---
title: Valeurs de l'économie
tags: [reference, gameplay]
status: brouillon
updated: 2026-10-08
---

# Valeurs de l'économie

Dons du direct, prix des bornes et effet des perks. Les dons sont dans
`streamConfig` (`src/game/session/stream/streamSim.ts`), les prix dans le
niveau (`tools/blender/refresh_perk_kiosks.py`), les effets dans
`src/game/player/perkConfig.ts`. Ces valeurs sont celles de la variante B du
relevé d'équilibrage ; aucune n'a été jouée.

## Bornes et perks

| Perk | Produit | Borne | Prix | Effet |
|---|---|---|---:|---|
| `perche` | Perche Titane | galerie | 10 € | dégâts du pied-de-biche ×1,5 |
| `vpn` | VPN Faraday | caisses | 20 € | distance de repérage des Costards et des Vigiles ×0,6 |
| `aimant` | Aimant Magnétips | allée centrale | 25 € | rayon de ramassage 3 m au lieu de 1,2 m |
| `premium` | Abonnement Vérité+ | réserve | 35 € | +50 munitions de pistolet au plafond |
| `boisson` | Zone 51 Energy | couloir du personnel | 55 € | vitesse ×1,3 pendant 2,5 s après un kill |
| `gilet` | Gilet Alu-Tactique | bureaux | 85 € | +25 PV au maximum, rendus à l'achat |

Les six coûtent 230 €.

## Dons des spectateurs

Chaque évènement a une chance de déclencher un don, tiré parmi quelques
montants. Deux dons de spectateurs sont séparés d'au moins 8 s de jeu.

| Évènement | Chance | Montants |
|---|---:|---|
| Kill | 16,8 % | 1, 2, 2 ou 5 € |
| Série (3 kills en 6 s) | 70 % | 5, 5 ou 10 € |
| Directeur | 100 % | 20 ou 50 € |
| Secret | 84 % | 5 ou 10 € |
| Carte ramassée | 56 % | 5 ou 10 € |
| Toilettes | 70 % | 1 ou 2 € |
| Casse | 7 % | 1 ou 2 € |
| Coup reçu | 5,6 % | 1 € |
| Annonce | — | aucun don |

La difficulté multiplie la chance : ×1,4 en Client, ×1 en Habitué, ×0,7 en
Lanceur d'alerte.

## Donateur mystère

Cinq dons fixes, sans tirage, identiques dans les trois difficultés.

| Étape | Quand | Montant |
|---|---|---:|
| `depart` | 12 s de jeu | 10 € |
| `carte_argent` | carte Argent ramassée | 10 € |
| `quai` | réplique du quai dite | 15 € |
| `carte_or` | carte Or ramassée | 20 € |
| `escalier` | entrée dans l'escalier des bureaux | 45 € |

Total : 100 €.

## Relevé simulé

`pnpm economy` rejoue trois parties types à travers la simulation du direct,
200 fois chacune. En « Habitué », variante B :

| Partie type | Durée | Dons reçus | Utiles avant la dernière borne | Perks achetés (min / médiane / max) |
|---|---:|---:|---:|---|
| Pressé | 4,5 min | 132 € | 98 € | 1 / 2 / 2 |
| Normal | 8,6 min | 169 € | 131 € | 2 / 3 / 4 |
| Complétiste | 13,9 min | 193 € | 155 € | 3 / 3 / 5 |

Les profils sont des hypothèses : part d'ennemis tués, rythme des combats,
détours empruntés. L'écart entre deux variantes est plus petit que
l'incertitude du modèle. Le journal d'une vraie partie
(`cassandre.economie.journal()`) fait foi.

## Variantes d'équilibrage

`cassandre.economie.appliquer("A")` met une variante à l'essai en jeu.

| | A — serrée | B — équilibrée | C — généreuse |
|---|---|---|---|
| Générosité du chat (par rapport à avant le lot B7) | ×1,3 | ×1,4 | ×1,8 |
| Donateur mystère | 10 + 10 + 10 + 20 + 40 = 90 € | 100 € | 10 + 10 + 15 + 25 + 50 = 110 € |
| Prix (perche, VPN, aimant, abonnement, boisson, gilet) | 10, 25, 30, 40, 55, 90 | 10, 20, 25, 35, 55, 85 | 10, 20, 25, 30, 50, 80 |
| Les six perks | 250 € | 230 € | 215 € |
| Partie normale, perks achetés | 1 / 2 / 3 | 2 / 3 / 4 | 2 / 3 / 4 |

Aucune variante ne permet d'acheter les six perks, dans aucun profil ni
aucune difficulté.

Voir [Sponsors](../2-fonctionnel/sponsors.md),
[Session et score](../4-technique/session-et-score.md#économie-du-direct) et
l'[ADR 0040](../decisions/0040-bornes-et-perks.md).
