"""
Mecanismes et mouvements : ce qui glisse, frotte, roule, siffle.

Un mecanisme, c'est une SUITE de chocs et de frottements a des instants
precis (une pompe : glissiere qui recule, butee, glissiere qui revient,
verrouillage). Le rythme interne fait autant que le timbre : une pompe trop
reguliere sonne comme un synthetiseur, une pompe aux butees molles comme un
jouet.
"""

from __future__ import annotations

import numpy as np

from catalogue import recette
from physique import (SR, choc, colle_glisse, courbe, db, eolien, melange, modes_barre,
                      modes_denses, modes_plaque, n_ech, place, raclement, reponse_modale, unite)
from synth import bandpass, highpass, lowpass
from scipy import signal as sps


def _frotte(force: np.ndarray, md, duree: float) -> np.ndarray:
    """Une force de frottement passee dans un corps : ce corps qui sonne en frottant."""
    return sps.fftconvolve(force, reponse_modale(md, min(duree, 0.6)))[:len(force)]


# ============================================================ ARMES (mecanique)

@recette("crowbar_swing", "weapon", variantes=3, distance=1.0, oreille=None,
         vitesse=(28.0, 12.0, 45.0, "m/s", "vitesse du bout de la barre au plus fort du geste"),
         diametre=(19.0, 8.0, 40.0, "mm", "epaisseur de la barre : plus fine = plus aigu"),
         duree=(0.26, 0.12, 0.5, "s", "duree du geste"))
def pied_de_biche_dans_le_vide(g, vitesse, diametre, duree):
    """
    Le pied-de-biche fend l'air : tons eoliens le long de la barre (St ~ 0,2),
    qui montent et redescendent avec la vitesse du geste. Une barre de 19 mm
    a 28 m/s chante vers 300 Hz au bout — un « vvoum », pas un « fiou » de
    sabre (une lame de 4 mm monterait a 1,4 kHz).
    """
    d = diametre / 1000
    n = n_ech(duree + 0.05)
    t = np.arange(n) / SR
    pic = duree * g.uniform(0.5, 0.62)
    v = vitesse * g.uniform(0.9, 1.1) * np.exp(-0.5 * ((t - pic) / (duree / 4.2)) ** 2)
    air = eolien(v, 0.6, d, g, segments=10, q=5.0)
    # Le froissement de la manche et du poignet, au depart du geste.
    tissu = bandpass(g.standard_normal(n), 900, 5000) * np.exp(-0.5 * ((t - pic * 0.4) / 0.03) ** 2)
    return melange(duree + 0.05, (air, 0.0, 0), (tissu, 0.0, -22))


@recette("shotgun_pump", "weapon", variantes=3, oreille="mecanisme", distance=0.6,
         piece_db=2.0,
         ecart=(0.11, 0.06, 0.25, "s", "temps entre le recul et le retour de la pompe"),
         frottement_db=(-19.0, -40.0, 0.0, "dB", "glissiere qui frotte pendant la course"),
         butee=(1.0, 0.4, 1.6, "", "violence des butees"))
def pompe(g, ecart, frottement_db, butee):
    """
    Rearmement d'un fusil a pompe : la glissiere recule (frottement acier sur
    acier, 40 ms), butee arriere avec ejection de la douille, la glissiere
    revient, butee avant et verrouillage. Quatre evenements, deux butees
    franches — c'est le « tchak-tchak » qu'on reconnait.
    """
    duree = ecart + 0.35
    carcasse = modes_denses(650, 7000, 26, "arme", g, puissance=1.5)
    glissiere = modes_barre(520 * g.uniform(0.95, 1.05), "mecanisme", g, desaccord=0.03)
    out = np.zeros(n_ech(duree))
    course = 0.045
    for k, t0 in enumerate((0.0, ecart)):
        v = courbe([(0, 0), (course * 0.3, 1), (course, 0.6)], course)
        f = raclement(v * 0.8, g, rugosite=0.6, grain_mm=0.15)
        place(out, unite(_frotte(f, glissiere, course)), t0, db(frottement_db))
        b = choc(carcasse, "arme", g, duree=0.2, vitesse=butee * (1.0 if k else 0.85),
                 contact_ms=0.07, part_eclat=0.5)
        place(out, unite(b), t0 + course, db(-1 if k else -3))
        if k == 1:
            # Verrouillage : un petit choc sec juste apres la butee avant.
            v2 = choc(modes_denses(2500, 9000, 8, "mecanisme", g), "mecanisme", g, duree=0.06,
                      vitesse=0.6, contact_ms=0.05)
            place(out, unite(v2), t0 + course + 0.012, db(-9))
    return out


