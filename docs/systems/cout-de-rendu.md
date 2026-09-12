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
cassandre.lightBudget()               // état du pool, sans rien changer
cassandre.lightBudget(8)              // n'allume que les 8 lampes les plus proches
cassandre.lightBudget(null)           // tout rallumer
cassandre.lighting().lights           // `visible: false` = éteinte PAR LE POOL
```

**Piège de cette mesure, découvert en la faisant.** Déplacer le joueur
(`cassandre.player.spawn(...)`) ne déplace PAS la caméra tant que la boucle
d'affichage ne tourne pas — et elle ne tourne pas dans un onglet masqué. Une
série de mesures « à différentes positions » obtenue ainsi peut être une
série d'une seule et même vue, et ça ne se voit pas dans les chiffres. La
parade : poser `camera.position`/`camera.lookAt` directement avant chaque
`renderBench`. Le témoin qui trahit le problème est le panneau de debug —
`Steps: 0` et `Pos: 0,0,0` veulent dire que rien n'a bougé.

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

## Découpe du décor en cellules

L'[ADR 0023](../decisions/0023-fusion-decor-au-chargement.md) regroupait le
décor du niveau ENTIER par matériau. Un lot est dessiné dès qu'une seule de
ses parties entre dans le champ : un lot qui couvre la carte n'est donc
jamais écarté, et le niveau se dessine en entier à chaque image, dos compris.
Découper d'abord par cellules de `DECOR_CELL_SIZE` mètres
(`game/level/mergeStaticDecor.ts`) rend le tri d'écart à nouveau utile.

Mesuré sur le blockout du niveau v2, caméra posée à la main (voir le piège
ci-dessus), en lots de dessin / triangles réellement dessinés :

| Cellule | Lots créés | Parking | Hub vers le nord | Rayons | Bureaux |
|---|---|---|---|---|---|
| niveau entier | 17 | 63 / 107 482 | 18 / 115 580 | 18 / 115 580 | 7 / 82 836 |
| 48 m | 41 | 79 / 99 546 | 33 / 103 700 | 30 / 89 808 | 7 / 14 000 |
| **32 m** | **62** | **93 / 91 442** | **41 / 84 952** | **39 / 81 804** | **8 / 11 184** |
| 24 m | 86 | 91 / 86 980 | 67 / 86 796 | 61 / 79 492 | 9 / 9 564 |

Deux choses à lire dans ce tableau.

D'abord le symptôme : **sans découpe, les bureaux — une pièce close de
28 × 26 m — dessinent 82 836 triangles.** Avec des cellules de 32 m, 11 184.
Le reste du niveau était dessiné derrière les murs.

Ensuite le choix de 32 m, qui est le **coude de la courbe** et non un ordre de
grandeur : 48 → 32 m retire 8 à 18 % de triangles pour une dizaine de lots de
plus ; 32 → 24 m n'en retire plus que 5 % pour vingt-quatre lots de plus.

Le compromis se paie en lots de dessin, et il se paie surtout là où l'on voit
loin (le parking, 63 → 93). Les deux budgets restent larges : 93 lots pour 200
autorisés, 91 442 triangles pour 1 500 000. Si l'habillage de N9 approche des
200 lots, **remonter la cellule est le premier levier** — les triangles ont de
la marge, pas les lots.

## Ce que ça change pour le niveau v2

La salle d'essai porte 27 lampes pour 320 m². À cette densité, les 13 472 m²
du niveau v2 en demanderaient **environ 1 140** : le shader ne compilerait
sur aucune machine, et même s'il compilait, ce serait environ 36 ms par
image rien que pour l'éclairage.

C'est donc l'éclairage, et non la géométrie, qui impose de ne traiter que ce
qui est proche du joueur. Décision et remède : [ADR 0026](../decisions/0026-visibilite-par-espace-et-pool-de-lampes.md).
