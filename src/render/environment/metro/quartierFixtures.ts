import type { MeshLambertMaterial, MeshStandardMaterial } from "three";

const EMISSIVE_SURFACES = new Set(["quartier_lampe", "quartier_vitre_chaude"]);

// see: docs/4-technique/pilote-quartier.md#éclairage
export function illuminateQuartierFixture(material: MeshLambertMaterial, source: MeshStandardMaterial): void {
  if (!EMISSIVE_SURFACES.has(source.name)) return;
  material.emissive.copy(source.emissive);
  material.emissiveIntensity = source.emissiveIntensity;
}
