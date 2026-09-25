"""
Prises reelles (enregistrements CC0) utilisables comme COUCHES d'une recette.

    from enregistrements import prise
    faience = prise("kenney_audio/kenney_impact-sounds/Audio/impactPlate_heavy_001.ogg",
                    duree=0.30, passe_haut=90)

Le son se fait a deux mains (docs/systems/hud-audio.md#assets-sonores) : de
vrais enregistrements pour ce qui est un OBJET, la synthese pour ce qui n'existe
pas physiquement. Les deux se rejoignent ICI : une recette de `recipes.py` peut
poser une prise sous, sur ou a cote de couches de synthese, et le resultat suit
la meme chaine que tout le reste (rendu, mesures, sprite, page d'ecoute).

La source reste `recipes.py` : c'est elle qui dit QUELLE prise, QUEL morceau,
QUEL traitement. Les fichiers bruts vivent dans `assets_src/cc0_raw/`, ignore
par git — ils se retelechargent depuis la source du registre. Meme fichier, meme
decodeur : meme octet.

Deux garde-fous, APPLIQUES et pas seulement annonces :

1. **La licence est lue dans le registre** (`assets_src/LICENCES_ASSETS.md`) a
   chaque prise. Un fichier dont aucune ligne ne couvre le dossier, ou dont la
   ligne porte « a confirmer », leve `PriseIndisponible`. La regle du registre
   (« une ligne a confirmer ne s'utilise pas ») etait jusqu'ici une phrase ; ici
   elle est un test.
2. **Un fichier absent leve, il ne se remplace pas.** Se rabattre en silence sur
   de la synthese donnerait deux sprites differents sur deux machines, sans que
   rien ne le dise. `render_sfx.py` rattrape l'exception, rend le reste, et
   sort en erreur avec la liste de ce qui manque.

Pieges de source deja payes sur ce projet (voir l'historique de
`import_sfx.py`, retire le 2026-09-20), et traites ici :

- **Sommer un stereo ESPACE creuse le spectre** (filtre en peigne : -5 a -6 dB
  entre 60 et 600 Hz mesures sur la bibliotheque d'armes). Les canaux ne sont
  sommes que s'ils sont correles ; sinon on garde le plus fort.
- **Reechantillonner sans filtre replie l'aigu.** `resample_poly` filtre.
- **Les prises ecretent parfois** (2 a 5 ms dans chaque prise de la
  bibliotheque d'armes). Le nombre d'echantillons a pleine echelle est compte et
  signale, jamais cache.
"""

from __future__ import annotations

import functools
import os
import re
import subprocess
import sys
import tempfile
import wave
from fractions import Fraction

import numpy as np
from scipy import signal as sps

from synth import SR, highpass, lowpass

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BRUT = os.path.join(RACINE, "assets_src", "cc0_raw")
REGISTRE = os.path.join(RACINE, "assets_src", "LICENCES_ASSETS.md")

# Au-dessus de cette correlation entre canaux, les sommer ne creuse rien.
CORRELATION_SOMMABLE = 0.5


class PriseIndisponible(RuntimeError):
    """Prise absente du disque, ou non couverte par une licence confirmee."""


# ------------------------------------------------------------------ licence

@functools.lru_cache(maxsize=1)
def _lignes_du_registre() -> tuple[tuple[str, str, str], ...]:
    """(dossier cc0_raw, licence, source) pour chaque ligne du registre."""
    if not os.path.exists(REGISTRE):
        raise PriseIndisponible(f"registre des licences introuvable : {REGISTRE}")
    lignes = []
    with open(REGISTRE, encoding="utf-8") as f:
        for ligne in f:
            if not ligne.startswith("|") or ligne.startswith("|---"):
                continue
            cellules = [c.strip() for c in ligne.strip().strip("|").split("|")]
            if len(cellules) < 7:
                continue
            # Colonnes : Pack | Auteur | Source | Licence | Telecharge | Taille |
            # Dossier cc0_raw/ | Utilise pour | Modifications
            dossiers = re.findall(r"`([^`]+)`", cellules[6])
            for d in dossiers:
                lignes.append((d.rstrip("/"), cellules[3], cellules[2]))
    return tuple(lignes)


