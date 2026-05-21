"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAppJson } from "@/lib/data/fetch-app-json";
import { baseNameForUnique, uniqueMatchesForSlot } from "@/lib/build/slot-uniques";
import { SLOT_LAYOUT, sizeClass, type SlotLayout } from "@/lib/build/slots";
import type { BuildState, GearItem } from "@/schemas/build";
import { BasesFileSchema, type BasesFile } from "@/schemas/base";
import { UniquesFileSchema, type UniquesFile } from "@/schemas/unique";

interface GearPanelProps {
  build: BuildState;
  setBuild: React.Dispatch<React.SetStateAction<BuildState>>;
  gearH: number;
}

export function GearPanel({ build, setBuild, gearH }: GearPanelProps) {
  const [bases, setBases] = useState<BasesFile | null>(null);
  const [uniques, setUniques] = useState<UniquesFile | null>(null);
  const [activeSet, setActiveSet] = useState(1);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let aborted = false;
    fetchAppJson("/bases")
      .then(async (data) => {
        const parsed = BasesFileSchema.safeParse(data);
        if (!parsed.success) throw new Error(parsed.error.message.slice(0, 120));
        if (!aborted) setBases(parsed.data);
      })
      .catch(() => {
        /* bases unavailable */
      });
    return () => {
      aborted = true;
    };
  }, []);

  useEffect(() => {
    let aborted = false;
    fetchAppJson("/uniques")
      .then(async (data) => {
        const parsed = UniquesFileSchema.safeParse(data);
        if (!parsed.success) throw new Error(parsed.error.message.slice(0, 120));
        if (!aborted) setUniques(parsed.data);
      })
      .catch(() => {
        /* uniques unavailable */
      });
    return () => {
      aborted = true;
    };
  }, []);

  const itemsBySlot = useMemo(() => {
    const m = new Map<string, GearItem>();
    for (const it of build.items) m.set(it.slot, it);
    return m;
  }, [build.items]);

  const visibleSlots = useMemo(
    () => SLOT_LAYOUT.filter((s) => !s.set || s.set === activeSet),
    [activeSet],
  );

  const selectedSlot = SLOT_LAYOUT.find((s) => s.id === selectedSlotId) ?? null;
  const selectedItem = selectedSlot ? itemsBySlot.get(selectedSlot.id) : undefined;

  useEffect(() => {
    setPickerOpen(false);
  }, [selectedSlotId]);

  const setCount = (n: number) =>
    build.items.filter((i) => i.slot === `Weapon${n}` || i.slot === `Offhand${n}`).length;

  const updateItem = useCallback(
    (slot: string, patch: Partial<GearItem>) => {
      setBuild((prev) => {
        const existing = prev.items.find((i) => i.slot === slot);
        const nextItem: GearItem = existing
          ? { ...existing, ...patch }
          : {
              slot,
              mode: "rare",
              desc: "",
              levelInterval: [1, 100],
              ...patch,
            };
        return {
          ...prev,
          items: [...prev.items.filter((i) => i.slot !== slot), nextItem],
        };
      });
    },
    [setBuild],
  );

  const clearSlot = (slot: string) => {
    setBuild((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.slot !== slot),
    }));
    if (selectedSlotId === slot) setSelectedSlotId(null);
  };

  const selectSlot = (e: React.MouseEvent, slotId: string) => {
    e.stopPropagation();
    setSelectedSlotId(slotId);
  };

  return (
    <section
      className="panel gear-panel"
      data-picker-open={pickerOpen ? "1" : "0"}
      style={gearH ? { height: gearH, maxHeight: "none", flex: "none" } : undefined}
    >
      <header className="panel-h gear-panel-h">
        <h2>Gear</h2>
        <div className="gear-set-tabs" role="tablist" aria-label="Weapon set">
          <button
            type="button"
            role="tab"
            aria-selected={activeSet === 1}
            data-on={activeSet === 1 ? "1" : "0"}
            onClick={() => setActiveSet(1)}
          >
            <span className="gst-roman">I</span>
            <span className="gst-count mono">{setCount(1)}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSet === 2}
            data-on={activeSet === 2 ? "1" : "0"}
            onClick={() => setActiveSet(2)}
          >
            <span className="gst-roman">II</span>
            <span className="gst-count mono">{setCount(2)}</span>
          </button>
        </div>
      </header>

      <div className="gear-grid-wrap">
        <div className="gear-grid">
          {visibleSlots.map((slot) => {
            const it = itemsBySlot.get(slot.id);
            const isSel = selectedSlotId === slot.id;
            const sz = sizeClass(slot);
            return (
              <div
                key={slot.id}
                className={`igs igs-${sz} igs-${it?.mode ?? "empty"} ${isSel ? "is-sel" : ""}`}
                style={{
                  gridColumn: `${slot.x + 1} / span ${slot.w}`,
                  gridRow: `${slot.y + 1} / span ${slot.h}`,
                }}
                onClick={(e) => selectSlot(e, slot.id)}
                title={slot.label}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedSlotId(slot.id);
                  }
                }}
              >
                <SlotContents slot={slot} item={it} size={sz} uniques={uniques} bases={bases} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="gear-detail" ref={detailRef}>
        {!selectedSlot ? (
          <div className="gd-empty">
            <span className="gd-hint-kbd">click</span>
            <span>
              any slot to author it. Each slot can be a specific unique or a description
              of the rare to hunt for.
            </span>
          </div>
        ) : (
          <SlotDetail
            slot={selectedSlot}
            item={selectedItem}
            uniques={uniques}
            bases={bases}
            onMode={(mode) => updateItem(selectedSlot.id, { mode })}
            onName={(n) => updateItem(selectedSlot.id, { unique_name: n, mode: "unique" })}
            onDesc={(d) => updateItem(selectedSlot.id, { desc: d, mode: "rare" })}
            onConvert={() =>
              updateItem(
                selectedSlot.id,
                selectedItem?.mode === "unique"
                  ? { mode: "rare", unique_name: undefined }
                  : { mode: "unique", desc: undefined },
              )
            }
            onClear={() => clearSlot(selectedSlot.id)}
            onPickerOpenChange={setPickerOpen}
          />
        )}
      </div>
    </section>
  );
}

