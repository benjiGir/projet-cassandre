import type { PROP_FRAGMENT_VARIANTS } from "../../../../../render/fx/propDebris/propDebrisConfig";
import type { TuningField } from "../../lib/tuningTypes";

export const PROP_DEBRIS_VARIANT_NAMES: readonly (keyof typeof PROP_FRAGMENT_VARIANTS)[] = ["SUBTLE", "DYNAMIC"];
export const PROP_DEBRIS_VARIANT_LABELS = {
  SUBTLE: "Sobre — chute proche",
  DYNAMIC: "Dynamique — projection plus ample",
};
export const PROP_DEBRIS_FIELDS = [
  { key: "speedScale", label: "Force de projection", min: 0.5, max: 1.8, step: 0.05, decimals: 2 },
  { key: "liftScale", label: "Élan vertical", min: 0.5, max: 1.8, step: 0.05, decimals: 2 },
] satisfies ReadonlyArray<TuningField<"speedScale" | "liftScale">>;
