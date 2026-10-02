---
name: weapon-sound-design
description: Anatomie physique d'un coup de feu entendu par le tireur — onde de Friedlander, amas de résonances mesuré, jet de gaz, mécanique, écrêtage du micro, pièce — et comment le juger contre la bibliothèque d'armes réelle. Charger pour créer ou corriger une arme, un impact ou un son d'ennemi.
---

# Son d'arme

## L'erreur qui a coûté quatre passes

« Bruit filtré + transitoire + `sine_drop` pour le poids » : c'est la recette
des passes rejetées le 2026-09-20 (« ça ne ressemble pas à ce que c'est »).
Mesurée contre le réel le 2026-10-01, l'ancienne arme était classée **6ᵉ**
pour « pistolet », plus proche d'un grincement de porte. Elle était claire et
bruitée (centroïde ~7 kHz, platitude 0,09) là où les vraies prises sont
sombres et tonales (centroïde ~1 kHz, platitude 0,01).

## Ce qu'est un tir (Maher 2006 ; Mengual, Moffat, Reiss 2016)

| Instant | Composante | Modèle (`physique.py` / `sons_armes.py`) |
|---|---|---|
| 0 ms | percuteur — souvent noyé (−32 dB) | `choc` acier, petits modes |
| ~1 ms | **onde de souffle** : montée instantanée, phase positive 0,45 ms × charge^(1/3), phase négative | `friedlander` |
| 1 ms | **front de choc** : onde en N brève, large bande — l'aigu des 3 premières ms | `_front` |
| 2-30 ms | **amas de 4 à 6 résonances très amorties** (150-600 /s), 150 Hz-1,2 kHz pour un pistolet, plus bas + une composante 40-75 Hz pour un fusil | `_souffle` — MESURÉ par faisceau matriciel sur les 16 prises |
| 0-80 ms | **jet de gaz** : bosse 1-2 kHz, −6 dB/oct au-dessus (jamais de bruit blanc) | `_jet` |
| 3-25 ms | **mécanique** : culasse qui recule puis revient (pistolet), canon qui sonne (fusil) — carcasse tenue, donc étouffée | `choc` matière `arme` |
| — | **le micro écrête** : plateaux plats sur toutes les prises réelles — écrêtage DUR, pas une tanh | `micro_sature` |
| après | **la pièce** : échos et queue (`espace.py`), appliquée au rendu | `@recette(lieu=, distance=)` |

La différence pistolet / pompe vient de la physique (racine cubique de la
charge), pas d'un plan de bandes imposé.

## Juger contre le réel

```bash
./.venv-refs/bin/python3 tools/audio/oreille.py juger w/pistol_fire.wav=pistolet
```

Une arme se juge **placée au stand** (`LIEU_DU_CORPUS`) : les prises de la
Free Firearm Library portent l'écho de leur butte à ~140 ms. Le studio
(`tools/audio/studio.py`) le fait tout seul. Le rapport d'écarts dit quoi
corriger (« niveau vers 10 kHz : −28 dB, réel −15 ± 2 »).

État au 2026-10-01 : pistolet 1ᵉʳ et dans le nuage du réel ; pompe dans le
nuage au stand (classe déjà ambiguë entre vraies prises : 50 %).

## Pièges payés

- Une résonance unique et peu amortie s'entend comme une note — et la pièce
  la prolonge en raie au spectrogramme. Le réel est un AMAS très amorti.
- Un percuteur trop fort (−24 dB) 1,5 ms avant le souffle allonge l'attaque
  mesurée et sonne « double ».
- Le fondu d'entrée de `write_wav` (0,5 ms) rabote un choc né au premier
  échantillon : `catalogue.au_niveau` ajoute 1 ms de silence devant.

## Les variantes

Chaque graine tire de nouvelles fréquences dans l'amas, un nouveau timing de
culasse, de nouveaux modes : une variation PHYSIQUE (point de frappe,
dispersion de la charge), pas un pitch aléatoire. La variation de pitch en jeu
reste basse sur les armes (`SFX_TABLE`, ±2,5 %).
