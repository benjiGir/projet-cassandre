"""
Voix par synthese source-filtre : grognements, cris, rales.

Une voix, c'est une SOURCE — les cordes vocales qui s'ouvrent et se ferment,
un debit d'air en impulsions — filtree par le CONDUIT vocal, dont les
resonances (formants) font les voyelles (Fant, 1960 ; synthetiseur de Klatt,
1980). Les anciennes recettes posaient deux formants sur du bruit blanc :
un chuchotement filtre, jamais une voix. Ce qui fait « humain », et que ce
module reproduit :

- une source PERIODIQUE (impulsion glottique de Rosenberg) dont la hauteur
  suit une intonation ;
- son IRREGULARITE : gigue de periode (jitter, ~1 %), de niveau (shimmer,
  ~0,3 dB), et tremblement lent — une voix parfaitement reguliere est un
  synthe ;
- le SOUFFLE melange a la voix, module par l'ouverture de la glotte ;
- l'EFFORT : une voix qui crie ferme vite sa glotte, d'ou plus d'aigu ; une
  voix qui s'eteint laisse passer du souffle et descend en voix craquee
  (vocal fry : impulsions lentes et irregulieres) ;
- des formants qui GLISSENT d'une voyelle a l'autre.

Le registre vise des non-mots (grognements, cris, rales) : c'est la ou la
synthese tient le mieux, et c'est tout ce que dit un Costard.
"""

from __future__ import annotations

import numpy as np
from scipy import signal as sps

from physique import EPS, SR, courbe, n_ech

# Formants (F1..F5 en Hz, et largeurs de bande) d'une voix d'homme adulte.
VOYELLES = {
    "a": (750, 1250, 2550, 3500, 4500),
    "â": (680, 1100, 2450, 3400, 4400),
    "e": (420, 1900, 2550, 3400, 4400),
    "è": (560, 1700, 2500, 3400, 4400),
    "i": (290, 2200, 3000, 3600, 4500),
    "o": (460, 850, 2450, 3400, 4400),
    "ou": (320, 780, 2300, 3300, 4300),
    "eu": (500, 1400, 2450, 3400, 4400),
    "u": (300, 1650, 2200, 3300, 4300),
}
LARGEURS = np.array([80, 100, 140, 200, 260], dtype=float)


def _rosenberg(phase: np.ndarray, ouverture: np.ndarray, vitesse: float = 2.5) -> np.ndarray:
    """
    Debit glottique sur une periode (phase dans [0, 1)) : montee lente,
    descente rapide (c'est la fermeture brusque qui excite le conduit), puis
    glotte fermee. `ouverture` : part de la periode glotte ouverte.
    """
    tp = ouverture * vitesse / (1 + vitesse)
    tn = ouverture - tp
    u = np.zeros_like(phase)
    a = phase < tp
    u[a] = 0.5 * (1 - np.cos(np.pi * phase[a] / np.maximum(tp[a], EPS)))
    b = (phase >= tp) & (phase < ouverture)
    u[b] = np.cos(0.5 * np.pi * (phase[b] - tp[b]) / np.maximum(tn[b], EPS))
    return u


