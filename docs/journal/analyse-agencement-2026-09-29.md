---
title: Analyse de l’agencement du niveau v2
tags: [journal, niveau, agencement, analyse]
status: brouillon
updated: 2026-09-30
---

# Analyse de l’agencement du niveau v2

## Période

Inspection du 29 septembre 2026, après les corrections des véhicules, des
caddies extérieurs et des distributeurs de la cafétéria.

## Objectif

Évaluer le placement, la circulation et la lisibilité du niveau existant.
L’inspection couvre les pièces du plan, trois couloirs de service et huit vues
à hauteur du joueur. Les rendus utilisent une lumière de contrôle et des
plafonds masqués : ils servent à juger l’agencement. Le rythme des combats et
la lisibilité sous l’éclairage du jeu restent à confirmer en jouant.

## Livré et preuve

**Avis général : la structure tient bien ; la priorité est de clarifier les
placements et les repères, puis de varier quelques compositions.**

### Ce qui fonctionne

- **Circulation principale.** L’entrée mène aux caisses puis au hub. Les
  rayons et l’électroménager se distinguent de part et d’autre. Le raccourci
  relie les coulisses à la surface de vente.
- **Rayons et caisses.** Les deux transversales de 4 m entre les tronçons de
  gondoles offrent des échappées. Les passages de 2,5 m entre les caisses
  permettent plusieurs franchissements. Conserver ces dégagements.
- **Réserve et sous-sol.** Les racks, le quai et les piliers produisent des
  volumes différents. Les véhicules occupent les places plutôt que les
  allées ; la rampe centrale de la réserve reste lisible.
- **Pièces spécialisées.** Le fournil, les vestiaires, le PC sécurité et le SAV
  ont des meubles liés à leur fonction. Leurs compositions sont plus
  convaincantes que les petits objets dispersés dans les grandes salles.

### Préconisations par priorité

| Priorité | Zone et constat | Proposition |
|---|---|---|
| 1 | Hub et sortie du sous-sol : la répétition des travées peut brouiller la destination. Les panneaux du hub annoncent surtout des rayons. | Ajouter des indications explicites « Réserve », « Bureaux » et « Retour magasin », visibles avant le choix de direction. Marquer la rampe de sortie du parking avec un signe distinctif. |
| 1 | Parking extérieur, caisses, électroménager : cartons et petits objets isolés occupent ponctuellement les dégagements. | Regrouper le réassort près des murs ou des meubles, en deux ou trois ensembles cohérents. Garder libres les approches des portes et les passages entre caisses. Préserver les obstacles utiles comme couvert. |
| 2 | Compacteur et planque du vigile : trois volumes de balles de carton dans le premier ; presque uniquement un ramassage dans la seconde. Le générateur les indique encore non habillés. | Donner une fonction lisible au compacteur (machine, commandes, balles texturées). Composer un petit coin personnel dans la planque : siège, casier, télévision et butin regroupé. |
| 2 | Couloir coupe-feu : 56 m de perspective très rectiligne et peu d’événements visuels. | Créer deux repères distincts aux accès du SAV et des locaux techniques : signalétique, matériel de maintenance regroupé, changement local de traitement du mur. Conserver un axe central dégagé. |
| 2 | Galerie, cafétéria et rayons : kiosques, tables et gondoles répètent des compositions régulières. | Garder la trame ; distinguer quelques ensembles par leur usage : table abandonnée, zone de réassort, tête de gondole signature. Varier surtout les accessoires et les repères, sans décaler systématiquement les meubles. |
| 3 | Bureau du Directeur : grand dégagement autour d’un bureau et d’un canapé, peu de volumes intermédiaires. | Essayer deux couverts bas sur les côtés. Les conserver seulement s’ils améliorent le combat contre le boss. |

### Contrôle géométrique

L’audit du fichier `assets_src/blender/niveau_v2.blend` examine 841 proxies,
avec un sondage des sols tous les 0,5 m. Il ne signale aucun trou de sol, bord
ouvert sur le vide, chevauchement au-delà du seuil de l’outil, objet flottant ou
point d’apparition encombré. Ce résultat ne mesure pas le confort en combat.

Vues consultées : [espaces publics](../assets/agencement-2026-09-29/01-public.jpg),
[coulisses](../assets/agencement-2026-09-29/02-coulisses.jpg),
[annexes](../assets/agencement-2026-09-29/03-annexes.jpg) et
[vues au sol](../assets/agencement-2026-09-29/04-au-sol.jpg).

