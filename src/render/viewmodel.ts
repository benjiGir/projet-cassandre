import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Schema } from "effect";

import { assetUrl } from "../core/assetPath";
import type { ViewmodelClocks, WeaponKind } from "../game/player/weaponTypes";
import type { ViewmodelSource } from "./viewmodelTypes";

// see: docs/6-reference/notes-code-rendu.md#viewmodel

export interface WeaponModels {
  crowbar: THREE.BufferGeometry;
  pistol: THREE.BufferGeometry;
  shotgun: THREE.BufferGeometry;
  shotgunPump: THREE.BufferGeometry;
  worldCrowbar: THREE.BufferGeometry;
  worldPistol: THREE.BufferGeometry;
  worldShotgun: THREE.BufferGeometry;
  crowbarPivot: THREE.Vector3;
  pistolPivot: THREE.Vector3;
  shotgunPivot: THREE.Vector3;
  pistolMuzzle: THREE.Vector3;
  shotgunMuzzle: THREE.Vector3;
  pumpAxis: THREE.Vector3;
  // Un seul matériau pour tout : couleurs portées par les sommets.
  material: THREE.MeshLambertMaterial;
}

const decodeVector = Schema.decodeUnknownSync(Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]));

function vec3(value: unknown, name: string): THREE.Vector3 {
  try {
    const [x, y, z] = decodeVector(value);
    return new THREE.Vector3(x, y, z);
  } catch (cause) {
    throw new Error(`[armes] extra "${name}" absent ou mal formé`, { cause });
  }
}

function disposeImportedMaterials(scene: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  // Le viewmodel ne reprend que les géométries ; aucune texture glTF n'est réutilisée.
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}

// Frontière asynchrone au démarrage ; repli si nœuds ou extras manquent.
export async function loadWeaponModels(): Promise<WeaponModels> {
  const gltf = await new GLTFLoader().loadAsync(assetUrl("assets/weapons/armes.glb"));
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  try {
    // Le nom Blender et les extras peuvent vivre sur le groupe homonyme du mesh.
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
    const pistol = node("vm_pistol");
    const shotgun = node("vm_shotgun");
    const pump = node("vm_shotgun_pump");

    return {
      crowbar: crowbar.geometry,
      pistol: pistol.geometry,
      shotgun: shotgun.geometry,
      shotgunPump: pump.geometry,
      worldCrowbar: node("world_crowbar").geometry,
      worldPistol: node("world_pistol").geometry,
      worldShotgun: node("world_shotgun").geometry,
      crowbarPivot: vec3(extra("vm_crowbar", "prise"), "vm_crowbar.prise"),
      pistolPivot: vec3(extra("vm_pistol", "prise"), "vm_pistol.prise"),
      pistolMuzzle: vec3(extra("vm_pistol", "bout_canon"), "vm_pistol.bout_canon"),
      shotgunPivot: vec3(extra("vm_shotgun", "prise"), "vm_shotgun.prise"),
      shotgunMuzzle: vec3(extra("vm_shotgun", "bout_canon"), "vm_shotgun.bout_canon"),
      pumpAxis: vec3(extra("vm_shotgun_pump", "axe_glissiere"), "vm_shotgun_pump.axe_glissiere").normalize(),
      material,
    };
  } catch (error) {
    material.dispose();
    throw error;
  } finally {
    disposeImportedMaterials(gltf.scene);
  }
}

