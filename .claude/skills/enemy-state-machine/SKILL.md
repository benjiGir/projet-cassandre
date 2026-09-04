---
name: enemy-state-machine
description: Machine à états des ennemis (XState partagée Suit/Director), télégraphie d'attaque, lisibilité du combat, pathfinding 2.5D + évitement local, mort et gibs. Charger pour toute tâche sur les entités hostiles ou l'IA de combat.
---

# Ennemis et lisibilité du combat

## Le critère de qualité

Ce n'est pas la sophistication de l'IA. C'est la **lisibilité**. Un ennemi
simple et lisible fait un meilleur combat qu'un ennemi malin et confus.

## Machine à états

```
IDLE ──(vue joueur)──> ALERTE ──> POURSUITE ──> TIR
  ^                                  ^          │
  │                                  └──────────┘
  └──(perte de contact, 5 s)─────────┘
                                              RECUL ──> POURSUITE
                                     (dégâts)  ^
                                               │
  n'importe quel état ──(pv <= 0)──> MORT ──> CADAVRE
```

**Chaque état a une pose de sprite distincte.** Un état invisible pour le
joueur est un état inutile : supprime-le plutôt que de l'implémenter.

Implémentée comme une **seule machine XState partagée** entre Costard et
Directeur (`src/game/entities/enemyMachine.ts`, jalon M5 de
`PLAN_EFFECT_XSTATE.md` — avant, deux implémentations dupliquées). Aucune
transition retardée par `after` (`setTimeout` réel) : toute durée d'état
(`alertDuration`, `attackTelegraphDuration`, `staggerDuration`,
`deathFrameDuration`...) vit dans `context.stateTimer`, décrémentée par un
évènement `TICK` envoyé une fois par pas fixe avec le `gameplayDt` réel —
sinon le hitstop ne ralentirait plus les ennemis. Voir invariant #13 de
`CLAUDE.md` et le skill `effect-xstate-cassandre`.

## Les quatre règles de lisibilité

1. **Toute attaque a une télégraphie.** Au moins une frame d'anticipation
   visuelle **et** un son distinct, avant les dégâts. Minimum 200 ms — en
   dessous, le joueur ne peut physiquement pas réagir.
2. **Le joueur sait toujours qui lui tire dessus.** Trois ennemis qui tirent
   simultanément hors champ = combat raté, quelle que soit la qualité de l'IA.
   Un son directionnel distinct au moment de la télégraphie suffit.
3. **Le feedback de dégâts est triple** : flash blanc sur le sprite, knockback,
   son. Les trois. Un seul ne se lit pas en pleine action.
4. **La mort est immédiatement claire** : animation dédiée, son dédié,
   changement de silhouette. Le joueur doit pouvoir arrêter de tirer.

## Navigation

**Un vrai pathfinding 2.5D existe** (`PathfindingService`,
`src/game/level/pathfinding.ts`, jalon M4 de `PLAN_EFFECT_XSTATE.md`) : un
graphe de praticabilité baké par niveau, pas seulement l'évitement local
d'avant. L'évitement à 3 rayons (avant, avant-gauche 30°, avant-droit 30°)
décrit ci-dessous **reste utilisé** pour l'esquive fine à courte portée —
les deux coexistent, ce n'est pas un remplacement.

```ts
// 3 rays : avant, avant-gauche 30°, avant-droit 30°
// si l'avant est bloqué, dévier vers le côté le plus dégagé
```

Un ennemi coincé derrière une gondole reste acceptable au stade prototype.
Si le level design produit trop de blocages, c'est d'abord le niveau qu'on
corrige. Aucune zone existante n'a été retouchée pour exploiter le vrai
pathfinding (décision explicite, hors scope de M4) — poser un ennemi sur une
mezzanine ou dans un escalier reste une décision de level design séparée à
prendre consciemment, pas un acquis automatique du nouveau système.

## Contraintes techniques

| Aspect | Règle |
|---|---|
| Architecture | `Entity[]` + `update(dt)` + `switch`. Pas d'ECS. |
| Temporalité | tout dans le pas fixe, timers en nombre de steps, jamais `Date.now()` |
| Budget | 20 ennemis actifs à 60 fps stable |
| Allocation | pool fixe pour cadavres, gibs, projectiles — zéro alloc par frame |
| Déterminisme | RNG seedé par entité, pas de `Math.random()` global |

## Diagnostic

- Mosaïque 6 états × 8 directions, caméra fixe — repère les cases d'atlas
  manquantes
- Overlay de debug par ennemi : état courant, cible, temps dans l'état
- Snapshot perf à 20 ennemis simultanés

## Signal d'alarme

Si les performances s'écroulent à 10 ennemis, **arrête et profile** avant
d'ajouter quoi que ce soit. C'est un problème d'architecture (allocations par
frame, draw calls, raycasts non budgétés), pas une optimisation à faire plus
tard. Remonte-le au `director`.
