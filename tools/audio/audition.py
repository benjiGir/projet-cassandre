"""
Page d'ecoute locale de toutes les recettes.

    ./.venv-refs/bin/python3 tools/audio/audition.py
    ./.venv-refs/bin/python3 tools/audio/audition.py --cat weapon
    # puis http://localhost:5173/audition/ (serveur de dev)

Existe pour une raison simple : **un agent ne peut pas entendre**. Il mesure, il
lit un spectrogramme, il verifie une correlation — mais il ne saura jamais dire
si un pompe claque. Le jugement est humain, et il faut donc le rendre FACILE :
une page, un clic par son, tout le catalogue d'un coup d'oeil.

Elle rend les variantes de seed a cote du son principal, parce que c'est la
qu'on entend si les variantes se ressemblent trop. Chaque bouton porte les
mesures que l'agent, lui, a pu faire — duree, facteur de crete, centre de
gravite : quand l'oreille et le chiffre ne sont pas d'accord, c'est l'oreille
qui a raison, mais savoir OU ils divergent est ce qui permet de corriger.

Les ambiances y tournent EN BOUCLE, par Web Audio comme dans le jeu (un
`<audio loop>` ne reboucle pas a l'echantillon pres, et ferait entendre un trou
que le jeu n'a pas) : c'est la seule facon de juger un raccord a l'oreille. Une
boucle exacte (`recipes.BOUCLES_EXACTES`) propose aussi les fichiers LIVRES au
jeu, .ogg et .m4a, pour entendre ce que l'encodage en a fait. Un son ponctuel
n'arrete pas la boucle : on peut jouer la telegraphie d'un Costard par-dessus
le jet d'eau.

Ce qu'elle ecrit (`public/audition/`) est un artefact jetable et gitignore.
La source reste `recipes.py`.
"""

from __future__ import annotations

import argparse
import html
import os
import shutil
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from enregistrements import PriseIndisponible  # noqa: E402
from recipes import BOUCLES_EXACTES, RECIPES  # noqa: E402
from synth import SR, write_wav    # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SORTIE = os.path.join(ROOT, "public", "audition")
LIVRES = os.path.join(ROOT, "public", "assets", "audio", "sfx")

# Meme ordre que le catalogue, mais les armes d'abord : c'est ce qu'on vient
# ecouter neuf fois sur dix.
ORDRE = ["weapon", "enemy", "impact", "pickup", "interact", "ui", "ambience"]

TITRES = {
    "weapon": "Armes du joueur",
    "enemy": "Costards",
    "impact": "Impacts",
    "pickup": "Ramassages et secrets",
    "interact": "Objets et portes",
    "ui": "Interface",
    "ambience": "Ambiances (boucles)",
}


def mesures(x: np.ndarray) -> str:
    """Ce que l'agent a pu constater, affiche a cote du bouton."""
    crete = float(np.max(np.abs(x))) or 1e-9
    rms = float(np.sqrt(np.mean(x ** 2))) or 1e-9
    spectre = np.abs(np.fft.rfft(x[:int(0.25 * SR)] * np.hanning(min(len(x), int(0.25 * SR)))))
    freqs = np.fft.rfftfreq(min(len(x), int(0.25 * SR)), 1 / SR)
    centre = float((freqs * spectre).sum() / (spectre.sum() or 1))
    return f"{len(x) / SR:.2f}s · crete {20 * np.log10(crete / rms):.0f}dB · {centre:.0f}Hz"


def rendre(nom: str, fonction, seed: int, sortie: str) -> str:
    """Rend une recette et l'encode en ogg. Renvoie la ligne de mesures."""
    # Pas de grain retro : il a quitte le defaut du rendu le 2026-09-20, et une
    # page d'ecoute qui ne traiterait pas comme le rendu mentirait.
    x = np.asarray(fonction(seed=seed), dtype=np.float64)
    wav = os.path.join(SORTIE, sortie + ".wav")
    # Une boucle exacte s'ecrit comme au rendu (sans fondu aux bords, qui
    # ferait entendre ici un trou que le jeu n'a pas), et avec la marge de
    # l'encodeur : un bruit dense a 0,95 ressortirait ecrete de Vorbis.
    boucle = nom in BOUCLES_EXACTES
    write_wav(wav, x, SR, peak=0.80 if boucle else 0.95, boucle=boucle)
    subprocess.run(["oggenc", "-Q", "-q", "5",
                    "-o", os.path.join(SORTIE, sortie + ".ogg"), wav], check=True)
    os.unlink(wav)
    return mesures(x)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--cat", default=None, help="n'ecrire qu'une categorie")
    ap.add_argument("--no-variants", action="store_true", help="seulement la seed 0")
    args = ap.parse_args()

    shutil.rmtree(SORTIE, ignore_errors=True)
    os.makedirs(SORTIE, exist_ok=True)

    par_categorie: dict[str, list[str]] = {}
    total = 0
    for nom, (fonction, categorie, variantes) in RECIPES.items():
        if args.cat and categorie != args.cat:
            continue
        seeds = [0] if args.no_variants else list(range(max(1, variantes)))
        boutons = []
        for seed in seeds:
            fichier = f"{nom}__{seed}"
            try:
                info = rendre(nom, fonction, seed, fichier)
            except PriseIndisponible as e:
                print(f"[audition] {nom} seed {seed} ABSENT : {e}")
                boutons.append(f'      <p class="aide">{html.escape(nom)} : prise absente — {html.escape(str(e))}</p>')
                continue
            etiquette = nom if seed == 0 else f"variante {seed}"
            boucle = ' data-boucle="1"' if categorie == "ambience" else ""
            boutons.append(
                f'      <button data-src="{fichier}.ogg"{boucle} title="{html.escape(info)}">'
                f'{html.escape(etiquette)}<span>{html.escape(info)}</span></button>')
            total += 1
        if nom in BOUCLES_EXACTES:
            for ext in ("ogg", "m4a"):
                if os.path.exists(os.path.join(LIVRES, f"{nom}.{ext}")):
                    boutons.append(
                        f'      <button data-src="../assets/audio/sfx/{nom}.{ext}" data-boucle="1">'
                        f'fichier du jeu (.{ext})<span>tel que livré, après encodage</span></button>')
        par_categorie.setdefault(categorie, []).append(
            f'  <section>\n    <h3>{html.escape(nom)}</h3>\n'
            f'    <div class="pistes">\n' + "\n".join(boutons) + "\n    </div>\n  </section>")

    blocs = []
    for categorie in ORDRE:
        if categorie not in par_categorie:
            continue
        blocs.append(f'<h2>{html.escape(TITRES.get(categorie, categorie))}</h2>')
        if categorie == "ambience":
            blocs.append(AIDE_BOUCLES)
        blocs += par_categorie[categorie]

    with open(os.path.join(SORTIE, "index.html"), "w") as f:
        f.write(PAGE % "\n".join(blocs))
    print(f"[audition] {total} clips -> http://localhost:5173/audition/")


