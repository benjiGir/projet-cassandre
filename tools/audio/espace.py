"""
Acoustique des lieux : la piece fait la moitie d'un son.

Un coup de feu dans un hypermarche ne sonne pas comme au stand de tir, et
c'est surtout la piece qu'on entend apres les 10 premieres ms. L'ancienne
`synth.reverb` (bruit qui decroit, meme couleur partout) donnait a tous les
sons du jeu la meme queue : les timbres convergeaient, et aucun lieu
n'existait. Ici la piece est CALCULEE depuis ce qu'elle est :

- ses dimensions et la matiere de chaque paroi (coefficients d'absorption
  par octave, tables usuelles d'acoustique du batiment) ;
- les PREMIERES REFLEXIONS par la methode des sources-images (Allen et
  Berkley, 1979) : chaque paroi renvoie une copie du son, retardee de son
  trajet, attenuee par la distance, la paroi et l'air. Ce sont elles qui
  disent la TAILLE du lieu — l'echo net d'un mur a 20 m, le flottement d'un
  couloir etroit ;
- la QUEUE diffuse, par octave, avec la duree de reverberation d'Eyring :
  le beton garde l'aigu, une reserve encombree l'avale ;
- son NIVEAU, par la distance critique : r_c = 0,057 sqrt(V / T60). A la
  distance r de la source, l'energie reverberee vaut (r / r_c)^2 fois le
  direct. Pas de « mix » a regler au jugé.

Un son de recette est rendu SEC ; la piece s'applique au rendu (voir
`catalogue.py`), et l'oreille (`oreille.py`) juge le son sec. Une recette ne
choisit que le lieu et la distance.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy import signal as sps

from synth import SR, EPS, rng

C = 343.0
BANDES = np.array([63, 125, 250, 500, 1000, 2000, 4000, 8000], dtype=float)

# Coefficients d'absorption alpha par octave (63 Hz -> 8 kHz). Valeurs des
# tables usuelles (beton, carrelage, vitrage, plaque de platre...) ; 63 et
# 8k sont prolonges depuis 125 et 4k. « rayonnages » est une surface
# equivalente de gondoles chargees — des objets qui absorbent et diffusent,
# comme un public assis dans une salle.
ABSORPTION = {
    "beton":        [0.01, 0.01, 0.02, 0.04, 0.06, 0.08, 0.10, 0.10],
    "beton_peint":  [0.01, 0.01, 0.01, 0.02, 0.02, 0.02, 0.02, 0.03],
    "carrelage":    [0.01, 0.01, 0.01, 0.01, 0.01, 0.02, 0.02, 0.03],
    "bac_acier":    [0.25, 0.20, 0.15, 0.10, 0.08, 0.05, 0.05, 0.05],
    "faux_plafond": [0.20, 0.30, 0.50, 0.70, 0.80, 0.80, 0.70, 0.65],
    "vitrage":      [0.35, 0.35, 0.25, 0.18, 0.12, 0.07, 0.04, 0.03],
    "platre":       [0.30, 0.29, 0.10, 0.05, 0.04, 0.07, 0.09, 0.09],
    "bois":         [0.15, 0.15, 0.11, 0.10, 0.07, 0.06, 0.07, 0.07],
    "rayonnages":   [0.15, 0.25, 0.35, 0.45, 0.55, 0.60, 0.60, 0.60],
    "cartons":      [0.10, 0.20, 0.35, 0.45, 0.55, 0.55, 0.55, 0.55],
    "sol_vinyle":   [0.02, 0.02, 0.02, 0.03, 0.03, 0.04, 0.04, 0.04],
    "plein_air":    [1.0] * 8,
    "terre":        [0.15, 0.15, 0.25, 0.40, 0.55, 0.60, 0.60, 0.65],
}

# Absorption de l'air, dB par metre (20 degres, 50 % HR, ISO 9613-1 arrondie).
AIR_DB_M = np.array([0.0001, 0.0004, 0.001, 0.002, 0.005, 0.01, 0.03, 0.1])


@dataclass(frozen=True)
class Lieu:
    """
    Une boite : dimensions (x, y, z) en m, et une matiere par paroi :
    sol, plafond, murs (x-, x+, y-, y+). `encombrement` : surface equivalente
    d'objets qui absorbent (m2 de « rayonnages »), et qui DIFFUSENT — elle
    brouille aussi les echos discrets (une gondole casse le flutter).
    """
    nom: str
    dims: tuple[float, float, float]
    sol: str
    plafond: str
    murs: tuple[str, str, str, str]
    encombrement: float = 0.0
    matiere_encombrement: str = "rayonnages"
    ordre: int = 3
    t_melange: float | None = None     # debut de la queue diffuse (s) ; defaut ~ sqrt(V) ms
    queue_db: float = 0.0              # niveau de queue en plus de la distance critique
    source: tuple[float, float, float] | None = None
    auditeur: tuple[float, float, float] | None = None

    @property
    def volume(self) -> float:
        return float(np.prod(self.dims))

    def surfaces(self) -> list[tuple[float, str]]:
        x, y, z = self.dims
        return [(x * y, self.sol), (x * y, self.plafond),
                (y * z, self.murs[0]), (y * z, self.murs[1]),
                (x * z, self.murs[2]), (x * z, self.murs[3])]

    def t60(self) -> np.ndarray:
        """Duree de reverberation par octave, formule d'Eyring + air."""
        S = sum(s for s, _ in self.surfaces())
        A = sum(s * np.array(ABSORPTION[m]) for s, m in self.surfaces())
        A = A + self.encombrement * np.array(ABSORPTION[self.matiere_encombrement])
        S_tot = S + self.encombrement
        a_moy = np.clip(A / S_tot, 1e-4, 0.999)
        m_air = AIR_DB_M / (10 * np.log10(np.e))      # Neper/m (intensite: x2 ci-dessous)
        return 0.161 * self.volume / (-S_tot * np.log(1 - a_moy) + 4 * m_air * self.volume)


