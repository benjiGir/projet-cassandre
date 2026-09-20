"""Importe les sons CC0 des packs bruts vers `public/assets/audio/sfx`.

    ./.venv-refs/bin/python3 tools/audio/import_sfx.py            # tout
    ./.venv-refs/bin/python3 tools/audio/import_sfx.py shotgun_fire pistol_fire
    ./.venv-refs/bin/python3 tools/audio/import_sfx.py --liste    # la table, sans rien écrire

Les sons du jeu étaient des PLACEHOLDERS synthétisés (`tools/audio/` n'existait
pas : le code de synthèse vivait dans des scripts jetables). Ils viennent
maintenant de vrais enregistrements CC0, dont la trace est dans
`assets_src/LICENCES_ASSETS.md` ; les archives brutes restent dans
`assets_src/cc0_raw/`, gitignoré. Ce fichier est la RECETTE : il dit quel son
du pack devient quel son du jeu, et comment il est traité — sans lui, le choix
ne serait reproductible qu'à la main.

Chaîne de traitement, dans l'ordre :

1. décodage (WAV directement, OGG via `oggdec`) ;
2. **mono** — le jeu n'a pas de son positionnel, un fichier stéréo doublerait
   le poids pour rien ;
3. recherche de l'ATTAQUE (premier échantillon au-dessus du seuil) et coupe
   juste avant : les prises de la bibliothèque d'armes commencent par des
   secondes de silence, et un son de jeu doit claquer au moment où on appuie ;
4. coupe à la durée voulue, avec fondu de sortie — une queue de réverbération
   de dix secondes sur un tir qui se répète trois fois par seconde est
   inutilisable ;
5. normalisation de la crête ;
6. rééchantillonnage à **22 050 Hz** : c'est le grain de l'époque Build (Duke
   Nukem 3D tournait en 11 kHz), ça divise le poids par deux, et au-delà de
   11 kHz il ne reste que le souffle ;
7. encodage `.ogg` (`oggenc`) ET `.m4a` (`afconvert`). Les deux sont
   obligatoires : Howler choisit UN seul fichier d'après le codec supporté par
   le navigateur, sans repli si l'autre manque (voir docs/systems/hud-audio.md).
"""

from __future__ import annotations

import argparse
import math
import os
import subprocess
import sys
import tempfile
import wave
from dataclasses import dataclass

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BRUT = os.path.join(ROOT, "assets_src", "cc0_raw")
SORTIE = os.path.join(ROOT, "public", "assets", "audio", "sfx")

# Fréquence de sortie : voir l'étape 6 de la doc de tête.
HZ = 22050
# Crête visée, en dB sous le maximum. Pas 0 : un encodeur avec perte dépasse
# volontiers l'original de quelques dixièmes de dB, et ça sature.
CRETE_DB = -1.5


@dataclass(frozen=True)
class Source:
    """Un son du jeu et la prise dont il sort."""

    chemin: str
    """Relatif à `assets_src/cc0_raw/`."""
    duree: float
    """Durée finale maximale, secondes (fondu de sortie compris)."""
    pack: str
    """Clé de pack, pour le rapport et le registre de licences."""
    avance: float = 0.004
    """Silence gardé avant l'attaque, secondes."""
    seuil: float = 0.02
    """Niveau (0..1) à partir duquel on considère que le son a commencé."""
    fondu: float = 0.06
    """Fondu de sortie, secondes."""
    gain: float = 1.0
    """Multiplicateur appliqué APRÈS normalisation — pour asseoir un son trop en avant."""


K = "kenney_audio"
F = "firearm_library/Prepared SFX Library"

