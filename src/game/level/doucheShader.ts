import * as THREE from "three";
import { MeshLambertNodeMaterial } from "three/webgpu";
import {
  abs,
  floor,
  fract,
  float,
  mix,
  positionLocal,
  positionWorld,
  sin,
  step,
  sub,
  uniform,
  vec3,
} from "three/tsl";

import { runGameplaySync } from "../../core/runtime";
import { RenderService } from "../../render/renderService";
interface AnimationDouche {
  meshes: THREE.Mesh[];
  temps: number;
}

const animations = new WeakMap<THREE.Object3D, AnimationDouche>();
const uniformTemps = uniform(0).setName("uTempsDouche");
const NOM_FILET = /^fx_douche_[12]_stream_.+$/;
const PERIODE_TEMPS = 16;

function estUnFilet(mesh: THREE.Mesh): boolean {
  const nomGlb = typeof mesh.userData.name === "string" ? mesh.userData.name : "";
  return NOM_FILET.test(mesh.name) || NOM_FILET.test(nomGlb);
}

function creerMateriauFilet(): MeshLambertNodeMaterial {
  const poste = floor(positionWorld.x.mul(7));
  const hauteur = positionWorld.y;

  // Les veines descendent dans le volume, avec un léger balancement latéral.
  const derive = sin(hauteur.mul(3.1).add(uniformTemps.mul(1.7)).add(poste)).mul(0.13);
  const coordonneeLargeur = positionLocal.x.mul(44).add(derive);
  const celluleLargeur = floor(coordonneeLargeur);
  const graineFilet = fract(
    sin(celluleLargeur.mul(12.9898).add(poste.mul(78.233)).add(4.17)).mul(43758.5453),
  );
  const graineGoutte = fract(
    sin(celluleLargeur.mul(39.3467).add(poste.mul(19.19)).add(11.3)).mul(24634.6345),
  );

  const distanceFilet = abs(fract(coordonneeLargeur).sub(0.5));
  const largeurFilet = graineFilet.mul(0.075).add(0.035);
  const filet = step(distanceFilet, largeurFilet)
    .mul(step(0.2, graineFilet))
    .mul(step(0.12, graineGoutte));

  // Les filets restent lisibles mais se fragmentent en gouttes en descendant.
  const phaseChute = fract(hauteur.mul(3.7).add(uniformTemps.mul(5.2)).add(graineFilet));
  const chute = step(0.07, phaseChute).mul(sub(1, step(0.84, phaseChute)));
  const veine = filet.mul(chute);

  // Éclats fins et rares : ils glissent plus vite que les veines principales.
  const phaseÉclat = fract(hauteur.mul(9.5).add(uniformTemps.mul(10.5)).add(graineGoutte));
  const éclat = step(0.84, graineGoutte)
    .mul(step(distanceFilet, largeurFilet.mul(0.62)))
    .mul(step(0.18, phaseÉclat))
    .mul(sub(1, step(0.38, phaseÉclat)));

  // Un bruit en damier très discret casse l'aplat sans transformer l'eau en grille.
  const celluleHauteur = floor(hauteur.mul(14).add(uniformTemps.mul(8)));
  const grain = fract(
    sin(celluleLargeur.mul(17.17).add(celluleHauteur.mul(31.73)).add(poste)).mul(15731.743),
  );
  const mousse = step(0.91, grain).mul(step(0.28, phaseChute));

  const materiau = new MeshLambertNodeMaterial({
    color: 0xffffff,
    emissive: 0x08212a,
    emissiveIntensity: 0.38,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const couleurVolume = vec3(0.045, 0.17, 0.22);
  const couleurVeine = vec3(0.08, 0.46, 0.56);
  const couleurMousse = vec3(0.24, 0.66, 0.72);
  const couleurÉclat = vec3(0.72, 0.94, 0.97);
  materiau.colorNode = mix(
    mix(mix(couleurVolume, couleurVeine, veine), couleurMousse, mousse),
    couleurÉclat,
    éclat,
  );
  materiau.opacityNode = float(0.19)
    .add(veine.mul(0.29))
    .add(mousse.mul(0.1))
    .add(éclat.mul(0.3));

  return materiau;
}

/** Remplace les filets par un Lambert TSL partagé entre les jets de cette racine. */
export function installShaderDouches(root: THREE.Object3D | null): void {
  if (!root || animations.has(root)) return;

  const meshes: THREE.Mesh[] = [];
  root.traverse((objet) => {
    if (objet instanceof THREE.Mesh && estUnFilet(objet)) meshes.push(objet);
  });
  if (meshes.length === 0) return;

  const animation: AnimationDouche = { meshes, temps: 0 };
  const material = creerMateriauFilet();
  animations.set(root, animation);
  for (const mesh of meshes) {
    mesh.material = material;
    mesh.visible = false;
  }
}

/** Avance le motif au pas fixe ; aucun temps mural ni node `time`. */
export function updateShaderDouches(root: THREE.Object3D | null, dt: number): void {
  if (!root || !Number.isFinite(dt) || dt <= 0) return;

  const animation = animations.get(root);
  if (!animation) return;

  animation.temps = (animation.temps + dt) % PERIODE_TEMPS;
  uniformTemps.value = animation.temps;
}

/** WebGLNodesHandler ne supporte pas compileAsync : amorçage sous l'écran de chargement.
 * see: docs/4-technique/rendu.md#préparation-des-douches */
export async function warmShaderDouches(
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
