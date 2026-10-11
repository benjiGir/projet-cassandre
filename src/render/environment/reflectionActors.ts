import type * as THREE from "three";

const actorsByScene = new WeakMap<THREE.Scene, Set<THREE.Object3D>>();

export function registerReflectionActor(scene: THREE.Scene, actor: THREE.Object3D): () => void {
  const actors = actorsByScene.get(scene) ?? new Set<THREE.Object3D>();
  actorsByScene.set(scene, actors);
  actors.add(actor);
  actor.visible = false;
  return () => actors.delete(actor);
}

export function revealReflectionActors(scene: THREE.Scene): () => void {
  const previous = [...(actorsByScene.get(scene) ?? [])].map((actor) => [actor, actor.visible] as const);
  for (const [actor] of previous) actor.visible = true;
  return () => {
    for (const [actor, visible] of previous) actor.visible = visible;
  };
}
