---
name: modular-kit-design
description: Conception d'un kit modulaire pour construire un niveau de boomer shooter — pièces paramétriques, dimensions, origines, instancing, liste du kit hypermarché. Charger pour toute tâche de création ou d'extension d'assets de décor.
---

# Kit modulaire

## Pourquoi un kit

Modéliser un niveau dense pièce par pièce est hors de portée d'un développeur
seul. La solution que tout le level design retro utilise : un **kit de pièces
réutilisables** assemblées sur grille.

Bénéfices en cascade :

- Un niveau se construit en heures plutôt qu'en semaines
- Les jonctions sont propres par construction
- La cohérence visuelle est acquise, pas à surveiller
- Côté runtime, tout partage le même matériau → `BatchedMesh`, draw calls sous
  contrôle
- Modifier une pièce met à jour tout le niveau

## Règles de conception d'une pièce

1. **Empreinte multiple de 1 m**, hauteur multiple de 0.5 m
2. **Origine à un coin au sol**, jamais au centre
3. **Jonctions au ras de la grille** — la face de raccord tombe exactement sur
   un multiple, sans marge ni chevauchement
4. **Un seul matériau** par pièce, partagé par tout le kit
5. **Subdivision minimale pour l'éclairage** — une face de 4 m découpée tous
   les 1 m ; voir `vertex-color-sector-lighting`, un mur en 2 triangles ne peut
   pas recevoir de bake
6. **Pas de n-gons** — triangulation propre, faces quad ou tri
7. **Proxy de collision fourni** avec la pièce, en cuboid quand c'est possible

## Instancing

Le niveau n'utilise que des **instances** (`Alt+D` ou instances de collection),
jamais des copies. L'exporteur glTF partage alors la géométrie, et le loader
peut regrouper les instances en `BatchedMesh` ou `InstancedMesh`.

Un niveau construit en copies (`Shift+D`) explose le compte de draw calls et
rend impossible toute modification globale du kit.

## Kit hypermarché — liste de départ

**Coque**

| Pièce | Dimensions |
|---|---|
| `kit_wall_4m` | 4 × 5 × 0.25 |
| `kit_wall_2m` | 2 × 5 × 0.25 |
| `kit_wall_1m` | 1 × 5 × 0.25 (raccord) |
| `kit_corner_in` / `kit_corner_out` | 0.25 |
| `kit_door_2m` | panneau 2 m, ouverture 1.5 × 2.5 |
| `kit_floor_4x4` | 4 × 4 |
| `kit_ceiling_4x4` | 4 × 4 |
| `kit_pillar` | 0.5 × 0.5 × 5 |
| `kit_stairs_2m` | 8 marches de 0.25 |
| `kit_railing_2m` | 2 × 1 |

**Mobilier de vente**

| Pièce | Dimensions |
|---|---|
| `kit_gondola_4m` | 4 × 1.25 × 2 |
| `kit_gondola_end` | 1.25 × 1.25 × 2 |
| `kit_checkout` | 3 × 1 × 1.1 |
| `kit_freezer_2m` | 2 × 1 × 2 |
| `kit_cart` | 1 × 0.6 × 1 (dynamique) |

**Réserve et quai**

| Pièce | Dimensions |
|---|---|
| `kit_rack_4m` | 4 × 1.2 × 6 |
| `kit_pallet` | 1.2 × 0.8 × 0.15 |
| `kit_crate` | 1 × 1 × 1 (dynamique) |
| `kit_dock_door` | 3 × 4 |

**Éclairage et détail**

`kit_ceiling_light` · `kit_vent` · `kit_sign_aisle` · `kit_camera` (surveillance)

Une vingtaine de pièces suffit à construire l'intégralité du niveau.

## Les allées, contrainte de gameplay

Gondole de 1.25 m de profondeur, allée de **3 m** entre deux gondoles. Ça
laisse la place de strafer autour d'un ennemi, ce qu'une allée réaliste de
1.8 m interdit.

Les gondoles à 2 m de haut bloquent la vue debout (yeux à 1.6 m) : ça crée les
embuscades latérales de la zone C sans travail supplémentaire. C'est la
géométrie qui produit le gameplay.

## Ce qui ne se met pas dans le kit

Les éléments **uniques et signifiants** : le bureau du directeur, le mur
cassable du rayon surgelés, la machine à pinces. Ils sont modélisés à part
parce qu'ils portent du sens narratif, et un joueur repère instantanément
qu'un élément est différent des autres — c'est exactement l'effet recherché
pour les secrets.
