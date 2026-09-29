---
title: Board de références — motos du parking
tags: [assets, references, motos, parking]
status: brouillon
updated: 2026-09-29
---

# Board de références — motos du parking

Deux motos originales prolongent la bibliothèque de véhicules. Les références
fixent les proportions et les traits de catégorie. Aucun badge ni élément de
carrosserie propre à un constructeur n'est repris.

## Références

### Motocross

- [Fiche constructeur Yamaha YZ250F](https://cdn2.yamaha-motor.eu/prod/product-assets/2026/YZ250F/Factsheets/2026-YZ250F_en.pdf) : longueur 2,185 m, empattement 1,48 m, hauteur de selle 0,97 m et garde au sol 0,35 m.
- [Présentation Yamaha YZ250F](https://www.yamaha-motor.eu/al/en/motorcycles/competition/pdp/yz250f/) : roues hautes et étroites, longues suspensions, selle plate et garde-boue dégagés.

### Custom basse

- [Caractéristiques Harley-Davidson Street Bob 114](https://serviceinfo.harley-davidson.com/sip/service/procedure/2209382485329242859/BLAISE/1323672/en_US?nid=4866&uid=1323672) : empattement 1,63 m et selle chargée à environ 0,66 m ; la longueur de 2,32 m vient de la [fiche 2024 du constructeur](https://members.staging.harley-davidson.com/us/en/motorcycles/2024/street-bob.html).
- [Gamme cruiser Harley-Davidson](https://www.harley-davidson.com/es/es/motorcycles/2024/cruiser.html) : posture basse, moteur en V exposé, réservoir compact et garde-boue proches des pneus.

## Modèles proposés

| Modèle | Dimensions | Silhouette | Détails visibles |
|---|---|---|---|
| Motocross | 2,18 × 0,86 × 1,28 m | haute et légère | pneus à crampons, fourche longue, plaques et garde-boue orange |
| Custom | 2,32 × 0,92 × 1,16 m | basse et allongée | moteur en V, phare rond, réservoir prune, deux échappements |

Les deux modèles pointent leur avant vers +Y Blender et posent leurs roues sur
Z=0. Chaque GLB est un seul objet avec un matériau à couleurs de sommets.
La source est `assets_src/blender/propositions_motos.blend`. Les exports et
aperçus sont dans `assets_src/blender/propositions_motos/` ; le script de
construction est `tools/blender/propositions_motos.py`.
