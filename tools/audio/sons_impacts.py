"""
Impacts et casse : un objet frappe, une matiere qui cede.

Chaque son est un CORPS (ses modes : taille, forme, matiere) excite par un
CONTACT (sa duree : la durete du choc), plus ce qui suit quand l'objet casse
(rafale de micro-ruptures, eclats qui retombent). Voir `physique.py` pour le
pourquoi de chaque brique.

Ce qu'on regle d'abord quand un impact « ne ressemble pas » :
- la matiere ne se lit pas  -> l'amortissement (eta) et la hauteur des modes ;
- ca sonne « en plastique » -> le contact est trop long (choc trop mou) ;
- ca sonne « synthe »       -> trop peu de modes, ou des modes trop purs
  (`dedoublement`, `desaccord`) ;
- la casse ne se lit pas    -> c'est la rafale et les eclats qui la disent,
  pas le premier choc.
"""

from __future__ import annotations

import numpy as np

from catalogue import recette
from physique import (SR, choc, contact, db, eclat, eclats_qui_tombent, fracture,
                      matiere, melange, modes, modes_barre, modes_coque,
                      modes_denses, modes_plaque, n_ech, place, reponse_modale, unite)
from synth import bandpass, highpass, lowpass
from scipy import signal as sps


# ------------------------------------------------------------- grains de casse

def _grain(mat: str, fmin: float, fmax: float, nmodes: int = 4, duree: float = 0.04):
    """Fabrique de micro-ruptures : un minuscule choc dans un minuscule corps."""
    def grain(g, niveau):
        md = modes_denses(fmin * g.uniform(0.7, 1.3), fmax, nmodes, mat, g, puissance=1.2)
        x = choc(md, mat, g, duree=duree, vitesse=1.0, part_eclat=0.8)
        return x * niveau
    return grain


def _brise(x: np.ndarray, t_rupture: float, tau: float = 0.006) -> np.ndarray:
    """
    Un objet qui CASSE cesse de vibrer d'un bloc : apres la rupture, ses modes
    d'ensemble n'existent plus. Sans cette coupure, un bocal brise « sonnait »
    entier pendant une seconde (raie a 900 Hz au spectrogramme) — un verre
    cogne, pas un verre casse.
    """
    t = np.arange(len(x)) / SR
    return x * np.where(t < t_rupture, 1.0, np.exp(-(t - t_rupture) / tau))


# ============================================================ MATIERES FRAPPEES

@recette("crowbar_metal", "weapon", variantes=3, oreille="metal", distance=1.0,
         piece_db=4.0,
         taille=(1.0, 0.5, 2.0, "", "taille de la tole frappee (plus grand = plus grave)"),
         barre_db=(-8.0, -30.0, 0.0, "dB", "le pied-de-biche qui sonne lui-meme dans la main"),
         vitesse=(1.0, 0.4, 1.6, "", "force du coup"))
def pied_de_biche_metal(g, taille, barre_db, vitesse):
    """
    Pied-de-biche contre une tole (etagere, porte de casier). Deux corps qui
    sonnent : la tole (plaque mince, modes denses des 120 Hz) et la barre
    d'acier de 60 cm (barre libre, ~240 Hz, mais tenue a la main).
    """
    tole = modes_plaque(130 / taille, "tole", g, lx_sur_ly=1.6, n=40, dedoublement=0.0008)
    barre = modes_barre(240 * g.uniform(0.95, 1.05), "arme", g)
    a = choc(tole, "tole", g, duree=1.2, vitesse=vitesse, contact_ms=0.12, rugosite=0.2)
    b = choc(barre, "arme", g, duree=0.5, vitesse=vitesse, contact_ms=0.12)
    return melange(1.2, (a, 0.0, 0), (b, 0.0, barre_db))


@recette("impact_metal", "impact", variantes=4, oreille="metal", distance=6.0,
         taille=(1.0, 0.4, 2.5, "", "taille de la piece touchee"),
         ricochet=(0.25, 0.0, 1.0, "", "probabilite d'un sifflement de ricochet"))
def balle_metal(g, taille, ricochet):
    """Balle dans du metal : contact quasi nul, tout l'aigu, tole qui sonne."""
    tole = modes_plaque(220 / taille, "tole", g, lx_sur_ly=1.3, n=36, dedoublement=0.0006)
    x = choc(tole, "tole", g, duree=0.8, vitesse=1.3, contact_ms=0.03, part_eclat=0.6)
    out = np.zeros(n_ech(0.8))
    place(out, x, 0.0)
    if g.random() < ricochet:
        place(out, _ricochet(g), 0.004, db(-10))
    return out


