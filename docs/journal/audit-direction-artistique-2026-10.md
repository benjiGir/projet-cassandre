---
title: Audit de direction artistique
tags: [journal, audit, direction-artistique, rendu]
status: brouillon
updated: 2026-10-11
---

# Audit de direction artistique

## Période

10 octobre 2026. État du dépôt à `3b40bff`, avec les modifications locales
présentes, dont les nouvelles boîtes de cartouches du métro.

## Objectif

Identifier ce qui empêche le magasin, le métro, les personnages et
l'habillage du direct de former une direction artistique cohérente.
Cet audit livre un diagnostic et une proposition de travail. Les arbitrages
artistiques ci-dessous sont suivis par étapes. Le traitement de l'étalon
est approuvé le 10 octobre ; les autres familles attendent leur passe.

**Constat principal : l'identité existe, mais la finition des matières et
le niveau de détail varient trop entre les familles d'assets.** Le rendu
pixelisé rassemble les silhouettes ; il laisse visibles les différences
entre surfaces riches, aplats géométriques et illustrations détaillées.

**Direction recommandée : un rétro urbain texturé, semi-réaliste et
satirique**, avec des silhouettes franches, des matières mates et une
interface de diffusion identifiable. Les illustrations et le portrait
peuvent garder leur dessin expressif, à condition de partager avec le monde
les couleurs, les vêtements et les lieux reconnaissables.

## Livré et preuve

### Ce qui a été regardé

- Captures nouvelles du magasin : parking, entrée, caisses, pistolet,
  fusil à pompe et mains ; 10 octobre.
- Captures du parcours jouable du métro : rue, fontaine, quai, galerie,
  dépôt, station privée et parvis ; 9 octobre. Le vestiaire avec la boîte
  de cartouches vient de la capture du 10 octobre.
- Les quatre atlas ennemis actuels, une cellule par personnage ; les
  textures actuelles des armes au sol et de la carte Argent.
- Le portrait actuel, le HUD en aperçu et le menu principal ; 10 octobre.
- Les seize illustrations de campagne actuellement servies.
- Les textures sources, la planche du kit de quartier et celle des
  véhicules supplémentaires. Ces planches Blender renseignent les modèles,
  pas leur éclairage dans le jeu.
- Les sources de filtrage, de matériaux, de ramassages, de l'interface,
  de la fontaine, de l'apparition des ennemis et de l'éclair de tir.

Les images complètes et l'inventaire sont accessibles depuis cette page.


Les captures du magasin comportent le panneau technique de développement :
il est exclu des jugements de DA. L'aperçu du HUD affiche volontairement
plusieurs notifications simultanées ; il ne mesure pas leur fréquence en jeu.
Les effets de tir et d'apparition sont examinés dans leurs sources,
sans nouvelle capture animée. La fontaine est aussi examinée en image.
L'audit ne constitue pas une revue de chaque objet, de chaque UV ou de
toutes les frames d'animation.

### Ce qui fonctionne déjà

| Famille | À conserver | Pourquoi |
|---|---|---|
| Quais publics | Ivoire, frise pétrole, bancs sombres et ouvertures noires | Les matières, les couleurs et les silhouettes expliquent le lieu. C'est le meilleur ancrage actuel pour le métro. |
| Magasin | Accents rouges, produits colorés, signalétique et éclairage commercial | Une personnalité propre, liée au propos satirique. |
| Quartier | Façades mates, encadrements, points de lumière chauds | Un vocabulaire commun avec le métro ; les usages des objets restent reconnaissables. |
| Véhicules | Silhouettes distinctes, vrais vitrages, variantes de carrosserie | La famille est déjà cohérente. Le métro réemploie les citadine et berline validées dans `tools/metro/quartier/vehicles.py`. |
| Ennemis | Silhouette du Costard, bouclier du Vigile, corps vert du Rampant | Des rôles visuels distincts, avec un système commun de sprites. Les variantes de peau restent compatibles avec ce système. |
| Portrait et histoire | Visage expressif, veste kaki, dessin et pixels visibles | Une identité forte pour le héros. Le portrait validé par l'utilisateur reste un ancrage. |
| Interface | Vert phosphore, ambre, rouge d'alerte, cadres et REC | Le direct possède déjà son langage. La police commune et les jetons centralisés donnent une base cohérente. |
| Objets interactifs | Cartes, façades de distributeurs et commandes du magasin | Motifs et pictogrammes lisibles, plus aboutis que les surfaces les plus simples. |
| Effets TSL | Quatre couleurs de l'éclair de tir, cellules d'apparition, jets de fontaine | La technique permet déjà des effets stylisés adaptés au rendu pixelisé. |

