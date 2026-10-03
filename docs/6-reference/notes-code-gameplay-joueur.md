---
title: Contrats du joueur et des armes
tags: [gameplay, joueur, armes, code]
status: brouillon
updated: 2026-10-03
---

# Contrats du joueur et des armes

## Déplacement et vue

Le KCC Rapier est la seule résolution de déplacement. Son origine est le centre
de capsule ; `spawn` reçoit la hauteur des pieds. La hauteur totale vaut deux
fois demi-hauteur plus rayon. La hauteur de l’œil est relative aux pieds.
L’accélération vise un vecteur normalisé pour éviter le bonus diagonal.
Le freinage se produit au sol ; en l’air, la vélocité est conservée sans input.
La gravité est celle du monde. Le KCC produit un déplacement, pas une vitesse.

Le snap est désactivé pendant une montée afin de ne pas écraser le saut.
La vitesse verticale est annulée en cas de plafond ou de réception. Les murs
recalculent la vitesse horizontale réalisée, afin de supprimer l’élan accumulé
contre un obstacle. Une rampe marchable ne doit pas être confondue avec un mur.
Le `groundStickSpeed` reste faible : une forte vitesse descendante augmente le
travail d’autostep et fait trébucher dans les marches.

Le saut est latched jusqu’à la réception. Coyote time et jump buffer sont des
compteurs gameplay ; leur valeur initiale est désactivée. Le `spawn` remet aussi
les grandeurs de vue à zéro, pour éviter un bob ou un dip de la partie précédente.
Le bob suit la distance réellement parcourue, pas un oscillateur au temps mural.
`approach` atteint exactement sa cible afin d’éviter une asymptote et des mises à
jour permanentes du FOV. La récupération du dip précède le nouveau choc de réception.

## Contrats des armes

Les trois armes partagent les entrées de visée du pas fixe. Les cooldowns, recul,
changements d’arme et munitions utilisent ce temps, ralenti par le hitstop.
Aucune animation ne bloque le joueur. Le viewmodel lit des sorties interpolées ;
il ne décide ni des dégâts ni de la cadence. Ses horloges saturent au repos afin
de ne pas interpoler des durées infinies ou un temps depuis le précédent niveau.

Le pompe garde une dotation unique, sans vrai chargeur ni rechargement. Le champ
`shotgunMagazineSize` décrit une capacité nominale, pas une mécanique branchée.
Un pied-de-biche ou pompe déjà possédé ne se consomme pas une seconde fois.
Un pistolet déjà possédé recharge son pool plafonné ; le pickup reste si ce pool
est plein. Le premier pistolet donne la dotation de départ et l’équipe.

Les événements possèdent des copies de position et de direction. Le tableau des
bouts de plombs est partagé avec l’événement créé avant son remplissage ; il est
complet avant la présentation. Les événements sont vidés une fois après lecture.
Le bit d’appartenance `ENEMY` détermine le matériau `flesh` ; le masque de filtre
ne doit pas être testé à sa place. Les murs utilisent actuellement `concrete`.
Le hitstop est posé à la source, une seule fois par impact ; le rendu applique
shake, particules et son sans recalculer les dégâts.

## Géométrie des attaques

La mêlée interroge une capsule couvrant le segment de visée. Le KCC joueur n’est
pas utilisé pour cette requête. L’axe natif Y de la capsule est tourné vers la
visée. Pour chaque collider, le point de contact est projeté depuis le point de
l’axe le plus proche ; le centre de la capsule ne suffit pas aux longs segments.
Une normale dégénérée utilise l’opposé de la visée.

Le pistolet et les plombs du pompe interrogent des rayons normalisés. Leur
`timeOfImpact` est donc une distance. Un rayon qui manque garde son bout à portée
maximale pour les gizmos. La dispersion échantillonne un disque uniforme avec
`radius = sqrt(u) * tan(angle)` ; un rayon uniforme aurait trop concentré les
plombs au centre. Pistolet et pompe utilisent le même générateur déterministe de
l’instance d’armes, recréé au boot. Le rendu n’utilise pas ce générateur.

## Tuning

Les configurations sont des objets mutables lus par référence. Les variantes
A/B/C sont des candidats de feel, pas des constantes immuables du moteur.
Les amplitudes de recul sont locales à la caméra ; les angles sont en degrés
dans la configuration et convertis au moment du kick. Le hitstop s’exprime en
secondes dérivées de `FIXED_DT`, les dimensions du réticule en pixels internes.
Les nombres et options détaillés restent dans [les valeurs de déplacement](valeurs-deplacement.md)
et [les valeurs d’armes](valeurs-armes.md).

## Comparaison du recul positionnel

`recoilPositionInterpolated` interpole le kick précédent/courant avant
l’application de l’enveloppe, comme le pitch. Le mode `STABLE` active cette
correction ; `HISTORIQUE` prend le kick courant immédiatement. Les amplitudes
restent identiques. Le panneau de tuning expose les deux modes et les cinq
paramètres de chaque arme. Enregistrer 15 secondes avec F9, arrêter avec F9
puis rejouer avec F10 dans chaque mode permet une comparaison sur les mêmes
entrées. Le ressenti n’a pas été validé par cet audit.
