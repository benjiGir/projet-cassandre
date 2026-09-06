---
title: Clone de texture par instance de sprite billboard
tags: [adr, rendu]
status: accepte
updated: 2026-09-05
---

# ADR 0017 — Clone de texture par instance de sprite billboard

## Statut

Accepté.

## Contexte

`BillboardSprite` (`src/render/billboard.ts`) sélectionne sa case d'atlas
(direction × frame) en mutant `material.map.offset`/`.repeat`. Si plusieurs
instances partagent le même objet `THREE.Texture` (un seul atlas chargé pour
~20 Costards), muter `.offset` sur l'une désynchronise TOUTES les autres :
elles partagent le même objet, donc le même offset — au rendu, tous les
sprites affichent la case du DERNIER `updatePose` appelé cette frame. Bug
quasi invisible à l'œil avec un seul sprite dans la scène, repéré à la
relecture avant qu'il ne se manifeste en jeu.

## Décision

Chaque `BillboardSprite` clone l'atlas passé à son constructeur
(`atlas.clone()`, `needsUpdate = true`) et ne mute plus que le
`.offset`/`.repeat` de SA PROPRE copie. L'image bitmap sous-jacente
(`texture.image`) reste partagée par référence entre tous les clones —
three.js ne redécode ni ne duplique les pixels sources, seul l'objet
`THREE.Texture` (filtre, offset, repeat, sa ressource GPU propre) est
dupliqué.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| UV par géométrie, atlas totalement partagé (une seule `THREE.Texture`, offsets encodés dans les UV de chaque `PlaneGeometry`) | plus économe en mémoire GPU, mais chaque instance a de toute façon besoin de sa propre géométrie (taille/ancrage vertical peuvent varier par instance) — pas d'économie réelle vu qu'une géométrie par instance est déjà allouée pour d'autres raisons |
| Un seul atlas partagé + sélection au shader (attribut d'instance, `InstancedMesh`) | prématuré : le skill `billboard-sprites-8dir` réserve cette voie au-delà de 30 sprites simultanés, le budget actuel (~20 Costards) reste sous ce seuil |

## Conséquences

Coût par instance : un objet JS léger + une texture GPU indépendante (mêmes
pixels), pas une image dupliquée — négligeable pour ~20 Costards simultanés.
`BillboardSprite.dispose()` doit libérer cette copie (`this.texture.dispose()`)
— ne jamais disposer l'atlas source partagé depuis une instance.

## Comment on saurait qu'on a eu tort

Si le nombre de sprites simultanés dépasse significativement ~30 (le seuil
`InstancedMesh` du skill) et qu'un profil GPU montre une pression mémoire
texture réelle liée à ces clones — pas avant, et pas sur une intuition non
mesurée.
