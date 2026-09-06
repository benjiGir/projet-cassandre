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
boucle de l'autre) n'ont rien en commun. Tous les assets sonores actuels
sont des placeholders synthétiques générés par script, pas des
enregistrements — même statut que les meshes non texturés (invariant #9).

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

## Assets sonores : boîtes blanches

Chaque `SfxId` a un placeholder SYNTHÉTIQUE (bruit/sinus généré par script,
aucun enregistrement ni source externe) sous
`public/assets/audio/sfx/<file>.{ogg,m4a}` — 9 sons ajoutés le 2026-08-20
pour juger le feedback de hit avec du son plutôt qu'en silence,
`door_locked`/`door_unlock`/`secret_found` ajoutés le 2026-08-23. Même
statut que les meshes non texturés (invariant #9) : à remplacer par de vrais
assets à la Phase 5, pas des choix de sound design arrêtés.

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