def _verifier_licence(relatif: str) -> None:
    """Leve si aucune ligne CONFIRMEE du registre ne couvre ce fichier."""
    candidates = [(d, lic, src) for d, lic, src in _lignes_du_registre()
                  if relatif == d or relatif.startswith(d + "/")]
    if not candidates:
        raise PriseIndisponible(
            f"{relatif} : aucune ligne de {os.path.relpath(REGISTRE, RACINE)} ne couvre ce "
            "fichier. Une prise sans licence enregistree ne s'utilise pas.")
    # La ligne la plus precise fait foi (un fichier peut avoir sa propre ligne
    # sous un dossier qui en a une autre).
    dossier, licence, source = max(candidates, key=lambda c: len(c[0]))
    if "confirmer" in licence.lower():
        raise PriseIndisponible(
            f"{relatif} : la ligne « {dossier} » du registre est marquee a confirmer "
            f"({source}). Tant qu'elle l'est, elle ne s'utilise pas.")
    if "cc0" not in licence.lower() and "domaine public" not in licence.lower():
        raise PriseIndisponible(f"{relatif} : licence « {licence} », CC0 uniquement.")


# ----------------------------------------------------------------- decodage

SORTIE = "{sortie}"


def _via_wav(commande: list[str], chemin: str) -> tuple[np.ndarray, int]:
    """Decode par un programme externe vers un WAV temporaire, puis le lit.

    `commande` porte l'emplacement SORTIE, remplace par le fichier temporaire.
    """
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        temporaire = tmp.name
    try:
        subprocess.run([temporaire if c == SORTIE else c for c in commande],
                       check=True, capture_output=True)
        return _lire_wav(temporaire)
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        raise PriseIndisponible(f"{chemin} : decodage impossible ({e})") from e
    finally:
        os.unlink(temporaire)


@functools.lru_cache(maxsize=64)
def _decoder(chemin: str) -> tuple[np.ndarray, int]:
    """
    (echantillons (n, canaux) dans [-1, 1], frequence).

    OGG par `oggdec` (le decodeur de reference, celui des rendus deja livres) ;
    WAV PCM directement ; tout le reste — FLAC, AIFF, MP3, WAV flottant ou
    « extensible », ce que Freesound livre souvent en original — par `ffmpeg`,
    en 24 bits, canaux et frequence d'origine conserves.
    """
    bas = chemin.lower()
    if bas.endswith(".ogg"):
        return _via_wav(["oggdec", "-Q", "-o", SORTIE, chemin], chemin)
    if bas.endswith(".wav"):
        try:
            return _lire_wav(chemin)
        except (wave.Error, EOFError):
            pass   # flottant ou WAVE_FORMAT_EXTENSIBLE : ffmpeg s'en charge
    return _via_wav(["ffmpeg", "-v", "error", "-y", "-i", chemin, "-c:a", "pcm_s24le", SORTIE],
                    chemin)


