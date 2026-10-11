"""Matières de l'étalon approuvé ; 128 px pour 2 m, variations déterministes.

see: docs/assets/etalon-direction-artistique.md#matières
"""
from pathlib import Path

import bpy
import numpy as np

from tools.metro.quartier.materials import png

RAMPS = {
    "ivoire": ("a49e8d", "c9c1aa", "d8d0b8", "e3dcc8"),
    "sol": ("303a3e", "424f53", "4c585b", "5b6667"),
    "beton": ("414e50", "505e60", "5d6969", "6a7573"),
    "acier": ("303b42", "434d55", "535f64", "677276"),
    "petrole": ("365a54", "487369", "537d74", "6b9184"),
    "bois": ("684c33", "86613e", "9d744a", "b68b5c"),
    "ambre": ("9d7937", "c49b42", "deb44b", "e7ca74"),
}


def indices(name: str) -> np.ndarray:
    y, x = np.mgrid[:128, :128]
    noise = (x * 37 + y * 17 + x * y * 3) % 101
    coarse = ((x // 8 * 11 + y // 8 * 7) % 19)
    hashes = x.astype(np.uint32) * 374761393 + y.astype(np.uint32) * 668265263 + 1447
    hashes = (hashes ^ (hashes >> 13)) * 1274126177
    grain_noise = (hashes ^ (hashes >> 16)) % 101
    result = np.full((128, 128), 2, dtype=np.uint8)
    if name == "ivoire":
        tile = (y // 16 * 17 + (x + (y // 16 % 2) * 16) // 32 * 7) % 13
        result[tile < 3] = 1
        joints = (y % 16 == 0) | ((x + (y // 16 % 2) * 16) % 32 == 0)
        result[joints] = 0
        result[(y % 16 == 1) & ~joints] = 3
        result[(noise > 97) & ~joints] = 1
    elif name == "sol":
        result[:] = 1
        tile = (x // 32 * 5 + y // 32 * 3) % 7
        result[tile == 3] = 2
        joints = (x % 32 == 0) | (y % 32 == 0)
        result[joints] = 0
        result[(x % 32 == 1) & ~joints] = 2
        result[((x + y * 2) % 61 < 2) & (coarse < 3) & ~joints] = 3
    elif name == "sol_voie":
        stain = np.sin(x * 2 * np.pi / 128) + np.sin(y * 2 * np.pi / 128 + .4)
        result[stain < -.8] = 1
        result[(noise < 4) & (stain < .2)] = 0
        result[noise > 98] = 3
        result[y == 0] = 0
        result[y == 1] = 1
    elif name == "beton":
        stain = (np.sin(x * 2 * np.pi / 128) + np.sin(y * 2 * np.pi / 128 + .6)
                 + .45 * np.sin((x - y) * 2 * np.pi / 64))
        result[stain < -1.1] = 1
        result[(noise < 2) & (stain < -.5)] = 0
        result[(noise > 98) & (stain > 1.2)] = 3
        result[(x % 64 == 0) | (y % 64 == 0)] = 0
        result[(x % 64 == 1) | (y % 64 == 1)] = 3
        for cx, cy in ((8, 8), (56, 8), (8, 56), (56, 56)):
            result[((x % 64 - cx) ** 2 + (y % 64 - cy) ** 2) <= 2] = 0
    elif name == "acier":
        result[:] = 1
        result[y % 64 == 0] = 0
        result[y % 64 == 1] = 3
        result[(x % 32 == 0) & (noise < 50)] = 2
        result[(noise > 98) & (coarse < 4)] = 3
    elif name in ("petrole", "ivoire_peint"):
        result[coarse < 2] = 1
        result[(noise > 97) & (coarse < 4)] = 3
        result[y % 64 == 0] = 0
        result[y % 64 == 1] = 3
    elif name == "ivoire_mur":
        result[noise < 3] = 1
        result[(noise < 1) & (coarse < 1)] = 0
        result[noise > 99] = 3
    elif name in ("store_terrazzo", "store_terrazzo_fin"):
        result[:] = 2
        fine = name.endswith("_fin")
        spacing = 16
        for row in range(8):
            for column in range(8):
                seed = (column * 13 + row * 7) % 19
                if seed > (6 if fine else 9):
                    continue
                cx = column * spacing + 5 + seed % 7
                cy = row * spacing + 5 + (seed * 3) % 7
                u = (x - cx + 64) % 128 - 64
                v = (y - cy + 64) % 128 - 64
                rx, ry = ((2, 1.5) if fine else (3 + seed % 3, 2 + seed % 2))
                chip = abs(u + v * .25) / rx + abs(v) / ry < 1.15
                result[chip] = (0, 1, 3, 1, 1)[seed % 5]
        result[noise > 99] = 1
    elif name == "store_carrelage":
        panel = (x // 32 * 5 + y // 32 * 3) % 13
        result[panel < 2] = 1
        joints = (x % 32 == 0) | (y % 32 == 0)
        result[joints] = 0
        result[(y % 32 == 1) & ~joints] = 3
        result[(noise < 2) & ~joints] = 1
    elif name == "store_damier":
        dark = (x // 32 + y // 32) % 2 == 0
        result[dark] = 0
        result[dark & (noise > 97)] = 1
        joints = (x % 32 == 0) | (y % 32 == 0)
        result[joints & ~dark] = 1
        result[(y % 32 == 1) & ~dark & ~joints] = 3
    elif name in ("store_email", "store_rouge", "wc_stratifie"):
        result[noise < 2] = 1
        result[(noise < 1) & (coarse < 2)] = 0
        result[(noise > 99) & (coarse < 3)] = 3
    elif name == "store_perfore":
        holes = (x % 4 == 2) & (y % 4 == 2)
        result[holes] = 0
        result[(noise > 98) & ~holes] = 3
    elif name == "store_carton":
        result[noise < 3] = 1
        result[(noise > 98) & (coarse < 4)] = 3
        result[(noise < 1) & (coarse < 1)] = 0
    elif name == "store_bois":
        grain = (y * 7 + x // 16 * 3 + x // 32) % 29
        result[grain < 2] = 1
        result[(grain == 4) & (noise > 20)] = 3
        result[x % 64 == 0] = 0
    elif name == "wc_faience":
        tile = (x // 16 * 7 + y // 16 * 3) % 17
        result[tile < 2] = 1
        joints = (x % 16 == 0) | (y % 16 == 0)
        result[joints] = 0
        result[(y % 16 == 1) & ~joints] = 3
        result[(noise < 1) & ~joints] = 1
    elif name in ("reserve_sol", "reserve_plafond"):
        aggregate = ((x // 3 * 11 + y // 3 * 19) % 23)
        if name == "reserve_plafond":
            result[aggregate < 3] = 1
        result[(noise < 7) & (aggregate < 8)] = 1
        result[(noise > 96) & (aggregate > 15)] = 3
        result[(x == 0) | (y == 0)] = 0
        result[(x == 1) | (y == 1)] = 3
        if name == "reserve_sol":
            result[noise < 10] = 1
            for seed in range(11):
                cx, cy = (seed * 37 + 11) % 128, (seed * 59 + 17) % 128
                u, v = (x - cx + 64) % 128 - 64, (y - cy + 64) % 128 - 64
                scuff = (abs(u + v * .3) < 2) & (abs(v) < 6 + seed % 5)
                result[scuff] = 1
                result[scuff & (noise < 8)] = 0
        else:
            result[y % 32 == 0] = 1
            for cx, cy in ((8, 8), (120, 8), (8, 120), (120, 120)):
                result[(abs(x - cx) <= 1) & (abs(y - cy) <= 1)] = 0
    elif name == "reserve_enduit":
        shifted = x + (y // 16 % 2) * 16
        block = (shifted // 32 * 7 + y // 16 * 11) % 17
        result[block < 3] = 1
        joints = (y % 16 == 0) | (shifted % 32 == 0)
        result[joints] = 0
        result[(y % 16 == 1) & ~joints] = 3
        result[(noise < 8) & ~joints] = 1
        result[(noise > 97) & ~joints] = 3
        result[(noise < 3) & (coarse < 4) & ~joints] = 0
    elif name == "reserve_rouge":
        result[(noise < 7) & (coarse < 6)] = 1
        scratches = ((x + y * 3) % 59 < 2) & (y % 27 < 8)
        result[scratches] = 3
        result[(noise < 2) & (coarse < 3)] = 0
    elif name == "reserve_carton":
        result[noise < 13] = 1
        result[(noise > 98) & (coarse < 5)] = 3
        result[(x == 62) | (x == 66)] = 0
        result[(x > 62) & (x < 66)] = 1
        result[(x == 63) & (noise > 12)] = 3
        label = (x >= 69) & (x <= 82) & (y >= 58) & (y <= 68)
        result[label] = 3
        result[label & (y >= 59) & (y <= 63) & (x % 3 != 0)] = 0
        result[label & (y == 66) & (x < 78)] = 1
        result[(y == 64) & (x < 59)] = 1
    elif name == "reserve_bois":
        grain = (y * 3 + x // 9 * 2) % 31
        result[grain < 4] = 1
        result[(grain == 5) & (noise > 15)] = 3
        result[y % 10 == 0] = 0
        result[y % 10 == 1] = 3
        result[(x % 32 == 4) & (y % 10 == 5)] = 0
    elif name == "reserve_rideau":
        result[y % 4 == 0] = 1
        result[y % 4 == 1] = 3
        result[(noise < 1) & (y % 4 > 1)] = 1
    elif name == "reserve_fut":
        result[noise < 5] = 1
        result[(noise > 99) & (coarse < 2)] = 3
        result[(y % 32 == 0) | (y % 32 == 1)] = 0
        result[y % 32 == 2] = 3
        label = (x % 64 >= 24) & (x % 64 <= 34) & (y % 64 >= 22) & (y % 64 <= 32)
        result[label] = 3
        result[label & (y % 64 >= 26) & (y % 64 <= 29) & (x % 3 != 0)] = 0
    elif name == "reserve_outil":
        result[noise < 2] = 1
        result[(noise > 99) & (coarse < 3)] = 3
    elif name == "exterior_enduit":
        result[grain_noise < 7] = 1
        result[grain_noise > 98] = 3
        worn = np.sin(x*2*np.pi/128) + np.cos(y*2*np.pi/128) < -1.2
        result[worn & (grain_noise < 20)] = 1
    elif name == "exterior_brique":
        tile = (y//16*7 + (x+(y//16%2)*16)//32*3) % 13
        result[tile < 4] = 1
        joints = (y % 16 == 0) | ((x+(y//16%2)*16) % 32 == 0)
        result[joints] = 0
        result[(y % 16 == 1) & ~joints] = 3
        result[(grain_noise < 7) & ~joints] = 1
    elif name == "exterior_ardoise":
        joints = (y % 16 == 0) | ((x+(y//16%2)*8) % 16 == 0)
        result[joints] = 0
        result[(y % 16 == 1) & ~joints] = 3
        result[(grain_noise < 6) & ~joints] = 1
    elif name == "exterior_pave":
        tile = (y//32*7 + (x+(y//32%2)*16)//32*3) % 17
        result[tile < 5] = 1
        joints = (y % 32 == 0) | ((x+(y//32%2)*16) % 32 == 0)
        result[joints] = 0
        result[(y % 32 == 1) & ~joints] = 3
        result[(grain_noise < 8) & ~joints] = 1
    elif name == "exterior_email":
        result[grain_noise < 3] = 1
        result[(grain_noise > 98) & (coarse < 4)] = 3
    elif name == "exterior_nuit":
        result[grain_noise < 3] = 1
        result[(grain_noise > 98) & (coarse < 3)] = 3
    elif name == "vehicle_surface":
        result[:] = 3
        result[grain_noise < 9] = 2
        result[(grain_noise < 3) & (coarse < 4)] = 1
        result[(grain_noise < 1) & (coarse < 2)] = 0
    elif name in ("finish_asphalte","exterior_rue"):
        result[grain_noise < 18] = 1
        result[grain_noise > 96] = 3
        worn = (np.sin(x*2*np.pi/128) + np.cos(y*2*np.pi/128)) < -.8
        result[worn & (grain_noise < 20)] = 1
    elif name == "finish_beton":
        result[grain_noise < 10] = 1
        result[grain_noise > 98] = 3
        result[x == 0] = 0
        result[x == 1] = 3
        tie = ((x % 64 - 12)**2 + (y % 64 - 12)**2) < 2
        result[tie] = 0
        result[(y % 16 == 0) & (x != 0)] = 1
        result[(y % 16 == 1) & (x > 1)] = 3
    elif name == "finish_plafond":
        joints = (x % 32 == 0) | (y % 32 == 0)
        result[joints] = 0
        result[(y % 32 == 1) & ~joints] = 3
        result[(grain_noise < 3) & ~joints] = 1
        pores = (x % 4 == 0) & (y % 4 == 0) & (grain_noise < 12)
        result[pores & ~joints] = 1
    elif name == "finish_marques":
        result[grain_noise < 5] = 1
        result[grain_noise > 98] = 3
    elif name in ("finish_toile_rouge","finish_toile_claire"):
        weave = (x % 2 == 0) & (y % 2 == 0)
        result[weave] = 1
        result[grain_noise > 97] = 3
    elif name == "annex_enduit":
        result[grain_noise < 5] = 1
        result[grain_noise > 99] = 3
        worn = (np.cos(x*2*np.pi/128) + np.sin(y*2*np.pi/128)) < -1.1
        result[worn & (grain_noise < 35)] = 1
        result[worn & (grain_noise < 2)] = 0
    elif name == "annex_tissu":
        weave = (x % 2 == 0) & (y % 2 == 0)
        result[weave] = 1
        result[(grain_noise > 97) & ~weave] = 3
        result[grain_noise < 1] = 0
    elif name == "annex_plastique":
        result[grain_noise < 5] = 1
        result[(grain_noise > 98) & (coarse < 4)] = 3
    elif name == "annex_tole":
        result[grain_noise < 3] = 1
        seams = (x % 64 == 0) | (y == 0)
        result[seams] = 0
        result[(x % 64 == 1) | (y == 1)] = 3
        rivets = ((x % 64 - 4)**2 + (y % 64 - 4)**2) < 2
        result[rivets] = 0
        result[(x % 32 == 16) & (y % 128 > 4) & (y % 128 < 123)] = 1
    elif name == "annex_plancher":
        result[grain_noise < 8] = 1
        bars = ((x+y) % 16 < 2) & ((x-y) % 16 < 7)
        result[bars] = 3
        result[((x+y) % 16 == 2) & ((x-y) % 16 < 7)] = 0
        result[(x == 0) | (y == 0)] = 0
    elif name == "annex_plafond":
        result[grain_noise < 3] = 1
        result[y % 64 == 0] = 0
        result[y % 64 == 1] = 3
        result[x % 64 == 0] = 1
    elif name == "cold_sol":
        result[grain_noise < 12] = 1
        result[grain_noise > 95] = 3
        grip = ((x % 8 - 4)**2 + (y % 8 - 4)**2) <= 1
        result[grip] = 1
        joints = (x % 64 == 0) | (y % 64 == 0)
        result[joints] = 0
        result[(y % 64 == 1) & ~joints] = 3
    elif name == "cold_paroi":
        result[grain_noise < 8] = 1
        result[grain_noise > 98] = 3
        result[x == 0] = 1
        result[x == 1] = 3
    elif name == "cold_plafond":
        rails = (x == 0) | (y % 64 == 0)
        result[rails] = 0
        result[((x == 1) | (y % 64 == 1)) & ~rails] = 3
        result[(grain_noise < 5) & ~rails] = 1
    elif name == "cold_evaporateur":
        result[y % 4 == 0] = 0
        result[y % 4 == 1] = 1
        result[y % 4 == 3] = 3
        result[(grain_noise < 4) & (y % 4 == 2)] = 1
    elif name == "cold_givre":
        cloud = np.sin(x*2*np.pi/128) + np.cos(y*2*np.pi/128)
        result[cloud < -.6] = 1
        result[(grain_noise > 80) & (cloud > .2)] = 3
        result[(grain_noise < 12) & (cloud < -.5)] = 0
    elif name == "service_peint":
        result[(grain_noise < 10) & (coarse < 6)] = 1
        result[grain_noise > 98] = 3
        chips = ((x+y*3) % 61 < 2) & (y % 37 < 7)
        result[chips] = 1
        result[chips & (grain_noise < 12)] = 0
    elif name == "atelier_gres":
        result[grain_noise < 13] = 1
        result[grain_noise > 96] = 3
        joints = (x % 16 == 0) | (y % 16 == 0)
        result[joints] = 0
        result[(y % 16 == 1) & ~joints] = 3
    elif name == "atelier_faience":
        joints = (x % 16 == 0) | (y % 16 == 0)
        result[joints] = 0
        result[(y % 16 == 1) & ~joints] = 3
        result[(grain_noise < 3) & ~joints] = 1
    elif name == "atelier_plafond":
        rails = (x % 64 == 0) | (y == 0)
        result[rails] = 0
        result[((x % 64 == 1) | (y == 1)) & ~rails] = 3
        result[(grain_noise < 4) & ~rails] = 1
    elif name in ("atelier_inox", "atelier_noir"):
        result[(y % 19 == 0) & (grain_noise < 65)] = 1
        result[(y % 31 == 0) & (grain_noise > 30)] = 3
        result[(grain_noise < 3) & (coarse < 5)] = 0
        result[(grain_noise < 8) & (coarse < 7)] = 1
    elif name == "atelier_planche":
        result[grain_noise < 7] = 1
        cut = ((x + y * 2) % 57 < 2) & (y % 41 < 19)
        result[cut] = 1
        result[cut & (grain_noise < 7)] = 0
        result[grain_noise > 98] = 3
    elif name == "atelier_email":
        result[grain_noise < 5] = 1
        result[(grain_noise > 98) & (coarse < 4)] = 3
        result[x % 64 == 0] = 0
        result[x % 64 == 1] = 3
    elif name == "office_enduit":
        result[grain_noise < 12] = 1
        result[grain_noise > 97] = 3
        patch = ((x // 7 * 17 + y // 11 * 13) % 29 < 3)
        result[patch & (grain_noise < 28)] = 1
        result[x == 0] = 1
        result[x == 1] = 3
    elif name == "office_plafond_vestiaires":
        rails = (x % 64 == 0) | (y % 32 == 0)
        result[rails] = 0
        result[((x % 64 == 1) | (y % 32 == 1)) & ~rails] = 3
        holes = (x % 8 == 4) & ((y % 8 == 3) | (y % 8 == 4))
        result[holes & ~rails] = 1
        result[(grain_noise < 3) & ~rails] = 1
    elif name in ("office_plafond", "office_plafond_pc", "office_carrelage"):
        tile = (x // 32 * 7 + y // 32 * 3) % 17
        result[tile < 2] = 1
        joints = (x % 32 == 0) | (y % 32 == 0)
        result[joints] = 0
        result[(y % 32 == 1) & ~joints] = 3
        result[(grain_noise < 4) & ~joints] = 1
        result[(grain_noise > 98) & ~joints] = 3
    elif name == "office_moquette_bleue":
        result[:] = 1
        result[grain_noise > 57] = 2
        fibers = ((x//2+y//3*7) % 23 == 0) & (grain_noise < 40)
        result[fibers] = 0
        result[grain_noise > 97] = 3
    elif name == "office_acoustique":
        result[grain_noise < 5] = 1
        result[(grain_noise > 97) & (coarse < 9)] = 3
        pores = (x % 4 == 0) & (y % 4 == 0) & (grain_noise < 25)
        result[pores] = 0
    elif name == "office_ossature":
        result[grain_noise < 3] = 1
        result[(grain_noise > 98) & (coarse < 3)] = 3
    elif name == "office_moquette":
        result[:] = 1
        tile = (x // 32 * 7 + y // 32 * 3) % 11
        weave = ((x + np.where(tile % 2 == 0, y, -y)) % 3 == 0)
        result[weave] = 2
        result[(grain_noise < 5) & ~weave] = 0
        result[(grain_noise > 94) & weave] = 3
        result[(x % 32 == 0) | (y % 32 == 0)] = 0
    elif name == "office_bois":
        grain = (y * 3 + x // 13 * 2 + x // 31) % 47
        result[grain < 5] = 1
        result[(grain == 7) & (noise > 20)] = 3
        result[(grain < 2) & (x % 51 < 29)] = 0
        result[x == 0] = 1
    elif name == "office_metal":
        result[(y % 23 == 0) & (noise < 80)] = 1
        result[(y % 29 == 0) & (noise > 30)] = 3
        result[(noise < 3) & (coarse < 5)] = 0
        result[(noise < 8) & (coarse < 9)] = 1
    elif name == "office_peint":
        result[noise < 6] = 1
        result[(noise > 97) & (coarse < 6)] = 3
        result[(x % 64 == 0) | (y % 32 == 0)] = 0
        result[(x % 64 == 1) | (y % 32 == 1)] = 3
    elif name == "office_dossiers":
        result[noise < 8] = 1
        result[y % 5 == 0] = 1
        result[(y % 5 == 1) & (noise > 30)] = 3
        result[(x % 32 == 5) & (y % 16 < 10)] = 0
    elif name == "store_enduit":
        stain = np.sin(x * 2 * np.pi / 128) + .5 * np.sin(y * 2 * np.pi / 128)
        result[(noise < 3) & (stain < .5)] = 1
        result[(noise > 99) & (stain > .8)] = 3
        result[(noise < 1) & (coarse < 1) & (stain < -.8)] = 0
    elif name == "store_plafond":
        panels = (x // 32 * 7 + y // 32 * 3) % 13
        result[panels < 2] = 1
        seams = (x % 32 == 0) | (y % 32 == 0)
        result[seams] = 0
        result[(y % 32 == 1) & ~seams] = 3
        result[(noise < 2) & ~seams] = 1
    elif name == "store_stratifie":
        result[noise < 3] = 1
        result[(noise > 99) & (coarse < 3)] = 3
        result[x % 64 == 0] = 1
        result[(x % 64 == 1) & (noise < 10)] = 0
    elif name == "store_inox":
        result[(y % 17 == 0) & (noise < 70)] = 1
        result[(y % 31 == 0) & (noise > 40)] = 3
        result[(noise < 1) & (coarse < 3)] = 0
    elif name == "store_plastique":
        result[:] = 1
        result[noise > 98] = 2
        result[(noise > 99) & (coarse < 3)] = 3
    elif name == "store_tapis":
        result[:] = 1
        result[y % 4 == 0] = 2
        result[(noise < 2) & (y % 4 != 0)] = 0
    elif name == "fret_paroi":
        result[noise < 3] = 1
        result[(noise > 99) & (coarse < 3)] = 3
        result[(noise < 1) & (coarse < 1)] = 0
    elif name == "sol_rame":
        result[:] = 1
        stud = (x % 8 - 4) ** 2 + (y % 8 - 4) ** 2
        result[stud < 3] = 2
        result[(stud == 2) & (y % 8 > 4)] = 0
        result[(noise > 99) & (stud > 3)] = 2
    elif name == "fret_tissu":
        result[(x % 4 == 0) & (y % 4 < 2)] = 1
        result[(y % 4 == 0) & (x % 4 < 2)] = 3
        result[(noise < 1) & (coarse < 3)] = 0
    elif name == "fret_cable":
        result[:] = 1
        result[noise < 3] = 0
        result[noise > 98] = 2
    elif name == "bois":
        grain = (y * 7 + (x // 16) * 3 + x // 32) % 29
        result[grain < 3] = 1
        result[(grain == 4) & (noise > 15)] = 3
        result[x % 32 == 0] = 0
    elif name == "ambre":
        result[noise < 6] = 1
        result[noise > 98] = 3
    elif name in ("atelier_bleu", "bogie_bleu", "passage_depot"):
        wear = np.sin(x * 2 * np.pi / 128) + np.sin(y * 2 * np.pi / 128 + .6)
        result[wear < -1.2] = 1
        result[(noise < 2) & (wear < -.5)] = 0
        result[(noise > 98) & (wear > 1)] = 3
    elif name in ("atelier_metal", "bogie_metal", "relais_cuivre"):
        result[(y % 17 == 0) & (noise < 70)] = 1
        result[(y % 31 == 0) & (noise > 40)] = 3
        result[(noise < 1) & (coarse < 3)] = 0
    elif name == "bogie_web":
        result[noise < 3] = 1
        result[noise > 99] = 3
    elif name == "prive_pierre":
        panel = (x // 64 * 5 + y // 32 * 3) % 11
        result[panel < 2] = 1
        joints = (x % 64 == 0) | (y % 32 == 0)
        result[joints] = 0
        result[(y % 32 == 1) & ~joints] = 3
        result[(noise < 2) & ~joints] = 1
    elif name == "prive_sol":
        panel = (x // 64 * 5 + y // 64 * 3) % 7
        result[:] = 1
        result[panel == 3] = 2
        joints = (x % 64 == 0) | (y % 64 == 0)
        result[joints] = 0
        result[(noise > 97) & ~joints] = 2
        result[(noise > 99) & (coarse < 2) & ~joints] = 3
    elif name == "prive_pave":
        shifted = x + (y // 16 % 2) * 16
        block = (shifted // 32 * 7 + y // 16 * 5) % 11
        result[block < 4] = 1
        joints = (shifted % 32 == 0) | (y % 16 == 0)
        result[joints] = 0
        result[(y % 16 == 1) & ~joints] = 3
        result[(noise < 3) & ~joints] = 1
    elif name == "parvis_feuillage":
        result[:] = 0
        u, v = x % 16 - 8, y % 16 - 8
        direction = np.where((x // 16 + y // 16) % 2 == 0, 1, -1)
        along, across = (u + direction * v) / 1.414, (v - direction * u) / 1.414
        leaf = (along / 7) ** 2 + (across / 3.5) ** 2 < 1
        result[leaf] = 1
        result[leaf & (across < 0)] = 2
        result[leaf & (abs(across) < .7) & (along > -4)] = 3
    return result


def build_materials(source: dict, output: Path, palettes: dict | None = None) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    result = {}
    for name, colors in (RAMPS if palettes is None else palettes).items():
        ramp = np.array([[int(value[k:k + 2], 16) for k in (0, 2, 4)]
                         for value in colors], dtype=np.uint8)
        path = output / f"{name}.png"
        png(path, ramp[indices(name)])
        image = bpy.data.images.load(str(path), check_existing=False)
        image.colorspace_settings.name = "sRGB"
        image.pack()
        material = source[name].copy()
        material.name = "da_" + name
        shader = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
        for node in list(material.node_tree.nodes):
            if node.type == "TEX_IMAGE":
                material.node_tree.nodes.remove(node)
        shader.inputs["Base Color"].default_value = (1, 1, 1, 1)
        shader.inputs["Roughness"].default_value = .9
        node = material.node_tree.nodes.new("ShaderNodeTexImage")
        node.image, node.interpolation, node.extension = image, "Closest", "REPEAT"
        material.node_tree.links.new(node.outputs["Color"], shader.inputs["Base Color"])
        result[name] = material
    return result