### Mise en œuvre par étapes

Chaque étape est présentée avant de commencer la suivante.

| Étape | Travail | État |
|---|---|---|
| 1 | Signalétique du hub, de la sortie du sous-sol et du couloir du personnel | Installée le 30 septembre ; lisibilité en jeu à confirmer |
| 2 | Regrouper le réassort et dégager les approches des portes | Installée le 30 septembre ; confort en combat à confirmer |
| 3 | Habiller le compacteur et la planque du vigile | Installée le 30 septembre ; accès au secret et lisibilité en jeu à confirmer |
| 4 | Ajouter deux repères dans le couloir coupe-feu | Installés le 30 septembre ; lecture et circulation en jeu à confirmer |
| 5 | Distinguer quelques ensembles dans la galerie, la cafétéria et les rayons | Six ensembles installés le 30 septembre ; lisibilité et confort en jeu à confirmer |
| 6 | Essayer deux couverts latéraux dans le bureau du Directeur | Maquette examinée, meubles bas non retenus ; combat réel encore à jouer |

**Étape 1 — signalétique.** Dix plaques indiquent la réserve en orange,
les bureaux en bleu et le retour au magasin en vert. Les panneaux suspendus
du hub portent une destination différente sur chaque face. Dans le parking
souterrain, un relais précède le changement de direction et un encadrement
bleu identifie la rampe. Les indications se poursuivent dans le couloir du
personnel, sans masquer la plaque du PC sécurité.

La source Blender et l’export du jeu ont été mis à jour. Le générateur
`tools/level_v2/build_niveau.py` utilise désormais
`tools/blender/lib_wayfinding.py` ; la mise à jour sélective passe par
`tools/blender/refresh_level_wayfinding.py`. L’atlas de 128 × 128 pixels est
reproductible avec `tools/textures/generate_wayfinding.py`.

La comparaison de l’export avec sa sauvegarde confirme que les géométries,
textures, positions et propriétés des objets préexistants sont conservées.
L’ajout représente 21 meshes, 660 sommets exportés et environ 39 ko. Le
contrôle géométrique retrouve les 841 proxies et aucun défaut signalé.

Vues de contrôle Blender : [hub vers la réserve](../assets/agencement-etape-1-2026-09-30/hub_sol.png),
[retour dans le hub](../assets/agencement-etape-1-2026-09-30/hub_retour.png),
[rampe du parking](../assets/agencement-etape-1-2026-09-30/souterrain_sol.png),
[relais du parking](../assets/agencement-etape-1-2026-09-30/souterrain_retour.png),
[arrivée dans le couloir](../assets/agencement-etape-1-2026-09-30/c_bu_sol.png) et
[accès aux bureaux](../assets/agencement-etape-1-2026-09-30/c_bu_retour.png).
Ces vues emploient une lumière de contrôle ; elles ne confirment pas la
lisibilité sous l’éclairage du jeu.

**Étape 2 — rangement.** Les 16 cartons et caisses physiques des trois zones
sont déplacés, avec les trois cônes du parking. Aucun objet n’est ajouté ou
supprimé ; les propriétés physiques et destructibles des piles sont conservées.

- **Parking extérieur :** une pile reste visible près de la muscle car au
  pied-de-biche ; l’autre ensemble longe le côté de l’abri à caddies. Les
  cônes rejoignent ces groupes. L’axe central vers les portes est dégagé.
- **Caisses :** le réassort rejoint la palette ouest ; deux objets de retour
  se regroupent derrière une caisse à l’est. Les espaces au nord des caisses
  et les approches de l’entrée et du hub sont dégagés de ces cartons.
- **Électroménager :** la pile et la caisse en bois occupent le bout ouest
  d’un îlot ; les deux autres cartons rejoignent la palette au sud. L’entrée,
  les accès aux cabines et les circulations entre îlots restent libres.

Les coordonnées du générateur sont mises à jour. Le script
`tools/blender/refresh_level_restock.py` déplace les meshes existants et leurs
proxies ; son option `--preview` écrit un candidat séparé avant l’installation.
La source Blender et l’export du jeu intègrent cette étape. La comparaison
avec la sauvegarde retrouve exactement les 22 meshes concernés (16 props,
3 cônes et leurs 3 proxies). Les autres meshes, les images, les matériaux,
les UV et les couleurs de sommets sont conservés. Le nombre d’objets et de
sommets exportés reste identique.
Le contrôle géométrique retrouve les 841 proxies et ne signale aucun trou
de sol, bord ouvert, chevauchement, objet flottant ou spawn encombré.

