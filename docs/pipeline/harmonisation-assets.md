---
title: Harmonisation des assets du niveau v2
tags: [pipeline, assets, textures, niveau]
status: stable
updated: 2026-09-12
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

## Affiches de marques

Les illustrations viennent d'un générateur d'images, à partir des prompts de
[`assets_src/affiches/PROMPTS.md`](../../assets_src/affiches/PROMPTS.md) ; les
images brutes sont déposées dans `assets_src/affiches/raw/<nom>.png`.
`tools/textures/generate_affiches.py` en fait l'atlas `aff_affiches.png` :
détection de la bande vide du bas (les générateurs la font entre 19 et 27 %
de la hauteur), recadrage de l'illustration, réduction à 100 × 160 px, puis
nom et slogan en police pixel sur une bande repeinte aux couleurs de
l'étiquette du produit, et quantification sur la palette.

Le texte n'est jamais laissé à l'IA : réduit à 100 px de large, un texte lissé
devient illisible. Une affiche pas encore générée est simplement sautée, et
chacune a sa case réservée dans l'ordre de `AFFICHES` : en ajouter une ne
déplace jamais les autres.

**Deux exceptions assumées**, décidées le 2026-09-15 :

- **Densité** : 100 px pour une affiche de 1 m de large, la même exception
  que les étiquettes, et pour la même raison.
- **Taille** : l'atlas fait **512 × 512**, au-delà du plafond de 128 × 128.
  Ce plafond tient pour des textures qui se répètent sur un mur ; une affiche
  ne se répète pas. Quinze textures de 128 coûteraient quinze lots de dessin,
  et le niveau en compte déjà 186 sur 200 ; l'atlas unique n'en ajoute qu'un
  (187 mesuré en jeu). `validate_level.py` n'accepte ce plafond que pour les
  images `aff_*`.

**Où elles vont** : sur les deux flancs des têtes de gondole des rayons
(1 × 1,6 m, `uv="affiche:<nom>"`), l'affiche d'une marque du thème de la face
qui donne sur la même allée (`RY_AFFICHES`, `build_niveau.py`). Un thème sans
affiche disponible garde l'autocollant « PRIX CHOC ».

Pour ajouter des affiches : déposer les images, relancer
`generate_affiches.py`, puis reconstruire et exporter `niveau_v2` (voir
[`tools/blender/README.md`](../../tools/blender/README.md)).

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
   ont pas : c'est l'étagère qui porte la collision. **Les plafonds n'en ont
   jamais** : le bake du pathfinding prendrait leur dessus pour le sol (voir
   [Pathfinding](../systems/pathfinding.md)).
7. **Rangement** : une collection par asset (le rendu et son proxy
   ensemble), marquée comme asset dans la bonne catégorie de l'Asset
   Browser.
8. **Contrôle visuel** : vue silhouette à côté de trois voisins, puis
   capture à 640×360 depuis 1,6 m, comparée au board.

## La bibliothèque livrée (jalon N4)

37 assets, **générés par code** (`tools/blender/lib_rayons.py`) et non
modelés à la main. `lib_hypermarche_v2.blend` est donc un PRODUIT que
`build_library.py` régénère : on l'ouvre pour feuilleter, glisser un asset
dans une scène, contrôler une silhouette — jamais pour l'éditer.

| Catégorie | Assets |
|---|---|
| Mobilier de vente | gondole 4 m et 2 m, tête de gondole, bac promo, tourniquet, meuble réfrigéré 2 m, caddie |
| Signalétique | panneau d'allée suspendu, affiche promo suspendue, rampe de néons 4 m, bandeau de rayon 4 m |
| Structure | pilier 5 m |
| Déco | palette de cartons, poubelle |
| Produits | 13 marques inventées (boîtes à étiquette) + 10 modèles Kenney Food |

**Un objet par matériau, pas un par pièce.** Une gondole est faite d'une
vingtaine de boîtes, mais ne compte que quatre objets : tôle perforée,
rouge, acier, trim. La fusion au chargement ([ADR 0023](../decisions/0023-fusion-decor-au-chargement.md))
regroupant par matériau, découper plus finement coûterait vingt bakes et
vingt meshes pour exactement le même résultat à l'écran. La salle d'essai
entière tient en 13 lots de dessin.

**Les modèles tiers sont des ACCENTS, pas le fond du rayon.** Un modèle
Kenney coûte une centaine de triangles, une boîte à étiquette en coûte
douze. Garnir majoritairement en modèles donnait 88 000 triangles pour la
seule marchandise — l'essentiel du budget, pour un gain de silhouette
visible seulement de près. Ramenés à 12 % des articles (45 % dans le rayon
frais, où les silhouettes rondes font le sujet), la salle tombe à 96 000
triangles au total.

**Ce que les modèles Kenney apportent quand même** : tout le pack partage un
unique matériau `colormap`, donc dix références de produits ne coûtent
qu'un seul lot de dessin. Son atlas est requantifié sur notre palette et
réduit à 128 px par `tools/textures/make_kenney_atlas.py` — en NEAREST, car
ses UV visent le centre de pastilles unies qu'un filtre moyennant
mélangerait.

