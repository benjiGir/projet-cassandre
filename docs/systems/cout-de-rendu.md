---
title: Ce que coûte une image — mesures
tags: [systemes, rendu, performance]
status: stable
updated: 2026-09-24
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
| 32 m | 62 | 93 / 91 442 | 41 / 84 952 | 39 / 81 804 | 8 / 11 184 |
| 24 m | 86 | 91 / 86 980 | 67 / 86 796 | 61 / 79 492 | 9 / 9 564 |

Le symptôme saute aux yeux : **sans découpe, les bureaux — une pièce close de
28 × 26 m — dessinent 82 836 triangles.** Avec des cellules de 32 m, 11 184.
Le reste du niveau était dessiné derrière les murs.

Sur ce niveau gris, 32 m était le coude de la courbe : 48 → 32 m retirait 8 à
18 % de triangles pour une dizaine de lots de plus, 32 → 24 m n'en retirait
plus que 5 % pour vingt-quatre lots de plus.

### Le coude se déplace quand l'habillage arrive

Refait sur le niveau HABILLÉ (trois espaces sur dix, jalon N9.2), le classement
s'inverse. Un décor texturé porte bien plus de matériaux distincts par cellule,
et le nombre de lots suit le nombre de matériaux :

| Cellule | Lots créés | Pire point de vue | Galerie vers l'est | Ligne de caisses |
|---|---|---|---|---|
| 32 m | 156 | **163** / 480 446 | 98 / 173 670 | 107 / 226 672 |
| **48 m** | **102** | **122** / 498 092 | 76 / 169 918 | 82 / 239 478 |
| 64 m | 89 | 123 / 499 178 | 97 / 299 960 | 98 / 311 804 |

**48 m devient le bon réglage** : 41 lots de moins au pire point de vue pour
3,7 % de triangles en plus. Au-delà, les lots ne baissent plus et les triangles
remontent franchement.

C'est le levier que l'ADR 0026 annonçait, tiré au moment où la mesure l'a
réclamé : à 32 m et trois espaces habillés, on était à 163 lots sur 200, et le
lot suivant aurait dépassé le budget. La leçon générale : **le budget sous
tension est celui des LOTS DE DESSIN, pas celui des triangles** (33 % du budget
seulement), et la taille de cellule est ce qui arbitre entre les deux. À
re-mesurer quand le niveau sera entièrement habillé.

## Ce que ça change pour le niveau v2

La salle d'essai porte 27 lampes pour 320 m². À cette densité, les 13 472 m²
du niveau v2 en demanderaient **environ 1 140** : le shader ne compilerait
sur aucune machine, et même s'il compilait, ce serait environ 36 ms par
image rien que pour l'éclairage.

C'est donc l'éclairage, et non la géométrie, qui impose de ne traiter que ce
qui est proche du joueur. Décision et remède : [ADR 0026](../decisions/0026-visibilite-par-espace-et-pool-de-lampes.md).

## Ce qui ne fusionne jamais

Le décor statique fusionne (ADR 0023/0026). Tout ce qui doit pouvoir bouger,
disparaître ou se casser SEUL en est exclu — et coûte alors un lot de dessin
par objet DANS LE CÔNE DE VUE, occultation comprise, puisque three.js
n'élimine que par le cône. Mesuré au niveau v2 le 2026-09-19, chaque famille
a son remède, et les trois sont le même : regrouper ou élaguer.

| Famille | Sans remède | Remède | Après |
|---|---|---|---|
| `prop_*` (mobilier poussable) | 37 lots au spawn du parking | élagage à 36 m ([ADR 0030](../decisions/0030-props-dynamiques.md)) | 6 |
| `door_*` (vantaux animés) | 13 lots au bout du hub, 20 vantaux | `BatchedMesh` par matériau (`batchDoorMeshes`) | 6 pour tout le niveau |
| `vitre_*` (vitrages) | 6 lots au spawn du parking | un lot par matériau, sans découpe en cellules | 1 pour tout le niveau |
| `sanitaire_*` (cuvettes/urinoirs) | 1 lot, mais visible depuis le parking extérieur à 80 m (77 poses sur 240 du parking le dessinaient) | un lot par matériau comme `vitre_*` ([ADR 0032](../decisions/0032-sanitaires-utilisables.md)), PLUS l'élagage à 48 m des `use_*` | 1 dans la salle des toilettes, 0 ailleurs |
| `use_*` (ramassages, lecteurs) | 21 lots depuis les caisses, dont une trousse à 150 m | élagage à 48 m (`render/useObjectCulling.ts`) | 3 à 5 |

**Pourquoi trois réglages différents.** Un vantail ne peut pas être élagué :
il est grand, on le regarde de loin, et le voir apparaître à trente mètres se
remarque — mais vingt vantaux tiennent dans six lots parce qu'ils ne sont que
six matériaux. Une vitre ne peut pas non plus être élaguée (on voit à travers
une galerie entière), mais tout le verre du niveau pèse quelques centaines de
triangles : un seul lot, sans cellules, coûte toujours un. Un ramassage, lui,
est petit : à 48 m, une trousse fait deux pixels de haut.

**Remesuré le 2026-09-24, protocole différent, résultat à lire comme tel.**
Joueur laissé au spawn du parking, quarante ennemis en vie, caméra seule
déplacée sur une grille de 10 points × 24 caps dans le parking extérieur
(`renderBench(1)`) : pire pose **211 lots** en (−10 ; 1,6 ; 30) vers le
nord-est, AVANT comme APRÈS les sanitaires — liste des objets dessinés
identique, objet par objet, entre les deux `.glb`. Ce protocole ne
reproduit donc pas les 198 annoncés plus bas et dans CLAUDE.md : le
dépassement n'est pas neuf, mais il existe à cette pose.

**État du budget après cette passe** (200 lots, quarante ennemis encore en
vie, ramassages proches visibles) : pire vue mesurée **188 lots** (la ligne
de caisses vers le nord), contre 198 avant. Le détail d'une vue chargée :
environ 123 lots de décor fusionné, 45 sprites d'ennemis, 14 morceaux de
coque isolés, 1 lot de verre, 3 à 6 lots de vantaux.
