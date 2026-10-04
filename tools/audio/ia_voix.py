"""
Répliques parlées générées par ElevenLabs (texte → voix) — PROJET_CASSANDRE.

    # 1. Coût, sans rien appeler (par défaut : héros, statuts T et E, variante A)
    ./.venv-refs/bin/python3 tools/audio/ia_voix.py generate
    # 2. Générer pour de vrai (dépense des crédits, reprend là où il s'est arrêté)
    ./.venv-refs/bin/python3 tools/audio/ia_voix.py generate --go
    # 3. Écouter et cocher                http://localhost:5173/audition/voix/index.html
    ./.venv-refs/bin/python3 tools/audio/ia_voix.py page
    # 4. Garder des prises (copiées dans assets_src/audio_ia/retenus/voix/, versionnées)
    ./.venv-refs/bin/python3 tools/audio/ia_voix.py pick heros_depart_a heros_hub_a
    # (Distribuer un rôle : mêmes phrases par plusieurs voix, brutes et en haut-parleur)
    ./.venv-refs/bin/python3 tools/audio/ia_voix.py casting --role annonce --voix sarah,alice,lily --go
    #                                     http://localhost:5173/audition/casting/index.html
    # 5. Planche audio du jeu (public/assets/audio/voix/voix.{ogg,m4a,json})
    ./.venv-refs/bin/python3 tools/audio/ia_voix.py finalize --out /tmp/voix
    ./.venv-refs/bin/python3 tools/audio/build_sprite.py /tmp/voix --out public/assets/audio/voix --nom voix

Le texte vient de `docs/6-reference/repliques-niveau-v2.md`, lu tel quel :
une ligne de tableau = une situation, trois variantes A/B/C. Le catalogue reste
la seule source ; ce script n'en recopie rien.

Compte en offre gratuite (constaté le 2026-10-02) : ni voix de la bibliothèque
française ni création de voix par l'API, seulement les voix génériques. Le
héros est « Callum » (choisi à l'écoute par l'utilisateur), qui parle français
via `eleven_v3`. Une prise se facture un crédit par caractère, et le quota
mensuel est petit : d'où la simulation par défaut et l'ordre de priorité
(statuts T puis E, puis R, puis P), pour que ce qui est jouable sorte d'abord.

Les prises sont gardées en MP3 tel que livré (pas de réencodage avant le sprite).
Le jeu n'appelle jamais le service (invariants #11-12) ; la licence suit la
ligne `audio_ia/` du registre, comme les bruitages (`ia_sfx.py`).
"""

from __future__ import annotations

import argparse
import html
import json
import shutil
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import numpy as np

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))

import espace  # noqa: E402
from ia_sfx import URL, Indisponible, _erreur, _mp3, cle_api, licence_confirmee  # noqa: E402
from synth import SR, bandpass, saturate, write_wav  # noqa: E402

RACINE = ICI.parents[1]
CATALOGUE = RACINE / "docs/6-reference/repliques-niveau-v2.md"
CANDIDATS = RACINE / "assets_src/audio_ia/candidats/voix"
RETENUS = RACINE / "assets_src/audio_ia/retenus/voix"
PAGE = RACINE / "public/audition/voix"
CASTING = RACINE / "assets_src/audio_ia/candidats/voix_casting"
PAGE_CASTING = RACINE / "public/audition/casting"

