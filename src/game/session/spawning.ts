import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Effect } from "effect";

import { assetUrl } from "../../core/loading/assetPath";
import { runGameplaySync } from "../../app/runtime/gameRuntime";
import { RaycastService } from "../../physics/raycast";
import { GROUP, interactionGroups } from "../../physics/world";
import { BillboardSprite } from "../../render/sprites/billboard";
import { enemyHumanAtlas, enemySpriteQuad } from "../../render/sprites/enemySprites";
import { HUMAN_SPRITE_MINIMUM_LIGHT } from "../../render/sprites/enemySkinConfig";
import {
  dressAmmoPickup,
  dressFoodPickup,
  dressHealPickup,
  dressWeaponPickup,
  type WeaponPickupBillboard,
} from "../../render/pickups/pickups";
import { dressCardPickup, type CardPickupBillboard } from "../../render/pickups/cardPickups";
import { LightPool } from "../../render/environment/lightPool";
import { PropSystem } from "../level/props/props";
import { DoorSystem } from "../level/doors/doors";
import { VitreSystem } from "../level/interactions/vitres";
import { SanitaireSystem } from "../level/sanitaires/sanitaires";
import { EcranSystem } from "../level/interactions/ecrans";
import { CameraViewSystem } from "../level/interactions/cameras";
import { warmShaderDouches } from "../level/sanitaires/doucheShader";
import { RenderService } from "../../render/pipeline/renderService";
import { Suit } from "../entities/suit/suit";
import type { SuitKind } from "../entities/suit/suitConfig";
import { Director } from "../entities/director/director";
import { directorConfig } from "../entities/director/directorConfig";
import { createLevelSession, type LevelSession } from "../level/loading/hotReload";
import { loadLevelSpaces } from "../level/loading/loadLevelSpaces";
import { sortLevelSpaces } from "../level/navigation/levelSpaces";
import { LEVEL_EVENTS } from "./progression/levelEvents";
import { readLevelScript } from "./progression/levelScriptSetup";
import { reportLoading, letBrowserPaint } from "../../core/loading/loadingProgress";
import { PathfindingService } from "../level/navigation/pathfinding";
import { navGraphStats } from "../level/navigation/navGraph";
import { useGameStore } from "../hud/state";
import { type GameSession } from "./gameSession";
import { type PersistentEngine } from "./gameEngine";

// see: docs/archive/systems-rendu.md#éclairage-des-sprites
const ENEMY_SPRITE_NORMAL_TILT = Math.PI / 4;

// see: docs/archive/systems-session.md#spawn-et-chargement-de-niveau
/** Planche de sprites d'une espèce — le seul endroit qui associe les deux. */
export function suitSheetFor(engine: Pick<PersistentEngine, "suitSheet" | "rampantSheet" | "vigileSheet">, kind: SuitKind) {
  switch (kind) {
    case "costard":
      return engine.suitSheet;
    case "rampant":
      return engine.rampantSheet;
    case "vigile":
      return engine.vigileSheet;
    default:
      return kind satisfies never;
  }
}

