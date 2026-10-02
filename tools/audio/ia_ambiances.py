"""
Ambiances de zone générées par ElevenLabs — PROJET_CASSANDRE.

    # 1. Coût, sans rien appeler
    ./.venv-refs/bin/python3 tools/audio/ia_ambiances.py generate --zone magasin --prises 2
    # 2. Générer (dépense des crédits ; reprend ce qui manque)
    ./.venv-refs/bin/python3 tools/audio/ia_ambiances.py generate --zone magasin --prises 2 --go
    # 3. Écouter : une minute « comme en jeu » par prise, à côté de la nappe actuelle
    ./.venv-refs/bin/python3 tools/audio/ia_ambiances.py page      # http://localhost:5173/audition/ambiances/index.html
    # 4. Retenir une nappe par zone (avec ses événements) — FLAC versionné dans assets_src/audio_ia/retenus/ambiances/
    ./.venv-refs/bin/python3 tools/audio/ia_ambiances.py pick magasin=2 parking=1
    # 5. Fichiers du jeu + manifeste avec les volumes de zone (public/assets/audio/ambiances/)
    ./.venv-refs/bin/python3 tools/audio/ia_ambiances.py finalize

Les prompts sont dans `ia_prompts.py` (`AMBIANCES`, `EVENEMENTS`). Une zone =
une NAPPE en boucle (paramètre `loop` du modèle) + des ÉVÉNEMENTS ponctuels.
L'aperçu reproduit ce que le jeu fera : la nappe qui tourne, une respiration
lente de son niveau, et un événement tiré au hasard toutes les 6 à 14 s, à
gauche ou à droite. Juger une nappe seule, c'est juger la boucle qu'on veut
justement faire oublier.

Les prises sont gardées en STÉRÉO : une ambiance a de la largeur, contrairement
aux bruitages ponctuels du sprite.
"""

from __future__ import annotations

import argparse
import html
import json
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path

import numpy as np

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))

from analyze_sfx import raccord  # noqa: E402
from ia_prompts import AMBIANCES, EVENEMENTS  # noqa: E402
from ia_sfx import CREDITS_PAR_SECONDE, URL, Indisponible, _erreur, cle_api  # noqa: E402
from synth import SR  # noqa: E402

RACINE = ICI.parents[1]
CANDIDATS = RACINE / "assets_src/audio_ia/candidats/ambiances"
RETENUS = RACINE / "assets_src/audio_ia/retenus/ambiances"
SORTIE = RACINE / "public/assets/audio/ambiances"
PAGE = RACINE / "public/audition/ambiances"
NAPPE_ACTUELLE = RACINE / "public/assets/audio/music/ambience_hum.ogg"

APERCU_SECONDES = 60.0
LFO_HZ = 0.045            # une respiration toutes les ~22 s (skill ambience-and-loops)
LFO_PROFONDEUR = 0.12
EVENEMENT_ECART = (6.0, 14.0)
EVENEMENT_GAIN_DB = (-12.0, -6.0)   # sous la nappe, jamais devant


def _appel(cle: str, prompt: str, duree: float, influence: float, boucle: bool) -> bytes:
    corps = {"text": prompt, "duration_seconds": duree, "prompt_influence": influence,
             "model_id": "eleven_text_to_sound_v2", "loop": boucle}
    req = urllib.request.Request(f"{URL}/v1/sound-generation?output_format=pcm_44100",
                                 data=json.dumps(corps).encode(),
                                 headers={"xi-api-key": cle, "Content-Type": "application/json"})
    for essai in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                time.sleep(2 ** essai * 2)
                continue
            raise Indisponible(f"refusé ({e.code}) : {_erreur(e)}") from e
        except (urllib.error.URLError, TimeoutError) as e:
            if essai == 3:
                raise Indisponible(f"réseau : {e}") from e
            time.sleep(2 ** essai * 2)
    raise Indisponible("échec après plusieurs essais")