MODELE = "eleven_v3"
FORMAT = "mp3_44100_128"
# Rôle -> (voice_id, nom). Un rôle absent n'est pas encore distribué.
VOIX = {"heros": ("N2lVS1w4EtoT3dr4eOWO", "Callum"), "annonce": ("XrExE9yKIg1WjnnlVkGX", "Matilda")}
# Voix génériques du compte (`GET /v1/voices`, relevé du 2026-10-04) : les seules
# que l'offre gratuite laisse appeler. Nom court -> (voice_id, portrait du service).
GENERIQUES = {
    "sarah": ("EXAVITQu4vr4xnSDxMaL", "mûre, rassurante"),
    "laura": ("FGY2WhTYpPnrIDTdsKH5", "enthousiaste, décalée"),
    "alice": ("Xb7hH8MSUJpSbSDYk0k2", "claire, pédagogue"),
    "matilda": ("XrExE9yKIg1WjnnlVkGX", "professionnelle, enjouée"),
    "jessica": ("cgSgspJ2msm6clMCkdW9", "joueuse, lumineuse"),
    "bella": ("hpp4J3VqNfWAUOO0d1Us", "professionnelle, chaleureuse"),
    "lily": ("pFZP5JQG7iQjIQuC4Bku", "veloutée, comédienne"),
    "river": ("SAz9YHcvj6GT2YYXdXww", "neutre, posée"),
    "roger": ("CwhRBWXzGAHq8TQ4Fs17", "décontracté, grave"),
    "george": ("JBFqnCBsd6RMkjVDRZzb", "chaleureux, conteur"),
    "eric": ("cjVigY5qzO86Huf0OWal", "lisse, digne de confiance"),
    "brian": ("nPczCjzI2devNBz1zQrb", "grave, réconfortant"),
    "daniel": ("onwK4e9ZLuTAKqWW03F9", "présentateur posé"),
    "adam": ("pNInz6obpgDQGcFmaJgB", "dominant, ferme"),
    "bill": ("pqHfZKP75CvOlQylNhV4", "âgé, sage"),
}
# Phrases d'essai d'un casting : de vraies répliques du jeu (`levelEvents.ts`),
# une neutre et une qui porte la chute, pour juger le sourire ET la menace.
ESSAIS = {
    "annonce": {
        "caisses": "Un client non identifié est attendu en caisse centrale.",
        "renfort": "Renfort demandé en réserve. Le personnel non essentiel est prié de mordre.",
    },
}
PRIORITE = "TERP"
ROLES_SECONDAIRES = {"### Costard": "costard", "### Directeur": "directeur", "### Annonces": "annonce"}


@dataclass(frozen=True)
class Replique:
    role: str
    ident: str
    statut: str
    section: str
    situation: str
    texte: str
    variante: str

    @property
    def nom(self) -> str:
        return f"{self.role}_{self.ident}_{self.variante}"


def lire_catalogue() -> list[Replique]:
    """Une Replique par cellule A/B/C des tableaux du catalogue."""
    out, section, role = [], "", "heros"
    for ligne in CATALOGUE.read_text().splitlines():
        if ligne.startswith("## "):
            section, role = ligne[3:].strip(), "heros"
        for prefixe, r in ROLES_SECONDAIRES.items():
            if ligne.startswith(prefixe):
                role = r
        cellules = [c.strip() for c in ligne.strip().strip("|").split("|")]
        if not ligne.startswith("|") or len(cellules) != 6 or cellules[1] not in PRIORITE:
            continue
        ident, statut, situation, *textes = cellules
        for variante, texte in zip("abc", textes):
            if texte == "—":               # une annonce déjà en jeu n'a qu'une version
                continue
            out.append(Replique(role, ident, statut, section, situation, texte, variante))
    return out


def choisir(args) -> list[Replique]:
    roles = set(args.role.split(","))
    statuts = set(args.statut.upper())
    variantes = set(args.variante.lower())
    garder = [r for r in lire_catalogue()
              if r.role in roles and r.statut in statuts and r.variante in variantes]
    if args.only:
        voulus = set(args.only.split(","))
        garder = [r for r in garder if r.ident in voulus]
    return sorted(garder, key=lambda r: PRIORITE.index(r.statut))


def chemin(r: Replique) -> Path:
    return CANDIDATS / r.role / f"{r.nom}.mp3"


def generer_une(cle: str, voice_id: str, texte: str) -> bytes:
    corps = json.dumps({"text": texte, "model_id": MODELE, "language_code": "fr"}).encode()
    req = urllib.request.Request(f"{URL}/v1/text-to-speech/{voice_id}?output_format={FORMAT}", data=corps,
                                 headers={"xi-api-key": cle, "Content-Type": "application/json"})
    for essai in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            detail = _erreur(e)
            if e.code == 429 and "quota" not in detail.lower() or e.code >= 500:
                time.sleep(2 ** essai * 2)
                continue
            raise Indisponible(f"refusé ({e.code}) : {detail}") from e
        except (urllib.error.URLError, TimeoutError) as e:
            if essai == 3:
                raise Indisponible(f"réseau : {e}") from e
            time.sleep(2 ** essai * 2)
    raise Indisponible("échec après plusieurs essais")


