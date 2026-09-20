# Studio audio — PROJET_CASSANDRE

Tout le son est **synthétisé par code**. Aucun échantillon externe, aucune
question de licence. Les WAV sont des artefacts de build ; la source est
`recipes.py`, en texte, versionnée.

**Les quatre scripts sont testés et fonctionnels.**

| Script | Rôle |
|---|---|
| `synth.py` | bibliothèque DSP (bruits, enveloppes, filtres, réverbération) |
| `recipes.py` | les 26 sons du projet, paramétriques et déterministes |
| `render_sfx.py` | rend les recettes en WAV |
| `analyze_sfx.py` | mesures + planche de spectrogrammes + masquage |
| `build_sprite.py` | empaquette en sprite Howler + encode ogg/m4a |
| `audition.py` | page d'ecoute locale, tout le catalogue a un clic par son |

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
```

## Ce que produit la chaîne

26 sons, 7 catégories : armes, impacts, ramassages, ennemis, interactifs, UI,
ambiances. Rendu en 0.6 s.

```
Sprite SFX (ogg)    113 Ko      23 sons, 17.6 s
Ambiances (ogg)     235 Ko       3 boucles sans couture
TOTAL              0.53 Mo      budget 8 Mo
```

## Dépendances

`numpy`, `scipy` (presents dans `.venv-refs`), `matplotlib` pour la planche de
spectrogrammes seulement.

Pour l'encodage, `ffmpeg` s'il est la — sinon `oggenc` et `afconvert`, ce
dernier livre avec macOS. Aucun des deux formats n'est optionnel : Howler
choisit UN fichier d'apres le codec que le navigateur declare supporter et ne
se rabat pas sur l'autre. Un sprite en ogg seul, c'est un jeu muet sur Safari.

## Limite à connaître

**Un agent ne peut pas entendre.** Il mesure, il regarde un spectrogramme, il
vérifie la conformité. Le jugement final est humain, au casque. Voir le skill
`audio-critique-loop`.
