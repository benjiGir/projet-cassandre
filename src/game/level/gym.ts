import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsWorld } from "../../physics/world";

/**
 * Gym boîte blanche — Phase 1 (Déplacement). N'est pas un décor : c'est un
 * instrument de mesure, chaque zone encadre un seuil du character
 * controller. Layout et valeurs de seuil : see: docs/game/plan-prototype.md
 */

// Constantes générales.

const FLOOR_THICK = 0.4;
const WALL_HEIGHT = 6;
const WALL_THICK = 0.5;
const DEG_TO_RAD = Math.PI / 180;

/** Murs qui bordent une fosse (zone gouffres) : ils plongent sous le fond
 * de la fosse pour ne jamais laisser un trou entre le mur et le sol,
 * quelle que soit la hauteur locale du sol (0 ou -1.5). */
const PIT_WALL_HEIGHT = 8.5;
const PIT_WALL_CENTER_Y = 1.75; // couvre y = [-2.5, 6]

// Palette : une teinte par zone, + un dégradé partagé vert->rouge (facile->seuil du controller).

const OPEN_AREA_COLOR = 0x707a72;
const CORRIDOR_COLOR = 0x4f6a7a;
const MARKER_COLOR_A = 0xb08a4a;
const MARKER_COLOR_B = 0xd8d0c0;
const RAMPS_COLOR = 0x8a7355;
const PLATFORMS_COLOR = 0x5a7a63;
const STAIRS_COLOR = 0x6a5a78;
const GAPS_COLOR = 0x7a5650;

/** index 0 (facile) -> 3 (au seuil du controller). */
const GRADIENT = [0x6fae63, 0xc9b256, 0xd08a45, 0xc0503f];

function darken(hex: number, factor: number): number {
  return new THREE.Color(hex).multiplyScalar(factor).getHex();
}

// Helpers de construction — mesh + collider fixed cuboid en parallèle, jamais trimesh.

function materialFor(materials: Map<number, THREE.MeshLambertMaterial>, color: number): THREE.MeshLambertMaterial {
  let mat = materials.get(color);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color });
    materials.set(color, mat);
  }
  return mat;
}

/** Boîte axis-aligned : mesh + collider fixe cuboid, centrés sur (cx,cy,cz). */
function addBox(
  scene: THREE.Object3D,
  physics: PhysicsWorld,
  materials: Map<number, THREE.MeshLambertMaterial>,
  color: number,
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  d: number
): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materialFor(materials, color));
  mesh.position.set(cx, cy, cz);
  scene.add(mesh);

  const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz));
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2), body);
}

/**
 * Boîte inclinée entre deux points (rampe) : mesh + collider fixe cuboid,
 * orientés pour que l'axe "largeur" reste horizontal (pas de roulis), quelle
 * que soit la direction de la pente (le gouffre a une rampe de récupération
 * qui monte selon X, les rampes de la zone sud montent selon Z).
 */
function addRampBetween(
  scene: THREE.Object3D,
  physics: PhysicsWorld,
  materials: Map<number, THREE.MeshLambertMaterial>,
  color: number,
  base: THREE.Vector3,
  top: THREE.Vector3,
  width: number,
  thickness: number
): void {
  const zAxis = new THREE.Vector3().subVectors(top, base).normalize();
  const upHint = Math.abs(zAxis.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3().crossVectors(upHint, zAxis).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));

  const length = base.distanceTo(top);
  const center = new THREE.Vector3().addVectors(base, top).multiplyScalar(0.5);

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, length), materialFor(materials, color));
  mesh.position.copy(center);
  mesh.quaternion.copy(quat);
  scene.add(mesh);

  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(center.x, center.y, center.z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
  );
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, thickness / 2, length / 2), body);
}

// Zone 6 — Espace ouvert (hub central).

export const HUB_SIZE = 44; // >= 40x40 requis, x et z dans [-22, 22]
const HUB_HALF = HUB_SIZE / 2;

const CORRIDOR_OPENING = 6; // largeur de l'ouverture nord, doit matcher CORRIDOR_WIDTH
const RAMPS_OPENING = 20; // largeur de l'ouverture sud, doit matcher RAMPS_WIDTH
const EAST_OPENING = 20; // largeur de l'ouverture est, doit matcher EAST_WING_WIDTH

