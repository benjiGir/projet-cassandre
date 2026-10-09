import { BufferGeometry, Float32BufferAttribute } from "three";

export function createMuzzleFlashGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [
        -0.5, -0.5, 0.03, 0.5, -0.5, 0.03, 0.5, 0.5, 0.03, -0.5, 0.5, 0.03, -0.5, 0, 0, 0.5, 0, 0, 0.5, 0, 1, -0.5, 0,
        1, 0, -0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1,
      ],
      3,
    ),
  );
  geometry.setAttribute(
    "uv",
    new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1], 2),
  );
  geometry.setAttribute("flashPlane", new Float32BufferAttribute([0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1], 1));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11]);
  geometry.computeVertexNormals();
  return geometry;
}
