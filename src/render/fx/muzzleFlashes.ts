import * as THREE from "three";

// Frames d’affichage, pas pas fixes.
const MUZZLE_FLASH_FRAMES = 2;
const MUZZLE_FLASH_POOL_SIZE = 2;

interface MuzzleFlashPreset {
  color: number;

  intensity: number;
  // Portée de la lumière, en mètres.
  range: number;
  // Taille du quad (côté du carré), en mètres.
  size: number;
  // Décalage le long de `muzzleDirection` depuis `muzzlePosition`, en mètres.
  offset: number;
}

// Le pied-de-biche ne doit recevoir aucun flash de canon.
const MUZZLE_FLASH_PRESETS: Record<"pistol" | "shotgun", MuzzleFlashPreset> = {

  pistol: { color: 0xfff0b0, intensity: 28, range: 4, size: 0.12, offset: 0.06 },

  shotgun: { color: 0xfff2c0, intensity: 60, range: 6, size: 0.22, offset: 0.06 },
};

interface MuzzleFlashSlot {
  light: THREE.PointLight;
  quad: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  // Frames d'affichage restantes avant extinction. 0 = éteint.
  framesRemaining: number;
}

const PLANE_DEFAULT_NORMAL = new THREE.Vector3(0, 0, 1);

export class MuzzleFlashes {
  private readonly muzzleFlashes: MuzzleFlashSlot[] = [];
  private muzzleFlashCursor = 0;
  private readonly scratchDir = new THREE.Vector3();

  constructor(private readonly scene: THREE.Scene) {
    for (let i = 0; i < MUZZLE_FLASH_POOL_SIZE; i++) this.muzzleFlashes.push(this.createMuzzleFlashSlot());
  }

  private createMuzzleFlashSlot(): MuzzleFlashSlot {
    const light = new THREE.PointLight(0xfff2c0, 0, 1, 2);
    light.visible = false;
    this.scene.add(light);

    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 1 }),
    );
    quad.visible = false;
    this.scene.add(quad);

    return { light, quad, framesRemaining: 0 };
  }

  spawnMuzzleFlash(position: THREE.Vector3, direction: THREE.Vector3, weapon: "pistol" | "shotgun") {
    const preset = MUZZLE_FLASH_PRESETS[weapon];
    const slot = this.muzzleFlashes[this.muzzleFlashCursor]!;
    this.muzzleFlashCursor = (this.muzzleFlashCursor + 1) % this.muzzleFlashes.length;

    slot.light.position.copy(position).addScaledVector(direction, preset.offset);
    slot.light.color.setHex(preset.color);
    slot.light.intensity = preset.intensity;
    slot.light.distance = preset.range;
    slot.light.visible = true;

    slot.quad.position.copy(slot.light.position);
    slot.quad.material.emissive.setHex(preset.color);
    slot.quad.scale.setScalar(preset.size);
    // La normale du flash regarde à l’opposé du tir, vers le joueur.
    this.scratchDir.copy(direction).negate().normalize();
    slot.quad.quaternion.setFromUnitVectors(PLANE_DEFAULT_NORMAL, this.scratchDir);
    slot.quad.visible = true;

    slot.framesRemaining = MUZZLE_FLASH_FRAMES;
  }

  reset(): void {
    for (const slot of this.muzzleFlashes) {
      slot.framesRemaining = 0;
      slot.light.visible = false;
      slot.quad.visible = false;
    }
    this.muzzleFlashCursor = 0;
  }

  update(): void {
    for (const slot of this.muzzleFlashes) {
      if (slot.framesRemaining <= 0) continue;
      slot.framesRemaining -= 1;
      if (slot.framesRemaining <= 0) {
        slot.light.visible = false;
        slot.quad.visible = false;
      }
    }
  }
}
