---
title: Documentation PROJET_CASSANDRE
tags: [index]
status: stable
updated: 2026-10-11
---

# PROJET_CASSANDRE

Boomer shooter rétro en Three.js : un hypermarché des années 90 sert de façade
à un complot reptilien. Le pitch, le périmètre et l'état du prototype sont
dans [Le projet](1-introduction/le-projet.md).

## Trouver une information

### Je découvre le projet

- [Le projet](1-introduction/le-projet.md) — pitch, ton, stack et périmètre.
- [Démarrage rapide](1-introduction/demarrage-rapide.md) — installation, lancement et commandes.
- [Comment lire cette documentation](1-introduction/comment-lire-cette-doc.md) — parcours selon le besoin.
- [Glossaire](1-introduction/glossaire.md) — vocabulaire du projet.

### Je veux comprendre le jeu ou son architecture

- [Expérience de jeu](2-fonctionnel/experience-de-jeu.md) — boucle du joueur.
- [Le niveau](2-fonctionnel/le-niveau.md) — espaces, progression et plan de masse.
- [Vue d'ensemble](3-architecture/vue-d-ensemble.md) — blocs du projet et frontières.
- [Invariants](3-architecture/invariants.md) — règles non négociables et leurs raisons.
- [Cycle de vie](3-architecture/cycle-de-vie.md) — démarrage, session, reset et chargement.

### Je veux modifier le jeu

- [Reprendre le projet](5-guides/reprendre-le-projet.md) — parcours du premier jour.
- [Où agir](5-guides/ou-agir.md) — trouver les fichiers concernés.
- [Modifier le niveau](5-guides/modifier-le-niveau.md) — Blender live, build, audit et export.
- [Ajouter un objet interactif](5-guides/ajouter-un-objet-interactif.md) — contrat glTF de bout en bout.
- [Ajouter un ennemi](5-guides/ajouter-un-ennemi.md) — recette pas à pas.
- [Ajouter une arme](5-guides/ajouter-une-arme.md) — recette pas à pas.
- [Chargement de niveau](4-technique/chargement-de-niveau.md) — loader, extras et hot reload.
- [Board des voitures](assets/board-voitures.md) et [board des motos](assets/board-motos.md) — références des véhicules proposés.
- [Board des armes et mains](assets/board-armes-mains.md) — références, proportions et composition de la vue subjective.
- [Étalon de direction artistique](assets/etalon-direction-artistique.md) — traitement du quai approuvé, comparaison jouable et charte commune.
- [Galeries et vestiaire](assets/galerie-direction-artistique.md) — première application de la charte au métro jouable, comparaison avant/après.
- [Quais et tunnels](assets/quais-direction-artistique.md) — carrelage, mobilier, béton et voies dans la continuité de l'étalon approuvé.
- [Surface de vente et mobilier commercial](assets/vente-direction-artistique.md) — sols, métal peint, tôles, cartons et équipements avec l’éclairage d’origine.
- [Cafétéria du magasin](assets/cafeteria-direction-artistique.md) — damier, stratifié, métal et parois dans les familles communes.
- [Sanitaires du magasin](assets/sanitaires-direction-artistique.md) — faïence, cabines vert pétrole et pièces métalliques.
- [Nouveaux équipements des sanitaires](assets/sanitaires-assets.md) — cabines accessibles, grands lavabos et miroirs avec reflets dynamiques.
- [Corps du héros dans les miroirs](4-technique/reflet-du-heros.md) — modèle original, clips, prises d'arme et revue interactive.
- [Réserve et quai de livraison](assets/reserve-direction-artistique.md) — béton, peinture, bois, cartons et équipements industriels harmonisés.
- [Personnel et bureaux](assets/bureaux-direction-artistique.md) — vestiaires, PC sécurité, escalier, moquette et mobilier administratif.
- [Fournil, labo et SAV](assets/ateliers-direction-artistique.md) — grès, faïence, inox et surfaces de travail des ateliers.
- [Fours du fournil](assets/fours-fournil.md) — fours à soles vitrés et rôtissoire reconstruits.
- [Locaux de service](assets/service-direction-artistique.md) — chambre froide et compacteur aux matières harmonisées.
- [Planque et gaine VMC](assets/annexes-direction-artistique.md) — coin pause et passage métallique.
- [Finitions des bureaux](assets/bureaux-finitions.md) — moquette bleue continue et faux plafonds en relief.
- [Finition des décors restants](assets/finition-direction-artistique.md) — parkings, raccords, véhicules et quartier ; revue finale des matières.
- [Entrée et caisses du magasin](assets/caisses-direction-artistique.md) — terrazzo plus calme, carrelage, stratifié, métal et tapis.
- [Rames du métro](assets/rame-direction-artistique.md) — carrosserie, tissu, caoutchouc, garage et voitures de passage.
- [Station privée et parvis](assets/arrivee-direction-artistique.md) — pierre froide, dalles, bancs, jardins et remontée vers la tour.
- [Machinerie et aiguillage](assets/technique-direction-artistique.md) — équipements industriels, local de maintenance et poste de commande.
- [Dépôt et ateliers](assets/depot-direction-artistique.md) — béton industriel, charpente, établis et pièces mécaniques aux matières distinctes.
- [Billetterie et descente](assets/billetterie-direction-artistique.md) — finition du hall, du guichet, des portiques et de l'escalier jusqu'aux quais.
- [Board du métro](assets/board-metro.md) — huit références regardées, charte proposée et dimensions dérivées du joueur (N1).
- [Plan de masse du métro](assets/plan-metro.md) — tracé N2 accepté pour poursuivre, voies, niches, boucles et relevé calculé.
- [Pièce pilote du métro](4-technique/pilote-metro.md) — quai et 60 m de tunnel jouables, lumière et ambiances originales (N4).
- [Kit du métro](assets/kit-metro.md) — 26 pièces originales, bibliothèque Blender et planche N3 à juger.
- [Kit du quartier](assets/kit-quartier.md) — façades, commerces, bouche de métro, mobilier, véhicules et tour du lot N3b.
- [Place pilote du quartier](4-technique/pilote-quartier.md) — rue, cour de service, descente et retour par la grille publique (N4b).

### Je cherche une valeur, une commande ou une convention

- [Commandes](6-reference/commandes.md)
- [Console cassandre](6-reference/console-cassandre.md)
- [Valeurs de déplacement](6-reference/valeurs-deplacement.md)
- [Valeurs des ennemis](6-reference/valeurs-ennemis.md)
- [Catalogue de répliques du niveau](6-reference/repliques-niveau-v2.md) — trois alternatives par événement pour préparer les voix.
- [Catalogue de répliques du métro](6-reference/repliques-metro.md) — héros, annonces, compte vérifié et chat du second niveau.
- [Conventions de nommage glTF](6-reference/conventions-nommage.md)
- [Index des ADR](decisions/README.md)

## Organisation

| Dossier | Contenu |
|---|---|
| [1-introduction](1-introduction/README.md) | Pitch, prise en main et vocabulaire |
| [2-fonctionnel](2-fonctionnel/README.md) | Ce que le joueur voit et fait |
| [3-architecture](3-architecture/README.md) | Modules, frontières et décisions de conception |
| [4-technique](4-technique/README.md) | Fonctionnement interne des systèmes |
| [5-guides](5-guides/README.md) | Recettes et parcours de travail |
| [6-reference](6-reference/README.md) | Valeurs, commandes et contrats |
| [Journal](journal/README.md) | Historique daté des chantiers et playtests |
| [Archive](archive/README.md) | Anciennes pages conservées, marquées périmées |

Les pages sont rédigées à neuf à partir du code. Les ADR gardent leur chemin
stable sous `decisions/` ; l'ancienne documentation est conservée dans
`archive/`. Les [conventions de portabilité](1-introduction/comment-lire-cette-doc.md)
expliquent les liens relatifs et les statuts.

## État du chantier documentaire

Les phases A à I et les jalons D68 et D70 de la phase J du plan de
documentation sont terminés. Le plan a été retiré du dépôt le 2026-10-02 ; il
reste lisible dans l'historique git (`git show 4e88907^:PLAN_DOCUMENTATION.md`).

Le travail de niveau v2 en cours est suivi dans
[`board-coulisses.md`](assets/board-coulisses.md) et dans le
[plan des coulisses](assets/plan-coulisses.md). Le plan du niveau v2, retiré
du dépôt avec la 1.0.0, reste dans l'historique git
(`git show 4e88907^:PLAN_NIVEAU_V2.md`).

- [Parcours complet du métro N5](assets/blockout-metro.html) — blockout à juger sur la longueur et l’orientation.