AIDE_BOUCLES = """<p class="aide">Ces sons tournent <strong>en boucle</strong> (Web Audio, comme dans le jeu) :
un clic lance, un second clic arrête. Laisse tourner une trentaine de secondes, le raccord passe à chaque
tour (10,24 s pour le jet d'eau) : un clic, un trou, un moment qui revient et qu'on attend, c'est un défaut
de boucle. Pendant qu'une boucle tourne, un son ponctuel se joue <em>par-dessus</em> — essaie
<code>suit_telegraph</code> sur le jet d'eau : c'est le canal qui dit qu'on te tire dessus.</p>
<p class="aide"><label>Volume des boucles <input type="range" id="volume" min="0" max="1" step="0.05"
value="1"></label> <span id="volval">1.00</span> — en jeu, le jet d'eau est atténué selon la distance.</p>"""


PAGE = """<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<title>Studio audio — PROJET_CASSANDRE</title>
<style>
  :root { color-scheme: dark; }
  body { background: #14141a; color: #e8e8ee; font: 15px/1.5 ui-monospace, monospace; margin: 0 auto;
         max-width: 64rem; padding: 2rem 1rem 4rem; }
  h1 { font-size: 1.4rem; margin-bottom: .2rem; }
  h2 { font-size: 1.05rem; color: #ffd479; margin: 2rem 0 .2rem; border-bottom: 1px solid #3a3a48;
       padding-bottom: .3rem; }
  h3 { font-size: .92rem; margin: 0 0 .35rem; color: #8fd3ff; font-weight: 600; }
  p.aide { color: #9a9aa8; }
  section { padding: .55rem 0; }
  .pistes { display: flex; flex-wrap: wrap; gap: .4rem; }
  button { background: #22222c; color: #e8e8ee; border: 1px solid #39394a; border-radius: 4px;
           padding: .3rem .65rem; font: inherit; cursor: pointer; text-align: left; line-height: 1.25; }
  button span { display: block; font-size: .72rem; color: #8a8a98; }
  button:hover { background: #2e2e3c; }
  button.joue { background: #2e6f4e; border-color: #47a273; }
  button.joue span { color: #cdebd9; }
</style>
<h1>Studio audio</h1>
<p class="aide">Un clic joue le son. Le premier bouton de chaque ligne est la seed 0, celle qui part
dans le jeu ; les suivants sont ses variantes — si elles s'entendent comme le même son, dis-le.</p>
<p class="aide">Sous chaque bouton : durée, facteur de crête, centre de gravité spectral. C'est tout ce
qu'un agent peut constater. <strong>Ce qui compte, c'est ton oreille</strong> — les chiffres servent
seulement à savoir quoi corriger quand elle n'est pas d'accord.</p>
%s
<script>
  let courant = null, courantBouton = null;
  let ctx = null, sortie = null, boucle = null, boucleBouton = null;
  const tampons = new Map();

  async function tampon(src) {
    if (!tampons.has(src)) {
      tampons.set(src, fetch(src).then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a)));
    }
    return tampons.get(src);
  }

  async function basculerBoucle(b) {
    if (!ctx) {
      ctx = new AudioContext();
      sortie = ctx.createGain();
      sortie.gain.value = Number(document.getElementById("volume")?.value ?? 1);
      sortie.connect(ctx.destination);
    }
    const meme = boucleBouton === b;
    if (boucle) { boucle.stop(); boucleBouton.classList.remove("joue"); boucle = null; boucleBouton = null; }
    if (meme) return;
    const source = ctx.createBufferSource();
    source.buffer = await tampon(b.dataset.src);
    source.loop = true;
    source.connect(sortie);
    source.start();
    boucle = source;
    boucleBouton = b;
    b.classList.add("joue");
  }

  function jouerPonctuel(b) {
    if (courant) { courant.pause(); courantBouton.classList.remove("joue"); }
    courant = new Audio(b.dataset.src);
    courantBouton = b;
    b.classList.add("joue");
    courant.addEventListener("ended", () => b.classList.remove("joue"));
    courant.play();
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-src]");
    if (!b) return;
    if (b.dataset.boucle) basculerBoucle(b); else jouerPonctuel(b);
  });

  document.addEventListener("input", (e) => {
    if (e.target.id !== "volume") return;
    document.getElementById("volval").textContent = Number(e.target.value).toFixed(2);
    if (sortie) sortie.gain.value = Number(e.target.value);
  });
</script>
</html>
"""


if __name__ == "__main__":
    main()