export function spawnSuitAt(
  engine: PersistentEngine,
  session: GameSession,
  x: number,
  feetY: number,
  z: number,
  kind: SuitKind = "costard",
  materialize = false,
): Suit {
  const facing = new THREE.Vector3(session.player.position.x - x, 0, session.player.position.z - z);
  if (facing.lengthSq() < 1e-6) facing.set(0, 0, 1);
  facing.normalize();

  const suit = session.suitManager.spawnSuit(x, feetY, z, facing, kind);
  // Le rendu interpole le CENTRE de la capsule : les pieds de l'atlas se
  // posent sur son bas, offset du KCC compris.
  const sheet = suitSheetFor(engine, kind);
  const cfg = suit.cfg;
  const atlas = kind === "rampant" ? sheet.atlases.humain : enemyHumanAtlas(sheet, suit.appearanceIndex);
  const sprite = new BillboardSprite(engine.scene, atlas, {
    rows: sheet.rows,
    normalTilt: ENEMY_SPRITE_NORMAL_TILT,
    minimumLight: kind === "rampant" ? 0 : HUMAN_SPRITE_MINIMUM_LIGHT,
    ...enemySpriteQuad(sheet, cfg.capsuleHalfHeight + cfg.capsuleRadius + cfg.colliderOffset),
  });
  session.suitSprites.set(suit.id, sprite);
  if (materialize) {
    suit.beginAppearance();
    sprite.updatePose(engine.camera, suit.position, suit.forward);
    engine.fx.spawnEnemyAppearance(sprite, feetY);
  }
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
 * Compile les shaders TSL d'explosion, de tir et d'apparition sous le chargement, dans les
 * mêmes conditions que celui des douches : framebuffer écran, et ancienne
 * racine détachée au hot reload pour que ses lampes n'entrent pas dans la
 * variante compilée.
 * see: docs/4-technique/rendu.md#préparation-des-douches
 */
async function warmFxShaders(engine: PersistentEngine, previousRoot?: THREE.Object3D): Promise<void> {
  const previousTarget = engine.renderer.getRenderTarget();
  const previousParent = previousRoot?.parent;
  const render = () => {
    engine.renderer.setRenderTarget(null);
    runGameplaySync(RenderService.use((rs) => rs.render(engine.renderer, engine.scene, engine.camera)));
  };
  try {
    previousRoot?.removeFromParent();
    await engine.fx.warmExplosions(engine.camera, render);
    await engine.fx.warmMuzzleFlashes(engine.camera, render);
    await engine.fx.warmEnemyAppearances(engine.camera, render);
  } finally {
    if (previousRoot && previousParent) previousParent.add(previousRoot);
    // Efface l'image de préparation avant le prochain paint.
    render();
    engine.renderer.setRenderTarget(previousTarget);
  }
}

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
      prepare: async (handle, info) => {
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
        const ecranSystem = new EcranSystem(handle.ecrans);
        const cameraView = new CameraViewSystem(handle.cams);
        const lightPool = new LightPool(handle.lights);
        const propSystem = new PropSystem(handle.props, handle.root);

        // see: docs/6-reference/notes-code-gameplay.md#session-et-moteur
        const pickupResources = session.pickupResources;
        if (!pickupResources) throw new Error("Ressources des ramassages absentes pendant le chargement");
        const weaponPickupBillboards: WeaponPickupBillboard[] = [];
        const cardPickupBillboards: CardPickupBillboard[] = [];
        for (const useObject of handle.useObjects) {
          if (useObject.grantsCard) {
            cardPickupBillboards.push(dressCardPickup(
              useObject.object, useObject.grantsCard, groundBelow(session, useObject.position), engine.cardPickupTextures,
            ));
            if (session.cards.has(useObject.grantsCard)) useObject.object.visible = false;
            continue;
          }
          if (useObject.heals !== null) {
            const ground = groundBelow(session, useObject.position);
            if (useObject.aliment) dressFoodPickup(useObject.object, ground, useObject.aliment, pickupResources);
            else dressHealPickup(useObject.object, ground, pickupResources);
            continue;
          }
          if (useObject.ammo !== null) {
            dressAmmoPickup(useObject.object, groundBelow(session, useObject.position), pickupResources);
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
            dressWeaponPickup(useObject.object, weapon, groundBelow(session, useObject.position), pickupResources),
          );
        }

        const script = readLevelScript(
          handle.triggers, handle.spawnSuits, handle.ecrans.map((ecran) => ecran.name), LEVEL_EVENTS,
          handle.doors.map((door) => door.name),
        );
        for (const problem of script.problems) console.error(`[level] ${problem}`);
        const planSpaces = (await loadLevelSpaces(name)) ?? [];
        const levelSpaces = planSpaces.length + script.placeSpaces.length > 0
          ? sortLevelSpaces([...planSpaces, ...script.placeSpaces])
          : null;

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
            `(${handle.stats.sanitaireBatchCount} lots), écrans ${handle.stats.ecranCount} ` +
            `(${handle.stats.ecranBatchCount} lots), caméras ${handle.cams.length}, ` +
            `lots de décor ${handle.stats.decorBatchCount}`,
        );

        reportLoading("Préparation des effets d’eau", 0.96);
        if (info.isFirstLoad && !engine.flow.isPlaying()) await letBrowserPaint();
        lightPool.update(info.isFirstLoad ? (handle.spawnPlayer?.position ?? session.player.position) : engine.camera.position);
        await warmShaderDouches(
          engine.renderer, engine.scene, engine.camera, handle.root, session.gltfLevelSession?.current?.root,
        );
        reportLoading("Préparation des effets", 0.97);
        await warmFxShaders(engine, session.gltfLevelSession?.current?.root);

        return () => {
          // Toutes les affectations de session restent dans ce commit : tant
          // que la préparation n'est pas intégralement terminée, l'ancien
          // niveau et ses systèmes constituent encore un ensemble cohérent.
          engine.fx.clearWaterJets();
          session.currentNavGraph = navGraph;
          session.levelSpaces = levelSpaces;
          session.placeLines = script.placeLines;
          session.scriptTriggers = script.triggers;
          session.doorSystem = doorSystem;
          session.vitreSystem = vitreSystem;
          session.sanitaireSystem = sanitaireSystem;
          session.ecranSystem = ecranSystem;
          session.cameraView = cameraView;
          session.lightPool = lightPool;
          session.propSystem = propSystem;
          session.weaponPickupBillboards = weaponPickupBillboards;
          session.cardPickupBillboards = cardPickupBillboards;

          // Seul le TOUT PREMIER chargement DE CETTE SESSION déplace le joueur
          // — un hot reload ne doit JAMAIS respawn (voir `hotReload.ts`).
          if (info.isFirstLoad && handle.spawnPlayer) {
            session.player.spawn(handle.spawnPlayer.position.x, handle.spawnPlayer.position.y, handle.spawnPlayer.position.z);
            engine.look.yaw = handle.spawnPlayer.yaw;
            engine.look.pitch = 0;
          }

          // `handle.spawnSuits` (Empties `spawn_suit_*`, voir `loader.ts`) :
          // MÊME garde `isFirstLoad` que `spawn_player` juste au-dessus.
          if (info.isFirstLoad) {
            // Un spawn qui porte un `groupe` attend son réveil par le script de niveau.
            for (const spawn of handle.spawnSuits) {
              if (spawn.group !== null) continue;
              spawnSuitAt(engine, session, spawn.position.x, spawn.position.y, spawn.position.z, spawn.kind);
            }
            for (const spawn of handle.spawnDirectors) {
              spawnDirectorAt(engine, session, spawn.position.x, spawn.position.y, spawn.position.z);
            }
          }

          session.secretsTotal = handle.stats.secretCount;
          useGameStore.getState().setSecretsTotal(session.secretsTotal);
        };
      },
    });
    session.gltfLevelSession = levelSession;
    return levelSession;
  };

  if (!previous) return Promise.resolve(install());
  return previous.stop().then(install);
}

export function debugFindPath(session: GameSession, from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null {
  const graph = session.currentNavGraph;
  if (!graph) return null;
  const result = runGameplaySync(
    PathfindingService.use((pf) => pf.findPath(graph, from, to)).pipe(Effect.catch(() => Effect.succeed(null))),
  );
  return result ? Array.from(result) : null;
}
