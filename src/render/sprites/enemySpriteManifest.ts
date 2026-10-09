import { Schema } from "effect";

import { BILLBOARD_COLUMNS } from "./billboard";

const positiveNumber = Schema.Finite.check(Schema.isGreaterThan(0));
const positiveInteger = Schema.Int.check(Schema.isGreaterThan(0));
const nonNegativeInteger = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

const spriteAnimation = Schema.Struct({
  row: nonNegativeInteger,
  frames: positiveInteger,
  fps: Schema.optionalKey(positiveNumber),
  metersPerCycle: Schema.optionalKey(positiveNumber),
  duration: Schema.optionalKey(positiveNumber),
});

const animations = Schema.StructWithRest(
  Schema.Struct({
    idle: spriteAnimation,
    alert: spriteAnimation,
    chase: spriteAnimation,
    aim: spriteAnimation,
    fire: spriteAnimation,
    stagger: spriteAnimation,
    death: spriteAnimation,
  }),
  [Schema.Record(Schema.String, spriteAnimation)],
);

const spriteManifest = Schema.Struct({
  cellWidth: positiveInteger,
  cellHeight: positiveInteger,
  columns: Schema.Literal(BILLBOARD_COLUMNS),
  rows: positiveInteger,
  pixelsPerMeter: positiveNumber,
  feetFromBottom: nonNegativeInteger,
  atlases: Schema.StructWithRest(Schema.Struct({ humain: Schema.NonEmptyString }), [
    Schema.Record(Schema.String, Schema.NonEmptyString),
  ]),
  animations,
}).check(
  Schema.makeFilter((manifest) => {
    const issues: Schema.FilterIssue[] = [];
    if (manifest.feetFromBottom >= manifest.cellHeight) {
      issues.push({ path: ["feetFromBottom"], issue: "Les pieds doivent rester dans la case." });
    }
    for (const [name, animation] of Object.entries(manifest.animations)) {
      if (animation.row + animation.frames > manifest.rows) {
        issues.push({ path: ["animations", name], issue: "L'animation dépasse les lignes de l'atlas." });
      }
    }
    return issues;
  }),
);

// Validation à la frontière de chargement ; aucune exécution dans la frame.
export const decodeSpriteManifest = Schema.decodeUnknownSync(spriteManifest);
