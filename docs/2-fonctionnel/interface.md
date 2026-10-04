---
title: Interface
tags: [fonctionnel]
status: brouillon
updated: 2026-10-04
---

# Interface

## Ce que vit le joueur

### Le parcours d'écrans

Le jeu s'ouvre sur un menu principal, jamais directement en jeu. De là, un
chargement mène à la partie ; la partie peut se mettre en pause, se terminer
par une mort ou par une vraie sortie de niveau ; chacune de ces fins ramène
soit à une nouvelle partie, soit au menu.

```mermaid
stateDiagram-v2
  [*] --> MenuPrincipal
  MenuPrincipal --> ParamètresDuSignal
  ParamètresDuSignal --> MenuPrincipal
  MenuPrincipal --> ChoixDuProfil
  ChoixDuProfil --> MenuPrincipal
  ChoixDuProfil --> Chargement
  Chargement --> Jeu
  Chargement --> ÉchecDeChargement
  ÉchecDeChargement --> Chargement
  ÉchecDeChargement --> MenuPrincipal
  Jeu --> Pause
  Pause --> Jeu
  Pause --> MenuPrincipal
  Jeu --> Mort
  Jeu --> FinDeNiveau
  Mort --> Chargement : rejouer
  Mort --> MenuPrincipal
  FinDeNiveau --> Chargement : rejouer
  FinDeNiveau --> MenuPrincipal
```

Rejouer ou revenir au menu repart d'une partie neuve : cartes, munitions et
progression ne survivent pas.

### Menu principal

Le premier écran habille tout de suite le jeu en diffusion piratée : un
bandeau « SIGNAL INTERCEPTÉ », une légende de caméra
(« CAM_04 · RÉVEIL_DU_PEUPLE »), le titre « PROJET_CASSANDRE » sous
l'accroche « RÉVEIL_DU_PEUPLE — la vérité, en direct », et un bandeau
défilant sans lien avec la partie (« SIGNAL NON AUTORISÉ », « 200
ABONNÉS »…). Trois actions : « REJOINDRE LE DIRECT » mène au choix du
profil, « PARAMÈTRES DU SIGNAL » ouvre les options, « COUPER LA DIFFUSION »
tente de fermer l'onglet et l'explique en toutes lettres quand ça échoue.

### Choix du profil

Sous le titre « QUI ENTRE DANS LE MAGASIN ? », trois cartes côte à côte :
Client, Habitué, Lanceur d'alerte. Chacune porte une phrase d'ambiance, quatre
lignes qui disent ce que le profil change, et le record du joueur dans ce
profil. Un clic choisit et lance le chargement. Le dernier profil joué est
marqué d'une flèche et reçoit le focus. « ◀ RETOUR » ramène au menu. Le
détail est dans [Difficulté](difficulte.md).

### Paramètres du signal (options)

Trois onglets (souris ou flèches) : « CONTRÔLES », « AFFICHAGE » et
« AUDIO », un seul bouton de sortie « ◀ RETOUR », écran identique depuis le
menu principal ou la pause. **Contrôles** : liste des actions et leur touche (cliquer une ligne attend la
prochaine touche pressée, `Échap` annule), bouton de réinitialisation.
**Affichage**, quatre réglages : le *filtrage des textures lointaines* en
trois choix décrits par ce qu'on voit — « gros pixel partout, y compris au
loin » (origine), « gros pixel de près, lissé au loin », « gros pixel de
près, net même en rasant » (actuel) — sans jamais changer la netteté de
près ; la *résolution interne* ; le *champ de vision* de base ;
l'*intensité du screenshake* à l'impact (0 à 100 %).

### Chargement

Une barre de progression réelle, pourcentage et libellé de l'étape, à côté
d'une petite phrase qui change toutes les quelques secondes sur un ton
pince-sans-rire (« Décongélation du rayon surgelés… », « Le directeur est
en réunion. Il vous recevra. ») — jamais ce que fait vraiment le
chargement, c'est le rôle du libellé. En cas d'échec, elle laisse place à
un message d'erreur et un bouton « RÉESSAYER ».

