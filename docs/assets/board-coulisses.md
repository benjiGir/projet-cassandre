---
title: Board de références — coulisses
tags: [assets, references, niveau, level-design]
status: brouillon
updated: 2026-09-26
---

# Board de références — coulisses

Fiche de spec pour refaire les coulisses du niveau v2 (plan
[`plan-coulisses.md`](plan-coulisses.md)), écrite selon le skill
`reference-driven-authoring`. Retour de l'utilisateur sur la première passe,
mot pour mot : « on dirait des trucs posés au pif, pas de plaisir à
explorer ».

On construit contre CETTE fiche, pas contre le souvenir des sources. Aucune
image n'est téléchargée : tout est cité par URL (section 6). Deux sortes de
chiffres s'y mêlent, et chaque ligne dit laquelle :

- **relevé** : lu dans une source (fiche constructeur, texte réglementaire,
  guide de niveau) ;
- **cible** : une règle qu'on se donne pour ce niveau, déduite des sources,
  à vérifier en jouant.

## 1. Diagnostic de la première passe

Relevé sur `docs/assets/coulisses-plan.diff` (sept espaces, deux couloirs).

| Pièce | Accès | Lien avec une autre pièce | Vue sur ailleurs |
|---|---|---|---|
| Vestiaires | couloir du personnel + fournil | fournil (porte 1,5 m) | aucune |
| Fournil | couloir du personnel + vestiaires | vestiaires | aucune |
| PC sécurité | couloir du personnel **seul** | **scellé** avec le fournil | aucune (le mur d'écrans viendra plus tard) |
| Chambre froide et marée | couloir coupe-feu **seul** | **scellée** avec le SAV | aucune |
| Atelier SAV | couloir coupe-feu **seul** | **scellé** avec la chambre froide | aucune |
| Compacteur | couloir coupe-feu + planque | **scellé** avec la réserve | aucune |
| Planque (secret 4) | compacteur seul | — | aucune |

Ce qui fait « posé au pif », mesuré :

1. **Quatre pièces sur sept n'ont qu'une porte.** On entre, on ressort par la
   même porte, on reprend le couloir. C'est la définition du cul-de-sac.
2. **Quatre murs communs sont scellés exprès** (`JONCTIONS_SCELLEES`) : les
   seules boucles que la géométrie offrait ont été fermées.
3. **Le voisinage ne suit aucune logique métier.** La boucherie touche le SAV
   (viande crue contre téléviseurs), le fournil touche le PC sécurité, le
   compacteur est à 10 m du quai mais n'y mène pas. Rien ne dit pourquoi
   telle pièce est là.
4. **Aucune pièce ne se voit depuis une autre.** Aucune fenêtre, aucun
   passe-plat, aucune grille. On découvre chaque pièce en ouvrant sa porte,
   jamais avant.
5. **Le couloir est le seul fil.** Sur 92 m de couloir, il n'y a qu'un
   chemin, et il ne revient jamais sur un lieu connu.

**Contrainte à respecter par toute correction** : `reserve ↔ c_bu` et
`reserve ↔ c_short_ramp` sont scellées pour que les bureaux ne s'atteignent
que par le parking souterrain. Une boucle vers la réserve doit donc être
**visuelle** (vitre, grille) ou **à sens unique, des coulisses vers la
réserve** (comme la porte coupe-feu vers les rayons) : revenir en arrière
dans la progression est sans danger, sauter le souterrain ne l'est pas.

## 2. Level design : ce que font Duke Nukem 3D et Ion Fury

### 2.1 Ce que montrent les niveaux étudiés

| Niveau | Ce qui s'y voit, en rapport avec nos coulisses | Source |
|---|---|---|
| **Shop-N-Bag** (Duke 3D, E4L3) | **Le plus proche du nôtre : un supermarché avec ses coulisses.** Cuisine du rayon boucherie atteinte **par les conduits** ; **bureau du directeur derrière la caisse** ; **compacteur à déchets en fin de niveau**, avec un message secret dans un conduit voisin qu'on n'atteint que rétréci ; pile de cartons dont la rangée centrale plus sombre s'ouvre ; extincteur du rayon 1 qu'on fait sauter pour ouvrir une cache. **7 secrets.** | Informational Suite ; vidéo 100 % |
| **Hollywood Holocaust** (E1L1) | Un cinéma qui ressemble à un cinéma. Le hall donne le choix entre trois annexes (foyer, petit bureau, toilettes). **Conduit des toilettes relié à la cabine de projection**, caisse enregistreuse du hall qui déclenche un ascenseur secret, écran destructible, pont final qui ramène au cinéma par une fenêtre. Interrupteurs de lumière, film qu'on lance, extincteurs qui explosent, bornes d'arcade. **8 secrets** officiels et 4 officieux. | Informational Suite ; Bio Break |
| **Red Light District** (E1L2) | Conduit du club qu'on casse puis qu'on atteint **depuis une table** (passage obligatoire) ; **cuvette qu'on casse pour entrer dans l'égout** ; canapé du club qui ouvre une cache **à l'autre bout de la salle** ; mur plus éclairé entre des caisses qui s'ouvre ; étagère de librairie qui pivote ; sèche-mains qui ouvre une cache. **8 secrets.** | Informational Suite |
| **Death Row** (E1L3) | Interrupteur à côté de la **vitre** de la salle de la chaise électrique (on voit la pièce avant d'y agir) ; lit de cellule qui glisse ; **poster qui cache un tunnel vers les égouts** ; mur fissuré qui rejoint un trou vu plus tôt dans une cellule (la boucle se referme sur un lieu connu). **10 secrets.** | Informational Suite ; wiki |
| **Toxic Dump** (E1L4) | Conduits au ras du sol, praticables rétréci ; fissure dans le tunnel d'égout qui mène à une sortie secrète. | wiki Duke |
| **Ion Fury** (2019) | Procédé en cinq étapes chez Voidpoint : blockout pour l'échelle et la tactique, géométrie, lumière (« variété de couleur »), **détail interactif** (bornes d'arcade, **toilettes à chasse d'eau**, juke-box ; lampes qui clignotent, vapeur, pluie), puis séquences de destruction. Règle maison de Build : « Always start with a BANG! ». Secrets conçus autour du saut sur les objets mobiles (poubelles, cartons, balais). | PlayStation Blog ; TGG |

*Stadium, Fusion Station et Movie Set* : non étudiés en détail (guides
bloqués, voir section 7). Seul fait relevé : Movie Set cache une sortie
secrète dans une maquette de navette qu'on ouvre en pressant l'enseigne.

### 2.2 Principes, et ce qu'ils deviennent chez nous

1. **Boucler plutôt qu'aller-retour.** Romero (règle 7) : faire revenir le
   joueur dans des lieux connus pour qu'il comprenne l'espace. Un cul-de-sac
   doit être court, payer (récompense, secret) ou rouvrir sur le chemin
   principal par un raccourci. Duke le fait à chaque niveau : le mur fissuré
   de Death Row débouche sur le trou de cellule vu plus tôt, le pont
   d'Hollywood Holocaust ramène au cinéma par une fenêtre.
   → **Cible : toute pièce des coulisses a au moins 2 accès**, dont au moins
   un qui n'est pas une porte de couloir (porte vers la pièce voisine,
   passe-plat, conduit, vitre cassable, trou). Seule exception : la planque
   du secret, qui paie.
2. **Voir avant d'atteindre.** Romero (règle 5) : si le joueur voit un lieu,
   il doit pouvoir y aller. Death Row fait agir un interrupteur à côté d'une
   vitre. → **Cible : chaque pièce se voit depuis au moins un autre lieu**
   avant qu'on y entre (vitre, passe-plat, grille, porte vitrée), et au moins
   un de ces points de vue est pris depuis un lieu DÉJÀ traversé (rayons,
   réserve).
3. **Des routes parallèles.** Les niveaux de Duke sont non linéaires : les
   conduits, les portes de service et les égouts offrent des chemins qui se
   rejoignent, pour éviter un combat ou trouver une cache. Shop-N-Bag mène à
   la boucherie par les conduits. → **Cible : un conduit ou une gaine
   praticable qui double le couloir sur au moins deux pièces**, porteur d'au
   moins un secret.
4. **Chaque pièce a son jouet.** « Chaque pièce pouvait avoir un bouton, un
   mur mobile, un secret, un gag visuel, une embuscade » (Generation Amiga).
   Le détail d'Ion Fury est interactif avant d'être décoratif. → **Cible :
   par pièce, 1 interaction signature (touche E ou tir) qui n'existe nulle
   part ailleurs + 2 à 4 petites (casse, ramassage, interrupteur, porte
   d'armoire).** Une pièce sans interaction propre est un couloir élargi.
5. **Des secrets nombreux et annoncés.** 7, 8, 8 et 10 secrets relevés sur
   quatre niveaux de Duke. Les indices se répètent : mur plus éclairé,
   rangée de cartons plus sombre, fissure, poster, objet qui ne sert à rien
   sinon. → **Cible : dans les coulisses, 1 secret officiel (★4) + 2 caches
   mineures (munitions, nourriture)**, chacune annoncée par un indice visible
   d'au moins un angle.
6. **Contraste d'une pièce à l'autre.** Romero (règle 4) : clair/sombre,
   étroit/vaste. Le premier board le confirme : chaque espace qui tranche le
   fait par la température de sa lumière. → **Cible : deux pièces qui se
   suivent ne partagent ni la même hauteur sous plafond, ni la même
   température de lumière** (voir les palettes, section 3).
7. **Des repères.** Romero (règle 8) ; Tim Willits : ménager une vue qui
   fait dire « wow » au détour d'un angle. → **Cible : 1 point focal par
   pièce, visible depuis sa porte principale, qui la nomme sans panneau.**
8. **Défi, puis récompense.** Levelord : « une bonne carte est une suite de
   défis et de récompenses ». Rythme cité par la communauté de Duke :
   ravitaillement, ennemis, ravitaillement. → alterner pièce de combat et
   pièce de répit (PC sécurité et compacteur sont déjà des pièces sans
   ennemi : les placer ENTRE deux pièces de combat).
9. **L'environnement raconte.** Harvey Smith et Matthias Worch (GDC 2010) :
   un seul objet peut changer la lecture d'une scène ; le joueur comble le
   vide entre les indices ; « il faut pouvoir rater certaines choses pour
   que les trouver ait du sens ». → **Cible : une histoire qui court sur au
   moins trois pièces**, lisible seulement pour qui regarde (proposition en
   section 4.4).
10. **Reconnaissable d'abord.** « Un cinéma ressemblait à un cinéma, un bar à
    un bar » (Generation Amiga). Marc Laidlaw : le décor banal de bureau rend
    l'horreur plus frappante. → chaque pièce doit se nommer par ses objets
    à 640×360, sans texte.

### 2.3 Chiffres cibles pour les coulisses

| Mesure | Première passe (relevé) | Cible |
|---|---|---|
| Pièces à un seul accès | 4 sur 7 | 0 (hors planque du secret) |
| Boucles praticables dans les coulisses | 0 | ≥ 2 |
| Pièces visibles avant d'y entrer | 0 sur 7 | ≥ 5 sur 7 |
| Points de vue vers un lieu déjà traversé | 0 | ≥ 2 (rayons, réserve) |
| Interaction signature par pièce | 3 pièces sur 7 (casiers, console, bouton) | 7 sur 7 |
| Objets interactifs par pièce (casse, E, ramassage) | non compté | 3 à 5 |
| Secrets et caches | 1 | 1 secret + 2 caches annoncées |
| Deux pièces voisines de même lumière | non mesuré | 0 |

## 3. Les vraies coulisses d'une grande surface

### 3.1 Le flux réel, qui doit dicter l'ordre des pièces

- **La marche en avant** (règle d'hygiène alimentaire) : les produits vont de
  la réception au produit fini **sans retour en arrière ni croisement**. Dans
  un grand établissement, elle est spatiale : réception et déballage,
  stockage sec, stockage froid (positif, parfois négatif), préparation, zone
  chaude (pousse, cuisson), refroidissement, plonge séparée, et **un circuit
  des déchets qui ne traverse aucune zone propre**. Le cru entre d'un côté,
  le produit fini sort de l'autre (La Toque, Nouvelles de la Boulangerie,
  Moulins à farine).
- **La réserve** : zone de réception accolée aux quais, dimensionnée pour une
  journée de livraisons ; allées de circulation **à sens unique, 3,10 m de
  large** ; stockage tampon le long des murs, hors des allées ; articles à
  forte rotation près de l'entrée de réserve (Carsat Aquitaine, via
  recherche ; Equip Rayonnage).
- **Un hypermarché Leclerc réel** (dossier de conception Carsat Aquitaine,
  page non ouverte, voir section 7) : **rail au plafond pour transporter les
  carcasses jusqu'au laboratoire boucherie**, labos boucherie et
  boulangerie éclairés par des **châssis vitrés**, chariot à fourches
  longues de trois palettes qui alimente le couloir de la réserve depuis le
  quai **en ligne droite**.
- **Le personnel** a son propre flux : entrée du personnel, pointage,
  vestiaire, puis son labo ou son rayon. Le vestiaire est un local à part,
  **isolé des locaux de travail et de stockage, placé sur le passage des
  travailleurs** (Code du travail, R4228-2).
- **Le PC sécurité** d'un établissement recevant du public se place **au
  niveau d'arrivée des secours**, facilement accessible ; il centralise
  vidéosurveillance, contrôle d'accès, alarmes, et une armoire avec toutes
  les clés du bâtiment (Fiducial, Prepasecu, SFP73).

**Ce que ça veut dire pour nous** : les pièces des coulisses ont un ordre
naturel, et le joueur le reconnaîtra sans qu'on l'explique. Le joueur arrive
dans les coulisses **depuis le parking souterrain par la rampe** : c'est
exactement l'entrée du personnel d'une grande surface. Section 4.

### 3.2 Fiches par pièce

Les palettes sont **proposées** d'après les matériaux relevés (inox, carrelage
de grès, panneaux blancs lessivables, béton), pas mesurées sur des photos :
les images n'ont pas été ouvertes (section 7). Elles se vérifient avec
`tools/refs/extract_palette.py` le jour où un dossier `refs/coulisses/`
existe. Les hex sont des albédos avant quantification sur `palette.png`.