def _lire_wav(chemin: str) -> tuple[np.ndarray, int]:
    """WAV PCM 16, 24 ou 32 bits -> (echantillons (n, canaux), frequence)."""
    with wave.open(chemin, "rb") as w:
        canaux, octets, hz, n = (w.getnchannels(), w.getsampwidth(),
                                 w.getframerate(), w.getnframes())
        brut = w.readframes(n)
    if octets == 2:
        data = np.frombuffer(brut, dtype="<i2").astype(np.float64) / 32768.0
    elif octets == 3:
        o = np.frombuffer(brut, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        entiers = o[:, 0] | (o[:, 1] << 8) | (o[:, 2] << 16)
        entiers = np.where(entiers & 0x800000, entiers - 0x1000000, entiers)
        data = entiers.astype(np.float64) / 8388608.0
    elif octets == 4:
        data = np.frombuffer(brut, dtype="<i4").astype(np.float64) / 2147483648.0
    else:
        raise PriseIndisponible(f"{chemin} : {octets * 8} bits par echantillon, non gere")
    return data.reshape(-1, canaux), hz


def _un_canal(data: np.ndarray) -> np.ndarray:
    """Un canal sans filtre en peigne : somme si correles, sinon le plus fort."""
    if data.shape[1] == 1:
        return data[:, 0]
    g, d = data[:, 0], data[:, 1]
    if np.std(g) < 1e-9 or np.std(d) < 1e-9:
        return g if np.std(g) >= np.std(d) else d
    if np.corrcoef(g, d)[0, 1] >= CORRELATION_SOMMABLE:
        return data.mean(axis=1)
    return g if np.sum(g ** 2) >= np.sum(d ** 2) else d


@functools.lru_cache(maxsize=64)
def ecretage(relatif: str) -> int:
    """
    Nombre d'echantillons a pleine echelle dans la prise brute.

    `prise()` le SIGNALE, une fois par fichier, sur la sortie d'erreur : une
    prise ecretee reste utilisable (on n'en garde souvent qu'un morceau, sous
    d'autres couches), mais personne ne doit l'apprendre a l'ecoute.
    """
    data, _ = _decoder(os.path.join(BRUT, relatif))
    n = int(np.sum(np.abs(data) >= 32766 / 32768))
    if n:
        print(f"[prise] ATTENTION {relatif} : {n} echantillons a pleine echelle "
              "(prise ecretee a la source)", file=sys.stderr)
    return n


# -------------------------------------------------------------------- prise

def prise(relatif: str, debut: float | None = None, duree: float | None = None,
          semitons: float = 0.0, passe_haut: float | None = None,
          passe_bas: float | None = None, fondu: float = 0.004) -> np.ndarray:
    """
    Un morceau de prise reelle, pret a etre pose comme une couche.

    relatif     chemin sous `assets_src/cc0_raw/`
    debut       seconde de depart dans la prise ; None = juste avant l'attaque
    duree       longueur gardee, en secondes de la PRISE (avant transposition)
    semitons    transposition par changement de vitesse, comme un echantillonneur :
                +12 = une octave plus haut ET deux fois plus court. C'est ce qui
                fait d'un gros eclat un petit sans changer de matiere.
    passe_haut  coupe le grondement d'une prise (bruit de manipulation, table)
    fondu       fondu de sortie, secondes — une prise coupee net claque

    Renvoie un signal mono a `SR`, crete normalisee a 1 : le gain se regle dans
    la recette, comme pour n'importe quelle couche de synthese.
    """
    _verifier_licence(relatif)
    chemin = os.path.join(BRUT, relatif)
    if not os.path.exists(chemin):
        raise PriseIndisponible(
            f"{relatif} absent de assets_src/cc0_raw/ (dossier ignore par git) : "
            "le retelecharger depuis la source indiquee dans le registre des licences.")

    data, hz = _decoder(chemin)
    ecretage(relatif)
    x = _un_canal(data)

    if debut is None:
        crete = float(np.max(np.abs(x))) or 1.0
        attaque = int(np.argmax(np.abs(x) >= 0.02 * crete))
        i0 = max(0, attaque - int(0.004 * hz))
    else:
        i0 = int(debut * hz)
    i1 = len(x) if duree is None else min(len(x), i0 + int(duree * hz))
    x = x[i0:i1]

    # Transposition ET passage a SR en une seule operation filtree : lire la
    # prise comme si elle avait ete enregistree a hz * 2^(st/12).
    rapport = Fraction(SR / (hz * 2 ** (semitons / 12))).limit_denominator(2000)
    if rapport != 1:
        x = sps.resample_poly(x, rapport.numerator, rapport.denominator)

    if passe_haut:
        x = highpass(x, passe_haut)
    if passe_bas:
        x = lowpass(x, passe_bas)
    nf = min(len(x) // 2, int(fondu * SR))
    if nf > 0:
        x[-nf:] *= np.linspace(1, 0, nf)
    crete = float(np.max(np.abs(x)))
    return x / crete if crete > 1e-12 else x
