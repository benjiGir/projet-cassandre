import * as THREE from "three";
import { applyMinimumLight } from "../materials/minimumLight";
import type { HeroAsset, HeroAtlasKind } from "./heroTypes";

export const HERO_HEIGHT = 1.86;
export const HERO_EYE_HEIGHT = 1.6;

export class HeroBillboard {
  readonly root = new THREE.Group();
  private readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  private readonly textures: Readonly<Record<HeroAtlasKind, THREE.Texture>>;
  private readonly toCamera = new THREE.Vector3();
  private readonly forward = new THREE.Vector3(0, 0, -1);
  private readonly cameraPosition = new THREE.Vector3();
  private atlas: HeroAtlasKind = "locomotion";
  private row = 0;
  private direction = 0;
  private recoil = 0;

  constructor(private readonly asset: HeroAsset) {
    const clone = (kind: HeroAtlasKind) => {
      const texture = asset.atlases[kind].texture.clone();
      texture.needsUpdate = true;
      return texture;
    };
    this.textures = {
      locomotion: clone("locomotion"),
      equipment: clone("equipment"),
      actions: clone("actions"),
      armedWalk: clone("armedWalk"),
    };
    const material = new THREE.MeshLambertMaterial({
      map: this.textures.locomotion,
      alphaTest: 0.5,
      transparent: false,
      depthWrite: true,
    });
    applyMinimumLight(material, 0.32);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    this.mesh.frustumCulled = false;
    // Chaque miroir a sa caméra virtuelle : la vue doit être choisie dans sa passe.
    this.mesh.onBeforeRender = (_renderer, _scene, camera) => this.face(camera);
    this.root.add(this.mesh);
  }

  pose(yaw: number, atlas: HeroAtlasKind, row: number, recoil = 0): void {
    this.forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    this.atlas = atlas;
    this.row = row;
    this.recoil = recoil;
  }

  private face(camera: THREE.Camera): void {
    camera.getWorldPosition(this.cameraPosition);
    this.toCamera.subVectors(this.cameraPosition, this.root.position).setY(0);
    if (this.toCamera.lengthSq() > 1e-8) {
      this.root.rotation.y = Math.atan2(this.toCamera.x, this.toCamera.z);
      this.toCamera.normalize();
      const angle = Math.atan2(
        this.forward.z * this.toCamera.x - this.forward.x * this.toCamera.z,
        this.forward.dot(this.toCamera),
      );
      this.direction = Math.round(THREE.MathUtils.euclideanModulo(angle, Math.PI * 2) / (Math.PI / 4)) % 8;
    }
    const atlas = this.asset.atlases[this.atlas];
    const frame = atlas.frames[this.row][this.direction];
    const texture = this.textures[this.atlas];
    texture.repeat.set(frame.width / atlas.width, frame.height / atlas.height);
    texture.offset.set(frame.x / atlas.width, 1 - (frame.y + frame.height) / atlas.height);
    this.mesh.material.map = texture;
    this.mesh.scale.set((frame.width / frame.height) * HERO_HEIGHT, HERO_HEIGHT, 1);
    this.mesh.position.set(
      ((frame.width * 0.5 - frame.anchorX) / frame.height) * HERO_HEIGHT,
      HERO_HEIGHT * 0.5,
      -this.recoil,
    );
    this.root.updateMatrixWorld(true);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    for (const texture of Object.values(this.textures)) texture.dispose();
  }
}
