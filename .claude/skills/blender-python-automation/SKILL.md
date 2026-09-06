---
name: blender-python-automation
description: Automatisation Blender par script bpy headless — patterns, exécution en ligne de commande, arbitrage scripts versus Blender MCP, précautions de sécurité, pièges courants de l'API. Charger pour écrire ou exécuter du code Blender.
---

# Automatisation Blender

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
dialogue. Il existe plusieurs implémentations (`ahujasid/blender-mcp` et ses
forks, plus un serveur officiel côté Blender). Elles exposent l'API Python de
Blender à l'agent.

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
