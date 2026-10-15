"""Matières partagées par les passes de finition du métro.

see: docs/5-guides/direction-artistique.md
"""
from pathlib import Path

from tools.art_direction.surface_recipes import RAMPS, build_materials

TEXTURES = Path(__file__).resolve().parents[2] / "assets_src/library/art_direction/textures"
DEPOT_RAMPS = {
    "atelier_bleu": ("354b57", "49616f", "587783", "70919b"),
    "bogie_bleu": ("415b61", "56777c", "63878a", "7c9d9c"),
    "atelier_metal": ("757f7b", "949f99", "a8b1aa", "bcc4bb"),
    "bogie_metal": ("757f7b", "949f99", "a8b1aa", "bcc4bb"),
    "bogie_web": ("3b4844", "4b5953", "596761", "6d7a71"),
    "relais_cuivre": ("765035", "946740", "ad7d4a", "be9563"),
    "passage_depot": ("465650", "586b60", "65786a", "7f907c"),
}
ARRIVAL_RAMPS = {
    "prive_pierre": ("81959a", "b0bfc1", "b6c5c7", "c6d2d3"),
    "prive_sol": ("34434b", "4c6069", "52666f", "667b83"),
    "prive_pave": ("5c706e", "758583", "8a9993", "a9b6ac"),
    "parvis_feuillage": ("2f4c45", "3f6657", "5f8065", "7f9670"),
}

SERVICE_RAMPS = {
    "fret_paroi": ("a4ad9e", "c0c6b5", "c8cdbe", "d6d9cb"),
    "sol_rame": ("343f41", "414d4e", "4a5655", "5a6660"),
    "fret_tissu": ("344f48", "4e725f", "547865", "60816b"),
    "fret_cable": ("182728", "233735", "30423e", "48584e"),
}


def build(a) -> dict:
    source = {**a.mats, "ivoire_peint": a.mats["agents_ivoire"],
              "ivoire_mur": a.mats["enduit"], "sol_voie": a.mats["sol"],
              "prive_pave": a.mats["pave"], "sol_rame": a.mats["sol"]}
    palettes = {**RAMPS, **DEPOT_RAMPS, **ARRIVAL_RAMPS, **SERVICE_RAMPS, "ivoire_peint": RAMPS["ivoire"],
                "ivoire_mur": RAMPS["ivoire"], "sol_voie": RAMPS["sol"]}
    return build_materials(source, TEXTURES, palettes)
