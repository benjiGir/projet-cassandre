import { LEVEL_CHOICES } from "../../level/catalog/levels";

export const STORE_LEVEL_ID = "niveau_v2";
export const METRO_LEVEL_ID = "metro";

export function metroLevel() {
  const level = LEVEL_CHOICES.find((choice) => choice.id === METRO_LEVEL_ID);
  if (!level) throw new Error("Le métro manque au registre des niveaux");
  return level;
}
