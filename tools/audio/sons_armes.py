"""
Armes du joueur et du Costard, par leurs composantes physiques.

Un coup de feu entendu par le tireur, c'est, dans l'ordre (Maher 2006 ;
Mengual, Moffat, Reiss 2016) :

    0 ms      le percuteur — un petit choc d'acier, souvent noye
    ~1 ms     l'ONDE DE SOUFFLE — onde de Friedlander, phase positive de
              0,5 ms (9 mm) a 1-2 ms (calibre 12), suivie de l'oscillation
              du nuage de gaz : 2-3 alternances vers 120-250 Hz, visibles sur
              TOUTES les prises du corpus. C'est le « pop » et son corps.
    0-80 ms   le JET DE GAZ — turbulent, large bande, centre 1-3 kHz
    3-25 ms   la MECANIQUE — culasse qui recule puis revient en batterie
              (pistolet), canon et carcasse qui sonnent (fusil)
    ensuite   la PIECE — echos et reverberation (`espace.py`), ajoutee au rendu
    ~0,5 s    la douille qui touche le sol

Et un micro pres d'une arme sature : toutes les prises reelles ecretent sur 2
a 10 ms. Cette saturation fait partie de ce qu'on reconnait comme « tir ».

Les proportions entre armes viennent de la physique, pas d'un plan de
bandes : la duree du souffle croit comme la racine cubique de la charge
(similitude de Hopkinson), d'ou un pompe plus grave et plus long qu'un
pistolet SANS qu'on ait a le lui interdire l'aigu.
"""

from __future__ import annotations

import numpy as np

from catalogue import recette
from physique import (SR, choc, db, eclats_qui_tombent, friedlander, gaz, melange,
                      micro_sature, modes_barre, modes_denses, n_ech, place, unite)
from synth import highpass, lowpass


def _souffle(g, charge: float, bande: tuple[float, float], n: int = 5,
             grave: float = 0.0, part_resonance: float = 0.9) -> np.ndarray:
    """
    L'onde de souffle telle que le micro la voit : Friedlander, puis ce qui
    resonne juste apres — nuage de gaz qui se dilate trop et se recontracte,
    canon, sol proche, capsule du micro.

    Mesure sur le corpus (faisceau matriciel, 2-30 ms apres la crete, 16
    prises) : PAS une sinusoide, mais un amas de 4 a 6 composantes tres
    amorties (taux 150 a 600 /s, soit 2 a 7 ms), reparties entre ~150 Hz et
    ~1,2 kHz pour les pistolets, un peu plus bas pour les fusils — qui
    ajoutent une composante tres grave (40-75 Hz), la poussee du gros volume
    de gaz. Une resonance unique et peu amortie s'entendait comme une note, et
    la piece la prolongeait en raie.
    """
    T = 0.00045 * charge ** (1 / 3)
    bl = friedlander(T, b=1.1, longueur=0.08)
    t = np.arange(len(bl)) / SR
    att = 1 - np.exp(-t / (T * 1.5))
    lo, hi = bande
    f = np.exp(g.uniform(np.log(lo), np.log(hi), n))
    d = np.exp(g.uniform(np.log(150), np.log(600), n))
    a = np.exp(g.normal(0, 0.6, n))
    res = np.sum(a[:, None] * np.sin(2 * np.pi * f[:, None] * t + g.uniform(0, 6.3, (n, 1)))
                 * np.exp(-d[:, None] * t), axis=0) * att
    if grave > 0:
        fg = g.uniform(40, 75)
        res = unite(res) + grave * -np.sin(2 * np.pi * fg * t) * np.exp(-g.uniform(110, 200) * t) * att
    return unite(bl) + part_resonance * unite(res)


def _front(g, duree_ms: float = 0.3) -> np.ndarray:
    """
    Le front de choc tel que le micro le rend : une onde en N tres breve (la
    balle supersonique, le front qui sature la capsule). Large bande, c'est
    l'aigu du corpus pendant les 3 premieres ms (-11 dB a 10 kHz dans
    l'enveloppe moyenne), et c'est lui qui fait l'attaque instantanee.
    """
    n = max(4, n_ech(duree_ms / 1000))
    onde_n = np.linspace(1, -1, n)
    bruit = g.standard_normal(n * 3) * np.exp(-np.arange(n * 3) / n)
    return highpass(np.r_[onde_n, np.zeros(2 * n)] + 0.5 * bruit, 2500, order=2)


def _jet(g, duree: float, centre: float, decroissance: float) -> np.ndarray:
    """
    Le jet de gaz tel que les prises le montrent : bosse vers 1-2 kHz, aigu
    qui tombe d'environ 6 dB par octave au-dessus (entre 30 et 150 ms, le
    corpus est a -50 dB a 15 kHz, mais pas a zero : le turbulent grésille).
    Un bruit blanc rendait le tir clair et « bruite » (platitude 0,09 contre
    0,01 au reel) ; une coupure a 12 dB/octave l'eteignait au-dessus de 10 kHz.
    """
    x = gaz(duree, g, centre=centre, decroissance=decroissance, souffle=0.0)
    turb = gaz(duree, g, centre=centre, decroissance=decroissance * 1.6, souffle=1.0)
    return lowpass(x, centre * 1.8, order=2) + 0.12 * lowpass(turb, centre * 2, order=1)


