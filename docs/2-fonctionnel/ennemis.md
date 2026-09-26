---
title: Ennemis
tags: [fonctionnel]
status: stable
updated: 2026-09-25
---

# Ennemis

## Ce que vit le joueur

Deux types d'ennemis peuplent l'hypermarché : le Costard, l'employé de base,
et le Directeur, patron unique du niveau, affronté à la toute fin.

### Le Costard

Un homme en costume ardoise, cravate rouge et lunettes noires. Au repos, il
ne réagit à rien tant que vous restez hors de sa vue ou trop loin (au-delà
d'une vingtaine de mètres) : vous pouvez le croiser du regard sans qu'il
bronche, comme les deux employés qui rôdent au loin dès l'entrée du parking.

Dès qu'il vous repère — assez près, avec une ligne de vue dégagée — il marque
un temps d'arrêt visible, l'air alerte, avant de se lancer à votre poursuite :
un bref instant pour réagir avant que la chasse commence. En poursuite, il
contourne les meubles et les murs sur son chemin, prend un escalier s'il faut
monter, et pousse une porte de bureau fermée plutôt que de rester bloqué
devant. Il vous perd s'il vous perd de vue assez longtemps (quelques
secondes) et retourne à son inactivité.

Une fois assez près et la ligne de vue dégagée, il s'arrête, épaule son
pistolet et le tient en joue un court instant — c'est le moment de réagir,
en bougeant ou en vous mettant à couvert — avant que le coup ne parte
réellement. S'il vous rate parce que vous vous êtes écarté à temps, il ne
retente pas tout de suite : il lui faut un peu de temps avant de pouvoir
tirer à nouveau. Un tir qui vous touche vous fait perdre un peu de vie et
secoue légèrement l'écran.

Encaisser un coup de votre part le fait reculer sous l'impact et l'immobilise
un court instant, visiblement chancelant, avant qu'il ne reprenne la chasse.
Tué à l'arme de corps-à-corps ou au pistolet, il s'écroule en plusieurs poses
successives (à genoux, une supplication, une chute) avant de rester à plat au
sol, un corps parmi le décor. Tué au fusil à pompe à bout portant, il
n'a pas cette agonie : le coup l'envoie en pièces sur place.

### Le Directeur

Le patron de l'hypermarché, rencontré seul dans son bureau au sommet du
niveau, en costume beige plutôt que noir. Il partage l'essentiel du
comportement du Costard — repérage, temps d'alerte, poursuite, télégraphie
avant le tir, recul à l'impact — mais en version boss : bien plus résistant,
plus lent à poursuivre, et son tir fait plus mal. Il engage sans détour dès
que vous entrez dans son bureau, escorté d'un garde du corps : pas d'approche
furtive possible, la confrontation est immédiate.

Passé la moitié de ses points de vie, sa peau humaine se déchire pour
révéler un reptilien en dessous : bascule uniquement visuelle, son
comportement de combat ne change pas. À sa mort, il lâche la carte Platine à
ses pieds — invisible un court instant avant de pouvoir la ramasser, pour
éviter qu'un coup achevé à bout portant ne la fasse disparaître aussitôt
récupérée. Contrairement au Costard, il ne se déchiquette jamais en morceaux,
quelle que soit l'arme : la mise en scène de sa mort et de sa révélation
prime.

## Règles

- Un ennemi ne réagit à vous qu'à portée de vue et avec une ligne de vue
  dégagée ; un obstacle assez haut (au-dessus de vos yeux) bloque
  entièrement son regard, un obstacle bas ne fait que gêner vos pas.
- Le repérage marque toujours un temps d'arrêt avant la poursuite, et la mise
  en joue marque toujours un temps d'arrêt avant le tir : un ennemi ne vous
  touche jamais sans un instant pour réagir.
- Un tir qui rate parce que vous vous êtes mis à couvert ne se répète pas
  immédiatement ; il y a toujours un délai minimum entre deux tirs du même
  ennemi.
- Encaisser un coup vous fait toujours reculer un peu avant que l'ennemi ne
  reprenne la poursuite, jamais l'inverse.
- Un ennemi tué au fusil à pompe assez près se déchiquette au lieu de
  s'écrouler normalement ; le Directeur ne se déchiquette jamais.
- Plusieurs ennemis groupés se bousculent entre eux plutôt que de se
  traverser, mais un tir ennemi ne touche jamais un autre ennemi : pas de
  dégâts entre eux.
- Un meuble ou un carton poussable ne vous protège pas d'un tir ennemi, qui
  le traverse ; une vraie rangée de rayonnage, elle, bloque la vue et
  protège réellement. Une allée dégagée, à l'inverse, ne cache jamais
  personne d'un bout à l'autre — l'embuscade se prépare toujours à
  l'intersection, jamais en ligne droite.
- Un tir ennemi qui vous rate joue un son distinct au moment du coup, pensé
  pour rester audible même par-dessus le bruit de votre propre arme : c'est
  ainsi que vous savez qu'on vous tire dessus hors champ.
- Le Directeur lâche systématiquement la carte Platine à sa mort ; elle se
  ramasse en marchant simplement dessus, comme les autres cartes.

## Valeurs

Comparaison qualitative :

| | Costard | Directeur |
|---|---|---|
| Robustesse | De base | Bien plus résistant (plusieurs fois la vie d'un Costard) |
| Vitesse de poursuite | Normale | Un peu plus lente |
| Dégâts par tir touché | Modérés | Plus élevés |
| Portée d'attaque | Longue | Un peu plus courte |
| Révélation | Aucune | Peau reptilienne sous la moitié de sa vie |
| Mort au pompe à bout portant | Se déchiquette | Ne se déchiquette jamais |
| Butin à la mort | Aucun | Carte Platine |

Détail chiffré (points de vie, portées, délais, dégâts) :
`6-reference/valeurs-ennemis.md`.

## État

- Validé en playtest : le combat rapproché contre plusieurs Costards, jugé
  fun dès le tout début du prototype (Phase 3) malgré des ennemis encore
  provisoires (rectangles de couleur, pas les sprites actuels). Les dégâts
  par tir du Costard ont depuis été revus à la baisse après une vraie
  partie sur le niveau complet, où l'affrontement à plusieurs vidait la vie
  du joueur trop vite.
- En attente de verdict : les sprites animés actuels des deux ennemis
  (2026-09-13), la poursuite à travers portes et escaliers sur le niveau
  habillé (le vrai calcul de chemin ne fonctionne de façon fiable que
  depuis le 2026-09-11, trop récent pour avoir été éprouvé sur l'ensemble
  du niveau), la bousculade entre ennemis groupés (2026-08-23), et le
  nouveau réglage de la carte Platine posée aux pieds du Directeur avec son
  délai avant ramassage (2026-08-22).

## Pour aller plus loin

- Le fonctionnement interne de la machine à états, de la perception et du
  calcul de chemin : `4-technique/ennemis-et-ia.md`.
- Le calcul de chemin à travers le niveau : `4-technique/pathfinding.md`.
- Les sprites animés et leurs planches d'angles : `4-technique/sprites-et-viewmodel.md`.
- Toutes les valeurs numériques de combat : `6-reference/valeurs-ennemis.md`.
- Ce que les armes du joueur infligent à un ennemi : [Armes](armes.md).
