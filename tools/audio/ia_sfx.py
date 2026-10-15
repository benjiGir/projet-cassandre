"""
Sons générés par un modèle texte → SFX — PROJET_CASSANDRE.

    # 1. Voir ce que ça coûterait (par défaut RIEN n'est appelé, rien n'est dépensé)
    ./.venv-refs/bin/python3 tools/audio/ia_sfx.py generate --only pistol_fire --variants 6
    # 2. Générer pour de vrai (clé dans ELEVENLABS_API_KEY ou `.env.local`)
    ./.venv-refs/bin/python3 tools/audio/ia_sfx.py generate --only pistol_fire --variants 6 --go
    # 3. Écouter : la synthèse actuelle À CÔTÉ de chaque prise
    ./.venv-refs/bin/python3 tools/audio/ia_sfx.py page          # http://localhost:5173/audition/ia/index.html
    # 4. Garder la meilleure prise (copiée dans assets_src/audio_ia/retenus/, versionnée)
    ./.venv-refs/bin/python3 tools/audio/ia_sfx.py pick pistol_fire=3
    # 5. Mettre les prises retenues dans le sprite, à la place des recettes
    ./.venv-refs/bin/python3 tools/audio/render_sfx.py --out /tmp/wav
    ./.venv-refs/bin/python3 tools/audio/ia_sfx.py finalize --out /tmp/wav
    ./.venv-refs/bin/python3 tools/audio/build_sprite.py /tmp/wav --out public/assets/audio/sfx

Pourquoi : quatre passes de synthèse ont été rejetées à l'écoute, toujours pour
la même raison — « ça ne ressemble pas à ce que c'est ». Un modèle qui a
entendu de vrais pistolets part de la matière, pas d'un bruit qu'on habille.
Ce que ça ne change PAS : c'est l'oreille de l'utilisateur qui tranche. D'où la
page de comparaison, et le fait que `finalize` ne remplace que ce qui a été
choisi, son par son.

Ce qui n'est plus déterministe — et le dit : une prise générée ne se régénère
pas à l'identique (et coûte à chaque fois). La SOURCE d'un son retenu est donc
le WAV brut de `retenus/` + son prompt (`retenus.json`), commités ; les
candidats (`candidats/`) sont jetables et gitignorés. Le jeu, lui, reste
déterministe : il joue un sprite figé (invariant #12 : le RNG du jeu n'est pas
concerné, aucun appel réseau à l'exécution).

Licence : une ligne du registre (`assets_src/LICENCES_ASSETS.md`) doit couvrir
`audio_ia/`, et ne pas porter « à confirmer », sinon `finalize` refuse — même
règle, même test que pour les prises CC0 (`enregistrements.py`). Ce n'est PAS du
CC0 : les droits d'usage commercial dépendent de l'offre du compte.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path

import numpy as np

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))

from ia_prompts import BOUCLES, PROMPTS, SONS_TRAIN  # noqa: E402
from synth import SR, read_wav, write_wav  # noqa: E402

RACINE = ICI.parents[1]
IA = RACINE / "assets_src/audio_ia"
CANDIDATS = IA / "candidats"
RETENUS = IA / "retenus"
REGISTRE = RACINE / "assets_src/LICENCES_ASSETS.md"
PAGE = RACINE / "public/audition/ia"

CREDITS_PAR_SECONDE = 40      # docs ElevenLabs, durée fixée
TEXTE_MAX = 450               # longueur de prompt au-delà de laquelle le service répond 400
VARIANTES_DEFAUT = 6
URL = os.environ.get("ELEVENLABS_BASE_URL", "https://api.elevenlabs.io")


class Indisponible(RuntimeError):
    pass


# --- clé et appel -------------------------------------------------------------

def cle_api() -> str:
    """La clé vient de l'environnement ou de `.env.local` (gitignoré). Jamais affichée."""
    cle = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    env_local = RACINE / ".env.local"
    if not cle and env_local.exists():
        for ligne in env_local.read_text().splitlines():
            nom, _, valeur = ligne.partition("=")
            if nom.strip() == "ELEVENLABS_API_KEY":
                cle = valeur.strip().strip("'\"")
    if not cle:
        raise Indisponible("pas de clé : définir ELEVENLABS_API_KEY, ou la mettre dans .env.local "
                           "(ELEVENLABS_API_KEY=...) — ce fichier est gitignoré")
    return cle


