// see: docs/6-reference/notes-code-core.md#mixage-de-leau

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface WaterAmbienceMix {
  gain: number;
  pan: number;
}

export const JET_FULL_GAIN_DISTANCE = 1.5;

export const JET_SILENCE_DISTANCE = 11;

export const SUMMED_GAIN_CAP = 1.6;

export const PAN_MAX = 0.55;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function jetGain(distance: number): number {
  if (distance <= JET_FULL_GAIN_DISTANCE) return 1;
  if (distance >= JET_SILENCE_DISTANCE) return 0;
  const t = (JET_SILENCE_DISTANCE - distance) / (JET_SILENCE_DISTANCE - JET_FULL_GAIN_DISTANCE);
  return t * t * (3 - 2 * t);
}

export function computeWaterAmbienceMix(
  listenerPosition: Vec3Like,
  listenerRight: Vec3Like,
  jets: readonly Vec3Like[],
  out: WaterAmbienceMix,
): WaterAmbienceMix {
  if (jets.length === 0) {
    out.gain = 0;
    out.pan = 0;
    return out;
  }

  let summedGain = 0;
  let dominantGain = 0;
  let dominantDirX = 0;
  let dominantDirY = 0;
  let dominantDirZ = 0;

  for (const jet of jets) {
    const dx = jet.x - listenerPosition.x;
    const dy = jet.y - listenerPosition.y;
    const dz = jet.z - listenerPosition.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const gain = jetGain(distance);
    summedGain += gain;
    if (gain > dominantGain) {
      dominantGain = gain;
      dominantDirX = dx;
      dominantDirY = dy;
      dominantDirZ = dz;
    }
  }

  out.gain = Math.min(SUMMED_GAIN_CAP, summedGain);
  if (dominantGain <= 0) {
    out.pan = 0;
    return out;
  }

  const dominantLength = Math.sqrt(
    dominantDirX * dominantDirX + dominantDirY * dominantDirY + dominantDirZ * dominantDirZ,
  );
  if (dominantLength < 1e-6) {
    out.pan = 0;
    return out;
  }

  const lateral =
    (dominantDirX * listenerRight.x + dominantDirY * listenerRight.y + dominantDirZ * listenerRight.z) / dominantLength;
  out.pan = clamp(lateral * PAN_MAX, -PAN_MAX, PAN_MAX);
  return out;
}

export function smoothTowards(current: number, target: number, dt: number, tau: number): number {
  if (tau <= 0) return target;
  const alpha = 1 - Math.exp(-dt / tau);
  return current + (target - current) * alpha;
}
