import type { GoreBurstVariant } from "../../../../../render/fx/goreConfig";
import type { TuningField } from "../../lib/tuningTypes";

export const GORE_VARIANT_NAMES: readonly GoreBurstVariant[] = ["SOBRE", "RENFORCE"];
export const GORE_VARIANT_LABELS: Record<GoreBurstVariant, string> = {
  SOBRE: "Sobre — éclatement précédent",
  RENFORCE: "Renforcé — gerbe plus dense",
};

export const GORE_FIELDS = [
  { key: "gibChunks", label: "Morceaux par éclatement", min: 8, max: 24, step: 1, decimals: 0 },
  { key: "gibSprayCount", label: "Giclées par éclatement", min: 6, max: 18, step: 1, decimals: 0 },
  { key: "gibSprayGrow", label: "Durée d’étalement", unit: "s", min: 0.03, max: 0.3, step: 0.01, decimals: 2 },
] satisfies ReadonlyArray<TuningField<"gibChunks" | "gibSprayCount" | "gibSprayGrow">>;
