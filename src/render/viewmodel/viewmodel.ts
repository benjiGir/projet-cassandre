import * as THREE from "three";
import type { ViewmodelClocks } from "../../game/player/weapons/weaponTypes";

import type { ViewmodelSource, WeaponModels, ViewmodelAnimation } from "./viewmodelTypes";
import { viewmodelAnimationAt } from "./viewmodelAnimation";
import { drawOverWorld } from "./viewmodelDepth";

// see: docs/6-reference/notes-code-rendu.md#viewmodel

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

  muzzleWorldDirection(out: THREE.Vector3, weapon: "pistol" | "shotgun"): THREE.Vector3 {
    const mesh = (weapon === "pistol" ? this.pistol : this.shotgun).children[0]!;
    mesh.updateWorldMatrix(true, false);
    return out.copy(weapon === "pistol" ? this.models.pistolAxis : this.models.pumpAxis).transformDirection(mesh.matrixWorld);
  }
}

// see: docs/journal/audit-src-render-2026-10.md#contexte-preserve
