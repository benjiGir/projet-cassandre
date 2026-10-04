---
title: Bornes et perks — achat en partie, effets posés sur la session
tags: [adr, gameplay, niveau, histoire]
status: accepte
updated: 2026-10-04
---

# ADR 0040 — Bornes et perks : achat en partie, effets posés sur la session

## Statut

Accepté. S'appuie sur l'[ADR 0038](0038-simulation-du-direct.md), qui fait des
dons un état de partie.

## Contexte

La v1.1 a donné une cagnotte au joueur, alimentée par les dons du direct. Il
fallait qu'elle serve. L'utilisateur a tranché deux points en amont : on
dépense **pendant la partie**, à des bornes posées dans le niveau, et il n'y a
pas de boutique entre deux parties.

Trois contraintes en découlent. Rien ne fige le joueur (invariant #10), donc
pas de menu d'achat. Une partie repart toujours du même état, sans quoi le
rejeu et les records n'ont plus de sens. Et le déplacement, validé en
playtest, ne doit pas être modifié par un réglage global.

## Décision

Une borne est un `use_*` qui porte deux propriétés : `perk` et `prix`. Elle
vend **un seul perk**, **une seule fois par partie**, à la touche d'usage,
sans menu.

Un perk modifie une valeur **de la partie en cours**, jamais une configuration
globale. Les six perks et leurs effets sont dans `src/game/player/perks.ts` et
`src/game/player/perkConfig.ts` ; l'achat et la pose de l'effet dans
`src/game/session/progression/perks.ts`.

Le prix vit dans le niveau. Le validateur refuse un `perk` inconnu en lisant
la liste dans la source du jeu, comme pour les scénarios.

Chaque perk est un placement de produit que le héros accepte : une marque
inventée et une réplique de « lecture de pub ».

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Boutique entre les parties | refusée par l'utilisateur ; elle demande une progression persistante que le jeu n'a pas |
| Menu d'achat à plusieurs articles par borne | il faudrait arrêter le jeu ou laisser le joueur lire sous le feu ; une borne, un article se lit d'un coup d'œil |
| Modifier `moveConfig` ou `weaponConfig` à l'achat | la partie suivante hériterait du perk, et le harnais de réglage ne saurait plus quelle valeur il règle |
| Prix dans le code, par perk | la place d'une borne dans le parcours fait son prix ; les deux se décident ensemble, dans le niveau |
| Perks tirés au hasard à chaque partie | le joueur ne pourrait pas économiser pour un perk précis |

## Conséquences

Ajouter un perk demande une entrée dans `PERKS` et `PERK_INFO`, une valeur
dans `perkConfig`, un `case` dans la pose de l'effet, une réplique, et une
borne dans le niveau (`tools/blender/refresh_perk_kiosks.py`).

Une borne vue trop tôt est inabordable, une borne vue trop tard ne sert plus :
l'ordre des bornes le long du parcours est un réglage d'équilibrage. Le relevé
`pnpm economy` le mesure (voir
[Valeurs de l'économie](../6-reference/valeurs-economie.md)).

Une variante d'équilibrage peut imposer ses prix par-dessus ceux du niveau, le
temps d'un essai. Hors essai, le niveau fait foi.

## Comment on saurait qu'on a eu tort

Si les joueurs demandent à choisir entre deux perks à la même borne, la règle
« une borne, un article » ne tiendra plus. Si un perk doit survivre à la mort,
il faudra une progression persistante, et cette décision devra être reprise
avec celle des records.
