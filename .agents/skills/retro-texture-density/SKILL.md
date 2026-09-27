---
name: retro-texture-density
description: Pipeline de textures rétro — densité de texels constante, tiling, trim sheets, quantification de palette, atlas versus array texture, réglages d'export. Charger pour toute tâche de texturing ou d'UV.
---

# Densité de texels et pipeline de textures

## La constante du projet

**64 texels par mètre.** Une texture de 128×128 couvre exactement 2 × 2 m et se
répète au-delà.

C'est le paramètre le plus important du texturing rétro, et le plus souvent
négligé. Si un mur est à 64 px/m et le sol voisin à 200 px/m, l'œil lit
immédiatement une incohérence — l'un paraît net, l'autre flou, et l'ensemble
perd l'unité qui fait le charme du look Build.

Repères historiques : Duke 3D tournait autour de 32 px/m, Ion Fury monte plus
haut. **64 px/m** place le projet entre les deux, ce qui correspond à la
direction annoncée.

## Vérifier la densité

Dans Blender, l'UV Editor affiche le ratio si on active une grille de
référence. En pratique, le plus fiable est un **damier de contrôle** :

1. Matériau temporaire avec une texture damier 128×128
2. Appliqué à tout le niveau
3. Les carreaux doivent avoir la **même taille apparente partout**

Un carreau plus gros signale une densité trop basse, plus petit une densité
trop haute. C'est une vérification visuelle, immédiate, et `level-forge` peut
générer le matériau de contrôle automatiquement.

## Tiling plutôt que grandes textures

Le plafond de 128×128 tient parce que les textures **se répètent**. Un mur de
4 m répète sa texture deux fois. C'est exactement le fonctionnement de Build,
et ça donne la bonne densité pour un coût mémoire nul.

En conséquence, les textures doivent être **tileables sans couture** — c'est
une contrainte de création, pas un détail technique.

## Trim sheets

Pour le détail architectural (plinthes, bandeaux, corniches, encadrements), une
**trim sheet** unique de 128×128 découpée en bandes horizontales évite de
multiplier les textures.

```
128 px
┌──────────────────────┐
│ plinthe        16 px │
│ mur bas        48 px │
│ bandeau        16 px │
│ mur haut       32 px │
│ corniche       16 px │
└──────────────────────┘
```

Les UV des pièces du kit se posent sur les bandes correspondantes. Une texture
couvre tout le vocabulaire architectural du niveau.

## Quantification de palette

Pour l'homogénéité, toutes les textures passent par la même palette réduite.

```bash
# Palette commune de 64 couleurs générée depuis l'ensemble des sources
magick montage sources/*.png -tile 8x -geometry +0+0 all.png
magick all.png -colors 64 -unique-colors palette.png

# Application, sans dithering (le dithering se fait en post au runtime)
magick input.png -resize 128x128 -dither None -remap palette.png output.png
```

Le dithering est appliqué **au runtime** dans le pipeline image, pas dans les
textures. L'appliquer deux fois produit des motifs d'interférence.

## Atlas ou array texture

Deux options côté runtime, et l'array texture est probablement meilleure ici.

| | Atlas | `DataArrayTexture` |
|---|---|---|
| Bleeding entre cases | oui, padding requis | **aucun** |
| Wrapping / tiling natif | non, calcul d'UV | **oui** |
| Mipmaps par case | contaminés | propres |
| Contrainte | aucune | **dimensions identiques** |

Toutes les textures du projet font 128×128. La contrainte de l'array texture
est donc déjà satisfaite, et elle élimine le padding et les calculs d'UV
d'atlas. Combinée à `BatchedMesh`, elle permet de rendre des objets à textures
différentes en un seul draw call.

L'atlas reste nécessaire pour les **sprites 8 directions**, où les cases sont
des frames d'animation et non des matériaux — mais là aussi une array texture
avec une couche par direction est envisageable.

## Réglages obligatoires

```ts
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestFilter;
texture.generateMipmaps = false;
texture.colorSpace = THREE.SRGBColorSpace;
texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
```

**Pas de compression KTX2 ni Draco** sur ce projet. La compression par blocs
détruit le pixel art : elle est conçue pour des textures photographiques et
introduit exactement le type d'artefact que la basse résolution rend visible.
Une texture 128×128 non compressée pèse 64 Ko — le problème n'existe pas.
