import type { KickConfig } from "../../../../../../game/player/weapons/kickConfig";
import type { TuningSliderProps } from "../../../controls/TuningSlider/TuningSlider";

export const KICK_VARIANT_LABELS = {
  VIF: "Vif — geste court",
  FRANC: "Franc — extension marquée",
  LOURD: "Lourd — retour plus lent",
};

export const KICK_FIELDS = [
  { key: "range", label: "Portée", unit: "m", min: 0.5, max: 2, step: 0.05, decimals: 2 },
  { key: "hitRadius", label: "Largeur du contact", unit: "m", min: 0.05, max: 0.4, step: 0.01, decimals: 2 },
  { key: "damage", label: "Dégâts", min: 5, max: 40, step: 1, decimals: 0 },
  { key: "cooldown", label: "Intervalle entre deux coups", unit: "s", min: 0.2, max: 1, step: 0.01, decimals: 2 },
  { key: "strike", label: "Extension avant impact", unit: "s", min: 0.04, max: 0.2, step: 0.01, decimals: 2 },
  { key: "hold", label: "Maintien du pied", unit: "s", min: 0, max: 0.15, step: 0.01, decimals: 2 },
  { key: "recover", label: "Retour", unit: "s", min: 0.1, max: 0.5, step: 0.01, decimals: 2 },
] satisfies Array<Omit<TuningSliderProps, "value" | "onChange"> & { key: keyof KickConfig }>;
