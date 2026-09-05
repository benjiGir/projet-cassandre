import * as THREE from "three";
import { Effect } from "effect";

import { runGameplaySync } from "../../core/runtime";
import { BillboardSprite } from "../../render/billboard";
import { Suit, SUIT_ATLAS_ROWS } from "../entities/suit";
import { Director, DIRECTOR_ATLAS_ROWS } from "../entities/director";
import { createLevelSession } from "../level/hotReload";
import { PathfindingService, navGraphStats } from "../level/pathfinding";
import { useGameStore } from "../state";
import { type GameSession } from "./gameSession";
import { type PersistentEngine, SUIT_SPRITE_HEIGHT, DIRECTOR_SPRITE_HEIGHT } from "./gameEngine";

/**
 * Extraction du refactor de `main.ts` (2229 lignes → modules, 2026-09-05) :
 * `spawnSuitAt`/`spawnDirectorAt`/`loadGltfLevel`/`debugFindPath` prenaient
 * déjà `session: GameSession` en paramètre EXPLICITE depuis le jalon M8 (pas
 * une fermeture sur la variable mutable `currentSession`) — raison
 * documentée sur `spawnSuitAt` ci-dessous, inchangée par ce refactor. Ce
 * jalon ajoute `engine: PersistentEngine` comme second type de paramètre
 * explicite, pour le même genre de raison : ces fonctions tournent aussi
 * PENDANT `lifecycle.ts::buildGameEngine`/`bootGameSession`, avant que
 * `engine.session` n'existe — `PersistentEngine` (pas `GameEngine`) leur est
 * donc appliqué partout, voir `gameEngine.ts` pour la justification complète.
 */

/**
 * Fait apparaître un Costard ET son `BillboardSprite`, toujours ensemble
 * (jamais l'un sans l'autre — un Costard sans sprite serait invisible mais
 * actif, un bug de lisibilité silencieux). `facing` par défaut : vise la
 * position COURANTE du joueur DE `session` au moment du spawn (pratique
 * aussi bien pour les 3 spawns initiaux que pour `cassandre.spawnSuit` en
 * cours de partie).
 *
 * `session` est un paramètre EXPLICITE (pas une lecture d'`engine.session`) :
 * cette fonction est aussi appelée DEPUIS `lifecycle.ts::bootGameSession`,
 * PENDANT la construction d'une NOUVELLE session qui n'est pas encore
 * devenue "la" session courante — lui faire lire `engine.session` pousserait
 * alors le Costard dans l'ANCIENNE partie (celle en cours de remplacement),
 * un bug d'un genre difficile à repérer en jeu (le Costard semblerait juste
 * ne jamais apparaître).
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
 * Charge (ou recharge) `public/assets/levels/<name>.glb` DANS `session` —
 * voir `game/level/hotReload.ts` pour le mécanisme de session/hot reload
 * lui-même (INCHANGÉ par ce refactor). `engine`/`session` explicites, même
 * raison que `spawnSuitAt` : appelée depuis `lifecycle.ts::bootGameSession`
 * pendant la construction d'une session qui n'est pas encore
 * `engine.session`, ET depuis la console (`cassandre.level.load`, qui doit
 * lui viser LA session courante — voir `devtools/consoleApi.ts`).
 */
export function loadGltfLevel(engine: PersistentEngine, session: GameSession, name: string): void {
  session.gltfLevelSession?.stop();
  const url = `/assets/levels/${name}.glb`;
  session.gltfLevelSession = createLevelSession(url, engine.scene, session.physics, {
    onLoaded: (handle, info) => {
      const navGraphBounds = new THREE.Box3().setFromObject(handle.root);
      session.currentNavGraph = runGameplaySync(
        PathfindingService.use((pf) => pf.bake(session.physics, navGraphBounds)),
      );
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
          `secrets ${handle.stats.secretCount}, meshes non préfixés ${handle.stats.unprefixedMeshCount}`,
      );
      // Seul le TOUT PREMIER chargement DE CETTE SESSION déplace le
      // joueur : un hot reload ne doit JAMAIS respawn (voir la doc de tête
      // de `hotReload.ts`) — c'est le critère central de ce pipeline
      // (<60 s, joueur en place). `isFirstLoad` est réarmé à `true` par
      // `createLevelSession` à CHAQUE nouvel appel (nouvelle `session`,
      // donc nouvelle fermeture) — un "Rejouer" respawn donc bien le
      // joueur sur `spawn_player`, exactement comme le tout premier boot.
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
