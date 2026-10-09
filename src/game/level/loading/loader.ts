import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Effect, Exit, Scope } from "effect";
import { LevelResources } from "./levelResources";
import type {
  SpawnPoint,
  NamedSpawn,
  TriggerVolume,
  UseObject,
  SecretZone,
  LevelStats,
  LevelHandle,
} from "./levelTypes";
import type { PhysicsWorld } from "../../../physics/world";
import { GameRuntime } from "../../../app/runtime/gameRuntime";
import { mergeStaticDecor } from "./mergeStaticDecor";
import type { PropInfo } from "../props/props";
import type { DoorInfo } from "../doors/doorTypes";
import { batchDoorMeshes } from "../doors/doorBatching";
import { mergeVitreDecor, type VitreCandidate } from "../interactions/vitres";
import { mergeSanitaireDecor, type SanitaireCandidate } from "../sanitaires/sanitaires";
import { mergeEcranDecor, type EcranCandidate } from "../interactions/ecrans";
import type { CamPoint } from "../interactions/cameras";
import { initialiserDouches } from "../sanitaires/douches";
import { initializeStoreSign } from "../../../render/environment/storeSign";
import { createFountainWater } from "../../../render/environment/fountain/fountainWater";
import { STORE_SIGN_PREFIX } from "../../../render/environment/storeSignConfig";
import { LevelFetchError, validateSpawnPlayerCountEffect } from "./levelDiagnostics";
import { blenderName, readSpawnGroup } from "./levelExtras";
import {
  isAxisAlignedBox,
  buildStaticColliderSafe,
  buildCuboidCollider,
  buildConvexHullColliderSafe,
  buildTriggerSafe,
} from "./levelColliders";
import {
  extractSpawnPoint,
  buildDoorEffect,
  buildVitreCandidateEffect,
  buildSanitaireCandidateEffect,
  buildEcranCandidateEffect,
  buildPropEffect,
  buildUseObjectEffect,
  buildSecretZone,
} from "./levelObjects";
import { convertToLambert, buildLevelLight } from "./levelPresentation";
import { readTrainLevel, TrainLevelError } from "../trains/trainLevelData";
import { LevelTrains } from "../trains/levelTrains";
import { MetroBlockout } from "../blockout/metroBlockout";

// Point d'entrée.

interface LevelResource extends Omit<LevelHandle, "dispose" | "suspend"> {
  readonly bodies: readonly RAPIER.RigidBody[];
}

