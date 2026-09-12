---
title: Éclairage hybride — lampes temps réel et ombre cuite
tags: [adr, rendu, pipeline, niveau, eclairage]
status: accepte
updated: 2026-09-12
---

# ADR 0024 — Éclairage hybride : lampes temps réel et ombre cuite

## Statut

Accepté (après le gate de richesse du jalon N4, `PLAN_NIVEAU_V2.md`).
Complète l'[ADR 0005](0005-eclairage-vertex-colors.md), qui reste valable :
le choix « vertex colors plutôt que lightmap » n'est pas remis en cause, c'est
le RÔLE de ces vertex colors qui change.

## Contexte

Après avoir joué la salle d'essai du jalon N4, l'utilisateur signale :
« j'ai l'impression qu'il y a une ambient light qui éclaire tout ». Le
diagnostic, mesuré avec `cassandre.lighting()`, donne deux causes distinctes.

**La première est réelle mais bénigne** : la scène porte bien une
`AmbientLight` à 1.0, posée délibérément pour qu'un niveau baké ne soit pas
éclairé deux fois. La retirer n'ajouterait aucune ombre — elle assombrirait
tout uniformément.

**La seconde est structurelle, et c'est la vraie.** Une couleur cuite PAR
SOMMET ne peut pas montrer une arête : les huit sommets d'une boîte
appartiennent chacun à trois faces, donc le dessus d'un carton sous un néon et
son flanc reçoivent forcément la même valeur. Passer le bake au domaine CORNER
(une couleur par face) a corrigé ce point précis, mais le plafond du tout-baké
restait atteint :

- aucune lumière ne répond au joueur ni au temps (pas de tir qui éclaire, pas
  de néon qui grésille) ;
- les ennemis, en billboard, ne sont pas éclairés par la pièce qu'ils
  traversent ;
- la finesse d'une ombre est bornée par la densité de sommets.

**Mesure décisive** : seize `PointLight` ajoutées à la salle d'essai ne
coûtent rien. 0,30 ms de rendu contre 0,90 ms sans elles (la variation est du
bruit), 117 FPS, 18 draw calls — identique. À 640×360, le coût par fragment
d'une poignée de lampes est négligeable.

## Décision

**Le direct est rendu en temps réel, l'indirect est cuit.**

- Le niveau porte ses propres lampes, posées dans Blender comme des empties
  `light_*` et instanciées en `THREE.PointLight` par `loader.ts`
  (`buildLevelLight`). Extras lus : `color`, `intensity`, `distance`, `decay`.
- Le bake ne cuit plus que la lumière REBONDIE
  (`bake_vertex_lighting.py --pass indirect`), remappée par `--ambient 0.5`.
  La couleur de sommet ne porte donc plus l'éclairage : elle porte **l'ombre**,
  comme une carte d'occlusion.
- `LevelDef.lighting` choisit le régime par niveau : `"temps-reel"` (défaut,
  gym et zones A-E), `"bake"`, `"hybride"`.

**Un empty et non une vraie lampe Blender exportée en `KHR_lights_punctual`** :
la scène Blender a déjà des lampes, celles du bake — grandes, douces, en forme
de tube — et le watt de Blender ne se convertit pas en intensité three.js. Un
empty porte exactement les paramètres de `THREE.PointLight`, lisibles tels
quels, et ne peut jamais être confondu avec une source de bake.

**Réglage par niveau et non bascule globale** : les zones A-E ont été
éclairées à l'œil SOUS l'ancien rig. Les basculer d'office changerait l'aspect
de tout le jeu sans que personne l'ait demandé. Leur sort se décide au jalon
N10.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Rester au tout-baké | plafond atteint : pas de chute de lumière, pas d'arête qui se détache, ennemis non éclairés par la pièce — et la mesure montre que le temps réel est gratuit |
| Tout en temps réel, sans bake | les lampes de three.js n'ont pas d'ombres ici : une lampe traverserait les gondoles et éclairerait l'allée voisine. C'est précisément ce que l'ombre cuite rattrape |
| Vraies ombres temps réel (shadow maps) | 27 lampes × une shadow map cubique chacune : hors budget, et hors de l'esthétique visée |
| Lampes Blender exportées en `KHR_lights_punctual` | mélangerait sources de bake et lampes de jeu dans la même liste, avec une conversion d'unité douteuse |

## Conséquences

- La couleur de sommet **multiplie** la lumière temps réel au lieu de
  s'y ajouter (`MeshLambertMaterial`). Un recoin à l'ombre cuite reste donc
  sombre même sous une lampe proche. C'est faux physiquement, juste
  visuellement : c'est exactement le rôle d'un masque d'occlusion, et c'est ce
  qui remplace les ombres portées qu'on n'a pas.
- L'ambiante n'est pas nulle en hybride (0.18) : les lampes ont une portée
  finie, et un recoin hors de portée de toutes tomberait au noir absolu.
- **Limite de passage à l'échelle, connue et non traitée.** three.js évalue
  TOUTES les lampes pour chaque fragment. 27 lampes ne coûtent rien ; le
  niveau v2 complet (dix espaces) en demanderait largement plus de cent, et le
  coût croît linéairement. La parade prévue le moment venu : un pool de taille
  fixe, dont les lampes sont RÉAFFECTÉES aux luminaires les plus proches du
  joueur plutôt qu'allumées et éteintes — changer le nombre de lampes force
  three.js à recompiler ses shaders, pas les déplacer. À traiter au jalon N9,
  dès que le premier grand espace existe.

## Comment on saurait qu'on a eu tort

Si le coût par fragment devient mesurable sur le matériel cible (portable à
GPU intégré) une fois le niveau complet éclairé, ou si le masque d'ombre cuit
se révèle insuffisant pour empêcher une lampe de « traverser » un rayon de
façon visible, il faudra soit revenir au tout-baké, soit introduire un vrai
découpage en secteurs.

Retour à la [carte des décisions](README.md).
