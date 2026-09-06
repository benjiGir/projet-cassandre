---
name: adr-format
description: Format des Architecture Decision Records — structure, statut, quand en écrire un, comment gérer une décision remplacée. Charger pour consigner une décision technique ou de conception.
---

# Architecture Decision Records

## À quoi ça sert

Un ADR répond à la question que tout le monde se pose six mois plus tard :
**« pourquoi c'est fait comme ça ? »**

C'est la destination naturelle des gros blocs de commentaires qui racontent une
histoire — « on avait essayé X, ça ne marchait pas parce que… ».

## Quand en écrire un

- Un choix technique structurant (moteur, bibliothèque, architecture)
- Un choix contre-intuitif que quelqu'un voudra « corriger »
- Un rejet argumenté d'une option évidente
- Une contrainte qui se propage dans tout le projet
- Une décision **encore ouverte** qu'il faut trancher

Pas d'ADR pour : un choix réversible en dix minutes, une convention de style,
une valeur de tuning.

## Format

```markdown
---
title: Colliders cuboid plutôt que trimesh
tags: [adr, physique]
status: accepte
updated: 2026-09-05
---

# ADR 0004 — Colliders cuboid plutôt que trimesh

## Statut

Accepté. Remplace partiellement [ADR 0002](0002-fixed-timestep.md).

## Contexte

Ce qui est vrai au moment de décider. Les contraintes, ce qu'on sait,
ce qu'on ne sait pas.

## Décision

Ce qu'on fait. Une ou deux phrases, à l'affirmative.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Trimesh partout | ghost collisions, instabilité sur triangles fins |

## Conséquences

Ce que ça implique, y compris les inconvénients acceptés.

## Comment on saurait qu'on a eu tort

Le signal qui déclencherait une reconsidération.
```

La dernière section est celle qui manque partout et qui vaut le plus : elle
transforme une décision en hypothèse falsifiable.

## Statuts

| Statut | Sens |
|---|---|
| `propose` | rédigé, pas tranché |
| `accepte` | en vigueur |
| `remplace` | remplacé par un ADR plus récent, **conservé** |
| `raison inconnue` | le comportement est documenté, la raison perdue |

**Un ADR ne se supprime jamais.** Remplacé, il passe en `remplace` avec un lien
vers son successeur. L'historique des décisions abandonnées est souvent plus
utile que les décisions en vigueur.

## Numérotation

Séquentielle, quatre chiffres, jamais réutilisée :
`0001-moteur-threejs.md`, `0002-fixed-timestep.md`.

## Longueur

**Une page.** Un ADR de cinq pages ne sera pas lu, donc n'existe pas.

Si le contexte déborde, il appartient à `docs/systems/` et l'ADR y renvoie.
