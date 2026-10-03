---
title: Corrections P2 de l’audit de src
tags: [journal, maintenance, architecture, effect]
status: stable
updated: 2026-10-03
---

# Corrections P2 de l’audit de src

## Période

3 octobre 2026. Suite de l’[audit complet](audit-src-2026-10.md), appliquée après
le commit `22c9131`. Les rapports d’audit restent des fichiers locaux.

## Objectif

Traiter les fragilités P2 du code, séparer les responsabilités volumineuses et
rendre explicite la durée de vie des ressources. Conserver pas fixe, RNG,
ordre des actions et contrats de contenu. Les sujets P3 restent hors de cette passe.

## Livré et preuve

| Point P2 | Livré |
|---|---|
| Restauration debug XState | `resolveState` et `getPersistedSnapshot`, nouvel acteur avec snapshot, ancien acteur arrêté ; aucune écriture privée |
| Recul positionnel | interpolation du kick précédent/courant sans allocation ; choix `STABLE` / `HISTORIQUE` à amplitudes identiques |
| Loader | acquisition et orchestration conservées ; diagnostics, extras, colliders, objets et présentation séparés |
| Portes | contrats/configuration, géométrie et batching séparés de `DoorSystem` |
| Navigation | graphe, bake et A* séparés du service Effect ; Raycast injecté conservé |
| Ennemis | perception, navigation, physique et combat séparés du graphe et des décisions par état |
| FX | façade stable ; shake, flashes, decals, débris et jets d’eau dans leurs pools |
| Ramassages | propriétaire `PickupResources` par partie ; atlas attendu et textures préchauffées avant construction |
| Viewmodel | modèles chargés, contrats et calcul des séquences séparés de la présentation |
| Filtrage | canaux classiques, uniformes shader et entrées TSL explicites ; encodage des données conservé |

### Taille des orchestrateurs

Ces nombres décrivent une répartition, pas une suppression de fonctionnalités.

| Fichier | Avant | Après |
|---|---:|---:|
| `src/game/level/loading/loader.ts` | 1 674 lignes | 430 lignes |
| `src/game/level/doors/doors.ts` | 750 lignes | 324 lignes |
| `src/game/level/navigation/pathfinding.ts` | 567 lignes | 32 lignes |
| `src/game/entities/shared/enemyMachine.ts` | 748 lignes | 394 lignes |
| `src/render/fx/fx.ts` | 690 lignes | 65 lignes |

Le contrôle lexical des extractions de niveau compare 166 déclarations :
42 portes, 32 navigation et 92 chargement. Leurs tokens restent identiques
hors visibilité/imports. La comparaison de 27 corps de fonctions ennemies et
22 méthodes FX ne trouve pas de modification de leur corps après déplacement.
La façade FX conserve l’ordre shake → flashes → particules → jets, ainsi que
les capacités des pools et le flux RNG cosmétique partagé.

### Possession des ressources

`bootGameSession` attend l’atlas et prépare les textures avant de créer la
partie. Les objets habillés empruntent géométries et matériaux à leur session.
Le nettoyage d’un niveau ignore ces ressources empruntées : un hot reload ne
les invalide pas. `teardownGameSession` attend l’arrêt du niveau, puis libère
les ressources et le monde. Les libérations sont toutes tentées et les erreurs
agrégées. L’horloge du pouls des armes au sol repart de zéro à chaque partie.

Une erreur de préparation rejoint l’écran de retry via
`bootGameSessionWithRetry`. Aucun constructeur de billboard ne lance de
requête réseau. Les géométries du glTF d’armes abandonnées en cas d’échec ou
inutilisées sont libérées ; les géométries retenues restent vivantes.

### Comparaison du recul

Le panneau de tuning propose `Stable` et `Historique`, plus les curseurs de
position, pitch et durée de chaque arme. F9 enregistre/arrête une séquence ;
F10 permet de la rejouer dans chaque mode. Le défaut est l’interpolation
corrigée. Les intensités n’ont pas été retouchées. Le ressenti demande encore
une comparaison par le joueur ; aucune préférence perceptuelle n’est déduite
de la lecture du code.

### Contrôles et limites

- Construction de production et vérification TypeScript réussies, y compris
  les imports des tests existants.
- Graphe des imports statiques : 221 modules TS/TSX, 809 arêtes, aucun cycle
  runtime détecté. Ce graphe ne couvre pas les imports dynamiques externes.
- Diff vérifié sans erreur d’espacement ; documentation liée et actualisée.
- Aucun test ajouté ni exécuté. Les imports existants déplacés sont adaptés.
- Aucun playtest, rejeu, capture visuelle ni mesure GPU effectué. Les comparaisons
  lexicales et la compilation ne prouvent pas le comportement en jeu.

## Arbitrages

Les textures TSL ont des entrées explicites enregistrées dans
`textureRegistry.ts` ; le changement de filtrage ne parcourt pas arbitrairement
le graphe des nodes. Render targets, textures de profondeur et cubemaps gardent
leur contrat propre. L’agrandissement des textures configurables reste nearest.

Les calculs purs restent synchrones et ordinaires. Le service de navigation
reste Effect ; les acquisitions asynchrones ne quittent jamais la préparation
et ne passent jamais dans le pas fixe. Aucun ECS ni barrel n’est introduit.

## Leçons

Les extractions utiles réduisent le travail nécessaire pour comprendre un
système : l’orchestrateur montre maintenant l’ordre, les modules voisins portent
les calculs. La durée de vie des ressources partagées doit suivre leur
propriétaire plutôt que l’arbre Three.js auquel elles sont temporairement rattachées.