def _ricochet(g) -> np.ndarray:
    """
    Le sifflement d'une balle deformee qui repart en tournoyant : un ton
    eolien qui chute (Doppler en s'eloignant) de ~2-4 kHz a ~1 kHz.
    """
    dur = g.uniform(0.18, 0.35)
    n = n_ech(dur)
    t = np.arange(n) / SR
    f0, f1 = g.uniform(2200, 4200), g.uniform(700, 1300)
    f = f0 * (f1 / f0) ** (t / dur)
    wob = 1 + 0.04 * np.sin(2 * np.pi * g.uniform(18, 35) * t)
    ph = 2 * np.pi * np.cumsum(f * wob) / SR
    env = np.exp(-t / (dur / 3)) * (1 - np.exp(-t / 0.003))
    souffle = bandpass(g.standard_normal(n), 1500, 6000) * 0.15
    return (np.sin(ph) + souffle) * env


@recette("impact_concrete", "impact", variantes=4, oreille="pierre", distance=6.0,
         gravats=(14.0, 0.0, 40.0, "", "petits morceaux de beton qui retombent"),
         poussiere_db=(-14.0, -40.0, 0.0, "dB", "souffle de poussiere et de gravillons"))
def balle_beton(g, gravats, poussiere_db):
    """
    Balle dans du beton : pas de corps qui sonne (le beton est trop massif et
    trop amorti), un eclat sec, la matiere qui s'effrite, des gravillons.
    """
    impact = eclat(0.6, g, couleur=0.2)
    md = modes_denses(600, 6000, 20, "beton", g, puissance=1.5)
    coup = choc(md, "beton", g, duree=0.12, vitesse=1.2, contact_ms=0.04, part_eclat=0.9)
    effrite = fracture(0.12, 900, 0.025, g, grain=_grain("beton", 2000, 9000, 3, 0.012))
    chute = eclats_qui_tombent(int(gravats), 1.2, g, "beton", 2500, 9000, rebonds=2,
                               restitution=0.25, dispersion=0.35, duree=0.9)
    poussiere = bandpass(g.standard_normal(n_ech(0.25)), 1200, 9000) * np.exp(-np.arange(n_ech(0.25)) / (0.05 * SR))
    return melange(0.9, (coup, 0.0, 0), (impact, 0.0, -4), (effrite, 0.001, -8),
                   (poussiere, 0.0, poussiere_db), (chute, 0.0, -20))


@recette("impact_flesh", "impact", variantes=4, oreille="mou", distance=8.0,
         humide=(0.6, 0.0, 1.0, "", "part du claquement humide"))
def balle_chair(g, humide):
    """
    Balle dans un corps : contact long et mou (pas d'aigu de choc), cavite
    thoracique qui resonne grave et s'eteint vite, claquement humide de la
    peau et des tissus.
    """
    cavite = modes_denses(70, 400, 8, "chair", g, puissance=1.0)
    coup = choc(cavite, "chair", g, duree=0.18, vitesse=1.0, contact_ms=2.5, part_eclat=0.0)
    n = n_ech(0.09)
    t = np.arange(n) / SR
    claque = bandpass(g.standard_normal(n), 500, 3500) * np.exp(-t / 0.012) * (1 - np.exp(-t / 0.0015))
    # Les tissus qui se deplacent : un petit glissement de formant, mouille.
    fc = 900 * np.exp(-t / 0.03) + 400
    from physique import passe_bande_variable
    gloup = passe_bande_variable(g.standard_normal(n), fc, q=4) * np.exp(-t / 0.03)
    return melange(0.25, (coup, 0.0, 0), (claque, 0.0015, -6 + 6 * humide), (gloup, 0.004, -12 + 6 * humide))


@recette("crowbar_flesh", "weapon", variantes=3, oreille="mou", distance=1.0,
         masse=(1.0, 0.5, 2.0, "", "poids du coup"))
def pied_de_biche_chair(g, masse):
    """
    Coup de barre dans un corps : la barre d'acier ne sonne pas (elle s'enfonce),
    c'est le corps qui encaisse — grave, pousse, avec le froissement du costume.
    """
    corps = modes_denses(55, 300, 10, "chair", g, puissance=1.0)
    coup = choc(corps, "chair", g, duree=0.3, vitesse=masse, contact_ms=6.0, part_eclat=0.0)
    n = n_ech(0.12)
    t = np.arange(n) / SR
    tissu = bandpass(g.standard_normal(n), 800, 6000) * np.exp(-t / 0.02) * (1 - np.exp(-t / 0.004))
    os_ = choc(modes_denses(400, 2500, 8, "bois", g), "bois", g, duree=0.06, vitesse=0.5, contact_ms=0.6)
    return melange(0.32, (coup, 0.0, 0), (tissu, 0.002, -14), (os_, 0.001, -18))


# ================================================================ CASSE

@recette("impact_glass", "impact", variantes=3, oreille="verre", distance=4.0,
         eclats=(40.0, 5.0, 120.0, "", "nombre d'eclats qui retombent"),
         hauteur=(0.9, 0.3, 2.5, "m", "hauteur de chute des eclats"),
         epaisseur=(1.0, 0.5, 2.0, "", "verre epais (bocal, vitrine) = plus grave"))
