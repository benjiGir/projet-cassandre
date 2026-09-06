---
title: Physique jouet plutôt que Rapier pour les débris cosmétiques
tags: [adr, rendu, physique]
status: accepte
updated: 2026-09-05
---

# ADR 0018 — Physique jouet plutôt que Rapier pour les débris cosmétiques

## Statut

Accepté.

## Contexte

`FxSystem` (`src/render/fx.ts`) doit animer trois catégories de débris
purement cosmétiques et de courte durée de vie : particules d'impact
(< 0.4 s), douilles éjectées (1.6 s, avec un rebond), et gibs de mise à mort
à bout portant (0.9 s). Aucun n'a d'effet de gameplay — `render/` ne touche
jamais Rapier, par discipline de découplage (voir [Rendu — Découplage entre
render/ et game/](../systems/rendu.md#découplage-entre-render-et-game)). Le
rebond des douilles nécessite néanmoins une notion de sol.

## Décision

Une « physique jouet » entièrement maison (`ToyParticle`/`updateToyPhysics`) :
gravité constante dupliquée (-25 m/s², même magnitude que l'invariant #7
pour rester visuellement cohérente avec le reste du monde), intégration
semi-implicite (`velocity += g·dt`, `position += velocity·dt`), et pour les
douilles seulement un rebond sur un plan de sol supposé à `y = 0`
(`SHELL_GROUND_Y`, restitution 0.3, friction 0.6) — sans la moindre requête
Rapier. Les trois catégories réutilisent la même infrastructure générique,
seuls géométrie, couleur, quantité, vitesse, dispersion et `bounce`
diffèrent.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Vrai `RigidBody` léger par débris (`COLLISION_GROUPS.DEBRIS`, groupe déjà réservé dans `physics/world.ts`) | cycle de vie physique complet à gérer (création, nettoyage, un pas de `world.step()` de plus par débris) pour un objet sans le moindre effet de gameplay — coût disproportionné à ce stade |
| Pas de rebond du tout pour les douilles | le rebond fait partie du feedback attendu d'une douille éjectée (retour visuel FPS classique) ; le supprimer aurait été un renoncement, pas un choix |

## Conséquences

`SHELL_GROUND_Y = 0` est une approximation qui suppose un sol plat, au
niveau du hub/couloir de `game/level/gym.ts`. Dans une zone avec relief
(rampes, marches, mezzanine), une douille peut visuellement traverser une
marche avant de disparaître — acceptable pour un débris à durée de vie
courte (1.6 s) dans une gym en boîtes blanches, pas nécessairement pour un
futur niveau avec sol texturé et caméra proche du sol.

## Comment on saurait qu'on a eu tort

Si un niveau avec relief marqué près du spawn du joueur rend ce
traversement de douille visible et gênant en jeu — remplacer
`SHELL_GROUND_Y` par une vraie requête raycast ponctuelle (pas un
`RigidBody`) résoudrait le cas sans revenir sur la décision de ne pas
utiliser Rapier pour l'intégration elle-même.
