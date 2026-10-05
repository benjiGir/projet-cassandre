---
title: Contrats locaux du rendu
tags: [reference, rendu, contrats]
status: brouillon
updated: 2026-10-05
---

# Contrats locaux du rendu

Cette page conserve les contrats et détails retirés des commentaires de
`src/render/`. Le fonctionnement général reste dans [Rendu](../4-technique/rendu.md).

## Frontiere Effect et temps

`src/render/pipeline/renderService.ts` enveloppe seulement l'appel WebGL dans
`Effect.sync`. Le renderer, la scène et la caméra sont des paramètres : ils
existent après la construction de `GameLayer`. La couche de substitution
`RenderService.test` ne dessine rien par défaut.

Les calculs de pose, les pools et les canevas restent des objets synchrones.
Leur orchestration passe par `runGameplaySync` dans le code appelant.
Aucun chargement de texture ne doit commencer dans un pas fixe. Les fonctions
`load*` de ce dossier se lancent à la frontière de démarrage du moteur.

Les animations des ennemis et des armes utilisent des horloges de gameplay
interpolées, ralenties par le hitstop. Les marqueurs, flottements,
débris et parasites CCTV avancent au delta réel d'affichage. Ils ne produisent
ni collision ni décision de gameplay. La rotation de visée reste directe.

## Enseigne Hyper Varan

`tools/level_v2/enseigne.py` pose le caisson, le varan en anneau, dix lettres
en relief et une lampe rouge au-dessus de l'entrée du parking extérieur.
La même recette sert au build et à `cassandre.store_sign()` pour une retouche
locale du niveau livré.

Les meshes `fx_enseigne_hyper_varan_*` restent hors de la fusion du décor.
`src/render/environment/storeSign.ts` prépare leurs matériaux Lambert avant
le premier rendu ; chaque lettre garde sa propre intensité émissive.
`storeSignConfig.ts` définit les séquences : six lettres stables, trois
défectueuses et une éteinte, avec le logo toujours allumé.

L'horloge appartient à la racine du niveau dans une `WeakMap`. Elle avance
avec le delta de gameplay au pas fixe, s'arrête en pause et se recrée au
rechargement du niveau. Les rafales utilisent des séquences fixes sans RNG,
minuteur mural, texture chargée en cours de partie ni changement de shader.
Les ressources GPU restent possédées par `LevelResources`.

## Commandes des portes

`tools/blender/lib_door_controls.py` construit cinq panneaux muraux : trois
lecteurs avec leur carte requise et deux poussoirs verts. Les libellés,
pictogrammes et couleurs partagent `assets_src/textures/prd_commandes.png`,
un atlas 128 × 128 produit par `tools/textures/generate_door_controls.py`.

`src/render/environment/doorControls.ts` ajoute une émission de 0,6 au seul
matériau `mat_prd_commandes`, à la conversion du niveau. Sa carte émissive
réutilise la texture diffuse. Les panneaux restent lisibles dans la pénombre,
sans lampe ajoutée, animation ni allocation par image. Leurs textures et
matériaux restent possédés par `LevelResources`.

La retouche locale `cassandre.rework_accesses()` partage les constructeurs du
build complet. Le secret de la cafétéria conserve ses identifiants de gameplay,
mais son distributeur coulisse de 1,8 m en 1,1 s et dévoile un passage de
1,5 × 2,25 m. Le local et sa trousse sont au sol ; son volume secret ne dépasse
pas dans la cafétéria. L'ancienne grille, son escalade et son cadre disparaissent.

## Billboard ennemi

`src/render/sprites/billboard.ts` emploie un quad vertical orienté seulement en yaw :
un `THREE.Sprite` inclinerait aussi le personnage avec le regard vertical.
L'atlas possède exactement huit colonnes. La direction zéro montre la face ;
les directions avancent par secteurs de 45 degrés calculés avec `atan2` du
produit croisé horizontal et du produit scalaire entre orientation et caméra.
Une orientation ou distance horizontale dégénérée conserve la dernière case.

