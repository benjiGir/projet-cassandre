---
title: Documentation PROJET_CASSANDRE
tags: [index]
status: stable
updated: 2026-09-26
---

# PROJET_CASSANDRE

Boomer shooter rétro en Three.js, façon Duke Nukem 3D / Ion Fury : un
hypermarché sert de façade à un complot reptilien. Pitch complet, ton, stack
et état du prototype : [1-introduction/le-projet.md](1-introduction/le-projet.md).

## Par où entrer, selon ce que vous cherchez

### Je découvre

- [Le projet](1-introduction/le-projet.md) — pitch, ton, stack, où en est le prototype.
- [Démarrage rapide](1-introduction/demarrage-rapide.md) — installer, lancer, la console `cassandre`.
- [Comment lire cette doc](1-introduction/comment-lire-cette-doc.md) — les six parties, les parcours par profil.
- [Glossaire](1-introduction/glossaire.md) — le vocabulaire du projet, français et anglais mêlés.

### Je veux comprendre

- [Vue d'ensemble](3-architecture/vue-d-ensemble.md) — les quatre blocs du projet.
- [Invariants](3-architecture/invariants.md) — les 11 règles actives non négociables (deux retirées) et pourquoi.
- [Expérience de jeu](2-fonctionnel/experience-de-jeu.md) — la boucle du joueur, vue de la manette.
- [Le niveau](2-fonctionnel/le-niveau.md) — l'hypermarché, les dix espaces, la progression.

### Je veux modifier

- [Reprendre le projet](5-guides/reprendre-le-projet.md) — parcours du premier jour.
- [Où agir](5-guides/ou-agir.md) — trouver les fichiers d'une fonctionnalité.
- [Ajouter un objet interactif](5-guides/ajouter-un-objet-interactif.md) — contrat glTF de bout en bout.
- [Ajouter un ennemi](5-guides/ajouter-un-ennemi.md) — recette pas à pas.
- [Ajouter une arme](5-guides/ajouter-une-arme.md) — recette pas à pas.
- [Modifier le niveau](5-guides/modifier-le-niveau.md) — session Blender live, build, audit, export.
- [Chargement de niveau](4-technique/chargement-de-niveau.md) — conventions glTF, loader, hot reload.

### Je cherche une valeur ou une convention

- [Valeurs de déplacement](6-reference/valeurs-deplacement.md)
- [Valeurs des ennemis](6-reference/valeurs-ennemis.md)
- [Conventions de nommage](6-reference/conventions-nommage.md)
- [Index des décisions (ADR)](decisions/README.md)

## Les parties de la doc

| Dossier | À quoi il sert | État |
|---|---|---|
| [1-introduction](1-introduction/README.md) | le projet, démarrage rapide, glossaire | écrit (4/4 ; 3 stables) |
| [2-fonctionnel](2-fonctionnel/README.md) | ce que fait le jeu, vu du joueur | écrit (9/9) |
| [3-architecture](3-architecture/README.md) | comment le tout est découpé et pourquoi | écrit (9/9) |
| [4-technique](4-technique/README.md) | comment chaque système fonctionne à l'intérieur | en cours (20/20 rédigées ; 7 stables) |
| [5-guides](5-guides/README.md) | reprendre le projet, où agir, recettes pas à pas | écrit (16/16 ; brouillons à relire) |
| [6-reference](6-reference/README.md) | tables de valeurs, conventions, commandes, console | écrit (12/12 ; brouillons à relire) |

Le nombre avant la barre compte les pages rédigées ; « stable » compte les
pages relues par une autre personne. Les README de dossier sont exclus.

## En attendant la nouvelle doc

Chaque partie encore à écrire est aujourd'hui couverte par l'ancienne doc, qui
reste en place le temps du chantier ([PLAN_DOCUMENTATION.md](../PLAN_DOCUMENTATION.md)).
La correspondance complète est dans [`_chantier/correspondance.tsv`](_chantier/correspondance.tsv).

**1-introduction** (contenu déjà repris) :
[game/univers.md](game/univers.md) — stub jamais rempli, rien à migrer.

**2-fonctionnel** :
[game/plan-prototype.md](game/plan-prototype.md) — phases, critères, rollback ·
[game/niveau-hypermarche.md](game/niveau-hypermarche.md) — le niveau, zone par zone ·
[game/niveau-v2-plan-de-masse.md](game/niveau-v2-plan-de-masse.md) — plan de masse du niveau v2.

**3-architecture** :
[systems/boucle-de-jeu.md](systems/boucle-de-jeu.md) — pas fixe, interpolation, hitstop ·
[systems/session.md](systems/session.md) — `GameEngine`/`GameSession`, boot, reset.

**4-technique** :
Les jalons D33 à D38 sont rédigés dans [chargement de niveau](4-technique/chargement-de-niveau.md), [systèmes de niveau](4-technique/systemes-de-niveau.md), [rendu](4-technique/rendu.md), [sprites et viewmodel](4-technique/sprites-et-viewmodel.md), [éclairage](4-technique/eclairage.md) et [budget de rendu](4-technique/budget-de-rendu.md).
Les jalons D39 à D45 sont rédigés dans [interface React](4-technique/interface-react.md), [audio runtime](4-technique/audio-runtime.md), [outillage Blender](4-technique/outillage-blender.md), [studio audio](4-technique/studio-audio.md), [générateurs](4-technique/generateurs.md), [tests et qualité](4-technique/tests-et-qualite.md) et [debug](4-technique/debug.md).
[systems/hud.md](systems/hud.md), [systems/hud-audio.md](systems/hud-audio.md), [systems/debug.md](systems/debug.md) — interface, audio, outils de debug ·
[pipeline/niveau-blender.md](pipeline/niveau-blender.md), [pipeline/harmonisation-assets.md](pipeline/harmonisation-assets.md) — auteur du niveau et pipeline Blender/textures ·
[systems/armes.md](systems/armes.md) et [_chantier/a-reprendre.md](_chantier/a-reprendre.md) — discipline de déterminisme et protocole des harnais A/B qui restent à reprendre.

**Phase H — jalons D46 à D62** : références, guides transverses et onze recettes sont rédigés dans [6-reference](6-reference/README.md) et [5-guides](5-guides/README.md). La phase I (journal et archivage de l'ancienne doc) reste à faire.

**6-reference** :
[pipeline/assets.md](pipeline/assets.md) — arborescence des assets ·
[reference/react-structure.md](reference/react-structure.md), [reference/react-bonnes-pratiques.md](reference/react-bonnes-pratiques.md), [reference/react-css.md](reference/react-css.md), [reference/react-composition.md](reference/react-composition.md) — conventions React ·
[reference/controles.md](reference/controles.md), [reference/threejs-rapier.md](reference/threejs-rapier.md), [reference/conventions-nommage.md](reference/conventions-nommage.md), [reference/valeurs-deplacement.md](reference/valeurs-deplacement.md), [reference/valeurs-ennemis.md](reference/valeurs-ennemis.md) — valeurs et conventions.

Trois pages iront au journal, pas encore écrit (destination en backticks) :
[assets/board-hypermarche.md](assets/board-hypermarche.md) (`journal/niveau-v2.md`),
[assets/board-pistolet.md](assets/board-pistolet.md) (`journal/playtests-2026-09.md`),
[reference/etat-des-lieux-code-architecture.md](reference/etat-des-lieux-code-architecture.md)
(`journal/audit-architecture-2026-09.md`).

## Décisions, journal, archive

- [Index des décisions (ADR)](decisions/README.md) — une ligne de résumé et le statut par ADR, regroupés par domaine.
- [Journal](journal/README.md) — historique daté des chantiers et des playtests, en construction.
- [Archive](archive/README.md) — recevra l'ancienne doc figée en `status: perime` au jalon D64.

## Conventions

Liens relatifs, pas de wikilinks, frontmatter à quatre champs, deux niveaux de
dossier maximum. Détail et parcours de lecture selon votre profil :
[comment-lire-cette-doc.md](1-introduction/comment-lire-cette-doc.md).