---

#### A. Vestiaires et pointeuse

**Réalité.** Local isolé sur le passage du personnel, **1 m² par salarié**
retenu par l'inspection (bancs compris). Casiers métalliques **30 à 40 cm de
large, 50 cm de profond, 180 cm de haut** ; pour une activité salissante
(boucherie, fournil), armoire à **deux compartiments** séparés par une
cloison (tenue de ville / tenue de travail). Douches obligatoires pour
certains travaux salissants seulement. Dans les années 80-90 : **pointeuse
à cartes carton entre deux râteliers numérotés** — on prend sa carte à
gauche, on pointe en tirant la manette, on la range à droite, et l'inverse
le soir. Tableau d'affichage obligatoire, plannings, machine à café.

- Point focal : **la pointeuse et ses deux râteliers de cartes**, face à la
  porte d'arrivée, sous une horloge.
- Objets signature : rangée de casiers gris-beige (porte ouvrable, E) ;
  bancs à patères ; pointeuse murale à manette ; tableau de liège (planning,
  notes de service) ; porte vitrée dépolie des douches.
- Gags façon Duke :
  - **pointer** (E) : réplique du héros, « Heures sup' non payées », et la
    carte du joueur porte un numéro qui n'existe pas ;
  - un casier s'ouvre sur un **Costard en train de se changer** (le spawn
    prévu, rendu lisible : on le voit par la fente de la porte avant
    d'ouvrir) ;
  - douche qu'on allume (vapeur, bruit d'eau), comme les toilettes à chasse
    d'eau d'Ion Fury ;
  - « Employé du mois » au mur : le Directeur, déjà reptilien sur la photo
    si on la regarde de près.
