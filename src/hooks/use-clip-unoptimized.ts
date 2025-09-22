import {
  Vector2,
  Vector3,
  Mesh,
  LineBasicMaterial,
  LineSegments,
  Object3D,
  type Object3DEventMap,
  Line3,
  Matrix4,
  BufferGeometry,
  BufferAttribute,
} from "three";
import { MeshBVH } from "three-mesh-bvh";
import { useThree } from "@react-three/fiber";
import earcut from "../utils/earcut";
import type { UseThree } from "../shared-variables";

type Segment = [Vector2, Vector2];

const vector3ToVector2 = (points: Vector3[], normal: Vector3) => {
  const dotProduct = (v1: Vector3, v2: Vector3) =>
    v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;

  const subtract = (v1: Vector3, v2: Vector3) =>
    new Vector3(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z);

  const scale = (v: Vector3, s: number) =>
    new Vector3(v.x * s, v.y * s, v.z * s);

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

  const v2dList = points.map((point) => {
    const v = projectPointOntoPlane(point, normal, points[0]);
    return new Vector2(v.x, v.y);
  });

  return v2dList;
};

const triangulation = (points: Vector2[]) => {
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

const getAllPolygons = (points: Vector2[], tolerance?: number) => {
  if (!tolerance) tolerance = 0.000001;
  const parseSegments = (points: Vector2[]) => {
    const segments: Segment[] = [];
    for (let i = 0; i < points.length; i += 2) {
      const start = points[i];
      const end = points[i + 1];
      segments.push([start, end]);
    }
    return segments;
  };

  const arePointsClose = (
    p1: Vector2,
    p2: Vector2,
    tolerance: number
  ): boolean => {
    return p1.distanceTo(p2) <= tolerance;
  };

  const buildGraph = (segments: Segment[]): Map<string, Vector2[]> => {
    const graph = new Map<string, Vector2[]>();

    const getKey = (point: Vector2) => {
      const roundToTolerance = (value: number) =>
        Math.round(value / tolerance) * tolerance;
      return `${roundToTolerance(point.x)},${roundToTolerance(point.y)}`;
    };

    for (const [p1, p2] of segments) {
      const key1 = getKey(p1);
      const key2 = getKey(p2);

      if (!graph.has(key1)) graph.set(key1, []);
      if (!graph.has(key2)) graph.set(key2, []);
      graph.get(key1)?.push(p2);
      graph.get(key2)?.push(p1);
    }

    return graph;
  };

  const findClosePointKey = (
    point: Vector2,
    graph: Map<string, Vector2[]>
  ): string | null => {
    for (const key of graph.keys()) {
      const [x, y] = key.split(",").map((v) => +v);
      const graphPoint = new Vector2(x, y);
      if (arePointsClose(point, graphPoint, tolerance)) {
        return key;
      }
    }
    return null;
  };

  const findCycles = (graph: Map<string, Vector2[]>): Vector2[][] => {
    const visited = new Set<string>();
    const cycles: Vector2[][] = [];
    const stack: string[] = [];

    const dfs = (nodeKey: string, _point: Vector2, parent: string | null) => {
      visited.add(nodeKey);
      stack.push(nodeKey);

      for (const neighbor of graph.get(nodeKey) || []) {
        const neighborKey = findClosePointKey(neighbor, graph);
        if (neighborKey == parent) continue;

        if (neighborKey && visited.has(neighborKey)) {
          const cycleStartIdx = stack.indexOf(neighborKey);
          if (cycleStartIdx !== -1) {
            const cycle = stack.slice(cycleStartIdx).map((key) => {
              const [x, y] = key.split(",").map(Number);
              return new Vector2(x, y);
            });
            cycles.push(cycle);
          }
        } else if (neighborKey) {
          dfs(neighborKey, neighbor, nodeKey);
        }
      }

      stack.pop();
    };

    for (const nodeKey of graph.keys()) {
      if (!visited.has(nodeKey)) {
        dfs(nodeKey, new Vector2(...nodeKey.split(",").map(Number)), null);
      }
    }

    return cycles;
  };

  const segments = parseSegments(points);
  const graph = buildGraph(segments);
  const allCycles = findCycles(graph);

  const uniqueCycles = allCycles.map((cycle) => Array.from(new Set(cycle)));

  return uniqueCycles;
};

type ClipFilter = (item: Object3D<Object3DEventMap>) => boolean;

const useClipUnoptimized = () => {
  const { scene }: UseThree = useThree();

  const clip = (planeMesh: Mesh, filter: ClipFilter, tolerance?: number) => {
    const m = new LineBasicMaterial({ color: 0xffff00 });
    const lines: LineSegments[][] = [];
    const normal = new Vector3();
    planeMesh.getWorldDirection(normal);
    const planeBoundsTree = new MeshBVH(planeMesh.geometry);
    planeMesh.geometry.boundsTree = planeBoundsTree;
    const meshList: Mesh[] = [];

    scene.traverse((item) => {
      if (filter(item)) {
        const edge = new Line3();
        const itemSegments: Vector3[] = [];
        const itemLines: LineSegments[] = [];
        planeBoundsTree.bvhcast(
          (item as Mesh).geometry.boundsTree!,
          new Matrix4()
            .copy(planeMesh.matrixWorld)
            .invert()
            .multiply(item.matrixWorld),
          {
            intersectsTriangles(tri1, tri2) {
              if (tri1.intersectsTriangle(tri2, edge)) {
                const { start, end } = edge;
                itemSegments.push(start.clone(), end.clone());
                const g = new BufferGeometry();
                g.setAttribute(
                  "position",
                  new BufferAttribute(
                    new Float32Array([
                      start.x,
                      start.y,
                      start.z,
                      end.x,
                      end.y,
                      end.z,
                    ]),
                    3
                  )
                );
                const line = new LineSegments(g, m);
                line.applyMatrix4(planeMesh.matrix);
                line.renderOrder = 20;
                itemLines.push(line);
              }
              return false;
            },
          }
        );
        lines.push(itemLines);
        const vector2List = vector3ToVector2(itemSegments, normal);
        const polygons = getAllPolygons(vector2List, tolerance);
        polygons.forEach((polygon) => {
          const triangleList = triangulation(polygon).filter(
            (v) => v.length > 2
          );
          triangleList.forEach((triangle) => {
            const vector3List = triangle.map((p) => new Vector3(p.x, p.y, 0));
            const g = new BufferGeometry();
            g.setFromPoints(vector3List);
            g.computeBoundingBox();
            const mesh = new Mesh(g, (item as Mesh).material);
            mesh.userData.isClipResult = true;
            mesh.applyMatrix4(planeMesh.matrix);
            mesh.renderOrder = 20;
            meshList.push(mesh);
          });
        });
      }
    });

    return { lines, meshList };
  };

  return { clip };
};

export default useClipUnoptimized;
