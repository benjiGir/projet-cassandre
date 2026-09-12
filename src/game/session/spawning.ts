import * as THREE from "three";
import { Effect } from "effect";

import { assetUrl } from "../../core/assetPath";
import { runGameplaySync } from "../../core/runtime";
import { BillboardSprite } from "../../render/billboard";
import { LightPool } from "../../render/lightPool";
import { Suit, SUIT_ATLAS_ROWS } from "../entities/suit";
import { Director, DIRECTOR_ATLAS_ROWS } from "../entities/director";
import { createLevelSession } from "../level/hotReload";
import { PathfindingService, navGraphStats } from "../level/pathfinding";
import { useGameStore } from "../state";
import { type GameSession } from "./gameSession";
import { type PersistentEngine, SUIT_SPRITE_HEIGHT, DIRECTOR_SPRITE_HEIGHT } from "./gameEngine";

/**
 * Fait apparaître un Costard ET son `BillboardSprite`, toujours ensemble —
 * un Costard sans sprite serait invisible mais actif, un bug de lisibilité
 * silencieux. `facing` par défaut vise la position courante du joueur.
 *
 * `session` est un paramètre EXPLICITE (pas une lecture d'`engine.session`) :
 * lui faire lire `engine.session` pousserait le Costard dans l'ANCIENNE
 * partie pendant un `bootGameSession` en cours (bug silencieux : l'entité
 * semblerait juste ne jamais apparaître).
 * see: docs/systems/session.md#spawn-et-chargement-de-niveau
 */
export function spawnSuitAt(engine: PersistentEngine, session: GameSession, x: number, feetY: number, z: number): Suit {
  const facing = new THREE.Vector3(session.player.position.x - x, 0, session.player.position.z - z);
  if (facing.lengthSq() < 1e-6) facing.set(0, 0, 1);
  facing.normalize();

  const suit = session.suitManager.spawnSuit(x, feetY, z, facing);
  const sprite = new BillboardSprite(engine.scene, engine.suitAtlas, {
    rows: SUIT_ATLAS_ROWS,
    height: SUIT_SPRITE_HEIGHT,
    verticalAnchor: 0.5,
  });
  session.suitSprites.set(suit.id, sprite);
  return suit;
}

/** Même rôle que `spawnSuitAt`, pour le Directeur — même raison pour les paramètres `engine`/`session` explicites. */
export function spawnDirectorAt(
  engine: PersistentEngine,
  session: GameSession,
  x: number,
  feetY: number,
  z: number,
): Director {
  const facing = new THREE.Vector3(session.player.position.x - x, 0, session.player.position.z - z);
  if (facing.lengthSq() < 1e-6) facing.set(0, 0, 1);
  facing.normalize();

  const director = session.directorManager.spawnDirector(x, feetY, z, facing);
  const sprite = new BillboardSprite(engine.scene, engine.directorAtlas, {
    rows: DIRECTOR_ATLAS_ROWS,
    height: DIRECTOR_SPRITE_HEIGHT,
    verticalAnchor: 0.5,
  });
  session.directorSprites.set(director.id, sprite);
  return director;
}

/**
 * Charge (ou recharge) `public/assets/levels/<name>.glb` dans `session` —
 * voir `game/level/hotReload.ts` pour le mécanisme de hot reload lui-même.
 * `engine`/`session` explicites, même raison que `spawnSuitAt` ci-dessus.
 * see: docs/systems/session.md#spawn-et-chargement-de-niveau
 */
