---
title: Sprites et viewmodel
tags: [technique]
status: brouillon
updated: 2026-10-13
---

# Sprites et viewmodel

## Responsabilité

Cette page décrit les représentations visuelles des ennemis et des armes en vue subjective. Le gameplay choisit les états, les armes et les tirs ; les modules de rendu reçoivent une pose et des horloges déjà calculées.

## Fichiers

- `src/render/sprites/billboard.ts` — quad orienté vers la caméra, sélection de direction et flash de dégâts.
- `src/render/sprites/enemySprites.ts` — charge les atlas et manifestes, puis associe les états visibles aux lignes de l'atlas.
- `src/render/viewmodel/weaponModels.ts` — chargement glTF, validation des extras et modèles de secours.
- `src/render/viewmodel/viewmodelTypes.ts` — contrats des modèles, horloges et poses.
- `src/render/viewmodel/viewmodelAnimation.ts` — calcul pur des séquences à partir des horloges.
- `src/render/viewmodel/viewmodel.ts` — hiérarchie caméra et application des poses.
- `src/render/pickups/pickupResources.ts` — atlas et modèles partagés, détenus par la session.
- `src/render/pickups/pickups.ts` — rend les armes au sol sous forme de billboards.
- `src/render/pickups/cardPickups.ts` — rend les trois cartes de fidélité et le drop du Directeur.
- `src/game/loop/interpolateVisuals.ts` — transmet les positions et orientations interpolées des acteurs.
- `src/game/loop/updateFx.ts` — fait décroître les flashes au temps réel.
- `src/game/player/weapons/weapons.ts` — détient les horloges de tir et de changement d'arme consommées par le viewmodel.
- `tools/blender/render_enemy_sprites.py` — produit les planches et manifestes ennemis.
- `tools/sprites/describe_costard.py` — mesure les cases peintes du Costard et copie les originaux vers le runtime.
- `tools/sprites/describe_rampant.py` — décrit le Rampant peint ; la mesure commune vit dans `tools/sprites/describe_painted.py`.
- `tools/sprites/describe_vigile.py` — décrit les quatre carnations peintes du Vigile.
- `tools/sprites/describe_directeur.py` — décrit les formes humaine et révélée du Directeur.
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

Le Costard utilise des dessins générés dans le style du héros, conservés dans
`assets_src/costard_sprites/` avec leurs prompts. Ses quatre planches de
1024 × 1536 pixels contiennent chacune 96 cases : huit directions et douze
poses. Les colonnes montrent face, trois-quarts droit, profil droit, dos droit,
dos, dos gauche, profil gauche et trois-quarts gauche.

La poursuite joue les lignes 2, 3, 4, 3 par distance parcourue. Le tir, l'impact
et la visée ont des poses distinctes. Quatre images de mort s'étalent sur la
durée de mort existante ; le cadavre garde la dernière. L'IA, les capsules et
les dégâts restent indépendants des images.

Le champ facultatif `layouts` décrit, pour chaque peau, les rectangles de
chaque pose, leur ancrage horizontal, les pieds et la densité. L'outil mesure
l'alpha sans modifier les PNG. Une seule densité par peau préserve la taille
du corps pendant qu'il tombe : le cadavre n'est pas agrandi à 1,8 m de haut.
Les dimensions du PNG, les huit directions de chaque ligne et les bornes des
rectangles sont contrôlées au chargement. Les quatre espèces utilisent des
planches peintes ; la grille régulière reste disponible pour le repli.

Le Rampant partage ce pipeline peint, avec une planche de 96 cases dans
`assets_src/rampant_sprites/`. Sa pose de repos mesure 1,2 m de haut. La
densité reste identique entre les poses : l'élan peut le redresser, puis son
corps s'affaisse à la mort. Les lignes 5 et 6 représentent l'anticipation et
le coup de griffe, sous les noms historiques `aim` et `fire` ; aucune arme
à feu ni traînée magique n'est ajoutée. La course joue 2, 3, 4, 3, avec un
cycle de 2,4 m. La capsule, la portée et la vitesse d'attaque ne viennent pas
du dessin. Le même quad conserve le flash d'impact et l'apparition TSL.
L'ancrage horizontal du Rampant reprend la pose de repos de chaque direction
jusqu'à la chute : une griffe levée ne décale pas son corps. Les poses au sol
reprennent le centre du rectangle.

Le Vigile utilise quatre planches peintes dans `assets_src/vigile_sprites/`,
avec leurs prompts. Sa pose de repos mesure 2 m, comme sa capsule. La bande
jaune continue dans le dos ; le bouclier reste porté devant le corps à gauche
et la matraque à droite. L'anticipation lève la matraque avant le coup.
Les rectangles mesurés conservent une densité par carnation et un ancrage de
repos jusqu'à la chute, sans agrandir le cadavre. La marche reste liée à la
distance parcourue, avec un cycle de 1,7 m ; les durées d'attaque, la couverture
du bouclier et les dégâts restent ceux du gameplay existant.
Chaque carnation contient 80 cases : huit directions, deux pas de marche et
trois poses de mort parmi les dix lignes. La mesure exclut les petits
fragments d'une case voisine qui touchent le bord d'une colonne ; seuls les
rectangles changent, les originaux PNG restent intacts.

