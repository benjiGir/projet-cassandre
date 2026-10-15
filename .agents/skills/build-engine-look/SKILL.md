---
name: build-engine-look
description: Reproduction du look Build/Ion Fury en Three.js — résolution interne 640×360, filtrage nearest, matériaux Lambert, réduction de palette, dithering, ordre du pipeline image, liste des techniques à rejeter. Charger pour toute tâche de rendu ou d'apparence.
---

# Le look Build

## Référence courante — 10 octobre 2026

Les instructions de `AGENTS.md` font foi en cas de divergence. Le code utilise
actuellement mipmaps et anisotropie à la réduction (ADR 0027 encore proposé),
et conserve nearest à l’agrandissement. L’exclusivité Lambert est retirée ;
il n’y a plus de plafond de lots (ADR 0039). La charte artistique candidate
et son étalon sont dans `docs/5-guides/direction-artistique.md` ; leur
validation artistique appartient à l’utilisateur.

## Les quatre ingrédients

Le look ne vient pas du moteur — Ion Fury tourne sur EDuke32, mais Cultic,
Dusk et Wrath obtiennent le même registre en 3D moderne. Il tient à :

1. **Résolution interne basse** (640×360) upscalée en nearest
2. **Ennemis en sprites billboard** pixel art, 8 angles
3. **Textures répétées de référence en 128×128**, nearest à l’agrandissement, rampes de couleurs contrôlées ; tailles adaptées pour atlas et illustrations
4. **Silhouettes franches**, courbes segmentées utiles, matières mates

## Configuration

```ts
// Phase 0 — le pas cher
renderer.setPixelRatio(1);
renderer.setSize(640, 360, false);   // false = ne touche pas au CSS
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = false;
```

```css
canvas { width: 100vw; height: 100vh; image-rendering: pixelated; }
```

```ts
// Sur TOUTES les textures
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestMipmapLinearFilter;
texture.generateMipmaps = true;
texture.colorSpace = THREE.SRGBColorSpace;
```

Dès qu'il faut du post-processing : `WebGLRenderTarget(640, 360)` avec
`NearestFilter`, puis quad plein écran en caméra orthographique.

## Liste de rejet

Techniques excellentes ailleurs, **fausses ici**. À refuser en expliquant le
coût sur l'identité visuelle :

| Technique | Pourquoi non |
|---|---|
| Spécularité brillante généralisée | concurrence le traitement mat proposé ; juger les effets ciblés dans leur contexte |
| Lissage à l’agrandissement | efface le gros pixel ; mipmaps et anisotropie à la réduction restent compatibles |
| SSAO / GTAO | l'occlusion douce contredit le pixel art |
| Ombres cascadées | trop douces, trop chères, hors registre |
| TAA / FXAA / MSAA | **le crénelage est intentionnel** |
| Bloom global | acceptable uniquement sur muzzle flash, seuil très haut |
| Tone mapping filmique | reste en `NoToneMapping` |
| Diffusion atmosphérique, volumétrique | hors sujet pour un hypermarché |

Cette liste inverse volontairement les recommandations des packs graphiques
Three.js orientés photoréalisme. C'est délibéré.

## Ordre du pipeline image

Contraint. Le dithering **après** l'upscale produit un motif à la mauvaise
échelle et annule l'effet :

```
scène → RT 640×360 → réduction palette → dithering Bayer 4×4 → upscale nearest
```

## Réduction de palette (optionnel, phase tardive)

```glsl
// Quantification par canal + dithering ordonné
float bayer = texture2D(bayerTex, gl_FragCoord.xy / 4.0).r - 0.5;
vec3 c = color + bayer / levels;
c = floor(c * levels + 0.5) / levels;
```

`levels = 16` à `32` donne un rendu Build crédible sans devenir illisible.

## Éclairage

`MeshLambertMaterial` + lumières ponctuelles à portée courte + une ambiante
généreuse. Le contraste vient des **textures**, pas de l'éclairage dynamique.
Un niveau Build est éclairé par ses textures et sa lumière de secteur, pas par
un système d'ombres.

## Diagnostic

Vérifier systématiquement : résolution interne réelle du drawing buffer,
présence de `NearestFilter` à l’agrandissement, filtrage de réduction conforme au réglage choisi, traitement visuel des matériaux classiques et TSL, compte de draw calls comme indicateur.
