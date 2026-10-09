import * as THREE from "three";
import { trainConfig, TRAIN_CAR_COUNT, TRAIN_CAR_LENGTH } from "./trainConfig";
import { distanceAlongRoute, poseOnRoute, routeLength } from "./trainPath";
import { trainTouchesActor } from "./trainContact";
import type { TrainActor, TrainCommand, TrainConfig, TrainLaneDef, TrainLaneStatus, TrainPass } from "./trainTypes";

interface LaneState {
  def: TrainLaneDef;
  nextArrival: number;
  routeIndex: number;
  pending: TrainPass | null;
  delayAfterPending: number;
  stoppedUntil: number;
  reusableAt: number;
  enabled: boolean;
  singlePass: boolean;
}

export class TrainSystem {
  readonly passes: TrainPass[] = [];
  private readonly lanes: LaneState[];
  private readonly commands: TrainCommand[] = [];
  private readonly feedback: string[] = [];
  private time = 0;
  private warningSounds = 0;
  private warnedPasses = new WeakSet<TrainPass>();
  private readonly warningPosition = new THREE.Vector3();
  private readonly warningDirection = new THREE.Vector3();

  constructor(
    definitions: readonly TrainLaneDef[],
    readonly config: TrainConfig = trainConfig,
  ) {
    this.lanes = definitions.map((def) => ({
      def,
      nextArrival: def.firstArrival,
      routeIndex: 0,
      pending: null,
      delayAfterPending: 0,
      stoppedUntil: 0,
      reusableAt: 0,
      enabled: def.enabled ?? true,
      singlePass: false,
    }));
  }

  enqueue(command: TrainCommand): void {
    this.commands.push(command);
  }

  reset(): void {
    this.time = 0;
    this.passes.length = 0;
    this.warningSounds = 0;
    this.warnedPasses = new WeakSet<TrainPass>();
    this.feedback.length = 0;
    this.commands.length = 0;
    for (const lane of this.lanes)
      Object.assign(lane, {
        nextArrival: lane.def.firstArrival,
        routeIndex: 0,
        pending: null,
        delayAfterPending: 0,
        stoppedUntil: 0,
        reusableAt: 0,
        enabled: lane.def.enabled ?? true,
        singlePass: false,
      });
  }

  update(dt: number, listener: THREE.Vector3): void {
    for (const command of this.commands.splice(0)) {
      if (command.type === "reset") {
        this.reset();
        continue;
      }
      const lane = this.lanes.find((candidate) => candidate.def.id === command.lane);
      if (!lane) continue;
      if (command.type === "enable") {
        if (command.enabled && !lane.enabled)
          lane.nextArrival = Math.max(lane.nextArrival, this.time + this.config.warning);
        lane.enabled = command.enabled;
        lane.singlePass = false;
        continue;
      }
      if (command.type === "pass") {
        if (!lane.pending) lane.nextArrival = this.time + this.config.warning;
        lane.singlePass = lane.singlePass || !lane.enabled;
        lane.enabled = true;
        continue;
      }
      if (command.type === "switch") {
        const requested = command.route ? lane.def.routes.findIndex((route) => route.id === command.route) : -1;
        if (command.route && requested < 0) throw new Error(`Route de train inconnue : ${command.route}`);
        lane.routeIndex = command.route ? requested : (lane.routeIndex + 1) % lane.def.routes.length;
        this.feedback.push(`Aiguillage : ${lane.def.routes[lane.routeIndex].id}. La rame annoncée garde sa route.`);
      } else if (this.time >= lane.reusableAt) {
        const duration = Math.max(0, this.config.stopDuration);
        if (lane.pending) lane.delayAfterPending += duration;
        else lane.nextArrival += duration;
        lane.stoppedUntil = this.time + duration;
        lane.reusableAt = this.time + Math.max(duration, this.config.stopCooldown);
        this.feedback.push(`Trafic retenu ${duration} s. Toute rame déjà annoncée passe.`);
      } else {
        this.feedback.push(`Arrêt disponible dans ${Math.ceil(lane.reusableAt - this.time)} s`);
      }
    }
    this.time += dt;
    for (const lane of this.lanes) {
      if (lane.enabled && !lane.pending && this.time >= lane.nextArrival - this.config.warning) {
        const pass: TrainPass = {
          lane: lane.def.id,
          route: lane.def.routes[lane.routeIndex],
          arrival: lane.nextArrival,
          speed: Math.max(1, this.config.speed),
          front: 0,
          previousFront: 0,
          length: TRAIN_CAR_COUNT * TRAIN_CAR_LENGTH,
        };
        lane.pending = pass;
      }
      if (lane.pending && this.time >= lane.nextArrival) {
        this.passes.push(lane.pending);
        if (lane.singlePass) {
          lane.enabled = false;
          lane.singlePass = false;
        }
        lane.pending = null;
        lane.nextArrival += Math.max(10, this.config.interval) + lane.delayAfterPending;
        lane.delayAfterPending = 0;
      }
    }
    for (let i = this.passes.length - 1; i >= 0; i--) {
      const pass = this.passes[i];
      pass.previousFront = pass.front;
      pass.front = pass.speed * (this.time - pass.arrival);
      if (pass.front - pass.length > routeLength(pass.route)) this.passes.splice(i, 1);
    }
    for (const lane of this.lanes) {
      if (lane.pending) this.warnApproach(lane.pending, listener);
    }
    for (const pass of this.passes) this.warnApproach(pass, listener);
  }

  private warnApproach(pass: TrainPass, listener: THREE.Vector3): void {
    if (this.warnedPasses.has(pass)) return;
    const along = distanceAlongRoute(pass.route, listener);
    const countdown = pass.arrival - this.time + along / pass.speed;
    if (countdown <= 0 || countdown > this.config.warning) return;
    poseOnRoute(pass.route, along, this.warningPosition, this.warningDirection);
    if (this.warningPosition.distanceToSquared(listener) > 20 * 20) return;
    this.warnedPasses.add(pass);
    this.warningSounds++;
  }

  status(id: string, at: THREE.Vector3): TrainLaneStatus {
    const lane = this.lanes.find((candidate) => candidate.def.id === id)!;
    const route = lane.pending?.route ?? lane.def.routes[lane.routeIndex];
    let countdown =
      lane.enabled || lane.pending
        ? lane.nextArrival - this.time + distanceAlongRoute(route, at) / Math.max(1, this.config.speed)
        : Infinity;
    for (const pass of this.passes) {
      if (pass.lane !== id) continue;
      const along = distanceAlongRoute(pass.route, at);
      if (pass.front - pass.length <= along) countdown = Math.min(countdown, (along - pass.front) / pass.speed);
    }
    return {
      id,
      countdown,
      announced: countdown <= this.config.warning,
      route: lane.def.routes[lane.routeIndex].id,
      pendingRoute: lane.pending?.route.id ?? null,
      stopped: Math.max(0, lane.stoppedUntil - this.time),
      cooldown: Math.max(0, lane.reusableAt - this.time),
      enabled: lane.enabled,
    };
  }

  touches(actor: TrainActor): boolean {
    return this.passes.some((pass) => trainTouchesActor(pass, actor));
  }
  takeFeedback(): string[] {
    return this.feedback.splice(0);
  }
  takeWarningSounds(): number {
    const count = this.warningSounds;
    this.warningSounds = 0;
    return count;
  }
}
