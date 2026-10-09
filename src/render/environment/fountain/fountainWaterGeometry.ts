import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const TAU = Math.PI * 2;

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  try {
    const geometry = mergeGeometries(parts);
    if (!geometry) throw new Error("Géométrie de fontaine incompatible");
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.boundingBox?.expandByScalar(0.02);
    if (geometry.boundingSphere) geometry.boundingSphere.radius += 0.02;
    return geometry;
  } finally {
    for (const part of parts) part.dispose();
  }
}

export function createFountainPools(): THREE.BufferGeometry {
  const lower = new THREE.RingGeometry(0.66, 2.015, 8, 12);
  lower.rotateX(-Math.PI / 2).translate(0, 0.49, 0);
  const upper = new THREE.RingGeometry(0.078, 0.69, 8, 6);
  upper.rotateX(-Math.PI / 2).translate(0, 1.865, 0);
  return merge([lower, upper]);
}

function stream(angle: number, cascade: boolean): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const radius = cascade ? 0.66 + 0.84 * t : 0.05 + 0.48 * t;
    const y = cascade ? 1.866 + 0.45 * t - 1.826 * t * t : 1.98 + 8.2 * t - 8.33 * t * t;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
  }
  const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, cascade ? 0.033 : 0.026, 6, false);
  const uv = geometry.getAttribute("uv");
  geometry.setAttribute("fountainFlow", new THREE.Float32BufferAttribute(Array.from({ length: uv.count }, (_, i) => uv.getX(i)), 1));
  return geometry;
}

export function createFountainStreams(): THREE.BufferGeometry {
  const core = new THREE.CylinderGeometry(0.09, 0.055, 2.02, 10, 28, true);
  core.translate(0, 2.99, 0);
  const uv = core.getAttribute("uv");
  core.setAttribute("fountainFlow", new THREE.Float32BufferAttribute(Array.from({ length: uv.count }, (_, i) => uv.getY(i)), 1));
  const parts: THREE.BufferGeometry[] = [core];
  for (let i = 0; i < 8; i++) {
    const angle = i * TAU / 8;
    parts.push(stream(angle, false), stream(angle, true));
  }
  return merge(parts);
}

export function createFountainDroplets(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 96; i++) {
    const drop = new THREE.OctahedronGeometry(0.032);
    drop.scale(1, 1.8, 1);
    const positions = drop.getAttribute("position");
    const flight = new Float32Array(positions.count * 3);
    for (let j = 0; j < positions.count; j++) {
      flight[j * 3] = (i % 48) / 48;
      flight[j * 3 + 1] = (i % 8) * TAU / 8;
      flight[j * 3 + 2] = i < 48 ? 0 : 1;
    }
    drop.setAttribute("fountainFlight", new THREE.BufferAttribute(flight, 3));
    parts.push(drop);
  }
  const geometry = merge(parts);
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-1.6, 0.4, -1.6), new THREE.Vector3(1.6, 4.1, 1.6));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2.25, 0), 2.9);
  return geometry;
}