function SlotContents({
  slot,
  item,
  size,
  uniques,
  bases,
}: {
  slot: SlotLayout;
  item: GearItem | undefined;
  size: ReturnType<typeof sizeClass>;
  uniques: UniquesFile | null;
  bases: BasesFile | null;
}) {
  if (!item) return <EmptySlotContent slot={slot} size={size} />;
  if (item.mode === "unique") {
    return (
      <UniqueSlotContent slot={slot} item={item} size={size} uniques={uniques} bases={bases} />
    );
  }
  return <RareSlotContent slot={slot} item={item} size={size} />;
}

function EmptySlotContent({ slot, size }: { slot: SlotLayout; size: ReturnType<typeof sizeClass> }) {
  if (size === "micro") {
    return (
      <div className="igs-inner igs-inner-empty">
        <div className="igs-empty-glyph" aria-hidden>
          ＋
        </div>
      </div>
    );
  }
  return (
    <div className="igs-inner igs-inner-empty">
      <div className="igs-empty-glyph" aria-hidden>
        ＋
      </div>
      <div className="igs-empty-lbl mono">{slot.label}</div>
    </div>
  );
}

function UniqueSlotContent({
  slot,
  item,
  size,
  uniques,
  bases,
}: {
  slot: SlotLayout;
  item: GearItem;
  size: ReturnType<typeof sizeClass>;
  uniques: UniquesFile | null;
  bases: BasesFile | null;
}) {
  const isMicro = size === "micro";
  const isTiny = size === "tiny";
  const showsName = !isMicro;
  const showsBase = size === "large" || size === "medium";
  const base =
    uniques && item.unique_name
      ? baseNameForUnique(uniques, bases, item.unique_name)
      : undefined;

  return (
    <div className="igs-inner igs-inner-unique">
      {!isMicro && !isTiny && <div className="igs-tag mono">UNIQUE</div>}
      {showsName && (
        <div className="igs-name">
          {item.unique_name || <span className="igs-name-empty">unnamed</span>}
        </div>
      )}
      {showsBase && base && <div className="igs-base">{base}</div>}
      {isMicro && <div className="igs-micro-glyph" />}
      <div className="igs-slot-lbl mono">{slot.label}</div>
    </div>
  );
}

function RareSlotContent({
  slot,
  item,
  size,
}: {
  slot: SlotLayout;
  item: GearItem;
  size: ReturnType<typeof sizeClass>;
}) {
  const isMicro = size === "micro";
  const isTiny = size === "tiny";
  const showsPreview = !isMicro;
  const stripped = (item.desc ?? "").replace(/<[^>]+>/g, "").replace(/[{}]/g, "").trim();

  return (
    <div className="igs-inner igs-inner-rare">
      {!isMicro && !isTiny && <div className="igs-tag mono">RARE</div>}
      {showsPreview && stripped && <div className="igs-rare-preview">{stripped}</div>}
      {showsPreview && !stripped && <div className="igs-rare-empty">undescribed</div>}
      {isMicro && <div className="igs-micro-glyph igs-micro-rare" />}
      <div className="igs-slot-lbl mono">{slot.label}</div>
    </div>
  );
}

