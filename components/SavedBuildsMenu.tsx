"use client";

import { useEffect, useRef, useState } from "react";
import type { SavedBuild } from "@/lib/build/storage";

interface SavedBuildsMenuProps {
  savedBuilds: SavedBuild[];
  currentId: string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveAsCopy: () => void;
}

function relativeTime(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function SavedBuildsMenu({
  savedBuilds,
  currentId,
  onLoad,
  onDelete,
  onSaveAsCopy,
}: SavedBuildsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Stable "now" per render pass for relative timestamps; refreshed when opened.
  const now = Date.now();
  const sorted = [...savedBuilds].sort((a, b) => b.savedAt - a.savedAt);

  return (
    <div className="tb-saved" ref={ref}>
      <button
        type="button"
        className="tb-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Open your in-browser saved builds"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M2 2.5 H10 V9.5 H2 Z M2 4.5 H10 M4 2.5 V4.5"
            stroke="currentColor"
            strokeWidth="1.1"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          Saved builds
          {savedBuilds.length > 0 && (
            <span className="tb-saved-count">{savedBuilds.length}</span>
          )}
        </span>
      </button>

      {open && (
        <div className="tb-saved-menu" role="menu">
          {sorted.length === 0 ? (
            <div className="tb-saved-empty">
              No saved builds yet. Click <strong>Save</strong> to store the
              current build in your browser.
            </div>
          ) : (
            <div className="tb-saved-list">
              {sorted.map((b) => (
                <div
                  key={b.id}
                  className="tb-saved-item"
                  data-on={b.id === currentId ? "1" : "0"}
                >
                  <button
                    type="button"
                    className="tb-saved-load"
                    onClick={() => {
                      onLoad(b.id);
                      setOpen(false);
                    }}
                    title="Load this build"
                  >
                    <span className="tb-saved-name">
                      {b.name || "Untitled build"}
                    </span>
                    <span className="tb-saved-meta">
                      {b.id === currentId && (
                        <span className="tb-saved-current">current</span>
                      )}
                      {relativeTime(b.savedAt, now)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="tb-saved-del"
                    onClick={() => {
                      if (window.confirm(`Delete "${b.name || "Untitled build"}"?`)) {
                        onDelete(b.id);
                      }
                    }}
                    title="Delete this saved build"
                    aria-label="Delete saved build"
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                      <path
                        d="M2.5 3 H8.5 M4.5 3 V2 H6.5 V3 M3.3 3 L3.7 9 H7.3 L7.7 3"
                        stroke="currentColor"
                        strokeWidth="1"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="tb-saved-footer">
            <button
              type="button"
              className="tb-saved-copy"
              onClick={() => {
                onSaveAsCopy();
                setOpen(false);
              }}
              title="Save the current build as a new entry"
            >
              + Save as copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