### Relevé factuel des ressources

L'inventaire lit les GLB exportés, sans modification des assets.

| Mesure | Magasin | Métro |
|---|---:|---:|
| Images embarquées | 49 | 9 |
| Dimensions | 48 en 128×128, 1 en 512×512 | 9 en 128×128 |
| Matériaux déclarés | 56 | 43 |
| Avec texture de couleur de base | 47 | 12 |
| Sans texture de couleur de base | 9 | 31 |

Ces comptes portent sur les ressources du fichier, pas sur leur surface
visible ou leur nombre de dessins. Certains matériaux sans texture servent
correctement au verre, aux lampes ou aux couleurs de sommet. Les éléments
créés au runtime ne sont pas inclus. **Le nombre de textures n'est pas un
objectif de qualité.** Il accompagne ici une différence visible de traitement.

Autres repères confirmés :

- Le monde démarre en 640×360, sans antialiasing, avec agrandissement nearest
  dans `src/render/pipeline/renderer.ts`. La réduction utilise actuellement
  mipmaps et anisotropie.
- Les cellules ennemies font 240×192. Les manifestes indiquent 96 px/m
  pour Costard et Rampant, 88 pour Vigile et 84 pour Directeur. Ces valeurs
  participent à leur échelle ; leur différence n'est pas une anomalie en soi.
- Les icônes d'armes au sol font 56×56, 30×30 et 94×94, pour des quads de
  0,8 m, 0,8 m et 1,1 m. Le pistolet dispose donc de moins de définition
  source à taille comparable. Les zones transparentes empêchent d'assimiler
  directement ces nombres à la densité de la silhouette.
- Les cartes font 128×80 et les illustrations 640×360. Les faces des
  trousses et boîtes de munitions sont dessinées sur des canevas de 32×32.

Inventaire détaillé.

### Écarts et recommandations

P0 prépare les décisions communes. P1 traite les écarts les plus visibles.
P2 finit et stabilise les familles déjà reconnaissables. Les efforts sont
relatifs : petit, moyen, important ; ils ne sont pas des estimations horaires.

