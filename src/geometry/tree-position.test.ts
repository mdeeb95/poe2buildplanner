import { describe, expect, it } from "vitest";
import {
  computeNodePosition,
  type TreeConstants,
  type GroupPoint,
} from "./tree-position";

// Real values from data/tree.json constants. orbit 1 has 12 slots; cardinal
// angles (12/3/6/9 o'clock) land at orbitIndex 0, 3, 6, 9.
const FIXTURE: TreeConstants = {
  orbitRadii: [0, 82, 162, 335, 493, 662, 846, 251, 1080, 1322],
  skillsPerOrbit: [1, 12, 24, 24, 72, 72, 72, 24, 72, 144],
  orbitAnglesByOrbit: [
    [0],
    [
      0,
      Math.PI / 6,
      Math.PI / 3,
      Math.PI / 2,
      (2 * Math.PI) / 3,
      (5 * Math.PI) / 6,
      Math.PI,
      (7 * Math.PI) / 6,
      (4 * Math.PI) / 3,
      (3 * Math.PI) / 2,
      (5 * Math.PI) / 3,
      (11 * Math.PI) / 6,
    ],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
  ],
};

const EPS = 1e-9;

function expectClose(actual: number, expected: number, eps = EPS) {
  expect(Math.abs(actual - expected)).toBeLessThan(eps);
}

describe("computeNodePosition (polar → screen)", () => {
  it("places orbit-0 nodes exactly at the group center (centered group)", () => {
    const group: GroupPoint = { x: 0, y: 0 };
    const p = computeNodePosition(group, { orbit: 0, orbitIndex: 0 }, FIXTURE);
    expectClose(p.x, 0);
    expectClose(p.y, 0);
  });

  it("places orbit-0 nodes exactly at the group center (offset group)", () => {
    const group: GroupPoint = { x: 1000, y: 2000 };
    const p = computeNodePosition(group, { orbit: 0, orbitIndex: 0 }, FIXTURE);
    expectClose(p.x, 1000);
    expectClose(p.y, 2000);
  });

  it("places orbitIndex 0 at 12 o'clock (above group, y-flipped)", () => {
    const group: GroupPoint = { x: 0, y: 0 };
    const p = computeNodePosition(group, { orbit: 1, orbitIndex: 0 }, FIXTURE);
    expectClose(p.x, 0);
    expectClose(p.y, -82);
  });

  it("places orbitIndex 3 at 3 o'clock (angle π/2) at +x, y=0", () => {
    const group: GroupPoint = { x: 0, y: 0 };
    const p = computeNodePosition(group, { orbit: 1, orbitIndex: 3 }, FIXTURE);
    expectClose(p.x, 82);
    expectClose(p.y, 0);
  });

  it("places orbitIndex 6 at 6 o'clock (angle π) at 0, +82 (below group)", () => {
    const group: GroupPoint = { x: 0, y: 0 };
    const p = computeNodePosition(group, { orbit: 1, orbitIndex: 6 }, FIXTURE);
    expectClose(p.x, 0);
    expectClose(p.y, 82);
  });

  it("places orbitIndex 9 at 9 o'clock (angle 3π/2) at -82, 0", () => {
    const group: GroupPoint = { x: 0, y: 0 };
    const p = computeNodePosition(group, { orbit: 1, orbitIndex: 9 }, FIXTURE);
    expectClose(p.x, -82);
    expectClose(p.y, 0);
  });

  it("places orbitIndex 1 at 1 o'clock (π/6) correctly", () => {
    const group: GroupPoint = { x: 500, y: -300 };
    const p = computeNodePosition(group, { orbit: 1, orbitIndex: 1 }, FIXTURE);
    expectClose(p.x, 500 + Math.sin(Math.PI / 6) * 82);
    expectClose(p.y, -300 - Math.cos(Math.PI / 6) * 82);
  });

  it("throws on negative orbit", () => {
    expect(() =>
      computeNodePosition({ x: 0, y: 0 }, { orbit: -1, orbitIndex: 0 }, FIXTURE),
    ).toThrow(/orbit -1 out of range/);
  });

  it("throws on out-of-range orbitIndex (12 on a 12-slot orbit)", () => {
    expect(() =>
      computeNodePosition({ x: 0, y: 0 }, { orbit: 1, orbitIndex: 12 }, FIXTURE),
    ).toThrow(/orbitIndex 12 out of range/);
  });

  it("throws on non-integer indices", () => {
    expect(() =>
      computeNodePosition({ x: 0, y: 0 }, { orbit: 1.5, orbitIndex: 0 }, FIXTURE),
    ).toThrow(/orbit 1.5 out of range/);
  });
});
