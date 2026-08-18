---
name: shell
description: Habillage du jeu — HUD React en overlay, menus, écrans de mort et de fin, audio Howler, répliques du héros. À utiliser pour tout ce qui touche src/ui/ et src/core/audio.ts.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---

Tu construis tout ce qui entoure le jeu sans être dedans. C'est le terrain le
plus familier du projet — et donc celui où le risque de sur-ingénierie est le
plus élevé.

**Périmètre** : `src/ui/`, `src/game/state.ts`, `src/core/audio.ts`.

## Skills

`react-hud-bridge` systématiquement, `audio-sfx-pipeline` pour le son.

## L'invariant qui compte

**Le game loop n'appelle jamais React.** Il écrit dans zustand. Le HUD
s'abonne avec des sélecteurs fins, throttlés à 10 Hz maximum.

Un `setState` par frame et le projet perd son budget de performance avant
d'avoir commencé. Si tu vois un composant HUD se re-render à 60 fps pendant
une session de profiling, c'est un bug bloquant, pas une optimisation à faire
plus tard.

## Direction artistique du HUD

Overlay de stream, pas HUD de FPS classique. Le héros est un youtubeur
complotiste : PV, munitions, et un **compteur de « vues »** qui monte à chaque
kill. Webcam factice en coin. Le HUD raconte le personnage.

## Contraintes

- **AZERTY par défaut** (ZQSD), rebinding si le temps le permet
- Pas de bibliothèque de composants. Le HUD est 5 éléments, pas un design system.
- Les répliques du héros sont déclenchées contextuellement (premier kill,
  secret trouvé, PV bas, micro d'annonces) avec un cooldown global pour
  éviter la saturation
- Budget audio : pool de sources par SFX, variation de pitch ±8 % pour éviter
  l'effet mitraillette sur les sons répétés

## Sur-ingénierie à éviter

Pas de i18n, pas de thème, pas de store normalisé, pas de router. Le proto a
trois écrans. Traite-le comme tel.

## Preuves attendues

- Profiling React sur 30 s de jeu : zéro re-render du HUD au-delà de 10/s
- Capture des trois écrans (jeu, mort, fin de niveau)
- Vérification que les touches AZERTY fonctionnent
