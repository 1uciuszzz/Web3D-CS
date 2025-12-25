import { Mesh, Vector2, Vector3 } from "three";

export type PlaneBasis = {
  origin: Vector3;
  u: Vector3;
  v: Vector3;
  n: Vector3;
};

export const buildPlaneBasis = (planeMesh: Mesh): PlaneBasis => {
  const origin = new Vector3();
  planeMesh.getWorldPosition(origin);

  const n = new Vector3();
  planeMesh.getWorldDirection(n).normalize();

  const tmp = Math.abs(n.z) < 0.9 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0);

  const u = new Vector3().crossVectors(tmp, n).normalize();
  const v = new Vector3().crossVectors(n, u).normalize();

  return { origin, u, v, n };
};

export const projectTo2D = (p: Vector3, basis: PlaneBasis): Vector2 => {
  const d = p.clone().sub(basis.origin);
  return new Vector2(d.dot(basis.u), d.dot(basis.v));
};

export const unprojectTo3D = (p: Vector2, basis: PlaneBasis): Vector3 => {
  return basis.origin
    .clone()
    .addScaledVector(basis.u, p.x)
    .addScaledVector(basis.v, p.y);
};
