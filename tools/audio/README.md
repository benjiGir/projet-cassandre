# Studio audio — PROJET_CASSANDRE

Le son se fait **à deux mains** (direction du 2026-09-21) : de vrais
enregistrements CC0 pour ce qui est un objet, la synthèse pour le reste. Les
deux se rejoignent dans `recipes.py` : une recette peut poser une prise réelle
(`enregistrements.prise()`) sous des couches de synthèse. Aujourd'hui, une
seule le fait (`ceramic_break`) ; tout le reste est synthétisé. Les WAV sont
des artefacts de build ; la source est `recipes.py`, en texte, versionnée.

**Les quatre scripts sont testés et fonctionnels.**

| Script | Rôle |
|---|---|
| `synth.py` | bibliothèque DSP (bruits, enveloppes, filtres, réverbération) |
| `recipes.py` | les 38 recettes du projet, paramétriques et déterministes |
| `enregistrements.py` | prises réelles (`assets_src/cc0_raw/`) : licence lue au registre, décodage, découpe, transposition |
| `render_sfx.py` | rend les recettes en WAV |
| `analyze_sfx.py` | mesures + planche de spectrogrammes + masquage + ressemblance de timbre + raccord d'une boucle |
| `build_sprite.py` | empaquette en sprite Howler + encode ogg/m4a, ambiances comprises ; décode et vérifie chaque boucle exacte |
| `audition.py` | page d'ecoute locale, tout le catalogue a un clic par son, les ambiances en boucle |

## Chaîne complète

```bash
./.venv-refs/bin/python3 tools/audio/render_sfx.py  --out /tmp/wav
./.venv-refs/bin/python3 tools/audio/analyze_sfx.py /tmp/wav
./.venv-refs/bin/python3 tools/audio/build_sprite.py /tmp/wav --out public/assets/audio/sfx
./.venv-refs/bin/python3 tools/audio/audition.py     # page d'ecoute locale
```

Le sprite va sous `public/assets/` comme tout le reste des assets du jeu, et
c'est `src/core/audio.ts` qui le lit via son manifeste `sfx.json`.

Sélectif, variantes, masquage :

```bash
python3 tools/audio/render_sfx.py --out w --only shotgun,suit_telegraph
python3 tools/audio/render_sfx.py --out w --cat weapon --variants
python3 tools/audio/analyze_sfx.py --mask w/shotgun.wav w/suit_telegraph.wav
python3 tools/audio/analyze_sfx.py --timbre w/ceramic_break.wav w/*.wav   # < 0,55 = distincts
python3 tools/audio/analyze_sfx.py --boucle w/amb_water_jet.wav \
    public/assets/audio/sfx/amb_water_jet.ogg public/assets/audio/sfx/amb_water_jet.m4a \
    --sheet /tmp/boucle.png --contre w/suit_telegraph.wav
```

## Boucles

Une ambiance qui tourne en boucle se fabrique de deux façons. Les trois
ambiances de zone se referment par fondu croisé (`loop_seamless`). Le jet d'eau
des sanitaires (`amb_water_jet`) est fabriqué PÉRIODIQUE : filtres et
réverbération par `synth.periodique`, évènements qui débordent de la fin
rendus au début (`boucle=True` sur `bubbles`, `chocs`, `turbulence`), creux
spectral par `eq_circulaire`, crêtes par `limiteur(boucle=True)`. C'est la seule
façon juste pour un bruit continu et dense — un fondu croisé y creuse 3 dB une
fois par tour. Une recette de ce genre s'inscrit dans `BOUCLES_EXACTES`, qui
fait écrire son WAV sans fondu aux bords (`write_wav(boucle=True)`) et fait
vérifier ses fichiers encodés par `build_sprite.py`.

`analyze_sfx.py --boucle` situe le raccord parmi toutes les positions du fichier
(rangs 0-100 : un clic sort au-dessus de 99, un trou sous 1). Détail, étalonnage
et limites : `docs/systems/hud-audio.md#boucles-exactes--le-jet-deau`.

Écart connu : les trois ambiances de zone portent encore le fondu de 2,5 ms que
`write_wav` pose aux bords de tout son — un clic à chaque tour, mesuré. Pas
corrigé : elles ne sont pas branchées en jeu, et la correction change leurs
octets.

Une recette qui pose une prise réelle dépend d'un fichier de
`assets_src/cc0_raw/`, ignoré par git. S'il manque, ou si le registre des
licences ne le couvre pas, `render_sfx.py` le dit, rend le reste et sort en
erreur : ne pas empaqueter ce dossier-là.

## Ce que produit la chaîne

38 recettes, 7 catégories : armes, impacts, ramassages, ennemis, interactifs,
UI, ambiances. Rendu en 2 s. Mesuré le 2026-09-24 :

```
Sprite SFX         187 Ko ogg + 329 Ko m4a     34 sons, 28.3 s
Ambiances          338 Ko ogg + 579 Ko m4a     4 boucles, dont le jet d'eau (103 + 126 Ko)
TOTAL             1.40 Mo                      budget 8 Mo
```

Toute la chaîne est déterministe à l'octet, `.ogg` compris : le numéro de série
du flux Ogg, que les encodeurs tirent au hasard, est fixé par le nom du fichier.

## Dépendances

`numpy`, `scipy` (presents dans `.venv-refs`), `matplotlib` pour la planche de
spectrogrammes seulement. Les prises reelles se decodent par `oggdec` (ogg) et
`ffmpeg` (flac, aiff, mp3, wav flottant).

Pour l'encodage, `ffmpeg` s'il est la — sinon `oggenc` et `afconvert`, ce
dernier livre avec macOS. Aucun des deux formats n'est optionnel : Howler
choisit UN fichier d'apres le codec que le navigateur declare supporter et ne
se rabat pas sur l'autre. Un sprite en ogg seul, c'est un jeu muet sur Safari.

## Limite à connaître

**Un agent ne peut pas entendre.** Il mesure, il regarde un spectrogramme, il
vérifie la conformité. Le jugement final est humain, au casque. Voir le skill
`audio-critique-loop`.