# --------------------------------------------------------------- les lieux

LIEUX = {
    # Surface de vente : 60 x 40 m, 6 m sous bac acier, sol beton peint,
    # facade vitree, et surtout des gondoles chargees partout.
    "magasin": Lieu("magasin", (60, 40, 6), "beton_peint", "bac_acier",
                    ("platre", "vitrage", "platre", "beton"),
                    encombrement=2600, source=(22, 18, 1.5), auditeur=(23, 18.6, 1.6)),
    # Reserve : 30 x 20 x 8, beton brut, rayonnages de cartons — plus vide.
    "reserve": Lieu("reserve", (30, 20, 8), "beton", "bac_acier",
                    ("beton", "beton", "beton", "beton"),
                    encombrement=700, matiere_encombrement="cartons",
                    source=(11, 8, 1.5), auditeur=(11.8, 8.3, 1.6)),
    # Sanitaires : 5 x 3,5 x 2,6, carrelage, cloisons de cabines en bois
    # stratifie, lavabos. Court, brillant, dense : ~1,2 s au medium, comme un
    # vrai bloc sanitaire (le carrelage seul donnerait 4,7 s, une cathedrale).
    "sanitaires": Lieu("sanitaires", (5, 3.5, 2.6), "carrelage", "platre",
                       ("carrelage", "bois", "carrelage", "carrelage"),
                       encombrement=6, matiere_encombrement="cartons",
                       source=(2.0, 1.4, 1.2), auditeur=(2.6, 1.9, 1.6), ordre=4),
    # Couloir de service : 25 x 2,2 x 3 — l'echo flottant entre deux murs.
    "couloir": Lieu("couloir", (25, 2.2, 3), "beton_peint", "platre",
                    ("beton", "beton", "platre", "platre"),
                    encombrement=14, matiere_encombrement="cartons",
                    source=(8, 1.0, 1.5), auditeur=(8.7, 1.2, 1.6), ordre=5),
    # Bureau de la direction : 6 x 5 x 2,7, faux plafond, moquette (bois ici).
    "bureau": Lieu("bureau", (6, 5, 2.7), "bois", "faux_plafond",
                   ("platre", "vitrage", "platre", "platre"),
                   encombrement=12, source=(2.5, 2.0, 1.3), auditeur=(3.1, 2.4, 1.6)),
    # Stand de tir en plein air : sol de terre, et une butte a ~24 m — c'est
    # l'ECHO a ~140 ms qu'on voit sur toutes les prises de la bibliotheque
    # d'armes. Sert a juger une arme SECHE contre le corpus reel.
    # La queue diffuse (terrain, arbres, abri du pas de tir) est calee sur
    # les prises : -45 a -55 dB sous la crete entre 200 et 400 ms.
    "stand": Lieu("stand", (60, 60, 60), "terre", "plein_air",
                  ("plein_air", "plein_air", "plein_air", "terre"),
                  source=(30, 36, 1.5), auditeur=(30.6, 36.3, 1.6), ordre=1,
                  t_melange=0.02, queue_db=14.0),
}


