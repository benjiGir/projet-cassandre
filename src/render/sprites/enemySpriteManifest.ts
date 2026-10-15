import { Schema } from "effect";

import { BILLBOARD_COLUMNS } from "./billboard";

const positiveNumber = Schema.Finite.check(Schema.isGreaterThan(0));
const positiveInteger = Schema.Int.check(Schema.isGreaterThan(0));
const nonNegativeInteger = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const nonNegativeNumber = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));

const spriteFrame = Schema.Struct({
  x: nonNegativeInteger,
  y: nonNegativeInteger,
  width: positiveInteger,
  height: positiveInteger,
  anchorX: nonNegativeNumber,
  feetFromBottom: nonNegativeInteger,
});

const spriteLayout = Schema.Struct({
  width: positiveInteger,
  height: positiveInteger,
  pixelsPerMeter: positiveNumber,
  frames: Schema.Array(Schema.Array(spriteFrame)),
});

const spriteAnimation = Schema.Struct({
  row: nonNegativeInteger,
  frames: positiveInteger,
  sequence: Schema.optionalKey(Schema.Array(nonNegativeInteger)),
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
  layouts: Schema.optionalKey(Schema.Record(Schema.String, spriteLayout)),
}).check(
  Schema.makeFilter((manifest) => {
    const issues: Schema.FilterIssue[] = [];
    if (manifest.feetFromBottom >= manifest.cellHeight) {
      issues.push({ path: ["feetFromBottom"], issue: "Les pieds doivent rester dans la case." });
    }
    for (const [name, animation] of Object.entries(manifest.animations)) {
      if (
        animation.row >= manifest.rows ||
        (animation.sequence
          ? animation.sequence.length !== animation.frames || animation.sequence.some((row) => row >= manifest.rows)
          : animation.row + animation.frames > manifest.rows)
      ) {
        issues.push({ path: ["animations", name], issue: "L'animation dépasse les lignes de l'atlas." });
      }
    }
    for (const [skin, layout] of Object.entries(manifest.layouts ?? {})) {
      const path = ["layouts", skin];
      if (!manifest.atlases[skin] || layout.frames.length !== manifest.rows) {
        issues.push({ path, issue: "La disposition doit décrire un atlas existant et toutes ses lignes." });
      }
      for (const row of layout.frames) {
        if (row.length !== BILLBOARD_COLUMNS) {
          issues.push({ path, issue: "Chaque ligne doit décrire huit directions." });
        }
        for (const frame of row) {
          if (
            frame.x + frame.width > layout.width ||
            frame.y + frame.height > layout.height ||
            frame.anchorX > frame.width ||
            frame.feetFromBottom >= frame.height
          ) {
            issues.push({ path, issue: "La case ou son ancrage dépasse l'image." });
          }
        }
      }
    }
    if (manifest.layouts && Object.keys(manifest.atlases).some((skin) => !manifest.layouts?.[skin])) {
      issues.push({ path: ["layouts"], issue: "Chaque peau doit avoir sa disposition." });
    }
    return issues;
  }),
);

// Validation à la frontière de chargement ; aucune exécution dans la frame.
export const decodeSpriteManifest = Schema.decodeUnknownSync(spriteManifest);