### Pause

Déclenchée par la perte du verrouillage du pointeur (par exemple `Échap`),
jamais par un bouton dédié. Le jeu reste visible derrière, assombri et
flouté : « STREAM EN PAUSE », sous « La caméra tourne encore. Personne ne
le sait. » Trois actions : « ▶ REPRENDRE » redemande le verrouillage du
pointeur, « ⚙ PARAMÈTRES » ouvre le même écran d'options, « ◀ QUITTER VERS
LE MENU » abandonne la partie. Rouvrir la pause repart toujours de ce
menu ; un réglage d'affichage changé en pause s'applique sans reprendre.

### Mort et fin de niveau

Mourir affiche « STREAM COUPÉ » (« Ils ont eu ta connexion. Encore une
preuve, pense les 200 abonnés restants. »), les spectateurs au moment de
la coupure, et un récapitulatif **partiel** — sans bonus de rapidité, un
message le rappelle. Deux actions : « ▶ RECONNECTER » et « ◀ RETOUR AU
MENU ».

Franchir la sortie déverrouillée passe par les quatre panneaux de fin, puis
affiche « TRANSMISSION ACHEVÉE » et « ÉCHAPPÉ D'HYPER VARAN » (« Vidéo
retirée, chaîne suspendue. Mais les images existent, et toi, tu es
dehors. »). Sous un bandeau rouge « VIDÉO DÉMONÉTISÉE », le bilan du direct :
le pic d'audience, les abonnés gagnés et les dons reçus, « retenus par la
plateforme ». Ce bilan est informatif et ne compte pas dans le score. Suivent
le temps comparé au temps de référence et un récapitulatif **complet**, bonus
de rapidité compris. Deux actions : « ▶ REJOUER » et « ◀ RETOUR AU MENU ».

Dans les deux cas, le récapitulatif rappelle le profil joué et se révèle ligne
par ligne, boutons utilisables pendant toute la révélation. Sous le total
d'un niveau terminé, une ligne dit « NOUVEAU RECORD » ou rappelle le record à
battre. Barème complet : [Secrets et score](secrets-et-score.md).

### Le HUD « stream »

Toute la partie garde la même blague en fond : le joueur est un streameur
clandestin. En haut à droite, une webcam de 96 × 54 pixels virtuels montre
son visage et ses épaules, avec un badge clignotant « EN DIRECT » au-dessus
et la légende « RÉVEIL_DU_PEUPLE — 200 abonnés » dessous.
Ses blessures suivent cinq paliers de santé : 80–100 %, 60–79 %, 40–59 %,
20–39 % et 1–19 %. Il réagit aux coups, tirs, éliminations, ramassages,
soins, découvertes et répliques. La douleur prend la priorité sur les
réactions ordinaires. Au repos, il cligne des yeux et regarde sur le côté.
À la mort, la webcam de l'écran de mort montre son effondrement, puis
« SIGNAL PERDU ». La bouche accompagne actuellement la durée d'affichage
des répliques ; les prises de voix restent à intégrer.

Sous la webcam, le nombre d'abonnés et un compteur de « spectateurs en
direct ». L'audience monte avec ce que vous faites — un kill, une série, un
secret, de la casse, le Directeur plus que tout — et repart quand il ne se
passe rien, sans jamais retomber sous une part de son pic. Dessous, la
cagnotte des dons reçus, puis les répliques du héros, sous l'étiquette
« RÉVEIL_DU_PEUPLE dit : », avec un délai minimum entre deux.

En haut au centre passent les annonces du magasin et de l'interphone.

Près d'une borne, une invite s'affiche au centre de l'image, sous le réticule : la touche
d'usage, le produit, ce qu'il change et son prix, ou la mention qu'elle est
épuisée. Elle disparaît dès qu'on s'éloigne. Voir [Sponsors](sponsors.md).

