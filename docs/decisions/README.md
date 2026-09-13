---
title: Décisions techniques
tags: [adr, index]
status: stable
updated: 2026-09-13
---

# Architecture Decision Records

Un ADR répond à « pourquoi c'est fait comme ça ? ». Format et règles : skill
`adr-format`.

**Un ADR ne se supprime jamais.** Remplacé, il passe en statut `remplace` avec
un lien vers son successeur.

| # | Décision | Statut |
|---|---|---|
| [0001](0001-moteur-threejs.md) | Three.js vanilla plutôt que Godot, Unity ou R3F | accepté |
| [0002](0002-fixed-timestep.md) | Boucle à pas fixe 1/60 avec interpolation | accepté |
| [0003](0003-react-hors-boucle.md) | React en overlay DOM, jamais dans la boucle | accepté |
| [0004](0004-colliders-cuboid.md) | Colliders cuboid plutôt que trimesh | accepté |
| [0005](0005-eclairage-vertex-colors.md) | Éclairage baké en vertex colors | accepté |
| [0006](0006-air-strafing.md) | Air strafing façon Quake | **proposé** |
| [0007](0007-rng-deterministe.md) | RNG déterministe unique — DeterministicRandom | accepté |
| [0008](0008-collision-ennemi-ennemi.md) | Collision ennemi-ennemi activée | accepté |
| [0009](0009-machine-partagee-suit-director.md) | Machine XState partagée entre Costard et Directeur | accepté |
| [0010](0010-curseur-evenements-multi-pas-fixe.md) | Curseur explicite d'événements multi-pas-fixe, jamais inféré | accepté |
| [0011](0011-hot-reload-sondage-http.md) | Hot reload de niveau par sondage HTTP HEAD plutôt qu'un watcher fichier | accepté |
| [0012](0012-porte-collider-non-recentre.md) | Collider de porte non recentré automatiquement dans loader.ts | accepté |
| [0013](0013-garde-flux-vs-monde-physique.md) | Deux gardes distinctes — état de flux vs existence du monde physique | accepté |
| [0014](0014-gameengine-persistentengine-separes.md) | GameEngine et PersistentEngine séparés plutôt qu'un champ session nullable | accepté |
| [0015](0015-rampe-lineaire-lissage-vue.md) | Rampe linéaire plutôt qu'approche exponentielle pour le lissage de vue | accepté |
| [0016](0016-garde-fous-degenerescence-kcc.md) | Deux garde-fous contre la dégénérescence de `computeColliderMovement` | accepté |
| [0017](0017-clone-texture-sprite-billboard.md) | Clone de texture par instance de sprite billboard | accepté |
| [0018](0018-physique-jouet-debris-cosmetiques.md) | Physique jouet plutôt que Rapier pour les débris cosmétiques | accepté |
| [0019](0019-machine-xstate-flux-ecran.md) | Machine XState de flux d'écran plutôt que rechargement de page | accepté |
| [0020](0020-state-feuille-de-dependances.md) | `game/state.ts` comme feuille de dépendances — jamais d'import vers `src/game/*` | accepté |
| [0021](0021-export-vertex-color-enum.md) | `export_vertex_color="ACTIVE"` plutôt que `export_colors` (export glTF Blender 5.x) | accepté |
| [0022](0022-occlusion-rangees-non-bloquante.md) | Occlusion des rangées de kit non fiable pour la ligne de vue ennemie | remplacé par 0025 |
| [0023](0023-fusion-decor-au-chargement.md) | Fusion du décor statique au chargement plutôt qu'instanciation GPU | accepté, granularité révisée par 0026 |
| [0024](0024-eclairage-hybride.md) | Éclairage hybride — lampes temps réel et ombre cuite | accepté |
| [0025](0025-occlusion-lignes-de-vue-cause-racine.md) | L'occlusion des lignes de vue ennemies est fiable, et le level design peut s'y fier | accepté |
| [0026](0026-visibilite-par-espace-et-pool-de-lampes.md) | Visibilité par espace et pool de lampes, plutôt que streaming ou WebGPU | accepté |
| [0027](0027-filtrage-des-textures-reduites.md) | Mipmaps et anisotropie sur les textures réduites, gros pixel conservé à l'agrandissement | **proposé** |
