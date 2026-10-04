"""
Le Rampant : reptilien sans costume (lot B4 de PLAN_SUITE.md).

Meme distance et meme piece que le Costard (`sons_costard.py`) : ces sons sont
joues a plein volume, sans spatialisation.

Une voix, mais pas une voix d'homme. Le meme modele source-filtre que le
Costard (`voix.py`), regle sur un autre animal : un conduit vocal court
(formants hauts, timbre clair et nasillard), une hauteur deux a trois fois
plus elevee, beaucoup d'air (un sifflement est du souffle qui passe une
constriction), et une voix qui craque — la crecelle. Rien de cela ne se
confond avec le « Hé ! » du Costard ni avec la culasse de son pistolet.

Contrats de gameplay, les memes que pour le Costard :
- ALERTE : bref, reconnaissable, dit « il t'a vu » ;
- ELAN : avant les degats, timbre unique — il dit « recule » ;
- COUP : le geste, entendu qu'il porte ou non ;
- MORT : le joueur doit arreter de tirer.
"""

from __future__ import annotations

import numpy as np

from catalogue import recette
from physique import SR, choc, eolien, melange, modes_denses, n_ech
from synth import bandpass, highpass
from voix import vocalise


def _sifflement(g, duree: float, centre: tuple[float, float], pic: float) -> np.ndarray:
    """
    Air force entre des dents serrees : bruit de friction dont la bande monte
    avec le debit. Pas de hauteur, seulement une couleur qui glisse.
    """
    n = n_ech(duree)
    t = np.arange(n) / SR
    x = g.standard_normal(n)
    f0, f1 = centre
    # Deux bandes fixes dont on fait glisser le poids : moins cher qu'un filtre
    # variable, et l'oreille entend la meme montee.
    grave = bandpass(x, f0 * 0.7, f0 * 1.5)
    aigu = bandpass(x, f1 * 0.7, min(f1 * 1.5, SR / 2 - 500))
    k = np.clip(t / max(pic, 1e-3), 0, 1)
    env = np.minimum(1, t / 0.012) * np.exp(-np.clip(t - pic, 0, None) / (duree * 0.28))
    return ((1 - k) * grave + k * aigu) * env


@recette("rampant_alert", "enemy", variantes=3, oreille=None, distance=2.5, piece_db=-4.0,
         hauteur=(430.0, 250.0, 700.0, "Hz", "hauteur de la crecelle"),
         taille=(0.72, 0.55, 1.0, "", "taille du conduit vocal : petit = clair et nasillard"),
         souffle_db=(-5.0, -30.0, 3.0, "dB", "le sifflement d'air qui porte le cri"))
def rampant_alerte(g, hauteur, taille, souffle_db):
    """
    Le Rampant t'a vu : une crecelle montante, courte, portee par un
    sifflement (« krrriiih ! »). Aigue et craquee la ou le Costard interpelle
    d'une voix pleine.
    """
    d = g.uniform(0.36, 0.44)
    h = hauteur * g.uniform(0.92, 1.1)
    cri = vocalise(g, d,
                   f0=[(0, h * 0.8), (d * 0.45, h * 1.45), (d, h * 1.1)],
                   voyelles=[(0, "è"), (d * 0.4, "i"), (d, "i")],
                   effort=[(0, 0.7), (d * 0.4, 1.0), (d, 0.6)],
                   souffle=[(0, 0.7), (d * 0.5, 0.45), (d, 0.8)],
                   niveau=[(0, 0), (0.02, 0.8), (d * 0.45, 1.0), (d, 0)],
                   craque=[(0, 0.85), (d * 0.5, 0.45), (d, 0.8)],
                   taille=taille, gigue=0.05)
    air = _sifflement(g, d, (2600, 5200), d * 0.45)
    return melange(d + 0.05, (cri, 0.0, 0), (air, 0.0, souffle_db))


@recette("rampant_telegraph", "enemy", variantes=3, oreille=None, distance=2.5, piece_db=-6.0,
         duree=(0.24, 0.15, 0.4, "s", "duree de l'elan"),
         aigu=(6200.0, 3500.0, 9000.0, "Hz", "ou finit le sifflement : plus haut = plus pressant"))
