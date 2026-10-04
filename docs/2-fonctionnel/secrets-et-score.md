---
title: Secrets et score
tags: [fonctionnel]
status: brouillon
updated: 2026-10-04
---

# Secrets et score

## Ce que vit le joueur

### Les secrets

Quatre secrets récompensent qui s'écarte du chemin obligé, chacun trahi par un
indice plutôt que par un marqueur sur une carte : un pan de mur qui s'efface
près d'un photomaton, une caisse qui permet de grimper sur le toit d'un
rayon, une bouche d'aération au-dessus d'un distributeur, une planque au fond
du local compacteur. Aucun n'est un
simple couloir de plus : chacun débouche sur une petite pièce construite pour
raconter quelque chose qu'on ne voit nulle part ailleurs dans le magasin,
plutôt que pour cacher un objet à ramasser.

Trouver un secret se remarque tout de suite : un message à l'écran annonce
« Secret trouvé ! » avec le compte à jour (par exemple 2/4), un son dédié se
joue, et le héros réagit à voix haute. Un secret déjà trouvé ne compte
qu'une fois, pour le reste de la partie.

### Le score

Chaque partie se termine par un récapitulatif : la liste de ce qui a rapporté
des points, révélée ligne par ligne, suivie du total. Mourir affiche un
récapitulatif partiel, sur ce qui a été accompli jusque-là ; terminer le
niveau pour de vrai en affiche un complet, avec en plus la récompense de
vitesse. Rien de tout cela ne ralentit ni ne bloque le joueur : le
récapitulatif s'affiche à côté des boutons de l'écran, jamais à leur place.

| Source | Points | Condition |
|---|---|---|
| Costard, Rampant ou Vigile éliminé | 100 chacun | Par ennemi neutralisé ; le récapitulatif les range sous la même ligne « Costards éliminés » |
| Directeur éliminé | 1 000 | À sa mort |
| Secret trouvé | 500 chacun | Par secret découvert |
| Bonus « tous les secrets » | 1 000 | Si les quatre secrets du niveau sont trouvés |
| Précision | Jusqu'à 1 000 | Proportionnel à la part des tirs qui ont touché un ennemi |
| Rapidité | 10 par seconde | Chaque seconde sous le temps de référence du niveau (dix minutes pour le niveau complet), seulement si la partie se termine par la vraie sortie |
| Vandalisme — meuble cassé | 10 chacun | Par prop détruit |
| Vandalisme — vitre brisée | 25 chacune | Par vitre cassée |
| Vandalisme — sanitaire cassé | 50 chacun | Par sanitaire brisé |

Le vandalisme rapporte, mais nettement moins qu'un ennemi neutralisé — casser
le décor est un à-côté, pas une stratégie de score. La récompense de rapidité
ne s'applique jamais à un récapitulatif partiel : mourir en cours de route ne
peut jamais rapporter de bonus de vitesse.

Une partie complète en « Habitué », sur le niveau actuel : une cinquantaine
d'ennemis et le Directeur éliminés (environ 5 000 + 1 000), les quatre
secrets trouvés avec le bonus (3 000), une précision de 60 % (600 points),
quelques meubles et une vitre cassés en chemin (140 points), et une sortie
deux minutes avant le temps de référence (1 200 points) — un peu moins de
11 000 points au total. Le nombre d'ennemis dépend du profil choisi : les
rencontres en amènent plus ou moins.

### Les records

Le récapitulatif rappelle le profil joué, par exemple « Difficulté :
Habitué ». Quand le niveau est terminé, il dit aussi où en est le record de
score dans ce profil : « NOUVEAU RECORD » si la partie vient de le battre ou
d'en poser un premier, sinon le record à battre.

Chaque profil a son propre record. Deux choses sont retenues : le meilleur
score et le meilleur temps, qui ne viennent pas forcément de la même partie.
L'écran de choix du profil les rappelle sur chaque carte.

Une mort n'inscrit rien : son récapitulatif est partiel.

### Le direct n'est pas le score

Le HUD affiche à part l'audience du direct, les abonnés et la cagnotte des
dons. Ils montent avec ce que vous faites, mais n'ont aucun lien avec le
score : l'écran de fin les présente dans un bilan séparé, sous le bandeau
« vidéo démonétisée ». Le détail est dans [Interface](interface.md).

## Règles

- Un secret compte une seule fois : le retrouver ensuite ne change rien.
- Le bonus « tous les secrets » ne s'ajoute qu'une fois les quatre trouvés
  dans la même partie — un secret manqué le retire entièrement.
- La récompense de précision monte avec la part de tirs qui ont touché un
  ennemi, jamais avec le nombre brut de tirs.
- La récompense de rapidité ne s'accorde que sur une vraie sortie de niveau,
  jamais sur un récapitulatif affiché après une mort.
- Casser le décor (meubles, vitres, sanitaires) rapporte toujours moins que
  neutraliser un ennemi, quelle que soit la quantité cassée.
- L'audience, les abonnés et les dons du direct sont indépendants du score :
  ils ne rapportent aucun point.
- Un record ne s'inscrit que sur un niveau terminé, dans le profil joué. Un
  score fait en « Client » ne touche pas le record d'un « Lanceur d'alerte ».
- Les records sont gardés sur ce navigateur ; ils ne suivent pas le joueur
  ailleurs.

## Valeurs

Le barème complet est déjà donné ci-dessus, tel qu'il apparaît au joueur
dans le récapitulatif : cette page ne fixe aucune autre valeur numérique.

## État

- Validé en playtest : le compteur de secrets et son message à l'écran (nom
  du secret trouvé, compte à jour) existent depuis une passe de niveau plus
  ancienne et ont été vérifiés en jeu à cette occasion.
- En attente de verdict : le barème complet du score, le récapitulatif de
  fin de partie (partiel à la mort, complet à la vraie sortie) et les quatre
  secrets du niveau actuel dans leur habillage définitif — ajoutés lors de
  la passe de playtest du 2026-09-25, aucun n'a encore reçu de verdict humain
  en conditions réelles. Les records par profil datent du 4 octobre 2026.

## Pour aller plus loin

- [Difficulté](difficulte.md) — les trois profils et ce qu'ils règlent.
- [Interface](interface.md) — le HUD façon stream, l'audience et les dons,
  les écrans de mort et de fin de niveau.
- Détail technique du calcul et de la construction du récapitulatif :
  `4-technique/session-et-score.md`.
