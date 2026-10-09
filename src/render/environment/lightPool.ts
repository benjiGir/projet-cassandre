import * as THREE from "three";

// see: docs/6-reference/notes-code-rendu.md#eclairage-et-elagage

export const LIGHT_POOL_BUDGET = 48;

const REEVALUATION_DISTANCE = 2.0;

export interface LightPoolStats {
  readonly total: number;

  readonly actives: number;

  readonly budget: number | null;
}

interface Entry {
  readonly light: THREE.PointLight;
  score: number;
}

function score(light: THREE.PointLight, cameraPosition: THREE.Vector3): number {
  if (light.distance <= 0) return -Infinity;
  return light.position.distanceTo(cameraPosition) - light.distance;
}

function byScore(a: Entry, b: Entry): number {
  return a.score - b.score;
}

export class LightPool {
  // Le tri réutilise le tableau pour éviter les allocations.
  private readonly entries: Entry[];
  private budget: number | null;
  private readonly lastEvaluatedAt = new THREE.Vector3();
  private evaluated = false;
  private actives: number;

  constructor(lights: readonly THREE.PointLight[], budget: number | null = LIGHT_POOL_BUDGET) {
    this.entries = lights.map((light) => ({ light, score: 0 }));
    this.budget = budget;
    this.actives = this.entries.length;
  }

  get stats(): LightPoolStats {
    return { total: this.entries.length, actives: this.actives, budget: this.budget };
  }

  // Force une réévaluation même si la caméra reste immobile.
  setBudget(budget: number | null): void {
    this.budget = budget;
    this.evaluated = false;
  }

  // Position caméra de la frame affichée, jamais celle du pas fixe.
  update(cameraPosition: THREE.Vector3): void {
    if (this.budget !== null && this.entries.length <= this.budget) {
      // Le pool ne sert à rien sur ce niveau : tout allumer une fois, puis ne
      // plus jamais rien faire.
      if (!this.evaluated) this.lightAll();
      return;
    }
    if (this.evaluated && this.lastEvaluatedAt.distanceTo(cameraPosition) < REEVALUATION_DISTANCE) return;

    this.evaluated = true;
    this.lastEvaluatedAt.copy(cameraPosition);

    if (this.budget === null) {
      this.lightAll();
      return;
    }

    for (const entry of this.entries) entry.score = score(entry.light, cameraPosition);
    this.entries.sort(byScore);
    for (let i = 0; i < this.entries.length; i++) this.entries[i].light.visible = i < this.budget;
    this.actives = Math.min(this.budget, this.entries.length);
  }

  private lightAll(): void {
    for (const entry of this.entries) entry.light.visible = true;
    this.actives = this.entries.length;
    this.evaluated = true;
  }
}
