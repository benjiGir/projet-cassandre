import { PROP_FRAGMENT_VARIANTS, propDebrisConfig } from "../../render/fx/propDebris/propDebrisConfig";

export function applyPropDebrisVariant(name: keyof typeof PROP_FRAGMENT_VARIANTS): void {
  Object.assign(propDebrisConfig, PROP_FRAGMENT_VARIANTS[name]);
}
