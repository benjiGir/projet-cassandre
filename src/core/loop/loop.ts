import { input } from "../input/input";
import { RollingP95 } from "./rollingP95";

export const FIXED_DT = 1 / 60;
const MAX_FRAME = 0.25; // garde-fou anti spiral of death

export interface LoopStats {
  // see: docs/6-reference/notes-code-core.md#rejeu-et-horloge
  steps: number;
  accumulator: number;
  alpha: number;
  gameplayMs: number;
  gameplayP95Ms: number;
  physicsMs: number;
  renderMs: number;
}

export interface LoopCallbacks {
  updateDisplayInput: () => void;
  snapshotPrevious: () => void;
  updateGameplay: (dt: number) => void;
  stepPhysics: (dt: number) => void;
  interpolateVisuals: (alpha: number) => void;
  updateFx: (realDt: number, stats: LoopStats) => void;
  render: () => void;
}

export function startLoop(callbacks: LoopCallbacks) {
  let accumulator = 0;
  let last = performance.now();
  let lastRenderMs = 0;
  const gameplayP95 = new RollingP95();
  let gameplayP95Ms = 0;
  let frameNumber = 0;

  function frame(now: number) {
    requestAnimationFrame(frame);

    let frameTime = (now - last) / 1000;
    last = now;
    if (frameTime > MAX_FRAME) frameTime = MAX_FRAME;
    accumulator += frameTime;

    input.beginFrame();
    callbacks.updateDisplayInput();

    let steps = 0;
    let gameplayMs = 0;
    let physicsMs = 0;
    while (accumulator >= FIXED_DT) {
      input.beginFixedStep();
      callbacks.snapshotPrevious();
      const gameplayStart = performance.now();
      callbacks.updateGameplay(FIXED_DT);
      gameplayMs += performance.now() - gameplayStart;
      const physicsStart = performance.now();
      callbacks.stepPhysics(FIXED_DT);
      physicsMs += performance.now() - physicsStart;
      accumulator -= FIXED_DT;
      steps++;
    }
    gameplayP95.record(gameplayMs);
    if (++frameNumber % 6 === 0) gameplayP95Ms = gameplayP95.value();

    const alpha = accumulator / FIXED_DT;
    const renderStart = performance.now();
    callbacks.interpolateVisuals(alpha);
    callbacks.updateFx(frameTime, { steps, accumulator, alpha, gameplayMs, gameplayP95Ms, physicsMs, renderMs: lastRenderMs });
    callbacks.render();
    lastRenderMs = performance.now() - renderStart;

    input.endFrame();
  }

  requestAnimationFrame(frame);
}
