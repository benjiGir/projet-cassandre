"""Importe les sons CC0 des packs bruts vers `public/assets/audio/sfx`.

    ./.venv-refs/bin/python3 tools/audio/import_sfx.py            # tout
    ./.venv-refs/bin/python3 tools/audio/import_sfx.py shotgun_fire pistol_fire
    ./.venv-refs/bin/python3 tools/audio/import_sfx.py --liste    # la table, sans rien écrire

Les sons du jeu étaient des PLACEHOLDERS synthétisés (`tools/audio/` n'existait
pas : le code de synthèse vivait dans des scripts jetables). Ils viennent
maintenant de vrais enregistrements CC0, dont la trace est dans
`assets_src/LICENCES_ASSETS.md` ; les archives brutes restent dans
`assets_src/cc0_raw/`, gitignoré. Ce fichier est la RECETTE : il dit quel son
du pack devient quel son du jeu, et comment il est traité — sans lui, le choix
ne serait reproductible qu'à la main.

Chaîne de traitement, dans l'ordre :

1. décodage (WAV directement, OGG via `oggdec`) ;
2. **passage à un canal** — le jeu n'a pas de son positionnel. Pas forcément en
   SOMMANT : voir `un_canal()`, c'est la correction la plus importante de cette
   chaîne ;
3. recherche de l'ATTAQUE (premier échantillon au-dessus du seuil) et coupe
   juste avant : les prises de la bibliothèque d'armes commencent par des
   secondes de silence, et un son de jeu doit claquer au moment où on appuie ;
4. coupe à la durée voulue, avec fondu de sortie — une queue de réverbération
   de dix secondes sur un tir qui se répète trois fois par seconde est
   inutilisable ;
5. normalisation de la crête ;
6. rééchantillonnage à **44 100 Hz**, filtre anti-repliement compris
   (`passe_bas()`) ;
7. encodage `.ogg` (`oggenc`) ET `.m4a` (`afconvert`). Les deux sont
   obligatoires : Howler choisit UN seul fichier d'après le codec supporté par
   le navigateur, sans repli si l'autre manque (voir docs/systems/hud-audio.md).

Cette chaîne a été refaite le 2026-09-20, après un retour d'écoute sans appel
sur les armes (« c'est trop bizarre, je n'aime pas du tout »). Trois causes
mesurées, dont deux étaient des défauts de cette chaîne et une vient de la
bibliothèque elle-même. Le détail est dans
docs/systems/hud-audio.md#pourquoi-cette-chaîne.

- La sortie était à **22 050 Hz** — assumé comme « le grain de l'époque Build ».
  Le rééchantillonnage se faisait par `np.interp` SANS filtre anti-repliement :
  tout ce qui dépassait 11 kHz revenait se plier dans l'aigu au lieu de
  disparaître (+2,8 dB de trop mesurés dans la bande 9–11 kHz d'un coup de
  pompe). On perdait le claquement du coup ET on le remplaçait par du bruit.
  Un son d'arme n'est pas le bon endroit pour économiser 150 Ko.
- La réduction à un canal était une MOYENNE des deux. Voir `un_canal()`.
- Les prises d'armes n'ont **aucun grave** et saturent à la détonation. Ça ne
  se corrige pas, ça se complète. Voir `Grave`.
"""

from __future__ import annotations

import argparse
import math
import os
import subprocess
import sys
import tempfile
import wave
import zlib
from dataclasses import dataclass

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BRUT = os.path.join(ROOT, "assets_src", "cc0_raw")
SORTIE = os.path.join(ROOT, "public", "assets", "audio", "sfx")

# Fréquence de sortie : voir l'étape 6 de la doc de tête.
HZ = 44100
# Crête visée, en dB sous le maximum. Pas 0 : un encodeur avec perte dépasse
# volontiers l'original de quelques dixièmes de dB, et ça sature.
CRETE_DB = -1.5
# Qualité Vorbis. Un coup de feu est une transitoire large bande : c'est
# exactement ce qu'un encodeur avec perte étale quand on le serre trop.
QUALITE_OGG = "6"
# Au-dessus de cette corrélation entre canaux, on peut les sommer sans dégât ;
# en dessous, sommer creuse des trous dans le spectre (voir `un_canal()`).
CORRELATION_SOMMABLE = 0.5


