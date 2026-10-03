---
title: Systèmes de niveau
tags: [technique]
status: brouillon
updated: 2026-10-03
---

# Systèmes de niveau

## Responsabilité

Les systèmes de niveau font vivre les objets décrits dans le glTF : portes, objets utilisables, props mobiles, vitres, sanitaires, écrans et vues fixes. Le loader construit les données et Rapier résout les collisions ; ces systèmes appliquent les règles de partie et émettent les événements de présentation.

## Fichiers

- `src/game/level/loading/loader.ts` — fabrique les descripteurs depuis les préfixes glTF et leurs extras.
- `src/game/level/doors/doors.ts` — état et mouvement des portes.
- `src/game/level/interactions/interactive.ts` — proximité, touche E, ramassages à la marche et dispatch des interactions.
- `src/game/level/props/props.ts` — objets dynamiques, dégâts et contenu lâché.
- `src/game/level/interactions/vitres.ts` — points de vie, casse et lots de vitrages.
- `src/game/level/sanitaires/sanitaires.ts` — sanitaires intacts/cassés et jet d'eau.
- `src/game/level/interactions/ecrans.ts` — animations d'écran et casse.
- `src/game/level/interactions/cameras.ts` — sélection de caméras fixes et sortie de leur vue.
- `src/game/level/interactions/food.ts` — catalogue des aliments et de leur valeur de soin.
- `src/game/level/navigation/levelSpaces.ts` — schéma du manifeste des espaces et recherche de l'espace qui contient un point.
- `src/game/level/loading/loadLevelSpaces.ts` — charge le manifeste des espaces avec le niveau.
- `src/game/session/player/placeLines.ts` — réplique de première visite d'un espace.
- `src/game/session/spawning.ts` — crée une instance de chaque système au commit du niveau.
- `src/game/loop/updateGameplay.ts`, `stepPhysics.ts`, `interpolateVisuals.ts` et `updateFx.ts` — appels fixes, synchronisation physique, interpolation et retours visuels.
- `src/render/environment/useObjectCulling.ts` — élague les objets utilisables et les lots de sanitaires éloignés.
- `docs/6-reference/conventions-nommage.md` — préfixes, extras et conventions Blender.

## Où ça s'insère dans la boucle

Les systèmes sont reconstruits avec le niveau courant. Ils lisent les impacts du pas fixe ; `updateFx` consomme ensuite les événements de casse et joue les effets. Le diagramme sépare les règles du pas fixe de leur présentation.

~~~mermaid
flowchart TD
  A["LevelHandle"] --> B["Systèmes de partie"]
  C["Input et tirs du pas fixe"] --> B
  B --> D["Rapier : physique et colliders"]
  B --> E["État et événements"]
  E --> F["updateFx : débris, sons, eau"]
  G["Interpolation d'affichage"] --> H["Pose visible"]
  D --> G
  B --> G
~~~

`loadGltfLevel` construit les systèmes dans `prepare`, avant de publier leurs références dans `GameSession`. Un hot reload remplace le handle et ses systèmes ensemble. L'ancien état de casse, le cooldown d'un sanitaire, les positions des props et la vue caméra ne sont pas copiés dans le nouveau niveau.

Au pas fixe, `InteractionSystem` traite d'abord l'objet `use_*` le plus proche à portée. Le même appui E peut ensuite viser un sanitaire ou actionner une porte manuelle si aucun objet précédent ne l'a consommé. Les soins, munitions et armes au sol se ramassent par proximité, sans appui E.

Les armes publient des `HitEvent`. `PropSystem`, `VitreSystem`, `SanitaireSystem` et `EcranSystem` les lisent avant le pas Rapier. Leurs curseurs évitent de traiter deux fois le même impact si une frame d'affichage contient plusieurs pas fixes. Les managers ennemis transmettent aussi les impacts aux cibles cassables prévues par leur contrat.

Les poses de portes et de props sont décidées au pas fixe. `stepPhysics` mémorise leurs poses précédentes, Rapier avance le monde, puis les props recopient la pose physique. `interpolateVisuals` interpole les meshes avant le rendu. Les files d'événements de casse sont lues et vidées une fois par frame d'affichage par `updateFx`.

## Données et contrats

### Interactions

Le loader transforme un mesh `use_*` en `UseObject` avec une position monde et une portée de 2 m. `InteractionSystem.update` choisit le plus proche ; un seul objet reçoit l'appui. La liste d'objets doit être relue depuis `LevelSession.current` à chaque pas, car le hot reload remplace ses meshes.

Les propriétés personnalisées donnent le comportement déclaratif : `target` nomme une porte, `card` donne une carte, `requires` en exige une, `message` fournit un retour de porte libre, `soin` et `munitions` indiquent un ramassage, `aliment` choisit une valeur de soin et `cameras` liste les points de vue. Les actions spécifiques historiques `use_pa_mic`, `use_toilet` et la sortie de niveau passent par des callbacks fournis par l'appelant.

