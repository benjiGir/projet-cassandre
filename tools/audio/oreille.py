"""
L'oreille du studio : un son de synthese ressemble-t-il a ce qu'il pretend etre ?

    python3 tools/audio/oreille.py etalonner            # fiabilite de l'oreille sur le reel
    python3 tools/audio/oreille.py juger w/pistol_fire.wav=pistolet w/shotgun.wav=fusil
    python3 tools/audio/oreille.py voisins w/impact_glass.wav

Quatre passes de synthese ont ete rejetees avec les memes mots : « ca ne
ressemble pas a ce que c'est ». Ce n'etait ni un defaut de niveau, ni de
distinction entre armes — c'etait un defaut de RECONNAISSANCE. Un agent ne
l'entend pas ; il peut en revanche le mesurer contre le reel.

Le principe : un corpus d'enregistrements CC0 deja sur le disque (armes de la
Free Firearm Sound Library, impacts et bruitages Kenney), range par CLASSE de
source (« verre », « metal », « pistolet »...). Chaque son est decrit par une
empreinte de timbre — enveloppe spectrale, evolution par bande, vitesse de
decroissance par octave (ce qui fait entendre la MATIERE), texture tonale ou
bruitee, forme temporelle. Un son de synthese est juge par ses voisins reels :
s'il pretend etre du verre et que ses plus proches voisins sont du bois, il ne
sera pas entendu comme du verre.

Ce que l'oreille vaut se mesure avant de s'en servir : `etalonner` classe
chaque enregistrement par ses voisins, lui exclu. Une classe que l'oreille ne
reconnait pas dans le REEL ne prouve rien sur la synthese.

Limites, a ne pas oublier :
- Le corpus n'est pas le monde. Tous les impacts Kenney sortent d'une meme
  seance, toutes les armes d'un meme stand : une partie de ce qui rapproche
  deux prises est le micro, pas l'objet. Le jugement porte sur le son SEC (la
  source avant la piece, voir `espace.py`), pour ne pas comparer des reverbs.
- Etre dans le nuage d'une classe est necessaire, pas suffisant. Le verdict
  final reste humain, au casque — l'oreille sert a ne plus lui soumettre ce
  qui est mesurablement a cote.
"""

from __future__ import annotations

import argparse
import glob
import hashlib
import json
import os
import re
import sys
from fractions import Fraction

import numpy as np
from scipy import signal as sps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from enregistrements import BRUT, _decoder, _un_canal  # noqa: E402
from synth import SR  # noqa: E402

CACHE = os.path.join(BRUT, ".oreille_cache.json")
FENETRE = 0.8          # secondes analysees apres l'attaque
ARMES = "firearm_library/Prepared SFX Library"
IMPACTS = "kenney_audio/kenney_impact-sounds/Audio"
RPG = "kenney_audio/kenney_rpg-audio/Audio"

# Classe -> motifs (relatifs a assets_src/cc0_raw). Une classe = une SOURCE
# reconnaissable, pas un usage du jeu.
CORPUS: dict[str, list[str]] = {
    "pistolet": [f"{ARMES}/{a}/*.wav" for a in
                 ("Walther PPQ", "1911", "Bersa", "Ruger Mark III", "Smith & Wesson 642")],
    "fusil": [f"{ARMES}/{a}/*.wav" for a in ("Mossberg", "Nova", "Model 12")],
    "metal": [f"{IMPACTS}/impactMetal_*.ogg", f"{IMPACTS}/impactTin_*.ogg",
              f"{IMPACTS}/impactBell_*.ogg", f"{RPG}/metalPot*.ogg"],
    "faience": [f"{IMPACTS}/impactPlate_*.ogg"],
    "verre": [f"{IMPACTS}/impactGlass_*.ogg"],
    "bois": [f"{IMPACTS}/impactWood_*.ogg", f"{IMPACTS}/impactPlank_*.ogg", f"{RPG}/chop.ogg"],
    "mou": [f"{IMPACTS}/impactSoft_*.ogg", f"{IMPACTS}/impactPunch_*.ogg"],
    "pierre": [f"{IMPACTS}/impactMining_*.ogg", f"{IMPACTS}/footstep_concrete_*.ogg"],
    "grincement": [f"{RPG}/creak*.ogg"],
    "porte": [f"{RPG}/doorOpen_*.ogg", f"{RPG}/doorClose_*.ogg"],
    "mecanisme": [f"{RPG}/metalLatch.ogg", f"{RPG}/metalClick.ogg", f"{RPG}/beltHandle*.ogg"],
    "lame": [f"{RPG}/drawKnife*.ogg", f"{RPG}/knifeSlice*.ogg"],
    "tissu": [f"{RPG}/cloth*.ogg"],
    "voix": ["kenney_audio/kenney_voiceover-pack-fighter/Audio/*.ogg",
             "kenney_audio/kenney_voiceover-pack/Male/*.ogg"],
}