function buildOpenArea(scene: THREE.Object3D, physics: PhysicsWorld, materials: Map<number, THREE.MeshLambertMaterial>): void {
  addBox(scene, physics, materials, darken(OPEN_AREA_COLOR, 0.6), 0, -FLOOR_THICK / 2, 0, HUB_SIZE, FLOOR_THICK, HUB_SIZE);

  const wallY = WALL_HEIGHT / 2;

  // Nord : ouverture vers le couloir, x in [-3, 3]
  const nSeg = (HUB_SIZE - CORRIDOR_OPENING) / 2;
  addBox(scene, physics, materials, OPEN_AREA_COLOR, -(CORRIDOR_OPENING / 2 + nSeg / 2), wallY, HUB_HALF, nSeg, WALL_HEIGHT, WALL_THICK);
  addBox(scene, physics, materials, OPEN_AREA_COLOR, CORRIDOR_OPENING / 2 + nSeg / 2, wallY, HUB_HALF, nSeg, WALL_HEIGHT, WALL_THICK);

  // Sud : ouverture vers les rampes, x in [-10, 10]
  const sSeg = (HUB_SIZE - RAMPS_OPENING) / 2;
  addBox(scene, physics, materials, OPEN_AREA_COLOR, -(RAMPS_OPENING / 2 + sSeg / 2), wallY, -HUB_HALF, sSeg, WALL_HEIGHT, WALL_THICK);
  addBox(scene, physics, materials, OPEN_AREA_COLOR, RAMPS_OPENING / 2 + sSeg / 2, wallY, -HUB_HALF, sSeg, WALL_HEIGHT, WALL_THICK);

  // Est : ouverture vers escaliers/gouffres, z in [-10, 10]
  const eSeg = (HUB_SIZE - EAST_OPENING) / 2;
  addBox(scene, physics, materials, OPEN_AREA_COLOR, HUB_HALF, wallY, -(EAST_OPENING / 2 + eSeg / 2), WALL_THICK, WALL_HEIGHT, eSeg);
  addBox(scene, physics, materials, OPEN_AREA_COLOR, HUB_HALF, wallY, EAST_OPENING / 2 + eSeg / 2, WALL_THICK, WALL_HEIGHT, eSeg);

  // Ouest : mur plein, pas d'aile
  addBox(scene, physics, materials, OPEN_AREA_COLOR, -HUB_HALF, wallY, 0, WALL_THICK, WALL_HEIGHT, HUB_SIZE);
}

// Zone 5 — Couloir long.

const CORRIDOR_WIDTH = 6;
export const CORRIDOR_LENGTH = 44; // >= 40 m requis
const CORRIDOR_Z_START = HUB_HALF; // 22, mur nord du hub
const CORRIDOR_Z_END = CORRIDOR_Z_START + CORRIDOR_LENGTH; // 66
const CORRIDOR_MARKER_SPACING = 5;

function buildCorridor(scene: THREE.Object3D, physics: PhysicsWorld, materials: Map<number, THREE.MeshLambertMaterial>): void {
  const centerZ = (CORRIDOR_Z_START + CORRIDOR_Z_END) / 2;
  addBox(scene, physics, materials, darken(CORRIDOR_COLOR, 0.6), 0, -FLOOR_THICK / 2, centerZ, CORRIDOR_WIDTH, FLOOR_THICK, CORRIDOR_LENGTH);

  const wallY = WALL_HEIGHT / 2;
  addBox(scene, physics, materials, CORRIDOR_COLOR, -CORRIDOR_WIDTH / 2, wallY, centerZ, WALL_THICK, WALL_HEIGHT, CORRIDOR_LENGTH);
  addBox(scene, physics, materials, CORRIDOR_COLOR, CORRIDOR_WIDTH / 2, wallY, centerZ, WALL_THICK, WALL_HEIGHT, CORRIDOR_LENGTH);
  addBox(scene, physics, materials, CORRIDOR_COLOR, 0, wallY, CORRIDOR_Z_END, CORRIDOR_WIDTH, WALL_HEIGHT, WALL_THICK); // fond, jamais de vide infini

  let markerIndex = 0;
  for (let z = CORRIDOR_Z_START + CORRIDOR_MARKER_SPACING; z < CORRIDOR_Z_END; z += CORRIDOR_MARKER_SPACING) {
    const color = markerIndex % 2 === 0 ? MARKER_COLOR_A : MARKER_COLOR_B;
    addBox(scene, physics, materials, color, -(CORRIDOR_WIDTH / 2 - 0.15), 1, z, 0.3, 2, 0.3);
    addBox(scene, physics, materials, color, CORRIDOR_WIDTH / 2 - 0.15, 1, z, 0.3, 2, 0.3);
    markerIndex++;
  }
}

// Zone 1 — Rampes.

