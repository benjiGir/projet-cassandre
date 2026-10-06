---
title: Trains pilotés par les données du niveau
tags: [adr, metro, trains, gltf]
status: accepte
updated: 2026-10-06
---

# ADR 0044 — Trains pilotés par les données du niveau

## Statut

Accepté pour l’intégration T2, dans le cadre des règles de trains décidées le
2026-10-06. Le numéro 0043 appartient à la télémétrie sur `feat/telemetrie`.
Les horaires et le level design restent à régler en jeu.

## Contexte

Le prototype T1 fixe le principe des trains : danger mortel lisible,
aiguillage et arrêt des prochaines rames. N5 doit utiliser les voitures N3
et les trajets dessinés dans Blender, aux altitudes propres au métro.
La séquence à bord reste un trucage distinct, avec une rame immobile.

## Décision

Les trajets, panneaux, refuges et boîtiers sont des métadonnées glTF validées.
Chaque niveau possède son `TrainSystem`, sa configuration de difficulté et
ses ressources. Le système T1 est réutilisé pour les horaires.

La mort utilise le volume balayé de chaque voiture entre deux pas fixes.
Les colliders cinématiques servent aux tirs et aux props, sans porter le
joueur. Le rendu interpole les poses. Le script enfile ses commandes pour
le pas fixe suivant.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Coder les trajets propres à chaque station dans le runtime | Duplique le plan Blender et rend les retouches fragiles |
| Transporter le joueur par un collider mobile | Contredit la décision de garder le voyage à bord immobile |
| Décider la mort par collision discrète seule | Peut manquer un acteur entre deux poses à grande vitesse |
| Partager la configuration globale de T1 entre les niveaux | Une variante de dev pourrait modifier la difficulté d’une partie |

## Conséquences

La fermeture et le rollback libèrent aussi les rames déjà créées. Le loader
contrôle le gabarit du modèle et la lisibilité des intervalles visibles.
Le graphe exclut les voies, avec des exceptions explicites pour les traversées.

Les virages visibles et l’accès réel aux refuges exigent encore une revue sur
le blockout. Un contrôle de distance ne remplace pas un chemin praticable.
Les compteurs de trains restent locaux jusqu’à l’intégration de la télémétrie.

## Comment on saurait qu’on a eu tort

Des morts près d’un refuge pourtant visiblement sûr, des rames qui coupent
les parois dans les virages, ou des ressources conservées après un rechargement
imposeraient de revoir le balayage, le contrat de trajet ou son propriétaire.

Le [fonctionnement courant](../4-technique/trains-metro.md) décrit le contrat.
