---
title: Sprites et viewmodel
tags: [technique]
status: brouillon
updated: 2026-10-03
---

# Sprites et viewmodel

## Responsabilité

Cette page décrit les représentations visuelles des ennemis et des armes en vue subjective. Le gameplay choisit les états, les armes et les tirs ; les modules de rendu reçoivent une pose et des horloges déjà calculées.

## Fichiers

- `src/render/billboard.ts` — quad orienté vers la caméra, sélection de direction et flash de dégâts.
- `src/render/enemySprites.ts` — charge les atlas et manifestes, puis associe les états visibles aux lignes de l'atlas.
- `src/render/weaponModels.ts` — chargement glTF, validation des extras et modèles de secours.
- `src/render/viewmodelTypes.ts` — contrats des modèles, horloges et poses.
- `src/render/viewmodelAnimation.ts` — calcul pur des séquences à partir des horloges.
- `src/render/viewmodel.ts` — hiérarchie caméra et application des poses.
- `src/render/pickupResources.ts` — atlas et modèles partagés, détenus par la session.
- `src/render/pickups.ts` — rend les armes au sol sous forme de billboards.
- `src/render/cardPickups.ts` — rend les trois cartes de fidélité et le drop du Directeur.
- `src/game/loop/interpolateVisuals.ts` — transmet les positions et orientations interpolées des acteurs.
- `src/game/loop/updateFx.ts` — fait décroître les flashes au temps réel.
- `src/game/player/weapons.ts` — détient les horloges de tir et de changement d'arme consommées par le viewmodel.
- `tools/blender/render_enemy_sprites.py` — produit les planches et manifestes ennemis.
- `tools/blender/build_weapons.py` — produit le glTF des modèles subjectifs et des armes au sol.
- `public/assets/sprites/` et `public/assets/weapons/armes.glb` — ressources effectivement chargées.
- [Rendu](rendu.md) — résolution, textures, matériau Lambert et ordre de frame.

## Où ça s'insère dans la boucle

Les modèles et les planches sont chargés à la frontière asynchrone du démarrage. Ensuite le gameplay fournit des poses au pas fixe ; l'interpolation les transmet au renderer au taux d'affichage. Les animations du viewmodel lisent des horloges de gameplay interpolées. Le flash de dégâts décroît avec le dt réel. Le diagramme montre les deux sources de temps.

~~~mermaid
flowchart TD
  A["État de l'ennemi"] --> B["EnemyAnimationInput"]
  C["Pose interpolée"] --> D["BillboardSprite"]
  B --> D
  E["Caméra de la frame"] --> D
  D --> F["Atlas : direction et frame"]
  G["Horloges WeaponSystem"] --> H["Viewmodel"]
  I["Tir et changement d'arme"] --> G
  H --> J["Mesh enfant de caméra"]
~~~

`BillboardSprite.updatePose` reçoit la position et le vecteur avant interpolés, ainsi que la caméra de la frame. Il écrit la direction et l'UV de la case d'atlas avant le rendu. La caméra n'est pas interpolée ; voir [Simulation et présentation](../3-architecture/simulation-et-presentation.md).

`Viewmodel.update` lit `WeaponSystem` à partir de l'interpolation et recopie les offsets sur les meshes d'arme. Il ne modifie ni la cadence de tir, ni le cooldown, ni les entrées du joueur.

## Données et contrats

### Atlas ennemis

Une planche contient huit colonnes directionnelles et un nombre de lignes fourni par son manifeste JSON. Le manifeste donne les dimensions d'une case, les pixels par mètre, la ligne des pieds, les textures de peau et les plages de frames pour `idle`, `alert`, `chase`, `aim`, `fire`, `stagger` et `death`.

`loadEnemySpriteSheet` vérifie huit colonnes, toutes les animations attendues et la peau `humain`. Chaque texture suit le réglage rétro du renderer. Si le manifeste ou une texture échoue, `loadEnemySpriteSheetOrPlaceholder` signale l'erreur et fournit une planche de repli numérotée pour conserver une image jouable.

