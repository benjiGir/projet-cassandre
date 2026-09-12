"""
Rendu « tel que le jeu l'affichera » — PROJET_CASSANDRE.

    blender -b assets_src/blender/salle_essai_rayons.blend \\
        -P tools/blender/render_ingame.py -- --out renders/salle/ \\
        --view 5.75,1.25,0 --view 5.625,10,180

Options :
    --out DIR        dossier de sortie (créé si besoin)
    --view X,Y,CAP   un point de vue : position au sol en mètres et cap en
                     degrés (0 = vers +Y, 90 = vers -X). Répétable. Sans
                     aucun `--view`, part de `spawn_player`, cap 0.
    --eye H          hauteur des yeux (défaut 1.6, comme le joueur)
    --res-x/--res-y  résolution (défaut 640×360, celle du jeu)

Différence avec `render_preview.py` : celui-ci ne sert pas à lire un layout
mais à juger l'image — d'où le champ de vision et la colorimétrie ci-dessous.

**Le champ de vision est celui du jeu**, 75° VERTICAL en 16:9
(`moveConfig.fovBase`), soit 107° horizontal — focale 13.2 mm sur un capteur
de 36 mm. Une focale plus longue donne une capture flatteuse qui ment sur les
bords de l'écran : au jalon N4, des rayons bien garnis en capture à 32 mm se
révélaient rasants et creux en jeu.

**Les couleurs approchent celles du jeu**, c'est-à-dire texture × couleur de
sommet. Workbench sait afficher l'une OU l'autre, jamais leur produit ; on
reconstruit donc le calcul avec un shader d'émission pure sous EEVEE — aucune
lumière dans la scène de rendu, tout l'éclairage vient du bake, comme
`MeshLambertMaterial` + `COLOR_0` en jeu (invariant #5).

**Ce n'est pas une capture d'écran du jeu.** Comparée côte à côte au jalon
N4, cette reconstruction ressort un peu plus claire et un peu moins
contrastée : il reste un facteur d'échelle entre l'`AmbientLight` de three.js
et l'émission de Blender, non mesuré (le framebuffer du jeu n'est pas
lisible, `preserveDrawingBuffer` est à faux). **Le jeu reste la référence**
pour tout jugement d'éclairage ; cet outil sert à cadrer, composer et
contrôler la géométrie sans lancer le serveur de dev.
"""

from __future__ import annotations

import math
import os
import sys

import bpy
from mathutils import Euler, Vector

SKIP_PREFIXES = ("col_", "trig_", "secret_")
SOURCE_COLLECTIONS = {"_KIT", "_LIB"}
GAME_LENS = 13.2          # 107° horizontal, voir la doc de tête
EYE_HEIGHT = 1.6


def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg_value(args, flag, default):
    return args[args.index(flag) + 1] if flag in args else default


def arg_values(args, flag) -> list[str]:
    return [args[i + 1] for i, a in enumerate(args) if a == flag and i + 1 < len(args)]


def rewire_as_game(mat: bpy.types.Material, ambiant: float = 1.0,
                   eclaire: bool = False) -> None:
    """Reconstruit « texture × attribut Col ».

    Sans lampe (`eclaire=False`), en émission pure : tout l'éclairage est déjà
    dans les sommets. Avec des lampes, en diffus — la couleur de sommet devient
    un masque d'ombre que la lumière vient multiplier, exactement comme
    `MeshLambertMaterial` en jeu — plus une part d'émission qui tient lieu de
    l'ambiante de la scène.
    """
    if not mat.use_nodes:
        mat.use_nodes = True
    nt = mat.node_tree
    # Nœuds cherchés par TYPE : une interface Blender en français traduit les noms.
    image = next((n for n in nt.nodes if n.type == "TEX_IMAGE"), None)
    out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
    if out is None:
        out = nt.nodes.new("ShaderNodeOutputMaterial")

    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "Col"
    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MULTIPLY"
    mix.inputs["Fac"].default_value = 1.0
    if image is not None:
        nt.links.new(image.outputs["Color"], mix.inputs["Color1"])
    else:
        mix.inputs["Color1"].default_value = (0.8, 0.8, 0.8, 1.0)
    nt.links.new(attr.outputs["Color"], mix.inputs["Color2"])

    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = ambiant
    nt.links.new(mix.outputs["Color"], emit.inputs["Color"])

    if not eclaire:
        nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
        return

    diffuse = nt.nodes.new("ShaderNodeBsdfDiffuse")
    nt.links.new(mix.outputs["Color"], diffuse.inputs["Color"])
    somme = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(diffuse.outputs["BSDF"], somme.inputs[0])
    nt.links.new(emit.outputs["Emission"], somme.inputs[1])
    nt.links.new(somme.outputs["Shader"], out.inputs["Surface"])


