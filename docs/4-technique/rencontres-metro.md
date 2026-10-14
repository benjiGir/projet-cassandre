---
title: Rencontres du métro
tags: [metro, ennemis, script]
status: brouillon
updated: 2026-10-14
---

# Rencontres du métro

Première implantation jouable, à ajuster au playtest. Elle utilise les
Costards, Vigiles et Rampants, avec le Contrôleur et son chef de brigade.
Quatre secrets complètent le parcours. Les bornes et l'équilibrage final
restent ouverts ; N7 n'est pas clôturé.

## Parcours et effectifs

Les effectifs appliquent les règles existantes de difficulté, groupe par
groupe : moitié / trois quarts / totalité, arrondi au plus proche, minimum
un. Les gardes sont dans leurs propres groupes pour rester présents en Client.

| Rencontre | Rôle | Client | Habitué | Lanceur d'alerte |
|---|---|---:|---:|---:|
| Quartier | Costards devant les façades, après les premiers soins | 2 | 2 | 3 |
| Billetterie | Tireurs côté ouest, Vigile derrière les portiques | 3 | 4 | 4 |
| Quai sud | Tireurs sur les deux quais | 3 | 3 | 4 |
| Quai nord | Deuxième ligne de tireurs, garde du passage de maintenance | 3 | 4 | 4 |
| Galerie, entrée | Rampants au-delà du premier seuil | 1 | 2 | 2 |
| Galerie, coude | Meute au-delà de la distribution technique | 2 | 2 | 3 |
| Galerie, retour | Meute avant le retour au tunnel | 2 | 3 | 3 |
| Dépôt | Tireurs dans le hall, garde du chemin d'embarquement | 5 | 5 | 7 |
| Accès au poste | Vigile dans le passage ouest ; cabine et escalier libres | 1 | 1 | 1 |
| Machinerie | Tireurs sur le pourtour, puis deux Rampants | 3 | 5 | 5 |
| Rame, première vague | Rampants après 10 secondes de voyage | 2 | 3 | 3 |
| Rame, seconde vague | Rampants après 30 secondes de voyage | 4 | 4 | 5 |
| Quai privé | Costards activés à l'arrivée effective | 1 | 2 | 2 |
| Parvis | Tireurs sur les côtés, Vigile devant l'entrée de la tour | 3 | 3 | 4 |
| **Total du parcours** | | **35** | **43** | **50** |

Le GLB contient 58 marqueurs : les deux vagues possèdent chacune une
implantation nord et sud, mutuellement exclusives. À chaque vague, le
contrôleur choisit l'extrémité opposée à la moitié de rame occupée par le
joueur. Les marqueurs de l'autre implantation ne sont pas réveillés.

Les déclencheurs ordinaires sont sur le parcours, avant les positions de
combat. Aucun ennemi n'est placé dans un gabarit ferroviaire, la cabine du
guichet, une volée d'escalier ou la fosse de la machinerie. Les petits locaux
et les tunnels conservent des pauses. La progression n'exige pas de tuer
tous les ennemis et ne ferme aucune nouvelle porte d'arène.

## Contrôleurs et chef de brigade

La partie réveille neuf Contrôleurs en Client et Habitué, dix en Lanceur
d'alerte, plus un chef. Quatorze marqueurs décrivent ces rencontres, dont
six pour les extrémités alternatives des deux vagues. Le premier est dans
la billetterie, sur sol plat loin des voies. Un Contrôleur attend sur chaque
quai, un dans la galerie de retour, deux ou trois au dépôt, un sur le
pourtour sud de la machinerie. Il n'y en a aucun dans les tunnels. Un entre
à chaque vague de la rame ; le chef accompagne la seconde.

La config `src/game/entities/controller/controllerConfig.ts` reprend les
valeurs de départ du plan : signal de 0,8 s, 16 m/s, 12 m, projection de
5 m en 0,5 s, récupération de 1 s. La direction est figée au signal ; les
commandes du joueur restent actives. Le Contrôleur a 70 PV et inflige 5 PV
avant difficulté. Le chef a 210 PV, une casquette galonnée et deux charges
avec une nouvelle anticipation entre elles. Pas de barre de boss.

Une balle ne casse pas la charge. Un impact de pompe à moins de 3 m
interrompt son anticipation ou sa charge, même non mortel. Les coups et
explosions restent mortels ; un souffle interrompt aussi la charge. Les
murs, un appui absent ou une dénivellation supérieure à 55 cm interrompent
l'élan. Les volumes `nav_voie_*` le limitent aux traversées désignées.
Le KCC résout toutes les collisions, y compris la projection du joueur.

L'alerte est une interpellation vocale synthétique ; le signal est un sifflet
court. Le sprite audio séparé est chargé et préparé au démarrage.
Les sons d'impact, de douleur et de mort reprennent le catalogue existant.
L'interpellation n'est pas une phrase parlée enregistrée. Les répliques
spécifiques du héros sont textuelles en attendant les prises de voix.