def _lire_json(p: Path) -> dict:
    return json.loads(p.read_text()) if p.exists() else {}


def cmd_generate(args) -> int:
    repliques = choisir(args)
    sans_voix = sorted({r.role for r in repliques if r.role not in VOIX})
    if sans_voix:
        raise SystemExit(f"rôle(s) sans voix attribuée : {', '.join(sans_voix)} — voir VOIX")
    a_faire = [r for r in repliques if not chemin(r).exists()]
    credits = sum(len(r.texte) for r in a_faire)
    par_statut = {s: sum(len(r.texte) for r in a_faire if r.statut == s) for s in PRIORITE}
    print(f"{len(repliques)} réplique(s) choisie(s), {len(repliques) - len(a_faire)} déjà faite(s), "
          f"{len(a_faire)} à faire ≈ {credits} crédits "
          f"({', '.join(f'{s}:{c}' for s, c in par_statut.items() if c)})")
    if not args.go:
        print("Simulation : rien n'a été appelé. Ajouter --go pour générer (dépense des crédits du compte).")
        return 0
    cle = cle_api()
    manifeste_p = CANDIDATS / "manifest.json"
    manifeste = _lire_json(manifeste_p)
    for i, r in enumerate(a_faire, 1):
        voice_id, voix = VOIX[r.role]
        try:
            mp3 = generer_une(cle, voice_id, r.texte)
        except Indisponible as e:
            print(f"\nARRÊT à {r.nom} ({i - 1}/{len(a_faire)} faites) : {e}", file=sys.stderr)
            print("Relancer la même commande reprend là où ça s'est arrêté.", file=sys.stderr)
            return 2
        chemin(r).parent.mkdir(parents=True, exist_ok=True)
        chemin(r).write_bytes(mp3)
        manifeste[r.nom] = {"texte": r.texte, "voix": voix, "voice_id": voice_id, "modele": MODELE,
                            "date": time.strftime("%Y-%m-%d %H:%M")}
        manifeste_p.write_text(json.dumps(manifeste, ensure_ascii=False, indent=1, sort_keys=True))
        print(f"  [{i}/{len(a_faire)}] {r.nom}  « {r.texte} »")
    return 0


def cmd_page(args) -> int:
    repliques = [r for r in choisir(args) if chemin(r).exists()]
    if not repliques:
        print("aucune prise à écouter : lancer `generate --go` d'abord")
        return 1
    if PAGE.exists():
        shutil.rmtree(PAGE)
    PAGE.mkdir(parents=True)
    retenus = _lire_json(RETENUS / "retenus.json")
    ordre = {r: i for i, r in enumerate(lire_catalogue())}
    blocs, section = [], None
    for r in sorted(repliques, key=ordre.__getitem__):
        if r.section != section:
            section = r.section
            blocs.append(f"<h2>{html.escape(section)}</h2>")
        shutil.copy(chemin(r), PAGE / chemin(r).name)
        coche = " checked" if r.nom in retenus else ""
        blocs.append(
            f'<div class="l"><button data-src="{chemin(r).name}">▶</button>'
            f'<span class="t">« {html.escape(r.texte)} »</span>'
            f'<span class="s">{r.ident} · {r.statut} · {html.escape(r.situation)}</span>'
            f'<label><input type="checkbox" value="{r.nom}"{coche}> garder</label></div>')
    (PAGE / "index.html").write_text(_HTML.replace("@@LIGNES@@", "\n".join(blocs)))
    print(f"{len(repliques)} prise(s) — http://localhost:5173/audition/voix/index.html  (serveur de dev : pnpm dev)")
    return 0


