---
title: Valeurs de déplacement
tags: [reference, feel]
status: brouillon
updated: 2026-09-05
---

# Valeurs de déplacement

> **Note** — Valeurs de départ, pas valeurs finales. Le tuning est un critère
> de feel, non délégable. Ce document reçoit les valeurs **retenues** une fois
> figées ; pendant l'arbitrage elles vivent dans la config exposée.

## Joueur

| Paramètre | Valeur | Effet perceptuel |
|---|---|---|
| Vitesse marche | 9 m/s | |
| Vitesse course | 13 m/s | |
| Temps → vitesse max au sol | 0.08 s | plus bas = plus nerveux |
| Temps d'arrêt complet | 0.10 s | |
| Gravité | −25 m/s² | pas −9.81 : le réalisme donne un saut mou |
| Hauteur de saut | 1.1 m (v₀ ≈ 7.4 m/s) | |
| Contrôle aérien | 35 % de l'accélération sol | voir [ADR 0006](../decisions/0006-air-strafing.md) |

## Capsule et controller

| Paramètre | Valeur |
|---|---|
| Rayon capsule | 0.4 m |
| Demi-hauteur capsule | 0.6 m |
| Hauteur des yeux | 1.6 m |
| Offset controller | 0.01 |
| Autostep | 0.35 m (hauteur), 0.2 m (largeur mini) |
| Snap to ground | 0.4 m |
| Pente max grimpable | 50° |
| Pente min glissante | 55° |
| `groundStickSpeed` | 0.2 m/s — plafonné bas, voir [ADR 0016](../decisions/0016-garde-fous-degenerescence-kcc.md) |

## Conséquences pour le level design

Ces valeurs contraignent directement l'architecture — voir
[conventions de nommage](conventions-nommage.md) et le kit modulaire.

| Contrainte | Conséquence |
|---|---|
| Rayon 0.4 m | passage absolu minimum 1 m |
| Hauteur 1.2 m | plafond minimum 2 m |
| Autostep 0.35 m | **marches à 0.25 m**, jamais plus de 0.35 |
| Saut 1.1 m | rebord franchissable ≤ 1.0 m, bloquant ≥ 1.25 m |

## Impact

| Paramètre | Valeur |
|---|---|
| Hitstop | 3 frames (50 ms) |
| Screenshake | amplitude 0.15, durée 120 ms, décroissance exponentielle |
| Muzzle flash | 2 frames |
| Dispersion pompe | 9 plombs, cône 5°, distribution en disque uniforme |
