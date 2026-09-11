---
title: Occlusion des rangées de kit non fiable pour la ligne de vue ennemie
tags: [adr, entites, level-design, raison-partielle]
status: accepte
updated: 2026-09-06
---

# ADR 0022 — Occlusion des rangées de kit non fiable pour la ligne de vue ennemie

## Statut

Accepté pour le contournement. La cause racine reste **non identifiée** —
voir la section dédiée ci-dessous plutôt qu'une justification inventée.

## Contexte

`enemyMachine.ts::hasClearWorldPath` (voir [Entités et IA —
Navigation](../systems/entites.md#navigation)) tire un rayon `WORLD_ONLY_RAY_GROUPS`
entre les yeux de l'ennemi et ceux du joueur ; un `spawn_suit_*`/
`spawn_director_*` posé derrière une rangée de gondoles (Zone C) ou de racks
(Zone D) est censé rester `idle`/`alert` sans jamais atteindre `attack` tant
que la rangée bloque ce rayon.

Constaté à deux reprises, sur deux zones et deux pièces de kit différentes :

- **Zone C** (`kit_gondola_end`/`kit_gondola_4m`) : `spawn_suit_1`/
  `spawn_suit_2` posés au milieu des allées centrales passaient en `attack`
  dès le spawn — mais l'allée elle-même est une ligne droite dégagée d'un
  bout à l'autre par construction, donc pas une preuve d'échec de
  l'occlusion latérale.
- **Zone D** (`kit_rack_4m`) : `spawn_suit_1`/`spawn_suit_2`, posés dans les
  couloirs latéraux avec une occlusion **confirmée par calcul géométrique**
  (le segment spawn→ennemi croise bien l'empreinte réelle du rack, bbox
  revérifiées indépendamment en rechargeant le `.glb` exporté), passaient
  quand même en `chase` puis `attack` dès le spawn, à une distance sous
  `attackRange`.

Dans les deux cas, la géométrie, les colliders (`col_box_*`, groupe
`COLLISION_GROUPS.WORLD` comme tout `col_*`) et le calcul géométrique
d'occlusion sont corrects par relecture indépendante. Le rayon ne s'arrête
pourtant pas sur la rangée en pratique.

## Décision

**Contournement, pas une correction** : dans les deux zones, les
`spawn_suit_*` concernés ont été déplacés à une distance qui les place
**hors `attackRange` quelle que soit l'occlusion réelle**, plutôt que de
compter sur le blocage de ligne de vue par la rangée :

- Zone C : `spawn_suit_1`/`spawn_suit_2` déplacés de Y=12 (milieu d'allée) à
  Y=18 (sortie nord des allées, ~18.1 m du spawn).
- Zone D : `spawn_suit_1`/`spawn_suit_2` déplacés de Y=10 (couloir latéral,
  ~13.8 m) à Y=16 (même couloir, ~18.9 m).

Revérifié en jeu dans les deux cas : les ennemis concernés passent
`idle` → `alert` → `chase` sans jamais `attack` au spawn.

## Cause racine — non identifiée

Aucun repro headless n'a été tenté. Hypothèse non vérifiée : un gap général
sur l'occlusion des pièces `PROP` du kit (gondoles, racks) spécifiquement
pour les rayons de ligne de vue, indépendant de la zone — mais rien ne
distingue leur collider `col_box_*` de celui d'un mur `SHELL`, qui bloque
correctement. **Ne pas supposer que cette hypothèse est la bonne** : elle
n'a pas été testée.

### Piste (2026-09-11), non vérifiée

Rapier ne rend un collider visible aux rayons qu'après un `world.step()`
(voir [Physique — Colliders invisibles aux rayons avant le premier
pas](../systems/physique.md#colliders-invisibles-aux-rayons-avant-le-premier-pas)).
Au chargement d'un niveau, rien n'avançait la simulation avant la première
passe d'IA : si le premier rayon de ligne de vue d'un ennemi part avant le
premier pas de physique, il ne rencontre aucun collider et « voit » le
joueur à travers la rangée. L'ennemi passe alors en alerte, et la suite
de la machine à états peut s'enchaîner même une fois la rangée redevenue
opaque. Ce serait cohérent avec les deux constats (ennemis actifs dès le
spawn, géométrie pourtant correcte). Depuis le 2026-09-11,
`refreshSceneQueries()` est appelé au chargement, avant toute passe d'IA ;
le repro headless du jalon N5 (`PLAN_NIVEAU_V2.md`) doit confirmer ou
écarter cette explication.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Chercher la cause racine avant de livrer les zones | aurait bloqué C et D indéfiniment ; le contournement par distance donne le même résultat observable (pas d'embuscade injuste) sans dépendre de l'occlusion |
| Ignorer l'écart, garder les positions d'origine | vérifié en jeu comme un vrai bug de gameplay (ennemi qui tire dès le spawn, aucune fenêtre d'approche) — pas acceptable |

## Conséquences

- Toute future zone avec des `spawn_suit_*`/`spawn_director_*` derrière un
  `kit_gondola_*`/`kit_rack_4m` doit être vérifiée **en jeu**
  (`window.cassandre.suits`), pas seulement par calcul géométrique — le
  calcul s'est révélé correct et insuffisant à lui seul dans ce cas précis.
- Un futur repro headless (spawner un ennemi et un joueur de part et
  d'autre d'un `col_box_gondola_4m`/`col_box_rack_4m` isolé, sans le reste
  du niveau) permettrait de confirmer ou d'infirmer l'hypothèse ci-dessus —
  pas fait ici, hors périmètre de cette tâche de migration de commentaires.

## Comment on saurait qu'on a eu tort

Si un futur repro headless identifie une cause précise (ex. un défaut de
`col_box_*` généré par `build_kit.py` pour les pièces `PROPS` uniquement, ou
un problème de tolérance dans `RaycastService`/`WORLD_ONLY_RAY_GROUPS`), la
corriger à la source rendrait ce contournement par distance inutile pour les
zones existantes et permettrait de rapprocher les spawns du plan de level
design d'origine.
