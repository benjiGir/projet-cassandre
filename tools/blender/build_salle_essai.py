"""
Salle d'essai « rayons » — niveau v2, jalon N4.

    blender -b --factory-startup -P tools/blender/build_salle_essai.py -- \\
        --out assets_src/blender/salle_essai_rayons.blend

Options :
    --out PATH          .blend produit
    --light-energy W    puissance des rampes (défaut 180). Calibré en mesurant :
                        90 W donnaient une luminance moyenne de 0.30 — une salle
                        dans la pénombre —, 180 W donnent 0.46 pour 4 % de
                        sommets écrêtés. La relation n'est pas linéaire, c'est
                        l'écrêtage qui mange le gain.

Pas une zone du niveau : une salle jetable dont le seul but est de répondre à
une question, « est-ce que la richesse est là ? ». Elle n'utilise donc pas le
kit modulaire (`kit_spec.py`) mais la bibliothèque du niveau v2
(`lib_rayons.py`), et construit ses murs directement.

Plan : 16 × 20 m, trois rangées de gondoles coupées par une allée
transversale, meubles réfrigérés le long des murs, rampes de néons, piliers.
Repères sur la grille de 0.25 m ; les meubles sont posés transform figée dans
le mesh (voir `lib_rayons.place`), donc tous à la position (0,0,0).

Chaîne complète ensuite :
    blender -b <out> -P tools/blender/bake_vertex_lighting.py -- --type diffuse --save
    blender -b <out> -P tools/blender/validate_level.py -- --strict
    blender -b <out> -P tools/blender/export_level.py -- --out public/assets/levels/salle_essai_rayons.glb
"""

from __future__ import annotations

import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import lib_helpers as H          # noqa: E402
import lib_rayons as L           # noqa: E402

# --- Cotes de la salle -------------------------------------------------------
W, D, HT = 16.0, 20.0, 5.0
WALL_T = 0.25

ROWS = (4.0, 8.5, 13.0)          # bord DROIT de chaque rangée (largeur 1.25)
# Thème de chaque rangée : (face EST, face OUEST). Une allée voit donc deux
# catégories voisines — boissons face au petit déjeuner, entretien face aux
# conserves — comme dans un vrai magasin.
THEMES = (("boissons", "epicerie"),
          ("entretien", "petit_dej"),
          ("frais", "conserves"))
SEGMENTS = (2.25, 11.25)         # départ en y des deux tronçons de 6.5 m
CROSS = (8.75, 11.25)            # allée transversale

# Les rampes courent au-dessus des allées et des dégagements, jamais des rangées
# (bords droits en 4.0 / 8.5 / 13.0, largeur 1.25).
NEON_X = (1.5, 5.75, 10.25, 14.5)
NEON_Y = (1.0, 5.5, 10.0, 14.5)
# Tubes grillés, choisis pour creuser des coins : nord-ouest (réassort) et
# sud-est. Rien de crucial ne s'y trouve — l'ombre invite, elle ne punit pas.
NEONS_MORTS = frozenset({(1.5, 14.5), (14.5, 1.0), (10.25, 14.5)})

SEED = 20260912


def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg_value(args: list[str], flag: str, default):
    return args[args.index(flag) + 1] if flag in args else default


# ---------------------------------------------------------------------------

def reset_scene() -> None:
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)


