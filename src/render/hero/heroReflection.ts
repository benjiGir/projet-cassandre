import * as THREE from "three";
import type { ViewmodelClocks } from "../../game/player/weapons/weaponTypes";
import type { ViewmodelAnimation, ViewmodelSource } from "../viewmodel/viewmodelTypes";
import { viewmodelAnimationAt } from "../viewmodel/viewmodelAnimation";
import { kickExtensionAt } from "../viewmodel/kickAnimation";
import { registerReflectionActor } from "../environment/reflectionActors";
import { HERO_EYE_HEIGHT, HeroBillboard } from "./heroBillboard";
import type { HeroAsset, HeroAtlasKind, HeroMovementSource, HeroPose } from "./heroTypes";

const WALK_ROWS = [1, 2, 3, 2] as const;

export class HeroReflection {
  readonly root: THREE.Group;
  private readonly billboard: HeroBillboard;
  private readonly viewmodel: ViewmodelAnimation = { weapon: "none", lowered: 0, swing: 0, pump: 0 };
  private readonly unregister: () => void;
  private readonly rotation = new THREE.Euler(0, 0, 0, "YXZ");
  private elapsed = 0;
  private previousElapsed = 0;
  private readonly poseInput = {
    eyePosition: new THREE.Vector3(),
    eyeHeight: HERO_EYE_HEIGHT,
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
  ) {
    this.billboard = new HeroBillboard(asset);
    this.root = this.billboard.root;
    this.root.name = "hero_reflection";
    scene.add(this.root);
    this.unregister = registerReflectionActor(scene, this.root);
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
    const moving = pose.grounded && pose.movement > 0.15;
    const walk = moving
      ? WALK_ROWS[Math.floor(pose.distance / (pose.running > 0.5 ? 0.85 : 0.65)) % WALK_ROWS.length]
      : 0;
    let atlas: HeroAtlasKind = "locomotion";
    let row: number = walk;
    const weapon = presentation.weapon;
    if (weapon !== "none") {
      atlas = "equipment";
      row = weapon === "pistol" ? 0 : weapon === "shotgun" ? 1 : weapon === "melee" ? 2 : 3;
      if (moving) {
        atlas = "armedWalk";
        const step = Math.floor(pose.distance / (pose.running > 0.5 ? 0.85 : 0.65)) % 2;
        if (weapon === "flare" && step === 1) {
          atlas = "equipment";
          row = 3;
        } else row = row * 2 + (weapon === "flare" ? 0 : step);
      }
      if (weapon === "melee" && presentation.swing > 0.3) {
        atlas = "actions";
        row = 2;
      }
      if (weapon === "shotgun" && presentation.pump > 0.35) {
        atlas = "actions";
        row = 3;
      }
    } else {
      const kick = kickExtensionAt(clocks.sinceKickFire ?? Infinity);
      if (kick > 0.05) {
        atlas = "actions";
        row = kick < 0.65 ? 0 : 1;
      }
    }
    this.root.position.copy(pose.eyePosition);
    this.root.position.y -= pose.eyeHeight;
    this.root.scale.setScalar(pose.eyeHeight / HERO_EYE_HEIGHT);
    const sinceFire =
      weapon === "pistol"
        ? clocks.sincePistolFire
        : weapon === "shotgun"
          ? clocks.sinceShotgunFire
          : weapon === "flare"
            ? clocks.sinceFlareFire
            : Infinity;
    const recoil = sinceFire >= 0 && sinceFire < 0.18 ? Math.sin((sinceFire * Math.PI) / 0.18) * 0.025 : 0;
    this.billboard.pose(pose.yaw, atlas, row, recoil);
  }

  prepareWarmup(view: THREE.Camera): () => void {
    const position = this.root.position.clone();
    const quaternion = this.root.quaternion.clone();
    this.root.position.copy(view.position);
    this.root.position.y -= HERO_EYE_HEIGHT;
    this.rotation.setFromQuaternion(view.quaternion, "YXZ");
    this.billboard.pose(this.rotation.y, "locomotion", 0);
    return () => {
      this.root.position.copy(position);
      this.root.quaternion.copy(quaternion);
      this.root.updateMatrixWorld(true);
    };
  }

  dispose(): void {
    this.unregister();
    this.billboard.dispose();
    for (const atlas of Object.values(this.asset.atlases)) atlas.texture.dispose();
  }
}
