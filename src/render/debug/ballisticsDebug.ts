import * as THREE from "three";

// see: docs/6-reference/notes-code-rendu.md#overlays-et-diagnostic

const TRACE_LIFETIME = 0.35; // s

const SHOTGUN_TRACE_COLOR = 0xffcc33;
const MELEE_TRACE_COLOR = 0x33ccff;

// CapsuleGeometry construit son cylindre sur +Y, comme Rapier.
const UNIT_Y = new THREE.Vector3(0, 1, 0);

interface ActiveTrace {
  object: THREE.Object3D;
  remaining: number;
  dispose: () => void;
}

export class BallisticsDebugOverlay {
  private readonly scene: THREE.Scene;
  private enabled = import.meta.env.DEV;
  private readonly traces: ActiveTrace[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  // Désactiver retire immédiatement les traces existantes.
  toggle(): boolean {
    this.enabled = !this.enabled;
    if (!this.enabled) this.clearAll();
    return this.enabled;
  }

  private clearAll() {
    for (const trace of this.traces) {
      this.scene.remove(trace.object);
      trace.dispose();
    }
    this.traces.length = 0;
  }

  // Extrémités réelles des plombs ; un seul objet pour tout le tir.
  recordShotgunFire(origin: THREE.Vector3, endpoints: ReadonlyArray<THREE.Vector3>) {
    if (!this.enabled || endpoints.length === 0) return;

    const positions = new Float32Array(endpoints.length * 6);
    for (let i = 0; i < endpoints.length; i++) {
      const end = endpoints[i];
      positions[i * 6 + 0] = origin.x;
      positions[i * 6 + 1] = origin.y;
      positions[i * 6 + 2] = origin.z;
      positions[i * 6 + 3] = end.x;
      positions[i * 6 + 4] = end.y;
      positions[i * 6 + 5] = end.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: SHOTGUN_TRACE_COLOR,
      transparent: true,
      opacity: 0.9,
    });
    const lines = new THREE.LineSegments(geometry, material);
    this.scene.add(lines);

    this.traces.push({
      object: lines,
      remaining: TRACE_LIFETIME,
      dispose: () => {
        geometry.dispose();
        material.dispose();
      },
    });
  }

  // Même longueur et rayon que la capsule de mêlée réellement testée.
  recordMeleeFire(origin: THREE.Vector3, direction: THREE.Vector3, range: number, radius: number) {
    if (!this.enabled || range <= 0 || radius <= 0) return;

    const geometry = new THREE.CapsuleGeometry(radius, range, 4, 8);
    const material = new THREE.MeshBasicMaterial({
      color: MELEE_TRACE_COLOR,
      wireframe: true,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.copy(origin).addScaledVector(direction, range / 2);
    mesh.quaternion.setFromUnitVectors(UNIT_Y, direction);
    this.scene.add(mesh);

    this.traces.push({
      object: mesh,
      remaining: TRACE_LIFETIME,
      dispose: () => {
        geometry.dispose();
        material.dispose();
      },
    });
  }

  // Delta réel d’affichage ; la requête représentée reste figée au tir.
  update(realDt: number) {
    for (let i = this.traces.length - 1; i >= 0; i--) {
      const trace = this.traces[i];
      trace.remaining -= realDt;
      if (trace.remaining <= 0) {
        this.scene.remove(trace.object);
        trace.dispose();
        this.traces.splice(i, 1);
      }
    }
  }
}
