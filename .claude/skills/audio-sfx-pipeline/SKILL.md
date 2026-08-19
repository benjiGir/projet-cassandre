---
name: audio-sfx-pipeline
description: Audio du jeu avec Howler — pooling de sources, variation de pitch, spatialisation, ducking, déclenchement contextuel des répliques du héros. Charger pour toute tâche sonore.
---

# Audio

## Ce que Howler fait déjà

Ne pas écrire de pool maison : `pool` et les audio sprites sont natifs.

```ts
const sfx = new Howl({
  src: ['sfx.ogg', 'sfx.m4a'],
  sprite: { shot: [0, 420], reload: [500, 780], impact: [1400, 260] },
  pool: 12,
});
sfx.play('shot');
```

Les **audio sprites** empaquettent tous les SFX courts dans un fichier unique :
un seul décodage, une seule requête, latence minimale. C'est le pattern
recommandé pour un jeu.

`html5: true` pour la musique (streaming, économise la mémoire), **jamais pour
les SFX** — ça casse la latence.

Repère : 50 sons superposés passent, 500 glitchent.

## Variation de pitch

**±8 % systématique** sur tout son répété (tirs, impacts, pas, douilles). Sans
ça, l'oreille détecte la répétition en trois secondes et le son devient une
mitraillette de samples identiques. C'est un des écarts les plus audibles
entre un proto et un jeu fini, pour un coût dérisoire.

Ne pas varier : les sons uniques et signifiants (ramassage de clé, secret
trouvé, réplique du héros).

## Spatialisation

Howler gère le panning stéréo par position. Suffisant pour ce projet — pas
besoin de HRTF.

Point critique côté gameplay : **la télégraphie d'attaque ennemie doit être
audible et directionnelle**. C'est le principal canal qui permet au joueur de
savoir qui lui tire dessus hors champ (voir `enemy-state-machine`).

## Répliques du héros

Le personnage est un youtubeur complotiste. Ses répliques sont ses
catchphrases de chaîne — c'est la justification diégétique du one-liner.

Déclencheurs contextuels : premier kill, secret trouvé, PV bas, usage du micro
d'annonces, fin de niveau.

**Cooldown global de 15 s minimum** entre deux répliques, quelle que soit la
source. La saturation est ce qui rend les one-liners insupportables — Duke 3D
lui-même en souffre quand on enchaîne les kills.

## Ducking

Baisse la musique de 6 dB pendant une réplique, remontée sur 400 ms. Sans ça,
la ligne est inintelligible et la blague tombe à plat.

## Budget

| Aspect | Cible |
|---|---|
| Sons simultanés | < 24 |
| Taille totale des assets audio | < 8 Mo pour le proto |
| Format | `.ogg` en principal, `.m4a` en fallback Safari |
| Latence de déclenchement | < 30 ms depuis l'événement de gameplay |

## Piège navigateur

Le contexte audio est suspendu tant qu'il n'y a pas eu d'interaction
utilisateur. Reprends-le sur le même événement que le `pointerlock` — sinon le
premier tir est muet et le bug passe inaperçu en développement, où l'onglet a
déjà reçu des clics.
