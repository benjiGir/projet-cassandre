---
title: Invariants
tags: [architecture]
status: stable
updated: 2026-10-08
---

# Invariants

## Rôle

Onze règles actives (numérotées #1 à #14, trois retirées — voir
« Invariants retirés » en bas de page) tiennent la simulation déterministe,
rétro et lisible : une proposition qui en viole une se **refuse avec
explication**, on n'y déroge jamais discrètement. Un 14e point renvoie aux
règles React.

## Récapitulatif

| # | Règle en 6 mots | Gardé par un test |
|---|---|---|
| 1 | Pas fixe 1/60, delta clampé 0,25 s | Oui |
| 2 | React ne touche jamais la boucle | Non |
| 3 | Rotation caméra jamais interpolée | Non |
| 4 | 640×360, `NearestFilter` à l'agrandissement | Non |
| 5 | *Retiré 2026-09-28* — exclusivité `MeshLambertMaterial` | — |
| 6 | Déplacement = KCC de Rapier, jamais maison | Non |
| 7 | Gravité −25 m/s² | Non |
| 8 | Pas d'ECS avant 12 types d'ennemis | Non |
| 9 | *Retiré 2026-09-25* — Boîtes blanches jusqu'à la Phase 5 | — |
| 10 | Aucune animation ne bloque le joueur | Oui |
| 11 | Frontière Effect synchrone stricte | Oui |
| 12 | RNG déterministe uniquement | Oui |
| 13 | *Retiré 2026-09-25* — XState sans temps mural | — |
| 14 | Conventions React non négociables | Non (revue de code) |

## Invariants

### #1 — Pas fixe 1/60, delta clampé à 0,25 s

Gameplay et physique n'avancent que par pas de 1/60 s ; le temps réel écoulé
entre deux frames est clampé à 0,25 s avant l'accumulateur.

- **Pourquoi / casse si violé** : sinon deux machines jouent deux parties
  différentes et le framerate change la physique elle-même ; sans clamp, un
  onglet revenu au premier plan rattrape des minutes d'un coup (« spirale »).
- **Code** : `FIXED_DT`/`MAX_FRAME`, `src/core/loop/loop.ts` (`startLoop`). **Test** :
  `test/core/loop/loop.test.ts` (clamp à quinze pas fixes = 0,25 s). **Décision** :
  [ADR 0002](../decisions/0002-fixed-timestep.md).

### #2 — React ne touche jamais la boucle

Aucun `setState` par frame. Le HUD s'abonne à un store zustand, écrit à un
débit throttlé de 10 Hz maximum.

- **Pourquoi / casse si violé** : React replanifie son arbre à chaque mise à
  jour ; à 60 Hz en concurrence avec le rendu, ça ferait chuter le framerate
  du jeu pour un gain d'affichage invisible.
- **Code** : `src/game/hud/state.ts` (écriture throttlée) ; lu par `src/ui/hud/`.
  **Test** : aucun ne mesure la fréquence d'écriture ni l'absence de
  `setState` par frame. **Décision** : [ADR 0003](../decisions/0003-react-hors-boucle.md).

### #3 — La rotation caméra n'est pas interpolée

La position de la caméra est interpolée entre deux pas fixes ; sa rotation
est lue directement au taux d'affichage.

- **Pourquoi / casse si violé** : interpoler la position lisse un mouvement
  sans coût perçu, mais interpoler la visée ajoute un retard geste-écran —
  visée « pâteuse », tirs ratés, le pire défaut pour un FPS.
- **Code** : `src/game/loop/interpolateVisuals.ts` (rotation capturée par
  `updateDisplayInput`, appliquée telle quelle). **Test** : aucun ;
  `updateDisplayInput.test.ts` vérifie l'ordre de capture, pas l'absence
  d'interpolation. **Décision** : aucun ADR, règle dans `CLAUDE.md` (#3).

### #4 — 640×360, `NearestFilter` à l'agrandissement

Résolution interne 640×360 upscalée. `NearestFilter` à l'AGRANDISSEMENT non
négociable ; la RÉDUCTION utilise mipmaps + anisotropie.

- **Pourquoi / casse si violé** : le gros pixel de près est le look
  recherché ; le même filtrage au loin échantillonne un texel presque au
  hasard — crénelage et scintillement, pas du cachet rétro.