Vues du dessus : [parking](../assets/agencement-etape-2-2026-09-30/parking_ext.png),
[caisses](../assets/agencement-etape-2-2026-09-30/caisses.png) et
[électroménager](../assets/agencement-etape-2-2026-09-30/electro.png).
Vues à hauteur du joueur : [approche du magasin](../assets/agencement-etape-2-2026-09-30/parking_ext_sol.png),
[passage entre caisses](../assets/agencement-etape-2-2026-09-30/caisses_sol.png),
[bout d’îlot](../assets/agencement-etape-2-2026-09-30/electro_sol.png),
[pile près de la voiture](../assets/agencement-etape-2-2026-09-30/parking_ext_groupe.png),
[réassort aux caisses](../assets/agencement-etape-2-2026-09-30/caisses_groupe.png) et
[palette d’électroménager](../assets/agencement-etape-2-2026-09-30/electro_groupe.png).
Ces rendus de contrôle ne remplacent pas une traversée avec combats.

**Étape 3 — compacteur et planque.** La presse verticale devient le point
focal au sud-ouest du local. Son châssis vert, son vérin apparent, la grille
de chargement, les commandes latérales et le seuil jaune/noir reprennent le
vocabulaire observé sur les photos des presses
[Solen 80K et 300K](https://www.solen.fr/produits/presses-a-balles-verticales-simple-chambre/).
La palette et les textures restent celles du jeu ; les marques du fabricant
ne sont pas reproduites.

La machine culmine à 4,06 m sous le plafond de 5 m. Huit balles de carton
occupent deux ensembles près du mur nord et un groupe près du quai. Les
balles ordinaires mesurent 1,2 × 0,78 × 1,3 m ; deux balles mal cerclées
masquent l’accès au secret. Elles utilisent les propriétés du carton grand
déjà présent : masse 14 kg, 26 PV, matière carton. Elles sont poussables et
cassables ; aucun proxy statique ne les double. Leur pile de 2,35 m tient
sous le linteau de 2,5 m. Une benne, des palettes vides et un transpalette
complètent le local. Le centre et les ouvertures vers le couloir et le quai
restent dégagés. Une caméra coiffée d’un carton reprend l’indice du board.

Dans la planque de 8 × 4 m, le canapé fait face à une télé à tube posée sur
une caisse. Son écran utilise la chaîne animée `foot` et les 12 PV déjà
employés pour les écrans. Le casier, la radio avec antivol, les boissons et
le calendrier des rondes donnent une fonction aux autres coins. La pizza
existante rejoint la table basse : son identifiant et ses 25 PV de soin
sont conservés. Le déclencheur du secret est inchangé. Une lampe chaude et
une petite source près de la télé distinguent la pièce du local industriel.

**Limite de cette étape :** la presse est un décor en maintenance, signalé
« HORS SERVICE ». Le cycle interactif du compacteur et son gag restent au
plan des coulisses. Cette passe utilise les systèmes existants de casse et
d’écrans ; elle n’ajoute pas de mécanique de presse.

Le générateur utilise `tools/blender/lib_compacteur.py`. Les trois textures
de 128 × 128 pixels sont reproductibles avec
`tools/textures/generate_compacteur.py`. La mise à jour sélective
`tools/blender/refresh_compacteur_planque.py` propose un candidat séparé avec
`--preview`, puis enregistre la source et l’export vérifié.

La comparaison avec la sauvegarde retrouve seulement les huit meshes gris
remplacés et le mesh de la pizza modifié parmi les objets préexistants.
Tous les autres meshes, toutes les images préexistantes et toutes les
propriétés de gameplay préexistantes sont conservés. L’export ajoute 76
meshes, retire les huit anciens, gagne 6 150 sommets et environ 256 ko.
Le contrôle géométrique examine 856 proxies et ne signale aucun défaut.
La validation des assets signale zéro erreur et les mêmes 22 catégories
d’avertissements qu’avant cette passe ; les comptes de meshes sans bake et
de matériaux augmentent. Le mode strict reste donc non conforme. Le coût
en lots de dessin et l’accès au secret restent à mesurer dans le jeu.

Vues de contrôle : [compacteur du dessus](../assets/agencement-etape-3-2026-09-30/compacteur.png),
[planque du dessus](../assets/agencement-etape-3-2026-09-30/secret4.png),
[presse depuis l’entrée](../assets/agencement-etape-3-2026-09-30/compacteur_sol.png),
[indice du secret](../assets/agencement-etape-3-2026-09-30/compacteur_retour.png),
[coin télé](../assets/agencement-etape-3-2026-09-30/secret4_sol.png) et
[coin canapé](../assets/agencement-etape-3-2026-09-30/secret4_retour.png).
Silhouettes contrôlées : [presse](../assets/agencement-etape-3-2026-09-30/presse_silhouette.png),
[benne](../assets/agencement-etape-3-2026-09-30/benne_silhouette.png) et
[canapé](../assets/agencement-etape-3-2026-09-30/canape_silhouette.png).
Les aperçus [du projecteur](../assets/agencement-etape-3-2026-09-30/compacteur_ambiance.png)
et [de la télé](../assets/agencement-etape-3-2026-09-30/secret4_ambiance.png)
simulent les sources locales dans Blender, avec un réglage d’énergie de
présentation ; ils ne sont pas des captures de l’éclairage en jeu.

### Étape 4 — repères du couloir coupe-feu

Deux ensembles ponctuent les accès existants du couloir de 56 m :

- **Chambre froide, y = 107** : cadre jaune sur le mur, nom de la pièce,
  enseigne « FROID » lisible depuis les deux sens. En face, escabeau ouvert,
  caisse à outils et conduites composent un poste de maintenance. La palette,
  la flaque et le seau existants rejoignent cet ensemble contre le mur est.
  Un panneau « SOL MOUILLÉ » accompagne la fuite.
- **SAV, y = 118** : cadre bleu, enseigne double face et extincteur mural.
  En face, un chariot bleu regroupe un carton et deux appareils en retour.
  Les petits appareils reprennent la bibliothèque d’électroménager existante.

L’intention reprend les usages du [board des coulisses](../assets/board-coulisses.md) :
maintenance du froid et dépôt d’appareils. Les bandes et enseignes suivent le
langage graphique de l’étape 1. Les ouvertures, les portes et leurs paramètres
ne changent pas. Aucun nouvel interactif ou éclairage n’est ajouté. Une bande
centrale de 4 m reste dégagée au droit des deux ensembles ; les nouveaux
objets solides utilisent quatre proxies cuboid. La palette garde ses propriétés
physiques et ne reçoit pas de collider statique jumeau.

Sources reproductibles : `tools/blender/lib_service_landmarks.py`,
`tools/blender/refresh_service_landmarks.py`,
`tools/blender/render_service_landmarks.py` et
`tools/textures/generate_service_landmarks.py`. Le générateur complet appelle
le même habillage. La mise à jour localisée sauvegarde la source et l’export
avant de les modifier ; l’export passe par `cassandre.export()`.

Le contrôle Cassandre ne signale aucun défaut : sol, bords, interpénétrations,
objets flottants, spawns ou périmètre du PC sécurité. La validation conserve
zéro erreur et 22 avertissements globaux ; les comptes de matériaux et de
meshes sans bake augmentent. Le mode strict reste non conforme.
La comparaison de l’export confirme que seuls les trois objets regroupés
changent parmi les meshes existants ; leurs UV, normales et matériaux restent
identiques. Les autres meshes, les images embarquées préexistantes et les
propriétés de gameplay sont conservés. L’export ajoute 40 meshes, 1 868 sommets
et environ 91 ko.

Vues à 640 × 360 avec le rendu matériel Cassandre, à 1,6 m :
[approche sud](../assets/agencement-etape-4-2026-09-30/approche_sud.png),
[approche nord](../assets/agencement-etape-4-2026-09-30/approche_nord.png),
[maintenance](../assets/agencement-etape-4-2026-09-30/maintenance.png) et
[SAV](../assets/agencement-etape-4-2026-09-30/sav.png).
Comparaisons avant : [sud](../assets/agencement-etape-4-2026-09-30/approche_sud_avant.png),
[nord](../assets/agencement-etape-4-2026-09-30/approche_nord_avant.png).
Le [dessus du couloir](../assets/agencement-etape-4-2026-09-30/couloir_dessus.png)
permet de suivre l’axe libre. Les silhouettes de conception
[de l’escabeau](../assets/agencement-etape-4-2026-09-30/escabeau_silhouette.png)
et [du chariot](../assets/agencement-etape-4-2026-09-30/chariot_silhouette.png)
ont été examinées avant les derniers ajustements des roulettes et des panneaux.
Ces images sont des aperçus Blender, pas des captures du jeu. La circulation
avec les portes ouvertes, la lisibilité en mouvement et le coût en lots de
dessin restent à confirmer en jeu.

### Étape 5 — compositions des espaces publics

Six ensembles différencient quelques meubles, sans modifier leur trame :

| Espace | Ensemble | Usage visible |
|---|---|---|
| Galerie | Kiosque Presse libre | Présentoir rouge de magazines, trois tablettes et bandeau « PRESSE DU JOUR » à côté du comptoir |
| Galerie | Kiosque Désimlock | Coin réparation sur le comptoir : téléphone redressé, téléphone à plat, petit matériel et enseigne |
| Cafétéria | Table sud-ouest | Plateau laissé avec sandwich, café, couvert et serviette |
| Cafétéria | Table centrale nord | Pause à deux : deux tasses, journal et dossier cartonné |
| Rayons | Tête `ry1s0_sud` | Assortiment consacré au cola 5G, en deux rangs, bandeau « SPECIAL 5G » |
| Rayons | Tête `ry2s1_sud` | Lessive en réassort : tablettes partiellement vides, carton ouvert et bandeau orange |

Les références existantes examinées sont la galerie de Noyelles
(`refs/galerie_marchande/03_noyelles_centre_commercial_galerie_marchande_1.jpg`),
la cafétéria d’Helsinki
(`refs/cafeteria/05_new_childrens_hospital_helsinki_cafeteria_01.jpg`) et le
supermarché Maxi (`refs/hypermarche_90s/01_supermarket_maxi.jpg`), avec les vues
du relevé initial. Les contraintes retenues sont les suivantes : circulation
continue autour des kiosques, objets posés sur les tables, produits regroupés
par promotion et variation de densité sur les têtes. Les textures et la palette
existantes restent la direction graphique ; les marques réelles ne sont pas reprises.

Le présentoir de presse mesure 0,9 × 0,5 × 1,8 m, avec un proxy cuboid au sol.
Les autres ajouts restent sur les meubles et utilisent leurs emprises solides
existantes. Les tables, kiosques, gondoles, distributeurs et accès aux secrets
gardent leur position. Les nouveaux aliments sont des accessoires de décor,
sans récompense de soin ajoutée. Aucun nouvel ennemi, prop dynamique ou
éclairage n’est posé.

Sources reproductibles : `tools/blender/lib_public_compositions.py`,
`tools/textures/generate_public_compositions.py` et
`tools/blender/render_public_compositions.py`. Le générateur complet appelle
les mêmes compositions. La recette `cassandre.compose_public(preview=…)`
écrit un candidat séparé ; sans `preview`, elle sauvegarde la source et
l’export avant la mise à jour et passe par `cassandre.export()`.

Vues à 640 × 360, à 1,6 m :
[presse](../assets/agencement-etape-5-2026-09-30/galerie_presse.png),
[réparation](../assets/agencement-etape-5-2026-09-30/galerie_reparation.png),
[repas](../assets/agencement-etape-5-2026-09-30/cafeteria_repas.png),
[pause](../assets/agencement-etape-5-2026-09-30/cafeteria_pause.png),
[cola](../assets/agencement-etape-5-2026-09-30/rayons_cola.png) et
[réassort](../assets/agencement-etape-5-2026-09-30/rayons_reassort.png).
Comparaisons avant : [presse](../assets/agencement-etape-5-2026-09-30/galerie_presse_avant.png),
[repas](../assets/agencement-etape-5-2026-09-30/cafeteria_repas_avant.png) et
[cola](../assets/agencement-etape-5-2026-09-30/rayons_cola_avant.png).
Dessus contrôlés : [galerie](../assets/agencement-etape-5-2026-09-30/galerie_dessus.png),
[cafétéria](../assets/agencement-etape-5-2026-09-30/cafeteria_dessus.png) et
[rayons](../assets/agencement-etape-5-2026-09-30/rayons_dessus.png).
Silhouettes : [présentoir](../assets/agencement-etape-5-2026-09-30/presse_silhouette.png)
et [plateau](../assets/agencement-etape-5-2026-09-30/repas_silhouette.png).
Les rendus Workbench servent à juger la composition et les textures ; ils ne
représentent pas l’éclairage en jeu. Le pipeline restaure les réglages de rendu
et la visibilité après chaque vue.

Le contrôle géométrique ne signale aucun défaut de sol, bord, chevauchement,
objet flottant, spawn ou périmètre du PC sécurité. La validation signale zéro
erreur et les mêmes 22 avertissements globaux, dont l’absence de bake et le
compte de matériaux ; le mode strict reste non conforme. Lisibilité en
mouvement, budget de lots et confort en combat restent à confirmer en jeu.
L’étape 6 garde sa condition : jouer le combat du Directeur avant de retenir
des couverts supplémentaires.
La comparaison de l’export retire uniquement les quatre meshes de produits
des deux têtes choisies. Les autres meshes, les textures embarquées
préexistantes et les propriétés de gameplay sont conservés. Cette passe ajoute
23 meshes et réduit le total de 2 409 sommets et d’environ 74 ko : les deux
garnissages mixtes denses sont remplacés par des compositions plus simples.

**Étape 6 — essai de deux meubles bas, non intégré.** Une variante séparée
ajoute deux meubles d’archives de 2,40 × 0,75 × 1,20 m sur les côtés du bureau.
L’axe entre les meubles mesure 5,65 m, l’entrée et l’approche de la sortie
restent ouvertes. Deux meshes et deux proxies cuboid sont ajoutés uniquement
au candidat `renders/_cassandre/direction_covers.blend`. La recette
`cassandre.direction_covers()` reproduit la variante, les vues avant/après et
les [mesures de l’essai](../assets/agencement-etape-6-2026-09-30/mesures.json).

L’examen du gameplay révèle une limite à la recommandation initiale : aucune
action d’accroupissement n’existe dans `src/core/input.ts`, les yeux du joueur
sont à 1,60 m et ceux du Directeur à 1,80 m. `resolveAttack` dans
`src/game/entities/enemyMachine.ts` vérifie la visibilité puis vise entre ces
deux points. Sur le même sol, ce segment passe au moins 40 cm au-dessus des
meubles. Ils ne coupent donc pas le tir nominal ; la dispersion peut modifier
certains impacts, sans en faire une protection fiable. Les deux meubles
réduisent les zones disponibles pour les déplacements latéraux.

**Décision : conserver la salle actuelle et écarter ces meubles bas.** C’est
une conclusion sur la géométrie et les règles actuelles, pas un verdict de
playtest. Aucun combat réel n’a été joué pendant cette étape ; la qualité du
combat et une éventuelle variante avec des volumes plus hauts restent à
évaluer en jeu. La source et le GLB livré ont gardé leurs empreintes SHA-256
pendant l’essai. Aucun nouveau couvert n’est exporté.

Vues de contrôle Blender : [comparaison](../assets/agencement-etape-6-2026-09-30/comparaison.png),
[plan du candidat](../assets/agencement-etape-6-2026-09-30/dessus_candidat.png)
et [silhouette du meuble](../assets/agencement-etape-6-2026-09-30/archives_silhouette.png).
Les rendus utilisent la lumière de contrôle Workbench ; ils ne représentent
pas l’éclairage du jeu. Cette étude ne clôt pas le jalon N10.

**Correction des écrans de bureau.** Retour utilisateur du 30 septembre : les
écrans regardaient à l’opposé des fauteuils. Les cinq postes (Directeur,
sécurité, deux en comptabilité et RH) ont maintenant leur écran et leur
clavier face au fauteuil. `lib_bureaux.orienter_equipements_poste` corrige
l’ensemble dans le générateur et `cassandre.orient_office_screens()` applique
la correction aux instances et aux quatre modèles locaux de bibliothèque.
Les tables, sièges et colliders gardent leur place. La source Blender et le
GLB du jeu sont mis à jour après sauvegarde. Vues de contrôle :
[avant](../assets/bureaux-ecrans-2026-09-30/avant.png) et
[corrigées](../assets/bureaux-ecrans-2026-09-30/corrige.png), depuis chaque
fauteuil, sous la lumière de contrôle Workbench.

## Rejeté et raison

Remplir uniformément les zones vides n’est pas retenu : elles donnent de
l’espace pour esquiver et rendent les passages visibles. Une recomposition
des meubles existants et quelques repères ciblés suffisent à une première passe.

## Leçons

Commencer par la signalétique et le rangement des objets isolés. Faire ensuite
une traversée en jeu, avec combats, avant d’ajouter des couverts ou de modifier
la géométrie. Le générateur de référence est
`tools/level_v2/build_niveau.py` ; le contrôle utilisé est
`tools/level_v2/audit_niveau.py`.
