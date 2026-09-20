"""
Mesure et diagnostic visuel des sons. L'equivalent audio de render_preview.py.

    python3 tools/audio/analyze_sfx.py assets/audio/wav/
    python3 tools/audio/analyze_sfx.py assets/audio/wav/ --sheet renders/audio.png
    python3 tools/audio/analyze_sfx.py --mask shotgun.wav suit_telegraph.wav

LIMITE A CONNAITRE : un agent ne peut pas ECOUTER. Il peut mesurer, et il peut
REGARDER un spectrogramme. Le jugement final reste humain, au casque.
Ce script rend la partie objective verifiable ; il ne remplace pas l'oreille.
"""

from __future__ import annotations

import argparse
import glob
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import read_wav  # noqa: E402

EPS = 1e-12

# Budget du projet — voir docs/systems/hud-audio.md
BUDGET = {
    "peak_dbfs_max": -0.5,
    "peak_dbfs_min": -6.0,
    "dc_offset_max": 0.002,
}

# Le seuil d'attaque n'a de sens que sur un son d'impact. Un whoosh, une
# melodie de ramassage ou un moteur de porte ont une montee lente par
# CONCEPTION — les signaler serait du bruit, et du bruit dans un rapport
# finit par faire ignorer les vrais avertissements.
PROFILS = {
    "impact":   dict(attack_ms_max=25.0,  dur_max=1.0),
    "weapon":   dict(attack_ms_max=25.0,  dur_max=1.2),
    "enemy":    dict(attack_ms_max=60.0,  dur_max=1.2),
    "pickup":   dict(attack_ms_max=None,  dur_max=2.0),
    "interact": dict(attack_ms_max=None,  dur_max=2.0),
    "ui":       dict(attack_ms_max=None,  dur_max=0.5),
    "ambience": dict(attack_ms_max=None,  dur_max=None),
}

# Sons a montee lente assumee, malgre leur categorie.
MONTEE_LENTE = {"crowbar_swing", "shotgun_pump", "suit_telegraph"}


def profil(name: str) -> dict:
    """Devine la categorie depuis le prefixe du nom de fichier."""
    for prefix, cat in (("amb_", "ambience"), ("ui_", "ui"),
                        ("impact_", "impact"), ("pickup_", "pickup"),
                        ("suit_", "enemy"), ("shotgun", "weapon"),
                        ("crowbar", "weapon"), ("shell_", "weapon"),
                        ("secret_", "pickup"), ("door_", "interact"),
                        ("cart_", "interact"), ("pa_", "interact")):
        if name.startswith(prefix):
            return PROFILS[cat]
    return PROFILS["impact"]


def db(x: float) -> float:
    return 20 * np.log10(max(abs(x), EPS))


def attack_time(x: np.ndarray, sr: int) -> float:
    """Temps jusqu'a 90 % du pic. Mesure objective du 'claquant'."""
    a = np.abs(x)
    pk = np.max(a)
    if pk < EPS:
        return 0.0
    idx = int(np.argmax(a >= 0.9 * pk))
    return 1000.0 * idx / sr


def decay_time(x: np.ndarray, sr: int, drop_db: float = 40) -> float:
    """Duree du pic jusqu'a -40 dB — la queue reelle du son."""
    a = np.abs(x)
    pk = np.max(a)
    if pk < EPS:
        return 0.0
    thr = pk * (10 ** (-drop_db / 20))
    above = np.where(a >= thr)[0]
    if len(above) == 0:
        return 0.0
    return 1000.0 * (above[-1] - int(np.argmax(a))) / sr


def centroid(x: np.ndarray, sr: int) -> float:
    """Centroide spectral en Hz — correle a la brillance percue."""
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    f = np.fft.rfftfreq(len(x), 1 / sr)
    s = spec.sum()
    return float((f * spec).sum() / s) if s > EPS else 0.0


def band_energy(x: np.ndarray, sr: int, bands=((0, 200), (200, 800),
                                               (800, 3000), (3000, 8000),
                                               (8000, 20000))) -> dict:
    """Repartition d'energie par bande — la base de l'analyse de masquage."""
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
    f = np.fft.rfftfreq(len(x), 1 / sr)
    total = spec.sum() + EPS
    return {f"{lo}-{hi}": float(spec[(f >= lo) & (f < hi)].sum() / total)
            for lo, hi in bands}


def measure(path: str) -> dict:
    x, sr = read_wav(path)
    pk = float(np.max(np.abs(x)))
    rms = float(np.sqrt(np.mean(x ** 2)))
    return {
        "name": os.path.splitext(os.path.basename(path))[0],
        "path": path,
        "sr": sr,
        "dur": round(len(x) / sr, 3),
        "peak_db": round(db(pk), 2),
        "rms_db": round(db(rms), 2),
        "crest_db": round(db(pk) - db(rms), 2),
        "attack_ms": round(attack_time(x, sr), 2),
        "decay40_ms": round(decay_time(x, sr), 1),
        "centroid_hz": round(centroid(x, sr)),
        "dc": round(float(np.mean(x)), 5),
        "clipped": int(np.sum(np.abs(x) >= 0.999)),
        "bands": band_energy(x, sr),
        "kb": round(os.path.getsize(path) / 1024, 1),
    }


