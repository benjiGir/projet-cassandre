"""
Modeles physiques du studio : ce qui fait qu'un son ressemble a ce qu'il est.

Les quatre passes rejetees partaient toutes de la meme grammaire — un bruit
filtre sous une enveloppe, plus un sinus qui chute. Cette grammaire sait faire
« un bruit percussif », pas « du verre » : l'oreille reconnait une matiere a des
indices que le bruit filtre n'a pas, et que la physique donne gratuitement.

| Indice perceptif | D'ou il vient | Ici |
|---|---|---|
| la MATIERE (metal, bois, verre) | la loi d'amortissement des modes avec la frequence | `Matiere`, `corps_modal` |
| la DURETE du choc | la duree du contact (Hertz) : un choc mou n'excite pas l'aigu | `contact` |
| la TAILLE de l'objet | la frequence de ses modes, leur densite | `modes_*` |
| la FORME (barre, plaque, coque) | le rapport entre ses modes | `modes_barre`, `modes_plaque`... |
| la CASSE | une rafale de micro-ruptures puis des eclats qui retombent | `fracture` |
| le GRINCEMENT | un frottement colle-glisse, train d'impulsions qui suit la vitesse | `colle_glisse` |
| le SIFFLEMENT d'un objet balance | les tons eoliens (Strouhal) le long de l'objet | `eolien` |
| le COUP DE FEU | l'onde de souffle (Friedlander), les gaz, la culasse | `souffle`, `gaz` |

Sources, pour qui reprend ce fichier :
- K. van den Doel, P. Kry, D. Pai, « FoleyAutomatic », SIGGRAPH 2001 —
  synthese modale, contact, raclement, roulement.
- R. Wildes, W. Richards (1988) ; R. Klatzky, D. Pai, E. Krotkov (2000) —
  le facteur de perte (angle de frottement interne) comme indice de matiere.
- M. Aramaki et al. (2011), « Controlling the perceived material in an impact
  sound synthesizer » — amortissement global + amortissement relatif a f.
- P. Cook, « Real Sound Synthesis for Interactive Applications » (2002) —
  PhISEM, particules stochastiques (eclats, gravier, secousses).
- R. Selfridge, D. Moffat, J. Reiss (2017), « Sound synthesis of objects
  swinging through air using physical models » — tons eoliens, nombre de
  Strouhal, sources compactes le long de l'objet.
- L. Mengual, D. Moffat, J. Reiss (2016), « Modal synthesis of weapon sounds » ;
  R. Maher (2006), caracterisation acoustique des coups de feu — onde de
  souffle de Friedlander, gaz, mecanique.
- D. Moffat, J. Reiss (2018), « Perceptual evaluation of synthesized sound
  effects » — la synthese ADDITIVE/MODALE est la seule jugee aussi realiste
  que l'enregistrement sur toutes les classes testees. D'ou ce module.
- A. Farnell, « Designing Sound » (MIT Press, 2010) — methode : analyser la
  physique d'abord, ne synthetiser qu'ensuite.

Tout est deterministe : chaque fonction qui tire au hasard prend un
`np.random.Generator` (ou une graine), jamais le hasard global.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

import numpy as np
from scipy import signal as sps

from synth import SR, EPS, rng

C_AIR = 343.0       # m/s
NU_AIR = 1.5e-5     # viscosite cinematique de l'air, m2/s


def gen(graine) -> np.random.Generator:
    """Accepte une graine ou un generateur deja cree."""
    return graine if isinstance(graine, np.random.Generator) else rng(graine)


def n_ech(sec: float) -> int:
    return max(1, int(round(sec * SR)))


def place(sortie: np.ndarray, x: np.ndarray, sec: float, gain: float = 1.0) -> None:
    """Additionne x dans sortie a l'instant sec (tronque au bord)."""
    i = int(round(sec * SR))
    if i >= len(sortie) or i + len(x) <= 0:
        return
    a, b = max(0, i), min(len(sortie), i + len(x))
    sortie[a:b] += gain * x[a - i:b - i]


def db(v: float) -> float:
    """Gain lineaire depuis des dB."""
    return 10 ** (v / 20)


