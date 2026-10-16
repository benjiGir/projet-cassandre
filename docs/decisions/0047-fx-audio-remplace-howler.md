---
title: fx-audio remplace Howler
tags: [adr, audio]
status: accepte
updated: 2026-10-16
---

# ADR 0047 — fx-audio remplace Howler

## Statut

Accepté.

## Contexte

Howler lisait tous les sons du jeu (sprite des effets, voix, nappes de zone,
boucles d'eau). Il fallait le contourner à plusieurs endroits : amorcer son
pool avec des lectures muettes, retenir les volumes tant que le contexte
attendait un geste (sinon la file débordait à la reprise), désactiver son
auto-suspension, attendre ses événements `load`/`loaderror` à la main.

[fx-audio](https://github.com/benjiGir/fx-audio) est une bibliothèque du même
auteur, bâtie sur Effect, qui vise à remplacer Howler : sons décodés séparés
des voix, sprites, groupes, panoramique, reprise du contexte automatique.

## Décision

- Tout le runtime audio passe par la façade promise `fx-audio/promise`, via un
  moteur unique créé à la demande (`core/audio/audioEngine.ts`). La
  présentation reste hors du pas fixe ; la frontière Effect synchrone
  (invariant #11) ne concerne pas ce moteur, qui a son propre runtime.
- Le format des manifestes de sprite ne change pas : `{ src, sprite }`, en
  millisecondes. `pool` n'est plus lu.
- fx-audio charge une seule URL : `loadFirstSound` essaie `.ogg` puis `.m4a`.
- Le gain général et la coupure globale sont ceux du master ; le gain voix est
  un groupe. Les réglages sont retenus tant que le moteur n'existe pas.
- fx-audio n'est pas sur npm : il s'installe depuis l'archive d'une release
  GitHub (`package.json` porte l'URL).
- `effect` passe de `4.0.0-rc.112` à `4.0.5` (pair exigé : `^4.0.4`), avec
  `@effect/vitest`. Conséquence : `onExcessProperty: "preserve"` n'existe plus,
  les décodeurs de manifestes et d'enregistrements écartent les champs inconnus.

## Conséquences

- Disparaissent : le pool, l'amorçage muet, l'auto-suspension, l'installation
  manuelle de la reprise du contexte, l'attente d'événements `load`.
- Un volume négatif ou non fini lève une erreur chez fx-audio, là où Howler le
  bornait : `clampVolume` protège les appelants.
- Les `Howl` n'ont plus d'équivalent de `playing(id)` : une voix terminée
  ignore simplement ses réglages.
- Non vérifié à l'oreille ni sur Safari/Firefox : seuls le décodage, les
  offsets de sprite et l'état du contexte ont été contrôlés (Chromium).
