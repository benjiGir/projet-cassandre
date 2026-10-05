import { DoubleSide } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { Fn, abs, atan, attribute, clamp, color, cos, float, length, max, mix, oneMinus, pow, sin, step, uniform, uv, vec4 } from "three/tsl";

// see: docs/6-reference/notes-code-rendu.md#éclairs-de-tir-tsl
export function createMuzzleFlashMaterial(): MeshBasicNodeMaterial {
  const age = uniform(0).onObjectUpdate(({ object }) => (object?.userData.flashAge as number | undefined) ?? 0);
  const seed = uniform(0).onObjectUpdate(({ object }) => (object?.userData.flashSeed as number | undefined) ?? 0);
  const spread = uniform(0).onObjectUpdate(({ object }) => (object?.userData.flashSpread as number | undefined) ?? 0);
  const side = step(0.5, attribute("flashPlane", "float"));
  const p = uv().mul(2).sub(1);
  const radius = length(p);
  const angle = atan(p.y, p.x);

  const rays = pow(abs(cos(angle.mul(3).add(seed))), 7);
  const uneven = sin(angle.mul(7).add(seed.mul(2))).mul(0.055);
  const edge = rays.mul(0.43).add(0.34).add(uneven).add(spread.mul(0.08));
  const capMask = step(radius.mul(age.mul(0.3).add(1)), edge);
  const capHeat = clamp(oneMinus(radius.div(edge)).mul(0.85).add(0.18).sub(age.mul(0.2)), 0, 1);

  const along = uv().y;
  const flutter = sin(along.mul(23).add(seed)).mul(0.07)
    .add(sin(along.mul(43).sub(seed.mul(1.3))).mul(0.025));
  const envelope = pow(oneMinus(along), 0.7).mul(0.44).add(0.035)
    .add(spread.mul(0.1)).add(flutter).mul(oneMinus(age.mul(0.45)));
  const jetWidth = max(envelope, 0.025);
  const jetMask = step(abs(p.x), jetWidth).mul(step(along, oneMinus(age.mul(0.25))));
  const jetHeat = clamp(float(1.12).sub(along.mul(0.48)).sub(abs(p.x).div(jetWidth).mul(0.65))
    .sub(age.mul(0.32)), 0, 1);

  const heat = mix(capHeat, jetHeat, side);
  let ramp = mix(color(0xeb5421), color(0xffa52e), step(0.22, heat));
  ramp = mix(ramp, color(0xffdf79), step(0.46, heat));
  ramp = mix(ramp, color(0xfff6d7), step(0.76, heat));

  const material = new MeshBasicNodeMaterial({ side: DoubleSide, alphaTest: 0.5, depthWrite: true, fog: false, toneMapped: false });
  material.fragmentNode = Fn(() => {
    mix(capMask, jetMask, side).lessThan(0.5).discard();
    return vec4(ramp, 1);
  })();
  return material;
}
