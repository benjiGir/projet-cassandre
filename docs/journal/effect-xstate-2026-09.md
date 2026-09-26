---
title: "Effect-TS et XState — livré le 2026-09-04"
tags: [journal, architecture]
status: stable
updated: 2026-09-26
---

# Effect-TS et XState — livré le 2026-09-04

Chantier Effect-TS/XState (M0-M9) — Livré (2026-09-04).** Détail jalon
> par jalon dans `docs/journal/plan-effect-xstate-2026-09.md`. Effect orchestre maintenant toute
> la boucle jeu — gameplay (M6), raycasting (M3), pathfinding (M4), rendu et
> interpolation (M7) — derrière une frontière synchrone stricte unique
> (`runGameplaySync`, invariant #11 ci-dessus) ; `loader.ts`/`hotReload.ts`
> sont entièrement retrofités vers Effect (M2, erreurs typées, mêmes
> comportements observables qu'avant — principe transverse #4 du plan).
> Costard et Directeur partagent désormais une seule machine XState
> (`enemyMachine.ts`, M5) au lieu de deux implémentations dupliquées. Le
> flux d'écran (menu → jeu → mort/fin de niveau → reset) tourne sur une
> machine XState dédiée (`gameFlowMachine.ts`, M8) au lieu de
> `window.location.reload()` — vrai reset en place, plus de rechargement de
> page. Un vrai pathfinding 2.5D existe maintenant (`PathfindingService`,
> M4) ; aucune zone existante n'a été retouchée pour l'exploiter (hors
> scope, décision actée en §0 du plan) — poser un ennemi sur une mezzanine
> reste une décision de level design séparée à prendre consciemment.
>
> **Action §11.2 du plan ("retirer la note de duplication Suit/Director de
> CLAUDE.md") vérifiée sans effet à faire ici** : aucune note de ce type
> n'existe littéralement dans ce fichier — le seul endroit qui la
> documentait était les commentaires de tête de `suit.ts`/`director.ts`,
> déjà mis à jour AU jalon M5 lui-même ("dédupliqué avec lui au jalon M5").
> Rien à retirer dans ce fichier.
>
> **Écart trouvé pendant M9, corrigé le 2026-09-05** (tâche de suivi
> dédiée, hors scope du jalon documentation lui-même) : le RNG déterministe
> n'était pas unifié derrière le service `DeterministicRandom` malgré
> l'invariant #12 — `weapons.ts` (dispersion du pompe) et
> `enemyMachine.ts::createEnemyPrng` gardaient chacun leur propre copie
> locale de mulberry32 plutôt que d'obtenir leur générateur via ce service.
> Les deux routent maintenant vers `DeterministicRandom.forSeed` (via
> `runGameplaySync(DeterministicRandom.useSync(...))`, même pattern que les
> appels `RaycastService.use(...)` déjà en place) ; `mulberry32` n'existe
> plus qu'à un seul endroit, `src/core/random.ts`. Aucune régression de
> déterminisme (même algorithme, mêmes graines) : `pnpm build`/`pnpm test`
> verts (116/116) avant et après, y compris les tests à valeurs de
> référence de `random.test.ts`/`suit.test.ts`/`director.test.ts` qui
> recalculent l'algorithme indépendamment plutôt que de comparer le code à
> lui-même.
>
> `pnpm build` propre, `pnpm test` vert (116/116) au moment de ce jalon.
> Skills mis à jour pour refléter ces patterns : `enemy-state-machine`
> (pathfinding + machine XState partagée), `fixed-timestep-loop`
> (`runGameplaySync`), `react-hud-bridge` (pont XState → zustand, même
> discipline que le reste du HUD), `gltf-level-conventions` (retrofit
> Effect de `loader.ts`/`hotReload.ts`) ; nouveau skill dédié
> `effect-xstate-cassandre` pour les deux patterns propres à ce projet
> (frontière synchrone stricte, timer manuel au lieu de `after`) que les
> agents spécialisés (`core-loop`, `entity-designer`, `level-pipeline`,
> `shell`) peuvent charger sans redécouvrir le plan à chaque fois.
>
>
