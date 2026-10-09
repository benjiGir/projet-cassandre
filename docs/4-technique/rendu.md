---
title: Rendu
tags: [technique]
status: brouillon
updated: 2026-10-09
---

# Rendu

## Responsabilité

Le rendu transforme la scène Three.js en image, puis la présente dans le canevas du jeu avec le style rétro prévu. Il ne décide pas les dégâts, la progression des ennemis ni la composition de l'interface React.

## Fichiers

- `src/render/pipeline/renderer.ts` — crée le renderer WebGL, configure les textures et expose la résolution interne.
- `src/render/pipeline/renderService.ts` — enveloppe l'appel WebGL derrière un service Effect synchrone.
- `src/main.ts` — appelle le rendu après l'interpolation et les mises à jour de présentation.
- `src/core/loop/loop.ts` — cadence les pas fixes, l'interpolation et l'image affichée.
- `src/game/loop/interpolateVisuals.ts` — place les objets interpolables et lit la visée de la caméra.
- `src/game/loop/updateFx.ts` — met à jour les éléments visuels transitoires au taux d'affichage.
- `src/game/session/gameEngine.ts` — crée la scène, la caméra, le renderer et les overlays.
- `src/game/settings/graphicsSettings.ts` — persiste et applique les réglages de rendu.
- `src/render/fx/gore.ts` — façade du gore : ce qu'un ennemi laisse sur le décor. `goreConfig.ts` porte ses réglages et le contrat de la sonde, `goreSplats.ts` et `goreAtlas.ts` les taches, `goreChunks.ts` les morceaux.
- `src/game/session/presentation/surfaceProbe.ts` — sonde du décor statique, fournie au gore par le jeu ; `src/game/level/loading/movableColliders.ts` dit ce qui, dans le niveau, bouge ou se casse.
- `src/render/debug/debugView.ts` — bascule la géométrie en mode wireframe.
- `src/render/overlays/cameraView.ts`, `crosshair.ts` et `hitmarker.ts` — canevas 2D spécialisés hors React.
- `index.html` — dimensionne l'image 16:9 et demande un agrandissement à pixels nets.

## Où ça s'insère dans la boucle

Le gameplay avance au pas fixe ; la pose des objets est interpolée, puis les effets visuels sont mis à jour et la scène est dessinée une fois par frame navigateur. Le renderer ne récupère jamais le temps de jeu lui-même. Le diagramme résume ce trajet.

~~~mermaid
flowchart TD
  A["Pas fixe : état de jeu"] --> B["Interpolation des poses"]
  B --> C["Mise à jour des effets"]
  C --> D["Scène et caméra"]
  D --> E["RenderService"]
  E --> F["WebGL : canvas interne"]
  F --> G["Agrandissement CSS pixelisé"]
~~~

`main.ts` appelle `RenderService.render` par `runGameplaySync` après l'orchestration de la frame. L'effet ne fait que l'appel synchrone `renderer.render(scene, camera)` ; `RenderService.test` permet de le remplacer dans les tests.

La rotation de caméra suit directement les entrées au taux d'affichage. L'interpolation ne concerne pas le regard ; les sprites lisent la position de caméra courante après l'interpolation des acteurs. Les règles de temps sont détaillées dans [Boucle et temps](../3-architecture/boucle-et-temps.md).

## Données et contrats

### Image interne et présentation

`createRenderer` crée un `WebGLRenderer` avec antialiasing désactivé, pixel ratio à 1 et taille initiale 640×360. Le canevas garde sa taille CSS : `index.html` le contient dans une boîte 16:9 et applique `image-rendering: pixelated`. Les bandes hors image restent remplies par le fond de l'application.

Le menu Affichage expose aussi les préréglages 960×540, 1280×720 et 1600×900. `graphicsSettings.ts` applique leur taille au renderer et met à jour le rapport de la caméra. `cassandre.resolution(l, h)` fournit un réglage de diagnostic direct. Les canevas 2D restent en 640×360.

