---
title: Audio runtime
tags: [technique]
status: brouillon
updated: 2026-10-02
---

# Audio runtime

## Responsabilité

Le runtime audio transforme les événements de présentation en sons ponctuels, musique et ambiances.
Il ne décide pas quand un événement de gameplay arrive ; cette décision appartient au jeu et à `updateFx`.

## Fichiers

- `src/core/audio.ts` charge le sprite des effets, définit `SFX_TABLE` et lance les lectures ponctuelles.
- `src/core/audioPreparation.ts` attend le décodage, amorce le pool et reprend Web Audio sur une interaction.
- `src/core/music.ts` gère le thème, la nappe de fond, le ducking et la préférence persistée.
- `src/core/waterAmbience.ts` gère la boucle unique des jets d'eau positionnels.
- `src/core/showerAmbience.ts` gère la boucle localisée des douches.
- `src/core/waterAmbienceMix.ts` calcule le gain et le panoramique des jets.
- `src/core/assetPath.ts` construit les chemins d'assets servis par le jeu.
- `src/game/loop/updateFx.ts` consomme les faits de présentation et met à jour les ambiances.
- `src/game/session/feedback.ts` publie les répliques et déclenche le ducking musical.
- `public/assets/audio/sfx/sfx.json` donne les offsets et durées du sprite.
- `public/assets/audio/sfx/sfx.ogg` et `public/assets/audio/sfx/sfx.m4a` sont ses encodages.
- `public/assets/audio/music/` contient les pistes de fond.

## Où ça s'insère dans la boucle

`main.ts` lance le chargement audio avant le menu, en parallèle du démarrage.
Avant d'entrer en jeu, il attend le décodage du sprite et des deux boucles
d'eau. Le contexte audio est repris sur `pointerdown` ou `keydown`, dès le
menu. L'auto-suspension Howler après trente secondes est désactivée pour
éviter un nouveau démarrage du moteur audio au prochain son.
Les faits de tir, d'impact, de casse et d'ennemi sont lus dans `updateFx`, au taux d'affichage.
La boucle positionnelle d'eau calcule son mélange au même endroit.
Le pas fixe n'appelle pas Howler et ne dépend pas de la lecture audio.

Le flux relie l'événement de jeu à sa lecture, sans faire entrer l'audio dans la simulation.

