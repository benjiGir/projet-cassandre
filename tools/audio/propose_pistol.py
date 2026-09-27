"""Prototypes isolés du tir de pistolet, sans modifier le sprite du jeu.

    ./.venv-refs/bin/python3 tools/audio/propose_pistol.py --out renders/audio/pistol-proposal

Les trois prises viennent du registre CC0. Elles servent à choisir une
direction à l'écoute ; une seule pourra ensuite rejoindre recipes.py.
"""

from __future__ import annotations

import argparse
import os

from scipy import signal as sps

from enregistrements import prise
from synth import SR, bandpass, highpass, layer, limiteur, lowpass, reverb, write_wav


SOURCES = {
    "walther": "firearm_library/Prepared SFX Library/Walther PPQ/X_31P.wav",
    "bersa": "firearm_library/Prepared SFX Library/Bersa/F_41P.wav",
    "colt1911": "firearm_library/Prepared SFX Library/1911/A_34P.wav",
}


def render(source: str):
    # On garde le désordre de la vraie détonation et sa mécanique. Le coupe-bas
    # réserve le grave au pompe ; la petite pièce ne colore pas toute la prise.
    shot = prise(SOURCES[source], duree=0.32, passe_haut=170, fondu=0.025)
    shot = highpass(shot, 330)
    notch = sps.butter(3, [250, 650], btype="bandstop", fs=SR, output="sos")
    shot = sps.sosfilt(notch, shot)
    shot = limiteur(shot, plafond=0.55, ms=1.0)
    return reverb(shot, room=0.16, mix=0.04, damp=5000)


def render_weighted():
    """Réponse au retour « claquement en plastique » : du corps réel, pas un clic ajouté."""
    raw = prise(SOURCES["colt1911"], duree=0.38, passe_haut=65, fondu=0.04)
    body = highpass(raw, 240)
    notch = sps.butter(2, [320, 720], btype="bandstop", fs=SR, output="sos")
    body = sps.sosfilt(notch, body)
    weight = lowpass(raw, 190) * 0.45
    chest = bandpass(raw, 850, 1450) * 1.35
    shot = limiteur(layer(body, weight, chest), plafond=0.46, ms=1.2)
    return reverb(shot, room=0.20, mix=0.07, damp=3800)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    for name in SOURCES:
        path = os.path.join(args.out, f"pistol_{name}.wav")
        print(name, write_wav(path, render(name), peak=0.85))
    path = os.path.join(args.out, "pistol_weighted_1911.wav")
    print("weighted_1911", write_wav(path, render_weighted(), peak=0.85))


if __name__ == "__main__":
    main()
