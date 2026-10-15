---
title: Campagne avec équipement d’arrivée figé
tags: [adr, campagne, session]
status: accepte
updated: 2026-10-06
---

# ADR 0045 — Campagne avec équipement d’arrivée figé

## Statut

Accepté pour C1, selon les décisions D33 à D39 du plan v2.
La télémétrie conserve le numéro 0043 sur sa branche.

## Contexte

Le métro garde l’équipement, les PV et la difficulté de la sortie du magasin.
La mort recommence le niveau avec l’équipement exact de son entrée.
L’état courant continue pourtant de changer avec les tirs et les achats.

## Décision

Capturer une copie figée de l’arrivée dans le pas fixe. Construire les
sessions suivantes avec elle, appliquer les perks avant les réserves et
la conserver comme référence des redémarrages. Persister la sortie du
magasin hors de la boucle synchrone, sous un format versionné validé par Schema.

L’identifiant `metro` est indépendant du fichier GLB provisoire du pilote.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Copier le joueur au clic Continuer | Les panneaux et l’attente sépareraient la capture de la sortie |
| Conserver les objets de la session précédente | Ils appartiennent à un monde physique fermé |
| Repartir plein après une mort | Contredit les PV et réserves de l’arrivée |
| Sauvegarder tout le niveau | Élargit C1 à des checkpoints et à la restauration du monde |
| Lire ou écrire le navigateur dans le pas fixe | Mélange les frontières de persistance et de simulation |

## Conséquences

Une reprise restaurée emploie sa propre difficulté, indépendamment du menu.
Cartes, score, temps et audience repartent. Le navigateur ne garde que la
dernière fin du magasin ; le métro seul utilise un équipement type.
Une persistance refusée conserve la reprise dans l’onglet et avertit le joueur.

La [fiche de campagne](../4-technique/campagne.md) décrit les bornes de
consommables, les plafonds et les limites du simulateur économique.

## Comment on saurait qu’on a eu tort

Si le playtest montre qu’un joueur blessé ne peut pas sortir du début du métro
malgré les soins prévus avant le combat, il faut revoir les ressources ou la
règle de reprise. Une demande de checkpoints serait un chantier distinct.