# ================================================================ MATIERES
#
# Un mode de frequence f s'eteint au taux d(f) = a0 + pi * eta * f  (1/s).
# eta, le facteur de perte, est une propriete de la MATIERE ; a0 rassemble ce
# qui ne depend pas de f (rayonnement, appui, main qui tient l'objet). C'est la
# loi « globale + relative » d'Aramaki : le metal a les deux faibles, le bois a
# un eta fort (son aigu meurt en quelques ms), le verre est entre les deux mais
# tient son aigu parce que ses modes sont hauts ET peu amortis.
#
# T60 d'un mode = 6,91 / d. Acier a 3 kHz : ~1,2 s. Bois a 2 kHz : ~50 ms.

@dataclass(frozen=True)
class Matiere:
    nom: str
    eta: float          # facteur de perte (tan phi)
    a0: float           # amortissement independant de f, 1/s
    contact_ms: float   # duree typique d'un choc franc avec un objet dur
    inclinaison: float  # pente du rayonnement des modes, dB/octave
    eclat: float        # part du clic de contact large bande (0..1)


MATIERES = {
    "acier":     Matiere("acier",     4e-4,   2.0, 0.08, 0.0, 0.25),
    "tole":      Matiere("tole",      1.6e-3, 7.0, 0.12, -1.0, 0.35),
    "fonte":     Matiere("fonte",     1.2e-3, 5.0, 0.10, -1.5, 0.30),
    "alu":       Matiere("alu",       3e-4,   4.0, 0.10, 0.0, 0.25),
    "laiton":    Matiere("laiton",    8e-4,   6.0, 0.06, 0.5, 0.30),
    # Petite piece d'acier PRISE dans un mecanisme (chien, verrou, gache,
    # ressort) : couplee a une masse, elle ne sonne pas comme une barre libre.
    # Avec « acier », une culasse tintait 0,8 s a 5 kHz — « comme du cristal »
    # (retour d'ecoute du 2026-10-01).
    "mecanisme": Matiere("mecanisme", 4e-3,  70.0, 0.06, -1.5, 0.45),
    # Carcasse d'arme TENUE : acier, mais la main et la crosse l'etouffent.
    "arme":      Matiere("arme",      1.5e-3, 35.0, 0.08, -1.0, 0.35),
    "verre":     Matiere("verre",     1.1e-3, 3.0, 0.06, 1.0, 0.40),
    "faience":   Matiere("faience",   3.5e-3, 9.0, 0.08, 0.0, 0.45),
    "bois":      Matiere("bois",      2.2e-2, 14.0, 0.45, -2.0, 0.55),
    "contreplaque": Matiere("contreplaque", 3e-2, 20.0, 0.5, -2.5, 0.6),
    "plastique": Matiere("plastique", 3.5e-2, 25.0, 0.35, -2.0, 0.5),
    "carton":    Matiere("carton",    9e-2,  45.0, 1.20, -4.0, 0.7),
    "beton":     Matiere("beton",     1.5e-2, 60.0, 0.05, -1.0, 0.85),
    "chair":     Matiere("chair",     0.35,  80.0, 6.00, -6.0, 0.2),
}


def matiere(m: str | Matiere) -> Matiere:
    return m if isinstance(m, Matiere) else MATIERES[m]


# ================================================================ MODES
#
# Un objet = un ensemble de modes (frequence, amplitude, amortissement). Les
# rapports entre modes disent la FORME ; leur echelle dit la TAILLE.

@dataclass
class Modes:
    f: np.ndarray
    a: np.ndarray
    d: np.ndarray

    def __len__(self) -> int:
        return len(self.f)

    def gardes(self, fmax: float = SR / 2 - 500) -> "Modes":
        k = (self.f > 20) & (self.f < fmax)
        return Modes(self.f[k], self.a[k], self.d[k])

    def transposes(self, facteur: float) -> "Modes":
        """Meme objet en plus petit (facteur > 1) ou plus grand."""
        return replace(self, f=self.f * facteur)

    def plus(self, autre: "Modes", gain: float = 1.0) -> "Modes":
        return Modes(np.r_[self.f, autre.f], np.r_[self.a, autre.a * gain], np.r_[self.d, autre.d])


# Rapports modaux de reference (frequence du mode n / mode 1).
BARRE_LIBRE = np.array([1.0, 2.756, 5.404, 8.933, 13.344, 18.638, 24.81, 31.87, 39.81, 48.6])
BARRE_ENCASTREE = np.array([1.0, 6.267, 17.55, 34.39, 56.84, 84.91])   # diapason, lame tenue


