---
name: audio-sfx-pipeline
description: Audio du jeu avec Howler — pooling de sources, variation de pitch, spatialisation, ducking, déclenchement contextuel des répliques du héros. Charger pour toute tâche sonore.
---

# Audio

## Pooling

Un boomer shooter tire vite. Rejouer la même instance de son coupe le son
précédent ; en créer une nouvelle à chaque tir sature la mémoire.

Pool de N instances par SFX (N = 4 à 8 pour les armes), rotation circulaire :

```ts
class SfxPool {
  private sounds: Howl[];
  private i = 0;
  play(volume = 1) {
    const s = this.sounds[this.i];
    this.i = (this.i + 1) % this.sounds.length;
    s.rate(0.92 + Math.random() * 0.16);   // ±8 %
    s.volume(volume);
    s.play();
  }
}
```

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
