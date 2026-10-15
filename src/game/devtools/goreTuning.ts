import { GORE_BURST_VARIANTS, goreConfig, type GoreBurstVariant } from "../../render/fx/goreConfig";

export function applyGoreVariant(name: GoreBurstVariant): void {
  Object.assign(goreConfig, GORE_BURST_VARIANTS[name]);
}
