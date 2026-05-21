import { memo, type ReactElement } from "react";
import type { WeaponSet } from "@/lib/build/weapon-set";
import type { Tree, TreeNode } from "@/schemas/tree";

interface TreeNodesActiveProps {
  tree: Tree;
  allocated: ReadonlyArray<string>;
  passiveWeaponSet: Readonly<Record<string, WeaponSet>>;
}

function radiusFor(node: TreeNode): number {
  if (node.classesStart && node.classesStart.length > 0) return 50;
  if (node.isKeystone) return 40;
  if (node.isJewelSocket) return 32;
  if (node.isNotable) return 26;
  return 14;
}

function strokeFor(weaponSet: WeaponSet | undefined): string {
  if (weaponSet === 1) return "var(--color-weapon-set-1)";
  if (weaponSet === 2) return "var(--color-weapon-set-2)";
  return "var(--color-node-class-start)";
}

function TreeNodesActiveImpl({ tree, allocated, passiveWeaponSet }: TreeNodesActiveProps) {
  if (allocated.length === 0) return null;
  const rings: ReactElement[] = [];
  for (const id of allocated) {
    const node = tree.nodes[id];
    if (!node || node.group === null) continue;
    const r = radiusFor(node);
    rings.push(
      <circle
        key={id}
        cx={node.x}
        cy={node.y}
        r={r + 6}
        fill="none"
        stroke={strokeFor(passiveWeaponSet[id])}
        strokeWidth={5}
        strokeOpacity={0.95}
        vectorEffect="non-scaling-stroke"
      />,
    );
  }
  return <g pointerEvents="none">{rings}</g>;
}

export const TreeNodesActive = memo(TreeNodesActiveImpl);
