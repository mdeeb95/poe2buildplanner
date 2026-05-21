import { memo, useMemo } from "react";
import type { EdgeRecord } from "@/lib/tree/build-edge-index";

interface TreeEdgesPreviewProps {
  edgeIndex: ReadonlyArray<EdgeRecord>;
  /** Canonical "a|b" (a < b) keys of the route edges to highlight. */
  previewEdgeKeys: ReadonlySet<string>;
}

function TreeEdgesPreviewImpl({ edgeIndex, previewEdgeKeys }: TreeEdgesPreviewProps) {
  const d = useMemo(() => {
    if (previewEdgeKeys.size === 0) return "";
    const parts: string[] = [];
    for (const e of edgeIndex) {
      const key = e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`;
      if (previewEdgeKeys.has(key)) parts.push(e.fragment);
    }
    return parts.join("");
  }, [edgeIndex, previewEdgeKeys]);

  if (d === "") return null;

  return (
    <path
      d={d}
      fill="none"
      stroke="var(--color-preview)"
      strokeWidth={4}
      strokeOpacity={0.9}
      strokeDasharray="10 6"
      vectorEffect="non-scaling-stroke"
    />
  );
}

export const TreeEdgesPreview = memo(TreeEdgesPreviewImpl);
