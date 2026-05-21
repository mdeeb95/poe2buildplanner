import type { GemPickerKind, GemUiColor } from "@/lib/build/gem-ui";

const GEM_COLORS: Record<
  GemUiColor,
  { bg: string; border: string; glyph: string }
> = {
  red: { bg: "#3a1d1d", border: "#6e2f2f", glyph: "#e2a0a0" },
  green: { bg: "#1d2e1f", border: "#365d3a", glyph: "#a3d0a8" },
  blue: { bg: "#1a2540", border: "#365b8a", glyph: "#9fc1ec" },
  white: { bg: "#2a2a2e", border: "#5a5a60", glyph: "#cfcfd2" },
};

interface GemIconProps {
  color: GemUiColor;
  size?: number;
  kind?: GemPickerKind;
}

export function GemIcon({ color, size = 22, kind = "skill" }: GemIconProps) {
  const c = GEM_COLORS[color] ?? GEM_COLORS.white;

  if (kind === "support") {
    return (
      <svg width={size} height={size} viewBox="0 0 22 22" className="gem" aria-hidden>
        <path
          d="M11 2 L20 11 L11 20 L2 11 Z"
          fill={c.bg}
          stroke={c.border}
          strokeWidth="1"
        />
        <path d="M11 7 L15 11 L11 15 L7 11 Z" fill={c.glyph} opacity="0.85" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 22 22" className="gem" aria-hidden>
      <rect
        x="2"
        y="2"
        width="18"
        height="18"
        rx="3"
        fill={c.bg}
        stroke={c.border}
        strokeWidth="1"
      />
      <circle cx="11" cy="11" r="4.5" fill={c.glyph} opacity="0.85" />
    </svg>
  );
}
