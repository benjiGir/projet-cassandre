import type { EnemyShieldConfig } from "./enemyTypes";

interface Horizontal {
  readonly x: number;
  readonly z: number;
}

/**
 * Le bouclier couvre l'avant du porteur : un impact dont la normale (le côté
 * du corps touché) tombe dans l'arc est arrêté. Vu de dessus seulement — on
 * ne passe pas par-dessus un bouclier en visant la tête.
 */
export function isShieldedHit(shield: EnemyShieldConfig | undefined, forward: Horizontal, hitNormal: Horizontal): boolean {
  if (!shield) return false;
  const length = Math.hypot(hitNormal.x, hitNormal.z);
  if (length < 1e-6) return false;
  const facing = (hitNormal.x * forward.x + hitNormal.z * forward.z) / length;
  return facing >= Math.cos((shield.halfArcDeg * Math.PI) / 180);
}
