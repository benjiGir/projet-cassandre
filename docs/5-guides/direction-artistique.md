---
title: Direction artistique commune
tags: [guide, direction-artistique, rendu]
status: brouillon
updated: 2026-10-11
---

# Direction artistique commune

## Objectif

Construire un **rétro urbain texturé, semi-réaliste et satirique**. Le monde,
les personnages et le direct partagent des couleurs, des valeurs et un
niveau de finition reconnaissables. Les zones gardent leur ambiance propre.

Le traitement de référence est **approuvé par l'utilisateur le 10 octobre
2026**, après observation de [l'étalon du quai](../assets/etalon-direction-artistique.md).
Son déploiement dans les niveaux suit des passes locales comparées en jeu.

## Avant de commencer

Les instructions de `AGENTS.md` font foi. Le monde utilise une base 640×360
et un agrandissement nearest. Le filtrage de réduction courant utilise
mipmaps et anisotropie ; l'ADR 0027 reste proposé. Les matériaux classiques
et les effets TSL peuvent coexister. Les lots de dessin sont des indicateurs.

Références : [audit initial](../journal/audit-direction-artistique-2026-10.md),
[métro validé](../assets/board-metro.md),
[armes et mains](../assets/board-armes-mains.md).

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

Comparer le même lieu, la même pose, la même résolution et les mêmes lampes.
Regarder une vue d'ensemble, une vue proche et un passage en mouvement.
Faire apparaître arme, personnage et ramassage dans la scène de référence.
Une belle texture isolée ne suffit pas à valider son usage dans le monde.

## Pièges

Une palette commune ne donne pas seule une matière commune. Le sol peut
devenir le sujet principal si son grain est trop contrasté. Les lampes
proches peuvent saturer le métal du viewmodel ; conserver ses nuances.
Les captures Blender vérifient l'assemblage, les captures du jeu arbitrent
le rendu réel des sprites, objets et armes.

## Exemple réel

L'étalon du 10 octobre utilise `tools/art_direction/quay_scene.py` et
`surface_recipes.py`. Il réemploie le kit du métro, ses bancs, ses commandes
et ses ressources runtime. Les deux exports partagent l'assemblage et les
lampes. La proposition applique sept recettes de textures distinctes.
Le traitement de cet étalon est approuvé le 10 octobre 2026. La première
extension concerne [les galeries et le vestiaire](../assets/galerie-direction-artistique.md)
du métro jouable. Les modifications restent sans commit à cette date.
La passe suivante applique ce traitement aux
[quais et tunnels](../assets/quais-direction-artistique.md), avec une recette
distincte pour le béton sous les rails et la peinture des bandes de sécurité.
[La billetterie et sa descente](../assets/billetterie-direction-artistique.md)
prolongent ensuite ces familles de matières jusqu'au guichet et aux portiques.

[Le dépôt et ses ateliers](../assets/depot-direction-artistique.md) reprennent le
béton industriel et les peintures communes, avec des rampes propres au bleu
des équipements, au métal usiné et au cuivre.

[La machinerie et le poste d’aiguillage](../assets/technique-direction-artistique.md)
prolongent le béton industriel. Le poste de commande conserve une peinture
ivoire et un sol de dalles ; les pales du ventilateur utilisent le métal
usiné du dépôt.

[La station privée et le parvis](../assets/arrivee-direction-artistique.md)
utilisent des parements de pierre et des dalles gris-bleu propres. Le
feuillage dispose d’une matière distincte des peintures d’équipements.

[Les rames du métro](../assets/rame-direction-artistique.md) partagent les
peintures claires, pétrole et acier. Le tissu des coussins et le caoutchouc
des sols et câbles disposent de recettes propres, au contraste discret.
Le garage prolonge le béton et le sol industriel du dépôt.

[L’entrée et les caisses du magasin](../assets/caisses-direction-artistique.md)
prolongent les tons ivoire et gris de la charte. Le terrazzo conserve des
fragments espacés ; les comptoirs emploient du stratifié, du métal brossé
et du caoutchouc. Les étiquettes et les accents rouges gardent leur rôle.

Le magasin conserve son éclairage d’origine : la proposition plus sombre est
rejetée lors du retour utilisateur du 11 octobre. Les passes suivantes portent
sur les textures.

[La surface de vente et le mobilier commercial](../assets/vente-direction-artistique.md)
reprennent ensuite le terrazzo et les métaux des caisses. Le damier gris-ivoire,
l’émail des appareils et la peinture des gondoles utilisent des rampes sobres ;
les produits et les étiquettes gardent leurs atlas.

[La cafétéria](../assets/cafeteria-direction-artistique.md) reprend le damier
des rayons, le stratifié des caisses et les métaux communs. Les parois et le
plafond gardent un grain discret ; la peinture rouge des chaises conserve
l’accent du magasin sans l’ancienne usure très contrastée.

[Les sanitaires attenants](../assets/sanitaires-direction-artistique.md)
prolongent le damier partagé et l’enduit ivoire. La faïence a ses joints de
25 cm ; le stratifié des cabines reprend le vert pétrole de l’étalon.

La [refonte des équipements](../assets/sanitaires-assets.md) conserve ces matières
et agrandit les passages des cabines. Les vasques et appareils gardent une
céramique de palette ; les miroirs reflètent la scène en 640×360 avec un
agrandissement nearest.

[La réserve et son quai](../assets/reserve-direction-artistique.md) emploient
un béton jointé et usé, des parpaings peints clairs et des racks rouges.
Après le rejet de la première version trop lisse, les cartons reçoivent
ruban et étiquettes, et les palettes des lattes et fixations lisibles. Ces
motifs sont propres à la réserve. Les fûts gardent leurs cerclages et étiquettes ;
les transpalettes gardent l’ambre sur leurs fourches. Les bandes de quai
et les atlas fonctionnels conservent leur contraste.


[Les locaux du personnel et les bureaux](../assets/bureaux-direction-artistique.md)
prolongent le béton du couloir et les cartons de la réserve. Les vestiaires
utilisent un carrelage gris-vert ; le PC et l’étage une moquette à trame fine.
Les bureaux et bancs ont un bois veiné, les caissons un métal mat et les
archives une peinture verte. Les atlas de casiers et d’interactions gardent
leurs détails.


[Le fournil, le labo et le SAV](../assets/ateliers-direction-artistique.md)
partagent l’inox mat et les familles de surfaces de travail. La faïence
claire et le grès rouge-brun distinguent les ateliers alimentaires ; le SAV
garde le béton de manutention et ses établis de bois. Le plafond utilise
des panneaux lessivables rectangulaires, distincts des petits carreaux.

La [chambre froide et le compacteur](../assets/service-direction-artistique.md)
prolongent les ateliers : panneaux isothermes clairs, sol antidérapant,
évaporateur à ailettes, béton et peinture industrielle. Les commandes et les
atlas des balles de carton conservent leurs détails.

La [planque du vigile et la gaine VMC](../assets/annexes-direction-artistique.md)
prolongent cette passe avec tissu, plastique et panneaux métalliques.

Les [finitions des bureaux](../assets/bureaux-finitions.md) rétablissent une
moquette bleue continue et ajoutent des ossatures de faux plafond en relief.

La [passe des décors restants](../assets/finition-direction-artistique.md)
termine les parkings, raccords et petits décors du magasin, puis les façades,
la voirie et le mobilier du quartier. Les véhicules gardent leurs couleurs
de sommets, avec un grain de surface discret. Le déploiement des matières
du décor est intégré aux builds normaux des deux niveaux.
