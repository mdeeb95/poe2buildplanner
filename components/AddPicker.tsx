"use client";

import { useEffect, useRef } from "react";
import { GemIcon } from "@/components/GemIcon";
import type { GemPickerRow } from "@/lib/build/gem-ui";

interface AddPickerProps {
  query: string;
  setQuery: (q: string) => void;
  results: GemPickerRow[];
  onPick: (item: GemPickerRow) => void;
  onClose: () => void;
  placeholder: string;
  highlightIds?: Set<string>;
}

export function AddPicker({
  query,
  setQuery,
  results,
  onPick,
  onClose,
  placeholder,
  highlightIds,
}: AddPickerProps) {
  const inpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inpRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="add-picker" onClick={(e) => e.stopPropagation()}>
      <div className="add-picker-search">
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
          <circle cx="4.5" cy="4.5" r="3" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M7 7 L10 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
        <input
          ref={inpRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results.length > 0) {
              e.preventDefault();
              onPick(results[0]!);
            }
          }}
          placeholder={placeholder}
        />
        <button type="button" className="add-picker-x" onClick={onClose} title="Cancel (Esc)">
          esc
        </button>
      </div>
      <div className="add-picker-results">
        {results.length === 0 ? (
          <div className="add-picker-empty">
            No matches. The gem catalog ships with the build editor.
          </div>
        ) : (
          results.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`add-picker-item${highlightIds?.has(r.id) ? " is-upgrade" : ""}`}
              onClick={() => onPick(r)}
            >
              <GemIcon color={r.color} size={20} kind={r.kind} />
              <span className="add-picker-name">{r.name}</span>
              <span className="add-picker-desc">
                {highlightIds?.has(r.id) ? "Upgrade · " : ""}
                {r.desc}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
