---
title: Le héros en billboard dans les miroirs
tags: [technique, rendu, personnage, sprites]
status: brouillon
updated: 2026-10-12
---

# Le héros en billboard dans les miroirs

## Responsabilité et frontières

Le reflet représente le héros par un sprite peint, vu sous huit directions.
Son visage et sa tenue reprennent le portrait du retour de stream : cheveux
bruns, barbe courte, sweat kaki, cordons écrus et tee-shirt rouille. Le
pantalon gris-vert et les bottines brunes prolongent le premier plan du jeu.

Le personnage apparaît uniquement dans les passes réfléchies. Il n'a aucun
collider et ne déclenche ni tir ni déplacement. Ses poses suivent les données
existantes du joueur et des armes ; aucune animation ne bloque une action.
Le corps articulé glTF précédent est remplacé par cette représentation.

## Fichiers

| Fichier | Responsabilité |
|---|---|
| `assets_src/hero_sprites/` | originaux des quatre planches peintes et prompts de génération |
| `tools/sprites/describe_hero.py` | mesure des cases et copie des originaux vers le runtime |
| `public/assets/characters/hero.json` | rectangles des cases et ancrages |
| `public/assets/characters/hero-*.png` | planches chargées par le jeu |
| `src/render/hero/loadHero.ts` | chargement initial, validation du manifeste et filtrage |
| `src/render/hero/heroTypes.ts` | contrats du rendu et du mouvement |
| `src/render/hero/heroReflection.ts` | choix de la pose, position et durée de vie |
| `src/render/hero/heroBillboard.ts` | direction de vue, UV et quad vertical |
| `src/render/environment/reflectionActors.ts` | visibilité limitée aux reflets |

## Place dans la boucle

`main.ts` charge les quatre textures et le manifeste à la frontière asynchrone
initiale. `PersistentEngine` détient le reflet pendant toute la durée de
l'onglet. Le pas fixe reste l'unique propriétaire du mouvement et des attaques.

`interpolateVisuals` transmet la position, la distance parcourue et les
horloges d'armes interpolées. Le yaw courant définit l'orientation du héros.
Les pieds restent à l'altitude de la capsule ; le sprite ne suit pas le
head bob de la caméra. La montée du saut vient du déplacement du joueur.

Le callback `onBeforeRender` du quad choisit la direction depuis la caméra
réellement utilisée pour cette passe. Dans un miroir, il s'agit de la caméra
virtuelle réfléchie. Choisir l'angle depuis la caméra subjective montrerait
le dos du héros à la place de son visage. Le callback actualise les UV et la
matrice du quad sans faire avancer les animations.

## Données et contrats

| Planche | Rangées |
|---|---|
| `hero-locomotion.png` | repos, premier appui, passage, second appui |
| `hero-equipment.png` | pistolet, pompe, pied-de-biche, détresse au repos |
| `hero-actions.png` | préparation du coup de pied, extension, frappe de pied-de-biche, geste de pompe |
| `hero-armed-walk.png` | deux appuis pour pistolet, pompe et pied-de-biche, puis un appui de détresse |

Chaque rangée possède huit directions : face, trois-quarts vers la gauche,
profil gauche, dos trois-quarts gauche, dos, dos trois-quarts droit,
profil droit et trois-quarts vers la droite. La case zéro est la vue de face.
Les planches représentent 152 cases au total. Le déplacement avec le pistolet
de détresse alterne son appui et sa posture au repos.

Les animations de marche et de course viennent de la distance parcourue.
Les horloges de `WeaponSystem.viewmodelClocks` et `viewmodelAnimationAt`
pilotent les équipements, frappes et gestes de pompe. Le coup de pied
partage `kickExtensionAt` avec le viewmodel. Un recul bref accompagne les
tirs du pistolet, du pompe et du pistolet de détresse.

Chaque pose dessine un corps complet avec ses mains et son équipement.
Le rendu utilise un seul quad de deux triangles, sans fusion de morceaux
issus de postures différentes. La hauteur est de 1,86 m pour des yeux à
1,60 m ; son échelle suit `moveConfig.eyeHeight`.

Le quad tourne seulement autour de l'axe vertical. Le matériau Lambert
utilise `alphaTest: 0.5`, `transparent: false`, `depthWrite: true` et un
minimum de lumière de 0,32. L'agrandissement reste nearest ; le filtrage de
réduction suit `configureRetroTexture`.

Les originaux générés ne sont pas retouchés par l'outil de description.
Leurs marges transparentes définissent les rectangles des cases ; l'ancrage
horizontal se mesure sur la tête pour qu'une arme étendue ne décale pas le
corps. Chaque instance possède ses transformations UV, sans modifier la
texture partagée.

## Pièges

- La direction dépend de chaque caméra de miroir, pas de la dernière caméra
  de rendu du monde. Deux miroirs doivent pouvoir choisir deux vues distinctes.
- Le quad reste vertical quand le joueur regarde vers le sol ou le plafond.
- Les poses complètes évitent les mains doublées et les raccords de taille
  produits par un mélange de jambes et de buste provenant d'autres dessins.
- La silhouette varie entre les cases. L'élagage utilise une désactivation
  du frustum culling pour ce personnage unique.
- Le démontage libère les clones de texture et les quatre atlas, sans toucher
  aux géométries du viewmodel.

## Tests

Il n'existe pas de suite automatisée dédiée à ce reflet. La revue visuelle
se fait dans les sanitaires et sur une présentation temporaire des poses.
Les captures et pages de revue restent dans `renders/`, ignoré par Git.

## Comment vérifier

Pour décrire de nouveau les planches, utiliser Python avec Pillow :

```sh
python3 tools/sprites/describe_hero.py
```

L'outil écrit les copies PNG et `hero.json` dans le dossier runtime.
Les prompts exacts et leur outil de génération sont consignés dans
`assets_src/hero_sprites/generation.json`. Les originaux doivent rester
versionnés : ils ne se régénèrent pas à l'identique.

Dans les sanitaires du magasin, comparer le reflet au portrait du direct.
Changer d'arme, marcher, sauter et attaquer, puis regarder les miroirs avec
un angle latéral. Le visage représente actuellement le héros sain ; les
variantes de blessure restent celles du portrait du HUD.

Voir aussi : [Chargement de niveau](chargement-de-niveau.md#miroirs),
[équipements des sanitaires](equipements-sanitaires.md) et
[sprites et viewmodel](sprites-et-viewmodel.md).
