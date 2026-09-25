/** Fenêtre bornée de mesures de frame, sans allocation à chaque échantillon. */
export class RollingP95 {
  private readonly samples: Float32Array;
  private readonly sorted: Float32Array;
  private count = 0;
  private next = 0;

  constructor(size = 120) {
    if (!Number.isInteger(size) || size < 1) throw new RangeError("size must be a positive integer");
    this.samples = new Float32Array(size);
    this.sorted = new Float32Array(size);
  }

  record(value: number): void {
    this.samples[this.next] = value;
    this.next = (this.next + 1) % this.samples.length;
    this.count = Math.min(this.count + 1, this.samples.length);
  }

  value(): number {
    if (this.count === 0) return 0;
    this.sorted.set(this.samples.subarray(0, this.count));
    this.sorted.subarray(0, this.count).sort();
    return this.sorted[Math.ceil(this.count * 0.95) - 1]!;
  }
}