def _appel(cle: str, prompt: str, duree: float, influence: float, fmt: str, boucle: bool = False) -> bytes:
    champs = {"text": prompt, "duration_seconds": duree, "prompt_influence": influence}
    if boucle:      # seul le modèle v2 sait rendre une boucle raccordable
        champs |= {"model_id": "eleven_text_to_sound_v2", "loop": True}
    corps = json.dumps(champs).encode()
    req = urllib.request.Request(f"{URL}/v1/sound-generation?output_format={fmt}", data=corps,
                                 headers={"xi-api-key": cle, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def _erreur(e: urllib.error.HTTPError) -> str:
    try:
        return e.read().decode("utf8", "replace")[:300]
    except OSError:
        return ""


def generer_une(cle: str, prompt: str, duree: float, influence: float,
                boucle: bool = False) -> tuple[np.ndarray, str]:
    """Une prise : (échantillons mono flottants à SR, format réellement obtenu)."""
    formats = ["pcm_44100", "mp3_44100_128"]      # le PCM brut, sinon MP3 décodé
    for i, fmt in enumerate(formats):
        for essai in range(4):
            try:
                brut = _appel(cle, prompt, duree, influence, fmt, boucle)
                return (_pcm(brut, duree) if fmt.startswith("pcm") else _mp3(brut)), fmt
            except urllib.error.HTTPError as e:
                if e.code == 401:
                    raise Indisponible("clé refusée (401)") from e
                if e.code in (402, 403) and "quota" in _erreur(e).lower():
                    raise Indisponible(f"crédits épuisés ({e.code}) : {_erreur(e)}") from e
                if e.code == 429 or e.code >= 500:
                    time.sleep(2 ** essai * 2)
                    continue
                if i + 1 < len(formats):      # format refusé par l'offre du compte : on descend
                    break
                raise Indisponible(f"refusé ({e.code}) : {_erreur(e)}") from e
            except (urllib.error.URLError, TimeoutError) as e:
                time.sleep(2 ** essai * 2)
                if essai == 3:
                    raise Indisponible(f"réseau : {e}") from e
    raise Indisponible("échec après plusieurs essais")


def _pcm(brut: bytes, duree: float) -> np.ndarray:
    """
    PCM brut 16 bits -> mono flottant. Le service ne dit pas combien de canaux
    il envoie, et il envoie du STEREO entrelace (constate le 2026-10-02 : lu
    comme du mono, chaque prise durait le double et sonnait une octave trop
    bas). Le nombre de canaux se deduit de la duree demandee.
    """
    x = np.frombuffer(brut[: len(brut) // 2 * 2], dtype="<i2").astype(np.float64) / 32768.0
    return desentrelacer(x, duree)


def desentrelacer(x: np.ndarray, duree: float) -> np.ndarray:
    """Si x contient deux canaux entrelaces, rend un canal sans filtre en peigne."""
    from enregistrements import _un_canal  # noqa: PLC0415
    canaux = max(1, round(len(x) / (duree * SR)))
    if canaux < 2:
        return x
    n = len(x) // canaux * canaux
    return _un_canal(x[:n].reshape(-1, canaux))


def _mp3(brut: bytes) -> np.ndarray:
    """MP3 → flottants : `afconvert` (macOS), sinon `ffmpeg`."""
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = Path(tmp, "a.mp3"), Path(tmp, "a.wav")
        src.write_bytes(brut)
        if shutil.which("afconvert"):
            cmd = ["afconvert", "-f", "WAVE", "-d", f"LEI16@{SR}", "-c", "1", str(src), str(dst)]
        elif shutil.which("ffmpeg"):
            cmd = ["ffmpeg", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", str(SR), str(dst)]
        else:
            raise Indisponible("ni afconvert ni ffmpeg pour décoder le MP3")
        subprocess.run(cmd, check=True)
        x, _ = read_wav(str(dst))
        return x


def _ecrire_brut(chemin: Path, x: np.ndarray) -> None:
    """WAV brut, SANS traitement : c'est la prise telle que livrée par le service."""
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(chemin), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


# --- sélection des sons ---------------------------------------------------------

def choisir(args) -> list[str]:
    from recipes import RECIPES  # noqa: PLC0415
    noms = [n for n in PROMPTS if n in RECIPES]
    if args.only:
        voulus = args.only.split(",")
        inconnus = [n for n in voulus if n not in PROMPTS]
        if inconnus:
            raise SystemExit(f"sons sans prompt : {', '.join(inconnus)} — voir ia_prompts.py")
        noms = voulus
    if getattr(args, "cat", None) == "train":      # nés d'un prompt : pas de recette, donc pas de catégorie
        noms = list(SONS_TRAIN)
    elif getattr(args, "cat", None):
        noms = [n for n in noms if RECIPES[n][1] == args.cat]
    return noms


def prises(nom: str) -> list[Path]:
    return sorted((CANDIDATS / nom).glob("[0-9][0-9].wav"))


# --- commandes ------------------------------------------------------------------

def cmd_generate(args) -> int:
    noms = choisir(args)
    longs = [f"{n} ({len(PROMPTS[n][0])})" for n in noms if len(PROMPTS[n][0]) > TEXTE_MAX]
    if longs:      # le service refuse la requête entière, autant le dire avant
        raise SystemExit(f"prompt de plus de {TEXTE_MAX} caractères : {', '.join(longs)}")
    plan, total = [], 0.0
    for nom in noms:
        prompt, duree, infl = PROMPTS[nom]
        manque = max(args.variants - len(prises(nom)), 0)
        credits = manque * duree * CREDITS_PAR_SECONDE
        total += credits
        plan.append((nom, duree, len(prises(nom)), manque, credits))
    print(f"{'son':18s} {'durée':>6s} {'déjà':>5s} {'à faire':>8s} {'crédits':>8s}")
    for nom, duree, deja, manque, credits in plan:
        print(f"{nom:18s} {duree:5.1f}s {deja:5d} {manque:8d} {credits:8.0f}")
    print(f"{'TOTAL':18s} {'':>6s} {'':>5s} {sum(p[3] for p in plan):8d} {total:8.0f} crédits")
    if not args.go:
        print("\nSimulation : rien n'a été appelé. Ajouter --go pour générer (dépense des crédits du compte).")
        return 0
    if total == 0:
        print("\nRien à générer.")
        return 0
    cle = cle_api()
    manifeste = _lire_json(CANDIDATS / "manifest.json")
    for nom, duree, _deja, manque, _c in plan:
        prompt, _, infl = PROMPTS[nom]
        for _ in range(manque):
            n = len(prises(nom)) + 1
            x, fmt = generer_une(cle, prompt, duree, infl, nom in BOUCLES)
            _ecrire_brut(CANDIDATS / nom / f"{n:02d}.wav", x)
            manifeste.setdefault(nom, {})[f"{n:02d}"] = {
                "prompt": prompt, "duree": duree, "influence": infl, "format": fmt, "boucle": nom in BOUCLES,
                "date": time.strftime("%Y-%m-%d %H:%M")}
            (CANDIDATS).mkdir(parents=True, exist_ok=True)
            (CANDIDATS / "manifest.json").write_text(json.dumps(manifeste, ensure_ascii=False, indent=1))
            print(f"  {nom} {n:02d}  ({fmt}, {len(x) / SR:.2f} s)")
    return 0


def _lire_json(chemin: Path) -> dict:
    return json.loads(chemin.read_text()) if chemin.exists() else {}


def cmd_page(args) -> int:
    from recipes import RECIPES  # noqa: PLC0415
    noms = [n for n in choisir(args) if prises(n)]
    if not noms:
        print("aucune prise à écouter : lancer `generate --go` d'abord")
        return 1
    if PAGE.exists():
        shutil.rmtree(PAGE)
    PAGE.mkdir(parents=True)
    retenus = _lire_json(RETENUS / "retenus.json")
    manifeste = _lire_json(CANDIDATS / "manifest.json")
    lignes = []
    for nom in noms:
        boutons = []
        # Un son né d'un prompt n'a pas de recette : rien à lui comparer.
        if nom in RECIPES:
            fn = RECIPES[nom][0]
            write_wav(str(PAGE / f"{nom}_actuel.wav"), fn(seed=0), SR)
            boutons.append(f'<button class="son actuel" data-src="{nom}_actuel.wav">synthèse actuelle</button>')
        for p in prises(nom):
            n = p.stem
            shutil.copy(p, PAGE / f"{nom}_{n}.wav")
            choisi = retenus.get(nom, {}).get("candidat") == n
            boucle = ' data-boucle="1"' if nom in BOUCLES else ""
            sien = html.escape(manifeste.get(nom, {}).get(n, {}).get("prompt", ""))     # le prompt de CETTE prise, au survol
            boutons.append(f'<span class="prise"><button class="son" data-src="{nom}_{n}.wav" title="{sien}"{boucle}>'
                           f'{int(n)}</button>'
                           f'<label><input type="radio" name="{nom}" value="{int(n)}"'
                           f'{" checked" if choisi else ""}> garder</label></span>')
        prompt = html.escape(PROMPTS[nom][0])
        titre = f"{nom} — boucle : un clic la lance, un second l'arrête" if nom in BOUCLES else nom
        lignes.append(f'<section><h2>{titre}</h2><p class="prompt">{prompt}</p><div>{"".join(boutons)}</div></section>')
    (PAGE / "index.html").write_text(_HTML.replace("@@SONS@@", "\n".join(lignes)))
    print(f"{len(noms)} son(s) — http://localhost:5173/audition/ia/index.html  (serveur de dev : pnpm dev)")
    return 0


def cmd_pick(args) -> int:
    meta = _lire_json(RETENUS / "retenus.json")
    manifeste = _lire_json(CANDIDATS / "manifest.json")
    for choix in args.choix:
        if choix.endswith("=-"):                 # `nom=-` : retirer le choix
            meta.pop(choix[:-2], None)
            (RETENUS / f"{choix[:-2]}.wav").unlink(missing_ok=True)
            continue
        nom, _, n = choix.partition("=")
        if nom not in PROMPTS or not n.isdigit():
            raise SystemExit(f"attendu nom=numéro (ex. pistol_fire=3), reçu : {choix}")
        src = CANDIDATS / nom / f"{int(n):02d}.wav"
        if not src.exists():
            raise SystemExit(f"pas de prise {int(n)} pour {nom} (il y en a {len(prises(nom))})")
        RETENUS.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, RETENUS / f"{nom}.wav")
        fiche = manifeste.get(nom, {}).get(f"{int(n):02d}", {})
        meta[nom] = {**fiche, "candidat": f"{int(n):02d}"}
        print(f"retenu : {nom} ← prise {int(n)}")
    RETENUS.mkdir(parents=True, exist_ok=True)
    (RETENUS / "retenus.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1, sort_keys=True))
    return 0


def licence_confirmee() -> None:
    """Même règle que `enregistrements.py` : une ligne `à confirmer` ne s'utilise pas."""
    lignes = [ln for ln in REGISTRE.read_text().splitlines() if ln.startswith("|") and "audio_ia/" in ln]
    if not lignes:
        raise Indisponible("aucune ligne du registre des licences ne couvre audio_ia/")
    if any("à confirmer" in ln.lower() for ln in lignes):
        raise Indisponible(
            "la ligne audio_ia/ du registre dit encore « à confirmer » : lire les conditions d'usage commercial "
            "de l'offre du compte, puis remplacer la mention dans assets_src/LICENCES_ASSETS.md")


def couper(x: np.ndarray, sr: int) -> np.ndarray:
    """Retire le silence d'attaque (garde 3 ms) et la queue sous −50 dB, fondue en 20 ms."""
    pic = float(np.max(np.abs(x))) or 1.0
    fortes = np.flatnonzero(np.abs(x) > pic * 0.02)
    queue = np.flatnonzero(np.abs(x) > pic * 0.003)
    debut = max(int(fortes[0]) - int(0.003 * sr), 0)
    fin = min(int(queue[-1]) + int(0.03 * sr), len(x))
    y = x[debut:fin].copy()
    n = min(int(0.020 * sr), len(y))
    y[-n:] *= np.linspace(1.0, 0.0, n)
    return y


def cmd_finalize(args) -> int:
    licence_confirmee()
    retenus = _lire_json(RETENUS / "retenus.json")
    if not retenus:
        print("aucune prise retenue (`pick nom=N` d'abord)")
        return 1
    os.makedirs(args.out, exist_ok=True)
    print(f"{'son':18s} {'durée':>7s} {'crête':>7s} {'écrêté':>7s}")
    for nom in sorted(retenus):
        x, sr = read_wav(str(RETENUS / f"{nom}.wav"))
        ecrete = int((np.abs(x) >= 32767 / 32768.0).sum())
        if sr != SR:
            from scipy.signal import resample_poly  # noqa: PLC0415
            x = resample_poly(x, SR, sr)
        y = couper(x, SR)
        # Au niveau du mixage (`catalogue.NIVEAUX`), comme dans le studio ou la
        # prise a ete choisie : normalisee a crete pleine, un tir deja tres
        # compresse sortait ~6 dB au-dessus de ce qu'on avait ecoute.
        import catalogue  # noqa: PLC0415
        crete_wav = 0.89
        if nom in catalogue.NIVEAUX:
            y = catalogue.au_niveau(y, catalogue.NIVEAUX[nom])
            crete_wav = float(np.max(np.abs(y)))
        info = write_wav(os.path.join(args.out, f"{nom}.wav"), y, SR, peak=crete_wav)
        rms = float(np.sqrt(np.mean(y ** 2))) or 1e-9
        crete = 20 * np.log10(float(np.max(np.abs(y))) / rms)
        print(f"{nom:18s} {info['duration']:6.2f}s {crete:6.1f}dB {ecrete:7d}")
    print(f"\n{len(retenus)} son(s) écrits dans {args.out}, par-dessus les recettes.")
    return 0


_HTML = """<!doctype html><html lang="fr"><meta charset="utf-8"><title>Sons générés — écoute</title>
<style>
body{font:15px system-ui;background:#14161a;color:#e6e6e6;max-width:980px;margin:2rem auto;padding:0 1rem}
section{border-top:1px solid #333;padding:.8rem 0}h2{margin:.2rem 0;font-size:1.05rem}
.prompt{color:#8b93a1;margin:.1rem 0 .5rem;font-size:.85rem}
button{background:#2a3140;color:#e6e6e6;border:1px solid #455;border-radius:6px;padding:.45rem .9rem;cursor:pointer;font-size:1rem}
button:hover{background:#3a4560}button.actuel{border-style:dashed}button.joue{background:#2f6f4f}
.prise{display:inline-block;margin:0 .6rem .4rem 0}label{margin-left:.3rem;font-size:.85rem;color:#aab}
#cmd{position:sticky;bottom:0;background:#1d212a;border-top:2px solid #455;padding:.7rem;margin-top:1rem}
code{display:block;word-break:break-all;margin:.4rem 0}
</style>
<h1>Sons générés — écoute comparée</h1>
<p>Un clic joue la prise. « synthèse actuelle » = ce que le jeu joue aujourd'hui. Coche « garder » sur la meilleure ; la commande en bas se met à jour.</p>
@@SONS@@
<div id="cmd"><strong>Pour enregistrer ces choix :</strong>
<code id="ligne"></code><button id="copier">copier la commande</button></div>
<script>
const ctx = new (window.AudioContext||window.webkitAudioContext)();
const tampons = {};
const boucles = new Map();
async function jouer(b){
  const src=b.dataset.src;
  if(boucles.has(b)){ boucles.get(b).stop(); boucles.delete(b); return; }
  if(!tampons[src]) tampons[src]=await ctx.decodeAudioData(await (await fetch(src)).arrayBuffer());
  if(ctx.state==='suspended') await ctx.resume();
  const s=ctx.createBufferSource(); s.buffer=tampons[src]; s.connect(ctx.destination);
  if(b.dataset.boucle){ s.loop=true; boucles.set(b,s); }
  s.start();
  b.classList.add('joue'); s.onended=()=>b.classList.remove('joue');
}
document.querySelectorAll('button.son').forEach(b=>b.onclick=()=>jouer(b));
function maj(){
  const choix=[...document.querySelectorAll('input[type=radio]:checked')].map(r=>r.name+'='+r.value);
  document.getElementById('ligne').textContent = choix.length
    ? './.venv-refs/bin/python3 tools/audio/ia_sfx.py pick '+choix.join(' ') : '(rien de coché)';
}
document.querySelectorAll('input[type=radio]').forEach(r=>r.onchange=maj); maj();
document.getElementById('copier').onclick=()=>navigator.clipboard.writeText(document.getElementById('ligne').textContent);
</script></html>"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1], formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("generate", help="génère des prises (simulation sans --go)")
    g.add_argument("--only"), g.add_argument("--cat")
    g.add_argument("--variants", type=int, default=VARIANTES_DEFAUT)
    g.add_argument("--go", action="store_true", help="appeler vraiment le service (dépense des crédits)")
    p = sub.add_parser("page", help="page d'écoute comparée")
    p.add_argument("--only"), p.add_argument("--cat")
    k = sub.add_parser("pick", help="retenir une prise : nom=N (nom=- pour retirer)")
    k.add_argument("choix", nargs="+")
    f = sub.add_parser("finalize", help="écrit les prises retenues, nettoyées, dans un dossier de WAV")
    f.add_argument("--out", default="/tmp/wav")
    args = ap.parse_args()
    try:
        return {"generate": cmd_generate, "page": cmd_page, "pick": cmd_pick, "finalize": cmd_finalize}[args.cmd](args)
    except Indisponible as e:
        print(f"ERREUR : {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
