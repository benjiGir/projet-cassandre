import { moveConfig, type MoveConfig } from "../player/movement/moveConfig";

// Capturé avant l’application des préférences persistées.
const DEFAULT_MOVE_CONFIG: MoveConfig = { ...moveConfig };
const APPLY_CONFIG_THROTTLE_MS = 100;

// see: docs/6-reference/notes-code-interface.md#outils-de-développement
export function createMovementTuning() {
  let lastApplyAt = 0;

  function apply(force: boolean) {
    const player = window.cassandre?.player;
    if (!player) return;
    const now = performance.now();
    if (!force && now - lastApplyAt < APPLY_CONFIG_THROTTLE_MS) return;
    lastApplyAt = now;
    player.applyConfig();
  }

  return {
    apply,
    reset() {
      Object.assign(moveConfig, DEFAULT_MOVE_CONFIG);
      apply(true);
    },
  };
}