@dataclass(frozen=True)
class Grave:
    """Couche grave synthétique posée SOUS une prise qui n'en a pas.

    Mesuré le 2026-09-20 sur les quatre armes de la bibliothèque : il n'y a
    RIEN sous 200 Hz (0,1 % de l'énergie), et près de 60 % se concentre entre
    600 et 1 500 Hz. Ce n'est pas un défaut d'import, c'est la prise : ces
    enregistrements sont faits dehors, avec le coupe-bas qu'impose le vent, et
    le préampli sature sur la détonation (2 à 5 ms d'échantillons à pleine
    échelle dans CHAQUE fichier de la bibliothèque).

    Un coup de feu sans grave n'est pas un coup de feu : c'est un claquement,
    genre pétard. C'est ça que l'écoute du 2026-09-20 a rejeté, et aucun
    traitement ne le rattrape — ce qui manque n'est pas dans le fichier.

    On le reconstruit donc, comme le fait n'importe quel jeu : la prise garde
    l'aigu, la texture et la mécanique de l'arme, une sinusoïde qui plonge lui
    rend le coup de poing, un bruit filtré lui rend le ventre. Tirage
    déterministe (graine fixe) : relancer l'import redonne le même fichier.
    """

    depart: float
    """Fréquence de la sinusoïde à l'instant de la détonation, Hz."""
    arrivee: float
    """Fréquence en fin de plongeon, Hz."""
    plongeon: float
    """Durée de la descente, secondes."""
    decroissance: float
    """Constante de temps de l'extinction, secondes."""
    niveau: float
    """Amplitude de la sinusoïde, relative à la crête de la prise."""
    corps: float = 0.0
    """Amplitude du bruit grave qui remplit le ventre, même échelle."""
    coupure_corps: float = 300.0
    """Fréquence au-dessus de laquelle ce bruit est retiré, Hz."""


@dataclass(frozen=True)
class Source:
    """Un son du jeu et la prise dont il sort."""

    chemin: str
    """Relatif à `assets_src/cc0_raw/`."""
    duree: float
    """Durée finale maximale, secondes (fondu de sortie compris)."""
    pack: str
    """Clé de pack, pour le rapport et le registre de licences."""
    avance: float = 0.004
    """Silence gardé avant l'attaque, secondes."""
    seuil: float = 0.02
    """Niveau (0..1) à partir duquel on considère que le son a commencé."""
    fondu: float = 0.06
    """Fondu de sortie, secondes."""
    gain: float = 1.0
    """Multiplicateur appliqué APRÈS normalisation — pour asseoir un son trop en avant."""
    canal: int | None = None
    """Canal à garder, si le choix automatique d'`un_canal()` ne convient pas."""
    grave: Grave | None = None
    """Couche grave à reconstruire sous la prise. Voir `Grave`."""


K = "kenney_audio"
F = "firearm_library/Prepared SFX Library"

