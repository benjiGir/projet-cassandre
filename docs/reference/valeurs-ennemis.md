---
title: Valeurs des ennemis
tags: [reference, feel, entites]
status: brouillon
updated: 2026-09-05
---

# Valeurs des ennemis

> **Note** — Valeurs de départ, pas valeurs finales (même statut que
> [Valeurs de déplacement](valeurs-deplacement.md)). `SuitConfig`/
> `DirectorConfig` sont des objets mutables tunables à chaud
> (`cassandre.suitConfig.xxx = …`, `cassandre.directorConfig.xxx = …`) —
> source unique de vérité, aucun nombre de comportement/combat codé en dur
> ailleurs que dans `src/game/entities/suitConfig.ts`/`directorConfig.ts`.

`SuitConfig` et `DirectorConfig` sont deux interfaces **distinctes**,
délibérément dupliquées plutôt que partagées ou liées par héritage — voir
[ADR 0009](../decisions/0009-machine-partagee-suit-director.md) et
l'invariant #8 (pas d'ECS/abstraction avant 12 types d'ennemis). Un second
type d'ennemi qui hériterait du premier romprait dès que l'un des deux bouge
pour une raison propre à lui seul.

Sauf mention contraire, une valeur du Directeur plus « lourde » (vitesse plus
basse, knockback plus faible, dégâts plus hauts) traduit un choix de
*silhouette de boss*, pas un choix de difficulté isolé.

## Vie

| Paramètre | Costard | Directeur | Effet perceptuel |
|---|---|---|---|
| `maxHp` | 50 | 300 | 300 = 6× celui du Costard : un boss unique doit survivre nettement plus longtemps qu'un Costard (qui meurt en un coup de pompe à bout portant) sans transformer le combat en corvée — repère : ~6 tirs de pompe pleinement chargés à bout portant, ou une trentaine de coups de pied-de-biche |
| `revealHpFraction` | — | 0.5 | fraction de `maxHp` sous laquelle la révélation (costume humain → reptilien) se déclenche. Exprimée en fraction plutôt qu'en PV absolus pour rester correcte si `maxHp` est retuné sans recalcul séparé. 0.5 choisi (pas prescrit) : signal de « seconde phase » à mi-combat — plus haut (0.8) perdrait l'effet de surprise, plus bas (0.2) arriverait trop tard pour influencer la fin du combat |

`maxHp` du Costard (50) est lui-même calé pour qu'un tir de pompe totalement
à bout portant (9 plombs × `weaponConfig.shotgunDamagePerPellet` = 54) tue de
façon fiable en un coup — condition nécessaire pour que la mécanique de gibs
ait une chance de se déclencher en jeu normal, où la dispersion du cône fait
rarement toucher les 9 plombs. Le pied-de-biche (40 dégâts) laisse le Costard
survivant à un coup, cohérent avec une arme de mêlée plus faible que le
pompe.

## Capsule et controller

| Paramètre | Costard | Directeur |
|---|---|---|
| `capsuleRadius` | 0.4 m | 0.45 m (silhouette de boss plus imposante) |
| `capsuleHalfHeight` | 0.5 m | 0.6 m |
| `eyeHeight` | 1.6 m | 1.8 m |
| `characterMass` | 75 | 110 |
| `colliderOffset` | 0.01 | 0.01 |
| Autostep | 0.35 m (hauteur), 0.2 m (largeur mini) | identique |
| Snap to ground | 0.4 m | identique |
| Pente max grimpable | 50° | identique |
| Pente min glissante | 55° | identique |
| `groundStickSpeed` | 0.2 m/s | 0.2 m/s |

`groundStickSpeed` partage sa valeur et sa raison avec
`MoveConfig.groundStickSpeed` (joueur) : au-delà d'~0.2 combiné à un grand
déplacement horizontal axé-axe, `computeColliderMovement` (Rapier) dégénère
— voir [ADR 0016](../decisions/0016-garde-fous-degenerescence-kcc.md) pour
l'analyse complète du bug et les mesures.
Les ennemis se déplacent nettement plus lentement que le joueur, donc le
risque mesuré côté joueur est déjà une borne haute ici ; à retester avec le
même harnais headless si `chaseSpeed` est un jour poussé significativement
au-dessus de la vitesse de marche du joueur.

## Perception

| Paramètre | Costard | Directeur |
|---|---|---|
| `sightRange` | 22 m | 22 m (la Zone E fait 16×16 m — cette valeur couvre déjà toute la pièce) |
| `lostContactTimeout` | 5 s | 5 s |

`lostContactTimeout` est une valeur **prescrite** par le skill
`enemy-state-machine` (diagramme de la machine à états), identique pour les
deux types — ne pas la retuner sans relire le skill.

## Déplacement

