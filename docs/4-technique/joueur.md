---
title: Joueur
tags: [technique]
status: stable
updated: 2026-09-26
---

# Joueur

## Responsabilité

Fait : déplace le joueur contre le décor via le `KinematicCharacterController`
de Rapier (invariant #6), dérive de ce mouvement les grandeurs de vue (head
bob, FOV dynamique, enfoncement de réception), porte les PV et la mort, et
tient l'inventaire des cartes de fidélité. Seule source de vérité sur la
position/vitesse du joueur : tout le reste du pas fixe (tir, ennemis,
interactifs) la lit après coup, jamais avant.

Ne fait pas : ne résout aucune collision lui-même (géométrie et groupes de
collision : [Physique](physique.md)) ; ne dessine rien (caméra et viewmodel
posés par `interpolateVisuals`, au taux d'affichage) ; ne décide pas des
dégâts qu'il reçoit (ennemis et `game/level/*` produisent des `HitEvent`/
soins, `feedback.ts::applyPlayerDamage` les applique) ; ne connaît aucune
arme (D28).

## Fichiers

- `src/game/player/controller.ts` — `PlayerController` : fabrique et pilote
  le KCC, intègre vitesse/gravité/saut, calcule les grandeurs de vue.
- `src/game/player/moveConfig.ts` — `MoveConfig`, `moveConfig` (source unique
  de vérité du déplacement), `FEEL_VARIANTS`, fonctions dérivées.
- `src/game/player/loyaltyCards.ts` — `LOYALTY_CARDS`, `parseLoyaltyCard` ;
  inventaire réel dans `src/game/session/cards.ts` (`grantCard`,
  `syncCardsToStore`).
