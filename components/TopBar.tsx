"use client";

import { useEffect, useRef, useState } from "react";
import { SavedBuildsMenu } from "@/components/SavedBuildsMenu";
import { buildFromFile, downloadBuildFile } from "@/lib/build/build-file";
import { LEVEL_MIN, PASSIVE_POINTS_MAX } from "@/lib/build/levels";
import type { SavedBuild } from "@/lib/build/storage";
import type { BuildState } from "@/schemas/build";
import type { TreeClass } from "@/schemas/tree";

interface TopBarProps {
  build: BuildState;
  setBuild: React.Dispatch<React.SetStateAction<BuildState>>;
  classes: TreeClass[];
  viewerLevel: number;
  setViewerLevel: React.Dispatch<React.SetStateAction<number>>;
  savedBuilds: SavedBuild[];
  currentId: string | null;
  onSave: () => void;
  onSaveAsCopy: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
}

export function TopBar({
  build,
  setBuild,
  classes,
  viewerLevel,
  setViewerLevel,
  savedBuilds,
  currentId,
  onSave,
  onSaveAsCopy,
  onLoad,
  onDelete,
  onReset,
}: TopBarProps) {
  const [ascOpen, setAscOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const ascRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      // Keep this updater pure — stopping at the top is handled by the effect
      // below. (Calling setPlaying here runs during render and warns.)
      setViewerLevel((lv) => (lv >= PASSIVE_POINTS_MAX ? PASSIVE_POINTS_MAX : lv + 1));
    }, 50);
    return () => clearInterval(id);
  }, [playing, setViewerLevel]);

  // End playback once the run reaches the top.
  useEffect(() => {
    if (playing && viewerLevel >= PASSIVE_POINTS_MAX) setPlaying(false);
  }, [playing, viewerLevel]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    // Restart from the beginning once the run has reached the top.
    setViewerLevel((lv) => (lv >= PASSIVE_POINTS_MAX ? LEVEL_MIN : lv));
    setPlaying(true);
  };

  useEffect(() => {
    if (!ascOpen) return;
    const onDown = (e: MouseEvent) => {
      if (ascRef.current && !ascRef.current.contains(e.target as Node)) {
        setAscOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [ascOpen]);

  const passiveCount = build.allocated.length;
  const skillCount = build.skills.length;
  const itemCount = build.items.length;
  const snapshot = viewerLevel < PASSIVE_POINTS_MAX;

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const data: unknown = JSON.parse(text);
      setBuild(buildFromFile(data, classes));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not read .build file";
      window.alert(msg);
    }
  };

  return (
    <header className="topbar">
      <div className="tb-mark" title="Build editor">
        <svg viewBox="0 0 22 22" width="20" height="20" aria-hidden>
          <path
            d="M11 1 L20 6 V16 L11 21 L2 16 V6 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M11 6 V16 M6.5 8.5 L15.5 13.5 M15.5 8.5 L6.5 13.5"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.55"
          />
        </svg>
      </div>

      <div className="tb-meta">
        <div className="tb-meta-row">
          <input
            className="tb-name"
            value={build.name}
            placeholder="Untitled build"
            onChange={(e) => setBuild((prev) => ({ ...prev, name: e.target.value }))}
            spellCheck={false}
          />
          <div className="tb-asc" ref={ascRef}>
            <button
              type="button"
              className="tb-asc-btn"
              onClick={() => setAscOpen((v) => !v)}
              aria-expanded={ascOpen}
              aria-haspopup="menu"
            >
              <span className="tb-asc-class">{build.className || "Class"}</span>
              <span className="tb-asc-dot">·</span>
              <span className="tb-asc-name">
                {build.ascendancy || "Choose ascendancy"}
              </span>
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                <path
                  d="M2 4 L5 7 L8 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            {ascOpen && (
              <div className="tb-asc-menu" role="menu">
                {classes.map((cls) => (
                  <div key={cls.name} className="tb-asc-group">
                    <div className="tb-asc-group-h">{cls.name}</div>
                    {cls.ascendancies.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="tb-asc-item"
                        data-on={build.ascendancy === a.name ? "1" : "0"}
                        onClick={() => {
                          setBuild((prev) => ({
                            ...prev,
                            className: cls.name,
                            ascendancy: a.name,
                          }));
                          setAscOpen(false);
                        }}
                      >
                        <span>{a.name}</span>
                        {build.ascendancy === a.name && (
                          <span className="tb-asc-tick">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <input
          className="tb-desc"
          value={build.description}
          placeholder="One line of context — what this build does and when it comes online."
          onChange={(e) =>
            setBuild((prev) => ({ ...prev, description: e.target.value }))
          }
          spellCheck={false}
        />
      </div>

      <div className="tb-stats">
        <div className="tb-stat">
          <span className="tb-stat-n">{passiveCount}</span>
          <span className="tb-stat-l">passives</span>
        </div>
        <div className="tb-stat">
          <span className="tb-stat-n">{skillCount}</span>
          <span className="tb-stat-l">skills</span>
        </div>
        <div className="tb-stat">
          <span className="tb-stat-n">{itemCount}</span>
          <span className="tb-stat-l">items</span>
        </div>
      </div>

      <div className={`level-slider${snapshot ? " is-snapshot" : ""}`}>
        <button
          type="button"
          className="level-slider-play"
          onClick={togglePlay}
          aria-label={playing ? "Pause level playback" : "Play through levels"}
          title={playing ? "Pause" : "Watch the build come online level by level"}
        >
          {playing ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <rect x="2" y="1.5" width="2.2" height="7" rx="0.4" fill="currentColor" />
              <rect x="5.8" y="1.5" width="2.2" height="7" rx="0.4" fill="currentColor" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <path d="M2.5 1.5 L8.5 5 L2.5 8.5 Z" fill="currentColor" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="level-slider-label"
          onClick={() => setViewerLevel(PASSIVE_POINTS_MAX)}
          title={snapshot ? "Reset to show the whole build" : "Drag the slider to preview the build at an earlier level"}
        >
          {snapshot ? (
            <>
              Snapshot · <span className="level-slider-n mono">Lv {viewerLevel}</span>
            </>
          ) : (
            <>
              <span className="level-slider-n mono">Lv {PASSIVE_POINTS_MAX}</span> · all
            </>
          )}
        </button>
        <input
          type="range"
          className="level-slider-range"
          min={LEVEL_MIN}
          max={PASSIVE_POINTS_MAX}
          step={1}
          value={viewerLevel}
          onChange={(e) => {
            setPlaying(false);
            setViewerLevel(Number(e.target.value));
          }}
          aria-label="Snapshot level"
          title="Snapshot level"
        />
      </div>

      <div className="tb-actions">
        <input
          ref={importInputRef}
          type="file"
          accept=".build,application/json"
          className="tb-file-input"
          aria-hidden
          tabIndex={-1}
          onChange={onImportFile}
        />
        <SavedBuildsMenu
          savedBuilds={savedBuilds}
          currentId={currentId}
          onLoad={onLoad}
          onDelete={onDelete}
          onSaveAsCopy={onSaveAsCopy}
        />
        <button
          type="button"
          className="tb-btn"
          onClick={onReset}
          title="Clear the current build and start fresh"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path
              d="M9.5 3.5 A4 4 0 1 0 10 6 M9.5 1.5 V3.5 H7.5"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Reset</span>
        </button>
        <button
          type="button"
          className="tb-btn"
          onClick={() => importInputRef.current?.click()}
          title="Load a .build file from disk"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path
              d="M6 10 V3 M3 6 L6 3 L9 6 M2 2 H10"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            Import <span className="tb-btn-ext">.build</span>
          </span>
        </button>
        <button
          type="button"
          className="tb-btn"
          onClick={() => void downloadBuildFile(build)}
          title="Download this build as a .build file"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path
              d="M6 1 V8 M3 5 L6 8 L9 5 M2 10 H10"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            Export <span className="tb-btn-ext">.build</span>
          </span>
        </button>
        <button
          type="button"
          className="tb-btn tb-btn-primary"
          onClick={onSave}
          title={
            currentId
              ? "Save changes to the current build in your browser"
              : "Save this build in your browser"
          }
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path
              d="M2.5 2 H8 L10 4 V10 H2 Z M4 2 V4.5 H7.5 V2 M4 10 V7 H8 V10"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Save</span>
        </button>
      </div>
    </header>
  );
}