const RAMPS_WIDTH = 20; // doit matcher RAMPS_OPENING
const RAMPS_Z_START = -HUB_HALF; // -22
const RAMPS_Z_END = -40; // ouvert sur la zone plateformes, pas de mur ici
const RAMP_RUNUP = 3; // approche plate avant la base de chaque rampe
const RAMP_RISE = 3; // hauteur commune à toutes les rampes
/** Angles testés, en degrés. Seuil controller : pente max 50°. */
const RAMP_ANGLES_DEG = [20, 35, 45, 55];
const RAMP_LANE_X = [-7.5, -2.5, 2.5, 7.5];
const RAMP_WIDTH = 4;
const RAMP_THICKNESS = 0.4;
const RAMP_LANDING_DEPTH = 2.5;

function buildRampsZone(scene: THREE.Object3D, physics: PhysicsWorld, materials: Map<number, THREE.MeshLambertMaterial>): void {
  const centerZ = (RAMPS_Z_START + RAMPS_Z_END) / 2;
  const depth = RAMPS_Z_START - RAMPS_Z_END;
  addBox(scene, physics, materials, darken(RAMPS_COLOR, 0.6), 0, -FLOOR_THICK / 2, centerZ, RAMPS_WIDTH, FLOOR_THICK, depth);

  const wallY = WALL_HEIGHT / 2;
  addBox(scene, physics, materials, RAMPS_COLOR, -RAMPS_WIDTH / 2, wallY, centerZ, WALL_THICK, WALL_HEIGHT, depth);
  addBox(scene, physics, materials, RAMPS_COLOR, RAMPS_WIDTH / 2, wallY, centerZ, WALL_THICK, WALL_HEIGHT, depth);

  const baseZ = RAMPS_Z_START - RAMP_RUNUP; // -25

  RAMP_ANGLES_DEG.forEach((angleDeg, i) => {
    const run = RAMP_RISE / Math.tan(angleDeg * DEG_TO_RAD);
    const topZ = baseZ - run;
    const laneX = RAMP_LANE_X[i];

    addRampBetween(
      scene,
      physics,
      materials,
      GRADIENT[i],
      new THREE.Vector3(laneX, 0, baseZ),
      new THREE.Vector3(laneX, RAMP_RISE, topZ),
      RAMP_WIDTH,
      RAMP_THICKNESS
    );

    // palier d'arrivée en haut de la rampe
    addBox(
      scene,
      physics,
      materials,
      RAMPS_COLOR,
      laneX,
      RAMP_RISE - FLOOR_THICK / 2,
      topZ - RAMP_LANDING_DEPTH / 2,
      RAMP_WIDTH,
      FLOOR_THICK,
      RAMP_LANDING_DEPTH
    );
  });
}

// Zone 3 — Plateformes.

const PLATFORMS_Z_START = RAMPS_Z_END; // -40, continuité de l'aile sud
const PLATFORMS_Z_END = -50;
/** Hauteurs testées, en mètres. Seuil controller : saut 1.1 m. */
const PLATFORM_HEIGHTS = [0.8, 1.0, 1.2, 1.4];
const PLATFORM_LANE_X = RAMP_LANE_X; // mêmes colonnes que les rampes, pour la cohérence visuelle
const PLATFORM_WIDTH = 4;
const PLATFORM_DEPTH = 3;
const PLATFORM_Z = (PLATFORMS_Z_START + PLATFORMS_Z_END) / 2; // -45, ~4 m de recul depuis la limite de l'aile rampes

function buildPlatformsZone(scene: THREE.Object3D, physics: PhysicsWorld, materials: Map<number, THREE.MeshLambertMaterial>): void {
  const centerZ = (PLATFORMS_Z_START + PLATFORMS_Z_END) / 2;
  const depth = PLATFORMS_Z_START - PLATFORMS_Z_END;
  addBox(scene, physics, materials, darken(PLATFORMS_COLOR, 0.6), 0, -FLOOR_THICK / 2, centerZ, RAMPS_WIDTH, FLOOR_THICK, depth);

  const wallY = WALL_HEIGHT / 2;
  addBox(scene, physics, materials, PLATFORMS_COLOR, -RAMPS_WIDTH / 2, wallY, centerZ, WALL_THICK, WALL_HEIGHT, depth);
  addBox(scene, physics, materials, PLATFORMS_COLOR, RAMPS_WIDTH / 2, wallY, centerZ, WALL_THICK, WALL_HEIGHT, depth);
  addBox(scene, physics, materials, PLATFORMS_COLOR, 0, wallY, PLATFORMS_Z_END, RAMPS_WIDTH, WALL_HEIGHT, WALL_THICK); // fond de l'aile sud

  PLATFORM_HEIGHTS.forEach((height, i) => {
    addBox(scene, physics, materials, GRADIENT[i], PLATFORM_LANE_X[i], height / 2, PLATFORM_Z, PLATFORM_WIDTH, height, PLATFORM_DEPTH);
  });
}

