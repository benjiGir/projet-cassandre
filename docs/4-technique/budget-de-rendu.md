---
title: Budget de rendu
tags: [technique]
status: brouillon
updated: 2026-10-03
---

# Budget de rendu

## Responsabilité

Cette page explique comment le runtime contrôle le coût de dessin d'un niveau et comment le mesurer depuis une vue réelle. Les lots de dessin n'ont plus de plafond ([ADR 0039](../decisions/0039-abandon-du-plafond-de-lots.md)) : leur nombre est un indicateur à lire, pas une limite à tenir. Le loader ne promet pas une limite globale de temps GPU.

## Fichiers

- `src/game/level/loading/mergeStaticDecor.ts` — clé de regroupement et fusion du décor statique.
- `src/game/level/loading/loader.ts` — construit les lots et expose les compteurs `LevelStats`.
- `src/game/level/doors/doors.ts` — regroupe les vantaux compatibles en `BatchedMesh`.
- `src/game/level/interactions/vitres.ts`, `sanitaires.ts` et `ecrans.ts` — fusion dédiée des surfaces cassables ou animées.
- `src/game/level/props/props.ts` — conserve le rendu mobile indépendant et l'élague à distance.
- `src/render/environment/useObjectCulling.ts` — distance de rendu des objets utilisables et des lots de sanitaires.
- `src/render/environment/lightPool.ts` — borne le nombre de lampes ponctuelles actives.
- `src/game/devtools/consoleApi.ts` et `src/game/devtools/replay/testHarness.ts` — commandes de diagnostic et banc `renderBench`.
- `tools/level_v2/plan_de_masse.py` et `tools/blender/validate_level.py` — cible de lots planifiée et contrôles de contenu.
- `test/game/level/loading/mergeStaticDecor.test.ts` — règles de fusion géométrique.
- [Mesures historiques](./budget-de-rendu.md) — protocole et relevés antérieurs à l'archive de phase I.

## Où ça s'insère dans la boucle

La majorité des fusions se fait une seule fois quand le loader construit le niveau. À chaque frame, Three.js écarte les objets hors du frustum ; quelques systèmes ajoutent un élagage par distance et le pool d'éclairage réévalue sa sélection selon la caméra. Le diagramme distingue ces étapes.

~~~mermaid
flowchart TD
  A["Meshes glTF"] --> B["Cellules et matériaux"]
  B --> C["Lots de décor"]
  A --> D["Lots spéciaux"]
  E["Position caméra"] --> F["Frustum et élagage"]
  C --> F
  D --> F
  G["LightPool"] --> H["Shaders actifs"]
  F --> I["Draw calls et triangles visibles"]
  H --> I
~~~

La fusion est une opération du chargement, pas un travail par frame. `UseObjectCulling`, `PropSystem` et `LightPool` lisent la caméra au taux d'affichage ; leur résultat est prêt avant l'appel de rendu.

## Données et contrats

### Décor statique

`mergeStaticDecor` groupe les meshes admissibles par contenu de matériau, attributs de géométrie et cellule cubique de 48 m. Le matériau est comparé par ses propriétés utiles (texture, couleurs, opacité, vertex colors, côté), car le loader crée souvent une instance de matériau par mesh. Les géométries doivent aussi avoir le même jeu d'attributs et le même statut indexé/non indexé.

La cellule est calculée à partir du centre de la boîte monde du mesh, puis arrondie par 48 m sur les axes x, y et z. Un grand mesh reste entier dans la cellule de son centre. Le lot conserve chaque sommet et ses vertex colors, mais tous les meshes qu'il contient sont rendus ou écartés ensemble.

Un mesh n'est pas fusionné s'il est invisible, a des enfants, est skinné ou instancié, porte plusieurs matériaux, contient des morph targets, a une échelle négative ou constitue un objet mobile. Un groupe d'un seul mesh reste tel quel ; la fusion doit contenir au moins deux membres pour réduire le nombre de dessins.

`LevelStats.decorBatchCount` additionne les meshes non fusionnés et les lots créés à partir des candidats non préfixés. Il donne un ordre de grandeur du décor rendu, pas un nombre garanti de draw calls visibles pour chaque caméra.

### Objets à coût spécifique

Les portes ne rejoignent pas le décor statique, car leur pose change. `batchDoorMeshes` regroupe par matériau les vantaux qui peuvent partager une instance de `BatchedMesh` ; un vantail seul reste un mesh ordinaire. Les matrices de chaque porte sont actualisées indépendamment.

Les vitres, sanitaires et écrans gardent chacun une plage de sommets éditable dans un lot dédié. Ils peuvent changer d'état ou d'UV sans créer un lot de dessin supplémentaire par objet. Ces lots sont groupés par matériau au niveau du glTF, pas par cellule : ils économisent des lots, mais une partie visible du lot peut garder un grand volume de culling.

Un `prop_*` bouge et se détruit séparément. Il ne peut pas rejoindre un lot statique ; son coût est donc un mesh par prop visible. `PropSystem` cache les props au-delà de 36 m et les restaure en revenant à portée.

Un `use_*` doit pouvoir être masqué quand il est ramassé. `UseObjectCulling` le garde visible jusqu'à 48 m, même si le frustum contient l'objet. Le même élagage traite les lots de rendus sanitaires selon leur centre monde. La logique de visibilité ne rallume que les meshes qu'elle a elle-même éteints ; un ramassage consommé reste masqué.

### Cible et limites des contrôles