def _rapports_plaque(lx_sur_ly: float, n: int) -> np.ndarray:
    """Plaque rectangulaire appuyee : f_mn ~ (m/Lx)^2 + (n/Ly)^2."""
    r = []
    for m in range(1, 12):
        for k in range(1, 12):
            r.append(m ** 2 + (k * lx_sur_ly) ** 2)
    r = np.sort(np.array(r))[:n]
    return r / r[0]


def _rapports_anneau(n: int) -> np.ndarray:
    """Coque mince, modes de flexion en anneau (boite, tuyau, cuvette, verre)."""
    k = np.arange(2, 2 + n)
    r = k * (k ** 2 - 1) / np.sqrt(k ** 2 + 1)
    return r / r[0]


def modes(rapports: np.ndarray, f1: float, mat: str | Matiere, g,
          desaccord: float = 0.01, inclinaison: float | None = None,
          dedoublement: float = 0.0) -> Modes:
    """
    Modes d'un objet a partir de ses rapports, avec ce que le reel ajoute :

    - desaccord : l'objet n'est jamais parfait, chaque mode derive un peu.
    - amplitudes tirees : elles dependent du POINT de frappe (un ventre ou un
      noeud du mode), different a chaque coup — c'est la variation naturelle,
      celle qu'on reconnait, bien mieux qu'un pitch aleatoire.
    - inclinaison : pente du rayonnement avec la frequence (dB/octave).
    - dedoublement : un objet presque symetrique (verre, boite, cloche) a ses
      modes par PAIRES tres proches, qui battent. Valeur = ecart relatif
      (0,0005 = 1 Hz a 2 kHz). C'est le « wah-wah » d'un verre qu'on cogne.
    """
    g = gen(g)
    m = matiere(mat)
    inc = m.inclinaison if inclinaison is None else inclinaison
    f = f1 * rapports * (1 + desaccord * g.standard_normal(len(rapports)))
    a = g.uniform(0.15, 1.0, len(f)) * (f / f1) ** (inc / 6.02)
    a[0] = max(a[0], 0.6)
    if dedoublement > 0:
        df = f * dedoublement * g.uniform(0.5, 1.5, len(f))
        f = np.r_[f - df / 2, f + df / 2]
        a = np.r_[a, a * g.uniform(0.4, 1.0, len(a))]
    d = m.a0 + np.pi * m.eta * f
    return Modes(f, a, d).gardes()


def modes_barre(f1, mat, g, **kw) -> Modes:
    return modes(BARRE_LIBRE, f1, mat, g, **kw)


def modes_plaque(f1, mat, g, lx_sur_ly=1.4, n=24, **kw) -> Modes:
    return modes(_rapports_plaque(lx_sur_ly, n), f1, mat, g, **kw)


def modes_coque(f1, mat, g, n=10, **kw) -> Modes:
    return modes(_rapports_anneau(n), f1, mat, g, **kw)


def modes_denses(fmin: float, fmax: float, n: int, mat, g, puissance: float = 2.0,
                 inclinaison: float | None = None) -> Modes:
    """
    Objet complexe (meuble, caisse, cuvette) : n modes sans rapport simple,
    dont la densite croit avec f — en f^(puissance-1) : ~f^2 pour un solide
    epais, constante (puissance=1) pour une plaque mince.
    """
    g = gen(g)
    u = np.sort(g.random(n))
    f = (fmin ** puissance + u * (fmax ** puissance - fmin ** puissance)) ** (1 / puissance)
    m = matiere(mat)
    inc = m.inclinaison if inclinaison is None else inclinaison
    a = g.uniform(0.1, 1.0, n) * (f / fmin) ** (inc / 6.02)
    return Modes(f, a, m.a0 + np.pi * m.eta * f).gardes()


def reponse_modale(md: Modes, duree: float, g=None, sr: int = SR) -> np.ndarray:
    """
    Reponse impulsionnelle : somme de sinusoides amorties, une par mode.
    Phase de depart nulle : un mode frappe part de sa position de repos.
    """
    n = n_ech(duree)
    out = np.zeros(n)
    t = np.arange(n) / sr
    for i in range(0, len(md), 48):
        f, a, d = md.f[i:i + 48, None], md.a[i:i + 48, None], md.d[i:i + 48, None]
        out += np.sum(a * np.exp(-d * t) * np.sin(2 * np.pi * f * t), axis=0)
    return out