@recette("shell_drop", "weapon", variantes=3, oreille=None, distance=1.5,
         hauteur=(1.2, 0.5, 2.0, "m", "hauteur de chute de la cartouche"))
def cartouche_au_sol(g, hauteur):
    """
    Cartouche de calibre 12 au sol : un tube de plastique (sourd) a culot de
    laiton (qui tinte). Elle rebondit deux ou trois fois et roule.
    """
    tube = modes_denses(900, 5000, 8, "plastique", g)
    culot = modes_denses(4200, 12000, 6, "laiton", g, puissance=1.2)
    out = np.zeros(n_ech(0.9))
    t, v = 0.0, 1.0
    for _ in range(4):
        place(out, unite(choc(tube, "plastique", g, duree=0.08, vitesse=v, contact_ms=0.2)), t, v)
        place(out, unite(choc(culot, "laiton", g, duree=0.2, vitesse=v, contact_ms=0.06)), t + 0.002, 0.7 * v)
        v *= g.uniform(0.3, 0.45)
        t += 2 * v * np.sqrt(2 * 9.81 * hauteur) / 9.81
    return out


# ============================================================ PORTES

# Les durees viennent du JEU (`game/level/doors.ts::MOVEMENT_DEFAULT_DUREE` :
# battant 0,5 s, coulisse 0,45 s, descend 0,6 s, monte 1,4 s ; aucune porte du
# niveau ne les surcharge). Un son qui dure deux a trois fois l'animation —
# 1,2 s pour un battant ouvert en 0,5 s — s'entend « lent et pas naturel »
# (retour d'ecoute du 2026-10-01) : l'oreille cale le son sur le geste.

@recette("door_open", "interact", variantes=3, oreille=None, distance=2.0,
         duree=(0.5, 0.25, 1.2, "s", "duree de l'ouverture (jeu : 0,5 s)"),
         metal=(0.7, 0.0, 1.0, "", "0 = porte en bois, 1 = porte coupe-feu en tole"),
         grincement=(0.15, 0.0, 1.0, "", "un bref grincement de charniere (0 = aucun)"),
         butee_db=(-16.0, -40.0, 0.0, "dB", "le vantail qui arrive en butee"))
def porte_battante(g, duree, metal, grincement, butee_db):
    """
    Porte battante qu'on pousse : la poignee qui bascule et le pene qui
    rentre (deux petits chocs secs), la main qui pousse le vantail (son
    panneau sonne, grave et court), l'air deplace pendant le mouvement, un
    eventuel bref grincement de charniere, et l'arrivee en butee.
    """
    D = duree + 0.25
    n = n_ech(D)
    t = np.arange(n) / SR
    mat = "tole" if metal >= 0.5 else "bois"
    panneau = modes_plaque(75 + 40 * metal, mat, g, lx_sur_ly=2.1, n=26)
    petite = modes_denses(1400, 7000, 10, "mecanisme", g)
    poignee = choc(petite, "mecanisme", g, duree=0.06, vitesse=0.7, contact_ms=0.08)
    pene = choc(petite, "mecanisme", g, duree=0.06, vitesse=1.0, contact_ms=0.06)
    pousse = choc(panneau, mat, g, duree=0.4, vitesse=0.8, contact_ms=2.5)
    v = courbe([(0, 0), (0.04, 0), (0.04 + duree * 0.35, 1.0), (duree, 0.0), (D, 0.0)], D)
    air = lowpass(g.standard_normal(n), 220 + 300 * v.max(), order=2) * v ** 1.5
    out = melange(D, (poignee, 0.0, -8), (pene, 0.028 * g.uniform(0.8, 1.2), -4),
                  (pousse, 0.035, -2), (air, 0.0, -14))
    if grincement > 0.01:
        c = 0.04 + duree * g.uniform(0.3, 0.6)
        p = 0.2 + 0.8 * np.exp(-0.5 * ((t - c) / 0.05) ** 2)
        imp = colle_glisse(v, p, g, f_base=g.uniform(180, 320), regularite=0.85)
        imp *= np.clip((p - 0.3) / 0.5, 0, 1)
        chant = sps.fftconvolve(imp, reponse_modale(modes_denses(800, 4000, 8, "mecanisme", g), 0.04))[:n]
        place(out, unite(chant), 0.0, db(-26 + 20 * grincement))
    arret = choc(panneau, mat, g, duree=0.25, vitesse=0.4, contact_ms=4.0)
    place(out, unite(arret), 0.04 + duree, db(butee_db))
    return out


