"""
Le Costard : sa voix, son arme.

Distance : le jeu joue ces sons a plein volume, SANS spatialisation
(`playEnemySfx`). La piece integree est donc la seule distance qu'on entend :
a 6 m (la distance critique du magasin), la reverberation valait le direct —
« trop de reverb » (retour d'ecoute du 2026-10-01). Ils sont rendus a 2,5 m,
piece abaissee.

Contrats de gameplay (skill `enemy-state-machine`, `audio-mix-budget`) qui
restent valables quelle que soit la synthese :
- ALERTE : bref, reconnaissable, dit « il t'a vu » ;
- TELEGRAPHIE : >= 200 ms avant les degats, timbre unique, aigu et donc
  localisable — le son le plus important du jeu apres le tir du joueur ;
- BLESSURE : le joueur entend qu'il TOUCHE sans croire qu'il a tue ;
- MORT : le joueur doit arreter de tirer.
"""

from __future__ import annotations

import numpy as np

from catalogue import recette
from physique import SR, choc, db, melange, modes_denses, modes_plaque, n_ech, place, raclement, unite
from sons_armes import _pistolet
from voix import vocalise


@recette("suit_alert", "enemy", variantes=3, oreille="voix", distance=2.5, piece_db=-4.0,
         hauteur=(150.0, 90.0, 260.0, "Hz", "hauteur de la voix au depart du cri"),
         effort=(0.8, 0.2, 1.0, "", "force du cri"),
         taille=(1.08, 0.9, 1.3, "", "taille du conduit vocal (plus grand = plus sombre)"))
def costard_alerte(g, hauteur, effort, taille):
    """
    « Hé ! » — le Costard t'a vu. Attaque soufflee (h), voyelle ouverte qui
    se ferme (è -> e), intonation qui monte puis tombe : une interpellation.
    """
    d = g.uniform(0.32, 0.4)
    h = hauteur * g.uniform(0.92, 1.08)
    return vocalise(g, d,
                    f0=[(0, h * 0.95), (d * 0.3, h * 1.25), (d, h * 0.85)],
                    voyelles=[(0, "â"), (d * 0.25, "è"), (d, "e")],
                    effort=[(0, effort * 0.6), (d * 0.25, effort), (d, effort * 0.7)],
                    souffle=[(0, 1.0), (0.05, 0.25), (d, 0.35)],
                    niveau=[(0, 0), (0.03, 0.6), (0.07, 1.0), (d * 0.75, 0.8), (d, 0)],
                    taille=taille)


@recette("enemy_hurt", "enemy", variantes=4, oreille="voix", distance=2.5, piece_db=-4.0,
         hauteur=(175.0, 100.0, 300.0, "Hz", "hauteur du grognement"),
         souffle=(0.45, 0.0, 1.0, "", "part d'air expulse"),
         taille=(1.08, 0.9, 1.3, "", "taille du conduit vocal"))
def costard_blessure(g, hauteur, souffle, taille):
    """
    Grognement bref quand une balle touche : l'air chasse d'un coup (« heuh »),
    hauteur qui chute, voix qui se serre. Court (~0,2 s) et haut : il ne doit
    pas se confondre avec le rale grave et long de la mort.
    """
    d = g.uniform(0.18, 0.26)
    h = hauteur * g.uniform(0.9, 1.12)
    v = g.choice(["eu", "â", "a"])
    return vocalise(g, d,
                    f0=[(0, h * 1.15), (d * 0.4, h), (d, h * 0.7)],
                    voyelles=[(0, v), (d, "eu")],
                    effort=[(0, 0.95), (d, 0.5)],
                    souffle=[(0, 0.6 + souffle * 0.4), (d * 0.3, souffle * 0.6), (d, souffle)],
                    niveau=[(0, 0), (0.012, 1.0), (d * 0.5, 0.7), (d, 0)],
                    taille=taille, gigue=0.02)


@recette("suit_death", "enemy", variantes=3, oreille="voix", distance=2.5, piece_db=-4.0,
         hauteur=(140.0, 80.0, 220.0, "Hz", "hauteur au debut du rale"),
         chute_db=(-6.0, -30.0, 0.0, "dB", "le corps qui tombe au sol"),
         taille=(1.1, 0.9, 1.3, "", "taille du conduit vocal"))