# ================================================================ CONTACT

def contact(duree_ms: float, vitesse: float = 1.0, rugosite: float = 0.0,
            g=None) -> np.ndarray:
    """
    Force d'un choc, modele de Hertz : demi-sinus a la puissance 3/2.

    La duree du contact fait la DURETE entendue : son spectre s'effondre
    au-dessus de ~1,5/duree. Acier sur acier : 0,05-0,1 ms, tout l'aigu passe.
    Poing dans un ventre : 10 ms, plus rien au-dessus de 150 Hz. Le meme corps
    modal frappe par deux contacts differents sonne comme deux chocs
    differents — c'est la que les passes precedentes perdaient « l'impact ».

    vitesse : plus vite = plus fort ET plus court (Hertz : tau ~ v^-1/5).
    rugosite : micro-chocs pendant le contact (surface granuleuse, eclat).
    """
    tau = duree_ms / 1000 * vitesse ** (-0.2)
    n = max(2, n_ech(tau))
    f = np.sin(np.pi * np.arange(n) / n) ** 1.5 * vitesse
    if rugosite > 0:
        g = gen(g)
        f = f * (1 + rugosite * np.abs(g.standard_normal(n)))
    return f


def eclat(duree_ms: float, g, couleur: float = 0.0) -> np.ndarray:
    """
    Le clic de contact, large bande : la deformation locale, le grain qui
    s'ecrase. Bruit tres court a decroissance exponentielle ; couleur > 0
    l'eclaircit (derive), < 0 l'assombrit (integre).
    """
    g = gen(g)
    n = max(4, n_ech(duree_ms / 1000))
    x = g.standard_normal(n) * np.exp(-5 * np.arange(n) / n)
    if couleur > 0:
        x = np.diff(x, prepend=0) * couleur + x * (1 - couleur)
    elif couleur < 0:
        x = sps.lfilter([1 + couleur], [1, couleur], x)
    return x / (np.max(np.abs(x)) + EPS)


def choc(md: Modes, mat: str | Matiere, g, duree: float = 1.0, vitesse: float = 1.0,
         contact_ms: float | None = None, part_eclat: float | None = None,
         rugosite: float = 0.0) -> np.ndarray:
    """
    Un objet frappe : force de contact convoluee par sa reponse modale, plus le
    clic de contact. C'est la brique de base de tout impact.
    """
    g = gen(g)
    m = matiere(mat)
    cms = m.contact_ms if contact_ms is None else contact_ms
    pe = m.eclat if part_eclat is None else part_eclat
    force = contact(cms, vitesse, rugosite, g)
    corps = sps.fftconvolve(force, reponse_modale(md, duree, g))[:n_ech(duree)]
    corps /= np.max(np.abs(corps)) + EPS
    if pe > 0:
        # Le clic est filtre par la meme durete : un choc mou ne claque pas.
        e = eclat(max(0.3, cms * 4), g, couleur=0.3)
        coupure = min(SR / 2 - 200, 2500 / max(cms, 0.02))
        e = sps.sosfilt(sps.butter(2, coupure, "low", fs=SR, output="sos"), e)
        e /= np.max(np.abs(e)) + EPS
        corps[:len(e)] += pe * e
    return corps * vitesse


# ================================================================ FRACTURE

def fracture(duree: float, taux0: float, demi_vie: float, g,
             energie: float = 1.0, grain=None) -> np.ndarray:
    """
    Rafale de micro-ruptures (modele PhISEM de Cook) : des chocs a des
    instants de Poisson dont le taux decroit avec l'energie restante du
    systeme. `grain(g, niveau)` fabrique UN micro-choc — c'est lui qui dit la
    matiere (fibre de bois, verre, ceramique).

    Les fibres d'une planche qui cede crepitent pendant 30 a 150 ms : c'est ce
    crepitement, et pas le « crac » initial, qui fait entendre « bois casse ».
    """
    g = gen(g)
    n = n_ech(duree)
    out = np.zeros(n)
    t = 0.0
    while t < duree:
        taux = taux0 * 0.5 ** (t / demi_vie)
        if taux < 0.5:
            break
        t += g.exponential(1 / taux)
        niveau = energie * 0.5 ** (t / demi_vie) * 10 ** (g.uniform(-18, 0) / 20)
        c = grain(g, niveau) if grain else g.standard_normal(8) * niveau
        place(out, c, t)
    return out


