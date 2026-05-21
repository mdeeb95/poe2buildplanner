import { memo, useMemo } from "react";
import type { EdgeRecord } from "@/lib/tree/build-edge-index";

interface TreeEdgesActiveProps {
  edgeIndex: ReadonlyArray<EdgeRecord>;
  allocatedIds: ReadonlySet<string>;
}

function TreeEdgesActiveImpl({ edgeIndex, allocatedIds }: TreeEdgesActiveProps) {
  const d = useMemo(() => {
    if (allocatedIds.size === 0) return "";
    const parts: string[] = [];
    for (const e of edgeIndex) {
      if (allocatedIds.has(e.a) && allocatedIds.has(e.b)) {
        parts.push(e.fragment);
      }
    }
    return parts.join("");
  }, [edgeIndex, allocatedIds]);

  if (d === "") return null;

  return (
    <path
      d={d}
      fill="none"
      stroke="var(--color-node-class-start)"
      strokeWidth={5}
      strokeOpacity={0.95}
      vectorEffect="non-scaling-stroke"
    />
  );
}

export const TreeEdgesActive = memo(TreeEdgesActiveImpl);
