---
title: Difficulté
tags: [fonctionnel]
status: brouillon
updated: 2026-10-04
---

# Difficulté

## Ce que vit le joueur

Après « Rejoindre le direct », un écran demande qui entre dans le magasin.
Trois profils sont proposés, du plus doux au plus dur.

| Profil | L'idée |
|---|---|
| Client | Vous venez pour les promos. Le magasin vous ménage. |
| Habitué | Vous connaissez les rayons. Eux aussi vous connaissent. |
| Lanceur d'alerte | Vous savez. Ils savent que vous savez. |

Chaque carte de l'écran dit en clair ce que le profil change, et rappelle
votre record dans ce profil. Un clic choisit et lance la partie. Le dernier
profil joué est marqué et reçoit le focus : la touche Entrée relance dans le
même.

Le profil vaut pour toute la partie. « Rejouer » et « Reconnecter » le
gardent ; pour en changer, il faut revenir au menu.

### Ce qu'un profil règle

Quatre choses, et seulement celles-là.

- **La vie des ennemis.** Tous, Directeur compris.
- **Les dégâts que vous recevez.**
- **Les renforts.** Les ennemis qu'une rencontre fait surgir arrivent moins
  nombreux dans les profils doux.
- **Les dons du chat.** Les spectateurs donnent plus facilement à un Client,
  plus rarement à un Lanceur d'alerte.

Le comportement des ennemis, leur vitesse, votre déplacement, vos armes et les
prix des bornes ne changent pas.

## Règles

- Le profil se choisit au lancement et ne change pas en cours de partie.
- Le choix est mémorisé sur ce navigateur, avec les autres réglages.
- Les ennemis déjà présents au début d'une partie sont les mêmes dans les
  trois profils. Seuls les groupes réveillés par une rencontre varient.
- Un groupe réveillé compte toujours au moins un ennemi.
- Les dons du donateur mystère sont identiques dans les trois profils.
- Le profil joué s'affiche dans le récapitulatif, y compris après une mort.
- Les records sont tenus par profil — voir
  [Secrets et score](secrets-et-score.md#les-records).

## Valeurs

| | Client | Habitué | Lanceur d'alerte |
|---|---|---|---|
| Vie des ennemis | −25 % | normale | +30 % |
| Dégâts reçus | −40 % | normaux | +50 % |
| Renforts | la moitié | les trois quarts | tous |
| Dons du chat | +40 % | normaux | −30 % |

Ces valeurs sont un point de départ. Le détail est dans
[Valeurs des ennemis](../6-reference/valeurs-ennemis.md#difficulté).

## État

- Validé en playtest : rien encore.
- En attente de verdict : les trois profils, livrés le 4 octobre 2026 sans
  partie jouée. En Lanceur d'alerte, un Costard a plus de vie qu'un coup de
  pompe à bout portant n'en retire : il n'éclate plus du premier coup. À
  juger en jouant.
- Connu : un enregistrement de touches (F9/F10) ne retient pas le profil.
  Rejoué dans un autre, il ne reproduit pas la partie.

## Pour aller plus loin

- [Ennemis](ennemis.md) — ce que chaque ennemi fait.
- [Le niveau](le-niveau.md#les-rencontres) — les rencontres qui amènent des
  renforts.
- [Sponsors](sponsors.md) — ce que les dons permettent d'acheter.
- [ADR 0042 — Difficulté](../decisions/0042-difficulte.md)