def eclats_qui_tombent(n_eclats: int, hauteur: float, g, mat: str | Matiere,
                       fmin: float, fmax: float, rebonds: int = 3,
                       restitution: float = 0.35, dispersion: float = 0.25,
                       duree: float = 1.5, sol: str = "beton") -> np.ndarray:
    """
    Les morceaux d'un objet casse qui retombent et rebondissent.

    Chaque eclat a sa taille (loi de puissance : beaucoup de petits), donc ses
    modes (petit = aigu), il tombe de `hauteur` (t = sqrt(2h/g)) avec une
    dispersion, puis rebondit : chaque rebond perd de la vitesse
    (restitution) et arrive plus tot que le precedent. Ce motif — des tintements
    qui se resserrent et s'eteignent — est la signature d'un bris de verre.
    """
    g = gen(g)
    out = np.zeros(n_ech(duree))
    t_chute = np.sqrt(2 * max(hauteur, 0.01) / 9.81)
    v_chute = np.sqrt(2 * 9.81 * max(hauteur, 0.01))
    for _ in range(n_eclats):
        taille = g.pareto(1.6) + 1.0                     # 1 = le plus petit
        f1 = np.clip(fmax / taille, fmin, fmax)
        md = modes_denses(f1, min(f1 * 6, SR / 2 - 600), 6, mat, g, puissance=1.3)
        t, v = t_chute * g.uniform(1 - dispersion, 1 + dispersion), v_chute * g.uniform(0.6, 1.0)
        poids = 1.0 / taille ** 0.7
        for r in range(rebonds + 1):
            if t > duree:
                break
            vv = v / v_chute
            son = choc(md, mat, g, duree=min(0.25, duree - t), vitesse=vv,
                       contact_ms=matiere(mat).contact_ms, part_eclat=0.5)
            place(out, son, t, poids * vv)
            v *= restitution * g.uniform(0.7, 1.2)
            t += 2 * v / 9.81
    return out


# ================================================================ FROTTEMENT

def colle_glisse(vitesse: np.ndarray, pression: np.ndarray, g,
                 f_base: float = 300.0, regularite: float = 0.8) -> np.ndarray:
    """
    Frottement colle-glisse (stick-slip) : la surface accroche, la tension
    monte, elle glisse d'un coup, raccroche. Chaque glissement est une
    impulsion ; leur cadence monte avec la vitesse et baisse avec la pression.

    Une charniere qui grince, une semelle sur un carrelage mouille, une craie :
    un TRAIN d'impulsions presque periodique, dont la hauteur suit le geste —
    d'ou ce cote « voix » d'un grincement (le spectrogramme de creak1.ogg
    montre des harmoniques bien rangees, pas du bruit).

    vitesse, pression : courbes [0..1] par echantillon.
    f_base : cadence a vitesse et pression 1.
    regularite : 1 = periodique (couinement), 0 = erratique (craquement).
    Rend un train d'impulsions de force, a passer dans un corps modal.
    """
    g = gen(g)
    n = len(vitesse)
    out = np.zeros(n)
    phase = 0.0
    gigue = 1 - regularite
    i = 0
    while i < n:
        v, p = vitesse[i], max(pression[i], 0.05)
        cadence = f_base * v / p ** 0.5
        if cadence < 2 or v < 0.02:
            i += 64
            continue
        periode = 1.0 / cadence * (1 + gigue * g.standard_normal() * 0.5)
        i += max(1, int(periode * SR))
        if i < n:
            out[i] += p * v ** 0.5 * (1 + gigue * g.uniform(-0.6, 0.6))
    return out


def raclement(vitesse: np.ndarray, g, rugosite: float = 1.0, grain_mm: float = 1.0) -> np.ndarray:
    """
    Raclement (van den Doel) : on lit le profil de la surface a la vitesse du
    contact. Profil fractal en 1/f^beta ; plus on va vite, plus il monte dans
    l'aigu. Rend une force, a passer dans un corps modal.
    """
    g = gen(g)
    n = len(vitesse)
    # Position parcourue (m) -> echantillonnage du profil a pas fixe de grain.
    pos = np.cumsum(np.maximum(vitesse, 0)) / SR
    pas = grain_mm / 1000
    longueur = int(pos[-1] / pas) + 8
    profil = np.cumsum(g.standard_normal(longueur))
    profil = profil - np.convolve(profil, np.ones(16) / 16, "same")
    profil += rugosite * g.standard_normal(longueur) * 0.5
    x = np.interp(pos / pas, np.arange(longueur), profil)
    return np.diff(x, prepend=x[0]) * SR * pas


