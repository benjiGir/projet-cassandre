---
title: Trains dans le pipeline de niveau
tags: [metro, trains, gltf, physique]
status: brouillon
updated: 2026-10-06
---

# Trains dans le pipeline de niveau

## Responsabilité et frontières

Les rames de ligne sont un danger mobile. Elles ne portent jamais le joueur.
La rame du voyage à bord reste dans le système distinct du
[prototype T4](prototype-voyage-rame.md).

Le [pilote de trafic](../assets/trains-metro.html) utilise le décor N4 et la
voiture Blender N3. Le pilote visuel accepté reste accessible séparément.
L’intégration est un candidat de T2 ; elle ne construit pas le blockout N5.

## Fichiers

| Rôle | Source |
|---|---|
| Contrat glTF | `src/game/level/trains/trainLevelData.ts` |
| Horaires et commandes | `src/game/level/trains/trainSystem.ts` |
| Trajets et contacts | `src/game/level/trains/trainPath.ts`, `src/game/level/trains/trainContact.ts` |
| Propriétaire du système | `src/game/level/trains/levelTrains.ts` |
| Navigation et lisibilité | `src/game/level/trains/trainNavigation.ts`, `src/game/level/trains/trainSafety.ts` |
| Mort, score et direct | `src/game/session/player/levelTrainGameplay.ts` |
| Présentation partagée avec T1 | `src/render/environment/trainGym/trainPresentation.ts` |
| Préparation du modèle | `src/render/environment/metro/warmTrainModel.ts` |
| Scénario du pilote | `src/game/level/trains/metroTrainEvents.ts` |
| Auteur Blender | `tools/metro/pilot/train_fixture.py` |
| Contrôle d’export | `tools/blender/validate_trains.py` |

## Place dans la boucle

### Cycle de vie

Le loader lit les métadonnées avant de fusionner le décor. Le modèle de voiture
reste séparé du décor statique. Ses géométries sont fusionnées entre elles,
puis partagées par les clones des trois voitures de chaque rame.

Le `LevelResources` possède les ressources GPU et les corps des trains.
Une fermeture ou un chargement rejeté libère les panneaux, les corps et le
modèle. Une racine suspendue pendant un hot reload arrête sa simulation.

Au chargement, la difficulté sélectionne une copie de configuration. Le
contrôle de lisibilité précède la cuisson du graphe. Le modèle est rendu sous
l’écran de chargement, sans frustum culling, pour amorcer les programmes et
les géométries. Cet amorçage reste à la frontière asynchrone du chargement.

Les horaires, commandes, déplacements et contacts avancent au pas fixe.
Le rendu interpole les poses. Les panneaux actualisent leur texte à 10 Hz.
Une commande de rejeu demande une remise à zéro traitée au prochain pas fixe.
Les commandes du script utilisent la même file que les boîtiers physiques.

### Contact

#### Contact mortel

Chaque voiture occupe un rectangle de 2,8 m de largeur et de 14,65 m de longueur.
Le contrôle balaie son déplacement entre deux pas, puis compare ce volume au
trajet de la capsule de l’acteur. Une marge couvre la rotation entre les poses.
La hauteur est mesurée depuis la voie, y compris aux altitudes négatives.

Le collider Rapier intercepte les tirs et les props. Il exclut le joueur :
celui-ci meurt au contact du volume balayé, sans être poussé ou transporté.
Les ennemis passent par leur circuit normal de mort, de gibs et de score.

`SessionStats` conserve `trainKills`, `trainCrossings`, `trainDeaths` et
`lastDamageSource`. Le récap distingue la mort par train et les traversées.
Une traversée complète fait un événement de direct `train`, sans don ; le chat
réutilise le thème `moment`. Son gain d’audience reste une valeur de candidat.

## Données et contrats

### Contrat Blender

| Objet | Métadonnées / sens |
|---|---|
| `voie_*` | `voie`, `trajet`, `points` (CSV ordonné de noms `rail_*`), `debut_visible`, `fin_visible`, `premier` facultatif (10 s), `active` facultatif (true) |
| `rail_*` | Empty de position ; segments non nuls, pente au plus 0,6 |
| `train_modele_*` | Un seul groupe de voiture, sans `col_*` enfant ; 15 × 2,8 × 3,2 m, centré en X/Z runtime, sol à Y=0 |
| `signal_train_*` | Empty : `voie`, `cap` facultatif en degrés ; panneau lisible des deux côtés |
| `nav_voie_*` | Box logique : `voie` ; exclut une portion de voie de l’IA |
| `traversee_train_*` | Box logique : `voie` ; exception à l’exclusion et compteur de traversée |
| `refuge_train_*` | Box logique : `voie` ; volume sûr pour le contrôle de distance |
| `use_*` | `voie`, `train: stop/switch`, `trajet` facultatif pour un aiguillage nommé |

