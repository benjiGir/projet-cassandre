---
title: Chargement de niveau
tags: [technique]
status: brouillon
updated: 2026-10-03
---

# Chargement de niveau

## Responsabilité

Le loader transforme un fichier glTF exporté en un niveau utilisable : rendu Three.js, corps Rapier, points de spawn et descripteurs que les systèmes de jeu prennent en charge. Il ne construit pas le niveau dans Blender et ne décide pas des règles des portes, des props ou des interactions.

`LevelSession` coordonne le chargement asynchrone et le remplacement d'un niveau. Le registre et la construction d'une partie sont décrits dans [Cycle de vie](../3-architecture/cycle-de-vie.md) ; l'auteur du contenu est décrit dans [Pipelines de contenu](../3-architecture/pipelines-de-contenu.md).

## Fichiers

- `src/game/level/loader.ts` — acquisition Scope, classement des nœuds et résultat `LevelHandle`.
- `src/game/level/levelDiagnostics.ts` — erreurs, avertissements et messages.
- `src/game/level/levelExtras.ts` — noms Blender et lecture des propriétés.
- `src/game/level/levelColliders.ts` — géométrie monde et fabriques Rapier.
- `src/game/level/levelObjects.ts` — spawns et objets spécialisés.
- `src/game/level/levelPresentation.ts` — conversion des matériaux et lumières.
- `src/game/level/levelResources.ts` — propriétaire de la racine, des corps et des ressources GPU.
- `src/game/level/hotReload.ts` — ouvre la `LevelSession`, sérialise les remplacements et garde l'ancien niveau en cas d'échec.
- `src/game/level/mergeStaticDecor.ts` — fusionne le décor statique en lots de dessin spatiaux.
- `src/game/level/doors.ts`, `props.ts`, `vitres.ts`, `sanitaires.ts` et `ecrans.ts` — regroupent les géométries spéciales et exposent leurs contrats au loader.
- `src/game/level/levels.ts` — registre des niveaux, du fichier glTF, du mode d'éclairage et du ciel.
- `src/game/session/spawning.ts` — prépare les systèmes dérivés et le graphe de navigation avant le commit.
- `src/physics/world.ts` — monde Rapier et groupes de collision.
- `docs/6-reference/conventions-nommage.md` — contrat auteur des préfixes et extras.

## Où ça s'insère dans la boucle

Le chargement et la préparation du candidat sont asynchrones. Le jeu ne lit que le niveau courant pendant ses pas fixes ; il ne suspend jamais un pas pour attendre un fichier. Le diagramme montre le chemin de construction et le remplacement transactionnel.

~~~mermaid
flowchart TD
  A["LevelDef"] --> B["loadGltfLevel"]
  B --> C["LevelSession"]
  C --> D["loadLevel : réseau et GLTFLoader"]
  D --> E["buildLevelFromGltfEffect"]
  E --> F["parcours et classement des nœuds"]
  F --> G["colliders et LevelHandle"]
  F --> H["conversion des matériaux et fusions"]
  G --> I["prepare : systèmes et navigation"]
  H --> I
  I --> J["commit synchrone"]
  J --> K["libération de l'ancien niveau"]
~~~

`src/game/level/loader.ts::loadLevel` appelle `GLTFLoader.loadAsync` via `GameRuntime.runPromise`. La progression ne remonte que si la réponse fournit un `Content-Length` exploitable. `buildLevelFromGltf` reçoit un glTF déjà parsé et reste synchrone ; il sert aussi aux tests sans réseau.

`src/game/session/spawning.ts::loadGltfLevel` installe une fonction `prepare`.
Elle construit les systèmes du niveau, cuit le graphe de navigation et
amorce le shader des douches pendant que le candidat est isolé.
`LevelSession` attend cette préparation, qui peut être asynchrone, puis
applique les changements de session par un commit synchrone.
L'attente conserve les gardes d'annulation et la restauration du niveau
précédent en cas d'erreur. Voir [Préparation des douches](rendu.md#préparation-des-douches).

