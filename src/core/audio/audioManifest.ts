import { Schema } from "effect";

const Offset = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));
const Duration = Schema.Finite.check(Schema.isGreaterThan(0));
const TimeRange = Schema.mutable(Schema.Tuple([Offset, Duration]));
const FileNames = Schema.mutable(Schema.Array(Schema.NonEmptyString));

export const AudioSpriteManifest = Schema.Struct({
  src: FileNames.check(Schema.isMinLength(1)),
  sprite: Schema.Record(Schema.NonEmptyString, TimeRange),
  pool: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThan(0))),
});

const AxisRange = Schema.mutable(Schema.Tuple([Schema.Finite, Schema.Finite])).check(
  Schema.makeFilter(([min, max]) => min <= max || "Les bornes de zone sont inversées."),
);
const AmbienceBox = Schema.Struct({ x: AxisRange, y: AxisRange, z: AxisRange });
const AmbienceZone = Schema.Struct({
  nappe: Schema.NonEmptyString,
  boucle: TimeRange,
  evenements: FileNames,
  espaces: Schema.mutable(Schema.Array(AmbienceBox)),
});

export const ZoneAmbienceManifest = Schema.Struct({
  defaut: Schema.NonEmptyString,
  zones: Schema.Record(Schema.NonEmptyString, AmbienceZone),
}).check(
  Schema.makeFilter(
    (manifest) => manifest.zones[manifest.defaut] !== undefined || "La zone par défaut est absente du manifeste.",
  ),
);

export type AudioSpriteManifestData = typeof AudioSpriteManifest.Type;
export type ZoneAmbienceManifestData = typeof ZoneAmbienceManifest.Type;
export type AmbienceBoxData = typeof AmbienceBox.Type;
export type AmbienceZoneData = typeof AmbienceZone.Type;

export const decodeAudioSpriteManifest = Schema.decodeUnknownSync(AudioSpriteManifest, {
  onExcessProperty: "preserve",
});
export const decodeZoneAmbienceManifest = Schema.decodeUnknownSync(ZoneAmbienceManifest, {
  onExcessProperty: "preserve",
});
