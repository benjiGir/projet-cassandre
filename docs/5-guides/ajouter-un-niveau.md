---
title: Ajouter un niveau
tags: [guide, recette]
status: brouillon
updated: 2026-09-26
---

# Ajouter un niveau

## Objectif

Rendre un nouveau niveau testable dans le jeu en raccordant son asset,
sa définition, son éclairage et les validations de contenu.

## Avant de commencer

- Choisissez le pipeline : niveau de test en volumes ou niveau glTF issu
  de Blender.
- Lisez [Chargement de niveau](../4-technique/chargement-de-niveau.md),
  [Outillage Blender](../4-technique/outillage-blender.md) et [la
  référence de nommage](../6-reference/conventions-nommage.md).
- Une nouvelle zone dans le niveau v2 se crée à partir du plan de masse
  commun ; elle n'est pas un second niveau glTF autonome.
- Décidez si le joueur démarre armé, quel éclairage le niveau utilise et
  s'il possède un ciel.
- Vérifiez que le fichier exporté sera publié dans
  `public/assets/levels/`.

## Étapes

1. Construisez une géométrie test légère ou préparez une source Blender
   dédiée dans `assets_src/blender/`.
2. Ajoutez les colliders, les spawns, les lumières et objets interactifs
   requis selon leurs préfixes glTF.
3. Donnez au niveau un nom de fichier stable et ne confondez pas son
   identifiant de menu avec son nom de fichier.
4. Pour un niveau v2, ajoutez ses espaces et connexions à
   `tools/level_v2/plan_de_masse.py` puis construisez via
   `tools/level_v2/build_niveau.py`.
5. Pour un niveau historique construit par kit, ajoutez les
   spécifications dans `tools/blender/level_spec.py` et utilisez les
   constructeurs du kit.
6. Validez le contrat avec `tools/blender/validate_level.py`.
7. Faites l'audit géométrique du niveau v2 avec
   `tools/level_v2/audit_niveau.py`.
8. Bakiez l'éclairage si le niveau l'utilise ; les niveaux de test non
   texturés peuvent garder l'éclairage temps réel.
9. Exportez le GLB sous `public/assets/levels/<fichier>.glb` avec le
   script d'export du dépôt.
10. Ajoutez une entrée à `LEVEL_CHOICES` dans
    `src/game/level/catalog/levels.ts`. Choisissez `kind: "gltf"`, `gltfName` et
    les options de départ adaptées.
11. Si le niveau utilise une skybox, définissez `ciel` avec le nom du
    dossier correspondant dans `public/assets/sky/`.
12. Vérifiez la sélection depuis `src/app/navigation/bootChoice.ts` et le menu de
    développement `src/ui/dev/LevelMenu/`.
13. Pour un niveau de test construit en TypeScript, créez le builder
    dans `src/game/level/` et branchez son cas `kind: "gym"`.
14. Ajoutez le test de chargement sous `test/game/level/` et une
    couverture sur les propriétés propres au nouveau contenu.
15. Lancez le jeu avec le nouvel identifiant de niveau et attendez la
    fin du chargement.
16. Contrôlez le point de départ, les collisions, le sol, la navigation,
    les secrets et le chemin de sortie.
17. Vérifiez le rendu avec les paramètres du vrai runtime ; un bake
    isolé dans Blender ne garantit pas le résultat Three.js.
18. Mettez à jour le plan, l'inventaire du niveau, les docs
    fonctionnelles et la table [Où agir](ou-agir.md).

## Vérifier

- Le fichier .glb existe au chemin exact demandé par
  `LevelDef.gltfName`.
- Le loader trouve exactement un spawn joueur, les spawns ennemis et
  tous les objets référencés.
- Le niveau sélectionné démarre avec le bon équipement et le bon
  éclairage.
- La console ne signale pas de custom property inconnue.
- Les tests de loader/hot reload couvrent la définition du nouveau
  niveau.
- Faites un trajet complet : entrée, progression, objectif, sortie,
  reset.
- Vérifiez les collisions et le graphe de navigation avec des ennemis
  réels.
- Demandez une inspection visuelle et un playtest si le niveau apporte
  une nouvelle expérience.

## Pièges

- Un niveau listé mais sans GLB se sélectionne puis échoue au
  chargement.
- Le menu montre `label` ; le loader résout `gltfName`. Gardez ces
  valeurs explicites.
- Un plafond exporté comme collider peut boucher le graphe de
  navigation.
- Les properties glTF ne sont présentes que si l'export active les
  extras.
- L'éclairage déclaré dans `LevelDef` change le rôle des lampes et des
  vertex colors.
- Le hot reload concerne les fichiers glTF en mode dev ; il ne remplace
  pas une définition valide du niveau.
- Les niveaux à armes initiales spécifiques doivent déclarer
  `startUnarmed` au lieu de modifier silencieusement le joueur.

## Exemple réel

Commit `95a1571`, « Niveau v2, N8 : blockout gris jouable » : il ajoute
un GLB de niveau, son plan de masse et une entrée sélectionnable dans
`LEVEL_CHOICES`.