def source(f0: np.ndarray, effort: np.ndarray, souffle: np.ndarray, g,
           gigue: float = 0.012, scintillement: float = 0.35,
           craque: np.ndarray | None = None) -> np.ndarray:
    """
    Onde glottique (derivee du debit, ce que rayonnent les levres) + souffle.

    f0, effort [0..1], souffle [0..1], craque [0..1] : courbes par echantillon.
    """
    n = len(f0)
    # Gigue : la periode varie d'un cycle a l'autre ; tremblement : lent.
    lent = sps.sosfilt(sps.butter(2, 6, "low", fs=SR, output="sos"), g.standard_normal(n))
    lent /= np.std(lent) + EPS
    f = f0 * (1 + 0.01 * lent)
    if craque is not None:
        # Voix craquee : periodes longues et inegales (30-70 Hz), une sur deux
        # plus faible. On abaisse f0 la ou craque monte.
        f = f * (1 - craque) + craque * np.clip(f * 0.35, 28, 75)
    phase = np.zeros(n)
    acc, gig, niveau = 0.0, 1.0, np.ones(n)
    periode_niveau = 1.0
    for i in range(n):
        acc += f[i] * gig / SR
        if acc >= 1.0:
            acc -= 1.0
            gig = 1 + gigue * g.standard_normal()
            periode_niveau = 10 ** (scintillement * g.standard_normal() / 20)
            if craque is not None and craque[i] > 0.3 and g.random() < 0.5 * craque[i]:
                periode_niveau *= 0.35
        phase[i] = acc
        niveau[i] = periode_niveau
    # L'effort se joue sur la glotte : un cri la ferme plus tot (ouverture
    # courte) et plus SEC (descente rapide) — c'est la brusquerie de la
    # fermeture qui fait l'aigu d'une voix forcee, pas un egaliseur.
    ouverture = np.clip(0.72 - 0.3 * effort, 0.35, 0.8)
    u = np.zeros(n)
    for lo, hi in ((0.0, 0.34), (0.34, 0.67), (0.67, 1.01)):
        m = (effort >= lo) & (effort < hi)
        if m.any():
            u[m] = _rosenberg(phase[m], ouverture[m], vitesse=1.6 + 5 * (lo + hi) / 2)
    u *= niveau
    # Derivee du debit = onde rayonnee par les levres (-6 dB/octave en tout).
    voix = np.diff(u, prepend=0.0) * SR / np.maximum(f, 40) / 6.0
    # Souffle turbulent, plus fort quand la glotte est ouverte.
    bruit = sps.sosfilt(sps.butter(2, [500, 9000], "band", fs=SR, output="sos"), g.standard_normal(n))
    bruit *= (0.3 + u) * souffle
    return voix + 0.5 * bruit


def conduit(x: np.ndarray, formants: np.ndarray, largeurs: np.ndarray = LARGEURS,
            bloc: int = 64) -> np.ndarray:
    """
    Formants en cascade (resonateurs a deux poles, Klatt), mis a jour par
    blocs. formants : (n, 5) frequences par echantillon.
    """
    out = x.copy()
    n = len(x)
    for k in range(formants.shape[1]):
        y = np.zeros(n)
        zi = np.zeros(2)
        for i in range(0, n, bloc):
            F = float(np.mean(formants[i:i + bloc, k]))
            B = largeurs[k]
            r = np.exp(-np.pi * B / SR)
            a = [1.0, -2 * r * np.cos(2 * np.pi * F / SR), r * r]
            b = [1 - 2 * r * np.cos(2 * np.pi * F / SR) + r * r]
            y[i:i + bloc], zi = sps.lfilter(b, a, out[i:i + bloc], zi=zi)
        out = y
    return out


def trajet(points: list[tuple[float, str]], duree: float, taille: float = 1.0) -> np.ndarray:
    """
    Formants qui glissent entre voyelles : [(instant, voyelle), ...].
    taille > 1 : conduit plus long (homme grand, voix plus sombre).
    """
    n = n_ech(duree)
    out = np.zeros((n, 5))
    for k in range(5):
        out[:, k] = courbe([(t, VOYELLES[v][k] / taille) for t, v in points], duree)
    return out


def vocalise(g, duree: float, f0: list[tuple[float, float]], voyelles: list[tuple[float, str]],
             effort: list[tuple[float, float]], souffle: list[tuple[float, float]],
             niveau: list[tuple[float, float]], craque: list[tuple[float, float]] | None = None,
             taille: float = 1.08, gigue: float = 0.012) -> np.ndarray:
    """Une emission vocale complete, decrite par ses courbes (instant, valeur)."""
    c = lambda pts: np.clip(courbe(pts, duree), 0, None)
    s = source(c(f0), np.clip(c(effort), 0, 1), c(souffle), g, gigue=gigue,
               craque=c(craque) if craque else None)
    y = conduit(s, trajet(voyelles, duree, taille))
    # Correction des poles superieurs (Klatt) : une cascade de CINQ formants
    # a gain unite au continu tombe de ~100 dB a 7 kHz, alors qu'une vraie
    # voix y garde de l'energie (formants 6, 7..., bruit de friction). Sans
    # elle : -33 dB vers 7 kHz contre -5 au reel, et une voix « en carton ».
    aigu = sps.sosfilt(sps.butter(2, [2800, 9000], "band", fs=SR, output="sos"), s)
    y = y / (np.max(np.abs(y)) + EPS) + 0.22 * aigu / (np.max(np.abs(aigu)) + EPS)
    # Rayonnement et petite piece de bouche : un leger passe-haut.
    y = sps.sosfilt(sps.butter(2, 90, "high", fs=SR, output="sos"), y)
    return y * c(niveau)
