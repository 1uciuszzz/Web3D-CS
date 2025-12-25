/// <reference lib="webworker" />

import {
  BufferGeometry,
  BufferAttribute,
  Matrix4,
  Vector3,
  Line3,
} from "three";
import { MeshBVH } from "three-mesh-bvh";
import type {
  ClipRequest,
  ClipResponse,
  PolygonResult,
} from "./clip-optimized-worker.type";
import { projectTo2D, unprojectTo3D } from "../utils/build-plane-basis";
import { getAllPolygons } from "../utils/get-all-polygons";
import earcut from "../utils/earcut";

self.onmessage = (e: MessageEvent<ClipRequest>) => {
  const startTime = performance.now();
  const { plane, basis, targets, tolerance } = e.data;

  const planeGeom = buildGeometry(plane.geometry);
  const planeBVH = new MeshBVH(planeGeom);

  const planeToWorld = new Matrix4().fromArray(plane.matrixWorld);
  const worldToPlane = planeToWorld.clone().invert();

  const origin = new Vector3(...basis.origin);
  const xAxis = new Vector3(...basis.xAxis);
  const yAxis = new Vector3(...basis.yAxis);
  const normal = new Vector3(...basis.normal);
  const planeBasis = { origin, u: xAxis, v: yAxis, n: normal };

  const results: PolygonResult[] = [];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const targetGeom = buildGeometry(target.geometry);
    const targetBVH = new MeshBVH(targetGeom);

    const transform = new Matrix4()
      .copy(worldToPlane)
      .multiply(new Matrix4().fromArray(target.matrixWorld));

    const edge = new Line3();
    const segments3D: Vector3[] = [];

    planeBVH.bvhcast(targetBVH, transform, {
      intersectsTriangles(t1, t2) {
        if (t1.intersectsTriangle(t2, edge)) {
          segments3D.push(
            edge.start.clone().applyMatrix4(planeToWorld),
            edge.end.clone().applyMatrix4(planeToWorld)
          );
        }
        return false;
      },
    });

    if (!segments3D.length) continue;

    const segments2D = segments3D.map((p) => projectTo2D(p, planeBasis));

    const polygons = getAllPolygons(segments2D, tolerance);

    for (const poly of polygons) {
      if (poly.length < 3) continue;

      const linePos: number[] = [];
      for (const p of poly) {
        const p3 = unprojectTo3D(p, planeBasis);
        linePos.push(p3.x, p3.y, p3.z);
      }

      const flat: number[] = [];
      poly.forEach((p) => flat.push(p.x, p.y));
      const indices = earcut(flat);
      if (!indices.length) continue;

      const triPos: number[] = [];
      for (const i of indices) {
        const p3 = unprojectTo3D(poly[i], planeBasis);
        triPos.push(p3.x, p3.y, p3.z);
      }

      results.push({
        sourceIndex: i,
        triangles: new Float32Array(triPos),
        lines: new Float32Array(linePos),
      });
    }
  }

  const response: ClipResponse = { polygons: results };

  const endTime = performance.now();

  console.log(`clip-optimized-worker: ${(endTime - startTime).toFixed(2)}ms`);

  self.postMessage(
    response,
    results.flatMap((r) => [r.triangles.buffer, r.lines.buffer])
  );
};

const buildGeometry = (g: {
  position: Float32Array;
  index: Uint32Array | null;
}) => {
  const geom = new BufferGeometry();
  geom.setAttribute("position", new BufferAttribute(g.position, 3));
  if (g.index) geom.setIndex(new BufferAttribute(g.index, 1));
  return geom;
};
