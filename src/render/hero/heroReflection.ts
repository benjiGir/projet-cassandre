import * as THREE from "three";
import type { ViewmodelClocks, WeaponKind } from "../../game/player/weapons/weaponTypes";
import type { ViewmodelAnimation, ViewmodelSource, WeaponModels } from "../viewmodel/viewmodelTypes";
import { viewmodelAnimationAt } from "../viewmodel/viewmodelAnimation";
import { registerReflectionActor } from "../environment/reflectionActors";
import { HeroAnimation } from "./heroAnimation";
import { HeroArms } from "./heroArms";
import type { HeroAsset, HeroMovementSource, HeroPose } from "./heroTypes";

const MODEL_EYE_HEIGHT = 1.65;

export class HeroReflection {
  readonly root: THREE.Group;
  private readonly animation: HeroAnimation;
  private readonly arms: HeroArms;
  private readonly weapons = new Map<WeaponKind, THREE.Mesh>();
  private readonly viewmodel: ViewmodelAnimation = { weapon: "none", lowered: 0, swing: 0, pump: 0 };
  private readonly unregister: () => void;
  private readonly headRotation = new THREE.Euler(0, 0, 0, "YXZ");
  private elapsed = 0;
  private previousElapsed = 0;
  private readonly poseInput = {
    eyePosition: new THREE.Vector3(),
    eyeHeight: MODEL_EYE_HEIGHT,
    yaw: 0,
    pitch: 0,
    elapsed: 0,
    distance: 0,
    movement: 0,
    running: 0,
    grounded: true,
  };
  private readonly clocks: ViewmodelClocks = {
    active: "none",
    previous: "none",
    sinceSwitch: 1e3,
    sinceKickFire: 1e3,
    sinceMeleeFire: 1e3,
    sincePistolFire: 1e3,
    sinceShotgunFire: 1e3,
    sinceFlareFire: 1e3,
  };

  constructor(
    scene: THREE.Scene,
    private readonly asset: HeroAsset,
    models: WeaponModels,
  ) {
    this.root = asset.root;
    this.root.name = "hero_reflection";
    this.animation = new HeroAnimation(asset);
    this.arms = new HeroArms(this.root);
    scene.add(this.root);
    this.unregister = registerReflectionActor(scene, this.root);
    const hand = this.root.getObjectByName("hand_R");
    if (!hand) throw new Error("[héros] main droite absente");
    this.root.updateMatrixWorld(true);
    const grip = new THREE.Vector3();
    hand.getWorldPosition(grip);
    grip.y -= 0.055;
    const inverse = new THREE.Matrix4().copy(hand.matrixWorld).invert();
    const rest = new THREE.Matrix4().compose(
      grip,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2)),
      new THREE.Vector3(1, 1, 1),
    );
    for (const [kind, geometry, handle] of [
      ["melee", models.worldCrowbar, new THREE.Vector3(0, 0.014, 0.22)],
      ["pistol", models.worldPistol, new THREE.Vector3(-0.03, 0.0255, 0.079)],
      ["shotgun", models.worldShotgun, new THREE.Vector3(-0.015, 0.035, 0.175)],
      ["flare", models.worldFlare, new THREE.Vector3(-0.04, 0.0245, 0.068)],
    ] as const) {
      const mesh = new THREE.Mesh(geometry, models.material);
      mesh.name = `hero_${kind}`;
      const placement = new THREE.Matrix4()
        .multiplyMatrices(inverse, rest)
        .multiply(new THREE.Matrix4().makeTranslation(-handle.x, -handle.y, -handle.z));
      mesh.applyMatrix4(placement);
      mesh.visible = false;
      hand.add(mesh);
      this.weapons.set(kind, mesh);
    }
    this.animation.pose(this.poseInput, this.clocks, "none");
  }

  reset(): void {
    this.elapsed = this.previousElapsed = 0;
  }

  snapshotPrevious(): void {
    this.previousElapsed = this.elapsed;
  }

  advance(dt: number): void {
    this.elapsed += dt;
  }

  update(
    alpha: number,
    player: HeroMovementSource,
    weapons: ViewmodelSource,
    yaw: number,
    pitch: number,
    eyeHeight: number,
  ): void {
    const pose = this.poseInput;
    player.eyePosition(alpha, pose.eyePosition);
    pose.eyeHeight = eyeHeight;
    pose.yaw = yaw;
    pose.pitch = pitch;
    pose.elapsed = THREE.MathUtils.lerp(this.previousElapsed, this.elapsed, alpha);
    pose.distance = THREE.MathUtils.lerp(player.previousDistanceTravelled, player.distanceTravelled, alpha);
    pose.movement = Math.min(1, THREE.MathUtils.lerp(player.previousBobIntensity, player.bobIntensity, alpha) * 2);
    pose.running = player.runFactorAt(alpha);
    pose.grounded = player.isGrounded;
    this.pose(pose, weapons.viewmodelClocks(alpha, this.clocks));
  }

  pose(pose: HeroPose, clocks: ViewmodelClocks): void {
    const presentation = viewmodelAnimationAt(clocks, this.viewmodel);
    this.animation.pose(pose, clocks, presentation.weapon);
    this.root.position.copy(pose.eyePosition);
    this.root.position.y -= pose.eyeHeight;
    this.root.rotation.set(0, pose.yaw + Math.PI, 0);
    this.root.scale.setScalar(pose.eyeHeight / MODEL_EYE_HEIGHT);
    this.root.updateMatrixWorld(true);
    const sinceFire =
      presentation.weapon === "pistol"
        ? clocks.sincePistolFire
        : presentation.weapon === "shotgun"
          ? clocks.sinceShotgunFire
          : clocks.sinceFlareFire;
    const recoil = sinceFire >= 0 && sinceFire < 0.2 ? Math.sin((sinceFire * Math.PI) / 0.2) * 0.04 : 0;
    this.arms.pose(presentation, pose.pitch, recoil);
    for (const [kind, mesh] of this.weapons) mesh.visible = kind === presentation.weapon;
    this.root.updateMatrixWorld(true);
  }

  prepareWarmup(view: THREE.Camera): () => void {
    const position = this.root.position.clone();
    const quaternion = this.root.quaternion.clone();
    this.root.position.copy(view.position);
    this.root.position.y -= MODEL_EYE_HEIGHT;
    this.headRotation.setFromQuaternion(view.quaternion, "YXZ");
    this.root.rotation.set(0, this.headRotation.y + Math.PI, 0);
    this.root.updateMatrixWorld(true);
    return () => {
      this.root.position.copy(position);
      this.root.quaternion.copy(quaternion);
      this.root.updateMatrixWorld(true);
    };
  }

  dispose(): void {
    this.unregister();
    this.root.removeFromParent();
    for (const mesh of this.weapons.values()) mesh.removeFromParent();
    this.animation.dispose(this.root);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.asset.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        const texture = (material as THREE.MeshLambertMaterial).map;
        if (texture) textures.add(texture);
      }
      if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
  }
}
