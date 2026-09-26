---
title: Résolution interne configurable
tags: [adr, rendu, affichage]
status: propose
updated: 2026-09-26
---

# ADR 0034 — Résolution interne configurable

## Statut

**Proposé — arbitrage utilisateur requis.** Le code expose plusieurs résolutions
internes; l'invariant #4 présente pourtant 640×360 comme non négociable.

## Contexte

Le menu Affichage propose 640×360, 960×540, 1280×720 et 1600×900. Le réglage
est appliqué au renderer et persiste dans les préférences. L'invariant #4
décrit 640×360 comme la résolution interne fixe du jeu. Le défaut reste
640×360, mais l'utilisateur peut le modifier depuis le menu.

La page [Rendu](../4-technique/rendu.md) décrit les préréglages et l'état du
code. Ce désaccord concerne le contrat du projet, pas le fonctionnement du
menu.

## Décision proposée

Conserver 640×360 comme valeur par défaut et reconnaître la résolution interne
comme un réglage utilisateur, avec une option de retour à la valeur historique.
Cette proposition ne devient pas un invariant avant validation.

## Alternatives

| Option | Conséquence |
|---|---|
| Garder 640×360 comme seule résolution autorisée | Supprimer les préréglages supérieurs du menu et des préférences. |
| Autoriser les préréglages, 640×360 restant le défaut | Mettre à jour l'invariant #4 et garder les réglages actuels. |
| Garder les préréglages uniquement comme outil de diagnostic | Séparer les réglages de diagnostic des options utilisateur. |

## Conséquences en attente

- Mettre à jour l'invariant #4 et les pages qui le citent selon l'arbitrage.
- Confirmer si les résolutions supérieures doivent rester persistantes et
  accessibles dans le menu.
- Ne pas présenter 640×360 comme une contrainte absolue tant que la décision
  reste proposée.

## Comment on saurait qu'on a eu tort

Si le réglage nuit au rendu attendu ou au budget GPU sur les machines visées,
le menu et l'invariant devront revenir à une résolution unique.
