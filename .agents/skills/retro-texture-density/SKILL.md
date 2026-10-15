---
name: retro-texture-density
description: Pipeline de textures rétro — densité de texels constante, tiling, trim sheets, quantification de palette, atlas versus array texture, réglages d'export. Charger pour toute tâche de texturing ou d'UV.
---

# Densité de texels et pipeline de textures

## Référence courante — 10 octobre 2026

Les instructions de `AGENTS.md` font foi en cas de divergence. Le code utilise
actuellement mipmaps et anisotropie à la réduction (ADR 0027 encore proposé),
et conserve nearest à l’agrandissement. L’exclusivité Lambert est retirée ;
il n’y a plus de plafond de lots (ADR 0039). La charte artistique candidate
et son étalon sont dans `docs/5-guides/direction-artistique.md` ; leur
validation artistique appartient à l’utilisateur.

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

Les matières répétées de référence en 128×128 tiennent parce que les textures **se répètent**. Les atlas, petits objets et illustrations ont des dimensions adaptées, documentées comme exceptions. Un mur de
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

Pour l’homogénéité, les matières de décor partagent des familles de couleurs et des rampes. Le magasin utilise déjà une palette réduite commune ; les sous-palettes du métro restent adaptées à ses zones.

```bash
# Palette commune de 64 couleurs générée depuis l'ensemble des sources
magick montage sources/*.png -tile 8x -geometry +0+0 all.png
magick all.png -colors 64 -unique-colors palette.png

# Application, sans dithering (le dithering se fait en post au runtime)
magick input.png -resize 128x128 -dither None -remap palette.png output.png
```

Le renderer courant ne possède pas de passe de tramage global. Les motifs déjà peints se jugent à 640×360 ; leur superposition avec un futur tramage demande une comparaison visuelle.

## Atlas ou array texture

Deux options côté runtime, et l'array texture est probablement meilleure ici.

| | Atlas | `DataArrayTexture` |
|---|---|---|
| Bleeding entre cases | oui, padding requis | **aucun** |
| Wrapping / tiling natif | non, calcul d'UV | **oui** |
| Mipmaps par case | contaminés | propres |
| Contrainte | aucune | **dimensions identiques** |

Une array texture est une option pour des couches de dimensions identiques. Le dépôt contient aussi des atlas et illustrations plus grands ; elle ne constitue pas une migration imposée du pipeline actuel. Combinée à `BatchedMesh`, elle permet de rendre des objets à textures
différentes en un seul draw call.

L'atlas reste nécessaire pour les **sprites 8 directions**, où les cases sont
des frames d'animation et non des matériaux — mais là aussi une array texture
avec une couche par direction est envisageable.

## Réglages obligatoires

```ts
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestMipmapLinearFilter;
texture.generateMipmaps = true;
texture.colorSpace = THREE.SRGBColorSpace;
texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
```

**Pas de compression KTX2 ni Draco** sur ce projet. La compression par blocs
détruit le pixel art : elle est conçue pour des textures photographiques et
introduit exactement le type d'artefact que la basse résolution rend visible.
Une texture 128×128 non compressée pèse 64 Ko — le problème n'existe pas.
