import * as THREE from "three";
import type { ViewmodelAnimation } from "../viewmodel/viewmodelTypes";

interface Arm {
  readonly upper: THREE.Object3D;
  readonly forearm: THREE.Object3D;
  readonly hand: THREE.Object3D;
  readonly upperLength: number;
  readonly lowerLength: number;
}

function arm(root: THREE.Object3D, side: "R" | "L"): Arm {
  const upper = root.getObjectByName(`upper_arm_${side}`);
  const forearm = root.getObjectByName(`forearm_${side}`);
  const hand = root.getObjectByName(`hand_${side}`);
  if (!upper || !forearm || !hand) throw new Error(`[héros] bras ${side} incomplet`);
  return { upper, forearm, hand, upperLength: forearm.position.length(), lowerLength: hand.position.length() };
}

// Les cibles maintiennent les prises pendant le mélange des clips et le geste de pompe.
export class HeroArms {
  private readonly right: Arm;
  private readonly left: Arm;
  private readonly shoulder = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly pole = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly bend = new THREE.Vector3();
  private readonly elbow = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0, 1, 0);
  private readonly orientation = new THREE.Quaternion();
  private readonly parentRotation = new THREE.Quaternion();
  private readonly gripRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, Math.PI, 0, "YXZ"));
  private readonly aimRotation = new THREE.Quaternion();
  private readonly pitchAxis = new THREE.Vector3(1, 0, 0);

  constructor(private readonly root: THREE.Object3D) {
    this.right = arm(root, "R");
    this.left = arm(root, "L");
  }

  private orient(bone: THREE.Object3D, direction: THREE.Vector3): void {
    this.orientation.setFromUnitVectors(this.axis, direction);
    bone.parent?.getWorldQuaternion(this.parentRotation);
    bone.quaternion.copy(this.parentRotation.invert()).multiply(this.orientation);
    bone.updateWorldMatrix(false, true);
  }

  private reach(arm: Arm, x: number, y: number, z: number, side: number): void {
    this.target.set(x, y, z);
    this.pole.set(side * 0.43, 1.1, 0.06);
    this.root.localToWorld(this.target);
    this.root.localToWorld(this.pole);
    this.root.getWorldScale(this.scale);
    arm.upper.getWorldPosition(this.shoulder);
    this.direction.subVectors(this.target, this.shoulder);
    const upper = arm.upperLength * this.scale.y;
    const lower = arm.lowerLength * this.scale.y;
    const distance = Math.max(0.01, Math.min(this.direction.length(), upper + lower - 0.002));
    this.direction.normalize();
    this.bend.subVectors(this.pole, this.shoulder);
    this.bend.addScaledVector(this.direction, -this.bend.dot(this.direction)).normalize();
    const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
    const across = Math.sqrt(Math.max(0, upper * upper - along * along));
    this.elbow.copy(this.shoulder).addScaledVector(this.direction, along).addScaledVector(this.bend, across);
    this.direction.subVectors(this.elbow, this.shoulder).normalize();
    this.orient(arm.upper, this.direction);
    this.direction.subVectors(this.target, this.elbow).normalize();
    this.orient(arm.forearm, this.direction);
    this.root.getWorldQuaternion(this.orientation);
    this.orientation.multiply(this.aimRotation).multiply(this.gripRotation);
    arm.hand.parent?.getWorldQuaternion(this.parentRotation);
    arm.hand.quaternion.copy(this.parentRotation.invert()).multiply(this.orientation);
    arm.hand.updateWorldMatrix(false, true);
  }

  pose(animation: ViewmodelAnimation, pitch: number, recoil: number): void {
    const weapon = animation.weapon;
    if (weapon === "none" || weapon === "melee") return;
    this.aimRotation.setFromAxisAngle(this.pitchAxis, -pitch - recoil * 2);
    const drop = animation.lowered * 0.28;
    const aim = Math.sin(pitch) * 0.2;
    if (weapon === "shotgun") {
      this.reach(this.right, -0.1, 1.31 - drop + aim, 0.18 - recoil, -1);
      this.reach(this.left, -0.05, 1.29 - drop + aim, 0.49 - animation.pump * 0.085 - recoil, 1);
    } else if (weapon === "pistol") {
      this.reach(this.right, -0.025, 1.3 - drop + aim, 0.32 - recoil, -1);
      this.reach(this.left, 0.025, 1.285 - drop + aim, 0.31 - recoil, 1);
    } else {
      this.reach(this.right, -0.17, 1.29 - drop + aim, 0.42 - recoil, -1);
    }
  }
}
