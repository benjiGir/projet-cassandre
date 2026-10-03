import * as THREE from "three";

// see: docs/6-reference/notes-code-rendu.md#overlays-et-diagnostic
export function createWireframeToggle(scene: THREE.Scene) {
  let enabled = false;
  let warnedUnsupported = false;

  function apply(value: boolean) {
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if ("wireframe" in material && typeof material.wireframe === "boolean") {
          material.wireframe = value;
        } else if (!warnedUnsupported) {
          warnedUnsupported = true;
          console.warn(
            `[debugView] mesh "${obj.name || obj.uuid}" a un matériau sans wireframe ` +
              `(${material.type}) — wireframe non appliqué dessus.`,
          );
        }
      }
    });
  }

  return {
    get enabled() {
      return enabled;
    },

    toggle(): boolean {
      enabled = !enabled;
      apply(enabled);
      return enabled;
    },
  };
}
