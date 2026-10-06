---
title: Décisions techniques
tags: [adr, index]
status: stable
updated: 2026-10-04
---

# Architecture Decision Records

Un ADR explique pourquoi un choix a été retenu, les options écartées et ses
conséquences. Le format est défini par le skill `adr-format`. Un ADR remplacé
reste conservé et renvoie à son successeur.

## Moteur et présentation

| # | Décision | Statut |
|---|---|---|
| [0001](0001-moteur-threejs.md) | Three.js vanilla plutôt que Godot, Unity ou React Three Fiber | accepté |
| [0002](0002-fixed-timestep.md) | Simulation à pas fixe de 1/60 s avec interpolation | accepté |
| [0003](0003-react-hors-boucle.md) | React en overlay DOM, hors de la boucle de jeu | accepté |
| [0005](0005-eclairage-vertex-colors.md) | Éclairage baké en vertex colors plutôt qu'en lightmap | accepté |
| [0015](0015-rampe-lineaire-lissage-vue.md) | Lissage de caméra linéaire, avec une latence mesurable | accepté |
| [0024](0024-eclairage-hybride.md) | Lampes temps réel et ombre cuite en vertex colors | accepté |
| [0027](0027-filtrage-des-textures-reduites.md) | Mipmaps et anisotropie à la réduction, nearest à l'agrandissement | proposé |
| [0028](0028-sprites-ennemis-pre-rendus.md) | Sprites d'ennemis pré-rendus depuis un modèle CC0 | accepté |
| [0034](0034-resolution-interne-configurable.md) | Résolution interne configurable, 640×360 proposé comme défaut | proposé |
| [0035](0035-materiaux-tsl-cibles.md) | Matériaux TSL ciblés via l'adaptateur WebGL | accepté |
| [0039](0039-abandon-du-plafond-de-lots.md) | Abandon du plafond de lots de dessin | accepté |

## Simulation, mouvement et combat

| # | Décision | Statut |
|---|---|---|
| [0004](0004-colliders-cuboid.md) | Colliders simples plutôt que trimesh pour les objets de jeu | accepté |
| [0006](0006-air-strafing.md) | Air strafing inspiré de Quake | proposé |
| [0007](0007-rng-deterministe.md) | Un seul RNG déterministe pour permettre le rejeu | accepté |
| [0008](0008-collision-ennemi-ennemi.md) | Les ennemis se bloquent physiquement entre eux | accepté |
| [0010](0010-curseur-evenements-multi-pas-fixe.md) | Curseur explicite pour consommer les événements sur plusieurs pas | accepté |
| [0016](0016-garde-fous-degenerescence-kcc.md) | Deux garde-fous contre la dégénérescence du contrôleur Rapier | accepté |
| [0018](0018-physique-jouet-debris-cosmetiques.md) | Débris cosmétiques pilotés par une physique jouet | accepté |
| [0033](0033-rng-presentation-et-portee-du-rejeu.md) | RNG de présentation séparé et limites explicites du rejeu | accepté |
| [0038](0038-simulation-du-direct.md) | Simulation du direct : audience, dons et chat dans le pas fixe | accepté |

## Entités et cycle de vie

| # | Décision | Statut |
|---|---|---|
| [0009](0009-machine-partagee-suit-director.md) | Une machine XState partagée pour le Costard et le Directeur | accepté |
| [0014](0014-gameengine-persistentengine-separes.md) | Séparer le moteur persistant de la session de jeu | accepté |
| [0019](0019-machine-xstate-flux-ecran.md) | Machine de flux d'écran plutôt qu'un rechargement de page | accepté |
| [0020](0020-state-feuille-de-dependances.md) | Garder `game/hud/state.ts` comme feuille de dépendances | remplacé par 0036 |
| [0036](0036-contrats-feuilles-et-store-hud.md) | Séparer les contrats feuilles du store HUD et des implémentations | accepté |

## Niveau, chargement et objets

| # | Décision | Statut |
|---|---|---|
| [0011](0011-hot-reload-sondage-http.md) | Détecter les changements de niveau par sondage HTTP | accepté |
| [0012](0012-porte-collider-non-recentre.md) | Conserver le collider de porte à son origine glTF | remplacé par 0031 |
| [0013](0013-garde-flux-vs-monde-physique.md) | Distinguer l'état de flux du monde physique chargé | accepté |
| [0017](0017-clone-texture-sprite-billboard.md) | Cloner la texture pour chaque instance de sprite billboard | accepté |
| [0021](0021-export-vertex-color-enum.md) | Utiliser l'option d'export vertex color de Blender 5.x | accepté |
| [0022](0022-occlusion-rangees-non-bloquante.md) | Ne pas faire confiance à l'occlusion des rangées pour la visée | remplacé par 0025 |
| [0023](0023-fusion-decor-au-chargement.md) | Fusionner le décor statique au chargement | accepté, précisé par 0026 |
| [0025](0025-occlusion-lignes-de-vue-cause-racine.md) | Autoriser le level design à s'appuyer sur l'occlusion testée | accepté |
| [0026](0026-visibilite-par-espace-et-pool-de-lampes.md) | Visibilité par espace et pool de lampes plutôt que streaming | accepté |
| [0029](0029-armes-en-vue-subjective.md) | Armes 3D en vue subjective, tenues par des bras CC0 | accepté |
| [0030](0030-props-dynamiques.md) | Props dynamiques dans un groupe de collision distinct | accepté |
| [0031](0031-portes-animees-et-vitres.md) | Portes animées et vitres cassables avec colliders pilotés | accepté |
| [0032](0032-sanitaires-utilisables.md) | Sanitaires utilisables, soignants et cassables | accepté |
| [0037](0037-script-de-niveau.md) | Script de niveau par volumes déclencheurs et scénarios nommés | accepté |
| [0040](0040-bornes-et-perks.md) | Bornes et perks : achat en partie, effets posés sur la session | accepté |
| [0041](0041-explosifs.md) | Explosifs : une matière de prop, un souffle dans le pas fixe | accepté |
| [0042](0042-difficulte.md) | Difficulté : trois niveaux posés sur la partie, records séparés | accepté |
| [0044](0044-trains-de-niveau.md) | Trains pilotés par les données glTF, contacts balayés et ressources par niveau | accepté |
