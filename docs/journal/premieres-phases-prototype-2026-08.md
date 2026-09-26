---
title: "Prototype — premières phases — 2026-08"
tags: [journal, prototype]
status: stable
updated: 2026-09-26
---

# Prototype — premières phases — 2026-08

Phases 0-3 codées, fonctionnelles, et validées humainement.** Phase 3
> ("l'ennemi Costard" — machine à états, billboard, hitscan télégraphié,
> gibs) est le **point de décision majeur du plan** : combat contre plusieurs
> Costards dans la gym jugé fun par l'utilisateur ("Franchement c'est fun
> même si ça ressemble à rien, je valide") — le proto continue. Feedback de
> hit retravaillé après coup (son placeholder synthétique ajouté, crosshair
> permanent, gizmos balistiques touche `B`, fix d'un vrai bug de portée sur
> le pied-de-biche, compteur de munitions du pompe affiché). Phase 1
> (déplacement) validée dès son passage ("Quake / Half-Life 1"), deux bugs de
> stutter post-playtest corrigés (reclip de vélocité sur mur uniquement,
> `groundStickSpeed` réduit à -0.2 m/s — voir `.claude/docs/RAPIER_GUIDE.MD`
> / skill `threejs-rapier-fieldguide` pour la référence qui a orienté le
> diagnostic). Outils de debug : `V` wireframe, `B` gizmos balistiques.
>
> **Gate `qa-evidence` : abandonné par défaut, pas par phase — décision
> explicite de l'utilisateur (2026-08-20).** Ne pas le lancer à chaque phase ;
> il sera lancé une seule fois, à la toute fin du proto, si besoin.
>
> Mettre à jour cette ligne à chaque passage de phase.

Les critères de validation et de rollback de chaque phase sont dans
`docs/journal/plan-prototype-2026-08.md`.

**Gate `qa-evidence` abandonné (décision explicite de l'utilisateur,
2026-08-19).** Le passage de phase ne dépend plus d'une validation formelle
par preuve (build/console/hash pixel/déterminisme/perf) — seul le critère
humain de fun/lisibilité du plan compte. Le `director` ne doit plus bloquer
une phase suivante en attendant `qa-evidence`.
