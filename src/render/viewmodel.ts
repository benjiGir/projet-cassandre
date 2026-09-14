import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { assetUrl } from "../core/assetPath";
import type { ViewmodelClocks, WeaponSystem } from "../game/player/weapons";

/**
 * Les armes affichées à l'écran : pied-de-biche et fusil à pompe tenus par
 * les avant-bras du héros, construits dans Blender
 * (`tools/blender/build_weapons.py`, `public/assets/weapons/armes.glb`).
 *
 * Les meshes `vm_*` sont déjà exprimés dans le repère de la caméra : leur
 * place à l'écran se règle dans le script Blender, pas ici. Ce module ne fait
 * que les ANIMER autour de leur pivot (le poing droit) — recul, balayage,
 * pompage, changement d'arme — à partir de nombres interpolés lus sur
 * `WeaponSystem`. Aucune animation ne retarde un tir (invariant #10).
 *
 * Hiérarchie de scène (enfant de caméra), prérequis `scene.add(camera)` :
 * see: docs/systems/rendu.md#le-mesh-darme-affiché-à-lécran-viewmodel
 */

// --- Modèles -----------------------------------------------------------------

export interface WeaponModels {
  crowbar: THREE.BufferGeometry;
  shotgun: THREE.BufferGeometry;
  shotgunPump: THREE.BufferGeometry;
  worldCrowbar: THREE.BufferGeometry;
  worldShotgun: THREE.BufferGeometry;
  /** Poing droit de chaque arme, repère caméra : centre des rotations. */
  crowbarPivot: THREE.Vector3;
  shotgunPivot: THREE.Vector3;
  /** Bout du canon, repère caméra : où naît l'éclair de tir. */
  shotgunMuzzle: THREE.Vector3;
  /** Direction du canon (unitaire, repère caméra) : le fût recule le long de son opposé. */
  pumpAxis: THREE.Vector3;
  /** Un seul matériau pour tout : couleurs portées par les sommets. */
  material: THREE.MeshLambertMaterial;
}

function vec3(value: unknown, name: string): THREE.Vector3 {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`[armes] extra "${name}" absent ou mal formé`);
  return new THREE.Vector3(value[0], value[1], value[2]);
}

/**
 * Charge `armes.glb`. Frontière asynchrone, appelée au démarrage (invariant
 * #11). Lève si un nœud ou un extra attendu manque.
 */
export async function loadWeaponModels(): Promise<WeaponModels> {
  const gltf = await new GLTFLoader().loadAsync(assetUrl("assets/weapons/armes.glb"));
  // `GLTFLoader` réécrit `.name` (le nom Blender brut est dans `userData.name`)
  // et, pour un nœud qui a des enfants, pose les extras sur un groupe qui
  // contient un mesh homonyme : on cherche les deux par nom.
  const byName = new Map<string, THREE.Object3D[]>();
  gltf.scene.traverse((obj) => {
    const name = (obj.userData.name as string | undefined) ?? obj.name;
    byName.set(name, [...(byName.get(name) ?? []), obj]);
  });
  const node = (name: string): THREE.Mesh => {
    const mesh = byName.get(name)?.find((obj) => (obj as THREE.Mesh).isMesh) as THREE.Mesh | undefined;
    if (!mesh) throw new Error(`[armes] nœud "${name}" absent de armes.glb`);
    return mesh;
  };
  const extra = (name: string, key: string): unknown => byName.get(name)?.find((obj) => key in obj.userData)?.userData[key];

  const crowbar = node("vm_crowbar");
  const shotgun = node("vm_shotgun");
  const pump = node("vm_shotgun_pump");
  // Invariant #5 : `GLTFLoader` pose un `MeshStandardMaterial` par défaut.
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });

  return {
    crowbar: crowbar.geometry,
    shotgun: shotgun.geometry,
    shotgunPump: pump.geometry,
    worldCrowbar: node("world_crowbar").geometry,
    worldShotgun: node("world_shotgun").geometry,
    crowbarPivot: vec3(extra("vm_crowbar", "prise"), "vm_crowbar.prise"),
    shotgunPivot: vec3(extra("vm_shotgun", "prise"), "vm_shotgun.prise"),
    shotgunMuzzle: vec3(extra("vm_shotgun", "bout_canon"), "vm_shotgun.bout_canon"),
    pumpAxis: vec3(extra("vm_shotgun_pump", "axe_glissiere"), "vm_shotgun_pump.axe_glissiere").normalize(),
    material,
  };
}

