import * as THREE from "three";
import { MeshLambertNodeMaterial } from "three/webgpu";
import { abs, floor, fract, float, mix, positionLocal, positionWorld, sin, step, sub, uniform, vec3 } from "three/tsl";

import { runGameplaySync } from "../../../app/runtime/gameRuntime";
import { RenderService } from "../../../render/pipeline/renderService";
interface ShowerAnimation {
  meshes: THREE.Mesh[];
  time: number;
}

const animations = new WeakMap<THREE.Object3D, ShowerAnimation>();
const timeUniform = uniform(0).setName("uTempsDouche");
const STREAM_NAME = /^fx_douche_[12]_stream_.+$/;
const TIME_PERIOD = 16;

function isStream(mesh: THREE.Mesh): boolean {
  const glbName = typeof mesh.userData.name === "string" ? mesh.userData.name : "";
  return STREAM_NAME.test(mesh.name) || STREAM_NAME.test(glbName);
}

function createStreamMaterial(): MeshLambertNodeMaterial {
  const station = floor(positionWorld.x.mul(7));
  const height = positionWorld.y;

  // Les veines descendent dans le volume, avec un léger balancement latéral.
  const drift = sin(height.mul(3.1).add(timeUniform.mul(1.7)).add(station)).mul(0.13);
  const widthCoord = positionLocal.x.mul(44).add(drift);
  const widthCell = floor(widthCoord);
  const streamSeed = fract(sin(widthCell.mul(12.9898).add(station.mul(78.233)).add(4.17)).mul(43758.5453));
  const dropSeed = fract(sin(widthCell.mul(39.3467).add(station.mul(19.19)).add(11.3)).mul(24634.6345));

  const streamDistance = abs(fract(widthCoord).sub(0.5));
  const streamWidth = streamSeed.mul(0.075).add(0.035);
  const stream = step(streamDistance, streamWidth).mul(step(0.2, streamSeed)).mul(step(0.12, dropSeed));

  // Les filets restent lisibles mais se fragmentent en gouttes en descendant.
  const fallPhase = fract(height.mul(3.7).add(timeUniform.mul(5.2)).add(streamSeed));
  const fall = step(0.07, fallPhase).mul(sub(1, step(0.84, fallPhase)));
  const vein = stream.mul(fall);

  // Éclats fins et rares : ils glissent plus vite que les veines principales.
  const sparklePhase = fract(height.mul(9.5).add(timeUniform.mul(10.5)).add(dropSeed));
  const sparkle = step(0.84, dropSeed)
    .mul(step(streamDistance, streamWidth.mul(0.62)))
    .mul(step(0.18, sparklePhase))
    .mul(sub(1, step(0.38, sparklePhase)));

  // Un bruit en damier très discret casse l'aplat sans transformer l'eau en grille.
  const heightCell = floor(height.mul(14).add(timeUniform.mul(8)));
  const grain = fract(sin(widthCell.mul(17.17).add(heightCell.mul(31.73)).add(station)).mul(15731.743));
  const foam = step(0.91, grain).mul(step(0.28, fallPhase));

  const streamMaterial = new MeshLambertNodeMaterial({
    color: 0xffffff,
    emissive: 0x08212a,
    emissiveIntensity: 0.38,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const volumeColor = vec3(0.045, 0.17, 0.22);
  const veinColor = vec3(0.08, 0.46, 0.56);
  const foamColor = vec3(0.24, 0.66, 0.72);
  const sparkleColor = vec3(0.72, 0.94, 0.97);
  streamMaterial.colorNode = mix(mix(mix(volumeColor, veinColor, vein), foamColor, foam), sparkleColor, sparkle);
  streamMaterial.opacityNode = float(0.19).add(vein.mul(0.29)).add(foam.mul(0.1)).add(sparkle.mul(0.3));

  return streamMaterial;
}

/** Remplace les filets par un Lambert TSL partagé entre les jets de cette racine. */
export function installShowerShader(root: THREE.Object3D | null): void {
  if (!root || animations.has(root)) return;

  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && isStream(object)) meshes.push(object);
  });
  if (meshes.length === 0) return;

  const animation: ShowerAnimation = { meshes, time: 0 };
  const material = createStreamMaterial();
  animations.set(root, animation);
  for (const mesh of meshes) {
    mesh.material = material;
    mesh.visible = false;
  }
}

/** Avance le motif au pas fixe ; aucun temps mural ni node `time`. */
export function updateShowerShader(root: THREE.Object3D | null, dt: number): void {
  if (!root || !Number.isFinite(dt) || dt <= 0) return;

  const animation = animations.get(root);
  if (!animation) return;

  animation.time = (animation.time + dt) % TIME_PERIOD;
  timeUniform.value = animation.time;
}

/** WebGLNodesHandler ne supporte pas compileAsync : amorçage sous l'écran de chargement.
 * see: docs/4-technique/rendu.md#préparation-des-douches */
export async function warmShowerShader(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  root: THREE.Object3D,
  previousRoot?: THREE.Object3D,
): Promise<void> {
  const animation = animations.get(root);
  if (!animation) return;

  const poses = animation.meshes.map((mesh) => ({ mesh, visible: mesh.visible, culled: mesh.frustumCulled }));
  const previousTarget = renderer.getRenderTarget();
  const previousParent = previousRoot?.parent;
  try {
    // L'adaptateur TSL parcourt même les lampes d'une racine invisible.
    previousRoot?.removeFromParent();
    for (const { mesh } of poses) {
      mesh.visible = true;
      mesh.frustumCulled = false;
    }
    // Le framebuffer écran garde la même conversion de couleur que le jeu.
    // Un RenderTarget ordinaire ferait compiler une autre variante, en linéaire.
    renderer.setRenderTarget(null);
    runGameplaySync(RenderService.use((rs) => rs.render(renderer, scene, camera)));
    // L'adaptateur invalide les attributs de géométrie dans une microtask.
    await Promise.resolve();
    runGameplaySync(RenderService.use((rs) => rs.render(renderer, scene, camera)));
  } finally {
    for (const { mesh, visible, culled } of poses) {
      mesh.visible = visible;
      mesh.frustumCulled = culled;
    }
    if (previousRoot && previousParent) previousParent.add(previousRoot);
    renderer.setRenderTarget(previousTarget);
    // Restaurer l'image avant le prochain paint, y compris lors d'un hot reload.
    runGameplaySync(RenderService.use((rs) => rs.render(renderer, scene, camera)));
  }
}