- **Amendement en cours (ADR 0027, `propose`)** : l'invariant écrit
  interdisait mipmaps/anisotropie sans distinguer les deux cas ; l'ADR
  propose l'amendement ci-dessus, en attente. Le code n'attend pas ce
  verdict : `renderer.ts` a trois modes, et le défaut est déjà `"aniso"`.
  Historique via `cassandre.filtrage("nearest")` ou le menu Affichage.
- **Code** : `INTERNAL_WIDTH`/`HEIGHT`, `configureRetroTexture` (`renderer.ts`).
  **Test** : aucun. **Décision** : [ADR 0027](../decisions/0027-filtrage-des-textures-reduites.md)
  (amendement proposé, en attente).

### #6 — Déplacement = `KinematicCharacterController` de Rapier

Le contrôleur de personnage (joueur, ennemis) est exclusivement celui de
Rapier. Jamais d'implémentation maison capsule-contre-monde.

- **Pourquoi / casse si violé** : un contrôleur correct (pentes, marches,
  glissement) est déjà résolu par Rapier ; le refaire rouvrirait des bugs
  déjà réglés une fois sur ce contrôleur partagé.
- **Code** : `controller.ts`, `physics/world.ts`, réutilisé par `suit.ts`/
  `director.ts`. **Test** : aucun (`suit.test.ts` utilise un vrai KCC comme
  outillage, pas garde-fou). **Décision** : pas d'ADR initial ; les garde-fous
  du contrôleur sont dans [ADR 0016](../decisions/0016-garde-fous-degenerescence-kcc.md).
  Le contrôle aérien relève de [ADR 0006](../decisions/0006-air-strafing.md),
  toujours `propose`.

### #7 — Gravité −25 m/s²

La gravité du monde physique vaut −25 m/s², pas la valeur terrestre réelle.

- **Pourquoi / casse si violé** : un FPS arcade veut un saut vif ; une
  gravité réaliste donne un arc mou, à rebours de Quake/Duke 3D — perte de la
  sensation de vitesse.
