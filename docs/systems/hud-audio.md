---
title: HUD et audio
tags: [systeme, audio]
status: stable
updated: 2026-09-06
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
boucle de l'autre) n'ont rien en commun. Treize des vingt SFX sont
maintenant de vrais enregistrements CC0 et un est fabriqué avec sa recette
(voir plus bas) ; les six qui restent, et la musique, sont encore des
placeholders synthétiques sans recette.

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

Depuis le 2026-09-20, treize des vingt `SfxId` viennent de packs CC0, pas
d'une synthèse : les tirs du pompe et du pistolet sont de VRAIES armes (un
Winchester Model 12 et un Colt 1911, « The Free Firearm Sound Library »), le
reste vient des packs audio de Kenney. Chaque pack a sa ligne au registre
(`assets_src/LICENCES_ASSETS.md`), et la recette — quelle prise devient quel
son, et comment elle est traitée — est dans `tools/audio/import_sfx.py`.

Chaîne de traitement, la même pour tous : passage à un canal, recalage sur
l'attaque (les prises d'armes commencent par des secondes de silence), coupe
courte avec fondu, normalisation, **44 100 Hz** avec filtre anti-repliement.
Les vingt sons pèsent ensemble moins de 400 Ko.

**Six sons restent synthétiques**, faute d'équivalent CC0 : les quatre
vocalisations de Costard (`enemy_alert`, `enemy_telegraph`, `enemy_hurt`,
`enemy_death` — aucun pack CC0 n'a de grognements) et les deux portes
mécaniques du niveau v2 (`door_slide`, `door_shutter` — ni porte automatique
ni rideau métallique dans ces packs). Ceux-là sont une **dette** : ils ont été
produits par des scripts jetables jamais versionnés, donc personne ne peut les
refaire ni savoir comment ils ont été obtenus.

**Un son est FABRIQUÉ, avec sa recette** : `melee_fire`, par
`tools/audio/synth_sfx.py`. Le pied-de-biche sortait jusqu'au 2026-09-20 de
`knifeSlice2.ogg` — et ça s'entendait : « le pied de biche sonne comme un coup
de couteau ». C'était littéralement le cas. Aucun pack du projet n'a de son de
BALANCEMENT, et une lame qui fend l'air n'est pas une barre d'acier qui la
brasse : plus grave, plus lente, et assez de masse pour qu'on la sente. Un
`Souffle` est du bruit dont la COULEUR bouge — un passe-bande à variable d'état
dont le centre monte jusqu'au passage devant l'oreille puis redescend ; un
filtre fixe donnerait un « chhh » de vieille radio, pas un mouvement. Médiane
spectrale : **5823 Hz (la lame) → 885 Hz (la barre)**.

`synth_sfx.py` est l'endroit où la dette des six autres se remboursera, un son
à la fois. Chaque son y porte sa graine : régénérer redonne exactement le même
fichier, sinon comparer deux versions n'aurait plus de sens.

**Comment on choisit, puisqu'un agent n'entend pas** :
`tools/audio/audition.py` écrit une page locale — `http://localhost:5173/audition/`
— qui pose côte à côte, pour chaque son, les versions déjà écoutées, celle qui
est installée, des variantes de TRAITEMENT sur la même prise et des variantes
de PRISE. Toutes passent par la même chaîne et le même encodeur : comparer
deux réglages d'encodage reviendrait à juger l'encodeur en croyant juger le
son. Le choix se note ensuite dans la table d'`import_sfx.py`, qui reste la
source de vérité.

Garder les versions précédentes n'est pas de la coquetterie : sans elles, une
écoute dit si un son plaît, jamais si on a progressé depuis la dernière.

Un fichier absent (404, cas normal en l'absence d'asset final) ne fait
jamais planter le jeu : `onloaderror` log un seul `console.warn` par id
(jamais un par tentative de lecture) et le son ne joue simplement pas.

## Pourquoi cette chaîne

La première version de cette chaîne, le matin du 2026-09-20, a été rejetée à
l'écoute : « c'est trop bizarre le son des armes, je n'aime pas du tout ». La
réponse est ici parce que les trois causes se mesurent, et qu'aucune n'était
une question de goût.

### La somme stéréo creusait le son

La bibliothèque d'armes est enregistrée dehors, au couple de micros ESPACÉ :
la même onde arrive sur les deux capsules à 0,89 ms d'intervalle (30 cm
d'écart), et la corrélation entre canaux est quasi nulle — **−0,03** sur le
Model 12. Les additionner, ce qui semble la façon évidente de passer en mono,
fait interférer le son avec sa propre copie retardée. C'est un filtre en
peigne, et il tombait exactement là où vit un coup de feu :

| Bande | Ce que la somme mono retirait |
|---|---|
| 60–200 Hz | **−5,4 dB** (pompe) · **−6,3 dB** (pistolet) |
| 200–600 Hz | −1,4 dB · −6,2 dB |
| 600–1500 Hz | −4,1 dB · −1,3 dB |

`un_canal()` mesure donc la corrélation avant de décider : il somme si les
canaux se ressemblent, sinon il en garde UN — celui qui porte le plus
d'énergie sur les 50 ms qui suivent l'attaque.

### Le rééchantillonnage n'avait pas de filtre

La sortie était à 22 050 Hz, « le grain de l'époque Build ». La conversion se
faisait par interpolation linéaire, sans filtre anti-repliement : tout ce qui
dépassait 11 kHz ne disparaissait pas, il se repliait vers le bas à une
fréquence fausse. Mesuré : **+2,8 dB de trop dans la bande 9–11 kHz** d'un
coup de pompe. On perdait le claquement du coup, et on le remplaçait par du
grésillement au même endroit.

Corrigé deux fois : sortie à 44 100 Hz, et `passe_bas()` (sinus cardinal
fenêtré) avant toute décimation. Un son d'arme n'est pas le bon endroit pour
économiser 150 Ko.

### Les prises n'ont aucun grave, et elles saturent

C'est la cause principale, et elle n'est pas dans le code. Mesuré sur les
quatre armes de la bibliothèque, sur les 500 ms qui suivent la détonation :

| Arme | < 60 Hz | 60–200 Hz | 200–600 Hz | **600–1500 Hz** |
|---|---:|---:|---:|---:|
| Winchester Model 12 | 0,0 % | 0,1 % | 14,8 % | **59,2 %** |
| Colt 1911 | 0,0 % | 0,0 % | 16,3 % | **66,0 %** |
| Benelli Nova | 0,1 % | 0,1 % | 12,3 % | **60,7 %** |
| Mossberg | 0,0 % | 0,1 % | 13,3 % | **57,3 %** |

Un coup de feu dont toute l'énergie tient entre 600 et 1500 Hz n'est pas un
coup de feu : c'est un claquement de pétard. Ces prises sont faites en
extérieur, avec le coupe-bas qu'impose le vent, et **chaque fichier de la
bibliothèque sature** — 2 à 5 ms d'échantillons collés à la pleine échelle sur
la détonation, le préampli à bout de souffle.

Ça ne se rattrape pas par traitement : ce qui manque n'est pas dans le
fichier. On le reconstruit, comme le fait n'importe quel jeu — la prise garde
l'aigu, la texture et la mécanique de l'arme, une sinusoïde qui plonge lui
rend le coup de poing, un bruit filtré lui rend le ventre (`Grave`, tirage à
graine fixe pour rester reproductible). Résultat, part de l'énergie entre 60
et 200 Hz : **0,1 % → 26,9 %** pour le pompe, **0,0 % → 17,1 %** pour le
pistolet, sans toucher au facteur de crête (23,5 dB avant comme après — la
transitoire est intacte, on a ajouté sous elle, pas devant).

Le plongeon s'arrête à 80 Hz, pas plus bas : sous 60 Hz un petit haut-parleur
ne restitue rien, et l'énergie qu'on y met est perdue pour tout le monde sauf
pour le casque, où elle devient de la boue.

## Pooling et variation de pitch

Pattern du skill `audio-sfx-pipeline` : N instances de `Howl` par id
(`POOL_SIZE = 8`), rotation circulaire, variation de rate ±8 %
(`PITCH_VARIATION`) à chaque lecture.

**Sauf sur les armes**, depuis le 2026-09-20 : `SfxDef.pitch` baisse cette
variation à ±2,5 % pour le pompe et le pistolet, ±4 % pour le pied-de-biche.
Le défaut a été réglé pour des sons de synthèse, où il passe inaperçu ; ±8 %
sur un vrai enregistrement font presque un ton et demi, et l'arme du joueur
semble changer de calibre d'un tir à l'autre. Ce n'est pas de la variété,
c'est ce que l'oreille lit comme un faux.

Ça évite deux problèmes :

- l'effet « mitraillette de samples identiques » sur un son répété (tir,
  impact) ;
- `Howl.rate(rate)` sans id de son cible modifie la vitesse de TOUTES les
  instances en cours de lecture de ce `Howl` — en tirant au pompe (9
  plombs, jusqu'à 9 `hitEvent` dans le même pas fixe), appeler `rate()` sur
  le même objet `Howl` pour le plomb n+1 changerait rétroactivement le
  pitch du plomb n déjà en train de jouer. Un pool évite ce chevauchement.

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
