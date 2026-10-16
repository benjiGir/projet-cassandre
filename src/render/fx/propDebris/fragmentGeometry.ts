import * as THREE from "three";
import { configureRetroTexture } from "../../pipeline/renderer";
import type { FragmentMaterial } from "./propDebrisTypes";

export function createFragmentGeometry(kind: FragmentMaterial): THREE.BufferGeometry {
  if (kind === "flour") return new THREE.IcosahedronGeometry(0.5, 0);
  if (kind === "water") return new THREE.OctahedronGeometry(0.5, 0);
  const outline =
    kind === "cardboard"
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
  if (kind === "glass") outline.splice(0, outline.length, [-0.5, -0.45], [0.5, -0.25], [-0.15, 0.5]);
  else if (kind !== "cardboard" && kind !== "wood")
    outline.splice(0, outline.length, [-0.5, -0.5], [0.3, -0.48], [0.5, -0.05], [0.38, 0.5], [-0.4, 0.4]);
  const positions: number[] = [],
    uvs: number[] = [];
  function vertex(x: number, y: number, z: number): void {
    positions.push(x, y, z);
    uvs.push(x + 0.5, z + 0.5);
  }
  const bent = kind === "cardboard" || kind === "metal" || kind === "gas" || kind === "electronics";
  const borderY = bent ? -0.1 : 0.5;
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
  if (kind !== "cardboard" && kind !== "wood") return createHardFragmentMaterial(kind);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = kind === "cardboard" ? "#eee8d7" : "#e1d6bf";
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i++) {
    ctx.fillStyle = i % 3 === 0 ? "#b6ac96" : "#d5ccb7";
    if (kind === "cardboard") ctx.fillRect((i * 23) % 64, (i * 11) % 64, 2, 1);
    else ctx.fillRect(i, 0, i % 7 === 0 ? 2 : 1, 64);
  }
  if (kind === "cardboard") {
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

function createHardFragmentMaterial(kind: FragmentMaterial): THREE.MeshLambertMaterial {
  if (kind === "flour" || kind === "water") return new THREE.MeshLambertMaterial({ flatShading: true });
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = kind === "circuit" ? "#355d46" : kind === "gas" ? "#a53829" : "#b7bdb7";
  ctx.fillRect(0, 0, 64, 64);
  if (kind === "circuit") {
    ctx.strokeStyle = "#a19454";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const x = 6 + i * 9;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 20 + i * 4);
      ctx.lineTo(x + 5, 25 + i * 4);
      ctx.lineTo(x + 5, 64);
      ctx.stroke();
    }
    ctx.fillStyle = "#222d29";
    ctx.fillRect(15, 13, 15, 20);
    ctx.fillRect(38, 39, 10, 9);
    ctx.fillStyle = "#c4c1a7";
    for (let i = 0; i < 6; i++) ctx.fillRect(12, 15 + i * 3, 3, 1);
  } else if (kind === "glass") {
    ctx.fillStyle = "#dce8de";
    ctx.fillRect(2, 2, 3, 55);
    ctx.fillRect(2, 3, 49, 2);
    ctx.strokeStyle = "#899e9c";
    ctx.beginPath();
    ctx.moveTo(8, 55);
    ctx.lineTo(30, 28);
    ctx.lineTo(51, 10);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#777e7a";
    for (let i = 0; i < 12; i++) ctx.fillRect((i * 17) % 64, (i * 23) % 64, 11, 1);
    ctx.fillStyle = "#d9d9c9";
    ctx.fillRect(4, 3, 54, 2);
    if (kind === "electronics") {
      ctx.fillStyle = "#424b49";
      for (let i = 0; i < 5; i++) ctx.fillRect(12, 15 + i * 6, 33, 2);
    }
    if (kind === "gas") {
      ctx.fillStyle = "#b7a352";
      ctx.fillRect(0, 23, 64, 12);
      ctx.fillStyle = "#322d28";
      ctx.fillRect(21, 26, 20, 5);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  configureRetroTexture(texture);
  return new THREE.MeshLambertMaterial({ map: texture });
}
