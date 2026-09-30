---
name: blender-python-automation
description: Automatisation Blender par script bpy headless — patterns, exécution en ligne de commande, arbitrage scripts versus Blender MCP, précautions de sécurité, pièges courants de l'API. Charger pour écrire ou exécuter du code Blender.
---

# Automatisation Blender

## D'abord : les commandes `cassandre`

Avant d'écrire du `bpy`, vérifier que la tâche n'est pas déjà une commande de
`tools/blender/cassandre.py`. Elles lancent les scripts du pipeline tels quels
et absorbent ce qui casse à chaque fois : modules périmés en cache, `sys.exit`
refusé par le MCP, caméra de rendu oubliée avant l'export, capture trop lourde,
session ouverte plus vieille que son fichier.

| Besoin | Commande |
|---|---|
| Fraîcheur de la session, du `.blend`, du `.glb` | `status()` |
| Reconstruire le niveau v2 (copie de sécurité si la session est modifiée) | `build()` |
| Contrat + audit, verdicts seuls | `check(strict=False)` |
| Regarder : spawn, pose du jeu, point, dessus d'un espace, objet | `shot("spawn" \| "joueur" \| (x, y, cap) \| "dessus:<espace>" \| nom)` |
| Exporter le `.glb` vérifié | `export()` |
| Trouver des objets | `find("motif*", pres=(x, y))` |
| Quelle ligne a posé cet objet | `where(nom \| "motif*" \| pres=(x, y))` |
| Lots de dessin d'une vue, matériaux réutilisables d'une cellule | `budget(vue=…)`, `budget(cellule_de=(x, y))` |
| Relancer n'importe quel script du dépôt | `run(script, *args, keep="[prefixe]")` |
| Relire les `lib_*.py` modifiés | `reload()` |

```python
# Session ouverte, par le MCP : une ligne, un dict en retour
import cassandre as C; result = C.check()
```

```bash
# Headless (sous-agents sans MCP) : une ligne `[cassandre] {...}` en sortie
blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- shot 'vue=[0,60,180]'
```

**Pour modifier le niveau sans relire 5 000 lignes** : `where` rend le `site`
(fichier:ligne fonction où l'objet a été posé) et, pour une instance de la
bibliothèque, le `patron_site` (où l'asset est défini). `python3
tools/blender/api_index.py lib_rayons` liste les fonctions d'un module, `--grep
motif` cherche partout. Ouvrir ensuite seulement les lignes désignées.

Les images et logs vont dans `renders/_cassandre/` (gitignoré). Une recette qui
manque s'ajoute à `cassandre.py` — pas dans un appel MCP jetable qu'il faudra
retaper.

## Deux canaux

**Scripts bpy headless** — le défaut. Versionnable, déterministe, exécutable en
CI, relisible en diff. Tout ce qui est répétable passe par là.

```bash
blender -b level.blend -P tools/blender/validate_level.py
blender -b --factory-startup -P tools/blender/build_kit.py -- --out kit.blend
```

Le `--` sépare les arguments Blender des arguments du script :

```python
import sys
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
```

**Blender MCP** — pour l'assemblage exploratoire sur une scène ouverte, en
dialogue. Le projet utilise le serveur officiel (Blender Lab) ; il expose l'API
Python de Blender à l'agent. Seul l'agent principal y a accès : les
sous-agents passent par `cassandre_cli.py`.

## Où chaque canal est bon

Le retour d'usage sur Blender MCP est cohérent : **excellent pour l'assemblage
de scène, les matériaux, l'éclairage et le travail répétitif ; faible pour
produire un modèle organique**, parce qu'il construit à partir de primitives et
de modificateurs plutôt que de générer de la forme.

C'est précisément le bon profil ici : le niveau est de l'assemblage de kit sur
grille, et les ennemis sont des sprites, pas des modèles 3D. Le point faible de
l'outil ne touche pas ce projet.

## Précaution de sécurité

Ces serveurs exécutent du **Python arbitraire dans Blender, sans garde-fou**.
La documentation officielle recommande explicitement une machine virtuelle ou
un système sans données sensibles.

Règles minimales :
- Sauvegarder avant toute session
- Travailler dans un dossier isolé, pas dans le dépôt principal
- Ne jamais l'activer sur un `.blend` non versionné

## Patterns bpy utiles

**Itérer proprement sur les meshes**

```python
import bpy
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
```

**Appliquer les transforms**

```python
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
```

**Lire la géométrie évaluée** (modificateurs appliqués)

```python
deps = bpy.context.evaluated_depsgraph_get()
eval_obj = obj.evaluated_get(deps)
mesh = eval_obj.to_mesh()
# ... lecture ...
eval_obj.to_mesh_clear()
```

Oublier `to_mesh_clear()` fuit de la mémoire sur un batch.

**Custom properties → glTF extras**

```python
obj["use_target"] = "door_exit"
obj["secret_id"] = 2
```

**Export**

```python
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_extras=True,          # obligatoire
    export_apply=True,           # applique les modificateurs
    export_vertex_color='ACTIVE', # Blender 5.x : ENUM, pas le bool export_colors —
                                  # voir docs/decisions/0021-export-vertex-color-enum.md
    export_yup=True,
    export_draco_mesh_compression_enable=False,
)
```

## Pièges de l'API

- **Les opérateurs `bpy.ops` dépendent du contexte.** En headless, beaucoup
  échouent avec « context is incorrect ». Préférer l'API de données directe
  (`obj.data`, `obj.matrix_world`) partout où c'est possible.
- **`bpy.ops` est lent en boucle.** Sur des centaines d'objets, utiliser
  `bmesh` ou l'API de données.
- **Les noms sont uniques et suffixés automatiquement.** `col_wall` devient
  `col_wall.001` à la copie — le contrat de nommage doit tolérer le suffixe
  `.NNN` dans ses regex.
- **Le code exécuté dans Blender tourne sur le thread principal.** Pas de
  threading naïf.
- **L'API casse entre versions majeures.** Figer la version de Blender du
  projet et la documenter dans le README.

## Ce qu'un script doit toujours faire

1. Sortir un **code de retour** exploitable (`sys.exit(1)` en échec)
2. Logger de façon parsable — un rapport lisible par `qa-evidence`
3. Ne jamais modifier le `.blend` d'entrée sans le dire
4. Documenter sa ligne de commande en tête de fichier
