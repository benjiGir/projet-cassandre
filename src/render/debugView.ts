import * as THREE from "three";

/**
 * Bascule wireframe à chaud sur TOUTE la géométrie de la scène rendue — outil
 * de debug (`KeyV`), pas une feature de jeu. `scene.traverse` couvre tout le
 * graphe, y compris les enfants de la caméra (le viewmodel), puisque la
 * caméra elle-même est ajoutée à `scene` (`game/session/gameEngine.ts`).
 *
 * Méthode, limite assumée et restriction à `MeshLambertMaterial` :
 * see: docs/systems/rendu.md#bascule-wireframe-de-debug
 */
export function createWireframeToggle(scene: THREE.Scene) {
  let enabled = false;
  let warnedNonLambert = false;

  function apply(value: boolean) {
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshLambertMaterial) {
          material.wireframe = value;
        } else if (!warnedNonLambert) {
          warnedNonLambert = true;
          console.warn(
            `[debugView] mesh "${obj.name || obj.uuid}" a un matériau non-Lambert ` +
              `(${material.type}) — invariant #5 potentiellement violé, wireframe non appliqué dessus.`,
          );
        }
      }
    });
  }

  return {
    get enabled() {
      return enabled;
    },
    /** Bascule l'état et l'applique immédiatement à tout ce qui est actuellement dans la scène. */
    toggle(): boolean {
      enabled = !enabled;
      apply(enabled);
      return enabled;
    },
  };
}
