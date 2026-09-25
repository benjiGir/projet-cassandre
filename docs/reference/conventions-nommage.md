---
title: Conventions de nommage
tags: [reference, pipeline]
status: stable
updated: 2026-09-24
---

# Conventions de nommage

Contrat entre Blender et le loader runtime. Un mesh sans préfixe est rendu tel
quel, **sans collider**, silencieusement — c'est le comportement voulu.

## Préfixes glTF

| Préfixe | Effet à l'import |
|---|---|
| `col_box_*` | cuboid — voir [ADR 0004](../decisions/0004-colliders-cuboid.md) |
| `col_hull_*` | convexHull |
| `col_mesh_*` | trimesh + `FIX_INTERNAL_EDGES`, à justifier |
| `col_*` | détection automatique, mesh rendu invisible |
| `spawn_player` | position et orientation de départ — exactement un |
| `spawn_suit_*` | point d'apparition Costard |
| `spawn_director_*` | point d'apparition Directeur (boss unique) |
| `trig_*` | volume de trigger, box, sensor |
| `door_*` | porte ANIMÉE (voir plus bas) — corps FIXE à la pose fermée, collider actif seulement fermé, mesh piloté par `DoorSystem` |
| `use_*` | objet interactif, portée d'usage 2 m |
| `secret_*` | zone comptée dans le compteur de secrets |
| `prop_*` | mobilier physique : corps dynamique libre, poussable et cassable |
| `vitre_*` | vitrage (voir plus bas) — collider cuboid tant que `solide !== false`, cassable si `pv` |
| `sanitaire_*` | cuvette ou urinoir UTILISABLE (voir plus bas) — collider cuboid toujours actif, cassable si `pv` |
| `kit_*` | pièce du kit modulaire |

Blender suffixe automatiquement les doublons (`col_wall.001`). Toute regex de
validation doit tolérer `.NNN`.

## Custom properties

Transportées dans `mesh.userData` via les `extras` glTF. Cocher **Custom
Properties** à l'export, sinon tout le paramétrage est perdu silencieusement.

