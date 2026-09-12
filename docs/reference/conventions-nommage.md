---
title: Conventions de nommage
tags: [reference, pipeline]
status: stable
updated: 2026-09-06
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
| `door_*` | porte animée, collider dynamique |
| `use_*` | objet interactif, portée d'usage 2 m |
| `secret_*` | zone comptée dans le compteur de secrets |
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
| `secret_id` | `secret_*` | identifiant du secret |
| `door_hp` | `door_*` | points de vie si destructible |

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
| Une porte sans condition | un `use_*` avec `target` seul (cas de `door_b_frozen`) |

Deux garde-fous, parce qu'une faute de frappe ouvrirait la porte à tout le
monde en silence : `validate_level.py` en fait une **erreur** avant l'export,
et `loader.ts` un **avertissement bruyant** au chargement, la propriété étant
alors ignorée.

La carte **Platine** n'a pas de `use_*` : le Directeur la lâche à sa mort
(`DIRECTOR_DROPPED_CARD`, `game/entities/directorConfig.ts`), ramassée par
simple proximité. Côté jeu, l'inventaire vit dans `session.cards` et se
consulte en console avec `cassandre.cards()` / `cassandre.giveCard("or")`.

## Constantes de construction

| Constante | Valeur |
|---|---|
| Grille fine | 0.25 m |
| Grille standard | 1 m |
| Module de kit | 2 m |
| Densité de texels | 64 px/m |
| Taille de texture | 128 × 128 max |
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
