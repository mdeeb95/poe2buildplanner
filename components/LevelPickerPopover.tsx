"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { clampLevel, LEVEL_MAX, LEVEL_MIN } from "@/lib/build/levels";

export interface LevelPickerAnchor {
  clientX: number;
  clientY: number;
}

interface LevelPickerPopoverProps {
  anchor: LevelPickerAnchor;
  currentLevel: number;
  title?: string;
  onApply: (level: number) => void;
  onClear: () => void;
  onClose: () => void;
}

const PADDING = 8;

export function LevelPickerPopover({
  anchor,
  currentLevel,
  title = "Allocate at level",
  onApply,
  onClear,
  onClose,
}: LevelPickerPopoverProps) {
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(String(currentLevel));
  const [pos, setPos] = useState({ left: anchor.clientX, top: anchor.clientY });

  useEffect(() => {
    setDraft(String(currentLevel));
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
  }, [anchor.clientX, anchor.clientY]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: PointerEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [onClose]);

  const submit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const parsed = parseInt(draft, 10);
      if (Number.isNaN(parsed)) return;
      onApply(clampLevel(parsed));
    },
    [draft, onApply],
  );

  return (
    <div
      ref={popRef}
      className="level-picker-popover"
      style={{ left: pos.left, top: pos.top }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <form className="level-picker-form" onSubmit={submit}>
        <label className="level-picker-label">{title}</label>
        <div className="level-picker-row">
          <input
            ref={inputRef}
            type="number"
            min={LEVEL_MIN}
            max={LEVEL_MAX}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="level-picker-input mono"
            aria-label={title}
          />
          <button type="submit" className="level-picker-apply">
            Apply
          </button>
        </div>
        <div className="level-picker-actions">
          <button type="button" className="level-picker-secondary" onClick={onClear}>
            Clear
          </button>
          <button type="button" className="level-picker-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