# ------------------------------------------------------------ couches de jeu
#
# Direction donnee le 2026-10-01 : « pas assez de puissance », reference Ion
# Fury / DOOM 2016. Le noyau physique ci-dessus est celui d'un MICRO au stand :
# juste, mais un vrai tir enregistre sonne comme un claquement — l'arme de jeu
# moderne y ajoute ce que le tireur SENT (la poussee dans la poitrine) et
# serre la dynamique pour que tout soit fort en meme temps. Deux couches, pas
# un egaliseur :

def _coup(g, f_fin: float, duree: float, depart: float = 2.0) -> np.ndarray:
    """
    Le coup dans la poitrine : la phase basse de l'onde de pression, que le
    corps ressent plus qu'il ne l'entend. Une oscillation tres grave qui part
    plus haut (le front, `depart` x f_fin) et retombe en quelques dizaines de
    ms vers f_fin, eteinte en `duree`.
    """
    n = n_ech(duree * 2.5)
    t = np.arange(n) / SR
    f = f_fin * (1 + (depart - 1) * np.exp(-t / 0.012)) * g.uniform(0.95, 1.05)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return x * np.exp(-t / (duree / 2.3)) * (1 - np.exp(-t / 0.0006))


def _serre(x: np.ndarray, plafond: float, part: float) -> np.ndarray:
    """
    Compression parallele (« New York ») : on garde le transitoire intact et on
    lui ajoute une copie ecrasee par le limiteur CENTRE — le corps et la queue
    remontent, l'attaque reste franche. C'est ce qui fait qu'une arme de DOOM
    est forte de bout en bout au lieu d'un pic suivi de rien.
    """
    from synth import limiteur
    return unite(unite(x) + part * unite(limiteur(x, plafond=plafond, ms=2.0)))


def _pistolet(g, charge, grave_hz, aigu_hz, gaz_db, culasse_db, front_db, saturation,
              douille_db, coup_db=-60.0, coup_hz=75.0, serrage=0.0) -> np.ndarray:
    """Noyau commun : pistolet du joueur (avec couches de jeu) et du Costard (sans)."""
    k = charge ** (1 / 3)
    duree = 0.6
    t0 = 0.0012
    perc = choc(modes_denses(2600, 9000, 8, "mecanisme", g), "mecanisme", g, duree=0.03,
                vitesse=0.5, contact_ms=0.05)
    souffle = _souffle(g, charge, (grave_hz / k, aigu_hz / k))
    jet = _jet(g, 0.14, centre=1100 / k, decroissance=45 / k)
    # La culasse : une piece d'acier lourde qui recule (~3 ms) puis revient en
    # batterie (~15 ms) ; la carcasse tenue en main etouffe tout.
    md = modes_denses(700, 5500, 22, "arme", g, puissance=1.6)
    recul = choc(md, "arme", g, duree=0.12, vitesse=0.6, contact_ms=0.12)
    retour = choc(md, "arme", g, duree=0.15, vitesse=1.0, contact_ms=0.09)
    corps = melange(duree,
                    (perc, 0.0, -32),
                    (souffle, t0, 0),
                    (_front(g), t0, front_db),
                    (jet, t0 + 0.0003, gaz_db),
                    (recul, t0 + 0.003 * g.uniform(0.9, 1.1), culasse_db - 4),
                    (retour, t0 + 0.015 * g.uniform(0.9, 1.1), culasse_db),
                    (_coup(g, coup_hz, 0.06), t0, coup_db))
    sat = micro_sature(corps, saturation)
    if serrage > 0:
        sat = _serre(sat, plafond=0.35 - 0.2 * serrage, part=1.2 * serrage)
    out = highpass(sat, 30, order=2)
    if douille_db > -59:
        douille = eclats_qui_tombent(1, 1.3, g, "laiton", 5500, 9000, rebonds=3,
                                     restitution=0.4, dispersion=0.1, duree=duree)
        place(out, unite(douille), 0.0, db(douille_db))
    return out


@recette("pistol_fire", "weapon", variantes=4, oreille="pistolet",
         lieu="magasin", distance=0.7, piece_db=2.0,
         prereglages={"DOOM": {}, "réaliste": {"coup_db": -40, "serrage": 0, "culasse_db": -22,
                                               "saturation": 0.55, "piece_db": 8}},
         charge=(1.0, 0.4, 2.5, "x 9 mm", "masse de poudre ; plus = souffle plus long et plus grave"),
         coup_db=(-3.0, -40.0, 3.0, "dB", "le coup dans la poitrine : la puissance (DOOM)"),
         coup_hz=(78.0, 45.0, 140.0, "Hz", "hauteur du coup"),
         serrage=(0.7, 0.0, 1.0, "", "compression parallele : fort de bout en bout"),
         culasse_db=(-12.0, -40.0, -3.0, "dB", "culasse qui recule et revient : le metal du pistolet"),
         gaz_db=(-9.0, -30.0, 0.0, "dB", "jet de gaz apres le pop : le souffle sifflant"),
         front_db=(-3.0, -30.0, 0.0, "dB", "front de choc : le claquement large bande de l'attaque"),
         saturation=(0.6, 0.0, 1.0, "", "micro qui sature : le claquement"),
         douille_db=(-34.0, -60.0, -12.0, "dB", "la douille qui tombe au sol"))
