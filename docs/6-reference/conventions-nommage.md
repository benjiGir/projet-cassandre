---
title: Conventions de nommage glTF
tags: [reference, pipeline]
status: brouillon
updated: 2026-09-26
---

# Conventions de nommage glTF

Le loader interprète les noms et les propriétés glTF comme un contrat de gameplay. Activez l'export des propriétés personnalisées. Les noms sans préfixe de gameplay sont rendus comme décor.

## Préfixes d'objets

| Nom | Effet à l'import |
|---|---|
| `col_box_*` | Collider cuboïde ; le mesh source devient invisible. |
| `col_hull_*` | Collider convexe ; mesh invisible. |
| `col_mesh_*` | Trimesh statique ; usage rare à justifier. |
| `spawn_player` | Point de départ du joueur ; un seul par niveau. |
| `spawn_suit_*` | Point d'apparition d'un Costard. |
| `spawn_director_*` | Point d'apparition du Directeur. |
| `trig_*` | Volume de trigger. |
| `use_*` | Objet actionnable à portée de 2 m, ou ramassage spécialisé selon ses extras/nom. |
| `light_*` | Empty converti en `THREE.PointLight`, activée selon le pool du niveau. |
| `secret_*` | Zone de présence comptée comme secret. |
| `door_*` | Vantail animé ; le collider est actif uniquement quand la porte est fermée. |
| `prop_*` | Mobilier dynamique Rapier, poussable et cassable si `pv` est défini. |
| `vitre_*` | Panneau vitré ; collision activée sauf `solide: false` ; cassable si PV définis. |
| `sanitaire_*` | Cuvette ou urinoir utilisable et cassable. |
| `ecran_*` | Mesh à un matériau ; `chaine` choisit la boucle affichée. |
| `cam_*` | Empty désignant un point de vue fixe pour la vidéosurveillance. |

Les préfixes sont reconnus au début du nom. L'export glTF doit préserver un mesh à un seul matériau pour les préfixes dont le système attend un mesh unique. Aucun `col_*` jumeau pour un `prop_*` ou un `sanitaire_*`.

## Propriétés personnalisées

| Propriété | Objet | Valeurs ou sens |
|---|---|---|
| `target` | `use_*` | Nom du `door_*` actionné. |
| `card` | `use_*` | Carte donnée : `argent`, `or` ou `platine`. |
| `requires` | `use_*` | Carte exigée pour activer `target`. |
| `message` | `use_*` | Message d'une porte libre, sans `requires`. |
| `soin` | `use_*` | Nombre de PV rendus par une trousse. |
| `aliment` | `use_*` | Type de nourriture ; le runtime en déduit le soin. |
| `munitions` | `use_*` | Quantité de munitions de pistolet donnée. |
| `cameras` | `use_*` | Noms de `cam_*` séparés par des virgules, dans l'ordre de défilement. |
| `color`, `intensity`, `distance`, `decay` | `light_*` | Couleur hexadécimale et paramètres de portée/intensité de la lampe. |
| `secret_id` | `secret_*` | Identifiant stable du secret. |
| `masse`, `pv`, `matiere`, `contenu` | `prop_*` | Masse en kg (défaut 25), PV optionnels, matière de casse et contenu lâché. |
| `mouvement`, `groupe`, `auto`, `manuelle`, `charniere`, `sens` | `door_*` | Mouvement et configuration du vantail, de l'ouverture auto et de l'action manuelle. |
| `angle`, `course`, `duree`, `portee`, `delai`, `referme` | `door_*` | Géométrie et temporisation de l'ouverture ou de la refermeture. |
| `pv`, `solide`, `givre` | `vitre_*` | Vie, présence d'un collider et effet de givre à la casse. |
| `sorte`, `pv` | `sanitaire_*` | `sorte` est obligatoire : `cuvette` ou `urinoir`. PV facultatifs. |
| `chaine`, `pv` | `ecran_*` | Boucle visuelle obligatoire à la validation et PV optionnels. |
| `nom` | `cam_*` | Libellé affiché pendant la vue caméra ; facultatif, mais un nom est recommandé. |

Le validateur bloque les valeurs qu'il contrôle. Les propriétés reconnues dont
le loader traite explicitement une valeur invalide produisent aussi un
avertissement et retombent sur le comportement documenté. Une propriété glTF
inconnue n'est pas nécessairement signalée ; seuls les extras reconnus ont un
effet.

Ajouter une nouvelle catégorie de carte exige de mettre à jour ensemble
`src/game/player/loyaltyCards.ts` (liste, type et libellé),
`src/game/level/loader.ts` (lecture de `card` et `requires`),
`tools/blender/validate_level.py` (valeurs acceptées), les types et règles de
session concernés, leurs tests et cette référence. Le validateur ne peut pas
détecter une faute de frappe dans un extra qu'il ne connaît pas.