Dans une frame, `updateGameplay` relit `LevelSession.current` pour les objets qui peuvent changer après un hot reload. Les systèmes mettent à jour leur état au pas fixe ; `interpolateVisuals` et `updateFx` présentent le résultat au taux d'affichage. Voir [Boucle et temps](../3-architecture/boucle-et-temps.md).

## Données et contrats

### Parcours du glTF

Le loader ajoute d'abord la racine du glTF à la scène et actualise toute la hiérarchie `matrixWorld`. Il parcourt ensuite les nœuds et lit le nom Blender conservé par `GLTFLoader` dans `userData.name`. Un nœud est classé une seule fois : le préfixe est testé avant le cas générique.

Chaque mesh est reconverti en `MeshLambertMaterial` avant son routage. Le loader conserve la couleur, la texture diffuse, la transparence et l'attribut de couleur de sommet ; les autres propriétés de matériau PBR ne font pas partie du rendu du jeu. Les effets ciblés peuvent ensuite remplacer ce matériau par du TSL. Le filtrage conserve l’[invariant #4](../3-architecture/invariants.md).

| Nœud glTF | Résultat du loader |
|---|---|
| `col_box_*`, `col_hull_*`, `col_mesh_*`, `col_*` | Collider statique Rapier ; le cas générique garde la compatibilité avec les anciens niveaux. |
| `spawn_player`, `spawn_suit_*`, `spawn_director_*` | Positions monde ; le spawn joueur porte aussi le yaw. |
| `trig_*` | Capteur cuboid fixe dans le groupe `TRIGGER`, plus un résumé `TriggerVolume`. |
| `door_*` | `DoorInfo` avec corps fixe fermé, collider, pose initiale, extras et éventuel clip glTF. |
| `prop_*` | `PropInfo` avec corps dynamique et collider propres ; il n'y a pas de `col_*` jumeau. |
| `vitre_*`, `sanitaire_*`, `ecran_*` | Descripteurs spécialisés. Chacun construit ses colliders selon son contrat. |
| `use_*`, `secret_*` | Objet ou volume logique. Les secrets deviennent des boîtes englobantes monde. |
| `light_*`, `cam_*` | Lumière ponctuelle ou point de vue fixe à partir d'un empty Blender. |
| Mesh sans préfixe reconnu | Mesh rendu tel quel, sans collider. |

Les formes des colliders statiques sont choisies selon le nom : cuboid pour `col_box_*`, convex hull pour `col_hull_*`, trimesh pour `col_mesh_*`. Un `col_*` générique détecté comme boîte alignée devient aussi un cuboid. Un hull dégénéré retombe sur un trimesh avec avertissement.

`trig_*` doit être une boîte alignée dans sa géométrie locale ; il devient un capteur cuboid orienté par le transform monde. Son `TriggerVolume.min/max` est un résumé axis-aligned destiné à l'inspection et aux tests. Les règles d'extraction et les formes sont détaillées dans [Physique](physique.md).

### Résultat public

`LevelHandle` rassemble la racine Three.js, le glTF chargé, les spawns, triggers, portes, objets `use_*`, secrets, props, vitres, sanitaires, écrans, caméras, lampes et statistiques. Les systèmes spécialisés reçoivent ces listes lors de la préparation ; ils ne sont pas enfouis dans le loader.

`LevelStats` compte les colliders par forme, les spawns et volumes logiques, les objets spécialisés, les lampes et les lots de dessin. `cassandre.level.stats()` retourne ces statistiques pour le niveau courant. Le compteur de meshes sans préfixe est relevé avant la fusion du décor.

`use_*` porte ses propriétés personnalisées dans les `extras` du glTF. Le loader convertit les valeurs connues en champs typés de `UseObject` : cible, carte donnée ou exigée, soin, munitions, aliment et liste ordonnée de caméras. Les détails et les valeurs acceptées figurent dans [Conventions de nommage](../6-reference/conventions-nommage.md).

Les propriétés manquantes ont souvent un sens : `pv` absent rend un objet indestructible ; `target` absent donne `null`. Une valeur présente mais inconnue produit un avertissement explicite et un repli documenté. Les défauts de géométrie critiques, par exemple un trigger non cubique, sont journalisés et l'objet concerné est ignoré ; un échec de téléchargement ou de parsing fait échouer l'essai de chargement.