// Zones 2 & 4 — Escaliers puis gouffres, même aile est (pas de mur entre les deux).

const EAST_WING_WIDTH = 20; // doit matcher EAST_OPENING, z in [-10, 10]
const EAST_WING_HALF = EAST_WING_WIDTH / 2;
const EAST_X_START = HUB_HALF; // 22, mur est du hub

// Escaliers.

const STAIRS_RUNUP = 2;
const STEP_COUNT = 6;
const STEP_TREAD = 0.8; // profondeur d'une marche (horizontal)
/** Hauteurs de marche testées, en mètres. Seuil controller : autostep 0.35 m. */
const STEP_HEIGHTS = [0.15, 0.25, 0.35, 0.45];
const STAIR_LANE_Z = [-8.75, -6.25, -3.75, -1.25]; // occupent z in [-10, 0], le reste (z in [0,10]) reste dégagé
const STAIR_LANE_WIDTH = 2.5;

const STAIRS_STEPS_START_X = EAST_X_START + STAIRS_RUNUP; // 24
const STAIRS_STEPS_END_X = STAIRS_STEPS_START_X + STEP_COUNT * STEP_TREAD; // 28.8
const GAPS_START_X = 32; // début de l'aile gouffres ; le palier d'arrivée des escaliers comble l'écart jusque-là

// Gouffres.

/** Portées testées, en mètres. Un gouffre franchi de justesse est le
 * meilleur détecteur de mollesse en pleine course. */
const GAP_SPANS = [2, 3, 4, 5];
const GAP_PAD_DEPTH = 3;
const PIT_DEPTH = 1.5; // fond de fosse, avec rampe de remontée : pas punitif
const PIT_Z_CENTER = EAST_WING_HALF / 2; // centre de la bande gouffres, dans z in [0, 10] -> centre à z=5
const RECOVERY_RAMP_RUN = 3;