**Arbitrage en attente** : [l'invariant #4](../3-architecture/invariants.md) présente 640×360 comme une résolution interne non négociable, alors que ces préréglages changent effectivement la taille interne. La proposition de résolution interne configurable est suivie dans [ADR 0034](../decisions/0034-resolution-interne-configurable.md). La résolution d'origine reste le réglage par défaut jusqu'à décision.

### Textures et matériaux

`configureRetroTexture` impose `NearestFilter` à l'agrandissement dans tous les modes. Le réglage courant s'applique à toute nouvelle texture. Pour la réduction, les modes sont :

| Mode | Réduction | Usage |
|---|---|---|
| `nearest` | voisin le plus proche, sans mipmaps | réglage historique ; les surfaces lointaines peuvent scintiller. |
| `mipmap` | mipmaps et `NearestMipmapLinearFilter` | réduit le crénelage, sans filtrage anisotrope. |
| `aniso` | même réduction, avec anisotropie maximale disponible | mode par défaut ; aide surtout les surfaces vues en biais. |

`cassandre.filtrage(mode)` réapplique le mode à toutes les textures déjà chargées. Les textures sont parcourues une fois par identité, même si plusieurs meshes partagent la même texture. `graphicsSettings.ts` persiste le choix du menu ; un changement est appliqué à chaud dès que le renderer existe.

Le loader reconvertit les matériaux glTF en `MeshLambertMaterial`. Le matériau garde la couleur diffuse, la texture, l'opacité/transparence et les vertex colors. L'attribut glTF `COLOR_0` devient `geometry.attributes.color` dans Three.js et porte le bake de couleur ou d'ombre du niveau. Les raisons sont dans [Éclairage](eclairage.md) et l'[ADR 0005 — Éclairage en vertex colors](../decisions/0005-eclairage-vertex-colors.md).

Le renderer WebGL installe `WebGLNodesHandler` pour accepter des matériaux TSL ciblés à côté des matériaux classiques. Un effet qui anime son shader reçoit son temps depuis la simulation au pas fixe. Le reste du niveau garde les matériaux Lambert produits par le loader.

### Préparation des douches

`src/game/level/sanitaires/doucheShader.ts::warmShaderDouches` rend les jets avant le
commit du niveau, sous l'écran de chargement. Le pool de lampes est déjà
configuré. Les jets deviennent temporairement visibles et ne sont pas
éliminés par le frustum ; leur état initial éteint est restauré ensuite.
L'horloge du shader n'avance pas pendant cette préparation.

L'adaptateur `WebGLNodesHandler` ne prend pas en charge `compile` et
`compileAsync` pour les matériaux nodaux. Deux rendus réels sont nécessaires,
avec une microtask entre eux pour laisser l'adaptateur actualiser ses
attributs de géométrie. Ils passent par `RenderService` et `runGameplaySync`,
mais l'attente de préparation reste à la frontière de chargement.

Le framebuffer écran est utilisé pour garder la même variante de conversion
de couleur qu'en jeu. Un render target ordinaire prépare une variante
linéaire, ce qui laisse une compilation à payer au premier affichage réel.
Un dernier rendu, jets restaurés, efface l'image de préparation avant le
prochain paint. Au hot reload, l'ancienne racine est temporairement détachée
pour que ses lampes ne participent pas au shader du candidat : l'adaptateur
parcourt aussi les lampes invisibles. Elle est remise en place avant le
commit ou son éventuelle annulation.
La boule de feu des explosions (`src/render/fx/explosions.ts`) utilise aussi
un matériau TSL. `spawning.ts::warmFxShaders` la prépare juste après
les douches, par la même recette : une boule placée devant la caméra, deux
rendus réels, puis un rendu qui efface l'image. Son matériau est unique et
partagé par tout le pool ; l'âge et la graine de chaque boule sont lus sur son
mesh au moment du dessin.

Chaque racine de niveau possède son matériau, partagé par ses jets. La
libération de l'ancien niveau ne détruit donc pas le programme déjà préparé
pour le nouveau.

### Gore

`src/render/fx/gore.ts` dessine ce qu'un ennemi laisse sur le décor : une
flaque qui s'étale sous un mort, une giclée derrière un ennemi touché, et pour
un ennemi qui éclate une flaque, des traînées au sol, des taches à coulures
aux murs et des morceaux qui retombent. Tout est cosmétique : temps
d'affichage, flux de présentation, aucun effet sur la simulation.

Le coût est fixe : **deux lots de dessin**, quelle que soit la quantité de
sang. Les taches sont les quads d'une seule géométrie, écrits dans une réserve
tournante de 192 ; les morceaux sont un `InstancedMesh` de 48. Les plus
anciens sont repris quand la réserve est pleine.

Le rendu ne connaît pas Rapier. Le jeu lui fournit une sonde
(`createStaticSurfaceProbe`) qui rend le premier décor **statique** sur un
rayon. Une porte, une vitre, un sanitaire ou un prop ne reçoivent jamais de
tache : elle resterait suspendue en l'air une fois l'objet ouvert ou cassé.
La sonde appartient à la partie ; `resetSession` la retire avant que le monde
physique ne soit libéré.

Trois règles de pose :

- une tache vérifie que son pourtour repose sur la même surface ; sinon elle
  se réduit de moitié, ou ne se pose pas ;
- au sol elle prend n'importe quelle orientation, ou s'allonge dans l'axe du
  coup ; au mur elle reste droite, coulures vers le bas ;
- le mesh des taches se dessine après le décor opaque (`renderOrder`), sans
  écrire la profondeur : deux taches superposées se recouvrent dans l'ordre
  de pose au lieu de scintiller.

L'atlas des taches est dessiné par le code, sans tirage : huit formes fixes en
gros pixels (`goreAtlas.ts`). Les réglages sont dans `goreConfig`
(`goreConfig.ts`).

### Frontières des couches

`src/render/` dépend de Three.js et reçoit des valeurs simples. Il ne lit pas directement les machines ennemies ni les contrôleurs joueur. `game/loop/` traduit l'état du jeu en poses et événements visuels ; l'architecture complète est décrite dans [Simulation et présentation](../3-architecture/simulation-et-presentation.md).

Le HUD React est rendu séparément dans `#ui-root` et ne pilote pas le renderer. Le réticule, le hitmarker et l'habillage caméra sont des canevas 2D transparents de 640×360 superposés au jeu. Ils ne sont pas des enfants de la scène 3D.

La caméra détermine le champ de vision, l'aspect et les plans de coupe. `setResolutionInterne` met à jour son aspect quand la résolution change, mais le ratio de sortie reste 16:9. Le réglage `cassandre.resolution` est un outil de comparaison ; il ne remplace pas l'observation des overlays à leur taille d'origine.

### Application des réglages

`setGraphicsSettings` écrit les choix validés dans le stockage local. Au démarrage, `initGraphicsSettingsAtBoot` relit ces valeurs et retombe sur les préréglages d'origine si le contenu est invalide ou inaccessible.

La cible WebGL n'existe qu'après la construction du moteur. `registerRenderTarget` l'enregistre une fois ; un réglage d'affichage fait avant cette étape est mémorisé puis appliqué au renderer quand il devient disponible. Après l'enregistrement, le filtrage et la résolution changent à chaud.

Les préréglages de résolution gardent tous le rapport 16:9 et sont des multiplicateurs de la résolution d'origine. Leur sélection modifie donc le coût de rendu sans changer le cadrage relatif de la caméra.

Le mode de filtrage reste courant au niveau du module renderer. Le loader l'utilise implicitement pour chaque texture nouvelle ; un chargement ou un hot reload conserve donc le choix sans reconfigurer la scène entière.

Le changement de résolution met à jour le buffer de dessin et le rapport de la caméra. Il ne redimensionne pas les canevas 2D du réticule, du hitmarker ou de la vue caméra ; ceux-ci restent conçus pour leur propre repère 640×360.

### Configuration d'une texture

`configureRetroTexture` règle aussi l'espace couleur sRGB, les mipmaps et l'anisotropie disponibles sur la machine. La texture reçoit ensuite `needsUpdate` pour que Three.js téléverse les changements au prochain rendu.

`appliquerFiltrage` parcourt la scène et déduplique les cartes par identité : un atlas partagé par plusieurs meshes n'est reconfiguré qu'une fois. La fonction retourne le nombre de textures distinctes modifiées, utile pour vérifier qu'un changement a réellement touché les ressources présentes.

Le renderer fixe le pixel ratio à 1 et désactive l'antialiasing. La netteté provient ensuite de l'agrandissement pixelisé du canevas, pas d'un rendu haute densité suivi d'un filtre lissant.

## Pièges

- Ne confondez pas agrandissement et réduction. Le gros pixel proche vient de `magFilter` ; les mipmaps traitent les surfaces éloignées et leur crénelage.
- Monter la résolution interne ne corrige pas un mauvais filtrage d'une texture réduite. Cela augmente aussi le travail par image.
- `WebGLRenderer` doit rester sans antialiasing. Un lissage supplémentaire efface les arêtes franches recherchées.
- La taille HTML du canvas et sa taille de dessin sont deux choses différentes. Modifier le CSS ne change pas la résolution réellement rendue.
- Un changement de résolution doit aussi mettre à jour `camera.aspect` et sa matrice de projection. Modifier seulement le canvas déforme le champ de vision.
- Les overlays ont leurs propres dimensions internes. Ne supposez pas qu'ils suivent les réglages appliqués au canvas WebGL.
- Le mode de filtrage est global au module renderer ; configurez les textures créées ensuite avec le mode courant, sans réinitialiser leur comportement au chargement du niveau.
- Tout appel au service de rendu reste synchrone. Une ressource qui exige une promesse se charge avant d'entrer dans la frame.

## Tests

- `test/render/fx/gore.test.ts` — taches au sol et au mur, morceaux qui se posent, réserve tournante, arêtes, remise à zéro. `test/render/fx/goreAtlas.test.ts` — atlas sans tirage, bords transparents. `test/game/session/presentation/surfaceProbe.test.ts` et `test/game/level/loading/movableColliders.test.ts` — la sonde ignore mobilier, portes, vitres et sanitaires.

- `test/render/pipeline/renderService.test.ts` — service de rendu substituable et absence d'appel WebGL par sa couche de test.
- `test/game/level/loading/loader.test.ts` — reconversion des matériaux du glTF et conservation des propriétés nécessaires au rendu.
- `test/render/sprites/billboard.test.ts` et `test/render/viewmodel/viewmodel.test.ts` — contrats de matériaux et de géométrie des objets 3D affichés.

## Comment vérifier que ça marche

Lancez le jeu à la résolution d'origine et vérifiez que les arêtes du décor restent nettes lors de l'agrandissement. Dans une vue de sol ou de mur en biais, comparez `cassandre.filtrage("nearest")`, `"mipmap"` puis `"aniso"` pendant que la caméra bouge.

Comparez ensuite le préréglage d'affichage courant avec 640×360 et vérifiez le rapport de la caméra, les bandes éventuelles et l'alignement des overlays. La console permet aussi `cassandre.resolution(960, 540)` puis `cassandre.resolution()` pour revenir à l'origine.

Couverture ciblée : `pnpm test -- renderService loader billboard viewmodel`.

## Registre des textures configurables

`src/render/pipeline/textureRegistry.ts` suit les textures configurées jusqu’à leur
libération. Le réglage global parcourt tous les canaux texture des matériaux
classiques et les uniformes ShaderMaterial. Pour du TSL, le propriétaire
enregistre les TextureNodes concernés avec `registerMaterialTextureInputs` ;
la valeur est relue au changement de mode, même si elle a été remplacée.
Les render targets, textures de profondeur et cubemaps du ciel gardent leur
contrat propre. L’espace couleur des canaux de données est préservé.


### Éclairs de tir

Le pistolet et le pompe utilisent un matériau TSL procédural préchauffé
sous l'écran de chargement, avec les explosions. La couleur passe par un
cœur blanc, du jaune et de l'orange ; le contour se rétracte au pas fixe.
Le flash suit le bout du canon affiché et son orientation pendant le recul.
Les deux lampes du pool restent présentes à intensité nulle au repos.
Les dimensions, durées et limites sont consignées dans
[Éclairs de tir TSL](../6-reference/notes-code-rendu.md#éclairs-de-tir-tsl).

### Apparition des renforts

Les groupes réveillés par une embuscade se matérialisent pendant 0,7 s :
silhouette turquoise en pixels, balayage montant et anneau au sol.
`enemyAppearances.ts` prête un matériau TSL partagé aux billboards, puis
restaure leur matériau Lambert. Toutes les espèces et variantes de peau
restent issues de leurs atlas habituels. Les ennemis restent touchables,
mais leur IA attend la fin de l'apparition avant de commencer.

Le temps vient du pas fixe de `SuitManager`, le rendu lit sa progression
dans `interpolateVisuals`. Les ennemis présents au chargement n'ont pas
cet effet. Les shaders sont préparés par `warmFxShaders` sous le chargement.
Contrat : [Matérialisation des embuscades](../6-reference/notes-code-rendu.md#matérialisation-des-embuscades).


### Fontaine du quartier en TSL

`src/render/environment/fountain/` ajoute l’eau à l’asset octogonal
`fontaine_place`. Le loader repère ses meshes par l’extra glTF `kit`,
calcule leur enveloppe dans le repère du niveau avant la fusion du décor,
puis pose un groupe `fx_fontaine_eau` à son centre horizontal et à sa base.
Le quartier pilote et le parcours métro utilisent ce même asset.
Un niveau sans cet asset ne crée aucune ressource de fontaine.

Le groupe contient quatre meshes : les deux surfaces fusionnées, les jets
fusionnés, les 96 gouttelettes fusionnées et la buse métallique.
Les trois matériaux d’eau sont des `MeshBasicNodeMaterial` procéduraux TSL.
Les surfaces et filets transparents utilisent `forceSinglePass` : une seule
passe suffit pour ces formes fines et évite les programmes et groupes
d’uniformes distincts pour la face avant et la face arrière.
Les anneaux aux impacts, les éclats mobiles et les trajectoires des gouttes
sont calculés sur le GPU. La buse utilise un matériau Lambert classique.
Aucune texture, lumière, collision ou simulation physique n’est ajoutée.

Le bassin inférieur est à 0,49 m, sous la margelle de 0,65 m. La surface
supérieure est à 1,865 m, au-dessus du disque existant qui culmine à 1,85 m.
Le jet monte jusqu’à environ 4 m ; les huit cascades retombent à 1,50 m
du centre, à l’intérieur du bassin. Les géométries conservent une enveloppe
qui inclut les déplacements du shader pour le culling.

`FountainWater.fixed` avance le temps dans `updateGameplay`.
`interpolateVisuals` interpole le temps précédent et courant pour éviter
un mouvement limité à 60 images/s. L’uniforme boucle sur 64 secondes ;
chaque fréquence accomplit un nombre entier de cycles. Aucun node `time`,
temps mural, tirage aléatoire ou travail asynchrone n’entre dans ces appels.

`warmFountainWater` effectue deux rendus réels via `RenderService`, séparés
par une microtask, dans la préparation asynchrone du niveau sous l’écran
de chargement. Le culling est désactivé temporairement pour compiler les
matériaux même si la fontaine est hors champ. L’ancien niveau est détaché
pendant la préparation ; le parent, le culling et la cible sont restaurés.
Toutes les géométries et tous les matériaux sont enregistrés dans
`LevelResources` dès leur création et libérés avec le niveau.
Les trois géométries et matériaux TSL ont aussi un nettoyage explicite via `onCleanup` :
le handler appelle temporairement `geometry.dispose()` après compilation
pour rafraîchir les attributs, puis les réutilise. Ce premier événement
les retire du suivi général ; le nettoyage explicite assure leur libération
au véritable déchargement.

Avant tous les préchauffages d’un remplacement de niveau, l’ancienne
fontaine est masquée et ses matériaux sont disposés pour libérer leurs
groupes d’uniformes. Leur graphe reste réutilisable en cas de rollback.
Cette suspension évite de réserver simultanément les groupes de l’ancienne
et de la nouvelle fontaine. L’ancienne racine reste détachée pendant toute
la séquence, pour éviter les variantes de shaders avec les lampes des deux
niveaux à la fois. Les effets persistants (explosion, flash et apparition)
libèrent aussi leurs anciens programmes avant cette séquence : le handler
TSL inclut les identifiants des lampes dans sa clé même pour un matériau
Basic. Garder leurs anciennes variantes réserverait des groupes d’uniformes
à chaque remplacement de niveau. La visibilité précédente est restaurée dans
le `finally` de la préparation ; le candidat est ensuite validé, ou libéré
par le chargeur avant le prochain rendu en cas d’échec.

En pause, l’interpolation de la fontaine lit la fin du dernier pas fixe
plutôt qu’un alpha qui continue d’osciller entre deux images.

La commande de développement `cassandre.level.reload()` attend le résultat
du remplacement à chaud en conservant la session courante.
La page de revue du métro offre trois vues de fontaine, une pause de
l’animation, un relevé de rendu avec et sans l’eau, et trois rechargements.
`cassandre.renderBench` rapporte également les nombres de géométries et
textures de `renderer.info.memory`. Les relevés et limites de validation
sont conservés dans le [journal du métro](../journal/metro-blockout-2026-10.md).