- Contraintes mesurables :
  - casiers en rangées de 5 à 8 (1,8 m de haut) : **à 1,8 m, une rangée
    couvre un Costard** (au-dessus du seuil de 1,6 m de l'ADR 0025) ;
  - allée entre deux rangées ≥ 1,2 m ; surface 60 à 100 m² pour 60 à
    100 casiers (1 m² par salarié) ;
  - plafond bas : **2,6 à 3,0 m** (contraste avec le fournil, voir 2.2 §6) ;
  - lumière : tubes fluo nus en ligne au-dessus des allées, blanc neutre
    tirant vers le vert (1 tube sur 6 qui clignote) ;
  - palette : casiers gris-beige `#a8a28e`, sol carrelage `#b9b2a0`, bancs
    bois `#8a6a45`, portes de casier dépareillées (1 sur 8 d'une autre
    teinte `#6f7f6a`).

---

#### B. Fournil et rôtisserie

**Réalité.** Organisation en marche en avant : réception et stockage des
matières (sacs de farine), pétrissage, façonnage, **pousse**, **cuisson**,
refroidissement sur chariots, puis vente. Plans de travail à ~90 cm
(viennoiserie) à ~100 cm (pâtisserie fine), **passage d'au moins 120 cm
derrière un équipement, 150 cm dos à dos**. Sol en résine ou carrelage
antidérapant à joints étanches, plinthes à gorge, murs en panneaux lisses
lessivables, inox 304. Éclairage **500 à 700 lux** (le poste de travail le
plus lumineux des coulisses). Équipements relevés : **four à sole à étages**
(chambres de 18 à 21 cm de haut, par exemple 4 étages de 650 × 800 mm) ;
**chambre de pousse à chariot** (480 × 615 × 1 835 mm pour un chariot de
20 niveaux de grilles 400 × 600) ; **rôtissoire vitrée 6 à 8 broches**,
30 à 48 poulets, 1 310 × 635 × 1 093 mm pour un modèle 8 broches.

En grande surface, le fournil est souvent **vitré côté magasin** (« pain cuit
sur place ») : le client voit le four. Non confirmé par une photo ouverte,
mais cohérent avec les châssis vitrés du Leclerc de la Carsat.

- Point focal : **le four à sole**, un mur entier de portes d'acier à
  hublots, lueur orange aux joints.
- Objets signature : four à sole à 3-4 étages ; chariots à échelles de
  grilles (1,8 m) en file ; pétrin à cuve ; palette de sacs de farine
  cassables (nuage blanc, prévu) ; rôtissoire vitrée aux broches qui
  tournent.
- Gags façon Duke :
  - ouvrir une porte de four (E) : fournée qui sort, pain +5 ; une porte
    ouverte lâche une bouffée de vapeur ;
  - **chambre de pousse** qu'on ouvre : la pâte a débordé, énorme, et
    déborde encore ;
  - radio de l'équipe de nuit posée sur un chariot, qu'on allume (le
    juke-box d'Ion Fury) ;
  - la farine qui éclate révèle les silhouettes : un Costard dans le nuage
    devient visible en blanc.
- Contraintes mesurables :
  - plafond **haut, 4 à 5 m**, hotte d'extraction au-dessus du four (et
    c'est elle qui accueille la gaine praticable, section 4) ;
  - allées de 1,2 m minimum entre chariots et plans de travail ; 3 à 4
    chariots en file créent une rangée de couvert à 1,8 m ;
  - densité : la plus élevée des coulisses (« elevee » au plan), un objet
    posé tous les 2 à 3 m² au sol ;
  - lumière : la plus **chaude** des coulisses, lueur orange au four
    (`light_*` chaude, basse) + tubes neutres au plafond ;
  - palette : inox clair `#b8bcc0`, carrelage rouge brique antidérapant
    `#8e3b2c`, farine `#ece6d8`, croûte `#b8742e`, lueur de four `#ff8a2a`
    (émissive).

---

#### C. PC sécurité

**Réalité.** Poste occupé en permanence, près de l'arrivée des secours et
de l'entrée du personnel. Années 90 : **moniteurs noir et blanc ou couleur
de 23 à 43 cm** reliés en coaxial, **commutateur cyclique** qui fait défiler
les caméras sur un écran, **quadravision** (écran coupé en quatre),
**multiplexeur** au-delà de dix caméras, **magnétoscope time-lapse** (jusqu'à
960 h sur une VHS T-120, contre 24 h sans). Armoire à clés de tout le
bâtiment, classeurs de consignes, tableau de signalisation incendie.

- Point focal : **le mur de moniteurs** (prévu, `ecran_*` + caméras `cam_*`),
  seul éclairage bleuté de la pièce.
- Objets signature : console avec le vigile endormi ; mur de 6 à 12
  moniteurs cathodiques dont 2-3 en quadravision ; pile de magnétoscopes à
  diodes rouges ; armoire à clés murale (crochets numérotés, un vide) ;
  **guichet vitré sur le couloir** (le vigile voit la pointeuse).
- Gags façon Duke :
  - la console (E) : vue par les caméras (prévu), dont celle du bureau du
    Directeur ;
  - **un moniteur montre le joueur** de dos, en direct (caméra du couloir) ;
  - micro d'annonces : « Monsieur Costard est attendu à l'accueil » ;
  - **un moniteur est noir, étiqueté « COMPACTEUR — HS »** : l'indice du
    secret 4 (section 4.4) ;
  - VHS marquée « NE PAS EFFACER » dans le magnétoscope.
- Contraintes mesurables :
  - pièce petite et basse : **2,6 à 3 m** sous plafond, 40 à 60 m² ;
  - aucun tube au plafond allumé, ou un seul : c'est la pièce **la plus
    sombre et la plus froide** des coulisses, éclairée par les écrans ;
  - le guichet donne une vue sur la porte d'arrivée des coulisses (point de
    vue exigé par 2.2 §2) ;
  - palette : console beige informatique `#b3ab96`, moquette `#4a4c52`,
    lueur d'écran `#7fb0d8` (émissive), diodes rouges `#e0302a`.

---

#### D. Chambre froide, labo boucherie, marée

Trois locaux dans la réalité, accolés et reliés par le rail.

**Réalité.**
- **Chambre froide** : carcasses suspendues à un **rail aérien inox**
  (suspentes tous les 60 à 80 cm). Hauteur libre sous le rail relevée :
  **2,20 m minimum pour une demi-carcasse de bœuf**, 2,00 m pour un porc
  entier, 1,60 m pour un agneau ; **20 cm minimum de garde au sol**.
  Espacement entre pièces : **60 à 80 cm (bœuf)**, 50 à 70 cm (porc).
  Portiques à viande standard à 2,10 m. **Rideau à lanières PVC** à la
  porte. Obligations : ouverture de la porte **depuis l'intérieur en toute
  circonstance**, **alarme « personne enfermée » : bouton coup de poing,
  grande surface, allumé en permanence**, exigé au-delà de 10 m³ ;
  éclairage de secours.
- **Labo boucherie** : sol en **grès cérame pleine masse antidérapant R12,
  20 × 20 cm** (recommandation de l'Assurance maladie), tables de découpe
  inox, scie à os, trancheuse ; relié à la chambre froide **par le rail**
  (Carsat : rail au plafond jusqu'au labo), derrière le comptoir boucherie
  du magasin.
- **Marée** : tables inox à planche de découpe, bac de lavage et trou à
  déchets ; bacs à glace pilée et machine à glace ; **vivier à homards**
  rectangulaire, eau à 8-15 °C ; caisses de polystyrène.

- Point focal : **la file de carcasses sur le rail**, qui entre dans la
  pièce par une ouverture à lanières et en ressort par une autre.
- Objets signature : carcasses suspendues (se balancent au tir, se poussent
  au contact) ; **bouton coup de poing lumineux** à côté de la porte ;
  rideau à lanières ; vivier à homards cassable (eau, prévu) ; trancheuse et
  scie à os sur table inox.
- Gags façon Duke :
  - le **bouton « personne enfermée »** (E) : la sirène hurle, un Costard
    arrive par l'autre porte ;
  - une carcasse en costume-cravate au milieu des autres (un Costard mort,
    ou pas : il bouge au passage du joueur) ;
  - le vivier cassé lâche des homards (sprites) qui s'enfuient ;
  - frapper une carcasse au pied-de-biche (clin d'œil à Rocky, qu'on
    reconnaît sans le nommer).
- Contraintes mesurables :
  - rail à **2,6 à 3 m** du sol pour que la carcasse pende à hauteur de
    visée (bas à ~0,3 m, haut à ~2,5 m) ; carcasses espacées de 0,7 m ;
    files parallèles espacées de 1,5 m (allée de circulation) ;
  - **les carcasses sont des lots de dessin** : s'en tenir à un
    `InstancedMesh` ou un `BatchedMesh`, et les compter avant d'en poser plus
    de 12 ;
  - plafond 3,5 à 4 m ; murs panneaux sandwich blancs ;
  - lumière : la plus **froide** du niveau, hublots étanches blanc bleuté,
    givre au sol et aux angles ; le labo attenant est blanc et vif (500 lux
    et plus), la chambre froide plus sombre ;
  - palette : panneaux `#dfe4e6`, carrelage rouge `#8e3b2c` au labo, viande
    `#9a3a34` / gras `#e6d6bf`, lanières translucides `#c9d8dc`, bouton
    `#e0302a` émissif.

---

#### E. Atelier SAV

**Réalité** (moins documentée, voir section 7). Le service après-vente d'un
hypermarché se tient **derrière le rayon électroménager et l'accueil** :
guichet de dépôt, fiches de dépôt agrafées aux appareils, étagères
d'appareils en attente (étiquette de dépôt, nom du client), établis de
réparation avec oscilloscope et fer à souder, pièces détachées en bacs,
téléviseurs sur mire pour le réglage.

- Point focal : **le mur de téléviseurs allumés** (prévu, ~40 écrans
  animés), qui n'est plus un gag gratuit : c'est l'endroit où l'on règle les
  télés.
- Objets signature : établi à loupe éclairée et oscilloscope ; rayonnage de
  retours (appareils étiquetés, cartons ouverts) ; guichet de dépôt avec
  sonnette ; bacs de pièces détachées ; chariot à téléviseur.
- Gags façon Duke :
  - un téléviseur passe la **fausse vidéosurveillance, qui montre le
    joueur** dans l'atelier ;
  - la sonnette du guichet (E) : « On arrive ! » — personne ne vient, ou un
    Costard ;
  - micro-ondes en réparation qui explose au tir (prévu) ;
  - étiquette de dépôt « Client : M. Directeur — urgent » sur un appareil
    qui fume.
- Contraintes mesurables :
  - plafond 3,5 m ; rayonnages de retours à 2 m (couvert réel) en 2 ou 3
    rangées, allées de 1,5 m ;
  - lumière : lampe d'établi chaude et ponctuelle + lueur froide des écrans
    (la seule pièce à deux températures, justifiée par ses objets) ;
  - **budget des écrans à mesurer avant de passer 20** (chaîne animée =
    un atlas partagé, mais chaque écran cassable doit rester un lot commun) ;
  - palette : carcasses d'appareils beige et gris `#b8b0a0` / `#5a5c60`,
    établi bois `#8a6a45`, étiquettes orange fluo `#ff9a3a`.

---

#### F. Local compacteur (et presse à balles)

**Réalité.** Accolé au **quai**, parce que les bennes et les balles partent
par camion. Presse à balles verticale (par exemple 1 709 × 1 248 × 2 370 mm ;
modèles réduits à 2,25 m pour les plafonds bas) ou horizontale pour les gros
producteurs. **Balle type 1 200 × 780 × 1 300 mm, 200 kg** ; de 30 à 550 kg
selon les presses. Bennes, conteneurs roulants, palettes vides empilées.

- Point focal : **la presse à balles**, porte grillagée, gros bouton
  vert/rouge, et le mur de balles de carton derrière elle.
- Objets signature : presse verticale à porte-grille ; balles de carton
  cerclées (props poussables) ; benne ; palettes vides en pile ; porte
  sectionnelle vers le quai.
- Gags façon Duke :
  - le **bouton du compacteur** (prévu) : la presse descend, écrase ce qui
    est dedans (un carton de canettes qui gicle, ou un Costard assommé) ;
  - rats qui détalent quand on entre ;
  - pousser une balle révèle un trou dans le mur (le secret 4).
- Contraintes mesurables :
  - plafond **5 m** (le plus haut des coulisses, contraste voulu) ;
  - balles à leur vraie cote, 1,2 × 0,78 × 1,3 m ; en empiler deux fait
    2,6 m, un mur de couvert ;
  - une balle poussable ne peut pas peser 200 kg dans le jeu si le joueur
    doit la bouger : `masse` à régler avec `feel-tuner`, l'écart est
    assumé ;
  - lumière : un seul projecteur sur la presse, pénombre autour, lumière
    du quai qui entre par une grille (voir 4.2) ;
  - palette : carton `#a47a4c`, béton `#77756f`, presse vert industriel
    `#3f6b4a`, bandes jaune et noir `#e0b020`.

---

#### ★4. Planque du vigile (secret 4)

**Réalité** : aucune source, c'est la fiction du lieu. Mais elle s'appuie
sur une réalité documentée des grandes surfaces, la **démarque inconnue**
(le vol, dont une part par le personnel), et sur le magnétoscope du PC
sécurité.

- Point focal : **le canapé face à la télé qui passe le foot**.
- Objets signature : canapé défoncé ; téléviseur sur une caisse ; frigo
  de boissons ; **marchandises volées encore munies de leurs antivols**
  (chaîne hi-fi, bouteilles, jambon) ; calendrier des rondes, cases cochées.
- Gags façon Duke : la télé (E) change de chaîne ; le frigo (E) donne une
  canette ; au mur, la photo du vigile endormi du PC sécurité.
- Contraintes mesurables : 2,5 m sous plafond, 8 × 6 m au plus, lumière
  d'une seule lampe chaude + lueur de la télé ; récompense visible depuis
  l'entrée (pizza +25, munitions +36, prévues).

## 4. Disposition recommandée

### 4.1 L'ordre : une journée de travail, à l'envers de la marchandise

Le joueur entre dans les coulisses par la rampe du parking souterrain — le
parking du personnel. L'ordre qui suit se reconnaît sans explication, parce
qu'il suit le flux réel :

```
 parking souterrain (personnel)
        │ rampe
        ▼
 ┌─ PC SÉCURITÉ ──guichet vitré──┐        ← contrôle des entrées
 │                               ▼
 │                        VESTIAIRES + pointeuse   ← on pointe, on se change
 │                               │ douches / porte commune
 │                               ▼
 │                        FOURNIL / rôtisserie     ← labo chaud
 │   (gaine VMC praticable au-dessus des trois, du fournil au PC sécu)
 └──── couloir du personnel (retour rapide) ──────┘
        │ couloir de service
        ▼
 ┌─ CHAMBRE FROIDE ──rail + lanières── LABO BOUCHERIE / MARÉE ─┐
 │        │                                   │ vitre / passe-plat
 │        │                                   ▼
 │   COMPACTEUR ──grille sur le quai── (réserve, déjà vue)     RAYONS
 │        │ balles poussées                                 (porte coupe-feu)
 │        ▼
 │   ★4 PLANQUE
 └──── couloir coupe-feu (retour rapide) ──────────────────────┘
```

Traduction sur le plan de masse actuel (coordonnées du diff, à reprendre au
lot 1) :

1. **PC sécurité à l'arrivée** : il y est déjà (x 44-56, bout est du couloir
   du personnel, face à la rampe). On lui ajoute un **guichet vitré sur le
   couloir**.
2. **Vestiaires et fournil échangés** : les vestiaires passent à l'est
   (contre le PC sécurité, relié par le guichet ou une porte), le fournil à
   l'ouest. On pointe avant de travailler.
3. **La jonction scellée `fournil ↔ pc_secu` disparaît**, remplacée par
   l'enfilade PC sécurité → vestiaires → fournil, chaque pièce avec sa porte
   de couloir ET sa porte vers la voisine : **une échelle**, pas un peigne.
   Le couloir devient le chemin de retour rapide.
4. **Chambre froide et labo boucherie ensemble, contre les rayons.** Le mur
   nord des rayons est à y = 84 ; l'aile ouest des coulisses commence à
   y = 88. Coller le labo boucherie aux rayons (y = 84) et lui donner une
   **vitre ou un passe-plat sur le rayon** : le joueur voit, depuis les
   rayons, des carcasses et un Costard derrière la vitre, bien avant d'y
   accéder (2.2 §2), et ressort par la porte coupe-feu juste à côté.
   La chambre froide se met au nord du labo, reliée par le **rail et un
   rideau à lanières** : la seconde porte de chaque pièce.
5. **Le SAV quitte l'aile boucherie.** Deux options, à trancher :
   - **A (recommandée)** : derrière l'électroménager (bande libre au nord
     de x 10-46, y 80-92, au-dessus du souterrain qui est à z = −6 : à
     vérifier), avec un **guichet SAV visible depuis le rayon TV** — il
     devient la seconde issue optionnelle de l'électroménager, et le mur de
     télés y trouve sa raison ;
   - **B** : il reste dans les coulisses, mais comme « retours et reprises »
     ouvert sur la réserve (sens unique vers la réserve).
6. **Le compacteur ouvre sur le quai** : la jonction `reserve ↔ compacteur`
   devient une **grille ou une porte sectionnelle vitrée** (vue sur le quai
   où l'on s'est battu), plus une **porte à sens unique des coulisses vers
   la réserve**. C'est la grande boucle : souterrain → coulisses → réserve,
   un lieu connu vu sous un angle neuf (Romero, règle 7). Elle ne permet pas
   de sauter le souterrain, puisqu'elle ne s'ouvre que de ce côté.

### 4.2 Les liens autres que des portes

| Lien | Entre | Rôle | Référence |
|---|---|---|---|
| Guichet vitré | PC sécurité → couloir / pointeuse | voir avant, et être vu | 2.2 §2 |
| Vitre ou passe-plat | labo boucherie ↔ rayons | voir depuis un lieu déjà traversé | Death Row (vitre de la chaise) |
| Rail aérien + lanières | chambre froide ↔ labo | seconde porte, fil conducteur | Carsat (rail au plafond) |
| Grille / porte sectionnelle vitrée | compacteur → quai | repère, revisite | Romero règle 7 |
| Gaine VMC praticable | fournil → vestiaires → PC sécurité | route parallèle, cache | Shop-N-Bag (boucherie par les conduits), Red Light District (conduit depuis une table) |
| Porte à sens unique | compacteur → réserve | grande boucle sans casser la progression | porte coupe-feu existante |

La gaine se prend **depuis un meuble**, comme le conduit du club de Red
Light District depuis une table : un plan de travail (~1 m) sous la hotte du
fournil, puis la bouche de gaine à ~2 m, chaque marche sous le saut de
1,1 m (à vérifier en jeu). Elle ne doit pas
recevoir de collider au plafond qui tromperait le bake de navigation : c'est
un couloir praticable à part entière, avec son sol.

### 4.3 L'alternance

| Ordre | Pièce | Ennemis (plan actuel) | Lumière | Plafond |
|---|---|---|---|---|
| 1 | PC sécurité | aucun (répit) | froide, sombre | 3 m |
| 2 | Vestiaires | 1 | neutre-vert | 3 m |
| 3 | Fournil | 2 | chaude, vive | 4-5 m |
| 4 | Chambre froide | 2 | froide, sombre | 4 m |
| 5 | Compacteur | aucun (répit) | un projecteur | 5 m |
| 6 | Labo boucherie → rayons | (vus par la vitre) | blanche, vive | 3,5 m |

Deux pièces voisines ne partagent jamais la même lumière. Vestiaires et PC
sécurité ont la même hauteur, mais pas la même lumière ; à vérifier au
premier rendu.

### 4.4 L'histoire qui court d'une pièce à l'autre

**Le vigile vole.** Personne ne le dit, et le joueur peut ne jamais le
comprendre (Smith : il faut pouvoir le rater).

1. **PC sécurité** : le vigile dort. Un moniteur est noir, étiqueté
   « COMPACTEUR — HS ». Un crochet vide dans l'armoire à clés.
2. **Compacteur** : la caméra du local est coiffée d'un carton. Une balle
   n'est pas cerclée comme les autres (l'indice façon « rangée de cartons
   plus sombre » de Shop-N-Bag).
