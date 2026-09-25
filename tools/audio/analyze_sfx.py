"""
Mesure et diagnostic visuel des sons. L'equivalent audio de render_preview.py.

    python3 tools/audio/analyze_sfx.py assets/audio/wav/
    python3 tools/audio/analyze_sfx.py assets/audio/wav/ --sheet renders/audio.png
    python3 tools/audio/analyze_sfx.py --mask shotgun.wav suit_telegraph.wav
    python3 tools/audio/analyze_sfx.py --timbre ceramic_break.wav impact_glass.wav ...
    python3 tools/audio/analyze_sfx.py --boucle amb_water_jet.wav amb_water_jet.ogg amb_water_jet.m4a

LIMITE A CONNAITRE : un agent ne peut pas ECOUTER. Il peut mesurer, et il peut
REGARDER un spectrogramme. Le jugement final reste humain, au casque.
Ce script rend la partie objective verifiable ; il ne remplace pas l'oreille.
"""

from __future__ import annotations

import argparse
import glob
import os
import re
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

# Deux sons qui doivent se distinguer restent SOUS ce seuil de ressemblance de
# timbre (voir `ressemblance`). Mesure du 2026-09-20 : la paire pompe/pistolet
# rejetee a l'ecoute etait a 0,976.
TIMBRE_MAX = 0.55


def profil(name: str) -> dict:
    """
    Categorie d'un son : celle que declare `recipes.py`, sinon devinee.

    La categorie est DECLAREE dans le registre des recettes ; la deviner au
    prefixe du nom faisait mesurer une chasse d'eau de deux secondes contre le
    profil d'un impact. Le prefixe ne sert plus que pour un WAV etranger au
    catalogue (une prise brute qu'on inspecte, par exemple).
    """
    try:
        from recipes import RECIPES
    except ImportError:  # pragma: no cover - analyse hors du studio
        RECIPES = {}
    base = re.sub(r"_\d+$", "", name)
    for n in (name, base):
        if n in RECIPES:
            return PROFILS[RECIPES[n][1]]
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


def profil_timbre(x: np.ndarray, sr: int) -> np.ndarray:
    """
    Empreinte de timbre : spectre moyen des 250 premieres ms (Welch, fenetres
    de 2048), 30 bandes log de 100 Hz a 16 kHz, en dB, moyenne retiree.

    Les 250 premieres ms parce que c'est la que l'oreille identifie un son en
    combat ; la moyenne retiree parce que deux sons ne different pas par leur
    niveau mais par leur FORME spectrale.

    Recale sur les reperes ecrits du projet : pompe/pied-de-biche metal 0,435
    (0,433 ecrit), pompe/pistolet 0,169 (0,188), pompe/impact metal 0,164
    (0,200). Les autres chiffres cites dans les commentaires de `recipes.py`
    ont ete pris a des etats intermediaires des recettes et ne se reproduisent
    pas sur le catalogue actuel.
    """
    from scipy import signal as sps
    x = x[:int(0.25 * sr)]
    f, P = sps.welch(x, sr, nperseg=min(2048, len(x)))
    bords = np.geomspace(100, 16000, 31)
    v = []
    for lo, hi in zip(bords[:-1], bords[1:]):
        m = (f >= lo) & (f < hi)
        v.append(P[m].mean() if m.any() else np.interp(np.sqrt(lo * hi), f, P))
    v = 10 * np.log10(np.asarray(v) + 1e-20)
    return v - v.mean()


def ressemblance(a: str, b: str) -> float:
    """Correlation des empreintes de timbre. Sous TIMBRE_MAX = distincts."""
    xa, sa = read_wav(a)
    xb, sb = read_wav(b)
    return float(np.corrcoef(profil_timbre(xa, sa), profil_timbre(xb, sb))[0, 1])


def lire(path: str) -> tuple[np.ndarray, int]:
    """
    WAV lu tel quel ; .ogg / .m4a DECODES par ffmpeg, en flottant.

    Flottant parce qu'un decodeur qui ecrit du 16 bits rabote a 1,0 et cache
    le depassement de l'encodeur — seul le flottant le montre, comme le
    `decodeAudioData` du navigateur. ffmpeg applique la liste d'edition du
    .m4a (le retrait du delai d'amorcage de l'AAC), comme le navigateur.
    """
    if path.lower().endswith(".wav"):
        return read_wav(path)
    import subprocess
    brut = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le",
                           "-ac", "1", "-ar", "44100", "-"],
                          capture_output=True, check=True).stdout
    return np.frombuffer(brut, "<f4").astype(np.float64), 44100


