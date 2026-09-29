---
title: Éclairage
tags: [technique]
status: brouillon
updated: 2026-09-28
---

# Éclairage

## Responsabilité

L'éclairage combine le rig global, les couleurs de sommet exportées avec le niveau et les lampes ponctuelles propres à un niveau. Cette page décrit comment ils atteignent les matériaux ; les choix de bake sont détaillés dans [les ADR](../decisions/0005-eclairage-vertex-colors.md) et le [pipeline de contenu](../3-architecture/pipelines-de-contenu.md).

## Fichiers

- `src/game/level/levels.ts` — déclare le mode d'éclairage et le ciel de chaque niveau.
- `src/game/session/lifecycle.ts` — applique le rig global et le fond au début de la partie.
- `src/game/level/loader.ts` — reconvertit les matériaux glTF, conserve `COLOR_0` et construit les `light_*`.
- `src/render/lightPool.ts` — limite les lampes actives selon la position de caméra.
- `src/render/ciel.ts` — charge et met en cache les cubemaps.
- `src/render/renderer.ts` — règle le filtrage et l'espace couleur des textures.
- `tools/blender/bake_vertex_lighting.py` — cuit l'éclairage en couleurs de sommets côté Blender.
- `tools/textures/generate_ciel.py` — génère les six images d'une cubemap.
- `src/game/devtools/consoleApi.ts` — expose l'inspection de lumière et le budget des lampes.
- `test/render/lightPool.test.ts` et `test/game/level/loader.test.ts` — couvrent la sélection des lampes et l'import.

## Où ça s'insère dans la boucle

`LevelDef` choisit un régime au début d'une partie. Le loader crée les lampes du glTF ; `LightPool` les active au taux d'affichage selon la caméra. Les objets sont ensuite dessinés par le `MeshLambertMaterial` de leur propre mesh. Le diagramme montre ces sources.

~~~mermaid
flowchart TD
  A["LevelDef.lighting"] --> B["Rig ambiant et soleil"]
  C["COLOR_0 du glTF"] --> D["MeshLambertMaterial"]
  E["light_* du glTF"] --> F["LightPool"]
  G["Position caméra"] --> F
  B --> D
  F --> D
  H["LevelDef.ciel"] --> I["scene.background"]
~~~

Le bake Blender appartient à la construction du contenu. Le runtime lit les couleurs exportées sans lancer de calcul d'éclairage différé. La sélection des lampes utilise la caméra de la frame ; elle ne dépend pas de la position interpolée d'un acteur calculée au pas fixe.

## Données et contrats

### Modes par niveau

`LevelDef.lighting` accepte trois modes ; sans valeur, le niveau utilise le mode temps réel.

| Mode | Lumière ambiante | Soleil directionnel | Contenu attendu |
|---|---:|---:|---|
| `temps-reel` | 0,4 | 0,8 | Éclairage global ; aucune couleur cuite requise. |
| `bake` | 1,0 | 0 | Couleurs de sommet portant l'éclairage final. |
| `hybride` | 0,18 | 0 | `light_*` ponctuelles et couleurs de sommet utilisées comme masque d'ombre. |

Ces valeurs sont définies dans `lifecycle.ts::applyLightRig`. Le mode est réglé par niveau pour préserver les matériaux et l'aspect choisis pour chaque contenu.

### Couleurs de sommet et Lambert

`GLTFLoader` lit `COLOR_0` comme attribut `color` et active le paramètre de vertex colors du matériau importé. Le loader remplace ce matériau par un `MeshLambertMaterial` et doit recopier ce paramètre. Si le flag disparaît, le mesh reste visible, mais le bake ne contribue plus comme prévu.

Dans le mode `bake`, la couleur de texture est modulée par la couleur de sommet sous une lumière ambiante à 1, sans soleil directionnel. Dans le mode `hybride`, les lampes donnent l'éclairage direct et la couleur de sommet assombrit les zones qui restent à l'ombre. Le décor importé reste Lambert par défaut ; le retrait de l'exclusivité [#5](../3-architecture/invariants.md#invariants-retirés) permet des effets TSL ciblés.

### Lampes du glTF

Chaque empty `light_*` devient une `THREE.PointLight` rattachée à la racine du niveau. Les extras sont optionnels : `color` en chaîne hexadécimale, `intensity`, `distance` et `decay`. Leurs défauts sont respectivement `#ffffff`, 8, 12 m et 2.

Le loader conserve toutes les lampes dans `LevelHandle.lights`. Le `LightPool` du niveau les trie par distance au bord de leur sphère d'influence (distance caméra-lampe moins portée), pas seulement par distance au centre. Une portée nulle est traitée comme illimitée. Les 48 meilleures restent visibles ; le reste est éteint. Si le niveau contient 48 lampes ou moins, le pool les laisse toutes allumées.

