---
title: Deux garde-fous contre la dégénérescence de computeColliderMovement
tags: [adr, physique, joueur]
status: accepte
updated: 2026-09-05
---

# ADR 0016 — Deux garde-fous contre la dégénérescence de `computeColliderMovement`

## Statut

Accepté.

## Contexte

Après la validation humaine de la Phase 1 (« Quake / Half-Life 1 »),
l'utilisateur a signalé un stutter intermittent en marchant/courant
(« comme si quelque chose me bloque »). Deux bugs distincts et réels ont
été trouvés dans `controller.ts`/`moveConfig.ts` via un harnais Rapier
headless jetable (Node/Vite sans navigateur, monde Rapier WASM réel,
géométrie réelle de la gym, `PlayerController` réel, rejeu de pas fixes en
mesurant `desired` vs mouvement résolu par pas).

**Bug 1 — reclip de vitesse sur n'importe quelle collision.** `controller.ts`
réécrivait `velocity.x/z` sur le mouvement réellement résolu dès que
`numComputedCollisions() > 0`. Or Rapier compte le contact de sol/pente/
marche comme une collision au même titre qu'un mur — ce reclip se
déclenchait donc à quasiment chaque pas fixe au sol, pas seulement contre
un mur : la vitesse retombait sur pente/marche/sol multi-boîtes, puis
l'accélération la refaisait remonter, un pas fixe suivant la refaisait
chuter — la sensation de « quelque chose qui bloque » en playtest.

**Bug 2 — `groundStickSpeed` dégénérant le solveur à haute vitesse.**
`groundStickSpeed` (poussée descendante constante au sol, pour stabiliser
`computedGrounded()`) valait `2 m/s`. Combiné à une grande vitesse
horizontale sur un déplacement **axé-axe** (droit devant, pas en diagonale),
ce creep vertical constant faisait dégénérer `computeColliderMovement` sur
sol plat : `computedMovement` ressortait mesurablement plus court que
voulu alors que `isGrounded` était vrai et la normale plate, sans mur ni
collision réelle. C'est le stutter en ligne droite dans le hub (44×44 m
ouvert, seul endroit du niveau où on court longtemps plein axe).

Mesures (harnais headless, `groundStickSpeed=2`, ancienne valeur) : hub
35.1 % des pas fixes affectés, KCC brut isolé en plein +X 41-49 % (résultat
indépendant d'autostep/snap, indépendant de `colliderOffset` testé de 0.01
à 0.2 m). En diagonale (yaw non aligné), l'ancienne valeur ne montrait déjà
quasi aucun artefact — c'est bien l'alignement d'axe combiné à la magnitude
du creep qui déclenche la dégénérescence, pas la géométrie du niveau.

**Piste écartée par la mesure, pas par le raisonnement** : la première
hypothèse pour le bug 2 — des coutures de géométrie dans `gym.ts` (boîtes
adjacentes multiples plutôt qu'un mesh fusionné) — était bien argumentée
mais **fausse** : le sol du hub, une seule boîte « propre », dégénérait dix
fois plus que les vraies coutures ailleurs dans la gym.

## Décision

**Bug 1** : le reclip de vitesse horizontale ne s'applique que si une
collision détectée est un vrai mur, au sens de `wallNormalYThreshold(cfg)`
(= cos(`maxSlopeClimbAngleDeg`)) — réutilisation de la frontière que Rapier
applique déjà en interne entre franchissable et non franchissable, plutôt
qu'un second seuil indépendant à maintenir en synchronisation.

**Bug 2** : `groundStickSpeed` plafonné à `0.2 m/s` (valeur retenue).
Testé jusqu'à 0.02 sans le moindre flicker de `isGrounded` sur la gym réelle
(hub, escaliers 0.45 m, rampe 45°) : la marge de sécurité au-dessus de 0.2
est large avant de retoucher au risque que ce champ existe pour éviter.
Avec `groundStickSpeed=0.2` : hub 2.1-2.4 % de pas fixes affectés,
comparable au bruit de fond déjà mesuré aux coutures géométriques du
niveau (2.4-4.3 %). Valeur partagée avec les ennemis
(`SuitConfig.groundStickSpeed`/`DirectorConfig.groundStickSpeed` — voir
[Valeurs des ennemis](../reference/valeurs-ennemis.md)) : les ennemis se
déplacent nettement plus lentement que le joueur, donc le risque mesuré
côté joueur est déjà une borne haute pour eux.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Reclip sur `numComputedCollisions() > 0` sans filtre de normale | pénalise sol/pentes/marches, pas seulement les murs — cause du bug 1 |
| Fusionner la géométrie de la gym en un seul mesh (hypothèse coutures) | mesuré et infirmé : le sol « propre » du hub dégénérait *plus* que les vraies coutures |
| `groundStickSpeed` plus élevé (ancienne valeur 2 m/s, sécurisant en apparence) | dégénère `computeColliderMovement` sur sol plat à grande vitesse axée-axe — mesuré, pas supposé |
| Un second champ dédié pour le seuil mur (indépendant de `maxSlopeClimbAngleDeg`) | source de vérité dupliquée pour la même frontière que Rapier applique déjà en interne |

## Conséquences

- `TuningPanel` (`src/ui/TuningPanel.tsx`) a vu la plage de son slider
  `groundStickSpeed` resserrée à `[0, 0.6]` — une « falaise » de
  dégénérescence a été mesurée entre 0.5 et 1.0 m/s ; 0.6 laisse 3× la
  valeur par défaut (0.2) de marge sans la franchir, et empêche de ramener
  le champ à la zone dangereuse à l'exécution.
- Ne pas « corriger » `groundStickSpeed` vers une valeur plus haute sans
  remesurer avec le même harnais headless : la valeur basse a l'air
  contre-intuitive (« ça devrait coller mieux au sol ») mais c'est l'inverse
  qui est vrai au-dessus d'un certain seuil.
- Un problème de feel physique qui *ressemble* à un problème de géométrie
  de niveau mérite d'être mesuré avant d'être attribué à la géométrie —
  Rapier peut dégénérer numériquement pour des raisons indépendantes de la
  façon dont le niveau est construit.

## Comment on saurait qu'on a eu tort

Si `isGrounded` se met à clignoter sur un terrain plat après une baisse de
`groundStickSpeed`, ou si un rapport de stutter revient après une hausse de
ce champ au-dessus de 0.2 sans nouvelle mesure au harnais headless.
