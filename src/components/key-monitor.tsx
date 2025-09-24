import { useAtomValue } from "jotai";
import { latestClipWastedTimeAtom } from "../shared-variables";

const KeyMonitor = () => {
  const latestClipWastedTime = useAtomValue(latestClipWastedTimeAtom);

  return (
    <>
      {Boolean(latestClipWastedTime) && (
        <div className="flex items-center">
          <span className="badge font-mono text-xs">
            Current cut execution time：≈{latestClipWastedTime.toFixed(2)}ms
          </span>
        </div>
      )}
    </>
  );
};

export default KeyMonitor;
