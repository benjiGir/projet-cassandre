---
title: textures
tags: [pipeline, rendu, textures]
status: stable
updated: 2026-09-05
---

# textures

Taille max et filtrage sont déjà figés dans [Conventions de nommage](../reference/conventions-nommage.md)
(128×128 max, `NearestFilter`) — ce document couvre le *comment*, pas les
valeurs retenues.

## Contrat `configureRetroTexture`

`render/renderer.ts::configureRetroTexture` applique le look rétro
(invariant #4) à une texture : `NearestFilter` en mag/min, pas de mipmaps,
`SRGBColorSpace`. Toute texture chargée ou générée à l'exécution doit passer
par cette fonction — c'est la seule source de vérité pour ce réglage côté
`render/`.

`game/level/loader.ts` applique le même triplet `NearestFilter`/pas de
mipmaps directement (sans appeler `configureRetroTexture`), pour les
textures qui arrivent déjà chargées par `GLTFLoader` — voir [Rendu —
Invariant #5](../systems/rendu.md#invariant-5-reconversion-depuis-gltfloader).
Deux implémentations indépendantes du même invariant plutôt qu'une fonction
partagée : à surveiller si l'une des deux dérive de l'autre.

## Atlas placeholder de billboard

`render/billboard.ts::createPlaceholderAtlas` génère par canvas un atlas
`columns × rows` (8×10, voir [Rendu — Sprites billboard 8
directions](../systems/rendu.md#sprites-billboard-8-directions)). Il a tenu
lieu de sprite d'ennemi jusqu'aux atlas pré-rendus
([ADR 0028](../decisions/0028-sprites-ennemis-pre-rendus.md)) ; il ne sert plus
que de repli quand une planche de `public/assets/sprites/` ne se charge pas.
Chaque case fait 32×48 px et porte :

- un fond teinté par COLONNE (teinte HSL tournant sur 360°/`columns`, donc
  la colonne `direction = 0` a toujours la même teinte reconnaissable d'un
  atlas à l'autre) ;
- le couple `"col.row"` en texte, le moyen le plus direct de vérifier à
  l'œil qu'une case correspond bien à la direction/frame attendue sans
  mémoriser une convention de flèche ;
- un padding transparent de 1 px autour de chaque case, pour éviter le
  bleeding d'atlas en `NearestFilter` (l'imprécision flottante sur les UV
  proches d'une frontière de case reste un risque même sans mipmaps).

Configuré avec `configureRetroTexture` ci-dessus, comme toute texture de ce
module.

Retour à la [carte de la documentation](../README.md).
