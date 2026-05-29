"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { GemIcon } from "@/components/GemIcon";
import type { GemPickerKind, GemUiColor } from "@/lib/build/gem-ui";

export interface GemTooltipData {
  name: string;
  color: GemUiColor;
  kind: GemPickerKind;
  /** Subtitle under the name: "Support" for supports, gem type (e.g. "Spell") for skills. */
  subtitle: string | null;
  /** Comma-separated gem tags, e.g. "Projectile, Lightning, Duration". */
  tagLine: string | null;
  /** Support gem family / category, e.g. "Retreat". */
  category: string | null;
  /** Uncut gem tier. */
  tier: number | null;
  /** Cost multiplier as a percentage (e.g. 120). */
  costMultiplier: number | null;
  /** Attribute requirement line, e.g. "+5 Dex". */
  requirements: string | null;
  /** Italic effect summary. */
  description: string | null;
  /** Rendered in-game stat lines. `null` = still loading; `[]` = none. */
  statLines: string[] | null;
  /** Bounding rect of the hovered row, used to anchor the tooltip. */
  anchor: { left: number; right: number; top: number; bottom: number };
}

const GAP = 12;
const MARGIN = 8;

const FOOTER: Partial<Record<GemPickerKind, string>> = {
  support:
    "Place into a Skill's Support Gem socket in the Skills Panel to apply its effects to that Skill. You cannot have multiple Support Gems of the same Category socketed within one Skill.",
};

/** Floating in-game-style stat block for a skill/support gem, anchored beside its row. */
export function GemTooltip({ data }: { data: GemTooltipData }) {
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Measure after render and place to the right of the row, flipping left or
  // clamping vertically when it would overflow the viewport.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = data.anchor.right + GAP;
    if (left + width + MARGIN > vw) {
      left = data.anchor.left - GAP - width;
    }
    left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN));

    let top = data.anchor.top;
    top = Math.max(MARGIN, Math.min(top, vh - height - MARGIN));

    setPos({ left, top });
  }, [data]);

  const meta: Array<[string, string]> = [];
  if (data.category) meta.push(["Category", data.category]);
  if (data.tier != null) meta.push(["Tier", String(data.tier)]);
  if (data.costMultiplier != null) meta.push(["Cost Multiplier", `${data.costMultiplier}%`]);
  if (data.requirements)
    meta.push([data.kind === "support" ? "Support Requirements" : "Requirements", data.requirements]);

  const footer = FOOTER[data.kind];

  return (
    <div
      ref={tipRef}
      className="gem-tooltip"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? "visible" : "hidden",
      }}
      role="tooltip"
    >
      <div className="gem-tooltip-head">
        <GemIcon color={data.color} size={22} kind={data.kind} />
        <div className="gem-tooltip-title">
          <span className="gem-tooltip-name">{data.name}</span>
          {data.subtitle ? <span className="gem-tooltip-sub">{data.subtitle}</span> : null}
        </div>
      </div>

      {data.tagLine ? <div className="gem-tooltip-tags">{data.tagLine}</div> : null}

      {meta.length > 0 ? (
        <div className="gem-tooltip-meta">
          {meta.map(([label, value]) => (
            <div className="gem-tooltip-metarow" key={label}>
              <span className="gem-tooltip-metalabel">{label}:</span>
              <span className="gem-tooltip-metaval">{value}</span>
            </div>
          ))}
        </div>
      ) : null}

      {data.description ? <p className="gem-tooltip-desc">{data.description}</p> : null}

      {data.statLines === null ? (
        <p className="gem-tooltip-stats-loading">Loading stats…</p>
      ) : data.statLines.length > 0 ? (
        <ul className="gem-tooltip-stats">
          {data.statLines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}

      {!data.description && data.statLines !== null && data.statLines.length === 0 ? (
        <p className="gem-tooltip-desc gem-tooltip-empty">No description available.</p>
      ) : null}

      {footer ? <p className="gem-tooltip-footer">{footer}</p> : null}
    </div>
  );
}