| ID | Priorité | Constat et preuve | Recommandation | Effort |
|---|---|---|---|---|
| DA-01 | P0 | Les boards du métro et des armes définissent des directions locales. La palette du magasin, les palettes originales du métro et les couleurs de l'interface suivent des recettes distinctes. Une image commune couvrant toutes ces familles manque aux références consultées. | Fixer une scène étalon et une courte charte transversale : valeurs, matières, grain, typographie, couleurs fonctionnelles et exceptions. | Petit |
| DA-02 | P1 | Dans la galerie, les murs et le plafond paraissent presque unis. Le quai conserve des joints lisibles ; le béton du métro a un grain beaucoup plus faible que celui du magasin. Voir les vues 03/04 et la planche des surfaces. | Enrichir les surfaces proches avec joints, assemblages, traces d'usage localisées et variations larges. Relier les matières par leur traitement, en conservant leurs différences d'usage. | Moyen |
| DA-03 | P1 | Le terrazzo des caisses occupe une grande partie du cadre avec beaucoup de fragments contrastés, alors que comptoirs et armes ont de grands aplats. Le sol concurrence les objets utiles. Vue 02 actuelle. | Réduire le contraste et la fréquence des petits éclats du sol ; donner aux objets proches quelques détails de matière ciblés. La hiérarchie visuelle doit favoriser ennemis et interactions. | Moyen |
| DA-04 | P1 | Le pistolet et le pompe ont de bonnes silhouettes mais des surfaces très uniformes. La peau et les manches restent très facettées au premier plan. Le portrait et les mains illustrées ont beaucoup plus de nuances. Captures parking/pompe et panneau `intro_2`. | Garder les poses et proportions acquises ; travailler métal, bois, peau et tissu par petites zones de valeurs, arêtes choisies et motifs sobres. Faire une comparaison dans les caisses et sur le quai avant extension. | Moyen |
| DA-05 | P1 | Les illustrations montrent des sols humides, des lumières réfléchies et des extérieurs plus riches. Le parvis illustré a une dominante bleue, tandis que la capture jouable garde un ciel étoilé et un horizon orange. La charte du métro annonce un retour au jour. | Choisir une heure et un état de sol communs pour chaque transition. Reprendre les signes reconnaissables de l'entrée, de la grille et de la tour dans les panneaux et le jeu. Des taches peintes et variations de valeur peuvent suggérer l'humidité. | Moyen |
| DA-06 | P1 | La capture des caisses montre trois grands « SORTIE » sur le même bandeau, au-dessus de « CAISSES » et de ses numéros. Dans les lieux sobres, les enseignes lumineuses prennent aussi une forte place dans le cadre. | Définir trois niveaux : destination, identification locale, information secondaire. Réserver taille, contraste et éclairage à leur rôle ; réduire les répétitions qui ne donnent aucune information nouvelle. | Petit à moyen |
| DA-07 | P2 | Véhicules et plusieurs meubles partagent de grandes plages de couleur plates. C'est une famille cohérente en elle-même, mais sa finition est moins riche que les sols et certains distributeurs. Planches de véhicules et parking actuel. | Ajouter quelques lignes d'assemblage, joints, ombres peintes et traces d'usage aux surfaces que le joueur approche. Conserver les silhouettes et variantes approuvées. | Moyen |
| DA-08 | P2 | Les sprites ennemis pré-rendus ont un modelé simple et peu de détails peints, comparés au visage du héros. Leur lisibilité dépend aussi d'un éclairage pré-rendu et d'un plancher lumineux de 0,32. | Unifier le traitement des vêtements, visages et contours à leur taille réelle dans le jeu. Comparer les quatre ennemis dans une zone claire puis sombre ; préserver la lisibilité du bouclier et la distinction des corps. | Important si les atlas sont tous repris |
| DA-09 | P2 | Les ramassages combinent armes et cartes en billboards, boîtes et nourriture en 3D. Leurs niveaux d'émissive sont réglés séparément : munitions 0,2, soin 0,35, armes 0,55–1,3, cartes environ 0,65–0,85. Le style des faces va du pictogramme très simple au dessin de carte détaillé. | Définir une famille de pictogrammes, contours, couleurs et visibilité à distance. Conserver les formats de ramassage validés ; ajuster leur finition et leur importance visuelle selon leur fonction. | Moyen |
| DA-10 | P2 | Le HUD se dimensionne en pixels virtuels du 640×360 ; plusieurs éléments des menus utilisent des tailles fixes. Les halos CSS et le texte du navigateur ont un grain différent du monde. Menu et aperçu actuels, `tokens.css`, CSS des boutons. | Garder le langage du stream et sa lisibilité. Harmoniser proportions, épaisseur des cadres et intensité des halos ; prévoir une règle commune d'échelle pour les écrans modaux. | Moyen |
| DA-11 | P2 | Le flash de tir utilise quatre tons francs ; l'apparition utilise des cellules et du cyan ; l'eau mélange des variations continues et des accents clairs. La fontaine attire fortement le regard. Les sources ont des palettes indépendantes. | Établir une palette et une hiérarchie des effets : feu chaud, matérialisation cyan, eau pétrole claire. Observer ensemble leurs silhouettes et animations dans le décor de référence avant tout réglage. | Moyen ; revue animée nécessaire |


### Pourquoi le traitement diverge

Le magasin réduit des sources CC0 et les quantifie sur une palette commune
de 64 couleurs (`tools/textures/build_palette.py`, `make_textures.py`).
Le métro construit des textures originales avec des variations de grain
très faibles (`tools/metro/kit/materials.py`). Le quartier utilise une autre
recette (`tools/metro/quartier/materials.py`). Les armes visibles utilisent
des couleurs de sommet et le loader ne conserve aucune texture de leur GLB
(`src/render/viewmodel/weaponModels.ts`). Les ennemis sont pré-rendus,
les illustrations sont des images dessinées et le HUD est composé en CSS.

Ces méthodes peuvent coexister. Aujourd'hui elles n'ont pas une référence
commune suffisante pour leur niveau de finition. Un changement de shader
global ne corrigerait pas, à lui seul, ces différences de production.

La [charte du métro](../6-reference/references-metro.md) offre déjà une progression
chromatique cohérente. La reprise doit conserver le quai ivoire/pétrole,
le service gris-vert/ambre et la station privée froide.

## Rejeté et raison

### Consignes anciennes à réconcilier

Les skills `build-engine-look` et `retro-texture-density` demandent encore
de supprimer mipmaps et anisotropie. Le premier décrit aussi une liste de
rejet qui ne reflète plus toutes les décisions actuelles. Les instructions
du projet retirent l'exclusivité Lambert depuis le 28 septembre et le code
accepte les effets TSL ciblés.

La [documentation du rendu](../4-technique/rendu.md) signale déjà l'arbitrage
entre la base 640×360 et les résolutions proposées dans les options.
L'[ADR 0027](../decisions/0027-filtrage-des-textures-reduites.md) conserve
la décision de filtrage comme proposition. L'audit retient le rendu courant
pour ses observations ; il n'arbitre pas ces décisions à la place du joueur.

