/**
 * Nourriture ramassable façon Duke Nukem 3D — walk-over, jamais la touche E,
 * même mécanique que les trousses de soin (`use_*` portant `soin`).
 *
 * Deux origines partagent ce barème :
 * - posée dans Blender, `use_*` portant l'extra `aliment` (voir
 *   `loader.ts::buildUseObjectEffect`) : une variante de `soin` qui donne son
 *   montant de PV par le NOM de l'aliment plutôt qu'un nombre explicite ;
 * - lâchée par un `prop_*` détruit portant l'extra `contenu` (voir
 *   `props.ts::PropSystem`), au pas fixe, position tirée du RNG déterministe
 *   (invariants #1/#11/#12).
 *
 * Chantier « Les coulisses » (2026-09-26), système 1.
 * see: docs/6-reference/conventions-nommage.md#nourriture
 */
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
