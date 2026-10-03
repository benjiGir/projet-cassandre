import { Schema } from "effect";

import type { Recording } from "./inputTypes";

const Vector = Schema.Struct({ x: Schema.Finite, y: Schema.Finite, z: Schema.Finite });
const InputFrameSchema = Schema.Struct({
  forward: Schema.Boolean,
  back: Schema.Boolean,
  left: Schema.Boolean,
  right: Schema.Boolean,
  jump: Schema.Boolean,
  sprint: Schema.Boolean,
  fire: Schema.Boolean,
  switchToMelee: Schema.Boolean,
  switchToPistol: Schema.Boolean,
  switchToShotgun: Schema.Boolean,
  use: Schema.Boolean,
  yaw: Schema.Finite,
  pitch: Schema.Finite,
  dx: Schema.Finite,
  dy: Schema.Finite,
});
const RecordingSchema = Schema.Struct({
  version: Schema.Literal(1),
  fixedDt: Schema.Finite.check(Schema.isGreaterThan(0)),
  start: Schema.Struct({
    position: Vector,
    velocity: Vector,
    yaw: Schema.Finite,
    pitch: Schema.Finite,
  }),
  frames: Schema.mutable(Schema.Array(InputFrameSchema)),
});

export const decodeRecording: (value: unknown) => Recording = Schema.decodeUnknownSync(RecordingSchema, {
  onExcessProperty: "preserve",
});
