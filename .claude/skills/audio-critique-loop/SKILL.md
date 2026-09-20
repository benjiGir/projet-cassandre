---
name: audio-critique-loop
description: Boucle de critique pour l'audio — ce qu'un agent peut mesurer et regarder, ce qu'il ne peut pas entendre, lecture d'un spectrogramme, protocole d'itération. Charger pour toute tâche de création ou de correction sonore.
---

# Boucle de critique audio

## L'asymétrie à poser d'emblée

`visual-critique-loop` repose sur un fait simple : l'agent peut **regarder** ce
qu'il produit.

En audio, ce n'est pas le cas. **Un agent ne peut pas entendre.** C'est une
limite réelle, pas une formalité, et la nier produirait des affirmations
invérifiables sur la qualité d'un son.

Ce qui reste accessible, et qui est beaucoup :

| Accessible | Inaccessible |
|---|---|
| Pic, RMS, facteur de crête | Est-ce que ça sonne bien |
| Temps d'attaque, de décroissance | Est-ce que l'impact est satisfaisant |
| Centroïde spectral, bandes | Est-ce que l'arme a du caractère |
| **Spectrogramme, regardé** | Est-ce que l'ambiance est inquiétante |
| Masquage entre deux sons | Est-ce que le mixage est agréable |

La colonne de gauche couvre la **conformité**. La colonne de droite reste
humaine, au casque. Un son conforme peut être mauvais ; un son non conforme est
mauvais à coup sûr.

**Ne jamais déclarer qu'un son est bon.** Dire qu'il est conforme, et renvoyer
à l'écoute.

## Le protocole

```
1. Rendre
     python3 tools/audio/render_sfx.py --out assets/audio/wav --only <nom>
2. Mesurer et tracer
     python3 tools/audio/analyze_sfx.py assets/audio/wav --sheet renders/audio.png
3. REGARDER la planche (view)
4. Critiquer contre la grille ci-dessous
5. Corriger recipes.py — jamais le WAV
6. Retour en 1, maximum 4 itérations
7. Remonter à l'humain pour l'écoute
```

L'étape 3 n'est pas optionnelle. Un spectrogramme non regardé ne compte pas
comme une itération, exactement comme un rendu Blender non ouvert.

## Lire un spectrogramme

C'est la compétence centrale de ce skill. Ce qu'on y voit :

| Ce qu'on voit | Ce que ça signifie |
|---|---|
| Coin d'énergie vertical à t=0 | attaque nette — bon pour un impact |
| Montée progressive | attaque molle — correct pour un whoosh, faux pour un tir |
| **Biseau descendant** | l'énergie haute se dissipe — le son « part » |
| Rectangle plein | pas de `sweep_lowpass` — le son reste plaqué |
| Lignes horizontales | composantes tonales (bourdon, notes, résonances) |
| Empilement harmonique régulier | quantification parasite — retirer le crush |
| Taches claires dispersées | événements sparses — verre, ambiance |
| Diagonale montante ou descendante | `sine_drop` — la chute de hauteur |
| Traînée en bas à droite | queue de réverbération longue |

Exemples lus sur la planche du projet : le `shotgun` montre le coin d'énergie
puis le biseau, forme canonique d'un tir. Le `suit_telegraph` affiche sa
diagonale montante de 380 à 900 Hz, immédiatement distincte de tout le reste.
Le `secret_found` empile quatre notes en escalier, reconnaissable au premier
coup d'œil.

## Grille de critique

1. **Attaque** — le transitoire est-il visible à t=0, ou le son monte-t-il ?
2. **Forme** — biseau descendant, ou rectangle plaqué ?
3. **Étalement** — l'énergie couvre-t-elle la bande attendue pour ce type ?
4. **Queue** — la décroissance est-elle cohérente avec la pièce ?
5. **Distinction** — ce spectrogramme ressemble-t-il à celui d'un voisin ?
6. **Parasites** — harmoniques régulières non voulues, bande morte, DC ?

La question 5 est celle qui rattrape le plus de problèmes : sur une planche,
deux sons qui se ressemblent visuellement se ressembleront à l'oreille, et le
joueur ne les distinguera pas en combat.

## Ce qu'il faut remonter à l'humain

Quand tu passes la main, donne une liste courte et précise de ce sur quoi
l'oreille doit trancher :

```
Sons conformes, en attente d'écoute :
  shotgun         — le poids est-il suffisant ? (sine_drop 190->42 Hz)
  suit_telegraph  — s'entend-il par-dessus un tir ? (masquage mesuré à 0.35)
  amb_hypermarche — la boucle s'entend-elle ? (fondu croisé 1.5 s)
```

Une question par son, formulée de façon à pouvoir répondre par oui ou non.
« Dis-moi ce que tu en penses » ne donne rien d'exploitable.