| Propriété | Sur | Sens |
|---|---|---|
| `target` | `use_*` | nom de l'objet actionné (un `door_*`) |
| `card` | `use_*` | carte de fidélité DONNÉE par cet objet — en fait un ramassage |
| `requires` | `use_*` | carte EXIGÉE pour agir sur `target` |
| `message` | `use_*` | texte affiché quand une porte LIBRE s'ouvre (voir plus bas) |
| `soin` | `use_*` | PV rendus — une trousse, ramassée en marchant dessus |
| `munitions` | `use_*` | munitions de pistolet rendues — une boîte, ramassée en marchant dessus |
| `secret_id` | `secret_*` | identifiant du secret |
| `door_hp` | `door_*` | points de vie si destructible |
| `masse` | `prop_*` | masse en kg (défaut 25) |
| `pv` | `prop_*` | points de vie — **absent = indestructible** |
| `matiere` | `prop_*` | `bois`, `carton`, `verre` ou `metal` |
| `sorte` | `sanitaire_*` | `cuvette` ou `urinoir` — **OBLIGATOIRE**, voir plus bas |
| `pv` | `sanitaire_*` | points de vie — absent = incassable AU TIR DU JOUEUR (reste utilisable et cassable d'un coup par un tir ennemi) |

La propriété s'appelle bien `target`, pas `use_target` : c'est le nom que
`loader.ts::buildUseObject` lit dans `extras`. (Cette table a porté
`use_target` jusqu'au jalon N7 — un nom qui ne correspondait à rien côté
runtime.)

### Cartes de fidélité

Les clés du niveau v2, à la place du badge unique du Directeur. Trois
valeurs, et rien d'autre : **`argent`**, **`or`**, **`platine`**. La lecture
tolère la casse et les espaces (`"Or "` marche), jamais un synonyme.

| Ce qu'on veut | Comment on l'écrit |
|---|---|
| Une carte à ramasser | un `use_*` avec `card = "argent"`, sans `target` |
| Une porte qui exige une carte | un `use_*` avec `target = "door_xxx"` **et** `requires = "argent"` |
| Une porte sans condition | un `use_*` avec `target` seul, et un `message` facultatif |

### Portes libres

Un `use_*` qui porte `target` sans `requires`, et dont le nom n'est réclamé
par aucun cas historique (`use_frozen_storage`, `use_exit_door`), ouvre sa
porte sans condition et affiche son `message` (« Passage ouvert » à défaut).
Jamais consommé : un second appui sur une porte déjà ouverte ne fait rien.
Le niveau v2 en a deux :

- **le photomaton** de la galerie (`use_photomaton`, caché DANS son caisson)
  efface le pan de mur voisin (`door_secret_photomaton`), vers le secret 1 ;
- **la porte coupe-feu** du couloir de service (`use_coupe_feu`) rouvre le
  raccourci vers les rayons.

**Une porte à sens unique n'a pas de propriété dédiée** : c'est la place de
son `use_*` qui fait le sens unique. Le bouton de la porte coupe-feu est à
2,9 m de tout point du côté rayons, au-delà de la portée d'usage (2 m) ; on ne
peut donc l'ouvrir que du côté du personnel. Une fois ouverte, elle le reste.
Le plan de masse le déclare dans `PORTES_SENS_UNIQUE`, pour que son contrôle
de connectivité le sache.

Deux garde-fous, parce qu'une faute de frappe ouvrirait la porte à tout le
monde en silence : `validate_level.py` en fait une **erreur** avant l'export,
et `loader.ts` un **avertissement bruyant** au chargement, la propriété étant
alors ignorée.

La carte **Platine** n'a pas de `use_*` : le Directeur la lâche à sa mort
(`DIRECTOR_DROPPED_CARD`, `game/entities/directorConfig.ts`), ramassée par
simple proximité. Côté jeu, l'inventaire vit dans `session.cards` et se
consulte en console avec `cassandre.cards()` / `cassandre.giveCard("or")`.

### Trousses de soin

Un `use_*` avec `soin = 25` (des PV, un nombre strictement positif), sans
`target`. Contrairement aux autres `use_*`, **il se ramasse en marchant
dessus**, pas à la touche E : à moins de 1,2 m du centre du joueur
(`HEAL_PICKUP_RADIUS`, `game/level/interactive.ts`). Un joueur qui a déjà tous
ses PV la laisse au sol, pour plus tard.

La boîte du `.glb` ne sert qu'à situer l'objet : le jeu la remplace par une
trousse blanche à croix verte de pharmacie, posée sur le sol réellement sous
elle (`render/pickups.ts`). La croix rouge est un emblème protégé, d'où la
verte.

Mêmes garde-fous que les cartes : **erreur** de `validate_level.py`,
**avertissement bruyant** du loader. Au niveau v2, les trousses se déclarent
dans le plan de masse (`tools/level_v2/plan_de_masse.py`), avec leurs PV dans
le libellé : `("trousse de soin +25", x, y, "soin")`. Pour les inspecter en
console : `cassandre.heals()`, où `object.visible: false` signale une trousse
déjà ramassée.

**Piège de placement** : le point d'apparition d'un ennemi n'est pas un sol
libre garanti, un Costard peut démarrer collé à un rack. Vérifier l'emplacement
d'une trousse contre le décor après construction, pas seulement contre le plan.

### Boîtes de munitions

Un `use_*` avec `munitions = 24`, sans `target`. Mêmes règles que les
trousses de soin ci-dessus : ramassage **en marchant dessus** dans un rayon de
`HEAL_PICKUP_RADIUS`, boîte du `.glb` remplacée par le vrai modèle
(`render/pickups.ts`), erreur de `validate_level.py` et avertissement bruyant
du loader sur une valeur qui n'est pas un nombre strictement positif.

Elles ne rechargent que le **pistolet** : le pompe garde sa dotation unique
(voir [Armes du joueur](../systems/armes.md#pistolet-2026-09-16)). Une boîte
prise alors que le joueur est au plafond de munitions reste au sol. En
console : `cassandre.ammo()`.

Dans le niveau v2, elles se déclarent au plan de masse comme les trousses,
quantité dans le libellé : `("boîte de munitions +24", x, y, "munitions")`.

### Props physiques

Un `prop_*` est un **corps dynamique libre** : il tombe, il se pousse, et il se
casse s'il a des `pv`. C'est le seul préfixe dont l'objet bouge réellement en
jeu — un `door_*` est dynamique mais verrouillé, tout le reste est fixe.

| Ce qu'on veut | Comment on l'écrit |
|---|---|
| Un obstacle qu'on bouscule | un `prop_*` avec `masse` seule |
| Une caisse qu'on casse au tir | un `prop_*` avec `masse`, `pv` et `matiere` |
| Une vitrine qui vole en éclats | un `prop_*` avec `pv` bas et `matiere = "verre"` |

Le collider est le **cuboid de la boîte englobante**, comme pour `col_box_*` —
une forme qui n'est pas une boîte sera silencieusement approximée, et
`validate_level.py` le signale. Un `prop_*` **ne porte jamais de `col_*`
jumeau** : il construit son propre collider, et un collider statique posé
par-dessus le figerait dans le décor (erreur de `validate_level.py`).

Trois choses qu'il faut savoir avant d'en poser un :

1. **Ce qui coûte, c'est la DENSITÉ locale, pas le nombre total.** Un prop dans
   les 36 m du joueur est un lot de dessin de plus, définitivement : un objet
   qui bouge ne rejoint jamais un lot de décor fusionné
   ([ADR 0023](../decisions/0023-fusion-decor-au-chargement.md)). Au-delà de
   36 m il n'est plus dessiné du tout. Les 51 props du niveau v2, étalés sur
   ses dix espaces, coûtent 6 à 8 lots selon le point de vue — un tas de
   cinquante props dans une même pièce en coûterait cinquante.
2. **Un prop ne protège pas.** Il n'entre ni dans les lignes de vue ennemies ni
   dans le graphe de navigation, et les balles ennemies le traversent — voir
   [ADR 0030](../decisions/0030-props-dynamiques.md) pour pourquoi.
3. **Un prop encastré dans le décor ne reste pas encastré**, il est éjecté au
   premier pas de simulation. Lancer `tools/level_v2/audit_niveau.py` après
   chaque construction : il connaît le préfixe et détecte l'encastrement.

Côté Blender, `lib_helpers.prop(...)` fait le travail (pas de subdivision : un
prop qui bouge ne peut porter aucune couleur d'éclairage cuite). En console :
`cassandre.props.liste()` et `cassandre.props.casser("prop_caisse_rs0")`.

### Portes animées

Un `door_*` reste un corps Rapier **FIXE, à la pose FERMÉE, pour toujours** —
seul le collider s'active/se désactive (actif SEULEMENT quand le vantail est
complètement fermé), seul le mesh bouge (`game/level/doors.ts::DoorSystem`,
reconstruit à chaque chargement comme un `PropSystem`). Aucune capsule de
personnage ne peut donc rester coincée dans un vantail en mouvement : du
point de vue de la physique, une porte est ouverte ou fermée, jamais « à
moitié ». Voir [ADR 0031](../decisions/0031-portes-animees-et-vitres.md)
pour la cause racine (aucune porte ne bougeait à l'écran avant ce jalon) et
pourquoi ce modèle remplace l'ancien collider non recentré
([ADR 0012](../decisions/0012-porte-collider-non-recentre.md)).

Toutes les extras suivantes sont **optionnelles** :

| Propriété | Sens | Défaut |
|---|---|---|
| `mouvement` | `"descend"`, `"monte"`, `"battant"` ou `"coulisse"` — voir ci-dessous | `"descend"` |
| `charniere` | (`battant`) `"min"` ou `"max"` : quelle extrémité du grand axe horizontal LOCAL porte la charnière | `"min"` |
| `angle` | (`battant`) amplitude d'ouverture, degrés | `95` |
| `sens` | (`battant`) `"auto"`, `"+"` ou `"-"` ; (`coulisse`) `"+"` ou `"-"` (pas d'`"auto"`) | `"auto"` (battant), `"+"` (coulisse) |
| `course` | (`coulisse`/`monte`/`descend`) distance parcourue, mètres | longueur du vantail (coulisse) ou sa hauteur (monte/descend) |
| `duree` | secondes d'ouverture | `0.5` battant, `0.45` coulisse, `1.4` monte, `0.6` descend |
| `auto` | `true` = s'ouvre par proximité devant N'IMPORTE QUI ; `"ennemis"` = devant les ennemis SEULEMENT (au joueur de l'ouvrir à la main) | absent = jamais |
| `manuelle` | `true` = la touche E l'ouvre ET la referme ; `"fermer"` = la touche E ne fait que la REFERMER | absent = pas manœuvrable |
| `referme` | (portes `auto` seulement) se referme après `delai` sans personne à portée | `true` |
| `delai` | (portes `auto`) secondes sans personne à portée avant refermeture | `1.2` |
| `groupe` | vantaux qui s'ouvrent/se referment ENSEMBLE (portes doubles) | (aucun — chaque vantail est son propre groupe) |
| `portee` | (portes `auto`) rayon de déclenchement horizontal, mètres (+ tolérance d'altitude fixe de 2 m) | `2.5` |

Une valeur inconnue de `mouvement` est un **avertissement bruyant** du
loader (repli sur `"descend"`) — mêmes règles que `matiere` sur un `prop_*`.
Les autres extras retombent SILENCIEUSEMENT sur leur défaut si absentes ou
mal formées (le contrat ne réclame un avertissement que pour `mouvement`).

**Repère de `charniere`/`sens` : le repère LOCAL three.js du mesh CHARGÉ**,
donc déjà après la conversion Y-up (Blender) → Z-up (three.js) faite par
`GLTFLoader` — le +Y de Blender devient le −Z de three. C'est à l'auteur du
niveau de garder ça en tête en pointant ces valeurs depuis Blender ; le code
runtime ne connaît que le repère three.js.

**`manuelle` et `auto: "ennemis"` vont ensemble.** Une porte qu'on ouvre à la
main (les quatre bureaux de l'étage) ne doit pas se rouvrir toute seule quand
on vient de la refermer — le joueur est encore devant. Elle garde pourtant
`auto: "ennemis"` : un Costard la pousse, et le bake du graphe de navigation
traverse toute porte dont l'`auto` n'est pas absent, donc ceux qui
travaillent derrière ont toujours un chemin pour en sortir.

**`manuelle: "fermer"` sert au sens unique.** La porte coupe-feu des rayons
s'ouvre par son bouton, posé hors de portée côté surface de vente ; la main
ne peut que la REFERMER, des deux côtés. Le raccourci reste donc à sens
unique, mais on peut claquer la porte derrière soi, et la rouvrir en
retournant au bouton (l'ouverture « permanente » d'un `use_*` saute à la
première fermeture manuelle).

L'appui sur E va d'abord aux `use_*` à portée ; s'il n'en trouve aucun, il
passe aux portes manœuvrables, dans la même portée de 2 m. Sans cet ordre, le
bouton de la coupe-feu et la porte elle-même répondraient au même appui,
qui l'ouvrirait et la refermerait dans le même pas fixe.

`sens: "auto"` (défaut d'un battant) recalcule, à CHAQUE début d'ouverture,
le sens qui écarte le vantail de la position de celui qui l'ouvre (joueur ou
ennemi) — un même va-et-vient pousse donc d'un côté ou de l'autre selon qui
arrive. `groupe` fait s'ouvrir/se refermer plusieurs vantaux ensemble ; la
portée `auto` se mesure depuis le CENTRE du groupe, et un `use_*`/une carte
qui cible un seul vantail du groupe ouvre le groupe entier. Une porte à
carte/`use_*` reste TOUJOURS ouverte une fois débloquée (`permanent`), quel
que soit `referme` — seules les portes `auto` peuvent se refermer toutes
seules.

Trois sons, un par MOUVEMENT (`core/audio.ts`), joués UNE FOIS au début
d'une ouverture depuis l'état fermé : `door_swing` (battant), `door_slide`
(coulisse et descend), `door_shutter` (monte, rideau métallique). Les sons
`door_locked`/`door_unlock` de la porte à carte restent séparés — ils
signalent un REFUS/SUCCÈS de carte, pas un mouvement de vantail.

En console : `cassandre.doorSystem.liste()` (état de chaque vantail),
`cassandre.doorSystem.ouvrir("door_argent")` (ouvre un vantail — et tout son
groupe — sans passer par un `use_*`/une carte) et
`cassandre.doorSystem.actionner()` (la touche E sur la porte manœuvrable la
plus proche du joueur). Ces trois-là existent parce que le verrouillage du
pointeur met le vrai clavier hors de portée de l'automatisation.

### Préfixe vitre

Un mesh de verre plat, UN matériau (alpha `transparent`/`opacity` du glTF,
`toLambert` la recopie déjà — parfaitement compatible avec l'invariant #5,
qui porte sur le modèle d'ÉCLAIRAGE, pas sur la transparence). Collider
cuboid FIXE, groupe WORLD, tant que `solide !== false` : bloque déplacement,
tirs et ligne de vue ennemie comme un mur, tant qu'elle est intacte.

| Propriété | Sens | Défaut |
|---|---|---|
| `solide` | `false` = AUCUN collider, incassable (verrière au plafond, fenêtre extérieure dont le MUR garde son propre collider) | `true` |
| `pv` | nombre > 0 = cassable ; absent = incassable | (aucun — incassable) |
| `givre` | `true` = explosion de givre à la casse (armoires/bacs surgelés) | `false` |

Un `pv` invalide (pas un nombre strictement positif) est un **avertissement
bruyant** du loader, vitre laissée incassable — même règle que `pv` sur un
`prop_*`. `solide: false` force l'incassabilité même si `pv` est renseigné
(une verrière au plafond n'a pas de collider pour ENCAISSER un tir : un
collider au-dessus d'un sol serait pris pour ce sol par le bake du graphe de
navigation, piège déjà connu des plafonds).

**Budget de lots, contrainte dure** : plusieurs `vitre_*` d'une même cellule
de 48 m (`DECOR_CELL_SIZE`, voir la fusion du décor statique) et du même
matériau sont fusionnées en **un seul lot de dessin**, quel que soit leur
nombre — chaque vitre garde sa PROPRE plage de sommets dans ce lot pour
pouvoir se casser individuellement (écrasés sur son propre centre à la
casse), sans jamais coûter un lot de plus. Une teinte unique de vitrage rend
l'ordre de mélange indifférent (le matériau est double face, sans écriture
de profondeur).

Le tir du JOUEUR endommage une vitre par ses PV (même barème que les
`prop_*`, `damageForWeapon`). Un tir ENNEMI qui rencontre une vitre (raté
dévié par le jitter de visée) la CASSE D'UN COUP, sans passer par ses PV —
l'effet Duke Nukem voulu, détaillé dans
[ADR 0031](../decisions/0031-portes-animees-et-vitres.md).

En console : `cassandre.vitres.liste()` (PV, cassée, givre) et
`cassandre.vitres.casser("vitre_surgeles_1")`.

### Préfixe sanitaire

Une cuvette ou un urinoir UTILISABLE, façon Duke Nukem 3D. UN mesh, UN
matériau (le matériau `palette` commun, comme les meubles Kenney) — **jamais
de `col_*` jumeau** : le loader construit lui-même un collider cuboid FIXE
sur la bbox monde, groupe WORLD, **toujours actif** (contrairement à
`vitre_*`, un sanitaire n'a pas de variante `solide: false`).

| Propriété | Sens | Défaut |
|---|---|---|
| `sorte` | `"cuvette"` ou `"urinoir"` — **OBLIGATOIRE** | (aucun — absente ou inconnue avertit bruyamment, repli sur `"cuvette"`) |
| `pv` | nombre > 0 = cassable au tir du JOUEUR ; absent = incassable à ce tir-là (mais toujours utilisable, et cassable d'un coup par un tir ENNEMI) | (aucun — incassable au joueur) |

`sorte` est la seule custom property de tout le contrat de nommage dont
l'ABSENCE avertit bruyamment (même règle que l'invalidité) : sur
`prop_*`/`door_*`, l'absence d'une propriété facultative est silencieuse,
seule une valeur présente-mais-fausse avertit. Ici, l'objet n'a pas de
comportement par défaut raisonnable sans savoir de quel appareil il s'agit —
la cuvette est le repli choisi (la plus fréquente au plan de masse), jamais
un silence.

**Deux gestes, une seule règle de soin** (`game/session/sanitaires.ts`,
partagée avec le `use_toilet` historique du niveau `hypermarche_complet`) :

| Ce qu'on fait | Effet |
|---|---|
| Toucher E devant un sanitaire INTACT | soulagement : +10 % du PV max (arrondi), plafonné au max, puis un délai GLOBAL de 220 s de GAMEPLAY avant le prochain — un seul compteur pour tout le niveau. La chasse d'eau (`sanitaire_use`) part dans tous les cas ; pendant le délai ou à PV pleins hors délai, rien ne soigne (message HUD court, délai non consommé à PV pleins) |
| Toucher E devant un sanitaire CASSÉ | une gorgée au jet d'eau permanent : +1 PV par appui, illimité, plafonné au max, son `water_drink` (aucun son à PV pleins) |

Écarts volontaires par rapport à `player.c` (Duke 3D, cas TOILET/STALL de
`checksectors`) : Duke fige le joueur ~2 s pendant l'acte — **on ne le fait
pas** (invariant #10, aucune animation ne bloque le joueur) ; à PV pleins ET
hors délai, Duke consommerait quand même le délai — ici il ne l'est PAS,
plus amical.

Un tir ENNEMI qui rencontre un sanitaire intact le CASSE D'UN COUP, sans
passer par ses PV — même effet Duke Nukem que `vitre_*`
(`enemyMachine.ts::handleEnemyShotMiss`, généralisé pour accepter plusieurs
cibles cassables plutôt que dupliqué).

**Portée d'usage — exige de VISER l'appareil** (révision du 2026-09-24, retour
de playtest : « je peux quand même activer [...] même si je regarde pas les
toilettes »), "neartag" façon Duke 3D plutôt qu'une simple distance. Un rayon
Rapier part de l'œil du joueur (même origine que les armes) dans la direction
de visée courante, filtré WORLD :

- un sanitaire **INTACT** doit être le PREMIER collider touché, à
  `SANITAIRE_AIM_RANGE_METERS` (1,4 m — volontairement plus court que les 2 m
  d'un `use_*` générique : viser une cuvette suppose de s'y tenir devant et de
  baisser les yeux) — une cloison de cabine plus proche bloque, comme un mur
  bloquerait un tir ;
- un sanitaire **CASSÉ** n'a plus de collider (désactivé à la casse) : viser
  son jet compte à la place — le volume vertical au-dessus de `jetOrigin`
  (~1,5 m de haut, ~0,3 m de rayon), à condition qu'aucun mur/cloison ne soit
  plus proche sur le même rayon.

`SanitaireSystem.resolveAim` fait l'interprétation géométrique,
`game/session/sanitaires.ts::trySanitaire` lance le rayon. Détail complet :
[ADR 0032](../decisions/0032-sanitaires-utilisables.md), section
« Portée — visée ».

**Budget de lots, même stratégie que `vitre_*`** : tous les `sanitaire_*`
d'un même matériau fusionnent en un seul lot de dessin POUR TOUT LE NIVEAU,
sans découpe en cellules — une salle de toilettes pèse quelques centaines de
triangles, la fusion sert ici à tenir le budget de LOTS. Casser un sanitaire
écrase sa propre plage de sommets sur son centre, le lot reste un seul mesh
pour toujours.

En console : `cassandre.sanitaires.liste()` (sorte, PV, cassé),
`cassandre.sanitaires.casser("sanitaire_urinoir_2")`,
`cassandre.sanitaires.jets()` (jets d'eau actifs) et
`cassandre.sanitaires.delai()`/`forcerDelai(secondes)` (lit/force le délai de
soulagement — le seul moyen de juger le "Rien ne vient." sans attendre 220 s
en jouant).

see: [ADR 0032](../decisions/0032-sanitaires-utilisables.md)

## Constantes de construction

| Constante | Valeur |
|---|---|
| Grille fine | 0.25 m |
| Grille standard | 1 m |
| Module de kit | 2 m |
| Densité de texels | 64 px/m |
| Taille de texture | 128 × 128 max (atlas d'affiches `aff_*` : 512 × 512, voir [Affiches de marques](../pipeline/harmonisation-assets.md#affiches-de-marques)) |
| Épaisseur de mur | 0.25 m |
| Ouverture de porte | 1.5 × 2.5 m |
| Portée d'usage (`use_*`) | 2 m |
| Seuil collider surdimensionné (`col_*`) | 50 000 triangles |

## Classes de pièce du kit modulaire (tools/blender/kit_spec.py)

Décident des contrôles de grille appliqués à une pièce (`check_spec`,
`validate_level.py`) :

| Classe | Contrainte dimensionnelle |
|---|---|
| `SHELL` | empreinte X multiple de 1 m, hauteur multiple de 0.5 m |
| `PROP` | pas de contrôle de grille sur ses propres dimensions — c'est son **placement** en niveau qui doit tomber sur la grille fine (0.25 m), pas sa géométrie |
| `DETAIL` | exempt — petit élément collé à une surface, non collidable |

Écart assumé par rapport à une lecture littérale de `modular-kit-design` :
la table de dimensions du même skill viole elle-même la règle SHELL sur
presque tous les props (gondole profonde de 1.25 m, palette 1.2 × 0.8 m,
caisse à 1.1 m de haut). La règle vaut pour ce qui se **carrelle** (la
coque), pas pour ce qui se **pose** (le mobilier) ; les dimensions du skill
font foi telles quelles.

**Origine à un coin au sol** pour toute pièce, deux exceptions par
ergonomie de pose :

| Pièce | Origine |
|---|---|
| `kit_floor_4x4` | coin de la **surface de marche** — la dalle descend sous z=0, poser à z=0 fait marcher le joueur à z=0 |
| `kit_ceiling_4x4` | coin de la **sous-face** — la dalle monte au-dessus, poser à z=5 donne 5 m de hauteur libre exacte |
