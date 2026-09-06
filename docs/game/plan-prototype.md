---
title: Plan du prototype
tags: [brouillon, game]
status: brouillon
updated: 2026-09-05
---

# Plan du prototype

> **Partiellement migré.** Ce document ne couvre pour l'instant que la
> Phase 1 (gym), migrée depuis `src/game/level/gym.ts`. Le reste de
> `PLAN_PROTO_BOOMER_SHOOTER.md` (phases, critères, rollback complets)
> attend une passe de migration dédiée — voir le skill
> `comment-migration-protocol`.

## Phase 1 — Gym, instrument de mesure

`src/game/level/gym.ts` n'est pas un décor : c'est un instrument de mesure.
Chaque zone encadre un seuil du character controller pour qu'un
franchissement raté soit lisible à l'œil, sans HUD ni chiffres. Toute la
géométrie est construite à la main (pas de loader glTF — la Phase 4
introduira le pipeline Blender séparément).

Valeurs de référence du controller au moment d'écrire ce fichier (en cours
de tuning ailleurs, voir [Valeurs de déplacement](../reference/valeurs-deplacement.md)
pour les valeurs actuelles) : autostep 0.35 m, pente max 50°, hauteur de
saut 1.1 m, marche 9 m/s, course 13 m/s, capsule rayon 0.4 / hauteur 1.2,
yeux à 1.6 m.

Layout depuis le spawn (hub central = « espace ouvert ») :

- **Nord** → couloir long (44 m, repères tous les 5 m) — mesure la vitesse
  de pointe à l'œil.
- **Sud** → rampes (20°/35°/45°/55°) puis, plus loin, plateformes
  (0.8 à 1.4 m). La pente max du controller est 50° : la rampe à 55° doit
  rester infranchissable, c'est le test du seuil. Les hauteurs de
  plateforme testent la hauteur de saut effective (seuil controller
  1.1 m).
- **Est** → escaliers (marches 0.15 à 0.45 m, seuil controller : autostep
  0.35 m) puis, plus loin, gouffres (portées 2 à 5 m, franchies en pleine
  course — un gouffre franchi de justesse est le meilleur détecteur de
  mollesse du déplacement).
- **Ouest** → mur plein, pas d'aile.

Toutes les ailes s'ouvrent directement sur le hub au niveau du sol : on
atteint l'entrée de chaque zone à pied, sans saut. À l'intérieur d'une zone,
le saut/l'ascension EST l'instrument.

Le spawn est au centre du hub, orienté vers l'entrée du couloir nord :
32 m de hub ouvert puis 44 m de couloir en ligne droite, largement de quoi
sentir la vitesse de pointe dans les 10 premières secondes.

**Résultat** : combat/déplacement jugés fun par l'utilisateur en playtest
(« Quake / Half-Life 1 ») — Phase 1 validée. Deux bugs de stutter trouvés
après ce playtest et corrigés (reclip de vélocité sur mur uniquement,
`groundStickSpeed` réduit) — voir
[Rapier/Three.js — guide de terrain](../reference/threejs-rapier.md).

Retour à la [carte de la documentation](../README.md).
