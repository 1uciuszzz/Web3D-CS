import {
  Vector3,
  Mesh,
  LineBasicMaterial,
  LineSegments,
  Object3D,
  type Object3DEventMap,
  BufferGeometry,
  BufferAttribute,
  DoubleSide,
  Material,
} from "three";
import { useThree } from "@react-three/fiber";
import type { UseThree } from "../shared-variables";
import ClipWorker from "../workers/clip-optimized.worker?worker";
import { useEffect, useRef } from "react";
import type {
  ClipInput,
  ClipResult,
  MeshData,
} from "../workers/clip-optimized-worker.type";

type ClipFilter = (item: Object3D<Object3DEventMap>) => boolean;

const useClipOptimized = () => {
  const { scene }: UseThree = useThree();

  const workerRef = useRef<Worker | null>(null);

  // 初始化 Worker
  useEffect(() => {
    workerRef.current = new ClipWorker();
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // 辅助：提取 Mesh 数据用于传输
  const extractMeshData = (mesh: Mesh): MeshData => {
    const geometry = mesh.geometry;
    const position = geometry.attributes.position.array;
    const index = geometry.index ? geometry.index.array : null;

    // 必须复制数据，因为如果直接传 buffer 且使用 transfer，主线程的 geometry 会失效
    // 如果追求极致性能且 geometry 不再变化，可以使用 slice 或 SharedArrayBuffer
    return {
      geometry: {
        position: new Float32Array(position),
        index: index
          ? index instanceof Uint16Array
            ? new Uint16Array(index)
            : new Uint32Array(index)
          : null,
      },
      matrixWorld: mesh.matrixWorld.toArray(),
    };
  };

  const clip = (
    planeMesh: Mesh,
    filter: ClipFilter,
    tolerance: number = 0.000001
  ) => {
    if (!workerRef.current) return { lines: [], meshList: [] };

    return new Promise<{ lines: LineSegments[][]; meshList: Mesh[] }>(
      (resolve) => {
        // 1. 准备 Plane 数据
        const normal = new Vector3();
        planeMesh.getWorldDirection(normal);
        const planeData = extractMeshData(planeMesh);

        // 2. 筛选并准备 Target Meshes 数据
        const targetsData: MeshData[] = [];
        const sourceMaterials: (Material | Material[])[] = [];

        scene.traverse((item) => {
          if (item instanceof Mesh && filter(item)) {
            targetsData.push(extractMeshData(item));
            // 保存材质引用，以便生成的新 Mesh 复用原来的材质
            sourceMaterials.push(item.material);
          }
        });

        // 3. 发送消息给 Worker
        const input: ClipInput = {
          plane: planeData,
          targets: targetsData,
          tolerance,
          planeNormal: normal.toArray(),
        };

        // 定义一次性事件监听器处理结果
        const handleMessage = (e: MessageEvent<ClipResult>) => {
          const { lines: linesRaw, meshes: meshesRaw } = e.data;

          const resultLines: LineSegments[][] = [];
          const resultMeshes: Mesh[] = [];
          const resultLineMat = new LineBasicMaterial({ color: 0xffff00 });

          // 4. 重建 LineSegments
          // 这里的 linesRaw 是一个 Float32Array 数组，每个数组代表一个 Mesh 产生的截面线集合
          if (linesRaw.length > 0) {
            const itemLines: LineSegments[] = [];
            linesRaw.forEach((lineBuffer) => {
              const g = new BufferGeometry();
              g.setAttribute("position", new BufferAttribute(lineBuffer, 3));
              const line = new LineSegments(g, resultLineMat);
              // 已经在 Worker 中转为 World Space，这里无需再应用矩阵
              itemLines.push(line);
            });
            resultLines.push(itemLines);
          }

          // 5. 重建 Meshes (Triangulation 结果)
          meshesRaw.forEach((item) => {
            const g = new BufferGeometry();
            g.setAttribute("position", new BufferAttribute(item.buffer, 3));
            g.computeVertexNormals(); // 重新计算法线
            g.computeBoundingBox();

            // 1. 获取对应的原始材质
            const originalMaterial = sourceMaterials[item.sourceIndex];

            let finalMaterial: Material;

            // 2. 克隆材质以避免副作用 (可选，根据需求)
            // 如果是多材质数组，通常截面生成的新几何体只有一个 group，无法直接应用多材质数组。
            // 这里的策略是：如果是数组，取第一个；如果是单个，直接 clone。
            if (Array.isArray(originalMaterial)) {
              finalMaterial = originalMaterial[0].clone();
            } else {
              finalMaterial = originalMaterial.clone();
            }

            // 3. 确保双面渲染 (因为切面可能包含物体内部)
            finalMaterial.side = DoubleSide;

            const mesh = new Mesh(g, finalMaterial);
            mesh.userData.isClipResult = true;
            mesh.renderOrder = 20;
            resultMeshes.push(mesh);
          });

          // 清理监听器
          workerRef.current?.removeEventListener("message", handleMessage);

          resolve({ lines: resultLines, meshList: resultMeshes });
        };

        workerRef.current!.addEventListener("message", handleMessage);

        // 发送数据 (这里使用了结构化克隆，对于大型 Geometry 数据，建议使用 transfer 列表优化)
        // 注意：为了使用 Transferable，需要把 input 中的 TypedArray 的 buffer 提取出来
        const transferList: Transferable[] = [
          planeData.geometry.position.buffer,
          ...(planeData.geometry.index
            ? [planeData.geometry.index.buffer]
            : []),
          ...targetsData.flatMap((t) => [
            t.geometry.position.buffer,
            ...(t.geometry.index ? [t.geometry.index.buffer] : []),
          ]),
        ];

        workerRef.current!.postMessage(input, transferList);
      }
    );
  };

  return { clip };
};

export default useClipOptimized;
