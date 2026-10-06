---
title: Armes
tags: [fonctionnel]
status: stable
updated: 2026-10-05
---

# Armes

## Ce que vit le joueur

Selon le niveau, vous démarrez déjà équipé ou sans arme. Sans arme, le clic
gauche donne un coup de pied. Sur le niveau complet, vous n'avez rien en poche
au départ : le pied-de-biche traîne
au sol tout près, et vous le ramassez simplement en marchant dessus, sans
rien à confirmer. Le pistolet et le fusil à pompe s'obtiennent plus loin de
la même façon — en marchant sur eux, jamais à la touche `E`, qui reste
réservée aux portes, aux sanitaires et aux autres objets du niveau. Posées au
sol, les armes se tiennent dressées face à vous plutôt que couchées à plat,
avec un léger flottement et une lueur qui pulse doucement : de nuit, une arme
couchée se perdait dans le décor.

Ramasser une arme que vous possédez déjà a un effet différent selon
laquelle : le pistolet se comporte alors comme une boîte de munitions et
recharge votre réserve jusqu'à un plafond ; le pied-de-biche et le pompe,
eux, n'ont rien de plus à offrir et restent simplement au sol.

Changer d'arme se fait au clavier, à tout moment. Le geste de rangement puis
de dégainement qui accompagne le changement est purement visuel : il ne vous
empêche jamais de bouger, de sauter ou de tirer, et un nouveau tir peut
partir avant même que l'arme ait fini de remonter à l'écran. Il n'existe
aucun rechargement à proprement parler : chaque arme a sa réserve, qui se vide
au tir. Une fois à sec, appuyer sur le bouton de tir ne fait rien — pas de
geste qui vous bloque, pas de son de clic qui casse le rythme, juste un coup
qui ne part pas.

### Le coup de pied

Disponible dès le départ, sans ramassage ni munition. La chaussure entre dans
le champ pendant la frappe puis se retire. Le coup touche le premier obstacle
devant vous à courte portée : un ennemi, un meuble cassable ou le décor.
Il fait moins de dégâts et porte moins loin que le pied-de-biche. Vous pouvez
continuer à marcher, courir et sauter pendant le geste.

Ramasser une arme l'équipe normalement. Tant que vous n'avez pas le
pied-de-biche, la touche de mêlée permet de revenir au coup de pied.

### Le pied-de-biche

Votre arme de dernier recours, celle qui ne manque jamais : un coup de
corps-à-corps qui pardonne une visée un peu imprécise à bout portant, sans
la moindre munition à surveiller. Il faut deux coups pour abattre un
Costard. La cadence est la plus lente des trois armes, et le recul du coup
est bien senti, sans pour autant vous retarder au coup suivant.

### Le pistolet

L'arme intermédiaire, précise et rapide, avec la plus longue portée des
trois : cinq balles suffisent à abattre un Costard. Tirer vite élargit un
peu la dispersion des tirs, mais reste maniable même en rafale. C'est
l'arme qui recule le moins et dont la visée se stabilise le plus vite après
un tir. C'est aussi la seule dont la réserve se complète en jeu, aux boîtes
de munitions trouvées au sol, jusqu'à un plafond au-delà duquel une boîte
supplémentaire reste sans effet et au sol.

### Le fusil à pompe

L'arme la plus puissante à courte portée : chaque tir envoie une gerbe de
plombs dans un cône assez large. À bout portant, quand tous les plombs
touchent, un seul tir suffit à abattre un Costard d'un coup — c'est
d'ailleurs pour cet effet précis que son réglage a été calé. À mesure que la
cible s'éloigne, les plombs se dispersent et de moins en moins touchent :
le pompe perd nettement de son mordant à distance, où le pistolet devient le
meilleur choix. C'est la cadence la plus lente des trois, avec le recul le
plus marqué, un éclair visible au bout du canon et une douille éjectée à
chaque tir. Sa réserve de munitions est fixe dès le ramassage : rien dans le
niveau ne la renfloue ensuite.

