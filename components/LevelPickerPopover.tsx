"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  clampPassivePoint,
  DEFAULT_LEVEL_MAX,
  LEVEL_MAX,
  LEVEL_MIN,
  normalizeLevelInterval,
  PASSIVE_POINTS_MAX,
} from "@/lib/build/levels";
import type { LevelInterval } from "@/schemas/build";

export interface LevelPickerAnchor {
  clientX: number;
  clientY: number;
}

interface LevelPickerPopoverBase {
  anchor: LevelPickerAnchor;
  onClose: () => void;
}

interface LevelPickerMinMode extends LevelPickerPopoverBase {
  currentLevel: number;
  onApply: (level: number) => void;
  onClear: () => void;
  title?: string;
  currentInterval?: never;
  onApplyInterval?: never;
}

interface LevelPickerIntervalMode extends LevelPickerPopoverBase {
  currentInterval: LevelInterval;
  onApplyInterval: (interval: LevelInterval) => void;
  onClear: () => void;
  title?: string;
  currentLevel?: never;
  onApply?: never;
}

export type LevelPickerPopoverProps = LevelPickerMinMode | LevelPickerIntervalMode;

const PADDING = 8;

export function LevelPickerPopover(props: LevelPickerPopoverProps) {
  const { anchor, onClose } = props;
  const intervalMode = "currentInterval" in props && props.currentInterval != null;

  const [draftMin, setDraftMin] = useState(
    intervalMode ? String(props.currentInterval[0]) : String(props.currentLevel),
  );
  const [draftMax, setDraftMax] = useState(
    intervalMode ? String(props.currentInterval[1]) : String(DEFAULT_LEVEL_MAX),
  );
  const [pos, setPos] = useState({ left: anchor.clientX, top: anchor.clientY });

  const popRef = useRef<HTMLDivElement>(null);
  const minInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (intervalMode) {
      setDraftMin(String(props.currentInterval[0]));
      setDraftMax(String(props.currentInterval[1]));
    } else {
      setDraftMin(String(props.currentLevel));
      setDraftMax(String(DEFAULT_LEVEL_MAX));
    }
  }, [intervalMode, intervalMode ? props.currentInterval : props.currentLevel]);

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
  }, [anchor.clientX, anchor.clientY, intervalMode]);

  useEffect(() => {
    minInputRef.current?.focus();
    minInputRef.current?.select();
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
      const min = parseInt(draftMin, 10);
      if (Number.isNaN(min)) return;
      if (intervalMode) {
        const max = parseInt(draftMax, 10);
        if (Number.isNaN(max)) return;
        props.onApplyInterval(normalizeLevelInterval(min, max));
        return;
      }
      props.onApply(clampPassivePoint(min));
    },
    [draftMin, draftMax, intervalMode, props],
  );

  const title = props.title ?? (intervalMode ? "Active level range" : "Allocate at level");

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
        <div className={`level-picker-row${intervalMode ? " level-picker-row-interval" : ""}`}>
          {intervalMode ? (
            <>
              <span className="level-picker-field-label mono">From</span>
              <input
                ref={minInputRef}
                type="number"
                min={LEVEL_MIN}
                max={LEVEL_MAX}
                value={draftMin}
                onChange={(e) => setDraftMin(e.target.value)}
                className="level-picker-input mono"
                aria-label="From level"
              />
              <span className="level-picker-field-label mono">Until</span>
              <input
                type="number"
                min={LEVEL_MIN}
                max={LEVEL_MAX}
                value={draftMax}
                onChange={(e) => setDraftMax(e.target.value)}
                className="level-picker-input mono"
                aria-label="Until level"
              />
            </>
          ) : (
            <input
              ref={minInputRef}
              type="number"
              min={LEVEL_MIN}
              max={PASSIVE_POINTS_MAX}
              value={draftMin}
              onChange={(e) => setDraftMin(e.target.value)}
              className="level-picker-input mono"
              aria-label={title}
            />
          )}
          <button type="submit" className="level-picker-apply">
            Apply
          </button>
        </div>
        {intervalMode ? (
          <p className="level-picker-hint">
            Until 100 = rest of campaign. Set until level before the next support tier (e.g. 15).
          </p>
        ) : null}
        <div className="level-picker-actions">
          <button type="button" className="level-picker-secondary" onClick={props.onClear}>
            {intervalMode ? "Reset default" : "Clear"}
          </button>
          <button type="button" className="level-picker-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
