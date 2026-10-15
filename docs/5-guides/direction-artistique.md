---
title: Direction artistique commune
tags: [guide, direction-artistique, rendu]
status: brouillon
updated: 2026-10-12
---

# Direction artistique commune

## Objectif

Construire un **rétro urbain texturé, semi-réaliste et satirique**. Le monde,
les personnages et le direct partagent des couleurs, des valeurs et un
niveau de finition reconnaissables. Les zones gardent leur ambiance propre.

Le traitement de référence est **approuvé par l'utilisateur le 10 octobre
2026**, après observation de [l'étalon du quai](direction-artistique.md).
Son déploiement dans les niveaux suit des passes locales comparées en jeu.

## Avant de commencer

Les instructions de `AGENTS.md` font foi. Le monde utilise une base 640×360
et un agrandissement nearest. Le filtrage de réduction courant utilise
mipmaps et anisotropie ; l'ADR 0027 reste proposé. Les matériaux classiques
et les effets TSL peuvent coexister. Les lots de dessin sont des indicateurs.

Références : [audit initial](../journal/audit-direction-artistique-2026-10.md),
[métro validé](../6-reference/references-metro.md),
[armes et mains](../6-reference/references-armes-mains.md).

## Étapes par famille

### 1. Matières et valeurs

- Garder une silhouette franche et des zones calmes autour du sujet utile.
- Faire lire la matière par ses joints, ses assemblages et quelques traces
  pertinentes. L'usure se concentre sur les contacts et arêtes exposés.
- Choisir de petites rampes de valeurs par matière. L'étalon propose
  quatre couleurs pour chacune de ses sept recettes.
- Traiter les grandes variations avant le grain fin. Une texture presque
  uniforme et une texture pleine d'éclats contrastés constituent les deux
  extrêmes à comparer dans un même cadrage.
- Prendre 64 texels/m comme repère des matières répétées. Les atlas,
  petits objets, textes et vues subjectives ont des exceptions explicites.

### 2. Sous-palettes de lieux

| Lieu | Base | Accents |
|---|---|---|
| Magasin | Ivoire, gris commerciaux, métal mat | Rouge enseigne/produits ; couleurs satiriques ponctuelles |
| Quartier | Enduit, brique sourde, ardoise | Vitrines et lampes chaudes |
| Quais | Ivoire et pétrole | Ambre de sécurité ; acier gris-bleu |
| Service | Béton gris-vert, acier, sol sombre | Ambre local et pictogrammes fonctionnels |
| Station privée | Pierre froide, gris-bleu | Lumière froide ; symbole de la plateforme |

Les extérieurs jouables et illustrés doivent partager l'heure, l'état du
sol et les repères de l'architecture.

### 3. Personnages et premier plan

Conserver les poses et silhouettes validées. Le traitement commun concerne
acier, bois, peau, tissu et ombres peintes. Le portrait du héros reste une
image expressive de retour de caméra. Les variantes de peau des ennemis
gardent leur diversité.

### 4. Interactions, signalétique et direct

Vert : soin/autorisation. Ambre : attention/action. Rouge : alerte/feu.
Cyan : matérialisation. Les pictogrammes et silhouettes complètent la couleur.
Les cartouches conservent leur boîte rouge et leur dessin distinctif.

Dans le monde, hiérarchiser destination, identification locale et détail
secondaire. Dans le direct, garder vert phosphore, ambre, REC rouge, cadres
francs et police commune. Relier leur échelle au format du jeu.

### 5. Effets

Les effets TSL partagent les rampes et la hiérarchie du décor. Le tir utilise
des tons chauds, l'apparition du cyan, l'eau du pétrole clair. Chaque effet
se juge en animation, dans un cadrage contenant ses voisins.

## Vérifier visuellement

Regarder une vue d'ensemble, une vue proche et un passage en mouvement.
Faire apparaître arme, personnage et ramassage dans la scène de référence.
Une belle texture isolée ne suffit pas à valider son usage dans le monde.

## Pièges

Une palette commune ne donne pas seule une matière commune. Le sol peut
devenir le sujet principal si son grain est trop contrasté. Les lampes
proches peuvent saturer le métal du viewmodel ; conserver ses nuances.
Les captures Blender vérifient l'assemblage, les captures du jeu arbitrent
le rendu réel des sprites, objets et armes.

## Sources et reprise

Le traitement retenu est intégré aux builds normaux des deux niveaux.
`tools/art_direction/surface_recipes.py` fournit les textures communes ;
les modules ci-dessous appliquent les variantes par zone.

| Zone | Module dans `tools/art_direction/` |
|---|---|
| Étalon du quai | `quay_scene.py` |
| Galeries et vestiaire | `metro_gallery.py` |
| Quais et tunnels | `metro_materials.py` |
| Billetterie et descente | `metro_ticket_hall.py` |
| Dépôt et ateliers | `metro_depot.py` |
| Machinerie et aiguillage | `metro_technical.py` |
| Station privée et parvis | `metro_arrival.py` |
| Rames et garage | `metro_service.py` |
| Entrée et caisses | `store_checkout.py` |
| Surface de vente | `store_sales.py` |
| Cafétéria | `store_cafeteria.py` |
| Sanitaires | `store_restrooms.py` |
| Réserve et quai de livraison | `store_reserve.py` |
| Personnel et bureaux | `store_offices.py`, `store_office_finishes.py` |
| Fournil, labo et SAV | `store_workshops.py` |
| Chambre froide et compacteur | `store_service.py` |
| Planque et gaine VMC | `store_annexes.py` |
| Décors restants et véhicules | `store_finish.py`, `metro_exteriors.py`, `vehicle_finish.py` |

Le magasin conserve son éclairage d'origine : la proposition plus sombre
est rejetée par l'utilisateur le 11 octobre. Les textures de la réserve
utilisent béton jointé, parpaings peints, rubans et étiquettes de cartons ;
la première passe trop lisse a été remplacée. Les bureaux et la direction
retrouvent une moquette bleue continue et un faux plafond sur ossature de
60 cm. Sols et plafonds des vestiaires utilisent des matières distinctes.

Les [équipements des sanitaires](../4-technique/equipements-sanitaires.md)
et les [fours du fournil](../4-technique/fours-fournil.md) ont leurs recettes
propres. Les matières du métro gardent ivoire/pétrole sur les quais,
béton industriel en service et pierre gris-bleu à l'arrivée. Tissu des
sièges, caoutchouc des sols et végétation restent des familles distinctes.

Les commandes de reprise locale passent par `tools/blender/cassandre.py` ;
consulter [le catalogue des recettes](../../tools/blender/README.md).
La source magasin est `assets_src/blender/niveau_v2.blend` ; celle du métro
est `assets_src/blender/metro_blockout.blend`.

## Sorties de travail

Les captures, comparaisons et relevés vont dans `renders/`, ignoré par Git.
Les recettes de retouche et d'assemblage utilisent `renders/reviews/` ;
le héros utilise `renders/hero/`. `out` permet de choisir une autre sortie
pour les kits et le plan candidat du métro.

`docs/assets/` conserve uniquement les plans qui expliquent la documentation.
Les pages de revue et séries avant/après sont retirées après utilisation.
Une référence graphique non reproductible reste dans `assets_src/` ; les
originaux du portrait et leurs prompts sont dans `assets_src/portrait_stream/`.
Les choix et retours restent dans le [journal de l'audit](../journal/audit-direction-artistique-2026-10.md).
