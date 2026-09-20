"""
Empaquetage en audio sprite + manifeste Howler.

    python3 tools/audio/build_sprite.py assets/audio/wav --out public/audio/sfx

Produit sfx.ogg, sfx.m4a et sfx.json pret a passer a Howler. Un seul
decodage, une seule requete, latence minimale — c'est le pattern recommande
pour les effets courts d'un jeu.

L'ambiance est EXCLUE du sprite : elle est longue, bouclee, et se charge en
streaming (html5: true). La mettre dans le sprite gonflerait le decodage
initial pour rien.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import shutil
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import SR, read_wav, write_wav  # noqa: E402

GAP = 0.12        # silence entre deux sons : evite qu'une queue deborde
POOL = 12

# Marge de crete de l'atlas, AVANT encodage.
#
# Un encodeur avec perte depasse son entree, et d'autant plus que le signal a
# des marches nettes. Mesure au decodeur du navigateur, le seul qui ne rabote
# pas a 1.0 — les autres ecretent en silence et on ne voit rien :
#
#   AVEC le grain retro, atlas a 0.95 -> ogg +2.6 dB, ~20 echantillons ecretes
#                        atlas a 0.89 -> ogg +1.44 dB (13 ech.)
#                        atlas a 0.80 -> ogg +0.96 dB (3 ech.)
#   SANS le grain,       atlas a 0.80 -> ogg -0.97 dB, ZERO ecretage
#
# C'est le `crush` qui causait le depassement : ses paliers d'echantillon
# bloque sont des marches verticales, precisement ce qu'un encodeur ne sait pas
# representer et compense en depassant. Retire du defaut le 2026-09-20, le
# probleme part avec lui, et le decibel qu'il fallait sacrifier revient.
PEAK = 0.85


def dispo(programme: str) -> bool:
    return shutil.which(programme) is not None


def essayer(tentatives: list[list[str]], dst: str) -> bool:
    """Lance les commandes dans l'ordre, s'arrete a la premiere qui reussit.

    ESSAYER, pas choisir : la presence d'un encodeur ne dit pas qu'il sait
    faire le travail. Le ffmpeg de Homebrew est livre SANS libvorbis — le
    preferer parce qu'il est installe a produit un sprite sans .ogg, donc un
    jeu muet sur Chrome et Firefox, pendant que `oggenc` attendait a cote.
    """
    dernier = ""
    for commande in tentatives:
        if not dispo(commande[0]):
            continue
        try:
            subprocess.run(commande, capture_output=True, check=True)
            return True
        except subprocess.CalledProcessError as e:
            dernier = f"{commande[0]}: {e.stderr.decode()[-160:]}"
    if dernier:
        print(f"  echec encodage {dst} ({dernier})")
    return False


def vers_ogg(src: str, dst: str, qualite: int) -> bool:
    """WAV -> Vorbis, par ffmpeg ou par oggenc."""
    # Pas de --downmix sur oggenc : tout le studio est mono par construction,
    # et l'option ne ferait qu'avertir qu'elle n'a rien a faire.
    return essayer([
        ["ffmpeg", "-y", "-i", src, "-c:a", "libvorbis", "-q:a", str(qualite), "-ac", "1", dst],
        ["oggenc", "-Q", "-q", str(qualite), "-o", dst, src],
    ], dst)


def vers_m4a(src: str, dst: str, kbps: int) -> bool:
    """WAV -> AAC, par ffmpeg ou par afconvert (livre avec macOS).

    Les DEUX formats sont obligatoires, ce n'est pas une ceinture-bretelles :
    Howler choisit UN seul fichier d'apres le codec que le navigateur declare
    supporter, et ne se rabat PAS sur l'autre si celui-la manque. Livrer le
    sprite en ogg seul, c'est un jeu muet sur Safari.
    """
    return essayer([
        ["ffmpeg", "-y", "-i", src, "-c:a", "aac", "-b:a", f"{kbps}k", "-ac", "1", dst],
        ["afconvert", "-f", "m4af", "-d", "aac", "-b", str(kbps * 1000), src, dst],
    ], dst)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--out", required=True)
    ap.add_argument("--gap", type=float, default=GAP)
    ap.add_argument("--peak", type=float, default=PEAK, help="marge de crete de l'atlas")
    args = ap.parse_args()

    paths = sorted(glob.glob(os.path.join(args.folder, "*.wav")))
    sfx = [p for p in paths if not os.path.basename(p).startswith("amb_")]
    amb = [p for p in paths if os.path.basename(p).startswith("amb_")]
    if not sfx:
        print(f"Aucun SFX sous {args.folder}")
        sys.exit(1)

    os.makedirs(args.out, exist_ok=True)

    chunks, sprite, cursor = [], {}, 0.0
    gap = np.zeros(int(args.gap * SR))
    for p in sfx:
        x, sr = read_wav(p)
        if sr != SR:
            print(f"  ATTENTION {p}: {sr} Hz != {SR}, ignore")
            continue
        name = os.path.splitext(os.path.basename(p))[0]
        dur_ms = 1000.0 * len(x) / SR
        sprite[name] = [round(cursor * 1000, 1), round(dur_ms, 1)]
        chunks += [x, gap]
        cursor += (len(x) + len(gap)) / SR

    atlas = np.concatenate(chunks)
    wav_path = os.path.join(args.out, "sfx.wav")
    write_wav(wav_path, atlas, SR, peak=args.peak)

    manifest = {
        "src": ["sfx.ogg", "sfx.m4a"],
        "sprite": sprite,
        "pool": POOL,
        "_note": ("Genere par tools/audio/build_sprite.py. "
                  "Ne pas editer a la main — modifier recipes.py et regenerer."),
    }

    sizes = {}
    if vers_ogg(wav_path, os.path.join(args.out, "sfx.ogg"), 4):
        sizes["ogg"] = os.path.getsize(os.path.join(args.out, "sfx.ogg")) / 1024
    if vers_m4a(wav_path, os.path.join(args.out, "sfx.m4a"), 96):
        sizes["m4a"] = os.path.getsize(os.path.join(args.out, "sfx.m4a")) / 1024
    for p in amb:
        n = os.path.splitext(os.path.basename(p))[0]
        if vers_ogg(p, os.path.join(args.out, f"{n}.ogg"), 3):
            sizes[n] = os.path.getsize(os.path.join(args.out, f"{n}.ogg")) / 1024
    if not sizes:
        print("  aucun encodeur (ni ffmpeg, ni oggenc/afconvert) — seul le WAV est produit")

    with open(os.path.join(args.out, "sfx.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    W = 62
    print("\n" + "=" * W)
    print("AUDIO SPRITE")
    print("=" * W)
    print(f"  Sons empaquetes   {len(sprite)}")
    print(f"  Duree atlas       {cursor:.2f} s")
    print(f"  Ambiances         {len(amb)} (hors sprite, streaming)")
    if sizes:
        print("-" * W)
        for k, v in sorted(sizes.items()):
            print(f"  {k:<18} {v:>8.0f} Ko")
        print(f"  TOTAL              {sum(sizes.values()) / 1024:>7.2f} Mo   (budget 8 Mo)")
    print("-" * W)
    print(f"  -> {args.out}/sfx.json")
    print("=" * W + "\n")

    if sum(sizes.values()) / 1024 > 8:
        print("  DEPASSEMENT du budget audio de 8 Mo.\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