- `src/game/session/feedback.ts` — `applyPlayerDamage` (PV et mort, pas
  fixe), `presentPlayerDamage` (publication au store, taux d'affichage).
- `src/game/session/fallRescue.ts` — `recordSafeGround`, `shouldRescue`,
  `RESCUE_FALL_DEPTH` : le filet de chute.
- `src/game/loop/updateGameplay.ts` — appelle `session.player.update`, lit
  `weaponEyeOrigin` après coup, applique le filet de chute.
- `src/game/loop/interpolateVisuals.ts` / `stepPhysics.ts` — posent la
  caméra (position, FOV, head bob) et le `snapshotPrevious` du joueur.

## Où ça s'insère dans la boucle

Ordre complet : [Boucle et temps](../3-architecture/boucle-et-temps.md).
Pour le joueur, dans le même pas fixe :

1. `snapshotPrevious` copie `position`/`distanceTravelled`/les enveloppes de
   vue courantes dans leurs pendants `previous*` — matière première de
   l'interpolation.
2. `session.player.update(gameplayDt, activeFrame)` intègre vitesse et
   gravité, résout le mouvement par `computeColliderMovement`, met à jour
   les grandeurs de vue (`updateViewState`).
3. `updateGameplay` applique le filet de chute juste après, puis reconstruit
   `weaponEyeOrigin` depuis `session.player.position` — après `player.update`,
   jamais une position interpolée : le rejeu d'input (F9/F10) doit tenir
   indépendamment du framerate d'affichage à l'enregistrement.
4. `stepPhysics` avance le monde Rapier (translation déjà posée via
   `setNextKinematicTranslation`) ; puis, au taux d'affichage,
   `interpolateVisuals` lit `player.eyePosition(alpha)`, `viewBob(alpha)` et
   `runFactorAt(alpha)` pour caméra/bob/FOV — jamais la rotation, capturée
   plus tôt dans l'image par `updateDisplayInput` (invariant #3).

Si `!engine.flow.isPlaying()` (mort, fin de niveau, menu), `updateGameplay`
retourne avant d'appeler `player.update` : le pas fixe continue de tourner
(invariant #1), le joueur reste simplement figé.

## Données et contrats

**`MoveConfig`** (`moveConfig.ts`) est l'objet mutable unique qui porte
chaque valeur de déplacement — aucun nombre de gameplay ailleurs. Détail
chiffré : `6-reference/valeurs-deplacement.md`. Ce qui compte pour lire le
code : les grandeurs qu'on croirait codées en dur sont **dérivées par
formule** à chaque pas (`jumpVelocity` = √(2·|g|·`jumpHeight`),
`groundAcceleration`/`groundDeceleration` = vitesse cible ÷ temps visé,
`wallNormalYThreshold` = cos(`maxSlopeClimbAngleDeg`)), ce qui permet un A/B
à chaud sans recalcul manuel. La gravité n'y est **pas** : elle appartient au
monde physique (`PhysicsWorld.gravityY`, −25 m/s², invariant #7), pour ne pas
désynchroniser la chute du joueur de celle des `prop_*`.
`PlayerController.applyConfig()` réapplique la config au collider/KCC après
une mutation à chaud — nécessaire pour les champs lus par Rapier (capsule,
autostep, snap), pas pour vitesses/accélération/saut, relus chaque pas.

**Direction voulue : yaw seul.** `update(dt, frame)` dérive `wishX`/`wishZ`
du seul `frame.yaw` (le pitch est exclu — regarder le sol ne ralentit pas la
marche). Accélération bornée par le budget du pas au sol, multipliée par
`airControl` (0.35) en l'air : une accélération scalée, pas le modèle Quake
de projection de vélocité sur `wishDir` — [ADR 0006](../decisions/0006-air-strafing.md)
reste **`propose`, non tranché** ; le bunny hop façon Quake n'est pas garanti.

**Vertical.** `velocity.y` intègre `gravityY * dt` chaque pas. Au sol, une
poussée descendante constante (`groundStickSpeed`) stabilise
`computedGrounded()` (piège mesuré ci-dessous). Le saut combine `coyoteTime`
et `jumpBufferTime`, tous deux à 0 par défaut (mécanique brute, exposés pour
`feel-tuner`) ; le snap-to-ground se désactive tant que `velocity.y > 0`,
sinon il recollerait au sol un saut naissant. Un seul passage sur les
collisions du pas trouve ensuite la normale du sol (la plus « vers le haut »,
si `grounded`) et détecte un MUR (`wallNormalYThreshold(cfg)`) : la vitesse
horizontale n'est reclippée sur le mouvement réel que si un vrai mur a été
touché — jamais sur un simple contact de sol/pente, raison mesurée en Pièges.

**Vue : trois grandeurs lissées par `approach()`** (rampe **linéaire**, pas
exponentielle — [ADR 0015](../decisions/0015-rampe-lineaire-lissage-vue.md)) :
`range` unités en `responseTime` secondes, cible atteinte exactement, à un
pas connu d'avance. `weapons.ts` réutilise la même fonction pour le recul du
viewmodel, jamais dupliquée.

- `bobIntensityTarget` : nul en l'air, croît de `bobSpeedFloor` à `runSpeed`
  au sol ; la phase vient de `distanceTravelled` interpolé, pas du temps —
  elle se fige net à l'arrêt.
- `fovRunFactorTarget` suit la vitesse horizontale réelle, déjà reclippée :
  courir contre un mur n'élargit pas le FOV.
- `landingDipFor` est linéaire depuis 0 selon la vitesse d'impact, mesurée
  uniquement à la transition air → sol (jamais à chaque pas au sol, où
  `groundStickSpeed` produirait un impact fantôme en continu).
- À l'arrêt complet, `viewBob(alpha, out)` renvoie exactement `(0, 0, 0)` —
  immobilité pixel-exacte pour une capture déterministe.
- Aucune de ces grandeurs n'est angulaire : elles s'ajoutent à la position
  de la caméra, jamais à sa rotation (invariant #3). `eyePosition(alpha)`
  reste disponible non bobée, pour servir d'origine de tir.

Trois variantes (`FEEL_VARIANTS.A/B/C`, sobre/classique/charnu) via
`cassandre.applyFeelVariant("A"|"B"|"C")` — aucune ne touche au déplacement.

**PV, dégâts et mort.** Les dégâts sont appliqués **au pas fixe** :
`applyPlayerDamage(engine, session, amount)` décrémente `session.playerHp`,
enregistre la perte au score, déclenche au premier franchissement du seuil
la réplique « PV bas » (30 % des PV max), et sur la mort (`playerHp <= 0`,
gardée idempotente par `session.deathHandled`) publie le récapitulatif
partiel puis appelle `engine.flow.playerDied()` — via `GameFlowPort`, jamais
un accès direct à XState. Appelants actuels : `suitManager`/
`directorManager`, qui posent un `HitEvent`. Le soin (sanitaire cassé,
trousse) suit le chemin inverse : incrémente `playerHp` directement, plafonné
à `playerMaxHp`. `presentPlayerDamage(playerHp)` publie seulement la valeur
au store zustand pour le HUD, au taux d'affichage. Il n'existe pas de champ
`isDead` : la mort est portée par le flux d'écran
(`GameFlowPort.isPlaying()`) ; quand il dit non, `updateGameplay` retourne
avant même d'appeler `player.update` — le pas fixe continue (invariant #1).

**Filet de chute.** `recordSafeGround`/`shouldRescue` mémorisent le dernier
sol réellement touché et remettent le joueur debout si la chute sous ce sol
dépasse `RESCUE_FALL_DEPTH` (12 m, au-delà des 6 m du plus grand décrochement
voulu). `recordSafeGround` exige `isGrounded && numCollisions > 0` : sans
cette garde, un joueur téléporté (spawn, rejeu, console) se déclarant au sol
dans le vide en ferait son « dernier sol sûr », et le filet y renverrait en
boucle. Garde-fou, pas une mécanique : logge les coordonnées en console à
chaque déclenchement, signal pour `tools/level_v2/audit_niveau.py`.

**Cartes de fidélité.** `session.cards` (`Set<LoyaltyCard>`) est la source de
vérité, jamais le store zustand ([ADR 0020](../decisions/0020-state-feuille-de-dependances.md)) ;
`grantCard(session, card)` ignore silencieusement un doublon (hot reload) et
pousse un message HUD, `parseLoyaltyCard` tolère casse/espaces d'une
propriété Blender mais reste strict sinon (valeur inconnue → `null`).

## Pièges

**Le reclip de vitesse ne doit filtrer QUE les vrais murs.** Rapier compte
un contact de sol/pente/marche comme une collision au même titre qu'un mur.
Reclipper sur cette seule condition pénalisait sol/pentes/marches à chaque
pas — la sensation de « quelque chose qui bloque » signalée après la Phase 1.
[ADR 0016](../decisions/0016-garde-fous-degenerescence-kcc.md).

**`groundStickSpeed` haut dégénère `computeColliderMovement` en ligne
droite, pas en diagonale.** À l'ancienne valeur (2 m/s), une vitesse axée-axe
(yaw aligné) combinée au creep vertical constant faisait ressortir
`computedMovement` mesurablement plus court que voulu, `isGrounded` restant
vrai — 35,1 % des pas affectés dans le hub. Une diagonale ne montrait presque
rien : c'est l'alignement d'axe, pas la géométrie du niveau (une hypothèse de
coutures de géométrie a été mesurée et infirmée). Plafonné à 0.2 m/s
(2,1-2,4 % affectés) : ne pas remonter sans remesurer au même harnais Rapier
headless — le slider `feel-tuner` est resserré à `[0, 0.6]` pour ça.
[ADR 0016](../decisions/0016-garde-fous-degenerescence-kcc.md).

**Une rampe exponentielle ne garantit jamais zéro exact.** Une version
antérieure du lissage de vue mettait 1,78 s à éteindre le bob et 2,18 s
l'enfoncement de réception après un arrêt net — deux captures déterministes
ne rendaient donc pas le même pixel selon les pas fixes écoulés. `approach()`
(rampe linéaire) atteint sa cible exactement. [ADR 0015](../decisions/0015-rampe-lineaire-lissage-vue.md).

**L'origine de tir vient de la position du pas fixe, jamais interpolée.**
`weaponEyeOrigin` est reconstruite depuis `session.player.position` après
`player.update`, jamais depuis `player.eyePosition()` : sinon le rejeu
d'input (F9/F10) diverge selon le framerate d'affichage à l'enregistrement —
même piège que [Boucle et temps](../3-architecture/boucle-et-temps.md#lordre-exact-dune-image-lu-dans-le-code).

**Un onglet masqué gèle le pas fixe entier**, pas seulement le rendu : rien
qui dépende d'une vraie entrée joueur (saut, mort, filet de chute) n'est
observable en automatisation navigateur avec l'onglet masqué — voir
[Boucle et temps](../3-architecture/boucle-et-temps.md#pièges).

## Tests

- `test/game/session/fallRescue.test.ts` — `recordSafeGround`/`shouldRescue`,
  y compris le piège du joueur téléporté qui se déclare au sol dans le vide.
- `test/game/session/feedback.test.ts` — `applyPlayerDamage` : PV décrémentés
  immédiatement, mort au même pas logique quel que soit le nombre de groupes
  de dégâts encaissés dans le même pas.
- `test/game/player/loyaltyCards.test.ts` — `parseLoyaltyCard` et la
  non-divergence entre `LOYALTY_CARDS` et l'union de `game/state.ts`.
- `test/game/session/sanitaires.test.ts` — le chemin de soin (`playerHp`
  plafonné au max).
- `test/game/updateDisplayInput.test.ts` — ordre de capture de la rotation
  caméra, hors pas fixe (invariant #3).
- `test/game/integration/gameSessionReset.test.ts` — le joueur survit à un
  reset complet de session sans état résiduel.

Aucun test dédié ne couvre `PlayerController.update` (accélération, reclip
de mur, saut, grandeurs de vue) : les deux bugs de l'ADR 0016 ont été
trouvés par un harnais Rapier headless jetable, pas par une suite permanente.

## Comment vérifier que ça marche

- `pnpm test -- fallRescue feedback loyaltyCards sanitaires updateDisplayInput`.
- Console `cassandre.player` : l'instance `PlayerController` réelle
  (position, vitesse, `isGrounded`, `distanceTravelled`…) ; `spawn(x, feetY, z)`
  téléporte, mais n'anime la caméra que si la boucle d'affichage tourne déjà.
- `cassandre.moveConfig` : mutation à chaud, suivie de
  `cassandre.player.applyConfig()` pour les champs lus par Rapier.
- `cassandre.applyFeelVariant("A"|"B"|"C")` : bascule les variantes de vue.
- `cassandre.cards()` / `cassandre.giveCard(carte)` : inventaire réel et
  ramassage forcé, pour tester une porte sans devoir trouver la carte.
