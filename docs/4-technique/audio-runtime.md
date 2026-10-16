---
title: Audio runtime
tags: [technique]
status: brouillon
updated: 2026-10-16
---

# Audio runtime

## Responsabilité

Le moteur de lecture est fx-audio, depuis l'[ADR 0047](../decisions/0047-fx-audio-remplace-howler.md).

Le runtime audio transforme les événements de présentation en sons ponctuels et ambiances.
Il ne décide pas quand un événement de gameplay arrive ; cette décision appartient au jeu et à `updateFx`.

## Fichiers

- `src/core/audio/audio.ts` charge le sprite des effets et lance les lectures ponctuelles ; la table `SFX_TABLE` vit dans `src/core/audio/audioCatalog.ts`.
- `src/core/audio/audioEngine.ts` possède l'unique moteur [fx-audio](https://benjigir.github.io/fx-audio/) (un seul contexte Web Audio, créé à la première demande), charge le premier fichier lisible d'une liste de formats, découpe un sprite en `SpriteSheet` et retient le gain général et la coupure globale tant que le moteur n'existe pas.
- `src/core/audio/loopedAmbience.ts` est la boucle d'ambiance spatialisée : chargement, lissage, volume et panoramique.
- `src/core/audio/waterAmbience.ts` en déclare une pour les jets d'eau, `src/core/audio/showerAmbience.ts` une pour les douches : un fichier, un volume de crête et un temps de lissage chacune.
- `src/core/audio/waterAmbienceMix.ts` calcule le gain et le panoramique des jets.
- `src/core/loading/assetPath.ts` construit les chemins d'assets servis par le jeu.
- `src/game/loop/updateFx.ts` consomme les faits de présentation et met à jour les ambiances.
- `src/game/session/player/feedback.ts` publie les répliques.
- `public/assets/audio/sfx/sfx.json` donne les offsets et durées du sprite.
- `public/assets/audio/sfx/sfx.ogg` et `public/assets/audio/sfx/sfx.m4a` sont ses encodages.

## Où ça s'insère dans la boucle

`main.ts` lance le chargement audio avant le menu, en parallèle du démarrage.
Avant d'entrer en jeu, il attend le décodage du sprite et des deux boucles
d'eau. fx-audio reprend le contexte au premier clic, à la première touche ou
au premier toucher, puis après une interruption (onglet masqué, appel) : rien
à installer côté jeu.
Les faits de tir, d'impact, de casse et d'ennemi sont lus dans `updateFx`, au taux d'affichage.
La boucle positionnelle d'eau calcule son mélange au même endroit.
Le pas fixe n'appelle pas fx-audio et ne dépend pas de la lecture audio.

Le flux relie l'événement de jeu à sa lecture, sans faire entrer l'audio dans la simulation.

```mermaid
flowchart LR
  A[Pas fixe] -->|faits de présentation| B[updateFx]
  B -->|identifiant logique| C[Table SFX]
  C --> D[Sprite fx-audio]
  B --> E[Mixage positionnel]
  E --> F[Boucle Web Audio]
  G[Réplique HUD] --> H[Duck du thème]
```

## Données et contrats

### Effets ponctuels

`SfxId` nomme les événements du jeu.
`SFX_TABLE` les associe à une clé de recette, un volume de base et éventuellement une variation de hauteur.
Le nom logique du jeu est distinct du nom de recette du studio.
`playSfx` reçoit une échelle de volume facultative.
Des fonctions spécialisées sélectionnent le son d'arme, d'impact, de matière, de porte ou d'ennemi.
Une matière inconnue retombe sur le son d'impact ou de casse par défaut.
Chaque lecture est une source Web Audio à usage unique : il n'y a plus de pool à dimensionner ni à amorcer.

`initAudio` est idempotente.
Elle récupère le manifeste, charge le premier format lisible (`.ogg`, puis
`.m4a`) et en tire un `SpriteSheet`. Sa promesse se résout après le
décodage. Le manifeste réseau et le chargement sont bornés à quinze
secondes chacun ; une panne reste non fatale.
Un appel avant disponibilité, ou une clé absente, ne bloque pas la partie ; un avertissement n'est émis qu'une fois par clé.
Le manifeste est généré par `tools/audio/build_sprite.py` et ne se modifie pas à la main.
Le générateur fournit Ogg et M4A : fx-audio charge une seule URL, donc `loadFirstSound` essaie les formats dans l'ordre et passe au suivant quand le navigateur n'en décode pas un.

