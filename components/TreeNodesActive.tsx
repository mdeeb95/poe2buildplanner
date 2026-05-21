import { memo, type ReactElement } from "react";
import { WEAPON_SET_STROKE, type WeaponSet } from "@/lib/build/weapon-set";
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
  if (weaponSet === 1) return WEAPON_SET_STROKE[1];
  if (weaponSet === 2) return WEAPON_SET_STROKE[2];
  return "var(--color-node-class-start)";
}

function fillFor(weaponSet: WeaponSet | undefined): string | undefined {
  if (weaponSet === 1) return "rgba(224, 82, 74, 0.22)";
  if (weaponSet === 2) return "rgba(87, 196, 106, 0.22)";
  return undefined;
}

function TreeNodesActiveImpl({ tree, allocated, passiveWeaponSet }: TreeNodesActiveProps) {
  if (allocated.length === 0) return null;
  const rings: ReactElement[] = [];
  for (const id of allocated) {
    const node = tree.nodes[id];
    if (!node || node.group === null) continue;
    const r = radiusFor(node);
    const ws = passiveWeaponSet[id];
    const tint = fillFor(ws);
    if (tint) {
      rings.push(
        <circle
          key={`${id}-tint`}
          cx={node.x}
          cy={node.y}
          r={r + 4}
          fill={tint}
          stroke="none"
        />,
      );
    }
    rings.push(
      <circle
        key={id}
        cx={node.x}
        cy={node.y}
        r={r + 6}
        fill="none"
        stroke={strokeFor(ws)}
        strokeWidth={5}
        strokeOpacity={ws ? 0.65 : 0.45}
        vectorEffect="non-scaling-stroke"
      />,
    );
  }
  return <g pointerEvents="none">{rings}</g>;
}

export const TreeNodesActive = memo(TreeNodesActiveImpl);
