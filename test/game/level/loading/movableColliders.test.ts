/**
 * Colliders qui bougent ou se cassent (`level/loading/movableColliders.ts`) :
 * aucune marque durable ne s'y pose.
 */
import { describe, expect, it } from "vitest";

import type { LevelSession } from "../../../../src/game/level/loading/hotReload";
import { isMovableOrBreakableHandle } from "../../../../src/game/level/loading/movableColliders";

function niveau(parts: {
  doors?: number[];
  vitres?: (number | null)[];
  sanitaires?: number[];
  props?: number[];
}): LevelSession {
  const avec = (handles: number[] = []) => handles.map((handle) => ({ collider: { handle } }));
  return {
    current: {
      doors: avec(parts.doors),
      vitres: (parts.vitres ?? []).map((handle) => ({ collider: handle === null ? null : { handle } })),
      sanitaires: avec(parts.sanitaires),
      props: avec(parts.props),
    },
  } as unknown as LevelSession;
}

describe("isMovableOrBreakableHandle", () => {
  it("reconnaît portes, vitres, sanitaires et props du niveau affiché, et rien d'autre", () => {
    const session = niveau({ doors: [1], vitres: [2, null], sanitaires: [3], props: [4] });
    for (const handle of [1, 2, 3, 4]) expect(isMovableOrBreakableHandle(session, handle)).toBe(true);
    expect(isMovableOrBreakableHandle(session, 5)).toBe(false);
  });

  it("sans niveau chargé, tout est statique", () => {
    expect(isMovableOrBreakableHandle(null, 1)).toBe(false);
  });

  it("suit un rechargement : la liste se refait quand le niveau affiché change", () => {
    const session = niveau({ doors: [1] });
    expect(isMovableOrBreakableHandle(session, 1)).toBe(true);
    (session as { current: unknown }).current = niveau({ doors: [9] }).current;
    expect(isMovableOrBreakableHandle(session, 1)).toBe(false);
    expect(isMovableOrBreakableHandle(session, 9)).toBe(true);
  });
});