def build_shell(shell, col_coll) -> None:
    """Sol, murs, plafond. Le plafond n'a PAS de proxy : le bake du pathfinding
    prendrait son dessus pour le sol (docs/systems/pathfinding.md)."""
    # Trois dalles jointives plutôt qu'une grande et des bandes par-dessus :
    # deux meshes coplanaires ressortiraient noirs au bake (auto-occultation).
    # `subdiv` serré : le sol et les murs portent l'essentiel du dégradé lumineux
    # de la salle, et un dégradé n'existe qu'entre deux sommets. Le sol descend à
    # 0.5 m : c'est lui qui porte les flaques de lumière sous les rampes, et le
    # bord d'une flaque ne peut pas être plus fin que la maille.
    H.box("sol_sud", (0, 0, -0.2, W, CROSS[0], 0), "sol_carrelage_blanc", shell, subdiv=0.5)
    # Damier sur la transversale : elle se lit d'un bout à l'autre de la salle et
    # sert de repère d'orientation, ce qu'un sol uniforme ne fait pas.
    H.box("sol_transversale", (0, CROSS[0], -0.2, W, CROSS[1], 0), "sol_damier", shell, subdiv=0.5)
    H.box("sol_nord", (0, CROSS[1], -0.2, W, D, 0), "sol_carrelage_blanc", shell, subdiv=0.5)
    H.col_box("sol", (0, 0, -0.2, W, D, 0), col_coll)

    murs = [("sud", (-WALL_T, -WALL_T, 0, W + WALL_T, 0, HT)),
            ("nord", (-WALL_T, D, 0, W + WALL_T, D + WALL_T, HT)),
            ("ouest", (-WALL_T, 0, 0, 0, D, HT)),
            ("est", (W, 0, 0, W + WALL_T, D, HT))]
    H.boxes("murs", [(b, "world") for _, b in murs], "mur_platre", shell, subdiv=0.8)
    for nom, bounds in murs:
        H.col_box(f"mur_{nom}", bounds, col_coll)

    # Plinthe tout autour : le bas d'un mur nu se lit comme une boîte blanche.
    p = 0.02
    H.boxes("plinthes", [
        ((0, 0, 0, W, p, 0.15), "trim:plinthe"),
        ((0, D - p, 0, W, D, 0.15), "trim:plinthe"),
        ((0, 0, 0, p, D, 0.15), "trim:plinthe"),
        ((W - p, 0, 0, W, D, 0.15), "trim:plinthe"),
    ], "trim_hypermarche", shell)

    H.box("plafond", (0, 0, HT, W, D, HT + 0.1), "plafond_dalles", shell, subdiv=0.8)


def build_rows(props, col_coll) -> int:
    """Trois rangées de deux tronçons : tête de gondole, gondole 4 m, tête.

    Chaque FACE de rangée porte un thème et son bandeau. Une face donne sur une
    allée, l'autre sur la suivante : c'est la face, pas la rangée, qui est
    l'unité de cohérence. Les têtes de gondole restent volontairement mélangées
    — c'est ce qu'est une tête de gondole, un assortiment de promotions.
    """
    n = 0
    for ri, x_right in enumerate(ROWS):
        # `place(..., 90)` envoie le -y local sur le +x monde : la face « avant »
        # d'une gondole posée en rangée regarde donc l'est.
        theme_est, theme_ouest = THEMES[ri]
        for si, y0 in enumerate(SEGMENTS):
            tag = f"r{ri}s{si}"
            seed = SEED + ri * 10 + si
            L.place(L.tete_garnie(seed), (x_right - 1.25, y0, 0), 0,
                    props, col_coll, f"{tag}_sud")
            L.place(L.gondole_garnie(seed + 100, 4.0, theme_est, theme_ouest),
                    (x_right, y0 + 1.25, 0), 90, props, col_coll, tag)
            L.place(L.tete_garnie(seed + 200), (x_right, y0 + 6.5, 0), 180,
                    props, col_coll, f"{tag}_nord")
            L.place(L.bandeau_rayon(theme_est), (x_right, y0 + 1.25, 2.0), 90,
                    props, col_coll, f"{tag}_est")
            L.place(L.bandeau_rayon(theme_ouest), (x_right - 1.25, y0 + 5.25, 2.0), 270,
                    props, col_coll, f"{tag}_ouest")
            n += 3
    return n


def build_walls_furniture(props, col_coll) -> None:
    """Meubles réfrigérés le long des murs, dos au mur, façade vers l'allée."""
    for i, y in enumerate((10.0, 12.25, 14.5)):
        L.place(L.frigo_garni(SEED + 300 + i), (0.8, y - 2.0, 0), 90,
                props, col_coll, f"ouest{i}")
    for i, y in enumerate((6.0, 8.25, 10.5)):
        L.place(L.frigo_garni(SEED + 400 + i), (15.2, y, 0), 270,
                props, col_coll, f"est{i}")


