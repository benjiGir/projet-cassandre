import type { MeshLambertMaterial } from "three";

const DOOR_CONTROL_MATERIAL = "mat_prd_commandes";
const PANEL_EMISSION = 0.6;

export function illuminateDoorControlPanel(material: MeshLambertMaterial): void {
  if (material.name !== DOOR_CONTROL_MATERIAL || !material.map) return;
  material.emissiveMap = material.map;
  material.emissive.set(0xffffff);
  material.emissiveIntensity = PANEL_EMISSION;
}