`enemySpriteRow` choisit une ligne sans allocation. Le repos suit une cadence, la poursuite suit la distance parcourue, la visée garde sa pose et les séquences d'alerte, de stagger et de mort étalent leurs images sur la durée fournie. Un tir peut afficher sa frame au-dessus de la course. Une entité morte conserve la dernière frame de mort.

`enemySpriteQuad` transforme la taille en pixels et l'ancrage des pieds en mètres à partir du manifeste et de la capsule. Les pixels transparents au bas de la planche sont intégrés au calcul de l'ancrage.

### Billboard 8 directions

`BillboardSprite` possède un `PlaneGeometry` et une texture clonée par instance. Le clonage est nécessaire : chaque ennemi change le `repeat` et l'`offset` de sa case sans modifier les UV d'un autre ennemi qui partage l'atlas.

Le billboard ne pivote que sur l'axe vertical. L'angle entre le vecteur avant de l'ennemi et la direction horizontale vers la caméra est quantifié par pas de 45 degrés. Si l'un des vecteurs est dégénéré, le sprite garde la dernière direction valide.

Le matériau est un `MeshLambertMaterial` opaque avec `alphaTest` (0,5 par défaut) et `depthWrite`. Les pixels transparents sont coupés ; les sprites ne demandent pas de tri alpha. L'option `normalTilt` incline les normales pour recevoir la lumière, sans modifier la géométrie. `setTint` modifie la teinte et `setAtlas` remplace la peau tout en gardant la case courante.

Le flash blanc de dégâts est purement visuel. `setFlash` peut renforcer un flash en cours ; `updateFlash(realDt)` applique sa décroissance au taux d'affichage. Le déclenchement vient du gameplay, mais la durée du flash ne fait pas avancer l'état de l'ennemi.

### Viewmodel et armes au sol

`loadWeaponModels` lit `public/assets/weapons/armes.glb` et récupère les meshes `vm_*`, `world_*` et leurs extras de pivots, bouche de canon et axe de glissière. Les modèles de vue sont déjà placés dans le repère de caméra par Blender. Le runtime les attache comme enfants de caméra et anime les pivots ; il ne recalcule pas leur cadrage.

Les géométries utilisent un matériau Lambert à vertex colors. Si le fichier ou un extra requis manque, `loadWeaponModelsOrPlaceholder` journalise l'erreur et fournit des boîtes de remplacement. Le modèle de pompe contient un sous-mesh mobile pour la pompe ; les pivots guident le recul et le glissement.

Le viewmodel interpole les clocks de chaque arme. Le changement fait descendre l'ancienne arme puis remonter la nouvelle ; le pied-de-biche balaie après l'appui ; le pompe recule puis pompe après le tir. Tirer avec la nouvelle arme peut la remettre en place immédiatement. Aucun de ces gestes ne retarde la possibilité de tirer, conformément à l'invariant [#10](../3-architecture/invariants.md).

Les armes au sol ne sont pas le viewmodel. `src/render/pickups.ts` dessine les billboards d'armes et les modèles de soin et de munitions ; `spawning.ts` habille les meshes `use_*` et conserve les billboards pour leur animation de présentation. `bootGameSession` attend l’atlas et préchauffe les textures avant la construction de la partie. Les modèles partagés vivent dans `session.pickupResources`, à travers les hot reloads ; ils sont libérés après l’arrêt du niveau.

### Cartes de fidélité

`src/render/cardPickups.ts` remplace les cubes `use_*` portant `card` par des cartes rectangulaires à coins arrondis. Les sprites RGBA de 128×80 pixels portent une puce, le nom du rang et une, deux ou trois étoiles. Argent est gris bleuté, Or doré et Platine turquoise clair. Les trois images sont générées par `tools/textures/generate_card_pickups.py` dans `public/assets/sprites/cards/`.

Les textures sont préchargées dans `main.ts` à la frontière asynchrone. Chaque billboard possède sa géométrie, son matériau et une texture clonée dont les pixels sont partagés. Le nettoyage du niveau libère les instances du niveau ; `CardPickupBillboard.dispose` libère le drop autonome à son ramassage ou à la fin de partie.

Le quad mesure 0,7×0,4375 m. Son bas flotte à 0,22 m de l'ancrage, avec un mouvement vertical de ±0,06 m et un léger pouls d'émissive. `updateFx` anime et oriente les cartes vers la caméra autour de l'axe vertical. L'ancrage de ramassage reste fixe ; le flottement ne change pas les distances d'interaction.

