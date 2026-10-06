---
title: Métro — board et cotes de départ
tags: [journal, metro, references, level-design]
status: brouillon
updated: 2026-10-06
---

# Métro — board et cotes de départ

## Période

6 octobre 2026, lot N1 demandé par l'utilisateur après N0.

## Objectif

Choisir des images de référence et transformer leurs caractéristiques en
contraintes pour N2 et les kits. Le plan exige la validation du board par
l'utilisateur avant la suite.

## Livré et preuve

- [Planche de huit images](../assets/board-metro.html), toutes ouvertes dans
  le navigateur et regardées ; chargement des huit images confirmé.
- [Fiche de référence](../assets/board-metro.md) : usages des lieux,
  signatures, palette proposée, densité du mobilier et cotes utiles.
- [Coupe SVG](../assets/metro-cotes.svg), ouverte et relue : station à deux
  voies, niveaux de quai et niche hors de la bande dangereuse.
- [Mesures chromatiques](../assets/metro-reference-mesures.json), sept images
  regroupées en cinq familles, empreintes et URLs conservées. Les images
  originales restent en fichiers temporaires ; elles ne sont pas copiées
  dans les assets du dépôt.

Le board passe du quartier nocturne à la station publique, puis aux
installations techniques, et finit sur une montée monumentale froide.
Le marbre privé et la tour originale sont des propositions ; les images
ne constituent pas des relevés métriques ni des décisions de cadrage.

## Rejeté et raison

- La copie d'un réseau et de sa livrée : le niveau demande un réseau fictif.
- Une couleur d'ennemi censée fonctionner partout : les mesures des quais,
  de l'intérieur et de l'arrivée donnent moins de 3 de contraste minimal.
  La composition et l'éclairage de N4 devront assurer la lisibilité.
- Le bord de mur du tunnel comme refuge : capsule et marge dépassent le
  recul disponible dans un tube de 4,5 m. Prévoir des niches creusées.
- L'emploi direct d'un plafond à 2 m : la capsule entière mesure déjà 2 m.
- La palette KMeans du script telle quelle : scikit-learn est absent.
  Quantification Pillow MEDIANCUT, fonctions de profil existantes conservées,
  méthode documentée sans ajouter une dépendance au projet.

## Leçons et suite

Les dimensions du code priment sur le résumé d'un skill. La charte propose
un quai à 0,75 m, des marches de 0,25 m et des niches tous les 12 m, mais
les temps de fuite restent des estimations. N2 vérifie le plan et les
enveloppes réelles ; N4 juge le rendu et les déplacements en jeu.

**Board et charte validés par l'utilisateur le 6 octobre 2026** (« je valide »).
N2 peut reprendre le tracé selon cette direction. Aucune suite de tests
automatisés n'est ajoutée ou exécutée. N1 ne modifie aucune scène de jeu.
