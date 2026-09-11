---
title: Harmonisation des assets du niveau v2
tags: [pipeline, assets, textures, niveau]
status: brouillon
updated: 2026-09-11
---

# Harmonisation des assets du niveau v2

Règles appliquées à tout ce qui entre dans la bibliothèque
`assets_src/library/lib_hypermarche_v2.blend` (voir `PLAN_NIVEAU_V2.md`,
jalon N3). Les packs CC0 ont chacun leur style (couleurs unies, atlas de
dégradés, textures photo) ; ces règles les ramènent à une seule langue
visuelle, celle du board ([Board de références](../assets/board-hypermarche.md))
et du style Build / Ion Fury.

## Textures

**Constante : 64 texels par mètre.** Une texture fait 128×128 et couvre
2 × 2 m. Pour une projection boîte, les UV valent la position monde
divisée par 2. Le matériau damier `mat_kit_checker` du kit sert de contrôle.

**Palette commune de 64 couleurs** (`assets_src/textures/palette.png` et
`palette.json`) : 56 couleurs obtenues par k-means (en Lab) sur trois
groupes de sources à poids égal — les images du board, les matériaux
ambientCG retenus, les atlas de couleurs des packs (Kenney, KayKit, Token
Gesture) — plus 8 accents de signalétique fixés à la main (rouge promo,
jaune, bleu enseigne, vert issue de secours, orange, magenta, quasi-noir,
quasi-blanc), que le k-means écraserait. `palette.json` donne aussi l'écart
moyen de quantification par groupe de sources.

**Fabrication** (Pillow, dans `.venv-refs/`) :

```bash
./.venv-refs/bin/python3 tools/textures/build_palette.py
./.venv-refs/bin/python3 tools/textures/make_textures.py            # toutes
./.venv-refs/bin/python3 tools/textures/make_textures.py sol_damier # une seule
```

`make_textures.py` décrit chaque texture par une source et des réglages
(`TEXTURES`). Pour chacune :

1. réduction de la source par un **facteur entier** (filtre BOX), qui garde
   la texture répétable sans joint ; `repeat` fixe combien de fois la
   source se répète dans les 2 m ;
2. contraste, saturation, luminosité et accentuation, calculés sur une
   copie 3×3 recadrée au centre, pour que les filtres voient les vrais
   voisins aux bords ;
3. quantification sur la palette **sans tramage** (le tramage éventuel se
   fait au rendu, pas dans la texture).

**Le relief se peint dans la couleur.** `MeshLambertMaterial` n'a ni carte
de normales ni relief : nervures, trous, losanges doivent apparaître dans
l'albedo, comme dans Build. Les matériaux ambientCG portent ce relief dans
leurs cartes de normales, que l'on jette ; `make_textures.py` repeint donc
les motifs par programme (`ribs`, `holes`, `stripes`). Leur période doit
diviser 128, sinon la texture ne se répète plus sans joint.

**Lisibilité avant échelle réelle.** À 640×360, un motif de 2 cm fait moins
d'un pixel. Les motifs fins (tôle, terrazzo, moquette) sont volontairement
grossis.

## Étiquettes et trim sheet

**Étiquettes de produits** (`generate_labels.py` → `prd_etiquettes.png` et
`prd_etiquettes.json`) : un atlas 128×128 de 16 cases de 32×32, une face de
produit par case — les 13 marques inventées validées le 2026-09-11 et trois
pastilles génériques (promo, prix choc, étiquette de prix). Le texte utilise
une police pixel 3×5 codée dans le script : une police lissée deviendrait
illisible une fois quantifiée. **Exception de densité assumée** : une face
de 30 cm porte 32 px, soit environ 100 px/m au lieu de 64 ; à 64 px/m, un
produit n'aurait qu'une vingtaine de pixels et aucun nom ne se lirait. Les
autres faces d'un produit échantillonnent la couleur de fond de sa case.
Marques et slogans : inventés, jamais inspirés d'une vraie marque.

**Trim sheet** (`generate_trims.py` → `trim_hypermarche.png` et
`trim_hypermarche.json`) : bandes horizontales répétables — tranche
d'étagère avec étiquettes de prix, plinthe, bandeau de rayon, bord de quai,
grille d'aération, néon, cornière, joint de caoutchouc. Les bornes
verticales de chaque bande sont dans le JSON. En U, 64 px/m (U = x / 2) ;
en V, la bande est étirée sur la hauteur de l'élément.

Les deux ont été vérifiés en 3D à 640×360 : noms et pictos lisibles à
1,5 m, tranche d'étagère immédiatement identifiable.

## Import d'un asset

Tout asset tiers passe par ces étapes, dans la collection `_RAW` de la
bibliothèque, avant d'être rangé dans `LIB_*` :

1. **Licence** : une ligne au [registre](../../assets_src/LICENCES_ASSETS.md)
   *avant* tout usage. Une ligne « à confirmer » ne va pas en jeu.
2. **Échelle** contre le repère `_ref_humain_1m80` ; rotation et échelle
   appliquées.
3. **Origine** au coin au sol (convention du kit), pas au centre.
4. **Matériau** : un seul par asset, Lambert en jeu (Principled à rugosité
   1 et spéculaire 0 dans Blender). Les atlas de couleurs des packs sont
   requantifiés sur la palette ; les surfaces qui le méritent (métal,
   carton, carrelage) reçoivent une texture de `assets_src/textures/`.
5. **Budget de triangles** (skill `prop-silhouette-design`) : prop courant
   100-500, prop signature 500-2 000. Au-delà, décimation `Planar` (angle
   10-15°), jamais `Collapse`.
6. **Proxy de collision** cuboid par défaut, nommé `col_box_<nom>` (skill
   `collision-proxy-authoring`). Les petits objets (produits en rayon) n'en
   ont pas : c'est l'étagère qui porte la collision.
7. **Rangement** : une collection par asset (le rendu et son proxy
   ensemble), marquée comme asset dans la bonne catégorie de l'Asset
   Browser.
8. **Contrôle visuel** : vue silhouette à côté de trois voisins, puis
   capture à 640×360 depuis 1,6 m, comparée au board.

## Nommage

Préfixe de catégorie, puis nom en français : `str_` (structure), `mob_`
(mobilier de vente), `prd_` (produits), `sig_` (signalétique), `deco_`
(déco), `gp_` (gameplay). Exemples : `mob_gondole_4m`, `prd_cereales_a`,
`sig_panneau_allee`, `gp_carte_argent`. Le proxy reprend le nom sans
préfixe de catégorie : `col_box_gondole_4m`.

Retour à la [carte de la documentation](../README.md).
