// see: docs/6-reference/conventions-nommage.md#nourriture
export const FOOD_ITEMS = ["donut", "sandwich", "jambon", "poulet", "pizza"] as const;
export type FoodItem = (typeof FOOD_ITEMS)[number];

/** PV rendus par aliment — barème du chantier « Les coulisses ». */
export const FOOD_HEAL_AMOUNTS: Record<FoodItem, number> = {
  donut: 5,
  sandwich: 10,
  jambon: 15,
  poulet: 25,
  pizza: 25,
};

/** `null` si `raw` n'est pas une chaîne ou ne nomme aucun aliment connu —
 * jamais bloquant, voir les avertissements bruyants côté appelants. */
export function parseFoodItem(raw: unknown): FoodItem | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return (FOOD_ITEMS as readonly string[]).includes(value) ? (value as FoodItem) : null;
}