function buildLevelResourceEffect(
  gltf: GLTF,
  scene: THREE.Scene,
  physics: PhysicsWorld,
  resources: LevelResources,
): Effect.Effect<LevelResource> {
  return Effect.gen(function* () {
    const root = gltf.scene;
    scene.add(root);
    // Un seul passage sur tout le sous-arbre AVANT toute lecture de matrixWorld.
    root.updateWorldMatrix(true, true);

    const nodes: THREE.Object3D[] = [];
    root.traverse((obj) => nodes.push(obj));

    const bodies = resources.bodies;

    let spawnPlayer: SpawnPoint | null = null;
    let spawnPlayerCount = 0;
    const spawnSuits: NamedSpawn[] = [];
    const lights: THREE.PointLight[] = [];
    const spawnDirectors: NamedSpawn[] = [];
    const triggers: TriggerVolume[] = [];
    const doors: DoorInfo[] = [];
    const props: PropInfo[] = [];
    const vitreCandidates: VitreCandidate[] = [];
    const sanitaireCandidates: SanitaireCandidate[] = [];
    const ecranCandidates: EcranCandidate[] = [];
    const cams: CamPoint[] = [];
    const useObjects: UseObject[] = [];
    const secrets: SecretZone[] = [];

    let colliderCount = 0;
    const colliderKindCounts = { cuboid: 0, convexHull: 0, trimesh: 0 };
    let unprefixedMeshCount = 0;

    // Un mesh sous une porte, un prop physique ou un objet interactif, ou visé
    // par une animation, bouge ou doit rester adressable : il ne rejoint jamais
    // un lot fusionné.
    const movableRoots = new Set(
      nodes.filter((o) => {
        const n = blenderName(o);
        return (
          n.startsWith("door_") ||
          n.startsWith("use_") ||
          n.startsWith("prop_") ||
          n.startsWith("train_modele_") ||
          n.startsWith("stage_voyage_")
        );
      }),
    );
    const animatedNodeNames = new Set(
      gltf.animations.flatMap((clip) => clip.tracks.map((t) => THREE.PropertyBinding.parseTrackName(t.name).nodeName)),
    );
    const isMovable = (obj: THREE.Object3D): boolean => {
      for (let o: THREE.Object3D | null = obj; o && o !== root; o = o.parent) {
        if (movableRoots.has(o) || animatedNodeNames.has(o.name)) return true;
      }
      return false;
    };
    const decorCandidates: THREE.Mesh[] = [];

    for (const obj of nodes) {
      // Nom "tel que tapé dans Blender", PAS `obj.name` — voir `blenderName`.
      const name = blenderName(obj);
      if (/^(nav_voie_|traversee_train_|refuge_train_)/.test(name)) {
        obj.visible = false;
        continue;
      }

      // Empties : jamais un THREE.Mesh, traités avant le filtre `instanceof`.
      if (name === "spawn_player") {
        spawnPlayerCount++;
        if (spawnPlayerCount === 1) spawnPlayer = extractSpawnPoint(obj);
        continue;
      }
      if (name.startsWith("spawn_suit_")) {
        const position = new THREE.Vector3();
        obj.getWorldPosition(position);
        spawnSuits.push({ name, position, group: readSpawnGroup(obj) });
        continue;
      }
      // Rampant : même liste et mêmes règles (`groupe`) qu'un Costard, une autre espèce.
      if (name.startsWith("spawn_rampant_")) {
        const position = new THREE.Vector3();
        obj.getWorldPosition(position);
        spawnSuits.push({ name, position, group: readSpawnGroup(obj), kind: "rampant" });
        continue;
      }
      if (name.startsWith("spawn_vigile_")) {
        const position = new THREE.Vector3();
        obj.getWorldPosition(position);
        spawnSuits.push({ name, position, group: readSpawnGroup(obj), kind: "vigile" });
        continue;
      }
      if (name.startsWith("light_")) {
        // Attachée à `root` et non à la scène : elle disparaît avec le niveau,
        // comme tout le reste du `.glb`.
        lights.push(buildLevelLight(obj, name));
        continue;
      }
      if (name.startsWith("spawn_director_")) {
        const position = new THREE.Vector3();
        obj.getWorldPosition(position);
        spawnDirectors.push({ name, position, group: null });
        continue;
      }
      if (name.startsWith("cam_")) {
        // Empty, jamais un mesh (voir `validate_level.py`) : position ET
        // orientation MONDE, figées à la construction.
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        obj.getWorldPosition(position);
        obj.getWorldQuaternion(quaternion);
        const label =
          typeof (obj.userData as Record<string, unknown>).nom === "string"
            ? ((obj.userData as Record<string, unknown>).nom as string)
            : name;
        cams.push({ name, position, quaternion, label });
        continue;
      }

      if (!(obj instanceof THREE.Mesh)) continue;

      // Conversion rétro et filtrage avant le routage de chaque mesh, préfixé ou non.
      convertToLambert(obj, resources);

      // Sous-préfixes de `col_*` testés AVANT le `col_` générique ci-dessous :
      // sinon `"col_box_test".startsWith("col_")` (vrai aussi) fait tomber le
      // routage dans le mauvais cas, silencieusement.
      if (name.startsWith("col_box_")) {
        buildCuboidCollider(obj, physics, bodies);
        colliderCount++;
        colliderKindCounts.cuboid++;
        obj.visible = false;
        continue;
      }

      if (name.startsWith("col_hull_")) {
        const kind = yield* buildConvexHullColliderSafe(obj, name, physics, bodies, resources);
        if (kind) {
          colliderCount++;
          colliderKindCounts[kind]++;
        }
        obj.visible = false;
        continue;
      }

      if (name.startsWith("col_mesh_")) {
        // Alias explicite du dernier recours (trimesh) — aucune nouvelle
        // logique, juste un branchement nommé plutôt qu'un fallthrough
        // implicite dans le `col_*` générique.
        const created = yield* buildStaticColliderSafe(obj, name, "col_*", physics, bodies, resources);
        if (created) {
          colliderCount++;
          colliderKindCounts.trimesh++;
        }
        obj.visible = false;
        continue;
      }

      if (name.startsWith("col_")) {
        // Rétrocompatibilité (Zones A/B) : trimesh, sauf boîte détectée -> cuboid.
        if (isAxisAlignedBox(obj.geometry)) {
          buildCuboidCollider(obj, physics, bodies);
          colliderCount++;
          colliderKindCounts.cuboid++;
        } else {
          const created = yield* buildStaticColliderSafe(obj, name, "col_*", physics, bodies, resources);
          if (created) {
            colliderCount++;
            colliderKindCounts.trimesh++;
          }
        }
        obj.visible = false;
        continue;
      }

      if (name.startsWith("trig_")) {
        const trigger = yield* buildTriggerSafe(obj, name, physics, bodies);
        if (trigger) triggers.push(trigger);
        obj.visible = false;
        continue;
      }

      if (name.startsWith("door_")) {
        doors.push(yield* buildDoorEffect(obj, name, root, physics, bodies, gltf.animations));
        continue; // reste visible : c'est un panneau de décor animé, pas un volume logique
      }

      if (name.startsWith("vitre_")) {
        vitreCandidates.push(yield* buildVitreCandidateEffect(obj, name, physics, bodies));
        continue; // reste visible : le rendu de la vitre EST son mesh, fusionné plus bas comme le décor
      }

      if (name.startsWith("sanitaire_")) {
        sanitaireCandidates.push(yield* buildSanitaireCandidateEffect(obj, name, physics, bodies));
        continue; // reste visible : le rendu du sanitaire EST son mesh, fusionné plus bas comme le décor
      }

      if (name.startsWith("ecran_")) {
        ecranCandidates.push(yield* buildEcranCandidateEffect(obj, name, physics, bodies));
        continue; // reste visible : le rendu de l'écran EST son mesh, fusionné plus bas comme le décor
      }

      if (name.startsWith("prop_")) {
        props.push(yield* buildPropEffect(obj, name, root, physics, bodies));
        continue; // reste visible : un prop EST son rendu, il n'a pas de proxy séparé
      }

      if (name.startsWith("use_")) {
        useObjects.push(yield* buildUseObjectEffect(obj, name));
        continue; // reste visible (objet interactif physique, ex. un terminal)
      }

      if (name.startsWith("fx_douche_")) {
        continue; // reste adressable pour l'animation et l'interrupteur d'eau
      }

      if (name.startsWith(STORE_SIGN_PREFIX)) {
        continue; // Chaque lettre garde son matériau pour varier indépendamment.
      }

      if (name.startsWith("secret_")) {
        secrets.push(buildSecretZone(obj, name));
        obj.visible = false; // volume logique, comme trig_*
        continue;
      }

      // Mesh sans préfixe reconnu : rendu tel quel, SANS collider,
      // SILENCIEUSEMENT — comportement voulu, ne rien logger ici.
      unprefixedMeshCount++;
      if (!isMovable(obj)) decorCandidates.push(obj);
    }

    // Après convertToLambert : le filet de douche remplace volontairement
    // son matériau classique par le matériau TSL ciblé (ADR 0035).
    initialiserDouches(root);
    initializeStoreSign(root);
    const fountainWater = createFountainWater(root, resources);
    const trainData = yield* Effect.try({
      try: () => readTrainLevel(nodes),
      catch: (cause) => new TrainLevelError({ message: String(cause) }),
    }).pipe(Effect.orDie);
    let trains: LevelTrains | null = null;
    if (trainData) {
      const meshes: THREE.Mesh[] = [];
      trainData.model.traverse((obj) => {
        if (obj instanceof THREE.Mesh) meshes.push(obj);
      });
      mergeStaticDecor(trainData.model, meshes, resources);
      trainData.model.removeFromParent();
      trainData.model.visible = false;
      trains = new LevelTrains(root, physics, trainData, resources);
    }
    const metroBlockout = root.getObjectByName("n5_voyage_centre") ? new MetroBlockout(root, trains, resources) : null;
    resources.collect();

    yield* validateSpawnPlayerCountEffect(spawnPlayerCount);

    for (const light of lights) root.add(light);

    const decor = mergeStaticDecor(root, decorCandidates, resources);
    const vitreMerge = mergeVitreDecor(root, vitreCandidates, resources);
    const sanitaireMerge = mergeSanitaireDecor(root, sanitaireCandidates, resources);
    const ecranMerge = mergeEcranDecor(root, ecranCandidates, resources);
    // Vantaux regroupés par matériau (voir `batchDoorMeshes`) : un vantail
    // animé ne rejoint jamais le décor fusionné, mais vingt vantaux n'ont pas
    // à coûter vingt lots de dessin.
    const doorBatchCount = batchDoorMeshes(root, doors, resources);

    const stats: LevelStats = {
      colliderCount,
      colliderKindCounts,
      spawnSuitCount: spawnSuits.length,
      spawnDirectorCount: spawnDirectors.length,
      triggerCount: triggers.length,
      doorCount: doors.length,
      useCount: useObjects.length,
      secretCount: secrets.length,
      unprefixedMeshCount,
      decorBatchCount: decorCandidates.length - decor.mergedMeshCount + decor.batchCount,
      lightCount: lights.length,
      propCount: props.length,
      vitreCount: vitreMerge.vitres.length,
      vitreBatchCount: vitreMerge.batchCount,
      doorBatchCount,
      sanitaireCount: sanitaireMerge.sanitaires.length,
      sanitaireBatchCount: sanitaireMerge.batchCount,
      ecranCount: ecranMerge.ecrans.length,
      ecranBatchCount: ecranMerge.batchCount,
    };

    return {
      metroBlockout,
      trains,
      fountainWater,
      root,
      gltf,
      spawnPlayer,
      spawnSuits,
      spawnDirectors,
      triggers,
      doors,
      props,
      vitres: vitreMerge.vitres,
      sanitaires: sanitaireMerge.sanitaires,
      sanitaireRendus: sanitaireMerge.rendus,
      ecrans: ecranMerge.ecrans,
      cams,
      useObjects,
      secrets,
      lights,
      stats,
      bodies,
    };
  });
}

