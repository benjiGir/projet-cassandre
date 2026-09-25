---
title: Machine XState de flux d'écran plutôt que rechargement de page
tags: [adr, ui, xstate]
status: accepte
updated: 2026-09-25
---

# ADR 0019 — Machine XState de flux d'écran plutôt que rechargement de page

## Statut

Accepté.

## Contexte

Avant le jalon M8 (`PLAN_EFFECT_XSTATE.md`, §10), la fin de partie (mort,
niveau terminé) et les boutons « Rejouer »/« Retour au menu principal »
passaient par `window.location.reload()`/`assign()` (`ui/screenNav.ts`) :
tout état de process (config de tuning à chaud, etc.) était perdu, et
« Rejouer » n'était jamais instantané. Le plan demandait un graphe d'état
**pur**, testable sans DOM/Three.js/Rapier, pour représenter les transitions
d'écran (`boot` → `mainMenu` → `playing` → `dead`/`levelComplete` → ...).

## Décision

`ui/gameFlowMachine.ts` déclare une machine XState à 7 états (`boot`,
`mainMenu`, `options`, `levelSelect`, `playing`, `dead`, `levelComplete`) et
les évènements qui les relient — sans connaître `PhysicsWorld`, `scene`, ni
`bootGameSession`/`teardownGameSession`. Un seul acteur pour toute la durée
de vie de l'onglet, créé une fois dans `main.ts`, jamais recréé par un
reset ; poussé côté React via `actor.subscribe(...)` vers `state.flowState`
(zustand), jamais `@xstate/react` (même pont que le reste du HUD, invariant
#2).

Le VRAI reset (dispose + reconstruction de `PhysicsWorld`/`SuitManager`/
`DirectorManager`/`WeaponSystem`/session de niveau) vit dans
`game/session/lifecycle.ts` (`replay`/`returnToMenu`), déclenché par les
mêmes boutons qui envoient `REPLAY`/`RETURN_TO_MENU` à l'acteur — voir
[Session de partie — Rejouer et retour au
menu](../systems/session.md#rejouer-et-retour-au-menu). Les écrans
(`DeathScreen`, `LevelCompleteScreen`) reçoivent `onReplay`/`onReturnToMenu`
comme de vraies fonctions en props, même pattern de callback que
`MainMenu`/`RebindScreen` (`onPlay`/`onOptions`/`onBack`) — pas un nouveau
module de registre global.

Le câblage RÉEL dans `main.ts` est volontairement plus grossier que la
table de transition : `resolveBootChoice`/`resolveLevelChoice`
(`game/session/bootChoice.ts`) gèrent déjà EUX-MÊMES la navigation interne
MainMenu/RebindScreen/LevelMenu via leurs propres `root.render()`
impératifs, sans envoyer d'évènement à l'acteur à chaque clic interne.
`main.ts` n'envoie que DEUX évènements autour de tout ce sous-flux :
`ENTER_MENU` juste avant de l'afficher (si `?level=` absent) et `PLAY` une
fois qu'il résout, quel que soit le chemin interne emprunté.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Garder `window.location.reload()`/`assign()` (`ui/screenNav.ts`) | perd tout état de process, aucun « Rejouer » instantané — contraire à l'objectif du jalon |
| Câbler `main.ts` avec la même granularité que la table de test (`OPEN_OPTIONS`/`BACK_TO_MENU`/`CHOOSE_ZONE` envoyés à chaque clic interne) | `resolveBootChoice`/`resolveLevelChoice` gèrent déjà cette navigation via leurs propres `root.render()` — dupliquer l'aiguillage dans l'acteur de flux créerait un second chemin de vérité pour le même sous-flux, jugé la partie la moins risquée à laisser telle quelle |

## Conséquences

- Les états `options`/`levelSelect` de la machine ne sont **jamais**
  atteints par l'acteur réel de l'application (rien ne lit
  `flowState === "options"` aujourd'hui) — seulement par les tests qui les
  exercent directement via `actor.send(...)`. Aucune régression
  fonctionnelle, mais un écart honnête entre la table testée et le câblage
  réel.
- `ui/screenNav.ts` est supprimé, plus aucun appelant.

## Comment on saurait qu'on a eu tort

Si du code en dehors des tests attend un jour que `flowState` vaille
`"options"` ou `"levelSelect"` (par exemple un composant qui réagirait à cet
état), il faudra câbler `main.ts` pour envoyer `OPEN_OPTIONS`/`CHOOSE_ZONE`
à l'acteur réel à ces moments-là — jusque-là, ces deux états sont des
artefacts de la table de transition, pas un comportement observable en jeu.

## Révision — pause (récap + pause EN JEU, 2026-09-24)

Un 8ᵉ état, `paused`, rejoint le graphe (`playing --PAUSE--> paused
--RESUME--> playing`, plus `paused --RETURN_TO_MENU--> mainMenu`) — voir
[Session de partie — Pause](../systems/session.md#pause). Contrairement à
`options`/`levelSelect` ci-dessus, `paused` **est** atteint par l'acteur
réel : `main.ts` envoie `PAUSE` sur perte du verrouillage du pointeur
pendant `playing`. Aucune remise en cause de la décision — la pause suit
exactement le même principe que `dead`/`levelComplete` (le monde reste
vivant, seul le contenu du pas fixe est ignoré) plutôt que d'introduire un
mécanisme séparé.

## Révision — chargement explicite et récupérable (2026-09-25)

Deux états complètent le graphe : `loading` interdit toute simulation pendant
la construction d’une session, et `loadFailed` attend une action explicite de
l’utilisateur. Le boot envoie `BEGIN_LOAD`; replay envoie `REPLAY` vers
`loading`; seul `waitForGameSessionReady` envoie `PLAY` après un commit réussi.
Un premier échec envoie `LOAD_FAILED`, puis le bouton « Réessayer » provoque
`RETRY_LOAD`. Le graphe représente ainsi la disponibilité réelle du monde au
lieu d’assimiler « session allouée » à « niveau jouable ».