/** Boîte teintée par sommets, pour le repli. */
function coloredBox(size: [number, number, number], center: [number, number, number], color: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(...size).translate(...center);
  const c = new THREE.Color(color);
  const colors = new Float32Array(geometry.attributes.position!.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Modèles de repli : les boîtes historiques, quand `armes.glb` ne se charge
 * pas. Le jeu reste jouable, l'erreur est bruyante en console.
 */
export function placeholderWeaponModels(): WeaponModels {
  return {
    crowbar: coloredBox([0.06, 0.06, 0.7], [0.32, -0.28, -0.55], 0x8a5a34),
    shotgun: coloredBox([0.09, 0.12, 0.85], [0.3, -0.3, -0.65], 0x555a60),
    shotgunPump: coloredBox([0.001, 0.001, 0.001], [0.3, -0.3, -0.65], 0x555a60),
    worldCrowbar: coloredBox([0.03, 0.03, 0.7], [0, 0.015, 0], 0x8a5a34),
    worldShotgun: coloredBox([0.05, 0.05, 0.8], [0, 0.025, 0], 0x555a60),
    crowbarPivot: new THREE.Vector3(0.32, -0.28, -0.4),
    shotgunPivot: new THREE.Vector3(0.3, -0.3, -0.4),
    shotgunMuzzle: new THREE.Vector3(0.3, -0.25, -1.05),
    pumpAxis: new THREE.Vector3(0, 0, -1),
    material: new THREE.MeshLambertMaterial({ vertexColors: true }),
  };
}

export async function loadWeaponModelsOrPlaceholder(): Promise<WeaponModels> {
  try {
    return await loadWeaponModels();
  } catch (error) {
    console.error("[armes] armes.glb illisible, repli sur les boîtes", error);
    return placeholderWeaponModels();
  }
}

// --- Animation ---------------------------------------------------------------

/** Durées de l'animation, en secondes de gameplay. Voir docs/systems/rendu.md. */
export const VIEWMODEL_TIMING = {
  /** L'ancienne arme descend… */
  lower: 0.12,
  /** …puis la nouvelle remonte. */
  raise: 0.18,
  /** Balayage du pied-de-biche : le coup part à l'appui, le geste suit aussitôt. */
  strike: 0.07,
  recover: 0.28,
  /** Coup de pompe, entamé après le recul du tir (cooldown du pompe : 0,8 s). */
  pumpStart: 0.2,
  pumpBack: 0.13,
  pumpForward: 0.15,
} as const;

export interface ViewmodelAnimation {
  /** Arme à afficher cette frame (l'ancienne pendant qu'elle descend). */
  weapon: "none" | "melee" | "shotgun";
  /** 0 = en place, 1 = hors écran. */
  lowered: number;
  /** 0 = repos, 1 = fin du balayage. */
  swing: number;
  /** 0 = fût en avant, 1 = fût tiré en arrière. */
  pump: number;
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Pose d'animation pour des horloges données. Pure. */
export function viewmodelAnimationAt(clocks: ViewmodelClocks, out: ViewmodelAnimation): ViewmodelAnimation {
  const t = VIEWMODEL_TIMING;

  // Changement d'arme. Tirer avec la nouvelle arme la remet en place
  // aussitôt : l'animation suit le joueur, elle ne le retient jamais.
  const sinceActiveFire =
    clocks.active === "melee" ? clocks.sinceMeleeFire : clocks.active === "shotgun" ? clocks.sinceShotgunFire : Infinity;
  const lowerPhase = clocks.previous === "none" ? 0 : t.lower;
  out.weapon = clocks.active;
  out.lowered = 0;
  if (sinceActiveFire >= clocks.sinceSwitch) {
    if (clocks.sinceSwitch < lowerPhase) {
      out.weapon = clocks.previous;
      out.lowered = easeInOut(clocks.sinceSwitch / t.lower);
    } else if (clocks.sinceSwitch < lowerPhase + t.raise) {
      out.lowered = 1 - easeOut((clocks.sinceSwitch - lowerPhase) / t.raise);
    }
  }

  const s = clocks.sinceMeleeFire;
  out.swing = s < t.strike ? easeOut(s / t.strike) : 1 - easeInOut(clamp01((s - t.strike) / t.recover));

  const p = clocks.sinceShotgunFire - t.pumpStart;
  out.pump =
    p < 0 ? 0 : p < t.pumpBack ? easeInOut(p / t.pumpBack) : 1 - easeInOut(clamp01((p - t.pumpBack) / t.pumpForward));

  return out;
}

/**
 * Part du tampon de profondeur réservée aux armes. La pompe dépasse d'un mètre
 * devant l'œil, la capsule du joueur de 40 cm : collé à un mur, le canon s'y
 * enfonçait. Dessinées dans [0, 0,05], les armes passent devant tout ce qui
 * est à plus de ~11 cm de l'œil, sans perdre leurs propres occlusions (une
 * main devant la carcasse). `WebGLState` ne pilote pas `depthRange` : le
 * rétablir après chaque mesh suffit.
 */
const VIEWMODEL_DEPTH_RANGE = 0.05;

function drawOverWorld(mesh: THREE.Mesh): THREE.Mesh {
  mesh.onBeforeRender = (renderer) => renderer.getContext().depthRange(0, VIEWMODEL_DEPTH_RANGE);
  mesh.onAfterRender = (renderer) => renderer.getContext().depthRange(0, 1);
  return mesh;
}

/** Amplitudes du geste, repère caméra (mètres, radians). */
const SWING_ROLL = 0.45;
const SWING_PITCH = -0.55;
const SWING_SHIFT = new THREE.Vector3(-0.08, 0.02, -0.06);
/**
 * Le pied-de-biche tourne autour du COUDE, pas du poing : autour du poing,
 * l'avant-bras remonte et barre l'écran. Décalage depuis la prise, repère caméra.
 */
const CROWBAR_ELBOW = new THREE.Vector3(0.1, -0.25, 0.22);
const LOWER_DROP = 0.38;
const LOWER_PITCH = -0.7;
const PUMP_TRAVEL = 0.09;
const PUMP_ROLL = 0.07;

export class Viewmodel {
  private readonly crowbar: THREE.Group;
  private readonly shotgun: THREE.Group;
  private readonly pump: THREE.Mesh;
  private readonly models: WeaponModels;
  private readonly crowbarElbow: THREE.Vector3;

  // Scratch, zéro allocation en régime établi.
  private readonly scratchPosition = new THREE.Vector3();
  private readonly scratchEuler = new THREE.Euler(0, 0, 0, "XYZ");
  private readonly clocks: ViewmodelClocks = {
    active: "none",
    previous: "none",
    sinceSwitch: 1e3,
    sinceMeleeFire: 1e3,
    sinceShotgunFire: 1e3,
  };
  private readonly animation: ViewmodelAnimation = { weapon: "none", lowered: 0, swing: 0, pump: 0 };

  constructor(camera: THREE.Camera, models: WeaponModels) {
    this.models = models;
    this.crowbarElbow = models.crowbarPivot.clone().add(CROWBAR_ELBOW);
    this.crowbar = this.mount(camera, models.crowbar, this.crowbarElbow);
    this.shotgun = this.mount(camera, models.shotgun, models.shotgunPivot);
    this.pump = drawOverWorld(new THREE.Mesh(models.shotgunPump, models.material));
    this.shotgun.children[0]!.add(this.pump);
  }

  /** Un groupe posé sur le pivot, portant le mesh décalé d'autant : les rotations tournent autour du poing. */
  private mount(camera: THREE.Camera, geometry: THREE.BufferGeometry, pivot: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    const mesh = drawOverWorld(new THREE.Mesh(geometry, this.models.material));
    mesh.position.copy(pivot).negate();
    group.add(mesh);
    group.visible = false;
    camera.add(group);
    return group;
  }

  /**
   * Pose l'arme active pour la frame d'affichage. À appeler dans
   * `interpolateVisuals`, APRÈS que la caméra est posée (bob, FOV).
   */
  update(alpha: number, weapons: WeaponSystem) {
    weapons.viewmodelPose(alpha, this.scratchPosition, this.scratchEuler);
    const anim = viewmodelAnimationAt(weapons.viewmodelClocks(alpha, this.clocks), this.animation);

    this.crowbar.visible = anim.weapon === "melee";
    this.shotgun.visible = anim.weapon === "shotgun";

    if (anim.weapon === "melee") {
      const group = this.crowbar;
      group.position.copy(this.crowbarElbow).add(this.scratchPosition).addScaledVector(SWING_SHIFT, anim.swing);
      group.position.y -= LOWER_DROP * anim.lowered;
      group.rotation.set(
        this.scratchEuler.x + SWING_PITCH * anim.swing + LOWER_PITCH * anim.lowered,
        0,
        SWING_ROLL * anim.swing,
      );
    } else if (anim.weapon === "shotgun") {
      const group = this.shotgun;
      group.position.copy(this.models.shotgunPivot).add(this.scratchPosition);
      group.position.y -= LOWER_DROP * anim.lowered;
      group.rotation.set(this.scratchEuler.x + LOWER_PITCH * anim.lowered, 0, PUMP_ROLL * anim.pump);
      this.pump.position.copy(this.models.pumpAxis).multiplyScalar(-PUMP_TRAVEL * anim.pump);
    }
  }

  /**
   * Bout du canon du pompe en coordonnées monde, tel qu'affiché cette frame :
   * l'éclair de tir y naît au lieu du centre de l'écran. Cosmétique.
   */
  muzzleWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    const mesh = this.shotgun.children[0]!;
    mesh.updateWorldMatrix(true, false);
    return mesh.localToWorld(out.copy(this.models.shotgunMuzzle));
  }
}

/**
 * Remplace la boîte d'un `use_crowbar`/`use_shotgun` par l'arme posée à plat,
 * alignée sur la plus grande dimension horizontale de la boîte. L'arme devient
 * enfant de l'objet : le ramassage, qui cache l'objet, la cache avec.
 *
 * @param groundY Hauteur de la surface sous la boîte (les boîtes `use_*`
 *   flottent souvent au-dessus du sol) ; à défaut, le dessous de la boîte.
 */
export function dressWeaponPickup(
  object: THREE.Object3D,
  weapon: "melee" | "shotgun",
  models: WeaponModels,
  groundY: number | null,
): void {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const mesh = object as THREE.Mesh;
  if (mesh.isMesh) mesh.material = HIDDEN_MATERIAL;

  const model = new THREE.Mesh(weapon === "melee" ? models.worldCrowbar : models.worldShotgun, models.material);
  model.position.set(center.x, groundY ?? box.min.y, center.z);
  // Les modèles au sol sont longs selon -Z (le +Y de Blender).
  model.rotation.y = size.x > size.z ? Math.PI / 2 : 0;
  object.attach(model);
}

/** Matériau jamais dessiné, pour la boîte d'un ramassage habillé. */
const HIDDEN_MATERIAL = new THREE.MeshLambertMaterial({ visible: false });