def build_props(props, col_coll) -> None:
    for i, (x, y) in enumerate(((1.0, 4.0), (1.0, 16.0), (14.5, 3.0), (14.5, 15.0))):
        L.place(L.pilier(), (x, y, 0), 0, props, col_coll, f"p{i}")

    for i, (x, y) in enumerate(((5.25, 9.0), (10.0, 9.0))):
        L.place(L.bac_garni(SEED + 500 + i), (x, y, 0), 0, props, col_coll, f"b{i}")

    for i, (x, y) in enumerate(((2.0, 9.0), (13.5, 12.5))):
        L.place(L.presentoir_garni(SEED + 600 + i), (x, y, 0), 0, props, col_coll, f"t{i}")

    for i, (x, y) in enumerate(((0.75, 17.5), (2.25, 18.25))):
        L.place(L.palette_cartons(), (x, y, 0), 0 if i == 0 else 30,
                props, col_coll, f"pal{i}")

    for i, (x, y) in enumerate(((0.75, 0.75), (15.0, 18.75))):
        L.place(L.poubelle(), (x, y, 0), 0, props, col_coll, f"pou{i}")

    # Caddies abandonnés dans les allées : rien ne dit « supermarché » plus vite.
    # Aucun dans les deux mètres autour de `spawn_player` (5.75, 1.25) : on y
    # apparaissait à l'intérieur du panier.
    caddies = ((7.75, 1.0, 15), (10.5, 9.75, -105), (1.5, 12.0, 200),
               (6.0, 18.0, 45), (11.0, 18.5, 260), (4.5, 6.0, 85))
    for i, (x, y, rot) in enumerate(caddies):
        L.place(L.caddie(), (x, y, 0), rot, props, col_coll, f"c{i}")


def build_signage(props, col_coll) -> None:
    """Panneaux d'allée aux deux entrées de chaque allée, affiches promo au-dessus
    des têtes de gondole."""
    for i, x in enumerate((4.75, 9.25)):        # centré sur les allées de 3.25 m
        for j, y in enumerate((2.0, 17.75)):
            L.place(L.panneau_allee(), (x, y, 3.0), 0, props, col_coll, f"all{i}{j}")
    for i, x_right in enumerate(ROWS):
        L.place(L.promo_suspendu(), (x_right - 1.05, 1.9, 3.5), 0,
                props, col_coll, f"promo{i}")


def build_lights(lights, props, logic, energy: float) -> None:
    """Rampes de néons, leurs sources de BAKE, et leurs lampes de JEU.

    Deux éclairages cohabitent et n'ont pas le même métier :

    - les **area lights** servent au bake et ne partent pas en jeu. Trois choix
      font tout leur relief, et aucun n'est un réglage de puissance : la source
      a la forme du tube (3,9 × 0,3 m) et non d'un carré de 3 m ; rien
      n'éclaire directement au-dessus des rangées, donc les gondoles reçoivent
      la lumière de biais et leurs tablettes basses restent dans l'ombre des
      hautes ; quelques tubes sont morts, ce qui creuse des zones sombres — de
      quoi dater le magasin et donner envie d'aller voir.
    - les **`light_*`** sont des empties lus par `loader.ts`, qui en fait des
      `THREE.PointLight`. Ce sont elles qui éclairent en jeu : chute de
      lumière réelle, arêtes qui se détachent, ennemis éclairés en passant
      dessous.

    Blanc légèrement froid dans les deux cas : un tube fluorescent n'est jamais
    neutre.
    """
    blanc_froid = (0.86, 0.93, 1.0)
    n = 0
    for x in NEON_X:
        for y in NEON_Y:
            mort = (x, y) in NEONS_MORTS
            L.place(L.neon(4.0, eteint=mort), (x, y, HT - 0.18), 90, props, props, f"n{n}")
            if not mort:
                H.area_light(f"lamp_{n}", (x - 0.17, y + 2.0, HT - 0.30),
                             0.30, energy, lights, size_y=3.90, color=blanc_froid)
                # Deux points par rampe : une lampe ponctuelle au milieu d'un
                # tube de 4 m donnerait une flaque ronde là où il faut une
                # traînée.
                # Posées NETTEMENT sous le carter (0.65 m) : collées au plafond
                # elles le brûlaient, alors que c'est le tube qui doit être
                # l'objet le plus lumineux, pas la dalle autour.
                for k, dy in enumerate((1.0, 3.0)):
                    light_empty(logic, f"light_neon_{n}_{k}", (x - 0.17, y + dy, HT - 0.65),
                                color="#dceeff", intensity=6.0, distance=11.0)
            n += 1

    # Bloc de secours au-dessus de la sortie nord : la seule lumière d'une autre
    # couleur de la salle, donc le seul repère qui se voit de loin dans l'ombre.
    L.place(L.neon(2.0), (7.0, 19.4, HT - 1.4), 0, props, props, "secours")
    H.area_light("lamp_secours", (8.0, 19.55, HT - 1.55), 1.8, 40.0, lights,
                 size_y=0.25, color=(0.35, 1.0, 0.45))
    light_empty(logic, "light_secours", (8.0, 19.3, HT - 1.6),
                color="#4dff73", intensity=3.0, distance=7.0)


