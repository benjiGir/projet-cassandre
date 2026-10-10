import * as THREE from "three";

import { installShowerShader, updateShowerShader } from "./doucheShader";
interface ShowerStation {
  meshes: THREE.Mesh[];
  origin: THREE.Vector3;
}

const stationsByRoot = new WeakMap<THREE.Object3D, Map<string, ShowerStation>>();
const STREAM_NAME = /^fx_douche_([12])_stream_.+$/;

/** Prépare les jets éteints avant le premier affichage du niveau chargé. */
export function initShowers(root: THREE.Object3D): void {
  if (stationsByRoot.has(root)) return;

  const stations = new Map<string, ShowerStation>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const glbName = typeof object.userData.name === "string" ? object.userData.name : "";
    const match = STREAM_NAME.exec(object.name) ?? STREAM_NAME.exec(glbName);
    if (!match) return;

    let station = stations.get(match[1]);
    if (!station) {
      station = { meshes: [], origin: new THREE.Vector3() };
      stations.set(match[1], station);
    }
    station.meshes.push(object);
  });

  installShowerShader(root);
  for (const station of stations.values()) {
    station.meshes[0].getWorldPosition(station.origin);
  }
  stationsByRoot.set(root, stations);
}

/** Anime le shader au pas fixe ; le rejeu garde ainsi le même écoulement. */
export function updateShowers(root: THREE.Object3D | null, dt: number): void {
  if (!root) return;
  initShowers(root);
  updateShowerShader(root, dt);
}

/** Écrit les origines des jets actifs dans le tableau réutilisé par l'audio. */
export function collectActiveShowerOrigins(root: THREE.Object3D | null, out: THREE.Vector3[]): void {
  out.length = 0;
  if (!root) return;
  initShowers(root);

  for (const station of stationsByRoot.get(root)!.values()) {
    if (station.meshes[0]?.visible) out.push(station.origin);
  }
}

/** Bascule l'eau du poste associé ; `null` signale une scène sans ce poste. */
export function toggleShowerWater(root: THREE.Object3D, commandName: string): boolean | null {
  const match = /^use_douche_([12])$/.exec(commandName);
  if (!match) return null;

  initShowers(root);
  const station = stationsByRoot.get(root)?.get(match[1]);
  if (!station) return null;

  const active = !station.meshes[0].visible;
  for (const mesh of station.meshes) mesh.visible = active;
  return active;
}
