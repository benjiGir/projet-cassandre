---
title: Armes du joueur
tags: [systeme, armes, combat]
status: stable
updated: 2026-09-06
---

# Armes du joueur

Le joueur dispose de deux armes — un pied-de-biche en mêlée et un fusil à
pompe — et ce document explique comment leurs tirs sont résolus, pourquoi
ils doivent l'être de façon déterministe, et comment le feedback de hit
(hitstop, secousse, réticule, marqueur de touche) a été construit couche
par couche à partir de retours de playtest concrets plutôt que d'un plan
arrêté d'avance. `WeaponSystem` (`src/game/player/weapons.ts`) gère la
sélection d'arme, les cooldowns, les munitions du pompe, les raycasts/tests
de forme, le hitstop et l'état de recul du viewmodel — uniquement des
nombres, aucun mesh/matériau/texture (le rendu du viewmodel est le travail
de `render/`). Les valeurs numériques vivent dans `weaponConfig.ts`, source
unique de vérité (voir [Valeurs de déplacement](../reference/valeurs-deplacement.md),
table « Impact », pour les nombres retenus).

## Discipline de déterminisme

`WeaponSystem.update()` doit recevoir l'origine de tir **authentique** du
pas fixe courant (`player.position` + `player.eyeOffset`) et la direction
de visée depuis `frame.yaw`/`frame.pitch` — jamais des valeurs interpolées
pour le rendu (`player.eyePosition(alpha, …)`). Une origine interpolée
dépend du taux d'affichage et casserait silencieusement le rejeu
déterministe du raycast d'arme (invariant #12, [ADR 0007](../decisions/0007-rng-deterministe.md)).

## Architecture munitions : un seul pool

