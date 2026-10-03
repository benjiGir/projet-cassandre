import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

import type { PhysicsWorld } from "../../physics/world";
type GpuResource = THREE.BufferGeometry | THREE.Material | THREE.Texture;

/** Possession enregistrée avant construction, y compris les ressources encore détachées. */
export class LevelResources {
  readonly bodies: RAPIER.RigidBody[] = [];
  private readonly gpu = new Set<GpuResource>();
  private readonly disposed = new WeakSet<GpuResource>();
  private readonly listeners = new Map<GpuResource, () => void>();
  private readonly batches = new Set<THREE.BatchedMesh>();

  constructor(readonly root: THREE.Object3D) {}

  geometry<T extends THREE.BufferGeometry>(geometry: T): T {
    this.track(geometry);
    return geometry;
  }

  material<T extends THREE.Material>(material: T): T {
    this.track(material);
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) this.track(value);
    }
    return material;
  }

  batch<T extends THREE.BatchedMesh>(batch: T): T {
    this.batches.add(batch);
    this.collectMesh(batch);
    return batch;
  }

  collect(): void {
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) this.collectMesh(object);
    });
  }

  dispose(physics: PhysicsWorld): void {
    this.root.removeFromParent();
    const errors: unknown[] = [];
    const release = (action: () => void): void => {
      try { action(); } catch (error) { errors.push(error); }
    };
    release(() => this.collect());
    for (const body of this.bodies) release(() => physics.world.removeRigidBody(body));
    this.bodies.length = 0;
    for (const batch of this.batches) release(() => batch.dispose());
    this.batches.clear();
    for (const resource of this.gpu) release(() => resource.dispose());
    for (const [resource, listener] of this.listeners) resource.removeEventListener("dispose", listener);
    this.listeners.clear();
    this.gpu.clear();
    if (errors.length > 0) throw new AggregateError(errors, "Libération incomplète des ressources du niveau");
  }

  private collectMesh(mesh: THREE.Mesh): void {
    if (mesh instanceof THREE.BatchedMesh) this.batches.add(mesh);
    this.geometry(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) this.material(material);
  }

  private track(resource: GpuResource): void {
    // Les ramassages empruntent les ressources de session à travers plusieurs hot reloads.
    if (resource.userData.pickupResourcesOwned === true || this.gpu.has(resource) || this.disposed.has(resource)) return;
    this.gpu.add(resource);
    const onDispose = (): void => {
      this.disposed.add(resource);
      this.gpu.delete(resource);
      this.listeners.delete(resource);
      resource.removeEventListener("dispose", onDispose);
    };
    this.listeners.set(resource, onDispose);
    resource.addEventListener("dispose", onDispose);
  }
}
