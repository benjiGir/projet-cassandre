"""
Empaquetage en audio sprite + manifeste Howler.

    python3 tools/audio/build_sprite.py assets/audio/wav --out public/audio/sfx

Produit sfx.ogg, sfx.m4a et sfx.json pret a passer a Howler. Un seul
decodage, une seule requete, latence minimale — c'est le pattern recommande
pour les effets courts d'un jeu.

L'ambiance est EXCLUE du sprite : elle est longue et bouclee, la mettre dans
le sprite gonflerait le decodage initial pour rien. Chaque `amb_*` sort en
DEUX fichiers, .ogg et .m4a, pour la meme raison que le sprite (Howler ne se
rabat pas d'un format sur l'autre) ; une boucle EXACTE (`BOUCLES_EXACTES`)
est ensuite DECODEE et son raccord verifie — voir `verifier_boucle`.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import shutil
import subprocess
import sys
import zlib

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from analyze_sfx import lire, raccord  # noqa: E402
from recipes import BOUCLES_EXACTES     # noqa: E402
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
    """WAV -> Vorbis, par ffmpeg ou par oggenc.

    Le numero de serie du flux Ogg est FIXE (tire du nom du fichier) : les deux
    encodeurs le tirent au hasard par defaut, et chaque construction sortait
    un .ogg aux octets differents pour un son identique — le seul artefact de
    la chaine qui n'etait pas deterministe.
    """
    serie = str(zlib.crc32(os.path.basename(dst).encode()) & 0x7FFFFFFF)
    # Pas de --downmix sur oggenc : tout le studio est mono par construction,
    # et l'option ne ferait qu'avertir qu'elle n'a rien a faire.
    return essayer([
        ["ffmpeg", "-y", "-i", src, "-c:a", "libvorbis", "-q:a", str(qualite), "-ac", "1",
         "-fflags", "+bitexact", "-serial_offset", serie, dst],
        ["oggenc", "-Q", "-q", str(qualite), "-s", serie, "-o", dst, src],
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


# Une boucle livree en fichier separe est lue par Web Audio, qui la reboucle
# sur la longueur DECODEE. Deux pieges de l'encodage avec perte, qui ne se
# voient qu'apres decodage :
# - l'AAC ajoute un delai d'amorcage (1024 echantillons chez ffmpeg) et
#   complete sa derniere trame : si le decodeur ne les retire pas, la boucle
#   gagne un silence a chaque tour. ffmpeg ecrit une liste d'edition a
#   l'echantillon pres, que les decodeurs du navigateur appliquent (mesure
#   dans Chrome : longueur exacte) ; et une boucle d'un nombre entier de
#   trames (`recipes.JET_N`) n'a de toute facon rien a completer ;
# - l'encodeur DEPASSE son entree.
# Le raccord est donc mesure sur la version decodee, par les memes rangs que
# `analyze_sfx.py --boucle`.
def verifier_boucle(wav: str, encode: str) -> list[str]:
    x, _ = read_wav(wav)
    y, _ = lire(encode)
    defauts = []
    if len(y) != len(x):
        defauts.append(f"{len(y) - len(x):+d} echantillons apres decodage")
    if np.max(np.abs(y)) >= 1.0:
        defauts.append(f"{int(np.sum(np.abs(y) >= 1.0))} echantillons ecretes apres decodage")
    r = raccord(y, SR)
    if r["grave"] >= 99 or r["clic"] >= 99:
        defauts.append(f"clic au raccord (grave {r['grave']}, clic {r['clic']})")
    if r["trou"] <= 1:
        defauts.append(f"trou au raccord (rang {r['trou']})")
    if r["spectre"] >= 99:
        defauts.append(f"rupture de spectre au raccord (rang {r['spectre']})")
    return defauts


# Crete d'une boucle exacte APRES decodage : la meme marge que tout le
# catalogue (-1 dBFS). Mesure sur le jet d'eau, normalise a -1 dBFS en WAV :
# Vorbis le rendait a +0,94 dBFS, deux echantillons ecretes — un bruit dense
# plein de chocs brefs est ce qu'un encodeur avec perte depasse le plus. Les
# ambiances graves, elles, restaient sous -0,87 dBFS.
CRETE_BOUCLE = 0.891


def _attenue(src: str, gain: float, dossier: str) -> str:
    """Copie du WAV multipliee par `gain`, rien d'autre : ni filtre, ni fondu."""
    import wave
    with wave.open(src, "rb") as w:
        params = w.getparams()
        brut = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2")
    dst = os.path.join(dossier, os.path.basename(src))
    with wave.open(dst, "wb") as w:
        w.setparams(params)
        w.writeframes(np.round(brut * gain).astype("<i2").tobytes())
    return dst