function coloredBox(size: [number, number, number], center: [number, number, number], color: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(...size).translate(...center);
  const c = new THREE.Color(color);
  const colors = new Float32Array(geometry.attributes.position!.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function placeholderWeaponModels(): WeaponModels {
  return {
    crowbar: coloredBox([0.06, 0.06, 0.7], [0.32, -0.28, -0.55], 0x8a5a34),
    pistol: coloredBox([0.06, 0.1, 0.26], [0.26, -0.26, -0.45], 0x3a3d44),
    shotgun: coloredBox([0.09, 0.12, 0.85], [0.3, -0.3, -0.65], 0x555a60),
    shotgunPump: coloredBox([0.001, 0.001, 0.001], [0.3, -0.3, -0.65], 0x555a60),
    worldCrowbar: coloredBox([0.03, 0.03, 0.7], [0, 0.015, 0], 0x8a5a34),
    worldPistol: coloredBox([0.04, 0.05, 0.22], [0, 0.025, 0], 0x3a3d44),
    worldShotgun: coloredBox([0.05, 0.05, 0.8], [0, 0.025, 0], 0x555a60),
    crowbarPivot: new THREE.Vector3(0.32, -0.28, -0.4),
    pistolPivot: new THREE.Vector3(0.26, -0.26, -0.32),
    pistolMuzzle: new THREE.Vector3(0.26, -0.22, -0.6),
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

// Durées de l'animation, en secondes de gameplay. Voir docs/4-technique/rendu.md.
export const VIEWMODEL_TIMING = {
  lower: 0.12,
  raise: 0.18,
  strike: 0.07,
  recover: 0.28,
  pumpStart: 0.2,
  pumpBack: 0.13,
  pumpForward: 0.15,
} as const;

export interface ViewmodelAnimation {
  weapon: WeaponKind;
  // 0 = en place, 1 = hors écran.
  lowered: number;
  // 0 = repos, 1 = fin du balayage.
  swing: number;
  // 0 = fût en avant, 1 = fût tiré en arrière.
  pump: number;
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function viewmodelAnimationAt(clocks: ViewmodelClocks, out: ViewmodelAnimation): ViewmodelAnimation {
  const t = VIEWMODEL_TIMING;

  // Le tir interrompt la descente : l’animation ne bloque aucune action.
  const sinceActiveFire =
    clocks.active === "melee"
      ? clocks.sinceMeleeFire
      : clocks.active === "pistol"
        ? clocks.sincePistolFire
        : clocks.active === "shotgun"
          ? clocks.sinceShotgunFire
          : Infinity;
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

  // Le pistolet n'a pas de mouvement propre : tout son geste est le recul
  // (`viewmodelPose`), plus sec et plus court que celui du pompe.
  const p = clocks.sinceShotgunFire - t.pumpStart;
  out.pump =
    p < 0 ? 0 : p < t.pumpBack ? easeInOut(p / t.pumpBack) : 1 - easeInOut(clamp01((p - t.pumpBack) / t.pumpForward));

  return out;
}

const VIEWMODEL_DEPTH_RANGE = 0.05;

function drawOverWorld(mesh: THREE.Mesh): THREE.Mesh {
  mesh.onBeforeRender = (renderer) => renderer.getContext().depthRange(0, VIEWMODEL_DEPTH_RANGE);
  mesh.onAfterRender = (renderer) => renderer.getContext().depthRange(0, 1);
  return mesh;
}

// Amplitudes du geste, repère caméra (mètres, radians).
const SWING_ROLL = 0.45;
const SWING_PITCH = -0.55;
const SWING_SHIFT = new THREE.Vector3(-0.08, 0.02, -0.06);
// Le pivot au coude empêche l’avant-bras de barrer l’écran.
const CROWBAR_ELBOW = new THREE.Vector3(0.1, -0.25, 0.22);
const LOWER_DROP = 0.38;
const LOWER_PITCH = -0.7;
const PUMP_TRAVEL = 0.09;
const PUMP_ROLL = 0.07;

export class Viewmodel {
  private readonly crowbar: THREE.Group;
  private readonly pistol: THREE.Group;
  private readonly shotgun: THREE.Group;
  private readonly pump: THREE.Mesh;
  private readonly models: WeaponModels;
  private readonly crowbarElbow: THREE.Vector3;

  private readonly scratchPosition = new THREE.Vector3();
  private readonly scratchEuler = new THREE.Euler(0, 0, 0, "XYZ");
  private readonly clocks: ViewmodelClocks = {
    active: "none",
    previous: "none",
    sinceSwitch: 1e3,
    sinceMeleeFire: 1e3,
    sincePistolFire: 1e3,
    sinceShotgunFire: 1e3,
  };
  private readonly animation: ViewmodelAnimation = { weapon: "none", lowered: 0, swing: 0, pump: 0 };

  constructor(camera: THREE.Camera, models: WeaponModels) {
    this.models = models;
    this.crowbarElbow = models.crowbarPivot.clone().add(CROWBAR_ELBOW);
    this.crowbar = this.mount(camera, models.crowbar, this.crowbarElbow);
    this.pistol = this.mount(camera, models.pistol, models.pistolPivot);
    this.shotgun = this.mount(camera, models.shotgun, models.shotgunPivot);
    this.pump = drawOverWorld(new THREE.Mesh(models.shotgunPump, models.material));
    this.shotgun.children[0]!.add(this.pump);
  }

  private mount(camera: THREE.Camera, geometry: THREE.BufferGeometry, pivot: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    const mesh = drawOverWorld(new THREE.Mesh(geometry, this.models.material));
    mesh.position.copy(pivot).negate();
    group.add(mesh);
    group.visible = false;
    camera.add(group);
    return group;
  }

  // Appeler après la pose finale de caméra dans l’interpolation.
  update(alpha: number, weapons: ViewmodelSource) {
    weapons.viewmodelPose(alpha, this.scratchPosition, this.scratchEuler);
    const anim = viewmodelAnimationAt(weapons.viewmodelClocks(alpha, this.clocks), this.animation);

    this.crowbar.visible = anim.weapon === "melee";
    this.pistol.visible = anim.weapon === "pistol";
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
    } else if (anim.weapon === "pistol") {
      const group = this.pistol;
      group.position.copy(this.models.pistolPivot).add(this.scratchPosition);
      group.position.y -= LOWER_DROP * anim.lowered;
      group.rotation.set(this.scratchEuler.x + LOWER_PITCH * anim.lowered, 0, 0);
    } else if (anim.weapon === "shotgun") {
      const group = this.shotgun;
      group.position.copy(this.models.shotgunPivot).add(this.scratchPosition);
      group.position.y -= LOWER_DROP * anim.lowered;
      group.rotation.set(this.scratchEuler.x + LOWER_PITCH * anim.lowered, 0, PUMP_ROLL * anim.pump);
      this.pump.position.copy(this.models.pumpAxis).multiplyScalar(-PUMP_TRAVEL * anim.pump);
    }
  }

  // Position mondiale du canon tel qu’affiché ; ne modifie pas le tir.
  muzzleWorldPosition(out: THREE.Vector3, weapon: "pistol" | "shotgun" = "shotgun"): THREE.Vector3 {
    const group = weapon === "pistol" ? this.pistol : this.shotgun;
    const mesh = group.children[0]!;
    mesh.updateWorldMatrix(true, false);
    return mesh.localToWorld(out.copy(weapon === "pistol" ? this.models.pistolMuzzle : this.models.shotgunMuzzle));
  }
}

// see: docs/journal/audit-src-render-2026-10.md#contexte-preserve
