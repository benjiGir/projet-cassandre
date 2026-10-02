"""
Studio sonore : ecouter, regler a l'oreille, comparer, decider.

    ./.venv-refs/bin/python3 tools/audio/studio.py          # http://127.0.0.1:8765
    ./.venv-refs/bin/python3 tools/audio/studio.py --port 9000

Une page, servie en local, ou chaque son physique (`catalogue.py`) a :

- ses CURSEURS — les reglages de la recette, rendus a la volee ;
- trois ecoutes : le son dans son lieu, le son SEC, et la piece seule
  changee (menu des lieux) ;
- l'AVANT — l'ancienne recette de synthese, rendue a la volee ;
- le REEL le plus proche — la prise CC0 du corpus que l'oreille juge la plus
  proche, pour un A/B honnete (jamais livree au jeu) ;
- le VERDICT de l'oreille (`oreille.py`) et ses ecarts, en clair ;
- un spectrogramme ;
- deux boutons d'avis (reconnaissable ou non) et un commentaire, ecrits
  dans `avis.json` : c'est par la que l'agent sait ce que l'humain a entendu.

« Sauver » ecrit les curseurs dans `reglages.json`, la source versionnee des
reglages ; le prochain `render_sfx.py` / `build_sprite.py` les prend.

Aucune dependance hors numpy/scipy/matplotlib : `http.server` de la
bibliotheque standard. Ecoute sur 127.0.0.1 seulement.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import catalogue  # noqa: E402
import ia_sfx  # noqa: E402
import espace  # noqa: E402
import recipes  # noqa: E402,F401  (inscrit les recettes physiques)
from enregistrements import BRUT, _decoder, _un_canal  # noqa: E402
from synth import SR, read_wav  # noqa: E402

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
PAGE = os.path.join(ICI, "studio.html")
AVIS = os.path.join(ICI, "avis.json")

_verrou = threading.Lock()
_oreille = None


def oreille():
    global _oreille
    if _oreille is None:
        import oreille as o
        _oreille = o.Oreille()
    return _oreille


def wav_octets(x: np.ndarray, crete: float = 0.89) -> bytes:
    m = np.max(np.abs(x)) if len(x) else 0
    y = x * (crete / m) if m > 1e-9 else x
    y = np.clip(y, -1, 1)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((y * 32767).astype("<i2").tobytes())
    return buf.getvalue()


def _reglages(q: dict) -> dict[str, float]:
    brut = q.get("r", ["{}"])[0]
    try:
        return {k: float(v) for k, v in json.loads(brut).items()}
    except (ValueError, TypeError):
        return {}


def _rendu(q: dict) -> np.ndarray:
    nom = q["nom"][0]
    seed = int(q.get("seed", ["0"])[0])
    sec = q.get("sec", ["0"])[0] == "1"
    lieu = q.get("lieu", [""])[0] or None
    with _verrou:
        if nom not in catalogue.REGISTRE:
            # Son de synthese abstraite (`recipes.py`) : pas de reglages, pas de lieu.
            fn, _, nvar = recipes.RECIPES[nom]
            return fn(seed=seed % max(nvar, 1))
        return catalogue.rendre(nom, seed, _reglages(q), sec=sec, lieu=lieu)


def _avant(nom: str, seed: int = 0) -> np.ndarray | None:
    """
    Le son tel qu'il etait AVANT les modeles physiques : l'ancienne recette
    (`recipes.ANCIENNES`), rendue a la volee — la comparaison survit donc a la
    reconstruction du sprite.
    """
    ancienne = recipes.ANCIENNES.get(nom)
    if ancienne is None:
        return None
    fn, _, nvar = ancienne
    return fn(seed=seed % max(nvar, 1))


def ia_retenus() -> dict:
    f = ia_sfx.RETENUS / "retenus.json"
    return json.loads(f.read_text()) if f.exists() else {}


def catalogue_json() -> list[dict]:
    sauves = catalogue.reglages_sauves()
    out = []
    for nom, r in catalogue.REGISTRE.items():
        out.append({
            "nom": nom, "categorie": r.categorie, "variantes": r.variantes,
            "aide": r.aide, "oreille": r.oreille, "lieu": r.lieu, "distance": r.distance,
            "prereglages": r.prereglages,
            "ia": [int(p.stem) for p in ia_sfx.prises(nom)],
            "ia_retenue": int(ia_retenus().get(nom, {}).get("candidat", 0)) or None,
            "reglages": [{"cle": k, "defaut": s.defaut, "mini": s.mini, "maxi": s.maxi,
                          "unite": s.unite, "aide": s.aide,
                          "valeur": sauves.get(nom, {}).get(k, s.defaut)}
                         for k, s in r.reglages.items()],
        })
    # Les sons de synthese abstraite qui ont des prises generees : ecoute et
    # choix seulement (ni reglages, ni lieu, ni oreille).
    for nom in sorted(set(recipes.RECIPES) - set(catalogue.REGISTRE)):
        if not ia_sfx.prises(nom):
            continue
        fn, cat, nvar = recipes.RECIPES[nom]
        out.append({"nom": nom, "categorie": cat, "variantes": nvar,
                    "aide": (fn.__doc__ or "").strip(), "oreille": None, "lieu": None,
                    "distance": None, "prereglages": {}, "reglages": [],
                    "ia": [int(p.stem) for p in ia_sfx.prises(nom)],
                    "ia_retenue": int(ia_retenus().get(nom, {}).get("candidat", 0)) or None})
    return out


def spectrogramme_png(x: np.ndarray) -> bytes:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from scipy import signal as sps
    fig, ax = plt.subplots(figsize=(7.2, 2.2), dpi=100)
    fig.patch.set_facecolor("#14161a")
    ax.set_facecolor("#14161a")
    f, t, Z = sps.stft(x, SR, nperseg=1024, noverlap=896)
    S = 20 * np.log10(np.abs(Z) + 1e-9)
    ax.pcolormesh(t, f, S, vmin=S.max() - 90, vmax=S.max(), shading="auto", cmap="magma")
    ax.set_yscale("symlog", linthresh=400)
    ax.set_ylim(40, 20000)
    ax.tick_params(colors="#8a8f98", labelsize=7)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.set_xlabel("s", color="#8a8f98", fontsize=7)
    fig.tight_layout(pad=0.3)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", facecolor=fig.get_facecolor())
    plt.close(fig)
    return buf.getvalue()


def lire_avis() -> list[dict]:
    if not os.path.exists(AVIS):
        return []
    with open(AVIS, encoding="utf-8") as f:
        return json.load(f)


def ajouter_avis(entree: dict) -> None:
    tout = lire_avis()
    tout.append(entree)
    with open(AVIS, "w", encoding="utf-8") as f:
        json.dump(tout, f, indent=2, ensure_ascii=False)
        f.write("\n")


class Gestion(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def _envoyer(self, code: int, corps: bytes, type_: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", type_)
        self.send_header("Content-Length", str(len(corps)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corps)

    def _json(self, obj, code: int = 200) -> None:
        self._envoyer(code, json.dumps(obj, ensure_ascii=False).encode(), "application/json")

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        try:
            if u.path == "/":
                with open(PAGE, "rb") as f:
                    self._envoyer(200, f.read(), "text/html; charset=utf-8")
            elif u.path == "/api/catalogue":
                self._json({"sons": catalogue_json(), "lieux": {n: espace.resume(n) for n in espace.LIEUX},
                            "avis": lire_avis()})
            elif u.path == "/api/son":
                self._envoyer(200, wav_octets(_rendu(q)), "audio/wav")
            elif u.path == "/api/spectro":
                self._envoyer(200, spectrogramme_png(_rendu(q)), "image/png")
            elif u.path == "/api/oreille":
                nom = q["nom"][0]
                r = catalogue.REGISTRE.get(nom)
                if r is None or not r.oreille:
                    self._json({"visee": None})
                    return
                o = oreille()
                import oreille as mod_oreille
                q2 = dict(q)
                lieu_corpus = mod_oreille.LIEU_DU_CORPUS.get(r.oreille)
                q2["sec"] = ["0" if lieu_corpus else "1"]
                q2["lieu"] = [lieu_corpus or ""]
                x = _rendu(q2)
                j = o.juger(x, SR, r.oreille)
                j["reference"] = o.reference(r.oreille, x, SR)
                j["fiabilite"] = o.fiabilite(r.oreille)
                j["juge_dans"] = lieu_corpus or "sec"
                self._json(j)
            elif u.path == "/api/ia":
                nom = q["nom"][0]
                n = int(q["prise"][0])
                x, _ = read_wav(str(ia_sfx.CANDIDATS / nom / f"{n:02d}.wav"))
                x = ia_sfx.couper(x, SR)
                if nom in catalogue.NIVEAUX:
                    # Meme intensite que la version physique : sinon la plus
                    # forte des deux parait toujours la meilleure.
                    x = catalogue.au_niveau(x, catalogue.NIVEAUX[nom])
                    self._envoyer(200, wav_octets(x, crete=float(np.max(np.abs(x)))), "audio/wav")
                else:
                    self._envoyer(200, wav_octets(x), "audio/wav")
            elif u.path == "/api/avant":
                x = _avant(q["nom"][0], int(q.get("seed", ["0"])[0]))
                if x is None:
                    self._envoyer(404, b"absent du sprite", "text/plain")
                else:
                    self._envoyer(200, wav_octets(x), "audio/wav")
            elif u.path == "/api/reel":
                rel = os.path.normpath(q["chemin"][0])
                if rel.startswith("..") or os.path.isabs(rel):
                    self._envoyer(403, b"", "text/plain")
                    return
                data, sr = _decoder(os.path.join(BRUT, rel))
                x = _un_canal(data)
                if sr != SR:
                    from fractions import Fraction
                    from scipy import signal as sps
                    fr = Fraction(SR, sr).limit_denominator(1000)
                    x = sps.resample_poly(x, fr.numerator, fr.denominator)
                self._envoyer(200, wav_octets(x), "audio/wav")
            else:
                self._envoyer(404, b"", "text/plain")
        except Exception as e:  # le studio ne tombe pas sur une recette cassee
            self._json({"erreur": f"{type(e).__name__}: {e}"}, 500)

    def do_POST(self):
        u = urlparse(self.path)
        longueur = int(self.headers.get("Content-Length", "0"))
        try:
            corps = json.loads(self.rfile.read(longueur) or b"{}")
            if u.path == "/api/ia_retenir":
                n = corps.get("prise")
                choix = f"{corps['nom']}=-" if not n else f"{corps['nom']}={int(n)}"
                ia_sfx.cmd_pick(argparse.Namespace(choix=[choix]))
                self._json({"ok": True, "retenue": n or None})
                return
            if u.path == "/api/sauver":
                catalogue.sauver_reglages(corps["nom"], corps.get("reglages", {}))
                self._json({"ok": True, "reglages": catalogue.reglages_sauves().get(corps["nom"], {})})
            elif u.path == "/api/avis":
                ajouter_avis({"date": time.strftime("%Y-%m-%d %H:%M"), "nom": corps["nom"],
                              "seed": corps.get("seed", 0), "avis": corps.get("avis", ""),
                              "commentaire": corps.get("commentaire", ""),
                              "reglages": corps.get("reglages", {})})
                self._json({"ok": True})
            else:
                self._envoyer(404, b"", "text/plain")
        except Exception as e:
            self._json({"erreur": f"{type(e).__name__}: {e}"}, 500)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    a = ap.parse_args()
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), Gestion)
    print(f"Studio : http://127.0.0.1:{a.port}  ({len(catalogue.REGISTRE)} sons physiques)")
    srv.serve_forever()


if __name__ == "__main__":
    main()
