export interface TreeConstants {
  orbitRadii: readonly number[];
  skillsPerOrbit: readonly number[];
  orbitAnglesByOrbit: readonly (readonly number[])[];
}

export interface GroupPoint {
  readonly x: number;
  readonly y: number;
}

export interface NodePolar {
  readonly orbit: number;
  readonly orbitIndex: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export function computeNodePosition(
  group: GroupPoint,
  node: NodePolar,
  constants: TreeConstants,
): ScreenPoint {
  const { orbit, orbitIndex } = node;

  if (!Number.isInteger(orbit) || orbit < 0 || orbit >= constants.orbitRadii.length) {
    throw new RangeError(
      `orbit ${orbit} out of range [0, ${constants.orbitRadii.length})`,
    );
  }

  const skillsOnOrbit = constants.skillsPerOrbit[orbit]!;
  if (!Number.isInteger(orbitIndex) || orbitIndex < 0 || orbitIndex >= skillsOnOrbit) {
    throw new RangeError(
      `orbitIndex ${orbitIndex} out of range [0, ${skillsOnOrbit}) on orbit ${orbit}`,
    );
  }

  const angle = constants.orbitAnglesByOrbit[orbit]![orbitIndex]!;
  const radius = constants.orbitRadii[orbit]!;

  return {
    x: group.x + Math.sin(angle) * radius,
    y: group.y - Math.cos(angle) * radius,
  };
}