**Action documentaire préalable** : aligner les skills et les références
sur les décisions effectivement adoptées, puis y relier la charte validée.
Cette remise en cohérence est une recommandation ; elle n'est pas effectuée
dans ce lot d'audit.

### Transformations non retenues dans la proposition

| Transformation | Raison |
|---|---|
| Recoloration globale identique pour toutes les zones | Efface la progression entre magasin, service et station privée. |
| Réduction uniforme de toutes les images | Supprime des informations utiles ; leur résolution n'explique pas seule les écarts de grain et de matière. |
| Hausse de résolution comme correction de DA | Ne crée ni les détails de matière ni les correspondances entre les familles d'assets. |
| Ajout d'un tramage global avant la reprise des textures | Le ciel et certaines images portent déjà des motifs ; leur superposition doit d'abord être évaluée. |
| Refonte de tout le niveau et des modèles approuvés | Le principal écart observé concerne leur traitement visuel. Le parcours et les silhouettes peuvent servir de base. |

## Leçons

### Charte proposée pour l'harmonisation

1. **Monde** : silhouettes franches, surfaces mates, détail peint lisible.
   Chaque matière proche doit montrer au moins une caractéristique d'usage
   ou d'assemblage pertinente. Les surfaces calmes restent nécessaires.
2. **Densité** : reprendre le repère existant de 64 texels/m pour les
   matières répétées, puis relever les UV réels. Documenter les exceptions
   pour sprites, signalétique, petits objets et premier plan. La taille
   d'un fichier ne constitue pas une mesure de densité sur un objet.
3. **Valeurs** : sujet utile lisible devant son fond ; décoration et grain
   secondaire plus calmes. Régler ensemble texture et lumière locale.
4. **Palette** : base de gris colorés, ivoire, pétrole, kaki et brun ;
   sous-palettes par zone. Réserver les accents forts aux produits,
   signalétique, interactions et effets pertinents.
5. **Couleurs fonctionnelles** : vert pour soin/autorisation, ambre pour
   attention/action, rouge pour alerte/feu, cyan pour le phénomène de
   matérialisation. Les cartouches rouges gardent leur silhouette et leur
   pictogramme distinctifs ; une information ne dépend pas de sa seule couleur.
6. **Personnages** : proportions expressives, ombres et vêtements traités
   avec un vocabulaire commun. Le portrait peut garder davantage de détail,
   car il est un retour de caméra affiché dans l'interface.
7. **Signalétique** : pictogrammes communs, lettres construites sur une grille,
   une destination principale par ensemble. Le HUD garde sa police commune
   et une hiérarchie adaptée à la lecture pendant le combat.
8. **Lumière et effets** : conserver les ambiances validées, travailler les
   zones de contact et la lisibilité locale. Les effets TSL partagent les
   valeurs et couleurs de la charte, avec une luminosité liée à leur rôle.
9. **Illustrations** : mettre en correspondance heure, météo, vêtements,
   façade, accès du métro et tour avec les plans réellement jouables.

### Ordre de travail recommandé

| Étape | Livrable concret | Critère de passage |
|---|---|---|
| 1 — Scène étalon | Un morceau de quai avec mur, sol, banc, commande, ennemi, soin, munitions et pistolet/mains ; cadrage reproductible. Charte courte associée. | Le joueur valide le traitement commun en image à 640×360 et dans le jeu. |
| 2 — Matières du métro | Reprise d'une galerie et d'une pièce de service à partir de l'étalon, puis déploiement par famille. | Les lieux gardent leur ambiance ; les détails utiles restent visibles en mouvement. |
| 3 — Magasin et objets proches | Terrazzo, comptoirs, meubles et finition des véhicules ; comparaison avec le quai. | La matière du sol laisse lire les ennemis et objets utiles. |
| 4 — Armes et personnages | Métal, bois, peau, tissu, puis traitement des sprites. | Poses approuvées conservées ; personnages reconnaissables en zones claires et sombres. |
| 5 — Interactions et signaux | Cartes, nourriture, trousses, boîtes, commandes et signalétique. | Fonction identifiable à 3/6/12 m quand elle est pertinente ; aucun besoin de multiplier les grands textes. |
| 6 — Histoire, interface et effets | Correspondances des extérieurs, échelle des menus, halos et palettes des effets. | Passage panneau/jeu et retour de stream cohérents ; effets observés en animation. |

**Première intervention recommandée : l'étape 1, puis DA-02 et DA-03.**
Le quai possède déjà une identité solide et permet de faire se rencontrer
les familles d'assets dans un cadre restreint. Une fois cet étalon validé,
le reste du travail suit une référence concrète.

