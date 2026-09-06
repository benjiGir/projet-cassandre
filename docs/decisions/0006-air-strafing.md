---
title: Air strafing façon Quake
tags: [adr, feel]
status: propose
updated: 2026-09-05
---

# ADR 0006 — Air strafing

## Statut

**Proposé — à trancher avant la Phase 1.**

Cette décision change les valeurs de tuning et le level design. La prendre
après coup coûte une reprise des deux.

## Contexte

Dans le modèle Quake, la vitesse n'est pas clampée directement : seule la
**projection de la vélocité courante sur la direction d'accélération** est
limitée. Une direction d'input perpendiculaire à la vélocité a une projection
quasi nulle, donc l'accélération s'applique presque entièrement.

Le bunny hop et le strafe jump ne sont donc pas des fonctionnalités codées
exprès : ce sont des effets de bord de cette formule.

```ts
const projection = velocity.dot(wishDir);
let addSpeed = wishSpeed - projection;
if (addSpeed <= 0) return;
let accelSpeed = accel * dt * wishSpeed;
if (accelSpeed > addSpeed) accelSpeed = addSpeed;
velocity.addScaledVector(wishDir, accelSpeed);
```

## Options

| Option | Pour | Contre |
|---|---|---|
| **Garder** | plafond de skill gratuit, sensation de vitesse, fidèle au genre | opaque pour qui ne connaît pas, casse l'équilibrage des distances |
| **Clamper** | comportement prévisible, level design plus simple | perd ce qui fait courir les joueurs de boomer shooter |
| **Garder, atténué** | compromis | risque du pire des deux |

## Décision

Non tranchée.

## Conséquences si on garde

- Les distances de saut du niveau doivent tenir compte d'une vitesse
  potentiellement bien supérieure à la vitesse nominale
- Les arènes doivent avoir assez d'espace pour que le mouvement s'exprime
- Le tuning de l'accélération aérienne devient un paramètre sensible

## Comment trancher

Implémenter les deux derrière un flag, jouer 15 minutes chacun dans la gym de
Phase 1. C'est un critère de feel : non délégable.