3. **Planque** : derrière cette balle, le butin avec ses antivols, la clé du
   crochet vide, et la télé qui passe le foot.
4. **Vestiaires** : son casier est le seul cadenassé ; ouvert au pied-de-biche
   (tir), il contient une cache mineure.

## 5. Ce qui ne se transfère pas (délibérément ignoré)

- **Les marques réelles** (fabricants de fours, de presses, enseignes de
  grande distribution) : règle de satire, marques inventées uniquement.
- **Les températures** (0-4 °C, −18 °C) : elles ne se voient pas. Le froid
  se lit par la lumière bleutée, le givre et les lanières, rien d'autre.
- **Les miroirs** des toilettes de Duke : pas de reflet dans notre pipeline
  Lambert à 640×360.
- **Le rétrécissement et le jetpack** de Duke, qui ouvrent ses conduits bas :
  il n'y a pas d'accroupissement dans `moveConfig.ts`, donc nos conduits se
  prennent **debout : 2 m de haut minimum**.
- **La règle d'hygiène elle-même** : la marche en avant interdit le retour
  en arrière, un niveau de jeu le recherche (boucles). On garde l'ORDRE des
  locaux, pas l'interdiction de revenir.
- **Les cotes de confort réelles** quand elles gênent le jeu : 1,2 m entre
  chariots est une valeur d'atelier, trop juste pour un combat. On garde
  1,5 m partout où un Costard doit pouvoir passer.