def light_empty(coll, name: str, location, color: str, intensity: float,
                distance: float, decay: float = 2.0):
    """Lampe de JEU : un empty `light_*` que `loader.ts` transforme en PointLight.

    Un empty plutôt qu'une vraie lampe Blender exportée en `KHR_lights_punctual` :
    la scène a déjà des lampes, celles du bake, et le watt de Blender ne se
    convertit pas en intensité three.js. L'empty porte exactement les paramètres
    de `THREE.PointLight`, lisibles tels quels, et ne peut pas être confondu avec
    une source de bake.
    """
    obj = bpy.data.objects.new(name, None)
    obj.location = location
    obj.empty_display_size = 0.3
    obj["color"] = color
    obj["intensity"] = intensity
    obj["distance"] = distance
    obj["decay"] = decay
    coll.objects.link(obj)
    return obj


def build_logic(logic) -> None:
    def empty(name, loc):
        obj = bpy.data.objects.new(name, None)
        obj.location = loc
        obj.empty_display_size = 0.5
        logic.objects.link(obj)
        return obj

    empty("spawn_player", (5.75, 1.25, 0.0))
    # Assez loin pour rester hors `attackRange` (16 m) : la salle est un test de
    # richesse, pas d'embuscade — mais une salle vide ne se juge pas en jouant.
    empty("spawn_suit_1", (5.75, 18.75, 0.0))
    empty("spawn_suit_2", (10.25, 18.75, 0.0))


def main() -> None:
    args = get_args()
    out = arg_value(args, "--out", "//salle_essai_rayons.blend")
    energy = float(arg_value(args, "--light-energy", "180"))

    reset_scene()
    L.build_all()
    shell = H.collection("SHELL")
    props = H.collection("PROPS")
    col_coll = H.collection("COLLISION")
    lights = H.collection("LIGHTS")
    logic = H.collection("LOGIC")

    build_shell(shell, col_coll)
    print(f"  gondoles          {build_rows(props, col_coll)}")
    build_walls_furniture(props, col_coll)
    build_props(props, col_coll)
    build_signage(props, col_coll)
    build_lights(lights, props, logic, energy)
    build_logic(logic)

    lib_layer = bpy.context.view_layer.layer_collection.children.get(L.LIB_NAME)
    if lib_layer:
        lib_layer.exclude = True

    for name, value in stats().items():
        print(f"  {name:18s}{value}")

    if not out.startswith("//"):
        out = os.path.abspath(out)
    bpy.ops.wm.save_as_mainfile(filepath=out)
    print(f"ok  {out}")


def stats() -> dict:
    """Comptes utiles au budget de N1 : un lot de fusion par matériau."""
    rendus = [o for o in bpy.data.objects
              if o.type == "MESH" and not o.name.startswith("col_")]
    tris = 0
    for o in rendus:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    materiaux = {m.name for o in rendus for m in o.data.materials if m}
    return {"objets rendus": len(rendus),
            "proxies": sum(1 for o in bpy.data.objects if o.name.startswith("col_")),
            "triangles": tris,
            "matériaux": len(materiaux),
            "lampes": sum(1 for o in bpy.data.objects if o.type == "LIGHT")}


if __name__ == "__main__":
    main()