export function loadGltfLevel(engine: PersistentEngine, session: GameSession, name: string): void {
  session.gltfLevelSession?.stop();
  const url = assetUrl(`assets/levels/${name}.glb`);
  session.gltfLevelSession = createLevelSession(url, engine.scene, session.physics, {
    onLoaded: (handle, info) => {
      const navGraphBounds = new THREE.Box3().setFromObject(handle.root);
      session.physics.refreshSceneQueries();
      session.currentNavGraph = runGameplaySync(
        PathfindingService.use((pf) => pf.bake(session.physics, navGraphBounds)),
      );
      // Pool de lampes : reconstruit à CHAQUE chargement (le hot reload peut
      // ajouter, déplacer ou retirer des `light_*`), et dès maintenant plutôt
      // qu'à la première image — une scène qui dépasse le mur d'uniformes ne
      // lève aucune exception, elle affiche du vide.
      // see: docs/decisions/0026-visibilite-par-espace-et-pool-de-lampes.md
      session.lightPool = new LightPool(handle.lights);

      const navStats = navGraphStats(session.currentNavGraph);
      console.info(
        `[pathfinding] graphe baké — ${navStats.walkableCount}/${navStats.cellCount} cellules praticables, ` +
          `${navStats.edgeCount} arêtes (grille ${navStats.cols}×${navStats.rows}, pas ${navStats.cellSize} m)`,
      );

      console.info(
        `[level] "${name}.glb" chargé — colliders ${handle.stats.colliderCount}, ` +
          `spawns Costard ${handle.stats.spawnSuitCount}, spawns Directeur ${handle.stats.spawnDirectorCount}, ` +
          `triggers ${handle.stats.triggerCount}, ` +
          `portes ${handle.stats.doorCount}, use ${handle.stats.useCount}, ` +
          `secrets ${handle.stats.secretCount}, meshes non préfixés ${handle.stats.unprefixedMeshCount}, ` +
          `lampes ${handle.stats.lightCount} (${session.lightPool.stats.actives} allumées), ` +
          `lots de décor ${handle.stats.decorBatchCount}`,
      );
      // Seul le TOUT PREMIER chargement DE CETTE SESSION déplace le joueur
      // — un hot reload ne doit JAMAIS respawn (voir `hotReload.ts`).
      // see: docs/systems/session.md#spawn-et-chargement-de-niveau
      if (info.isFirstLoad && handle.spawnPlayer) {
        session.player.spawn(handle.spawnPlayer.position.x, handle.spawnPlayer.position.y, handle.spawnPlayer.position.z);
        engine.look.yaw = handle.spawnPlayer.yaw;
        engine.look.pitch = 0;
      }

      // `handle.spawnSuits` (Empties `spawn_suit_*`, voir `loader.ts`) :
      // MÊME garde `isFirstLoad` que `spawn_player` juste au-dessus.
      // `SuitManager` n'expose aucun retrait en masse aujourd'hui (seul un
      // retrait par mort individuelle) — un hot reload PENDANT une partie
      // ne duplique donc jamais de Costards et n'interrompt jamais un
      // combat en cours.
      if (info.isFirstLoad) {
        for (const spawn of handle.spawnSuits) {
          spawnSuitAt(engine, session, spawn.position.x, spawn.position.y, spawn.position.z);
        }
        // `handle.spawnDirectors` (Empties `spawn_director_*`) : même garde
        // `isFirstLoad`, même raison exacte que `spawn_suit_*` ci-dessus.
        for (const spawn of handle.spawnDirectors) {
          spawnDirectorAt(engine, session, spawn.position.x, spawn.position.y, spawn.position.z);
        }
      }

      // Compteur de secrets (`debug.secretsTotal`) : fixé à CHAQUE
      // chargement (pas seulement `isFirstLoad`) puisque `handle.secrets`
      // change avec le niveau chargé — contrairement aux spawns, ce n'est
      // pas un événement ponctuel de partie mais une propriété du niveau
      // courant.
      useGameStore.getState().setSecretsTotal(handle.stats.secretCount);
    },
  });
}

/**
 * Wrapper console pour `PathfindingService.findPath` sur le graphe
 * COURANT DE `session` (`cassandre.pathfinding.findPath(...)`), pour
 * visualiser/vérifier un chemin en direct. `null` si aucun graphe n'est
 * encore baké ou si aucun chemin n'a été trouvé — jamais d'exception qui
 * remonterait à la console.
 */
export function debugFindPath(session: GameSession, from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null {
  const graph = session.currentNavGraph;
  if (!graph) return null;
  const result = runGameplaySync(
    PathfindingService.use((pf) => pf.findPath(graph, from, to)).pipe(Effect.catch(() => Effect.succeed(null))),
  );
  return result ? Array.from(result) : null;
}