### Fusions et durée de vie

Le décor statique fusionne uniquement si le matériau, les attributs de géométrie et la cellule de 48 m correspondent. Les vitres, sanitaires, écrans et vantaux ont chacun un regroupement dédié pour garder leurs plages de sommets ou leurs poses adressables. Les détails de coût sont dans [Budget de rendu](budget-de-rendu.md).

`LevelHandle.suspend()` masque la racine et désactive temporairement ses corps en mémorisant leur état exact. `dispose()` retire la racine, les corps Rapier et les ressources GPU du niveau. Les ressources marquées `pickupResourcesOwned` sont empruntées à la session et sont libérées par son propriétaire après l’arrêt du niveau. La fermeture du `Scope` garantit qu'une libération répétée reste sûre.

Au rechargement, `LevelSession` charge un candidat avant de suspendre l'ancien niveau. Si `prepare` ou le chargement échoue, le candidat est libéré et l'ancien est restauré. Si tout réussit, le commit remplace ensemble le handle et les systèmes ; l'ancien est libéré ensuite. Les demandes concurrentes sont coalescées et protégées par un sémaphore.

Le sondage HTTP `HEAD` est compilé uniquement en développement (`import.meta.env.DEV`). L'appel explicite `reload()` reste possible dans les deux builds. L'arrêt interrompt le sondage, attend un chargement en cours et libère le niveau courant.

### Préparation avant commit

Le candidat et ses systèmes restent isolés pendant la préparation. Le commit publie le nouveau handle et les références de session ensemble ; un échec ne laisse donc pas une moitié de niveau installée.

Les requêtes de remplacement concurrentes sont sérialisées et coalescées. Une succession rapide d'exports ne construit pas simultanément plusieurs candidats destinés à remplacer le même niveau.

## Pièges

- Le nom exposé par Three.js peut différer du nom saisi dans Blender. Toute classification doit passer par `blenderName`, qui relit le nom brut dans `userData`.
- Rapier exige un rafraîchissement de ses requêtes de scène avant un raycast ou le bake du graphe juste après la création des colliders. `spawning.ts` appelle `PhysicsWorld.refreshSceneQueries()` avant la cuisson ; voir [Physique](physique.md).
- Une animation glTF n'est pas lancée automatiquement par le loader. Pour une porte, le mouvement vient de `DoorSystem` ; le clip n'est qu'un élément exposé dans `DoorInfo`.
- Un objet mobile ou interactif ne rejoint pas le décor fusionné. Le déplacer après une fusion ou le réutiliser comme décor statique invalide le contrat.
- `useObjects` et les autres tableaux du niveau remplacé ne doivent pas être mis en cache par un système persistant. Relisez `LevelSession.current` pour ne pas garder des meshes déjà libérés.
- Le garde de `GameRuntime.runSync` interdit d'introduire une promesse dans le pas fixe ou le rendu. Le chargement réseau reste à la frontière `runPromise`/`runFork`, jamais dans `updateGameplay`.

## Tests

- `test/game/level/loader.test.ts` — préfixes, extras, formes de colliders, erreurs rattrapées et statistiques produites.
- `test/game/level/hotReload.test.ts` — commit, échec, annulation, coalescence et conservation de l'ancien handle.
- `test/game/level/mergeStaticDecor.test.ts` — clé de matériau, attributs, cellules et meshes exclus de la fusion.
- `test/game/level/pathfinding.test.ts` — cuisson du graphe à partir du monde physique préparé.

## Comment vérifier que ça marche

Lancez le jeu, puis lisez `cassandre.level.stats()` après le chargement du niveau. Comparez les nombres de colliders, spawns, objets et lots avec les contrôles faits sur le glTF ; les avertissements `[level]` identifient un contrat d'objet incorrect.

Pour vérifier le remplacement en développement, exportez un niveau valide depuis Blender, puis un second export avec un changement visible. Le niveau courant doit se remplacer sans respawn du joueur. Faites aussi un export temporairement invalide : l'ancien niveau reste affiché et la console signale l'échec.

Couverture ciblée : `pnpm test -- loader hotReload mergeStaticDecor pathfinding`.
