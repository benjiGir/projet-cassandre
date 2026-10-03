---
title: "Prototype — pipeline de niveau — 2026-08"
tags: [journal, pipeline]
status: stable
updated: 2026-09-26
---

# Prototype — pipeline de niveau — 2026-08

Phase 4 — Pipeline de niveau (glTF, conventions de nommage, hot reload).
> Codée et fonctionnelle : `src/game/level/loading/loader.ts` (contrat complet
> `col_*`/`spawn_player`/`spawn_suit_*`/`trig_*`/`door_*`/`use_*`/`secret_*`,
> transforms monde appliqués avant Rapier, reconversion forcée en
> `MeshLambertMaterial`/`NearestFilter` — sinon `GLTFLoader` viole l'invariant
> #5 silencieusement), `src/game/level/loading/hotReload.ts` (sondage HTTP HEAD
> ETag/Last-Modified, 400ms, préserve la position du joueur au reload).
> Câblage additif dans `main.ts` : `gym.ts` reste le niveau par défaut au
> boot, le pipeline glTF s'active via `?level=<nom>` ou
> `window.cassandre.level.load(name)` — rien de cassé côté Phases 1-3.
> Critère humain de cette phase ("déplacer un mur dans Blender, exporter, le
> voir en jeu en moins de 60 secondes, chronométré") pas encore constaté —
> hors de portée d'un agent, à tester par l'utilisateur dans son propre
> Blender.
>
> **
