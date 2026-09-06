---
name: docs-structure
description: Organisation et écriture de /docs — arborescence, portabilité Notion et Obsidian, frontmatter, règles de liens, conventions de fichier. Charger dès qu'on écrit dans /docs.
---

# Structure de /docs

## Arborescence

```
docs/
  README.md          carte du contenu — porte d'entrée unique
  game/              conception : pitch, personnage, factions, niveau
  systems/           fonctionnement : boucle, physique, rendu, entités, audio
  decisions/         ADR : pourquoi ce choix, alternatives, conséquences
  pipeline/          Blender, textures, export, assets, build
  reference/         tables de valeurs, conventions, contrats de nommage
```

**Un sujet par fichier.** Un fichier de 800 lignes couvrant cinq sujets se
navigue mal dans Obsidian et devient une page illisible dans Notion.

**Deux niveaux maximum.** `docs/systems/loop.md`, jamais
`docs/systems/core/timing/loop.md`. Notion transforme chaque dossier en page
imbriquée, et trois niveaux deviennent pénibles à parcourir.

## Portabilité Notion et Obsidian

C'est la contrainte qui décide de la plupart des conventions ci-dessous.

| Point | Règle | Pourquoi |
|---|---|---|
| **Liens** | relatifs standard `[texte](../systems/loop.md)` | les seuls que les deux comprennent |
| **Wikilinks** | **interdits** | `[[loop]]` reste du texte brut dans Notion |
| **Frontmatter** | minimal, 4 champs max | Obsidian en fait des propriétés, Notion l'affiche en corps de page |
| **Titres** | un seul `#` par document, en tête | Notion en fait le titre de page |
| **Images** | dans `docs/assets/`, chemins relatifs | évite les liens cassés à l'import |
| **Tableaux** | Markdown standard, pas de HTML | Notion ignore le HTML |
| **Callouts** | `> **Note**` plutôt que la syntaxe Obsidian | `> [!warning]` ne survit pas à Notion |
| **Mermaid** | acceptable, dégrade en bloc de code | les deux le rendent, Notion partiellement |

Le point sur les wikilinks est le piège principal : ils sont confortables dans
Obsidian et se perdent silencieusement à l'export vers Notion.
`check_docs_links.py` les signale.

## Frontmatter

```yaml
---
title: Boucle de jeu
tags: [systeme, core]
status: stable
updated: 2026-09-05
---
```

`status` prend `brouillon`, `stable` ou `perime`. Un document `perime` qu'on
garde vaut mieux qu'un document supprimé dont une ancre dépend encore.

## Conventions de fichier

- Noms en minuscules, tirets, sans accents : `boucle-de-jeu.md`
- ADR préfixés d'un numéro à quatre chiffres : `0004-colliders-cuboid.md`
- Un `README.md` par dossier listant son contenu — c'est ce qui empêche les
  orphelins et ce que Notion utilise pour la navigation

## Le README racine est la carte

Tout document doit être atteignable depuis `docs/README.md` en au plus deux
sauts. `check_docs_links.py` signale les orphelins.

Un document orphelin n'est pas seulement mal rangé : personne ne le trouvera,
et il pourrira sans que quiconque s'en aperçoive.

## Ce qui n'a pas sa place dans /docs

- Le contenu généré (API docs depuis TSDoc) — c'est un artefact de build
- Les valeurs de tuning en cours d'arbitrage — elles vivent dans la config
  exposée, `/docs` reçoit la valeur retenue une fois figée
- Les notes de session — celles-là vont dans un journal, pas dans la doc du jeu
- Une copie du code — un extrait de 5 lignes pour illustrer, jamais un fichier

## Sources déjà existantes

Deux documents du projet ont vocation à rejoindre `/docs` tels quels :

| Document | Destination |
|---|---|
| `PLAN_PROTO_BOOMER_SHOOTER.md` | `docs/game/plan-prototype.md` |
| `GUIDE_THREEJS_RAPIER.md` | `docs/reference/threejs-rapier.md` |
