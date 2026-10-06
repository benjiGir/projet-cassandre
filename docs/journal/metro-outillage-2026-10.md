---
title: Métro — outillage pour un second niveau
tags: [journal, blender, metro, outillage]
status: brouillon
updated: 2026-10-06
---

# Métro — outillage pour un second niveau

## Période et objectif

6 octobre 2026. Après l'acceptation de la sensation de voyage du prototype
T4, l'utilisateur autorise N0 du plan `PLAN_V2.md` : construire un second
niveau avec Cassandre et conserver le chemin de construction du magasin.

## Préparé

- Profils `hypermarche` et `metro`, avec générateurs, plans et sorties séparés.
- Sélection par argument, marqueur de scène ou fichier ; sélecteur Blender.
- Refus des sorties réservées à l'autre profil avant construction ou export.
- Manifestes génériques et audit adapté au niveau ouvert.
- Atelier technique métro de 12 × 16 m, sol à −5 m, spawn, murs et plafond.
- Empreinte du contenu Blender pour comparer les reconstructions.

Les [contrats de l'outillage](../4-technique/outillage-multi-niveaux.md)
décrivent les commandes. Cet atelier ne fixe pas le tracé final du métro.

## Relevés

Blender 5.1.2. Les candidats et logs sont dans `renders/metro_n0/` et
`renders/_cassandre/`, ignorés par Git. Les sources et exports livrés du
magasin ne sont pas réécrits.

| Opération | Résultat |
|---|---|
| Construction de l'atelier | 13 objets du relevé de provenance, source sauvegardée |
| Validation stricte de l'atelier | conforme, aucune erreur ni avertissement |
| Audit de l'atelier | aucun trou de sol, bord ouvert, encastrement, défaut de placement ou de spawn |
| Export de l'atelier | GLB de 114 Ko, contenu vérifié |
| Manifeste métro | une zone, altitude négative conservée |
| Vue de dessus | `renders/_cassandre/atelier_metro_n0.png`, salle grise technique |
| Reconstruction magasin par sélection historique puis explicite | 3 952 objets du view layer, empreintes identiques |
| Manifeste magasin générique contre le générateur historique de HEAD | texte identique pour les 34 espaces |

Empreinte commune des reconstructions :

```text
210824b86fbcf84d23f7ca2a67133da6e59d3dd5f48eb193ed7b5439ed6a3193
```

Les deux sources comparées sont `avant/niveau_v2.blend` (sélection par
défaut) et `apres/niveau_v2.blend` (`niveau="hypermarche"`). La comparaison
porte sur les poses, propriétés, parents, géométrie, affectations de
matériaux, UV et couleurs. Elle ignore l'ordre des faces et la rotation
cyclique de leur premier sommet, mais conserve leur sens. Elle ne prouve
pas l'identité des graphes de shaders ou des pixels d'un rendu.

## Défauts rencontrés et corrigés

Le premier build historique échoue sur le repère « rideau vers la réserve »
du compacteur : aucune règle de placement ne le reconnaît. Il est désormais
ignoré par les repères statiques, car la porte animée est déjà construite
par la recette des portes.

Le remplissage des kiosques utilisait le `hash()` Python, variable entre
deux processus. Sa graine dérive maintenant d'un SHA-256 stable. Cela
stabilise les reconstructions ; le garnissage d'un futur build peut différer
du fichier magasin actuellement livré. Le fichier livré reste intact.
La comparaison ci-dessus applique ces deux corrections aux deux candidats.

Un premier rapprochement des octets GLB échoue : outre les kiosques,
l'ordre des faces de six meshes créés par des opérateurs Blender varie.
Le relevé compare donc les surfaces source avec leurs UV et couleurs,
sans dépendre de cet ordre ni de la triangulation de l'exporteur.

Le manifeste magasin livré est déjà en décalage avec le plan courant sur
l'altitude du secret de la cafétéria (2 m contre 0 m). Les générateurs
historique et générique produisent la même sortie ; N0 ne réécrit pas ce
manifeste livré.

## Suite

N1 : références et cotes du métro. N2 : plan de masse réel. L'entrée du
métro dans la campagne, son décor et ses trains glTF restent à construire.
Aucune suite de tests automatisés n'est ajoutée ou exécutée pour N0.