Les comparaisons futures doivent utiliser le même cadrage, la même
résolution et la même lumière, avec une vue d'ensemble et une vue proche.
Les détails de UV, les angles supplémentaires des sprites et les effets
animés nécessitent encore une passe dédiée. Aucun test automatisé ni
modification des assets de jeu n'est réalisé pour cet audit.

### Première application — 10 octobre

À la demande « Commence le plan », l'étape 1 produit
[l'étalon du quai](../5-guides/direction-artistique.md) et la
[charte commune](../5-guides/direction-artistique.md).
Les deux traitements sont comparables dans une scène de développement.
L'utilisateur approuve le traitement le 10 octobre : « Je valide c'est très
beau tu peux continuer ». La reprise de campagne commence par les galeries
et le vestiaire des agents ; le reste du métro attend les passes suivantes.

### Déploiement local — galeries et vestiaire

L'étape 2 commence par [les galeries de maintenance et le vestiaire](../5-guides/direction-artistique.md).
Les recettes de béton, sol, acier, peinture et bois de l'étalon sont
appliquées aux objets de ces espaces. Une peinture ivoire complète les
équipements sans leur donner les joints du carrelage. Les ambiances et
le parcours restent ceux du niveau existant. La recette rejoint le
générateur du métro pour conserver la finition lors des reconstructions.
Cette passe locale ne clôture pas l'harmonisation de toutes les matières
du métro ; le quai, les tunnels et les autres locaux sont les prochains lots.

### Extension — quais et tunnels

À la demande de continuer, la passe suivante concerne
[les quais et tunnels A/B](../5-guides/direction-artistique.md).
Le carrelage, les dalles piétonnes, le mobilier et le béton rejoignent le
traitement approuvé. Le sol sous les rails reçoit une recette industrielle
distincte ; les bandes de sécurité et fonds des plans restent peints.
Les galeries et la station partagent désormais les mêmes instances de
matériaux, construites une fois par reconstruction.

### Extension — billetterie et descente

La demande suivante de continuer reprend
[la billetterie et la descente publique](../5-guides/direction-artistique.md).
Le hall, l'arrière-guichet, les bornes, les portiques et l'escalier utilisent
le carrelage, les dalles, la peinture, l'acier et le bois de la charte.
Les plafonds du hall et les marquages sont séparés du carrelage pour
conserver une finition calme et la lecture des repères.

### Extension — dépôt et ateliers

La passe suivante concerne [le dépôt et ses ateliers](../5-guides/direction-artistique.md).
Le sol industriel, le béton, la charpente, les marquages et les établis
reprennent les familles de l’étalon. Les équipements bleus, les roues, le
métal usiné et les pièces de cuivre gardent des rampes distinctes. La
marquise et les marches du quai de service prolongent le traitement.

### Extension — machinerie et aiguillage

La passe suivante concerne [la machinerie et le poste d’aiguillage](../5-guides/direction-artistique.md).
Le béton industriel, les rampes, la fosse, les armoires et le local
d’entretien reprennent les matières de la charte. Les pales du ventilateur
utilisent le métal usiné du dépôt. Le poste garde une peinture ivoire
autour de ses commandes et un sol de dalles sombres.

Le premier essai de peinture murale reprend les joints et petits éclats
des façades d’armoires. Les captures du poste montrent un motif trop
répétitif sur les grandes surfaces. Une recette murale dédiée garde la
rampe ivoire. Son second essai de taches larges produit des formes rondes
trop visibles dans le jeu. La version retenue utilise un grain fin et
discret ; les grandes surfaces restent calmes derrière les commandes.

### Extension — station privée et parvis, 11 octobre

La passe suivante concerne [la station privée, la remontée et le parvis](../5-guides/direction-artistique.md).
Les parements de pierre et les dalles utilisent une sous-palette froide
commune. Le bois des assises reprend la charte ; la végétation reçoit une
matière propre. Les nez de marche, garde-corps, marquise et socle de la tour
prolongent le traitement jusqu’à l’entrée. Le ciel actuel est conservé ;
son raccord aux illustrations reste dans le lot histoire et effets (DA-05).

La première comparaison de la station et du parvis montre des variations
trop contrastées entre les dalles et les panneaux de pierre. Les rampes
de ces deux matières rapprochent leurs tons intermédiaires, tout en
conservant les joints et les arêtes.

### Extension — rames du métro, 11 octobre

La passe suivante concerne [la rame de service, le garage et les voitures
de trafic](../5-guides/direction-artistique.md). Les coussins quittent
la famille des peintures d’équipements pour une trame de tissu vert.
Le sol intérieur et les câbles emploient du caoutchouc sombre ; la
carrosserie garde une peinture claire avec un grain discret. Les rames
de passage reprennent ces familles communes et les suspentes des signaux
reçoivent l’acier. La géométrie validée et les commandes restent en place.

Les passes de matières du métro sont déployées par zone. La suite du lot
de matières porte sur le magasin, le quartier extérieur et les objets
proches. La signalétique, les interactions et le raccord du ciel gardent
leurs lots dédiés.

### Étape 3 — entrée et caisses du magasin, 11 octobre

La première passe concerne [la galerie d’entrée et les six caisses](../5-guides/direction-artistique.md).
Le terrazzo réduit le contraste de ses fragments ; le carrelage commercial
garde des joints lisibles. Le stratifié, le métal brossé, le plastique
et le caoutchouc donnent des matières distinctes aux comptoirs. Les deux
passages d’entrée reprennent aussi le terrazzo pour assurer la continuité.

Le premier essai réduit les
fragments à un grain très fin. Le sol devient trop uniforme et perd sa
lecture de terrazzo. La version retenue utilise des fragments plus nets,
espacés et peu contrastés. Les vues du magasin sont comparées à l’étalon
du quai et observées dans le niveau réel.

La suite concerne la surface de vente et le mobilier commercial, avant
les autres locaux et la finition des véhicules. DA-06, dont les grands
« SORTIE » répétés au-dessus des caisses, conserve son lot de signalétique.

### Ajustement demandé — lumières du magasin, 11 octobre

L’utilisateur préfère l’éclairage du métro et demande de reprendre celui du
magasin. [La proposition](../5-guides/direction-artistique.md) remplace les néons
blancs froids par de l’ivoire, rapproche les portées et garde les accents des
équipements. La première passe reste trop uniforme et brûle encore les halos
au plafond ; la seconde abaisse l’ambiante propre au niveau et descend les
sources ponctuelles sous les tubes. Sept comparaisons avant/après et une
vue dégagée de cafétéria sont regardées dans le jeu. La pose initiale de cette
pièce est rejetée car elle se trouve sous le comptoir. La suite des matières
reste la surface de vente et le mobilier commercial.

Une source abaissée arrive trop près du panneau central des caisses : elle
crée un point brûlé sur sa face. La recette conserve la hauteur initiale des
sources proches des panneaux, et les captures finales sont reprises.

### Retour utilisateur — éclairage restauré, 11 octobre

La proposition d’éclairage est rejetée : le magasin est trop sombre. Les
245 sources et les matières des 137 luminaires sont restituées depuis la copie
avant éclairage. L’ambiante revient à 0,18. Les hooks de la proposition et son
raccord runtime sont retirés. La suite reprend les textures de la surface de
vente et du mobilier commercial.

### Étape 3 — surface de vente et mobilier, 11 octobre

La [passe de textures](../5-guides/direction-artistique.md) concerne
12 sols et 277 éléments de mobilier dans l’allée centrale, les rayons et
l’électroménager. Dix familles rapprochent le terrazzo, le carrelage, le
damier, les métaux, les peintures, le bois et le carton de la charte commune.
Les atlas des produits restent en place. Les six comparaisons en jeu utilisent
l’éclairage restauré ; une vue après déplacement et une planche Blender
complètent la revue. La suite concerne les autres locaux du magasin.

### Étape 3 — cafétéria, 11 octobre

La [passe de cafétéria](../5-guides/direction-artistique.md) traite
65 meshes : sol, parois, plafond et mobilier. Le damier rejoint celui des
rayons ; les tables et le self reçoivent le stratifié ivoire des caisses.
La première version du plafond présente des variations trop marquées :
la seconde rapproche et éclaircit les teintes. Quatre comparaisons en jeu,
une vue après déplacement et une planche Blender sont regardées.
Les lampes et les atlas des distributeurs restent en place. La prochaine
passe locale concerne les sanitaires attenants.

### Étape 3 — sanitaires, 11 octobre

La [passe des sanitaires](../5-guides/direction-artistique.md)
traite 15 meshes : murs carrelés, plafond, cloisons et pièces métalliques.
La faïence ivoire réduit son grain ; les cabines reprennent le vert pétrole
commun. Le sol partage déjà le damier de la cafétéria. Les appareils utilisables
conservent leurs nuances, leurs extras et leur matériau unique. Quatre
comparaisons en jeu, une vue après déplacement et une planche Blender sont
regardées. La prochaine passe concerne la réserve.

### Retour utilisateur — équipements des sanitaires, 11 octobre

Avant la réserve, l’utilisateur demande des cabines dans lesquelles entrer,
de plus grands lavabos et de vrais miroirs. La [refonte locale](../4-technique/equipements-sanitaires.md)
remplace les équipements par des formes originales : trois cabines avec des
portes manuelles, vasques creusées, appareils arrondis et accessoires.
Les premières cuvettes ont un réservoir trop haut ; la dernière révision
raccourcit celui-ci, distingue le siège et ajoute une vasque aux urinoirs.
Les reflets plans sont préparés pendant le chargement, après l’observation
d’un gel à leur première apparition dans la revue.

L’entrée dans les trois cabines, la fermeture et la réouverture d’une porte,
les vues des équipements et le changement de perspective du reflet sont
observés dans le jeu. Quatre révisions de génération/rendu affinent les
formes, les teintes et les accessoires. L’éclairage du magasin reste celui
restauré après le retour précédent. La réserve attend le retour utilisateur
sur ces équipements.

### Étape 3 — réserve et quai de livraison, 11 octobre

L’utilisateur reprend le retexturing après la refonte des sanitaires.
La [passe de réserve](../5-guides/direction-artistique.md) concerne
77 meshes : béton du sol et du quai, enduit, plafond, racks, palettes,
cartons et outillage. Les éclats rouges très contrastés sont supprimés ;
les fûts passent du motif de danger intégral à une peinture kaki cerclée.
Les premiers sols sont trop sombres, puis leurs grandes taches répétées
sont rejetées. La troisième version conserve un béton plus clair à grain
sobre. L’éclairage reste celui restauré du magasin.

La modification parallèle des armes interrompt temporairement la revue
et produit un modèle de repli. Un rechargement complet après la mise à jour
des assets permet de reprendre la comparaison. Quatre vues en jeu,
une vue après déplacement et une planche Blender sont ouvertes et relues.
La recette rejoint le build normal ; la reconstruction complète reste hors
de cette retouche locale. La suite concerne les locaux du personnel.


### Retour utilisateur — réserve trop lisse, 11 octobre

La première proposition de réserve est refusée : les matières paraissent
absentes et l’ensemble triste. La reprise remplace les aplats par des
parpaings peints à joints décalés, du béton jointé avec traces de manutention,
un plafond de coffrage, des racks rouges plus francs, des palettes veinées
et des cartons avec ruban et étiquettes. Les UV des cartons sont centrées
sur chaque boîte assemblée, à densité constante. Les motifs de bois, carton
et peinture sont désormais locaux à la réserve pour ne pas modifier les
rayons déjà revus. Le premier essai de cette reprise produit un semis trop
régulier au sol ; le second retire ce quadrillage de points.

Les vues de comparaison opposent la version refusée à la reprise. L’éclairage
du magasin conserve son réglage restauré. La reprise est approuvée par l’utilisateur : « C’est bien mieux ».


### Étape 3 — personnel et bureaux, 11 octobre

Après validation de la réserve, la [passe suivante](../5-guides/direction-artistique.md)
concerne 201 meshes : couloir du personnel, vestiaires et PC sécurité, escalier,
étage administratif et direction. Le béton rejoint celui de la réserve ;
le carrelage et la moquette gardent des identités propres. Bois veiné, métal
mat, peinture verte et papier remplacent les anciens motifs du mobilier.
Les atlas de casiers, portes, écrans et consoles conservent leurs détails.

Le premier essai montre une trame de moquette trop contrastée et un grain
répétitif sur l’enduit. Le second rapproche les valeurs du textile et affine
le grain des murs. Six comparaisons en jeu, une vue après déplacement et une
planche Blender accompagnent la proposition. L’éclairage du magasin reste
celui restauré. Le build normal rejoue cette passe après la réserve.


### Retour utilisateur — plafond du vestiaire, 11 octobre

Le plafond et le sol du vestiaire partagent le même motif de joints et de
grain, malgré deux rampes distinctes. L’utilisateur signale leur ressemblance.
Le plafond reçoit une recette propre : panneaux acoustiques ivoire de
1 × 0,5 m, rails fins et petites perforations. Le carrelage du sol reste
gris-vert avec des carreaux carrés de 0,5 m. La nouvelle vue remplace celle
de la revue ; la précédente reste dans `vestiaires-plafond-refuse.png`.


### Étape 3 — ateliers du magasin, 11 octobre

L’utilisateur approuve la correction du plafond des vestiaires, puis
demande la suite. La [passe des ateliers](../5-guides/direction-artistique.md)
traite le fournil, le labo boucherie et le SAV : grès rouge-brun, faïence
claire, panneaux de plafond, inox mat, polyéthylène marqué et bois des établis.
Les façades d’appareils, instruments et produits conservent leurs détails.
La première version rend les joints du labo trop contrastés ; la seconde
rapproche leur couleur de celle du grès. La source et l’export sont mis à
jour, et la recette rejoint le build normal. Six comparaisons en jeu, une
vue après déplacement et une planche Blender accompagnent cette proposition.

### Retouche des fours — 11 octobre

L’utilisateur demande de reprendre les fours après la passe des ateliers.
La [proposition](../4-technique/fours-fournil.md) remplace la longue armoire par
deux modules à soles vitrés et reprend la rôtissoire. La photo constructeur
Bongard guide les proportions et les ouvertures. Les pains, soles et broches
sont visibles en jeu ; hottes et conduits rejoignent le plafond.

Les anciens volumes sont retirés des meshes partagés sans retirer les tables
ou chariots. Trois proxies couvrent les nouveaux appareils. Deux exports
produisent la même liste de treize meshes visibles. Quatre vues du jeu et
les rendus Blender sont ouverts et relus ; l’éclairage reste celui accepté.
La proposition attend le retour utilisateur.

### Étape 3 — chambre froide et compacteur, 11 octobre

L’utilisateur approuve les fours et demande la suite. La
[passe des locaux de service](../5-guides/direction-artistique.md)
traite 51 meshes : sols, panneaux isolants et plafonds de la chambre froide,
rails, évaporateur, murs et béton du compacteur, peinture de la presse,
benne et petit mobilier. Les balles de carton gardent leurs atlas spécifiques.
Les faces des boutons conservent leurs couleurs dans les meshes mixtes.

Le premier rendu assombrit trop la chambre froide. Le second éclaircit la
rampe des panneaux et du plafond, et donne des ailettes à la surface de
l’évaporateur. Les lumières, colliders, carcasses et interactions sont conservés.
Six comparaisons en jeu et une planche Blender sont ouvertes et relues.
La recette rejoint le build normal après les ateliers.
La proposition attend le retour artistique de l’utilisateur.


### Étape 3 — planque et ventilation, 11 octobre

L’utilisateur approuve les locaux de service et demande la suite.
La [passe des annexes](../5-guides/direction-artistique.md) reprend
27 meshes : murs et plafond de la planque, canapé, table, caisses, frigo,
casier, télévision et radio, puis parois et plancher de la gaine VMC.
Les lumières, collisions, grilles cassables, affiches et objets de ramassage
conservent leurs valeurs et positions.

Le premier essai donne un quadrillage trop grossier au canapé. Le second
réduit le pas du tissage et adoucit le grain des tôles, en gardant les
raccords et les rivets lisibles. Quatre comparaisons en jeu et une planche
Blender accompagnent la proposition. La recette rejoint le build normal
après les locaux de service. La proposition attend le retour artistique
de l’utilisateur.


### Retour utilisateur — sols et plafonds des bureaux, 11 octobre

L’utilisateur demande de retrouver une moquette comme avant et d’avoir
un faux plafond dans les bureaux et la direction. La
[retouche des finitions](../5-guides/direction-artistique.md) reprend les deux
sols et les deux plafonds : textile bleu continu inspiré de la texture
initiale, panneaux acoustiques clairs et ossatures de 60 cm en relief.
Deux meshes regroupent les profils ; les intersections n’ont pas de
faces superposées. La recette rejoint la passe des bureaux du build normal.
La proposition attend le retour de l’utilisateur.

### Étape 3 — finition des décors restants, 11 octobre

L’utilisateur demande de finir le reste du retexturing. La
[passe finale des décors](../5-guides/direction-artistique.md) traite
721 meshes du magasin et 1 332 du métro : parkings, extérieurs, raccords,
petit mobilier, locaux secrets, quartier et boîtiers. Les 30 meshes de
véhicules gardent leurs couleurs ; un grain neutre complète les surfaces.

Le premier asphalte du parking est trop sombre dans le jeu. La deuxième
version remonte sa rampe et ajoute des lignes de coffrage au béton extérieur.
La cour est d’abord cadrée derrière un mur ; une pose dégagée de l’accès de
service la remplace. Les véhicules du métro possèdent `Col` sans le sélectionner
comme attribut actif : la recette rétablit cette sélection et conserve ses valeurs.

Quatorze vues avant/après, deux vues après déplacement et deux planches Blender
sont regardées. Les exports utilisés par le jeu contiennent respectivement
4 003 et 4 356 objets sans fuite de bibliothèque. Les deux builds normaux
rejouent les nouvelles recettes. Cette livraison termine le déploiement des
matières du décor ; les lots d’armes, personnages, interface et effets de
l’audit conservent leur périmètre séparé. La revue finale attend le retour
artistique de l’utilisateur.