def _bandes_tiers(seg: np.ndarray, sr: int) -> np.ndarray:
    """Energie en dB par tiers d'octave, 125 Hz a 16 kHz."""
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / sr)
    bords = 125 * 2 ** (np.arange(0, 22) / 3)
    return np.array([10 * np.log10(spec[(f >= lo) & (f < hi)].sum() + EPS)
                     for lo, hi in zip(bords[:-1], bords[1:])])


def raccord(x: np.ndarray, sr: int) -> dict:
    """
    Le raccord d'une boucle, compare a TOUT le reste du fichier.

    Une boucle sans couture n'est pas une boucle dont le raccord est « petit »,
    c'est une boucle dont le raccord ne se distingue d'aucun autre instant. Chaque
    mesure est donc un RANG : la place du raccord parmi toutes les positions du
    fichier (0 = le plus calme, 100 = le pire). Un clic sort au-dessus de 99 ;
    un trou sous 1.

    grave    marche du signal sous 250 Hz au raccord, parmi toutes ses marches
    clic     residu de prediction lineaire (sous 15 kHz) a 1 ms du raccord
    trou     niveau le plus bas sur 1 ms a moins de 10 ms du raccord
    spectre  ecart de spectre (tiers d'octave) entre les 50 ms d'avant et
             d'apres, parmi toutes les paires de 50 ms consecutives
    """
    from scipy.linalg import solve_toeplitz
    from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d

    n = len(x)
    y = np.roll(x, n // 2)          # le raccord au milieu : c = n // 2
    c = n // 2
    f = np.fft.rfftfreq(n, 1 / sr)

    # Grave : la marche du signal passe-bas (sous 250 Hz, filtre de phase nulle
    # et circulaire) au raccord, parmi toutes ses marches. Dans un bruit dense,
    # un ecart d'echantillon a echantillon ne veut rien dire — chaque
    # echantillon en est un ; sous 250 Hz, le signal est lisse, et une couture
    # (un « toc » sourd) y sort nettement.
    bas = np.fft.irfft(np.fft.rfft(y) / (1.0 + (f / 250.0) ** 8), n)
    ecarts = np.abs(np.diff(bas))
    saut = ecarts[c - 1]

    # Clic : residu de PREDICTION LINEAIRE (ordre 32). Sur un bruit dense, une
    # marche ne se voit pas dans le signal — chaque echantillon en est une.
    # Mais le residu d'un predicteur appris sur tout le fichier « blanchit » le
    # spectre : une couture y verse de l'energie dans les bandes que le son
    # laisse vides (la bande creusee, l'extreme aigu) et sort en pic. La mesure
    # est le plus fort residu a 1 ms du raccord, contre le meme maximum partout.
    # Au-dessus de 15 kHz, le residu ne dit plus rien d'utile : Vorbis et
    # l'AAC vident cette bande presque partout, le predicteur y apprend un
    # creux profond et y amplifie tout ce qui depasse — mesure sur le jet, un
    # raccord decode « cliquait » (rang 100) pour -20 dB d'energie au-dessus de
    # 17 kHz, sur 6 ms, que la source portait deja. L'oreille n'y entend pas un
    # evenement de quelques ms ; un vrai clic, large bande, sort aussi dessous.
    yc =np.fft.irfft(np.fft.rfft(y) / (1.0 + (f / 15000.0) ** 16), n)
    ordre = 32
    spec = np.abs(np.fft.rfft(yc, 2 * n)) ** 2
    ac = np.fft.irfft(spec)[:ordre + 1]
    a = solve_toeplitz(ac[:-1], ac[1:])
    pred = np.convolve(yc, np.concatenate([[0.0], a]), mode="full")[:n]
    res = uniform_filter1d((yc - pred) ** 2, int(0.0005 * sr) + 1)
    pic = maximum_filter1d(res, 2 * int(0.001 * sr) + 1)
    energie = pic[ordre:]
    clic = pic[c]

    # Trou : le plus bas de fenetres de 1 ms a moins de 10 ms du raccord,
    # compare au plus bas de ces memes fenetres autour de CHAQUE position
    # (comparer un minimum a des fenetres isolees le ferait paraitre creux a
    # tout coup). 1 ms : l'oreille detecte un silence de 2 a 3 ms dans un
    # bruit, et un fondu de 2,5 ms se noie dans une fenetre de 10.
    w2, pas = int(0.001 * sr), int(0.00025 * sr)
    debuts = np.arange(0, n - w2, pas)
    cumul = np.concatenate([[0.0], np.cumsum(y ** 2)])
    rms = np.sqrt((cumul[debuts + w2] - cumul[debuts]) / w2)
    creux = minimum_filter1d(rms, 2 * int(0.010 * sr / pas) + 1, mode="nearest")
    trou = creux[int(np.argmin(np.abs(debuts + w2 // 2 - c)))]

    w50 = int(0.050 * sr)
    b = [_bandes_tiers(y[i:i + w50], sr) for i in range(0, n - w50, w50 // 2)]
    paires = np.array([np.mean(np.abs(b1 - b0)) for b0, b1 in zip(b[:-2], b[2:])])
    spectre = np.mean(np.abs(_bandes_tiers(y[c:c + w50], sr) - _bandes_tiers(y[c - w50:c], sr)))

    def rang(v, tous):
        return round(100.0 * float(np.mean(tous < v)), 1)

    return {
        "grave": rang(saut, ecarts), "clic": rang(clic, energie),
        "trou": rang(trou, creux), "spectre": rang(spectre, paires),
        "trou_db": round(db(trou) - db(float(np.median(rms))), 1),
        "spectre_db": round(float(spectre), 2),
    }


def saillance(x: np.ndarray, sr: int) -> dict:
    """
    Ce qui ferait REPERER la boucle a l'oreille : un instant qui depasse (un
    evenement unique qu'on attend au tour suivant) ou une respiration reguliere.

    pic_db    fenetre de 50 ms la plus forte, au-dessus de la mediane
    p99_db    99e centile des fenetres, au-dessus de la mediane
    motif     plus forte autocorrelation de l'enveloppe entre 0,3 s et la
              demi-boucle : pres de 1, une modulation periodique s'entend
    """
    w = int(0.050 * sr)
    env = np.array([np.sqrt(np.mean(x[i:i + w] ** 2)) for i in range(0, len(x) - w + 1, w)])
    e = 20 * np.log10(env + EPS)
    med = np.median(e)
    v = e - e.mean()
    ac = np.array([np.mean(v * np.roll(v, k)) for k in range(len(v))]) / (np.mean(v * v) + EPS)
    k0 = max(1, int(0.3 / 0.050))
    return {"pic_db": round(float(e.max() - med), 1),
            "p99_db": round(float(np.percentile(e, 99) - med), 1),
            "motif": round(float(ac[k0:len(v) // 2].max()), 2)}


def rapport_boucle(ref: str, autres: list[str]) -> bool:
    """Mesure une boucle, puis chacune de ses versions encodees contre elle."""
    x, sr = lire(ref)
    ok = True
    print(f"\n  BOUCLE  {os.path.basename(ref)}   {len(x)} ech. ({len(x) / sr:.3f} s)")
    s = saillance(x, sr)
    print(f"    saillance   pic {s['pic_db']:+.1f} dB   p99 {s['p99_db']:+.1f} dB"
          f"   motif {s['motif']:.2f}   (au-dessus de la mediane des fenetres de 50 ms)")
    print(f"    {'fichier':<22}{'ech.':>9}{'ecart':>7}{'decal':>7}{'pic':>8}{'>=1':>5}"
          f"{'grave':>7}{'clic':>7}{'trou':>7}{'spectre':>8}")
    for p in [ref] + autres:
        y, sy = lire(p)
        if sy != sr:
            print(f"    {os.path.basename(p)}: {sy} Hz != {sr} Hz")
            ok = False
            continue
        # Decalage de la version decodee sur la source (delai d'amorcage mal
        # retire, echantillons perdus) : pic d'intercorrelation sur 2 s.
        from scipy import signal as sps
        m = min(2 * sr, len(x), len(y))
        cc = sps.correlate(y[:m], x[:m], mode="full", method="fft")
        lag = int(np.argmax(cc)) - (m - 1)
        r = raccord(y, sy)
        pk = float(np.max(np.abs(y)))
        ecr = int(np.sum(np.abs(y) >= 1.0))
        bon = (len(y) == len(x) and lag == 0 and ecr == 0 and r["grave"] < 99
               and r["clic"] < 99 and r["trou"] > 1 and r["spectre"] < 99)
        ok &= bon
        print(f"    {os.path.basename(p):<22}{len(y):>9}{len(y) - len(x):>+7}{lag:>7}"
              f"{db(pk):>8.2f}{ecr:>5}{r['grave']:>7.1f}{r['clic']:>7.1f}{r['trou']:>7.1f}"
              f"{r['spectre']:>8.1f}  {'ok' if bon else 'DEFAUT'}")
    print("    (grave, clic, trou, spectre : RANG du raccord parmi toutes les positions,")
    print("     0-100 ; un clic sort au-dessus de 99, un trou sous 1)\n")
    return ok


def planche_boucle(ref: str, out: str, contre: str | None = None) -> None:
    """
    Planche d'une boucle, ce que la planche commune ne montre pas a 10 s :
    la boucle entiere, une seconde de texture, le RACCORD lui-meme (les 400
    dernieres ms suivies des 400 premieres, comme a la lecture — une couture
    s'y voit comme un trait vertical ou une marche), et le spectre moyen, avec
    celui de `contre` (la telegraphie) pour voir la bande qui lui est laissee.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from scipy import signal as sps

    x, sr = lire(ref)
    fig, ax = plt.subplots(2, 2, figsize=(15, 8.5))

    def spectro(a, sig, titre, nper):
        f, tt, S = sps.spectrogram(sig, sr, nperseg=nper, noverlap=nper * 3 // 4)
        a.pcolormesh(tt, f, 10 * np.log10(S + 1e-12), shading="gouraud", cmap="magma",
                     vmin=10 * np.log10(S.max() + 1e-12) - 80)
        a.set_yscale("symlog", linthresh=200)
        a.set_ylim(20, sr / 2)
        a.set_title(titre, fontsize=9)
        a.tick_params(labelsize=7)

    nom = os.path.splitext(os.path.basename(ref))[0]
    spectro(ax[0, 0], x, f"{nom} — la boucle entiere ({len(x) / sr:.2f} s)", 2048)
    spectro(ax[0, 1], x[:sr], "une seconde de texture", 512)
    w = int(0.4 * sr)
    joint = np.concatenate([x[-w:], x[:w]])
    spectro(ax[1, 0], joint, "le RACCORD : fin (0-0,4 s) puis debut (0,4-0,8 s)", 256)
    ax[1, 0].axvline(0.4, color="cyan", lw=0.6, ls=":")

    def ltas(sig):
        f, P = sps.welch(sig, sr, nperseg=8192)
        return f, 10 * np.log10(P + 1e-20)
    f, P = ltas(x)
    ax[1, 1].semilogx(f[1:], P[1:] - P[1:].max(), lw=1.0, label=nom)
    if contre:
        y, _ = lire(contre)
        fc, Pc = ltas(y)
        ax[1, 1].semilogx(fc[1:], Pc[1:] - Pc[1:].max(), lw=1.0,
                          label=os.path.splitext(os.path.basename(contre))[0])
    ax[1, 1].axvspan(200, 800, color="grey", alpha=0.15)
    ax[1, 1].set_xlim(20, sr / 2)
    ax[1, 1].set_ylim(-90, 3)
    ax[1, 1].set_title("spectre moyen (dB sous le maximum) — gris : 200-800 Hz", fontsize=9)
    ax[1, 1].legend(fontsize=8)
    ax[1, 1].grid(True, which="both", alpha=0.2)
    ax[1, 1].tick_params(labelsize=7)

    fig.tight_layout()
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    fig.savefig(out, dpi=100)
    plt.close(fig)


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
    ap.add_argument("--timbre", nargs="+", metavar="WAV",
                    help="ressemblance de timbre du PREMIER son contre chacun des suivants")
    ap.add_argument("--boucle", nargs="+", metavar="FICHIER",
                    help="raccord d'une boucle : le WAV source, puis ses .ogg/.m4a encodes")
    ap.add_argument("--contre", default=None, metavar="WAV",
                    help="avec --boucle --sheet : spectre moyen compare a ce son")
    ap.add_argument("--strict", action="store_true")
    args = ap.parse_args()

    if args.boucle:
        ok = rapport_boucle(args.boucle[0], args.boucle[1:])
        if args.sheet:
            planche_boucle(args.boucle[0], args.sheet, args.contre)
            print(f"  Planche -> {args.sheet}  (a OUVRIR avant toute conclusion)\n")
        sys.exit(0 if ok else 1)

    if args.mask:
        r = masking(*args.mask)
        print(f"\n  MASQUAGE  {r['a']}  vs  {r['b']}")
        print(f"    recouvrement   {r['overlap']}")
        print(f"    bande critique {r['bande_conflit']} Hz")
        print(f"    centroides     {r['centroid_a']} Hz  /  {r['centroid_b']} Hz")
        print(f"    -> {r['verdict']}\n")
        sys.exit(0 if r["overlap"] <= 0.62 else 1)

    if args.timbre:
        if len(args.timbre) < 2:
            ap.error("--timbre REF AUTRE [AUTRE ...]")
        ref, autres = args.timbre[0], args.timbre[1:]
        nom = os.path.splitext(os.path.basename(ref))[0]
        print(f"\n  TIMBRE  {nom}  (seuil de distinction {TIMBRE_MAX})")
        pire = -1.0
        for autre in autres:
            if os.path.abspath(autre) == os.path.abspath(ref):
                continue
            r = ressemblance(ref, autre)
            pire = max(pire, r)
            marque = "TROP PROCHE" if r > TIMBRE_MAX else ""
            print(f"    {os.path.splitext(os.path.basename(autre))[0]:<22}{r:+.3f}  {marque}")
        print()
        sys.exit(0 if pire <= TIMBRE_MAX else 1)

    if not args.folder:
        ap.error("dossier requis (ou --mask A B, ou --timbre REF AUTRES)")

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
