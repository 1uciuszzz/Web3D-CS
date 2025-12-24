/// <reference lib="webworker" />
import {
  Vector3,
  Line3,
  Matrix4,
  BufferGeometry,
  BufferAttribute,
} from "three";
import { MeshBVH } from "three-mesh-bvh";

// 请根据你项目的实际路径调整这些工具函数的引入
import { vector3ToVector2 } from "../utils/vec3-to-vec2";
import { getAllPolygons } from "../utils/get-all-polygons";
import { triangulation } from "../utils/triangulation";
import type {
  ClipInput,
  ClipResult,
  MeshData,
  MeshResultItem,
} from "./clip-optimized-worker.type";

// 复用临时变量以减少 GC
const _tempMatrix = new Matrix4();
const _edge = new Line3();

// 辅助函数：从数据重建简单的 Geometry (仅用于 BVH 计算)
const reconstructGeometry = (data: MeshData["geometry"]) => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(data.position, 3));
  if (data.index) {
    geometry.setIndex(new BufferAttribute(data.index, 1));
  }
  return geometry;
};

self.onmessage = (e: MessageEvent<ClipInput>) => {
  const calcStart = performance.now();
  const { plane, targets, tolerance, planeNormal } = e.data;

  // 1. 重建切面 (Plane) 的 BVH
  const planeGeometry = reconstructGeometry(plane.geometry);
  const planeBVH = new MeshBVH(planeGeometry);
  const planeMatrix = new Matrix4().fromArray(plane.matrixWorld);
  const normal = new Vector3().fromArray(planeNormal);

  const resultLinesVertices: Float32Array[] = [];
  const resultMeshesItems: MeshResultItem[] = [];

  // 2. 遍历目标 Mesh 进行裁剪
  for (let i = 0; i < targets.length; i++) {
    const targetData = targets[i];
    const targetGeometry = reconstructGeometry(targetData.geometry);
    // 为目标构建 BVH (如果数据量大，这一步也可以在主线程预先构建好并序列化传输，这里为了简化直接构建)
    const targetBVH = new MeshBVH(targetGeometry);
    const targetMatrix = new Matrix4().fromArray(targetData.matrixWorld);

    // 计算变换矩阵：Target -> Plane 本地空间
    _tempMatrix.copy(planeMatrix).invert().multiply(targetMatrix);

    const itemSegments: Vector3[] = [];

    // 用于收集该 Mesh 产生的线条顶点 (扁平化存储: x,y,z, x,y,z...)
    const currentLineVertices: number[] = [];

    // 3. 执行 BVH 相交测试 (bvhcast)
    planeBVH.bvhcast(targetBVH, _tempMatrix, {
      intersectsTriangles(tri1, tri2) {
        // tri1 是 plane 的三角形，tri2 是 target 的三角形（已被变换到 plane 空间）
        if (tri1.intersectsTriangle(tri2, _edge)) {
          const { start, end } = _edge;

          // 保存用于后续多边形计算的点
          itemSegments.push(start.clone(), end.clone());

          // 将截面线转换回世界坐标，以便主线程直接渲染
          // 注意：intersectsTriangle 返回的 edge 在 Plane 的本地空间中
          const worldStart = start.clone().applyMatrix4(planeMatrix);
          const worldEnd = end.clone().applyMatrix4(planeMatrix);

          currentLineVertices.push(
            worldStart.x,
            worldStart.y,
            worldStart.z,
            worldEnd.x,
            worldEnd.y,
            worldEnd.z
          );
        }
        return false;
      },
    });

    if (currentLineVertices.length > 0) {
      resultLinesVertices.push(new Float32Array(currentLineVertices));
    }

    // 4. 计算封口多边形 (Triangulation)
    // 注意：这里的 itemSegments 还是在 Plane 本地空间的，这正是 vector3ToVector2 需要的
    if (itemSegments.length > 0) {
      const vector2List = vector3ToVector2(itemSegments, normal);
      const polygons = getAllPolygons(vector2List, tolerance);

      for (const polygon of polygons) {
        const triangleList = triangulation(polygon);

        // 可能一个物体会被切成多个碎片（例如切断一个甜甜圈），这里会产生多个 mesh
        // 它们都应该指向同一个 sourceIndex (i)
        const currentMeshVertices: number[] = [];

        for (const triangle of triangleList) {
          if (triangle.length > 2) {
            for (const p of triangle) {
              const v3 = new Vector3(p.x, p.y, 0);
              v3.applyMatrix4(planeMatrix); // 转回世界坐标
              currentMeshVertices.push(v3.x, v3.y, v3.z);
            }
          }
        }

        if (currentMeshVertices.length > 0) {
          // 存入结果，并带上源索引 i
          resultMeshesItems.push({
            buffer: new Float32Array(currentMeshVertices),
            sourceIndex: i,
          });
        }
      }
    }
  }

  // 5. 准备返回数据 (Transferable)
  // 收集所有 ArrayBuffer 以便通过零拷贝传输
  const transferables: Transferable[] = [
    ...resultLinesVertices.map((v) => v.buffer),
    ...resultMeshesItems.map((item) => item.buffer.buffer), // 提取 buffer
  ];

  const result: ClipResult = {
    lines: resultLinesVertices,
    meshes: resultMeshesItems,
  };

  const calcEnd = performance.now();

  console.log(`clip worker 计算时间: ${(calcEnd - calcStart).toFixed(2)}`);

  self.postMessage(result, transferables);
};
