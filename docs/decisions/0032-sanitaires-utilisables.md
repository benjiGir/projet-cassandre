---
title: Sanitaires utilisables — SanitaireSystem, calqué sur VitreSystem
tags: [adr, physique, niveau, gameplay]
status: accepte
updated: 2026-09-24
---

# ADR 0032 — Sanitaires utilisables : `SanitaireSystem`, calqué sur `VitreSystem`

## Statut

Accepté.

## Contexte

Demande explicite de l'utilisateur : « je voudrais que les toilettes soit
utilisables comme dans duke et redonne de la vie quand on les utilise. si on
les casse on a de l'eau qui jaillit et on peut la boire pour se heal. »

Référence : Duke Nukem 3D, `player.c::checksectors`, cas `TOILET`/`STALL`.
Duke se soulage à une cuvette/un urinoir intact (+max/10 PV, délai de
220 s = 26×220 tics), et boit à même un jet d'eau permanent après en avoir
cassé un (+1 PV illimité).

Contraintes déjà en place, héritées de l'ADR 0031 (portes/vitres) :

- **Le budget de lots de dessin**, mesuré à 200, pire vue déjà à 198. Un
  sanitaire de plus ne doit pas coûter un lot de plus.
- **Le graphe de navigation et les lignes de vue ennemies sont calculés une
  fois, au chargement**, filtrés sur `GROUP.WORLD` ([ADR 0030](0030-props-dynamiques.md)).
- **Invariant #1** (pas fixe strict), **#10** (aucune animation ne bloque le
  joueur — Duke fige ~2 s pendant l'acte, hors de question ici), **#12** (RNG
  déterministe), **#13** (aucune durée sur `setTimeout` réel).
- Le niveau v2 avait déjà un `use_toilet` PLACEHOLDER (`+1 PV` littéral,
  blague assumée sur sa dérision) dans `hypermarche_complet` — pas de vraie
  règle Duke, pas de casse, pas de jet d'eau.

## Décision

### Un préfixe `sanitaire_*`, calqué sur `vitre_*`

`game/level/sanitaires.ts` reprend l'architecture de `game/level/vitres.ts`
telle quelle : `loader.ts` construit un `SanitaireCandidate` par mesh
(collider cuboid FIXE déjà posé, groupe WORLD), `mergeSanitaireDecor` les
fusionne en **un lot de dessin par matériau pour TOUT le niveau** (pas de
découpe en cellules — une salle de toilettes pèse quelques centaines de
triangles, la fusion sert ici à tenir le budget de LOTS, pas à écarter du
rendu hors champ), et `SanitaireSystem` porte l'état de partie par-dessus
(cassé ou non, plage de sommets écrasée sur son centre à la casse).

Trois différences avec `vitre_*` :

0. **Élagué à 48 m, comme un `use_*`** (ajouté après mesure en jeu, le
   2026-09-24). Le verre ne peut pas l'être (on voit à travers une galerie
   entière) ; une cuvette, si : à 48 m elle fait quelques pixels. Sans
   élagage, le lot de la salle était dessiné depuis le parking extérieur, à
   80 m, dans la pire vue du niveau. `mergeSanitaireDecor` expose ses meshes
   rendus (`rendus`) et `interpolateVisuals.ts` les passe au même
   `UseObjectCulling` que les `use_*`.
1. **Toujours un collider** — un sanitaire est un meuble, jamais une
   verrière (`solide` n'a pas d'équivalent ici).
2. **`sorte`** (`"cuvette"`/`"urinoir"`) est **OBLIGATOIRE** : contrairement
   à `matiere`/`mouvement`, son ABSENCE avertit bruyamment, pas seulement une
   valeur invalide — l'objet n'a pas de comportement par défaut raisonnable
   sans savoir de quel appareil il s'agit. Repli sur `"cuvette"` (la plus
   fréquente au plan de masse), jamais un silence ni un crash.

### Deux gestes, une seule règle

`game/session/sanitaires.ts` porte la règle Duke, en une seule fonction par
geste, appelée depuis DEUX points d'entrée :

- `relieveAtSanitaire(session)` : soulagement à un sanitaire INTACT — +10 %
  du PV max (arrondi), plafonné, puis un délai **GLOBAL** de 220 s de
  GAMEPLAY (`session.sanitaireReliefCooldown`, décrémenté au pas fixe par le
  `gameplayDt` réel, hitstop inclus — jamais un temps mural) avant le
  prochain, un seul compteur pour TOUS les sanitaires du niveau. La chasse
  d'eau (`sanitaire_use`) part dans tous les cas ; pendant le délai ou à PV
  pleins, rien ne soigne. Appelée par `trySanitaire` (nouveau préfixe
  `sanitaire_*`) ET par `onToiletUse` (compatibilité `use_toilet`,
  `hypermarche_complet`) : **une seule règle dans le jeu**, l'ancien
  `TOILET_HEAL_AMOUNT = 1` littéral a disparu.
- Gorgée (fonction privée, dispatchée par `trySanitaire`) : à un sanitaire
  CASSÉ, +1 PV par appui, illimité, plafonné au max, son `water_drink` —
  jamais de délai.

