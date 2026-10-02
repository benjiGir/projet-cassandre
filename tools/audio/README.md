# Studio audio — PROJET_CASSANDRE

**Depuis le 2026-10-01, les sons d'OBJETS sont des modèles physiques**, en pur
Python (numpy/scipy), sans modèle d'IA ni enregistrement livré. Quatre passes
de « bruit filtré sous enveloppe » avaient été rejetées avec les mêmes mots :
*ça ne ressemble pas à ce que c'est*. Un bruit filtré sait faire « un bruit
percussif », pas « du verre ». La physique, elle, donne gratuitement les
indices que l'oreille utilise pour reconnaître une source : l'amortissement
des modes (la matière), la durée du contact (la dureté), les rapports entre
modes (la forme), la rafale de micro-ruptures (la casse), le frottement
colle-glisse (le grincement), les tons éoliens (l'objet qui fend l'air), l'onde
de souffle de Friedlander (le coup de feu), la pièce calculée (le lieu).
Sources et équations : en tête de `physique.py`.

Les signaux abstraits (interface, secret trouvé, ambiances, liquides)
restent dans `recipes.py`.

## Le studio : écouter, régler, juger

```bash
./.venv-refs/bin/python3 tools/audio/studio.py      # http://127.0.0.1:8765
```

(ou `studio-sonore` dans `.claude/launch.json`). Pour chaque son physique :
curseurs rendus à la volée, écoute dans son lieu / à sec / dans un autre
lieu, l'**avant** (ancienne recette), le **réel le plus proche** du corpus
CC0 (A/B, jamais livré), le verdict de l'oreille et un spectrogramme. Deux
boutons d'avis et un commentaire s'écrivent dans `avis.json` : c'est par là
que l'agent apprend ce que l'humain a entendu. « Sauver » écrit les curseurs
dans `reglages.json`, source versionnée que `render_sfx.py` applique.