def costard_mort(g, hauteur, chute_db, taille):
    """
    Rale de mort qui retombe et s'eteint en voix craquee (« aaahh... »), puis
    le corps qui touche le sol : genoux, puis le poids du torse sur le
    carrelage, le froissement du costume.
    """
    d = g.uniform(0.75, 0.95)
    h = hauteur * g.uniform(0.92, 1.08)
    cri = vocalise(g, d,
                   f0=[(0, h * 1.2), (0.12, h * 1.3), (d * 0.6, h * 0.75), (d, h * 0.5)],
                   voyelles=[(0, "a"), (d * 0.5, "â"), (d, "o")],
                   effort=[(0, 0.9), (d * 0.5, 0.5), (d, 0.15)],
                   souffle=[(0, 0.3), (d * 0.6, 0.5), (d, 0.9)],
                   niveau=[(0, 0), (0.03, 1.0), (d * 0.6, 0.7), (d, 0)],
                   craque=[(0, 0), (d * 0.55, 0), (d * 0.85, 0.9), (d, 1.0)],
                   taille=taille, gigue=0.018)
    corps = modes_denses(60, 600, 14, "chair", g, puissance=1.0)
    sol = modes_plaque(90, "beton", g, n=16)
    genoux = choc(corps, "chair", g, duree=0.25, vitesse=0.7, contact_ms=8)
    torse = choc(corps, "chair", g, duree=0.35, vitesse=1.0, contact_ms=12)
    claque = choc(sol, "beton", g, duree=0.2, vitesse=0.8, contact_ms=3)
    t_chute = d * 0.7
    n = n_ech(0.2)
    tissu = raclement(np.linspace(1, 0, n) * 0.5, g, rugosite=1.0, grain_mm=0.3)
    return melange(t_chute + 0.7, (cri, 0.0, 0), (genoux, t_chute, chute_db - 4),
                   (torse, t_chute + 0.16, chute_db), (claque, t_chute + 0.16, chute_db - 8),
                   (tissu, t_chute + 0.1, chute_db - 14))


@recette("suit_telegraph", "enemy", variantes=3, oreille="mecanisme", distance=2.5,
         piece_db=-6.0,
         ecart=(0.075, 0.04, 0.16, "s", "temps entre le recul de la culasse et son retour"),
         chien_db=(-6.0, -30.0, 0.0, "dB", "le chien qu'on arme : le clic aigu, le plus localisable"))
def costard_arme(g, ecart, chien_db):
    """
    Le Costard ARME son pistolet : il tire la culasse (« chk »), la relache
    (« tchak »), et le chien se bloque (« clic »). Un son DIEGETIQUE : il dit
    exactement ce qui va arriver, il est metallique et aigu (localisable en
    stereo), et rien d'autre dans le jeu ne le fait. ~200 ms : assez tot
    avant le tir pour reagir.

    Il remplace un « cliquet + glissando » abstrait qu'il fallait apprendre.
    A distinguer de la pompe du joueur : plus petit, plus aigu, plus sec.
    """
    carcasse = modes_denses(1600, 9000, 20, "arme", g, puissance=1.4)
    culasse = modes_denses(1500, 7000, 14, "mecanisme", g, puissance=1.3)
    out = np.zeros(n_ech(0.4))
    recul = raclement(np.r_[np.linspace(0, 1, n_ech(0.015)), np.linspace(1, 0.3, n_ech(0.02))] * 0.6,
                      g, rugosite=0.5, grain_mm=0.1)
    from scipy import signal as sps
    from physique import reponse_modale
    place(out, unite(sps.fftconvolve(recul, reponse_modale(culasse, 0.05))[:len(recul)]), 0.0, db(-12))
    place(out, unite(choc(carcasse, "arme", g, duree=0.12, vitesse=0.7, contact_ms=0.06)), 0.035, db(-4))
    place(out, unite(choc(carcasse, "arme", g, duree=0.15, vitesse=1.0, contact_ms=0.05)), 0.035 + ecart, 1.0)
    chien = choc(modes_denses(2200, 8000, 8, "mecanisme", g, puissance=1.2), "mecanisme", g,
                 duree=0.06, vitesse=0.8, contact_ms=0.03, part_eclat=0.6)
    place(out, unite(chien), 0.035 + ecart + 0.045, db(chien_db))
    return out


@recette("suit_shot", "enemy", variantes=4, oreille="pistolet", distance=6.0, piece_db=-3.0,
         charge=(1.0, 0.4, 2.5, "x 9 mm", "masse de poudre"),
         saturation=(0.35, 0.0, 1.0, "", "un tir entendu de loin sature moins"))
def costard_tir(g, charge, saturation):
    """
    Le tir du Costard : le meme pistolet que celui du joueur, mais entendu a
    6 m — moins de saturation, pas de culasse audible ni de douille, et la
    piece qui pese bien plus que le direct (distance critique). C'est la
    distance, pas un timbre invente, qui dit « ce n'est pas mon arme ».
    """
    return _pistolet(g, charge, 250.0, 1200.0, -10.0, -24.0, -6.0, saturation, -60.0,
                     coup_db=-14.0, coup_hz=90.0, serrage=0.4)