Les objets déjà consommés sont suivis par référence de mesh. Un refus d'accès ou une porte encore fermée reste réessayable ; une carte ou un ramassage accepté masque l'objet et le consomme. Un objet de soin ou d'arme reste au sol si l'inventaire ne peut rien recevoir.

### Portes

Chaque `door_*` possède un corps Rapier fixe à la pose fermée. `DoorSystem` déplace seulement le mesh et désactive le collider dès le début de l'ouverture ; il ne le réactive qu'à la fermeture complète. Si un acteur chevauche le vantail au moment de fermer, la porte repart en ouverture.

Les quatre mouvements déclarés par `mouvement` sont `battant`, `coulisse`, `monte` et `descend`. Les extras optionnels règlent le sens, la course, la durée, le groupe et l'ouverture automatique. `auto: true` ouvre devant joueur et ennemis ; `auto: "ennemis"` laisse le joueur manœuvrer à la main tout en laissant les ennemis traverser le graphe. `manuelle: true` permet les deux sens à E ; `manuelle: "fermer"` ne permet que la fermeture.

Les portes d'un même `groupe` s'ouvrent ensemble. `batchDoorMeshes` regroupe les vantaux par matériau quand plusieurs partagent le même. Les géométries conservent un index par porte pour synchroniser leur pose animée avec le lot rendu.

### Props et cibles cassables

Un `prop_*` porte un corps dynamique et un collider dans le groupe `PROP`. Les extras `masse`, `pv`, `matiere` et `contenu` configurent son comportement. Sans `pv`, il est poussable mais indestructible. La destruction désactive le corps/collider et masque le mesh ; `updateFx` joue les débris et le son correspondant. `contenu` peut faire apparaître des aliments, dont les positions sont tirées par un flux déterministe.

Une `vitre_*` solide utilise un collider cuboid fixe, double face et sans écriture de profondeur. `solide: false` supprime le collider ; c'est le cas des vitrages de plafond qui ne doivent pas gêner la navigation. `pv` rend la vitre cassable par les tirs du joueur ; les tirs ennemis peuvent casser les cibles reconnues par collider handle. `givre: true` ajoute un effet de givre à la casse.

Un `sanitaire_*` doit porter `sorte: "cuvette"` ou `sorte: "urinoir"`. Son collider reste fixe ; `pv` règle la casse par le joueur. Les systèmes conservent l'état cassé et l'origine du jet d'eau, tandis que la session porte le délai de soulagement. Un sanitaire cassé peut être visé à travers le volume du jet, sous réserve qu'aucun mur proche ne masque la visée.

Un `ecran_*` déclare `chaine` (`journal`, `pub`, `mire`, `foot` ou `cctv`) et éventuellement `pv`. Il possède son propre collider cuboid fixe. `EcranSystem` avance son animation avec le dt du pas fixe et réécrit les UV de sa plage de sommets ; à la casse il passe à la cellule de sprite prévue pour cet état.

Vitres, sanitaires et écrans sont fusionnés dans des lots dédiés tout en gardant les plages de sommets propres à chaque instance. La casse ou le changement d'image ne demande donc pas un mesh de rendu séparé par objet.

### Vue par caméra

Un `cam_*` est un empty dont la position et l'orientation monde sont figées au chargement. Une console `use_*` portant l'extra `cameras` fait défiler sa liste dans `CameraViewSystem`. Un déplacement ou un changement volontaire de visée quitte la vue au pas suivant ; le joueur n'est jamais immobilisé. `src/render/overlays/cameraView.ts` dessine l'habillage 2D correspondant.

### Espaces du niveau

Un niveau qui déclare `spaces: true` dans `src/game/level/catalog/levels.ts` livre un manifeste `<niveau>.espaces.json` à côté de son `.glb`. `tools/level_v2/espaces_jeu.py` le produit depuis le plan de masse : une boîte par espace, dans le repère du jeu, avec un mètre de marge en hauteur. Le manifeste se charge pendant la préparation du niveau, à la frontière asynchrone ; s'il manque ou ne se décode pas, le niveau reste jouable sans répliques de lieu.

`levelSpaceAt` rend l'identifiant de l'espace qui contient le joueur. Les boîtes sont triées par emprise au sol croissante : quand deux se recouvrent, la plus petite gagne.

`updatePlaceLine` tourne à la fin du pas fixe. Il propose la réplique de l'espace (`PLACE_LINES` dans `src/game/session/presentation/heroLines.ts`) selon quatre règles :

- le joueur a passé 1,5 s de jeu dans l'espace ;
- aucun ennemi n'est en alerte, en poursuite, en attaque ou sonné — sinon la réplique est abandonnée pour cette visite ;
- tant que le délai entre répliques la refuse, elle est retentée à chaque pas, jusqu'à la sortie de l'espace ;
- une fois dite, elle ne revient plus de la partie.

