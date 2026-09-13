"""
Bibliothèque d'assets du niveau v2 — PROJET_CASSANDRE.

    blender -b assets_src/library/lib_hypermarche_v2.blend \\
        -P tools/blender/build_library.py -- --save

Options :
    --save    réécrit le .blend d'entrée (destructif, explicite)
    --out P   écrit ailleurs

Construit tous les assets de `lib_rayons.py`, `lib_facade.py` et `lib_electro.py`,
et les marque dans l'Asset
Browser, chacun dans la catégorie donnée par son préfixe. Les assets sont
générés par code : ce `.blend` est un PRODUIT, pas une source — il sert à les
feuilleter, à les glisser dans une scène, à contrôler une silhouette. Le
fichier d'entrée est rouvert et non reconstruit de zéro, pour conserver ce qui
s'y trouve déjà à la main (le repère `_ref_humain_1m80`).

Les niveaux, eux, n'appendent pas depuis ce fichier : ils appellent les
modules directement (voir `build_salle_essai.py` et `tools/level_v2/build_niveau.py`).
"""

from __future__ import annotations

import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import lib_electro as E         # noqa: E402
import lib_reserve as R         # noqa: E402
import lib_facade as F          # noqa: E402
import lib_rayons as L          # noqa: E402

# UUID des catégories, tels qu'écrits dans assets_src/library/blender_assets.cats.txt.
CATALOGUES = {
    "str_": "6c70dbb8-ebf6-498c-bb3d-be169c5b1cf9",    # Structure
    "mob_": "8b19e618-839e-47c5-bb8f-51d8e41c8e09",    # Mobilier de vente
    "prd_": "e7412685-c6a0-41b1-b934-a58f0bee8f9a",    # Produits
    "sig_": "c5440509-bdce-47ce-90ec-2873627b2daf",    # Signalétique
    "deco_": "df87ad73-13e0-47c1-be84-51e76e8baf76",   # Déco
    "gp_": "97b946f9-02f6-4e67-a2de-ad2e64b443d0",     # Gameplay
    # Véhicules : rangés avec la déco faute de catégorie dédiée dans
    # `blender_assets.cats.txt`, qui est un fichier tenu à la main.
    "veh_": "df87ad73-13e0-47c1-be84-51e76e8baf76",
}


def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def catalog_for(name: str) -> str | None:
    for prefix, uuid in CATALOGUES.items():
        if name.startswith(prefix):
            return uuid
    return None


def main() -> None:
    args = get_args()
    names = L.build_all() + F.build_all() + E.build_all() + R.build_all()

    marked, sans_categorie = 0, []
    for name in names:
        coll = bpy.data.collections.get(name)
        if coll is None:
            continue
        uuid = catalog_for(name)
        if uuid is None:
            sans_categorie.append(name)
            continue
        if coll.asset_data is None:
            coll.asset_mark()
        coll.asset_data.catalog_id = uuid
        marked += 1

    print(f"[bibliothèque] {len(names)} assets construits, {marked} rangés en catégorie")
    if sans_categorie:
        print(f"[bibliothèque] WARN sans catégorie (préfixe inconnu) : {sans_categorie}")

    out = args[args.index("--out") + 1] if "--out" in args else None
    if out:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out))
        print(f"[bibliothèque] écrit : {out}")
    elif "--save" in args:
        bpy.ops.wm.save_mainfile()
        print(f"[bibliothèque] fichier d'entrée réécrit : {bpy.data.filepath}")
    else:
        print("[bibliothèque] ni --save ni --out : rien n'a été écrit")


if __name__ == "__main__":
    main()