| Paramètre | Costard | Directeur |
|---|---|---|
| `chaseSpeed` | 3.6 m/s | 3.2 m/s (un boss avance plus lourdement, délibérément — pas un choix de difficulté) |
| `turnRateRadPerSec` | 8 rad/s | 6 rad/s (tourne plus lourdement, cohérent avec sa carrure) |

`chaseSpeed` du Costard est volontairement **inférieure** à la vitesse de
marche du joueur (9 m/s, voir [Valeurs de déplacement](valeurs-deplacement.md)) :
un Costard rattrape un joueur immobile, mais on peut le semer en bougeant.

## Évitement local (skill `enemy-state-machine`)

| Paramètre | Costard | Directeur |
|---|---|---|
| `avoidanceRayLength` | 1.4 m | 1.6 m (cohérent avec une capsule plus large) |
| `avoidanceSideAngleDeg` | 30° | 30° |

`avoidanceSideAngleDeg` est **prescrit** par le skill (30°) pour les deux
types. Trois rayons (avant, avant-gauche, avant-droit) — voir
[Entités et IA](../systems/entites.md#navigation) pour le mécanisme complet
et sa coexistence avec le vrai pathfinding 2.5D.

## Machine à états — durées

| Paramètre | Costard | Directeur |
|---|---|---|
| `alertDuration` | 0.45 s | 0.45 s |
| `attackTelegraphDuration` | 0.35 s | 0.4 s |
| `attackCooldown` | 1.7 s | 2.2 s |
| `attackRange` | 16 m | 14 m |
| `staggerDuration` | 0.4 s | 0.45 s |
| `deathFrameDuration` | 0.12 s | 0.15 s (× 4 frames = durée totale) |

`attackTelegraphDuration` a un **plancher non négociable** de 0.2 s (skill
`enemy-state-machine`) : en dessous, le joueur ne peut physiquement pas
réagir. La valeur du Directeur est volontairement **au-dessus** de celle du
Costard : un boss doit se lire comme plus lourd/plus lisible, jamais plus
rapide à réagir — ne jamais descendre sous 0.2 s en tuning pour l'un ou
l'autre.

## Combat

| Paramètre | Costard | Directeur |
|---|---|---|
| `attackDamage` | 6 | 10 (un boss doit faire plus mal, mais rester survivable plusieurs coups avec `playerMaxHp` = 100, `game/state.ts`) |
| `aimJitterDeg` | 2.5° | 2° (un boss vise légèrement mieux) |
| `gibDistance` | 3 m | — (le Directeur n'a pas de mécanique de gibs : un boss qui explose en morceaux casserait la mise en scène de révélation/mort) |

**Dégâts baissés le 2026-09-15** (10 → 6, Directeur 15 → 10), après un retour
de playtest du niveau v2 : « je meurs trop vite », face à plusieurs Costards.
Les valeurs d'origine venaient de la gym de la Phase 3, où l'on n'affrontait
jamais plus de trois Costards et jamais sans pouvoir reculer. Le même jour, le
niveau v2 a reçu ses trousses de soin (propriété `soin` d'un `use_*`, voir
[Conventions de nommage](conventions-nommage.md#trousses-de-soin)).

Ordres de grandeur utiles au prochain réglage :

- **Sous 9 m, tous les tirs touchent.** La capsule du joueur fait 0,4 m de
  rayon et le jitter est de ±2,5° : l'écart latéral n'atteint le bord de la
  capsule qu'à 9,2 m. À 16 m (`attackRange`), un tir sur deux environ touche.
- **Le tir ne s'esquive pas en bougeant.** `resolveAttack` vise la position
  du joueur à la FIN de la télégraphie, pas au début : seule une ligne de vue
  coupée le fait rater. C'est ce qui rend un groupe si dangereux.
- **Un Costard fait environ 3 PV/s** (6 dégâts toutes les 2,05 s,
  télégraphie comprise), contre 4,9 PV/s avant.

`gibDistance` (Costard) est un point de départ explicitement **non figé**
par la tâche d'origine, contrairement à `weaponConfig.shotgunPelletCount`/
`shotgunSpreadConeDeg` qui sont prescrits — c'est un choix de tuning ouvert.

Les deux jitters de visée (`aimJitterDeg`) passent par le PRNG seedé par
entité (`createEnemyPrng`, `enemyMachine.ts`), jamais `Math.random()` —
invariant #12.

## Knockback

Les deux entités sont des corps **kinématiques** : `RAPIER.RigidBody.applyImpulse`
n'a aucun effet dessus. Le recul est une vélocité pilotée à la main,
décroissante sur `knockbackDecayTime`, injectée dans le mouvement désiré du
pas fixe — voir `enemyMachine.ts::updateKnockback`.

| Paramètre | Costard | Directeur |
|---|---|---|
| `knockbackSpeed` | 4.5 m/s | 3 m/s (un boss doit se sentir plus lourd, moins « poussable ») |
| `knockbackDecayTime` | 0.3 s | 0.3 s |
| `knockbackUpBoost` | 1.5 m/s | 1 m/s |

### Variantes de knockback (Costard) — harnais A/B

Un seul axe : « à quel point un Costard touché bouge visiblement ». Usage
console : `cassandre.applyKnockbackVariant("B")`. Même limite connue que
`IMPACT_VARIANTS` (`weaponConfig.ts`) pour le protocole F9/F10 : le recorder
ne restaure pas l'état des Costards — viser une cible aux PV pleins pour
chaque comparaison, respawner via `cassandre.spawnSuit(...)` si besoin.

| Variante | `knockbackSpeed` | `knockbackDecayTime` | `knockbackUpBoost` | Lecture |
|---|---|---|---|---|
| A — Subtil | 2 | 0.25 s | 0.6 | le Costard vacille à peine, lisible surtout à la pose de recul. Risque : peut lire comme si les coups ne « portaient » pas |
| B — Classique (valeur de départ, inchangée) | 4.5 | 0.3 s | 1.5 | recul net mais le Costard reste globalement sur place |
| C — Arcade | 8 | 0.35 s | 3 | visiblement repoussé/soulevé à chaque coup. Risque assumé : peut le pousser hors de portée de mêlée, ou dans un mur/une autre entité (pas de résolution de collision entre Costards à l'intérieur de cette mécanique) |

## Feedback visuel d'un coup reçu par un ennemi

| Paramètre | Costard | Directeur |
|---|---|---|
| `hitFlashDuration` | 0.25 s | 0.25 s |

Était une constante en dur (`FLASH_DURATION`) dans `render/billboard.ts`,
non exposée — violait le mandat « config unique, tunable à chaud » du skill
`game-feel-tuning`. Déplacée dans `SuitConfig`, valeur de départ inchangée :
ce déplacement ne devait rien changer au feedback perçu tant qu'un humain
n'avait pas choisi une variante différente.

### Variantes de flash (Costard) — harnais A/B

Un seul axe : combien de temps le sprite touché reste visiblement blanc.
Usage console : `cassandre.applyFlashVariant("B")`.

| Variante | `hitFlashDuration` | Lecture |
|---|---|---|
| A — Court | 0.12 s | net et bref : deux coups à la cadence du pompe (0.8 s) restent toujours distincts, mais un seul coup peut passer inaperçu au coin de l'œil |
| B — Classique (valeur de départ, inchangée) | 0.25 s | — |
| C — Long | 0.45 s | très lisible même en périphérie. Risque assumé : plusieurs coups rapprochés (mêlée en rafale, plusieurs Costards groupés) peuvent fusionner visuellement |

## Feedback visuel d'un coup reçu par le joueur

| Paramètre | Costard | Directeur |
|---|---|---|
| `playerHitShakeAmplitude` | 0.08 m | 0.1 m (un coup de boss doit se sentir plus lourd) |
| `playerHitShakeDuration` | 0.1 s | 0.12 s |

Utilise l'API publique déjà existante de `render/fx.ts` (`triggerShake`),
aucune modification de ce fichier nécessaire pour ce feedback.

## Révélation (Directeur uniquement)

| Paramètre | Valeur |
|---|---|
| `humanTintColor` | `0xffffff` (blanc = atlas affiché sans teinte, identique au rendu du Costard) |
| `revealedTintColor` | `0x33cc55` (vert reptilien) |
| `revealShakeAmplitude` | 0.12 m |
| `revealShakeDuration` | 0.25 s |

`revealedTintColor` est un **placeholder explicite** (invariant #9, pas
d'art final) : suffisant pour valider que la bascule se déclenche au bon
seuil de PV sans attendre un sprite dédié.

## Badge du Directeur

| Paramètre | Valeur |
|---|---|
| `cardPickupRadius` | 1.5 m (même ordre de grandeur que la portée `use_*`, 2 m, mais consommé par proximité seule — pas de touche E, voir [Entités et IA](../systems/entites.md#carte-lâchée-par-le-directeur)) |
| `cardPickupDelay` | 0.6 s |

`cardPickupDelay` existe pour une raison précise : sans lui, un kill à bout
portant (mêlée, pompe au contact) place le joueur déjà dans
`cardPickupRadius` au moment même où le badge apparaît — il se ramasserait
alors sur le **même** pas fixe que sa création, donc jamais visible, ce qui
se lit comme un bug (« le drop plante », « il disparaît tout de suite »)
plutôt que comme un ramassage. 0.6 s : assez long pour que le joueur voie le
badge apparaître, assez court pour ne pas sembler être une attente
artificielle. Bug réel trouvé et corrigé le 2026-08-23 après un retour de
playtest (« on dirait que le drop le fait buggé ») — voir le journal de
`CLAUDE.md`, Phase 5, pour le détail complet des deux causes trouvées ce
jour-là (position du drop + absence de ce délai).

Retour à la [carte de la documentation](../README.md).