# Ce que vaut chaque classe comme etalon. Mesure le 2026-10-01 : les impacts
# Kenney sont des sons de JEU deja traites (grave gonfle, aigu a -40/-70 dB :
# « impactGlass » est un objet en verre qu'on cogne, pas du verre qui casse).
# Leur verdict est un indice, pas une preuve. Les armes viennent d'une
# bibliotheque enregistree au stand, neutre — c'est l'etalon le plus sur.
FIABILITE = {
    "pistolet": "prises neutres au stand (Free Firearm Library) : etalon fiable",
    "fusil": "prises neutres au stand, mais 6 seulement et proches des pistolets : indicatif",
    "voix": "voix d'annonceur Kenney : fiable pour « est-ce une voix », pas pour le registre",
}
# Ou le corpus a ete enregistre, quand ce n'est pas un son sec : une arme se
# juge placee au stand (`espace.LIEUX["stand"]`), comme les prises — sinon on
# compare un son sec a des prises qui portent leur echo de butte a 140 ms.
LIEU_DU_CORPUS = {"pistolet": "stand", "fusil": "stand"}
_KENNEY = "sons Kenney deja traites pour le jeu (grave gonfle, peu d'aigu) : indicatif seulement"


# ------------------------------------------------------------- empreinte

def _mel(n_fft: int, bandes: int, fmin: float = 40.0, fmax: float = 16000.0) -> np.ndarray:
    """Banc de filtres triangulaires en echelle mel (bandes, n_fft//2+1)."""
    def hz2mel(f):
        return 2595 * np.log10(1 + f / 700)

    def mel2hz(m):
        return 700 * (10 ** (m / 2595) - 1)
    bords = mel2hz(np.linspace(hz2mel(fmin), hz2mel(fmax), bandes + 2))
    f = np.fft.rfftfreq(n_fft, 1 / SR)
    banc = np.zeros((bandes, len(f)))
    for i in range(bandes):
        a, b, c = bords[i:i + 3]
        banc[i] = np.clip(np.minimum((f - a) / (b - a), (c - f) / (c - b)), 0, None)
    return banc / (banc.sum(axis=1, keepdims=True) + 1e-12)


N_FFT, SAUT = 2048, 256
BANC = _mel(N_FFT, 40)
OCTAVES = [63, 125, 250, 500, 1000, 2000, 4000, 8000]
_f = np.fft.rfftfreq(N_FFT, 1 / SR)
BANC_OCT = np.array([((_f >= c / np.sqrt(2)) & (_f < c * np.sqrt(2))).astype(float)
                     for c in OCTAVES])


def preparer(x: np.ndarray, sr: int = SR) -> np.ndarray:
    """Mono SR, cale sur l'attaque (5 ms avant), FENETRE secondes, crete a 1."""
    if sr != SR:
        r = Fraction(SR, sr).limit_denominator(1000)
        x = sps.resample_poly(x, r.numerator, r.denominator)
    a = np.abs(x)
    seuil = 0.1 * a.max()
    debut = max(0, int(np.argmax(a > seuil)) - int(0.005 * SR))
    x = x[debut:debut + int(FENETRE * SR)]
    x = np.pad(x, (0, int(FENETRE * SR) - len(x)))
    return x / (np.max(np.abs(x)) + 1e-12)


