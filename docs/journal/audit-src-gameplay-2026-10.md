---
title: Audit du code gameplay — octobre 2026
tags: [audit, gameplay, effect, architecture]
status: stable
updated: 2026-10-02
---

# Audit du code gameplay — octobre 2026

**Suite du 3 octobre 2026 :** les recommandations P2 sont traitées dans
[Corrections P2](audit-src-p2-2026-10.md). Les constats ci-dessous décrivent
l’état du 2 octobre avant cette seconde passe.


## Périmètre et méthode

Lecture des 56 fichiers présents dans `src/game/` avant intervention : joueur,
armes, ennemis, niveau, session, orchestration des pas et outils de développement.
Les commentaires ont été traités avant toute modification de comportement.
Le scanner TypeScript comptait 5 050 lignes de commentaires ; la première passe
les a ramenées à 1 904, soit −62,3 %. Les tokens exécutables des 56 fichiers
étaient identiques avant/après cette passe. Le snapshot global de cette étape
est décrit dans l’[audit général](audit-src-2026-10.md).

Les explications utiles ont été réorganisées dans les références de gameplay,
avec des liens depuis le code. Les commentaires locaux de contrat, d’unité,
d’invariant et de piège restent près de leur usage. Les métriques du script
historique `audit_comments.py` ne sont pas comparables à celles du scanner :
son analyse des blocs JSDoc monolignes peut compter du code comme commentaire.

Aucun test n’a été créé ni exécuté. Les imports et données des fixtures
existantes ont été adaptés aux contrats déplacés. La compilation et la
construction sont prises en charge par l’audit général ; elles ne prouvent pas
le résultat visuel, le déterminisme du rejeu ni la correction du rollback à
l’exécution.

## Corrections effectuées

### Contrats indépendants des implémentations

| Contrat | Module propriétaire |
|---|---|
| Vue du portrait, debug et récap HUD | `game/hud/hudTypes.ts` |
| Valeur initiale du portrait | `game/session/presentation/portraitState.ts` |
| Santé maximale initiale | `game/session/player/playerState.ts` |
| Spawns, triggers, interactions, statistiques et handle de niveau | `game/level/loading/levelTypes.ts` |
| Armes, événements de tir/impact et horloges du viewmodel | `game/player/weapons/weaponTypes.ts` |
| Configuration, contexte, états et événements ennemis | `game/entities/shared/enemyTypes.ts` |

Les contrats de flux écran et d’input viennent respectivement de
`app/navigation/gameFlowTypes.ts` et `core/input/inputTypes.ts`. Les contrats sprites proviennent
de `render/sprites/enemySpriteTypes.ts`. Les imports pointent vers leurs propriétaires,
sans réexport de compatibilité depuis les implémentations.

Le calcul du récap (`session/score.ts`) et la machine de portrait ne chargent
plus Zustand. La publication du récap est isolée dans `session/recap.ts`.
`GameSession` possède désormais santé maximale, secrets trouvés et total de
secrets ; le HUD reçoit les valeurs, et le gameplay ne relit plus ces données
depuis `debug`. Les totaux et l’identité WeakSet des secrets gardent le
comportement existant pendant le hot reload.

### Injection Effect de navigation

Le service de navigation recréait auparavant `RaycastService.layer` dans son
`bake`, en ignorant l’instance injectée par la composition du jeu. Il capture
maintenant cette instance à la construction du service et la transmet au bake.
La composition du runtime fournit explicitement cette dépendance.

### Possession et rollback des ressources de niveau

L’ancienne acquisition installait son finalizer après avoir attaché la racine
et créé les corps. Un défaut pendant cette construction pouvait laisser le
niveau partiellement attaché et ses ressources sans propriétaire.

`LevelResources` est acquis sous Scope avant le premier changement. Chaque corps
est suivi immédiatement après `createRigidBody`, avant la création du collider.
Géométries, matériaux et textures initiaux, matériaux convertis, clones de bake,
géométries temporaires de fusion et lots de portes sont suivis dès leur création.
Les ressources déjà libérées par une fusion sont retirées du suivi, pour éviter
une seconde libération. Le nettoyage tente toutes les libérations et remonte les
échecs ensemble. Un exit en échec ferme le Scope manuel ; le succès garde le
niveau vivant jusqu’à `handle.dispose()`.

