import type { MeshLambertMaterial, MeshStandardMaterial } from "three";

const VENDING_MATERIALS = new Set([
  "mat_prd_distributeur_soda_5g_cola",
  "mat_prd_distributeur_chips_illumi",
  "mat_prd_distributeur_cafe_reveille",
]);

export function illuminateVendingMachine(material: MeshLambertMaterial, source: MeshStandardMaterial): void {
  if (!VENDING_MATERIALS.has(material.name) || !source.emissiveMap) return;
  material.emissiveMap = source.emissiveMap;
  material.emissive.set(0xffffff);
  material.emissiveIntensity = 0.55;
}
