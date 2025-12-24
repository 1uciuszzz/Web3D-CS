import { Vector2 } from "three";
import earcut from "./earcut";

export const triangulation = (points: Vector2[]) => {
  const vertices: number[] = [];
  points.forEach((point) => {
    vertices.push(point.x, point.y);
  });
  const triangles = earcut(vertices);
  const triangleList: Vector2[][] = [];
  for (let i = 0; i < triangles.length; i += 3) {
    triangleList.push([
      points[triangles[i]],
      points[triangles[i + 1]],
      points[triangles[i + 2]],
    ]);
  }
  return triangleList;
};
