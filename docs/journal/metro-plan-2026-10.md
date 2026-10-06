---
title: Métro — plan de masse N2
tags: [journal, metro, level-design, plan]
status: brouillon
updated: 2026-10-06
---

# Métro — plan de masse N2

## Période

6 octobre 2026. N1 validé ; l'utilisateur demande de lancer N2.

## Objectif

Transformer le premier tracé en données cotées, vérifier les projections
des sols et réserver les voies, refuges, boucles et sources lumineuses.

## Livré et preuve

Le [plan candidat](../assets/plan-metro.md) rassemble le SVG, les données
de `tools/metro/layout/plan_n2.py` et le relevé produit par la même recette.
Le SVG est ouvert et regardé avant livraison ; les repères des galeries
et de la machinerie sont déplacés pour éviter leur confusion avec les secrets.

| Relevé | Résultat |
|---|---|
| Emprise des supports | 212,75 × 500,5 m |
| Supports navigables bruts | 14 650,25 m² en 243 fragments, sans mobilier |
| Surfaces nulles / projections superposées | 0 / 0 |
| Axes de voie hors grille | 0 |
| Tunnel A / B | 146,35 / 79,64 m |
| Refuges réservés | 19 niches, au pas de 12 m |
| Enveloppe XY de voiture | 269 poses dans A, 136 dans B ; aucun rectangle de voiture hors tube |
| Marqueurs fixes proposés | 118 ; pool du moteur à 48 par défaut |
| Enveloppes de budget par zone | 24–48, quatre places phares/signaux comprises |

Le contrôle d'enveloppe est échantillonné, horizontal, sur le rectangle complet
des voitures et exclut les extrémités sur 8 m. Les raccords, les portes,
l'aiguille, les altitudes des contacts de train et le rendu réel restent
aux lots T2/N5. Aucun playtest complet n'est déclaré.

## Rejeté et raison

- L'emprise de 340 m de long du croquis : les longueurs successives et les
  raccords n'y tiennent pas. Le candidat est plus long, à juger en N5.
- Des sols qui se chevauchent aux raccords : trois chevauchements révélés
  par calcul sont corrigés en séparant les raccords des courbes et les accès.
- Des galeries de 63 et 85,5 m parfaitement droites : remplacées par des
  coudes, avec passage de 2,5 m et vues axiales limitées à 40,75 m.
- Le même gabarit pour une droite et une courbe : élargissement à 7 m
  dans les courbes, contrôlé contre une voiture de 15 × 2,8 m.
- Une station privée accessible depuis le dépôt : séparation de mur
  obligatoire, portes et masques dépendant de l'état du voyage.

## Leçons

La surface du toit secret remplace le support navigable sous la caisse.
La cabine surélevée est à côté de la voie et ne garde aucun sol dessous.
La fosse centrale du ventilateur n'est pas un chemin ; elle sera gardée
par des garde-corps. Le contrôle 2D porte sur les supports réservés et
ne remplace pas les collisions du blockout.

**Accord utilisateur reçu le 6 octobre 2026** pour poursuivre (« tu peux continuer »).
Aucune scène du magasin, des prototypes ou de l'atelier N0 n'est réécrite.
Aucune suite de tests automatisés n'est ajoutée ou exécutée.
