import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  clamp,
  color,
  faceDirection,
  float,
  mix,
  mx_fractal_noise_float,
  normalize,
  oneMinus,
  positionGeometry,
  pow,
  smoothstep,
  step,
  uniform,
  varying,
  vec3,
} from "three/tsl";

// Boule de feu d'une explosion, en TSL (ADR 0035). Une sphère dont chaque
// sommet est repoussé par un bruit fractal qui défile : des volutes qui
// roulent. La couleur suit une température — tout part blanc, les bosses
// refroidissent les premières en fumée noire pendant que les creux restent
// incandescents — puis un second bruit ronge la surface, qui se déchire en
// lambeaux au lieu de s'éteindre en fondu.
//
// Paliers de couleur et trous francs (`alphaTest`), jamais de transparence :
// le gros pixel reste net. Durées en temps d'AFFICHAGE : c'est un effet, pas
// du gameplay.

const POOL_SIZE = 4;
/** Lampes partagées par les explosions : au-delà, la plus ancienne est reprise. */
const LIGHT_COUNT = 2;
const DURATION = 1.25; // s — le feu tient ~0,5 s, la fumée finit de se déchirer ensuite
/** Rayon de la boule à pleine taille, bosses moyennes, en mètres — en deçà du rayon de dégâts : elle dit « où », pas « jusqu'où ». */
const MAX_RADIUS = 2.3;
/** Montée de la boule sur sa durée, en mètres : l'air chaud l'emporte. */
const RISE = 1.3;
const LIGHT_INTENSITY = 240;
const LIGHT_RANGE = 14;
/** La lampe s'éteint avec le feu, bien avant la fumée. */
const LIGHT_DURATION = 0.45; // s

/** Âge 0..1 et graine de CHAQUE boule, lus sur son mesh : un seul matériau, donc un seul programme, pour tout le pool. */
const uAge = uniform(0).onObjectUpdate(({ object }) => (object?.userData.explosionAge as number | undefined) ?? 0);
const uSeed = uniform(0).onObjectUpdate(({ object }) => (object?.userData.explosionSeed as number | undefined) ?? 0);

function createFireballMaterial(): MeshBasicNodeMaterial {
  const direction = normalize(positionGeometry);

  // Volutes : bruit de basse fréquence sur la sphère, qui défile vers le bas
  // dans le repère de la boule — à l'écran, les bosses roulent vers le haut.
  const flow = vec3(uSeed, uAge.mul(-1.5).add(uSeed.mul(1.7)), uSeed.mul(0.37));
  const billow = clamp(mx_fractal_noise_float(direction.mul(1.7).add(flow), 3, 2, 0.42).mul(0.7).add(0.5), 0, 1);

  // Gonfle très vite puis ralentit, comme un souffle : 1 − (1 − t)³.
  const growth = oneMinus(pow(oneMinus(uAge), 3));
  const radius = growth.mul(0.75).add(0.25).mul(billow.mul(0.8).add(0.6));

  const vDirection = varying(direction);
  const vBillow = varying(billow);

  // Grain fin, au fragment : il casse les aplats et sert à ronger la surface.
  const grain = clamp(
    mx_fractal_noise_float(vDirection.mul(4.6).add(flow.mul(1.6)).add(11.3), 2, 2, 0.55).mul(0.7).add(0.5),
    0,
    1,
  );

  // Température : elle tombe avec l'âge, les bosses (loin du cœur) refroidissent
  // d'abord, et l'intérieur vu par un trou reste plus chaud que la peau.
  const temperature = float(1.3).sub(uAge.mul(2.3));
  const inside = oneMinus(faceDirection).mul(0.12);
  const heat = clamp(temperature.add(float(0.5).sub(vBillow).mul(0.95)).add(grain.sub(0.5).mul(0.4)).add(inside), 0, 1);

  // Rampe en paliers : fumée, braise, rouge, orange, jaune, blanc.
  const smoke = mix(color(0x141211), color(0x3d3733), grain);
  let ramp = mix(smoke, color(0x4a1a12), step(0.07, heat));
  ramp = mix(ramp, color(0xb02931), step(0.2, heat));
  ramp = mix(ramp, color(0xf2891d), step(0.38, heat));
  ramp = mix(ramp, color(0xffd75a), step(0.6, heat));
  ramp = mix(ramp, color(0xfff6c8), step(0.82, heat));

  // Érosion : rien n'est rongé pendant la boule de feu, tout l'est à la fin.
  const erosion = smoothstep(0.45, 1, uAge);
  const hole = clamp(grain.mul(0.6).add(vBillow.mul(0.3)).add(0.08), 0, 0.98);

  const material = new MeshBasicNodeMaterial({ side: THREE.DoubleSide, alphaTest: 0.5 });
  material.positionNode = direction.mul(radius);
  material.colorNode = ramp;
  material.opacityNode = step(erosion, hole);
  return material;
}