Les boîtiers sont fixés aux murs. Leur origine `use_*` est placée sur la
fixation, à hauteur de commande, pour que la portée de 2 m corresponde au
boîtier visible. Les panneaux du quai restent hors du gabarit des rames.

Les boxes logiques n’ont pas de collider physique. Elles portent huit sommets
et disparaissent du rendu. Les points et marqueurs restent adressables par
leur nom Blender. Les variantes d’une même voie partagent l’horaire initial.

Les actions du script portent `kind: train`, `voie`, `commande` et un `trajet`
facultatif. Commandes : `enable`, `disable`, `pass`, `stop`, `switch`.
`pass` déclenche une rame unique sur une voie suspendue ; une voie régulière
conserve son horaire répétitif. Une rame déjà annoncée conserve son trajet.
L’arrêt retarde les suivantes et partage son délai de réutilisation par voie.

### Navigation

Le graphe est cuit avec les colliders statiques. Les cellules des volumes
`nav_voie_*` sont ensuite exclues, sauf dans les traversées de la même voie.
Les arêtes vers les cellules exclues et les diagonales qui coupent leur coin
sont retirées. Cela autorise les traversées balisées, sans donner aux ennemis
un trajet longitudinal dans le tube.

### Lisibilite

Au chargement, les intervalles visibles sont échantillonnés tous les quatre
mètres, extrémités comprises. Chaque point doit voir un panneau de sa voie
à moins de 20 m par un rayon dans les colliders du monde.

Le refuge le plus proche doit être atteignable en moins que le préavis :
distance horizontale / 9 m/s + 0,8 m de marge / 9 m/s + 1,58 s de réaction.
Ce contrôle de distance ne calcule pas un chemin autour des obstacles ; il
complète la revue visuelle et devra être repris sur le blockout.

| Difficulté | Vitesse | Préavis | Intervalle | Arrêt |
|---|---:|---:|---:|---:|
| Client | 18 m/s | 7 s | 30 s | 12 s |
| Habitué | 24 m/s | 5 s | 20 s | 8 s |
| Lanceur | 30 m/s | 4 s | 20 s | 5 s |

Réutilisation de l’arrêt : 30 s. Source : `trainDifficulty.ts` et variantes T1.

## Alerte sonore

Chaque rame déclenche une seule alerte lorsque le joueur entre dans son
préavis local, à moins de 20 m de sa voie. Un déplacement du joueur ne
réarme pas une rame déjà signalée. Le compte à rebours visuel reste actif.

`tools/audio/metro_ambiances.py` produit une alerte de 450 ms : deux sinus
600 / 450 Hz, avec enveloppes douces. `trainWarning.ts` la décode et amorce
ses deux sources pendant le chargement audio ; le gain de lecture est 0,22,
sans variation de pitch. Le réglage des effets et le volume général s’appliquent.
Le son de porte verrouillée et son atlas restent inchangés.

Le tintement de rail aléatoire a été retiré des zones du pilote ; il ne
correspondait à aucun passage réel. Les nappes et les gouttes restent actives.
Le roulement synchronisé et les annonces enregistrées restent au lot T3.

## Pièges

- Le pilote T2 masque ses extensions de voies par des bouches de tunnel.
  La bifurcation ligne / dépôt est hors champ ; les virages visibles de N5
  doivent être relus avec le gabarit réel des trois voitures.
- La présentation maintient les voitures horizontales. Le pilote utilise des
  voies planes ; les pentes doivent être adaptées avant leur emploi dans N5.
- Le pilote ne contient aucun ennemi : le circuit de kill est intégré, mais
  les situations de combat sur les voies attendent les rencontres de N7.
- La télémétrie distante vit sur la branche `feat/telemetrie`, absente ici.
  Les compteurs locaux sont prêts ; leur transmission reste à raccorder.
- Le contrôle de lisibilité repose sur les colliders : un mur seulement
  visuel peut masquer un signal sans être détecté par le rayon.

## Tests

Aucune suite de tests n’a été exécutée dans cette livraison. Le build,
le contrôle Blender et la revue visuelle sont consignés dans le
[journal T2](../journal/metro-trains-2026-10.md). Le gate automatisé prévu au
plan et les mesures sur le parcours complet restent ouverts.

## Comment vérifier

Ouvrez le [pilote de trafic](../assets/trains-metro.html). Les raccourcis
placent le joueur sur le quai ou dans un refuge. Les boîtiers répondent à E.
Le panneau de revue expose les commandes et l’état des horaires.

Pour reconstruire, utilisez `metro_trains` dans une session Blender neuve
avec `--factory-startup`, via `tools/blender/cassandre_cli.py`. Sorties :
`assets_src/blender/metro_trains.blend`, `public/assets/levels/metro_trains.glb`
et son manifeste d’espaces. Contrôlez ensuite `check strict=true audit=false`.

Voir aussi la [décision du pipeline des trains](../decisions/0044-trains-de-niveau.md)
et le [pilote visuel N4](pilote-metro.md).