Le niveau v2 n'a plus de plafond de lots. Il en dessine entre 70 et 255 selon la vue, pour 2 à 3 ms de rendu sur la machine de développement. `LevelStats` et `pnpm probe` exposent ces nombres ; ils servent à comprendre une vue, pas à valider un décor.

`tools/blender/validate_level.py` compte automatiquement les triangles et signale le dépassement de son budget triangulaire. Son contrôle des matériaux avertit au-delà de 24 matériaux ; il ne mesure pas le nombre réel de draw calls après fusion. Le diagnostic de lots s'appuie donc sur la vue du niveau chargé, pas seulement sur le rapport Blender.

### Mesure en jeu

`cassandre.level.stats()` lit les compteurs du glTF courant. `cassandre.renderBench(120)` dessine plusieurs frames en boucle serrée et rapporte le coût CPU, les draw calls et les triangles mesurés par Three.js. `cassandre.lightBudget()` donne l'état du pool sans le modifier.

Ces nombres dépendent de la caméra : un mesh hors champ ne compte pas dans ce qui est réellement soumis au GPU. Mesurez plusieurs poses représentatives et retenez le pire point de vue utile, pas une moyenne de tout le niveau. Un onglet automatisé masqué bride normalement `requestAnimationFrame` ; le banc contourne cette limite pour mesurer l'appel de rendu sans attendre les frames du navigateur.

Le banc ne remplace pas un chronomètre GPU. `EXT_disjoint_timer_query_webgl2` est requis pour isoler le temps d'exécution GPU ; le temps CPU et le nombre de triangles ne suffisent pas à l'estimer.

### Lire les statistiques

`decorBatchCount` décrit le décor ordinaire après fusion et les meshes restés seuls. Les compteurs de vantaux, vitres et sanitaires rapportent séparément les lots spéciaux ; `propCount` compte les objets mobiles dont le mesh conserve son identité.

`lightCount` mesure les `light_*` du niveau, pas des lots de dessin. Leur sélection agit sur le coût des shaders ; `cassandre.lightBudget()` permet de relever combien sont allumées dans la vue actuelle.

Le banc chauffe d'abord les programmes et les buffers, puis mesure le nombre demandé d'images et attend la fin du GPU. Il retourne le temps moyen, les lots, triangles et programmes compilés pour la caméra courante ; aucun pas de gameplay n'avance pendant cette mesure.

Le temps rapporté couvre cette boucle de rendu isolée, avec une synchronisation GPU avant et après. Il ne représente pas le coût complet de la frame jouée, qui comprend aussi la simulation, les effets et l'interface.

Le nombre de programmes compilés aide à repérer un excès de variantes de matériaux même quand le total de meshes paraît faible. Comparez-le avec les draw calls et les triangles au même point de vue avant de modifier les règles de fusion.

## Pièges

- Fusionner toute la carte par matériau réduit les lots, mais un seul morceau visible force le dessin de toute la géométrie fusionnée. Les cellules gardent le culling spatial utile.
- Réduire la cellule peut améliorer le culling et augmenter le nombre de lots par matériau. La valeur 48 m est un coude mesuré sur le décor texturé actuel, pas une constante universelle.
- L'origine Blender ne détermine pas la cellule. C'est le centre de la boîte monde ; déplacer seulement l'origine ne répartit donc pas un grand mesh entre plusieurs lots.
- Un nouvel attribut glTF ou une liste de matériaux différente empêche la fusion, même si la texture paraît identique à l'écran.
- Une vitre ou un écran fusionné sur toute la carte peut coûter un grand volume de géométrie lorsqu'une seule partie entre dans le champ. Vérifiez la baisse des draw calls avec la hausse des triangles.
- Un mesh animé, physique ou consommable ne doit pas être fusionné avec le décor fixe. Il doit garder son identité, sa pose ou sa visibilité propre.
- Le nombre de lots ne se déduit ni du nombre de matériaux Blender ni du total de triangles. Il faut inspecter le niveau chargé dans les vues pertinentes.
- Mesurer uniquement la résolution, une frame invisible ou une caméra déplacée hors boucle donne des chiffres qui ne représentent pas le point de vue joué.

## Tests

- `test/game/level/loading/mergeStaticDecor.test.ts` — regroupement par matériau, attributs et cellule ; exclusions et géométries transformées.
- `test/game/level/loading/loader.test.ts` — compteurs exposés et lots ajoutés par le loader.
- `test/game/level/doors/doors.test.ts`, `vitres.test.ts`, `sanitaires.test.ts` et `ecrans.test.ts` — lots dédiés aux objets qui gardent un état adressable.
- `test/render/environment/lightPool.test.ts` — budget de lampes, qui est un coût séparé du comptage des lots.

## Comment vérifier que ça marche

Chargez le niveau v2 et inspectez `cassandre.level.stats()`. Déplacez-vous vers plusieurs pièces ouvertes, couloirs et vues sur le parking ; lancez `cassandre.renderBench(120)` à chaque position. Le plus haut nombre de draw calls visibles désigne la vue la plus chargée ; c'est son temps de rendu qui compte, pas le nombre lui-même.

Comparez ce nombre au nombre de triangles visibles, puis réduisez temporairement `cassandre.lightBudget(8)` pour isoler le coût des lampes. Remettez ensuite le budget normal ou demandez explicitement `cassandre.lightBudget(null)` pour tout rallumer.

Pour le contenu source, lancez `python tools/blender/validate_level.py --strict` afin de vérifier le budget de triangles et les contrats exportés. Cette validation complète la mesure en jeu ; elle ne dit rien du nombre de lots par caméra.

Couverture ciblée : `pnpm test -- mergeStaticDecor loader doors vitres sanitaires ecrans lightPool`.