function SlotDetail({
  slot,
  item,
  uniques,
  bases,
  onMode,
  onName,
  onDesc,
  onConvert,
  onClear,
  onPickerOpenChange,
}: {
  slot: SlotLayout;
  item: GearItem | undefined;
  uniques: UniquesFile | null;
  bases: BasesFile | null;
  onMode: (mode: "unique" | "rare") => void;
  onName: (n: string) => void;
  onDesc: (d: string) => void;
  onConvert: () => void;
  onClear: () => void;
  onPickerOpenChange: (open: boolean) => void;
}) {
  const mode = item?.mode;
  return (
    <div className="gd">
      <div className="gd-head">
        <div className="gd-head-meta">
          <span className="gd-head-slot mono">{slot.label.toUpperCase()}</span>
          {mode && (
            <span className={`gd-head-mode gd-head-mode-${mode}`}>
              {mode === "unique" ? "Specific unique" : "Described rare"}
            </span>
          )}
        </div>
        <div className="gd-head-actions">
          {item && (
            <button
              type="button"
              className="gd-act"
              onClick={onConvert}
              title={mode === "unique" ? "Switch to rare description" : "Switch to specific unique"}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                <path
                  d="M1 3 L9 3 M7 1 L9 3 L7 5 M9 7 L1 7 M3 5 L1 7 L3 9"
                  stroke="currentColor"
                  strokeWidth="0.9"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{mode === "unique" ? "Use rare instead" : "Use unique instead"}</span>
            </button>
          )}
          {item && (
            <button type="button" className="gd-act gd-act-x" onClick={onClear} title="Clear slot">
              ×
            </button>
          )}
        </div>
      </div>

      {!item && <SlotPickModeRow onMode={onMode} />}
      {item?.mode === "unique" && (
        <UniqueDetailEditor
          item={item}
          uniques={uniques}
          bases={bases}
          onName={onName}
          slotId={slot.id}
          onOpenChange={onPickerOpenChange}
        />
      )}
      {item?.mode === "rare" && <RareDetailEditor item={item} onDesc={onDesc} />}
    </div>
  );
}

function SlotPickModeRow({ onMode }: { onMode: (mode: "unique" | "rare") => void }) {
  return (
    <div className="gd-pick">
      <div className="gd-pick-hint">How will players acquire this slot?</div>
      <div className="gd-pick-row">
        <button type="button" className="gd-pick-btn gd-pick-unique" onClick={() => onMode("unique")}>
          <span className="gd-pick-name">Specific unique</span>
          <span className="gd-pick-sub">name the exact item</span>
        </button>
        <button type="button" className="gd-pick-btn gd-pick-rare" onClick={() => onMode("rare")}>
          <span className="gd-pick-name">Described rare</span>
          <span className="gd-pick-sub">describe what to hunt for</span>
        </button>
      </div>
    </div>
  );
}

function UniqueDetailEditor({
  item,
  uniques,
  bases,
  onName,
  slotId,
  onOpenChange,
}: {
  item: GearItem;
  uniques: UniquesFile | null;
  bases: BasesFile | null;
  onName: (n: string) => void;
  slotId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const inpRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(item.unique_name || "");
  const [open, setOpen] = useState(false);

  const setPickerOpen = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange(next);
    },
    [onOpenChange],
  );

  useEffect(() => {
    setQuery(item.unique_name || "");
  }, [item.unique_name]);

  useEffect(() => () => onOpenChange(false), [onOpenChange]);

  const matches = useMemo(() => {
    if (!uniques) return [];
    return uniqueMatchesForSlot(uniques, slotId, query || "");
  }, [uniques, slotId, query]);

  const apply = (name: string) => {
    onName(name);
    setQuery(name);
    setPickerOpen(false);
  };

  const resolvedBase =
    uniques && item.unique_name
      ? baseNameForUnique(uniques, bases, item.unique_name)
      : undefined;

  return (
    <div className="gd-unique">
      <div className="gd-field">
        <label className="gd-field-lbl mono">UNIQUE NAME</label>
        <div className="gd-search">
          <input
            ref={inpRef}
            value={query}
            placeholder="Type a unique name…"
            onChange={(e) => {
              setQuery(e.target.value);
              onName(e.target.value);
              setPickerOpen(true);
            }}
            onFocus={() => setPickerOpen(true)}
            onBlur={() => setTimeout(() => setPickerOpen(false), 120)}
          />
          {open && uniques && (
            <div className="gd-search-results">
              {matches.length === 0 ? (
                <div className="gd-search-empty">
                  No matches in catalog. The name will still export.
                </div>
              ) : (
                matches.map(({ name, base }) => (
                  <button
                    key={name}
                    type="button"
                    className="gd-search-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      apply(name);
                    }}
                  >
                    <span className="gd-search-name">{name}</span>
                    <span className="gd-search-base">{base}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      {item.unique_name && (
        <div className="gd-field">
          <label className="gd-field-lbl mono">BASE</label>
          <div className="gd-base">
            {resolvedBase || <span className="gd-base-unknown">not in local catalog</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function RareDetailEditor({
  item,
  onDesc,
}: {
  item: GearItem;
  onDesc: (d: string) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    taRef.current?.focus();
  }, []);

  return (
    <div className="gd-rare">
      <div className="gd-field">
        <label className="gd-field-lbl mono">DESCRIPTION</label>
        <textarea
          ref={taRef}
          value={item.desc || ""}
          placeholder="What rare should the player look for? e.g. life · 30% movement speed · two resists"
          onChange={(e) => onDesc(e.target.value)}
        />
      </div>
    </div>
  );
}