// Le finalizer existe avant le premier corps ou changement de hiérarchie.
function acquireLevelResourceEffect(
  gltf: GLTF,
  scene: THREE.Scene,
  physics: PhysicsWorld,
): Effect.Effect<LevelResource, never, Scope.Scope> {
  return Effect.gen(function* () {
    const resources = yield* Effect.acquireRelease(
      Effect.sync(() => new LevelResources(gltf.scene)),
      (owned) => Effect.sync(() => owned.dispose(physics)),
    );
    resources.collect();
    return yield* buildLevelResourceEffect(gltf, scene, physics, resources);
  });
}

function toLevelHandle(resource: LevelResource, scope: Scope.Closeable): LevelHandle {
  let restoreSuspension: (() => void) | null = null;
  return {
    metroBlockout: resource.metroBlockout,
    trains: resource.trains,
    fountainWater: resource.fountainWater,
    root: resource.root,
    gltf: resource.gltf,
    spawnPlayer: resource.spawnPlayer,
    spawnSuits: resource.spawnSuits,
    spawnDirectors: resource.spawnDirectors,
    triggers: resource.triggers,
    doors: resource.doors,
    props: resource.props,
    vitres: resource.vitres,
    sanitaires: resource.sanitaires,
    sanitaireRendus: resource.sanitaireRendus,
    ecrans: resource.ecrans,
    cams: resource.cams,
    useObjects: resource.useObjects,
    secrets: resource.secrets,
    lights: resource.lights,
    stats: resource.stats,
    suspend: () => {
      if (restoreSuspension) return restoreSuspension;
      const rootWasVisible = resource.root.visible;
      const enabledBodies = resource.bodies.map((body) => body.isEnabled());
      resource.root.visible = false;
      for (const body of resource.bodies) body.setEnabled(false);
      let restored = false;
      restoreSuspension = () => {
        if (restored) return;
        restored = true;
        resource.root.visible = rootWasVisible;
        for (let i = 0; i < resource.bodies.length; i++) {
          resource.bodies[i].setEnabled(enabledBodies[i]);
        }
        restoreSuspension = null;
      };
      return restoreSuspension;
    },
    dispose: () => GameRuntime.runSync(Scope.close(scope, Exit.void)),
  };
}

