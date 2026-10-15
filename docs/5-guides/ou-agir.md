---
title: Où agir
tags: [guide, navigation]
status: brouillon
updated: 2026-10-08
---

# Où agir

Repérez d'abord le comportement, puis modifiez sa source de vérité. Les fichiers ci-dessous sont les points d'entrée ; les pages techniques détaillent les contrats.

| Je veux modifier… | Où agir | Lire |
|---|---|---|
| Marche, sprint, saut, caméra, bob ou FOV | `src/game/player/movement/moveConfig.ts`, `src/game/player/movement/controller.ts` | [Joueur](../4-technique/joueur.md), [valeurs](../6-reference/valeurs-deplacement.md) |
| Touches joueur | `src/core/input/inputBindings.ts`, `src/core/input/input.ts`, options contrôles de `src/ui/screens/options/controls/ControlsTab/` | [Contrôles](../6-reference/controles.md) |
| Gravité, capsule ou groupes de collision | `src/physics/world.ts`, `src/game/player/movement/controller.ts` | [Physique](../4-technique/physique.md), [Three.js et Rapier](../6-reference/threejs-rapier.md) |
| Dégâts, portée, cadence ou recul d'une arme | `src/game/player/weapons/weaponConfig.ts`, `src/game/player/weapons/weapons.ts` | [Armes](../4-technique/armes.md) |
| Modèle d'arme en vue subjective | `tools/blender/build_weapons.py`, puis asset généré `public/assets/weapons/armes.glb` | [Sprites et viewmodel](../4-technique/sprites-et-viewmodel.md) |
| Arme ramassable au sol | `src/game/level/interactions/interactive.ts`, `src/game/player/weapons/weapons.ts`, `src/render/pickups/pickups.ts` | [Systèmes de niveau](../4-technique/systemes-de-niveau.md) |
| PV, détection, poursuite ou attaque d'un Costard | `src/game/entities/suit/suitConfig.ts`, `src/game/entities/shared/enemyMachine.ts` | [Ennemis et IA](../4-technique/ennemis-et-ia.md), [valeurs](../6-reference/valeurs-ennemis.md) |
| Comportement ou états communs des ennemis | `src/game/entities/shared/enemyMachine.ts`, `src/game/entities/suit/suit.ts`, `src/game/entities/director/director.ts` | [Ennemis et IA](../4-technique/ennemis-et-ia.md) |
| Niveau sélectionnable au menu | `src/game/level/catalog/levels.ts`, `src/app/navigation/bootChoice.ts` | [Chargement de niveau](../4-technique/chargement-de-niveau.md) |
| Géométrie / placement du niveau v2 | `tools/level_v2/plan_de_masse.py`, `tools/level_v2/espaces/` (un fichier par espace), `tools/level_v2/build_niveau.py` (registre `HABILLAGE`) | [Modifier le niveau](modifier-le-niveau.md) |
| Niveau modulaire historique | `tools/blender/kit_spec.py`, `tools/blender/level_spec.py`, `tools/blender/build_level.py` | [Outillage Blender](../4-technique/outillage-blender.md) |
| Import glTF et préfixe d'objet | `src/game/level/loading/loader.ts`, `tools/blender/validate_level.py` | [Chargement de niveau](../4-technique/chargement-de-niveau.md), [noms glTF](../6-reference/conventions-nommage.md) |
| Porte, carte ou message d'interaction | `src/game/level/doors/doors.ts`, `src/game/session/progression/doors.ts`, `src/game/level/interactions/interactive.ts` | [Systèmes de niveau](../4-technique/systemes-de-niveau.md) |
| Prop physique ou sa casse | `src/game/level/props/props.ts`, `src/render/fx/fx.ts` | [Systèmes de niveau](../4-technique/systemes-de-niveau.md) |
| Vitre cassable | `src/game/level/interactions/vitres.ts`, `src/game/entities/shared/enemyMachine.ts` | [Systèmes de niveau](../4-technique/systemes-de-niveau.md) |
| Sanitaire et soin | `src/game/level/sanitaires/sanitaires.ts`, `src/game/session/player/sanitaires.ts` | [Systèmes de niveau](../4-technique/systemes-de-niveau.md) |
| Écrans animés et flux vidéo | `src/game/level/interactions/ecrans.ts`, `tools/textures/generate_chaines.py` | [Générateurs](../4-technique/generateurs.md) |
| Caméra fixe de surveillance | `src/game/level/interactions/cameras.ts`, `src/render/overlays/cameraView.ts` | [Systèmes de niveau](../4-technique/systemes-de-niveau.md) |
| Ambiance sonore ou effets | `src/core/audio/audio.ts`, `tools/audio/recipes.py`, `tools/audio/render_sfx.py` | [Ajouter un son](ajouter-un-son.md), [audio runtime](../4-technique/audio-runtime.md) |
| Interface, écran ou widget React | `src/ui/` (dossier du composant), `src/game/hud/state.ts` si lecture d'état | [Interface React](../4-technique/interface-react.md), [conventions](conventions-de-code.md) |
| Compteurs du score ou récap | `src/game/session/progression/score.ts`, `src/game/hud/state.ts` | [Session et score](../4-technique/session-et-score.md) |
| Aléatoire reproductible | `src/core/effect/random.ts`, `src/game/session/gameSession.ts` | [Rejeu et déterminisme](../4-technique/rejeu-et-determinisme.md) |
| Pas fixe, interpolation ou hitstop | `src/core/loop/loop.ts`, `src/game/loop/updateGameplay.ts`, `src/game/loop/interpolateVisuals.ts` | [Boucle et temps](../3-architecture/boucle-et-temps.md) |
| Affichage rétro, matériaux ou filtrage | `src/render/pipeline/renderer.ts`, `src/render/pipeline/renderService.ts` | [Rendu](../4-technique/rendu.md) |
| Éclairage d'une zone | `tools/blender/bake_vertex_lighting.py`, `src/render/environment/lightPool.ts` | [Éclairage](../4-technique/eclairage.md) |
| Erreur de simulation difficile à reproduire | `src/core/input/inputRecorder.ts`, `src/game/devtools/replay/testHarness.ts` | [Diagnostiquer un bug](diagnostiquer-un-bug-de-simulation.md) |
| Temps de rendu ou nombre de lots | `src/game/devtools/replay/testHarness.ts`, `src/render/environment/lightPool.ts` | [Mesurer une perf](mesurer-une-perf.md), [budget de rendu](../4-technique/budget-de-rendu.md) |
| Commande console de développement | `src/game/devtools/consoleApi.ts` | [Console cassandre](../6-reference/console-cassandre.md) |
| Nouvelle décision technique | `docs/decisions/` | [Écrire un ADR](ecrire-un-adr.md) |

Une valeur de gameplay ne se duplique pas dans plusieurs modules : trouvez d'abord le fichier de configuration désigné comme source unique. Les pages de [référence](../6-reference/README.md) donnent les valeurs initiales.
