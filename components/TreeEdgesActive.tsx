import { memo, useMemo } from "react";
import {
  allocatedEdgeRole,
  WEAPON_SET_STROKE,
  type WeaponSet,
} from "@/lib/build/weapon-set";
import type { EdgeRecord } from "@/lib/tree/build-edge-index";

interface TreeEdgesActiveProps {
  edgeIndex: ReadonlyArray<EdgeRecord>;
  allocatedIds: ReadonlySet<string>;
  passiveWeaponSet: Readonly<Record<string, WeaponSet>>;
}

function TreeEdgesActiveImpl({
  edgeIndex,
  allocatedIds,
  passiveWeaponSet,
}: TreeEdgesActiveProps) {
  const paths = useMemo(() => {
    const global: string[] = [];
    const set1: string[] = [];
    const set2: string[] = [];

    if (allocatedIds.size === 0) {
      return { global: "", set1: "", set2: "" };
    }

    for (const e of edgeIndex) {
      const role = allocatedEdgeRole(e.a, e.b, allocatedIds, passiveWeaponSet);
      if (role === "global") global.push(e.fragment);
      else if (role === 1) set1.push(e.fragment);
      else if (role === 2) set2.push(e.fragment);
    }

    return {
      global: global.join(""),
      set1: set1.join(""),
      set2: set2.join(""),
    };
  }, [edgeIndex, allocatedIds, passiveWeaponSet]);

  if (!paths.global && !paths.set1 && !paths.set2) return null;

  return (
    <g className="tree-edges-active">
      {paths.global && (
        <path
          d={paths.global}
          fill="none"
          stroke="var(--color-node-class-start)"
          strokeWidth={5}
          strokeOpacity={0.85}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {paths.set1 && (
        <path
          d={paths.set1}
          fill="none"
          stroke={WEAPON_SET_STROKE[1]}
          strokeWidth={5}
          strokeOpacity={0.92}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {paths.set2 && (
        <path
          d={paths.set2}
          fill="none"
          stroke={WEAPON_SET_STROKE[2]}
          strokeWidth={5}
          strokeOpacity={0.92}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}

export const TreeEdgesActive = memo(TreeEdgesActiveImpl);