`trySanitaire(session, usePressed, playerPosition, eyeOffset, yaw, pitch)` est
le point d'entrée unique côté `updateGameplay.ts` : lance le rayon de visée,
résout le sanitaire visé et dispatche. Priorité de l'appui E, dans
`updateGameplay.ts` : `use_*` (`InteractionSystem`, inchangé) d'abord, puis le
sanitaire VISÉ, puis la porte manœuvrable la plus proche
(`doorSystem.actionner`) — même patron que le `consomme` déjà en place pour ne
jamais faire réagir deux choses au même appui.

### Portée — visée (révision du 2026-09-24, retour de playtest)

Le premier jet mesurait la portée comme un `use_*` générique : distance au
point le plus proche de la bbox monde du sanitaire, 2 m, sans regarder où le
joueur vise (`SanitaireSystem.nearestInRange`, disparue depuis). Retour de
l'utilisateur, mot pour mot : « la zone d'action quand tu appuies sur E pour
allumer les toilettes, elle est trop grande. Même si je regarde pas les
toilettes, et que je suis pas vraiment devant collé, je peux quand même
activer et avoir le bruit de la chasse d'eau. » Un sanitaire n'est pas un
levier qu'on frôle en passant : Duke 3D lui-même exige d'être DANS le secteur
de l'appareil (`checksectors` teste le secteur courant du joueur, pas une
distance).

Remplacé par un "neartag" façon Duke 3D : un rayon Rapier part de l'œil du
joueur (même origine que les armes, `weaponEyeOrigin` —
`game/player/weapons.ts`) dans la direction de visée courante
(`frame.yaw`/`frame.pitch`), filtré WORLD (murs, cloisons de cabine, colliders
de `sanitaire_*`). `SanitaireSystem.resolveAim` (`game/level/sanitaires.ts`)
interprète le résultat :

- **Sanitaire INTACT** : doit être le PREMIER collider touché par le rayon,
  à `SANITAIRE_AIM_RANGE_METERS` (1,4 m) — une cloison de cabine plus proche
  bloque, exactement comme elle bloquerait un tir. Portée volontairement
  COURTE, distincte de `USE_RANGE_METERS` (2 m, la portée générique d'un
  `use_*`) : viser une cuvette exige de s'y tenir devant et de baisser les
  yeux (œil à 1,6 m, cuvette contre son mur à ~0,4-0,8 m de haut — le trajet
  œil → cuvette mesure grossièrement 1,3 m à bout portant) ; viser un urinoir
  se fait de face, à bout de bras. 1,4 m couvre les deux sans laisser un
  joueur qui regarde vaguement dans la bonne direction depuis le milieu de la
  pièce déclencher la chasse d'eau.
