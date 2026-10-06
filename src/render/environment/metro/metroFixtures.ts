import type { MeshLambertMaterial, MeshStandardMaterial } from "three";

// see: docs/4-technique/pilote-metro.md#matériaux-et-lampes
export function illuminateMetroFixture(material: MeshLambertMaterial, source: MeshStandardMaterial): void {
  if (source.name !== "metro_lampe" && source.name !== "metro_signal") return;
  material.emissive.copy(source.emissive);
  material.emissiveIntensity = source.emissiveIntensity;
}