`window.cassandre.sfx.liste()` expose `present` pour chaque identifiant. Ce
champ indique seulement que sa clé figure dans le manifeste JSON chargé ; il
ne révèle pas si fx-audio a fini de télécharger ou décoder le fichier. Pour
vérifier un son, contrôlez dans l'onglet Réseau que `sfx.json` et le format
choisi par le navigateur (`.ogg` ou `.m4a`) se chargent sans erreur, vérifiez
l'absence d'avertissement `[audio]` dans la console, puis déclenchez le son
avec `window.cassandre.sfx.joue("shotgun_fire")`.

`setAudioRandom` injecte le flux aléatoire de présentation utilisé pour la variation de hauteur.
Ce flux est distinct de la simulation.
L'absence d'un son ne change donc pas les décisions de gameplay ni le rejeu.

### Pas de musique

Le jeu n'a pas de thème musical : retiré le 2026-10-02, il n'apportait rien
que l'ambiance de zone ne fasse déjà. Sans musique, plus de ducking : une
réplique du héros ne baisse aucun autre canal.

### Ambiances de zone

`core/audio/zoneAmbience.ts` lit `assets/audio/ambiances/ambiances.json`, écrit par
`tools/audio/ia_ambiances.py finalize` : pour chaque zone, sa nappe, ses
événements et les espaces du plan de masse qu'elle couvre (boîtes en repère du
jeu, la plus petite l'emporte). Chaque nappe est amorcée en silence au
chargement ; `updateZoneAmbience`, appelée par `updateFx` au taux
d'affichage, choisit la zone sous la caméra (on garde la précédente entre deux
espaces), fond les nappes en ~0,7 s, fait respirer leur niveau (0,045 Hz,
±12 %) et lâche un événement toutes les 6 à 14 s, panoramique au hasard. Le
tirage passe par un flux `DeterministicRandom` dédié, posé à chaque partie.

À la construction d'une partie, `resetZoneAmbienceSession` remet la
respiration à l'instant zéro, la zone à null, les gains à zéro et le premier
événement à 6 secondes de jeu actif. Le nouveau générateur reprend la seed
`0xa4b1a7`. Au départ, la zone sous la caméra prime ; hors de toute boîte,
la zone par défaut remplace la zone de la partie précédente.

La pause, les écrans de fin et le menu figent l'horloge et le délai ; le
fondu vers le silence continue. La destruction d'une partie arrête aussi
les sons ponctuels en cours. Les sons décodés, les gains utilisateur et
les boucles des nappes sont conservés entre parties : le curseur de lecture
audio reste continu. Le calendrier cosmétique dépend du delta d'affichage ;
ce reset ne garantit pas un rejeu sonore identique à des fréquences différentes.

Le fichier d'une nappe porte 0,5 s de marge de chaque côté et le jeu boucle sur
la région du milieu (segment de sprite bouclé) : encodée en ogg ou m4a, une boucle
propre en WAV sortait avec un clic au raccord, l'encodeur abîmant les bords du
fichier. `finalize` mesure le raccord APRÈS décodage. `cassandre.sfx.ambiance()`
donne la zone entendue, le volume de chaque nappe, l'horloge en secondes
et le délai avant le prochain événement (`horloge`, `prochainEvenementDans`).

### Jet d'eau positionnel

`waterAmbienceMix.ts` reçoit la position des jets et la pose de caméra.
Il retourne un gain et un panoramique bornés, lissés ensuite par `loopedAmbience.ts`.
Le mix atteint son niveau maximal près de la source, décroît avec la distance et devient muet au-delà de sa portée.
Plusieurs jets additionnent leurs gains jusqu'à un plafond.
Une seule voix en boucle est amorcée à volume nul dès le décodage, avec son
panoramique. Il reste en boucle : le mix ne fait ensuite que régler
volume et pan. Sous le seuil de silence, le volume est exactement nul.
Le module s'actualise pendant le jeu ; les écrans de menu et de fin ne produisent pas de jet audible.
La douche est une seconde boucle du même module, avec ses propres réglages.
Une voix lancée avant le premier geste attend le contexte suspendu ; ses
réglages de volume et de panoramique, envoyés à chaque image, remplacent
simplement les précédents : rien ne s'empile.

