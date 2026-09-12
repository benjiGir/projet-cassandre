---
title: Visibilité par espace et pool de lampes, plutôt que streaming ou WebGPU
tags: [adr, rendu, performance, niveau-v2]
status: accepte
updated: 2026-09-12
---

# ADR 0026 — Visibilité par espace et pool de lampes

## Contexte

Le plan de masse du niveau v2 (jalon N6) propose 13 472 m² praticables, soit
42 × la salle d'essai de N4, et environ **1,45 million de triangles** — 7,2 ×
le budget de 200 000 posé au jalon N1. Question posée : comment tenir un
niveau de cette taille, proprement, avec three.js ? Trois pistes étaient sur
la table, dont deux venaient de l'utilisateur : passer à **WebGPU**, et **ne
charger que ce que le joueur voit** avec un préchargement pour éviter
l'apparition d'objets sous ses yeux.

Plutôt que d'arbitrer sur des ordres de grandeur supposés, on a mesuré. Les
chiffres, la méthode et leurs limites : [Ce que coûte une image](../systems/cout-de-rendu.md).

## Ce que la mesure dit

1. **Les triangles ne sont pas le problème.** 1,45 million de triangles,
   carte entière dans le champ, aucun tri d'écart : **4,94 ms GPU** sur la
   machine de développement, pour un budget d'image de 16,6 ms. Le budget de
   N1 était trop prudent d'un ordre de grandeur.
2. **Les lampes sont le problème.** Environ **0,03 ms par `PointLight`**, et
   surtout un mur : au-delà de **254 lampes allumées**, le shader dépasse
   `MAX_FRAGMENT_UNIFORM_VECTORS` et **ne compile plus du tout** — la
   géométrie disparaît, sans autre signe qu'une ligne en console. Sur une
   machine conforme au minimum de la spécification WebGL 2, ce mur peut
   tomber vers la cinquantaine de lampes.
3. À la densité d'éclairage de la salle d'essai (27 lampes pour 320 m²), le
   niveau v2 en demanderait **environ 1 140**. Impossible, et de loin.

## Décision

**Tout le niveau reste résident ; ce qui est proche du joueur est traité, le
reste est éteint.** Trois mesures, dans cet ordre de priorité :

### 1. Un pool de lampes, réaffecté par pas fixe — la seule urgence

Seules les **N lampes les plus proches de la caméra** sont visibles, les
autres sont éteintes (`visible = false`, ce que three.js exclut de son état
d'éclairage). **N = 48** par défaut : trois fois sous le mur de la machine de
mesure, sous le mur d'une machine minimale, et environ 1,5 ms d'éclairage.

C'est le remède annoncé par l'[ADR 0024](0024-eclairage-hybride.md) pour le
jalon N9, désormais chiffré. Le prototype existe déjà, comme outil de
mesure : `cassandre.lightBudget(n)` (`applyLightBudget`,
`src/game/devtools/testHarness.ts`).

### 2. Fusionner le décor par espace, pas par niveau

L'[ADR 0023](0023-fusion-decor-au-chargement.md) regroupe aujourd'hui le
décor du niveau ENTIER par matériau : un lot couvre toute la carte, donc le
frustum n'élimine jamais rien. Dix espaces × ~5 matériaux = ~50 lots, sous
les 200 du budget, et le tri d'écart redevient capable d'écarter ce qui
n'est pas vu. Bénéfice secondaire, maintenant que les triangles se sont
révélés bon marché — mais c'est aussi ce qui rend le pool de lampes utile
(une lampe d'un espace non vu n'a aucune raison d'être allumée).

### 3. Une visibilité par espace, tirée du graphe de pièces

Le niveau v2 est un ensemble de pièces reliées par des ouvertures, et ce
graphe est **déjà écrit** (jalon N6, `tools/level_v2/plan_de_masse.py`).
Éteindre les espaces qu'on ne peut pas voir depuis l'espace courant est un
ensemble potentiellement visible à l'ancienne, écrit à la main — exactement
ce que faisait le moteur Build dont ce jeu imite le rendu. À faire seulement
si la mesure sur la vraie carte le réclame.

## Ce qui est écarté, et pourquoi

| Option | Pourquoi non |
|---|---|
| **Passer à WebGPU** | Ne répond pas au problème mesuré : le mur est le nombre de lampes évaluées par fragment, pas l'API. Le renderer WebGPU de three 0.185 convertit pourtant `MeshLambertMaterial` en `MeshLambertNodeMaterial` automatiquement (vérifié dans `StandardNodeLibrary.js`), donc l'invariant #5 survivrait à une bascule : c'est une option ouverte, pas un prérequis. À reconsidérer si le pool de 48 lampes devient un jour la contrainte artistique |
| **Charger/décharger les espaces à la volée** | Résout un problème qu'on n'a pas : tout le niveau tient en mémoire et se dessine en moins de 5 ms. Un chargement à la volée **créerait** le défaut qu'il est censé éviter (apparition d'objets sous les yeux du joueur, à-coup de chargement) et ferait apparaître des colliders APRÈS le `refreshSceneQueries()` du chargement — le piège exact de l'[ADR 0025](0025-occlusion-lignes-de-vue-cause-racine.md) |
| **Occlusion culling dynamique** | three.js n'en a pas, et l'écrire est un projet en soi. Le graphe de pièces donne 90 % du bénéfice pour quelques lignes |
| **`BatchedMesh`** | Vrai candidat, gardé en réserve : un seul appel de dessin avec tri d'écart **par objet** (`perObjectFrustumCulled`, activé par défaut), et il préserve les couleurs de sommets du bake, contrairement à l'instanciation. Mais il impose un matériau unique par lot, donc un atlas de textures. Inutile tant que ~50 lots suffisent |
| **Relever le budget de triangles et ne rien faire d'autre** | Le budget mérite effectivement d'être relevé (voir ci-dessous), mais ça ne soigne pas les lampes, qui est le vrai mur |

## Budget révisé

| | N1 (posé a priori) | Révisé (mesuré) |
|---|---|---|
| Triangles par image | 200 000 | **1 500 000** |
| Lots de dessin | 200 | 200 (inchangé) |
| Lampes allumées | non spécifié | **48** |

Le budget de triangles reste bien en-dessous de ce que la machine de mesure
encaisse (3,6 millions en 10 ms) : la marge est là pour la cible réelle, un
portable à GPU intégré, plusieurs fois plus lent.

## Comment on saurait qu'on a eu tort

- Si le niveau v2 assemblé dépasse 8 ms de GPU par image sur la machine de
  développement, c'est que la géométrie a dérivé bien au-delà de
  l'estimation de N6 : re-mesurer avant d'optimiser quoi que ce soit.
- Si 48 lampes ne suffisent pas à tenir l'ambiance d'un espace, le pool a
  de la marge jusqu'à ~200 sur une machine ordinaire — mais il faudra
  vérifier le mur sur la machine la plus faible visée, pas sur celle-ci.
- Si des pans de décor disparaissent sans erreur visible, regarder la
  console AVANT de chercher un bug de géométrie : c'est la signature du
  dépassement d'uniformes.