`updatePose` reçoit la position et l'orientation déjà interpolées. La rotation
de caméra n'entre pas dans le calcul. La ligne est entière et bornée ; la ligne
zéro est en haut de l'image, donc son offset V est `1 - (row + 1) / rows`.

Chaque instance clone la texture et possède sa géométrie. Partager les offsets
modifierait toutes les entités en même temps ([ADR 0017](../decisions/0017-clone-texture-sprite-billboard.md)).
`setAtlas` exige une disposition identique et conserve la case courante.
`dispose` libère seulement les ressources propres à l'instance.

Les dimensions par défaut sont 1 × 1,8 m, une ligne, teinte blanche et coupure
alpha à 0,5. `verticalAnchor` mesure la fraction de hauteur sous `position.y` :
0 pour le pied, 0,5 pour le centre, 1 pour le sommet. La géométrie se translate
une fois ; elle ne change pas pendant l'interpolation.
`normalTilt` incline uniquement les normales pour mieux capter une lampe au
plafond. La silhouette et la pose du quad restent verticales.

Le matériau est opaque avec `alphaTest` et écrit la profondeur : pas de tri de
transparence entre ennemis. La teinte multiplie l'atlas ; le flash s'ajoute par
l'émissif. `setFlash` prend le maximum des amplitudes concurrentes, recalcule
le taux exponentiel depuis la durée demandée, atteint 5 % du pic à cette durée
et coupe sous 0,001. Le repli de durée vaut 0,25 s.
L'appel de `setTint` est normalement associé à une transition de peau.

L'atlas de repli utilise des cases 32 × 48 px, avec un pixel de marge
transparente. Chaque colonne possède une teinte, chaque ligne une luminosité
et une étiquette `col.row` pour distinguer directions et frames.

## Planches et chargement ennemi

`src/render/sprites/enemySprites.ts` sépare la ligne d'animation de la colonne choisie
par le billboard. Les poses et durées viennent d'un `EnemyAnimationInput`
traduit par l'appelant ; ce module ne lit pas la machine de l'ennemi.

La poursuite dépend de la distance parcourue, donc un ennemi bloqué ne court
pas sur place. Le repos boucle à cadence fixe. Alerte, stagger et mort étalent
leurs frames sur la durée de la pose ; le cadavre garde la dernière frame.
L'éclair de tir se superpose à la poursuite, car la machine reprend cette pose
le pas du tir. Les replis sont 1,5 fps, 2,8 m par cycle et 0,12 s d'éclair.

Le manifeste fournit taille des cases, densité, pixels transparents sous les
pieds, atlas par peau et sept animations. `enemySpriteQuad` convertit les
pixels en mètres et place les pieds au bas de la capsule, incluant demi-hauteur,
rayon et offset du contrôleur fournis par l'appelant.
`enemySpriteManifest.ts` décode le manifeste avec Effect Schema : huit colonnes,
dimensions et densité positives, sept animations, compte de frames non nul,
lignes dans les limites de l’atlas et peau humaine non vide.
Les réponses de textures sont toutes attendues ; si l’une échoue, celles
déjà réussies sont libérées avant le repli.
Son repli numéroté comporte dix lignes, dont quatre pour la mort ; l'erreur est
signalée en console et le jeu reste jouable.

Les Costards et les Vigiles possèdent quatre carnations (`clair`, `humain`,
`mate`, `fonce`), rendues avec les mêmes poses et uniformes par
`tools/blender/render_enemy_sprites.py`. Visage et mains changent ensemble.
`SuitManager` attribue un `appearanceIndex` par ordre d'apparition dans chaque
espèce ; `enemyHumanAtlas` choisit l'atlas une seule fois au spawn, dans l'ordre
de `enemySkinConfig.ts`. Ce compteur ne consomme aucun tirage du RNG de combat,
et la carnation reste identique jusque sur le cadavre. Les anciennes planches
sans variantes retombent sur `humain`. Le Rampant et la transformation du
Directeur gardent leurs atlas spécifiques.

