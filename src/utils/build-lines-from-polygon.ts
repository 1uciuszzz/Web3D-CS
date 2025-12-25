import {
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  type Material,
  type Vector2,
} from "three";
import { unprojectTo3D, type PlaneBasis } from "./build-plane-basis";

export const buildLinesFromPolygon = (
  polygon: Vector2[],
  basis: PlaneBasis,
  material?: Material
): LineSegments => {
  const points3D: number[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];

    const pA = unprojectTo3D(a, basis);
    const pB = unprojectTo3D(b, basis);

    points3D.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(points3D), 3)
  );

  return new LineSegments(
    geometry,
    material ??
      new LineBasicMaterial({
        color: 0x000000,
        depthTest: false,
      })
  );
};
