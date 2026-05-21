import { memo, useMemo } from "react";
import type { EdgeRecord } from "@/lib/tree/build-edge-index";

interface TreeEdgesProps {
  edgeIndex: ReadonlyArray<EdgeRecord>;
}

function TreeEdgesImpl({ edgeIndex }: TreeEdgesProps) {
  const d = useMemo(() => edgeIndex.map((e) => e.fragment).join(""), [edgeIndex]);
  return (
    <path
      d={d}
      fill="none"
      stroke="var(--color-edge)"
      strokeWidth={3}
      strokeOpacity={0.42}
      vectorEffect="non-scaling-stroke"
    />
  );
}

export const TreeEdges = memo(TreeEdgesImpl);
