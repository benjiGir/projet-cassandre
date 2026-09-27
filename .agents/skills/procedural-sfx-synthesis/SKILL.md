---
name: procedural-sfx-synthesis
description: Synthèse sonore procédurale en numpy/scipy — pourquoi le code plutôt que l'échantillon, briques DSP disponibles, structure en couches, grain rétro par réduction de bits. Charger pour toute tâche de création sonore.
---

# Synthèse procédurale

## Pourquoi le code plutôt que l'échantillon

Pour un boomer shooter rétro, la synthèse procédurale domine la banque de sons
sur presque tous les axes :

| Critère | Synthèse | Échantillons |
|---|---|---|
| **Déterminisme** | même seed, même octet | binaire opaque |
| **Versionnage** | recette en texte, diff lisible | blob dans git |
| **Variantes** | changer une seed | re-sourcer, re-découper |
| **Reparamétrage** | une ligne | retour au DAW |
| **Licence** | aucune question | à vérifier pour chaque fichier |
| **Poids du dépôt** | quelques Ko de Python | des Mo de binaire |
| **Réalisme organique** | faible | fort |

La dernière ligne est la seule où l'échantillon gagne — et elle ne concerne pas
ce projet : les armes de Duke 3D et d'Ion Fury sont du bruit filtré sous
enveloppe, pas des captations de terrain.

Le déterminisme n'est pas un détail ici : c'est déjà un invariant du projet,
côté boucle et côté physique. L'audio s'y conforme.

## La structure en couches

Tout SFX percussif se décompose en trois couches. C'est la grammaire de base,
et elle explique la plupart des sons ratés.

| Couche | Rôle | Durée typique |
|---|---|---|
| **Transitoire** | le clic mécanique, l'attaque | 3 à 8 ms |
| **Corps** | le bruit filtré, ce qu'on identifie | 50 à 250 ms |
| **Queue** | l'espace, la réverbération | 100 ms à 1 s |

Un son qui manque de transitoire paraît mou. Un son qui manque de corps paraît
creux. Un son qui manque de queue paraît collé à l'écran, sans lieu.

## Briques disponibles

`tools/audio/synth.py` fournit :

**Bruits** — `white`, `pink` (1/f, chaud), `brown` (1/f², grondements)

**Enveloppes** — `env_exp` (percussif), `env_ad`, `env_adsr`, `fade`

**Filtres** — `lowpass`, `highpass`, `bandpass`, `resonant` (pic résonant,
donne un timbre métallique), `sweep_lowpass` (coupure qui glisse)

**Oscillateurs** — `sine`, `saw`, `sine_drop` (hauteur qui chute)

**Traitement** — `saturate`, `crush`, `reverb`, `slapback`

**Composition** — `layer`, `delay`, `loop_seamless`

## Le grain rétro

L'équivalent audio du 640×360 est la **réduction de bits et de taux
d'échantillonnage**. Duke 3D tournait en 11025 Hz mono 8 bits ; c'est ce qui
donne le grain, exactement comme le `NearestFilter` donne le pixel.

Le projet utilise **10 bits / 22050 Hz** : assez de grain pour la cohérence,
assez de définition pour que les impacts restent lisibles.

**Deux catégories échappent au grain**, pour des raisons opposées :

- **L'ambiance** est une nappe tenue. Le grain s'y entend en continu, alors
  qu'il disparaît sous un transitoire.
- **L'UI** est faite de sinus purs. La quantification leur ajoute des
  harmoniques parasites, visibles au spectrogramme et audibles.

Le crush sert les transitoires. Pas les nappes, pas les tons purs.

## Deux pièges systématiques

**L'offset DC.** Invisible à l'œil, s'entend comme un clic au déclenchement, et
consomme de la marge de crête pour rien. Le bruit brun en produit (c'est un
`cumsum`, il dérive), et une sinusoïde démarrant à phase 0 sous enveloppe
percussive aussi. `write_wav` applique un highpass de sécurité, mais mieux vaut
le traiter à la source.

**Le clic de bord.** Tout signal coupé net claque. Un fondu de 2 ms en sortie
suffit et c'est appliqué systématiquement par `write_wav`.

## Ajouter un son

Une fonction dans `recipes.py`, une entrée dans `RECIPES` avec sa catégorie et
son nombre de variantes. Rien d'autre — le rendu, l'analyse et l'empaquetage
suivent automatiquement.
