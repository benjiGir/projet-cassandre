---
title: Matériaux TSL ciblés
tags: [adr, rendu, tsl]
status: accepte
updated: 2026-09-28
---

# ADR 0035 — Matériaux TSL ciblés

## Statut

Accepté le 2026-09-28 à la demande de l'utilisateur. L'exclusivité
`MeshLambertMaterial` de l'invariant #5 est retirée.

## Contexte

Le jeu utilise Three.js 0.185.1 et `WebGLRenderer`. Le shader d'eau écrit en
`onBeforeCompile` est difficile à composer et son résultat visuel a été rejeté.
Cette version fournit `WebGLNodesHandler`, qui permet de dessiner des matériaux
TSL avec le renderer WebGL existant. Le loader, les portes et plusieurs effets
attendent encore des matériaux classiques ; le projet n'a pas besoin d'une
migration générale pour essayer TSL sur un effet isolé.

## Décision

Autoriser le mélange de matériaux classiques et TSL. Activer `WebGLNodesHandler`
sur le renderer existant et utiliser TSL d'abord pour le jet d'eau, avec un
`MeshLambertNodeMaterial` animé par un uniforme avancé au pas fixe.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Garder l'exclusivité Lambert classique | Bloque les matériaux nodaux et les compositions TSL. |
| Migrer tout le moteur vers `WebGPURenderer` | Inutile pour ce shader ; augmente le périmètre et les compatibilités à valider. |
| Garder le shader GLSL en chaînes `onBeforeCompile` | Le rendu d'eau a été jugé laid et la composition par remplacement de chaînes reste fragile. |

## Conséquences

- Les matériaux glTF restent convertis en Lambert par défaut.
- Les effets TSL ciblés remplacent leur matériau après le chargement du niveau.
- Les systèmes qui testent `instanceof MeshLambertMaterial` ne doivent pas
  recevoir un matériau node sans adaptation.
- Les animations de shader reçoivent leur temps depuis le pas fixe ; le node
  TSL `time` ne pilote pas l'état du jeu.
- `WebGLNodesHandler` a des limites de compatibilité propres à son adaptateur ;
  le rendu réel doit être vérifié sur l'effet utilisé.

## Comment on saurait qu'on a eu tort

Si le shader ne compile pas sur le renderer WebGL ciblé, si l'adaptateur crée
des erreurs console, ou si le coût du rendu dépasse le budget du jeu, revenir à
un matériau classique pour l'effet concerné.