def cmd_pick(args) -> int:
    meta = _lire_json(RETENUS / "retenus.json")
    manifeste = _lire_json(CANDIDATS / "manifest.json")
    RETENUS.mkdir(parents=True, exist_ok=True)
    for nom in args.noms:
        if nom.endswith("=-"):                  # `nom=-` : retirer le choix
            meta.pop(nom[:-2], None)
            (RETENUS / f"{nom[:-2]}.mp3").unlink(missing_ok=True)
            continue
        src = CANDIDATS / nom.split("_", 1)[0] / f"{nom}.mp3"
        if not src.exists():
            raise SystemExit(f"pas de prise {nom}")
        shutil.copy(src, RETENUS / f"{nom}.mp3")
        meta[nom] = manifeste.get(nom, {})
        print(f"retenu : {nom}")
    (RETENUS / "retenus.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1, sort_keys=True))
    return 0


def haut_parleur(x: np.ndarray) -> np.ndarray:
    """Une prise sèche entendue par la sonorisation du magasin : pavillon étroit, ampli poussé, salle."""
    y = bandpass(x, 420, 3600)
    y = saturate(y / (float(np.abs(y).max()) or 1.0), 2.2)
    return espace.dans(y, "magasin", distance=14.0, sec=0.55)


def cmd_casting(args) -> int:
    if args.role not in ESSAIS:
        raise SystemExit(f"pas de phrases d'essai pour « {args.role} » — voir ESSAIS")
    voix = args.voix.split(",")
    inconnues = [v for v in voix if v not in GENERIQUES]
    if inconnues:
        raise SystemExit(f"voix inconnue(s) : {', '.join(inconnues)} — voir GENERIQUES")
    essais = ESSAIS[args.role]
    prises = [(v, ident, CASTING / f"{args.role}_casting_{v}_{ident}.mp3") for v in voix for ident in essais]
    a_faire = [p for p in prises if not p[2].exists()]
    credits = sum(len(essais[ident]) for _, ident, _ in a_faire)
    print(f"{len(prises)} prise(s), {len(prises) - len(a_faire)} déjà faite(s), {len(a_faire)} à faire ≈ {credits} crédits")
    if a_faire and not args.go:
        print("Simulation : rien n'a été appelé. Ajouter --go pour générer (dépense des crédits du compte).")
        return 0
    if a_faire:
        cle = cle_api()
        CASTING.mkdir(parents=True, exist_ok=True)
        for i, (v, ident, dest) in enumerate(a_faire, 1):
            dest.write_bytes(generer_une(cle, GENERIQUES[v][0], essais[ident]))
            print(f"  [{i}/{len(a_faire)}] {dest.name}")
    if PAGE_CASTING.exists():
        shutil.rmtree(PAGE_CASTING)
    PAGE_CASTING.mkdir(parents=True)
    blocs = []
    for v in voix:
        blocs.append(f"<h2>{v.capitalize()} <small>{html.escape(GENERIQUES[v][1])}</small></h2>")
        for ident, texte in essais.items():
            src = CASTING / f"{args.role}_casting_{v}_{ident}.mp3"
            shutil.copy(src, PAGE_CASTING / src.name)
            sono = PAGE_CASTING / f"{src.stem}_sono.wav"
            write_wav(str(sono), haut_parleur(couper_voix(_mp3(src.read_bytes()))), SR, peak=0.7)
            blocs.append(
                f'<div class="l"><button data-src="{src.name}">▶ brute</button>'
                f'<button data-src="{sono.name}">▶ haut-parleur</button>'
                f'<span class="t">« {html.escape(texte)} »</span></div>')
    (PAGE_CASTING / "index.html").write_text(
        _HTML_CASTING.replace("@@ROLE@@", args.role).replace("@@LIGNES@@", "\n".join(blocs)))
    print("http://localhost:5173/audition/casting/index.html  (serveur de dev : pnpm dev)")
    return 0


# Niveau commun des répliques : même RMS de parole pour toutes, pour qu'aucune
# ne sorte plus fort qu'une autre. `build_sprite.py` règle ensuite la crête de
# l'atlas entier sans toucher aux écarts entre prises.
RMS_PAROLE = 0.1
CRETE_MAX = 0.95
# Une annonce sort 3 dB sous le héros : en bande étroite et saturée, elle
# paraît plus forte que lui à RMS égal, et il doit pouvoir parler par-dessus.
RMS_ANNONCE = 0.07


def couper_voix(x: np.ndarray) -> np.ndarray:
    """Silence de tête et de queue retiré (30 ms gardés avant, 80 ms après), fondues de 10 ms."""
    enveloppe = np.abs(x)
    pic = float(enveloppe.max()) or 1.0
    actifs = np.flatnonzero(enveloppe > pic * 0.02)
    debut = max(int(actifs[0]) - int(0.030 * SR), 0)
    fin = min(int(actifs[-1]) + int(0.080 * SR), len(x))
    y = x[debut:fin].copy()
    n = min(int(0.010 * SR), len(y) // 2)
    y[:n] *= np.linspace(0.0, 1.0, n)
    y[-n:] *= np.linspace(1.0, 0.0, n)
    return y


def rms_parole(x: np.ndarray) -> float:
    """RMS des seules fenêtres de 20 ms où l'on parle (à -35 dB du pic ou plus) : les pauses ne comptent pas."""
    n = int(0.020 * SR)
    fenetres = x[: len(x) // n * n].reshape(-1, n)
    rms = np.sqrt(np.mean(fenetres ** 2, axis=1))
    parle = rms[rms > rms.max() * 10 ** (-35 / 20)]
    return float(np.sqrt(np.mean(parle ** 2))) if len(parle) else float(rms.max())


def sonoriser(x: np.ndarray) -> np.ndarray:
    """Une annonce telle que le jeu la joue : dans la sono, queue de salle coupée à -46 dB et fondue."""
    y = haut_parleur(x)
    actifs = np.flatnonzero(np.abs(y) > float(np.abs(y).max()) * 0.005)
    y = y[: int(actifs[-1]) + 1]
    n = min(int(0.150 * SR), len(y))
    y[-n:] *= np.linspace(1.0, 0.0, n)
    return y * RMS_ANNONCE / (rms_parole(y) or 1.0)


def cmd_finalize(args) -> int:
    licence_confirmee()
    retenus = _lire_json(RETENUS / "retenus.json")
    if not retenus:
        print("aucune prise retenue (`pick` d'abord)")
        return 1
    Path(args.out).mkdir(parents=True, exist_ok=True)
    for nom in sorted(retenus):
        y = couper_voix(_mp3((RETENUS / f"{nom}.mp3").read_bytes()))
        y *= RMS_PAROLE / (rms_parole(y) or 1.0)
        if nom.startswith("annonce_"):
            y = sonoriser(y)
        crete = float(np.abs(y).max())
        if crete > CRETE_MAX:          # un cri court : la crête passe avant le niveau moyen
            y *= CRETE_MAX / crete
        write_wav(str(Path(args.out) / f"{nom}.wav"), y, SR, peak=float(np.abs(y).max()))
    print(f"{len(retenus)} réplique(s) écrites dans {args.out}")
    return 0


_HTML = """<!doctype html><html lang="fr"><meta charset="utf-8"><title>Répliques — écoute</title>
<style>
body{font:15px system-ui;background:#14161a;color:#e6e6e6;max-width:980px;margin:2rem auto 8rem;padding:0 1rem}
h2{font-size:1rem;color:#9fb3d9;border-top:1px solid #333;padding-top:.8rem}
.l{display:flex;gap:.7rem;align-items:baseline;padding:.25rem 0}
button{background:#2a3140;color:#e6e6e6;border:1px solid #455;border-radius:6px;padding:.3rem .7rem;cursor:pointer}
button.joue{background:#2f6f4f}.t{flex:1}.s{color:#7d8594;font-size:.8rem;flex:1}label{font-size:.85rem;color:#aab}
#cmd{position:fixed;left:0;right:0;bottom:0;background:#1d212a;border-top:2px solid #455;padding:.7rem 1rem}
code{display:block;word-break:break-all;margin:.4rem 0;max-height:4.5em;overflow:auto}
</style>
<h1>Répliques du héros — écoute</h1>
<p>Un clic joue la prise ; coche « garder » sur celles qui vont dans le jeu. La commande en bas se met à jour.</p>
@@LIGNES@@
<div id="cmd"><strong>Pour enregistrer ces choix :</strong><code id="ligne"></code>
<button id="copier">copier la commande</button></div>
<script>
let courant=null;
document.querySelectorAll('.l button').forEach(b=>b.onclick=()=>{
  if(courant){courant.pause();document.querySelectorAll('.joue').forEach(x=>x.classList.remove('joue'));}
  courant=new Audio(b.dataset.src); b.classList.add('joue'); courant.onended=()=>b.classList.remove('joue'); courant.play();
});
function maj(){
  const c=[...document.querySelectorAll('input:checked')].map(i=>i.value);
  document.getElementById('ligne').textContent=c.length?'./.venv-refs/bin/python3 tools/audio/ia_voix.py pick '+c.join(' '):'(rien de coché)';
}
document.querySelectorAll('input').forEach(i=>i.onchange=maj); maj();
document.getElementById('copier').onclick=()=>navigator.clipboard.writeText(document.getElementById('ligne').textContent);
</script></html>"""


_HTML_CASTING = """<!doctype html><html lang="fr"><meta charset="utf-8"><title>Casting — @@ROLE@@</title>
<style>
body{font:15px system-ui;background:#14161a;color:#e6e6e6;max-width:980px;margin:2rem auto;padding:0 1rem}
h2{font-size:1rem;color:#9fb3d9;border-top:1px solid #333;padding-top:.8rem}small{color:#7d8594;font-weight:400}
.l{display:flex;gap:.7rem;align-items:baseline;padding:.25rem 0}
button{background:#2a3140;color:#e6e6e6;border:1px solid #455;border-radius:6px;padding:.3rem .7rem;cursor:pointer;white-space:nowrap}
button.joue{background:#2f6f4f}.t{flex:1}
</style>
<h1>Casting — @@ROLE@@</h1>
<p>Les mêmes phrases par chaque voix. « Haut-parleur » = la prise passée par la sonorisation du magasin,
telle qu'on l'entendrait en jeu.</p>
@@LIGNES@@
<script>
let courant=null;
document.querySelectorAll('button').forEach(b=>b.onclick=()=>{
  if(courant){courant.pause();document.querySelectorAll('.joue').forEach(x=>x.classList.remove('joue'));}
  courant=new Audio(b.dataset.src); b.classList.add('joue'); courant.onended=()=>b.classList.remove('joue'); courant.play();
});
</script></html>"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1], formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for nom, aide in (("generate", "génère les prises (simulation sans --go)"), ("page", "page d'écoute")):
        p = sub.add_parser(nom, help=aide)
        p.add_argument("--role", default="heros", help="heros,costard,directeur,annonce")
        p.add_argument("--statut", default="TE", help="lettres parmi T, E, R, P")
        p.add_argument("--variante", default="a", help="lettres parmi a, b, c")
        p.add_argument("--only", help="identifiants séparés par des virgules")
        if nom == "generate":
            p.add_argument("--go", action="store_true", help="appeler vraiment le service (dépense des crédits)")
    c = sub.add_parser("casting", help="mêmes phrases par plusieurs voix, pour distribuer un rôle")
    c.add_argument("--role", default="annonce", help="rôle à distribuer (voir ESSAIS)")
    c.add_argument("--voix", required=True, help="noms courts séparés par des virgules (voir GENERIQUES)")
    c.add_argument("--go", action="store_true", help="appeler vraiment le service (dépense des crédits)")
    f = sub.add_parser("finalize", help="écrit les prises retenues, recadrées et au même niveau, en WAV")
    f.add_argument("--out", default="/tmp/voix")
    k = sub.add_parser("pick", help="retenir des prises : heros_depart_a … (nom=- pour retirer)")
    k.add_argument("noms", nargs="+")
    args = ap.parse_args()
    try:
        return {"generate": cmd_generate, "page": cmd_page, "pick": cmd_pick, "finalize": cmd_finalize,
                "casting": cmd_casting}[args.cmd](args)
    except Indisponible as e:
        print(f"ERREUR : {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
