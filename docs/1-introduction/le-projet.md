---
title: Le projet
tags: [introduction]
status: stable
updated: 2026-09-25
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

Les phases 0 à 6 du prototype (déplacement, arme de mêlée, ennemi Costard,
pipeline de niveau, contenu de la Zone A à E, habillage HUD/menus/écrans)
sont livrées et validées humainement. Le chantier d'architecture Effect/
XState (boucle, rendu, pathfinding, machines d'ennemis, flux d'écran) est
livré en totalité. Le niveau v2 (dix espaces habillés, remplaçant les zones
de test) est construit de bout en bout mais n'a reçu aucun verdict de
playtest sur son habillage. Trois décisions attendent l'utilisateur : le
verdict de playtest du niveau v2, l'amendement de l'invariant #4 sur le
filtrage des textures réduites, et la confirmation de licence de quatre
packs d'assets tiers. Détail daté dans `journal/` (page à venir).

## Ce que le projet n'est pas

Pas de PBR (un seul matériau, `MeshLambertMaterial`), pas d'ECS avant douze
types d'ennemis, pas de multijoueur, pas de character controller maison
(celui de Rapier uniquement), pas de résolution interne au-delà de
640×360. Liste complète et non négociable : `3-architecture/invariants.md`.

## Pour aller plus loin

- `1-introduction/demarrage-rapide.md` — installer et lancer le projet.
- `1-introduction/glossaire.md` — les termes du jeu et du code.
- `1-introduction/comment-lire-cette-doc.md` — comment naviguer le reste de
  la documentation selon votre profil.