### Ce que les armes touchent

Peu importe l'arme utilisée, un ennemi touché encaisse les mêmes dégâts par
plomb ou par coup, saigne visiblement, et déclenche un bref ralenti et une
secousse d'écran plus marqués que sur un simple mur. Le décor fixe garde une
marque d'impact durable ; un ennemi, une porte, un prop poussable, une vitre
ou un sanitaire n'en gardent jamais, même quand ils encaissent le tir comme
n'importe quelle autre cible — certains d'entre eux finissent par se briser.
Le détail de ce qui casse, avec quoi et ce qui en sort, est décrit dans
[Objets interactifs](objets-interactifs.md).

## Règles

- Le niveau décide si vous démarrez armé ou non ; sans arme, le clic gauche
  donne un coup de pied. Le pied-de-biche reste le premier ramassage du jeu.
- Une arme posée au sol se ramasse en marchant dessus, jamais à la touche
  `E`.
- Ramasser une arme déjà en poche ne fait rien pour le pied-de-biche et le
  pompe ; pour le pistolet, cela recharge des munitions jusqu'à un plafond.
- Changer d'arme, tirer, se déplacer ou sauter ne sont jamais bloqués par le
  geste d'une autre action : aucune animation n'immobilise le joueur.
- Aucune arme ne se recharge : chaque coup consomme sa réserve, et une
  réserve vide rend le tir silencieusement inopérant.
- Seul le pistolet a des munitions qui se complètent en jeu ; le pompe part
  avec une réserve fixe jamais renflouée ; le pied-de-biche n'a pas de
  munitions du tout.
- Toucher un ennemi produit toujours un retour plus marqué (ralenti,
  secousse, sang) que toucher le décor, quelle que soit l'arme utilisée.

## Valeurs

Comparaison qualitative des trois armes :

| | Pied-de-biche | Pistolet | Fusil à pompe |
|---|---|---|---|
| Portée | Contact | La plus longue | Courte, chute vite avec la distance |
| Cadence | La plus lente | La plus rapide | Lente |
| Précision | Sans objet (contact) | Bonne, se dégrade un peu en rafale | Dispersée en cône, imprévisible au-delà de la courte distance |
| Coups pour abattre un Costard | Deux | Cinq | Un seul à bout portant, plusieurs à distance |
| Munitions | Aucune, illimité | Réserve rechargeable au sol | Réserve fixe, jamais renflouée |
| Recul ressenti | Modéré | Le plus léger | Le plus fort |

Détail chiffré (dégâts, cadence, portée, dispersion, points de vie des
ennemis et des objets cassables) : `6-reference/valeurs-armes.md`.

## État

- Validé en playtest : le combat rapproché au pied-de-biche puis au pompe
  contre plusieurs Costards, jugé fun malgré des armes encore provisoires
  (retour de tout début de prototype, avant les vrais modèles ci-dessous).
- En attente de verdict : les modèles 3D du pied-de-biche et du pompe tenus
  à l'écran (2026-09-13), la reconstruction récente du pistolet, la
  disparition de l'éclair blanc qui accompagnait autrefois le coup de
  corps-à-corps, et le nouveau ramassage des armes au sol en marchant
  dessus avec leur affichage dressé de nuit (2026-09-25) — aucun n'a encore
  été confirmé par une vraie partie jouée.

## Pour aller plus loin

- Le fonctionnement interne des tirs, des tests de portée et de la
  dispersion : `4-technique/armes.md`.
- Les modèles d'armes tenus à l'écran et leurs animations : `4-technique/sprites-et-viewmodel.md`.
- Toutes les valeurs numériques de combat : [Valeurs des armes](../6-reference/valeurs-armes.md).
- Ce qui se casse au tir dans le niveau : [Objets interactifs](objets-interactifs.md).