`SessionStats` expose `controllerHits`, `controllerPushesToRail` et
`controllerTrainKills`, avec `controleur` comme source de dégâts. Une
projection suivie d'une entrée sur voie dans les 0,8 s est comptabilisée.
Le direct récompense davantage un Contrôleur fauché par une rame : audience
×2 et dons de 2/5/10 euros, contre audience ×1 et 1/2/5 euros pour un kill
ordinaire. Ces valeurs restent à régler en jouant.

La console expose `cassandre.spawnControleur(x, piedsY, z, chef)` et
`cassandre.controleur` (config, charge, variantes A/B/C). Les coordonnées
d'apparition sont celles de Three.js ; `cassandre.tp` utilise celles de Blender.
La pose locale se rejoue avec `C.metro_controleurs()` : elle ne reconstruit
pas le décor et utilise les mêmes positions que le générateur complet.

## Ressources

Les dix-huit ramassages donnent **225 PV de soins**, **168 balles de
pistolet** et **40 cartouches de pompe**, distribués entre rue, billetterie, vestiaire,
entrée du dépôt, machinerie, rame et sortie sur le parvis. Les premiers
soins sont dans la rue, avant le premier déclencheur. Ils restent des
trousses pour cette passe ; la nourriture prévue dans le plan,
bornes, armes et l'économie finale restent à traiter.

Ces totaux sont des ressources posées : les plafonds du joueur peuvent en
réduire le gain effectif. Les munitions `use_*.munitions` rechargent le
pistolet ; `use_*.cartouches` recharge le pompe. Les cinq boîtes rouges
contiennent 8 cartouches chacune : billetterie, vestiaire, dépôt, machinerie
et rame. Elles se distinguent des boîtes olive du pistolet par leur taille,
leur bande claire « 12 » et leur motif de cartouches rouges à culot doré.
La campagne conserve l'équipement du niveau précédent ;
le lancement isolé de la page d'auteur ne prouve pas l'équilibre d'une
arrivée pauvre ou riche.

Le pistolet de détresse se trouve dans le métro (`use_flare`) : au sol devant
l'établi de la première galerie de service (X 19,05 / Y 215), sous sa lampe de
travail, sur le chemin obligé et quatre mètres avant la première meute de
Rampants. Il donne 6 fusées. Trois étuis `use_*.fusees` de 4 fusées le
rechargent, au dépôt, dans la machinerie et dans la rame : 18 fusées en tout,
le plafond de l'arme. Une arme au sol n'est pas dans `PICKUPS` mais dans
`WEAPONS` : le jeu la reconnaît à son nom exact, sans propriété.

`tools/metro/blockout/refresh_weapon_pickups.py` pose ces quatre objets sur le
`.blend` livré, avec le même contrôle d'appui et de dégagement que la
construction, sans reconstruire tout le parcours :

```bash
blender -b assets_src/blender/metro_blockout.blend -P tools/metro/blockout/refresh_weapon_pickups.py
```

Chaque marqueur de ramassage porte son origine au centre de sa boîte, à
16 cm au-dessus du sol prévu. La géométrie est ramenée dans son repère
local : `buildUseObjectEffect` lit cette origine mondiale pour le ramassage,
alors que le rendu des trousses et boîtes se place depuis leurs bounds.
Une boîte construite en coordonnées monde avec une origine à zéro serait
visible au bon endroit et impossible à ramasser en passant dessus.

## Secrets

Quatre détours facultatifs portent un volume `secret_*`. Entrer dans une
cache déclenche le compteur, le son de découverte, le retour de stream et
une réplique propre, en texte seul. Revenir dans la même cache ne la compte
pas une seconde fois. Les récompenses utilisent les ramassages existants.

| Cache | Accès et indice | Récompenses |
|---|---|---|
| Atelier du quartier | Rideau ATELIER, poussoir sur le jambage, éclairage intérieur | 25 PV, 24 balles |
| Archives Sang-Froid | Bouton au fond d'un casier ouvert du local des agents ; armoire pivotante | 36 balles, 4 fusées |
| Toit de la rame de fret | Escalier de maintenance, marquise puis toiture de la rame déjà posée | 25 PV, 16 cartouches |
| Local d'entretien | Grille ouvrable au-delà de la ventilation, commande sur le mur latéral | 50 PV, 12 cartouches |

Les huit récompenses ajoutent 100 PV, 60 balles, 28 cartouches et 4 fusées
aux ressources du chemin principal. Ce sont des quantités posées ; les
plafonds d'inventaire limitent les gains effectifs. Aucune progression
obligatoire ne demande un secret.

La station abandonnée prévue dans le premier plan devient un local
d'archives derrière le vestiaire existant. L'accès au toit réutilise la
rame de fret sur sa voie actuelle : aucune rame ni voie isolée n'est ajoutée.
Les trois portes restent ouvertes après leur première activation, pour
laisser revenir chercher une boîte quand l'inventaire n'est plus plein.
Les murs et portes fermées bloquent l'attraction des récompenses, même avec
Aimant. Le volume du toit couvre le palier supérieur, la marquise, la
passerelle et toute la zone praticable de toiture ; sa limite basse exclut
l'intérieur de la rame.