def rampant_elan(g, duree, aigu):
    """
    L'elan avant le coup de griffe : un sifflement sec qui monte (« kssss »),
    sans voix. Il part au debut du bond, avant les degats : c'est le signal
    pour reculer. Aucun autre son du jeu n'est un souffle aigu qui monte.
    """
    d = duree * g.uniform(0.92, 1.08)
    air = _sifflement(g, d, (2200, aigu), d * 0.75)
    # Un clic de gorge au depart : l'attaque qui le rend localisable.
    clic = choc(modes_denses(1800, 6000, 6, "plastique", g, puissance=1.2), "plastique", g,
                duree=0.03, vitesse=0.7, contact_ms=0.2)
    return melange(d + 0.04, (highpass(air, 1500, order=2), 0.0, 0), (clic, 0.0, -10))


@recette("rampant_attack", "enemy", variantes=3, oreille=None, distance=2.5, piece_db=-6.0,
         vitesse=(34.0, 15.0, 50.0, "m/s", "vitesse du bout des griffes"),
         machoire_db=(-7.0, -40.0, 0.0, "dB", "la machoire qui claque dans le vide"))
def rampant_griffe(g, vitesse, machoire_db):
    """
    Le coup de griffe : des griffes fines qui fendent l'air (ton eolien aigu —
    une griffe de 8 mm chante bien plus haut que le pied-de-biche de 19 mm),
    puis la machoire qui claque. Entendu que le coup porte ou non : l'impact
    sur le joueur a son propre son.
    """
    duree = 0.16
    n = n_ech(duree + 0.04)
    t = np.arange(n) / SR
    pic = duree * g.uniform(0.45, 0.55)
    v = vitesse * g.uniform(0.9, 1.1) * np.exp(-0.5 * ((t - pic) / (duree / 4.5)) ** 2)
    air = eolien(v, 0.35, 0.008, g, segments=6, q=4.0)
    dents = choc(modes_denses(900, 5200, 8, "faience", g, puissance=1.2), "faience", g,
                 duree=0.07, vitesse=0.9, contact_ms=0.15, part_eclat=0.4)
    return melange(duree + 0.12, (air, 0.0, 0), (dents, pic + 0.03, machoire_db))


@recette("rampant_death", "enemy", variantes=3, oreille=None, distance=2.5, piece_db=-4.0,
         hauteur=(400.0, 220.0, 650.0, "Hz", "hauteur au debut du cri"),
         taille=(0.72, 0.55, 1.0, "", "taille du conduit vocal"),
         chute_db=(-9.0, -30.0, 0.0, "dB", "le corps qui tombe : plus leger qu'un Costard"))
def rampant_mort(g, hauteur, taille, chute_db):
    """
    Un cri qui retombe et se defait en crecelle (« kriiiaarrh... »), puis un
    corps leger qui tombe. Plus court et plus aigu que le rale du Costard :
    dans une meute, on doit entendre chaque mort sans que la suivante la
    recouvre.
    """
    d = g.uniform(0.5, 0.62)
    h = hauteur * g.uniform(0.92, 1.08)
    cri = vocalise(g, d,
                   f0=[(0, h * 1.3), (0.08, h * 1.45), (d * 0.6, h * 0.8), (d, h * 0.45)],
                   voyelles=[(0, "i"), (d * 0.45, "è"), (d, "a")],
                   effort=[(0, 1.0), (d * 0.5, 0.6), (d, 0.15)],
                   souffle=[(0, 0.5), (d * 0.6, 0.7), (d, 1.0)],
                   niveau=[(0, 0), (0.015, 1.0), (d * 0.6, 0.65), (d, 0)],
                   craque=[(0, 0.4), (d * 0.4, 0.7), (d, 1.0)],
                   taille=taille, gigue=0.05)
    corps = modes_denses(90, 800, 10, "chair", g, puissance=1.0)
    chute = choc(corps, "chair", g, duree=0.22, vitesse=0.7, contact_ms=7)
    return melange(d + 0.45, (cri, 0.0, 0), (chute, d * 0.75, chute_db))
