---
name: weapon-sound-design
description: Anatomie d'un son d'arme — les quatre couches, le rôle du sine_drop, les mécanismes, les variantes, l'erreur du bruit blanc coupé. Charger pour créer ou corriger une arme, un impact ou un son d'ennemi.
---

# Son d'arme

## L'erreur de départ

La tentative naïve est un bruit blanc sous enveloppe décroissante. Le résultat
sonne comme une bouffée de parasites, pas comme une arme. Il manque tout ce qui
suit.

## Les quatre couches d'un tir

| Couche | Ce qu'elle apporte | Sans elle |
|---|---|---|
| **Percuteur** | le mécanisme, l'origine physique | le son démarre de nulle part |
| **Corps** | l'identité de l'arme | rien à reconnaître |
| **Poids grave** | la puissance ressentie | l'arme paraît en plastique |
| **Claquement aigu** | la portée, l'air déplacé | le son reste confiné |

```python
click  = transient(0.005, seed, hp=2500) * 0.45
body   = sweep_lowpass(noise_burst(0.26, 120, 9000, decay=24, seed=seed), 9000, 900)
weight = sine_drop(0.13, 190, 42, curve=2.2) * env_exp(n, 34) * 0.75
crack  = noise_burst(0.05, 2500, 11000, decay=90, seed=seed+1) * 0.5
```

## Le `sine_drop` est le levier principal

C'est une sinusoïde dont la hauteur chute vite — 190 Hz vers 42 Hz en 130 ms.

C'est **ce qui donne le poids**. Un tir sans elle a tout le bruit et aucune
force. C'est la correction la plus rentable sur une arme qui paraît faible, et
celle à laquelle on pense en dernier.

La `curve` règle la vitesse de chute : élevée = chute brutale et agressive,
basse = chute molle et lourde.

## Le `sweep_lowpass` fait la distance

Une coupure qui glisse de 9 kHz vers 900 Hz sur la durée du son reproduit
l'énergie haute qui se dissipe plus vite que la basse. C'est ce qui donne
l'impression que le son **part** vers l'extérieur plutôt que de rester plaqué.

Au spectrogramme, ça se lit comme un biseau descendant. Si le spectrogramme
montre un rectangle, la couche manque.

## Les mécanismes comptent autant que le tir

Un pompe se joue en trois sons, pas un : le tir, le réarmement, la douille au
sol. C'est cette séquence qui vend l'arme, et chacun a sa signature.

Le réarmement est lui-même **deux mécanismes séparés par 90 ms** — arrière puis
avant. Un seul clic sonne faux, et personne ne sait dire pourquoi.

```python
return reverb(layer(back, delay(fwd, 0.09)), room=0.2, mix=0.14)
```

## Impacts : la matière est dans la résonance

| Matière | Recette |
|---|---|
| **Béton** | bruit large bande, décroissance rapide, aucune résonance |
| **Métal** | transitoire + `resonant` à Q élevé, longue décroissance |
| **Chair** | passe-bas serré, très court, `sine_drop` grave, zéro résonance |
| **Verre** | éclats sparses à `delay` aléatoires, très haute fréquence |

Deux résonances **désaccordées** (1850 et 3170 Hz, par exemple) donnent un
timbre métallique crédible. Deux fréquences en rapport harmonique sonnent comme
un instrument, pas comme un objet.

## Les variantes

Le runtime applique déjà ±8 % de pitch. Ça suffit pour des pas ou des douilles,
mais pas pour l'arme principale : l'oreille détecte la répétition d'un même
échantillon en quelques secondes, même repitché.

Rendre **3 à 4 variantes de seed** sur le tir et sur l'impact. Le bruit change,
la structure reste. C'est un des écarts les plus audibles entre un prototype et
un jeu fini, pour un coût nul.

```bash
python3 tools/audio/render_sfx.py --out w --cat weapon --variants
```

## Le son ennemi est un contrat, pas une décoration

La télégraphie d'attaque du Costard obéit aux règles de `enemy-state-machine` :
au moins 200 ms avant les dégâts, timbre unique dans tout le mixage, et
suffisamment aigu pour être localisable en panning.

C'est le canal principal qui permet au joueur de savoir **qui lui tire dessus
hors champ**. Un combat où trois ennemis tirent sans être localisables est raté,
quelle que soit la qualité de l'IA.

Vérification obligatoire avant de figer :

```bash
python3 tools/audio/analyze_sfx.py --mask shotgun.wav suit_telegraph.wav
```

Voir `audio-mix-budget` : c'est une contrainte de lisibilité, pas de goût.