def bris_de_verre(g, eclats, hauteur, epaisseur):
    """
    Verre qui casse (bocal, vitrine de surgeles) :
      1. le choc sur le verre entier — modes hauts, peu amortis, par paires ;
      2. la fissure qui court : une rafale tres dense et tres aigue (~20 ms) ;
      3. les eclats qui tombent et rebondissent, tintements qui se resserrent.
    C'est le 3 qui fait entendre « verre casse », le 1 seul est un verre cogne.
    """
    k = 1 / epaisseur
    entier = modes_coque(900 * k, "verre", g, n=12, dedoublement=0.0015)
    coup = choc(entier, "verre", g, duree=0.6, vitesse=1.3, contact_ms=0.06, part_eclat=0.7)
    coup = _brise(coup, g.uniform(0.004, 0.012))
    fissure = fracture(0.05, 6000, 0.012, g, grain=_grain("verre", 3000 * k, 16000, 3, 0.02))
    # Les eclats qui retombent sur l'etagere, tout pres : ils arrivent pendant
    # que la fissure court encore, et relient le choc a la pluie d'eclats.
    proches = eclats_qui_tombent(int(eclats * 0.4), 0.08, g, "verre", 2600 * k, 15000,
                                 rebonds=3, restitution=0.35, dispersion=0.8, duree=0.6)
    chute = eclats_qui_tombent(int(eclats), hauteur, g, "verre", 2200 * k, 14000,
                               rebonds=4, restitution=0.38, dispersion=0.45, duree=1.6)
    return melange(1.6, (coup, 0.0, -2), (fissure, 0.0005, -3), (proches, 0.004, -8),
                   (chute, 0.0, -5))


@recette("prop_break_wood", "impact", variantes=3, oreille="bois", distance=3.0,
         taille=(1.0, 0.5, 2.0, "", "taille de la caisse (plus grand = plus grave)"),
         fibres=(1.0, 0.2, 2.0, "", "densite du crepitement des fibres qui cedent"),
         morceaux=(6.0, 0.0, 16.0, "", "planches et echardes qui retombent"))
def caisse_bois(g, taille, fibres, morceaux):
    """
    Caisse ou etagere en bois qui cede :
      1. le coup sur la planche — bois : modes graves, l'aigu meurt en ms ;
      2. les FIBRES qui cedent : crepitement de 50 a 150 ms, c'est lui qui dit
         « ca casse » (sans lui, c'est un coup sur une caisse) ;
      3. le craquement final, plus grave : la planche qui se separe ;
      4. les morceaux qui retombent, mats.
    """
    planche = modes_plaque(110 / taille, "bois", g, lx_sur_ly=3.5, n=30)
    coup = _brise(choc(planche, "bois", g, duree=0.4, vitesse=1.2, contact_ms=0.35, part_eclat=0.5),
                  0.03, tau=0.02)
    crepite = fracture(0.16, 700 * fibres, 0.045, g, grain=_grain("bois", 900, 6000, 5, 0.03))
    craque = choc(modes_plaque(180 / taille, "bois", g, lx_sur_ly=2.5, n=20), "bois", g,
                  duree=0.3, vitesse=1.0, contact_ms=0.25, part_eclat=0.8)
    chute = eclats_qui_tombent(int(morceaux), 0.8, g, "bois", 250 / taille, 2500,
                               rebonds=2, restitution=0.3, dispersion=0.3, duree=1.0)
    return melange(1.0, (coup, 0.0, 0), (crepite, 0.004, -5),
                   (craque, 0.03 * g.uniform(0.8, 1.4), -5), (chute, 0.0, -12))


@recette("ceramic_break", "impact", variantes=3, oreille="faience", lieu="sanitaires",
         distance=1.5,
         eclats=(18.0, 4.0, 60.0, "", "morceaux de faience qui retombent"),
         eau_db=(-12.0, -40.0, 0.0, "dB", "la gerbe d'eau qui sort de la cuvette cassee"))
def faience_casse(g, eclats, eau_db):
    """
    Cuvette ou urinoir en faience qui eclate : un corps epais et lourd (modes
    plus graves et plus amortis que le verre), une rupture seche, de gros
    morceaux, et l'eau.
    """
    from synth import bubbles
    cuve = modes_coque(520, "faience", g, n=14, dedoublement=0.001)
    coup = _brise(choc(cuve, "faience", g, duree=0.5, vitesse=1.3, contact_ms=0.08, part_eclat=0.7),
                  g.uniform(0.006, 0.015), tau=0.01)
    rupture = fracture(0.06, 2500, 0.015, g, grain=_grain("faience", 2000, 11000, 4, 0.02))
    chute = eclats_qui_tombent(int(eclats), 0.6, g, "faience", 1400, 9000,
                               rebonds=3, restitution=0.3, dispersion=0.25, duree=1.2)
    eau = bubbles(1.0, 260, 1.0, 9.0, seed=int(g.integers(1 << 30)), damping=2.5)
    eau *= np.exp(-np.arange(len(eau)) / (0.35 * SR))
    return melange(1.2, (coup, 0.0, 0), (rupture, 0.0005, -4), (chute, 0.0, -8), (eau, 0.02, eau_db))
