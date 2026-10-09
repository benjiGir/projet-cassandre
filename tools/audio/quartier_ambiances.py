"""Deux nappes discrètes du pilote N4b, sans bourdon tonal.

see: docs/4-technique/pilote-quartier.md#ambiance
"""
from pathlib import Path
import json

import numpy as np

import metro_ambiances as studio

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/assets/audio/quartier_pilote"
REPORT = ROOT / "docs/assets/pilote-quartier"


def wind(seed, cutoff, gain):
    count = studio.SR * studio.DURATION
    time = np.arange(count) / studio.SR
    freq = np.fft.rfftfreq(count, 1 / studio.SR)
    channels = []
    for side in (0, 1):
        spectrum = np.fft.rfft(np.random.default_rng(seed + side).standard_normal(count))
        spectrum *= (freq / (freq + 45)) ** 3 / np.sqrt(freq + 25) / (1 + (freq / cutoff) ** 4)
        spectrum[0] = 0
        signal = np.fft.irfft(spectrum, n=count) * (1 + .12 * np.sin(2 * np.pi * time / studio.DURATION))
        edge = np.minimum(np.minimum(time / 1.5, (studio.DURATION - time) / 1.5), 1)
        signal *= np.sin(np.pi * np.clip(edge, 0, 1) / 2) ** 2
        channels.append(signal * gain / studio.rms(signal))
    return np.stack(channels, axis=1)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    REPORT.mkdir(parents=True, exist_ok=True)
    studio.OUT, studio.REPORT = OUT, REPORT
    signals = {"rue": wind(2026100701, 850, .028), "service": wind(2026100703, 350, .018)}
    margin = int(studio.MARGIN * studio.SR)
    readings = {}
    for name, signal in signals.items():
        studio.encode(name, np.concatenate([signal[-margin:], signal, signal[:margin]]))
        readings[name] = []
        for ext in ("ogg", "m4a"):
            region = studio.decoded(OUT / f"{name}.{ext}")[margin:margin + len(signal)]
            readings[name].append({"codec": ext, "rms_db": round(20 * np.log10(studio.rms(region)), 2),
                "peak_db": round(20 * np.log10(float(np.abs(region).max())), 2),
                "dc": round(float(region.mean()), 8), "loop_jump": round(float(np.abs(region[0] - region[-1]).max()), 6)})
    zones = {"rue": {"nappe": "rue", "boucle": [500, 20000], "evenements": [],
                     "espaces": [{"x": [-30, 35], "y": [-1, 20], "z": [-73, 0]}]},
             "service": {"nappe": "service", "boucle": [500, 20000], "evenements": [],
                         "espaces": [{"x": [-20, 30], "y": [-8, .5], "z": [-100, -69]}]}}
    (OUT / "ambiances.json").write_text(json.dumps({"defaut": "rue", "zones": zones}, ensure_ascii=False, indent=2) + "\n")
    (REPORT / "audio-mesures.json").write_text(json.dumps(readings, indent=2) + "\n")
    studio.spectrogram(signals, "QUARTIER N4b / vent discret et souffle de service / 44 100 Hz")
    print(json.dumps(readings))


if __name__ == "__main__":
    main()