Le validateur couvre notamment les cartes, les aliments, les montants `soin`
et `munitions`, les matières et contenus de prop, les valeurs de porte, la
chaîne d'écran, les caméras référencées et la sorte de sanitaire. Certaines
options facultatives de porte sont lues avec un défaut par le runtime ; une
valeur mal formée peut donc retomber sur ce défaut.

## Cartes et objets automatiques

| Besoin | Contrat |
|---|---|
| Donner une carte Argent ou Or | `use_*` + `card`, sans cible. La Platine est lâchée par le Directeur. |
| Verrouiller une porte | `use_*` + `target` + `requires`. |
| Porte libre | `use_*` + `target`, sans `requires` ; `message` facultatif. |
| Trousse | `use_*` + `soin` strictement positif ; ramassage au contact. |
| Nourriture | `use_*` + `aliment` reconnu ; ramassage au contact. |
| Munitions | `use_*` + `munitions` strictement positif ; ramassage au contact. |
| Arme au sol | Noms réservés `use_crowbar`, `use_pistol`, `use_shotgun` ; ramassage au contact. |
| Console vidéo | Un `use_*` avec `cameras` référençant des noms `cam_*` existants. |

Un objet peut porter un `use_*` sans cible lorsqu'il possède un comportement dédié. Un usage manuel standard choisit l'objet visible le plus proche dans la portée.

Deux noms historiques ont un comportement dédié sans extra : `use_pa_mic`
déclenche une réplique du héros ; `use_toilet` suit la règle de sanitaire
historique. Le système de surveillance est déclaré par `cameras`, quel que
soit le nom du `use_*`.

### Nourriture

`aliment` accepte `donut` (+5 PV), `sandwich` (+10), `jambon` (+15),
`poulet` (+25) et `pizza` (+25). Un `soin` explicite reste prioritaire si les
deux propriétés sont présentes. Ces ramassages se font au contact.

Un `prop_*` peut porter `contenu` au format `nom:nombre`, par exemple
`donut:2`. La syntaxe est validée ; les noms d'objets inconnus du runtime ne
produisent pas de ramassage.

## Portes, props, vitrages et sanitaires

Les mouvements de porte reconnus sont `battant`, `coulisse`, `monte` et `descend`. Les portes auto peuvent se déclencher pour tout le monde ou seulement les ennemis ; une porte `manuelle: "fermer"` se commande uniquement pour se refermer. `groupe` synchronise plusieurs vantaux. Voir [ADR 0031 — Portes animées et vitres](../decisions/0031-portes-animees-et-vitres.md).

Les extras de porte sont `mouvement`, `charniere` (`min`/`max`), `sens`
(`auto`/`+`/`-`), `auto` (`true`/`ennemis`), `manuelle` (`true`/`fermer`),
`angle`, `course`, `duree`, `portee`, `delai`, `referme` et `groupe`.
`mouvement` choisit l'un des quatre types ci-dessus. Les autres valeurs
manquantes utilisent les défauts du runtime ; le validateur peut bloquer une
valeur incorrecte avant export.

Pour un prop, `masse` est en kilogrammes (25 par défaut). `pv` absent signifie indestructible ; `matiere` détermine son effet de casse. Le groupe de collision du prop est séparé du monde fixe.

Pour une vitre, `solide: false` supprime le collider. Sans `pv`, elle ne casse pas. `givre: true` active l'effet de givre à sa destruction.

Un sanitaire est un mesh unique avec un matériau unique et une valeur `sorte` obligatoire. Le loader crée son collider. Le geste d'usage exige de viser l'appareil intact ou le jet d'eau d'un appareil cassé.

Les valeurs de `chaine` pour un `ecran_*` sont `journal`, `pub`, `mire`,
`foot` et `cctv`. L'absence ou l'invalidité déclenche un avertissement du
loader, qui retombe sur `mire` ; le validateur de niveau exige une valeur
connue. La casse est un état interne, pas une valeur à exporter.

Les matières de `prop_*` sont `bois`, `carton`, `verre`, `metal`, `farine`,
`eau` et `electronique`. Elles règlent le son et la couleur des débris ; la
masse contrôle la physique.

Un `light_*` est un Empty. Ses extras facultatifs sont `color`,
`intensity`, `distance` et `decay`. Le loader utilise `#ffffff`, 8, 12 et 2
si ces valeurs manquent ; le helper du niveau v2 écrit par défaut `#dceeff`,
6, 12 et 2. La lampe Three.js reste rattachée au niveau ; le pool choisit
les lampes allumées.

## Références de construction

Les unités sont en mètres. La grille fine vaut 0,25 m, la grille standard 1 m, le module de kit 2 m et la densité de texture cible 64 px/m. Le jeu utilise une portée d'usage générale de 2 m ; les sanitaires ont un contrat de visée plus court.

Voir [Chargement de niveau](../4-technique/chargement-de-niveau.md), [Systèmes de niveau](../4-technique/systemes-de-niveau.md), [ADR 0030 — Props dynamiques](../decisions/0030-props-dynamiques.md) et [ADR 0032 — Sanitaires utilisables](../decisions/0032-sanitaires-utilisables.md).
