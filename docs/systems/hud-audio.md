---
title: HUD et audio
tags: [systeme, audio]
status: stable
updated: 2026-09-24
---

# HUD et audio

Le jeu a deux besoins sonores très différents, traités par deux modules
séparés. Le premier : des bruits courts et ponctuels (tir, impact, alerte
d'un Costard, porte qui se déverrouille) qui doivent pouvoir se superposer
sans se marcher dessus ni sonner comme une mitraillette de samples
identiques — c'est le rôle de `core/audio.ts`. Le second : une ambiance de
fond et un thème musical, en boucle sur toute une session, qui doivent
parfois baisser brièvement pour laisser la place à une réplique du héros —
c'est le rôle de `core/music.ts`, volontairement séparé du premier parce
que les deux jeux de contraintes (pooling/pitch d'un côté, streaming en
boucle de l'autre) n'ont rien en commun. **Les vingt-trois SFX sont
synthétisés par code** depuis le 2026-09-20 — un seul mêle une vraie prise,
voir [le catalogue](#catalogue-doù-vient-chaque-son) — et livrés en un seul
audio sprite ; la musique, elle, reste un placeholder.

## Effets sonores ponctuels

Wrapper minimal autour de Howler (`src/core/audio.ts`) pour les SFX
ponctuels du jeu : tir, impact, feedback de l'ennemi Costard (alerte,
télégraphie, dégât, mort), porte à badge, secret trouvé.

Périmètre volontairement exclusif : aucune musique, aucune nappe d'ambiance
ici — `core/music.ts` est un module séparé depuis la Phase 6 (« Habillage »),
parce que le pooling par `Howl` et la variation de pitch ±8 % n'ont aucun
sens pour une piste en boucle streamée (voir plus bas). Les répliques du
héros restent, elles, du texte HUD (invariant #9, pas de vraie VO cette
phase) — câblées dans `game/session/feedback.ts`, ni ici ni dans `music.ts`.

Ce module ne touche jamais le pas fixe (invariant #2) : il n'est consommé
que depuis `updateFx` (`game/loop/updateFx.ts`), sur des
`fireEvents`/`hitEvents` déjà produits par le pas fixe qui vient de tourner.

## Assets sonores

**Le son se fait à deux mains, depuis le 2026-09-20 :** de vrais
enregistrements CC0 pour tout ce qui est un OBJET — armes, impacts, verre,
bois, portes, ramassages, voix des Costards — et la synthèse pour ce qui
n'existe pas physiquement : interface, bips du lecteur de carte, son de secret
trouvé, ambiances de zone. Chaque technique est bonne à une chose différente,
et quatre passes ont été nécessaires pour l'admettre (voir plus bas). Les deux
origines se rejoignent dans le même sprite. Le studio vit sous `tools/audio/` : `synth.py`
(briques DSP), `recipes.py` (les recettes, en texte, versionnées),
`render_sfx.py` (rendu WAV), `analyze_sfx.py` (mesures et masquage),
`build_sprite.py` (empaquetage), `audition.py` (page d'écoute). Les WAV sont
des artefacts de build ; la source est `recipes.py`, et un même seed y rend le
même octet.

Le jeu ne charge plus un fichier par son mais un **audio sprite** : un seul
fichier, un seul décodage, une seule requête, latence minimale. Le manifeste
`sfx.json` dit où chaque son commence dans l'atlas et combien de temps il dure.
Les ambiances en sont exclues — longues et bouclées, les mettre dans l'atlas
gonflerait le décodage initial pour rien. Chacune part en DEUX fichiers,
`.ogg` et `.m4a`, pour la même raison que le sprite : Howler ne se rabat pas
d'un format sur l'autre (voir [Boucles exactes](#boucles-exactes-le-jet-deau)).

```bash
./.venv-refs/bin/python3 tools/audio/render_sfx.py --out /tmp/wav
./.venv-refs/bin/python3 tools/audio/build_sprite.py /tmp/wav --out public/assets/audio/sfx
./.venv-refs/bin/python3 tools/audio/audition.py     # page d'écoute
```

`SFX_TABLE` raccorde les **identifiants du jeu** aux **noms de recettes** :
`melee_fire` joue `crowbar_swing`, `enemy_death` joue `suit_death`. Les deux
vocabulaires restent séparés exprès, et cette table est le seul endroit à
toucher si une recette est renommée. Un identifiant qui pointe sur une recette
absente du sprite est signalé UNE fois au chargement, pas au premier tir ;
`cassandre.sfx.liste()` le dit aussi en console, et `cassandre.sfx.joue(id)`
déclenche n'importe quel son sans avoir à provoquer la situation qui le
produit — indispensable, le verrouillage du pointeur étant hors de portée de
l'automatisation.

### Catalogue : d'où vient chaque son

Aujourd'hui presque tout est synthétisé : les enregistrements attendus par la
direction du 2026-09-21 ne sont pas encore téléchargés. La dernière colonne dit
ce que cette direction prévoit pour chaque son — ce qui est un OBJET sera
enregistré, ce qui n'existe pas physiquement reste synthétisé.

| Identifiant du jeu | Recette | Origine aujourd'hui | Cible |
|---|---|---|---|
| `melee_fire` | `crowbar_swing` | synthèse | enregistrement |
| `shotgun_fire` | `shotgun` | synthèse | enregistrement |
| `pistol_fire` | `pistol_fire` | synthèse | enregistrement |
| `impact_concrete` | `impact_concrete` | synthèse | enregistrement |
| `impact_metal` | `impact_metal` | synthèse | enregistrement |
| `impact_flesh` | `impact_flesh` | synthèse | enregistrement |
| `prop_break_wood` | `prop_break_wood` | synthèse | enregistrement |
| `prop_break_glass` | `impact_glass` | synthèse | enregistrement |
| `enemy_alert` | `suit_alert` | synthèse | enregistrement (voix) |
| `enemy_hurt` | `enemy_hurt` | synthèse | enregistrement (voix) |
| `enemy_death` | `suit_death` | synthèse | enregistrement (voix) |
| `enemy_telegraph` | `suit_telegraph` | synthèse | non tranché : signal de jeu, dessiné pour ne ressembler à rien |
| `door_swing` | `door_open` | synthèse | enregistrement |
| `door_slide` | `door_slide` | synthèse | enregistrement |
| `door_shutter` | `door_shutter` | synthèse | enregistrement |
| `door_locked` | `door_locked` | synthèse | synthèse (lecteur de carte) |
| `door_unlock` | `door_unlock` | synthèse | synthèse (lecteur de carte) |
| `heal_pickup` | `pickup_health` | synthèse | enregistrement |
| `ammo_pickup` | `pickup_ammo` | synthèse | enregistrement |
| `secret_found` | `secret_found` | synthèse | synthèse |
| `sanitaire_use` | `toilet_flush` | **placeholder** de synthèse | enregistrement (`flush_*`) |
| `sanitaire_break` | `ceramic_break` | **placeholder hybride** : faïence réelle (assiettes Kenney `impactPlate_*`, CC0), eau de synthèse | enregistrement (`ceramic_*`, `spray_*`) |
| `water_drink` | `water_gulp` | **placeholder** de synthèse | enregistrement (`gulp_*`) |
| *(boucle positionnelle, [hors sprite](#boucle-deau-positionnelle))* | `amb_water_jet` | **placeholder** de synthèse, fichiers séparés | enregistrement (`jet_*`) |

Les quatre sons des sanitaires (2026-09-24) sont conformes aux mesures, sans
être jugés à l'oreille : ce qui a été rejeté quatre fois était « ça ne
ressemble pas à ce que c'est », et aucune mesure ne répond à ça. Leur eau
repose sur un modèle physique de bulles (`synth.bubble`, van den Doel 2005 :
chaque bulle résonne et sa hauteur MONTE) — du bruit filtré seul s'entend
comme du vent.

Mesuré sur la seed 0 :

| Recette | Durée | Facteur de crête | Masquage de `suit_telegraph` | Ressemblance de timbre |
|---|---:|---:|---:|---|
| `toilet_flush` | 1,92 s | 21,8 dB | 0,455 | `door_shutter` 0,78, `door_slide` 0,68 |
| `ceramic_break` | 0,96 s | 22,9 dB | 0,395 | `impact_glass` **−0,72** (contrat < 0,55), `prop_break_wood` 0,81, `suit_death` 0,93 |
| `water_gulp` | 0,41 s | 18,0 dB | 0,24 | `suit_telegraph` −0,10 |
| `amb_water_jet` | 10,24 s, en boucle | 12,6 dB | 0,239 | `suit_telegraph` −0,48, `toilet_flush` 0,22 ; `impact_glass` et `pa_click` 0,74 (voir plus bas) |

**Ce qu'il faut télécharger pour les remplacer** — la liste détaillée est dans
`assets_src/cc0_raw/freesound/README.md`, un dossier ignoré par git, d'où ce
résumé : une chasse d'eau entière prise de près (`flush_*`), un jet d'eau sous
pression (`spray_*`), de la faïence ÉPAISSE qui éclate (`ceramic_*` — pas de la
vaisselle, c'est le défaut du placeholder), une gorgée avalée de près
(`gulp_*`), et un jet d'eau CONTINU d'au moins vingt secondes, sans début ni
fin, qui retombe sur une surface dure (`jet_*`). Un contributeur différent par
famille.

### Boucles exactes : le jet d'eau

`amb_water_jet` est le son du jet PERMANENT d'un sanitaire cassé : le tuyau
qui crache sous pression, l'eau qui retombe en pluie sur le carrelage. Le jeu
le joue en boucle près de chaque jet (voir [Boucle d'eau
positionnelle](#boucle-deau-positionnelle)) ; le fichier est une source à
plein volume vue de près, le runtime atténue. Quatre couches : le souffle du
jet (1-10 kHz, timbre qui bascule entre deux bandes, rugosité rapide, poches
d'air qui le coupent à moitié trois fois par seconde), la pluie sur le
carrelage (des milliers de chocs secs, dont la densité suit le débit avec
1,1 s de retard, le temps de vol d'une goutte lancée à 1,5 m), les bulles de
la flaque (Minnaert, 1 à 7 kHz — l'indice qui dit LIQUIDE, à qui la bande
1-2 kHz est laissée), et la canalisation sous 150 Hz.

**Une boucle construite, pas refermée.** Les trois ambiances de zone se
referment par fondu croisé (`loop_seamless`). Sur un bruit continu et dense,
c'est une erreur : deux bruits indépendants fondus l'un dans l'autre perdent
3 dB au milieu du fondu (leurs puissances s'ajoutent, pas leurs amplitudes), et
un jet qui « respire » une fois par tour se repère mieux qu'un clic. Le jet est
donc fabriqué PÉRIODIQUE d'emblée : chaque filtre et la réverbération passent
par `synth.periodique` (appliqués à trois copies bout à bout, on garde la
troisième, qui est ce qu'ils produiraient en boucle infinie), les chocs et les
bulles qui débordent de la fin retombent au début (`boucle=True`), le creux de
la télégraphie est taillé dans le spectre de la période (`eq_circulaire`), et
le limiteur de crête lit la boucle en rond. Le raccord est un échantillon comme
les autres.

Durée : **441 trames AAC de 1024 échantillons**, soit 10,24 s. Un nombre entier
de trames ne laisse aucun remplissage en fin de `.m4a`, et 10,24 s tombent
juste à 48 000 Hz (491 520), où le navigateur rééchantillonne presque toujours.

**Le piège trouvé en route : `write_wav` posait un fondu de 2,5 ms aux bords de
TOUT son**, donc un trou pile au raccord de chaque ambiance. Les boucles
exactes (`recipes.BOUCLES_EXACTES`) s'écrivent sans lui. Les trois ambiances de
zone le portent encore, et c'est mesuré : leur raccord sort au rang 100 du
détecteur de clic (ci-dessous) — un clic à chaque tour, sur un son grave où il
s'entend. Elles ne sont pas branchées en jeu ; les ajouter à
`BOUCLES_EXACTES` change leurs octets, décision à prendre le jour où on les
branche.

**Vérifier une boucle sans l'entendre** : `analyze_sfx.py --boucle source.wav
livre.ogg livre.m4a` décode chaque fichier en flottant et situe le raccord
parmi TOUTES les positions du fichier — un raccord sans couture n'est pas un
raccord « petit », c'est un raccord qui ne se distingue d'aucun autre instant.
Quatre rangs (0-100) : marche du signal sous 250 Hz (un « toc » sourd),
résidu de prédiction linéaire sous 15 kHz (un clic : sur un bruit dense, une
marche ne se voit pas dans le signal, mais elle perce dans le résidu), niveau le
plus bas sur 1 ms (un trou), écart de spectre des 50 ms de part et d'autre. Un
clic sort au-dessus de 99, un trou sous 1. Étalonné sur des défauts fabriqués
exprès : un délai d'amorçage AAC non retiré (1 024 échantillons de silence)
sort à 0,3 et 99,8, un trou de 1,5 ms à 0,0, le fondu de `write_wav` à 0,0,
une marche de 0,1 à 100. Ce que la mesure ne voit pas : une coupure franche
dans un bruit de même spectre et de même niveau — l'oreille non plus, sans
doute, mais c'est pour ça que la boucle est construite plutôt que coupée.
`--sheet` ajoute une planche : la boucle entière, une seconde de texture, le
raccord lui-même, et le spectre moyen comparé à celui de `--contre`.

`build_sprite.py` fait la même vérification sur les fichiers qu'il vient
d'encoder, et **sort en erreur** si une boucle exacte revient avec une longueur
fausse, un échantillon écrêté ou un raccord hors rang. Il y a trouvé les deux
défauts de la première construction : Vorbis rendait le jet, normalisé à
−1 dBFS, à **+0,94 dBFS** (deux échantillons écrêtés — un bruit dense plein de
chocs brefs est ce qu'un encodeur avec perte dépasse le plus) ; les deux
formats sont donc réencodés ensemble, avec le même gain (−1,84 dB), jusqu'à
repasser sous −1 dBFS décodés. Mesuré sur les fichiers livrés :

| Décodeur | `.ogg` | `.m4a` |
|---|---|---|
| ffmpeg (applique la liste d'édition du `.m4a`) | 451 584 éch., pic −1,14 dBFS | 451 584 éch., pic −2,02 dBFS |
| Chrome `decodeAudioData`, contexte à 44 100 Hz | 451 584, décalage 0 | 451 584, décalage 0 |
| Chrome, contexte à 48 000 Hz | 491 520, pic −0,28 dBFS | 491 520, pic −0,61 dBFS |
| AudioToolbox (le décodeur de Safari), 44 100 / 48 000 Hz | — | 451 584 / **491 519** |

Zéro échantillon écrêté, raccord dans le rang ordinaire partout. Le seul écart
est l'échantillon manquant du rééchantillonneur d'AudioToolbox à 48 kHz :
0,02 ms, sous tout ce que la mesure (et l'oreille) distingue dans ce bruit.

**Même octet** : les deux encodeurs tiraient au hasard le numéro de série du
flux Ogg, et chaque construction sortait des `.ogg` différents pour des sons
identiques. Il est désormais tiré du nom du fichier ; le son décodé des
anciens et des nouveaux `.ogg` est identique à l'échantillon près.

**Ressemblance de timbre** : 0,74 avec `impact_glass` et `pa_click`, au-dessus
du seuil de 0,55. La mesure ne lit que les 250 premières ms et ignore le
déroulé dans le temps ; elle compare ici une nappe continue à des évènements
ponctuels, qui se distinguent par leur enveloppe. Contre la télégraphie, qui
compte, −0,48.

### Une prise réelle dans une recette

Les deux origines se rejoignent dans `recipes.py` même : une recette peut poser
une prise sous des couches de synthèse, par `enregistrements.prise()`, qui
découpe, transpose (comme un échantillonneur : plus bas = plus lourd et plus
lent), filtre, et rend un signal mono à 44 100 Hz. Tout le reste de la chaîne
— rendu, mesures, sprite, page d'écoute — ne voit pas la différence. Les
fichiers bruts restent dans `assets_src/cc0_raw/`, ignoré par git.

Deux garde-fous, appliqués par le code et pas par une consigne :

- **La licence est lue dans le registre** `assets_src/LICENCES_ASSETS.md` à
  chaque prise. Un fichier qu'aucune ligne ne couvre, ou dont la ligne porte
  « à confirmer », est refusé.
- **Un fichier absent fait échouer le rendu**, il n'est jamais remplacé en
  silence : `render_sfx.py` rend le reste, liste ce qui manque et sort en
  erreur. Deux machines ne produisent pas deux sprites différents sans le dire.

Les pièges payés par l'ancien import (somme d'un stéréo espacé, rééchantillonnage
sans filtre, prises écrêtées) y sont traités ; une prise écrêtée à la source
est signalée. Premier piège trouvé sur les assiettes Kenney : 65 à 80 % de leur
énergie est sous 80 Hz — la table, pas l'assiette. Passe-haut obligatoire.

### Le grain rétro, retiré du défaut

Le rendu appliquait un `crush` à 10 bits / 22 050 Hz à tout sauf l'ambiance et
l'interface — « l'équivalent audio du 640×360 ». Mesuré le 2026-09-20, il
faisait autre chose que ce qu'il annonçait. La réduction de taux se fait par
blocage d'échantillon, sans filtre : elle ne coupe pas l'aigu, elle le
**replie**.

| Son | Parasite injecté | Aigu |
|---|---:|---|
| `impact_metal` | **−1,7 dB** du signal | +1,9 dB de *faux* aigu |
| `impact_glass` | −2,9 dB | fabriqué, pas perdu |
| `pistol_fire` | −2,9 dB | +1,8 dB de faux |
| `crowbar_metal` | −4,4 dB | +2,5 dB de faux |

À −6 dB il y a autant de parasite que de son utile ; plusieurs étaient
au-dessus. Sur un impact métal ou un bris de verre — précisément les sons dont
la richesse fait qu'on les reconnaît — on remplaçait le détail par du bruit.

Il reste disponible en option (`render_sfx.py --crush`), et `synth.crush` reste
une brique : un son qui passe par un haut-parleur **dans la fiction** (annonce
au micro, interphone, talkie) a de bonnes raisons d'être dégradé. Ce qui était
faux, c'est de l'appliquer à tout.

Effet de bord mesuré, et il est net : l'écrêtage de l'atlas a disparu avec lui.
Les paliers du `crush` sont des marches verticales, exactement ce qu'un
encodeur avec perte ne sait pas représenter et compense en dépassant. La marge
de crête, qu'il avait fallu descendre à 0,80, est remontée à 0,85 — zéro
échantillon écrêté dans les deux formats, contre une vingtaine au départ.

### Pourquoi la synthèse, et pas des enregistrements

Parce qu'on a essayé, deux fois, et que l'utilisateur a rejeté les deux.
L'histoire vaut d'être gardée, parce que ce sont les mesures qui ont tranché :

1. **« C'est trop bizarre le son des armes. »** Trois causes mesurées. La somme
   stéréo d'un couple de micros ESPACÉ (corrélation −0,03, 0,89 ms d'écart)
   est un filtre en peigne : elle retirait **5 à 6 dB entre 60 et 600 Hz**. Le
   rééchantillonnage vers 22 050 Hz se faisait sans filtre anti-repliement :
   **+2,8 dB de grésillement** replié dans la bande 9–11 kHz, pile où vit le
   claquement du coup. Et surtout, les prises n'avaient **aucun grave** —
   0,1 % de l'énergie sous 200 Hz, 60 % entre 600 et 1500 Hz — en saturant
   2 à 5 ms sur chaque détonation.
2. **« Le pistolet et le pompe, on dirait le même son. »** Mesuré : **0,976**
   de corrélation de timbre. Pire, TOUTES les paires d'armes de la
   bibliothèque tenaient au-dessus de **0,840**, un fusil de chasse contre un
   .22 compris. Le lieu et les micros écrasaient l'arme : elles avaient été
   tirées le même jour, au même stand, au même couple de micros.

Un enregistrement se subit, un son fabriqué se règle. Là où l'échantillon ne
laissait qu'à choisir une autre prise, la recette laisse décider *ce qui*
sépare deux sons.

### La mesure qui garde cette porte fermée

Spectre moyen des 250 premières ms, 30 bandes log de 100 Hz à 16 kHz, en dB,
moyenne retirée, puis corrélation entre deux sons. Deux sons qui doivent se
distinguer restent **sous 0,55**. Elle est outillée depuis le 2026-09-24 :
`analyze_sfx.py --timbre ref.wav autres*.wav`. Le seuil ne vaut que pour les
paires qui DOIVENT se distinguer : sur le catalogue, 38 % des paires le
dépassent (médiane 0,39), toute la famille « large bande à pente descendante »
se ressemble sur cette mesure, qui ignore le déroulé dans le temps. Repères
mesurés sur le catalogue synthétisé :

| Paire | Ressemblance |
|---|---:|
| `shotgun` / `crowbar_swing` | −0,024 |
| `shotgun` / `impact_metal` | 0,200 |
| `shotgun` / `crowbar_metal` | 0,433 |
| `ceramic_break` / `impact_glass` | −0,719 |
| *(pour mémoire)* pompe / pistolet, échantillons rejetés | **0,976** |

`analyze_sfx.py --mask a.wav b.wav` fait l'autre contrôle, celui de
lisibilité : la télégraphie d'attaque d'un Costard ne doit pas être masquée
par le tir du joueur. C'est une contrainte de gameplay, pas de goût — c'est le
canal qui dit au joueur qu'on lui tire dessus hors champ.

Elle vaut pour tout son qui peut tomber en plein combat, pas seulement pour les
armes. La télégraphie met **76 % de son énergie entre 200 et 800 Hz** : un son
long qui s'y installe la couvre. La première chasse d'eau y mettait 88 % de la
sienne (recouvrement 0,855, conflit) ; elle passe maintenant par le grondement
de la canalisation sous 200 Hz et le chuintement au-dessus de 800 Hz (0,455).
Le jet d'eau, lui, sonne EN CONTINU près duquel on se bat : sa bande 320-850 Hz
est creusée à −18 dB, il n'y met plus que 0,04 % de son énergie, et son
recouvrement tombe à 0,239 — le plancher, la part de la télégraphie au-dessus
de 800 Hz qu'aucun son aigu ne peut éviter. Ce qu'il couvre encore de près : le
cliquet de la télégraphie à 3,6 kHz, pas sa montée de 380 à 900 Hz.

### Ce que l'agent ne peut pas faire

**Entendre.** Il mesure, il compare, il vérifie une conformité — il ne saura
jamais dire si un pompe claque. `tools/audio/audition.py` écrit donc une page
locale (`http://localhost:5173/audition/`) qui pose tout le catalogue à un clic
par son, variantes de seed comprises, avec sous chaque bouton les mesures que
l'agent, lui, a pu faire. Quand l'oreille et le chiffre divergent, c'est
l'oreille qui a raison ; le chiffre sert à savoir quoi corriger.

Un fichier absent (404) ne fait jamais planter le jeu : un seul `console.warn`
par id, et le son ne joue pas.

## Pooling et variation de pitch

Le sprite a rendu le pool d'instances inutile, et pour une raison qui mérite
d'être dite. L'ancien module gardait N `Howl` par son parce que
`Howl.rate(rate)` SANS identifiant change la vitesse de toutes les instances
en cours : en tirant au pompe — 9 plombs dans le même pas fixe — régler le
pitch du plomb n+1 modifiait rétroactivement celui du plomb n, encore en train
de sonner.

Avec le sprite, chaque lecture a son propre identifiant, rendu par `play()` :
`rate(r, id)` et `volume(v, id)` ne touchent qu'elle. Ce qui demandait huit
objets tient maintenant dans un seul, et Howler garde `pool` nœuds audio (12,
donné par le manifeste) pour les lectures qui se chevauchent — le défaut de 5
ne suffirait pas à une salve de pompe.

La variation de hauteur reste : ±8 % par défaut, pour casser l'effet
« mitraillette de samples identiques » sur un son répété. **Sauf sur les
armes**, à ±2,5 % (`SfxDef.pitch`) : ±8 % font presque un ton et demi, et
l'arme du joueur semble changer de calibre d'un tir à l'autre. Les recettes
déclarent 1 à 4 **variantes de seed** — le bruit change, la structure reste —
mais **seule la seed 0 part dans le sprite** : le jeu n'en tire aucune autre
aujourd'hui, et les variantes ne s'entendent que sur la page d'écoute. Un son
répété vite (une gorgée à chaque appui sur E) ne varie donc que par le ±8 %.

## Piège navigateur : déblocage du contexte audio

Le contexte audio reste suspendu tant qu'aucune interaction utilisateur n'a
eu lieu. Howler gère ça lui-même via `Howler.autoUnlock` (`true` par
défaut), qui écoute les premiers `click`/`touchend`/`keydown` du
`document` — exactement l'événement `click` sur le canvas qui déclenche
déjà `requestPointerLock` dans `core/input.ts`. Aucun code de déblocage
supplémentaire n'est nécessaire.

## Boucle d'eau positionnelle

Troisième module séparé de `core/audio.ts`/`core/music.ts`, pour une raison
différente des deux : un sanitaire cassé (`sanitaire_*`, [ADR
0032](../decisions/0032-sanitaires-utilisables.md)) laisse un jet d'eau
PERMANENT (`game/level/sanitaires.ts::SanitaireSystem`, `engine.fx.addWaterJet`
côté rendu) qui doit sonner comme une source ponctuelle dans l'espace — son
volume et son panoramique changent en continu avec la position et
l'orientation du joueur, ce qu'aucun des deux autres modules ne fait (les SFX
ponctuels sonnent une fois puis se taisent, la musique/l'ambiance ne bougent
jamais avec la caméra).

Le calcul est scindé en deux fichiers, pour une raison de testabilité qui
mérite d'être dite : `core/waterAmbienceMix.ts` ne connaît ni `Howl` ni
`AudioContext`, seulement des nombres (`Vec3Like`) — c'est lui qui a une
suite de tests (`test/core/waterAmbienceMix.test.ts`), à la manière de
`core/random.ts`. `core/waterAmbience.ts` le branche sur UN `Howl` unique en
boucle (`html5: false` — une boucle HTML5 a un trou au raccord, et surtout
`stereo()` n'a d'effet qu'en Web Audio) et n'est pas testé pour la même
raison que `core/audio.ts`/`core/music.ts` : aucun navigateur dans la suite
`vitest`.

Appelé depuis `updateFx` (`game/loop/updateFx.ts`), au taux d'AFFICHAGE,
jamais le pas fixe (invariant #2) — c'est de la présentation, comme le
screenshake ou le pool de lampes juste à côté dans le même fichier :

- **Gain par jet** : plein (1) à ≤ 1,5 m, silence (0) à 11 m (milieu de la
  fourchette 10-12 m demandée), courbe *smoothstep* entre les deux plutôt
  qu'une rampe linéaire — une rampe a une pente non nulle pile aux deux
  seuils, donc un pas de plus exactement à la frontière produit un saut de
  volume qui se remarque précisément là où on ne l'attend pas. Le
  smoothstep entre et sort de la plage à dérivée nulle : c'est la définition
  d'une atténuation « douce ».
- **Somme et plafond** : les gains de tous les jets actifs s'additionnent
  (deux jets proches s'entendent plus fort qu'un seul), mais la somme est
  plafonnée à 1,6 (`SUMMED_GAIN_CAP`) — sans quoi trois cuvettes cassées
  côte à côte tripleraient le volume perçu pour la seule raison qu'elles
  partagent la même pièce. 1,6 laisse un « un peu plus fort » mesurable
  (+4,1 dB) sans en faire un second évènement sonore.
- **Panoramique** : ±0,55 au plus (`PAN_MAX`, milieu de la fourchette
  ±0,5-0,6 demandée), d'après la direction du jet DOMINANT (celui qui
  contribue le plus de gain) projetée sur l'axe X local de la caméra — lu
  directement depuis `camera.quaternion` (invariant #3, même lecture brute
  qu'`interpolateVisuals.ts`), jamais depuis `matrixWorld` : à ce point de la
  frame, seul `renderer.render()` plus loin dans `core/loop.ts` la remet à
  jour. ±0,55 dit de quel côté est le jet sans jamais l'envoyer plein pot
  dans une seule oreille.
- **Lissage** : chaque frame, le gain et le pan CIBLES (calculés ci-dessus)
  sont approchés par un lissage exponentiel dépendant du temps
  (`smoothTowards`, constante de temps 50 ms pour le gain, 90 ms pour le
  pan — plus longue, un son qui change d'oreille se remarque plus qu'une
  petite variation de volume). Framerate-indépendant par construction :
  un facteur fixe par frame (`x += (cible - x) * 0.1`) accélérerait ou
  ralentirait le lissage selon le taux d'affichage réel, ce qui n'a pas de
  sens pour « quelques dizaines de ms ». C'est ce lissage, et rien d'autre,
  qui fait le fondu à la coupure — voir plus bas.
- **Volume final** : le gain plafonné (≤ 1,6) multiplie un volume Howler de
  base de 0,35 au plus proche — plafond choisi sous TOUT ce qui compte pour
  le gameplay (hiérarchie du skill `audio-mix-budget`) : sous
  `enemy_telegraph` (1.0, canal de lisibilité critique), sous les tirs, même
  sous les ramassages (0.7). Dans le pire cas (plusieurs jets proches),
  0,35 × 1,6 = 0,56 — encore sous tout ce qui précède. C'est un bruit de
  fond LOCAL, jamais un évènement.

**Coupure, toujours par le même mécanisme.** Le jeu ne passe jamais par un
fondu dédié : la cible du mélange devient silence (gain 0) dès que
`engine.flowActor.getSnapshot().value !== "playing"` (menu, mort, fin de
niveau — même lecture directe de l'acteur que la garde de CONTENU du pas
fixe dans `updateGameplay.ts`), et le lissage exponentiel s'en charge sur sa
propre constante de temps. Un rechargement de niveau/hot reload/reset obtient
le même résultat sans code dédié : `session.sanitaireSystem` devient une
instance NEUVE au chargement (aucun sanitaire cassé au départ), la liste des
jets actifs retombe à vide, la cible retombe à zéro. Le `Howl` lui-même n'est
`play()`-é qu'à la naissance du premier jet audible et `stop()`-é une fois le
fondu terminé (sous `AUDIBLE_GAIN_EPSILON`) — jamais laissé tourner à volume
nul en tâche de fond.

**Zéro allocation par frame en régime établi.** `SanitaireSystem` expose
`collectActiveJetOrigins(out)`, qui ÉCRIT dans un tableau scratch fourni par
l'appelant plutôt que d'en renvoyer un neuf — contrairement à `activeJets`
(getter existant, pour la console/les tests), qui clone un `Vector3` par jet
à chaque appel. `updateFx.ts` réutilise ce même tableau, et l'axe X de la
caméra, d'une frame à l'autre.

**Asset absent = non fatal**, même discipline que le reste du son de ce
projet : `amb_water_jet.ogg`/`.m4a`, sous `public/assets/audio/sfx/` comme le
sprite, peuvent ne pas encore exister (livrés par `sound-forge` en
parallèle) — un seul `console.warn` au premier échec de chargement, jamais
d'exception, et le calcul du mélange continue de tourner (observable en
console, voir plus bas) même sans fichier à jouer.

**Vérification sans l'entendre** : `cassandre.sfx.eau()` rend
`{ charge, joue, volume, pan }` — `charge` dit si le fichier a fini de
charger, `joue` si le `Howl` est réellement en lecture, `volume`/`pan` le
mélange courant. Même limitation que le reste du son de ce projet : le
verrouillage du pointeur est hors de portée de l'automatisation, donc c'est
le seul moyen de juger ce système sans se tenir devant un jet en jouant pour
de vrai.

## Musique et nappe d'ambiance

Deux pistes, deux rôles (`src/core/music.ts`) :

- `ambience` : nappe de fond en boucle (bruit de hypermarché — ballast
  fluorescent, ronronnement de groupe froid), jamais duckée, jamais coupée
  en jeu — c'est le bruit de la salle, pas un événement.
- `music` : thème en boucle, DUCKÉ (-6 dB) à chaque réplique du héros
  déclenchée (`triggerHeroLine`, `game/session/feedback.ts`), remonté sur
  400 ms après.
  Symbolique tant qu'il n'y a pas de vraie VO (répliques encore en texte
  HUD, invariant #9), mais c'est le comportement audio demandé par le plan —
  il prendra tout son sens le jour où une vraie voix remplace le texte.

`html5: true` sur les deux (streaming, jamais pour des SFX courts — ces
deux pistes durent plusieurs secondes et tournent en boucle toute une
session, l'inverse du cas `SfxPool` ci-dessus).

Même statut placeholder que les SFX : les deux fichiers sous
`public/assets/audio/music/` sont SYNTHÉTIQUES (même pipeline Python
stdlib — sinus/carrés + bruit filtré, `afconvert` pour le `.m4a`, `oggenc`
pour le `.ogg`), générés sans accès réseau. À remplacer par un vrai morceau
libre de droits dès qu'un humain peut en choisir un.

## Ducking pendant les répliques

`duckMusicForHeroLine()` (descente rapide, `DUCK_ATTACK_MS = 80`) et
`restoreMusicVolume()` (remontée, `DUCK_RESTORE_MS = 400`) sont
volontairement deux fonctions séparées plutôt qu'un minuteur interne à ce
module : la durée pendant laquelle la musique doit rester ducquée dépend de
la durée d'affichage de la réplique, une donnée que seul l'appelant
(`triggerHeroLine`, `game/session/feedback.ts`) connaît — même séparation
des responsabilités que `showHudMessage`/`hudMessage` dans `game/state.ts`
(l'auto-effacement est géré côté appelant, pas ici). `feedback.ts` appelle
`duckMusicForHeroLine()` au déclenchement, puis planifie
`restoreMusicVolume()` via son propre minuteur, au même endroit que celui
qui efface le texte de la réplique.

Le ducking n'agit QUE sur `music`, jamais sur `ambience` : le bruit de fond
de la salle n'a pas de raison de baisser quand le héros parle, seul le
thème musical pourrait le couvrir.

Retour à la [carte de la documentation](../README.md).
