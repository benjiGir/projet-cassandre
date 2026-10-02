"""
Ramassages et lecteur de badge : des OBJETS qu'on prend en main.

Un ramassage doit dire ce qu'on a pris sans regarder : une boite de
cartouches qui s'entrechoquent, une trousse en plastique qui claque, de la
nourriture qu'on croque. Ce sont des sons d'objets, donc des modeles
physiques ; seuls les signaux abstraits (secret trouve, interface) restent
de la synthese musicale (`recipes.py`).
"""

from __future__ import annotations

import numpy as np
from scipy import signal as sps

from catalogue import recette
from physique import (SR, choc, db, fracture, melange, modes_coque, modes_denses,
                      modes_plaque, n_ech, place, raclement, reponse_modale, unite)
from synth import bandpass, lowpass


def _secousse(g, n_objets: int, duree: float, mat: str, fmin: float, fmax: float,
              rythme: list[float], dispersion: float = 0.02) -> np.ndarray:
    """
    Objets libres dans une boite secouee (PhISEM de Cook, « shaker ») : a
    chaque secousse, chaque objet heurte la paroi ou un voisin, avec un petit
    retard aleatoire. Chaque objet a ses propres modes.
    """
    out = np.zeros(n_ech(duree))
    objets = [modes_denses(fmin * g.uniform(0.85, 1.2), fmax, 6, mat, g, puissance=1.2)
              for _ in range(n_objets)]
    for t0 in rythme:
        for md in objets:
            if g.random() < 0.8:
                v = g.uniform(0.3, 1.0)
                place(out, choc(md, mat, g, duree=0.12, vitesse=v, contact_ms=0.06),
                      t0 + abs(g.normal(0, dispersion)), v)
    return out


@recette("pickup_ammo", "pickup", variantes=2, oreille=None, distance=0.5,
         cartouches=(8.0, 2.0, 20.0, "", "nombre de cartouches dans la boite"))
def boite_de_munitions(g, cartouches):
    """
    Boite de cartouches ramassee : le carton qu'on saisit (sourd), les
    cartouches qui s'entrechoquent deux fois — le laiton tinte, net et aigu.
    Metallique et court, il ne doit pas se confondre avec un tir.
    """
    carton = choc(modes_plaque(260, "carton", g, n=16), "carton", g, duree=0.12,
                  vitesse=1.0, contact_ms=1.0)
    laiton = _secousse(g, int(cartouches), 0.35, "laiton", 3800, 12000, [0.01, 0.13])
    return melange(0.35, (carton, 0.0, -4), (laiton, 0.0, -2))


@recette("pickup_health", "pickup", variantes=1, oreille=None, distance=0.5,
         fermoir_db=(-3.0, -20.0, 0.0, "dB", "le fermoir en plastique de la trousse"))
def trousse_de_soin(g, fermoir_db):
    """
    Trousse de secours ramassee : la coque en plastique qu'on saisit, le
    fermoir qui claque (deux petits chocs secs), le contenu qui glisse
    (compresses, flacons) — un son doux, « bon pour toi » par sa matiere.
    """
    coque = modes_plaque(380, "plastique", g, n=18)
    prise = choc(coque, "plastique", g, duree=0.15, vitesse=0.6, contact_ms=0.8)
    clic = modes_denses(1800, 8000, 8, "plastique", g)
    c1 = choc(clic, "plastique", g, duree=0.05, vitesse=1.0, contact_ms=0.08, part_eclat=0.8)
    c2 = choc(clic, "plastique", g, duree=0.05, vitesse=0.8, contact_ms=0.08, part_eclat=0.8)
    flacons = _secousse(g, 3, 0.3, "verre", 2500, 9000, [0.05], dispersion=0.03)
    n = n_ech(0.2)
    glisse = lowpass(raclement(np.sin(np.linspace(0, np.pi, n)) * 0.4, g, rugosite=1.0, grain_mm=0.2), 4000)
    return melange(0.4, (prise, 0.0, -6), (c1, 0.04, fermoir_db), (c2, 0.075, fermoir_db - 3),
                   (flacons, 0.0, -16), (glisse, 0.02, -18))


@recette("food_eat", "pickup", variantes=3, oreille=None, distance=0.3, lieu=None,
         croquant=(0.6, 0.0, 1.0, "", "0 = sandwich mou, 1 = biscuit qui craque"),
         bouchees=(2.0, 1.0, 4.0, "", "nombre de mastications"))
