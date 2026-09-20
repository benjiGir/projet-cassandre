"""Fabrique les sons que les packs CC0 ne contiennent pas.

    ./.venv-refs/bin/python3 tools/audio/synth_sfx.py             # tout
    ./.venv-refs/bin/python3 tools/audio/synth_sfx.py melee_fire
    ./.venv-refs/bin/python3 tools/audio/synth_sfx.py --liste

Pendant du module d'import (`import_sfx.py`) : celui-ci part d'un
enregistrement, celui-là part de rien. Il écrit dans le même dossier, par la
même fonction d'encodage, aux mêmes cadences — un son fabriqué ne doit pas
s'entendre comme un corps étranger au milieu des vrais.

**Tirage déterministe** : chaque son a sa graine, écrite dans la table. Relancer
le script réécrit exactement les mêmes fichiers, sinon « régénérer les sons »
deviendrait une loterie et on ne pourrait plus comparer deux versions.

Pourquoi ce fichier existe (2026-09-20) : les six sons encore synthétiques du
jeu — les quatre vocalisations de Costard et les deux portes mécaniques — ont
été fabriqués par des scripts jetables, jamais versionnés. Ils sont sur disque
sans recette : personne ne peut les refaire, ni même savoir comment ils ont été
obtenus. Ce module est l'endroit où cette dette se rembourse, un son à la fois.

Premier pensionnaire, le pied-de-biche. Un retour d'écoute sans détour :
« le pied de biche sonne comme un coup de couteau ». C'était littéralement
vrai — il sortait de `knifeSlice2.ogg`. Aucun des packs CC0 du projet n'a de
son de BALANCEMENT (ni Kenney ni la bibliothèque d'armes), et une lame qui
fend l'air n'est pas une barre d'acier qui la brasse.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import import_sfx as I  # noqa: E402


@dataclass(frozen=True)
class Souffle:
    """Un objet lourd qui fend l'air devant l'oreille.

    Le son n'est que du bruit : ce qui le rend reconnaissable, c'est que sa
    couleur BOUGE. L'objet arrive, passe, s'éloigne ; le filtre monte, culmine
    au passage, redescend. Un filtre fixe sur du bruit donne un « chhh » de
    vieille radio, pas un mouvement.

    Ce qui distingue la barre d'acier de la lame : elle est plus GRAVE (une
    lame siffle haut parce qu'elle est fine), plus LENTE, et elle brasse assez
    d'air pour qu'on sente une masse — d'où `poids`.
    """

    duree: float
    """Durée totale, secondes."""
    depart: float
    """Centre du filtre à l'entrée, Hz."""
    sommet: float
    """Centre du filtre au passage devant l'oreille, Hz."""
    fin: float
    """Centre du filtre en sortie, Hz."""
    passage: float
    """Où tombe le passage dans la durée, en fraction (0..1)."""
    q: float = 2.0
    """Résonance du filtre. Trop haut, ça siffle comme un jouet."""
    poids: float = 0.0
    """Part de bruit grave ajoutée, pour la masse de l'objet."""
    coupure_poids: float = 220.0
    """Le bruit de `poids` est coupé au-dessus de cette fréquence, Hz."""
    brillance: float = 5000.0
    """Tout le souffle est coupé au-dessus, Hz.

    Un passe-bande laisse passer bien plus de bruit qu'il n'y paraît : le bruit
    blanc a autant d'énergie par hertz, donc les bandes hautes, plus larges,
    pèsent lourd même quand le filtre est calé bas. Sans cette coupe, l'objet
    a beau être grave, il CHUINTE — et le chuintement, c'est la lame.
    """


