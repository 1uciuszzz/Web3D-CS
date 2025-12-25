import {
  Mesh,
  BufferGeometry,
  BufferAttribute,
  Matrix4,
  Vector3,
  Line3,
  DoubleSide,
  Object3D,
  type Object3DEventMap,
  Scene,
  LineSegments,
} from "three";
import { MeshBVH } from "three-mesh-bvh";
import { getAllPolygons } from "../utils/get-all-polygons";
import {
  buildPlaneBasis,
  projectTo2D,
  unprojectTo3D,
} from "../utils/build-plane-basis";
import earcut from "../utils/earcut";
import { buildLinesFromPolygon } from "../utils/build-lines-from-polygon";

type SectionResult = {
  lines: LineSegments[];
  meshes: Mesh[];
};

type ClipFilter = (obj: Object3D<Object3DEventMap>) => boolean;

const useClipOptimized = (scene: Scene) => {
  const clip = (
    planeMesh: Mesh,
    filter: ClipFilter,
    tolerance = 1e-6
  ): SectionResult => {
    const basis = buildPlaneBasis(planeMesh);
    const planeBVH = new MeshBVH(planeMesh.geometry);
    planeMesh.geometry.boundsTree = planeBVH;

    const resultMeshes: Mesh[] = [];
    const resultLines: LineSegments[] = [];
    const planeToWorld = planeMesh.matrixWorld;
    const worldToPlane = new Matrix4().copy(planeToWorld).invert();

    scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      if (!filter(obj)) return;
      if (!obj.geometry.boundsTree) {
        obj.geometry.boundsTree = new MeshBVH(obj.geometry);
      }

      const segments3D: Vector3[] = [];
      const edge = new Line3();

      planeBVH.bvhcast(
        obj.geometry.boundsTree,
        new Matrix4().copy(worldToPlane).multiply(obj.matrixWorld),
        {
          intersectsTriangles(tri1, tri2) {
            if (tri1.intersectsTriangle(tri2, edge)) {
              segments3D.push(
                edge.start.clone().applyMatrix4(planeToWorld),
                edge.end.clone().applyMatrix4(planeToWorld)
              );
            }
            return false;
          },
        }
      );

      if (segments3D.length === 0) return;

      // 3D → 2D
      const segments2D = segments3D.map((p) => projectTo2D(p, basis));

      // 线段 → 多个 polygon（你已有实现）
      const polygons = getAllPolygons(segments2D, tolerance);

      polygons.forEach((polygon) => {
        if (polygon.length < 3) return;

        resultLines.push(buildLinesFromPolygon(polygon, basis));

        const flat: number[] = [];
        polygon.forEach((p) => flat.push(p.x, p.y));

        const indices = earcut(flat);
        if (indices.length === 0) return;

        const positions: number[] = [];

        for (let i = 0; i < indices.length; i++) {
          const p2 = polygon[indices[i]];
          const p3 = unprojectTo3D(p2, basis);
          positions.push(p3.x, p3.y, p3.z);
        }

        const geom = new BufferGeometry();
        geom.setAttribute(
          "position",
          new BufferAttribute(new Float32Array(positions), 3)
        );
        geom.computeVertexNormals();

        const mat = obj.material.clone();
        mat.side = DoubleSide;

        const sectionMesh = new Mesh(geom, mat);
        sectionMesh.userData.isSection = true;

        resultMeshes.push(sectionMesh);
      });
    });

    return { meshes: resultMeshes, lines: resultLines };
  };

  return { clip };
};

export default useClipOptimized;
