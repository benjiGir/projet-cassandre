---
title: Joueur — déplacement et vue
tags: [systeme, joueur, physique]
status: stable
updated: 2026-09-06
---

# Joueur — déplacement et vue

Ce document couvre comment le joueur se déplace et comment la caméra
restitue ce déplacement à l'écran — deux problèmes liés mais distincts.
Le déplacement s'appuie sur le character controller de Rapier plutôt que sur
une implémentation maison (invariant #6 de `CLAUDE.md` — voir [Physique et
collisions](physique.md) pour la discipline générale et les groupes de
collision, pas répétée ici) : la partie propre au joueur, ci-dessous, est la
résolution du pas fixe et deux garde-fous trouvés après coup contre des
comportements dégénérés de Rapier. Le système de vue (head bob, FOV
dynamique, réception de saut) est un habillage purement cosmétique posé
par-dessus, qui ne doit jamais contaminer la direction de visée réelle —
c'est la règle qui structure toute cette seconde moitié du document. Aucun
nombre de gameplay ne vit dans le code du contrôleur lui-même
(`src/game/player/controller.ts`) : tout vient de `moveConfig.ts`, source
unique de vérité — voir [Valeurs de déplacement](../reference/valeurs-deplacement.md).

## Résolution du pas fixe

- Le corps est kinématique : `PlayerController` intègre lui-même vitesse
  horizontale et verticale (le solveur Rapier ne l'intègre pas).
- La gravité est **lue** sur `PhysicsWorld.gravityY`, jamais redéclarée —
  la dupliquer désynchroniserait la chute du joueur de celle des corps
  dynamiques.
- `computeColliderMovement` résout pentes, marches (autostep) et
  glissements.
- La translation cible est posée via `setNextKinematicTranslation` et
  appliquée par le `world.step()` **du même pas fixe** (voir l'ordre des
  callbacks dans `core/loop.ts`) — le corps kinématique en dérive sa
  vitesse, ce qui permet de pousser proprement les corps dynamiques.

## Deux garde-fous contre la dégénérescence de Rapier

Deux bugs de stutter distincts, trouvés après la validation humaine de la
Phase 1 via un harnais Rapier headless jetable, ont chacun laissé un
garde-fou dans `controller.ts`/`moveConfig.ts`. Décision complète,
alternatives écartées et chiffres de mesure :
[ADR 0016](../decisions/0016-garde-fous-degenerescence-kcc.md).

### Distinction mur / sol-pente (reclip anti-vitesse-fantôme)

Rapier compte le contact de sol/pente/marche comme une collision au même
titre qu'un mur (`numComputedCollisions() > 0` à quasiment chaque pas fixe
au sol) — reclipper la vitesse horizontale sur le mouvement résolu dès
qu'une collision existe, sans filtrer, pénalise donc aussi sol/pentes/
marches. `wallNormalYThreshold(cfg)` (= cos(`maxSlopeClimbAngleDeg`))
réutilise la frontière que Rapier applique déjà en interne entre
franchissable et non franchissable : une collision dont `|normale.y|` tombe
sous ce seuil est un vrai mur (ou une pente volontairement infranchissable,
comme la rampe à 55° de la gym). Le reclip (`velocity.x/z = movement.{x,z} / dt`)
ne s'applique alors que si un mur a été détecté — sinon courir contre un mur
garderait une vitesse fantôme qui se libère d'un coup en s'en écartant.

### Une vitesse de collage au sol volontairement faible (groundStickSpeed)

Vitesse descendante appliquée en permanence au sol pour maintenir le
contact (stabilise `computedGrounded()`, aide le snap-to-ground en
descente). Doit rester **nettement** sous 0.2 m/s pour ce prototype : une
valeur plus haute combinée à une grande vitesse horizontale axée-axe (droit
devant, pas en diagonale) fait dégénérer `computeColliderMovement` sur sol
plat — voir l'ADR 0016 pour les mesures. Valeur partagée avec les ennemis
(`SuitConfig`/`DirectorConfig`, voir
[Valeurs des ennemis](../reference/valeurs-ennemis.md)).

### Snap-to-ground suspendu en montée

`kcc.disableSnapToGround()` tant que `velocity.y > 0` : sans ça, le
snap-to-ground (0.4 m) recollerait au sol un saut naissant (7.4 m/s × 1/60
≈ 0.12 m parcourus au premier pas fixe, largement sous les 0.4 m de snap).

### Vitesse d'impact : lue avant la remise à zéro