def passe_bande(x: np.ndarray, hz: int, centre: np.ndarray, q: float) -> np.ndarray:
    """Passe-bande dont le centre change à chaque échantillon.

    Filtre à variable d'état (Chamberlin) : deux intégrateurs, et un coefficient
    recalculé par échantillon. C'est ce qui permet de BALAYER la fréquence, ce
    qu'une convolution — le `passe_bas` d'`import_sfx` — ne sait pas faire :
    elle applique un noyau fixe à tout le signal.

    Boucle Python assumée : quelques dizaines de milliers d'échantillons, le
    temps de la lire est plus long que le temps de l'exécuter.
    """
    f = 2.0 * np.sin(np.pi * np.clip(centre, 20.0, hz * 0.45) / hz)
    amortissement = 1.0 / q
    bas = bande = 0.0
    sortie = np.empty(len(x), dtype=np.float32)
    for i in range(len(x)):
        haut = x[i] - bas - amortissement * bande
        bande += f[i] * haut
        bas += f[i] * bande
        sortie[i] = bande
    return sortie


def souffler(s: Souffle, hz: int, graine: int) -> np.ndarray:
    """Rend un `Souffle` en échantillons."""
    n = int(s.duree * hz)
    t = np.linspace(0.0, 1.0, n, dtype=np.float32)
    rng = np.random.default_rng(graine)

    # Enveloppe : montée lente pendant que l'objet approche, chute plus rapide
    # une fois passé. Symétrique, ça sonne comme un passage de voiture.
    avant = np.clip(t / s.passage, 0.0, 1.0) ** 2.2
    apres = np.exp(-np.clip(t - s.passage, 0.0, None) / (0.32 * (1.0 - s.passage)))
    enveloppe = avant * apres

    # Même forme pour la couleur : le filtre culmine au moment du passage.
    centre = s.depart + (s.sommet - s.depart) * avant
    centre = np.where(t > s.passage, s.fin + (s.sommet - s.fin) * apres, centre)

    bruit = rng.standard_normal(n).astype(np.float32)
    sortie = passe_bande(bruit, hz, centre, s.q) * enveloppe
    sortie = I.passe_bas(sortie, hz, s.brillance)
    if s.poids > 0:
        sortie = sortie + I.passe_bas(bruit, hz, s.coupure_poids) * enveloppe * s.poids

    crete = float(np.max(np.abs(sortie))) or 1.0
    return (sortie / crete * (10 ** (I.CRETE_DB / 20))).astype(np.float32)


# La table. Un son du jeu, sa recette et sa graine.
SONS: dict[str, tuple[Souffle, int]] = {
    # Pied-de-biche. Grave et lent : 240 Hz à l'entrée, 950 Hz au passage — une
    # lame de couteau culminerait vers 4 kHz, c'est toute la différence. Le
    # `poids` est ce qui fait sentir le kilo et demi d'acier ; sans lui on a le
    # sifflement d'une baguette.
    "melee_fire": (Souffle(duree=0.34, depart=240, sommet=950, fin=300,
                           passage=0.58, q=1.7, poids=0.45, brillance=3800), 0x0C12),
}


def main() -> None:
    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument("sfx", nargs="*", help="sons à refabriquer (tous par défaut)")
    parseur.add_argument("--liste", action="store_true", help="affiche la table sans rien écrire")
    args = parseur.parse_args()

    if args.liste:
        for sfx, (s, graine) in SONS.items():
            print(f"  {sfx:<18} {s.duree:>4.2f} s  {s.depart:.0f} -> {s.sommet:.0f} -> {s.fin:.0f} Hz"
                  f"  graine {graine:#x}")
        return

    demandes = args.sfx or list(SONS)
    inconnus = [s for s in demandes if s not in SONS]
    if inconnus:
        sys.exit(f"[synth] inconnu(s) : {', '.join(inconnus)}\n"
                 f"        connus : {', '.join(SONS)}")

    os.makedirs(I.SORTIE, exist_ok=True)
    for sfx in demandes:
        s, graine = SONS[sfx]
        data = souffler(s, I.HZ, graine)
        ogg, m4a = I.ecrire(data, sfx)
        print(f"[synth] {sfx:<18} {len(data) / I.HZ:>4.2f} s  {ogg / 1024:>5.1f} Ko ogg"
              f"  {m4a / 1024:>5.1f} Ko m4a")


if __name__ == "__main__":
    main()