### Répliques

Depuis le 2026-10-02, les répliques sont dites : `core/audio/heroVoice.ts` charge un
second sprite, `voix.{ogg,m4a,json}` (prises ElevenLabs, voix « Callum »,
produites par `tools/audio/ia_voix.py`). Une seule lecture à la fois — une
nouvelle réplique coupe la précédente — et aucune variation de hauteur.
`triggerHeroLine(session, id)` affiche le sous-titre, joue la prise
`heros_<id>_a`, fait parler le portrait et baisse le thème le temps de la
prise (4 s au moins). Le texte, la priorité, la règle « une fois par partie »
et la probabilité de chaque réplique sont dans `game/session/presentation/heroLines.ts` ;
`triggerHeroBark` joue les cris courts (douleur, réception), sans sous-titre.
`cassandre.voix.liste()`/`joue(cle)` en console.

### Réglages du joueur

Options › Audio (`ui/screens/options/audio/AudioTab/`) présente,
`game/settings/audioSettings.ts` persiste (`cassandre.audio`) et applique. Quatre canaux
— général (volume du master fx-audio), effets, voix du héros, ambiances (nappe,
jets d'eau, douches) — chacun un gain multiplié au volume de repos de son
module de `core/` : 100 % rend le mixage d'origine. Le gain est le carré de
la valeur affichée (50 % ≈ −12 dB). S'y ajoutent les sous-titres des
répliques (lus par `triggerHeroLine`) et la coupure du son quand la fenêtre
perd le focus (coupure du master). `initAudioSettingsAtBoot()` passe avant la
création du moteur, qui reprend le gain général et la coupure à sa
construction ; le gain voix vit dans un groupe `voix`.

## Pièges

- Appeler fx-audio dans le pas fixe mélange une action de présentation à la simulation.
- Confondre « manifeste disponible » et « audio décodé » reporte le coût sur la première action.
- Modifier les offsets du manifeste à la main est perdu au prochain build du sprite.
- Fusionner les clés de recette et les identifiants du jeu casse leur frontière de nommage.
- Une boucle d'eau en flux HTML5 (`stream`) ne fournit pas les raccords de boucle ni le contrôle de panoramique requis par le mix : elle reste un son décodé.
- fx-audio refuse un volume négatif ou non fini en levant une erreur : `clampVolume` protège les appelants dont le gain vient d'un réglage, une erreur de présentation ne doit pas arrêter la boucle.
- Les réglages ne doivent pas créer le moteur à eux seuls (pas de `AudioContext` sous Vitest) : `createdAudioEngine()` rend `null` tant qu'aucun son n'a été chargé.
- Un lissage exponentiel n'atteint jamais exactement zéro ; la mise au silence utilise donc un seuil.
- Le flux d'aléa des variations audio doit rester indépendant du RNG de gameplay.
- La lecture audio peut être muette si l'asset attendu manque ; le runtime avertit sans interrompre le jeu.

## Tests

- `test/core/audio/waterAmbienceMix.test.ts` vérifie le calcul pur du gain, de la distance et du panoramique.
- Le module `audio.ts` n'a pas de suite de tests d'intégration dédiée.
- L'analyse du studio et le contrôle des boucles sont décrits dans [Studio audio](studio-audio.md).

## Comment vérifier que ça marche

Lancer `pnpm test -- test/core/audio/waterAmbienceMix.test.ts`.
Dans le navigateur de développement, utiliser `window.cassandre.sfx.liste()` pour comparer les identifiants du jeu aux clés du manifeste ; `present` ne confirme pas le décodage du son.
Contrôler les réponses Réseau pour `sfx.json` et le format audio choisi, puis déclencher `window.cassandre.sfx.joue("shotgun_fire")` et écouter le résultat.
Casser un sanitaire, puis observer `window.cassandre.sfx.eau()` pour vérifier l'état de la boucle.