| Module | Rôle |
|---|---|
| `physique.py` | matières (facteur de perte), modes (barre, plaque, coque, denses), contact de Hertz, fracture (PhISEM), éclats qui retombent, colle-glisse, raclement, tons éoliens, Friedlander, jet de gaz, écrêtage du micro |
| `espace.py` | lieux (magasin, réserve, sanitaires, couloir, bureau, stand) : sources-images + queue diffuse par octave (Eyring), niveau par la distance critique |
| `voix.py` | voix source-filtre : impulsion glottique de Rosenberg, gigue, scintillement, souffle, voix craquée, formants en cascade (Klatt) |
| `sons_armes.py`, `sons_impacts.py`, `sons_mecanique.py`, `sons_costard.py`, `sons_ramassages.py` | les recettes physiques, chacune avec ses réglages |
| `catalogue.py` | registre `@recette`, réglages, rendu dans le lieu, rognage de la queue, mise au niveau de l'ancien mixage (`NIVEAUX`) |
| `oreille.py` | l'« oreille » : classe un son par ses voisins dans ~240 enregistrements CC0 locaux, et dit en clair où il s'écarte du réel |
| `studio.py` + `studio.html` | le serveur local et la page |
| `synth.py` | briques DSP de base (filtres, bulles de van den Doel, boucles exactes) |
| `recipes.py` | registre complet vu par la chaîne ; les recettes physiques y remplacent les anciennes (`ANCIENNES` les garde pour l'A/B) |
| `enregistrements.py` | prises réelles (`assets_src/cc0_raw/`) : licence lue au registre, décodage |
| `render_sfx.py` | rend les recettes en WAV (au niveau de `catalogue.NIVEAUX` pour les sons physiques) |
| `analyze_sfx.py` | mesures, spectrogrammes, masquage, ressemblance de timbre, raccord de boucle |
| `build_sprite.py` | sprite Howler ogg + m4a, ambiances, vérification des boucles |
| `audition.py` | ancienne page d'écoute du catalogue complet (via le serveur Vite) |

### L'oreille, et ce qu'elle vaut

`oreille.py etalonner` classe chaque prise réelle par les autres, en excluant
tout son groupe (même objet, même arme) : **67 % au premier rang, 83 % dans
les trois premiers, sur 14 classes**. Fiable pour les armes (bibliothèque
neutre enregistrée au stand) et pour « est-ce une voix » ; **seulement
indicative pour les impacts** : les sons Kenney sont déjà traités pour le jeu
(grave gonflé, aigu à −40/−70 dB), et « impactGlass » est un objet en verre
qu'on cogne, pas du verre qui casse. Une arme se juge placée au `stand`
(`LIEU_DU_CORPUS`), comme les prises. L'oreille écarte ce qui est
mesurablement à côté ; le verdict reste humain.

```bash
./.venv-refs/bin/python3 tools/audio/oreille.py etalonner
./.venv-refs/bin/python3 tools/audio/oreille.py juger w/pistol_fire.wav=pistolet
./.venv-refs/bin/python3 tools/audio/oreille.py voisins w/impact_glass.wav
```

Mesure d'entrée (anciennes recettes, 2026-10-01) : le pistolet était 6ᵉ pour
« pistolet » (plus proche d'un grincement de porte), le pompe 9ᵉ, le verre
11ᵉ. Le pistolet physique est 1ᵉʳ et dans le nuage du réel ; le pompe dans le
nuage au stand.

### Ajouter un son physique

Une fonction `(g, **réglages) -> signal SEC` dans le bon `sons_*.py`, décorée
par `@recette(nom, catégorie, variantes=, oreille=, lieu=, distance=,
réglage=(défaut, min, max, unité, aide)...)`. Le hasard passe TOUJOURS par
`g` (déterminisme). Ajouter son intensité cible dans `catalogue.NIVEAUX` et,
si c'est un nouveau nom, sa ligne dans `SFX_TABLE` (`src/core/audio.ts`).

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
python3 tools/audio/analyze_sfx.py --boucle w/amb_shower.wav \
    public/assets/audio/sfx/amb_shower.ogg public/assets/audio/sfx/amb_shower.m4a \
    --sheet /tmp/boucle.png --contre w/suit_telegraph.wav
```

## Sons générés par un modèle (`ia_sfx.py`, 2026-09-30) — mis de côté

> 2026-10-01 : l'utilisateur a écarté les modèles (« pas de model, j'ai pas
> envie de me prendre la tête ») au profit des modèles physiques ci-dessus.
> L'outil reste, non branché, sans clé ni crédit dépensé.

Quatre passes de synthèse pure ont été rejetées (« ça ne ressemble pas à ce que
c'est »). Pour les sons d'OBJETS, on part donc d'un modèle texte → SFX
(ElevenLabs Sound Effects, clé hors dépôt) plutôt que d'un bruit qu'on habille.
Les prompts sont dans `ia_prompts.py` — c'est lui qu'on affine, pas le
traitement d'après.

| Étape | Commande (`ia_sfx.py`) |
|---|---|
| Coût, sans rien appeler | `generate --only pistol_fire --variants 6` |
| Générer (dépense des crédits) | `generate --only pistol_fire --variants 6 --go` |
| Écouter, synthèse actuelle à côté | `page` → `http://localhost:5173/audition/ia/index.html` |
| Retenir une prise | `pick pistol_fire=3` (`pick nom=-` pour retirer) |
| Mettre les prises retenues dans le sprite | `render_sfx.py --out /tmp/wav`, puis `finalize --out /tmp/wav`, puis `build_sprite.py` |

La clé se met dans `ELEVENLABS_API_KEY` ou dans `.env.local` (gitignoré), jamais
dans le chat ni dans le dépôt. Le jeu n'appelle jamais le service : il joue un
sprite figé (invariants #11-12 intacts).

Une prise générée ne se régénère pas à l'identique : la source d'un son retenu
est son WAV brut dans `assets_src/audio_ia/retenus/` + son prompt
(`retenus.json`), commités ; `candidats/` est jetable et gitignoré.

**Licence : à lire avant d'adopter quoi que ce soit.** Ce n'est pas du CC0
(principe n° 7 du plan). La ligne `audio_ia/` du registre est « à confirmer » et
`finalize` refuse tant qu'elle l'est — même garde-fou que pour les prises CC0.
Les ambiances (`amb_*`) sont hors périmètre : ce sont des boucles exactes que
`build_sprite.py` vérifie à l'échantillon près, à traiter après les sons
ponctuels.

## Boucles

Une ambiance qui tourne en boucle se fabrique de deux façons. Les trois
ambiances de zone se referment par fondu croisé (`loop_seamless`). Le jet des
sanitaires (`amb_water_jet`) et la douche (`amb_shower`) sont fabriqués
PÉRIODIQUEMENT : filtres et réverbération par `synth.periodique`, évènements
qui débordent de la fin rendus au début (`boucle=True` sur `bubbles`, `chocs`,
`turbulence`), creux spectral par `eq_circulaire`, crêtes par
`limiteur(boucle=True)`. La douche dure 20,48 s, soit 882 trames AAC, et sa
modulation lente complète exactement un cycle. C'est la seule façon juste pour
un bruit continu et dense — un fondu croisé y creuse 3 dB une fois par tour.
Une recette de ce genre s'inscrit dans `BOUCLES_EXACTES`, qui fait écrire son
WAV sans fondu aux bords (`write_wav(boucle=True)`) et fait vérifier ses
fichiers encodés par `build_sprite.py`.

`analyze_sfx.py --boucle` situe le raccord parmi toutes les positions du fichier
(rangs 0-100 : un clic sort au-dessus de 99, un trou sous 1). Détail, étalonnage
et limites : `docs/4-technique/audio-runtime.md#boucles-exactes--le-jet-deau`.

Écart connu : les trois ambiances de zone portent encore le fondu de 2,5 ms que
`write_wav` pose aux bords de tout son — un clic à chaque tour, mesuré. Pas
corrigé : elles ne sont pas branchées en jeu, et la correction change leurs
octets.

Une recette qui pose une prise réelle dépend d'un fichier de
`assets_src/cc0_raw/`, ignoré par git. S'il manque, ou si le registre des
licences ne le couvre pas, `render_sfx.py` le dit, rend le reste et sort en
erreur : ne pas empaqueter ce dossier-là.

## Ce que produit la chaîne

40 recettes, dont 27 physiques, 7 catégories. Mesuré le 2026-10-01 (les
sons physiques portent leur queue de pièce, rognée à −60 dB) :

```
Sprite SFX         367 Ko ogg + 565 Ko m4a     35 sons, 45.9 s
Ambiances          528 Ko ogg + 824 Ko m4a     5 boucles, inchangées
TOTAL             2.23 Mo                      budget 8 Mo
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
