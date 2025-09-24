import { useAtomValue, useSetAtom } from "jotai";
import { button, useControls } from "leva";
import {
  latestClipWastedTimeAtom,
  theLongestEdgeLengthAtom,
} from "../shared-variables";
import { useRef, useState } from "react";
import useCSG from "../hooks/use-csg";
import useBvh from "../hooks/use-bvh";
import { DoubleSide, type Mesh } from "three";
import { PivotControls, Wireframe } from "@react-three/drei";

const Csg = () => {
  const theLongestEdgeLength = useAtomValue(theLongestEdgeLengthAtom);

  const clipPlaneMeshRef = useRef<Mesh>(null);

  const { csg } = useCSG();

  const { buildBvh } = useBvh();

  const [clipResultMeshes, setClipResultMeshes] = useState<Mesh[]>([]);

  const setLatestClipWastedTime = useSetAtom(latestClipWastedTimeAtom);

  const handleClip = () => {
    setLatestClipWastedTime(0);
    if (clipPlaneMeshRef.current) {
      const startTime = performance.now();
      buildBvh((item) => item.userData.canClip);
      const meshList = csg(
        clipPlaneMeshRef.current,
        (item) => item.userData.canClip
      );
      console.log(meshList);

      const endtime = performance.now();
      const time = endtime - startTime;
      setLatestClipWastedTime(time);
      setClipResultMeshes(meshList);
    }
  };

  const clearClipResult = () => {
    setClipResultMeshes([]);
  };

  const { showClipPlane, showClipResultMeshes, clipResultMeshesWireframe } =
    useControls(
      "02 CSG method",
      {
        showClipPlane: {
          label: "显示剪裁平面",
          value: false,
        },
        剪裁: button(() => handleClip()),

        showClipResultMeshes: {
          label: "显示剪裁结果",
          value: true,
        },
        clipResultMeshesWireframe: {
          label: "剪裁结果线框显示",
          value: false,
        },
        清除剪裁结果: button(() => clearClipResult()),
      },
      [handleClip, clipPlaneMeshRef, clearClipResult]
    );

  return (
    <>
      {showClipPlane && (
        <>
          <PivotControls scale={theLongestEdgeLength / 2}>
            <mesh ref={clipPlaneMeshRef}>
              <boxGeometry
                args={[theLongestEdgeLength, theLongestEdgeLength, 0.1]}
              />
              <meshStandardMaterial
                color={0xff0000}
                side={DoubleSide}
                flatShading
                roughness={0.98}
                transparent
                opacity={0.5}
              />
            </mesh>
          </PivotControls>
        </>
      )}

      {showClipResultMeshes && clipResultMeshes.length && (
        <group>
          {clipResultMeshes.map((mesh) => (
            <mesh
              key={mesh.uuid}
              geometry={mesh.geometry}
              material={mesh.material}
              rotation={mesh.rotation}
              position={mesh.position}
              scale={mesh.scale}
            >
              {clipResultMeshesWireframe && <Wireframe />}
            </mesh>
          ))}
        </group>
      )}
    </>
  );
};

export default Csg;