def check(m: dict, is_ambience: bool = False) -> list[str]:
    out = []
    pr = profil(m["name"])
    if m["peak_db"] > BUDGET["peak_dbfs_max"]:
        out.append(f"pic {m['peak_db']} dBFS — pas de marge pour le pitch et la sommation")
    if m["peak_db"] < BUDGET["peak_dbfs_min"] and not is_ambience:
        out.append(f"pic {m['peak_db']} dBFS — trop bas, sera noye dans le mixage")
    if m["clipped"] > 0:
        out.append(f"{m['clipped']} echantillons a pleine echelle — ecretage")
    if abs(m["dc"]) > BUDGET["dc_offset_max"]:
        out.append(f"offset DC {m['dc']} — clic a la lecture, passer un highpass")
    if pr["dur_max"] and m["dur"] > pr["dur_max"]:
        out.append(f"{m['dur']} s — long pour sa categorie, verifier la queue de reverb")
    if (pr["attack_ms_max"] and m["name"] not in MONTEE_LENTE
            and m["attack_ms"] > pr["attack_ms_max"]):
        out.append(f"attaque {m['attack_ms']} ms — mou, l'impact ne claquera pas")
    return out


def masking(a: str, b: str) -> dict:
    """
    Recouvrement spectral entre deux sons.

    Sert un contrat de gameplay, pas une preference esthetique : la
    telegraphie ennemie doit rester audible PENDANT le tir du joueur.
    Un recouvrement eleve dans les memes bandes = le joueur ne l'entendra
    pas, et le combat devient injuste.
    """
    ma, mb = measure(a), measure(b)
    ba, bb = ma["bands"], mb["bands"]
    overlap = sum(min(ba[k], bb[k]) for k in ba)
    conflict = max(ba, key=lambda k: min(ba[k], bb[k]))
    return {
        "a": ma["name"], "b": mb["name"],
        "overlap": round(overlap, 3),
        "bande_conflit": conflict,
        "centroid_a": ma["centroid_hz"], "centroid_b": mb["centroid_hz"],
        "verdict": ("CONFLIT — separer les bandes ou decaler le centroide"
                    if overlap > 0.62 else "separation suffisante"),
    }


def contact_sheet(paths: list[str], out: str, cols: int = 4) -> None:
    """Planche de spectrogrammes — c'est ce que l'agent peut REGARDER."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from scipy import signal as sps

    n = len(paths)
    rows = (n + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(cols * 3.6, rows * 2.5))
    axes = np.atleast_1d(axes).ravel()

    for ax, p in zip(axes, paths):
        x, sr = read_wav(p)
        nper = min(512, max(64, len(x) // 40))
        f, tt, S = sps.spectrogram(x, sr, nperseg=nper, noverlap=nper // 2)
        ax.pcolormesh(tt, f, 10 * np.log10(S + 1e-12), shading="gouraud", cmap="magma")
        ax.set_yscale("symlog", linthresh=200)
        ax.set_ylim(20, sr / 2)
        ax.set_title(os.path.basename(p).replace(".wav", ""), fontsize=8)
        ax.tick_params(labelsize=6)
    for ax in axes[n:]:
        ax.axis("off")

    fig.suptitle("Spectrogrammes — PROJET_CASSANDRE", fontsize=11)
    fig.tight_layout()
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    fig.savefig(out, dpi=100)
    plt.close(fig)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", nargs="?")
    ap.add_argument("--sheet", default=None, help="planche de spectrogrammes PNG")
    ap.add_argument("--mask", nargs=2, metavar=("A", "B"))
    ap.add_argument("--strict", action="store_true")
    args = ap.parse_args()

    if args.mask:
        r = masking(*args.mask)
        print(f"\n  MASQUAGE  {r['a']}  vs  {r['b']}")
        print(f"    recouvrement   {r['overlap']}")
        print(f"    bande critique {r['bande_conflit']} Hz")
        print(f"    centroides     {r['centroid_a']} Hz  /  {r['centroid_b']} Hz")
        print(f"    -> {r['verdict']}\n")
        sys.exit(0 if r["overlap"] <= 0.62 else 1)

    if not args.folder:
        ap.error("dossier requis (ou --mask A B)")

    paths = sorted(glob.glob(os.path.join(args.folder, "**", "*.wav"), recursive=True))
    if not paths:
        print(f"Aucun .wav sous {args.folder}")
        sys.exit(1)

    rows = [measure(p) for p in paths]
    issues: list[tuple[str, str]] = []
    total_kb = 0.0

    W = 78
    print("\n" + "=" * W)
    print("ANALYSE AUDIO")
    print("=" * W)
    print(f"  {'son':<20}{'dur':>7}{'pic':>8}{'crete':>8}{'att':>8}{'dec40':>8}{'centr':>8}")
    print("-" * W)
    for m in rows:
        amb = m["name"].startswith("amb_")
        total_kb += m["kb"]
        print(f"  {m['name']:<20}{m['dur']:>7.2f}{m['peak_db']:>8.1f}"
              f"{m['crest_db']:>8.1f}{m['attack_ms']:>8.1f}"
              f"{m['decay40_ms']:>8.0f}{m['centroid_hz']:>8}")
        for w in check(m, amb):
            issues.append((m["name"], w))

    print("-" * W)
    print(f"  {len(rows)} fichiers   {total_kb / 1024:.2f} Mo en WAV")
    if issues:
        print("-" * W)
        for name, w in issues:
            print(f"  WARN   {name}: {w}")

    if args.sheet:
        contact_sheet(paths, args.sheet)
        print("-" * W)
        print(f"  Planche -> {args.sheet}")
        print("  ETAPE SUIVANTE : ouvrir la planche (view), puis ECOUTER au casque.")
        print("  La mesure ne remplace pas l'oreille — elle la prepare.")
    print("=" * W + "\n")
    sys.exit(1 if (issues and args.strict) else 0)


if __name__ == "__main__":
    main()
