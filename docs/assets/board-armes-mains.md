---
title: Références et composition — armes et mains
tags: [assets, references, armes, viewmodel]
status: actif
updated: 2026-10-04
---

# Références et composition — armes et mains

Le pistolet, le pompe et leurs prises en main sont retravaillés à partir
des vues suivantes. Les photographies servent aux proportions et aux
silhouettes ; elles ne deviennent pas des textures du jeu.

## Board

| Vue observée | Source | Ce qui guide le modèle |
|---|---|---|
| Pistolet de profil | [Beretta 92FS Inox](https://www.beretta.com/en/product/92-fs-inox-P0049) | poignée inclinée, pontet courbe, chien ajouré, plaquettes sombres |
| Pistolet de dessus | [Photo de dessus Beretta](https://dam.beretta.com/content/dam/beretta-ita/firearms/products/90series_92fs-fullsize-inox/90Series_92FS-FullSize-Inox_9x19_TOP.tif/_jcr_content/renditions/Web-700.webp) | canon encadré de deux rails, dessus ouvert, chanfreins de culasse |
| Pistolet de dos | [Photo arrière Beretta](https://dam.beretta.com/content/dam/beretta-ita/firearms/products/90series_92fs-fullsize-inox/90Series_92FS-FullSize-Inox_9x19_DET2.tif/_jcr_content/renditions/Web-700.webp) | largeur de poignée, hausse séparée du chien, pouce sous la culasse |
| Pompe de profil | [Mossberg 590 Retrograde](https://www.mossberg.com/590-retrograde-52150.html) | crosse complète à pente douce, bois chaud, fût rainuré, deux tubes distincts |
| Paume en perspective | [Proko, section The Palm](https://www.proko.com/course-lesson/how-to-draw-hands-from-imagination-step-by-step) | poignet plus étroit, dos bombé, arc des articulations |
| Doigts et pouce | [Proko, sections The Fingers et The Thumb](https://www.proko.com/course-lesson/how-to-draw-hands-from-imagination-step-by-step) | quatre doigts de longueurs différentes, phalanges courbées et pouce opposé |

Les trois photographies du pistolet sont conservées localement dans
`refs/armes/pistolet/`, ignoré par Git. La source et les liens ci-dessus
permettent de reconstituer le board.

## Contraintes de composition

- **Pistolet** : environ 22 cm au sol, culasse inox claire et carcasse sombre.
  La [fiche du 92FS](https://www.berettadefense.com/products/92fs-bdt/)
  donne 217 × 137 × 38 mm. L'échelle ×1,25 en vue subjective et les visées
  élargies privilégient la lecture à 640 × 360.
- **Pompe** : environ 1,05 m au sol, canon et magasin séparés, fût d'environ
  19 cm. La référence Mossberg mesure 41 pouces, soit 1,0414 m. La crosse
  descend derrière la poignée ; le boîtier présente des épaules chanfreinées.
- **Mains** : paume d'environ 7 à 8 cm, poignet plus étroit, doigts séparés,
  auriculaire raccourci et pouce sous les parties métalliques mobiles.
  Les doigts se referment autour de la poignée ou du fût, plutôt que de
  traverser le dessus de l'arme.
- **Vue** : caméra Blender à l'origine, FOV vertical 75°, rendu 640 × 360.
  La mire reste dégagée. Le placement est porté par le modèle exporté.
- **Palette** : acier froid en trois valeurs, bois brun avec dessus plus
  clair, peau chaude et manches kaki. L'extraction des trois photos par
  `tools/refs/extract_palette.py` relève une saturation moyenne de 0,015 et
  des gris proches de `#25272a`, `#717275`, `#e2e3e5`. Les statistiques
  globales (luminance 0,24, écart-type 0,389, 72 % sombres) incluent les
  fonds des photos et ne servent pas à régler l'exposition du jeu.

## Construction et contrôle visuel

`tools/blender/build_weapons.py` conserve l'assemblage, les poses IK des
avant-bras et le contrat glTF. `tools/blender/weapons/` sépare palette,
géométrie, pistolet, pompe et mains. Les manches CC0 de Quaternius sont
conservées ; les mains figées sont remplacées par des volumes à phalanges
séparées, raccordés aux poignets du rig.

Les vues depuis l'œil, de profil et de dessus sont produites à chaque
itération. Les extras `prise`, `bout_canon` et `axe_glissiere` viennent des
mêmes coordonnées que la géométrie. La main gauche est fusionnée avec le
fût mobile ; les nouvelles formes doivent se regarder au repos et pendant
le pompage dans le jeu.

Décision de rendu : [ADR 0029 — armes en vue subjective](../decisions/0029-armes-en-vue-subjective.md).


## Livraison du 2026-10-04

Sources : `tools/blender/weapons/` et `assets_src/blender/armes.blend`.
Exports : `public/assets/weapons/armes.glb` et atlas des ramassages
`public/assets/sprites/weapon_pickups.png` (184 × 94 px).

Deux passes de prises en main ont été rendues et regardées de profil et
au format du jeu, puis une passe finale avec le dessus continu du pare-chaleur.
Le pistolet et le pompe sont aussi regardés dans le parking du jeu.
Le plancher lumineux de 0,32 conserve la lecture de la peau et de la culasse
inox dans cette zone sombre. Il ne remplace pas l'éclairage dynamique.

Les captures de travail restent dans `renders/armes/`, ignoré par Git.
La validation du ressenti et de la place occupée pendant le combat reste
un retour de jeu à recueillir auprès de l'utilisateur.

## Ajustement des poignets — 2026-10-04

Retour de l'utilisateur : le raccord des mains du pistolet et du
pied-de-biche paraît bizarre. La cible IK du poignet est désormais donnée
dans le repère de chaque main originale, près de sa base de paume, plutôt
que déduite du décalage de l'ancienne main CC0. Le coude du pistolet recule
et remonte pour réduire la cassure du poignet ; le poing du pied-de-biche
tourne de 65° autour de la barre et l'avant-bras suit cette prise.

Les vues de profil, de dessus et depuis l'œil sont rendues et regardées.
Les poses sont réexportées dans `armes.glb` et enregistrées dans
`armes.blend`. Les points de prise des armes restent ceux de la refonte.
