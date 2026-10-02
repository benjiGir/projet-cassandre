export class GameClock {
  elapsed = 0;

  private hitstopRemaining = 0;
  private hitstopScale = 1;

  // see: docs/6-reference/notes-code-core.md#rejeu-et-horloge
  reset(): void {
    this.elapsed = 0;
    this.hitstopRemaining = 0;
    this.hitstopScale = 1;
  }

  // Le hitstop réduit le delta gameplay, jamais le pas de physique.
  triggerHitstop(duration: number, scale = 0.05) {
    this.hitstopRemaining = duration;
    this.hitstopScale = scale;
  }

  tick(fixedDt: number): number {
    this.elapsed += fixedDt;

    if (this.hitstopRemaining <= 0) return fixedDt;

    this.hitstopRemaining -= fixedDt;
    return fixedDt * this.hitstopScale;
  }
}