def manger(g, croquant, bouchees):
    """
    Une bouchee : les dents qui traversent (une rafale de micro-ruptures,
    d'autant plus aigue et dense que c'est croquant), puis des mastications
    humides, entendues de l'interieur (conduction osseuse : grave, sans piece).
    """
    d = 0.25 + 0.17 * bouchees
    croque = fracture(0.09, 300 + 2500 * croquant, 0.03, g,
                      grain=lambda gg, niv: niv * choc(modes_denses(800 + 3000 * croquant, 9000, 4,
                                                                   "carton", gg), "carton", gg,
                                                      duree=0.02, contact_ms=0.1, part_eclat=0.9))
    out = np.zeros(n_ech(d))
    place(out, unite(croque), 0.0, 1.0)
    for k in range(int(bouchees)):
        t0 = 0.17 + k * 0.17 * g.uniform(0.9, 1.1)
        n = n_ech(0.12)
        t = np.arange(n) / SR
        humide = bandpass(g.standard_normal(n), 300, 2500) * np.exp(-t / 0.03) * (1 - np.exp(-t / 0.01))
        machoire = lowpass(g.standard_normal(n), 250) * np.exp(-t / 0.04)
        place(out, unite(humide), t0, db(-10))
        place(out, unite(machoire), t0, db(-12))
        if croquant > 0.3:
            place(out, unite(fracture(0.04, 800 * croquant, 0.015, g)), t0, db(-16))
    return out


def _bip(f: float, duree: float, carre: float = 0.6) -> np.ndarray:
    """Bip de buzzer piezo : onde presque carree, attaque et relache de 2 ms."""
    n = n_ech(duree)
    t = np.arange(n) / SR
    x = np.tanh(np.sin(2 * np.pi * f * t) * (1 + 8 * carre))
    k = n_ech(0.002)
    x[:k] *= np.linspace(0, 1, k)
    x[-k:] *= np.linspace(1, 0, k)
    return x


@recette("door_locked", "interact", variantes=1, oreille=None, distance=1.0,
         poignee_db=(-6.0, -30.0, 0.0, "dB", "la poignee qu'on secoue contre la gache"))
def lecteur_refus(g, poignee_db):
    """
    Badge refuse : le lecteur repond par deux bips graves (le buzzer piezo
    d'un vrai lecteur, pas une note de synthe), et la poignee qu'on a tiree
    bute contre la gache verrouillee — c'est elle qui dit « ferme a cle ».
    Une machine repond deux fois pareil : aucune variante.
    """
    bips = np.zeros(n_ech(0.4))
    place(bips, _bip(440, 0.11), 0.0)
    place(bips, _bip(440, 0.18), 0.15)
    boitier = lowpass(bips, 3500)
    gache = modes_denses(700, 7000, 20, "mecanisme", g)
    out = np.zeros(n_ech(0.55))
    place(out, unite(boitier), 0.0, db(-4))
    for k, t0 in enumerate((0.05, 0.13)):
        place(out, unite(choc(gache, "mecanisme", g, duree=0.15, vitesse=1.0 - 0.3 * k, contact_ms=0.1)),
              t0, db(poignee_db - 3 * k))
    return out


@recette("door_unlock", "interact", variantes=1, oreille=None, distance=1.0)
def lecteur_accepte(g):
    """
    Badge accepte : un bip aigu bref, puis la gache electrique qui se libere
    — un electro-aimant qui claque (choc sec, metal), et la porte qui
    decolle de son joint.
    """
    bip = lowpass(_bip(1760, 0.09, carre=0.4), 4500)
    gache = modes_denses(900, 8000, 18, "mecanisme", g)
    clac = choc(gache, "mecanisme", g, duree=0.2, vitesse=1.0, contact_ms=0.07, part_eclat=0.5)
    bourdon = np.sin(2 * np.pi * 50 * np.arange(n_ech(0.25)) / SR) * np.exp(-np.arange(n_ech(0.25)) / (0.08 * SR))
    porte = choc(modes_plaque(85, "bois", g, n=20), "bois", g, duree=0.3, vitesse=0.5, contact_ms=1.2)
    return melange(0.7, (bip, 0.0, -6), (clac, 0.12, 0), (bourdon, 0.12, -24), (porte, 0.2, -12))