@recette("door_shutter", "interact", variantes=2, oreille=None, distance=4.0,
         duree=(1.4, 0.6, 3.0, "s", "duree de la course (jeu : 1,4 s)"),
         lames=(32.0, 10.0, 60.0, "", "lames du rideau qui passent par seconde"),
         moteur_db=(-12.0, -40.0, 0.0, "dB", "moteur electrique du rideau"))
def rideau_metallique(g, duree, lames, moteur_db):
    """
    Rideau metallique qui s'enroule : le moteur demarre (un a-coup), chaque
    lame d'acier qui passe sur l'axe claque contre sa voisine (des dizaines de
    petits chocs de tole par seconde, irreguliers), le tablier vibre comme une
    grande tole, et la butee haute arrete tout.
    """
    D = duree + 0.35
    n = n_ech(D)
    t = np.arange(n) / SR
    tole = modes_plaque(70, "tole", g, lx_sur_ly=4, n=40)
    lame = modes_denses(500, 5000, 14, "tole", g, puissance=1.3)
    chocs = np.zeros(n)
    tt = 0.06
    while tt < duree:
        tt += g.exponential(1 / lames) * 0.5 + 0.5 / lames
        if tt < duree:
            chocs[int(tt * SR)] += g.uniform(0.3, 1.0)
    out = unite(sps.fftconvolve(chocs, reponse_modale(lame, 0.05))[:n])
    out += db(-6) * unite(sps.fftconvolve(chocs, reponse_modale(tole, 0.4))[:n])
    env = courbe([(0, 0), (0.06, 1), (duree, 1), (duree + 0.05, 0), (D, 0)], D)
    f_mot = 50 * courbe([(0, 0.6), (0.15, 1.0), (duree, 1.0), (D, 0.8)], D)
    ph = 2 * np.pi * np.cumsum(f_mot) / SR
    moteur = sum(np.sin(h * ph + g.uniform(0, 6)) / h for h in (1, 2, 3, 4, 6))
    moteur += 0.3 * bandpass(g.standard_normal(n), 150, 900)
    out = out * env + db(moteur_db) * unite(moteur) * env
    place(out, unite(choc(tole, "tole", g, duree=0.3, vitesse=0.8, contact_ms=0.3)), 0.0, db(-8))
    place(out, unite(choc(tole, "tole", g, duree=0.35, vitesse=1.0, contact_ms=0.15)), duree, db(-2))
    return out


@recette("door_slide", "interact", variantes=2, oreille=None, distance=3.0,
         duree=(0.45, 0.25, 1.2, "s", "duree de l'ouverture (jeu : 0,45 s ; 0,6 s pour « descend »)"),
         moteur_db=(-8.0, -30.0, 0.0, "dB", "moteur a courroie"))
