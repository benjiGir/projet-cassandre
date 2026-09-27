---
name: build-engine-look
description: Reproduction du look Build/Ion Fury en Three.js — résolution interne 640×360, filtrage nearest, matériaux Lambert, réduction de palette, dithering, ordre du pipeline image, liste des techniques à rejeter. Charger pour toute tâche de rendu ou d'apparence.
---

# Le look Build

## Les quatre ingrédients

Le look ne vient pas du moteur — Ion Fury tourne sur EDuke32, mais Cultic,
Dusk et Wrath obtiennent le même registre en 3D moderne. Il tient à :

1. **Résolution interne basse** (640×360) upscalée en nearest
2. **Ennemis en sprites billboard** pixel art, 8 angles
3. **Textures 128×128 max**, filtrage nearest, palette restreinte
4. **Géométrie anguleuse**, pas de courbes, pas de PBR

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
texture.minFilter = THREE.NearestFilter;
texture.generateMipmaps = false;
texture.colorSpace = THREE.SRGBColorSpace;
```

Dès qu'il faut du post-processing : `WebGLRenderTarget(640, 360)` avec
`NearestFilter`, puis quad plein écran en caméra orthographique.

## Liste de rejet

Techniques excellentes ailleurs, **fausses ici**. À refuser en expliquant le
coût sur l'identité visuelle :

| Technique | Pourquoi non |
|---|---|
| `MeshStandardMaterial` / PBR | la spécularité tue le look Build |
| Mipmaps, filtrage trilinéaire/aniso | le fourmillement fait partie du rendu |
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
présence de `NearestFilter` sur toutes les textures chargées, absence de
`MeshStandardMaterial` dans la scène, compte de draw calls.
