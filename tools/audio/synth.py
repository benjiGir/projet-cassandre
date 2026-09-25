"""
Moteur de synthese procedurale pour PROJET_CASSANDRE.

Bibliotheque DSP pure numpy/scipy. Aucune dependance audio externe.
Chaque son est deterministe : meme seed, meme echantillon bit-a-bit.

    from synth import *
    sig = layer(
        transient(0.004, seed=1) * 0.5,
        noise_burst(0.18, lo=200, hi=6000, decay=28, seed=1),
    )
    write_wav("shot.wav", crush(sig, bits=8, rate=11025))
"""

from __future__ import annotations

import wave
from dataclasses import dataclass

import numpy as np
from scipy import signal as sps

SR = 44100          # taux de travail interne
EPS = 1e-12


# ---------------------------------------------------------------- utilitaires

def t(dur: float, sr: int = SR) -> np.ndarray:
    """Vecteur temps en secondes."""
    return np.arange(int(dur * sr), dtype=np.float64) / sr


def rng(seed: int | None) -> np.random.Generator:
    """RNG seede — le determinisme est un invariant du projet."""
    return np.random.default_rng(seed)


def norm(x: np.ndarray, peak: float = 0.99) -> np.ndarray:
    m = np.max(np.abs(x))
    return x * (peak / m) if m > EPS else x


def pad_to(x: np.ndarray, n: int) -> np.ndarray:
    return np.pad(x, (0, max(0, n - len(x))))[:n]


def layer(*sigs: np.ndarray) -> np.ndarray:
    """Somme des couches, alignees a gauche, longueur = la plus longue."""
    n = max(len(s) for s in sigs)
    return np.sum([pad_to(s, n) for s in sigs], axis=0)


def delay(x: np.ndarray, sec: float, sr: int = SR) -> np.ndarray:
    """Decale une couche vers la droite (pompe, ejection de douille)."""
    return np.concatenate([np.zeros(int(sec * sr)), x])


# ------------------------------------------------------------------ bruits
# (les filtres sont plus bas ; brown() en a besoin, Python resout a l'appel)

def white(dur: float, seed: int | None = None, sr: int = SR) -> np.ndarray:
    return rng(seed).standard_normal(int(dur * sr))


def pink(dur: float, seed: int | None = None, sr: int = SR) -> np.ndarray:
    """Bruit rose (1/f) — plus chaud, base des souffles et ambiances."""
    n = int(dur * sr)
    w = rng(seed).standard_normal(n)
    spec = np.fft.rfft(w)
    f = np.fft.rfftfreq(n, 1 / sr)
    f[0] = f[1] if len(f) > 1 else 1.0
    return norm(np.fft.irfft(spec / np.sqrt(f), n))


def brown(dur: float, seed: int | None = None, sr: int = SR) -> np.ndarray:
    """
    Bruit brun (1/f^2) — grondements, souffle de ventilation.

    Le cumsum derive : sans le highpass, le signal porte un offset DC qui
    produit un clic a chaque lecture et mange de la marge de crete.
    """
    x = np.cumsum(rng(seed).standard_normal(int(dur * sr)))
    return norm(highpass(x - np.mean(x), 18, order=2, sr=sr))


# ---------------------------------------------------------------- enveloppes

def env_exp(n: int, decay: float, sr: int = SR) -> np.ndarray:
    """Decroissance exponentielle. decay eleve = plus sec, plus percussif."""
    return np.exp(-decay * np.arange(n) / sr)


def env_ad(n: int, attack: float, decay: float, sr: int = SR) -> np.ndarray:
    """Attaque lineaire puis decroissance exponentielle."""
    a = max(1, int(attack * sr))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    e[a:] = np.exp(-decay * np.arange(n - a) / sr)
    return e