`shotgunAmmo` est un pool unique, sans distinction magasin/réserve.
`shotgunMagazineSize` reste informatif cette phase — aucun mécanisme de
rechargement par magasin n'est implémenté : chaque tir se « réarme »
automatiquement via `shotgunCooldown`, ce qui satisfait déjà le piège du
plan (« le pompe se réarme pendant qu'on bouge », invariant #10) sans
machine à états de rechargement. Un vrai chargeur (rechargement manuel,
munitions par lot) est un candidat naturel pour la Phase 6 (HUD) si le feel
l'exige — pas tranché ici.

## Armement, ramassage, désarmement

- `activeWeapon` par défaut `"melee"` : `gym.ts` (terrain de test Phase 1-3)
  construit un `WeaponSystem` sans jamais appeler `startUnarmed()`, et doit
  démarrer exactement comme avant.
- `hasMelee`/`hasShotgun` par défaut `true`, même raison de compatibilité
  (`gym.ts` et les Zones B-E démarrent déjà « armées »).
- `startUnarmed()` (Zone A « Parking », le pied-de-biche est un ramassage
  au sol) **doit** être appelée de façon synchrone par l'appelant, avant
  que `startLoop()` ne commence à faire tourner le pas fixe — jamais depuis
  un callback asynchrone de chargement de niveau. Appelée en retard, elle
  ne crashe rien mais désarme le joueur en cours de partie au lieu qu'il
  démarre désarmé : un bug de timing silencieux, pas une erreur visible.
- `pickUpMelee()`/`pickUpShotgun()` équipent immédiatement l'arme ramassée
  (convention boomer-shooter classique) et sont idempotentes.

## Matériau perçu et hitstop mur/ennemi

`materialForCollider` lit uniquement les 16 bits de poids fort
(appartenance) de `collider.collisionGroups()` — jamais le filtre — pour
décider `"flesh"` (`GROUP.ENEMY`) vs `PLACEHOLDER_MATERIAL` (« concrete »,
la gym est en boîtes blanches, invariant #9 : pas de vrai système de tag de
matériau par collider cette phase). `triggerHitstopFor` sélectionne ensuite
`enemyHitstopDuration`/`enemyHitstopScale` ou leur équivalent générique
(voir [Hitstop et shake mur/ennemi](#hitstop-et-shake-murennemi-impact_variants)
ci-dessous) — distinction née d'un retour playtest Phase 3 (« le feedback
est mauvais sur un hit »).

**Fait mécanique vérifié** (`GameClock.triggerHitstop`, `FxSystem.triggerShake`) :
les deux déclenchements ne somment jamais entre plusieurs plombs d'un même
tir de pompe dans le même pas fixe — `triggerHitstop` écrase simplement
`hitstopRemaining`/`hitstopScale` (dernier appel gagne) et `triggerShake`
prend le max de l'amplitude courante et de la nouvelle en relançant la
durée pleine. Un tir de pompe à 9 plombs sur un Costard ne « sur-déclenche »
donc pas 9× plus fort qu'un plomb seul — mais il ne se distinguait pas non
plus, avant cette distinction, d'un seul plomb sur un mur. C'est exactement
le trou que la distinction ci-dessous comble.

## Pied-de-biche : portée en capsule

Requête de **forme** capsule — le produit de Minkowski d'un segment
(`eyeOrigin` → `eyeOrigin + direction * meleeRange`) et d'une boule de
rayon `meleeHitRadius` — contre `COLLISION_GROUPS.PLAYER_SHOT` (interagit
avec WORLD + ENEMY, jamais PLAYER : le joueur ne peut pas se toucher
lui-même par construction des groupes).

**Fix de portée, pas un choix de feel** — retour playtest : « je n'ai pas
l'impression de toucher à bout portant ». L'ancienne implémentation testait
une seule sphère centrée à `eyeOrigin + direction * meleeRange` : une bande
fixe `[meleeRange − meleeHitRadius, meleeRange + meleeHitRadius]` devant
les yeux (≈1.55–2.45 m avec les valeurs de départ). Une cible collée au
joueur à moins de 1.55 m tombait entièrement hors de cette bande : le coup
ne pouvait géométriquement pas toucher à bout portant, quelle que soit la
valeur de `meleeHitRadius`. La capsule couvre tout le segment entre les
yeux et la portée max, pas seulement son extrémité.

`RAPIER.Capsule(halfHeight, radius)` place son axe le long du Y local et
ses deux calottes sphériques à ±`halfHeight` de son centre. Avec
`halfHeight = meleeRange / 2` et le centre à `eyeOrigin + direction *
meleeRange / 2`, ses deux calottes tombent exactement sur `eyeOrigin` (t=0)
et `eyeOrigin + direction * meleeRange` (t=meleeRange) : c'est la
définition géométrique exacte d'une sphère de rayon `meleeHitRadius`
balayée le long de ce segment, pas une approximation par échantillonnage
de points.

`intersectionsWithShape` ne donne que les colliders touchés, pas de point/
normale d'impact. Pour chacun : le point de l'axe de visée le plus proche
de ce collider (projection clampée de son centre sur `[0, meleeRange]`),
puis `projectPoint(…, solid=false)` projette ce point sur la surface du
collider (jamais à l'intérieur) — c'est le point d'impact. La normale est
**approximée** par `normalize(axisPoint − point)` : direction du point de
surface vers l'axe de frappe, une approximation standard et correcte pour
une surface convexe (murs/boîtes de la gym, capsule d'un Costard), à ne pas
prendre pour une normale géométrique exacte issue du solveur de contact.

## Pompe : dispersion en cône

`shotgunPelletCount` raycasts indépendants, chacun dévié dans un cône de
demi-angle `shotgunSpreadConeDeg` autour de la visée, par échantillon de
disque projeté (rayon ∝ √u₁, azimut = u₂·2π — approximation d'un cône
uniforme largement suffisante à 5°). `u1`/`u2` viennent du PRNG déterministe
seedé de ce fichier (`SHOTGUN_SPREAD_SEED`, une constante arbitraire fixe,
jamais dérivée du temps réel) — voir [ADR 0007](../decisions/0007-rng-deterministe.md)
pour la raison d'être de `DeterministicRandom.forSeed` et pourquoi chaque
appelant seed sa propre instance plutôt que de partager un flux global.

## Files d'événements de frame (fireEvents/hitEvents)

Ces files s'**accumulent** au fil des pas fixes d'une même frame
d'affichage (une frame lente peut exécuter plusieurs pas fixes, donc
plusieurs tirs) et ne se vident jamais toutes seules à la lecture :
`retro-render` (spawns visuels, sfx) lit le même contenu que le HUD de
debug dans la même frame. Seul `clearFrameEvents()` les vide, et un seul
appelant doit le faire, **en tout dernier** — même principe que
`input.endFrame()` dans `core/loop.ts`.

Aujourd'hui, cet appelant unique est `updateFx()`
(`src/game/loop/updateFx.ts`) : il lit `fireEvents`/`hitEvents` pour
spawner les effets visuels et jouer les sons, puis appelle
`session.weapons.clearFrameEvents()` en tout dernier dans la même fonction,
après que tous ses lecteurs ont fini. Avant le refactor de `main.ts`
(2026-09-05, commit `7600662`), ce rôle était tenu directement dans le
monolithe `main.ts` ; `WeaponSystem` ne s'appelle jamais elle-même.

## Harnais A/B

Quatre harnais indépendants, chacun ajouté pour comparer un seul aspect du
feedback de tir sans jamais toucher à un levier de gameplay (dégâts,
cadence, munitions — hors scope de tous les quatre). Comparables au pas
fixe près via le protocole F9 (enregistrer) / F10 (rejouer) :
`InputFrame.fire` est enregistré comme n'importe quel autre front.

### Recul du viewmodel (RECOIL_VARIANTS)

`cassandre.applyRecoilVariant("A" | "B" | "C")`. Axe : « combien le tir
bouscule la vue ».

| Variante | Profil |
|---|---|
| A — Discipliné | Kick court, récupération rapide, cible gardée en joue. Risque : peut se sentir mou. |
| B — Classique | Kick net sans perte de cible prolongée. Point de départ recommandé. |
| C — Lourd | Poids visible sur les deux armes. Risque : retarde le tir suivant/la réacquisition, en particulier sur cibles rapprochées multiples. |

### Hitstop et shake mur/ennemi (IMPACT_VARIANTS)

`cassandre.applyImpactVariant("A" | "B" | "C")`. Axe : « à quel point le
hit ennemi se démarque du hit générique (mur) ».

| Variante | Profil |
|---|---|
| A — Uniforme | Comportement d'avant cette distinction. Repère de contrôle, pas une proposition. |
| B — Signal renforcé | Hit mur inchangé ; hit ennemi confirmé ~60 % plus long en hitstop, ~50 % plus ample en shake. |
| C — Punchy extrême | Hitstop quasi doublé, shake ×2 sur un hit ennemi. Risque : désorientant sur plusieurs Costards rapprochés, ou casse le rythme du pompe en rafale — à évaluer en combat à 2-3 Costards. |

Protocole de test : viser un Costard (les 3 spawns du hub sont
déterministes). Limite connue de F9/F10 : seul l'état du **joueur** est
restauré au début de l'enregistrement, pas les PV/positions des Costards —
pour comparer les variantes sur un hit ennemi propre, démarrer
l'enregistrement avant le premier coup porté à une cible à PV pleins, ou
respawner une cible fraîche (`cassandre.spawnSuit(x, y, z)`) avant chaque
F10 si le Costard visé est déjà mort/en stagger d'un essai précédent.

### Confirmation de hit à l'écran (HITMARKER_VARIANTS)

Canal de feedback absent du jeu jusqu'à son ajout en Phase 3 (angle mort
identifié en playtest) : confirmation de hit indépendante de la lisibilité
du sprite touché, utile à 640×360 où un flash émissif sur un petit sprite
peut se noyer en plein combat (`render/hitmarker.ts`, overlay canvas 2D
temps réel, hors React — invariant #2). Désactivé par défaut
(`hitmarkerEnabled = false`) : c'est un système entièrement nouveau, pas le
retuning d'un système existant — le livrer actif changerait le feedback
par défaut sans validation humaine. `cassandre.applyHitmarkerVariant("OFF" | "SOBRE" | "ARCADE")`.

### Réticule permanent (CROSSHAIR_VARIANTS)

Contrairement au hitmarker, la présence d'un réticule est une **demande
explicite** du playtest (« le tir est assez hasardeux ... j'ai l'impression
de ne pas toucher à bout portant » — aucun réticule permanent n'existait,
le viewmodel décalé bas-droit étant le seul repère visuel) : `crosshairEnabled`
est donc activé par défaut dans les trois variantes, ce n'est pas un axe de
comparaison. Seul le style (croix/point, taille, épaisseur, couleur,
pulsation au tir) varie. `cassandre.applyCrosshairVariant("CROIX_STATIQUE" | "POINT" | "CROIX_RESPIRATION")`.

**Correctitude de la position, pas une variante** : le réticule est dessiné
au centre exact du canvas interne (résolution 640×360, invariant #4) — la
caméra utilise une projection perspective symétrique (aucun `setViewOffset`
nulle part dans le projet) au même ratio d'aspect, et
`WeaponSystem.computeAimBasis` dérive `aimForward` de `yaw`/`pitch` avec
exactement la même convention Euler `'YXZ'` que `camera.quaternion` dans
`main.ts` — le centre du canvas est donc, par construction géométrique, le
point vers lequel pointe `aimForward`. Aucune marge de tuning sur la
position.

Retour à la [carte de la documentation](../README.md).
