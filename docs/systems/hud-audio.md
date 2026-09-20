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
boucle de l'autre) n'ont rien en commun. Quatorze des vingt SFX sont
maintenant de vrais enregistrements CC0 (voir plus bas) ; les six qui
restent, et la musique, sont encore des placeholders synthétiques.

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

Depuis le 2026-09-20, quatorze des vingt `SfxId` viennent de packs CC0, pas
d'une synthèse : les tirs du pompe et du pistolet sont de VRAIES armes (un
Winchester Model 12 et un Colt 1911, « The Free Firearm Sound Library »), le
reste vient des packs audio de Kenney. Chaque pack a sa ligne au registre
(`assets_src/LICENCES_ASSETS.md`), et la recette — quelle prise devient quel
son, et comment elle est traitée — est dans `tools/audio/import_sfx.py`.

Chaîne de traitement, la même pour tous : mono, recalage sur l'attaque (les
prises d'armes commencent par des secondes de silence), coupe courte avec
fondu, normalisation, **22 050 Hz** — le grain de l'époque Build, et la
moitié du poids. Les vingt sons pèsent ensemble moins de 300 Ko.

**Six sons restent synthétiques**, faute d'équivalent CC0 : les quatre
vocalisations de Costard (`enemy_alert`, `enemy_telegraph`, `enemy_hurt`,
`enemy_death` — aucun pack CC0 n'a de grognements) et les deux portes
mécaniques du niveau v2 (`door_slide`, `door_shutter` — ni porte automatique
ni rideau métallique dans ces packs).

**Comment on choisit, puisqu'un agent n'entend pas** :
`tools/audio/audition.py` écrit une page locale qui pose côte à côte, pour
chaque son, l'ancien placeholder, celui qui est installé et des variantes,
toutes passées par la même chaîne — `http://localhost:5173/audition/`. Le
choix se note ensuite dans la table d'`import_sfx.py`, qui reste la source
de vérité.

Un fichier absent (404, cas normal en l'absence d'asset final) ne fait
jamais planter le jeu : `onloaderror` log un seul `console.warn` par id
(jamais un par tentative de lecture) et le son ne joue simplement pas.

## Pooling et variation de pitch

Pattern du skill `audio-sfx-pipeline` : N instances de `Howl` par id
(`POOL_SIZE = 8`), rotation circulaire, variation de rate ±8 %
(`PITCH_VARIATION`) à chaque lecture.

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