def porte_coulissante(g, duree, moteur_db):
    """
    Porte automatique de supermarche : un clic de relais, le moteur a courroie
    qui monte en regime et retombe d'un coup, les galets sur le rail, le joint
    en caoutchouc qui se decolle, la butee amortie.
    """
    D = duree + 0.2
    n = n_ech(D)
    t = np.arange(n) / SR
    v = courbe([(0, 0), (duree * 0.25, 1), (duree * 0.8, 0.7), (duree, 0), (D, 0)], D)
    f_mot = 110 + 260 * v
    ph = 2 * np.pi * np.cumsum(f_mot) / SR
    moteur = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.sin(3 * ph + 1)) * v
    moteur += 0.35 * bandpass(g.standard_normal(n), 800, 4000) * v
    galets = raclement(v * 0.7, g, rugosite=0.3, grain_mm=0.4)
    rail = sps.fftconvolve(galets, reponse_modale(modes_denses(300, 3000, 16, "alu", g), 0.1))[:n]
    joint = bandpass(g.standard_normal(n), 300, 2000) * np.exp(-t / 0.03)
    relais = choc(modes_denses(1500, 6000, 8, "mecanisme", g), "mecanisme", g, duree=0.04, contact_ms=0.06)
    butee = choc(modes_denses(200, 2500, 14, "alu", g), "alu", g, duree=0.2, contact_ms=1.5)
    return melange(D, (relais, 0.0, -14), (moteur, 0.01, moteur_db), (rail, 0.01, -4),
                   (joint, 0.02, -14), (butee, duree, -10))


@recette("cart_roll", "interact", variantes=3, oreille=None, distance=3.0,
         vitesse=(1.2, 0.4, 2.5, "m/s", "vitesse du caddie"),
         cliquetis=(1.0, 0.0, 2.0, "", "jeu dans le panier et les roulettes"),
         duree=(2.0, 1.0, 4.0, "s", "duree"))
def caddie(g, vitesse, cliquetis, duree):
    """
    Caddie pousse sur un sol de beton peint : quatre roulettes (diametre
    125 mm) qui roulent — leurs defauts reviennent a chaque tour, v / (pi d)
    — sur les joints du sol, et un panier de fil d'acier qui cliquette des
    que ca secoue. Le detail qui fait exister le magasin.
    """
    n = n_ech(duree)
    t = np.arange(n) / SR
    env = courbe([(0, 0), (0.25, 1), (duree - 0.3, 1), (duree, 0)], duree)
    v = vitesse * env
    f_roue = v / (np.pi * 0.125)
    roule = np.zeros(n)
    for k in range(4):
        ph = 2 * np.pi * np.cumsum(f_roue * g.uniform(0.97, 1.03)) / SR + g.uniform(0, 6)
        bosse = np.maximum(np.sin(ph), 0) ** 12 * g.uniform(0.5, 1)
        roule += bosse + 0.4 * raclement(v * 0.5, g, rugosite=0.4, grain_mm=0.8)
    corps = modes_denses(150, 2500, 30, "acier", g, puissance=1.2)
    rouler = sps.fftconvolve(roule, reponse_modale(corps, 0.15))[:n]
    # Cliquetis : le panier saute quand une roue passe un joint (tous les
    # 60 cm) et a chaque bosse de roulette, avec du hasard.
    secousses = np.zeros(n)
    pos = np.cumsum(v) / SR
    joints = np.nonzero(np.diff(np.floor(pos / 0.6)) > 0)[0]
    for i in joints:
        for _ in range(int(g.integers(2, 6))):
            j = i + int(g.uniform(0, 0.04) * SR)
            if j < n:
                secousses[j] += g.uniform(0.3, 1.0)
    rare = g.random(n) < 6 * cliquetis * env / SR
    secousses += rare * g.uniform(0.1, 0.5, n)
    panier = modes_denses(1200, 9000, 30, "acier", g, puissance=1.2)
    clique = sps.fftconvolve(secousses, reponse_modale(panier, 0.12))[:n]
    return melange(duree, (rouler, 0.0, -2), (clique, 0.0, -9 + 6 * (cliquetis - 1)))