Les sprites humains ordinaires disposent aussi d'un plancher d'éclairage
Lambert de 0,32 (`HUMAN_SPRITE_MINIMUM_LIGHT`). `BillboardSprite` borne le
diffus indirect par la couleur de l'atlas multipliée par ce plancher : les
carnations restent distinctes dans le parking sombre, les lampes continuent
de les éclairer et le flash de dégâts conserve son émissif séparé. Le
paramètre est nul par défaut pour les autres billboards ; les uniformes
partagent la même variante de shader.

## Ramassages

`src/render/pickups/pickups.ts` habille les repères glTF de soin, munitions, nourriture
et armes. Le repère caché reste le parent du rendu : consommation et élagage
retirent aussi ses enfants. Le modèle se place sur `groundY`, ou sur le bas
de la boîte si aucune surface n'a été trouvée.

La trousse utilise une croix verte de pharmacie, jamais l'emblème rouge. Sa
silhouette de 0,5 × 0,32 × 0,36 m et son émissif de 0,35 la rendent visible
au souterrain. La caisse olive, plus basse (0,42 × 0,22 × 0,3 m), porte trois
balles jaunes ; la rotation de biais évite la lecture en panneau plat.
Les aliments utilisent des géométries et matériaux partagés par recette/couleur.
Leurs silhouettes distinctes priment sur les détails à 640×360.

Les icônes d'armes sont pré-rendues depuis les modèles `world_*` par
`tools/blender/render_weapon_pickups.py`. Le rectangle UV et les dimensions
copiés de `public/assets/sprites/weapon_pickups.json` doivent rester alignés
avec l'atlas 184 × 94 px. Les carrés de 0,8/0,8/1,1 m privilégient la lecture
à distance, sans reproduire l'échelle réelle des trois armes.
Le V est inversé comme pour les billboards ennemis.

L’atlas d’armes est attendu par `loadPickupResources` avant la création de
la session. Son filtrage est configuré après l’arrivée de l’image, puis
`warmTextures` prépare son upload pendant le chargement.
Le matériau et les géométries d'armes sont partagés. Une seule horloge avance
par frame avant les updates individuels ; l'avancer par pickup multiplierait
la vitesse. Le pouls d'émissif partagé varie entre 0,55 et 1,3, le flottement
entre ±0,08 m. Leurs cadences distinctes évitent un clignotement mécanique.

`attachTo` capture la hauteur locale après conversion de la position mondiale.
La direction du billboard utilise la position mondiale du mesh enfant ;
soustraire sa position locale à la caméra donnerait un cap erroné.
La phase de flottement dérive de la position, sans consommer le RNG du gameplay.

`src/render/pickups/cardPickups.ts` précharge les trois textures au démarrage : aucun
chargement ne commence à la mort du Directeur. Les pixels sont partagés mais
chaque carte clone la texture, pour isoler sa libération et le hot reload.
La pose transforme aussi la rotation mondiale en rotation locale du parent.
Les cartes du niveau suivent le nettoyage du loader ; le drop du boss se
libère séparément. Les cartes flottent et pulsent au temps réel.

## Viewmodel

`src/render/viewmodel/weaponModels.ts` charge les modèles Blender exprimés dans le repère
caméra ; le cadrage se règle dans Blender. Le poing définit les pivots et
l'extra `bout_canon` l'origine de l'éclair de tir. Le fût se déplace dans la
direction opposée à `axe_glissiere`. Les sommets portent les couleurs et le
rendu conserve un matériau Lambert partagé.

Le loader cherche le nom Blender dans `userData.name` : `GLTFLoader` peut
renommer un mesh ou poser les extras sur son groupe homonyme. Les vecteurs d’extras sont validés par un tuple de trois nombres finis avec
Effect Schema. Un nœud ou extra invalide provoque un repli signalé en console
sur les anciennes boîtes. Les matériaux et textures glTF d’origine sont
dédupliqués puis libérés ; seules les géométries sont reprises par le viewmodel.
`ViewmodelSource` ne demande que les poses et horloges interpolées, sans
dépendre de la classe `WeaponSystem`.
La caméra doit appartenir à la scène pour rendre ses enfants.