# La table. Un son du jeu, une prise. Les commentaires disent POURQUOI cette
# prise-là : c'est la seule chose qu'on ne peut pas relire dans le résultat.
SOURCES: dict[str, Source] = {
    # --- Armes -------------------------------------------------------------
    # Winchester Model 12 : un VRAI pompe 12, pris au plus près. C'est l'arme
    # du jeu, pas un substitut. La prise donne le claquement et la mécanique,
    # la couche `Grave` rend le coup de poing que l'enregistrement n'a pas.
    "shotgun_fire": Source(f"{F}/Model 12/K_22P.wav", duree=0.90, pack="firearm_library",
                           grave=Grave(depart=160, arrivee=80, plongeon=0.060,
                                       decroissance=0.075, niveau=0.30, corps=0.20)),
    # Colt 1911 .45 : le pistolet le plus « gros » de la bibliothèque, pour que
    # l'arme de poing ne fasse pas jouet à côté du pompe. Grave plus court et
    # plus haut : un .45 tape sec, il ne roule pas comme un 12.
    "pistol_fire": Source(f"{F}/1911/A_42P.wav", duree=0.55, pack="firearm_library",
                          grave=Grave(depart=180, arrivee=85, plongeon=0.035,
                                      decroissance=0.048, niveau=0.35, corps=0.18)),
    # Pied-de-biche : un sifflement de lame, sans impact — l'impact vient de
    # `impact_*`, joué séparément quand le coup touche.
    "melee_fire": Source(f"{K}/kenney_rpg-audio/Audio/knifeSlice2.ogg", duree=0.35, pack="kenney_rpg_audio"),
    # --- Impacts -----------------------------------------------------------
    "impact_concrete": Source(f"{K}/kenney_impact-sounds/Audio/impactMining_000.ogg", duree=0.35,
                              pack="kenney_impact_sounds"),
    "impact_metal": Source(f"{K}/kenney_impact-sounds/Audio/impactMetal_medium_000.ogg", duree=0.35,
                           pack="kenney_impact_sounds"),
    # « Soft » plutôt que « Punch » : un impact de balle dans un corps est mat,
    # pas un coup de poing de film.
    "impact_flesh": Source(f"{K}/kenney_impact-sounds/Audio/impactSoft_medium_000.ogg", duree=0.30,
                           pack="kenney_impact_sounds"),
    # --- Portes ------------------------------------------------------------
    "door_swing": Source(f"{K}/kenney_rpg-audio/Audio/doorOpen_2.ogg", duree=0.80, pack="kenney_rpg_audio"),
    "door_locked": Source(f"{K}/kenney_interface-sounds/Audio/error_004.ogg", duree=0.45,
                          pack="kenney_interface_sounds"),
    # Lecteur de carte qui accepte : un bip de validation, pas un carillon.
    "door_unlock": Source(f"{K}/kenney_interface-sounds/Audio/confirmation_002.ogg", duree=0.60,
                          pack="kenney_interface_sounds"),
    # --- Ramassages et secrets ---------------------------------------------
    "secret_found": Source(f"{K}/kenney_interface-sounds/Audio/bong_001.ogg", duree=1.20,
                           pack="kenney_interface_sounds"),
    "heal_pickup": Source(f"{K}/kenney_interface-sounds/Audio/pluck_001.ogg", duree=0.45,
                          pack="kenney_interface_sounds"),
    # Cliquetis métallique : une boîte de munitions, pas une trousse.
    "ammo_pickup": Source(f"{K}/kenney_rpg-audio/Audio/handleCoins.ogg", duree=0.60, pack="kenney_rpg_audio"),
    # --- Props et vitres ---------------------------------------------------
    "prop_break_wood": Source(f"{K}/kenney_impact-sounds/Audio/impactWood_heavy_001.ogg", duree=0.70,
                              pack="kenney_impact_sounds"),
    "prop_break_glass": Source(f"{K}/kenney_impact-sounds/Audio/impactGlass_heavy_000.ogg", duree=0.90,
                               pack="kenney_impact_sounds"),
}

# Sons encore SYNTHÉTIQUES, faute d'équivalent CC0 : les trois vocalisations de
# Costard (aucun pack CC0 n'a de grognements) et les deux portes mécaniques du
# niveau v2 (aucun pack n'a de porte automatique ni de rideau métallique).
RESTES_SYNTHETIQUES = ("enemy_alert", "enemy_telegraph", "enemy_hurt", "enemy_death",
                       "door_slide", "door_shutter")


def lire(chemin: str) -> tuple[np.ndarray, int]:
    """(échantillons float32 de forme (n, canaux) dans [-1, 1], fréquence).

    OGG décodé par `oggdec`. La réduction à un canal est faite plus tard, par
    `un_canal()` : elle a besoin de voir les canaux séparés pour décider.
    """
    if chemin.lower().endswith(".ogg"):
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            temporaire = tmp.name
        subprocess.run(["oggdec", "-Q", "-o", temporaire, chemin], check=True)
        try:
            return lire(temporaire)
        finally:
            os.unlink(temporaire)

    with wave.open(chemin, "rb") as w:
        canaux, octets, hz, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        brut = w.readframes(n)

    if octets == 2:
        data = np.frombuffer(brut, dtype="<i2").astype(np.float32) / 32768.0
    elif octets == 3:
        # 24 bits : trois octets par échantillon, que numpy ne sait pas lire
        # directement — on les remonte en 32 bits signés.
        octets_bruts = np.frombuffer(brut, dtype=np.uint8).reshape(-1, 3)
        entiers = (octets_bruts[:, 0].astype(np.int32)
                   | (octets_bruts[:, 1].astype(np.int32) << 8)
                   | (octets_bruts[:, 2].astype(np.int32) << 16))
        entiers = np.where(entiers & 0x800000, entiers - 0x1000000, entiers)
        data = entiers.astype(np.float32) / 8388608.0
    elif octets == 4:
        data = np.frombuffer(brut, dtype="<i4").astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"{chemin} : {octets * 8} bits par échantillon, non géré")

    return data.reshape(-1, canaux), hz