def stereo(brut: bytes, duree: float) -> np.ndarray:
    """PCM 16 bits entrelacé -> (n, 2). Le nombre de canaux se déduit de la durée demandée (voir ia_sfx._pcm)."""
    x = np.frombuffer(brut[: len(brut) // 2 * 2], dtype="<i2").astype(np.float64) / 32768.0
    canaux = max(1, round(len(x) / (duree * SR)))
    x = x[: len(x) // canaux * canaux].reshape(-1, canaux)
    return x if canaux == 2 else np.repeat(x[:, :1], 2, axis=1)


def ecrire(chemin: Path, x: np.ndarray) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(chemin), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def lire(chemin: Path) -> np.ndarray:
    with wave.open(str(chemin), "rb") as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768.0
        return x.reshape(-1, w.getnchannels())


def nappes(zone: str) -> list[Path]:
    return sorted((CANDIDATS / zone).glob("nappe_[0-9][0-9].wav"))


def evenement(zone: str, nom: str) -> Path:
    return CANDIDATS / zone / f"evt_{nom}.wav"


def _lire_json(p: Path) -> dict:
    return json.loads(p.read_text()) if p.exists() else {}


def cmd_generate(args) -> int:
    zones = args.zone.split(",")
    inconnues = [z for z in zones if z not in AMBIANCES]
    if inconnues:
        raise SystemExit(f"zone(s) sans prompt : {', '.join(inconnues)} — voir ia_prompts.AMBIANCES")
    plan = []
    for zone in zones:
        prompt, duree, infl = AMBIANCES[zone]
        for _ in range(max(args.prises - len(nappes(zone)), 0)):
            plan.append((zone, "nappe", prompt, duree, infl))
        for nom, (p, d, i) in EVENEMENTS.get(zone, {}).items():
            if not evenement(zone, nom).exists():
                plan.append((zone, nom, p, d, i))
    credits = sum(d * CREDITS_PAR_SECONDE for *_, d, _ in plan)
    for zone, nom, _, duree, _ in plan:
        print(f"  {zone:12s} {nom:10s} {duree:5.1f} s  {duree * CREDITS_PAR_SECONDE:5.0f} crédits")
    print(f"{len(plan)} prise(s) ≈ {credits:.0f} crédits")
    if not args.go:
        print("Simulation : rien n'a été appelé. Ajouter --go pour générer (dépense des crédits du compte).")
        return 0
    cle = cle_api()
    manifeste_p = CANDIDATS / "manifest.json"
    manifeste = _lire_json(manifeste_p)
    for zone, nom, prompt, duree, infl in plan:
        boucle = nom == "nappe"
        x = stereo(_appel(cle, prompt, duree, infl, boucle), duree)
        if boucle:
            chemin = CANDIDATS / zone / f"nappe_{len(nappes(zone)) + 1:02d}.wav"
        else:
            chemin = evenement(zone, nom)
        ecrire(chemin, x)
        manifeste[f"{zone}/{chemin.stem}"] = {"prompt": prompt, "duree": duree, "influence": infl,
                                             "boucle": boucle, "date": time.strftime("%Y-%m-%d %H:%M")}
        manifeste_p.write_text(json.dumps(manifeste, ensure_ascii=False, indent=1, sort_keys=True))
        mesure = f", raccord {raccord(x.mean(axis=1), SR)}" if boucle else ""
        print(f"  {zone}/{chemin.name}  {len(x) / SR:.2f} s{mesure}")
    return 0


def _decoder(chemin: Path) -> np.ndarray:
    """Fichier encodé -> (n, 2) à SR, par ffmpeg."""
    brut = subprocess.run(["ffmpeg", "-v", "error", "-i", str(chemin), "-f", "f32le", "-ac", "2",
                           "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(brut, dtype="<f4").astype(np.float64).reshape(-1, 2)


def _rms_actif(x: np.ndarray) -> float:
    """RMS des seules fenêtres de 50 ms où il se passe quelque chose : un événement bref n'est pas jugé sur son silence."""
    m = x.mean(axis=1)
    n = int(0.05 * SR)
    rms = np.sqrt(np.mean(m[: len(m) // n * n].reshape(-1, n) ** 2, axis=1))
    actif = rms[rms > rms.max() * 10 ** (-20 / 20)]
    return float(np.sqrt(np.mean(actif ** 2))) if len(actif) else 1e-9


def apercu(nappe: np.ndarray, evenements: list[np.ndarray], graine: int) -> np.ndarray:
    """Une minute comme en jeu : nappe en boucle qui respire, événements épars, panoramiques."""
    n = int(APERCU_SECONDES * SR)
    tours = int(np.ceil(n / len(nappe)))
    lit = np.tile(nappe, (tours, 1))[:n]
    t = np.arange(n) / SR
    lit = lit * (1.0 + LFO_PROFONDEUR * np.sin(2 * np.pi * LFO_HZ * t))[:, None]
    rms_nappe = float(np.sqrt(np.mean(lit ** 2))) or 1e-9
    g = np.random.default_rng(graine)
    instant = g.uniform(2.0, 5.0)
    while evenements and instant < APERCU_SECONDES - 3:
        e = evenements[g.integers(len(evenements))]
        gain = rms_nappe / _rms_actif(e) * 10 ** (g.uniform(*EVENEMENT_GAIN_DB) / 20)
        pan = g.uniform(-0.8, 0.8)
        mono = e.mean(axis=1) * gain
        debut = int(instant * SR)
        fin = min(debut + len(mono), n)
        lit[debut:fin, 0] += mono[: fin - debut] * np.sqrt((1 - pan) / 2) * np.sqrt(2)
        lit[debut:fin, 1] += mono[: fin - debut] * np.sqrt((1 + pan) / 2) * np.sqrt(2)
        instant += g.uniform(*EVENEMENT_ECART)
    # Fondus d'entrée/sortie de l'aperçu seulement (le jeu boucle sans fin).
    f = int(1.0 * SR)
    lit[:f] *= np.linspace(0, 1, f)[:, None]
    lit[-f:] *= np.linspace(1, 0, f)[:, None]
    return lit


def _au_niveau(x: np.ndarray, rms_cible: float = 0.08) -> np.ndarray:
    """Même niveau moyen pour toutes les écoutes : on compare des couleurs, pas des volumes."""
    y = x * rms_cible / (float(np.sqrt(np.mean(x ** 2))) or 1e-9)
    crete = float(np.abs(y).max())
    return y * (0.95 / crete) if crete > 0.95 else y


def cmd_page(args) -> int:
    if PAGE.exists():
        shutil.rmtree(PAGE)
    PAGE.mkdir(parents=True)
    blocs = []
    if NAPPE_ACTUELLE.exists():          # l'ancienne nappe, retirée du jeu le 2026-10-02
        ecrire(PAGE / "actuel.wav", _au_niveau(apercu(_decoder(NAPPE_ACTUELLE), [], 0)))
        blocs.append('<section><h2>Actuel</h2><p class="d">La nappe jouée partout aujourd\'hui (ambience_hum, 12 s).</p>'
                 '<button data-src="actuel.wav">▶ une minute</button></section>')
    for zone in AMBIANCES:
        prises = nappes(zone)
        if not prises:
            continue
        evts = [lire(p) for p in sorted((CANDIDATS / zone).glob("evt_*.wav"))]
        boutons = []
        for p in prises:
            n = p.stem.split("_")[1]
            ecrire(PAGE / f"{zone}_{n}_jeu.wav", _au_niveau(apercu(lire(p), evts, int(n))))
            ecrire(PAGE / f"{zone}_{n}_nappe.wav", _au_niveau(apercu(lire(p), [], 0)))
            boutons.append(f'<div class="p"><strong>Prise {int(n)}</strong> '
                           f'<button data-src="{zone}_{n}_jeu.wav">▶ comme en jeu</button> '
                           f'<button data-src="{zone}_{n}_nappe.wav">▶ nappe seule</button></div>')
        for p in sorted((CANDIDATS / zone).glob("evt_*.wav")):
            shutil.copy(p, PAGE / f"{zone}_{p.name}")
        evt_btn = " ".join(f'<button data-src="{zone}_{p.name}">{html.escape(p.stem[4:])}</button>'
                           for p in sorted((CANDIDATS / zone).glob("evt_*.wav")))
        blocs.append(f'<section><h2>{zone}</h2><p class="d">{html.escape(AMBIANCES[zone][0])}</p>'
                     f'{"".join(boutons)}<div class="p"><strong>Événements</strong> {evt_btn}</div></section>')
    (PAGE / "index.html").write_text(_HTML.replace("@@BLOCS@@", "\n".join(blocs)))
    print("http://localhost:5173/audition/ambiances/index.html  (serveur de dev : pnpm dev)")
    return 0


# --- retenir et livrer ----------------------------------------------------------

# Quels espaces du plan de masse (`tools/level_v2/plan_de_masse.py`) sonnent
# comme quelle zone. Un espace absent ne change pas l'ambiance : on garde celle
# d'où l'on vient.
ESPACES: dict[str, tuple[str, ...]] = {
    "parking": ("parking_ext",),
    "magasin": ("galerie", "cafeteria", "caisses", "hub", "rayons", "electro", "toilettes", "secret1",
                "c_pk_ga", "c_ga_cf", "c_ga_cs", "c_hb_ry", "c_hb_el"),
    "reserve": ("reserve", "compacteur", "secret4", "c_hb_rs"),
    "souterrain": ("souterrain", "c_so_bu"),
    "coulisses": ("pc_secu", "vestiaires", "fournil", "gaine", "labo", "chambre_froide", "sav", "secret3",
                  "c_bu", "c_short_ramp", "c_short_w"),
    "bureaux": ("bureaux", "direction", "c_escalier"),
}
ZONE_PAR_DEFAUT = "magasin"

# Niveau des fichiers livrés (RMS de la nappe, dBFS) ; le volume de lecture est
# dans `core/zoneAmbience.ts`. Les bureaux sont voulus presque silencieux.
NAPPE_RMS_DB = -20.0
DECALAGE_DB = {"bureaux": -4.0}
EVENEMENT_SOUS_NAPPE_DB = -8.0
RACCORD_FONDU = 0.25     # fondu croisé tête-queue (s), à puissance constante
MARGE_BOUCLE = 0.5       # signal ajouté avant et après la boucle dans le fichier (s)


def flac(src: np.ndarray, dst: Path) -> None:
    with __import__("tempfile").TemporaryDirectory() as tmp:
        w = Path(tmp, "a.wav")
        ecrire(w, src)
        dst.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(w), "-c:a", "flac", str(dst)], check=True)


def cmd_pick(args) -> int:
    meta = _lire_json(RETENUS / "retenus.json")
    manifeste = _lire_json(CANDIDATS / "manifest.json")
    for choix in args.choix:
        zone, _, n = choix.partition("=")
        src = CANDIDATS / zone / f"nappe_{int(n):02d}.wav"
        if zone not in AMBIANCES or not src.exists():
            raise SystemExit(f"pas de prise {n} pour la zone {zone}")
        dossier = RETENUS / zone
        if dossier.exists():
            shutil.rmtree(dossier)
        flac(lire(src), dossier / "nappe.flac")
        fiches = {"nappe": {**manifeste.get(f"{zone}/{src.stem}", {}), "prise": src.stem}}
        for e in sorted((CANDIDATS / zone).glob("evt_*.wav")):
            flac(lire(e), dossier / f"{e.stem}.flac")
            fiches[e.stem] = manifeste.get(f"{zone}/{e.stem}", {})
        meta[zone] = fiches
        print(f"retenu : {zone} ← nappe {int(n)} + {len(fiches) - 1} événement(s)")
    RETENUS.mkdir(parents=True, exist_ok=True)
    (RETENUS / "retenus.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1, sort_keys=True))
    return 0


def boucler(x: np.ndarray) -> np.ndarray:
    """Fondu croisé tête-queue à puissance constante : le raccord tombe dans du signal, plus sur un bord."""
    n = int(RACCORD_FONDU * SR)
    a = np.linspace(0, np.pi / 2, n)[:, None]
    debut = x[:n] * np.sin(a) + x[-n:] * np.cos(a)
    return np.concatenate([debut, x[n:-n]])


def rogner(x: np.ndarray) -> np.ndarray:
    """Événement : silences de tête et de queue retirés, fondus de 10 ms."""
    m = np.abs(x).max(axis=1)
    actif = np.flatnonzero(m > m.max() * 0.01)
    y = x[max(int(actif[0]) - int(0.01 * SR), 0): min(int(actif[-1]) + int(0.05 * SR), len(x))].copy()
    n = min(int(0.01 * SR), len(y) // 2)
    y[:n] *= np.linspace(0, 1, n)[:, None]
    y[-n:] *= np.linspace(1, 0, n)[:, None]
    return y


def encoder(x: np.ndarray, base: Path, qualite: int = 4) -> None:
    """Stéréo -> .ogg (oggenc) et .m4a (AAC) : Howler ne se rabat jamais d'un format sur l'autre."""
    with __import__("tempfile").TemporaryDirectory() as tmp:
        w = Path(tmp, "a.wav")
        ecrire(w, x)
        subprocess.run(["oggenc", "-Q", "-q", str(qualite), "-s", "1", "-o", str(base.with_suffix(".ogg")), str(w)], check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(w), "-c:a", "aac", "-b:a", "128k",
                        str(base.with_suffix(".m4a"))], check=True)


def rectangles(zone: str) -> list[dict]:
    """Espaces de la zone, en repère du JEU (x, y haut, z = −y Blender), sol à plafond, un mètre de marge en hauteur."""
    sys.path.insert(0, str(RACINE / "tools/level_v2"))
    import plan_de_masse as P  # noqa: PLC0415
    par_id = {s.id: s for s in P.ALL}
    out = []
    for esp in ESPACES[zone]:
        s = par_id[esp]
        sols = (s.rampe[1], s.rampe[2]) if s.rampe else (s.z, s.z)
        out.append({"espace": esp, "x": [s.x[0], s.x[1]], "z": [-s.y[1], -s.y[0]],
                    "y": [min(sols) - 1.0, max(sols) + s.hauteur + 1.0]})
    return out


def cmd_finalize(args) -> int:
    from ia_sfx import licence_confirmee  # noqa: PLC0415
    licence_confirmee()
    retenus = _lire_json(RETENUS / "retenus.json")
    if not retenus:
        print("aucune zone retenue (`pick zone=N` d'abord)")
        return 1
    if SORTIE.exists():
        shutil.rmtree(SORTIE)
    SORTIE.mkdir(parents=True)
    zones = {}
    for zone in sorted(retenus):
        nappe = boucler(_decoder(RETENUS / zone / "nappe.flac"))
        cible = 10 ** ((NAPPE_RMS_DB + DECALAGE_DB.get(zone, 0.0)) / 20)
        nappe *= cible / (float(np.sqrt(np.mean(nappe ** 2))) or 1e-9)
        # Un encodeur avec perte abîme les bords du fichier (amorçage, dernière
        # trame) : mesuré le 2026-10-02, une boucle propre en WAV sortait avec
        # un clic au raccord une fois encodée, en ogg comme en m4a. Le fichier
        # porte donc une marge de part et d'autre, et le jeu boucle sur la
        # région du milieu (sprite Howler `[début, durée, true]`) : le raccord
        # tombe en plein signal, là où l'encodeur n'a rien coupé.
        marge = int(MARGE_BOUCLE * SR)
        nappe = np.clip(nappe, -0.95, 0.95)
        # Vorbis q6 plutôt que q4 : à q4, le raccord du souterrain (bourdon dense)
        # mesurait un clic de rang 100 ; à q6, 62 — comme le WAV.
        encoder(np.concatenate([nappe[-marge:], nappe, nappe[:marge]]), SORTIE / zone, qualite=6)
        evts = []
        for f in sorted((RETENUS / zone).glob("evt_*.flac")):
            e = rogner(_decoder(f))
            e *= cible * 10 ** (EVENEMENT_SOUS_NAPPE_DB / 20) / _rms_actif(e)
            crete = float(np.abs(e).max())
            if crete > 0.95:
                e *= 0.95 / crete
            nom = f"{zone}_{f.stem[4:]}"
            encoder(e, SORTIE / nom)
            evts.append(nom)
        mesures = []
        for ext in ("ogg", "m4a"):
            region = _decoder(SORTIE / f"{zone}.{ext}")[marge: marge + len(nappe)]
            r = raccord(region.mean(axis=1), SR)
            ok = len(region) == len(nappe) and r["clic"] < 99 and r["grave"] < 99 and r["trou"] > 1
            mesures.append(f"{ext} clic {r['clic']:.0f} grave {r['grave']:.0f} trou {r['trou']:.0f}"
                           + ("" if ok else " DÉFAUT"))
        print(f"  {zone:11s} boucle {len(nappe) / SR:5.2f} s — {' · '.join(mesures)} — {len(evts)} événement(s)")
        zones[zone] = {"nappe": zone, "boucle": [round(marge / SR * 1000, 3), round(len(nappe) / SR * 1000, 3)],
                       "evenements": evts, "espaces": rectangles(zone)}
    manifeste = {"defaut": ZONE_PAR_DEFAUT, "zones": zones,
                 "_note": "Généré par tools/audio/ia_ambiances.py finalize — ne pas éditer à la main."}
    (SORTIE / "ambiances.json").write_text(json.dumps(manifeste, ensure_ascii=False, indent=1))
    taille = sum(f.stat().st_size for f in SORTIE.iterdir()) / 1024 / 1024
    print(f"{len(zones)} zone(s) -> {SORTIE.relative_to(RACINE)} ({taille:.2f} Mo)")
    return 0


_HTML = """<!doctype html><html lang="fr"><meta charset="utf-8"><title>Ambiances — écoute</title>
<style>
body{font:15px system-ui;background:#14161a;color:#e6e6e6;max-width:900px;margin:2rem auto;padding:0 1rem}
section{border-top:1px solid #333;padding:.8rem 0}h2{margin:.2rem 0;font-size:1.1rem;text-transform:capitalize}
.d{color:#8b93a1;font-size:.85rem;margin:.2rem 0 .6rem}.p{margin:.4rem 0}
button{background:#2a3140;color:#e6e6e6;border:1px solid #455;border-radius:6px;padding:.4rem .8rem;cursor:pointer;margin:0 .2rem .3rem 0}
button.joue{background:#2f6f4f}
</style>
<h1>Ambiances — écoute</h1>
<p>Toutes les écoutes sont au même niveau moyen : on compare des couleurs, pas des volumes. Un clic joue, un second arrête. Casque conseillé (stéréo).</p>
@@BLOCS@@
<script>
let courant=null, bouton=null;
document.querySelectorAll('button[data-src]').forEach(b=>b.onclick=()=>{
  const memes = bouton===b;
  if(courant){courant.pause(); bouton.classList.remove('joue'); courant=null; bouton=null;}
  if(memes) return;
  courant=new Audio(b.dataset.src); bouton=b; b.classList.add('joue');
  courant.onended=()=>{b.classList.remove('joue'); courant=null; bouton=null;}; courant.play();
});
</script></html>"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1], formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("generate", help="nappes et événements d'une ou plusieurs zones (simulation sans --go)")
    g.add_argument("--zone", required=True, help="zones séparées par des virgules, voir ia_prompts.AMBIANCES")
    g.add_argument("--prises", type=int, default=2, help="nombre de prises de nappe par zone")
    g.add_argument("--go", action="store_true", help="appeler vraiment le service (dépense des crédits)")
    sub.add_parser("page", help="page d'écoute : une minute comme en jeu par prise, à côté de l'actuel")
    k = sub.add_parser("pick", help="retenir une nappe par zone : zone=N")
    k.add_argument("choix", nargs="+")
    sub.add_parser("finalize", help="fichiers du jeu et manifeste dans public/assets/audio/ambiances/")
    args = ap.parse_args()
    try:
        return {"generate": cmd_generate, "page": cmd_page, "pick": cmd_pick, "finalize": cmd_finalize}[args.cmd](args)
    except Indisponible as e:
        print(f"ERREUR : {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
