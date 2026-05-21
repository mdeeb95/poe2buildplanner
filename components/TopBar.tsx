"use client";

import { useEffect, useRef, useState } from "react";
import { buildFromFile, downloadBuildFile } from "@/lib/build/build-file";
import type { BuildState } from "@/schemas/build";
import type { TreeClass } from "@/schemas/tree";

interface TopBarProps {
  build: BuildState;
  setBuild: React.Dispatch<React.SetStateAction<BuildState>>;
  classes: TreeClass[];
}

export function TopBar({ build, setBuild, classes }: TopBarProps) {
  const [ascOpen, setAscOpen] = useState(false);
  const ascRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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
          className="tb-btn tb-btn-primary"
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
      </div>
    </header>
  );
}
