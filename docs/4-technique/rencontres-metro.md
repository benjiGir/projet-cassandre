---
title: Rencontres du métro
tags: [metro, ennemis, script]
status: brouillon
updated: 2026-10-09
---

# Rencontres du métro

Première implantation jouable, à ajuster au playtest. Elle utilise les
Costards, Vigiles et Rampants existants. Le Contrôleur n'est pas encore
implémenté ; ce travail ne clôt pas l'ensemble du lot N7.

## Parcours et effectifs

Les effectifs appliquent les règles existantes de difficulté, groupe par
groupe : moitié / trois quarts / totalité, arrondi au plus proche, minimum
un. Les gardes sont dans leurs propres groupes pour rester présents en Client.

| Rencontre | Rôle | Client | Habitué | Lanceur d'alerte |
|---|---|---:|---:|---:|
| Quartier | Costards devant les façades, après les premiers soins | 2 | 2 | 3 |
| Billetterie | Tireurs côté ouest, Vigile derrière les portiques | 2 | 3 | 3 |
| Quai sud | Tireurs sur les deux quais | 2 | 2 | 3 |
| Quai nord | Deuxième ligne de tireurs, garde du passage de maintenance | 2 | 3 | 3 |
| Galerie, entrée | Rampants au-delà du premier seuil | 1 | 2 | 2 |
| Galerie, coude | Meute au-delà de la distribution technique | 2 | 2 | 3 |
| Galerie, retour | Meute avant le retour au tunnel | 1 | 2 | 2 |
| Dépôt | Tireurs dans le hall, garde du chemin d'embarquement | 3 | 3 | 4 |
| Accès au poste | Vigile dans le passage ouest ; cabine et escalier libres | 1 | 1 | 1 |
| Machinerie | Tireurs sur le pourtour, puis deux Rampants | 2 | 4 | 4 |
| Rame, première vague | Rampants après 10 secondes de voyage | 1 | 2 | 2 |
| Rame, seconde vague | Rampants après 30 secondes de voyage | 2 | 2 | 3 |
| Quai privé | Costards activés à l'arrivée effective | 1 | 2 | 2 |
| Parvis | Tireurs sur les côtés, Vigile devant l'entrée de la tour | 3 | 3 | 4 |
| **Total du parcours** | | **25** | **33** | **39** |

Le GLB contient 44 marqueurs : les deux vagues possèdent chacune une
implantation nord et sud, mutuellement exclusives. À chaque vague, le
contrôleur choisit l'extrémité opposée à la moitié de rame occupée par le
joueur. Les cinq marqueurs de l'autre implantation ne sont pas réveillés.

Les déclencheurs ordinaires sont sur le parcours, avant les positions de
combat. Aucun ennemi n'est placé dans un gabarit ferroviaire, la cabine du
guichet, une volée d'escalier ou la fosse de la machinerie. Les petits locaux
et les tunnels conservent des pauses. La progression n'exige pas de tuer
tous les ennemis et ne ferme aucune nouvelle porte d'arène.

## Ressources

Treize ramassages réemploient les billboards du jeu : **225 PV de soins** et
**168 balles de pistolet**, distribués entre rue, billetterie, vestiaire,
entrée du dépôt, machinerie, rame et sortie sur le parvis. Les premiers
soins sont dans la rue, avant le premier déclencheur. Ils restent des
trousses pour cette passe ; la nourriture prévue dans le plan, les secrets,
bornes, armes et l'économie finale restent à traiter.

Ces totaux sont des ressources posées : les plafonds du joueur peuvent en
réduire le gain effectif. Les munitions `use_*.munitions` rechargent le
pistolet uniquement. La campagne conserve l'équipement du niveau précédent ;
le lancement isolé de la page d'auteur ne prouve pas l'équilibre d'une
arrivée pauvre ou riche.

## Contrats et fichiers

| Responsabilité | Fichier |
|---|---|
| Positions, volumes et ramassages Blender | `tools/metro/blockout/encounters.py` |
| Contrôle des appuis et dégagements à la construction | `inspect_positions` dans ce même module |
| Scénarios, délais et annonces | `src/game/level/blockout/metroEncounterEvents.ts` |
| Choix des deux extrémités et événement d'arrivée | `src/game/level/blockout/metroBlockout.ts` |
| Catalogue `metro` et `blockout_metro` | `src/game/level/catalog/levels.ts` |
| Lancement spatial ou explicite d'un scénario | `src/game/level/scripting/levelScript.ts` |
| Réveil, difficulté et alerte | `src/game/session/progression/levelScriptActions.ts` |
| Alerte après matérialisation | `src/game/entities/suit/suit.ts` |
| Liaison au pas fixe | `src/game/loop/updateGameplay.ts` |
| Reconnaissance des événements et groupes à l'export | `tools/blender/validate_level.py` |

Les `spawn_*` portent `groupe`, les douze `trig_*` portent `evenement`.
Un groupe ne se réveille qu'une fois par partie : les deux entrées de la
machinerie partagent la même rencontre. Tous les réveils utilisent l'effet
d'apparition TSL existant. Les annonces de cette passe sont textuelles.

Les vagues sont comptées par le temps de simulation du voyage, sans temps
mural. Elles sont annoncées 0,25 seconde avant le réveil et ne partent que
si le joueur est à bord. Le bitmask `rideWaves` survit au hot reload avec
l'état du voyage ; les événements lancés et les groupes réveillés sont
conservés par l'état du script de niveau.

`reveiller.alerte` demande une alerte unique une fois la matérialisation
terminée. Le Rampant entre ensuite dans sa machine habituelle de poursuite :
il peut rejoindre un joueur qui reste à plus de sa portée de perception à
l'autre bout de la rame. La télégraphie et les pertes de contact ordinaires
restent actives. Le mode auteur `notarget` coupe cette poursuite.

## Revue locale et limites

Le [manifeste d'implantation](../assets/blockout-metro/rencontres.json)
donne les positions Blender, les déclencheurs et les appuis contrôlés sur
les colliders réels. Deux positions initiales trop proches du mobilier du
quartier et d'un mât du parvis ont été déplacées. Les capsules utilisent
les rayons réels de chaque espèce. Ce contrôle de placement ne prouve pas
qu'un chemin reste franchissable pendant un combat.

La [page d'auteur](../assets/blockout-metro.html) expose les rencontres,
l'état des ennemis, la neutralisation des attaques et le nettoyage des
acteurs pour les observer séparément. Suspendre le trafic avant une
téléportation sur une voie. Ces commandes sont réservées à la revue.

Les [observations datées](../journal/metro-blockout-2026-10.md#première-passe-de-rencontres--9-octobre)
distinguent placement, déclenchement et poursuite observée. La compilation
de production passe ; aucune suite de tests n'a été lancée. Une partie
complète avec combats, les profils d'arrivée pauvre et riche, le réglage
des ressources et la variante nord des vagues restent à juger.
