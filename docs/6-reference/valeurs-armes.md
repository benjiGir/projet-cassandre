---
title: Valeurs des armes
tags: [reference, armes]
status: brouillon
updated: 2026-09-26
---

# Valeurs des armes

Valeurs initiales de `src/game/player/weaponConfig.ts`. Ce sont les valeurs
configurées du prototype, pas un équilibrage final issu d'un playtest.

## Dégâts et attaque

| Arme | Dégâts par coup | Éléments par tir | Maximum théorique par tir | Unité |
|---|---:|---:|---:|---|
| Pied-de-biche | 40 | 1 | 40 | PV par coup |
| Pistolet | 12 | 1 | 12 | PV par balle |
| Fusil à pompe | 6 | 9 plombs | 54 | PV si les 9 plombs touchent |

Le pompe lance neuf rayons dispersés ; chaque plomb qui touche applique
6 PV. Les 54 PV sont un maximum théorique à courte portée, pas les dégâts
garantis d'un tir. `damageForWeapon("shotgun")` renvoie les dégâts d'un
plomb, pas la somme de la gerbe.

## Cadence, portée et munitions

| Paramètre | Pied-de-biche | Pistolet | Fusil à pompe | Unité |
|---|---:|---:|---:|---|
| Délai entre les tirs | 0,50 | 0,22 | 0,80 | s |
| Portée | 2 | 60 | 30 | m |
| Dispersion | — | 0,8 | 5 | degrés (cône pour le pompe) |
| Munitions au départ | aucune | 48 | 48 | coups |
| Réserve maximale | — | 150 | 48 fixes | coups |

Le pistolet seul peut être rechargé en ramassant ses munitions. Le pompe ne
dispose d'aucun ramassage de recharge.

## Source et usage

Les dégâts sont `meleeDamage`, `pistolDamage` et
`shotgunDamagePerPellet`; la cadence, la portée, la dispersion et les
réserves sont dans le même objet `weaponConfig`. Le guide [Ajouter une
arme](../5-guides/ajouter-une-arme.md) décrit les points à modifier et les
contrôles à effectuer. Les règles vécues par le joueur sont dans
[Armes](../2-fonctionnel/armes.md).
