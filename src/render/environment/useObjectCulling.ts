import type * as THREE from "three";

// see: docs/6-reference/notes-code-rendu.md#eclairage-et-elagage

export const USE_RENDER_DISTANCE = 48;
const USE_RENDER_DISTANCE_SQ = USE_RENDER_DISTANCE * USE_RENDER_DISTANCE;

export interface CullableUseObject {
  object: THREE.Object3D;
  // Position mondiale figée au chargement.
  position: THREE.Vector3;
}

export class UseObjectCulling {
  // Ne jamais rallumer un objet caché par la consommation.
  private readonly eteints = new WeakSet<THREE.Object3D>();

  // Appeler après la pose caméra de cette frame.
  update(useObjects: readonly CullableUseObject[], cameraPosition: THREE.Vector3): void {
    for (const useObject of useObjects) {
      const loin = cameraPosition.distanceToSquared(useObject.position) > USE_RENDER_DISTANCE_SQ;
      if (loin) {
        if (!useObject.object.visible) continue;
        useObject.object.visible = false;
        this.eteints.add(useObject.object);
        continue;
      }
      if (!this.eteints.has(useObject.object)) continue;
      useObject.object.visible = true;
      this.eteints.delete(useObject.object);
    }
  }
}
