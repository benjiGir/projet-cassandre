import { kickConfig } from "../../game/player/weapons/kickConfig";

export function kickExtensionAt(seconds: number): number {
  if (seconds < 0) return 0;
  if (seconds < kickConfig.strike) {
    const phase = seconds / kickConfig.strike;
    return 1 - (1 - phase) ** 3;
  }
  const recovery = seconds - kickConfig.strike - kickConfig.hold;
  if (recovery < 0) return 1;
  const phase = Math.min(1, recovery / kickConfig.recover);
  return 1 - phase * phase * (3 - 2 * phase);
}