`tools/metro/blockout/secrets.py` est commun à la reconstruction et à
`C.metro_secrets(apercus=False)`. La pose locale réutilise les textures de
la DA, découpe le mur des archives et contrôle dix appuis/dégagements ainsi
que les huit appuis des ramassages avant de sauvegarder. Les volumes de
secret restent alignés aux axes ; leur origine et leur géométrie sont
cohérentes avec le chargement glTF. Le cadre des archives utilise quatre
proxies séparés : un seul hull convexe reboucherait son ouverture dans Rapier.
Une partie complète reste à jouer pour
régler les indices et les quantités.

La revue locale du 14 octobre couvre les commandes, le passage des archives
dans les deux sens, l'escalier et les découvertes jusqu'à 4/4. Compilation
et liens documentaires passent. Le contrôle strict du niveau reste en
échec sur 85 erreurs de colliders existants ; les nouveaux objets de secret
ne présentent plus d'erreur de contrat. Cette revue ne clôture pas N7/N8.

La contre-revue relève puis corrige deux P2 : l'attraction à travers le
rideau fermé, et un volume de toit qui excluait ses bords. Avec Aimant,
soins et balles restent en place derrière le rideau (80 PV, 65 balles) ; les
balles montent à 89 après ouverture, puis les PV à 100 à l'intérieur.
Sous la toiture, les ressources restent bloquées
et aucun secret ne se déclenche. Sur son bord est, découverte, soins et
cartouches fonctionnent ; la marquise déclenche également la découverte.
Le pistolet de détresse reste ramassable dans la galerie.
L'agent QA valide les corrections statiquement ;
ces observations locales ne remplacent pas une partie complète.

## Contrats et fichiers

| Responsabilité | Fichier |
|---|---|
| Positions, volumes et ramassages Blender | `tools/metro/blockout/encounters.py` |
| Caches, accès et récompenses de secret | `tools/metro/blockout/secrets.py` |
| Contrôle des appuis et dégagements à la construction | `inspect_positions` dans ce même module |
| Scénarios, délais et annonces | `src/game/level/blockout/metroEncounterEvents.ts` |
| Choix des deux extrémités et événement d'arrivée | `src/game/level/blockout/metroBlockout.ts` |
| Catalogue `metro` et `blockout_metro` | `src/game/level/catalog/levels.ts` |
| Lancement spatial ou explicite d'un scénario | `src/game/level/scripting/levelScript.ts` |
| Réveil, difficulté et alerte | `src/game/session/progression/levelScriptActions.ts` |
| Alerte après matérialisation | `src/game/entities/suit/suit.ts` |
| Liaison au pas fixe | `src/game/loop/updateGameplay.ts` |
| Reconnaissance des événements et groupes à l'export | `tools/blender/validate_level.py` |

Les `spawn_*` portent `groupe`, les douze `trig_*` portent `evenement`.
Un groupe ne se réveille qu'une fois par partie : les deux entrées de la
machinerie partagent la même rencontre. Tous les réveils utilisent l'effet
d'apparition TSL existant. Les annonces de cette passe sont textuelles.

Les vagues sont comptées par le temps de simulation du voyage, sans temps
mural. Elles sont annoncées 0,25 seconde avant le réveil et ne partent que
si le joueur est à bord. Le bitmask `rideWaves` survit au hot reload avec
l'état du voyage ; les événements lancés et les groupes réveillés sont
conservés par l'état du script de niveau.

`reveiller.alerte` demande une alerte unique une fois la matérialisation
terminée. Le Rampant entre ensuite dans sa machine habituelle de poursuite :
il peut rejoindre un joueur qui reste à plus de sa portée de perception à
l'autre bout de la rame. La télégraphie et les pertes de contact ordinaires
restent actives. Le mode auteur `notarget` coupe cette poursuite.

## Revue locale et limites

Le relevé régénéré dans `renders/reviews/blockout-metro/rencontres.json`
donne les positions Blender, les déclencheurs et les appuis contrôlés sur
les colliders réels. Deux positions initiales trop proches du mobilier du
quartier et d'un mât du parvis ont été déplacées. Les capsules utilisent
les rayons réels de chaque espèce. Ce contrôle de placement ne prouve pas
qu'un chemin reste franchissable pendant un combat.

La page d'auteur temporaire a été retirée après la passe de création.
Pour reprendre la revue, utiliser les commandes de la
[console cassandre](../6-reference/console-cassandre.md). Suspendre le trafic
avant une téléportation sur une voie. Le relevé distingue `arme`, `munitions`
et `cartouches`.

Les [observations datées](../journal/metro-blockout-2026-10.md#première-passe-de-rencontres-9-octobre)
distinguent placement, déclenchement et poursuite observée. La compilation
de production passe ; aucune suite de tests n'a été lancée. Une partie
complète avec combats, les profils d'arrivée pauvre et riche, le réglage
des ressources et la variante nord des vagues restent à juger.