Ces répliques sont en texte seul (`textOnly`) : sans sous-titres, elles ne sont pas dites.

### Script de niveau

Un `trig_*` lance un scénario ou désigne une sous-zone ([ADR 0037](../decisions/0037-script-de-niveau.md)).

- `src/game/level/scripting/levelScript.ts` — le moteur, une fonction pure : déclencheurs franchis une fois par partie, étapes exécutées dans l'ordre après leur délai de gameplay.
- `src/game/session/progression/levelEvents.ts` — les scénarios, nommés par la propriété `evenement`.
- `src/game/session/progression/levelScriptSetup.ts` — lit les `trig_*` au chargement et signale les incohérences en console.
- `src/game/session/progression/levelScriptActions.ts` — exécute une action : réplique, annonce, réveil d'un groupe de `spawn_suit_*`, changement de chaîne d'un groupe d'`ecran_*`.

`updateLevelScript` tourne en fin de pas fixe, juste avant les répliques de lieu : une réplique de scénario passe avant celle de la pièce. Un `trig_*` qui porte `replique` rejoint les espaces du niveau et suit leurs règles.

Les `trig_*` du niveau v2 sont posés par `tools/blender/refresh_story_triggers.py`.

### Lecture de l'appui E

L'interaction reçoit le front montant de l'appui, pas l'état maintenu de la touche. Un appui donne donc une seule tentative, même si plusieurs pas fixes sont exécutés dans une frame navigateur.

La proximité est mesurée depuis le centre de la capsule du joueur jusqu'à la position monde de l'objet. Le nom du candidat le plus proche est recalculé même sans appui et exposé pour inspection ; le HUD ne construit pas encore d'invite d'interaction à partir de cette valeur.

## Pièges

- Le premier `use_*` à portée consomme E. Le même appui ne peut pas ouvrir ensuite la porte voisine ; cette priorité évite qu'un bouton et sa porte réagissent ensemble.
- Les armes, les soins et les munitions ne font pas partie de la recherche E. Les inclure leur ferait voler l'appui d'une porte ou d'un sanitaire.
- Les événements de tir sont relus par plusieurs systèmes. Chacun garde son curseur ; ne videz pas la file avant que tous les consommateurs aient traité le pas.
- Les files de présentation sont vidées à la frame, après tous leurs lecteurs. Un `clearFrameEvents` prématuré perd les sons ou débris associés à une casse.
- Un prop utilise `PROP`, séparé de `WORLD`. Les rayons ennemis et le graphe de navigation filtrent le monde statique ; un prop poussé ne doit pas laisser une obstruction fantôme.
- Un collider sous une vitre de plafond est un faux sol pour le bake de navigation. Déclarez `solide: false` quand la vitre est hors du parcours.
- Les lots spéciaux ne remplacent pas leurs systèmes d'état : ils gardent une surface rendue adressable, pas les PV ou la progression de casse.

## Tests

- `test/game/level/doors/doors.test.ts` — mouvements, groupes, collisions, ouvertures automatiques/manuelles et lots de vantaux.
- `test/game/level/props/props.test.ts` — poussée, dégâts, destruction, interpolation et contenu déterministe.
- `test/game/level/interactions/vitres.test.ts` et `test/game/level/sanitaires/sanitaires.test.ts` — colliders, casse, événements et visée du jet.
- `test/game/level/interactions/ecrans.test.ts` — chaînes, animation, UV et casse.
- `test/game/level/interactions/cameras.test.ts` — cyclage des caméras et sortie de vue par mouvement.
- `test/game/level/interactions/pickups.test.ts` — ramassages à la marche et objets qui restent si le joueur ne peut rien prendre.
- `test/game/level/loading/loader.test.ts` — construction des descripteurs et lecture des extras.
- `test/game/level/scripting/levelScript.test.ts` et `test/game/session/progression/levelScriptSetup.test.ts` — ordre et délais des scénarios, déclenchement unique, validation des déclencheurs.
- `test/game/level/navigation/levelSpaces.test.ts` et `test/game/session/player/placeLines.test.ts` — recherche d'espace, manifeste livré et règles des répliques de lieu.

## Comment vérifier que ça marche

Dans une partie, utilisez `cassandre.level.stats()` pour confirmer les nombres d'objets, puis `cassandre.doorSystem.liste()`, `cassandre.props.liste()`, `cassandre.vitres.liste()` ou `cassandre.sanitaires.liste()` pour voir l'état courant. Les méthodes `ouvrir(nom)` et `casser(nom)` de ces outils provoquent un événement sans viser l'objet en jeu.

Pour vérifier une interaction, placez deux objets `use_*` à portée et confirmez que seul le plus proche reçoit E. Pour une casse, comparez l'état et les événements avant/après l'impact ; vérifiez aussi le rendu, les débris et le son dans la frame suivante.

Couverture ciblée : `pnpm test -- doors props vitres sanitaires ecrans cameras pickups loader`.