def env_adsr(n: int, a: float, d: float, s: float, r: float,
             sr: int = SR) -> np.ndarray:
    na, nd, nr = int(a * sr), int(d * sr), int(r * sr)
    ns = max(0, n - na - nd - nr)
    return pad_to(np.concatenate([
        np.linspace(0, 1, max(1, na)),
        np.linspace(1, s, max(1, nd)),
        np.full(ns, s),
        np.linspace(s, 0, max(1, nr)),
    ]), n)


def fade(x: np.ndarray, ms_in: float = 1.0, ms_out: float = 3.0,
         sr: int = SR) -> np.ndarray:
    """Anti-clic aux bords. ms_out > 0 est obligatoire sur tout SFX."""
    y = x.copy()
    ni, no = int(ms_in * sr / 1000), int(ms_out * sr / 1000)
    if ni > 0:
        y[:ni] *= np.linspace(0, 1, ni)
    if no > 0:
        y[-no:] *= np.linspace(1, 0, no)
    return y


# ------------------------------------------------------------------ filtres

def lowpass(x: np.ndarray, cut: float, order: int = 4,
            sr: int = SR) -> np.ndarray:
    sos = sps.butter(order, min(cut, sr / 2 - 100), "low", fs=sr, output="sos")
    return sps.sosfilt(sos, x)


def highpass(x: np.ndarray, cut: float, order: int = 4,
             sr: int = SR) -> np.ndarray:
    sos = sps.butter(order, max(cut, 10), "high", fs=sr, output="sos")
    return sps.sosfilt(sos, x)


def bandpass(x: np.ndarray, lo: float, hi: float, order: int = 4,
             sr: int = SR) -> np.ndarray:
    hi = min(hi, sr / 2 - 100)
    lo = max(lo, 10)
    if lo >= hi:
        return x
    sos = sps.butter(order, [lo, hi], "band", fs=sr, output="sos")
    return sps.sosfilt(sos, x)


def resonant(x: np.ndarray, freq: float, q: float = 8.0,
             sr: int = SR) -> np.ndarray:
    """Pic resonant — donne un corps metallique, un 'ring' de mecanisme."""
    b, a = sps.iirpeak(min(freq, sr / 2 - 100), q, fs=sr)
    return sps.lfilter(b, a, x)


