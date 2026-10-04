import type { LevelSession } from "./hotReload";
import type { LevelHandle } from "./levelTypes";

// Ce qui, dans le niveau courant, bouge ou se casse : une marque durable
// (impact, tache) ne s'y pose jamais, elle resterait suspendue en l'air une
// fois l'objet ouvert ou cassé.

let cachedLevel: LevelHandle | null | undefined;
let cachedHandles: ReadonlySet<number> = new Set();

/** Le collider appartient à une porte, une vitre, un sanitaire ou un prop du niveau affiché. */
export function isMovableOrBreakableHandle(levelSession: LevelSession | null, colliderHandle: number): boolean {
  const handle = levelSession?.current ?? null;
  if (handle !== cachedLevel) {
    cachedLevel = handle;
    const set = new Set<number>();
    if (handle) {
      for (const door of handle.doors) set.add(door.collider.handle);
      for (const vitre of handle.vitres) if (vitre.collider) set.add(vitre.collider.handle);
      for (const sanitaire of handle.sanitaires) set.add(sanitaire.collider.handle);
      for (const prop of handle.props) set.add(prop.collider.handle);
    }
    cachedHandles = set;
  }
  return cachedHandles.has(colliderHandle);
}
