import type { ViewmodelClocks } from "../../game/player/weapons/weaponTypes";
import type { ViewmodelAnimation } from "./viewmodelTypes";

// Durées de l'animation, en secondes de gameplay. Voir docs/4-technique/rendu.md.
export const VIEWMODEL_TIMING = {
  lower: 0.12,
  raise: 0.18,
  strike: 0.07,
  recover: 0.28,
  pumpStart: 0.2,
  pumpBack: 0.13,
  pumpForward: 0.15,
} as const;

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function viewmodelAnimationAt(clocks: ViewmodelClocks, out: ViewmodelAnimation): ViewmodelAnimation {
  const t = VIEWMODEL_TIMING;

  // Le tir interrompt la descente : l’animation ne bloque aucune action.
  const sinceActiveFire =
    clocks.active === "melee"
      ? clocks.sinceMeleeFire
      : clocks.active === "pistol"
        ? clocks.sincePistolFire
        : clocks.active === "shotgun"
          ? clocks.sinceShotgunFire
          : Infinity;
  const lowerPhase = clocks.previous === "none" ? 0 : t.lower;
  out.weapon = clocks.active;
  out.lowered = 0;
  if (sinceActiveFire >= clocks.sinceSwitch) {
    if (clocks.sinceSwitch < lowerPhase) {
      out.weapon = clocks.previous;
      out.lowered = easeInOut(clocks.sinceSwitch / t.lower);
    } else if (clocks.sinceSwitch < lowerPhase + t.raise) {
      out.lowered = 1 - easeOut((clocks.sinceSwitch - lowerPhase) / t.raise);
    }
  }

  const s = clocks.sinceMeleeFire;
  out.swing = s < t.strike ? easeOut(s / t.strike) : 1 - easeInOut(clamp01((s - t.strike) / t.recover));

  // Le pistolet n'a pas de mouvement propre : tout son geste est le recul
  // (`viewmodelPose`), plus sec et plus court que celui du pompe.
  const p = clocks.sinceShotgunFire - t.pumpStart;
  out.pump =
    p < 0 ? 0 : p < t.pumpBack ? easeInOut(p / t.pumpBack) : 1 - easeInOut(clamp01((p - t.pumpBack) / t.pumpForward));

  return out;
}
