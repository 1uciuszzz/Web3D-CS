import { Vector2, Vector3 } from "three";

const dotProduct = (v1: Vector3, v2: Vector3) =>
  v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;

const subtract = (v1: Vector3, v2: Vector3) =>
  new Vector3(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z);

const scale = (v: Vector3, s: number) => new Vector3(v.x * s, v.y * s, v.z * s);

const projectPointOntoPlane = (
  point: Vector3,
  planeNormal: Vector3,
  planePoint: Vector3
) => {
  const v = subtract(point, planePoint);
  const d = dotProduct(v, planeNormal);
  const projected = subtract(point, scale(planeNormal, d));
  return new Vector3(point.x, point.y, projected.z);
};

export const vector3ToVector2 = (points: Vector3[], normal: Vector3) => {
  const v2dList = points.map((point) => {
    const v = projectPointOntoPlane(point, normal, points[0]);
    return new Vector2(v.x, v.y);
  });

  return v2dList;
};