def un_canal(data: np.ndarray, hz: int, s: Source) -> np.ndarray:
    """Réduit à un seul canal sans creuser le spectre.

    Sommer les deux canaux d'un stéréo est la manœuvre évidente, et c'est celle
    que faisait cette chaîne. Elle n'est juste que si les canaux portent le MÊME
    son : une source mono panoramiquée, ou un couple de micros coïncidents.

    La bibliothèque d'armes est enregistrée au couple ESPACÉ, dehors : la même
    onde arrive sur les deux micros à des instants différents (0,9 ms mesuré sur
    le Model 12, soit 30 cm d'écart), et la corrélation entre canaux est
    quasiment nulle (−0,03). Les sommer, c'est faire interférer un son avec sa
    propre copie retardée — un filtre en peigne. Mesuré sur le coup de pompe :
    **−5,4 dB entre 60 et 200 Hz**, là où vit le corps de la détonation, et
    −4,1 dB vers 1 kHz. L'arme perdait son ventre et sonnait creux ; c'est la
    cause principale du « c'est trop bizarre » du 2026-09-20.

    D'où la règle : on somme si les canaux se ressemblent, sinon on en GARDE UN,
    celui qui porte le plus d'énergie juste après l'attaque — le micro le mieux
    placé pour ce coup-là.
    """
    if data.shape[1] == 1:
        return data[:, 0]
    if s.canal is not None:
        return data[:, s.canal]

    gauche, droite = data[:, 0], data[:, 1]
    correlation = float(np.corrcoef(gauche, droite)[0, 1])
    if abs(correlation) >= CORRELATION_SOMMABLE:
        return data.mean(axis=1)

    # Énergie sur les 50 premières millisecondes de chaque canal, depuis SON
    # attaque : les micros ne sont pas à la même distance de l'arme.
    def punch(canal: np.ndarray) -> float:
        fort = np.flatnonzero(np.abs(canal) > s.seuil * (float(np.max(np.abs(canal))) or 1.0))
        debut = int(fort[0]) if fort.size else 0
        return float(np.sum(canal[debut:debut + int(0.05 * hz)] ** 2))

    return data[:, int(np.argmax([punch(data[:, c]) for c in range(data.shape[1])]))]


def passe_bas(data: np.ndarray, hz: int, coupure: float) -> np.ndarray:
    """Filtre les fréquences au-dessus de `coupure` avant de décimer.

    Sans lui, tout ce qui dépasse la moitié de la fréquence de sortie ne
    disparaît pas : il se REPLIE dans la bande audible, à une fréquence fausse.
    Sur un coup de feu — du bruit large bande — ça remplace le claquement par un
    grésillement. Sinus cardinal fenêtré par une Blackman, convolué directement :
    quelques milliers de points, personne n'attend.
    """
    taps = 255
    n = np.arange(taps) - (taps - 1) / 2
    noyau = np.sinc(2 * coupure / hz * n) * np.blackman(taps)
    noyau /= noyau.sum()
    return np.convolve(data, noyau.astype(np.float32), mode="same")


def poser_grave(data: np.ndarray, hz: int, g: Grave, graine: int) -> np.ndarray:
    """Ajoute la couche grave de `g` sous la prise, calée sur la détonation.

    Calée sur la CRÊTE et non sur le début du fichier : le seuil d'attaque se
    déclenche sur le tout premier frémissement, la détonation arrive un peu
    après, et un grave décalé de quelques millisecondes s'entend comme un
    deuxième évènement au lieu du même coup.
    """
    impact = int(np.argmax(np.abs(data[:int(0.05 * hz)])))
    n = min(len(data) - impact, int((g.plongeon + 6 * g.decroissance) * hz))
    if n <= 0:
        return data

    t = np.arange(n, dtype=np.float32) / hz
    # Descente exponentielle de la hauteur : une chute linéaire s'entend comme
    # un « pioupiou » de jeu vidéo, une chute exponentielle comme une masse.
    k = np.clip(t / g.plongeon, 0.0, 1.0)
    f = g.arrivee + (g.depart - g.arrivee) * np.exp(-3.0 * k)
    couche = np.sin(2 * np.pi * np.cumsum(f) / hz).astype(np.float32) * g.niveau

    if g.corps > 0:
        bruit = np.random.default_rng(graine).standard_normal(n).astype(np.float32)
        couche = couche + passe_bas(bruit, hz, g.coupure_corps) * g.corps

    couche *= np.exp(-t / g.decroissance).astype(np.float32)
    # Fondu d'entrée d'une milliseconde : un grave qui démarre sur un flanc
    # vertical ajoute son propre clic, juste là où la prise sature déjà.
    bord = int(0.001 * hz)
    couche[:bord] *= np.linspace(0.0, 1.0, bord, dtype=np.float32)

    sortie = data.copy()
    sortie[impact:impact + n] += couche * (float(np.max(np.abs(data))) or 1.0)
    return sortie