function buildStairsAndGapsWing(scene: THREE.Object3D, physics: PhysicsWorld, materials: Map<number, THREE.MeshLambertMaterial>): void {
  const wallY = WALL_HEIGHT / 2;

  const stairsCenterX = (EAST_X_START + GAPS_START_X) / 2;
  const stairsDepth = GAPS_START_X - EAST_X_START;
  addBox(scene, physics, materials, darken(STAIRS_COLOR, 0.6), stairsCenterX, -FLOOR_THICK / 2, 0, stairsDepth, FLOOR_THICK, EAST_WING_WIDTH);
  addBox(scene, physics, materials, STAIRS_COLOR, stairsCenterX, wallY, -EAST_WING_HALF, stairsDepth, WALL_HEIGHT, WALL_THICK);
  addBox(scene, physics, materials, STAIRS_COLOR, stairsCenterX, wallY, EAST_WING_HALF, stairsDepth, WALL_HEIGHT, WALL_THICK);

  STEP_HEIGHTS.forEach((stepHeight, lane) => {
    const laneZ = STAIR_LANE_Z[lane];
    for (let s = 1; s <= STEP_COUNT; s++) {
      const xStart = STAIRS_STEPS_START_X + (s - 1) * STEP_TREAD;
      const height = s * stepHeight;
      addBox(scene, physics, materials, GRADIENT[lane], xStart + STEP_TREAD / 2, height / 2, laneZ, STEP_TREAD, height, STAIR_LANE_WIDTH);
    }
    const topHeight = STEP_COUNT * stepHeight;
    const landingDepth = GAPS_START_X - STAIRS_STEPS_END_X;
    addBox(
      scene,
      physics,
      materials,
      STAIRS_COLOR,
      STAIRS_STEPS_END_X + landingDepth / 2,
      topHeight - FLOOR_THICK / 2,
      laneZ,
      landingDepth,
      FLOOR_THICK,
      STAIR_LANE_WIDTH
    );
  });

  // Gouffres : pastilles de départ/atterrissage séparées par du vide.
  let cursor = GAPS_START_X;
  const padCenters: number[] = [];

  const addPad = (color: number) => {
    const cx = cursor + GAP_PAD_DEPTH / 2;
    addBox(scene, physics, materials, color, cx, -PIT_DEPTH / 2, PIT_Z_CENTER, GAP_PAD_DEPTH, PIT_DEPTH, EAST_WING_HALF);
    padCenters.push(cx);
    cursor += GAP_PAD_DEPTH;
  };

  addPad(GRADIENT[0]); // pastille de départ, couleur = difficulté du 1er gouffre
  GAP_SPANS.forEach((span, i) => {
    cursor += span; // le gouffre lui-même : pas de géométrie, juste du vide au-dessus de la fosse
    const nextColor = i + 1 < GAP_SPANS.length ? GRADIENT[i + 1] : GAPS_COLOR;
    addPad(nextColor);
  });

  const trenchStartX = GAPS_START_X + GAP_PAD_DEPTH; // début du 1er gouffre
  const trenchEndX = cursor; // fin de la dernière pastille
  const trenchCenterX = (trenchStartX + trenchEndX) / 2;
  addBox(
    scene,
    physics,
    materials,
    darken(GAPS_COLOR, 0.6),
    trenchCenterX,
    -PIT_DEPTH - FLOOR_THICK / 2,
    PIT_Z_CENTER,
    trenchEndX - trenchStartX,
    FLOOR_THICK,
    EAST_WING_HALF
  );

  // Rampe de récupération : fond de fosse pas punitif.
  addRampBetween(
    scene,
    physics,
    materials,
    GAPS_COLOR,
    new THREE.Vector3(cursor, -PIT_DEPTH, PIT_Z_CENTER),
    new THREE.Vector3(cursor + RECOVERY_RAMP_RUN, 0, PIT_Z_CENTER),
    EAST_WING_HALF,
    FLOOR_THICK
  );
  cursor += RECOVERY_RAMP_RUN;

  const backWallX = cursor + 1;
  addBox(scene, physics, materials, darken(GAPS_COLOR, 0.6), (cursor + backWallX) / 2, -FLOOR_THICK / 2, PIT_Z_CENTER, backWallX - cursor, FLOOR_THICK, EAST_WING_HALF);

  // Sol de la bande escaliers prolongée le long des gouffres (contournement à pied).
  const gapsSectionCenterX = (GAPS_START_X + backWallX) / 2;
  const gapsSectionDepth = backWallX - GAPS_START_X;
  addBox(
    scene,
    physics,
    materials,
    darken(GAPS_COLOR, 0.6),
    gapsSectionCenterX,
    -FLOOR_THICK / 2,
    -EAST_WING_HALF / 2,
    gapsSectionDepth,
    FLOOR_THICK,
    EAST_WING_HALF
  );

  // Murs de la section gouffres (plongent sous le fond de fosse).
  addBox(scene, physics, materials, GAPS_COLOR, gapsSectionCenterX, PIT_WALL_CENTER_Y, -EAST_WING_HALF, gapsSectionDepth, PIT_WALL_HEIGHT, WALL_THICK);
  addBox(scene, physics, materials, GAPS_COLOR, gapsSectionCenterX, PIT_WALL_CENTER_Y, EAST_WING_HALF, gapsSectionDepth, PIT_WALL_HEIGHT, WALL_THICK);
  addBox(scene, physics, materials, GAPS_COLOR, backWallX, PIT_WALL_CENTER_Y, 0, WALL_THICK, PIT_WALL_HEIGHT, EAST_WING_WIDTH);
}

// Spawn au centre du hub, orienté vers l'entrée du couloir nord.
// Convention yaw=0 -> avant = -Z, voir SpawnPoint.yaw dans loader.ts.
const SPAWN_POSITION = new THREE.Vector3(0, 0, -10);
const SPAWN_YAW = Math.PI; // face +Z, vers l'entrée du couloir

/** Gym boîte blanche : rampes, escaliers, plateformes, gouffres, couloir
 * long, espace ouvert. Construit à la main, aucune abstraction glTF.
 *
 * `scene` accepte n'importe quel `THREE.Object3D`, pas seulement
 * `THREE.Scene` : `main.ts` y passe un `THREE.Group` dédié à la partie
 * courante, pour pouvoir retirer TOUTE la géométrie en un seul `remove()`
 * au reset — sans ça, un reset sur `?level=gym` dupliquerait indéfiniment
 * les boîtes à chaque partie (ce fichier ne garde aucune référence vers les
 * meshes qu'il crée). */
export function buildGym(
  scene: THREE.Object3D,
  physics: PhysicsWorld
): {
  spawn: THREE.Vector3;
  spawnYaw: number;
} {
  const materials = new Map<number, THREE.MeshLambertMaterial>();

  buildOpenArea(scene, physics, materials);
  buildCorridor(scene, physics, materials);
  buildRampsZone(scene, physics, materials);
  buildPlatformsZone(scene, physics, materials);
  buildStairsAndGapsWing(scene, physics, materials);

  return {
    spawn: SPAWN_POSITION.clone(),
    spawnYaw: SPAWN_YAW,
  };
}
