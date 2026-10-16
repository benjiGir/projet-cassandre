import type { PropDebrisMaterial } from "../../../render/fx/propDebris/propDebrisTypes";
import type { PropMaterial } from "../../level/props/props";

const DEBRIS_MATERIAL_BY_CONTENT: Record<PropMaterial, PropDebrisMaterial> = {
  carton: "cardboard",
  bois: "wood",
  verre: "glass",
  metal: "metal",
  electronique: "electronics",
  gaz: "gas",
  farine: "flour",
  eau: "water",
};

export function toDebrisMaterial(material: PropMaterial): PropDebrisMaterial {
  return DEBRIS_MATERIAL_BY_CONTENT[material];
}
