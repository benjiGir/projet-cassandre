"""Interpellation synthétique et sifflet du Contrôleur ; sprite séparé, sons existants conservés."""
from pathlib import Path
import sys

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from synth import SR, write_wav
from voix import vocalise

ROOT = Path(__file__).resolve().parents[2]


def main():
    out = ROOT / 'renders/controleur-billboard/audio'
    out.mkdir(parents=True, exist_ok=True)
    g = np.random.default_rng(10413)
    call = vocalise(g, .42,
        f0=[(0, 125), (.12, 158), (.42, 108)],
        voyelles=[(0, 'è'), (.18, 'e'), (.42, 'e')],
        effort=[(0, .5), (.12, .85), (.42, .5)],
        souffle=[(0, .8), (.05, .2), (.42, .35)],
        niveau=[(0, 0), (.035, .8), (.12, 1), (.32, .7), (.42, 0)], taille=1.15)
    write_wav(str(out / 'controleur_alert.wav'), call, SR, peak=.65)
    time = np.arange(round(.36 * SR)) / SR
    frequency = 1650 + 25 * np.sin(2 * np.pi * 28 * time)
    phase = np.cumsum(frequency) * (2 * np.pi / SR)
    envelope = np.minimum(time / .015, 1) * np.minimum((.36 - time) / .035, 1)
    whistle = (np.sin(phase) + .18 * np.sin(phase * 1.018)) * envelope
    write_wav(str(out / 'controleur_telegraph.wav'), whistle, SR, peak=.55)
    print(out)


if __name__ == '__main__':
    main()
