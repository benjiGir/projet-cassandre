---
title: Arborescence du dépôt
tags: [reference, structure]
status: brouillon
updated: 2026-10-03
---

# Arborescence du dépôt

Vue des dossiers suivis utiles au développement. Les fichiers générés et les caches ne sont pas une source de vérité.

## Code du jeu

```text
src/
  main.ts
  app/
    navigation/            menu, flux XState et transitions de partie
    runtime/               composition des services Effect
  core/
    audio/                 SFX, voix, préparation et ambiances
    effect/                RNG et garde-fou synchrone
    input/                 capture, bindings, persistance et rejeu
    loading/               chemins d'assets et progression de chargement
    loop/                  pas fixe, horloge et statistiques de boucle
  game/
    hud/                   store et contrats du HUD
    settings/              réglages audio et graphiques du moteur
    devtools/
      replay/              enregistrement, rejeu et harnais déterministe
    entities/
      shared/              machine, perception, navigation et combat communs
      suit/                Costard, configuration et manager
      director/            Directeur, configuration et manager
    level/
      catalog/             registre des niveaux et gym
      loading/             import glTF, extraction et ressources
      navigation/          graphe, bake et recherche de chemin
      doors/               état, géométrie, configuration et lots des portes
      interactions/        objets utilisables, écrans, vitres, caméras et nourriture
      props/               mobilier physique et configuration
      sanitaires/          sanitaires, douches et shader d'eau
    loop/                  étapes de simulation et de présentation
    player/
      movement/            controller et configuration du déplacement
      weapons/             système, configuration et contrats des armes
      loyaltyCards.ts      contrat et règles d'inventaire des cartes
    session/
      player/              santé, dégâts, secours de chute et actions sanitaires
      presentation/        répliques et portrait du héros
      progression/         cartes, portes, score et récapitulatif
      lifecycle.ts         construction et destruction d'une partie
      gameEngine.ts        moteur persistant
      gameSession.ts       données canoniques de la partie
      flowPort.ts          capacités de flux reçues de l'application
      spawning.ts          préparation du niveau et apparitions
  physics/                 monde Rapier et raycasts
  render/
    pipeline/              renderer, service Effect et registre de textures
    environment/           ciel, éclairage et visibilité des objets
    sprites/               billboards et atlas des ennemis
    pickups/               billboards, configuration et ressources des ramassages
    viewmodel/             modèles et animation des armes en vue subjective
    overlays/              réticule, hitmarker et effet CCTV
    fx/                    façade et pools des effets
    debug/                 diagnostic du rendu et des tirs
  ui/
    App/                   racine de l'overlay React
    components/            primitives rangées par rôle
    hud/                   widgets, overlays et primitives du HUD
    screens/               écrans rangés par fonction
    dev/                   aperçus et panneaux de tuning
    lib/                   fonctions d'interface partagées
    theme/                 jetons CSS
```

Les tests existants suivent les mêmes domaines dans `test/`. Les scénarios
qui croisent plusieurs systèmes restent dans `test/game/integration/`.
Le test du runtime composé et celui du flux d'écran vivent désormais dans
`test/app/`.

## Dossiers du dépôt

| Dossier | Rôle |
|---|---|
| `src/app/` | Composition des services Effect, démarrage du menu, acteur de flux et transitions vers une session. |
| `src/core/` | Horloge, boucle, input, audio, rejeu et RNG déterministe. |
| `src/game/devtools/` | Console et harnais de développement, retirés du build de production. |
| `src/game/entities/` | Entités, comportements et configurations des ennemis. |
| `src/game/level/` | Chargement glTF, interactions, portes, props, vitres, sanitaires et navigation. |
| `src/game/loop/` | Mise à jour de gameplay et présentation à chaque pas/frame. |
| `src/game/player/` | Contrôleur, armes et données du joueur. |
| `src/game/session/` | Création, reset, progression et fin d'une session. |
| `src/physics/` | Monde Rapier et raycasts. |
| `src/render/` | Renderer rétro, sprites, ressources de ramassage, éclairage et armes en vue subjective. |
| `src/render/fx/` | Pools de shake, flashes/decals, débris, jets d’eau, explosions et gore. |
| `src/ui/` | Overlay React, écrans, HUD et panneau de réglage en développement. |
| `test/core/` | Tests de la boucle, de l'input, du temps et de l'audio. |
| `test/game/` | Tests du joueur, des ennemis, du niveau et des sessions. |
| `test/physics/` | Tests de physique et de raycast. |
| `test/render/` | Tests des modules de rendu. |
| `test/ui/` | Tests des fonctions UI et du flux d'écrans. |
| `tools/audio/` | Recettes, rendu, analyse, écoute et empaquetage des sons. |
| `tools/blender/` | Kit, niveaux historiques, bake, rendu, validation et export glTF. |
| `tools/docs/` | Vérification des liens, audit des commentaires et remappage d'ancres. |
| `tools/level_v2/` | Construction, plan de masse et audit du niveau v2. |
| `tools/refs/` | Extraction de palettes à partir de références. |
| `tools/textures/` | Génération des textures du jeu. |
| `assets_src/blender/` | Sources Blender éditables ; jamais chargées en jeu. |
| `assets_src/library/` | Bibliothèque Blender des assets de niveau v2. |
| `assets_src/textures/` | Sources et manifestes des textures générées. |
| `assets_src/cc0_raw/` | Enregistrements sources ignorés par Git ; licences consignées dans `assets_src/LICENCES_ASSETS.md`. |
| `public/assets/levels/` | Niveaux glTF lus par le runtime. |
| `public/assets/audio/` | Sprites sonores et ambiances exportés. |
| `public/assets/sprites/` | Atlas ennemis et ramassages. |
| `public/assets/weapons/` | Modèles d'armes en vue subjective et au sol. |
| `docs/1-introduction/` à `docs/6-reference/` | Documentation structurée par besoin de lecture. |
| `docs/decisions/` | Décisions d'architecture (ADR). |
| `docs/journal/` | Historique des chantiers et des playtests. |
| `docs/archive/` | Ancienne documentation conservée après la phase I. |
| `.claude/agents/` | Définitions des agents spécialisés du dépôt. |
| `.claude/skills/` | Instructions spécialisées chargeables par les agents. |
| `.agents/skills/` | Copie des skills disponibles dans l'environnement de travail. |

## Règle de placement

Un dossier regroupe une responsabilité. Son implémentation, ses contrats et
ses paramètres restent voisins : pas de répertoire global `types/`,
`interfaces/` ou `utils/`. Un fichier neuf rejoint le domaine qui le possède.
Les imports visent le fichier qui définit l'export ; aucun `index.ts` barrel.
Les modules centraux de session peuvent rester à la racine de leur domaine.

Le code runtime vit dans `src/`. Les sources d'assets restent dans `assets_src/` ; le jeu ne lit que `public/assets/`. Les scripts de contenu vivent dans `tools/`. La documentation active vit dans les six dossiers numérotés.

Pour trouver un dossier par intention, utilisez aussi [Où agir](../5-guides/ou-agir.md).
