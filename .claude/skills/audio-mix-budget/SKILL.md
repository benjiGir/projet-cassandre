---
name: audio-mix-budget
description: Mixage et budget — marge de crête, masquage spectral comme contrat de gameplay, hiérarchie de niveaux, empaquetage en sprite, budget de poids, lien avec le runtime Howler. Charger pour toute décision de niveau, de mixage ou d'empaquetage.
---

# Mixage et budget

## La marge de crête

Tous les sons sont écrits à **−1 dBFS**, pas à 0.

Trois choses vont consommer cette marge au runtime :

1. La **variation de pitch** de ±8 % (`rate()` de Howler)
2. La **sommation** — trois impacts simultanés s'additionnent
3. L'**encodage avec perte** — Vorbis et AAC produisent des dépassements
   inter-échantillons invisibles dans le WAV

Écrire à 0 dBFS garantit un écrêtage audible dès que deux sons se superposent.

## Le masquage est un contrat de gameplay

Ce n'est pas une préférence esthétique. `enemy-state-machine` impose que le
joueur sache toujours qui lui tire dessus, y compris hors champ. La télégraphie
ennemie doit donc rester audible **pendant** que le joueur tire.

Deux sons qui occupent la même bande au même moment se masquent. Mesurable :

```bash
python3 tools/audio/analyze_sfx.py --mask shotgun.wav suit_telegraph.wav
```

Au-delà de 0.62 de recouvrement, le conflit est réel et se corrige en
**séparant les centroïdes** — descendre l'un, monter l'autre, ou creuser une
bande dans le son dominant.

Sur le mixage actuel : recouvrement 0.345, centroïdes à 6170 et 2363 Hz. La
télégraphie vit sous le tir, pas dedans.

## Hiérarchie de niveaux

Le mixage d'un boomer shooter n'est pas plat. Par ordre de priorité :

| Rang | Catégorie | Niveau relatif |
|---|---|---|
| 1 | Arme du joueur | 0 dB, référence |
| 2 | **Télégraphie ennemie** | −4 dB |
| 3 | Impacts et dégâts reçus | −6 dB |
| 4 | Tirs ennemis | −8 dB |
| 5 | Ramassages et interactifs | −10 dB |
| 6 | Répliques du héros | −8 dB, avec ducking |
| 7 | Ambiance | −20 dB |

La télégraphie passe **avant** les tirs ennemis. C'est contre-intuitif — le tir
fait plus de bruit dans la réalité — mais c'est la télégraphie qui porte
l'information dont le joueur a besoin pour réagir.

## Ducking

La musique et l'ambiance baissent de 6 dB pendant une réplique du héros,
remontée sur 400 ms. Sans ça, la ligne est inintelligible et la blague tombe à
plat.

## Empaquetage

**SFX courts → sprite audio.** Un fichier, un décodage, une requête, latence
minimale. C'est le pattern recommandé pour un jeu.

**Ambiances → fichiers séparés, streaming.** Longues et bouclées : les mettre
dans le sprite gonflerait le décodage initial pour rien.

```bash
python3 tools/audio/build_sprite.py assets/audio/wav --out public/audio
```

Produit `sfx.ogg`, `sfx.m4a` et `sfx.json` directement consommable :

```js
const sfx = new Howl({ ...manifest, pool: 12 });
const id = sfx.play('shotgun');
sfx.rate(0.92 + rng() * 0.16, id);   // ±8 %
```

Le `.m4a` n'est pas facultatif : c'est le repli Safari.

Le fichier `sfx.json` est **généré**. L'éditer à la main casse au prochain
rendu ; modifier `recipes.py` et régénérer.

## Budget

| Poste | Cible | Mesuré |
|---|---|---|
| Sprite SFX (ogg) | < 500 Ko | 113 Ko |
| Ambiances (ogg) | < 1 Mo | 235 Ko |
| **Total audio** | **< 8 Mo** | **0.53 Mo** |
| Sons simultanés | < 24 | |
| Latence de déclenchement | < 30 ms | |

Le budget est très large. Ça autorise des variantes de seed généreuses sur les
sons répétés — c'est le meilleur usage possible de cette marge, bien meilleur
qu'une augmentation de la qualité d'encodage que personne n'entendra à ce taux
d'échantillonnage.

## Piège navigateur

Le contexte audio est suspendu jusqu'à une interaction utilisateur. Le brancher
sur le **même événement que le pointer lock** — sinon le premier tir est muet,
et le bug passe inaperçu en développement, où l'onglet a déjà reçu des clics.