- **Code** : `src/physics/world.ts` (`gravity.y = -25`), lu via
  `physics.gravityY` par `controller.ts`/`moveConfig.ts::jumpVelocity`. **Test** :
  aucun n'assert la valeur `-25`. **Décision** : aucun ADR, valeur dans
  `CLAUDE.md` (#7).

### #8 — Pas d'ECS avant 12 types d'ennemis

Architecture en `Entity[]` + `update(dt)` + `switch`, sans ECS, tant qu'il n'y
a pas au moins 12 types d'ennemis.

- **Pourquoi / casse si violé** : un ECS résout un problème de composition à
  grande échelle qui n'existe pas encore avec un ennemi et un boss — sinon
  sur-ingénierie non rentabilisée, rien ne casse fonctionnellement.
- **Code** : `entity.ts` (interface squelettique) ; Costard et Directeur
  partagent une seule machine à états (`enemyMachine.ts`). **Test** : aucun.
  **Décision** : aucun ADR, règle dans `CLAUDE.md` (#8).

### #10 — Aucune animation ne bloque le joueur

Aucune animation (arme, changement d'arme, rechargement) ne retarde ni
n'empêche une action du joueur.

- **Pourquoi / casse si violé** : un boomer shooter fait l'inverse du
  réalisme moderne — la réactivité prime, sinon le contrôle se ressent mou.
- **Code** : `src/game/player/weapons/weapons.ts` (invariant cité en commentaire) ;
  `updateGameplay.ts` (hors de l'état `playing` de la machine de flux, le joueur
  n'avance plus ; la boucle continue, voir [Joueur](../4-technique/joueur.md)).
  **Test** : `test/render/viewmodel/viewmodel.test.ts` (« tirer pendant le changement
  d'arme remet l'arme en place aussitôt, invariant #10 »). **Décision** :
  aucun ADR, `CLAUDE.md` (#10).

### #11 — Frontière Effect synchrone stricte

Pas fixe et rendu/interpolation passent exclusivement par `runGameplaySync` :
zéro `Effect.tryPromise`/`promise`/`async`/`sleep`. Chargement de niveau et
hot-reload restent à la frontière asynchrone.

- **Pourquoi / casse si violé** : le pas fixe doit produire un résultat dans
  le même tick pour rester rejouable (F9/F10) ; le garde-fou lève un defect
  bruyant plutôt que de laisser passer une suspension en silence.
- **Code** : `runGameplaySync`, `src/app/runtime/gameRuntime.ts`, appelé depuis
  `stepPhysics.ts`, `interpolateVisuals.ts`, `updateFx.ts`, `updateGameplay.ts`.
  **Test** : `test/app/runtime/gameRuntime.test.ts` (suspension = erreur explicite).
  **Décision** : aucun ADR numéroté, skill `effect-xstate-cassandre`,
  `CLAUDE.md` (#11).

### #12 — RNG déterministe uniquement

Jamais `Math.random()`, jamais le service `Random` d'Effect. Seule source :
`DeterministicRandom` (enveloppe `mulberry32`).

- **Pourquoi / casse si violé** : le rejeu d'input (F9/F10) doit reproduire
  une partie à l'identique ; un seul appel non graine fait diverger deux
  exécutions en silence, sans erreur visible.
- **Code** : `src/core/effect/random.ts`, consommé via
  `runGameplaySync(DeterministicRandom.useSync(...))` dans `enemyMachine.ts`,
  `weapons.ts`, `props.ts` et `lifecycle.ts`. **Test** :
  `random.test.ts` (valeurs de référence indépendantes) ; `suit.test.ts`/
  `director.test.ts` via graines déterministes. **Décision** :
  [ADR 0007](../decisions/0007-rng-deterministe.md), complété par
  [ADR 0033](../decisions/0033-rng-presentation-et-portee-du-rejeu.md).

### #14 — Conventions React non négociables

Un dossier par composant, jamais de style inline hors utilitaire dédié, des
primitives composées par `children`, chaque widget du HUD lit ses propres
données du store. Un module qui persiste ou pilote le moteur ne vit pas dans
`src/ui/`.

- **Pourquoi / casse si violé** : adoptées après un verdict direct de
  l'utilisateur sur l'état du code React existant — le niveau attendu, pas
  une préférence de style ; régression de maintenabilité déjà constatée.
- **Code** : `src/ui/` ; détail dans les quatre pages
  `docs/6-reference/react-*.md`. **Test** : aucun — revue de code. **Décision** :
  pas d'ADR, `CLAUDE.md` (« Conventions React », 2026-09-23).

## Invariants retirés

### #5 — Exclusivité `MeshLambertMaterial` (retirée le 2026-09-28)

À la demande de l'utilisateur, le jeu peut mélanger ses matériaux classiques
avec des matériaux TSL ciblés. `WebGLNodesHandler` les rend sur le
`WebGLRenderer` existant ; les niveaux glTF gardent leur conversion Lambert
par défaut. Le premier usage est le jet d'eau, animé depuis le pas fixe.
L'intégration est consignée dans [ADR 0035](../decisions/0035-materiaux-tsl-cibles.md).

### #9 — Boîtes blanches jusqu'à la Phase 5 (retiré le 2026-09-25)

Ancienne règle : pas d'assets finaux avant que le gameplay soit validé.
**Retiré** parce que dépassé — N9 a habillé les dix espaces du niveau
(`HABILLAGE` dans `tools/level_v2/build_niveau.py`), `CLAUDE.md` note « Plus
un seul volume gris ». La règle ne décrivait plus une contrainte active, elle
était dépassée plutôt que violée en silence ; le retrait est maintenant
explicite.

### #13 — XState sans temps mural (retiré le 2026-09-25)

Ancienne règle : interdiction des transitions `after`, toute durée d'état
devait vivre dans `context.stateTimer`, avancée une fois par pas fixe par
`tickEnemy(actor, dt, …)` avec le vrai `gameplayDt` (hitstop inclus).
**Retiré par décision utilisateur** le 2026-09-25 — ce n'est plus une règle
non négociable. Le mécanisme `stateTimer`/`tickEnemy` reste néanmoins le
choix actuel du code (`enemyMachine.ts`) : aucune logique n'a changé, seul le
statut de règle a disparu.

## Proposer de changer un invariant

On écrit un ADR, on ne contourne pas. Voir `docs/5-guides/ecrire-un-adr.md`.
