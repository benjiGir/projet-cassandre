"""
Catalogue des recettes physiques : ce que le studio sait rendre, et comment.

Une recette est une fonction `(g, **reglages) -> signal SEC`, declaree par
`@recette(...)` avec :

- ses REGLAGES (defaut, min, max, unite, aide) : ce sont eux que la page du
  studio expose en curseurs, et que `reglages.json` surcharge ;
- son LIEU et sa DISTANCE (`espace.py`) : la piece s'applique au rendu, pas
  dans la recette — l'oreille juge le son sec, le jeu recoit le son place ;
- la CLASSE du corpus reel a laquelle il doit ressembler (`oreille.py`).

`reglages.json` est une SOURCE, versionnee comme le code : c'est la que
finissent les reglages faits a l'oreille dans le studio. Le code donne les
defauts ; le fichier dit ce qui a ete decide en ecoutant.

    from catalogue import REGISTRE, rendre
    x = rendre("pistol_fire", seed=2)                 # place dans son lieu
    x = rendre("pistol_fire", seed=2, sec=True)       # source seule
    x = rendre("pistol_fire", reglages={"charge": 1.4})
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass, field
from typing import Callable

import numpy as np

import espace
from synth import rng

ICI = os.path.dirname(os.path.abspath(__file__))
FICHIER_REGLAGES = os.path.join(ICI, "reglages.json")


@dataclass(frozen=True)
class Reglage:
    defaut: float
    mini: float
    maxi: float
    unite: str = ""
    aide: str = ""


@dataclass
class Recette:
    nom: str
    fonction: Callable[..., np.ndarray]
    categorie: str
    variantes: int
    oreille: str | None
    lieu: str | None
    distance: float | None
    piece_db: float
    reglages: dict[str, Reglage] = field(default_factory=dict)
    aide: str = ""
    prereglages: dict[str, dict[str, float]] = field(default_factory=dict)


REGISTRE: dict[str, Recette] = {}

# Intensite visee de chaque son : RMS maximal sur 100 ms, en dBFS, dans le
# WAV rendu. Ce sont les valeurs de l'ANCIEN catalogue, mesurees le
# 2026-10-01 : le mixage du jeu (volumes de `SFX_TABLE`, hierarchie du skill
# `audio-mix-budget` — la telegraphie au-dessus de tout) a ete regle sur elles.
# Changer de synthese ne doit pas changer le mixage en douce : un son
# physique plus « pointu » (crete plus haute pour la meme energie) sortait
# jusqu'a 12 dB sous l'ancien (la telegraphie !), un autre 8 dB au-dessus.
# Exceptions VOULUES (2026-10-01, « pas assez de puissance », reference
# DOOM 2016) : les deux armes du joueur montent (le pistolet etait 10 dB sous
# le pompe), et le tir du Costard, nouveau, reste sous sa telegraphie.
NIVEAUX = {
    "pistol_fire": -12.0, "shotgun": -9.0, "explosion": -7.5, "crowbar_metal": -22.9, "impact_metal": -22.9,
    "impact_concrete": -20.6, "impact_flesh": -20.4, "crowbar_flesh": -12.6, "gib_splat": -11.0,
    "impact_glass": -18.0, "prop_break_wood": -23.6, "ceramic_break": -16.1,
    "crowbar_swing": -15.4, "shotgun_pump": -26.4, "shell_drop": -19.3,
    "door_open": -11.9, "door_shutter": -14.4, "door_slide": -13.5, "cart_roll": -15.9,
    "suit_alert": -11.0, "enemy_hurt": -16.1, "suit_death": -8.9, "suit_telegraph": -7.6,
    "suit_shot": -18.0, "rampant_alert": -12.0, "rampant_telegraph": -13.0, "rampant_attack": -17.0,
    "rampant_death": -11.0, "pickup_ammo": -13.8, "pickup_health": -10.6, "food_eat": -14.0,
    "door_locked": -9.9, "door_unlock": -12.0,
    # Synthese abstraite (`recipes.py`) : niveau de leur recette, pour que
    # leurs prises generees sortent au meme niveau (`ia_sfx finalize`).
    "secret_found": -9.5, "water_gulp": -13.0, "toilet_flush": -17.9,
}
CRETE = 0.89


def intensite(x: np.ndarray) -> float:
    """RMS maximal sur une fenetre glissante de 100 ms, en dBFS."""
    w = min(len(x), int(0.1 * 44100))
    e = np.convolve(x ** 2, np.ones(w) / w, "valid")
    return float(10 * np.log10(np.max(e) + 1e-12))


def au_niveau(x: np.ndarray, cible_db: float) -> np.ndarray:
    """
    Ramene x a l'intensite visee, crete au plus CRETE.

    Trop fort : on baisse tout (la crete descend sous CRETE).
    Trop faible : monter le gain ecreterait ; on rabote d'abord les cretes
    avec le limiteur CENTRE de `synth` (un limiteur causal laisse passer le
    transitoire et ecrase le corps — mesure : il remonte le facteur de crete),
    par pas de 1,5 dB, sans descendre sous ~16 % de la crete d'origine.
    """
    from synth import highpass, limiteur
    # Le passe-haut de securite de `write_wav` d'abord : il retire la
    # composante quasi continue d'un choc (force de contact d'un seul signe),
    # donc change la crete — applique APRES, il faisait remonter tout le son
    # de 7 dB a la renormalisation.
    x = highpass(x, 12, order=2)
    # Et une milliseconde de silence devant : `write_wav` pose un fondu
    # d'entree de 0,5 ms, qui rabotait la crete d'un choc ne au premier
    # echantillon (et son attaque avec) — la renormalisation remontait
    # ensuite tout le son de 6-7 dB (mesure sur les impacts metal).
    x = np.r_[np.zeros(int(0.001 * 44100)), x]
    y = x * (CRETE / (np.max(np.abs(x)) + 1e-12))
    plafond = 1.0
    while intensite(y) < cible_db - 0.3 and plafond > 0.16:
        plafond *= 10 ** (-1.5 / 20)
        z = limiteur(x, plafond=plafond, ms=1.5)
        y = z * (CRETE / (np.max(np.abs(z)) + 1e-12))
    if intensite(y) > cible_db:
        y = y * 10 ** ((cible_db - intensite(y)) / 20)
    return y


def recette(nom: str, categorie: str, variantes: int = 1, oreille: str | None = None,
            lieu: str | None = "magasin", distance: float | None = None,
            piece_db: float = 0.0, prereglages: dict[str, dict[str, float]] | None = None,
            **reglages: tuple):
    """
    Inscrit une recette. Chaque reglage : (defaut, min, max[, unite[, aide]]).

    piece_db : surcroit de piece par rapport a la physique, en dB. La distance
    critique dit combien de reverberation entend le tireur ; un jeu en veut
    souvent plus — c'est un choix de mixage, assume et visible ici, pas un
    reglage cache dans une reverb.
    """
    def deco(fn):
        regl = {k: Reglage(*v) for k, v in reglages.items()}
        if lieu:
            # La piece est un reglage comme un autre : c'est souvent elle qu'on
            # veut doser a l'oreille (« trop de reverb »), son par son.
            regl["piece_db"] = Reglage(piece_db, -30.0, 18.0, "dB",
                                       "piece : echos et reverberation, en plus ou en moins de la physique")
        REGISTRE[nom] = Recette(
            nom=nom, fonction=fn, categorie=categorie, variantes=variantes,
            oreille=oreille, lieu=lieu, distance=distance, piece_db=piece_db,
            reglages=regl,
            aide=(fn.__doc__ or "").strip(), prereglages=prereglages or {})
        return fn
    return deco


def reglages_sauves() -> dict[str, dict[str, float]]:
    if not os.path.exists(FICHIER_REGLAGES):
        return {}
    with open(FICHIER_REGLAGES, encoding="utf-8") as f:
        return json.load(f)


def sauver_reglages(nom: str, valeurs: dict[str, float]) -> None:
    tout = reglages_sauves()
    r = REGISTRE[nom]
    propres = {k: round(float(v), 4) for k, v in valeurs.items()
               if k in r.reglages and abs(float(v) - r.reglages[k].defaut) > 1e-9}
    if propres:
        tout[nom] = propres
    else:
        tout.pop(nom, None)
    with open(FICHIER_REGLAGES, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(tout.items())), f, indent=2, ensure_ascii=False)
        f.write("\n")


def valeurs(nom: str, reglages: dict[str, float] | None = None) -> dict[str, float]:
    r = REGISTRE[nom]
    v = {k: s.defaut for k, s in r.reglages.items()}
    v.update({k: x for k, x in reglages_sauves().get(nom, {}).items() if k in v})
    v.update({k: float(x) for k, x in (reglages or {}).items() if k in v})
    return v


def graine(nom: str, seed: int) -> int:
    """Graine stable par (recette, variante) : deux recettes ne partagent pas leur hasard."""
    return int(hashlib.sha1(f"{nom}:{seed}".encode()).hexdigest()[:8], 16)


def rendre(nom: str, seed: int = 0, reglages: dict[str, float] | None = None,
           sec: bool = False, lieu: str | None = None) -> np.ndarray:
    """
    lieu : remplace celui de la recette (« stand » pour juger une arme contre
    la bibliotheque d'armes, enregistree en plein air).
    """
    r = REGISTRE[nom]
    v = valeurs(nom, reglages)
    piece_db = v.pop("piece_db", r.piece_db)
    x = r.fonction(rng(graine(nom, seed)), **v)
    x = np.asarray(x, dtype=np.float64)
    lieu = lieu or r.lieu
    if sec or not lieu:
        return x
    piece = espace.dans(x, lieu, r.distance, graine=graine(nom, seed) % 10007, sec=1.0)
    # La piece seule, sans le direct : dosee (piece_db) et privee de son grave.
    # Le magasin garde 1,7 s a 63 Hz — physiquement juste, mais le coup grave
    # d'un pompe y trainait plus d'une seconde en grondement boueux. Couper le
    # grave du DEPART de reverberation est la pratique de mixage standard.
    from synth import highpass
    mouille = piece.copy()
    mouille[:len(x)] -= x
    mouille = highpass(mouille, 120, order=2) * 10 ** (piece_db / 20)
    piece = mouille
    piece[:len(x)] += x
    return rogner(piece)


def rogner(x: np.ndarray, seuil_db: float = -60.0, fondu: float = 0.03) -> np.ndarray:
    """
    Coupe la queue de piece la ou elle passe sous `seuil_db` de la crete (elle
    durait jusqu'a 4 s pour un T60 de 3 s : du poids de sprite pour rien), avec
    un fondu, et sans jamais couper le son sec (borne basse : 30 ms).
    """
    from scipy.ndimage import maximum_filter1d
    a = maximum_filter1d(np.abs(x), int(0.02 * 44100))
    vivant = np.nonzero(a > np.max(a) * 10 ** (seuil_db / 20))[0]
    fin = max(int(vivant[-1]) if len(vivant) else len(x), int(0.03 * 44100))
    y = x[:fin].copy()
    k = min(int(fondu * 44100), len(y) // 4)
    y[-k:] *= np.linspace(1, 0, k)
    return y