# La table. Un son du jeu, une prise. Les commentaires disent POURQUOI cette
# prise-là : c'est la seule chose qu'on ne peut pas relire dans le résultat.
SOURCES: dict[str, Source] = {
    # --- Armes -------------------------------------------------------------
    # Winchester Model 12 : un VRAI pompe 12, pris au plus près. C'est l'arme
    # du jeu, pas un substitut.
    "shotgun_fire": Source(f"{F}/Model 12/K_22P.wav", duree=0.90, pack="firearm_library"),
    # Colt 1911 .45 : le pistolet le plus « gros » de la bibliothèque, pour que
    # l'arme de poing ne fasse pas jouet à côté du pompe.
    "pistol_fire": Source(f"{F}/1911/A_42P.wav", duree=0.55, pack="firearm_library"),
    # Pied-de-biche : un sifflement de lame, sans impact — l'impact vient de
    # `impact_*`, joué séparément quand le coup touche.
    "melee_fire": Source(f"{K}/kenney_rpg-audio/Audio/knifeSlice2.ogg", duree=0.35, pack="kenney_rpg_audio"),
    # --- Impacts -----------------------------------------------------------
    "impact_concrete": Source(f"{K}/kenney_impact-sounds/Audio/impactMining_000.ogg", duree=0.35,
                              pack="kenney_impact_sounds"),
    "impact_metal": Source(f"{K}/kenney_impact-sounds/Audio/impactMetal_medium_000.ogg", duree=0.35,
                           pack="kenney_impact_sounds"),
    # « Soft » plutôt que « Punch » : un impact de balle dans un corps est mat,
    # pas un coup de poing de film.
    "impact_flesh": Source(f"{K}/kenney_impact-sounds/Audio/impactSoft_medium_000.ogg", duree=0.30,
                           pack="kenney_impact_sounds"),
    # --- Portes ------------------------------------------------------------
    "door_swing": Source(f"{K}/kenney_rpg-audio/Audio/doorOpen_2.ogg", duree=0.80, pack="kenney_rpg_audio"),
    "door_locked": Source(f"{K}/kenney_interface-sounds/Audio/error_004.ogg", duree=0.45,
                          pack="kenney_interface_sounds"),
    # Lecteur de carte qui accepte : un bip de validation, pas un carillon.
    "door_unlock": Source(f"{K}/kenney_interface-sounds/Audio/confirmation_002.ogg", duree=0.60,
                          pack="kenney_interface_sounds"),
    # --- Ramassages et secrets ---------------------------------------------
    "secret_found": Source(f"{K}/kenney_interface-sounds/Audio/bong_001.ogg", duree=1.20,
                           pack="kenney_interface_sounds"),
    "heal_pickup": Source(f"{K}/kenney_interface-sounds/Audio/pluck_001.ogg", duree=0.45,
                          pack="kenney_interface_sounds"),
    # Cliquetis métallique : une boîte de munitions, pas une trousse.
    "ammo_pickup": Source(f"{K}/kenney_rpg-audio/Audio/handleCoins.ogg", duree=0.60, pack="kenney_rpg_audio"),
    # --- Props et vitres ---------------------------------------------------
    "prop_break_wood": Source(f"{K}/kenney_impact-sounds/Audio/impactWood_heavy_001.ogg", duree=0.70,
                              pack="kenney_impact_sounds"),
    "prop_break_glass": Source(f"{K}/kenney_impact-sounds/Audio/impactGlass_heavy_000.ogg", duree=0.90,
                               pack="kenney_impact_sounds"),
}

# Sons encore SYNTHÉTIQUES, faute d'équivalent CC0 : les trois vocalisations de
# Costard (aucun pack CC0 n'a de grognements) et les deux portes mécaniques du
# niveau v2 (aucun pack n'a de porte automatique ni de rideau métallique).
RESTES_SYNTHETIQUES = ("enemy_alert", "enemy_telegraph", "enemy_hurt", "enemy_death",
                       "door_slide", "door_shutter")


def lire(chemin: str) -> tuple[np.ndarray, int]:
    """(échantillons float32 mono dans [-1, 1], fréquence). OGG décodé par `oggdec`."""
    if chemin.lower().endswith(".ogg"):
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            temporaire = tmp.name
        subprocess.run(["oggdec", "-Q", "-o", temporaire, chemin], check=True)
        try:
            return lire(temporaire)
        finally:
            os.unlink(temporaire)

    with wave.open(chemin, "rb") as w:
        canaux, octets, hz, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        brut = w.readframes(n)

    if octets == 2:
        data = np.frombuffer(brut, dtype="<i2").astype(np.float32) / 32768.0
    elif octets == 3:
        # 24 bits : trois octets par échantillon, que numpy ne sait pas lire
        # directement — on les remonte en 32 bits signés.
        octets_bruts = np.frombuffer(brut, dtype=np.uint8).reshape(-1, 3)
        entiers = (octets_bruts[:, 0].astype(np.int32)
                   | (octets_bruts[:, 1].astype(np.int32) << 8)
                   | (octets_bruts[:, 2].astype(np.int32) << 16))
        entiers = np.where(entiers & 0x800000, entiers - 0x1000000, entiers)
        data = entiers.astype(np.float32) / 8388608.0
    elif octets == 4:
        data = np.frombuffer(brut, dtype="<i4").astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"{chemin} : {octets * 8} bits par échantillon, non géré")

    if canaux > 1:
        data = data.reshape(-1, canaux).mean(axis=1)
    return data, hz


