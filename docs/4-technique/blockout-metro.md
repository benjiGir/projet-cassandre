---
title: Métro complet — blockout N5
tags: [metro, niveau, blender, trains]
status: brouillon
updated: 2026-10-09
---

# Métro complet — blockout N5

## Responsabilité

Le [parcours d'essai](../assets/blockout-metro.html) raccorde le quartier
validé aux espaces du [plan N2](../assets/plan-metro.md), jusqu'au hall de la
tour. Le catalogue `metro` charge `metro_blockout.glb` ; `blockout_metro`
offre le même fichier en développement. Les pilotes N4, N4b et T2 restent
séparés et disponibles.

Le quartier conserve sa composition, ses collisions et ses lampes validées.
Sa rue et sa place reprennent l'emprise N4b, affinée avec l'utilisateur,
plutôt que les masses schématiques de 80 × 72 m de N2. Le reste du parcours conserve ses raccords, avec les révisions N5
décrites ci-dessous. Le secret d'arrière-boutique
n'est pas construit ici. Le local d’agents possède son décor, sans déclencheur
ni récompense de secret. Le local de maintenance dans la réservation de machinerie est meublé ;
son déclencheur et sa récompense, ainsi que le toit S3, attendent N7.
Une [première passe de rencontres](rencontres-metro.md) est intégrée le
9 octobre : trois espèces existantes, ressources et deux vagues à bord.
Contrôleur, secrets, bornes et équilibre final restent à N7/N8.

## Fichiers

| Rôle | Fichier |
|---|---|
| Assemblage | `tools/metro/blockout/build_blockout.py` |
| Supports et enveloppes | `tools/metro/blockout/geometry.py` |
| Altitudes et refuges révisés | `tools/metro/blockout/layout.py` |
| Voûtes, rails et arrière-tunnels | `tools/metro/blockout/rail_architecture.py` |
| Profil commun des voûtes et suspensions | `tools/metro/blockout/vault_profile.py` |
| Jonction commune des voûtes B et du sas nord | `tools/metro/blockout/vault_junction.py` |
| Trappe et descente de service du quartier | `tools/metro/quartier/service_access.py` |
| Guichet et portiques | `tools/metro/blockout/station_ticket_hall.py` |
| Escalier public et enveloppe | `tools/metro/blockout/station_descent.py` |
| Mobilier de station | `tools/metro/blockout/station_dressing.py` |
| Coffrets de commande | `tools/metro/blockout/control_panels.py` |
| Placement des arrêts dans les refuges | `tools/metro/blockout/refuge_controls.py` |
| Tête nord et accès de maintenance | `tools/metro/blockout/station_head.py` |
| Réseaux et appliques des galeries | `tools/metro/blockout/service_galleries.py` |
| Point d'entretien de la première galerie | `tools/metro/blockout/gallery_service_bay.py` |
| Distribution et première rampe des galeries | `tools/metro/blockout/gallery_distribution.py` |
| Vestiaire et accès des agents | `tools/metro/blockout/agents_room.py` |
| Seconde pente et retour vers A | `tools/metro/blockout/gallery_return.py` |
| Charpente, atelier et embarquement | `tools/metro/blockout/depot_workshop.py` |
| Franchissement de A et seuil du dépôt | `tools/metro/blockout/depot_entry.py` |
| Poste d'ajustage oriental | `tools/metro/blockout/depot_fitting_bench.py` |
| Postes de révision des bogies | `tools/metro/blockout/depot_bogie_bays.py` |
| Inspection du moteur déposé | `tools/metro/blockout/depot_motor_bench.py` |
| Maintenance électrique hors du coude VB | `tools/metro/blockout/depot_relay_bench.py` |
| Garde-corps et marquise du quai | `tools/metro/blockout/depot_boarding_platform.py` |
| Sièges de service de la première voiture | `tools/metro/blockout/freight_entry_seating.py` |
| Charges arrimées de la deuxième voiture | `tools/metro/blockout/freight_service_cargo.py` |
| Sièges de l’équipe dans la troisième voiture | `tools/metro/blockout/freight_crew_seating.py` |
| Pupitre de départ et encadrement de l’afficheur | `tools/metro/blockout/freight_departure_console.py` |
| Accès et pupitre d'aiguillage | `tools/metro/blockout/switching_post.py` |
| Fosse, ventilation et poste force | `tools/metro/blockout/machinery_room.py` |
| Rame, garage et quai d’arrivée | `tools/metro/blockout/freight_carriage.py` |
| Quai privé et sortie nord | `tools/metro/blockout/private_station.py` |
| Jardinières et assises du parvis | `tools/metro/blockout/tower_plaza_furniture.py` |
| Remontée, parvis et seuil de tour | `tools/metro/blockout/tower_approach.py` |
| Ennemis, déclencheurs et ressources | `tools/metro/blockout/encounters.py` |
| Scénarios des rencontres | `src/game/level/blockout/metroEncounterEvents.ts` |
| Sas du trafic VB et raccords | `tools/metro/blockout/traffic_layout.py` |
| Quartier conservé | `tools/metro/quartier/build_pilot.py`, mode `save=False` |
| Source / runtime | `assets_src/blender/metro_blockout.blend`, `public/assets/levels/metro_blockout.glb` |
| Progression | `src/game/level/blockout/metroBlockout.ts` |
| Noms des commandes | `src/game/level/blockout/blockoutConfig.ts` |
| Chargement et installation | `src/game/level/loading/loader.ts`, `src/game/session/spawning.ts` |
| Voyage partagé | `src/game/level/trainRide/trainRideSystem.ts`, `src/render/environment/trainRide/trainRidePresentation.ts` |
| Revue | `docs/assets/blockout-metro.html` |

## Géométrie

La préparation N2 fournit les supports recoupés des tubes, niches, galeries
et salles. Chaque support devient un prisme avec proxy convexe. Les arêtes
sont découpées aux raccords des autres supports : un mur ferme une limite
extérieure, un petit soubassement ferme une différence de niveau, un linteau
rejoint deux plafonds de hauteurs différentes. Les plafonds ordinaires
restent visuels pour ne pas devenir des sols du graphe 2,5D.

Les voûtes utilisent un profil demi-elliptique à 24 segments, commun aux
portails et aux suspensions. Leur enveloppe fermée possède une épaisseur
de 12 cm, avec des normales lissées sur les deux faces courbes. Les UV
suivent la longueur de l'arc et le cheminement longitudinal, à une répétition
tous les 2 m. Les courbes suivent la même section à chaque raccord ; les
arrière-tunnels reprennent une naissance à 2,75 m au-dessus des rails.

Les rampes conservent leurs altitudes, dont −5 → −13 m vers les quais,
−13,75 → −18 m dans A, −18 → −22 m vers la machinerie et −17,25 → 0 m
après le quai privé. La fosse de la machinerie possède des garde-corps ajourés
de 1,5 m, un cuvelage jusqu’au fond fermé et un plafond continu. La réservation de toit S3 est différée à son placement N7 après la révision
des garages ; le dépôt conserve ici un sol continu.

Les ouvertures vers l'escalier public et la trappe raccordent l'enveloppe
N4b. La paroi « QUAIS — HORS PILOTE » est retirée. Les voies publiques ont
des traversées guidées à Y 134 et 172. Le quai gauche reste continu jusqu'au
passage de maintenance ; aucune cloison transversale n'en coupe le parcours.
Les deux quais restent à 0,75 m au-dessus des rails, franchissables en saut.

## Profondeur et circulation

Après le retour du 8 octobre, le candidat N5 place les quais à −13 m et les
rails à −13,75 m. Le plan N2 reste archivé à ses altitudes d'origine. Le
module `blockout/layout.py` adapte ses données pour la construction jouable,
sans modifier les altitudes du quartier, des billets ni du dépôt.

L’escalier entre les billets et le quai descend de −5 à −13 m en deux
volées de 16 marches de 25 cm, séparées par un palier de 1,50 m. Il occupe
X −9 à −4 / Y 106,50 à 118. Chaque volée avance de 5 m. Le hall est recoupé
sur les 1,50 m de son entrée, pour ne pas conserver une dalle au-dessus
des premières marches. Les collisions suivent deux rampes et le palier ;
les marches, nez antidérapants et mains courantes sont visibles. Les murs
latéraux et le plafond suivent la descente, avec 2,75 m de dégagement,
un bandeau pétrole et trois luminaires fixés par des tiges courtes. Le
dégagement se mesure sous la dalle de plafond ; les bandes sont avancées
de 12 mm devant les murs pour éviter les faces coplanaires. Une fixation
de main courante est conservée à chaque raccord de volée.
Le tunnel A rejoint toujours le dépôt à −18 m ; ses sols, niches, voies,
voûtes, galeries, grille, commandes, lampes et poses d'auteur suivent cette
nouvelle pente. Le dessus de la voûte du quai atteint −6,38 m ; il reste
1,13 m sous le dessous du plancher des billets, à −5,25 m.

Le prolongement B tourne vers l’est dès la tête nord du quai. Son fond est
placé après le coude ; il ne ferme plus la voie dans l’axe de la station.
L’entrée des galeries entre Y 214 et 216,5 reste accessible depuis A.
Les plafonds visuels n’ajoutent pas de sol navigable. La descente et le
franchissement sont observés en jeu ; les relevés sont dans le journal du
8 octobre.

Le candidat conserve dix niches dans A/B, au lieu de dix-neuf, et une dans
le sas VB, au lieu de deux. Les ouvertures retirées sont refermées lors de
la reconstruction ; leurs lampes, boutons et marqueurs de refuge sont
retirés ensemble. Les feux passent d'un espacement de 14 à 30 m ; les deux
afficheurs publics restent sur les quais. Le contrôle de lisibilité au
chargement continue d'utiliser les signaux et refuges réellement présents.

Les deux câbles de chaque côté des axes sont remplacés par une goulotte
sur une seule paroi : sa géométrie suit les arêtes du tube, à 2,44–2,68 m
du sol, avec consoles tous les 6 m sur les portions de mur pleines. Les
rails et traverses restent indépendants de ce cheminement technique.

## Guichet et validation

La billetterie possède un guichet vitré côté est, raccordé à l’arrière-guichet
existant. Son comptoir de 0,95 m fait face à l’arrivée ; bureau, écran, siège
et armoire restent derrière le vitrage. Le plafond du guichet est à 3 m,
contre 3,50 m dans le hall. La descente de service arrive à l’arrière-guichet,
puis rejoint le poste. Une ouverture permanente de 2,30 × 2,75 m dans sa
façade nord, entre X 15,50 et 17,80 / Y 89,55, donne sur le hall. Son cadre
et son linteau remplacent le vitrage sur cette portion. L’armoire reste à
l’ouest de l’ouverture ; le passage depuis le couloir de service est libre.
La sortie ne demande aucune action E ni aucun saut.

Cinq corps de validation à Y 98,50 forment quatre passages : 1,75 m, 2,50 m,
1,25 m et 1,25 m. Le passage large est centré à X −6,50, dans l’axe de
l’escalier. Les vantaux sont repliés dans les corps. Les barrières latérales
rejoignent les parois ; leurs collisions font 1,50 m de haut. Lecteurs et
guichet sont décoratifs, sans nouvelle carte exigée ni interaction.

Des groupes de mobilier sont adossés aux murs : deux bornes de billets à
tête inclinée, écrans et pavés, plans graphiques encadrés, bancs à coques
avec pieds et accoudoirs, corbeilles ouvertes et armoire murale. Les deux
quais gardent au moins 3,40 m d’allée ; aucune traversée de voie n’est
occupée. Les bornes et leurs plans restent décoratifs.

Les commandes existantes utilisent des coffrets métalliques à coins coupés,
une façade en retrait et un bouton rond saillant. L’arrêt possède un
champignon rouge ; courant, aiguillage et départ possèdent des pictogrammes
propres. Trappe, grille et raccourci réemploient ce coffret. Les identifiants,
cibles, messages et commandes du scénario sont conservés. Le coffret de
grille fait face au hall, d’où le joueur l’actionne. Les petits
cartouches remplacent les panneaux redondants des pupitres. Les anciens
coffrets et voyants sont retirés, y compris les trois volumes de commande
intégrés auparavant au décor du raccourci. La trappe conserve un seul
socle, dimensionné jusqu'au sol.

## Raccord nord de la station

Le front à Y 190 est construit par `station_head.py`. Les murs de fin des
supports génériques sont omis sur ce bord ; ils fermaient notamment la voie
droite, dont le prolongement n'appartient pas aux supports N2. Le nouveau
front rejoint les deux parois et la voûte de station. Deux ouvertures
arrondies laissent les voies libres, séparées par un pied de 0,25 m.
Les voûtes A/B et leurs prolongements utilisent le même profil elliptique
que leurs ouvertures. Les sommets des fronts nord et sud suivent les mêmes
points que la voûte de station, pour fermer les jours au-dessus des murs.
Les garde-corps des deux quais sont ajourés, avec deux lisses et des
poteaux espacés d'au plus 2,75 m. Leurs proxies cuboid conservent la limite
de 1,50 m et les deux traversées restent ouvertes.
Les suspensions sont dimensionnées contre la hauteur réelle du profil
polygonal. Une marge de 55 cm sous le point le plus bas de la voûte au-dessus
du luminaire empêche son boîtier de couper la courbe. Les ombres des lampes
de quai sont désactivées dans l'aperçu Blender, conformément à leur absence
dans le moteur ; les marques noires projetées par les boîtiers ne décrivaient
pas la géométrie vue en jeu.

L'accès de maintenance traverse le front entre X −7,6 et −4,85. Une rampe
de 7,5 m relie le quai à −13 m au premier renfoncement à environ −13,97 m.
Le joueur tourne vers la voie au bout de cette rampe. Son plafond reste à
3 m du sol ; les sols des niches sont recoupés contre ce support. La
commande d'arrêt est fixée au mur ouest du renfoncement, face au passage.
Les autres refuges portent un seul arrêt au fond, tourné vers leur
ouverture. `refuge_controls.py` calcule ces poses à partir des niches ;
les plaques anciennes et potelets centraux sont retirés. Les volumes
sûrs sont recentrés près des commandes, à portée d'utilisation.

À Y 214–216,5, la galerie possède un encadrement et un linteau métalliques,
un seuil de 3 cm, ainsi qu'une porte visuelle ouverte contre le mur intérieur.
Le passage reste libre ; cette porte n'ajoute pas de commande. Un seul
écriteau « SERVICE » est posé au-dessus du linteau. Les appliques du tunnel
et de ce seuil ont des boîtiers visibles. La goulotte est fixée au front.

La reprise de la station couvre la tête nord, le premier passage de
maintenance et le seuil des galeries. La passe suivante reprend les
galeries jusqu'au retour dans A. Le dépôt reçoit ensuite sa charpente, ses
zones d'atelier et son embarquement ; le poste d’aiguillage et la machinerie sont ensuite repris séparément.

## Galeries de service

Les neuf tronçons gardent leurs coudes. Le sol reste de niveau dans les
passages est-ouest et les paliers. Deux rampes longitudinales, à Y 222–240
et 273–299, absorbent la descente ; leurs extrémités subdivisent les supports.
Les hauteurs d’entrée et de retour sont celles de A au centre des seuils.
Il n’y a plus de dévers dans les couloirs transversaux. Sol, plafond et réseaux
partagent cette altitude. Les raccords avec A comportent au plus 3,4 cm
de différence sur les côtés du seuil.

Deux conduites suivent une seule paroi, à 2,32 et 2,57 m du sol. Des coudes
arrondis les raccordent, avec consoles et colliers espacés d'au plus 4 m.
Une goulotte continue les accompagne à 2,81 m. Les réseaux restent visuels
et n'ajoutent pas de collision dans le passage de 2,50 m. Leurs extrémités
entrent dans des boîtiers de raccordement.

Le premier tronçon, X 0,80–26,75 / Y 214–220,50, possède un point
d'entretien original. Une dérivation rejoint la conduite existante,
descend vers une grille de drainage et porte une vanne à volant ajouré et
un manomètre. Les colliers relient sa descente au mur. Un établi mural de
2,10 × 0,35 m accompagne le coffret opposé : tiroirs, panneau d'outils et
boîte ouverte. Une lampe de travail sur deux consoles éclaire son panneau
ivoire ; son câble rejoint le coffret voisin. Son proxy cuboid est limité à 38 cm de profondeur ; une
allée d'au moins 2,10 m reste libre. Les plinthes sont décollées des faces
des murs ; aucun texte de direction ni nouvel objet interactif n'est ajouté.
Les autres tronçons ne reçoivent pas ce mobilier par répétition automatique.

Le tronçon suivant possède une armoire électrique unique, sur le mur sud
à X 43,25 / Y 218. Son alimentation rejoint la goulotte opposée par une
traversée à 2,81 m, suspendue au plafond et bridée au mur. Deux portes
peintes, une poignée, des charnières, des ouïes et de petits équipements
de façade la distinguent d'un bouton de jeu. Son proxy s'avance de 34 cm ;
plus de 2,15 m restent libres. Elle ne porte aucun `use_*`.

Une main courante ronde suit la première descente, Y 221,50–241,50,
sur le mur est. Sa hauteur reste à 1,03 m du sol ; ses supports sont
raccordés au mur et ses extrémités y retournent. Les plinthes de ce tronçon
sont subdivisées aux changements de pente de Y 222 et 240. Le relief et
les collisions du sol ne changent pas.

Le vestiaire conserve son emprise de 8 × 6 m et son accès latéral de
2,50 m. Deux battants ouverts contre la paroi encadrent le seuil ; le
linteau est raccordé au plafond. L'accès est éclairé par une applique
murale raccordée au chemin de câbles, et le néon de la pièce reçoit
deux suspentes rejoignant son plafond à 3,50 m.

Quatre casiers sur pieds longent la paroi nord. Le dernier est ouvert à
130° vers l'espace libre, avec penderie, gilet, tablette, casque et
chaussures ; les trois autres portent serrure, porte-étiquette et ouïes.
Le banc à trois lattes possède une structure ajourée et laisse environ
1,30 m entre son dos et les casiers. Le lavabo mural a une cuve creuse,
un dosseret, un robinet, des consoles, une évacuation et un distributeur
de savon. Ce mobilier reste décoratif ; les proxies du banc, des casiers
et de la cuve sont distincts de leurs détails visuels.

Les lumières génériques sans support sont remplacées par des appliques
murales, espacées d'au plus 8 m. Leurs boîtiers et fixations sont visibles.
L'applique voisine de la réservation du secret est décalée sur le mur plein,
afin de ne pas flotter dans l'ouverture. Deux coffrets fixés au mur ont des
proxies cuboid ; leur profondeur est de 18 cm.

Le retour dans A possède un encadrement sans porte ni obstacle central.
Ses faces côté galerie sont peintes en ivoire, avec deux repères ambrés
au pied ; une bande verte au sol marque le seuil sans collision ajoutée.
La seconde pente, Y 273–299, reçoit une main courante à 1,03 m du sol.
Elle se prolonge dans le coude, avec un arrondi de 25 cm de rayon, puis
s'arrête avant le coffret du retour. Supports et retours d'extrémité
rejoignent les murs. Les plinthes sont subdivisées aux changements de
pente. Un coffret de jonction compact remplace l'ancien coffret à X 57 ;
sa descente et sa traversée suspendue rejoignent la goulotte existante.
Il reste décoratif, avec un proxy de 22 cm de profondeur.
La commande `use_n5_raccourci` est déplacée sur la paroi nord, à X 44 / Y
304,25, avec une petite inscription « RACCOURCI » et un cheminement électrique
jusqu'à la goulotte. Sa cible et son comportement restent ceux de la grille.
L’ancienne salle Sang-Froid de 32 × 24 m est remplacée par un vestiaire de
8 × 6 m au même accès. Quatre armoires, un banc et un point d’eau occupent
ses parois. La lampe possède un boîtier au plafond et la porte visuelle est
rabattue dans le local. Son déclencheur et sa récompense restent à N7.

## Dépôt

Le hall central mesure 24 × 44 m, avec une hauteur de 6,50 m. L’atelier
oriental et le passage occidental vers B ont des plafonds à 4,70 m. L’emprise
praticable totale passe de 2 816 à 2 336 m² ; le rectangle sud-ouest inutilisé
est retiré et sa limite est fermée par le générateur des supports. Trois
travées portent la charpente du hall. Les luminaires sont fixés à ses poutres.
Les deux passages de quatre mètres dans la séparation orientale donnent
sur les accès de machinerie. Entre eux, un soubassement de 1,10 m et une
ossature ajourée laissent voir l’atelier. Le garde-corps possède une collision
de 1,50 m. L’allée orientale garde quatre mètres libres ; ses traits de bord
s’arrêtent avant les voies. Les coffrets et conduites sont fixés au garage,
hors de cette allée. Le chemin occidental rejoint le poste par B ; son établi
de maintenance électrique est déplacé hors du coude VB, à X 25,35–26,45 /
Y 351,05–356,40. Son cadre et sa lampe sont autonomes ; la baie sud et les
traits de l’allée Y 346,05–350,10 restent dégagés. Un cadre
ajouré conserve quatre mètres libres au seuil ouest. Un coffret passif portant
un petit diagramme de voies et sa conduite murale annoncent la branche ;
l’applique du coude éclaire la véritable porte « POSTE ». Il ne porte aucun
bouton ni nouvel objectif. La visite du 8 octobre rejoint cette commande
par B, active l’aiguillage et revient au quai sans saut, trafic suspendu
([relevé local](../assets/blockout-metro/poste-liaison-parcours-2026-10-08.json)).

La sortie de A traverse un platelage de 1,55 m de large, à 17,5 cm au-dessus
du sol, aligné sur les têtes des rails. Trois panneaux laissent des gorges
de 5 cm autour de chaque rail ; la collision piétonne est une boîte continue.
Deux rampes convexes de 60 cm rejoignent le sol aux extrémités. Deux
garde-corps de 1,10 m bordent le seuil côté hall, avec semelles et boulons.
Leurs proxies latéraux laissent 3,42 m libres entre eux. Les traits de
l'allée rejoignent le débouché. Le panneau « DEPOT > » de trois mètres
est retiré ; un luminaire fixé au cadre et relié à une dérivation murale
marque l'accès. Le trafic, les rails et leurs itinéraires sont conservés.

A arrive au dépôt puis bifurque dans deux coudes qui masquent sa naissance.
Une branche droite continue vers la rame de fret garée, avec des rails
jusqu’à Y 366. Les anciens mur et butoir de ce raccord sont retirés.
L’atelier contient des pièces en caisse et des établis. Les deux bogies
schématiques sont remplacés par deux états de révision : au sud, un bogie
assemblé avec longerons ajourés, suspensions, moteur et freins ; au nord,
un châssis sur quatre chandelles et deux essieux déposés à côté. Les roues
sont calées sur du bois, leurs centres assombris distinguent les jantes.
Le poste nord présente un moteur déposé sur son plateau : corps nervuré,
flasques, arbre et capot de ventilation. Un comparateur fixé au plateau
approche l’arbre ; des roulements reposent dans un bac et dans le rack
latéral, partiellement rempli. Un luminaire sur consoles rejoint le mur
nord par une dérivation locale. Ce poste n’introduit aucun interactif.
Le passage occidental possède un établi distinct : appareil de mesure
à aiguille, cordons sur plateau et relais ouvert avec bobine, noyau,
armature et contacts. Capot, outils et armoire complètent ce poste.
L’ancien meuble nord empiétait sur le garage VB : il est retiré.
La nouvelle lampe repose sur un cadre lié au piètement, sans fixation
à une paroi absente. Aucun fonctionnement électrique ni nouvel objectif.
Les deux néons des bogies sont recentrés et suspendus au plafond. Des traits aux angles
délimitent les postes, sans texte ni ajout de rails. La circulation reste
à l’ouest, à l’est des essieux et entre les deux postes. La voie
de manœuvre et la rame du secret S3 restent à N7 ; la bifurcation visible
n’a pas encore d’aiguille détaillée. La sortie de VB possède aussi deux
coudes. L’ancien accès piéton nord est fermé par leur coque ; l’aller et le
retour du poste utilisent désormais l’ouverture sud « POSTE », entre
X 9,5 et 13,5. Elle rejoint le passage occidental à Y 348.

L'établi oriental mesure 4 × 0,80 m, avec un plateau à 94 cm. Un étau à
mâchoires séparées serre le pied d'un profil de rail court ; sa vis et son
levier débordent du plateau côté atelier. Le panneau clair porte trois
clés, un marteau, une pince et un tournevis. Deux tiroirs, une tablette
basse et un bac de pièces regroupent le rangement. L'armoire à deux portes
est au nord, entre Y 336,65 et 337,65 ; elle ne déborde plus sur l'accès
de machinerie Y 328–332. La lampe repose sur deux consoles fixées au mur,
avec câble et dérivation locale. Le poste réemploie le sol et la paroi ;
aucune interaction n'est ajoutée. Les postes moteur et électrique ont leurs
propres composants et emplacements, décrits ci-dessus.

L’embarquement possède trois marches de 25 cm et un quai ouvert de 3 × 4 m,
à −17,25 m. Les garde-corps et la petite marquise remplacent le sas opaque.
Les appuis ouest sont recentrés sur X 34,87, avec semelles de 20 cm
reposant entièrement sur le quai qui commence à X 34,75. Une main courante
relie le pied des marches au garde-corps ouest ; lisse intermédiaire et
plinthes complètent la protection. Des proxies de 23 cm de large longent
les marches et laissent 2,77 m utiles. Le bout nord est fermé, l’accès à la
porte latérale reste libre. Les deux colonnes portent une marquise à
traverses et consoles diagonales ; son luminaire rejoint la couverture
par deux suspentes. Les deux points lumineux existants sont conservés,
celui du quai abaissé de 20 cm. La paroi occidentale du garage A s’arrête
à Y 361,80, soit 2,20 m avant les marches ; la rame est visible à l’approche.
Nez de marche et bande étroite côté rame
précisent le seuil. Sols, marches et fonctionnement des portes de la rame
sont conservés.
Pour les vues Blender du quai, `cassandre shot voyage=depart` masque
l’environnement d’arrivée superposé dans la scène sauvegardée ; la visibilité
initiale est restaurée après le rendu. Les vues en jeu restent la preuve du
rendu effectivement présenté au joueur.
Le mur séparant le dépôt du quai privé descend à −18 m, comme le sol du
dépôt ; sa hauteur de 6,75 m ferme la fente sous son ancien socle à −17,25 m.
Le front de la voiture possède pare-brise sombre, montant central,
essuie-glaces, phares et attelage. Une cabine fermée occupe les 1,30 m avant
de la première voiture ; l’accès latéral garde son passage derrière elle.
Les vitres latérales restent transparentes. La caisse, la porte latérale et
les rails se lisent à l’approche du quai. Le quai est
déclaré voisin du dépôt lors de la découpe des murs. Les meshes ajoutés au
dépôt appartiennent au groupe de départ, masqué pendant le voyage.

Les inscriptions et plaques de refuge sont retirées ; seules les commandes
murales restent.
L’afficheur de voyage N5 mesure 1,20 × 0,375 m et est fixé au-dessus du pupitre,
au lieu du panneau de 2,80 m. Les dimensions par défaut de l’essai T4 restent
celles de son prototype. Les libellés d’objectifs se trouvent sur les commandes.
Le [schéma simplifié](../assets/parcours-metro-simplifie.svg) distingue l’aller-retour
vers le poste de la boucle de machinerie, puis le voyage vers le quai privé, sans prétendre représenter
les distances ni remplacer le plan métrique N2.

## Poste d'aiguillage

Le poste possède un vestibule de 2 × 4 m à −18 m, la montée de 4 m et la cabine de
10 × 10 m à −16 m. L'entrée depuis le dernier tronçon de B possède un
encadrement de 2,80 m de large et de haut ; les côtés et le dessus sont
refermés jusqu'aux murs existants. La porte visuelle reste ouverte contre
la paroi et ne demande aucune action supplémentaire.

Le vestibule s'arrête à Y 376 et 380, dans la largeur de l'escalier. Sa porte
ouverte et son applique sont posées contre le mur nord. Il n'empiète pas
sur la dérivation VB. Le tunnel B et son sas nord partagent une coque de
voûte : union des volumes intérieurs, conservation des faces de toiture,
puis épaisseur de 12 cm. Les deux voûtes ne se traversent plus à la jonction.
Les arrière-tunnels VB commencent à la largeur de 7 m de la voie visible,
avant leur élargissement à 8,50 m.

Huit marches de 25 cm habillent la rampe existante ; son collider incliné
est conservé pour le déplacement. Les mains courantes suivent sa pente,
avec des fixations. Les appliques sont fixées aux murs du lobby et de
l'escalier ; deux luminaires rejoignent le plafond de la cabine.

Un pupitre de 6 m réunit deux écrans statiques, des claviers, des boutons et
la commande `use_n5_aiguillage`. Le tableau de voies mural est un schéma
original simplifié, visuel : il n'affiche pas l'état réel des trains. Son
câble rejoint le pupitre. Les deux armoires et le bureau occupent les bords
de la cabine, avec leurs faces utiles tournées vers l'intérieur.

La commande est située à X −73,13 / Y 380,065 / Z −14,81. Son nom reste
celui du contrôleur N5 : E valide l'objectif d'aiguillage et active VB.
Le changement concerne la géométrie et la pose, sans modification de la
progression TypeScript. La vue « Accès du poste » démarre dans B à
X −63,25 / Y 378, pour observer l'entrée et monter à pied.

## Machinerie

La boucle de 32 × 32 m conserve son sol à −22 m et ses deux rampes de
16 m depuis le dépôt. Les mains courantes suivent la pente de −18 à −22 m ;
les appliques sont fixées à leurs parois. Les bords de la fosse de
12 × 16 m utilisent quatre proxies cuboid de 1,50 m, avec des lisses et
des poteaux visibles. Les parapets opaques sont retirés. Le cuvelage
descend jusqu’au fond à −26 m et un plafond ferme son ancienne ouverture
vers le ciel à −17 m.

Le ventilateur axial de 6,40 m repose sur deux socles. Sa grille frontale
laisse voir sept pales statiques ; sa transition arrière et sa gaine
verticale rejoignent le plafond, à l’intérieur de la fosse. Deux pompes
et leurs conduites occupent le bord ouest. Les armoires électriques sont
contre le mur nord-est, avec leur façade tournée vers la circulation.
Les lampes devant les armoires sont suspendues au plafond, pour éclairer
la face utile plutôt que leur arrière.

La commande `use_n5_courant` est intégrée à l’armoire à
X 115 / Y 356,65 / Z −20,70. Son identité et la progression restent
inchangées : E rétablit le courant du fret. La géométrie de ventilation
est statique ; cette passe n’ajoute ni animation ni nouveau son.
La réservation du secret 4 est conservée pour N7. Les vues « Accès
machinerie », « Ventilation » et « Courant » permettent de regarder
la descente, l’installation et l’objectif séparément.

Le local latéral de 8 × 6 m possède un établi, un rangement de pièces,
une armoire et deux luminaires fixés au plafond. Sa liaison de 2,50 m reste
libre et encadrée ; la conduite relie le couloir à la paroi du local.
Son décor ne déclenche pas le secret S4.

## Rame de fret et arrivée

`freight_carriage.py` conserve le plancher fixe à −17,25 m, quatre voitures
de 15 m et trois raccords de 50 cm, de Y 366 à 427,5. Les plafonds plats
génériques de fret sont remplacés par une toiture à pans de 2,80 à 3,25 m.
Les fenêtres possèdent chacune un cadre ; les parois pleines et leurs
proxies sont interrompus aux deux portes. Les soufflets restent ouverts,
avec des nervures, des seuils bas et une allée d’au moins 2 m. Les sièges
latéraux et les charges arrimées occupent les bords ; les luminaires et
les mains courantes sont fixés à la toiture.

Dans la première voiture, les quatre banquettes à Y 371,20 et 374
portent chacune deux sièges profilés sur consoles murales. Les coques claires
encadrent des coussins pétrole ; un siège du second groupe ouest est relevé,
avec charnière visible et proxy rapproché de la paroi. Les accoudoirs
et montants sont ronds ; semelles au sol, barres longitudinales continues
à 2,60 m et suspentes sous la toiture les raccordent. L’allée entre
accoudoirs mesure 2,172 m ; les anciens blocs et segments de main courante
de cette voiture sont retirés. Les sièges des voitures suivantes et
le trajet sont conservés.

Dans la deuxième voiture, les charges Y 386–388,40 sont remplacées par
quatre valises en deux piles à l’ouest et deux enrouleurs à l’est. Les
valises possèdent coques nervurées, poignées et loquets ; quatre sangles
relient leurs couvercles aux ancrages du socle. Les enrouleurs montrent
câble, flasques, prises et manivelle ; leurs pieds et poignées sont
raccordés, avec brides au socle. Les bases de 0,62 × 2,40 m laissent
2,16 m dans l’allée ; chaque équipement porte un proxy distinct du socle.
Les anciennes charges de cette voiture sont retirées. Celles de la
quatrième voiture et le voyage sont conservés.

La troisième voiture réemploie les sièges profilés via `bench` et le cadre
de barres via `handrails`, dans `freight_entry_seating.py`. Les groupes
Y 399,80 et 402,60 remplacent les quatre banquettes génériques. Une assise
est relevée côté est dans le premier groupe, une autre côté ouest dans
le second. Leurs proxies suivent ces positions. Les barres continues
Y 399,745–404,005 rejoignent les montants et suspentes ; les anciens
segments de cette voiture sont retirés. L’allée garde 2,172 m entre
accoudoirs. Le helper conserve les poses et formes de la première voiture.

La porte d’entrée ouest coulisse vers le nord et la sortie est vers le sud,
chacune dans une poche située à l’intérieur de la longueur de la rame.
Elles gardent leurs identifiants et une course de 3,25 m. Le pupitre de
la quatrième voiture porte `use_n5_depart`, à
X 39,5 / Y 426,04 / Z −16,24. Le contrôleur, le panneau de voyage et
la durée fixe de 60 secondes restent inchangés.

Le pupitre possède un caisson profilé sur plinthe, un plateau incliné,
une façade ventilée, un cadran et un levier de décor. Le coffret de départ
est unique, fixé à la façade, et garde sa position. L’afficheur runtime
de 1,20 × 0,375 m se trouve à X 39,50 / Y 426,08 / Z −15,30 ; son
encadrement laisse cette surface entière libre et rejoint le plateau
par deux montants. Un câble descend dans le caisson ; une conduite
rejoint la paroi arrière de la voiture. Un proxy de 1,50 × 1,42 × 1,57 m
couvre le caisson et le bouton, à X 38,75 / Y 425,80 / Z −17,25.
Les passages entre pupitre et parois mesurent 1 m. La sortie latérale
Y 423–426 reste accessible depuis l’approche du pupitre.

Un garage ferme les vues extérieures avant le départ. Ses murs et son toit
sont visuels, car une collision d’un décor masqué persisterait à l’arrivée.
Les marches et le quai d’embarquement gardent leurs collisions. La rame
possède toujours ses limites propres ; le joueur reste dans celle-ci
pendant le trajet. Le garage appartient à `stage_voyage_depart`.

L’environnement d’arrivée appartient à `stage_voyage_arrivee`. Le volume
opposé au quai ferme aussi les vues par les vitres ouest. La paroi sud
referme l’ancien raccord visuel au dépôt ; son collider est celui de la
séparation existante, sans doublon. Le quai privé garde son emprise N2,
avec une palette de pierre et de sol froide, des joints de dallage, quatre
travées, une ligne de poteaux et deux bancs contre la paroi.
`private_station.py` pose désormais cet environnement. Le mur est porte
une plinthe métallique, des panneaux séparés et une bande horizontale. Deux
dosserets en lattes accompagnent les bancs de 2,70 et 3,60 m : assise à
49,5 cm, dossiers et accoudoirs, pieds ancrés au sol. Les anciens blocs
et motifs triangulaires sont retirés. Le seuil nord possède deux piédroits
hors du passage X 48–52, un linteau à 3,05 m, une lampe sous celui-ci
et une petite inscription « PARVIS ». Un dallage distinct accompagne
l’approche à Y 426–430. La lumière de sortie est replacée sous le linteau.
La remontée et le parvis sont ensuite repris par `tower_approach.py`.

Les rendus Blender de cette zone masquent alternativement les deux
environnements, après l’export. Cela reproduit leur visibilité en jeu et
évite de rendre le garage superposé au quai privé. Les marqueurs de lampes
restent des sources de niveau communes, selon le pipeline existant.
La vue « Embarquement » commence désormais au pied des marches ; la vue
« Quai privé » regarde la longueur du quai, visible après le voyage.

## Remontée et seuil de la tour

Le candidat N5 transforme la rampe de Y 430 à 466,5 en quatre volées
et trois paliers, sans changer son emprise de 4 m ni le dénivelé de
17,25 m. `layout.ASCENT` fournit sept supports : 18 puis trois fois
17 marches de 25 cm, giron de 45 cm, et paliers de 1,80 / 1,80 / 1,85 m.
Chaque volée conserve un proxy incliné ; les marches sont visuelles.
Les plafonds suivent ces mêmes sept sections, à 4 m du sol. Les mains
courantes et leurs attaches suivent les pentes et les paliers. Les
lampes sont fixées aux parois.

Un sas couvert et vitré prolonge le débouché sur le parvis, avec un
encadrement de 3,20 m et une inscription « SORTIE » fixée au linteau.
Les anciennes limites opaques de 5 m autour du parvis sont retirées.
Des limites ajourées et leurs proxies de 1,50 m protègent ses côtés,
en laissant libres la sortie et le seuil du bâtiment. Un sol extérieur
visuel entoure le parvis ; il ne traverse pas le volume de l’escalier et
ne crée pas de nouvelle zone praticable.

L’axe X 50 reste dégagé jusqu’à la tour. Un dallage de huit mètres de
large, X 46–54 / Y 469–500,25, le distingue des côtés. Trois jardinières
à angles coupés, de 56 cm de haut, regroupent une végétation à facettes et touffes de feuilles
et des assises en lattes tournées vers cet axe. Elles occupent X 37–44
à Y 477–481 et 487–490, puis X 56–63 à Y 479–484 ; les assises
restent hors des huit mètres de passage. Les bordures hautes possèdent
un véritable vide autour de la terre ; leurs proxies restent simples.
Deux édicules ventilés remplacent les anciennes grilles plates, à
X 27,50 et 66,50 / Y 485. Les quatre mâts de lumière restent en place. Le socle de la tour distante reste conservé dans le quartier ; seul celui de
l’instance proche est remplacé par une façade vitrée et une entrée
sous marquise. Les consoles métalliques relient la marquise à la façade.
L’intérieur de la tour n’est pas construit : le niveau finit sur ce seuil.

La commande `use_n5_fin` se trouve sur la porte, à
X 50 / Y 500,14 / Z 1,28. Elle conserve son rôle : E achève le parcours
après l’arrivée du voyage. Les nouveaux meshes appartiennent à
`stage_voyage_arrivee`. La page d’auteur ajoute une vue de palier et
replace les vues Parvis et Hall sur l’axe de l’entrée.

Cette passe porte sur l’architecture et ses lampes. La vapeur et
le passage du ciel à l’aube restent à reprendre pour l’ambiance finale.

## Progression

Le contrôleur `MetroBlockout` appartient au `LevelHandle`, avec une libération
enregistrée avant la collecte des ressources GPU. Le pas fixe appelle
`fixed` et les commandes des `use_*`. Le rendu appelle seulement
l'interpolation de la présentation du voyage. Aucun temps mural ni appel
asynchrone n'est introduit dans ces arbres.

| Commande | Effet |
|---|---|
| `use_n5_raccourci` | Ouvre définitivement la grille A depuis le retour des galeries |
| `use_n5_aiguillage` | Valide l'objectif ouest et active le trafic VB au retour |
| `use_n5_courant` | Valide l'objectif est dans la machinerie |
| `use_n5_depart` | Lance le voyage seulement avec les deux objectifs et le joueur à bord |
| `use_n5_fin` | Termine la session au hall, après l'arrivée de la rame |

La grille A se lève également à l'annonce d'une rame, puis se referme :
les trains ne traversent pas une grille visuellement fermée. Cette ouverture
offre un raccourci risqué avant la commande des galeries ; son intérêt et
son rythme restent à juger au blockout. La grille reste libre après usage
de la commande de retour.

Les trois phases départ/voyage/arrivée utilisent des groupes glTF exclus
de la fusion statique. Leurs colliders restent fixes. Le quai privé est
séparé du dépôt par une paroi ; la porte latérale de la rame reste verrouillée
jusqu'à l'arrivée. Les portes d'entrée et de sortie se ferment au départ.
Le voyage conserve le trucage T4 : rame fixe, tunnel défilant, 60 secondes.
La première passe N7 ajoute deux vagues de Rampants à 10 et 30 secondes,
puis des Costards sur le quai privé à l'arrivée. Le hot reload conserve les
objectifs, la phase et les vagues déjà lancées.

## Trains

Trois voies déclarées : A face au joueur dans le tunnel, B en sens inverse
sur les quais, VB activée après l'aiguillage. M reste réservée au scénario
N7 du dépôt. Les marqueurs du GLB
portent points, signaux, refuges, traversées et zones exclues de navigation.
Les courbes de A et B suivent le plan, avec dix niches conservées après
la révision du 8 octobre.

Les extensions de route cachées servent au préavis. `visibleStart` et
`visibleEnd` bornent les meshes, corps et contacts ; la marge N5 s'étend
seulement dans les arrière-tunnels construits (voir ci-dessous). Les
extensions lointaines ne traversent pas physiquement les autres espaces. Les salles T1 sans bornes de
visibilité gardent leur comportement.

La préparation de lisibilité désactive provisoirement le collider de la
grille A, car elle s'ouvre à l'annonce du train. Les autres obstacles restent
dans les raycasts. Elle vérifie les signaux et distances aux refuges avant
le jeu. Les commandes d'arrêt des niches réutilisent le système T2.

## Revue et limites

La compilation de production est exécutée ; aucune suite de tests
automatisés n'est ajoutée ni lancée. La recette rend des vues Blender,
puis la page d'auteur permet les captures et les interactions dans le moteur.
Les observations effectives et leurs limites sont dans le
[journal N5](../journal/metro-blockout-2026-10.md).

La page affiche l'état des deux objectifs et de la rame. Ses points de vue
utilisent la téléportation de développement ; ses boutons E, marche et saut
injectent les entrées ordinaires. Ils facilitent la revue des raccords,
sans remplacer une partie complète à pied pour juger la longueur.

## Reproduire

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  -P tools/blender/cassandre_cli.py -- metro_blockout
```

La recette écrit la source dédiée, le GLB et le manifeste des espaces.
Elle ne réexporte pas les pilotes ni le magasin. Les ambiances du quartier
sont provisoirement conservées ; les signatures des espaces et l'habillage
sonore complet restent à reprendre avec N6.

## Signaux et cadence

Révision du 7 octobre après le retour sur les apparitions, panneaux et
saccades, complétée le 8 octobre pour la profondeur et la circulation.
[Références photographiques](../assets/tunnels-references.md).

Les tubes A/B et les quais reprennent une voûte, des rails continus,
traverses, goulotte latérale et bouches de tunnel. Les matériaux N3 remplacent
les surfaces uniformes du blockout dans ces espaces. Les niches restent
ouvertes. Les planches numérotées au centre des salles sont retirées.

Les marqueurs `signal_train_*` peuvent déclarer `aspect: "feu"` ; l'absence
conserve les écrans T2. Les quinze feux N5 sont espacés de 30 m le long du parcours,
y compris dans les courbes, et dessinés dans deux `InstancedMesh`. Seuls
deux afficheurs publics utilisent encore une texture de texte. Les couleurs
sont changées au franchissement d'un état ; les 70 anciens écrans n'exigent
plus chacun leur dessin de canvas à 10 Hz. Le contrôle de lisibilité utilise
les positions réelles de ces feux.

`marge_visuelle` étend la section de présentation **et de contact** de
64 m aux deux extrémités. Chaque prolongement de parcours mesure 160 m ;
les marqueurs de la section principale gardent leur chaînage et leur cadence.
Les 72 premiers mètres derrière chaque bouche ont un sol, des parois, une
voûte et un fond fermé. La coque commune sud atteint 6,50 m au sommet ;
les autres coques atteignent 4,50 m. Les joues maçonnées raccordent la
coque commune aux deux arches du front de station. Une voiture de 15 m tient dans cette coque à sa
bascule de visibilité : 64 + 7,5 = 71,5 m depuis la bouche.

La voie A côté dépôt et la sortie VB possèdent deux coudes de rayon 12 m.
L’origine VB possède un coude de rayon 12 m ; la sortie B au nord de la
station utilise un rayon de 20 m. Au sud des quais, A et B partagent une
seule coque, avec des rails concentriques de rayon 12 et 16 m. La droite
initiale avance de 24 m jusqu’à Y 94 ; le coude est situé sous le hall,
pour ne pas pénétrer dans l’escalier. La coque mesure 7,50 m de large le
long de la cage, puis s’élargit après Y 105. Les caisses
naissent et disparaissent derrière les parois de ces coudes, sans modifier
le système de présentation du jeu. Les rails des prolongements restent
horizontaux lorsque le tube principal est en pente. Le réseau extérieur
n’est pas construit au-delà de ces fonds.

La soustraction des supports retire seulement les recouvrements coplanaires.
Un tunnel placé sous la billetterie garde donc son propre sol. Les ouvertures
entre supports exigent aussi un chevauchement vertical des volumes : une
voie profonde ne perce pas le mur d’une pièce située au-dessus.

L'origine VB est déplacée dans un sas courbe au nord du poste : elle ne
traverse plus sa cabine ni son escalier. Le chemin piéton du poste est
conservé. Ses nouveaux supports sont recoupés avec les supports existants
avant construction ; les intersections vides sont écartées avant soustraction.
La réservation de toit S3 est différée à son placement réel N7, car son ancien
proxy coupait l'arrivée VB dans le dépôt. La voie de manœuvre M du plan reste
réservée au script de rencontre N7 ; elle n'est pas déclarée dans cet export.
Son croisement avec les garages devra être raccordé lors de ce placement.

Les rames de niveau sont préparées au chargement, deux passages par voie,
puis réutilisées. La chauffe dessine ces meshes réels en désactivant aussi
le culling interne des lots, puis rétablit leur état. À la réactivation d'un
corps, sa pose est fixée avant de l'activer, pour éviter une vitesse
cinématique provenant de l'ancienne position cachée. Les poses et contacts
partagent une direction obtenue entre deux bogies espacés de 8 m : la caisse
ne saute plus instantanément de 7,5° à un sommet du tracé.

Le bouton « Observer une apparition » suspend le trafic automatique et
demande une seule rame sur la voie choisie. Il conserve sept vues avant
et après l’activation de sa première voiture. « Relancer le trafic »
rétablit les voies précédemment actives. Les poses sud des quais et VB
sont situées hors du gabarit du train.

Le panneau d'auteur mesure les intervalles entre images, et propose une
courte marche avec le trafic suspendu. Ces mesures ne sont pas des suites
de tests. Son relevé lit `cassandre.pose(false)`, sans publier un fichier de
pose à chaque seconde. La console `cassandre.pose()` garde sa publication
manuelle pour Blender. Le [journal](../journal/metro-blockout-2026-10.md)
distingue les résultats observés et la sensation à confirmer en playtest.
