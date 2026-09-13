---
title: Mipmaps et anisotropie sur les textures RÉDUITES, gros pixel conservé à l'agrandissement
tags: [adr, rendu, invariants, niveau-v2]
status: propose
updated: 2026-09-13
---

# ADR 0027 — Filtrage des textures réduites

## Contexte

Retour de playtest sur le niveau v2 habillé : « cette espèce de sensation
étrange très pixelisée pour les zones qui se trouvent loin. Ce n'est pas très
agréable à regarder. » La demande qui l'accompagnait était de monter la
résolution interne d'un cran pour voir.

L'[invariant #4](../../CLAUDE.md) dit : « Résolution interne 640×360, upscalée.
`NearestFilter` sur toutes les textures, `generateMipmaps = false`. »

## Le diagnostic, et pourquoi ce n'est pas la résolution

Deux réglages distincts se cachent derrière « ça pixelise », et ils n'ont pas
le même effet :

- la **résolution interne** donne un gros pixel UNIFORME sur toute l'image.
  C'est le look recherché, et il ne gêne personne au premier plan ;
- le **filtrage de réduction** décide de ce qui se passe quand une texture de
  128 px ne couvre plus que trois pixels à l'écran. En `NearestFilter` sans
  mipmap, le fragment échantillonne un texel presque au hasard dans la
  texture : le résultat grésille, moiré, et **rampe dès que la caméra bouge**.

Le second explique exactement le symptôme décrit — « étrange », « loin »,
« pas agréable à regarder ». Et monter la résolution ne le corrigerait pas :
plus de pixels, c'est plus de fragments qui échantillonnent au hasard. Le
grain serait plus fin, le crénelage identique, et le look du jeu perdu au
passage.

## Décision

**`magFilter` reste `NearestFilter`, toujours et dans tous les modes. La
réduction passe en `NearestMipmapLinearFilter` avec anisotropie maximale.**

C'est l'agrandissement qui porte le look du jeu : c'est lui qui fait le gros
pixel franc quand on colle une texture de près. La réduction, elle, ne porte
aucune intention artistique — elle ne portait que du crénelage.

Trois modes existent dans le code (`FiltrageTexture`,
`src/render/renderer.ts`), commutables en jeu pour comparer sur la même vue :

| Mode | Réduction | Ce qu'on voit |
|---|---|---|
| `nearest` | `NearestFilter`, pas de mipmap | le réglage historique, et le grésillement |
| `mipmap` | `NearestMipmapLinear` | le grésillement disparaît, les sols rasants floutent |
| **`aniso`** | idem + anisotropie ×16 | **défaut** — les sols rasants restent nets |

L'anisotropie n'est pas un luxe ici : un grand sol vu en fuyante est le pire
cas du mipmap classique, qui le floute d'un coup à mi-distance. Or ce niveau
est fait de grandes salles qu'on traverse au ras du sol.

`cassandre.filtrage("nearest" | "mipmap" | "aniso")` rebascule toutes les
textures chargées sans recharger le niveau — la seule façon honnête de juger un
défaut qui ne se voit qu'en mouvement. `cassandre.resolution(l, h)` fait de
même pour la résolution interne.

## Ce que ça coûte

Mesuré sur le niveau v2 complet, même point de vue, `renderBench(80)` :
**0,36 ms en `nearest`, 0,93 ms en `mipmap`, 0,96 ms en `aniso`** — pour un
budget d'image de 16,6 ms. Le mipmap ajoute aussi un tiers de mémoire de
texture, sur des atlas de 128 px : négligeable.

**Limite connue de cette mesure** : le banc capte surtout le temps CPU de
soumission des commandes (voir [Ce que coûte une image](../systems/cout-de-rendu.md)).
Il voit un écart réel entre les modes de filtrage, mais il ne voit PAS le coût
de remplissage — c'est pourquoi le même banc ne montre aucune différence entre
640×360 et 1920×1080, ce qui ne prouve évidemment pas que la résolution est
gratuite.

## Amendement proposé à l'invariant #4

> **Résolution interne 640×360**, upscalée. **`NearestFilter` à
> l'AGRANDISSEMENT sur toutes les textures** — c'est lui qui fait le look.
> La RÉDUCTION utilise des mipmaps et l'anisotropie (ADR 0027) : sans eux, les
> surfaces lointaines grésillent, ce qui n'est pas du cachet rétro mais du
> crénelage.

**Cet amendement attend la validation de l'utilisateur** — c'est son invariant,
et c'est son œil qui juge. Le code tourne en `aniso` par défaut pour que le
jugement se fasse sur pièce ; `cassandre.filtrage("nearest")` revient au
comportement historique en un appel.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| **Monter la résolution interne** | Ne corrige pas la cause (voir le diagnostic) et abandonne le gros pixel, qui est le look du jeu. La manette existe pour comparer, mais le défaut par défaut ne bouge pas |
| **`LinearFilter` partout** | Corrigerait le crénelage ET détruirait le look : texture floue au premier plan, exactement ce que l'invariant #4 interdit à raison |
| **`NearestMipmapNearestFilter`** | Tue le grésillement mais fait sauter visiblement d'un niveau de mip à l'autre quand on avance. L'interpolation entre niveaux ne coûte rien de mesurable |
| **Textures plus grandes** | Déplace le problème sans le résoudre : une texture de 512 px réduite sans mipmap grésille autant, et la charte du projet est à 64 px/m |

## Comment on saurait qu'on a eu tort

- Si le premier plan paraît flou, c'est que `magFilter` a dérivé vers
  `LinearFilter` quelque part : c'est lui qu'il faut vérifier, pas les mipmaps.
- Si les surfaces lointaines paraissent **trop** lisses et que le jeu perd son
  grain, l'ADR a corrigé un défaut au-delà de ce qui était souhaité :
  `cassandre.filtrage("mipmap")` puis `"nearest"` permettent de retrouver le
  point de bascule, et de le figer.
