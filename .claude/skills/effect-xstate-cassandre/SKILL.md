---
name: effect-xstate-cassandre
description: Patterns Effect-TS/XState spécifiques à PROJET_CASSANDRE — frontière synchrone stricte du pas fixe, RNG déterministe unique, machines XState sans temps mural. Charger avant toute tâche qui touche à Effect (services, layers, erreurs typées) ou XState dans ce repo, en complément du skill générique `effect-ts`.
---

# Effect + XState dans PROJET_CASSANDRE

Ce skill documente les patterns propres à ce repo (issus de
`PLAN_EFFECT_XSTATE.md`, jalons M0-M9), pas les concepts génériques d'Effect
ou XState. Pour ceux-là : skill `effect-ts` (bootstrap) et
`node_modules/effect/AGENTS.md` (référence complète, à lire **en entier**
avant tout code Effect nouveau — pas seulement ce skill).

## Les deux frontières, jamais mélangées

| Mode | Fonction d'entrée | Où | Interdit dedans |
|---|---|---|---|
| Synchrone strict | `runGameplaySync` (`src/core/runtime.ts`) | pas fixe (`updateGameplay`) ET rendu/interpolation (`interpolateVisuals`, `render`) | `Effect.tryPromise`/`Effect.promise`/`Effect.async`/`Effect.sleep` |
| Asynchrone à la frontière | `GameRuntime.runPromise`/`runFork` | chargement de niveau, hot-reload (`game/level/loader.ts`/`hotReload.ts`) | tout appel depuis `updateGameplay` |

`runGameplaySync` est la **seule** porte d'entrée synchrone vers
`GameRuntime` — ne jamais appeler `GameRuntime.runSync`/`Effect.runSync`
directement ailleurs dans le pas fixe ou le rendu. Si un Effect de cet arbre
suspend par erreur, `Runtime.runSync` lève un defect ; le garde-fou de
`runGameplaySync` l'intercepte et logge un message explicite en console
plutôt que de crasher silencieusement (cohérent avec le choix assumé du
plan : "aucun budget de perf fixé à l'avance, on ajuste si un problème
apparaît en jeu"). Ne pas avaler cette erreur ailleurs — la laisser
remonter.

Le rendu (M7) n'a **pas** de fonction séparée type `runRenderSync` : il
réutilise `runGameplaySync` tel quel, y compris pour `RenderService.use(...)`.
Un seul garde-fou, deux usages.

**Exception non négociable** (invariant #3 de `CLAUDE.md`) : la lecture de
la rotation caméra reste un accès brut, direct, sans passer par un service
Effect — l'indirection ajouterait de la latence de visée.

## RNG déterministe

Service canonique : `DeterministicRandom` (`src/core/random.ts`), une
fabrique de générateurs mulberry32 indépendants (`forSeed(seed)`), fournie
par `DeterministicRandom.layer` dans `GameLayer`. Jamais `Math.random()`,
jamais le service `Random` par défaut d'Effect — le rejeu d'input (F9/F10,
`core/inputRecorder.ts`) dépend de cette continuité.

**Écart connu (trouvé au jalon M9, pas corrigé) :** `weapons.ts` (dispersion
du pompe) et `enemyMachine.ts::createEnemyPrng` gardent chacun leur propre
copie locale de l'algorithme mulberry32 plutôt que d'obtenir leur générateur
via `DeterministicRandom`. Aucune régression de déterminisme (implémentations
identiques bit à bit, toutes seedées) — seulement une centralisation non
terminée. Si tu touches l'un de ces deux fichiers pour une autre raison,
router vers le service canonique est un bon petit nettoyage de passage ; ce
n'est pas un prérequis bloquant pour du travail sans rapport.

## XState sans temps mural

Interdiction des transitions retardées `after` (`setTimeout` réel) dans
**toute** machine XState de ce projet. Pattern à la place :

```ts
// Dans le context de la machine :
stateTimer: number;

// Un évènement TICK envoyé une fois par pas fixe, avec le dt RÉEL du
// gameplay (celui qui inclut le hitstop — GameClock.tick()) :
send({ type: "TICK", dt: gameplayDt });

// Dans le handler de l'état concerné :
ctx.stateTimer += dt;
if (ctx.stateTimer >= ctx.cfg.alertDuration) {
  // transition
}
```

Sans ça, le hitstop ne ralentirait plus les ennemis — régression invisible
en lecture de code, mais réelle en jeu. Voir `game/entities/enemyMachine.ts`
(machine partagée Costard/Directeur, jalon M5) pour l'implémentation
canonique, y compris pourquoi certains champs (`attackCooldownRemaining`,
`timeSinceLastSeen`) sont délibérément **exclus** de `stateTimer` (doc de
tête du fichier).

**Cette contrainte n'a de sens que pour les machines qui ont des durées
d'état.** `src/ui/gameFlowMachine.ts` (flux d'écran, jalon M8) n'a AUCUN
timer — chaque transition est un évènement discret (clic, mort, sortie de
niveau) — donc la règle y est vacuously vraie, pas quelque chose à
implémenter en plus.

## Où poser un nouveau service Effect

`GameRuntime`/`GameLayer` (`src/core/runtime.ts`) est la racine de
composition unique — un nouveau service (`Context.Service<...>`) rejoint
`GameLayer` via `Layer.mergeAll`, jamais une `Layer` ad hoc construite
ailleurs. Exemples existants : `RaycastService` (M3), `PathfindingService`
(M4), `RenderService` (M7). Le chargement de niveau (`loader.ts`) est
l'exception délibérée : ce sont des `Effect.gen` plats appelés directement
via `GameRuntime.runSync`/`runPromise`, pas un `Context.Service` dédié — il
tourne à la frontière asynchrone, jamais dans le pas fixe, donc l'indirection
d'un service n'apporte rien ici.

## Anti-patterns

| Anti-pattern | Conséquence |
|---|---|
| `Effect.tryPromise`/`Effect.sleep` dans un arbre passé à `runGameplaySync` | defect au runtime, pas fixe cassé |
| `GameRuntime.runSync` appelé directement au lieu de `runGameplaySync` | perte du garde-fou, erreur silencieuse possible |
| Nouvelle `Layer` construite hors de `GameLayer` | service invisible aux autres, double instanciation |
| `after` dans une machine XState de gameplay | hitstop ignoré par cette machine |
| `@xstate/react` | interdit par le plan — le pont vers React reste zustand (`actor.subscribe(...)`), voir skill `react-hud-bridge` |
| Nouveau générateur RNG ad hoc au lieu de `DeterministicRandom.forSeed(...)` | risque de casser le rejeu d'input si mal seedé |
