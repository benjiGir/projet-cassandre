---
title: Contrats locaux du rendu
tags: [reference, rendu, contrats]
status: brouillon
updated: 2026-10-02
---

# Contrats locaux du rendu

Cette page conserve les contrats et détails retirés des commentaires de
`src/render/`. Le fonctionnement général reste dans [Rendu](../4-technique/rendu.md).

## Frontiere Effect et temps

`src/render/renderService.ts` enveloppe seulement l'appel WebGL dans
`Effect.sync`. Le renderer, la scène et la caméra sont des paramètres : ils
existent après la construction de `GameLayer`. La couche de substitution
`RenderService.test` ne dessine rien par défaut.

Les calculs de pose, les pools et les canevas restent des objets synchrones.
Leur orchestration passe par `runGameplaySync` dans le code appelant.
Aucun chargement de texture ne doit commencer dans un pas fixe. Les fonctions
`load*` de ce dossier se lancent à la frontière de démarrage du moteur.

Les animations des ennemis et des armes utilisent des horloges de gameplay
interpolées, ralenties par le hitstop. Les flashes, marqueurs, flottements,
débris et parasites CCTV avancent au delta réel d'affichage. Ils ne produisent
ni collision ni décision de gameplay. La rotation de visée reste directe.

## Billboard ennemi

`src/render/billboard.ts` emploie un quad vertical orienté seulement en yaw :
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

`src/render/enemySprites.ts` sépare la ligne d'animation de la colonne choisie
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

## Ramassages

`src/render/pickups.ts` habille les repères glTF de soin, munitions, nourriture
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
avec l'atlas 159 × 72 px. Les carrés de 0,8/0,8/1,1 m privilégient la lecture
à distance, sans reproduire l'échelle réelle des trois armes.
Le V est inversé comme pour les billboards ennemis.

L'atlas d'armes se charge une fois en arrière-plan. Son filtrage doit être
configuré dans `onLoad` : `configureRetroTexture` demande un upload, incorrect
avant l'arrivée de l'image. Le quad peut être transparent jusque-là.
Le matériau et les géométries d'armes sont partagés. Une seule horloge avance
par frame avant les updates individuels ; l'avancer par pickup multiplierait
la vitesse. Le pouls d'émissif partagé varie entre 0,55 et 1,3, le flottement
entre ±0,08 m. Leurs cadences distinctes évitent un clignotement mécanique.

`attachTo` capture la hauteur locale après conversion de la position mondiale.
La direction du billboard utilise la position mondiale du mesh enfant ;
soustraire sa position locale à la caméra donnerait un cap erroné.
La phase de flottement dérive de la position, sans consommer le RNG du gameplay.

`src/render/cardPickups.ts` précharge les trois textures au démarrage : aucun
chargement ne commence à la mort du Directeur. Les pixels sont partagés mais
chaque carte clone la texture, pour isoler sa libération et le hot reload.
La pose transforme aussi la rotation mondiale en rotation locale du parent.
Les cartes du niveau suivent le nettoyage du loader ; le drop du boss se
libère séparément. Les cartes flottent et pulsent au temps réel.

## Viewmodel

`src/render/viewmodel.ts` charge les modèles Blender exprimés dans le repère
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

`src/render/fx.ts` reçoit des primitives Three.js et des valeurs de présentation.
Il n'importe pas les systèmes de gameplay. Les matières sont traduites en
chaînes ou couleurs par l'appelant. Son RNG cosmétique seedé est injecté à
chaque partie et reste distinct de la dispersion du fusil.

Le shake retient le maximum entre l'amplitude déjà amortie et la nouvelle,
sans addition. La décroissance atteint 5 % à la fin demandée. L'offset se tire
dans le volume d'une sphère ; la racine cubique évite une concentration au
centre. Les flashes durent deux frames d'affichage et utilisent deux slots.
Leur origine est le canon affiché et leur normale regarde à l'opposé du tir.
Le pied-de-biche n'en reçoit aucun.

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
`appliquerFiltrage` déduplique les textures par identité ; il ne visite
actuellement que la propriété `map` des matériaux, ce qui limite sa portée.
Changer la résolution interne met à jour le ratio caméra ; les overlays
conservent leur taille d'origine.

`ciel.ts` met en cache une cubemap par nom. Ses six faces proviennent de
`tools/textures/generate_ciel.py`. Elle se dessine derrière la scène sans mesh,
visible uniquement là où aucune géométrie ne masque le fond. Son filtrage
reste nearest dans les deux sens, sans mipmaps : elle n'est pas vue en fuyante.
