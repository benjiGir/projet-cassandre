"""
Rendu des recettes vers WAV.

    python3 tools/audio/render_sfx.py --out assets/audio/wav
    python3 tools/audio/render_sfx.py --out w --only shotgun,suit_telegraph
    python3 tools/audio/render_sfx.py --out w --cat weapon --crush

Le WAV est un artefact de build. La source est recipes.py, en texte, versionne.
Regenerable a l'identique : meme seed, meme octet.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from recipes import RECIPES              # noqa: E402
from synth import SR, crush, write_wav   # noqa: E402

# Grain retro, RETIRE DU DEFAUT le 2026-09-20 apres mesure.
#
# L'intention etait « l'equivalent audio du 640x360 ». Le resultat mesure est
# autre chose : la reduction de taux se fait par blocage d'echantillon, sans
# filtre, donc elle ne coupe pas l'aigu — elle le REPLIE. Sur les sons qui
# vivent dans l'aigu, elle injecte un parasite presque aussi fort que le son
# lui-meme, et fabrique des frequences qui n'existaient pas :
#
#   impact_metal    bruit ajoute a -1.7 dB du signal, +1.9 dB de faux aigu
#   impact_glass    -2.9 dB, aigu fabrique
#   pistol_fire     -2.9 dB, +1.8 dB de faux aigu
#   crowbar_metal   -4.4 dB, +2.5 dB de faux aigu
#
# A -6 dB il y a autant de parasite que de son utile ; plusieurs sont au-dessus.
# Sur un impact metal ou un bris de verre — precisement les sons dont la
# richesse fait qu'on les reconnait — on remplacait le detail par du bruit.
#
# Le grain reste disponible en OPTION (`--crush`), et `synth.crush` reste une
# brique : un son qui passe par un haut-parleur DANS LA FICTION (annonce au
# micro, interphone, talkie) a de bonnes raisons d'etre degrade. Ce qui etait
# faux, c'est de l'appliquer a tout.
CRUSH = dict(bits=10, rate=22050)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", default=None, help="liste de noms, separes par des virgules")
    ap.add_argument("--cat", default=None, help="weapon|impact|pickup|enemy|interact|ui|ambience")
    ap.add_argument("--variants", action="store_true",
                    help="rend aussi les variantes de seed declarees")
    ap.add_argument("--crush", action="store_true",
                    help="applique le grain retro (hors defaut, voir CRUSH)")
    ap.add_argument("--manifest", default=None)
    args = ap.parse_args()

    names = set(args.only.split(",")) if args.only else None
    os.makedirs(args.out, exist_ok=True)

    rendered, total = [], 0.0
    for name, (fn, cat, nvar) in RECIPES.items():
        if names and name not in names:
            continue
        if args.cat and cat != args.cat:
            continue

        seeds = range(nvar) if (args.variants and nvar > 1) else [0]
        for s in seeds:
            sig = fn(seed=s)
            # Deux categories y echappent meme quand on le demande, pour des
            # raisons opposees : l'ambiance est une nappe tenue ou le grain
            # s'entend en continu, et l'UI est faite de sinus purs ou la
            # quantification ajoute des harmoniques parasites.
            if args.crush and cat not in ("ambience", "ui"):
                sig = crush(sig, **CRUSH)
            stem = name if len(list(seeds)) == 1 else f"{name}_{s}"
            info = write_wav(os.path.join(args.out, f"{stem}.wav"), sig, SR)
            info.update(name=stem, cat=cat, seed=s)
            rendered.append(info)
            total += info["duration"]

    W = 62
    print("\n" + "=" * W)
    print("RENDU")
    print("=" * W)
    by_cat: dict[str, int] = {}
    for r in rendered:
        by_cat[r["cat"]] = by_cat.get(r["cat"], 0) + 1
    for c, n in sorted(by_cat.items()):
        print(f"  {c:<12} {n}")
    print("-" * W)
    print(f"  {len(rendered)} fichiers   {total:.1f} s   -> {args.out}")
    print(f"  Grain retro : {'OUI, ' + str(CRUSH['bits']) + ' bits / ' + str(CRUSH['rate']) + ' Hz' if args.crush else 'non'}")
    print("=" * W + "\n")

    if args.manifest:
        with open(args.manifest, "w") as f:
            json.dump(rendered, f, indent=2)
        print(f"[rendu] manifeste -> {args.manifest}\n")


if __name__ == "__main__":
    main()
