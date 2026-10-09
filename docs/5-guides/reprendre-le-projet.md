---
title: Reprendre le projet
tags: [guide, parcours]
status: brouillon
updated: 2026-10-08
---

# Reprendre le projet

Ce parcours vous mène d'une première lecture à une modification vérifiée. Suivez l'ordre ; vous n'avez pas besoin de connaître l'historique du dépôt.

## 1. Comprendre le produit

Lisez [Le projet](../1-introduction/le-projet.md), puis le [glossaire](../1-introduction/glossaire.md). Passez ensuite par [l'expérience de jeu](../2-fonctionnel/experience-de-jeu.md), les [contrôles](../2-fonctionnel/deplacement-et-controles.md) et [le niveau](../2-fonctionnel/le-niveau.md).

Le joueur explore un hypermarché, combat les Costards, collecte des cartes et cherche des secrets avant le Directeur. Le prototype est construit autour d'une boucle fixe et d'un rendu rétro en Three.js.

## 2. Lancer le projet

Installez la version de Node compatible au projet et les dépendances verrouillées, puis utilisez `pnpm dev`. Les commandes de vérification sont dans [Commandes](../6-reference/commandes.md). Pour le premier passage, lancez aussi `pnpm check:docs` afin de connaître l'état du graphe documentaire.

Ouvrez le navigateur sur le serveur Vite. Les contrôles initiaux sont dans [Contrôles](../6-reference/controles.md). Les outils de développement comme la console `cassandre` sont présents seulement dans la configuration dev.

## 3. Comprendre les frontières

Lisez la [vue d'ensemble](../3-architecture/vue-d-ensemble.md), les [invariants](../3-architecture/invariants.md), la [carte des modules](../3-architecture/carte-des-modules.md), puis [boucle et temps](../3-architecture/boucle-et-temps.md). Pour une modification React, lisez les quatre [références React](../6-reference/README.md). Pour le niveau, suivez [Chargement de niveau](../4-technique/chargement-de-niveau.md).

Le code actuel et les pages techniques sont les sources d'autorité. Les anciennes pages conservées dans [`archive/`](../archive/README.md) servent uniquement à retrouver l'historique; utilisez la page actuelle indiquée dans leur bandeau.

## 4. Choisir une tâche

Cherchez votre intention dans la table [Où agir](ou-agir.md), puis lisez la page technique associée. Pour une tâche récurrente, suivez la recette correspondante : [ajouter une arme](ajouter-une-arme.md), [un ennemi](ajouter-un-ennemi.md), [un objet interactif](ajouter-un-objet-interactif.md), [un son](ajouter-un-son.md), ou [modifier le niveau](modifier-le-niveau.md).

Avant de toucher un sous-système, consultez [Pièges connus](pieges-connus.md) et [Conventions de code](conventions-de-code.md). Si le changement traverse des modules, faites préciser les frontières et les propriétaires de fichiers.

## 5. Vérifier et transmettre

Choisissez une vérification qui couvre le comportement modifié. Une modification TypeScript peut demander typecheck et Vitest ; un changement Blender demande validation, audit et inspection de l'export ; un changement audio demande analyse, génération, préécoute et écoute humaine. Le guide [Mesurer une perf](mesurer-une-perf.md) décrit les preuves chiffrées et [Diagnostic simulation](diagnostiquer-un-bug-de-simulation.md) le rejeu F9/F10.

Rédigez ou mettez à jour un ADR lorsqu'une décision contraint durablement l'architecture. Mettez à jour la documentation du comportement dans le même changement. Pour poursuivre avec une équipe d'agents, lisez [Travailler avec les agents](travailler-avec-les-agents.md).

## Sources à garder ouvertes

- [README de la documentation](../README.md) — carte et état des six parties.
- [Guide technique](../4-technique/README.md) — systèmes et chemins source.
- [Référence](../6-reference/README.md) — commandes, valeurs, console, contrôles.
- [Journal](../journal/README.md) — chantiers datés, livraisons et retours de playtest.
- [Archive](../archive/README.md) — documentation précédente conservée avec ses remplacements.
