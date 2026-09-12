---
title: L'occlusion des lignes de vue ennemies est fiable, et le level design peut s'y fier
tags: [adr, entites, level-design, physique]
status: accepte
updated: 2026-09-12
---

# ADR 0025 — L'occlusion des lignes de vue ennemies est fiable

Remplace l'[ADR 0022](0022-occlusion-rangees-non-bloquante.md).

## Contexte

L'ADR 0022 constatait, sur deux zones et deux pièces de kit différentes, que
poser un `spawn_suit_*` derrière une rangée ne suffisait pas à le garder
endormi : l'ennemi se réveillait et attaquait dès le chargement, malgré une
géométrie et des colliders vérifiés corrects. Faute de cause, il avait acté
un contournement par la distance et une consigne de défiance : ne jamais
compter sur l'occlusion pour du placement d'ennemis.

Le jalon N5 du niveau v2 (`PLAN_NIVEAU_V2.md`) devait trancher avant que le
plan détaillé (N6) ne place un seul ennemi.

## Décision

**Le level design peut compter sur l'occlusion.** Une rangée de gondoles ou
de racks bloque réellement la ligne de vue ennemie ; la consigne de défiance
de l'ADR 0022 est levée.

La cause du symptôme n'était pas l'occlusion mais **l'ordre des opérations au
chargement** : Rapier ne rend un collider visible aux requêtes de scène
qu'après un `world.step()` (voir [Physique — Colliders invisibles aux rayons
avant le premier pas](../systems/physique.md#colliders-invisibles-aux-rayons-avant-le-premier-pas)).
Le premier rayon de ligne de vue partait dans une broad-phase encore vide,
ne rencontrait rien, et l'ennemi « voyait » à travers la rangée. La
transition `alert -> chase` étant inconditionnelle
(`enemyMachine.ts::runAlert`), il restait éveillé ensuite et venait
contourner la rangée — ce qui se lit en jeu comme « l'occlusion ne marche
pas ».

Le correctif est déjà en place depuis le 2026-09-11 : `refreshSceneQueries()`
appelé au chargement (`game/session/spawning.ts`), posé pour le graphe de
navigation, qui répare la ligne de vue par la même occasion. **Aucune ligne
de code de gameplay n'a été écrite pour cet ADR.**

## Preuve

`test/game/entities/lineOfSight.test.ts` — 12 cas, sans aucun raycast
scripté : vrai `RaycastService`, vrai monde Rapier, vrai `Suit`, et pour les
cas décisifs les **`.glb` réellement exportés**, relus par
`GLTFLoader.parse`, aux positions de spawn d'origine. Les cas sur niveau réel
vérifient aussi **quel** collider arrête le rayon, pas seulement qu'il
s'arrête — une fixture qui passerait grâce à un obstacle oublié serait un
piège pour la suite.

| Fixture | Monde pas-sé | Résultat |
|---|---|---|
| `col_box_gondola_4m` isolée (sommet 2,0 m) | oui | `idle` — bloquée |
| idem | non | `alert` — le rayon traverse |
| Mur de coque à la place de la gondole | oui | `idle` — rien ne distingue une pièce `PROP` d'un mur |
| `kit_checkout` (1,10 m, sous les yeux à 1,6 m) | oui | `alert` — pas du couvert |
| Rien entre les deux (témoin) | oui | `alert` |
| Zone D, `spawn_suit_1` d'origine (−10, 0, −10), 14,1 m | oui | `idle` — arrêt sur `col_box_pillar` (−8,5 ; −8,5) |
| idem | non | `alert` — le rayon ne rencontre **rien** |
| Zone D, `spawn_suit_2` d'origine (10, 0, −10) | oui | `idle` — arrêt au coin exact de la rangée est (4 ; −4) |
| Zone C, couloir latéral ouest, vue **à travers** la rangée | oui | `idle` — arrêt en plein sur `col_box_gondola_4m` |
| Zone C, `spawn_suit_1` d'origine, joueur au spawn | oui | `idle` — arrêt sur un capuchon `col_box_gondola_end` |
| Zone C, même ennemi, joueur entré dans l'allée | oui | `alert` — plus rien sur le segment |

Deux surprises utiles au level design, que seule la mesure pouvait donner :
la position « occultée par la rangée » de la Zone D l'est en réalité par un
**pilier** posé pour tout autre chose, et celle de la Zone D est ne tient
qu'à un **effleurement du coin** de la rangée — occlusion réelle, robustesse
nulle, un pas de côté du joueur l'annule. Cette dernière répond à la question
laissée ouverte dans `tools/blender/README.md`.

L'hypothèse de l'ADR 0022 (« un gap général sur l'occlusion des pièces
`PROP` du kit ») est donc **écartée par la mesure**, pas par argument.

## Règles de placement qui en découlent (jalons N6 et N8)

1. **Une rangée couvre.** Un ennemi posé derrière une rangée de gondoles ou
   de racks reste `idle` tant que le joueur n'a pas de vue sur lui. Une
   embuscade par occlusion est un outil disponible.
2. **Une allée ne couvre rien.** Une allée entre deux rangées est une ligne
   droite dégagée d'un bout à l'autre : un ennemi en son centre voit le
   joueur dès que celui-ci y entre. L'embuscade se pose dans une allée
   transversale, jamais dans celle que le joueur regarde.
3. **Rien sous 1,6 m ne bloque un rayon.** `eyeHeight` vaut 1,6 m pour le
   joueur comme pour le Costard (1,8 m pour le Directeur) : caisses de
   sortie, palettes et comptoirs bas sont des obstacles de déplacement, pas
   du couvert. Un couvert utile dépasse 1,6 m, et 1,8 m face au Directeur.
4. **Tout code qui interroge le monde juste après avoir créé des colliders
   passe par `refreshSceneQueries()`** — la règle générale dont cet ADR n'est
   qu'un cas particulier.

## Conséquences

- Les spawns des Zones C et D pourraient revenir à leur position de plan
  d'origine. **Non fait, délibérément** : ces zones sont remplacées par le
  niveau v2 au jalon N10, le travail serait jeté.
- `docs/pipeline/niveau-blender.md` ne porte plus d'« écart connu » sur
  l'occlusion : il porte les règles ci-dessus.
- La consigne « vérifier en jeu, pas seulement par calcul » garde sa valeur,
  pour une autre raison qu'en 2026-09-06 : le calcul géométrique était juste,
  c'est l'état du moteur au moment du tir qui ne l'était pas.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Garder la défiance de l'ADR 0022 et continuer à écarter les spawns | aurait coûté au niveau v2 son seul outil d'embuscade, sur une cause désormais connue et corrigée |
| Exporter `hasClearWorldPath` pour le tester directement | élargit l'API du module pour un test ; `Suit.state` après un pas fixe EST déjà l'observation utile, et elle couvre la machine à états en plus du rayon |
| Fixtures synthétiques seules | ne prouvent rien sur le vrai `.glb` — or c'est justement la fidélité au fichier exporté qui manquait à l'ADR 0022 |

## Comment on saurait qu'on a eu tort

Si un `spawn_suit_*` posé derrière une rangée du niveau v2 se réveille
malgré tout **en jeu** alors que `lineOfSight.test.ts` reste vert, c'est que
la scène réelle diffère de la fixture sur un point non couvert ici —
candidats : un collider créé APRÈS le `refreshSceneQueries()` du chargement
(hot reload, porte qui s'ouvre, prop dynamique), ou un ennemi dont les yeux
dépassent le sommet de la rangée.
