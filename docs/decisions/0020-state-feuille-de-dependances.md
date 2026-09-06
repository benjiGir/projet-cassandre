---
title: game/state.ts comme feuille de dépendances
tags: [adr, architecture, ui]
status: accepte
updated: 2026-09-06
---

# ADR 0020 — `game/state.ts` comme feuille de dépendances

## Statut

Accepté.

## Contexte

`game/state.ts` est le store zustand qui pont la boucle à pas fixe vers React
(voir [ADR 0003](0003-react-hors-boucle.md)) : tout `src/ui/*` importe
`useGameStore` depuis ce fichier (`DeathScreen.tsx`, `Hud.tsx`,
`HeroLine.tsx`, `HudMessage.tsx`, `DebugPanel.tsx`, `LevelCompleteScreen.tsx`).
Ce fichier ne dépend lui-même que de `zustand` — aucun `import` vers un autre
module de `src/game/*` (`entities/`, `level/`, `loop/`, `player/`,
`session/`, `devtools/`).

Deux champs de `DebugState`/`GameFlowState` recoupent pourtant du vocabulaire
possédé ailleurs : `activeWeapon: "none" | "melee" | "shotgun"` recopie
l'union de `WeaponSystem.activeWeapon` (`game/player/weapons.ts`), et
`GameFlowState` (7 états : `boot`/`mainMenu`/`options`/`levelSelect`/
`playing`/`dead`/`levelComplete`) est la table de clés d'état de
`ui/gameFlowMachine.ts`.

## Décision

`game/state.ts` n'importe jamais un autre module de `src/game/*`. Quand un
type doit être partagé avec le reste du jeu, deux tactiques selon le sens du
partage :

- **Le type est consommé par `src/ui/*`** : il est DÉFINI ici, pas dans
  `ui/*` puis importé — c'est le cas de `GameFlowState`. `ui/gameFlowMachine.ts`
  le réutilise tel quel pour ses clés d'état ; TypeScript vérifie la
  correspondance structurelle sans qu'aucun des deux fichiers n'ait besoin de
  dupliquer la liste des 7 états.
- **Le type est possédé par un module de gameplay** (`game/player/weapons.ts`
  pour `activeWeapon`) : l'union est RECOPIÉE À LA MAIN plutôt qu'importée.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Importer `ActiveWeapon` depuis `player/weapons.ts` | couple le store à `game/player` — une feuille de dépendances ne le reste pas si chaque type partagé futur emprunte le même chemin, jusqu'à faire de `game/state.ts` un nœud central du graphe |
| Définir `GameFlowState` dans `ui/gameFlowMachine.ts` et l'importer dans `game/state.ts` | inverse un sens déjà établi (`DeathScreen.tsx`/`Hud.tsx` importent déjà `useGameStore` DEPUIS `game/state.ts`) sans raison technique — le type se retrouverait du mauvais côté d'une frontière existante |

## Conséquences

- Les unions dupliquées (aujourd'hui, seulement `activeWeapon`) sont tenues
  synchronisées À LA MAIN. TypeScript ne vérifie la correspondance qu'aux
  points d'assignation réels (ex. `setDebug({ activeWeapon: weapons.activeWeapon })`),
  jamais que les deux déclarations de type restent identiques dans l'absolu.
- `game/state.ts` reste importable depuis n'importe quel module de
  `src/game/*` sans jamais créer de cycle, puisqu'il n'importe rien en retour
  de ce côté du graphe.

## Comment on saurait qu'on a eu tort

Si la duplication de `activeWeapon` dérive un jour en vrai bug (une valeur
acceptée par `weapons.ts` mais rejetée — ou l'inverse — par l'union de
`game/state.ts`), le coût de la synchronisation manuelle aura dépassé celui
du couplage qu'elle évite, et importer directement le type deviendra la
meilleure option.