En bas à gauche, au-dessus des cartes : le chat du direct, cinq lignes qui
commentent vos actions, et l'alerte du dernier don avec le mot du donateur.
Le chat ne dit jamais rien d'indispensable et se masque dans Options › Audio,
section Diffusion. Un donateur revient à chaque étape de l'histoire, dans une
teinte à part : voir [Histoire](histoire.md).

Puis : les cartes de fidélité en poche (si au moins une est
détenue), puis les PV en barre et en chiffres, colorés selon la vie
restante. En bas à droite : les munitions de l'arme en main — un compte de
cartouches pour pistolet et pompe, ou « PIED-DE-BICHE »/« À MAINS NUES ».

Deux canaux de message distincts se superposent : la réplique du héros
ci-dessus (cooldown de 15 secondes de gameplay, suspendu en pause) et un message système transitoire pour
les faits (porte déverrouillée, carte ramassée), sans aucun cooldown.

Un réticule reste affiché en permanence au centre exact de l'écran, seul
repère fiable de la direction de tir, et pulse à chaque tir. Un marqueur
distinct et plus bref confirme un tir qui a touché un ennemi (variante
propre à un coup qui l'élimine) ; un tir sur le seul décor ne l'affiche pas.

### Menu dev et accessibilité

Réservés au développement, absents du jeu livré : un lien discret du menu
principal vers un choix de niveau parmi les zones de test et blockouts, un
panneau de chiffres bruts à la place du compteur d'images du jeu livré, un
panneau de curseurs à chaud pour la sensation de jeu, replié par défaut et
basculé par une touche dédiée. Détail : `4-technique/debug.md`.

Le HUD grandit avec la fenêtre dans la même proportion que l'image du jeu ;
les écrans modaux (options, mort, fin de niveau, pause) gardent une taille
fixe — écart connu, pas un choix définitif. Chaque bouton est un vrai
bouton actionnable au clavier, les onglets des options se parcourent aux
flèches, les canaux de message et l'écran de chargement s'annoncent aux
lecteurs d'écran comme du contenu qui change. Aucun écran ne se ferme en
soumettant un formulaire.

## Règles

- Le menu principal est toujours le premier écran, sauf reprise d'une
  partie en cours par la pause.
- L'écran d'options est identique depuis le menu principal et la pause ;
  seul le bouton de retour change de destination.
- La pause ne s'ouvre que par perte du verrouillage du pointeur et repart
  toujours de son menu.
- Un récapitulatif de mort n'accorde jamais de bonus de rapidité ; seul un
  récapitulatif de fin de niveau réelle le peut.
- Rejouer ou revenir au menu, depuis n'importe quel écran de fin, repart
  d'une partie entièrement neuve.
- Les spectateurs, les abonnés et la cagnotte du HUD sont sans lien avec le
  score. Ils repartent de zéro à chaque partie.

## Valeurs

Aucune valeur numérique propre à cette page : barème de score dans [Secrets et score](secrets-et-score.md), contrôles dans `6-reference/controles.md`.

## État

- Validé en playtest : la direction « salle de contrôle » du HUD et sa
  disposition en coins d'écran.
- En attente de verdict : l'écran de choix du profil, l'invite des bornes et
  la ligne de record du récapitulatif (octobre 2026).
- En attente de verdict aussi : la pause sur perte de verrouillage du pointeur,
  les réglages d'affichage appliqués à chaud en pause, et le récapitulatif
  révélé ligne par ligne — ajoutés à la passe du 2026-09-25, jamais
  déclenchés par une vraie touche en conditions réelles.

## Pour aller plus loin

- Câblage React, store et machine de flux : `4-technique/interface-react.md`.
- Comment l'information passe du jeu vers l'interface : `3-architecture/flux-de-donnees.md`.
- Construction et démolition d'une partie, chargement d'un niveau : `3-architecture/cycle-de-vie.md`.
- Structure et règles d'écriture : `6-reference/react-structure.md`,
  `6-reference/react-bonnes-pratiques.md`, `6-reference/react-css.md`, `6-reference/react-composition.md`.