def traiter(data: np.ndarray, hz: int, s: Source) -> np.ndarray:
    """Un canal, attaque, coupe, grave, fondu, normalisation, rééchantillonnage."""
    data = un_canal(data, hz, s)

    crete = float(np.max(np.abs(data))) or 1.0
    fort = np.flatnonzero(np.abs(data) > s.seuil * crete)
    debut = max(0, int(fort[0] - s.avance * hz)) if fort.size else 0
    data = data[debut:debut + int(s.duree * hz)]

    if s.grave is not None:
        data = poser_grave(data, hz, s.grave, zlib.crc32(s.chemin.encode()))

    n_fondu = min(len(data), int(s.fondu * hz))
    if n_fondu > 1:
        data = data.copy()
        data[-n_fondu:] *= np.linspace(1.0, 0.0, n_fondu, dtype=np.float32)

    crete = float(np.max(np.abs(data))) or 1.0
    data = data / crete * (10 ** (CRETE_DB / 20)) * s.gain

    if hz > HZ:
        data = passe_bas(data, hz, 0.45 * HZ)
    if hz != HZ:
        n = int(round(len(data) * HZ / hz))
        data = np.interp(np.linspace(0, len(data) - 1, n), np.arange(len(data)), data).astype(np.float32)
    return np.clip(data, -1.0, 1.0)


def ecrire(data: np.ndarray, sfx: str) -> tuple[int, int]:
    """WAV 16 bits temporaire -> `.ogg` + `.m4a` dans `public/assets/audio/sfx`."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        temporaire = tmp.name
    with wave.open(temporaire, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(HZ)
        w.writeframes((data * 32767).astype("<i2").tobytes())

    ogg = os.path.join(SORTIE, f"{sfx}.ogg")
    m4a = os.path.join(SORTIE, f"{sfx}.m4a")
    try:
        subprocess.run(["oggenc", "-Q", "-q", QUALITE_OGG, "-o", ogg, temporaire], check=True)
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-q", "127", temporaire, m4a], check=True)
    finally:
        os.unlink(temporaire)
    return os.path.getsize(ogg), os.path.getsize(m4a)


def main() -> None:
    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument("sfx", nargs="*", help="sons à réimporter (tous par défaut)")
    parseur.add_argument("--liste", action="store_true", help="affiche la table sans rien écrire")
    args = parseur.parse_args()

    if args.liste:
        for sfx, s in SOURCES.items():
            print(f"  {sfx:<18} {s.duree:>4.2f} s  {s.chemin}")
        print(f"  encore synthétiques : {', '.join(RESTES_SYNTHETIQUES)}")
        return

    demandes = args.sfx or list(SOURCES)
    inconnus = [s for s in demandes if s not in SOURCES]
    if inconnus:
        sys.exit(f"[sfx] inconnu(s) : {', '.join(inconnus)}")

    os.makedirs(SORTIE, exist_ok=True)
    total = 0
    for sfx in demandes:
        s = SOURCES[sfx]
        chemin = os.path.join(BRUT, s.chemin)
        if not os.path.exists(chemin):
            sys.exit(f"[sfx] source absente : {chemin}\n"
                     f"      les packs bruts sont gitignorés, voir assets_src/LICENCES_ASSETS.md")
        data, hz = lire(chemin)
        data = traiter(data, hz, s)
        ogg, m4a = ecrire(data, sfx)
        total += ogg + m4a
        print(f"[sfx] {sfx:<18} {len(data) / HZ:>4.2f} s  {ogg / 1024:>5.1f} Ko ogg  {m4a / 1024:>5.1f} Ko m4a"
              f"  <- {os.path.basename(s.chemin)}")
    print(f"[sfx] {len(demandes)} sons, {total / 1024:.0f} Ko au total ({HZ} Hz mono)")
    print(f"[sfx] encore synthétiques : {', '.join(RESTES_SYNTHETIQUES)}")


if __name__ == "__main__":
    main()