## 6. Références

### Level design

- Informational Suite (Ryan Lennox), fiches de niveau :
  [Hollywood Holocaust](https://infosuite.duke4.net/index.php?page=e1l1),
  [Red Light District](https://infosuite.duke4.net/index.php?page=e1l2),
  [Death Row](https://infosuite.duke4.net/index.php?page=e1l3),
  [Shop-N-Bag](https://infosuite.duke4.net/index.php?page=e4l3).
- Vidéo 100 % de Shop-N-Bag (référence visuelle de la boucherie, du bureau
  derrière la caisse et du compacteur) :
  [YouTube](https://www.youtube.com/watch?v=Tv6sk6L8qkU).
- [Bio Break, Hollywood Holocaust](https://biobreak.wordpress.com/2017/02/04/duke-nukem-3d-hollywood-holocaust/) —
  niveau compact et dense, interactions, secrets.
- [Overdeveloped, « Game tutorial through level design »](http://overdevelop.blogspot.com/2014/10/duke-nukem-3d-game-tutorial-through.html) —
  le toit d'Hollywood Holocaust enseigne sans ennemi.
- [Generation Amiga, le Build engine et Duke 3D](https://www.generationamiga.com/2026/06/21/how-ken-silvermans-build-engine-shaped-duke-nukem-3d-and-90s-fps-design/) —
  « chaque pièce pouvait avoir un bouton… », lieux reconnaissables.
- [PlayStation Blog, le design d'Ion Fury](https://blog.playstation.com/2020/05/13/breaking-down-ion-furys-classic-fps-design-out-tomorrow/) —
  les cinq étapes, le détail interactif.
- [TGG, entretien avec Richard Gobeille (Voidpoint)](https://thegg.net/interviews/ion-fury-interview-with-voidpoint-game-development-and-ion-furys-past-present-and-future/).
- [Duke4.net, « Level design / gameplay design »](https://forums.duke4.net/topic/9799-level-designgameplay-design/) —
  rythme ravitaillement-ennemis, non-linéarité.
- Règles de Romero : [Helldorado Team](https://www.helldoradoteam.com/2018/12/19/john-romeros-level-design-tips/),
  [Doom Wiki](https://doomwiki.org/wiki/Tips_for_creating_good_WADs),
  [eev.ee, « You should make a Doom level », partie 2](https://eev.ee/blog/2015/12/30/you-should-make-a-doom-level-part-2/).
- [Game Developer, « Secrets of the Sages: Level Design »](https://www.gamedeveloper.com/design/secrets-of-the-sages-level-design) —
  Levelord, Willits, Jaquays, Laidlaw.
- [Kreonit, chemins, secrets et raccourcis](https://kreonit.com/idea-generation-and-game-design/level-design-for-beginners/) —
  le cul-de-sac doit être court ou rouvrir sur le chemin.
- Smith et Worch, « What Happened Here? » :
  [GDC Vault](https://gdcvault.com/play/1012647/What-Happened-Here-Environmental),
  [notes](https://www.worch.com/files/gdc/What_Happened_Here_Web_Notes.pdf),
  [entretien Nieman Storyboard](https://niemanstoryboard.org/2011/01/14/harvey-smith-on-environmental-storytelling-and-embedding-narrative/).

### Coulisses réelles (pages avec photos ou schémas)

- Réserve et quai : [Carsat Aquitaine, construction d'un hypermarché (sommaire)](https://leffetprevention.carsat-aquitaine.fr/construction-dun-hypermarche.html),
  [circulation intérieure](https://leffetprevention.carsat-aquitaine.fr/construction-dun-hypermarche/circulation-interieure-11.html),
  [quai](https://leffetprevention.carsat-aquitaine.fr/construction-dun-hypermarche/quai-1.html),
  [labo boulangerie-pâtisserie](https://leffetprevention.carsat-aquitaine.fr/construction-dun-hypermarche/laboratoire-boulangerie-patisserie.html) ;
  [Equip Rayonnage, aménager une réserve](https://www.equip-rayonnage.com/blog/amenager-reserve-magasin-n32) ;
  [INRS ED 6039, entrepôts de la grande distribution](https://www.inrs.fr/media.html?refINRS=ED+6039) ;
  Wikimedia Commons : [Loading docks](https://commons.wikimedia.org/wiki/Category:Loading_docks),
  [Loading bays](https://commons.wikimedia.org/wiki/Category:Loading_bays),
  [Pallet jacks](https://commons.wikimedia.org/wiki/Category:Pallet_jacks),
  [Supermarket interiors](https://commons.wikimedia.org/wiki/Category:Supermarket_interiors).
- Fournil : [La Toque, marche en avant](https://www.latoque.fr/fabrication/article/862333/hygiene-les-principes-de-la-marche-en-avant),
  [Les Nouvelles de la Boulangerie](https://lesnouvellesdelaboulangerie.fr/actualites/le-principe-de-la-marche-en-avant/),
  [Moulins à farine, normes du labo](https://moulinsafarine.fr/laboratoire-boulangerie-normes),
  [four à sole 4 étages (fiche)](https://www.stock-direct-chr.com/fours-a-sole-triphase-pour-boulangerie-4-etages-2-plaques-400x600-650x800x210-mm-forno246-4-sinmag/p68545),
  [chambre de pousse à chariot (fiche)](https://www.ematika.fr/boutique/materiel-de-preparation-professionnel/preparation-pate/armoire-chambre-pousse-etuve-fermentation/chambre-de-fermentation-a-chariots/chambre-de-fermentation-boulangerie-de-chariot-40x60.html),
  [rôtissoire 8 broches (fiche)](https://www.materielpizzadirect.com/rotissoire-professionnelle/14139-5382-rotissoire-professionnel-a-poulets-gaz-8-broches-48-poulets-sur-roues-0634438735137.html) ;
  Commons : [Bakery interiors](https://commons.wikimedia.org/wiki/Category:Bakery_interiors),
  [Bread ovens](https://commons.wikimedia.org/wiki/Category:Bread_ovens),
  [Bakers at work](https://commons.wikimedia.org/wiki/Category:Bakers_at_work),
  [Rotisserie](https://commons.wikimedia.org/wiki/Category:Rotisserie).
- Chambre froide, boucherie, marée : [Cold Distribution, suspendre la viande](https://colddistribution.fr/content/912-suspendre-la-viande-en-chambre-froide),
  [alarme « homme enfermé »](https://colddistribution.fr/content/665-alarme-homme-enferme-),
  [Mon labo fermier, rail à viande](https://monlabofermier.fr/materiel/rail-a-viande/),
  [MAPA, carrelage de boucherie](https://www.mapa-assurances.fr/boucherie/carrelage),
  [viviers à homards](https://lobster-tanks.com/viviers-a-homards-2/),
  [vivier de poissonnerie](https://www.materiel-chr-pro.com/froid/poissonnerie/vivier-aquarium-poissonnerie.html) ;
  Commons : [Cold storage](https://commons.wikimedia.org/wiki/Category:Cold_storage),
  [Meat hooks](https://commons.wikimedia.org/wiki/Category:Meat_hooks),
  [Butcher shops](https://commons.wikimedia.org/wiki/Category:Butcher_shops),
  [Fishmongers](https://commons.wikimedia.org/wiki/Category:Fishmongers),
  [Slaughterhouses](https://commons.wikimedia.org/wiki/Category:Slaughterhouses).
- PC sécurité : [Fiducial, définition du PC sécurité](https://www.fiducial-securite.fr/glossaire/qu-est-ce-qu-un-pc-securite-definition),
  [Prepasecu, le poste central de sécurité](https://prepasecu.fr/ssiap-1/cours/role-missions-agents-de-securite/poste-central-de-securite),
  [SFP73, prise de poste et clés](https://sfp73.fr/18ssiap1.html),
  [dossier vidéosurveillance, musée Obs-Traffic (PDF)](https://www.obs-traffic.museum/sites/default/files/ressources/files/SMF_videosurveillance.pdf) ;
  Commons : [Video monitors in control rooms](https://commons.wikimedia.org/wiki/Category:Video_monitors_in_control_rooms),
  [Video surveillance](https://commons.wikimedia.org/wiki/Category:Video_surveillance),
  [Video walls](https://commons.wikimedia.org/wiki/Category:Video_walls).
- Vestiaires : [Code du travail, R4228-2](https://code.travail.gouv.fr/code-du-travail/r4228-2),
  [Légifrance, vestiaires collectifs](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000018489211/),
  [pointeuse à râteliers (photo)](https://www.5francs.com/deco-industrielle/ancienne-pointeuse-porte-fiches/),
  [souvenir d'usage d'une pointeuse](http://lescheminsdefanou.eklablog.com/ancienne-pointeuse-d-usine-a115284338) ;
  Commons : [Locker rooms](https://commons.wikimedia.org/wiki/Category:Locker_rooms),
  [Lockers](https://commons.wikimedia.org/wiki/Category:Lockers),
  [Changing rooms](https://commons.wikimedia.org/wiki/Category:Changing_rooms),
  [Shower rooms](https://commons.wikimedia.org/wiki/Category:Shower_rooms).
- Compacteur : [Solen, presses à balles verticales](https://www.solen.fr/produits/presses-a-balles-verticales-simple-chambre/),
  [ETC Compact, presses horizontales](https://www.etc-compact.com/presses-a-balles-horizontales) ;
  Commons : [Industrial balers](https://commons.wikimedia.org/wiki/Category:Industrial_balers),
  [Compactors](https://commons.wikimedia.org/wiki/Category:Compactors),
  [Dumpsters](https://commons.wikimedia.org/wiki/Category:Dumpsters),
  [Pallets](https://commons.wikimedia.org/wiki/Category:Pallets).
- SAV : Commons [Electronics repair](https://commons.wikimedia.org/wiki/Category:Electronics_repair),
  [Workbenches](https://commons.wikimedia.org/wiki/Category:Workbenches),
  [Television sets](https://commons.wikimedia.org/wiki/Category:Television_sets).

## 7. Ce qui n'a pas été vérifié

- **Aucune image n'a été ouverte.** Les pages citées existent (vérifiées le
  2026-09-26, sauf mention), mais les descriptions viennent de leur texte.
  Les palettes de la section 3 sont donc proposées, pas mesurées ; la clé,
  le contraste et la couleur d'ennemi recommandée restent à extraire
  (`extract_palette.py`) sur un dossier `refs/coulisses/`.
- **Guides de niveau bloqués** : le wiki Duke (Fandom, 402), StrategyWiki
  (403), le site 3D Realms (DNS) et GameFAQs (403) n'ont pas pu être lus.
  Les faits de Duke viennent de l'Informational Suite et de résumés de
  recherche ; Stadium et Fusion Station ne sont pas étudiés. La disposition
  exacte d'Hollywood Holocaust (quelle fenêtre donne sur quoi) est à
  confirmer sur une vidéo avant d'en tirer une cote.
- **Carsat Aquitaine** (le Leclerc réel) : connexion refusée ; les trois
  faits cités (rail au plafond, châssis vitrés, chariot trois palettes,
  allées de 3,10 m) viennent des extraits du moteur de recherche.
- **Le SAV** n'a aucune source solide : sa fiche est une reconstitution.
- **Le fournil vitré côté magasin** est une pratique courante mais non
  confirmée ici par une photo.
- **Rien n'a été mesuré dans le jeu** : faisabilité de la gaine (saut depuis
  un chariot), coût en lots des carcasses, des vitres ajoutées et des
  écrans, bande libre derrière l'électroménager pour l'option A du SAV.
