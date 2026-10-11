---
title: Le corps du héros dans les miroirs
tags: [technique, rendu, personnage]
status: brouillon
updated: 2026-10-11
---

# Le corps du héros dans les miroirs

## Responsabilité et frontières

Le héros possède un corps 3D utilisé par les miroirs des sanitaires.
Cette représentation suit les données du joueur et des armes. Elle ne possède
aucun collider, ne déclenche aucun tir et ne modifie aucun déplacement.

La vue subjective garde ses mains et ses armes. Le corps complet apparaît
uniquement dans les passes réfléchies des miroirs.

Le modèle reprend le portrait du retour de stream : cheveux bruns, barbe courte,
sweat kaki ouvert sur un tee-shirt rouille et cordons écrus. Le pantalon et
les bottines reprennent les couleurs du modèle de coup de pied.
Le visage utilise un extrait de `public/assets/ui/hero-ambient.png`.

## Fichiers

| Fichier | Responsabilité |
|---|---|
| `tools/blender/build_hero.py` | géométrie originale, squelette, clips, export et rendus |
| `assets_src/blender/hero.blend` | source Blender articulée et pistes d'animation |
| `assets_src/blender/hero_face.png` | texture du visage extraite du portrait existant |
| `public/assets/characters/hero.glb` | modèle et animations chargés par le jeu |
| `src/render/hero/loadHero.ts` | chargement initial et conversion des matériaux Lambert |
| `src/render/hero/heroTypes.ts` | données de présentation et contrat de mouvement |
| `src/render/hero/heroAnimation.ts` | échantillonnage des clips et répartition de la visée |
| `src/render/hero/heroArms.ts` | articulation des bras vers les prises des armes à feu |
| `src/render/hero/heroReflection.ts` | position du corps, équipement et durée de vie |
| `src/render/environment/reflectionActors.ts` | visibilité limitée aux reflets |
| `docs/assets/hero-mirror.html` | revue interactive du modèle et des sanitaires |

## Place dans la boucle

`main.ts` charge le modèle à la frontière asynchrone de démarrage, avec les
sprites et les armes. `PersistentEngine` détient le corps pour toute la durée
de l'onglet, comme le viewmodel et les géométries d'armes.

L'horloge de respiration est remise à zéro au démarrage d'une partie. Elle
avance dans `updateGameplay`, avec le delta de gameplay affecté par le hitstop.
`snapshotPrevious` mémorise la valeur précédente.

Dans `interpolateVisuals`, la position et la distance parcourue sont interpolées
entre les deux pas fixes. La rotation utilise directement le yaw et le pitch
courants. Les pieds restent à l'altitude de la capsule ; le corps ne reprend
pas le déplacement artificiel du head bob de la caméra.

Les actions Three.js sont échantillonnées à une date précise, puis évaluées
avec `AnimationMixer.update(0)`. Aucun delta mural ne fait avancer les clips
dans le jeu. Le chemin de rendu reste dans `runGameplaySync`.

## Données et contrats

Le modèle mesure environ 1,86 m avec les cheveux. Le rendu ajuste son échelle
pour placer les yeux à `moveConfig.eyeHeight`. Le squelette comporte quinze
os ; le corps représente environ 4 500 triangles.

Les clips sont séparés par région du squelette au chargement :

| Clips | Région et usage |
|---|---|
| `idle`, `walk`, `run`, `jump` | bassin, jambes, buste et tête |
| `hold_none`, `hold_melee`, `hold_pistol`, `hold_shotgun`, `hold_flare` | posture des bras selon l'arme |
| `fire_melee`, `fire_pistol`, `fire_shotgun`, `fire_flare` | gestes d'attaque |
| `kick` | jambe droite, superposée au déplacement |

La phase des pas vient de la distance parcourue. Marche et course se mélangent
avec le facteur de course existant. Le saut suit `isGrounded`.
Sans arme, les bras balancent en opposition aux jambes ; les prises restent
stables lorsqu'une arme est équipée.
Le coup de pied utilise l'enveloppe `kickExtensionAt`, commune au viewmodel.

Les horloges de `WeaponSystem.viewmodelClocks` pilotent les attaques.
`viewmodelAnimationAt` décide de l'arme montrée pendant une transition et du
geste de pompe. Aucun second délai ne conditionne une attaque.

Pour les armes à feu, deux segments de bras rejoignent des prises définies
dans le repère du modèle. Les longueurs viennent du squelette. Les coudes
restent orientés vers l'extérieur et vers le bas ; les poignets redressent
les armes. La main de soutien du pompe suit le mouvement du fût.
Le recul et la visée déplacent ces prises sans agir sur les raycasts.

Les armes visibles sont les géométries `world*` de `WeaponModels`, avec leur
matériau partagé. Les poignées compensent le centrage des modèles au sol.
Le personnage ne possède pas de copies jetables de ces ressources.

Les matériaux du corps sont Lambert, avec un minimum de lumière de 0,32.
Le visage conserve l'agrandissement nearest et les mipmaps pour la réduction.
La préparation des miroirs place temporairement le personnage devant chaque
surface pour préparer aussi les variantes de shader des meshes articulés.

## Pièges

- Le héros Blender regarde vers −Y, donc vers +Z après export glTF. Le rendu
  ajoute un demi-tour au yaw du joueur, qui regarde vers −Z au repos.
- Dans Blender, les pistes NLA sont muettes au repos ; leurs strips restent
  actifs pour que l'export évalue réellement chaque animation.
- Les UV du visage portent le même nom sur toutes les pièces avant fusion,
  sinon Blender peut les perdre lors du `join`.
- La boîte de repos du mesh ne couvre pas un pied lancé. Les meshes articulés
  ne sont pas élagués avec cette boîte.
- Le corps doit rester hors des lots de décor. Ses matériaux et son squelette
  ne dépendent pas de la durée de vie d'un niveau.
- Le démontage du corps libère ses propres ressources, jamais les géométries
  et le matériau d'arme empruntés au moteur.

## Tests

Il n'existe pas de suite automatisée dédiée au reflet du héros.
La [revue interactive](../assets/hero-mirror.html) utilise la classe de rendu
du jeu pour montrer les postures, les mouvements et les attaques.
Son second cadre charge le magasin et place le joueur devant un vrai miroir.

Rendus conservés : [modèle Blender](../assets/hero-mirror/model.png),
[visage](../assets/hero-mirror/face.png),
[silhouette](../assets/hero-mirror/silhouette.png) et
[reflet équipé dans les sanitaires](../assets/hero-mirror/reflection.png).

## Comment vérifier

Lancer la recette depuis une session Blender neuve :

```bash
blender -b --factory-startup -P tools/blender/cassandre_cli.py -- hero_model
```

La recette sauvegarde la source, exporte le GLB et rend cinq vues dans
`renders/hero/`. Elle refuse de remplacer une autre source Blender ouverte.

Ouvrir la revue, comparer le modèle au portrait et utiliser les boutons de
mouvement et d'équipement. Dans les sanitaires, « Face au miroir » cadre le
premier lavabo. Les boutons du second cadre changent l'arme ou déclenchent
un court déplacement dans la session de revue. Cliquer dans le jeu permet
de viser et d'attaquer avec les commandes habituelles.

Les informations de santé du retour de stream restent celles du portrait.
La texture du corps représente pour l'instant le visage au repos.

Voir aussi : [Chargement de niveau](chargement-de-niveau.md#miroirs),
[rendu](rendu.md) et [documentation AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html).
