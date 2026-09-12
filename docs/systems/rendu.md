---
title: Rendu
tags: [systeme, rendu]
status: stable
updated: 2026-09-06
---

# Rendu

Le jeu vise délibérément un look « build engine » — une résolution basse
(640×360, upscalée), des textures nettes sans filtrage (`NearestFilter`,
aucun mipmap, invariant #4) et des matériaux plats sans aucun reflet
spéculaire (`MeshLambertMaterial` exclusif, jamais de PBR, invariant #5).
Ce document couvre deux choses : comment un niveau importé depuis Blender
(qui produit nativement des matériaux PBR) est reconverti pour respecter ce
look, et comment `src/render/` affiche les entités et les effets de jeu
(sprites billboard, effets de tir, overlays de debug) sans jamais dépendre
directement du code de simulation.

## Invariant #5 — reconversion depuis GLTFLoader

`GLTFLoader` matérialise CHAQUE primitive glTF en `MeshStandardMaterial` (le
modèle PBR metallic-roughness est natif au format) — importer un niveau tel
quel violerait donc silencieusement l'invariant #5. Le look « Build engine »
du jeu vient précisément de l'ABSENCE de spécularité.

`loader.ts::convertToLambert` reconvertit donc CHAQUE mesh importé (pas
seulement les `col_*`, qui de toute façon ne sont jamais rendus visibles) en
`MeshLambertMaterial`, en ne gardant que couleur de base + texture diffuse
(`map`) et en jetant roughness/metalness/normalMap/envMap. L'invariant #4
(`NearestFilter`, pas de mipmaps) est appliqué à toute texture survivante.

Si ce fichier est retouché plus tard : ne jamais retirer cet appel. L'erreur
qui en résulterait est silencieuse — le niveau importé « a l'air » normal
en dev, juste avec des reflets spéculaires qui ne devraient jamais exister à
l'écran dans ce projet.

## Éclairage de secteur baké en vertex colors (COLOR_0)

Voir [ADR 0005](../decisions/0005-eclairage-vertex-colors.md) pour la
décision de bake en vertex colors plutôt qu'en lightmap, et le skill
`vertex-color-sector-lighting` pour le workflow d'auteur côté Blender. Cette
section couvre uniquement la reconstruction du matériau côté loader.

`GLTFLoader` mappe l'attribut glTF `COLOR_0` sur l'attribut de géométrie
Three.js `"color"` et positionne lui-même `vertexColors = true` sur le
`MeshStandardMaterial` qu'il construit. `convertToLambert`/`toLambert`
doivent relire ce flag et le reporter sur le `MeshLambertMaterial` de
remplacement, sous peine de le perdre silencieusement — le mesh resterait
éclairé de façon plate, sans qu'aucune erreur ne le signale. Le colorspace
linéaire de `COLOR_0` est déjà géré en interne par `GLTFLoader`, rien à
faire de plus côté loader.

## Éclairage de scène selon le niveau

La scène porte, depuis la Phase 1, une `AmbientLight` à 0.4 et une
`DirectionalLight` à 0.8 placée en (5, 10, 5)
(`game/session/gameEngine.ts`). C'est ce rig qui donne leur relief aux
boîtes blanches de la gym, qui n'ont aucune couleur cuite.

Sur un niveau baké, il fait double emploi — et pire, il fait tort. Le rendu
Lambert vaut `texture × couleur de sommet × éclairage temps réel` : un
niveau dont l'éclairage est déjà cuit dans ses sommets se retrouve éclairé
une seconde fois, par une direction arbitraire qui n'a rien à voir avec ses
propres néons. Une face tournée à l'opposé du soleil perd 60 % de sa
luminosité cuite ; une face orientée vers lui déborde. La modulation la plus
visible du niveau ne vient alors pas du bake mais d'un soleil hérité.

`LevelDef.bakedLighting` (registre `game/level/levels.ts`) éteint le soleil
et met l'ambiante à 1 pour ce niveau : le rendu vaut alors exactement
`texture × couleur cuite`, ce que le pipeline vise depuis
l'[ADR 0005](../decisions/0005-eclairage-vertex-colors.md).
`lifecycle.ts::applyLightRig` l'applique à chaque construction de partie.

**Pourquoi un réglage par niveau et non un correctif global** : les zones
A à E ont été éclairées à l'œil SOUS l'ancien rig. Les y basculer d'office
changerait l'aspect de tout le jeu sans que personne l'ait demandé. Seule
la salle d'essai du niveau v2 l'active aujourd'hui ; la bascule des zones
existantes se décidera au jalon N10 (`PLAN_NIVEAU_V2.md`).

## Découplage entre render et game

Tous les modules de `src/render/` qui rendent des effets de jeu (`fx.ts`,
`billboard.ts`, `crosshair.ts`, `hitmarker.ts`, `ballisticsDebug.ts`,
`viewmodel.ts`) partagent la même discipline d'import : rien de
`game/entities/*` ni `game/player/*`, jamais un import direct de
`WeaponSystem`/`Suit`/`Director`. Seules des primitives entrent en
paramètre (`THREE.Vector3`, `THREE.Camera`, `"melee" | "shotgun"`, des
nombres de config).

Le pont vit ailleurs :

- **construction/câblage** — `game/session/gameEngine.ts` instancie chaque
  classe de `render/` une fois, persistante à travers un reset (jalon M8) ;
- **appel par frame** — `game/loop/updateFx.ts` lit `weapons.fireEvents`/
  `hitEvents` et les files d'événements de `suitManager`/`directorManager`,
  puis dépaquette leurs champs vers l'API de `render/` ; `game/loop/
  interpolateVisuals.ts` fait de même pour la pose des sprites/du viewmodel,
  avec des grandeurs déjà interpolées (alpha).

Avant le refactor du 2026-09-05 (commit `7600662`), ce rôle de pont était
tenu directement dans le monolithe `main.ts` — un commentaire qui le nomme
encore est une référence obsolète, pas une description du câblage actuel.

## Temps réel contre pas fixe dans render

Toutes les classes de `render/` qui portent un état visuel transitoire
(`FxSystem`, `BillboardSprite` pour son flash de dégâts, `CrosshairOverlay`,
`HitmarkerOverlay`, `BallisticsDebugOverlay`) exposent une méthode
`update(realDt)` — appelée UNE FOIS PAR FRAME D'AFFICHAGE avec le delta
TEMPS RÉEL, jamais `FIXED_DT` du pas fixe. Ces méthodes tournent depuis
`game/loop/updateFx.ts`, jamais depuis `game/loop/updateGameplay.ts` — voir
[Boucle de jeu](boucle-de-jeu.md#ordre-de-la-frame-daffichage) pour l'ordre
exact des callbacks.

C'est un choix délibéré : ces effets sont purement cosmétiques (screenshake,
flash, gizmos de debug, marqueurs de hit) et ne doivent ni ralentir avec le
hitstop ni dépendre du déterminisme du pas fixe. `BillboardSprite.updatePose`
(position/orientation/case d'atlas), à l'inverse, est appelée depuis
`interpolateVisuals` avec des grandeurs DÉJÀ INTERPOLÉES (alpha) par
l'appelant — jamais les valeurs brutes du pas fixe, sous peine de faire
trembler le sprite au ralenti dès que le framerate d'affichage dépasse 60 Hz.

## Sprites billboard 8 directions

Voir le skill `billboard-sprites-8dir` pour les maths de sélection de
direction et le contrat général du système. Ce qui suit couvre ce qui est
spécifique à `src/render/billboard.ts`.

**Convention de direction** : `direction = 0` correspond à l'ennemi vu DE
FACE (le joueur regarde `forward` droit dans les yeux). Un décalage de
convention se traduit par un décalage de 4 cases dans l'atlas — erreur
difficile à repérer à l'œil ; si les sprites semblent tous « à l'envers »,
vérifier en premier que `forward` pointe bien dans le sens où l'entité
regarde, pas dans le sens opposé.

**Mapping V de l'atlas** : three.js flip l'axe V par défaut
(`texture.flipY = true`) — `v = 0` correspond au BAS de l'image source,
`v = 1` à son HAUT. `createPlaceholderAtlas` (et toute image standard)
dessine la ligne 0 en HAUT du canvas ; pour que `row = 0` sélectionne bien
cette ligne, son offset V doit donc être `1 - 1/rows`, pas `0`. Piège
classique d'atlas three.js, pas spécifique à ce projet.

**Deux canaux de teinte indépendants** : `setTint` (`material.color`,
multiplié avec les pixels de l'atlas — bascule costume humain → reptilien du
Directeur) et `setFlash`/`updateFlash` (`material.emissive`, flash blanc de
dégâts) sont deux canaux distincts de `MeshLambertMaterial`, combinables
sans conflit : l'un module les texels, l'autre s'additionne dessus.

**`setFlash` ne somme jamais** : si un flash est déjà en cours, prend le MAX
de l'intensité courante (déjà partiellement décroissante) et de la nouvelle
demande — même règle que `FxSystem.triggerShake` (voir plus bas). Plusieurs
plombs de pompe touchant la même entité dans le même pas fixe ne doivent pas
empiler un flash plus blanc que blanc.

**Clone de texture par instance** : voir [ADR 0017](../decisions/0017-clone-texture-sprite-billboard.md)
pour le piège de partage de texture évité et l'alternative écartée.

**Atlas placeholder** (`createPlaceholderAtlas`) : voir
[Textures](../pipeline/textures.md#atlas-placeholder-de-billboard) pour son
format et son rôle.

## Effets visuels de tir (FxSystem)

`src/render/fx.ts` est purement cosmétique : screenshake, muzzle flash,
decals + particules d'impact, douilles éjectées, gibs de mise à mort à bout
portant. Tourne entièrement en temps réel (`update(realDt)`, voir
ci-dessus). Aucun `Math.random()` seedé ici — tout ce module est hors du
harnais de rejeu F9/F10 ; le shake ne modifie ni la position du joueur ni
aucun état de simulation.

**Trois régimes de pooling, volontairement pas uniformisés** :

| Catégorie | Régime | Pourquoi |
|---|---|---|
| Muzzle flash | Pool fixe de 2 (lumière + quad), round-robin | le pas fixe est clampé à 0.25 s et les cooldowns d'armes (≥ 0.5 s) rendent impossible plus d'un `fireEvent` par frame d'affichage en régime normal |
| Decals | Pool fixe de 24, round-robin | un joueur qui vide un chargeur ne doit pas accumuler des dizaines de quads invisibles pour toujours |
| Particules, douilles, gibs | Tableaux simples filtrés à chaque `update()`, pas de pool | durée de vie courte (< 2 s), volume par tir/mise à mort faible — un vrai pool serait de la sur-ingénierie à cette échelle |

**Screenshake** : décroissance exponentielle, `k = -ln(fraction) / duration`
(voir [Valeurs de déplacement — Impact](../reference/valeurs-deplacement.md#impact)
pour les valeurs retenues). Comme `BillboardSprite.setFlash`, PAS de
sommation entre déclenchements qui se chevauchent : le MAX de l'amplitude
courante (déjà partiellement décroissante) et de la nouvelle amplitude
demandée, relancé sur la durée pleine. Un impact à 9 plombs simultanés ne
secoue donc pas 9× plus fort qu'un seul.

**Physique jouet pour les débris cosmétiques** (particules, douilles, gibs) :
voir [ADR 0018](../decisions/0018-physique-jouet-debris-cosmetiques.md) pour
la décision de ne jamais toucher Rapier ici, et l'approximation de sol plat
assumée pour le rebond des douilles.

Les gibs (`spawnGibs`) réutilisent tel quel `ToyParticle`/`updateToyPhysics`
— seuls géométrie, couleur, quantité, vitesse et dispersion diffèrent des
particules d'impact, aucune duplication du pattern générique.

## Overlays canvas 2D hors React (réticule et hitmarker)

Réticule et hitmarker sont deux canaux de feedback ajoutés après un retour
playtest de la Phase 3 (« le tir est assez hasardeux », « la sensation de
tir et de touché n'est pas bonne »). Les deux dessinent directement sur un
`<canvas>` 2D dédié, monté sur le même conteneur que `canvas#game`
(`100vw`/`100vh`, `image-rendering: pixelated`), à la résolution interne
`INTERNAL_WIDTH`×`INTERNAL_HEIGHT` (invariant #4) — jamais via React
(invariant #2) : un marqueur doit apparaître en UN frame d'affichage et
durer une centaine de ms, largement sous le throttle 10 Hz du HUD React.
Mis à jour depuis `updateFx(realDt)`, jamais le pas fixe.

**Position du réticule — garantie géométrique, pas une valeur tunable** : le
réticule est dessiné au centre exact du canvas interne. La caméra utilise
une projection perspective symétrique au même ratio d'aspect (aucun
`camera.setViewOffset` nulle part dans le projet), donc son axe optique s'y
projette TOUJOURS exactement au centre — une propriété géométrique de la
projection, jamais quelque chose que ce module recalcule. Seul le style
(croix/point, taille, épaisseur, couleur, pulsation) est tunable — voir
[Armes du joueur — Réticule permanent](armes.md#réticule-permanent-crosshair_variants).

**Hitmarker `"hit"` et `"kill"` : deux fenêtres indépendantes**, jamais de
sommation d'intensité — un `"kill"` prime visuellement s'il se chevauche
avec un `"hit"` encore affiché (voir [Armes du joueur — Confirmation de hit
à l'écran](armes.md#confirmation-de-hit-à-lécran-hitmarker_variants) pour
les profils).

## Gizmos balistiques de debug

Ajoutés sur demande explicite de playtest (« il faudrait rajouter des
gizmos pour voir sur quoi on tire »). Dessinent la forme EXACTE réellement
testée par la requête de hit courante (mêmes nombres que `WeaponSystem` :
portée, rayon, directions dispersées des plombs) — pas une approximation
pédagogique. Contrairement au wireframe (`KeyV`, désactivé par défaut), actif
PAR DÉFAUT : il répond à un besoin de diagnostic immédiat, pas une
fonctionnalité cachée à découvrir. `KeyB` bascule l'affichage à chaud — voir
[Outils de debug](debug.md) et [Contrôles](../reference/controles.md) pour
le câblage des touches.

Ce sont des objets 3D RÉELS ajoutés à la scène (pas un canvas 2D), avec des
matériaux NON ÉCLAIRÉS (`LineBasicMaterial`/`MeshBasicMaterial`),
délibérément PAS `MeshLambertMaterial` : l'invariant #5 interdit la PBR/le
spéculaire sur ce que le JOUEUR voit en jeu, mais ces gizmos sont un calque
de DIAGNOSTIC transitoire (quelques centaines de ms), pas du rendu de jeu
final — rester visible quelle que soit la direction de la lumière est le
comportement correct pour un outil de mesure, pas une entorse à l'invariant.

## Le mesh d'arme affiché à l'écran (Viewmodel)

Le mesh d'arme affiché à l'écran est un ENFANT de la caméra
(`camera.add(...)`), pas recalculé en world-space chaque frame : la pose que
renvoie `WeaponSystem.viewmodelPose()` est déjà exprimée dans le repère
local de la caméra. Prérequis côté appelant : la caméra doit elle-même être
un descendant de `scene` (`scene.add(camera)`, posé dans
`game/session/gameEngine.ts`) pour que three.js traverse ses enfants au
rendu — une caméra hors du graphe de scène rend ses propres enfants
invisibles, même correctement positionnés.

Conséquence ASSUMÉE de ce choix, pas un oubli : le viewmodel hérite du FOV
dynamique de la caméra (élargi en course, `moveConfig.fovRunBoost`) et
semble très légèrement « zoomer » pendant un sprint — comportement habituel
d'un FPS, pas une régression.

`activeWeapon` a trois valeurs explicites (`"none" | "melee" | "shotgun"`),
jamais un ternaire binaire : un ternaire melee/shotgun afficherait le pompe
par défaut sur `"none"` (arme fantôme à l'écran pour un joueur censé être
désarmé, Zone A avant ramassage du pied-de-biche) — bug visuel silencieux
évité en énumérant les trois cas.

## Bascule wireframe de debug

`createWireframeToggle` bascule `material.wireframe` sur les matériaux DÉJÀ
présents dans la scène (`scene.traverse`), rien d'autre — pas de matériau de
remplacement, pas de post-processing, pas de shader dédié : le wireframe
s'obtient sur le pipeline existant ou pas du tout (contrainte du skill
`build-engine-look`). Restreint à `MeshLambertMaterial` (invariant #5) : ce
n'est pas qu'une contrainte de style, c'est un garde-fou passif — un mesh
dont le matériau n'est pas Lambert est ignoré et signalé une fois en
console, ce qui ne devrait jamais arriver dans ce projet.

Limite assumée : seuls les matériaux présents dans la scène AU MOMENT du
basculement sont couverts ; un objet ajouté après coup (particule d'impact,
douille) démarre non wireframe. Sans conséquence pour l'usage visé
(géométrie statique du niveau + balle témoin de `game/session/lifecycle.ts`).

Retour à la [carte de la documentation](../README.md).