L'atterrissage (`grounded && velocity.y < 0`) remet `velocity.y` à 0 tous
les pas fixes au sol — normal, `groundStickSpeed` s'applique en permanence.
La vitesse d'impact qui pilote l'enfoncement de réception
(`landingDipFor`) n'est donc capturée **que sur la transition air → sol**
(`!isGrounded` au pas fixe précédent) : sans cette garde, chaque pas de
marche au sol déclencherait un enfoncement de réception.

## Vue : head bob, FOV dynamique, réception de saut

Trois règles tiennent tout l'état de vue (`bobIntensity`, `runFactor`,
`landingDip`, et leurs échantillons `previous*`) :

1. Tout est avancé au **pas fixe**, avec le `dt` de gameplay — jamais une
   horloge murale, donc un rejeu d'input redonne exactement la même image.
2. Chaque grandeur a son échantillon n−1, comme `previousPosition`, pour
   être interpolée par `alpha` au rendu : ces valeurs n'avancent qu'à
   60 Hz, les échantillonner brutes ferait avancer le bob par paliers
   visibles sur un écran à 144 Hz.
3. Rien n'est angulaire : la vue est **translatée**, jamais tournée
   (invariant #3) — un tir de la Phase 2 vise depuis la direction de visée
   pure, non contaminée par le bob.

Le bob est donc **positionnel uniquement**. Choix explicite, pas un oubli :
un roulis de bob (rotation de caméra au rythme des pas) contaminerait la
direction de visée pure exigée par l'invariant #3 — il est reporté et
devra être arbitré séparément si le feel le demande un jour.

La **phase** du bob se dérive de `distanceTravelled` (mètres réellement
parcourus), jamais du temps : elle se fige exactement quand le joueur
s'arrête. Seules les **enveloppes** d'amplitude (`bobIntensity`,
`runFactor`, `landingDip`) sont lissées dans le temps, via une rampe
linéaire (voir plus bas) au `dt` du pas fixe.

`eyePosition()` — l'origine des yeux utilisée pour le raycast d'arme — est
**volontairement non bobée** : c'est la position anatomique, le bob
s'ajoute par-dessus côté caméra via `viewBob()`. Un tir ne doit jamais
partir d'une caméra secouée.

`viewBob(alpha, out)` écrit un décalage `(x latéral, y vertical, z inutilisé)`
dans le repère de la vue, sans allocation. À l'arrêt complet, la sortie est
**exactement** `(0, 0, 0)` — garantie d'immobilité pixel-exacte pour les
captures déterministes. Un cycle = deux appuis de pied : le balancement
latéral fait un aller-retour, la vue monte et redescend deux fois.

## Rampe linéaire, pas exponentielle (approach())

`approach()` (`controller.ts`, exportée) rapproche une grandeur de sa cible
à **vitesse constante** plutôt que par une décroissance exponentielle.
Fonction partagée avec `weapons.ts` pour la récupération de recul du
viewmodel — même contrat (`dt` de gameplay, jamais d'horloge murale), pour
ne jamais risquer deux implémentations qui divergent. Décision, alternative
écartée et mesures de convergence : [ADR 0015](../decisions/0015-rampe-lineaire-lissage-vue.md).

## Harnais A/B — FEEL_VARIANTS

`cassandre.applyFeelVariant("A" | "B" | "C")` bascule les champs de vue
(bob, FOV, réception) sans toucher au déplacement — vitesses,
accélérations, saut et capsule restent hors de cet A/B. Un seul axe :
« quantité de corps dans la caméra ». La cadence (`bobDistancePerCycle`)
est identique dans les trois variantes pour ne pas mélanger deux
dimensions dans la comparaison.

| Variante | Profil |
|---|---|
| A — Sobre | Bob à peine visible, FOV quasi fixe. Meilleur choix si la visée en mouvement prime. |
| B — Classique | Dosage type Quake/GoldSrc, point de départ recommandé. |
| C — Charnu | Bob et FOV marqués, réceptions accentuées. Risque assumé : gêne à la visée en mouvement, inconfort possible (mal des transports). |

`applyConfig()` n'est pas nécessaire après un changement de variante :
aucun de ces champs n'est lu par Rapier, ils sont relus à chaque pas fixe
et à chaque frame d'affichage.

Protocole de comparaison (`game/devtools/testHarness.ts::applyFeelVariant`),
trois étapes : F9, courir et sauter ~15 s dans le couloir nord du hub, F9
pour arrêter ; `cassandre.applyFeelVariant("A")` puis F10 — recommencer
avec « B », « C » ; la course rejouée est identique au pas fixe près, seule
la vue change — c'est la variante, pas la façon de jouer, qui est comparée.

Retour à la [carte de la documentation](../README.md).