## Des rayons à thème, pas un tas

Premier retour de jeu sur la salle d'essai : « tout est mélangé ». Un rayon où
les marques sont tirées au hasard se lit comme un tas ; un rayon cohérent se
lit comme un magasin, et son bandeau devient une information d'orientation
plutôt qu'une décoration.

`lib_rayons.RAYONS` groupe les références en six catégories — épicerie,
boissons, petit déjeuner, entretien, conserves, frais — chacune mêlant marques
inventées et modèles Kenney. L'unité de cohérence est la **face** de gondole,
pas la gondole : ses deux faces donnent sur deux allées différentes et portent
chacune son thème et son bandeau. Une allée voit donc deux catégories voisines,
comme dans un vrai magasin.

Les **têtes de gondole restent volontairement mélangées** : c'est ce qu'est une
tête de gondole, un assortiment de promotions.

**Atlas de bandeaux** (`generate_banners.py` → `sig_bandeaux.png`/`.json`) :
huit bandes de 16 px, une par catégorie, au format du trim sheet — `lib_helpers`
fusionne les deux fichiers, seule la texture passée à l'asset change. Le trim
sheet était plein, et un bandeau de catégorie n'est de toute façon pas un profil
de menuiserie : c'est de la signalétique.

Chaque bande porte **sa couleur de fond**, et c'est elle qui travaille : à
640×360 et à vingt mètres, on reconnaît le rayon à sa couleur bien avant de lire
son texte. Un cyan pour FRAIS a d'ailleurs dû devenir blanc — quantifié sur la
palette, il tombait sur le bleu de BOISSONS et les deux rayons devenaient
indiscernables de loin.

## Un rayon garni se fabrique, il ne se modèle pas

`lib_rayons.stock_shelf` remplit une tablette : produit tiré au hasard,
nombre d'exemplaires de front variable, retrait en profondeur, trous dans la
rangée, léger dévers. Deux garde-fous sont nés du contrôle visuel :

- **jamais deux fois la même référence de suite** — les tirages produisaient
  des files de cinq paquets identiques, qui se lisent comme une erreur de
  copier-coller plutôt que comme un rayon ;
- **deux exemplaires de front au maximum** pour un produit large.

Le plan prévoyait un générateur en Geometry Nodes. Il a été écrit en Python
à la place : le bake d'éclairage travaille par sommet sur de la géométrie
réelle, donc des instances GN devraient de toute façon être réalisées avant
le bake, et une réalisation GN produit un mesh multi-matériaux que la fusion
au chargement refuse ([ADR 0023](../decisions/0023-fusion-decor-au-chargement.md)).
Le générateur Python produit un mesh par matériau, déterministe et rejouable
par graine. Rien n'est perdu côté visuel ; ce qui est perdu, c'est le réglage
interactif dans Blender.

## Trois pièges de composition trouvés en regardant

Aucun ne se voit sur un plan ; tous les trois se sont vus au rendu, à hauteur
d'œil.

1. **Un montant de gondole ne traverse pas la profondeur.** Traversant, il
   présente à l'allée un panneau plein de 1,25 m de large tous les deux
   mètres : la rangée se lit comme un mur rouge. Les montants sont au bord de
   chaque face, et débordent d'un centimètre vers l'extérieur — à fleur des
   tranches, les deux faces se disputeraient le z-buffer.
2. **Une tête de gondole a des flancs pleins.** On la regarde depuis
   l'entrée de l'allée, donc de biais : à flancs ouverts, on voit à travers
   ses étagères, garnies d'un seul côté, et l'entrée d'allée se lit comme un
   rayonnage vide. Ses flancs portent une affiche — un pan rouge de 1,25 × 2 m
   à hauteur de regard, sans rien dessus, n'est pas mieux.
3. **Un bac promo bas vaut mieux qu'un bac haut.** À 80 cm, les parois
   cachaient entièrement la marchandise et le bac se lisait comme une caisse
   grise. À 60 cm, avec un tas qui dépasse de la cuve, il redevient un bac.

## Regarder au bon champ de vision

Le jeu rend à 75° VERTICAL en 16:9, soit **107° horizontal**. Une capture
Blender à 32 mm (la valeur historique de `render_preview.py`) montre 60° de
moins et ment sur les bords de l'écran : au jalon N4, des rayons bien garnis
en capture se révélaient rasants et creux en jeu. Les deux outils de rendu
utilisent désormais 13,2 mm. `render_ingame.py` reconstruit en plus la
colorimétrie du jeu — texture × couleur de sommet, en émission pure, sans
transformation de vue.

## Nommage

Préfixe de catégorie, puis nom en français : `str_` (structure), `mob_`
(mobilier de vente), `prd_` (produits), `sig_` (signalétique), `deco_`
(déco), `gp_` (gameplay). Exemples : `mob_gondole_4m`, `prd_cereales_a`,
`sig_panneau_allee`, `gp_carte_argent`. Le proxy reprend le nom sans
préfixe de catégorie : `col_box_gondole_4m`.

Retour à la [carte de la documentation](../README.md).