def encoder_ambiance(src: str, out: str, exacte: bool) -> tuple[dict, list[str]]:
    """
    Une ambiance en .ogg ET en .m4a. Une boucle exacte est ensuite decodee :
    si l'un des deux formats depasse CRETE_BOUCLE, les DEUX sont reencodes
    avec le meme gain — un navigateur lit l'un, un autre l'autre, et le jet ne
    doit pas etre plus fort sur Safari que sur Chrome.
    """
    import tempfile
    nom = os.path.splitext(os.path.basename(src))[0]
    formats = (("ogg", lambda s, d: vers_ogg(s, d, 3)), ("m4a", lambda s, d: vers_m4a(s, d, 96)))
    gain, tailles, defauts = 1.0, {}, []
    with tempfile.TemporaryDirectory() as tmp:
        for _ in range(4):
            entree = src if gain == 1.0 else _attenue(src, gain, tmp)
            tailles, defauts, pics = {}, [], []
            for ext, encode in formats:
                dst = os.path.join(out, f"{nom}.{ext}")
                if not encode(entree, dst):
                    defauts.append(f"{nom}.{ext} : aucun encodeur n'a reussi")
                    continue
                tailles[f"{nom}.{ext}"] = os.path.getsize(dst) / 1024
                if exacte:
                    pics.append(float(np.max(np.abs(lire(dst)[0]))))
            if not exacte or not pics or max(pics) <= CRETE_BOUCLE:
                break
            gain *= CRETE_BOUCLE / max(pics) * 0.99
        if exacte:
            for ext, _ in formats:
                dst = os.path.join(out, f"{nom}.{ext}")
                if os.path.exists(dst):
                    defauts += [f"{nom}.{ext} : {d}" for d in verifier_boucle(entree, dst)]
            if gain != 1.0:
                print(f"  {nom} : encode a {20 * np.log10(gain):+.2f} dB (depassement de l'encodeur)")
    return tailles, defauts


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
        sizes["sfx.ogg"] = os.path.getsize(os.path.join(args.out, "sfx.ogg")) / 1024
    if vers_m4a(wav_path, os.path.join(args.out, "sfx.m4a"), 96):
        sizes["sfx.m4a"] = os.path.getsize(os.path.join(args.out, "sfx.m4a")) / 1024
    defauts: list[str] = []
    for p in amb:
        n = os.path.splitext(os.path.basename(p))[0]
        tailles, d = encoder_ambiance(p, args.out, n in BOUCLES_EXACTES)
        sizes.update(tailles)
        defauts += d
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
    print(f"  Ambiances         {len(amb)} (hors sprite, .ogg + .m4a chacune)")
    if sizes:
        print("-" * W)
        for k, v in sorted(sizes.items()):
            print(f"  {k:<18} {v:>8.0f} Ko")
        print(f"  TOTAL              {sum(sizes.values()) / 1024:>7.2f} Mo   (budget 8 Mo)")
    print("-" * W)
    print(f"  -> {args.out}/sfx.json")
    print("=" * W + "\n")

    boucles = [os.path.splitext(os.path.basename(p))[0] for p in amb
               if os.path.splitext(os.path.basename(p))[0] in BOUCLES_EXACTES]
    if boucles:
        print(f"  Boucles verifiees apres decodage : {', '.join(boucles)}"
              f" — {'raccord propre' if not defauts else 'DEFAUTS ci-dessous'}\n")
    for d in defauts:
        print(f"  DEFAUT  {d}")
    if defauts:
        print()
        sys.exit(1)

    if sum(sizes.values()) / 1024 > 8:
        print("  DEPASSEMENT du budget audio de 8 Mo.\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
