import { PivotControls, Wireframe } from "@react-three/drei";
import { useAtomValue, useSetAtom } from "jotai";
import { button, useControls } from "leva";
import { useRef, useState } from "react";
import { DoubleSide, LineBasicMaterial, LineSegments, Mesh } from "three";
import {
  latestClipWastedTimeAtom,
  theLongestEdgeLengthAtom,
} from "../shared-variables";
import { Segments } from "@react-three/drei";
import useClipOptimizedWorker from "../hooks/use-clip-optimized-worker";
import { useThree } from "@react-three/fiber";

const ClipOptimizedViaWebWorker = () => {
  const theLongestEdgeLength = useAtomValue(theLongestEdgeLengthAtom);

  const clipPlaneMeshRef = useRef<Mesh>(null);

  const { scene } = useThree();

  const { clip } = useClipOptimizedWorker(scene);

  const [clipResultLines, setClipResultLines] = useState<LineSegments[]>([]);

  const [clipResultMeshes, setClipResultMeshes] = useState<Mesh[]>([]);

  const setLatestClipWastedTime = useSetAtom(latestClipWastedTimeAtom);

  const handleClip = async () => {
    setLatestClipWastedTime(0);
    if (clipPlaneMeshRef.current) {
      const startTime = performance.now();
      const { lines, meshes } = await clip(
        clipPlaneMeshRef.current,
        (item) => item.userData.canClip
      );
      const endtime = performance.now();
      const time = endtime - startTime;
      setLatestClipWastedTime(time);
      setClipResultLines(lines);
      setClipResultMeshes(meshes);
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
    "05 Optimized method via web worker",
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
          {clipResultLines.map((segment) => {
            segment.renderOrder = 11;
            (segment.material as LineBasicMaterial).depthTest = false;
            return <primitive key={segment.uuid} object={segment} />;
          })}
        </Segments>
      )}

      {showClipResultMeshes && clipResultMeshes.length && (
        <group>
          {clipResultMeshes.map((mesh) => {
            mesh.renderOrder = 10;
            return (
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
            );
          })}
        </group>
      )}
    </>
  );
};

export default ClipOptimizedViaWebWorker;