def sweep_lowpass(x: np.ndarray, f0: float, f1: float,
                  blocks: int = 64, sr: int = SR) -> np.ndarray:
    """Coupure qui glisse de f0 a f1 — l'energie qui se referme apres le tir."""
    n = len(x)
    out = np.zeros(n)
    bs = max(1, n // blocks)
    for i in range(0, n, bs):
        seg = x[i:i + bs]
        f = f0 + (f1 - f0) * (i / max(1, n))
        out[i:i + bs] = lowpass(seg, max(80, f), sr=sr)
    return out


# ------------------------------------------------------------- oscillateurs

def sine(dur: float, f: float, sr: int = SR) -> np.ndarray:
    return np.sin(2 * np.pi * f * t(dur, sr))


def sine_drop(dur: float, f0: float, f1: float, curve: float = 3.0,
              sr: int = SR) -> np.ndarray:
    """Sinus dont la hauteur chute — c'est ce qui donne le POIDS d'un tir."""
    tt = t(dur, sr)
    k = (tt / max(tt[-1], EPS)) ** (1 / curve)
    f = f0 + (f1 - f0) * k
    return np.sin(2 * np.pi * np.cumsum(f) / sr)


def saw(dur: float, f: float, sr: int = SR) -> np.ndarray:
    return sps.sawtooth(2 * np.pi * f * t(dur, sr))


# ---------------------------------------------------------------- traitement

def saturate(x: np.ndarray, drive: float = 3.0) -> np.ndarray:
    """Saturation douce — epaissit sans ajouter d'amplitude."""
    return np.tanh(x * drive) / np.tanh(drive)


def crush(x: np.ndarray, bits: int = 8, rate: int | None = None,
          sr: int = SR) -> np.ndarray:
    """
    Reduction de bits et de taux — l'equivalent audio du 640x360.

    Duke 3D tournait en 11025 Hz mono 8 bits. C'est ce qui donne le grain.
    """
    y = x
    if rate and rate < sr:
        step = max(1, int(round(sr / rate)))
        y = np.repeat(y[::step], step)[:len(x)]
    levels = 2 ** bits
    return np.round(np.clip(y, -1, 1) * (levels / 2 - 1)) / (levels / 2 - 1)


def reverb(x: np.ndarray, room: float = 0.35, mix: float = 0.25,
           damp: float = 4000, seed: int | None = 0,
           sr: int = SR) -> np.ndarray:
    """
    Reverb par convolution sur une RI synthetique (bruit a decroissance).

    room = duree en secondes. Un hypermarche vide veut du long et du sombre.
    """
    n = int(room * sr)
    ir = rng(seed).standard_normal(n) * np.exp(-5.0 * np.arange(n) / n)
    ir = lowpass(ir, damp, sr=sr)
    ir[0] = 1.0
    wet = sps.fftconvolve(x, ir)[:len(x) + n]
    wet = norm(wet, np.max(np.abs(x)) if np.max(np.abs(x)) > EPS else 1.0)
    return pad_to(x, len(wet)) * (1 - mix) + wet * mix


def slapback(x: np.ndarray, ms: float = 55, feedback: float = 0.3,
             taps: int = 3, sr: int = SR) -> np.ndarray:
    """Echos discrets — le claquement qui rebondit dans un entrepot."""
    n = len(x) + int(ms * taps * sr / 1000)
    out = pad_to(x, n)
    for i in range(1, taps + 1):
        d = int(ms * i * sr / 1000)
        out[d:d + len(x)] += x * (feedback ** i)
    return out


# ------------------------------------------------------- briques de haut niveau

def transient(dur: float = 0.004, seed: int | None = None,
              hp: float = 1200, sr: int = SR) -> np.ndarray:
    """Le clic mecanique. Tres court, large bande, attaque instantanee."""
    n = int(dur * sr)
    return highpass(white(dur, seed, sr), hp, sr=sr) * env_exp(n, 600, sr)


def noise_burst(dur: float, lo: float, hi: float, decay: float = 25,
                attack: float = 0.0005, seed: int | None = None,
                sr: int = SR) -> np.ndarray:
    """Le corps du tir : bruit filtre sous enveloppe percussive."""
    n = int(dur * sr)
    return bandpass(white(dur, seed, sr), lo, hi, sr=sr) * env_ad(n, attack, decay, sr)


def bubble(radius_mm: float, xi: float = 0.1, damping: float = 1.0,
           sr: int = SR) -> np.ndarray:
    """
    Une bulle d'air dans l'eau — la brique qui fait lire un LIQUIDE.

    Modele de van den Doel (« Physically-based models for liquid sounds »,
    2005) : une bulle qui nait resonne a la frequence de Minnaert
    f0 = 3,26 / r (r en metres, soit ~3260 / r_mm Hz), s'amortit d'autant plus
    vite qu'elle est petite (d = 0,043 f0 + 0,0014 f0^1,5 par seconde), et sa
    hauteur MONTE pendant qu'elle remonte : f(t) = f0 (1 + xi d t).

    Un bruit filtre, meme bien enveloppe, s'entend comme du vent ou de la
    vapeur. Ce qui dit « eau », c'est ce petit glissement montant, repete par
    dizaines ou centaines. xi = 0,1 est la valeur physique ; plus haut, la
    bulle « gloupe » comme un dessin anime.

    damping multiplie l'amortissement physique. Le modele decrit une bulle
    ISOLEE dans une eau calme : une bulle de 2 cm y sonne presque une seconde.
    Dans une eau brassee (siphon, gerbe, eclaboussure), la turbulence la
    brise bien avant — sans ce facteur, un glouglou devient un bourdon.
    """
    f0 = 3260.0 / max(radius_mm, 0.05)
    d = (0.043 * f0 + 0.0014 * f0 ** 1.5) * damping
    n = max(8, int(min(6.9 / d, 1.5) * sr))       # jusqu'a -60 dB
    tt = np.arange(n) / sr
    f = f0 * (1.0 + xi * d * tt)
    env = np.exp(-d * tt)
    # Un quart de periode d'attaque : une bulle qui demarre a pleine amplitude
    # s'affiche comme une ligne verticale au spectrogramme — un tic large
    # bande, pas un « bloup ».
    na = max(1, min(n // 2, int(sr / (4 * f0))))
    env[:na] *= np.linspace(0, 1, na)
    return np.sin(2 * np.pi * np.cumsum(f) / sr) * env


def bubbles(dur: float, rate: float, r_min: float, r_max: float,
            seed: int | None = None, xi: float = 0.1, beta: float = 2.0,
            density: np.ndarray | None = None, loud: float = 1.0,
            damping: float = 1.0, boucle: bool = False,
            sr: int = SR) -> np.ndarray:
    """
    Nuee de bulles : ecoulement, glouglou, ruissellement.

    rate      bulles par seconde au plus fort
    r_min/max rayons en mm (1 mm ~ 3,3 kHz, 10 mm ~ 330 Hz)
    beta      pente de la loi de rayons p(r) ~ r^-beta : grand = surtout des
              petites bulles (filet d'eau), petit = beaucoup de grosses
              (siphon qui avale de l'air)
    density   enveloppe [0..1] par echantillon qui module le debit — une
              chasse d'eau n'a pas le meme debit a 0,2 s et a 1,2 s
    loud      exposant amplitude/rayon : les grosses bulles sonnent plus fort
    damping   amortissement en plus du modele physique (voir `bubble`)
    boucle    la queue d'une bulle nee pres de la fin retombe au DEBUT, au
              lieu d'etre coupee : le signal est alors une periode exacte
              d'une boucle (voir `periodique`)

    Deterministe : meme graine, memes bulles aux memes instants.
    """
    g = rng(seed)
    n = int(dur * sr)
    out = np.zeros(n)
    count = g.poisson(rate * dur)
    starts = np.sort(g.uniform(0, dur, count))
    lo, hi = r_min ** (1 - beta), r_max ** (1 - beta)
    for s in starts:
        u, keep, gain = g.random(), g.random(), g.uniform(0.4, 1.0)
        i = int(s * sr)
        if density is not None and keep > density[min(i, len(density) - 1)]:
            continue
        r = (lo + u * (hi - lo)) ** (1 / (1 - beta)) if beta != 1 else r_min * (r_max / r_min) ** u
        b = bubble(r, xi, damping, sr) * gain * (r / r_max) ** loud
        j = min(n, i + len(b))
        out[i:j] += b[:j - i]
        if boucle and i + len(b) > n:
            _replie(out, b[j - i:])
    return out


def turbulence(dur: float, rate: float = 8.0, depth: float = 0.35,
               seed: int | None = None, boucle: bool = False,
               sr: int = SR) -> np.ndarray:
    """
    Modulation lente et aleatoire (1 +- depth) : le debit qui n'est jamais regulier.

    boucle : filtree comme une boucle (voir `periodique`), sa fin rejoint son
    debut — sinon une boucle de dix secondes changerait de debit d'un coup a
    chaque tour.
    """
    bruit = rng(seed).standard_normal(int(dur * sr))
    if boucle:
        m = periodique(lambda s: lowpass(s, rate, order=2, sr=sr), bruit)
    else:
        m = lowpass(bruit, rate, order=2, sr=sr)
    m = m / (np.max(np.abs(m)) + EPS)
    return 1.0 + depth * m


def chocs(dur: float, rate: float, seed: int | None = None,
          ms: tuple[float, float] = (0.3, 2.0),
          db: tuple[float, float] = (-24.0, 0.0),
          density: np.ndarray | None = None, boucle: bool = False,
          sr: int = SR) -> np.ndarray:
    """
    Pluie de petits chocs secs : des gouttes sur du carrelage, du gravier.

    Chaque choc est un eclat de bruit de `ms` millisecondes, a decroissance
    exponentielle, avec SON bruit, sa duree et son niveau. Le niveau est tire
    en dB et pas en amplitude : l'oreille entend des ecarts de niveau, et un
    tirage lineaire donne une poignee de chocs forts sur une bouillie.

    Large bande par nature : c'est le filtre qui suit qui dit sur QUOI ca
    tombe (du carrelage claque haut, une flaque etouffe).

    density et boucle : comme `bubbles`.
    """
    g = rng(seed)
    n = int(dur * sr)
    out = np.zeros(n)
    count = g.poisson(rate * dur)
    starts = np.sort(g.uniform(0, dur, count))
    for s in starts:
        longueur, niveau, keep = g.uniform(*ms), g.uniform(*db), g.random()
        i = int(s * sr)
        if density is not None and keep > density[min(i, len(density) - 1)]:
            continue
        k = max(4, int(longueur * sr / 1000))
        c = g.standard_normal(k) * np.exp(-5.0 * np.arange(k) / k) * 10 ** (niveau / 20)
        j = min(n, i + k)
        out[i:j] += c[:j - i]
        if boucle and i + k > n:
            _replie(out, c[j - i:])
    return out


# ---------------------------------------------------------- boucles exactes
#
# Une boucle d'ambiance se raccorde de deux facons. Par fondu croise
# (`loop_seamless`) : on melange la queue et la tete. Ou par CONSTRUCTION : on
# fabrique d'emblee un signal periodique, dont la fin est la veille du debut —
# le raccord est alors un echantillon comme les autres, et il n'y a plus rien
# a fondre.
#
# La seconde facon est la seule juste pour un bruit continu et dense (un jet
# d'eau, une soufflerie) : fondre deux bruits independants creuse le niveau de
# 3 dB au milieu du fondu (leurs puissances s'ajoutent, pas leurs amplitudes),
# et un jet qui « respire » une fois par tour trahit la boucle mieux qu'un clic.

def _replie(out: np.ndarray, reste: np.ndarray) -> None:
    """Ajoute au DEBUT de `out` ce qui deborde de sa fin (boucle)."""
    while len(reste):
        k = min(len(out), len(reste))
        out[:k] += reste[:k]
        reste = reste[k:]


def periodique(fonction, x: np.ndarray, tours: int = 3) -> np.ndarray:
    """
    Applique `fonction` a x comme si x se repetait sans fin, et rend UNE periode.

    Un filtre ou une reverb applique au signal seul demarre au repos et
    s'arrete net : la fin du fichier et son debut ne se raccordent plus. Sur
    trois copies bout a bout, il a atteint son regime au debut de la
    troisieme, qui est exactement ce qu'il produirait en boucle infinie —
    queue de reverb comprise, qui retombe sur le debut.

    Valable tant que la memoire du traitement (queue de reverb, reponse d'un
    filtre tres grave) tient dans deux periodes.
    """
    n = len(x)
    return np.asarray(fonction(np.tile(x, tours)))[(tours - 1) * n: tours * n]


def limiteur(x: np.ndarray, plafond: float = 0.5, ms: float = 1.5,
             boucle: bool = False, sr: int = SR) -> np.ndarray:
    """
    Rabote les cretes au-dessus de `plafond` (fraction du pic), sans toucher au
    reste : ce qui fait descendre le facteur de crete d'une pluie de chocs.

    Le detecteur est le MAXIMUM de |x| sur une fenetre CENTREE (`ms` de part et
    d'autre) : un suiveur d'enveloppe causal arrive apres une crete, laisse
    passer le transitoire et baisse le corps — il REMONTE le facteur de crete
    (mesure sur le pompe : 16,3 -> 24,2 dB). Le gain est ensuite lisse sur la
    meme largeur, ce qui garantit encore la crete : sur toute la fenetre qui
    l'entoure, le gain est deja au plus bas.
    """
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    mode = "wrap" if boucle else "nearest"
    a = np.abs(x) / (np.max(np.abs(x)) + EPS)
    w = 2 * int(ms * sr / 1000) + 1
    gain = np.minimum(1.0, plafond / np.maximum(maximum_filter1d(a, w, mode=mode), EPS))
    return x * uniform_filter1d(gain, w, mode=mode)


def eq_circulaire(x: np.ndarray, points: list[tuple[float, float]],
                  sr: int = SR) -> np.ndarray:
    """
    Egaliseur a phase nulle pour un signal PERIODIQUE.

    points : (frequence en Hz, gain en dB), interpoles en frequence
    logarithmique, constants au-dela des extremes. Applique dans le domaine
    frequentiel : la FFT d'une periode EST le spectre de la boucle, donc le
    resultat reste une boucle exacte, et la pente n'a pas de limite — c'est
    l'outil pour CREUSER une bande sans toucher ses voisines.
    """
    n = len(x)
    f = np.maximum(np.fft.rfftfreq(n, 1 / sr), 1.0)
    fs, gs = zip(*points)
    gain = np.interp(np.log10(f), np.log10(fs), gs)
    return np.fft.irfft(np.fft.rfft(x) * 10 ** (gain / 20), n)


def loop_seamless(x: np.ndarray, xfade: float = 0.5, sr: int = SR) -> np.ndarray:
    """
    Boucle sans couture par fondu croise tete-queue.

    Indispensable pour une ambiance : un bord net s'entend comme un clic
    toutes les N secondes, et on ne l'entend qu'apres coup, en jeu.
    """
    nf = int(xfade * sr)
    if nf * 2 >= len(x):
        nf = len(x) // 3
    head, tail = x[:nf], x[-nf:]
    ramp = np.linspace(0, 1, nf)
    return np.concatenate([tail * (1 - ramp) + head * ramp, x[nf:-nf]])


# ------------------------------------------------------------------- fichiers

def write_wav(path: str, x: np.ndarray, sr: int = SR, peak: float = 0.89,
              bits: int = 16, boucle: bool = False) -> dict:
    """
    Ecrit un WAV mono. peak 0.89 (~ -1 dBFS) laisse la marge que Howler,
    la variation de pitch et la sommation de plusieurs sons vont consommer.

    boucle : x est une periode exacte (voir `periodique`). Ni fondu aux bords
    — il ouvrirait un trou de 2,5 ms a CHAQUE tour, pile au raccord — ni
    passe-haut qui demarre au repos : il est applique comme a une boucle.
    """
    # Highpass de securite : l'offset DC est invisible a l'oeil, s'entend
    # comme un clic, et consomme de la marge de crete pour rien.
    if boucle:
        y = periodique(lambda s: highpass(s, 12, order=2, sr=sr), x)
        y = np.clip(norm(y, peak), -1, 1)
    else:
        y = np.clip(norm(fade(highpass(x, 12, order=2, sr=sr), 0.5, 2.0, sr), peak), -1, 1)
    data = (y * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(data.tobytes())
    return {"path": path, "sr": sr, "samples": len(y),
            "duration": round(len(y) / sr, 4), "peak": round(float(np.max(np.abs(y))), 4)}


def read_wav(path: str) -> tuple[np.ndarray, int]:
    with wave.open(path, "rb") as w:
        sr = w.getframerate()
        raw = w.readframes(w.getnframes())
        x = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
        if w.getnchannels() == 2:
            x = x.reshape(-1, 2).mean(axis=1)
    return x, sr
