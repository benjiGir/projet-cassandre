---
title: HUD et audio
tags: [systeme, audio]
status: stable
updated: 2026-09-20
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
boucle de l'autre) n'ont rien en commun. **Les vingt SFX sont synthétisés
par code** depuis le 2026-09-20 et livrés en un seul audio sprite (voir plus
bas) ; la musique, elle, reste un placeholder.

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
Les ambiances en sont exclues — longues et bouclées, elles se chargent en
streaming, et les mettre dans l'atlas gonflerait le décodage initial pour rien.

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
distinguer restent **sous 0,55**. Repères mesurés sur le catalogue synthétisé :

| Paire | Ressemblance |
|---|---:|
| `shotgun` / `crowbar_swing` | −0,024 |
| `shotgun` / `impact_metal` | 0,200 |
| `shotgun` / `crowbar_metal` | 0,433 |
| *(pour mémoire)* pompe / pistolet, échantillons rejetés | **0,976** |

`analyze_sfx.py --mask a.wav b.wav` fait l'autre contrôle, celui de
lisibilité : la télégraphie d'attaque d'un Costard ne doit pas être masquée
par le tir du joueur. C'est une contrainte de gameplay, pas de goût — c'est le
canal qui dit au joueur qu'on lui tire dessus hors champ.

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
rendent en plus 3 à 4 **variantes de seed** — le bruit change, la structure
reste — ce qui casse la répétition bien mieux qu'un repitch.

## Piège navigateur : déblocage du contexte audio

Le contexte audio reste suspendu tant qu'aucune interaction utilisateur n'a
eu lieu. Howler gère ça lui-même via `Howler.autoUnlock` (`true` par
défaut), qui écoute les premiers `click`/`touchend`/`keydown` du
`document` — exactement l'événement `click` sur le canvas qui déclenche
déjà `requestPointerLock` dans `core/input.ts`. Aucun code de déblocage
supplémentaire n'est nécessaire.

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
