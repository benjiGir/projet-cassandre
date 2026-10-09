import { DoubleSide } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { abs, attribute, color, cos, float, fract, length, mix, positionLocal, sin, smoothstep, step, uniform, vec2, vec3 } from "three/tsl";

export function createFountainClock() {
  return uniform(0);
}

type FountainClock = ReturnType<typeof createFountainClock>;
const TAU = Math.PI * 2;

export function createFountainPoolMaterial(clock: FountainClock): MeshBasicNodeMaterial {
  const p = positionLocal.xz;
  const upper = step(1, positionLocal.y);
  const radial = length(p);
  const centralWave = sin(radial.mul(28).sub(clock.mul(TAU * 0.5)));
  let impact = float(0).add(0);
  for (let i = 0; i < 8; i++) {
    const angle = i * TAU / 8;
    const distance = length(p.sub(vec2(Math.cos(angle) * 1.5, Math.sin(angle) * 1.5)));
    const envelope = float(1).sub(smoothstep(0.04, 0.53, distance));
    impact = impact.add(step(0.72, sin(distance.mul(38).sub(clock.mul(TAU)))).mul(envelope));
  }
  const ripples = mix(impact.clamp(0, 1), step(0.86, centralWave).mul(0.6), upper);
  const glimmer = sin(p.x.mul(19).add(p.y.mul(13)).add(clock.mul(TAU * 0.25)))
    .mul(sin(p.x.mul(11).sub(p.y.mul(17)).sub(clock.mul(TAU * 0.5))));
  const sparkle = step(0.83, glimmer).mul(0.3);
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true });
  material.colorNode = mix(mix(color(0x184753), color(0x397c87), glimmer.mul(0.2).add(0.4)), color(0xc8eeea), ripples.add(sparkle).clamp(0, 1));
  material.opacityNode = float(0.84).add(ripples.mul(0.12));
  material.positionNode = positionLocal.add(vec3(0, centralWave.mul(mix(0.008, 0.003, upper)), 0));
  return material;
}

export function createFountainStreamMaterial(clock: FountainClock): MeshBasicNodeMaterial {
  const flow = attribute<"float">("fountainFlow", "float");
  const vein = step(0.68, fract(flow.mul(15).sub(clock.mul(6))));
  const glint = step(0.90, fract(flow.mul(31).sub(clock.mul(10))));
  const crown = smoothstep(3.2, 4.0, positionLocal.y);
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true });
  material.colorNode = mix(mix(color(0x599fab), color(0xc0e7e6), vein), color(0xf0faf0), glint.add(crown.mul(0.3)).clamp(0, 1));
  material.opacityNode = float(0.44).add(vein.mul(0.3)).add(glint.mul(0.2));
  const sway = sin(positionLocal.y.mul(5).sub(clock.mul(TAU * 0.5))).mul(0.008);
  const free = smoothstep(1.98, 3.8, positionLocal.y);
  material.positionNode = positionLocal.add(vec3(sway.mul(free), 0, sway.mul(free).mul(0.7)));
  return material;
}

export function createFountainDropMaterial(clock: FountainClock): MeshBasicNodeMaterial {
  const flight = attribute<"vec3">("fountainFlight", "vec3");
  const t = fract(clock.mul(1.25).add(flight.x));
  const cascade = flight.z;
  const radius = mix(t.mul(0.48).add(0.05), t.mul(0.84).add(0.66), cascade);
  const y = mix(float(1.98).add(t.mul(8.2)).sub(t.mul(t).mul(8.33)),
    float(1.866).add(t.mul(0.45)).sub(t.mul(t).mul(1.826)), cascade);
  const material = new MeshBasicNodeMaterial();
  material.colorNode = mix(color(0xb8dedd), color(0xe3f3e8), step(0.5, abs(sin(flight.y))));
  material.positionNode = positionLocal.mul(sin(t.mul(Math.PI)).mul(0.6).add(0.4))
    .add(vec3(cos(flight.y).mul(radius), y, sin(flight.y).mul(radius)));
  return material;
}
