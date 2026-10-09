import * as THREE from "three";
import type { DoorSystem } from "../doors/doors";
import type { LevelResources } from "../loading/levelResources";
import type { LevelTrains } from "../trains/levelTrains";
import { TrainRideSystem } from "../trainRide/trainRideSystem";
import { TrainRidePresentation } from "../../../render/environment/trainRide/trainRidePresentation";
import { BLOCKOUT_ENTRY, BLOCKOUT_EXIT, BLOCKOUT_GATE } from "./blockoutConfig";
import type { MetroEncounterEvent } from "./metroEncounterEvents";

// see: docs/4-technique/blockout-metro.md#progression
export class MetroBlockout {
  readonly system = new TrainRideSystem({ combat: false });
  readonly presentation: TrainRidePresentation;
  private readonly center = new THREE.Vector3();
  private readonly gate = new THREE.Vector3();
  private readonly quarterTower: THREE.Object3D | undefined;
  private doors: DoorSystem | null = null;
  private readonly messages: string[] = [];
  private readonly encounters: MetroEncounterEvent[] = [];
  private rideWaves = 0;
  aiguillage = false;
  courant = false;
  shortcut = false;
  completed = false;

  constructor(
    root: THREE.Object3D,
    private readonly trains: LevelTrains | null,
    resources: LevelResources,
  ) {
    const marker = root.getObjectByName("n5_voyage_centre");
    const departure = root.getObjectByName("stage_voyage_depart"),
      arrival = root.getObjectByName("stage_voyage_arrivee");
    const gate = root.getObjectByName("n5_grille_centre");
    if (!marker || !departure || !arrival || !gate) throw new Error("Blockout N5 : marqueurs incomplets");
    marker.getWorldPosition(this.center);
    gate.getWorldPosition(this.gate);
    this.quarterTower = root.getObjectByName("stage_voyage_quartier_tour");
    const frame = new THREE.Group();
    frame.position.copy(this.center);
    root.add(frame);
    this.presentation = new TrainRidePresentation(frame, departure, arrival, {
      length: 61.5,
      title: "SERVICE / PRIVE",
      displayWidth: 1.2,
      displayHeight: 1.95,
      displayInset: 1.42,
    });
    arrival.visible = false;
    resources.onCleanup(() => this.presentation.dispose(frame));
  }

  bind(doors: DoorSystem, previous?: ReturnType<MetroBlockout["snapshot"]> | null): void {
    this.doors = doors;
    doors.lock(BLOCKOUT_EXIT);
    doors.lock(BLOCKOUT_GATE);
    if (!previous) return;
    this.aiguillage = previous.aiguillage;
    this.courant = previous.courant;
    this.shortcut = previous.raccourci;
    this.completed = previous.completed;
    this.rideWaves = previous.rideWaves;
    Object.assign(this.system.state, previous.voyage);
    this.system.previousDistance = previous.voyage.distance;
    if (this.aiguillage) this.trains?.system.enqueue({ type: "enable", lane: "VB", enabled: true });
    if (this.shortcut) {
      doors.unlock(BLOCKOUT_GATE, this.center);
      doors.open(BLOCKOUT_GATE, this.center);
    }
    if (previous.voyage.phase !== "boarding") doors.lock(BLOCKOUT_ENTRY);
    if (previous.voyage.phase === "arrived") {
      doors.unlock(BLOCKOUT_EXIT, this.center);
      doors.open(BLOCKOUT_EXIT, this.center);
    }
  }

  use(name: string, position: THREE.Vector3): void {
    switch (name) {
      case "use_n5_aiguillage":
        if (this.aiguillage) break;
        this.aiguillage = true;
        this.trains?.system.enqueue({ type: "enable", lane: "VB", enabled: true });
        this.messages.push("Aiguillage rétabli — trafic actif dans le tunnel B");
        break;
      case "use_n5_courant":
        if (this.courant) break;
        this.courant = true;
        this.messages.push("Courant rétabli — retour au dépôt");
        break;
      case "use_n5_raccourci":
        this.shortcut = true;
        this.doors?.unlock(BLOCKOUT_GATE, position);
        this.doors?.open(BLOCKOUT_GATE, position);
        this.messages.push("Raccourci du tunnel ouvert");
        break;
      case "use_n5_depart":
        if (!this.aiguillage || !this.courant)
          this.messages.push("Départ impossible : rétablissez l’aiguillage et le courant");
        else if (this.aboard(position)) this.system.enqueue("depart");
        break;
      case "use_n5_fin":
        if (this.system.state.phase === "arrived") this.completed = true;
        break;
    }
  }

  private aboard(p: THREE.Vector3): boolean {
    return (
      Math.abs(p.x - this.center.x) < 1.55 &&
      Math.abs(p.z - this.center.z) < 30.6 &&
      p.y > this.center.y - 0.2 &&
      p.y < this.center.y + 2.8
    );
  }

  fixed(dt: number, position: THREE.Vector3): void {
    const doors = this.doors;
    if (!doors) return;
    if (this.quarterTower) this.quarterTower.visible = position.z > -366;
    if (!this.shortcut && this.trains) {
      const status = this.trains.system.status("A", this.gate);
      if (status.announced) {
        doors.unlock(BLOCKOUT_GATE, position);
        doors.open(BLOCKOUT_GATE, position, { silent: true });
      } else doors.lock(BLOCKOUT_GATE);
    }
    this.system.update(
      dt,
      doors.stateOf(BLOCKOUT_ENTRY) === "closed" && doors.stateOf(BLOCKOUT_EXIT) === "closed",
      this.aboard(position),
    );
    for (const event of this.system.takeEvents()) {
      if (event === "depart") {
        doors.lock(BLOCKOUT_ENTRY);
        doors.lock(BLOCKOUT_EXIT);
        this.messages.push("Départ — destination privée");
      } else if (event === "arrived") {
        doors.unlock(BLOCKOUT_EXIT, position);
        doors.open(BLOCKOUT_EXIT, position);
        this.messages.push("Arrivée — sortie sur le quai privé");
        this.encounters.push("metro_arrivee");
      } else if (event === "reset") {
        doors.unlock(BLOCKOUT_ENTRY, position);
        doors.open(BLOCKOUT_ENTRY, position);
      }
    }
    if (this.aboard(position)) {
      for (const [index, time] of [10, 30].entries()) {
        const mask = 1 << index;
        if ((this.rideWaves & mask) !== 0 || this.system.state.elapsed < time) continue;
        this.rideWaves |= mask;
        const end = position.z > this.center.z ? "nord" : "sud";
        this.encounters.push(index === 0 ? `metro_rame_1_${end}` : `metro_rame_2_${end}`);
      }
    }
  }

  takeEncounterEvents(): MetroEncounterEvent[] {
    return this.encounters.splice(0);
  }

  takeMessages(): string[] {
    return this.messages.splice(0);
  }

  snapshot() {
    return {
      aiguillage: this.aiguillage,
      courant: this.courant,
      raccourci: this.shortcut,
      completed: this.completed,
      rideWaves: this.rideWaves,
      voyage: { ...this.system.state },
    };
  }
}
