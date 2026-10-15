---
title: Comment lire cette doc
tags: [introduction, guide]
status: stable
updated: 2026-10-08
---

# Comment lire cette doc

Cette page présente les six parties de la documentation et propose un
parcours selon votre tâche. L'index racine donne accès aux pages actuelles;
les pages historiques sont dans l'archive et les chantiers livrés dans le
journal.

## Les six parties, plus décisions/journal/archive

- **`1-introduction/`** — le projet, comment le lancer, le glossaire des
  termes du jeu. À lire en premier, une seule fois.
- **`2-fonctionnel/`** — ce que fait le jeu, vu du joueur. Zéro code. Pour
  comprendre une fonctionnalité avant d'aller y toucher.
- **`3-architecture/`** — comment le tout est découpé, pourquoi, et ce qui est
  interdit entre les blocs. Pour comprendre où une modification doit vivre
  avant de l'écrire.
- **`4-technique/`** — un système par page, décrit de l'intérieur : fichiers,
  contrats de données, pièges, comment vérifier. C'est la partie la plus
  consultée en travaillant.
- **`5-guides/`** — reprendre le projet, savoir où agir, recettes pas à pas
  pour les tâches courantes (ajouter une arme, modifier le niveau…).
- **`6-reference/`** — tables de valeurs, conventions de nommage, commandes,
  API console. Ce qu'on va chercher, pas ce qu'on lit d'un bout à l'autre.
- **`decisions/`** — les ADR : pourquoi un choix précis a été fait, quelles
  alternatives ont été écartées. Une page technique y renvoie plutôt que de
  répéter le raisonnement.
- **`journal/`** — l'historique daté des chantiers et des playtests : ce qui a
  été tenté, rejeté, corrigé, et quand. Une page technique ne raconte jamais
  cet historique — c'est ici qu'il vit.
- **`archive/`** — l'ancienne documentation, gelée, marquée `perime`. À
  consulter seulement si une page actuelle vous y renvoie explicitement.

## Quatre parcours conseillés

### Dev gameplay (TypeScript, `src/core`, `src/game`, `src/physics`)

1. `1-introduction/le-projet.md`, `1-introduction/demarrage-rapide.md`
2. `3-architecture/invariants.md` — les onze règles actives non négociables
3. `3-architecture/boucle-et-temps.md` puis `3-architecture/carte-des-modules.md`
4. `4-technique/joueur.md`, `4-technique/armes.md`, `4-technique/ennemis-et-ia.md`
   selon le système visé
5. `5-guides/ou-agir.md` pour trouver la ligne qui correspond à votre tâche

### Level designer (Blender, contenu du niveau)

1. `1-introduction/le-projet.md`, `1-introduction/demarrage-rapide.md`
   (section Blender/Python)
2. `2-fonctionnel/le-niveau.md` — les dix espaces, la progression par cartes
3. `6-reference/conventions-nommage.md` — les préfixes `col_*`, `door_*`,
   `use_*`, `prop_*`…
4. `4-technique/chargement-de-niveau.md`, `4-technique/outillage-blender.md`
5. `5-guides/modifier-le-niveau.md` — le geste complet : session Blender
   live, build, audit, export

### Son (studio audio, sprite runtime)

1. `2-fonctionnel/son.md` — ce qu'on entend et pourquoi
2. `4-technique/studio-audio.md` — le pipeline `tools/audio/`, synthèse
   procédurale, mesures
3. `4-technique/audio-runtime.md` — le sprite Howler, `SFX_TABLE`
4. `5-guides/ajouter-un-son.md`

### Interface React (HUD, menus, écrans)

1. `3-architecture/flux-de-donnees.md` — input → gameplay → store zustand → HUD
2. `4-technique/interface-react.md` — structure de `src/ui/`, store, machine
   de flux
3. `2-fonctionnel/interface.md` — ce que l'utilisateur voit
4. `5-guides/ajouter-un-ecran-ou-un-widget.md`, et les quatre pages
   `6-reference/react-*.md` pour les conventions de code React

## Deux réflexes transverses

- Une page dit toujours si ce qu'elle décrit est **validé en playtest** ou
  **en attente de verdict** (section « État » des pages fonctionnelles) — ne
  prenez pas un brouillon pour un acquis.
- Si une page semble contredire le code, vérifiez d'abord le comportement
  actuel, puis corrigez la page dans le même changement. Si le comportement
  ou l'invariant doit être arbitré, consignez la question dans un ADR proposé
  et demandez une décision au responsable du projet.