# --------------------------------------------------------------- calcul

def _filtres_octave() -> list[np.ndarray]:
    """Bancs passe-bande d'octave, de somme quasi plate (bords en passe-bas/haut)."""
    sos = []
    for i, f in enumerate(BANDES):
        lo, hi = f / np.sqrt(2), f * np.sqrt(2)
        if i == 0:
            sos.append(sps.butter(3, hi, "low", fs=SR, output="sos"))
        elif i == len(BANDES) - 1:
            sos.append(sps.butter(3, lo, "high", fs=SR, output="sos"))
        else:
            sos.append(sps.butter(3, [lo, hi], "band", fs=SR, output="sos"))
    return sos


_OCT = _filtres_octave()


def _par_bandes(trains: np.ndarray) -> np.ndarray:
    """trains (8, n) : un train d'impulsions par octave -> somme filtree (phase nulle)."""
    return sum(sps.sosfiltfilt(s, tr) for s, tr in zip(_OCT, trains))


def reponse(lieu: Lieu, distance: float | None = None, graine: int = 0,
            duree: float | None = None) -> np.ndarray:
    """
    Reponse impulsionnelle du lieu, direct exclu (le son sec le porte deja).

    distance : ecart source-auditeur (m), le long de l'axe x ; par defaut
    celui du lieu. Plus on est loin, plus la piece pese face au direct.
    """
    g = rng(graine)
    X = np.array(lieu.dims, dtype=float)
    src = np.array(lieu.source or X / 2)
    aud = np.array(lieu.auditeur or X / 2 + [1, 0, 0])
    if distance is not None:
        dirn = (aud - src) / (np.linalg.norm(aud - src) + EPS)
        aud = np.clip(src + dirn * distance, 0.3, X - 0.3)
    d0 = float(np.linalg.norm(aud - src))
    t60 = lieu.t60()
    t_max = duree or float(min(4.0, np.max(t60) * 1.1 + 0.05))
    n = int(t_max * SR)

    beta = {m: np.sqrt(1 - np.array(ABSORPTION[m])) for m in ABSORPTION}
    # Parois, dans l'ordre : x=0, x=X, y=0, y=Y, z=0 (sol), z=Z (plafond).
    parois = [lieu.murs[0], lieu.murs[1], lieu.murs[2], lieu.murs[3], lieu.sol, lieu.plafond]
    # La diffusion des objets disperse les echos discrets : leur part
    # speculaire baisse avec l'encombrement rapporte a la surface au sol.
    diffus = min(0.8, lieu.encombrement / (X[0] * X[1] + EPS) * 0.6)

    trains = np.zeros((len(BANDES), n))
    N = lieu.ordre
    rng_ = range(-N, N + 1)
    for nx in rng_:
        for ny in rng_:
            for nz in rng_:
                if abs(nx) + abs(ny) + abs(nz) > N:
                    continue
                for px in (0, 1):
                    for py in (0, 1):
                        for pz in (0, 1):
                            if (nx, ny, nz, px, py, pz) == (0, 0, 0, 0, 0, 0):
                                continue
                            img = np.array([
                                (1 - 2 * px) * src[0] + 2 * nx * X[0],
                                (1 - 2 * py) * src[1] + 2 * ny * X[1],
                                (1 - 2 * pz) * src[2] + 2 * nz * X[2],
                            ])
                            # Nombre de rebonds sur chaque paroi.
                            rx0, rx1 = abs(nx - px), abs(nx)
                            ry0, ry1 = abs(ny - py), abs(ny)
                            rz0, rz1 = abs(nz - pz), abs(nz)
                            g_b = (beta[parois[0]] ** rx0 * beta[parois[1]] ** rx1 *
                                   beta[parois[2]] ** ry0 * beta[parois[3]] ** ry1 *
                                   beta[parois[4]] ** rz0 * beta[parois[5]] ** rz1)
                            if np.max(g_b) < 1e-4:
                                continue
                            dist = float(np.linalg.norm(img - aud))
                            k = int(round((dist - d0) / C * SR))
                            if k <= 0 or k >= n:
                                continue
                            ordre = rx0 + rx1 + ry0 + ry1 + rz0 + rz1
                            spec = (1 - diffus) ** ordre
                            gain = g_b * (d0 / dist) * 10 ** (-AIR_DB_M * dist / 20) * spec
                            trains[:, k] += gain
    premieres = _par_bandes(trains)

    # Queue diffuse : bruit par octave a decroissance de T60, a partir du temps
    # de melange (~ sqrt(V) ms), energie fixee par la distance critique.
    t = np.arange(n) / SR
    t_mix = lieu.t_melange or min(0.002 * np.sqrt(lieu.volume) + 0.005, t_max / 3)
    queue_b = np.zeros((len(BANDES), n))
    for i, T in enumerate(t60):
        rc = 0.057 * np.sqrt(lieu.volume / max(T, 0.05))
        e_rev = (d0 / rc) ** 2 * 10 ** (lieu.queue_db / 10)   # energie reverberee / directe
        decr = np.exp(-6.91 * t / T)
        # Energie totale de exp(-13.8 t/T) : T/13.8 ; on norme pour que
        # l'integrale du carre vaille e_rev (le direct sec a une energie ~1/SR
        # par echantillon unitaire : on raisonne par impulsion unite).
        bruit = g.standard_normal(n) * decr
        bruit *= np.sqrt(e_rev / (np.sum(bruit ** 2) + EPS))
        queue_b[i] = bruit
    rampe = np.clip((t - t_mix * 0.5) / (t_mix + EPS), 0, 1) ** 2
    queue = _par_bandes(queue_b) * rampe
    # Les premieres reflexions s'effacent dans la queue apres le melange.
    attenue = np.clip(1.2 - t / (t_mix * 2 + EPS), 0, 1)
    return premieres * attenue + queue


def dans(x: np.ndarray, lieu: str | Lieu, distance: float | None = None,
         graine: int = 0, sec: float = 1.0) -> np.ndarray:
    """
    Place un son sec dans un lieu : direct + reponse du lieu. `sec` regle le
    direct (un son entendu derriere une gondole perd son direct, pas sa piece).
    """
    lieu = LIEUX[lieu] if isinstance(lieu, str) else lieu
    ri = reponse(lieu, distance, graine)
    mouille = sps.fftconvolve(x, ri)
    out = np.zeros(len(mouille))
    out[:len(x)] += x * sec
    return out + mouille


def resume(lieu: str | Lieu) -> dict:
    lieu = LIEUX[lieu] if isinstance(lieu, str) else lieu
    t60 = lieu.t60()
    return {"lieu": lieu.nom, "volume_m3": round(lieu.volume),
            "t60": {int(f): round(float(v), 2) for f, v in zip(BANDES, t60)}}


if __name__ == "__main__":
    for nom in LIEUX:
        r = resume(nom)
        print(f"{nom:<11} V={r['volume_m3']:>6} m3  T60 " +
              " ".join(f"{f}:{v}" for f, v in r["t60"].items()))