def traiter(data: np.ndarray, hz: int, s: Source) -> np.ndarray:
    """Attaque, coupe, fondu, normalisation, rééchantillonnage — voir la doc de tête."""
    crete = float(np.max(np.abs(data))) or 1.0
    fort = np.flatnonzero(np.abs(data) > s.seuil * crete)
    debut = max(0, int(fort[0] - s.avance * hz)) if fort.size else 0
    data = data[debut:debut + int(s.duree * hz)]

    n_fondu = min(len(data), int(s.fondu * hz))
    if n_fondu > 1:
        data = data.copy()
        data[-n_fondu:] *= np.linspace(1.0, 0.0, n_fondu, dtype=np.float32)

    crete = float(np.max(np.abs(data))) or 1.0
    data = data / crete * (10 ** (CRETE_DB / 20)) * s.gain

    if hz != HZ:
        n = int(round(len(data) * HZ / hz))
        data = np.interp(np.linspace(0, len(data) - 1, n), np.arange(len(data)), data).astype(np.float32)
    return np.clip(data, -1.0, 1.0)


def ecrire(data: np.ndarray, sfx: str) -> tuple[int, int]:
    """WAV 16 bits temporaire -> `.ogg` + `.m4a` dans `public/assets/audio/sfx`."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        temporaire = tmp.name
    with wave.open(temporaire, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(HZ)
        w.writeframes((data * 32767).astype("<i2").tobytes())

    ogg = os.path.join(SORTIE, f"{sfx}.ogg")
    m4a = os.path.join(SORTIE, f"{sfx}.m4a")
    try:
        subprocess.run(["oggenc", "-Q", "-q", "4", "-o", ogg, temporaire], check=True)
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-q", "127", temporaire, m4a], check=True)
    finally:
        os.unlink(temporaire)
    return os.path.getsize(ogg), os.path.getsize(m4a)


def main() -> None:
    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument("sfx", nargs="*", help="sons à réimporter (tous par défaut)")
    parseur.add_argument("--liste", action="store_true", help="affiche la table sans rien écrire")
    args = parseur.parse_args()

    if args.liste:
        for sfx, s in SOURCES.items():
            print(f"  {sfx:<18} {s.duree:>4.2f} s  {s.chemin}")
        print(f"  encore synthétiques : {', '.join(RESTES_SYNTHETIQUES)}")
        return

    demandes = args.sfx or list(SOURCES)
    inconnus = [s for s in demandes if s not in SOURCES]
    if inconnus:
        sys.exit(f"[sfx] inconnu(s) : {', '.join(inconnus)}")

    os.makedirs(SORTIE, exist_ok=True)
    total = 0
    for sfx in demandes:
        s = SOURCES[sfx]
        chemin = os.path.join(BRUT, s.chemin)
        if not os.path.exists(chemin):
            sys.exit(f"[sfx] source absente : {chemin}\n"
                     f"      les packs bruts sont gitignorés, voir assets_src/LICENCES_ASSETS.md")
        data, hz = lire(chemin)
        data = traiter(data, hz, s)
        ogg, m4a = ecrire(data, sfx)
        total += ogg + m4a
        print(f"[sfx] {sfx:<18} {len(data) / HZ:>4.2f} s  {ogg / 1024:>5.1f} Ko ogg  {m4a / 1024:>5.1f} Ko m4a"
              f"  <- {os.path.basename(s.chemin)}")
    print(f"[sfx] {len(demandes)} sons, {total / 1024:.0f} Ko au total ({HZ} Hz mono)")
    print(f"[sfx] encore synthétiques : {', '.join(RESTES_SYNTHETIQUES)}")


if __name__ == "__main__":
    main()