# ================================================================ AIR

def eolien(vitesse_bout: np.ndarray, longueur: float, diametre: float, g,
           segments: int = 8, q: float = 6.0) -> np.ndarray:
    """
    Objet balance dans l'air (Selfridge, Moffat, Reiss 2017).

    Un cylindre de diametre d dans un flux u laisse des tourbillons alternes
    (allee de von Karman) a f = St * u / d, St ~ 0,2 : c'est le ton eolien.
    Un objet qui tourne autour d'un pivot a une vitesse qui croit le long de
    son corps — on le decoupe en `segments` sources compactes, chacune a SA
    vitesse donc SA hauteur, et on somme. L'intensite d'un dipole croit en u^6,
    l'amplitude en u^3 : le son n'existe vraiment qu'au plus fort du geste.

    Le ton n'est pas pur : a ces nombres de Reynolds (~1e4-1e5), la frequence de
    detachement fluctue. Chaque source est une sinusoide dont la phase derive
    (bande ~ f/q), plus le sillage turbulent large bande, et le ton de TRAINEE
    a 2f, plus faible.

    vitesse_bout : vitesse du bout de l'objet (m/s) par echantillon.
    """
    g = gen(g)
    n = len(vitesse_bout)
    out = np.zeros(n)
    rayons = (np.arange(segments) + 0.5) / segments
    sos_derive = sps.butter(2, 40, "low", fs=SR, output="sos")
    for r in rayons:
        u = vitesse_bout * r
        f = 0.2 * u / diametre
        # Phase qui derive : bruit lent, ecart-type ~ largeur de bande f/q.
        derive = sps.sosfilt(sos_derive, g.standard_normal(n))
        derive /= np.std(derive) + EPS
        f_inst = np.maximum(f * (1 + derive / q), 0)
        phase = 2 * np.pi * np.cumsum(f_inst) / SR
        amp = (u / 30.0) ** 3 * (longueur / segments)
        out += amp * (np.sin(phase + g.uniform(0, 6.3)) + 0.25 * np.sin(2 * phase + g.uniform(0, 6.3)))
    # Sillage : bruit dont la coupure suit la vitesse.
    sillage = g.standard_normal(n)
    fc = np.clip(0.2 * vitesse_bout / diametre * 6, 200, 12000)
    sillage = _passe_bas_variable(sillage, fc)
    out += 0.35 * sillage * (vitesse_bout / 30.0) ** 3 * longueur
    return out


def _passe_bas_variable(x: np.ndarray, fc: np.ndarray, blocs: int = 256) -> np.ndarray:
    """Passe-bas d'ordre 2 dont la coupure varie, par blocs, etat conserve."""
    out = np.zeros_like(x)
    zi = np.zeros((1, 2))
    for i in range(0, len(x), blocs):
        f = float(np.clip(np.mean(fc[i:i + blocs]), 30, SR / 2 - 500))
        sos = sps.butter(2, f, "low", fs=SR, output="sos")
        out[i:i + blocs], zi = sps.sosfilt(sos, x[i:i + blocs], zi=zi)
    return out


def passe_bande_variable(x: np.ndarray, fc: np.ndarray, q: float = 2.0,
                         blocs: int = 256) -> np.ndarray:
    """Resonance dont la frequence varie (formant qui glisse, tuyau qui se remplit)."""
    out = np.zeros_like(x)
    zi = np.zeros(2)
    for i in range(0, len(x), blocs):
        f = float(np.clip(np.mean(fc[i:i + blocs]), 40, SR / 2 - 800))
        b, a = sps.iirpeak(f, q, fs=SR)
        out[i:i + blocs], zi = sps.lfilter(b, a, x[i:i + blocs], zi=zi)
    return out


# ================================================================ DETONATION