Le Directeur possède deux planches de 80 cases dans
`assets_src/directeur_sprites/` : humaine et révélée. Elles conservent le
costume ivoire, la cravate dorée et le pistolet ; la tête et les mains deviennent
reptiliennes à mi-vie. Sa hauteur de repos reste de 2,05 m. Les poses de visée,
tir, impact et mort sont distinctes, et la marche suit un cycle de 2,8 m.
Chaque forme possède ses rectangles et sa densité. Au spawn puis à la
révélation, le rendu prend le `layout` correspondant ; la sphère de culling
est étendue si la nouvelle forme en a besoin. Le plancher d'éclairage humain
de 0,32 reste actif dans les deux formes. Le seuil de révélation, les dégâts,
la capsule et le drop Platine restent définis par le gameplay.
Les poses de tir gardent l'éclair entier dans leur rectangle, avec une marge
transparente entre les silhouettes voisines.
Le générateur du Directeur mesure les silhouettes debout sur toute la ligne,
par composantes d'alpha, pour inclure le tir qui dépasse une colonne nominale.
Les poses au sol utilisent les colonnes : leurs flaques peuvent se rejoindre.

### Billboard 8 directions

`BillboardSprite` possède un `PlaneGeometry` et une texture clonée par instance. Le clonage est nécessaire : chaque ennemi change le `repeat` et l'`offset` de sa case sans modifier les UV d'un autre ennemi qui partage l'atlas.

Le billboard ne pivote que sur l'axe vertical. L'angle entre le vecteur avant de l'ennemi et la direction horizontale vers la caméra est quantifié par pas de 45 degrés. Si l'un des vecteurs est dégénéré, le sprite garde la dernière direction valide.

Avec un `layout` peint, les sommets du même quad suivent les dimensions de la
case. Leur mise à jour n'alloue ni géométrie ni matériau. Le choix de vue est
refait dans `onBeforeRender` avec la caméra de la passe, y compris celle d'un
miroir. Une sphère englobant toutes ses poses conserve le culling hors champ
sans recalculer les bornes par frame ; le sprite reste deux triangles. Le
masque alpha de l'apparition TSL lit les mêmes offsets UV.

Le matériau est un `MeshLambertMaterial` opaque avec `alphaTest` (0,5 par défaut) et `depthWrite`. Les pixels transparents sont coupés ; les sprites ne demandent pas de tri alpha. L'option `normalTilt` incline les normales pour recevoir la lumière, sans modifier la géométrie. `setTint` modifie la teinte et `setAtlas` remplace la peau tout en gardant la case courante.

Le flash blanc de dégâts est purement visuel. `setFlash` peut renforcer un flash en cours ; `updateFlash(realDt)` applique sa décroissance au taux d'affichage. Le déclenchement vient du gameplay, mais la durée du flash ne fait pas avancer l'état de l'ennemi.

### Viewmodel et armes au sol

`loadWeaponModels` lit `public/assets/weapons/armes.glb` et récupère les meshes `vm_*`, `world_*` et leurs extras de pivots, bouche de canon et axe de glissière. Les modèles de vue sont déjà placés dans le repère de caméra par Blender. Le runtime les attache comme enfants de caméra et anime les pivots ; il ne recalcule pas leur cadrage.

Les géométries utilisent un matériau Lambert à vertex colors. Si le fichier ou un extra requis manque, `loadWeaponModelsOrPlaceholder` journalise l'erreur et fournit des boîtes de remplacement. Le modèle de pompe contient un sous-mesh mobile pour la pompe ; les pivots guident le recul et le glissement.

Le viewmodel interpole les clocks de chaque arme. Le changement fait descendre l'ancienne arme puis remonter la nouvelle ; le pied-de-biche balaie après l'appui ; le pompe recule puis pompe après le tir ; le pistolet et le pistolet de détresse (`vm_flare`) n'ont que leur recul. Tirer avec la nouvelle arme peut la remettre en place immédiatement. Aucun de ces gestes ne retarde la possibilité de tirer, conformément à l'invariant [#10](../3-architecture/invariants.md).

Les armes au sol ne sont pas le viewmodel. `src/render/pickups/pickups.ts` dessine les billboards d'armes et les modèles de soin et de munitions ; `spawning.ts` habille les meshes `use_*` et conserve les billboards pour leur animation de présentation. `bootGameSession` attend l’atlas et préchauffe les textures avant la construction de la partie. Les modèles partagés vivent dans `session.pickupResources`, à travers les hot reloads ; ils sont libérés après l’arrêt du niveau.

### Cartes de fidélité

`src/render/pickups/cardPickups.ts` remplace les cubes `use_*` portant `card` par des cartes rectangulaires à coins arrondis. Les sprites RGBA de 128×80 pixels portent une puce, le nom du rang et une, deux ou trois étoiles. Argent est gris bleuté, Or doré et Platine turquoise clair. Les trois images sont générées par `tools/textures/generate_card_pickups.py` dans `public/assets/sprites/cards/`.

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
- Le modèle d'arme affiché ne contrôle jamais les hitboxes ni le raycast ; les dégâts restent dans `player/weapons/weapons.ts`.

## Tests

- `test/render/sprites/billboard.test.ts` — normales, inclinaison d'éclairage et géométrie du billboard.
- `test/render/sprites/enemySprites.test.ts` — sélection des lignes d'animation et alignement du quad sur les pieds.
- `test/render/viewmodel/viewmodel.test.ts` — pose au repos, changement, swing, recul et pompe sans blocage du tir.
- `test/game/player/weapons/weaponClocks.test.ts` — horloges interpolées consommées par le viewmodel.

## Comment vérifier que ça marche

Lancez le niveau et comparez un ennemi de face, de dos et en trois-quarts en tournant autour de lui. Vérifiez que ses pieds s'alignent avec le sol, que l'animation de poursuite s'arrête quand il s'immobilise et que le flash de dégâts disparaît sans ralentir le gameplay.

Tirez puis changez d'arme pendant le mouvement. Le coup doit partir à l'appui ; l'animation du viewmodel accompagne l'action sans suspendre les entrées. Regardez aussi le modèle d'arme au sol avant et après son ramassage.

Couverture ciblée : `pnpm test -- billboard enemySprites viewmodel weapons`.