```mermaid
flowchart LR
  A[Pas fixe] -->|faits de présentation| B[updateFx]
  B -->|identifiant logique| C[Table SFX]
  C --> D[Sprite Howler]
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
Le pool Howler prévoit douze lectures simultanées par défaut.

`initAudio` est idempotente.
Elle récupère le manifeste et crée le sprite Howler. Sa promesse se résout
après le décodage. Des lectures muettes amorcent les voix du pool natif
Howler ; elles sont arrêtées puis réutilisées par les vrais sons, sans
consommer le RNG. Le manifeste réseau et l'attente du décodage sont bornés à
quinze secondes chacun ; une panne reste non fatale.
Un appel avant disponibilité, ou une clé absente, ne bloque pas la partie ; un avertissement n'est émis qu'une fois par clé.
Le manifeste est généré par `tools/audio/build_sprite.py` et ne se modifie pas à la main.
Le générateur fournit Ogg et M4A car Howler choisit un format pris en charge sans repli d'une source à l'autre.

`window.cassandre.sfx.liste()` expose `present` pour chaque identifiant. Ce
champ indique seulement que sa clé figure dans le manifeste JSON chargé ; il
ne révèle pas si Howler a fini de télécharger ou décoder le fichier. Pour
vérifier un son, contrôlez dans l'onglet Réseau que `sfx.json` et le format
choisi par le navigateur (`.ogg` ou `.m4a`) se chargent sans erreur, vérifiez
l'absence d'avertissement `[audio]` dans la console, puis déclenchez le son
avec `window.cassandre.sfx.joue("shotgun_fire")`.

`setAudioRandom` injecte le flux aléatoire de présentation utilisé pour la variation de hauteur.
Ce flux est distinct de la simulation.
L'absence d'un son ne change donc pas les décisions de gameplay ni le rejeu.

### Musique et nappe

`initMusic` crée deux lectures en boucle au format HTML5 : le thème et la nappe d'ambiance.
La préférence du thème est enregistrée dans `localStorage`.
La nappe reste indépendante du réglage qui coupe le thème.
`setMusicEnabled` modifie le thème sans redémarrer la piste.
Le ducking atténue le thème pendant une réplique, puis le restaure ; il ne change pas la nappe.
Les erreurs de chargement sont traitées comme non fatales.

### Jet d'eau positionnel

`waterAmbienceMix.ts` reçoit la position des jets et la pose de caméra.
Il retourne un gain et un panoramique bornés, lissés ensuite par `waterAmbience.ts`.
Le mix atteint son niveau maximal près de la source, décroît avec la distance et devient muet au-delà de sa portée.
Plusieurs jets additionnent leurs gains jusqu'à un plafond.
Un seul `Howl` Web Audio est amorcé à volume nul pendant le chargement,
avec son panoramique. Il reste en boucle : le mix ne fait ensuite que régler
volume et pan. Sous le seuil de silence, le volume est exactement nul.
Le module s'actualise pendant le jeu ; les écrans de menu et de fin ne produisent pas de jet audible.
La douche suit la même préparation dans `showerAmbience.ts`.

### Répliques

Depuis le 2026-10-02, les répliques sont dites : `core/heroVoice.ts` charge un
second sprite, `voix.{ogg,m4a,json}` (prises ElevenLabs, voix « Callum »,
produites par `tools/audio/ia_voix.py`). Une seule lecture à la fois — une
nouvelle réplique coupe la précédente — et aucune variation de hauteur.
`triggerHeroLine(session, id)` affiche le sous-titre, joue la prise
`heros_<id>_a`, fait parler le portrait et baisse le thème le temps de la
prise (4 s au moins). Le texte, la priorité, la règle « une fois par partie »
et la probabilité de chaque réplique sont dans `game/session/heroLines.ts` ;
`triggerHeroBark` joue les cris courts (douleur, réception), sans sous-titre.
`cassandre.voix.liste()`/`joue(cle)` en console.

### Réglages du joueur

Options › Audio (`ui/screens/options/audio/AudioTab/`) présente,
`game/audioSettings.ts` persiste (`cassandre.audio`) et applique. Cinq canaux
— général (`Howler.volume`), musique, effets, voix du héros, ambiances (nappe,
jets d'eau, douches) — chacun un gain multiplié au volume de repos de son
module de `core/` : 100 % rend le mixage d'origine. Le gain est le carré de
la valeur affichée (50 % ≈ −12 dB). S'y ajoutent les sous-titres des
répliques (lus par `triggerHeroLine`) et la coupure du son quand la fenêtre
perd le focus (`Howler.mute`). Le thème activé/coupé reste le réglage de
`core/music.ts` (touche M). `initAudioSettingsAtBoot()` passe avant la
création des `Howl`, qui reprennent les gains à leur construction.

## Pièges

- Appeler Howler dans le pas fixe mélange une action de présentation à la simulation.
- Confondre « manifeste disponible » et « audio décodé » reporte le coût sur la première action.
- Modifier les offsets du manifeste à la main est perdu au prochain build du sprite.
- Fusionner les clés de recette et les identifiants du jeu casse leur frontière de nommage.
- Relier le réglage de musique à la nappe coupe un canal qui doit rester séparé.
- Une boucle d'eau HTML5 ne fournit pas le contrôle de panoramique requis par le mix.
- Un lissage exponentiel n'atteint jamais exactement zéro ; la mise au silence utilise donc un seuil.
- Le flux d'aléa des variations audio doit rester indépendant du RNG de gameplay.
- La lecture audio peut être muette si l'asset attendu manque ; le runtime avertit sans interrompre le jeu.

## Tests

- `test/core/waterAmbienceMix.test.ts` vérifie le calcul pur du gain, de la distance et du panoramique.
- Les modules Howler `audio.ts` et `music.ts` n'ont pas de suite de tests d'intégration dédiée.
- L'analyse du studio et le contrôle des boucles sont décrits dans [Studio audio](studio-audio.md).

## Comment vérifier que ça marche

Lancer `pnpm test -- test/core/waterAmbienceMix.test.ts`.
Dans le navigateur de développement, utiliser `window.cassandre.sfx.liste()` pour comparer les identifiants du jeu aux clés du manifeste ; `present` ne confirme pas le décodage du son.
Contrôler les réponses Réseau pour `sfx.json` et le format audio choisi, puis déclencher `window.cassandre.sfx.joue("shotgun_fire")` et écouter le résultat.
Casser un sanitaire, puis observer `window.cassandre.sfx.eau()` pour vérifier l'état de la boucle.
Basculer le thème avec la touche M et vérifier qu'elle ne coupe pas la nappe.
