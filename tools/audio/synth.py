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
              bits: int = 16) -> dict:
    """
    Ecrit un WAV mono. peak 0.89 (~ -1 dBFS) laisse la marge que Howler,
    la variation de pitch et la sommation de plusieurs sons vont consommer.
    """
    # Highpass de securite : l'offset DC est invisible a l'oeil, s'entend
    # comme un clic, et consomme de la marge de crete pour rien.
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
