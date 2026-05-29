"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { clampPassivePoint, LEVEL_MIN, PASSIVE_POINTS_MAX } from "@/lib/build/levels";

export interface NodePopoverAnchor {
  clientX: number;
  clientY: number;
}

interface NodePopoverProps {
  anchor: NodePopoverAnchor;
  nodeName: string;
  /** Ascendancy nodes have no level — show the note field only. */
  showLevel: boolean;
  currentLevel: number;
  note: string;
  onApplyLevel: (level: number) => void;
  onClearLevel: () => void;
  onNoteChange: (text: string) => void;
  onClose: () => void;
}

const PADDING = 8;

export function NodePopover({
  anchor,
  nodeName,
  showLevel,
  currentLevel,
  note,
  onApplyLevel,
  onClearLevel,
  onNoteChange,
  onClose,
}: NodePopoverProps) {
  const [draftLevel, setDraftLevel] = useState(String(currentLevel));
  const [pos, setPos] = useState({ left: anchor.clientX, top: anchor.clientY });

  const popRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraftLevel(String(currentLevel));
  }, [currentLevel]);

  useLayoutEffect(() => {
    const el = popRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = anchor.clientX;
    let top = anchor.clientY;
    if (left + rect.width > window.innerWidth - PADDING) {
      left = window.innerWidth - rect.width - PADDING;
    }
    if (top + rect.height > window.innerHeight - PADDING) {
      top = window.innerHeight - rect.height - PADDING;
    }
    left = Math.max(PADDING, left);
    top = Math.max(PADDING, top);
    setPos({ left, top });
  }, [anchor.clientX, anchor.clientY, showLevel]);

  useEffect(() => {
    firstFieldRef.current?.focus();
    if (showLevel) firstFieldRef.current?.select();
  }, [showLevel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: PointerEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [onClose]);

  const submitLevel = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const lvl = parseInt(draftLevel, 10);
      if (Number.isNaN(lvl)) return;
      onApplyLevel(clampPassivePoint(lvl));
    },
    [draftLevel, onApplyLevel],
  );

  return (
    <div
      ref={popRef}
      className="level-picker-popover node-popover"
      style={{ left: pos.left, top: pos.top }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="node-popover-title">{nodeName || "Node"}</div>

      {showLevel ? (
        <form className="level-picker-form" onSubmit={submitLevel}>
          <label className="level-picker-label">Allocate at point</label>
          <div className="level-picker-row">
            <input
              ref={firstFieldRef}
              type="number"
              min={LEVEL_MIN}
              max={PASSIVE_POINTS_MAX}
              value={draftLevel}
              onChange={(e) => setDraftLevel(e.target.value)}
              className="level-picker-input mono"
              aria-label="Allocate at point"
            />
            <button type="submit" className="level-picker-apply">
              Apply
            </button>
            <button type="button" className="level-picker-secondary" onClick={onClearLevel}>
              Clear
            </button>
          </div>
        </form>
      ) : null}

      <label className="level-picker-label node-popover-note-label">Note</label>
      <textarea
        ref={showLevel ? undefined : firstFieldRef}
        className="node-popover-note"
        value={note}
        placeholder="Acquired around… / why this node / leveling order"
        rows={3}
        onChange={(e) => onNoteChange(e.target.value)}
      />

      <div className="level-picker-actions">
        <button type="button" className="level-picker-secondary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
