---
title: Ce que coûte une image — mesures
tags: [systemes, rendu, performance]
status: stable
updated: 2026-09-12
---

# Ce que coûte une image — mesures

Page de référence chiffrée, pas de théorie : tous les nombres viennent du
banc `cassandre.renderBench()` et d'un chronomètre GPU
(`EXT_disjoint_timer_query_webgl2`), sur la salle d'essai « rayons » du
jalon N4. Elle existe parce que le budget de rendu du niveau v2 avait été
posé **a priori** au jalon N1 (200 000 triangles, 200 lots de dessin) sans
avoir jamais été confronté à une machine.

Conclusion en une phrase : **ce ne sont pas les triangles qui coûtent, ce
sont les lampes.**

## La machine de mesure

| | |
|---|---|
| GPU | Apple M3 Pro (ANGLE / Metal) |
| `MAX_FRAGMENT_UNIFORM_VECTORS` | 1024 |
| Résolution interne | 640 × 360 (invariant #4) |
| WebGPU disponible | oui (`navigator.gpu`) |

**Cette machine n'est pas la cible.** Le plan vise un portable à GPU intégré,
plusieurs fois plus lent. Les millisecondes ci-dessous sont des mesures, pas
des garanties : les lire comme un ordre de grandeur et une forme de courbe,
en gardant une marge.

## Comment mesurer

Les images par seconde ne se mesurent pas depuis un navigateur piloté en
automatisation : `document.visibilityState` y vaut `hidden`, ce qui bride
`requestAnimationFrame` à une image par seconde et fausse tout. Le banc
contourne le problème en appelant `renderer.render` lui-même, en boucle
serrée, sans jamais dépendre de `requestAnimationFrame` :

```js
cassandre.renderBench(120)            // coût CPU, draw calls, triangles
cassandre.lightBudget(8)              // n'allume que les 8 lampes les plus proches
cassandre.lightBudget(null)           // tout rallumer
```

Le coût GPU réel demande en plus un chronomètre GPU : `gl.finish()` seul ne
mesure que l'envoi des commandes côté CPU — précisément la partie qui ne
coûte rien quand le problème est ailleurs. Procédure complète dans
`benchmarkRender` (`src/game/devtools/testHarness.ts`).

## Les triangles ne coûtent presque rien

Copies de la salle d'essai empilées au même endroit — donc **toutes dans le
champ**, aucun tri d'écart, un pire cas honnête. Budget de lampes fixé à 8
pour que seule la géométrie varie.

| Triangles | Lots de dessin | GPU | CPU |
|---:|---:|---:|---:|
| 90 000 | 27 | 0,87 ms | 0,11 ms |
| 452 000 | 85 | 1,96 ms | 0,18 ms |
| **1 446 000** | 261 | **4,94 ms** | 0,60 ms |
| 3 615 000 | 649 | 10,06 ms | 2,73 ms |

Le niveau v2 est estimé à **1,45 million de triangles** (jalon N6) : c'est
la ligne en gras. Moins de 5 ms sur cette machine, **avec la carte entière
dans le champ**, pour un budget d'image de 16,6 ms à 60 images par seconde.
Le budget de 200 000 triangles de N1 était donc trop prudent d'un ordre de
grandeur.

## Les lampes coûtent, et elles ont un mur

Même salle, géométrie constante (90 400 triangles, 22 lots), seul le nombre
de `PointLight` allumées varie.

| Lampes allumées | GPU |
|---:|---:|
| 0 | 0,35 ms |
| 4 | 0,44 ms |
| 8 | 0,69 ms |
| 16 | 0,60 ms |
| 27 | 1,27 ms |
| 29 | 1,29 ms |

Environ **0,03 ms par lampe** à 640 × 360 dans une scène à faible
recouvrement. Le coût suit les pixels éclairés, pas les triangles : three.js
pose toutes les lampes en uniformes de fragment et les évalue toutes, pour
chaque pixel, sans le moindre tri spatial.

### Le mur : 254 lampes

Mesuré au fil de l'eau, sur une scène en contenant 1 082 :

| Lampes allumées | Résultat |
|---:|---|
| 254 | compile, dessine |
| **255** | **ne compile plus, plus rien ne se dessine** |

```
THREE.WebGLProgram: Shader Error 1282 - VALIDATE_STATUS false
Material Type: MeshLambertMaterial
FRAGMENT shader uniforms count exceeds MAX_FRAGMENT_UNIFORM_VECTORS(1024)
```

Le symptôme est méchant : **aucune erreur à l'écran**, la géométrie
concernée disparaît simplement, et le coût s'effondre — ce qui peut se lire
comme une optimisation réussie si on ne regarde que le chronomètre. Le seul
signe est en console.

Et 254 est la valeur **de cette machine**. Le minimum garanti par la
spécification WebGL 2 pour `MAX_FRAGMENT_UNIFORM_VECTORS` est de 224
vecteurs, soit environ quatre fois moins que les 1024 relevés ici : sur une
machine conforme mais modeste, le mur peut tomber vers **une cinquantaine de
lampes**. Aucun niveau ne doit s'approcher de ces ordres de grandeur.

## Ce que ça change pour le niveau v2

La salle d'essai porte 27 lampes pour 320 m². À cette densité, les 13 472 m²
du niveau v2 en demanderaient **environ 1 140** : le shader ne compilerait
sur aucune machine, et même s'il compilait, ce serait environ 36 ms par
image rien que pour l'éclairage.

C'est donc l'éclairage, et non la géométrie, qui impose de ne traiter que ce
qui est proche du joueur. Décision et remède : [ADR 0026](../decisions/0026-visibilite-par-espace-et-pool-de-lampes.md).