Les cartes du niveau gardent la touche `E`. La Platine lâchée par le Directeur utilise le même visuel et se ramasse par proximité, après le délai prévu par le gameplay. Le drop ramassé ne recrée pas de billboard. Les cartes déjà acquises restent cachées après un hot reload.

### Horloges et poses visibles

`EnemyAnimationInput` transporte des temps de gameplay. Le hitstop suspend donc aussi les poses temporisées ; la poursuite suit les mètres parcourus, ce qui arrête son cycle quand l'ennemi n'avance plus.

Les séquences d'alerte, de stagger et de mort répartissent leurs frames sur la durée réelle de la pose. La frame de tir se superpose brièvement à la course ; elle ne crée pas un nouvel état d'ennemi.

Les atlas peuvent contenir plusieurs peaux. Le manifeste exige toujours `humain` et peut fournir `revele` pour le Directeur ; `setAtlas` change la texture sans recalculer la direction ou la ligne d'animation courante.

### Profondeur du viewmodel

Les armes tenues sont attachées à la caméra et utilisent la plage de profondeur réservée au premier plan. Le canon reste visible quand le joueur touche un mur, tandis que les parties du modèle peuvent encore se masquer entre elles.

Cette règle ne s'applique pas aux armes au sol : elles sont des billboards dans la scène, soumis au test de profondeur ordinaire. Les modèles de vue et les objets ramassables partagent les assets générés, mais pas leur position ni leur mode de dessin.

Le secours en boîtes garde le rendu disponible si le glTF des armes ou ses extras de pivots sont illisibles. Il rend les écarts d'alignement visibles ; il ne remplace pas la vérification du modèle exporté.

## Pièges

- L'atlas est partagé, mais sa texture Three.js ne doit pas l'être entre deux sprites dont les UV sont mutés indépendamment. Cloner uniquement la texture d'instance évite aussi de dupliquer les pixels GPU.
- `THREE.Sprite` oriente son quad sur trois axes. Il penche quand on regarde le sol ou le plafond ; le quad yaw-only garde les ennemis verticaux.
- L'axe V de Three.js part du bas de la texture. Calculer la ligne de l'atlas sans tenir compte de ce retournement affiche une animation voisine.
- La position d'entité peut représenter le centre de capsule alors que l'image montre les pieds. L'ancrage vertical doit utiliser le contrat `feetFromBottom` et la capsule réelle.
- N'envoyez pas une pose brute du pas fixe à `updatePose`. Elle produit une image en escalier au taux d'affichage.
- Le flash est une horloge de présentation, alors que les frames de pose utilisent les valeurs de gameplay. Avancer les deux avec le même dt brouille le contrat de hitstop.
- Les géométries du viewmodel sont cadrées dans Blender. Changer leur position globale dans le runtime affecte chaque arme et peut décaler le point du muzzle flash.
- Le modèle d'arme affiché ne contrôle jamais les hitboxes ni le raycast ; les dégâts restent dans `player/weapons.ts`.

## Tests

- `test/render/billboard.test.ts` — normales, inclinaison d'éclairage et géométrie du billboard.
- `test/render/enemySprites.test.ts` — sélection des lignes d'animation et alignement du quad sur les pieds.
- `test/render/viewmodel.test.ts` — pose au repos, changement, swing, recul et pompe sans blocage du tir.
- `test/game/player/weaponClocks.test.ts` — horloges interpolées consommées par le viewmodel.

## Comment vérifier que ça marche

Lancez le niveau et comparez un ennemi de face, de dos et en trois-quarts en tournant autour de lui. Vérifiez que ses pieds s'alignent avec le sol, que l'animation de poursuite s'arrête quand il s'immobilise et que le flash de dégâts disparaît sans ralentir le gameplay.

Tirez puis changez d'arme pendant le mouvement. Le coup doit partir à l'appui ; l'animation du viewmodel accompagne l'action sans suspendre les entrées. Regardez aussi le modèle d'arme au sol avant et après son ramassage.

Couverture ciblée : `pnpm test -- billboard enemySprites viewmodel weapons`.