// Assez de sommets pour que les volutes restent rondes : à 8 subdivisions, elles tournaient en pointes.
const BALL_GEOMETRY = new THREE.IcosahedronGeometry(1, 14);

interface ExplosionSlot {
  ball: THREE.Mesh<THREE.IcosahedronGeometry, MeshBasicNodeMaterial>;
  origin: THREE.Vector3;
  /** Lampe prêtée à cette explosion, `null` si une plus récente la lui a reprise. */
  light: THREE.PointLight | null;
  /** Secondes écoulées ; négatif = libre. */
  age: number;
}

export class Explosions {
  private readonly slots: ExplosionSlot[] = [];
  private readonly lights: THREE.PointLight[] = [];
  private cursor = 0;
  private lightCursor = 0;

  constructor(scene: THREE.Scene, private readonly random: () => number) {
    const material = createFireballMaterial();
    for (let i = 0; i < POOL_SIZE; i++) {
      const ball = new THREE.Mesh(BALL_GEOMETRY, material);
      ball.visible = false;
      // Le shader repousse les sommets hors de la sphère unité que connaît le frustum.
      ball.frustumCulled = false;
      ball.scale.setScalar(MAX_RADIUS);
      scene.add(ball);
      this.slots.push({ ball, origin: new THREE.Vector3(), light: null, age: -1 });
    }
    // Lampes toujours visibles, éteintes par leur intensité : en allumer une
    // changerait le nombre de lampes de la scène, donc recompilerait tous les
    // matériaux éclairés en plein combat.
    for (let i = 0; i < LIGHT_COUNT; i++) {
      const light = new THREE.PointLight(0xffb060, 0, LIGHT_RANGE, 2);
      scene.add(light);
      this.lights.push(light);
    }
  }

  spawn(point: THREE.Vector3): void {
    const slot = this.slots[this.cursor]!;
    this.cursor = (this.cursor + 1) % this.slots.length;
    this.release(slot);
    slot.age = 0;
    slot.origin.copy(point);
    // Deux explosions voisines ne doivent pas montrer les mêmes volutes.
    slot.ball.userData.explosionSeed = this.random() * 40;
    slot.ball.rotation.y = this.random() * Math.PI * 2;
    slot.ball.visible = true;

    const light = this.lights[this.lightCursor]!;
    this.lightCursor = (this.lightCursor + 1) % this.lights.length;
    for (const other of this.slots) if (other.light === light) other.light = null;
    slot.light = light;
    light.position.copy(point);
    this.apply(slot);
  }

  reset(): void {
    for (const slot of this.slots) this.release(slot);
    this.cursor = 0;
    this.lightCursor = 0;
  }

  update(realDt: number): void {
    for (const slot of this.slots) {
      if (slot.age < 0) continue;
      slot.age += realDt;
      if (slot.age >= DURATION) this.release(slot);
      else this.apply(slot);
    }
  }

  /**
   * Fait compiler le shader sous l'écran de chargement : l'adaptateur TSL du
   * renderer WebGL ne sait pas précompiler, et la première explosion ne doit
   * pas figer l'image en plein combat. `render` dessine une image réelle ;
   * l'appelant en redessine une dernière ensuite, pour effacer celle-ci.
   * see: docs/4-technique/rendu.md#préparation-des-douches
   */
  async warm(camera: THREE.Camera, render: () => void): Promise<void> {
    const ball = this.slots[0]!.ball;
    const pose = { visible: ball.visible, position: ball.position.clone(), age: ball.userData.explosionAge as unknown };
    try {
      camera.getWorldDirection(ball.position).multiplyScalar(8).add(camera.getWorldPosition(new THREE.Vector3()));
      ball.userData.explosionAge = 0.5;
      ball.visible = true;
      render();
      // L'adaptateur invalide les attributs de géométrie dans une microtask.
      await Promise.resolve();
      render();
    } finally {
      ball.visible = pose.visible;
      ball.position.copy(pose.position);
      ball.userData.explosionAge = pose.age;
    }
  }

  private release(slot: ExplosionSlot): void {
    slot.age = -1;
    slot.ball.visible = false;
    if (slot.light) slot.light.intensity = 0;
    slot.light = null;
  }

  private apply(slot: ExplosionSlot): void {
    const t = slot.age / DURATION;
    slot.ball.userData.explosionAge = t;
    slot.ball.position.copy(slot.origin);
    slot.ball.position.y += RISE * t;
    if (slot.light) slot.light.intensity = LIGHT_INTENSITY * Math.max(0, 1 - slot.age / LIGHT_DURATION);
  }
}
