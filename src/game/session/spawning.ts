import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Effect } from "effect";

import { assetUrl } from "../../core/assetPath";
import { runGameplaySync } from "../../core/runtime";
import { RaycastService } from "../../physics/raycast";
import { GROUP, interactionGroups } from "../../physics/world";
import { BillboardSprite } from "../../render/billboard";
import { enemySpriteQuad } from "../../render/enemySprites";
import { dressAmmoPickup, dressHealPickup, dressWeaponPickup, type WeaponPickupBillboard } from "../../render/pickups";
import { LightPool } from "../../render/lightPool";
import { PropSystem } from "../level/props";
import { DoorSystem } from "../level/doors";
import { VitreSystem } from "../level/vitres";
import { SanitaireSystem } from "../level/sanitaires";
import { Suit } from "../entities/suit";
import { suitConfig } from "../entities/suitConfig";
import { Director } from "../entities/director";
import { directorConfig } from "../entities/directorConfig";
import { createLevelSession, type LevelSession } from "../level/hotReload";
import { reportLoading } from "../../core/loadingProgress";
import { PathfindingService, navGraphStats } from "../level/pathfinding";
import { useGameStore } from "../state";
import { type GameSession } from "./gameSession";
import { type PersistentEngine } from "./gameEngine";

/**
 * Normales des sprites d'ennemis inclinées de 45° vers le haut : les lampes du
 * niveau v2 sont des néons de plafond, qu'un quad vertical ne voit presque pas.
 * see: docs/systems/rendu.md#éclairage-des-sprites
 */
