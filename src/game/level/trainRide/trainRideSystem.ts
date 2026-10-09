import { trainRideConfig } from "./trainRideConfig";
import type { TrainRideCommand, TrainRideConfig, TrainRideEvent, TrainRideState } from "./trainRideTypes";

// see: docs/4-technique/prototype-voyage-rame.md#horloge-et-mouvement
export class TrainRideSystem {
  readonly state: TrainRideState = { phase: "boarding", elapsed: 0, distance: 0, speed: 0, remaining: 0 };
  previousDistance = 0;
  private readonly commands: TrainRideCommand[] = [];
  private readonly events: TrainRideEvent[] = [];
  private rules: TrainRideConfig = { ...trainRideConfig };
  private waveSent = false;

  constructor(private readonly overrides: Partial<TrainRideConfig> = {}) {}

  enqueue(command: TrainRideCommand): void {
    this.commands.push(command);
  }

  private reset(): void {
    Object.assign(this.state, { phase: "boarding", elapsed: 0, distance: 0, speed: 0, remaining: 0 });
    this.previousDistance = 0;
    this.waveSent = false;
    this.events.push("reset");
  }

  update(dt: number, doorsClosed: boolean, aboard: boolean): void {
    this.previousDistance = this.state.distance;
    let departing = false;
    for (const command of this.commands.splice(0)) {
      if (command === "reset") this.reset();
      else if (this.state.phase === "boarding" && aboard) {
        this.rules = { ...trainRideConfig, ...this.overrides };
        this.rules.duration = Math.max(10, this.rules.duration);
        this.rules.acceleration = Math.max(0.1, Math.min(this.rules.acceleration, this.rules.duration / 3));
        this.rules.braking = Math.max(0.1, Math.min(this.rules.braking, this.rules.duration / 3));
        this.state.phase = "closing";
        this.events.push("depart");
        departing = true;
      }
    }
    if (departing) return;
    if (this.state.phase === "boarding" || this.state.phase === "arrived") return;
    if (this.state.phase === "closing") {
      if (!aboard) {
        this.reset();
        return;
      }
      if (!doorsClosed) return;
      this.state.phase = "accelerating";
      this.state.elapsed = 0;
    }
    const t = Math.min(this.rules.duration, this.state.elapsed + dt);
    this.state.elapsed = t;
    this.state.remaining = this.rules.duration - t;
    const { speed, acceleration: a, braking: b, duration } = this.rules;
    const cruiseEnd = duration - b;
    if (t < a) {
      const u = t / a;
      this.state.speed = speed * (3 * u * u - 2 * u * u * u);
      this.state.distance = speed * a * (u ** 3 - 0.5 * u ** 4);
      this.state.phase = "accelerating";
    } else if (t < cruiseEnd) {
      this.state.speed = speed;
      this.state.distance = speed * (a / 2 + t - a);
      this.state.phase = "cruising";
    } else {
      const u = (t - cruiseEnd) / b;
      this.state.speed = speed * (1 - 3 * u * u + 2 * u * u * u);
      this.state.distance = speed * (a / 2 + cruiseEnd - a + b * (u - u ** 3 + 0.5 * u ** 4));
      this.state.phase = "braking";
    }
    if (!this.waveSent && t >= Math.min(this.rules.waveDelay, duration - b)) {
      this.waveSent = true;
      if (this.rules.combat) this.events.push("wave");
    }
    if (t >= duration) {
      this.state.phase = "arrived";
      this.state.speed = 0;
      this.events.push("arrived");
    }
  }

  takeEvents(): TrainRideEvent[] {
    return this.events.splice(0);
  }
}
