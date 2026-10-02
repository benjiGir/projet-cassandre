---
name: procedural-sfx-synthesis
description: Synthèse sonore par modèles physiques en numpy/scipy — pourquoi la physique plutôt que le bruit filtré, briques disponibles (modes, contact de Hertz, fracture, frottement, tons éoliens, souffle, voix, pièces), le studio, l'oreille étalonnée sur le réel. Charger pour toute tâche de création sonore.
---

# Synthèse par modèles physiques

## Pourquoi pas le bruit filtré

Quatre passes de « bruit filtré sous enveloppe » ont été rejetées avec les
mêmes mots : *ça ne ressemble pas à ce que c'est*. L'oreille reconnaît une
SOURCE à des indices physiques ; un bruit filtré ne les a pas. Moffat & Reiss
(2018) : seule la synthèse additive/modale a été jugée aussi réaliste que
l'enregistrement sur toutes les classes testées.

| Indice | Physique | Brique (`tools/audio/physique.py`) |
|---|---|---|
| matière | amortissement d(f) = a0 + π·η·f | `MATIERES`, `Matiere` |
| dureté du choc | durée du contact (Hertz) : le spectre s'effondre au-dessus de ~1,5/τ | `contact`, `choc` |
| taille, forme | fréquence et rapports des modes | `modes_barre`, `modes_plaque`, `modes_coque`, `modes_denses` |
| objet presque symétrique | modes par paires qui battent | `modes(..., dedoublement=)` |
| casse | rafale de micro-ruptures (PhISEM) + éclats qui retombent et rebondissent | `fracture`, `eclats_qui_tombent` |
| grincement | frottement colle-glisse, en salves | `colle_glisse` |
| raclement, roulement | profil de surface lu à la vitesse du contact | `raclement` |
| objet qui fend l'air | tons éoliens f = 0,2·u/d le long de l'objet | `eolien` |
| coup de feu | Friedlander, résonances, gaz, écrêtage | `friedlander`, `gaz`, `micro_sature` |
| voix | source glottique + formants (Klatt) | `voix.py` |
| lieu | sources-images + queue d'Eyring | `espace.py` |
| liquide | bulles de Minnaert (van den Doel) | `synth.bubble(s)` |

Un objet qui CASSE cesse de vibrer d'un bloc : couper ses modes d'ensemble à
la rupture (`sons_impacts._brise`), sinon c'est un verre cogné.

## Le studio et l'oreille

- `tools/audio/studio.py` : page locale, curseurs, avant/après, réel le plus
  proche, avis écrits dans `avis.json` — **lire `avis.json` avant de
  retoucher un son**, c'est la parole de l'utilisateur.
- `tools/audio/oreille.py` : classe un son parmi ~240 prises CC0 locales et
  dit en clair où il s'écarte. Étalonnée (groupe exclu) : 67 % top-1, 83 %
  top-3. Fiable pour les armes et la voix, indicative pour les impacts (sons
  Kenney déjà traités). Elle écarte le mesurablement faux ; elle ne remplace
  pas l'écoute.

## Règles

- Une recette rend un son **SEC** ; le lieu s'applique au rendu
  (`@recette(lieu=, distance=)`). Pas de reverb dans une recette.
- Tout hasard passe par le `np.random.Generator` reçu : même graine, même
  octet (vérifié sur les 40 fichiers).
- Les gains se règlent en dB sur des couches ramenées à crête 1
  (`melange`).
- L'intensité finale suit `catalogue.NIVEAUX` (l'ancien mixage) : changer de
  synthèse ne change pas le mixage en douce.
- Le grain rétro (`--crush`) reste hors défaut : il replie l'aigu au lieu de le
  couper (mesuré le 2026-09-20).
