---
title: Intégration des trains du métro
tags: [journal, metro, trains]
status: brouillon
updated: 2026-10-06
---

# Intégration des trains du métro

## Période

Le 2026-10-06, après la validation du pilote N4 par l’utilisateur :
« on est pas mal la tu peux continuer ».

## Objectif

Préparer T2 avant N5. Le graphe du plan impose également C1 avant le blockout
jouable entier. Le pilote accepté reste séparé de la scène de trafic.

## Livré et preuve

Un candidat d’intégration est accessible dans la
[revue de trafic](../assets/trains-metro.html), `?level=trains_metro`.
Il utilise la voiture N3, des commandes Blender, des panneaux à compte à
rebours et les cinq refuges du tube N4. La voie A est régulière. B est
suspendue au départ ; un scénario à l’entrée du tube demande un passage unique.
L’aiguillage A choisit ligne / dépôt derrière le portail sud.

Le loader valide les voies, les cibles, le gabarit et la lisibilité. Il refuse
les références de script invalides dans un niveau avec trains. Les corps et
panneaux suivent la possession et le rollback du niveau. Les contacts balayés
s’appliquent au joueur, aux Costards, Rampants, Vigiles et Directeurs.

La scène finale contient 282 colliders statiques, 24 lots de décor,
28 marqueurs de lampes, huit commandes et un trigger. Le chargement relève
51 points de visibilité et de distance aux refuges.

- Build TypeScript/Vite réussi ; avertissement habituel sur le bundle volumineux.
- Contrôle Blender strict : zéro erreur, zéro avertissement.
- Vue du quai et vue d’un refuge rendues dans Blender et regardées.
- Captures du moteur regardées : [quai](../assets/trains-metro/quai.png)
  et [refuge](../assets/trains-metro/refuge.png). Elles montrent une rame en passage.
- Aucune suite de tests exécutée ; aucune validation du rythme de N5 revendiquée.

Le [contrat technique](../4-technique/trains-metro.md) et
[l’ADR](../decisions/0044-trains-de-niveau.md) accompagnent le candidat.

## Rejeté et raison

Les premières boxes de logique utilisaient la géométrie de décor, avec des
sommets séparés par face. Le trigger était refusé par le runtime. Elles
utilisent maintenant la recette de proxy box à huit sommets.

Le compteur de lots de décor incluait le modèle détaché de la rame. Il
compte maintenant les candidats réellement destinés à la fusion du décor.
Les panneaux reçoivent deux faces pour rendre les textes lisibles des deux côtés.

## Leçons

Relire le GLB chargé est nécessaire : une scène Blender correcte ne prouve
pas que ses marqueurs sont effectivement utilisés par le runtime.

T2 reste candidat. Le son spécifique relève de T3 ; les virages visibles,
les combats et la mesure d’accès réel aux refuges attendent le parcours.
La télémétrie distante nécessite la branche dédiée ; les causes et compteurs
sont actuellement locaux. Le prochain préalable de N5 est C1.

## Correction après retour sur le placement

Le même jour, l’utilisateur signale des bancs inversés, du bruit répétitif,
des objets flottants et des écriteaux superposés.

- Deux bancs retournés vers les voies ; leurs dossiers restent contre le mur.
- Huit boîtiers et leurs plaques fixés aux murs, hors des bancs et des affiches.
  Les origines des `use_*` sont sur leur fixation : la portée ne vise plus
  l’origine du niveau. L’arrêt du quai a été actionné avec E en jeu.
- Quatre panneaux de trafic déplacés au-dessus des quais, en dehors du gabarit
  des trains ; cadre, deux tiges et platines ajustées à la voûte.
- Cinq panneaux du tube plaqués au mur opposé aux refuges.
- Une seule plaque « ACCES VOIES » remplace le panneau « SERVICE » superposé ;
  les refuges ont chacun une plaque numérotée. Les textes de trafic passent
  à trois lignes et gardent leur actualisation à 10 Hz.
- Lampes du tube suspendues à sa voûte ; lampes des refuges plaquées au plafond.
- Une alerte douce de 450 ms remplace le son de refus de porte répété chaque
  seconde. Elle se déclenche une fois par rame dans le préavis local.
  Le tintement aléatoire de rail est retiré des ambiances du pilote.

Les sources N4 et T2 sont reconstruites. Les captures de contrôle montrent
les [bancs](../assets/trains-metro/bancs.png), les
[panneaux](../assets/trains-metro/panneaux.png) et une
[commande de refuge](../assets/trains-metro/commande-refuge.png).
Le spectrogramme et les mesures des deux codecs sont dans la
[planche audio](../assets/pilote-metro/audio-spectres.png) et son
[relevé](../assets/pilote-metro/audio-mesures.json).
La [comparaison à gain de lecture](../assets/trains-metro/audio-comparaison.json)
relève un RMS maximal sur 100 ms inférieur de 5,5 dB et aucun échantillon
écrêté dans les deux codecs. La revue audio est instrumentale ; l’écoute
du mixage reste à l’utilisateur.

Contrôle final : build TypeScript/Vite réussi ; vérification Blender stricte
conforme, sans erreur ni avertissement. Les huit commandes, les 282 colliders
et les 24 lots de décor sont conservés. Aucune suite de tests exécutée.
