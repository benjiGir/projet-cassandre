import { Schema } from "effect";

// see: docs/4-technique/systemes-de-niveau.md#espaces-du-niveau

const AxisRange = Schema.Tuple([Schema.Finite, Schema.Finite]).check(
  Schema.makeFilter(([min, max]) => min <= max || "Les bornes d'espace sont inversées."),
);
const LevelSpace = Schema.Struct({ id: Schema.NonEmptyString, x: AxisRange, y: AxisRange, z: AxisRange });

export const LevelSpacesManifest = Schema.Struct({ espaces: Schema.Array(LevelSpace) });

export type LevelSpaceData = typeof LevelSpace.Type;

export const decodeLevelSpacesManifest = Schema.decodeUnknownSync(LevelSpacesManifest, {
  onExcessProperty: "preserve",
});

function footprint(space: LevelSpaceData): number {
  return (space.x[1] - space.x[0]) * (space.z[1] - space.z[0]);
}

/** Du plus petit au plus grand : `levelSpaceAt` rend ainsi l'espace le plus précis. */
export function sortLevelSpaces(spaces: readonly LevelSpaceData[]): LevelSpaceData[] {
  return [...spaces].sort((a, b) => footprint(a) - footprint(b));
}

/** Identifiant de l'espace qui contient le point, `null` hors de tout espace. `spaces` vient de `sortLevelSpaces`. */
export function levelSpaceAt(
  spaces: readonly LevelSpaceData[],
  p: { readonly x: number; readonly y: number; readonly z: number },
): string | null {
  for (const space of spaces) {
    if (
      p.x >= space.x[0] && p.x <= space.x[1] &&
      p.y >= space.y[0] && p.y <= space.y[1] &&
      p.z >= space.z[0] && p.z <= space.z[1]
    ) {
      return space.id;
    }
  }
  return null;
}
