---
title: Valeurs des armes
tags: [reference, armes]
status: brouillon
updated: 2026-10-15
---

# Valeurs des armes

Valeurs initiales de `src/game/player/weapons/weaponConfig.ts`. Ce sont les valeurs
configurées du prototype, pas un équilibrage final issu d'un playtest.

## Dégâts et attaque

| Arme | Dégâts par coup | Éléments par tir | Maximum théorique par tir | Unité |
|---|---:|---:|---:|---|
| Pied-de-biche | 25 | 1 | 25 | PV par coup |
| Pistolet | 18 | 1 | 18 | PV par balle |
| Fusil à pompe | 6 | 9 plombs | 54 | PV si les 9 plombs touchent |
| Pistolet de détresse | 35 | 1 fusée, puis son souffle | 125 | PV sur la cible touchée de plein fouet |

Le pompe lance neuf rayons dispersés ; chaque plomb qui touche applique
6 PV. Les 54 PV sont un maximum théorique à courte portée, pas les dégâts
garantis d'un tir. `damageForWeapon("shotgun")` renvoie les dégâts d'un
plomb, pas la somme de la gerbe.

## Cadence, portée et munitions

| Paramètre | Pied-de-biche | Pistolet | Fusil à pompe | Pistolet de détresse | Unité |
|---|---:|---:|---:|---:|---|
| Délai entre les tirs | 0,60 | 0,22 | 0,80 | 1,10 | s |
| Portée | 1,6 | 60 | 30 | 85 environ | m |
| Dispersion | — | 0,8 | 5 | aucune | degrés (cône pour le pompe) |
| Munitions au départ | aucune | 48 | 48 | 6 | coups |
| Réserve maximale | — | 150 | 96 | 18 | coups |

## Comparaison des réglages

Le réglage `REVISE` est actif par défaut, à essayer après le retour sur la mêlée
trop forte. `HISTORIQUE` conserve les valeurs précédentes pour comparer.
Les deux profils sont définis dans `src/game/player/weapons/weaponBalance.ts`
et initialisent la même config mutable `weaponConfig`.

| Paramètre | Historique | Révisé |
|---|---:|---:|
| Dégâts du pied-de-biche par cible | 40 | 25 |
| Intervalle de mêlée | 0,50 s | 0,60 s |
| Portée axiale de mêlée | 2 m | 1,60 m |
| Rayon de la capsule de contact | 0,45 m | 0,30 m |
| Dégâts par balle de pistolet | 12 | 18 |
| Intervalle du pistolet | 0,22 s | 0,22 s |
| Coups contre un Costard de 50 PV, mêlée / pistolet | 2 / 5 | 2 / 3 |
| Coups contre un Rampant de 20 PV, mêlée / pistolet | 1 / 2 | 1 / 2 |
| Coups contre un Vigile de 140 PV, hors bouclier, mêlée / pistolet | 4 / 12 | 6 / 8 |

La capsule dépasse sa portée axiale de son rayon : son extrémité passe de
2,45 m à 1,90 m depuis les yeux. La portée effective dépend aussi du volume
de la cible. Un coup peut toujours toucher plusieurs cibles dans la capsule.
La Perche Titane multiplie les dégâts de mêlée par 1,5 : le réglage révisé
inflige 37,5 PV et ne tue plus un Costard intact d’un seul coup.

Le panneau de tuning (touche accent grave) expose les six curseurs et les deux
profils. En console, `cassandre.applyWeaponBalanceVariant("HISTORIQUE")` ou
`cassandre.applyWeaponBalanceVariant("REVISE")` applique le profil à chaud.
Les mouvements, le recul, le hitstop, les munitions et les autres armes restent
aux valeurs de leur configuration.

Pour comparer, enregistrez 15 secondes de déplacement et de tir avec F9,
arrêtez avec F9, puis rejouez avec F10. Le rejeu restaure uniquement le joueur :
remettez les cibles, l’équipement et les munitions dans le même état avant
chaque essai. Le verdict de sensation reste à recueillir en jeu.

## Pistolet de détresse : la fusée et son souffle

Valeurs de départ, posées le 2026-10-11 et pas encore réglées en jeu.

| Paramètre | Valeur | Unité | Champ de `weaponConfig` |
|---|---:|---|---|
| Vitesse de la fusée | 34 | m/s | `flareSpeed` |
| Chute | 5 | m/s² | `flareGravity` |
| Durée de vol avant d'éclater en l'air | 2,5 | s | `flareLifetime` |
| Dégâts de la fusée sur ce qu'elle touche | 35 | PV | `flareDirectDamage` |
| Rayon du souffle | 3,5 | m | `flareBlast.radius` |
| Dégâts du souffle au centre | 90 | PV | `flareBlast.damage` |
| Part encaissée par le joueur | 50 | % | `flareBlast.playerDamageScale` |
| Distance sous laquelle un Costard tué éclate | 1,4 | m | `flareBlast.gibDistance` |
| Impulsion donnée au mobilier, au centre | 380 | N·s | `flareBlast.impulse` |

Les dégâts du souffle décroissent linéairement jusqu'à zéro au bord du rayon,
comme ceux d'une bonbonne (rayon 5 m, 120 PV au centre) : 64 PV à 1 m, 51 PV à
1,5 m, 26 PV à 2,5 m. Un Costard (50 PV) meurt donc touché de plein fouet ou à
moins de 1,5 m du point d'impact ; un Rampant (20 PV), à moins de 2,7 m ; un
Vigile (140 PV) demande deux fusées. La portée de 85 m est la distance
parcourue pendant la durée de vol, pas une limite de visée.

Les boîtes de munitions ramassées en marchant (`use_munitions_*`) ne rechargent
que le pistolet ; une boîte qui porte `fusees` recharge le pistolet de détresse.
Une borne de munitions, à 12 €, ajoute 24 coups au pistolet, 8 coups au pompe
et 2 fusées, pour chaque arme possédée
(`src/game/player/kioskOffer.ts`, `src/game/session/progression/perks.ts`).
La réserve de pistolet passe à 200 avec le perk `premium` (voir
[Valeurs de l'économie](valeurs-economie.md)).

## Coup de pied

Le coup de pied n'est pas une arme : il part au clic gauche tant qu'aucune arme
n'est équipée, sans munitions. Ses valeurs sont dans
`src/game/player/weapons/kickConfig.ts` : 20 PV par coup, portée de 1,45 m,
rayon de frappe de 0,24 m. Le délai entre deux coups est de 0,55 s dans la
variante `FRANC` (la valeur par défaut) ; `VIF` (0,42 s) et `LOURD` (0,72 s)
sont les autres variantes de `KICK_VARIANTS`.

## Source et usage

Les dégâts sont `meleeDamage`, `pistolDamage`,
`shotgunDamagePerPellet` et `flareDirectDamage` ; la cadence, la portée, la dispersion et les
réserves sont dans le même objet `weaponConfig`. Le guide [Ajouter une
arme](../5-guides/ajouter-une-arme.md) décrit les points à modifier et les
contrôles à effectuer. Les règles vécues par le joueur sont dans
[Armes](../2-fonctionnel/armes.md).
