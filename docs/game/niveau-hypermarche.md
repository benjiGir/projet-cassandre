---
title: Le niveau — hypermarché
tags: [game, niveau]
status: stable
updated: 2026-09-06
---

# Le niveau — hypermarché

Registre `src/game/level/levels.ts` : remplace le hardcode
`levelParam === "zone_a_parking"` qui vivait dans `main.ts` (dette
documentée dans `CLAUDE.md`, Phase 5 Zone A). Forme volontairement minimale
(pas d'abstraction avant que la douleur soit réelle) — pas de spawn points
génériques ni de loadout complexe, juste ce que le jeu consomme réellement
aujourd'hui : quel builder appeler (`gym.ts` vs pipeline glTF), quel fichier
`.glb` charger, et si le joueur démarre désarmé. Ajouter une zone
supplémentaire est une ligne dans `LEVEL_CHOICES`, sans toucher au menu
(`src/ui/dev/LevelMenu/LevelMenu.tsx`) ni à l'ordre de boot.

## Zones individuelles

| Zone | `startUnarmed` | Rôle |
|---|---|---|
| Gym (test) | — | Instrument de mesure du character controller, voir [Plan du prototype — Phase 1](plan-prototype.md#phase-1-gym-instrument-de-mesure) |
| A — Parking | oui | Pied-de-biche au sol (`use_crowbar`), un Costard scellé hors `attackRange` — premier contact visuel, jamais punitif |
| B — Caisses | non (déjà armé depuis A) | Premier combat réel : Costards à portée dès l'entrée |
| C — Rayons | non | Couloirs entre rangées de gondoles — embuscades latérales dès qu'une ligne de vue s'ouvre dans une allée |
| D — Réserve | non | Première verticalité (mezzanine + escalier) — voir la note ci-dessous |
| E — Bureau | non | Le vrai Directeur (`spawn_director_1`), sortie verrouillée par `door_e_exit` (`use_exit_door`, déverrouillée par le badge droppé à la mort du Directeur) |
| Niveau complet — L'Hypermarché | oui | Les 5 zones fusionnées en un seul fichier connecté (couloirs réels, aucune coupure de chargement) — un seul `spawn_player` (celui de la Zone A), le pompe se ramasse via `use_shotgun` en Zone B |

Les 5 entrées individuelles (A à E) restent disponibles pour du test ciblé,
inchangées par l'existence du niveau combiné.

## Zone D — pas de spawn d'ennemi sur la mezzanine

Aucun `spawn_suit_*`/`spawn_director_*` n'est posé sur la mezzanine de la
Zone D : au moment de construire cette zone, `Suit`/`Director` n'avaient
aucun vrai pathfinding (seulement 3 rayons d'évitement local), et un ennemi
chassant un joueur au sol via l'escalier serait resté bloqué contre la
rambarde.

**Cette prémisse est maintenant partiellement dépassée** : depuis le jalon
M4, un vrai pathfinding 2.5D existe (`PathfindingService`, voir
[Pathfinding](../systems/pathfinding.md)), capable en principe de calculer un
chemin à travers un escalier. Mais aucune zone existante — Zone D comprise
— n'a été retouchée pour l'exploiter (décision explicite, hors scope de
M4, voir [Entités et IA — Navigation](../systems/entites.md#navigation)) :
poser un ennemi sur la mezzanine de la Zone D reste donc une décision de
level design séparée, à prendre consciemment, pas un acquis automatique du
nouveau système.

Retour à la [carte de la documentation](../README.md).
