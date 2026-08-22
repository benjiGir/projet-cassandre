---
name: blender-level-conventions
description: Conventions de scène Blender pour le niveau — unités SI, grille de construction, métriques dérivées du joueur, structure des collections, transforms, réglages d'export glTF. Charger en premier pour toute tâche Blender sur le niveau.
---

# Conventions de scène Blender

Skill racine côté Blender. À charger avant les autres skills du domaine.

## Unités

**1 unité Blender = 1 mètre.** Rapier attend des unités SI ; utiliser autre
chose donne une simulation qui semble tourner au ralenti et invalide toutes les
valeurs de tuning du déplacement.

```
Scene Properties → Units
  Unit System : Metric
  Unit Scale  : 1.0
  Length      : Meters
```

Vérifier aussi le **scale d'export glTF** : il doit rester à 1.0.

## Grille de construction

| Grille | Pas | Usage |
|---|---|---|
| Fine | 0.25 m | détails, marches, épaisseurs |
| Standard | 1 m | tout le reste |
| Modules | 2 m | pièces du kit |

Snap magnétique en permanence, `Increment` à 0.25. Une pièce posée hors grille
casse l'assemblage modulaire et se voit immédiatement comme un joint ouvert.

## Métriques dérivées du joueur

Ces valeurs viennent du character controller. Le level design en dépend
directement — les changer côté gameplay invalide le niveau.

| Contrainte | Valeur | Conséquence |
|---|---|---|
| Rayon capsule | 0.4 m | passage absolu minimum 1 m |
| Hauteur capsule | 1.2 m | plafond minimum 2 m |
| Hauteur des yeux | 1.6 m | ligne d'horizon des compositions |
| Autostep | 0.35 m | **marches à 0.25 m**, jamais plus de 0.35 |
| Hauteur de saut | 1.1 m | rebord franchissable ≤ 1.0 m, bloquant ≥ 1.25 m |
| Pente max | 50° | au-delà, le joueur glisse |

**La marche à 0.25 m est un choix structurant** : c'est en dessous de
l'autostep, donc le joueur monte les escaliers sans à-coup, et ça tombe sur la
grille fine.

## Dimensions d'architecture

| Élément | Valeur |
|---|---|
| Couloir minimum | 2 m |
| Couloir standard | 3 m |
| Allée principale | 4 m |
| Ouverture de porte | 1.5 × 2.5 m |
| Hauteur surface de vente | 5 m |
| Hauteur bureaux / locaux | 3 m |
| Hauteur réserve | 7 m |
| Épaisseur de mur | 0.25 m |

Les portes sont **larges pour un bâtiment réel**. C'est volontaire : un boomer
shooter a besoin de franchissements qui ne cassent pas le mouvement en plein
combat. Une porte de 0.9 m est réaliste et injouable.

## Structure des collections

```
Scene
├── GEO          géométrie rendue
│   ├── SHELL      murs, sols, plafonds
│   ├── PROPS      mobilier, instances du kit
│   └── DETAIL     petits éléments non collidables
├── COL          proxies de collision (col_*)
├── LOGIC        empties : spawns, triggers, interactifs
└── _KIT         sources du kit modulaire — EXCLUE de l'export
```

`_KIT` contient les originaux ; le niveau n'utilise que des **instances**.
Marquer la collection comme exclue de l'export glTF.

## Transforms

**Toujours appliquer** rotation et scale avant export
(`Ctrl+A → Rotation & Scale`). Un scale non appliqué produit des colliders
Rapier décalés ou déformés, et le symptôme se manifeste en jeu, loin de la
cause.

L'origine d'une pièce de kit se place à un **coin au sol**, pas au centre :
l'assemblage sur grille devient trivial.

## Réglages d'export glTF

```
Format              : glTF Binary (.glb)
Include             : Selected Objects OFF, Visible Objects ON
                      Custom Properties ON        ← obligatoire
Transform           : +Y Up ON
Data → Mesh         : Apply Modifiers ON
                      Vertex Colors ON            ← obligatoire si bake
                      UVs ON, Normals ON
                      Tangents OFF
Data → Material     : Export Materials : Placeholder ou No Export
Compression         : OFF au stade prototype
```

**Custom Properties** transporte les métadonnées de level design (cible d'un
`use_*`, ID de secret, son associé) dans `mesh.userData`. Sans cette case, tout
le paramétrage côté Blender est perdu silencieusement.

**Draco** reste désactivé tant que le proto n'est pas validé : ça ajoute une
étape de décodage et complique le diagnostic pour un gain sans objet à cette
échelle.

## Contrat de nommage

Rappel du contrat runtime (voir `gltf-level-conventions`) :

| Préfixe | Effet |
|---|---|
| `col_*` | collider, mesh invisible |
| `spawn_player` | départ, exactement un |
| `spawn_suit_*` | apparition ennemi |
| `trig_*` | volume de trigger (box) |
| `door_*` | porte animée |
| `use_*` | objet interactif |
| `secret_*` | zone comptée |
| `kit_*` | pièce du kit modulaire |

Tout le reste est rendu tel quel, sans collider, silencieusement.
