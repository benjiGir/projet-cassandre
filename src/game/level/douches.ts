import * as THREE from "three";
import { installShaderDouches, updateShaderDouches } from "./doucheShader";

interface PosteDouche {
  meshes: THREE.Mesh[];
  origine: THREE.Vector3;
}

const postesParRacine = new WeakMap<THREE.Object3D, Map<string, PosteDouche>>();
const NOM_FILET = /^fx_douche_([12])_stream_.+$/;

/** Prépare les jets éteints avant le premier affichage du niveau chargé. */
export function initialiserDouches(root: THREE.Object3D): void {
  if (postesParRacine.has(root)) return;

  const postes = new Map<string, PosteDouche>();
  root.traverse((objet) => {
    if (!(objet instanceof THREE.Mesh)) return;
    const nomGlb = typeof objet.userData.name === "string" ? objet.userData.name : "";
    const match = NOM_FILET.exec(objet.name) ?? NOM_FILET.exec(nomGlb);
    if (!match) return;

    let poste = postes.get(match[1]!);
    if (!poste) {
      poste = { meshes: [], origine: new THREE.Vector3() };
      postes.set(match[1]!, poste);
    }
    poste.meshes.push(objet);
  });

  installShaderDouches(root);
  for (const poste of postes.values()) {
    poste.meshes[0]!.getWorldPosition(poste.origine);
  }
  postesParRacine.set(root, postes);
}

/** Anime le shader au pas fixe ; le rejeu garde ainsi le même écoulement. */
export function updateDouches(root: THREE.Object3D | null, dt: number): void {
  if (!root) return;
  initialiserDouches(root);
  updateShaderDouches(root, dt);
}

/** Écrit les origines des jets actifs dans le tableau réutilisé par l'audio. */
export function collectActiveShowerOrigins(
  root: THREE.Object3D | null,
  out: THREE.Vector3[],
): void {
  out.length = 0;
  if (!root) return;
  initialiserDouches(root);

  for (const poste of postesParRacine.get(root)!.values()) {
    if (poste.meshes[0]?.visible) out.push(poste.origine);
  }
}

/** Bascule l'eau du poste associé ; `null` signale une scène sans ce poste. */
export function basculerEau(root: THREE.Object3D, nomCommande: string): boolean | null {
  const match = /^use_douche_([12])$/.exec(nomCommande);
  if (!match) return null;

  initialiserDouches(root);
  const poste = postesParRacine.get(root)?.get(match[1]!);
  if (!poste) return null;

  const active = !poste.meshes[0]!.visible;
  for (const mesh of poste.meshes) mesh.visible = active;
  return active;
}
