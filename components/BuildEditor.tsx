"use client";

import { useEffect, useState } from "react";
import { PassiveTree } from "@/components/PassiveTree";
import { GearPanel } from "@/components/GearPanel";
import { HResizer, VResizer } from "@/components/Resizer";
import { SkillsPanel } from "@/components/SkillsPanel";
import { TopBar } from "@/components/TopBar";
import { createEmptyBuild } from "@/lib/build/defaults";
import { useBuildHistory } from "@/hooks/useBuildHistory";
import type { TreeBounds, TreeClass, TreeConstants } from "@/schemas/tree";

const SIDE_W_KEY = "buildEditor.sideW";
const GEAR_H_KEY = "buildEditor.gearH";
const DEFAULT_SIDE_W = 460;
const DEFAULT_GEAR_H = 500;

function readStoredInt(key: string, min: number, max: number, fallback: number): number {
  try {
    const v = parseInt(localStorage.getItem(key) ?? "", 10);
    if (v >= min && v <= max) return v;
  } catch {
    /* noop */
  }
  return fallback;
}

interface BuildEditorProps {
  seed: {
    version: { pobCommit: string; treeVersion: string; fetchedAt: string };
    bounds: TreeBounds;
    constants: TreeConstants;
  };
  classes: TreeClass[];
}

export function BuildEditor({ seed, classes }: BuildEditorProps) {
  const { build, setBuild } = useBuildHistory(createEmptyBuild());
  const [sideW, setSideW] = useState(DEFAULT_SIDE_W);
  const [gearH, setGearH] = useState(DEFAULT_GEAR_H);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSideW(readStoredInt(SIDE_W_KEY, 360, 800, DEFAULT_SIDE_W));
    setGearH(readStoredInt(GEAR_H_KEY, 320, 800, DEFAULT_GEAR_H));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SIDE_W_KEY, String(sideW));
    } catch {
      /* noop */
    }
  }, [sideW, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(GEAR_H_KEY, String(gearH));
    } catch {
      /* noop */
    }
  }, [gearH, hydrated]);

  return (
    <div
      className="app density-tight no-header-gradients"
      style={{ "--side-w": `${sideW}px` } as React.CSSProperties}
    >
      <TopBar build={build} setBuild={setBuild} classes={classes} />

      <main className="workspace">
        <section className="tree-section">
          <PassiveTree seed={seed} build={build} setBuild={setBuild} />
        </section>

        <aside className="side">
          <VResizer width={sideW} setWidth={setSideW} />
          <GearPanel build={build} setBuild={setBuild} gearH={gearH} />
          <HResizer height={gearH} setHeight={setGearH} />
          <SkillsPanel build={build} setBuild={setBuild} />
        </aside>
      </main>
    </div>
  );
}
