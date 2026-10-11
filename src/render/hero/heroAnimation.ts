import * as THREE from "three";
import type { ViewmodelClocks, WeaponKind } from "../../game/player/weapons/weaponTypes";
import type { HeroAsset, HeroPose } from "./heroTypes";
import { kickExtensionAt } from "../viewmodel/kickAnimation";

const ARM_BONES = new Set(["upper_arm_R", "forearm_R", "hand_R", "upper_arm_L", "forearm_L", "hand_L"]);
const KICK_BONES = new Set(["thigh_R", "shin_R", "foot_R"]);

function maskedClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  const upper = clip.name.startsWith("hold_") || clip.name.startsWith("fire_");
  const kick = clip.name === "kick";
  const tracks = clip.tracks.filter((track) => {
    const bone = track.name.split(".")[0];
    return upper
      ? ARM_BONES.has(bone)
      : kick
        ? KICK_BONES.has(bone) && track.name.endsWith(".quaternion")
        : !ARM_BONES.has(bone);
  });
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

export class HeroAnimation {
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly head: THREE.Object3D;
  private readonly spine: THREE.Object3D;
  private readonly rotation = new THREE.Quaternion();
  private readonly pitchAxis = new THREE.Vector3(1, 0, 0);

  constructor(asset: HeroAsset) {
    this.mixer = new THREE.AnimationMixer(asset.root);
    for (const clip of asset.animations) {
      const filtered = maskedClip(clip);
      if (clip.name === "kick") THREE.AnimationUtils.makeClipAdditive(filtered);
      const action = this.mixer.clipAction(filtered);
      action.play();
      action.setEffectiveWeight(0);
      this.actions.set(clip.name, action);
      if (clip.name === "walk" || clip.name === "run") {
        const arms = new THREE.AnimationClip(
          `${clip.name}_arms`,
          clip.duration,
          clip.tracks.filter((track) => ARM_BONES.has(track.name.split(".")[0])),
        );
        const armAction = this.mixer.clipAction(arms);
        armAction.play();
        armAction.setEffectiveWeight(0);
        this.actions.set(arms.name, armAction);
      }
    }
    const head = asset.root.getObjectByName("head");
    const spine = asset.root.getObjectByName("spine");
    if (!head || !spine) throw new Error("[héros] squelette incomplet");
    this.head = head;
    this.spine = spine;
  }

  private sample(name: string, seconds: number, weight: number): void {
    const action = this.actions.get(name);
    if (!action) throw new Error(`[héros] animation absente : ${name}`);
    action.time = THREE.MathUtils.euclideanModulo(seconds, action.getClip().duration);
    action.setEffectiveWeight(weight);
  }

  pose(pose: HeroPose, clocks: ViewmodelClocks, shownWeapon: WeaponKind): void {
    for (const action of this.actions.values()) action.setEffectiveWeight(0);
    const moving = pose.grounded ? pose.movement : 0;
    this.sample("idle", pose.elapsed, pose.grounded ? 1 - moving : 0);
    this.sample("walk", (pose.distance / 3.2) * 0.8, moving * (1 - pose.running));
    this.sample("run", (pose.distance / 4.2) * 0.55, moving * pose.running);
    this.sample("jump", 0, pose.grounded ? 0 : 1);

    const sinceFire =
      shownWeapon === "melee"
        ? clocks.sinceMeleeFire
        : shownWeapon === "pistol"
          ? clocks.sincePistolFire
          : shownWeapon === "shotgun"
            ? clocks.sinceShotgunFire
            : shownWeapon === "flare"
              ? clocks.sinceFlareFire
              : Infinity;
    const attack = shownWeapon === "none" ? undefined : this.actions.get(`fire_${shownWeapon}`);
    const firing = attack && sinceFire >= 0 && sinceFire < attack.getClip().duration ? 1 : 0;
    const armSwing = shownWeapon === "none" ? moving : 0;
    this.sample("walk_arms", (pose.distance / 3.2) * 0.8, armSwing * (1 - pose.running));
    this.sample("run_arms", (pose.distance / 4.2) * 0.55, armSwing * pose.running);
    this.sample(`hold_${shownWeapon}`, 0, (1 - firing) * (1 - armSwing));
    if (firing) this.sample(`fire_${shownWeapon}`, sinceFire, 1);
    const sinceKick = clocks.sinceKickFire ?? Infinity;
    if (shownWeapon === "none") this.sample("kick", 0.25, kickExtensionAt(sinceKick));
    this.mixer.update(0);

    // La visée reste celle de cette image ; le buste répartit le geste avec la tête.
    const pitch = -THREE.MathUtils.clamp(pose.pitch, -0.9, 0.9);
    this.spine.quaternion.multiply(this.rotation.setFromAxisAngle(this.pitchAxis, pitch * 0.55));
    this.head.quaternion.multiply(this.rotation.setFromAxisAngle(this.pitchAxis, pitch * 0.45));
  }

  dispose(root: THREE.Object3D): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(root);
  }
}
