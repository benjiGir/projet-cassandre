---
title: Le projet
tags: [introduction]
status: stable
updated: 2026-10-08
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
armes côté joueur — pied-de-biche (`meleeDamage`), pistolet et pompe, plus un
coup de pied tant qu'aucune arme n'est équipée (`WeaponKind` dans
`src/game/player/weapons/weaponTypes.ts`). Les ennemis sont le Costard (`Suit`,
ennemi de base), le Rampant et le Vigile, qui partagent sa machine d'état, et
le Directeur (`Director`, boss unique en fin de niveau).
Durée visée : 8 à 10 minutes de jeu, chronométrée dans le récap de fin de
partie sur le niveau complet (`parTime: 600` dans `src/game/level/catalog/levels.ts`).

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

**Version courante : 1.3.0 (2026-10-06).** La 1.0.0 (2026-10-02) a livré le
MVP jouable, publié en open source sous licence MIT (`LICENSE` à la racine) et
déployé sur GitHub Pages : le niveau v2 (l'hypermarché, ses dix espaces et ses
coulisses), trois armes, le Costard et le Directeur, le HUD « stream » et ses
répliques voisées, une ambiance sonore par zone. Les versions 1.1.0 « Le live »
et 1.2.0 « Les sponsors » ont ajouté le direct, ses dons et les bornes ; la 1.3.0
ajoute le coup de pied, de nouveaux modèles d'armes et des portes refaites. Le
détail des versions est dans `CHANGELOG.md`, l'historique daté des chantiers
dans `journal/`.

Décisions encore ouvertes (statut `propose`) : l'[ADR 0006](../decisions/0006-air-strafing.md)
(air strafing), l'[ADR 0027](../decisions/0027-filtrage-des-textures-reduites.md)
(amendement de l'invariant #4 sur le filtrage des textures réduites) et l'[ADR 0034](../decisions/0034-resolution-interne-configurable.md)
(résolution interne configurable).

## Ce que le projet n'est pas

Pas de PBR, pas d'ECS avant douze types d'ennemis, pas de multijoueur, pas
de character controller maison (celui de Rapier uniquement), pas de
résolution interne au-delà de 640×360 par défaut. Liste complète et non négociable : `3-architecture/invariants.md`.

## Pour aller plus loin

- [Démarrage rapide](demarrage-rapide.md) — installer et lancer le projet.
- [Glossaire](glossaire.md) — les termes du jeu et du code.
- [Comment lire cette doc](comment-lire-cette-doc.md) — comment naviguer le reste de
  la documentation selon votre profil.