def empreinte(x: np.ndarray, sr: int = SR) -> dict[str, np.ndarray]:
    """
    Empreinte de timbre, par GROUPES. Chaque groupe pese autant dans la
    distance, quel que soit son nombre de dimensions : sans ca, les 40 bandes
    de l'enveloppe ecraseraient les 8 vitesses de decroissance — qui sont
    pourtant ce qui distingue le metal du bois a enveloppe egale.
    """
    x = preparer(x, sr)
    _, _, Z = sps.stft(x, SR, window="hann", nperseg=N_FFT, noverlap=N_FFT - SAUT,
                       boundary=None, padded=False)
    P = np.abs(Z) ** 2                                  # (freq, trames)
    dt = SAUT / SR
    mel = 10 * np.log10(BANC @ P + 1e-10)
    mel = np.maximum(mel, mel.max() - 80)
    oct_ = 10 * np.log10(BANC_OCT @ P + 1e-10)
    oct_ = np.maximum(oct_, oct_.max() - 80)
    energie = P.sum(axis=0)
    e_db = 10 * np.log10(energie + 1e-12)
    e_db -= e_db.max()
    pic = int(np.argmax(e_db))

    # 1. Enveloppe spectrale moyenne (ponderee par l'energie), forme seule.
    poids = energie / (energie.sum() + 1e-12)
    env = mel @ poids
    env -= env.mean()

    # 2. Evolution : le spectre grossier (10 bandes) dans trois fenetres, en dB
    #    sous la trame la plus forte. Dit QUELLES bandes restent et lesquelles
    #    s'eteignent — l'aigu du verre tient, celui du bois tombe.
    grossier = np.array([mel[i:i + 4].mean(axis=0) for i in range(0, 40, 4)])
    ref = grossier[:, pic].max()
    fenetres = [(0.0, 0.025), (0.025, 0.12), (0.12, 0.5)]
    evo = []
    for a, b in fenetres:
        i, j = pic + int(a / dt), max(pic + int(a / dt) + 1, pic + int(b / dt))
        evo.append(grossier[:, i:j].mean(axis=1) - ref if i < grossier.shape[1]
                   else np.full(10, -80.0))
    evo = np.concatenate(evo)

    # 3. Decroissance par octave, en dB/s (log), sur la pente qui suit le pic de
    #    la bande jusqu'a -40 dB. C'est le facteur de perte de la matiere
    #    (Wildes et Richards, Klatzky et al.) : ce qui fait entendre « metal ».
    dec = []
    for b in oct_:
        k = int(np.argmax(b))
        queue = b[k:] - b[k]
        fin = int(np.argmax(queue < -40)) or len(queue)
        if fin < 3:
            dec.append(np.log10(4000.0))
            continue
        pente = -np.polyfit(np.arange(fin) * dt, queue[:fin], 1)[0]
        dec.append(np.log10(np.clip(pente, 5.0, 4000.0)))
    dec = np.array(dec)

    # 4. Texture : tonal (modes) ou bruite (frottement, souffle), regulier ou
    #    crepitant (fracture).
    actif = e_db > -40
    spec = P[:, actif] + 1e-12
    plat = np.exp(np.mean(np.log(spec), axis=0)) / np.mean(spec, axis=0)
    bande = (_f > 300) & (_f < 10000)
    tonal = np.log10(np.max(P[bande][:, actif], axis=0) / (np.median(P[bande][:, actif], axis=0) + 1e-12) + 1)
    lisse = np.convolve(e_db, np.ones(3) / 3, "same")
    rel = (lisse[1:-1] > lisse[:-2]) & (lisse[1:-1] >= lisse[2:]) & (lisse[1:-1] > -35)
    sauts = np.sum(np.diff(lisse[1:-1][rel]) != 0) if rel.any() else 0
    flux = np.mean(np.maximum(np.diff(mel[:, actif], axis=1), 0)) if actif.sum() > 1 else 0.0
    tex = np.array([np.mean(plat), np.mean(plat[: max(1, len(plat) // 4)]),
                    np.mean(tonal), np.log1p(sauts), flux / 10])

    # 5. Forme temporelle.
    env_a = np.abs(sps.hilbert(x))
    lis = np.convolve(env_a, np.ones(64) / 64, "same")
    m = lis.max()
    attaque = (np.argmax(lis > 0.9 * m) - np.argmax(lis > 0.1 * m)) / SR
    def tombe(db):
        apres = e_db[pic:]
        k = np.argmax(apres < db)
        return (k if k else len(apres)) * dt
    cent = (_f @ P) / (P.sum(axis=0) + 1e-12)
    c10 = cent[min(pic + 2, len(cent) - 1)]
    c100 = cent[min(pic + int(0.1 / dt), len(cent) - 1)]
    temps = np.array([np.log10(attaque + 1e-4), np.log10(tombe(-20) + 1e-3),
                      np.log10(tombe(-40) + 1e-3), np.log10(c10 + 50),
                      np.log10(c100 + 50), np.log10(cent[actif].mean() + 50)])

    return {"enveloppe": env, "evolution": evo, "decroissance": dec,
            "texture": tex, "temps": temps}


GROUPES = ("enveloppe", "evolution", "decroissance", "texture", "temps")

# Poids des groupes, choisis par `etalonner` sur le corpus (precision equilibree
# entre classes, groupe exclu : 43 % a poids egaux, 51 % ici). Gain modeste, et
# c'est une information : sur ce corpus, la FORME TEMPORELLE et l'EVOLUTION par
# bande separent mieux les sources que l'enveloppe moyenne, qui porte surtout
# la couleur du micro de la seance.
POIDS = {"enveloppe": 0.5, "evolution": 1.0, "decroissance": 0.5, "texture": 0.5, "temps": 2.0}
VOISINS_PAR_CLASSE = 3

# Nom lisible de chaque dimension, pour le rapport d'ecarts.
_CENTRES_MEL = [int(round(c)) for c in (np.fft.rfftfreq(N_FFT, 1 / SR) @ BANC.T)]
NOMS = {
    "enveloppe": [f"niveau relatif vers {c} Hz" for c in _CENTRES_MEL],
    "evolution": [f"bande {_CENTRES_MEL[i * 4]}-{_CENTRES_MEL[i * 4 + 3]} Hz, {w}"
                  for w in ("0-25 ms", "25-120 ms", "120-500 ms") for i in range(10)],
    "decroissance": [f"decroissance a {c} Hz (log dB/s)" for c in OCTAVES],
    "texture": ["platitude spectrale (bruit=1)", "platitude a l'attaque",
                "tonalite (pics/mediane)", "nombre de chocs (log)", "flux spectral"],
    "temps": ["attaque (log s)", "duree a -20 dB (log s)", "duree a -40 dB (log s)",
              "centroide a l'attaque (log Hz)", "centroide a 100 ms (log Hz)",
              "centroide moyen (log Hz)"],
}


# ---------------------------------------------------------------- corpus

def _fichiers() -> list[tuple[str, str]]:
    out = []
    for classe, motifs in CORPUS.items():
        for m in motifs:
            for p in sorted(glob.glob(os.path.join(BRUT, m))):
                out.append((classe, os.path.relpath(p, BRUT)))
    return out


def _signature_code() -> str:
    """Le cache tombe si le code de l'empreinte change."""
    with open(__file__, "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:12]


def corpus() -> tuple[list[str], list[str], dict[str, np.ndarray]]:
    """(classes, chemins, groupe -> matrice), empreintes en cache."""
    cache = {}
    if os.path.exists(CACHE):
        with open(CACHE) as f:
            cache = json.load(f)
    if cache.get("_code") != _signature_code():
        cache = {"_code": _signature_code()}
    classes, chemins, lignes = [], [], []
    neuf = False
    for classe, rel in _fichiers():
        if rel not in cache:
            data, sr = _decoder(os.path.join(BRUT, rel))
            emp = empreinte(_un_canal(data), sr)
            cache[rel] = {g: emp[g].tolist() for g in GROUPES}
            neuf = True
        classes.append(classe)
        chemins.append(rel)
        lignes.append(cache[rel])
    if neuf:
        with open(CACHE, "w") as f:
            json.dump(cache, f)
    mats = {g: np.array([ligne[g] for ligne in lignes]) for g in GROUPES}
    return classes, chemins, mats


def _groupe(rel: str) -> str:
    """Meme objet enregistre : meme dossier d'arme, meme nom sans son numero."""
    if rel.startswith(ARMES):
        return os.path.dirname(rel)
    return re.sub(r"_?\d+$", "", os.path.splitext(os.path.basename(rel))[0])


class Oreille:
    def __init__(self) -> None:
        self.classes, self.chemins, mats = corpus()
        self.moy = {g: m.mean(axis=0) for g, m in mats.items()}
        self.ect = {g: m.std(axis=0) + 1e-6 for g, m in mats.items()}
        self.z = {g: (m - self.moy[g]) / self.ect[g] for g, m in mats.items()}
        self.labels = np.array(self.classes)

    def _z(self, emp: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
        return {g: (emp[g] - self.moy[g]) / self.ect[g] for g in GROUPES}

    def distances(self, zq: dict[str, np.ndarray]) -> np.ndarray:
        d = np.zeros(len(self.classes))
        for g in GROUPES:
            d += POIDS[g] * np.mean((self.z[g] - zq[g]) ** 2, axis=1)
        return np.sqrt(d / sum(POIDS.values()))

    def _d_classe(self, d: np.ndarray, classe: str) -> float:
        """Distance a une classe : moyenne de ses membres les plus proches."""
        v = np.sort(d[self.labels == classe])
        v = v[np.isfinite(v)]
        return float(np.mean(v[:VOISINS_PAR_CLASSE])) if len(v) else np.inf

    def classer(self, d: np.ndarray) -> list[tuple[str, float]]:
        return sorted(((c, self._d_classe(d, c)) for c in CORPUS), key=lambda t: t[1])

    def etalonner(self) -> dict:
        """
        Classement de chaque prise reelle par les autres, son GROUPE exclu.

        Le groupe, c'est le meme objet : les cinq variantes Kenney d'un
        `impactMetal_heavy`, les deux prises d'une meme arme. Exclure la seule
        prise laisserait ses soeurs la reconnaitre — on mesurerait la memoire
        de l'oreille, pas sa capacite a reconnaitre une MATIERE.
        """
        bons, rangs, confusions = 0, [], {}
        rayon: dict[str, list[float]] = {c: [] for c in CORPUS}
        groupes = np.array([_groupe(c) for c in self.chemins])
        for i, vraie in enumerate(self.classes):
            zq = {g: self.z[g][i] for g in GROUPES}
            d = self.distances(zq)
            d[groupes == groupes[i]] = np.inf
            ordre = self.classer(d)
            noms = [c for c, _ in ordre]
            rang = noms.index(vraie) + 1
            rangs.append(rang)
            rayon[vraie].append(dict(ordre)[vraie])
            if rang == 1:
                bons += 1
            else:
                confusions.setdefault(vraie, {}).setdefault(noms[0], 0)
                confusions[vraie][noms[0]] += 1
        par_classe = {}
        for c in CORPUS:
            idx = [i for i, v in enumerate(self.classes) if v == c]
            finis = [r for r in rayon[c] if np.isfinite(r)]
            # Classe d'un seul objet (les trois grincements) : pas de rayon
            # mesurable groupe exclu, on prend la dispersion entre ses prises.
            rayon[c] = finis or [self._d_classe(self._dist_index(i, exclu=i), c) for i in idx]
            if idx:
                par_classe[c] = {
                    "n": len(idx),
                    "top1": round(sum(rangs[i] == 1 for i in idx) / len(idx), 2),
                    "top3": round(sum(rangs[i] <= 3 for i in idx) / len(idx), 2),
                    "rayon": round(float(np.percentile(rayon[c], 90)), 3),
                }
        return {"n": len(self.classes), "top1": round(bons / len(self.classes), 3),
                "top3": round(float(np.mean(np.array(rangs) <= 3)), 3),
                "classes": par_classe, "confusions": confusions}

    def _dist_index(self, i: int, exclu: int | None = None) -> np.ndarray:
        d = self.distances({g: self.z[g][i] for g in GROUPES})
        if exclu is not None:
            d[exclu] = np.inf
        return d

    def ecarts(self, emp: dict[str, np.ndarray], classe: str, n: int = 5) -> list[str]:
        """
        Les dimensions ou le son s'ecarte le plus de la classe visee, en clair,
        avec la valeur reelle attendue (moyenne +- ecart-type de la classe).
        C'est ce qui dit QUOI corriger ; la distance seule dit seulement « loin ».
        """
        idx = self.labels == classe
        lignes = []
        for g in GROUPES:
            brut = np.array([self.z[g][i] * self.ect[g] + self.moy[g] for i in np.where(idx)[0]])
            mu, sd = brut.mean(axis=0), brut.std(axis=0) + 0.05 * self.ect[g]
            ecart = (emp[g] - mu) / sd
            for k in range(len(mu)):
                lignes.append((abs(ecart[k]) * np.sqrt(POIDS[g]), g, k, emp[g][k], mu[k], sd[k], ecart[k]))
        lignes.sort(key=lambda t: -t[0])
        return [f"{NOMS[g][k]} : {v:.2f} (reel {m:.2f} +- {s:.2f}, {e:+.1f} sigma)"
                for _, g, k, v, m, s, e in lignes[:n]]

    def juger(self, x: np.ndarray, sr: int, visee: str | None = None) -> dict:
        emp = empreinte(x, sr)
        d = self.distances(self._z(emp))
        ordre = self.classer(d)
        out = {"classement": [(c, round(v, 3)) for c, v in ordre[:4]],
               "voisins": [(self.classes[i], os.path.basename(self.chemins[i]), round(float(d[i]), 3))
                           for i in np.argsort(d)[:5]]}
        if visee:
            noms = [c for c, _ in ordre]
            out["visee"] = visee
            out["rang"] = noms.index(visee) + 1
            out["distance"] = round(dict(ordre)[visee], 3)
            # Rayon de la classe : 90e centile des distances de ses propres
            # membres a la classe. Au-dela, le son est HORS du nuage du reel.
            out["rayon"] = self._rayon(visee)
            out["dans_le_nuage"] = out["distance"] <= out["rayon"]
            out["ecarts"] = self.ecarts(emp, visee)
        return out

    def _rayon(self, classe: str) -> float:
        if not hasattr(self, "_rayons"):
            cal = self.etalonner()
            self._rayons = {c: v["rayon"] for c, v in cal["classes"].items()}
        return self._rayons.get(classe, np.inf)

    def fiabilite(self, classe: str) -> str:
        return FIABILITE.get(classe, _KENNEY)

    def reference(self, classe: str, x: np.ndarray, sr: int) -> str:
        """La prise reelle de `classe` la plus proche : celle a ecouter en A/B."""
        d = self.distances(self._z(empreinte(x, sr)))
        idx = np.where(self.labels == classe)[0]
        return self.chemins[int(idx[np.argmin(d[idx])])]


def lire(chemin: str) -> tuple[np.ndarray, int]:
    data, sr = _decoder(os.path.abspath(chemin))
    return _un_canal(data), sr


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("etalonner")
    j = sub.add_parser("juger")
    j.add_argument("sons", nargs="+", help="fichier.wav=classe")
    v = sub.add_parser("voisins")
    v.add_argument("sons", nargs="+")
    a = ap.parse_args()

    o = Oreille()
    if a.cmd == "etalonner":
        r = o.etalonner()
        print(f"{r['n']} prises reelles, {len(CORPUS)} classes : top-1 {r['top1']:.0%}, top-3 {r['top3']:.0%}")
        for c, v in r["classes"].items():
            conf = r["confusions"].get(c, {})
            conf_s = ", ".join(f"{k}x{n}" for k, n in sorted(conf.items(), key=lambda t: -t[1]))
            print(f"  {c:<11} n={v['n']:<3} top1 {v['top1']:.0%}  top3 {v['top3']:.0%}  "
                  f"rayon {v['rayon']:.2f}  {('-> ' + conf_s) if conf_s else ''}")
        return
    for s in a.sons:
        chemin, _, visee = s.partition("=")
        x, sr = lire(chemin)
        r = o.juger(x, sr, visee or None)
        tete = os.path.basename(chemin)
        if visee:
            etat = "DANS le nuage" if r["dans_le_nuage"] else "hors du nuage"
            print(f"{tete:<28} {visee}: rang {r['rang']}, d={r['distance']:.2f} "
                  f"(rayon {r['rayon']:.2f}) {etat}")
        else:
            print(tete)
        print("    classes : " + "  ".join(f"{c} {v:.2f}" for c, v in r["classement"]))
        for e in r.get("ecarts", []):
            print(f"    ecart   {e}")
        if a.cmd == "voisins":
            for c, nom, dd in r["voisins"]:
                print(f"    {dd:.2f}  {c:<11} {nom}")


if __name__ == "__main__":
    main()
