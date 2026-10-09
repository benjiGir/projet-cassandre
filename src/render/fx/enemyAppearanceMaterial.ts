import { DoubleSide, Vector4, type Texture } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  If,
  abs,
  atan,
  clamp,
  color,
  dot,
  floor,
  fract,
  length,
  max,
  mix,
  oneMinus,
  sin,
  step,
  texture,
  uniform,
  uv,
  vec2,
  vec4,
} from "three/tsl";

const readProgress = () => uniform(0).onObjectUpdate(({ object }) => object?.userData.appearanceProgress ?? 0);

// see: docs/6-reference/notes-code-rendu.md#matérialisation-des-embuscades
export function createEnemyAppearanceMaterial(atlases: readonly Texture[]): MeshBasicNodeMaterial {
  const progress = readProgress();
  const seed = uniform(0).onObjectUpdate(({ object }) => object?.userData.appearanceSeed ?? 0);
  const rect = uniform(new Vector4(1, 1, 0, 0)).onObjectUpdate(({ object }) => {
    const map = object?.userData.appearanceMap as Texture;
    const value = object?.userData.appearanceUv as Vector4;
    return value.set(map.repeat.x, map.repeat.y, map.offset.x, map.offset.y);
  });
  const atlasIndex = uniform(0).onObjectUpdate(({ object }) => object?.userData.appearanceAtlasIndex ?? 0);
  const samples = atlases.map((atlas) => texture(atlas, uv().mul(rect.xy).add(rect.zw)));
  const sample = Fn(() => {
    const result = samples[0].toVar();
    for (let i = 1; i < samples.length; i++) {
      If(atlasIndex.equal(i), () => {
        result.assign(samples[i]);
      });
    }
    return result;
  })();
  const cells = floor(uv().mul(vec2(60, 48)));
  const grain = fract(sin(dot(cells, vec2(12.9898, 78.233)).add(seed)).mul(43758.5453));
  const front = progress.mul(1.18).sub(0.06);
  const height = uv().y.add(grain.mul(0.12));
  const assembled = step(height, front);
  const ghost = step(0.78, grain);
  const scan = oneMinus(step(0.038, abs(height.sub(front))));
  const stripes = step(0.45, fract(uv().y.mul(72).sub(progress.mul(9))));
  const ghostColor = mix(color(0x103d47), color(0x35cece), stripes);
  const tint = mix(ghostColor, sample.rgb, assembled);
  const rim = mix(color(0x43ebd3), color(0xe9fff0), step(0.55, grain));
  const glow = oneMinus(clamp(progress.sub(0.7).div(0.3), 0, 1));
  const ramp = mix(tint, rim, max(scan, ghost.mul(oneMinus(assembled)).mul(0.28)).mul(glow));

  const material = new MeshBasicNodeMaterial({ alphaTest: 0.5, depthWrite: true, toneMapped: false });
  material.fragmentNode = Fn(() => {
    sample.a.lessThan(0.5).discard();
    max(assembled, ghost).lessThan(0.5).discard();
    return vec4(ramp, 1);
  })();
  return material;
}

export function createEnemyAppearanceRingMaterial(): MeshBasicNodeMaterial {
  const progress = readProgress();
  const p = uv().mul(2).sub(1);
  const radius = length(p);
  const angle = atan(p.y, p.x);
  const outer = oneMinus(step(0.026, abs(radius.sub(0.7))));
  const inner = oneMinus(step(0.016, abs(radius.sub(0.48))));
  const segments = step(0.22, fract(angle.mul(3.1831).add(progress.mul(0.8))));
  const spokes = step(0.94, fract(angle.mul(1.9099).sub(progress.mul(0.4))))
    .mul(step(0.5, radius))
    .mul(step(radius, 0.84));
  const mask = max(max(outer.mul(segments), inner), spokes);
  const ramp = mix(color(0x168c9b), color(0x73ffe0), step(0.35, sin(progress.mul(Math.PI))));
  const material = new MeshBasicNodeMaterial({ side: DoubleSide, depthWrite: true, toneMapped: false });
  material.fragmentNode = Fn(() => {
    mask.lessThan(0.5).discard();
    return vec4(ramp, 1);
  })();
  return material;
}
