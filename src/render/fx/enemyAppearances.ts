import * as THREE from "three";
import type { MeshBasicNodeMaterial } from "three/webgpu";

import type { BillboardSprite } from "../sprites/billboard";
import { createEnemyAppearanceMaterial, createEnemyAppearanceRingMaterial } from "./enemyAppearanceMaterial";

interface EnemyAppearanceSlot {
  ring: THREE.Mesh<THREE.PlaneGeometry, MeshBasicNodeMaterial>;
}

// see: docs/6-reference/notes-code-rendu.md#matérialisation-des-embuscades
export class EnemyAppearances {
  private readonly active = new Map<BillboardSprite, EnemyAppearanceSlot>();
  private readonly placeholderAtlas = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  private readonly material: MeshBasicNodeMaterial;
  private readonly atlasIndices = new Map<THREE.Texture["source"], number>();
  private readonly atlases: readonly THREE.Texture[];
  private readonly ringGeometry = new THREE.PlaneGeometry(1.65, 1.65);
  private readonly ringMaterial = createEnemyAppearanceRingMaterial();
  private serial = 0;

  constructor(private readonly scene: THREE.Scene, atlases: readonly THREE.Texture[] = []) {
    this.placeholderAtlas.colorSpace = THREE.SRGBColorSpace;
    this.placeholderAtlas.magFilter = THREE.NearestFilter;
    this.placeholderAtlas.minFilter = THREE.NearestFilter;
    this.placeholderAtlas.needsUpdate = true;
    this.atlases = atlases.length > 0 ? atlases : [this.placeholderAtlas];
    this.atlases.forEach((atlas, i) => this.atlasIndices.set(atlas.source, i));
    this.material = createEnemyAppearanceMaterial(this.atlases);
  }

  spawn(sprite: BillboardSprite, feetY: number): void {
    this.finish(sprite);
    const map = sprite.material.map!;
    const atlasIndex = this.atlasIndices.get(map.source);
    if (atlasIndex === undefined) throw new Error("[apparition] atlas absent de la banque des ennemis");
    sprite.mesh.userData.appearanceAtlasIndex = atlasIndex;
    sprite.mesh.userData.appearanceMap = map;
    sprite.mesh.userData.appearanceUv = new THREE.Vector4();
    sprite.mesh.userData.appearanceProgress = 0;
    sprite.mesh.userData.appearanceSeed = (this.serial++ * 2.399963) % (Math.PI * 2);
    sprite.mesh.material = this.material;
    const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(sprite.mesh.position);
    ring.position.y = feetY + 0.025;
    ring.userData.appearanceProgress = 0;
    this.scene.add(ring);
    this.active.set(sprite, { ring });
  }

  follow(sprite: BillboardSprite, progress: number, alive: boolean): void {
    const slot = this.active.get(sprite);
    if (!slot) return;
    if (!alive || progress >= 1) {
      this.finish(sprite);
      return;
    }
    sprite.mesh.userData.appearanceProgress = progress;
    slot.ring.userData.appearanceProgress = progress;
    slot.ring.position.x = sprite.mesh.position.x;
    slot.ring.position.z = sprite.mesh.position.z;
    slot.ring.scale.setScalar(0.78 + Math.sin(progress * Math.PI) * 0.22);
  }

  reset(): void {
    for (const sprite of this.active.keys()) this.finish(sprite);
    this.serial = 0;
  }

  async warm(camera: THREE.Camera, render: () => void): Promise<void> {
    const geometry = new THREE.PlaneGeometry(1, 1.8);
    const placeholder = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh<THREE.PlaneGeometry, THREE.Material>(geometry, placeholder);
    const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
    const position = new THREE.Vector3();
    camera.getWorldPosition(position);
    camera.getWorldDirection(mesh.position).multiplyScalar(3).add(position);
    mesh.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion()));
    mesh.userData.appearanceUv = new THREE.Vector4();
    mesh.userData.appearanceProgress = 0.5;
    mesh.userData.appearanceSeed = 0;
    mesh.userData.appearanceAtlasIndex = 0;
    mesh.userData.appearanceMap = this.atlases[0];
    ring.position.copy(mesh.position).addScaledVector(new THREE.Vector3(0, 1, 0), -0.8);
    ring.rotation.x = -Math.PI / 2;
    ring.userData.appearanceProgress = 0.5;
    this.scene.add(mesh, ring);
    try {
      mesh.material = this.material;
      render();
      await Promise.resolve();
      render();
    } finally {
      this.scene.remove(mesh, ring);
      geometry.dispose();
      placeholder.dispose();
    }
  }

  private finish(sprite: BillboardSprite): void {
    const slot = this.active.get(sprite);
    if (!slot) return;
    sprite.mesh.material = sprite.material;
    delete sprite.mesh.userData.appearanceMap;
    delete sprite.mesh.userData.appearanceUv;
    delete sprite.mesh.userData.appearanceProgress;
    delete sprite.mesh.userData.appearanceSeed;
    delete sprite.mesh.userData.appearanceAtlasIndex;
    this.scene.remove(slot.ring);
    this.active.delete(sprite);
  }
}