def friedlander(duree_pos: float, b: float = 1.2, longueur: float | None = None) -> np.ndarray:
    """
    Onde de souffle (Friedlander) : p(t) = (1 - t/T) exp(-b t/T).

    Montee quasi instantanee (le front de choc), phase positive de duree T,
    puis phase NEGATIVE plus longue et plus faible — l'air qui revient. C'est
    elle qui donne au coup de feu son « pop » sourd : son spectre culmine vers
    1/(2T). Pistolet a 1 m : T ~ 0,4-0,8 ms ; fusil de chasse : 1-2 ms.
    Le T augmente comme la racine cubique de la charge (loi de similitude).
    """
    n = n_ech(longueur if longueur else duree_pos * 12)
    t = np.arange(n) / SR
    return (1 - t / duree_pos) * np.exp(-b * t / duree_pos)


def gaz(duree: float, g, centre: float = 1800.0, decroissance: float = 45.0,
        souffle: float = 0.6) -> np.ndarray:
    """
    Les gaz de combustion qui sortent du canon : un jet turbulent, bruit large
    bande centre vers 1-3 kHz qui s'eteint en quelques dizaines de ms. C'est
    la « queue » sifflante juste apres le pop.
    """
    g = gen(g)
    n = n_ech(duree)
    x = g.standard_normal(n)
    sos = sps.butter(2, [centre / 3, min(centre * 3, SR / 2 - 500)], "band", fs=SR, output="sos")
    jet = sps.sosfilt(sos, x)
    jet /= np.max(np.abs(jet)) + EPS
    t = np.arange(n) / SR
    env = np.exp(-decroissance * t) * (1 - np.exp(-t / 0.0004))
    return (jet * (1 - souffle) + souffle * x / (np.max(np.abs(x)) + EPS)) * env


def micro_sature(x: np.ndarray, saturation: float = 0.6, genou: float = 0.08) -> np.ndarray:
    """
    Ce que fait la chaine d'enregistrement pres d'une arme : elle ECRETE.
    Toutes les prises du corpus ont des plateaux plats a pleine echelle sur 1
    a 10 ms (capsule ou convertisseur en butee). C'est un ecretage DUR — une
    saturation douce (tanh) n'en a ni les plateaux ni l'aigu : l'enveloppe
    moyenne du corpus garde -11 a -18 dB vers 10-14 kHz, une tanh laissait
    -30 dB.

    saturation : 0 = rien, 1 = gain de ~7 avant butee. genou : arrondi du coin
    (fraction de la pleine echelle), pour ne pas fabriquer de repliement inutile.
    """
    y = x / (np.max(np.abs(x)) + EPS) / max(1.0 - 0.85 * saturation, 0.05)
    a = np.abs(y)
    k = 1.0 - genou
    doux = np.where(a <= k, a, k + genou * np.tanh((a - k) / genou))
    y = np.sign(y) * np.minimum(doux, 1.0)
    return y / (np.max(np.abs(y)) + EPS)


# ================================================================ OUTILS

def courbe(points: list[tuple[float, float]], duree: float, lisse: bool = True) -> np.ndarray:
    """Courbe par points (seconde, valeur), interpolee ; lissee en cosinus."""
    n = n_ech(duree)
    t = np.arange(n) / SR
    ts, vs = zip(*points)
    if not lisse:
        return np.interp(t, ts, vs)
    out = np.empty(n)
    ts, vs = np.array(ts), np.array(vs)
    k = np.clip(np.searchsorted(ts, t) - 1, 0, len(ts) - 2)
    u = np.clip((t - ts[k]) / np.maximum(ts[k + 1] - ts[k], EPS), 0, 1)
    out[:] = vs[k] + (vs[k + 1] - vs[k]) * (1 - np.cos(np.pi * u)) / 2
    return out


def unite(x: np.ndarray) -> np.ndarray:
    """Crete a 1 (une couche dont on regle ensuite le gain en dB)."""
    return x / (np.max(np.abs(x)) + EPS)


def melange(duree: float, *couches: tuple[np.ndarray, float, float]) -> np.ndarray:
    """
    Somme de couches (signal, instant en s, gain en dB), chaque signal ramene
    a crete 1 avant gain : les gains se lisent et se comparent.
    """
    out = np.zeros(n_ech(duree))
    for x, t0, gdb in couches:
        place(out, unite(x), t0, db(gdb))
    return out
