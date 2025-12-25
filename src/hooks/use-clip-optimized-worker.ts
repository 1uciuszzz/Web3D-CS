import {
  Mesh,
  Scene,
  BufferGeometry,
  BufferAttribute,
  LineSegments,
  DoubleSide,
  type Object3DEventMap,
  Object3D,
  MeshStandardMaterial,
  LineBasicMaterial,
} from "three";
import type {
  ClipRequest,
  ClipResponse,
  PlaneBasisSerialized,
  SerializedMesh,
} from "../workers/clip-optimized-worker.type";
import { buildPlaneBasis } from "../utils/build-plane-basis";
import ClipWorker from "../workers/clip-optimized.worker?worker&inline";

type ClipFilter = (obj: Object3D<Object3DEventMap>) => boolean;

type SectionResult = {
  meshes: Mesh[];
  lines: LineSegments[];
};

const useClipOptimizedWorker = (scene: Scene) => {
  const worker = new ClipWorker();

  const clip = async (
    planeMesh: Mesh,
    filter: ClipFilter,
    tolerance = 1e-6
  ): Promise<SectionResult> => {
    const sourceMeshes: Mesh[] = [];

    const rawBasis = buildPlaneBasis(planeMesh);

    const basis: PlaneBasisSerialized = {
      origin: rawBasis.origin.toArray(),
      xAxis: rawBasis.u.toArray(),
      yAxis: rawBasis.v.toArray(),
      normal: rawBasis.n.toArray(),
    };

    const targets: SerializedMesh[] = [];

    scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      if (!filter(obj)) return;

      const geom = obj.geometry as BufferGeometry;

      sourceMeshes.push(obj);

      targets.push({
        geometry: {
          position: geom.attributes.position.array as Float32Array,
          index: (geom.index?.array as Uint32Array) ?? null,
        },
        matrixWorld: obj.matrixWorld.toArray(),
      });
    });

    const planeGeom = planeMesh.geometry as BufferGeometry;

    const request: ClipRequest = {
      plane: {
        geometry: {
          position: planeGeom.attributes.position.array as Float32Array,
          index: (planeGeom.index?.array as Uint32Array) ?? null,
        },
        matrixWorld: planeMesh.matrixWorld.toArray(),
      },
      basis,
      targets,
      tolerance,
    };

    const response = await new Promise<ClipResponse>((resolve) => {
      worker.onmessage = (e) => resolve(e.data);
      worker.postMessage(request);
    });

    const meshes: Mesh[] = [];
    const lines: LineSegments[] = [];

    for (let i = 0; i < response.polygons.length; i++) {
      const poly = response.polygons[i];
      const geom = new BufferGeometry();
      geom.setAttribute("position", new BufferAttribute(poly.triangles, 3));
      geom.computeVertexNormals();

      const source = sourceMeshes[poly.sourceIndex];
      const mat = (source.material as MeshStandardMaterial).clone();
      mat.side = DoubleSide;

      meshes.push(new Mesh(geom, mat));

      const lineGeom = new BufferGeometry();
      lineGeom.setAttribute("position", new BufferAttribute(poly.lines, 3));
      lines.push(
        new LineSegments(
          lineGeom,
          new LineBasicMaterial({
            color: 0x000000,
          })
        )
      );
    }

    return { meshes, lines };
  };

  return { clip };
};

export default useClipOptimizedWorker;
