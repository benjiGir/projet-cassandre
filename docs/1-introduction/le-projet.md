---
title: Le projet
tags: [introduction]
status: stable
updated: 2026-10-02
---

# Le projet

## Le pitch

Un youtubeur complotiste à 200 abonnés avait raison sur toute la ligne : un
hypermarché sert de façade à un complot reptilien. PROJET_CASSANDRE est un
boomer shooter rétro dans le style de Duke Nukem 3D et Ion Fury, avec le look
du moteur Build — polygones bas, textures 64-128 px, gros pixel assumé. Le
ton est satirique : Costards en costume-cravate, marques de supermarché
inventées, un Directeur dont la peau se déchire pour révéler le reptilien
en dessous.

## Le prototype

Un niveau (l'hypermarché, dix espaces reliés en hub à la Duke 3D), trois
armes côté joueur — pied-de-biche (`meleeDamage`), pistolet et pompe, plus
l'état désarmé de départ (`WeaponKind` dans
`src/game/player/weapons.ts`) — et deux types d'ennemi : le Costard (`Suit`,
ennemi de base) et le Directeur (`Director`, boss unique en fin de niveau).
Durée visée : 8 à 10 minutes de jeu, chronométrée dans le récap de fin de
partie sur le niveau complet (`parTime: 600` dans `src/game/level/levels.ts`).

## La stack

- **Vite** — serveur de dev et build.
- **TypeScript** — tout le code du jeu.
- **three.js**, en vanilla (pas de framework React-three) — le rendu 3D.
- **Rapier** (`@dimforge/rapier3d-compat`) — physique et déplacement du
  personnage.
- **React**, uniquement en overlay — HUD, menus, écrans ; jamais dans la
  boucle de jeu elle-même (voir `3-architecture/invariants.md`).
- **zustand** — état partagé entre la boucle de jeu et l'overlay React.
- **howler** — lecture audio, sprite unique pour tous les sons du jeu.
- **Effect** — orchestration de la boucle de jeu et des services (RNG,
  raycast, pathfinding) derrière une frontière synchrone stricte.
- **XState** — machines à états des ennemis et du flux d'écran (menu → jeu →
  fin de niveau).
- **Blender → glTF** — le niveau est construit dans Blender, exporté en
  `.glb`, chargé par un pipeline de conventions de nommage.
- **Python** — scripts headless pour Blender (kit, niveau, textures) et pour
  le studio audio (synthèse procédurale).

## Où en est le projet

**Version 1.0.0 livrée le 2026-10-02** : le MVP jouable, publié en open
source sous licence MIT (`LICENSE` à la racine) et déployé sur GitHub Pages.
Contenu : le niveau v2 (l'hypermarché, ses dix espaces et ses coulisses),
trois armes, le Costard et le Directeur, le HUD « stream » et ses répliques
voisées, une ambiance sonore par zone. Le détail des versions est dans
`CHANGELOG.md`, l'historique daté des chantiers dans `journal/`.

Restent ouverts après la 1.0.0 : l'amendement de l'invariant #4 sur le
filtrage des textures réduites (ADR 0027, proposé) et la documentation du
jalon N10 du niveau v2 (`docs/2-fonctionnel/le-niveau.md` à réécrire).

## Ce que le projet n'est pas

Pas de PBR, pas d'ECS avant douze types d'ennemis, pas de multijoueur, pas
de character controller maison (celui de Rapier uniquement), pas de
résolution interne au-delà de 640×360 par défaut. Liste complète et non négociable : `3-architecture/invariants.md`.

## Pour aller plus loin

- `1-introduction/demarrage-rapide.md` — installer et lancer le projet.
- `1-introduction/glossaire.md` — les termes du jeu et du code.
- `1-introduction/comment-lire-cette-doc.md` — comment naviguer le reste de
  la documentation selon votre profil.
