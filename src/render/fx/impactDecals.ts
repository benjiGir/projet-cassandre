import * as THREE from "three";

// Decals réservés au décor statique : les surfaces mobiles laisseraient des impacts flottants.
const DECAL_POOL_SIZE = 24;
const DECAL_SIZE = 0.12; // m
// Détachement le long de la normale, évite le z-fighting avec la surface touchée.
const DECAL_OFFSET = 0.01; // m

const DECAL_COLOR = 0x1c1a18;

interface DecalSlot {
  mesh: THREE.Mesh;
}

const PLANE_DEFAULT_NORMAL = new THREE.Vector3(0, 0, 1);

export class ImpactDecals {
  private readonly decals: DecalSlot[] = [];
  private decalCursor = 0;

  constructor(private readonly scene: THREE.Scene) {
    for (let i = 0; i < DECAL_POOL_SIZE; i++) this.decals.push(this.createDecalSlot());
  }

  private createDecalSlot(): DecalSlot {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(DECAL_SIZE, DECAL_SIZE),
      new THREE.MeshLambertMaterial({ color: DECAL_COLOR }),
    );
    mesh.visible = false;
    this.scene.add(mesh);
    return { mesh };
  }

  spawnImpactDecal(point: THREE.Vector3, normal: THREE.Vector3, material: string) {
    void material;

    const slot = this.decals[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % this.decals.length;

    slot.mesh.position.copy(point).addScaledVector(normal, DECAL_OFFSET);
    slot.mesh.quaternion.setFromUnitVectors(PLANE_DEFAULT_NORMAL, normal);
    slot.mesh.visible = true;
  }

  reset(): void {
    for (const slot of this.decals) slot.mesh.visible = false;
    this.decalCursor = 0;
  }
}