Le tri ne se répète que lorsque la caméra a bougé d'au moins 2 m depuis le dernier classement. Changer le budget invalide ce classement pour l'appliquer à la prochaine mise à jour. Le budget `null` allume toutes les lampes. Le pool est reconstruit avec le niveau courant, donc les lampes d'un niveau remplacé ne restent pas actives.

### Interpréter le classement

Le score « distance caméra moins portée » est négatif quand la caméra se trouve dans la sphère d'influence et positif quand elle se trouve à l'extérieur. Les lampes qui peuvent déjà atteindre la caméra passent donc avant celles dont la portée s'arrête plus loin.

La sélection ne mesure pas la contribution lumineuse de chaque lampe aux surfaces visibles. Le frustum et le shader s'occupent ensuite du dessin ; le pool borne seulement les lampes conservées actives autour de la caméra.

### Ciel

`LevelDef.ciel` contient le nom d'un sous-dossier de `public/assets/sky/`. `chargerCiel` lit les six faces `px`, `nx`, `py`, `ny`, `pz` et `nz` et met la texture en cache. `applyLightRig` l'affecte à `scene.background` ; l'absence d'un ciel rétablit le fond uni.

La cubemap est un fond de scène, pas un mesh du niveau. Elle n'a pas de matériau du monde et ne change donc pas la règle Lambert. Son filtrage est `NearestFilter` dans les deux directions, sans mipmaps.

### Inspection des contributions

L'apparence d'un mesh résulte de contributions distinctes : le rig ambiant et directionnel, la couleur portée par ses sommets et les lampes ponctuelles actives. Une lampe du niveau n'explique donc pas à elle seule une zone claire ou sombre.

`cassandre.lighting()` rapporte séparément les couleurs de sommet et les lampes du niveau. Utilisez-le pour distinguer une lampe absente d'une lampe que le pool a simplement éteinte, ou d'un mesh sans attribut `COLOR_0`.

`cassandre.lightBudget()` expose le total, le nombre actif et le budget courant. Un budget nul rallume toutes les lampes ; un changement de budget invalide le classement et est appliqué lors de la prochaine mise à jour du pool.

Le mode `null` sert à comparer une scène sans élagage et peut dépasser les limites d'un GPU particulier. Il est utile comme diagnostic temporaire ; le budget normal revient avec `cassandre.lightBudget(48)`.

### Limite matérielle du pool

Three.js transmet les lampes ponctuelles visibles au shader comme des uniformes. Le pool borne leur nombre afin d'éviter qu'un appareil atteigne sa limite de vecteurs d'uniformes et refuse de compiler le programme.

La valeur 48 est une limite active simultanée, pas un maximum de lampes que le niveau peut contenir. Toutes restent dans le niveau ; le pool change leur propriété de visibilité en fonction de la caméra et ne retire pas leur géométrie ni leurs données d'auteur.

Le rang se base sur la distance au bord de la portée de chaque lampe. Il ne calcule pas la luminosité réelle de chaque fragment ; une lampe vaste peut donc rester active avant une lampe plus proche mais de faible portée.

## Pièges

- Des couleurs de sommet absentes ou un `vertexColors` perdu produisent un niveau éclairé à plat sans erreur de chargement. Vérifiez l'attribut `COLOR_0` et le matériau final.
- Le mode hybride attend des lampes et une couleur de sommet qui porte une ombre. Une géométrie colorée mais sans ombres et sans éclairage global peut paraître trop uniforme.
- `visible: false` sur une lampe inspectée peut signifier que le pool l'a éteinte. Distinguez une lampe absente d'une lampe présente hors budget.
- Dépasser le budget de lampes peut empêcher un shader Lambert de compiler sur des GPU aux limites d'uniformes différentes. Le budget de 48 garde une marge ; son contexte est dans [Budget de rendu](budget-de-rendu.md).
- Une lumière `light_*` est une `PointLight`, non un mesh de luminaire. Le luminaire visible doit être une géométrie séparée.
- Une cubemap est composée de six faces orientées. Un nom ou un ordre de faces incorrect donne des coutures et des directions inversées.

## Tests

- `test/render/lightPool.test.ts` — score par portée, limite active, réévaluation et budget `null`.
- `test/game/level/loader.test.ts` — import des lampes et conservation des vertex colors du glTF.

## Comment vérifier que ça marche

Dans la console de développement, `cassandre.lighting()` distingue les lampes absentes des lampes éteintes par le pool et résume les lots rendus avec leurs couleurs de sommet. `cassandre.lightBudget()` lit le budget actif ; `cassandre.lightBudget(8)` le change et `cassandre.lightBudget(null)` rallume tout.

Passez par une pièce éclairée et vérifiez la lumière et les ombres à plusieurs positions de caméra. Testez la cubemap là où le ciel est visible ; revenez ensuite au menu puis chargez un niveau sans ciel pour confirmer le retour au fond uni.

Couverture ciblée : `pnpm test -- lightPool loader`.
