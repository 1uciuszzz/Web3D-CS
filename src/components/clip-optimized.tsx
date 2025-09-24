import { PivotControls, Wireframe } from "@react-three/drei";
import { useAtomValue, useSetAtom } from "jotai";
import { button, useControls } from "leva";
import { useRef, useState } from "react";
import { DoubleSide, LineSegments, Mesh } from "three";
import {
  clipToleranceAtom,
  latestClipWastedTimeAtom,
  theLongestEdgeLengthAtom,
} from "../shared-variables";
import useClipOptimized from "../hooks/use-clip-optimized";
import { Segments } from "@react-three/drei";
import useBvh from "../hooks/use-bvh";

const ClipOptimized = () => {
  const theLongestEdgeLength = useAtomValue(theLongestEdgeLengthAtom);

  const clipPlaneMeshRef = useRef<Mesh>(null);

  const { clip } = useClipOptimized();

  const { buildBvh } = useBvh();

  const [clipResultLines, setClipResultLines] = useState<LineSegments[][]>([]);

  const [clipResultMeshes, setClipResultMeshes] = useState<Mesh[]>([]);

  const setLatestClipWastedTime = useSetAtom(latestClipWastedTimeAtom);

  const clipTolerance = useAtomValue(clipToleranceAtom);

  const handleClip = () => {
    setLatestClipWastedTime(0);
    if (clipPlaneMeshRef.current) {
      const startTime = performance.now();
      buildBvh((item) => item.userData.canClip);
      const { lines, meshList } = clip(
        clipPlaneMeshRef.current,
        (item) => item.userData.canClip,
        clipTolerance
      );
      const endtime = performance.now();
      const time = endtime - startTime;
      setLatestClipWastedTime(time);
      setClipResultLines(lines);
      setClipResultMeshes(meshList);
    }
  };

  const clearClipResult = () => {
    setClipResultLines([]);
    setClipResultMeshes([]);
  };

  const {
    showClipPlane,
    showClipResultLines,
    showClipResultMeshes,
    clipResultMeshesWireframe,
  } = useControls(
    "04 Optimized method",
    {
      showClipPlane: {
        label: "show clip plane",
        value: false,
      },
      cut: button(() => handleClip()),
      showClipResultLines: {
        label: "show clip result lines",
        value: false,
      },
      showClipResultMeshes: {
        label: "show clip result meshes",
        value: true,
      },
      clipResultMeshesWireframe: {
        label: "clip result meshes wireframe",
        value: false,
      },
      "clear clip result": button(() => clearClipResult()),
    },
    [handleClip, clipPlaneMeshRef, clearClipResult]
  );

  return (
    <>
      {showClipPlane && (
        <>
          <PivotControls scale={theLongestEdgeLength / 2}>
            <mesh ref={clipPlaneMeshRef}>
              <planeGeometry
                args={[theLongestEdgeLength, theLongestEdgeLength]}
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
      {showClipResultLines && clipResultLines.length && (
        <Segments>
          {clipResultLines.flat().map((segment) => (
            <primitive key={segment.uuid} object={segment} />
          ))}
        </Segments>
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

export default ClipOptimized;