const ENEMY_SPRITE_NORMAL_TILT = Math.PI / 4;

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
  // Le rendu interpole le CENTRE de la capsule : les pieds de l'atlas se
  // posent sur son bas, offset du KCC compris.
  const sheet = engine.suitSheet;
  const sprite = new BillboardSprite(engine.scene, sheet.atlases.humain, {
    rows: sheet.rows,
    normalTilt: ENEMY_SPRITE_NORMAL_TILT,
    ...enemySpriteQuad(sheet, suitConfig.capsuleHalfHeight + suitConfig.capsuleRadius + suitConfig.colliderOffset),
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
  const sheet = engine.directorSheet;
  const sprite = new BillboardSprite(engine.scene, sheet.atlases.humain, {
    rows: sheet.rows,
    normalTilt: ENEMY_SPRITE_NORMAL_TILT,
    ...enemySpriteQuad(
      sheet,
      directorConfig.capsuleHalfHeight + directorConfig.capsuleRadius + directorConfig.colliderOffset,
    ),
  });
  session.directorSprites.set(director.id, sprite);
  return director;
}

const GROUND_PROBE_GROUPS = interactionGroups(GROUP.PLAYER_SHOT, GROUP.WORLD);

/** Hauteur du premier collider du monde sous `point` (3 m au plus), `null` sinon. */
function groundBelow(session: GameSession, point: THREE.Vector3): number | null {
  const ray = new RAPIER.Ray({ x: point.x, y: point.y, z: point.z }, { x: 0, y: -1, z: 0 });
  const hit = runGameplaySync(
    RaycastService.use((raycast) =>
      raycast.castRay(session.physics, ray, 3, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, GROUND_PROBE_GROUPS),
    ),
  );
  return hit ? point.y - hit.timeOfImpact : null;
}

/**
 * Charge (ou recharge) `public/assets/levels/<name>.glb` dans `session` —
 * voir `game/level/hotReload.ts` pour le mécanisme de hot reload lui-même.
 * `engine`/`session` explicites, même raison que `spawnSuitAt` ci-dessus.
 * see: docs/systems/session.md#spawn-et-chargement-de-niveau
 */
export function loadGltfLevel(
  engine: PersistentEngine,
  session: GameSession,
  name: string,
): Promise<LevelSession | null> {
  const generation = ++session.levelLoadGeneration;
  const previous = session.gltfLevelSession;
  const install = (): LevelSession | null => {
    if (generation !== session.levelLoadGeneration) return null;
    const url = assetUrl(`assets/levels/${name}.glb`);
    const levelSession = createLevelSession(url, engine.scene, session.physics, {
      // Bornes du chargement : le `.glb` occupe la part du lion, le reste de
      // `main.ts` se partage ce qui l'encadre.
      onProgress: (fraction) => reportLoading("Chargement du niveau", 0.3 + fraction * 0.55),
      prepare: (handle, info) => {
        // Le glTF est là mais tout ce qui suit est SYNCHRONE et bloque : on
        // annonce l'étape avant de la commencer pour laisser React l'afficher.
        reportLoading("Construction du décor et des portes", 0.86);
        const doorSystem = new DoorSystem(handle.doors);
        const autoColliders = doorSystem.autoGroupColliders;
        for (const collider of autoColliders) collider.setEnabled(false);

        reportLoading("Cuisson du graphe de navigation", 0.92);
        const navGraphBounds = new THREE.Box3().setFromObject(handle.root);
        session.physics.refreshSceneQueries();
        let navGraph;
        try {
          navGraph = runGameplaySync(
            PathfindingService.use((pf) => pf.bake(session.physics, navGraphBounds)),
          );
        } finally {
          for (const collider of autoColliders) collider.setEnabled(true);
        }

        // Les portes déjà déverrouillées restent ouvertes après hot reload.
        for (const unlockedName of session.unlockedDoors) {
          doorSystem.open(unlockedName, session.player.position, { silent: true });
        }

        const vitreSystem = new VitreSystem(handle.vitres);
        const sanitaireSystem = new SanitaireSystem(handle.sanitaires);
        const lightPool = new LightPool(handle.lights);
        const propSystem = new PropSystem(handle.props, handle.root);

        // La boîte du `.glb` cède la place au vrai modèle, posé sur la surface
        // réellement sous elle. Ces mutations restent confinées au candidat.
        // Armes au sol : billboards dressés (`render/pickups.ts`), collectés
        // ici pour être animés au taux d'affichage (`updateFx`) — voir la doc
        // de tête de `WeaponPickupBillboard`.
        const weaponPickupBillboards: WeaponPickupBillboard[] = [];
        for (const useObject of handle.useObjects) {
          if (useObject.heals !== null) {
            dressHealPickup(useObject.object, groundBelow(session, useObject.position));
            continue;
          }
          if (useObject.ammo !== null) {
            dressAmmoPickup(useObject.object, groundBelow(session, useObject.position));
            continue;
          }
          const weapon =
            useObject.name === "use_crowbar"
              ? "melee"
              : useObject.name === "use_pistol"
                ? "pistol"
                : useObject.name === "use_shotgun"
                  ? "shotgun"
                  : null;
          if (!weapon) continue;
          weaponPickupBillboards.push(
            dressWeaponPickup(useObject.object, weapon, groundBelow(session, useObject.position)),
          );
        }

        const navStats = navGraphStats(navGraph);
        console.info(
          `[pathfinding] graphe baké — ${navStats.walkableCount}/${navStats.cellCount} cellules praticables, ` +
            `${navStats.edgeCount} arêtes (grille ${navStats.cols}×${navStats.rows}, pas ${navStats.cellSize} m)`,
        );
        console.info(
          `[level] "${name}.glb" chargé — colliders ${handle.stats.colliderCount} ` +
            `(cuboid ${handle.stats.colliderKindCounts.cuboid}, hull ${handle.stats.colliderKindCounts.convexHull}, ` +
            `trimesh ${handle.stats.colliderKindCounts.trimesh}), ` +
            `spawns Costard ${handle.stats.spawnSuitCount}, spawns Directeur ${handle.stats.spawnDirectorCount}, ` +
            `triggers ${handle.stats.triggerCount}, portes ${handle.stats.doorCount}, use ${handle.stats.useCount}, ` +
            `secrets ${handle.stats.secretCount}, meshes non préfixés ${handle.stats.unprefixedMeshCount}, ` +
            `lampes ${handle.stats.lightCount} (${lightPool.stats.actives} allumées), ` +
            `props ${handle.stats.propCount}, vitres ${handle.stats.vitreCount} ` +
            `(${handle.stats.vitreBatchCount} lots), sanitaires ${handle.stats.sanitaireCount} ` +
            `(${handle.stats.sanitaireBatchCount} lots), lots de décor ${handle.stats.decorBatchCount}`,
        );

        return () => {
          // Toutes les affectations de session restent dans ce commit : tant
          // que la préparation n'est pas intégralement terminée, l'ancien
          // niveau et ses systèmes constituent encore un ensemble cohérent.
          engine.fx.clearWaterJets();
          session.currentNavGraph = navGraph;
          session.doorSystem = doorSystem;
          session.vitreSystem = vitreSystem;
          session.sanitaireSystem = sanitaireSystem;
          session.lightPool = lightPool;
          session.propSystem = propSystem;
          session.weaponPickupBillboards = weaponPickupBillboards;

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
          if (info.isFirstLoad) {
            for (const spawn of handle.spawnSuits) {
              spawnSuitAt(engine, session, spawn.position.x, spawn.position.y, spawn.position.z);
            }
            for (const spawn of handle.spawnDirectors) {
              spawnDirectorAt(engine, session, spawn.position.x, spawn.position.y, spawn.position.z);
            }
          }

          useGameStore.getState().setSecretsTotal(handle.stats.secretCount);
        };
      },
    });
    session.gltfLevelSession = levelSession;
    return levelSession;
  };

  // Au boot, l'installation reste synchrone jusqu'à l'affectation de
  // `session.gltfLevelSession`. Lors d'un changement explicite depuis la
  // console, le nouveau chargement ne démarre qu'après l'arrêt complet de
  // l'ancien : aucun corps ne peut arriver après la libération de sa session.
  if (!previous) return Promise.resolve(install());
  return previous.stop().then(install);
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
