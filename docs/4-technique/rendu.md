---
title: Rendu
tags: [technique]
status: brouillon
updated: 2026-09-26
---

# Rendu

## Responsabilité

Le rendu transforme la scène Three.js en image, puis la présente dans le canevas du jeu avec le style rétro prévu. Il ne décide pas les dégâts, la progression des ennemis ni la composition de l'interface React.

## Fichiers

- `src/render/renderer.ts` — crée le renderer WebGL, configure les textures et expose la résolution interne.
- `src/render/renderService.ts` — enveloppe l'appel WebGL derrière un service Effect synchrone.
- `src/main.ts` — appelle le rendu après l'interpolation et les mises à jour de présentation.
- `src/core/loop.ts` — cadence les pas fixes, l'interpolation et l'image affichée.
- `src/game/loop/interpolateVisuals.ts` — place les objets interpolables et lit la visée de la caméra.
- `src/game/loop/updateFx.ts` — met à jour les éléments visuels transitoires au taux d'affichage.
- `src/game/session/gameEngine.ts` — crée la scène, la caméra, le renderer et les overlays.
- `src/game/graphicsSettings.ts` — persiste et applique les réglages de rendu.
- `src/render/debugView.ts` — bascule la géométrie en mode wireframe.
- `src/render/cameraView.ts`, `crosshair.ts` et `hitmarker.ts` — canevas 2D spécialisés hors React.
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

**Écart à arbitrer** : [l'invariant #4](../3-architecture/invariants.md) présente 640×360 comme une résolution interne non négociable, alors que ces préréglages changent effectivement la taille interne. L'écart est consigné dans `docs/_chantier/ecarts.md`. La résolution d'origine reste le réglage par défaut ; cette page décrit les capacités du code sans décider si les préréglages sont compatibles avec l'invariant.

### Textures et matériaux

`configureRetroTexture` impose `NearestFilter` à l'agrandissement dans tous les modes. Le réglage courant s'applique à toute nouvelle texture. Pour la réduction, les modes sont :

| Mode | Réduction | Usage |
|---|---|---|
| `nearest` | voisin le plus proche, sans mipmaps | réglage historique ; les surfaces lointaines peuvent scintiller. |
| `mipmap` | mipmaps et `NearestMipmapLinearFilter` | réduit le crénelage, sans filtrage anisotrope. |
| `aniso` | même réduction, avec anisotropie maximale disponible | mode par défaut ; aide surtout les surfaces vues en biais. |

`cassandre.filtrage(mode)` réapplique le mode à toutes les textures déjà chargées. Les textures sont parcourues une fois par identité, même si plusieurs meshes partagent la même texture. `graphicsSettings.ts` persiste le choix du menu ; un changement est appliqué à chaud dès que le renderer existe.

Le loader reconvertit les matériaux glTF en `MeshLambertMaterial`. Le matériau garde la couleur diffuse, la texture, l'opacité/transparence et les vertex colors. L'attribut glTF `COLOR_0` devient `geometry.attributes.color` dans Three.js et porte le bake de couleur ou d'ombre du niveau. Les raisons sont dans [Éclairage](eclairage.md) et l'[ADR 0005 — Éclairage en vertex colors](../decisions/0005-eclairage-vertex-colors.md).

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

- `test/render/renderService.test.ts` — service de rendu substituable et absence d'appel WebGL par sa couche de test.
- `test/game/level/loader.test.ts` — reconversion des matériaux du glTF et conservation des propriétés nécessaires au rendu.
- `test/render/billboard.test.ts` et `test/render/viewmodel.test.ts` — contrats de matériaux et de géométrie des objets 3D affichés.

## Comment vérifier que ça marche

Lancez le jeu à la résolution d'origine et vérifiez que les arêtes du décor restent nettes lors de l'agrandissement. Dans une vue de sol ou de mur en biais, comparez `cassandre.filtrage("nearest")`, `"mipmap"` puis `"aniso"` pendant que la caméra bouge.

Comparez ensuite le préréglage d'affichage courant avec 640×360 et vérifiez le rapport de la caméra, les bandes éventuelles et l'alignement des overlays. La console permet aussi `cassandre.resolution(960, 540)` puis `cassandre.resolution()` pour revenir à l'origine.

Couverture ciblée : `pnpm test -- renderService loader billboard viewmodel`.
