"""Nappes originales du pilote N4. N'écrase pas les ambiances du magasin.

see: docs/4-technique/pilote-metro.md#ambiances-par-niveau
"""
from pathlib import Path
import json
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/assets/audio/metro_pilote"
REPORT = ROOT / "docs/assets/pilote-metro"
SR, DURATION, MARGIN = 44100, 20, .5
ENCODERS = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True, check=True).stdout
VORBIS = ["-c:a", "libvorbis", "-q:a", "6"] if "libvorbis" in ENCODERS else ["-c:a", "vorbis", "-strict", "-2", "-b:a", "128k"]


def rms(x):
    return float(np.sqrt(np.mean(x ** 2)))


def bed(seed, cutoff, hum, gain):
    count = SR * DURATION
    time = np.arange(count) / SR
    freq = np.fft.rfftfreq(count, 1 / SR)
    channels = []
    for side in (0, 1):
        rng = np.random.default_rng(seed + side)
        spectrum = np.fft.rfft(rng.standard_normal(count))
        spectrum *= (freq / (freq + 35)) ** 3 / np.sqrt(freq + 15) / (1 + (freq / cutoff) ** 4)
        spectrum[0] = 0
        noise = np.fft.irfft(spectrum, n=count)
        noise /= rms(noise)
        breathing = 1 + .1 * np.sin(2 * np.pi * time / DURATION)
        tone = np.sin(2 * np.pi * hum * time + .5) * .35
        tone += np.sin(2 * np.pi * hum * 2 * time + .7) * .12
        signal = noise * breathing + tone
        channels.append(signal * gain / rms(signal))
    return np.stack(channels, axis=1)


def event(seed, kind):
    duration = 2.5 if kind == "rail" else 1.8
    time = np.arange(int(duration * SR)) / SR
    rng = np.random.default_rng(seed)
    envelope = np.exp(-time * (4 if kind == "rail" else 9)) * np.minimum(time / .003, 1)
    if kind == "rail":
        dry = (np.sin(2 * np.pi * 530 * time) + .35 * np.sin(2 * np.pi * 917 * time)) * envelope
    else:
        phase = 2 * np.pi * (220 * time + 70 * (1 - np.exp(-time * 15)))
        dry = np.sin(phase) * envelope + rng.normal(0, .08, len(time)) * envelope
    signal = dry.copy()
    for delay, gain in ((.12, .32), (.28, .16), (.46, .07)):
        offset = int(delay * SR)
        signal[offset:] += dry[:-offset] * gain
    signal *= np.minimum((duration - time) / .01, 1)
    signal -= signal.mean()
    signal *= .06 / max(rms(signal[:int(.5 * SR)]), 1e-9)
    return np.stack([signal, np.roll(signal, int(.003 * SR))], axis=1)


def warning():
    time = np.arange(int(.45 * SR)) / SR
    signal = np.zeros(len(time))
    for start, frequency in ((0, 600), (.2, 450)):
        age = time - start
        envelope = np.sin(np.pi * np.clip(age / .16, 0, 1)) ** 2
        signal += .45 * np.sin(2 * np.pi * frequency * age) * envelope
    return np.stack([signal, signal], axis=1)


def encode(name, signal):
    scratch = ROOT / "renders/metro_n4/audio"
    scratch.mkdir(parents=True, exist_ok=True)
    path = scratch / f"{name}.wav"
    with wave.open(str(path), "wb") as file:
        file.setnchannels(2)
        file.setsampwidth(2)
        file.setframerate(SR)
        file.writeframes((np.clip(signal, -.9, .9) * 32767).astype("<i2").tobytes())
    for ext, codec in (("ogg", VORBIS),
                       ("m4a", ["-c:a", "aac", "-b:a", "128k"])):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(path), *codec, str(OUT / f"{name}.{ext}")], check=True)


def decoded(path):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "pipe:1"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(pcm, dtype="<f4").reshape(-1, 2)


