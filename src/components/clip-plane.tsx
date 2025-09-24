import { useThree } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import { useControls } from "leva";
import { Mesh, Plane, Vector3 } from "three";

const ClipPlane = () => {
  const { showClipPlane, planeNormal, planePosition } = useControls(
    "01 Occlusion method",
    {
      showClipPlane: {
        label: "显示遮挡平面",
        value: false,
      },
      planeNormal: {
        label: "平面法线",
        value: [0, 0, 1],
      },
      planePosition: {
        label: "平面位置",
        value: 0,
        step: 1,
      },
    }
  );

  const { scene } = useThree();

  useQuery({
    queryKey: ["01-clip-plane", showClipPlane, planeNormal, planePosition],
    queryFn: async () => {
      scene.traverse((item) => {
        if (item instanceof Mesh && item.userData.canClip) {
          item.material.clippingPlanes = showClipPlane
            ? [new Plane(new Vector3(...planeNormal), planePosition)]
            : [];
        }
      });
      return true;
    },
  });

  return <></>;
};

export default ClipPlane;
