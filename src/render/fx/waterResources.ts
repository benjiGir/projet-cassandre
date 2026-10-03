import * as THREE from "three";

// Bleu pâle partagé par la gerbe initiale (`spawnChunks`) ET la fontaine permanente (`InstancedMesh`) — même eau, deux régimes de rendu.
const WATER_COLOR = 0xb7dff0;
const WATER_DROPLET_SIZE = 0.05; // m
export const WATER_GEOMETRY = new THREE.BoxGeometry(WATER_DROPLET_SIZE, WATER_DROPLET_SIZE, WATER_DROPLET_SIZE);
const WATER_EMISSIVE = 0x2f5566;
export const WATER_MATERIAL = new THREE.MeshLambertMaterial({ color: WATER_COLOR, emissive: WATER_EMISSIVE });

export { WATER_DROPLET_SIZE };