export function buildLevelFromGltfEffect(
  gltf: GLTF,
  scene: THREE.Scene,
  physics: PhysicsWorld,
): Effect.Effect<LevelHandle> {
  return Effect.gen(function* () {
    const scope = Scope.makeUnsafe();
    return yield* acquireLevelResourceEffect(gltf, scene, physics).pipe(
      Scope.provide(scope),
      Effect.map((resource) => toLevelHandle(resource, scope)),
      Effect.onExit((exit) => (Exit.isFailure(exit) ? Scope.close(scope, exit) : Effect.void)),
    );
  });
}

export function buildLevelFromGltf(gltf: GLTF, scene: THREE.Scene, physics: PhysicsWorld): LevelHandle {
  return GameRuntime.runSync(buildLevelFromGltfEffect(gltf, scene, physics));
}

/** Frontière asynchrone du chargement glTF ; la construction du niveau reste synchrone. */
export function loadLevelEffect(
  url: string,
  scene: THREE.Scene,
  physics: PhysicsWorld,
  onProgress?: (fraction: number) => void,
): Effect.Effect<LevelHandle, LevelFetchError> {
  return Effect.gen(function* () {
    const loader = new GLTFLoader();
    const gltf = yield* Effect.tryPromise({
      try: () =>
        loader.loadAsync(url, (event) => {
          // `total` vaut 0 si le serveur n'annonce pas de `Content-Length`
          // (réponse en flux, compression à la volée) : dans ce cas on ne
          // sait rien, et mentir vaut moins que se taire.
          if (onProgress && event.total > 0) onProgress(event.loaded / event.total);
        }),
      catch: (cause) => new LevelFetchError({ url, cause }),
    });
    return yield* buildLevelFromGltfEffect(gltf, scene, physics);
  });
}

export async function loadLevel(
  url: string,
  scene: THREE.Scene,
  physics: PhysicsWorld,
  onProgress?: (fraction: number) => void,
): Promise<LevelHandle> {
  return GameRuntime.runPromise(loadLevelEffect(url, scene, physics, onProgress));
}