def spectrogram(signals, title="METRO N4 / nappes et evenements originaux / 44 100 Hz"):
    image = Image.new("RGB", (960, len(signals) * 210 + 45), "#101b22")
    draw = ImageDraw.Draw(image)
    draw.text((20, 12), title, fill="#d8d0b8")
    for i, (name, signal) in enumerate(signals.items()):
        mono = signal.mean(axis=1)
        size, hop = 2048, 512
        windows = np.lib.stride_tricks.sliding_window_view(mono, size)[::hop]
        spec = np.abs(np.fft.rfft(windows * np.hanning(size), axis=1)).T
        freq = np.fft.rfftfreq(size, 1 / SR)
        bins = np.searchsorted(freq, np.geomspace(35, 12000, 155)).clip(0, len(freq) - 1)
        intensity = np.clip((20 * np.log10(spec[bins] + 1e-8) + 45) / 65, 0, 1)[::-1]
        rgb = np.stack([intensity * 230, intensity ** 1.3 * 170, (1 - intensity) * 40 + intensity * 75], axis=2).astype("uint8")
        panel = Image.fromarray(rgb).resize((890, 155))
        y = 45 + i * 210
        draw.text((20, y), name + f" / {len(signal)/SR:.1f} s", fill="#d8d0b8")
        image.paste(panel, (50, y + 22))
        draw.text((5, y + 25), "12k", fill="#aebec2")
        draw.text((5, y + 152), "35", fill="#aebec2")
    image.save(REPORT / "audio-spectres.png")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    REPORT.mkdir(parents=True, exist_ok=True)
    signals = {"quai": bed(2026100601, 2100, 50, .1),
               "tunnel": bed(2026100602, 850, 40, .09),
               "rail": event(2026100603, "rail"), "goutte": event(2026100604, "goutte"),
               "alerte": warning()}
    margin = int(MARGIN * SR)
    results = {}
    for name, signal in signals.items():
        encoded = np.concatenate([signal[-margin:], signal, signal[:margin]]) if name in ("quai", "tunnel") else signal
        encode(name, encoded)
        readings = []
        for ext in ("ogg", "m4a"):
            region = decoded(OUT / f"{name}.{ext}")
            if name in ("quai", "tunnel"):
                region = region[margin:margin + len(signal)]
            item = {"codec": ext, "samples": len(region), "rms_db": round(20 * np.log10(rms(region)), 2),
                    "peak_db": round(20 * np.log10(float(np.abs(region).max())), 2), "dc": round(float(region.mean()), 7)}
            if name in ("quai", "tunnel"):
                derivatives = np.abs(np.diff(region, axis=0))
                jump = np.abs(region[0] - region[-1])
                item["loop_jump"] = round(float(jump.max()), 6)
                item["jump_percentile"] = round(float(np.mean(derivatives < jump) * 100), 2)
            readings.append(item)
        results[name] = readings
    zones = {
        "quai": {"nappe": "quai", "boucle": [500, 20000], "evenements": [],
                 "espaces": [{"x": [-1, 19], "y": [-1, 8], "z": [-24, 1]}]},
        "tunnel": {"nappe": "tunnel", "boucle": [500, 20000], "evenements": ["goutte"],
                   "espaces": [{"x": [0, 19], "y": [-1, 8], "z": [-88, -24]}]},
    }
    (OUT / "ambiances.json").write_text(json.dumps({"defaut": "quai", "zones": zones,
        "_note": "Généré par tools/audio/metro_ambiances.py ; indépendant des ambiances du magasin."}, ensure_ascii=False, indent=2) + "\n")
    (REPORT / "audio-mesures.json").write_text(json.dumps(results, indent=2) + "\n")
    spectrogram(signals)
    print(json.dumps({"out": str(OUT), "bytes": sum(p.stat().st_size for p in OUT.iterdir()), "measures": results}))


if __name__ == "__main__":
    main()