def pistolet(g, charge, coup_db, coup_hz, serrage, culasse_db, gaz_db, front_db, saturation, douille_db):
    """
    Pistolet du joueur, 9 mm, facon arme de jeu moderne : le noyau physique
    (souffle, resonances mesurees, gaz, culasse, micro qui sature) + le coup
    dans la poitrine + une compression parallele.
    """
    return _pistolet(g, charge, 200.0, 1200.0, gaz_db, culasse_db, front_db, saturation,
                     douille_db, coup_db=coup_db, coup_hz=coup_hz, serrage=serrage)


@recette("shotgun", "weapon", variantes=4, oreille="fusil",
         lieu="magasin", distance=0.8, piece_db=3.0,
         prereglages={"DOOM": {}, "DOOM sans pompe": {"pompe_db": -60},
                      "réaliste": {"coup_db": -40, "serrage": 0, "canon_db": -24, "pompe_db": -60,
                                   "saturation": 0.65, "piece_db": 8}},
         charge=(7.0, 3.0, 12.0, "x 9 mm", "masse de poudre : 12 ga ~ 7 fois un 9 mm"),
         coup_db=(0.0, -40.0, 4.0, "dB", "le coup dans la poitrine : la puissance (DOOM)"),
         coup_hz=(52.0, 35.0, 100.0, "Hz", "hauteur du coup"),
         serrage=(0.75, 0.0, 1.0, "", "compression parallele : fort de bout en bout"),
         canon_db=(-15.0, -40.0, -3.0, "dB", "le canon et la carcasse qui sonnent"),
         pompe_db=(-5.0, -60.0, 0.0, "dB", "le rearmement « tchak-tchak » apres le tir (Duke 3D) ; -60 = sans"),
         pompe_t=(0.38, 0.25, 0.6, "s", "quand la pompe est actionnee (le tir suivant est a 0,8 s)"),
         gaz_db=(-4.0, -30.0, 0.0, "dB", "jet de gaz : le souffle large du canon long"),
         front_db=(0.0, -30.0, 6.0, "dB", "front de choc : le claquement large bande de l'attaque"),
         saturation=(0.7, 0.0, 1.0, "", "micro qui sature : le claquement"))
def fusil_a_pompe(g, charge, coup_db, coup_hz, serrage, canon_db, pompe_db, pompe_t,
                  gaz_db, front_db, saturation):
    """
    Fusil a pompe calibre 12, facon arme de jeu moderne : noyau physique (souffle
    de grosse charge, resonances, canon d'acier de 70 cm), gros coup grave,
    compression parallele, et la pompe qu'on actionne apres le tir.
    """
    k = charge ** (1 / 3)
    duree = 1.1
    t0 = 0.0015
    perc = choc(modes_denses(1800, 8000, 10, "mecanisme", g), "mecanisme", g, duree=0.04,
                vitesse=0.8, contact_ms=0.06)
    souffle = _souffle(g, charge, (280 / k, 2000 / k), n=6, grave=0.4, part_resonance=0.7)
    jet = _jet(g, 0.25, centre=1700, decroissance=30 / k * 1.5)
    # Canon : un tube d'acier de 70 cm, modes de barre libre (~270 Hz pour un
    # tube de 22 mm), etouffe par les mains et le bois.
    canon = choc(modes_barre(270 * g.uniform(0.95, 1.05), "arme", g, desaccord=0.02),
                 "arme", g, duree=0.4, vitesse=1.0, contact_ms=0.1)
    carcasse = choc(modes_denses(700, 6000, 24, "arme", g, puissance=1.6), "arme", g,
                    duree=0.2, vitesse=1.0, contact_ms=0.1)
    corps = melange(duree,
                    (perc, 0.0, -32),
                    (souffle, t0, 0),
                    (_front(g, 0.6), t0, front_db),
                    (jet, t0 + 0.0004, gaz_db),
                    (canon, t0 + 0.0005, canon_db),
                    (carcasse, t0 + 0.001, canon_db - 3),
                    (_coup(g, coup_hz, 0.13, depart=2.2), t0, coup_db))
    sat = micro_sature(corps, saturation)
    sat = _serre(sat, plafond=0.35 - 0.2 * serrage, part=1.2 * serrage) if serrage > 0 else sat
    out = highpass(sat, 28, order=2)
    if pompe_db > -59:
        from sons_mecanique import pompe
        place(out, unite(pompe(g, ecart=0.11, frottement_db=-16.0, butee=1.1)),
              pompe_t * g.uniform(0.97, 1.03), db(pompe_db))
    return out
