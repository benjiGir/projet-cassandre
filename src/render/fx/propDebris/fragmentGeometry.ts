import * as THREE from "three";
import { configureRetroTexture } from "../../pipeline/renderer";
import type { FragmentMaterial } from "./propDebrisTypes";

export function createFragmentGeometry(kind: FragmentMaterial): THREE.BufferGeometry {
  const outline =
    kind === "carton"
      ? [
          [-0.5, -0.46],
          [-0.1, -0.5],
          [0.03, -0.42],
          [0.5, -0.49],
          [0.46, 0.15],
          [0.5, 0.48],
          [0.04, 0.43],
          [-0.47, 0.5],
        ]
      : [
          [-0.5, -0.48],
          [-0.18, -0.4],
          [-0.04, -0.5],
          [0.11, -0.39],
          [0.5, -0.46],
          [0.48, 0.48],
          [0.13, 0.42],
          [-0.5, 0.5],
        ];
  const positions: number[] = [],
    uvs: number[] = [];
  function vertex(x: number, y: number, z: number): void {
    positions.push(x, y, z);
    uvs.push(x + 0.5, z + 0.5);
  }
  const borderY = kind === "carton" ? -0.1 : 0.5;
  for (let i = 0; i < outline.length; i++) {
    const [x, z] = outline[i],
      [nx, nz] = outline[(i + 1) % outline.length];
    vertex(0, 0.5, 0);
    vertex(nx, borderY, nz);
    vertex(x, borderY, z);
    vertex(0, -0.5, 0);
    vertex(x, -0.5, z);
    vertex(nx, -0.5, nz);
    vertex(x, borderY, z);
    vertex(nx, borderY, nz);
    vertex(nx, -0.5, nz);
    vertex(x, borderY, z);
    vertex(nx, -0.5, nz);
    vertex(x, -0.5, z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

export function createFragmentMaterial(kind: FragmentMaterial): THREE.MeshLambertMaterial {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = kind === "carton" ? "#eee8d7" : "#e1d6bf";
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i++) {
    ctx.fillStyle = i % 3 === 0 ? "#b6ac96" : "#d5ccb7";
    if (kind === "carton") ctx.fillRect((i * 23) % 64, (i * 11) % 64, 2, 1);
    else ctx.fillRect(i, 0, i % 7 === 0 ? 2 : 1, 64);
  }
  if (kind === "carton") {
    ctx.fillStyle = "#c8b987";
    ctx.fillRect(27, 0, 10, 64);
    ctx.fillStyle = "#91866d";
    ctx.fillRect(27, 0, 1, 64);
    ctx.fillRect(36, 0, 1, 64);
    ctx.fillStyle = "#514b3d";
    for (let x = 8; x < 23; x += 3) ctx.fillRect(x, 44, (x % 2) + 1, 9);
    ctx.strokeStyle = "#857b64";
    ctx.strokeRect(6, 41, 19, 15);
  } else {
    ctx.fillStyle = "#6b5b45";
    ctx.fillRect(7, 5, 2, 3);
    ctx.fillRect(52, 55, 2, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  configureRetroTexture(texture);
  return new THREE.MeshLambertMaterial({ map: texture });
}