## Bilan Effect et invariants

Les appels Effect asynchrones du gameplay inspecté restent dans le chargement
et le polling de hot reload. Le pas fixe et la présentation utilisent la
frontière `runGameplaySync`. Les horloges de simulation et machines ennemies
avancent au pas fixe ; les minuteries de texte sont de présentation. Les
mesures `performance.now()` de navigation ne choisissent jamais un chemin.

Aucun appel exécutable à `Math.random()` ni au service Effect Random par défaut
n’a été trouvé. Les flux armes, ennemis, répliques et contenu de props passent
par `DeterministicRandom`. Ajouter Effect à chaque fonction pure n’améliorerait
pas cette frontière : les fonctions mathématiques restent ordinaires, les
services et ressources portent les dépendances et la durée de vie.

## Chantiers restants, classés

### P2 — supprimer l’écriture dans un champ privé XState

`forceEnemyState` écrit encore `actor._snapshot`. Ce chemin est utilisé par les
setters de debug et les fixtures historiques ; il ne passe pas par les actions
d’entrée des états. Une mise à jour XState peut casser ce contournement.

La piste est un port explicite de restauration debug utilisant les snapshots
publics et la recréation d’acteur (`createActor` avec snapshot), détenu par les
wrappers Suit/Director. Il faut conserver le contexte et les références Rapier,
arrêter l’acteur remplacé et vérifier que les actions d’entrée ne sont pas
rejouées. Remplacer aveuglément ce chemin par un événement ciblant un état
changerait ses effets et les scénarios de test. Ce chantier demande une
validation dédiée avant remplacement.

### P2 — clarifier l’interpolation du recul positionnel

`WeaponSystem` capture `previousRecoilKickPosition`, mais `viewmodelPose` utilise
uniquement le kick courant multiplié par l’enveloppe interpolée. Le pitch,
lui, interpole son kick précédent/courant. Cela peut produire un saut de pose
lorsque l’impulsion change. La correction candidate est un `lerpVectors` vers
la sortie existante puis l’application de l’enveloppe, sans allocation. Elle
n’a pas été appliquée pendant cet audit : sa sensation doit être comparée sous
le harnais de déplacement/armes, sans figer un réglage par lecture de code.

### P2 — découper les responsabilités encore volumineuses

- `level/loader.ts` : extraire diagnostics Schema/formatage et parsers d’extras,
  puis fabriques de colliders. Garder l’acquisition et l’orchestration dans le
  loader, avec le même propriétaire de ressources.
- `level/doors.ts` : isoler contrats/configuration et géométrie d’ouverture de
  l’état mutable des groupes. Les calculs de pivot, scale et signe doivent
  rester ensemble afin de préserver leurs conventions.
- `entities/enemyMachine.ts` : les contrats sont extraits ; perception,
  navigation et intégration KCC peuvent ensuite devenir des fonctions privées
  par responsabilité, sans ECS ni changement de graphe d’états.
- `level/pathfinding.ts` : séparer le contrat de graphe et le bake Rapier de
  l’algorithme A*. Conserver l’ordre stable des voisins et le départage par index.

Le nombre de modules n’est pas un objectif ; ces extractions doivent réduire
les dépendances réellement nécessaires et laisser les parcours principaux lisibles.

## Références

- [Contrats généraux conservés](../6-reference/notes-code-gameplay.md)
- [Contrats joueur et armes](../6-reference/notes-code-gameplay-joueur.md)
- [Contrats ennemis](../6-reference/notes-code-gameplay-ennemis.md)
- [Contrats niveau](../6-reference/notes-code-gameplay-niveau.md)
- [Contrats des outils](../6-reference/notes-code-gameplay-outils.md)
- [ADR 0036 : contrats feuilles et miroir HUD](../decisions/0036-contrats-feuilles-et-store-hud.md)
