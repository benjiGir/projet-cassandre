import * as THREE from "three";
import type { TrainRideSystem } from "../../../game/level/trainRide/trainRideSystem";
import type { TrainRidePhase } from "../../../game/level/trainRide/trainRideTypes";

const LABELS: Record<TrainRidePhase, string> = {
  boarding: "E : LANCER LA RAME", closing: "FERMETURE DES PORTES", accelerating: "DÉPART",
  cruising: "EN LIGNE", braking: "ARRIVÉE", arrived: "QUAI ATTEINT — SORTIE DROITE",
};
const SECTION_LENGTH = 6;
const SECTION_COUNT = 16;
const TOTAL_LENGTH = SECTION_LENGTH * SECTION_COUNT;

// Décor sans collision ; la rame et toutes ses surfaces praticables restent fixes.
// see: docs/4-technique/prototype-voyage-rame.md#rendu-et-raccords
export class TrainRidePresentation {
  private readonly tunnel = new THREE.Group();
  private readonly blackout = new THREE.Group();
  private readonly sections: THREE.Group[] = [];
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly materials = new Map<number, THREE.Material>();
  private readonly canvas = document.createElement("canvas");
  private readonly texture: THREE.CanvasTexture;
  private readonly display: THREE.Mesh;
  private displayAt = -Infinity;

  constructor(root: THREE.Group, private readonly departure: THREE.Group, private readonly arrival: THREE.Group) {
    for (let i = 0; i < SECTION_COUNT; i++) {
      const section = new THREE.Group();
      for (const side of [-1, 1]) {
        this.box(section, 0x1c292e, [1, 5.4, 6], [side * 4.5, 1.9, 0]);
        this.box(section, 0x364249, [.25, 5.4, .30], [side * 3.95, 1.9, -2.85]);
        this.box(section, 0x6d7260, [.10, .10, 6], [side * 3.9, 1.1, 0]);
        this.box(section, 0x53616a, [.10, .10, 6], [side * 3.9, 2.8, 0]);
        this.box(section, i % 3 ? 0xd6d8ba : 0xcca86d, [.12, .55, 1.25], [side * 3.85, 2.05, .6], true);
        if (i % 4 === 0) this.box(section, 0xd5553e, [.13, .28, .26], [side * 3.83, 1.4, -1.5], true);
      }
      this.box(section, 0x111b22, [9, .5, 6], [0, 4.75, 0]);
      this.box(section, 0x252b2c, [9, .5, 6], [0, -1.3, 0]);
      this.tunnel.add(section); this.sections.push(section);
    }
    root.add(this.tunnel, this.blackout);
    for (const side of [-1, 1]) this.box(this.blackout, 0x070b10, [.02, 2, 46], [side * 1.68, 1.75, 0], true);
    this.canvas.width = 512; this.canvas.height = 160;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.display = new THREE.Mesh(new THREE.PlaneGeometry(2.8, .875), new THREE.MeshBasicMaterial({ map: this.texture }));
    this.display.position.set(0, 2.35, -22.25); root.add(this.display);
  }

  private box(root: THREE.Group, color: number, size: number[], at: number[], emissive = false): void {
    let material = this.materials.get(color);
    if (!material) {
      material = emissive ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color });
      this.materials.set(color, material);
    }
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.scale.set(size[0]!, size[1]!, size[2]!); mesh.position.set(at[0]!, at[1]!, at[2]!); root.add(mesh);
  }

  interpolate(system: TrainRideSystem, alpha: number, elapsed: number): void {
    const state = system.state;
    const distance = THREE.MathUtils.lerp(system.previousDistance, state.distance, alpha);
    for (let i = 0; i < this.sections.length; i++) {
      const z = THREE.MathUtils.euclideanModulo(i * SECTION_LENGTH + distance + TOTAL_LENGTH / 2, TOTAL_LENGTH) - TOTAL_LENGTH / 2;
      this.sections[i]!.position.z = z;
    }
    this.departure.visible = state.phase === "boarding" || state.phase === "closing";
    this.arrival.visible = state.phase === "arrived";
    this.tunnel.visible = state.phase !== "boarding" && state.phase !== "closing" && state.phase !== "arrived";
    this.blackout.visible = state.phase === "closing" || (state.phase === "accelerating" && state.elapsed < .8)
      || (state.phase === "braking" && state.remaining < .8);
    if (elapsed < this.displayAt + .1) return;
    this.displayAt = elapsed;
    const ctx = this.canvas.getContext("2d")!;
    ctx.fillStyle = "#11202b"; ctx.fillRect(0, 0, 512, 160);
    ctx.font = "bold 23px monospace"; ctx.fillStyle = "#c9d8ce"; ctx.fillText("ESSAI T4 — VOYAGE À BORD", 15, 32);
    ctx.font = "bold 23px monospace"; ctx.fillStyle = state.phase === "arrived" ? "#a5df8d" : "#efd594";
    ctx.fillText(LABELS[state.phase], 15, 74);
    ctx.font = "22px monospace"; ctx.fillStyle = "#c9d8ce";
    ctx.fillText(`Vitesse : ${(state.speed * 3.6).toFixed(0)} km/h`, 15, 113);
    ctx.fillText(`Arrivée : ${Math.ceil(state.remaining)} s`, 15, 146);
    this.texture.needsUpdate = true;
  }

  dispose(root: THREE.Group): void {
    root.remove(this.tunnel, this.blackout, this.display);
    this.geometry.dispose(); for (const material of this.materials.values()) material.dispose();
    this.display.geometry.dispose(); (this.display.material as THREE.Material).dispose(); this.texture.dispose();
  }
}