def build_game_lights(scene) -> int:
    """Recrée en EEVEE les lampes que le JEU allumera, d'après les `light_*`.

    Sur un niveau hybride (ADR 0024), la couleur de sommet n'est plus
    l'éclairage mais l'ombre : rendre `texture × Col` seul donnerait une image
    qui n'existe nulle part. Il faut donc rallumer ici les mêmes lampes que
    `loader.ts::buildLevelLight` instancie en jeu, avec les mêmes extras.

    Conversion d'intensité : une `PointLight` three.js est en candela, donc son
    éclairement vaut I/d² ; une lampe Blender est en watts et rayonne
    P/(4π·d²). Pour le même éclairement, P = 4π·I — un facteur calculé, pas
    réglé à l'œil (à 40 au lieu de 12,6, la capture ressortait trois fois trop
    claire et brûlait le plafond).
    """
    n = 0
    for obj in list(scene.objects):
        if obj.type != "EMPTY" or not obj.name.split(".")[0].startswith("light_"):
            continue
        data = bpy.data.lights.new(f"_rt_{obj.name}", type="POINT")
        data.energy = float(obj.get("intensity", 8.0)) * 4.0 * math.pi
        data.shadow_soft_size = 0.15
        couleur = str(obj.get("color", "#ffffff")).lstrip("#")
        if len(couleur) == 6:
            data.color = tuple(int(couleur[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
        light = bpy.data.objects.new(f"_rt_{obj.name}", data)
        light.location = obj.matrix_world.translation
        scene.collection.objects.link(light)
        n += 1
    return n


def find_spawn() -> bpy.types.Object | None:
    for obj in bpy.context.scene.objects:
        if obj.name.split(".")[0] == "spawn_player":
            return obj
    return None


def main() -> None:
    args = get_args()
    out_dir = os.path.abspath(arg_value(args, "--out", "renders"))
    eye = float(arg_value(args, "--eye", str(EYE_HEIGHT)))
    os.makedirs(out_dir, exist_ok=True)

    scene = bpy.context.scene
    # Blender 5.x a reperdu le suffixe `_NEXT` de la 4.2 : on prend ce que
    # l'énumération propose réellement plutôt que de parier sur un nom.
    engines = scene.render.bl_rna.properties["engine"].enum_items.keys()
    scene.render.engine = next(e for e in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE") if e in engines)
    scene.render.resolution_x = int(arg_value(args, "--res-x", "640"))
    scene.render.resolution_y = int(arg_value(args, "--res-y", "360"))
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    # Sans transformation de vue : le jeu écrit du sRGB direct, alors qu'AgX
    # (défaut de Blender) désature et relève les hautes lumières — la capture
    # sortirait plus claire et plus fade que ce que le joueur voit.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    if scene.world:
        scene.world.use_nodes = False
        scene.world.color = (0.0, 0.0, 0.0)

    lampes = build_game_lights(scene)
    for mat in bpy.data.materials:
        rewire_as_game(mat, ambiant=0.18 if lampes else 1.0, eclaire=lampes > 0)
    print(f"[rendu] {lampes} lampe(s) `light_*` rallumée(s)" if lampes
          else "[rendu] aucune `light_*` : niveau tout baké, émission pure")

    sources = set()
    for name in SOURCE_COLLECTIONS:
        root = bpy.data.collections.get(name)
        if root:
            stack = [root]
            while stack:
                coll = stack.pop()
                sources.add(coll)
                stack.extend(coll.children)
    for obj in scene.objects:
        if obj.name.startswith(SKIP_PREFIXES) or any(c in sources for c in obj.users_collection):
            obj.hide_render = True
        # Les lampes du BAKE n'ont rien à faire ici : leur travail est déjà dans
        # la couleur de sommet. Seules les `_rt_*` reconstruites plus haut, celles
        # que le jeu allumera vraiment, restent visibles.
        if obj.type == "LIGHT" and not obj.name.startswith("_rt_"):
            obj.hide_render = True

    data = bpy.data.cameras.new("_ingame")
    data.lens = GAME_LENS
    data.clip_start = 0.05
    data.clip_end = 200.0
    cam = bpy.data.objects.new("_ingame", data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    views = arg_values(args, "--view")
    if not views:
        spawn = find_spawn()
        origin = spawn.matrix_world.translation if spawn else Vector((0, 0, 0))
        views = [f"{origin.x},{origin.y},0"]

    for i, spec in enumerate(views):
        x, y, cap = (float(v) for v in spec.split(","))
        cam.location = (x, y, eye)
        cam.rotation_euler = Euler((math.radians(90.0), 0.0, math.radians(cap)), "XYZ")
        scene.render.filepath = os.path.join(out_dir, f"vue_{i + 1:02d}.png")
        bpy.ops.render.render(write_still=True)
        print(f"[rendu] {scene.render.filepath}  ({x}, {y}, cap {cap}°)")


if __name__ == "__main__":
    main()