Les horloges interpolées déterminent le changement d'arme, le balayage et le
pompage. La pose indique l'ancienne arme pendant la descente. `lowered`,
`swing` et `pump` représentent des enveloppes 0–1. Le tir interrompt la
descente : aucune animation ne bloque une action. Les durées sont centralisées
dans `VIEWMODEL_TIMING`. Le pistolet utilise seulement le recul commun.
Le pied-de-biche pivote au coude, sinon l'avant-bras barre l'image.

La profondeur des armes est comprimée dans [0, 0,05] pour éviter que le canon
entre dans un mur proche, sans perdre l'occlusion entre main et arme.
`WebGLState` ne pilote pas `depthRange` ; le callback de fin rétablit [0, 1]
après chaque mesh. `update` suit la pose finale de caméra dans l'interpolation.
`muzzleWorldPosition` retourne le canon tel qu'affiché, sans modifier le tir.

## Effets et allocation

`src/render/fx/fx.ts` reçoit des primitives Three.js et des valeurs de présentation.
Il n'importe pas les systèmes de gameplay. Les matières sont traduites en
chaînes ou couleurs par l'appelant. Son RNG cosmétique seedé est injecté à
chaque partie et reste distinct de la dispersion du fusil.

Le shake retient le maximum entre l'amplitude déjà amortie et la nouvelle,
sans addition. La décroissance atteint 5 % à la fin demandée. L'offset se tire
dans le volume d'une sphère ; la racine cubique évite une concentration au
centre. Les éclairs de tir utilisent deux slots, une géométrie de six
triangles et un matériau TSL partagés. Leur origine et leur axe suivent le
canon affiché ; le pied-de-biche n'en reçoit aucun. Leur âge avance au pas
fixe, comme décrit dans [Éclairs de tir TSL](#éclairs-de-tir-tsl).

Les 24 decals sont des quads statiques décalés de 0,01 m contre le z-fighting.
L'appelant doit exclure ennemis, props, portes, vitres et sanitaires : leurs
surfaces peuvent bouger ou disparaître. `spawnImpactDecal` ne vérifie pas ce
contrat et ignore actuellement son argument `material`. Les particules libres
restent possibles sur toutes ces surfaces ; `flesh` choisit la couleur sang.

Les particules, douilles et morceaux partagent géométrie et matériau ; chaque
événement alloue les meshes et vélocités individuels. L'émission rare de gibs,
débris, givre et céramique ne suit pas le régime du jet permanent. La gravité
jouet vaut −25 m/s² sans Rapier ([ADR 0018](../decisions/0018-physique-jouet-debris-cosmetiques.md)).
Seules les douilles rebondissent, sur un plan y=0 supposé : l'approximation
peut traverser des marches ou étages. L'éjection presque verticale se rabat
sur +X si sa direction horizontale dégénère.

Les gibs changent taille, quantité et couleur ; les débris reçoivent une
couleur externe mise en cache pour éviter un matériau par casse. Le givre
utilise 12 % de la gravité pour retomber lentement. La gerbe d'eau de casse
part vers le haut et n'installe pas elle-même la fontaine permanente.
`resetSession` retire les effets transitoires sans détruire les pools persistants.

## Fontaines permanentes

Tous les jets d'eau de `fx.ts` partagent un `InstancedMesh` opaque : un lot de
dessin pour huit slots de jets, chacun avec 28 gouttes et six éclaboussures.
Le round-robin remplace le jet le plus ancien au-delà de huit. Aucun mesh ni
vecteur ne s'alloue pendant leurs updates. Les instances invisibles ont une
matrice d'échelle nulle ; la capacité ne change pas après construction.

Chaque origine définit son propre plan de retombée, y compris un urinoir en
hauteur. La vitesse verticale vise 1 à 1,5 m (`sqrt(2*g*h)`), la dispersion
horizontale forme un éventail. Une phase initiale de vol empêche toutes les
gouttes de partir ensemble. La retombée déclenche une éclaboussure puis
réinitialise la goutte. Les éclaboussures grossissent puis disparaissent par
l'échelle, sans tri de transparence. Leur curseur est indépendant par jet.

Les matrices appliquent des facteurs à une géométrie déjà large de 0,05 m :
réappliquer cette dimension donnerait des gouttes de 2,5 mm illisibles.
L'eau utilise un émissif pour se distinguer du carrelage sombre.
La sphère englobante se recalcule seulement à l'ajout/effacement des jets,
avec marge de 0,8 m. Sans jet, le mesh reste invisible. La sphère automatique
initiale de Three.js serait calculée sur des instances encore à l'origine.

## Overlays et diagnostic

`crosshair.ts`, `hitmarker.ts` et `cameraView.ts` utilisent des canevas 2D
640×360 hors React, décoratifs et sans interception du pointeur. Le réticule
reste au centre géométrique. Sa pulsation répond à chaque tir accepté, même
sans toucher un ennemi. Le hitmarker confirme uniquement dégâts/mort ennemie.
Les signaux hit et kill possèdent chacun leur fenêtre ; kill se dessine après
hit pour rester lisible. Leurs enveloppes linéaires utilisent le delta réel.
`src/render/overlays/canvasOverlay.ts` centralise la construction et la conversion
des couleurs hexadécimales CSS. Il obtient le contexte 2D avant d'attacher le
canvas : un échec ne laisse aucun élément inutilisable dans le DOM.
La classe CSS `game-overlay` conserve le cadre 16:9 et l'agrandissement au
plus proche. Chaque widget garde ses contrats et ses commandes de dessin.
Les canevas se nettoient avant chaque rendu et se retirent au `dispose`.

Le CCTV s'ajoute après le rendu par la caméra du niveau choisie par l'appelant.
Son hash déterministe ne consomme pas le RNG de simulation. Le bruit par
blocs de 4 px évolue à 12 Hz ; les scanlines fixes, la bordure et l'étiquette
signalent une console diégétique. Aucune modification plein écran du rendu
WebGL n'est nécessaire. Un overlay inactif s'efface entièrement.

`ballisticsDebug.ts` représente exactement les requêtes de tir : un seul
`LineSegments` pour les extrémités réelles des plombs et une capsule de
même longueur/rayon que la mêlée. Le cylindre de `CapsuleGeometry` suit +Y,
comme la capsule Rapier. Les traces durent 0,35 s puis libèrent leurs ressources.
L'affichage est actif en développement, basculé par B, absent en production.

`debugView.ts` traverse toute la scène, caméra/viewmodel compris. Le wireframe s’applique aux matériaux qui exposent une propriété booléenne
`wireframe`, classiques ou nodaux. Le diagnostic des autres décrit seulement
l’absence de cette capacité, sans invoquer l’ancien invariant Lambert exclusif.

## Eclairage et elagage

`lightPool.ts` retient jusqu'à 48 lampes. Le budget évite la limite des uniformes
WebGL ; il ne constitue pas seulement un gain de vitesse. Le score mesure la
distance au bord de la sphère éclairée, pas simplement au centre. Une portée
nulle obtient un score prioritaire ; si trop de telles lampes existent, le
budget reste toutefois le nombre maximal de slots allumés.
Le tri réutilise le tableau et ne reprend qu'après 2 m parcourus.
`setBudget` invalide ce seuil pour appliquer le réglage même à l'arrêt.
Un budget nul allume tout ; un petit niveau s'allume une seule fois.
Voir [ADR 0026](../decisions/0026-visibilite-par-espace-et-pool-de-lampes.md).

`useObjectCulling.ts` conserve uniquement les objets qu'il a éteints. Il ne doit
pas rallumer un ramassage consommé. La portée de 48 m permet de repérer les
pickups plus loin que les props ; la position mondiale est figée au chargement.
L'update suit la caméra au taux d'affichage.

## Renderer et ciel

`renderer.ts` conserve le voisin le plus proche à l'agrandissement. Les modes
nearest/mipmap/aniso changent seulement la réduction ; aniso est le défaut.
La limite d'anisotropie provient du renderer construit au démarrage.
`appliquerFiltrage` déduplique les textures par identité et visite
les textures enregistrées et tous les canaux classiques, uniformes shader
et entrées TSL explicitement enregistrées.
Changer la résolution interne met à jour le ratio caméra ; les overlays
conservent leur taille d'origine.

`ciel.ts` met en cache une cubemap par nom. Ses six faces proviennent de
`tools/textures/generate_ciel.py`. Elle se dessine derrière la scène sans mesh,
visible uniquement là où aucune géométrie ne masque le fond. Son filtrage
reste nearest dans les deux sens, sans mipmaps : elle n'est pas vue en fuyante.

## Ressources explicites et sous-systèmes

`pickupResources.ts` possède atlas, modèles alimentaires, géométries et
matériaux des ramassages pour une session. `pickups.ts` les emprunte pour
poser les objets ; sa construction ne lance aucun chargement. `LevelResources`
ignore ces ressources empruntées pendant le nettoyage d’un niveau.

`FxSystem` garde l’interface appelante et délègue aux pools `CameraShake`,
`MuzzleFlashes`, `ImpactDecals`, `ToyDebris` et `WaterJets`. Son ordre d’update reste shake,
débris, eau. Les éclairs de tir avancent séparément au pas fixe. Le RNG
cosmétique est partagé dans le même ordre.

Le registre de textures collecte les canaux classiques et uniformes shader.
Les TextureNodes TSL à texture utilisent `registerMaterialTextureInputs` avec
leurs entrées mutables. Render targets, depth textures et cube textures restent
hors de ce réglage. Le changement de filtrage conserve l’espace couleur des
canaux de données ; l’agrandissement reste nearest.


## Modèles des armes et mains

`tools/blender/build_weapons.py` assemble les volumes de `weapons/`,
les manches CC0 posées par IK et les mains à phalanges séparées.
Les mains droites sont fusionnées avec l'arme ; la main gauche avec le fût
mobile du pompe. Les meshes exportés restent dans le repère de l'œil,
avec `prise`, `bout_canon`, `axe_glissiere` calculés depuis la construction.
La source éditable est `assets_src/blender/armes.blend`.

`weaponModels.ts` conserve un seul matériau Lambert à couleurs de sommets.
`materials/minimumLight.ts` pose un minimum de lumière indirecte à 0,32
pour les armes ; cette fonction est aussi utilisée par les billboards
avec leur valeur existante. La correction est appliquée après le calcul
Lambert, avant fog et colorimétrie ; elle garde les couleurs, les lampes
et les éclairs de tir. Aucun lot ni lampe supplémentaire.

Voir la [planche de références](../assets/board-armes-mains.md) et la
[révision de l'ADR 0029](../decisions/0029-armes-en-vue-subjective.md).


## Éclairs de tir TSL

`muzzleFlashMaterial.ts` construit un `MeshBasicNodeMaterial` procédural :
cœur blanc, jaune et orange en paliers, pointes irrégulières et deux langues
longitudinales. `muzzleFlashGeometry.ts` fusionne une face de bouche et deux
plans croisés en six triangles. Le masque alpha coupe franchement le fond ;
il n'utilise ni texture, ni bloom, ni transparence douce. Un éclair ajoute
un lot de dessin. La géométrie et le matériau sont partagés par les deux slots.

`muzzleFlashConfig.ts` distingue pistolet (18 cm de largeur, 22 cm de longueur,
3/60 s) et pompe (40 cm, 40 cm, 5/60 s). Ce sont des dimensions visuelles.
Les lampes restent à intensité nulle au repos, présentes dans la scène, pour
éviter une recompilation des matériaux éclairés à chaque tir. La lumière
amortit son intensité au carré pendant l'éclair.

`updateGameplay` avance l'âge avec `gameplayDt`, via
`FxSystem.advanceMuzzleFlashes`, à la frontière synchrone habituelle.
`updateFx` reçoit les événements de tir et suit le canon à chaque affichage,
avec `Viewmodel.muzzleWorldPosition` et `muzzleWorldDirection`. Le pistolet
exporte `axe_canon` ; le pompe réutilise `axe_glissiere`, parallèle au canon.
La pose visuelle ne change ni la dispersion ni les raycasts de tir.

La graine et la rotation viennent d'un compteur de tirs remis à zéro par
session. Elles ne consomment aucun tirage du RNG cosmétique existant.
Le shader reçoit uniquement les valeurs du mesh, sans node TSL `time`.
Les éclairs partagent la compression de profondeur des armes, dessinent
après elles, et écrivent la profondeur sur les fragments conservés. Cela
empêche les vitres du décor de recouvrir l'éclair ; les pixels rejetés par
le masque n'écrivent rien.

`warmFxShaders` prépare le matériau avec deux rendus et une microtask sous
l'écran de chargement du niveau, avec la racine précédente détachée au
hot reload. La frontière asynchrone reste dans `spawning.ts`.
Référence API : [MeshBasicNodeMaterial](https://threejs.org/docs/pages/MeshBasicNodeMaterial.html).

## Matérialisation des embuscades

Seule l'action `reveiller` de `levelScriptActions.ts` appelle `spawnSuitAt`
avec `materialize: true`. Le Directeur et les ennemis présents au chargement
gardent leur apparition habituelle. La durée canonique est
`ENEMY_MATERIALIZATION_DURATION`, 42 pas à 60 Hz, dans
`src/game/entities/shared/enemySpawnConfig.ts`.

`SuitManager` avance le délai de chaque ennemi avant de traiter les dégâts.
Un ennemi vivant en cours d'apparition ne reçoit aucun tick d'IA ; il garde
son collider et peut être blessé ou tué. Une mort continue immédiatement son
animation normale. Pause et hitstop arrêtent ou ralentissent ce délai comme
le reste de la simulation. Le rendu ne décide jamais quand l'IA démarre.

`EnemyAppearances` prête un `MeshBasicNodeMaterial` au quad existant :
cellules de quatre texels environ, fragments turquoise, puis révélation du
sprite de bas en haut par une bande claire. Le masque conserve l'alpha de
l'atlas et écrit la profondeur, sans fondu transparent. La banque d'atlas
est fournie par `gameEngine.ts` ; un indice par mesh choisit le sampler dans
le shader partagé. Les UV reprennent l'offset et le repeat du billboard.
Le partage évite de multiplier les groupes d'uniformes WebGL. Aucun atlas
supplémentaire, aucun tirage RNG et aucune horloge murale ne sont ajoutés.

Un quad horizontal porte deux anneaux et des segments tournants procéduraux.
Son masque écrit la profondeur, sinon un sol opaque dessiné après lui le
recouvrirait. Il ajoute un lot temporaire, sans lampe. `interpolateVisuals` suit le sprite,
lit `Suit.appearanceProgress` et retire l'anneau à la fin ou à la mort.
Le matériau Lambert original reste possédé par `BillboardSprite.material` ;
ses flashes de dégâts et sa teinte continuent d'y être écrits. Le matériau
TSL appartient au système persistant, jamais au billboard.

`warmFxShaders` dessine le matériau et l'anneau deux fois sous le chargement,
sur le framebuffer écran. Le premier groupe d'embuscade réutilise ces
programmes. `resetSession` restaure tous les matériaux et retire les anneaux.
Les outils `spawnSuit`, `spawnRampant` et `spawnVigile` acceptent un quatrième
argument `true` pour regarder cette arrivée isolément.
