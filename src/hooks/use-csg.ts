import { useThree } from "@react-three/fiber";
import { Mesh, Object3D, type Object3DEventMap } from "three";
import { Brush, Evaluator, INTERSECTION } from "three-bvh-csg";
import type { UseThree } from "../shared-variables";

type ClipFilter = (item: Object3D<Object3DEventMap>) => boolean;

const useCSG = () => {
  const { scene }: UseThree = useThree();

  const csg = (planeMesh: Mesh, filter: ClipFilter) => {
    const resultMeshList: Brush[] = [];

    const targets: Mesh[] = [];

    scene.traverse((item) => {
      if (item instanceof Mesh && filter(item)) {
        targets.push(item);
      }
    });

    const evaluator = new Evaluator();

    evaluator.attributes = ["position"];

    const brush1 = new Brush(planeMesh.geometry);

    brush1.applyMatrix4(planeMesh.matrixWorld);

    brush1.updateMatrixWorld();

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const brush2 = new Brush(target.geometry);
      brush2.applyMatrix4(target.matrixWorld);
      brush2.updateMatrixWorld();
      const result = evaluator.evaluate(brush1, brush2, INTERSECTION);
      result.material = target.material;
      resultMeshList.push(result);
    }

    return resultMeshList;
  };

  return { csg };
};

export default useCSG;
