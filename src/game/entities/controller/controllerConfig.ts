import { suitConfig, type SuitConfig } from "../suit/suitConfig";
import type { EnemyChargeConfig } from "../shared/enemyTypes";

export const controllerCharge: EnemyChargeConfig = {
  speed: 16,
  distance: 12,
  reach: 1.1,
  recovery: 1,
  pushDistance: 5,
  pushDuration: 0.5,
  charges: 1,
  interruptRange: 3,
  maxDrop: 0.55,
};

export const controllerConfig: SuitConfig = {
  ...suitConfig,
  maxHp: 70,
  chaseSpeed: 4,
  attackRange: 12,
  alertDuration: 0.45,
  attackTelegraphDuration: 0.8,
  attackCooldown: 1.2,
  attackDamage: 5,
  aimJitterDeg: 0,
  charge: controllerCharge,
};

export const brigadeConfig: SuitConfig = {
  ...controllerConfig,
  maxHp: controllerConfig.maxHp * 3,
  charge: { ...controllerCharge, charges: 2 },
};

export const CONTROLLER_VARIANTS = {
  A: { speed: 14, pushDistance: 3, recovery: 1.2 },
  B: { speed: 16, pushDistance: 5, recovery: 1 },
  C: { speed: 18, pushDistance: 6, recovery: 0.8 },
} as const;
