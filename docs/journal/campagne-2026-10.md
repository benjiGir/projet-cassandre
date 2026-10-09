---
title: Campagne du magasin au métro
tags: [journal, campagne, metro]
status: brouillon
updated: 2026-10-06
---

# Campagne du magasin au métro

## Période

6 octobre 2026, lot C1 du plan v2.

## Objectif

Rendre l’enchaînement jouable avant le blockout N5, avec équipement réel,
reprise locale et redémarrage du métro depuis son état d’entrée.

## Livré et preuve

Implémentation de la capture figée, du menu Continuer, du choix des niveaux
débloqués, de NEXT_LEVEL et des consommables aux bornes. Le métro stable
charge le pilote de quai avec les trains T2.

La compilation et le build passent. Le relevé `pnpm economy -- --campagne`
fonctionne sur 200 graines et montre les portefeuilles des deux niveaux.
La suite de tests n’a pas été lancée.

La [page d’auteur](../assets/campagne.html) expose les profils et la lecture
des équipements. La revue en jeu a constaté :

- transition blessée : 20 PV, 12 balles et 10 € conservés ;
- reprise après rechargement avec le même équipement ;
- métro seul : trois armes, 75 balles / 48 cartouches, trois perks et 40 € ;
- soin à PV pleins : refus sans débit ; recharge : −12 €, +24 balles / +8 cartouches ;
- après achats puis mort : retour à 40 €, 75 balles / 48 cartouches et 100 PV ;
- profil riche blessé : 115 / 125 PV, 195 / 200 balles, 94 cartouches et cinq perks conservés ;
- métro seul en Client, puis Continuer : difficulté Habitué de la sauvegarde conservée.

Les états observés figurent dans le [relevé de revue](../assets/campagne/releve.json).
Le playtest utilisateur reste ouvert. La télémétrie distante n’est pas raccordée
sur cette branche ; la provenance et l’équipement initial sont déjà dans la session.

## Rejeté et raison

Construire le métro complet dans C1 : il relève de N5. Présenter les dons
simulés du métro comme un équilibre validé : les rencontres sont hypothétiques.

## Leçons

Le pompe n’avait pas de plafond canonique ; il est désormais réglable à 96
cartouches pour porter les demi-réserves et les recharges.
L’hypothèse économique actuelle donne cinq perks au profil moyen, contre
six visés par le plan. Cette différence doit rester visible pour N5.

Les détails et le protocole sont dans la [fiche technique](../4-technique/campagne.md)
et [ADR 0045](../decisions/0045-campagne-et-arrivee.md).