- **Sanitaire CASSÉ** : son collider est désactivé à la casse (`destroy`), il
  ne peut donc plus être le premier hit du rayon — on vise à la place le
  volume vertical de son jet (boîte alignée aux axes ancrée sur `jetOrigin`,
  ~1,5 m de haut, 0,3 m de rayon horizontal, "quelques dizaines de cm" comme
  demandé). Le volume doit être atteint AVANT tout obstacle WORLD trouvé par
  le même rayon (`rayJetVolumeEntry` comparé à la distance du premier hit
  WORLD, marge `JET_BLOCK_EPSILON_METERS` pour l'imprécision flottante) —
  sinon une cloison ou un mur est entre le joueur et le jet, refusé.

Le rayon lui-même (`RaycastService.use(...)`, `session.physics`) est lancé
par `game/session/sanitaires.ts::trySanitaire` — seul endroit du jeu qui
connaît `RaycastService`/`PhysicsWorld` côté sanitaires, même séparation que
`vitre_*`/`prop_*`. `SanitaireSystem.resolveAim` ne fait QUE l'interprétation
géométrique du résultat qu'on lui passe, il ne connaît pas Rapier.

`onToiletUse` (compatibilité `use_toilet`, `hypermarche_complet`) N'EST PAS
concerné : ce préfixe historique reste un ramassage par proximité seule
(aucune variante cassée à viser), comme avant cette révision.

### Tir ennemi : `BreakableHitTarget`, généralisé plutôt que dupliqué

`enemyMachine.ts::handleEnemyShotMiss` cassait déjà une vitre d'un coup sur
un tir ennemi raté (`VitreHitTarget`, une seule cible). Plutôt que dupliquer
cette fonction pour les sanitaires, l'interface est renommée
`BreakableHitTarget` (alias `VitreHitTarget` conservé pour la
rétrocompatibilité des imports existants) et `handleEnemyShotMiss` prend
maintenant un TABLEAU de cibles — le premier collider reconnu par une cible
de la liste la casse, les suivantes ne sont pas essayées :

```ts
handleEnemyShotMiss([updateCtx.vitreSystem, updateCtx.sanitaireSystem], hit.collider, false, point, direction);
```

`VitreSystem` et `SanitaireSystem` satisfont toutes deux l'interface sans
rien déclarer de spécial (même contrat `tryBreakByColliderHandle`).
`EnemyUpdateContext` gagne un champ `sanitaireSystem?: BreakableHitTarget`,
`SuitManager.update`/`DirectorManager.update` gagnent un paramètre du même
nom, en dernière position — même précédent que `vitreSystem` avant eux.

### Un sanitaire cassé reste un obstacle dans le graphe de navigation — accepté

Comme un `prop_*` ou une `vitre_*` cassée, un sanitaire cassé garde son
collider WORLD tel qu'il était AU CHARGEMENT pour le bake du graphe de
navigation et les lignes de vue ennemies (calculés une seule fois, voir
[ADR 0030](0030-props-dynamiques.md)) — casser une cuvette ne rouvre donc
jamais un chemin pour un Costard. Accepté sans hésitation : un sanitaire est
un meuble contre un mur, jamais posé pour bloquer un passage, et rebaker le
graphe à chaque casse coûterait bien plus que ce que ça résoudrait ici
(contrairement à une porte, dont c'est justement le rôle).

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| **Dupliquer `handleEnemyShotMiss` pour les sanitaires** | Deux fonctions identiques à faire évoluer ensemble pour toujours — le tableau de cibles règle ça une fois |
| **Un délai de soulagement PAR sanitaire, pas global** | Duke a un seul compteur ; un délai par appareil inciterait à faire la tournée des cabines pour spammer le soin, contraire à l'esprit de la blague |
| **Figer le joueur ~2 s pendant le soulagement, comme Duke** | Invariant #10 : aucune animation ne bloque le joueur, non négociable |
| **`sorte` silencieuse si absente (comme `matiere`/`mouvement`)** | Il n'y a pas de repli visuel/sonore raisonnable sans savoir cuvette ou urinoir — un silence masquerait une vraie faute de données Blender |
| **Un mesh par sanitaire, jamais fusionné** | Même raison que `vitre_*` : le budget de 200 lots ne survit pas à une salle de toilettes avec plusieurs cabines/urinoirs comptés un par un |
| **Rebaker le graphe de navigation à chaque sanitaire cassé** | Coût disproportionné pour un meuble qui ne bloque jamais un passage réel — voir la section dédiée ci-dessus |
| **Garder la portée par distance à la bbox, juste la raccourcir** | Ne corrige pas le vrai défaut décrit par l'utilisateur : un joueur dos tourné à 1 m resterait "à portée" sans jamais regarder l'appareil |
| **Exiger de viser, mais garder `USE_RANGE_METERS` (2 m)** | Viser à 2 m à travers une pièce ouverte reste trop permissif pour un geste qui suppose de s'y tenir devant — la portée du "neartag" est un choix distinct de celle d'un `use_*` générique |

## Conséquences

- **`LevelStats` gagne `sanitaireCount`/`sanitaireBatchCount`**, journalisés
  au chargement comme `vitreCount`/`vitreBatchCount`
  (`game/session/spawning.ts`).
- **`GameSession` gagne trois champs** : `sanitaireSystem` (reconstruit à
  chaque `onLoaded`, hot reload compris — les sanitaires reviennent intacts
  avec le fichier), `sanitaireReliefCooldown` (état de PARTIE, remis à 0 par
  `bootGameSession`) et `sanitaireReliefRandom` (générateur RNG dédié au
  choix de la réplique de soulagement, invariant #12 — jamais
  `Math.random()`, le choix se fait DANS le pas fixe donc le rejeu d'input en
  dépend).
- **`FxSystem.addWaterJet`/`clearWaterJets`** (implémentés par la passe
  `retro-render`, hors scope de cet ADR) : les jets d'eau sont VIVANTS tant
  que la partie l'est, nettoyés à tout rechargement de niveau et à tout
  reset de partie (`teardownGameSession`) — sans quoi un jet de l'ancienne
  partie flotterait dans la nouvelle.
- **L'ancien `use_toilet` change de comportement** : +1 PV fixe devient
  +10 % du max avec délai partagé, la chasse d'eau (`sanitaire_use`) est
  jouée à chaque usage (elle ne l'était pas avant), et un message « Rien ne
  vient. » peut apparaître pendant le délai — écart assumé, c'est le sens
  même de la demande (« comme dans Duke »).

## Comment on saurait qu'on a eu tort

Si le délai de 220 s se révèle trop long en jouant (le joueur ne revoit
jamais un sanitaire assez tôt pour en profiter une deuxième fois en 8-10
minutes de partie), le raccourcir plutôt que le retirer — la répétabilité
fait partie de la blague.

Si un Costard tire assez souvent sur un sanitaire pour que la casse
systématique surprenne (« pourquoi mes toilettes explosent, je n'ai pas
tiré dessus »), même diagnostic que pour les vitres (ADR 0031) : resserrer
le jitter d'attaque ennemi plutôt que retirer l'effet.

Si `SANITAIRE_AIM_RANGE_METERS` (1,4 m) se révèle trop court en jouant (viser
une cuvette depuis une position naturelle rate le rayon), l'élargir
légèrement plutôt que revenir à une portée par distance — le défaut corrigé
ici est justement l'absence de condition de visée, pas la valeur numérique de
la portée.
