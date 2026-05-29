"use client";

import { useCallback, useEffect, useState } from "react";
import { PassiveTree } from "@/components/PassiveTree";
import { GearPanel } from "@/components/GearPanel";
import { HResizer, VResizer } from "@/components/Resizer";
import { SkillsPanel } from "@/components/SkillsPanel";
import { SiteFooter } from "@/components/SiteFooter";
import { TopBar } from "@/components/TopBar";
import { createEmptyBuild } from "@/lib/build/defaults";
import { PASSIVE_POINTS_MAX } from "@/lib/build/levels";
import { clearDraft, loadDraft, saveDraft } from "@/lib/build/storage";
import { fetchAppJson } from "@/lib/data/fetch-app-json";
import { grantedSkillIndex, type GrantedSkillIndex } from "@/lib/build/granted-skills";
import { useBuildHistory } from "@/hooks/useBuildHistory";
import { useSavedBuilds } from "@/hooks/useSavedBuilds";
import { GrantedSkillsFileSchema } from "@/schemas/granted-skills";
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
  const { build, setBuild, replace } = useBuildHistory(createEmptyBuild());
  const {
    savedBuilds,
    currentId,
    setCurrentId,
    saveCurrent,
    saveAsCopy,
    remove,
    getBuild,
  } = useSavedBuilds();
  const [sideW, setSideW] = useState(DEFAULT_SIDE_W);
  const [gearH, setGearH] = useState(DEFAULT_GEAR_H);
  const [hydrated, setHydrated] = useState(false);
  // Skills granted by allocated tree nodes (e.g. ascendancy notables), resolved
  // server-side. Keyed by granting node id; drives auto-managed Skills rows.
  const [grantedIndex, setGrantedIndex] = useState<GrantedSkillIndex | null>(null);
  // Snapshot viewer level: ephemeral view-only state (not part of the build,
  // not persisted, not exported). Counts passive points spent; the max shows
  // the whole build.
  const [viewerLevel, setViewerLevel] = useState(PASSIVE_POINTS_MAX);

  useEffect(() => {
    setSideW(readStoredInt(SIDE_W_KEY, 360, 800, DEFAULT_SIDE_W));
    setGearH(readStoredInt(GEAR_H_KEY, 320, 800, DEFAULT_GEAR_H));
    // Restore the autosaved working build so a refresh doesn't lose it.
    const draft = loadDraft();
    if (draft) replace(draft);
    setHydrated(true);
  }, [replace]);

  // Load the granted-skills index once (small, ETag-revalidated).
  useEffect(() => {
    let aborted = false;
    fetchAppJson("/granted-skills")
      .then((data) => {
        const parsed = GrantedSkillsFileSchema.safeParse(data);
        if (!aborted && parsed.success) setGrantedIndex(grantedSkillIndex(parsed.data.skills));
      })
      .catch(() => {
        /* granted skills optional */
      });
    return () => {
      aborted = true;
    };
  }, []);

  // Autosave the working build (debounced) so it survives a refresh.
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => saveDraft(build), 400);
    return () => clearTimeout(t);
  }, [build, hydrated]);

  const onLoad = useCallback(
    (id: string) => {
      const next = getBuild(id);
      if (!next) return;
      replace(next);
      setCurrentId(id);
    },
    [getBuild, replace, setCurrentId],
  );

  const onReset = useCallback(() => {
    const hasContent =
      build.allocated.length > 0 ||
      build.skills.length > 0 ||
      build.items.length > 0;
    if (hasContent && !window.confirm("Clear the current build and start fresh?")) {
      return;
    }
    replace(createEmptyBuild());
    setCurrentId(null);
    clearDraft();
  }, [build, replace, setCurrentId]);

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
      <TopBar
        build={build}
        setBuild={setBuild}
        classes={classes}
        viewerLevel={viewerLevel}
        setViewerLevel={setViewerLevel}
        savedBuilds={savedBuilds}
        currentId={currentId}
        onSave={() => saveCurrent(build)}
        onSaveAsCopy={() => saveAsCopy(build)}
        onLoad={onLoad}
        onDelete={remove}
        onReset={onReset}
      />

      <main className="workspace">
        <section className="tree-section">
          <PassiveTree
            seed={seed}
            build={build}
            setBuild={setBuild}
            viewerLevel={viewerLevel}
            grantedIndex={grantedIndex}
          />
        </section>

        <aside className="side">
          <VResizer width={sideW} setWidth={setSideW} />
          <GearPanel build={build} setBuild={setBuild} gearH={gearH} />
          <HResizer height={gearH} setHeight={setGearH} />
          <SkillsPanel
            build={build}
            setBuild={setBuild}
            viewerLevel={viewerLevel}
            grantedIndex={grantedIndex}
          />
        </aside>
      </main>

      <SiteFooter />
    </div>
  );
}
