import type { MeshLambertMaterial } from "three";

export function applyMinimumLight(material: MeshLambertMaterial, amount: number): void {
  const minimum = Math.min(1, Math.max(0, amount));
  if (minimum === 0) return;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.minimumDiffuseLight = { value: minimum };
    shader.fragmentShader = `uniform float minimumDiffuseLight;\n${shader.fragmentShader}`.replace(
      "#include <lights_fragment_end>",
      "#include <lights_fragment_end>\nreflectedLight.indirectDiffuse = max(reflectedLight.indirectDiffuse, diffuseColor.rgb * minimumDiffuseLight);",
    );
  };
  material.customProgramCacheKey = () => "minimum-diffuse-light";
  material.needsUpdate = true;
}
