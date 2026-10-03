---
title: Contrats feuilles séparés du store HUD
tags: [adr, architecture, ui, types]
status: accepte
updated: 2026-10-02
---

# ADR 0036 — Contrats feuilles séparés du store HUD

## Statut

Accepté. Remplace [ADR 0020](0020-state-feuille-de-dependances.md).

## Contexte

Le store `game/hud/state.ts` regroupait l’état Zustand, les types de présentation,
les types de flux et la pose initiale du portrait. Un contrôleur pur de
portrait devait importer ce fichier pour sa constante initiale, donc charger
Zustand. Le chargeur de niveau et le système d’armes portaient aussi des types
consommés par de nombreux autres modules.

La navigation XState vivait dans `ui/` alors qu’elle pilote le cycle de session.
L’ancienne règle de feuille du store évitait les cycles par duplication
manuelle des unions de cartes et d’armes.

## Décision

Les contrats partagés vivent dans des modules feuilles sans logique de moteur :
`app/navigation/gameFlowTypes.ts`, `game/hud/hudTypes.ts`, `game/level/loading/levelTypes.ts`,
`game/player/weapons/weaponTypes.ts` et `core/input/inputTypes.ts`. Le store consomme ces
contrats, sans importer leurs implémentations. Les valeurs initiales du
portrait vivent dans `game/session/presentation/portraitState.ts`, sans Zustand.

La machine de navigation appartient à `app/`. Les interfaces de composants
privées et les petits types locaux restent près du code qui les utilise.
Chaque import pointe vers le module propriétaire ; aucun barrel n’est ajouté.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Garder toutes les données partagées dans le store | impose une dépendance runtime à Zustand pour une constante pure |
| Importer les types depuis les implémentations du loader ou des armes | masque leur propriétaire et mélange les contrats aux dépendances moteur |
| Un fichier global `types.ts` pour tout le projet | déplace le nœud central sans organiser les domaines |
| Séparer chaque interface locale en un fichier | ajoute des déplacements sans réduire les dépendances |
| Encapsuler tous les calculs purs dans Effect | ne crée aucune capacité utile et élargit les interfaces |

## Conséquences

Les contrats de cartes et d’armes peuvent être réutilisés sans copier leurs
unions. Le portrait pur n’importe plus Zustand. Le flux de session n’importe
plus une implémentation située dans l’interface React. Le gameplay continue
de passer par `runGameplaySync` et React reste abonné au miroir de présentation.

Déplacer un contrat exige de mettre à jour les imports du jeu et des outils.
Ces fichiers feuilles doivent rester sans orchestration ni chargement.

## Comment on saurait qu’on a eu tort

Si les fichiers de contrats deviennent interdépendants ou importent les
implémentations moteur, l’extraction n’aura plus réduit le couplage. Un graphe
sans cycle et l’absence d’import runtime du store depuis les calculs purs
restent les critères à contrôler.
