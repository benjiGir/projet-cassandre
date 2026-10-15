---
title: Nouveaux équipements des sanitaires
tags: [assets, magasin, direction-artistique]
status: brouillon
updated: 2026-10-12
---

# Nouveaux équipements des sanitaires

## Objectif

Décrire les cabines accessibles, lavabos et miroirs du magasin.
Les matières suivent la [charte commune](../5-guides/direction-artistique.md).


## Équipements

| Élément | Assemblage |
|---|---|
| Trois cabines | Largeur intérieure minimale 2,20 m, profondeur 2,87 m, passage de porte 1,30 m. Cloisons, pieds et lisse métallique. |
| Portes | Vantaux de 2 m, charnières, poignée et verrou. Ouvertes au départ ; `E` les ouvre et les ferme. |
| Deux lavabos | Vasques ovales creusées de 1,44 m de large, rebord, bonde, robinet et siphon apparent. |
| Trois cuvettes | Pied et cuvette arrondis, anneau de siège distinct, réservoir et bouton de chasse. Porte-papier dans chaque cabine. |
| Deux urinoirs | Dos creusé et vasque inférieure, bonde et arrivée d’eau. Séparation centrale. |
| Deux miroirs | Surface de 1,36 × 1,13 m, cadre métallique et reflet dynamique de la pièce. |

Les matières restent celles de la charte : faïence ivoire, stratifié vert
pétrole et métal mat. La céramique utilise la palette commune.
Le sol partagé, les murs de la pièce, sa porte d’accès et ses lampes gardent
leur assemblage. Les nouveaux passages et équipements ont leurs proxies de
collision ; les cuvettes et urinoirs conservent leur contrat `sanitaire_*`
(un mesh, un matériau, `sorte`, `pv: 50`).

## Reflets

Les panneaux `wc_miroir0` et `wc_miroir1` portent `miroir: true`.
Le [rendu au chargement](chargement-de-niveau.md#miroirs)
installe un reflet plan par surface, à 640×360 avec agrandissement nearest.
Les reflets suivent le déplacement et montrent la pièce, ses meubles et ses
lampes. Les armes en vue subjective et les autres miroirs sont cachés dans
le passage réfléchi. Le [corps animé du héros](reflet-du-heros.md) apparaît
uniquement dans les reflets.

Les shaders des reflets sont amorcés pendant le chargement.
L’implémentation utilise le [Reflector officiel de Three.js](https://threejs.org/docs/pages/Reflector.html).
La planche Blender montre les panneaux de pose gris ; le reflet est installé
par le runtime et se juge dans le jeu.

## Sources et reprise

- `tools/blender/lib_restrooms.py` : équipements, UV et portes.
- `tools/level_v2/espaces/toilettes.py` : raccord au build normal et lampes.
- `tools/art_direction/store_restrooms.py` : faïence, stratifié et métaux.
- `tools/blender/refresh_restroom_assets.py` : remplacement local et export.
- `src/render/environment/levelMirrors.ts` : passage réfléchi et libération.
- `src/render/environment/warmLevelMirrors.ts` : préparation au chargement.

```sh
blender -b assets_src/blender/niveau_v2.blend \
  -P tools/blender/cassandre_cli.py -- rework_restrooms
```

La copie avant retouche reste dans
`renders/_cassandre/niveau_v2_avant_sanitaires_assets.blend`, lorsqu'elle
existe localement. Le relevé est écrit dans
`renders/reviews/sanitaires-assets/deploiement.json`.

## Revoir dans le jeu

Rejoindre les sanitaires du magasin. Entrer dans chacune des trois cabines,
fermer et rouvrir leurs portes avec E, puis observer les lavabos et les
reflets en se déplaçant. Les captures et la page de comparaison de la refonte
ont été retirées après leur utilisation.
