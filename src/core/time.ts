export class GameClock {
  elapsed = 0;

  private hitstopRemaining = 0;
  private hitstopScale = 1;

  /** Repart d'une horloge neutre au changement de partie. */
  reset(): void {
    this.elapsed = 0;
    this.hitstopRemaining = 0;
    this.hitstopScale = 1;
  }

  /** Slows gameplay dt (not physics dt) for `duration` seconds. */
  triggerHitstop(duration: number, scale = 0.05) {
    this.hitstopRemaining = duration;
    this.hitstopScale = scale;
  }

  /** Advances the clock by the fixed step and returns the scaled dt gameplay code should use. */
  tick(fixedDt: number): number {
    this.elapsed += fixedDt;

    if (this.hitstopRemaining <= 0) return fixedDt;

    this.hitstopRemaining -= fixedDt;
    return fixedDt * this.hitstopScale;
  }
}
