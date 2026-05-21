// gear.jsx — Spatial inventory grid that mirrors the in-game PoE2 layout.
// Tabs at the top swap between Weapon Set I and Weapon Set II (both sets'
// slots exist in build data; the tabs just decide which two big slots render).
// The grid is selection-first: clicking any slot highlights it and the detail
// strip below the grid retargets to edit that slot in place. No modals.

const UNIQUE_CATALOG = [
  { name: "The Crimson Storm",    base: "Tideturner Greataxe",      kind: 'Weapon1' },
  { name: "Throatseeker",         base: "Citrine Amulet",           kind: 'Amulet'  },
  { name: "Reaver's Cuffs",       base: "Steelscale Gauntlets",     kind: 'Gloves'  },
  { name: "The Whispering Ice",   base: "Vile Staff",               kind: 'Weapon1' },
  { name: "Bitterbind Point",     base: "Heavy Belt",               kind: 'Belt'    },
  { name: "Pyroshock Clasp",      base: "Iron Ring",                kind: 'Ring1'   },
  { name: "Stormhold Aegis",      base: "Tower Shield",             kind: 'Offhand1'},
  { name: "Voidsteel Plate",      base: "Crusader Plate",           kind: 'BodyArmour' },
  { name: "Hollow Crown",         base: "Sorcerer Coronet",         kind: 'Helmet'  },
  { name: "Wanderer's Bind",      base: "Stealth Boots",            kind: 'Boots'   },
];

// "Size class" the slot renders against — chooses how much label/content to show.
function sizeClass(slot) {
  const area = slot.w * slot.h;
  if (slot.w === 1 && slot.h === 1) return 'micro';   // 1×1 (rings, amulet)
  if (area <= 2) return 'tiny';                       // 2×1 (belt)
  if (area <= 4) return 'small';                      // 2×2 (helm, gloves, boots)
  if (area <= 6) return 'medium';                     // 2×3 (body)
  return 'large';                                     // 2×4 (weapons)
}

function GearPanel({ build, setBuild, selection, setSelection, gearH }) {
  const [activeSet, setActiveSet] = React.useState(1);
  const detailRef = React.useRef(null);

  const itemsBySlot = React.useMemo(() => {
    const m = new Map();
    for (const it of (build.items || [])) m.set(it.slot, it);
    return m;
  }, [build.items]);

  // Slots to render: filter weapon-set slots by activeSet; non-weapon slots always show.
  const visibleSlots = SLOT_LAYOUT.filter((s) => !s.set || s.set === activeSet);

  const updateItem = (slot, patch) => {
    const existing = itemsBySlot.get(slot);
    let nextItem;
    if (existing) {
      nextItem = { ...existing, ...patch };
    } else {
      nextItem = { slot, mode: 'rare', desc: '', levelInterval: [1, 100], ...patch };
    }
    const arr = (build.items || []).filter((i) => i.slot !== slot).concat(nextItem);
    setBuild({ ...build, items: arr });
  };

  const clearSlot = (slot) => {
    setBuild({ ...build, items: (build.items || []).filter((i) => i.slot !== slot) });
    if (selection?.kind === 'item' && selection.id === slot) setSelection(null);
  };

  const selectSlot = (e, slot) => {
    e.stopPropagation();
    const it = itemsBySlot.get(slot);
    const def = SLOT_LAYOUT.find((s) => s.id === slot);
    // Use the detail strip as the popover anchor so add-note appears next to it
    setSelection({
      kind: 'item',
      id: slot,
      name: it?.unique_name || def?.label || slot,
      levelInterval: it?.levelInterval || [1, 100],
      anchorRef: detailRef.current,
    });
  };

  // Counts for the header chips — only count weapon-set slots themselves.
  const setCount = (n) => (build.items || []).filter((i) => i.slot === `Weapon${n}` || i.slot === `Offhand${n}`).length;

  const selectedSlot = selection?.kind === 'item' ? SLOT_LAYOUT.find((s) => s.id === selection.id) : null;
  const selectedItem = selectedSlot ? itemsBySlot.get(selectedSlot.id) : null;

  return (
    <section className="panel gear-panel" style={gearH ? { height: gearH, maxHeight: 'none', flex: 'none' } : undefined}>
      <header className="panel-h gear-panel-h">
        <h2>Gear</h2>
        <div className="gear-set-tabs" role="tablist" aria-label="Weapon set">
          <button role="tab" aria-selected={activeSet === 1}
                  data-on={activeSet === 1 ? '1' : '0'}
                  onClick={() => setActiveSet(1)}>
            <span className="gst-roman">I</span>
            <span className="gst-count mono">{setCount(1)}</span>
          </button>
          <button role="tab" aria-selected={activeSet === 2}
                  data-on={activeSet === 2 ? '1' : '0'}
                  onClick={() => setActiveSet(2)}>
            <span className="gst-roman">II</span>
            <span className="gst-count mono">{setCount(2)}</span>
          </button>
        </div>
      </header>

      <div className="gear-grid-wrap">
        <div className="gear-grid">
          {visibleSlots.map((slot) => {
            const it = itemsBySlot.get(slot.id);
            const isSel = selection?.kind === 'item' && selection.id === slot.id;
            const sz = sizeClass(slot);
            return (
              <div
                key={slot.id}
                className={`igs igs-${sz} igs-${it?.mode || 'empty'} ${isSel ? 'is-sel' : ''}`}
                style={{
                  gridColumn: `${slot.x + 1} / span ${slot.w}`,
                  gridRow: `${slot.y + 1} / span ${slot.h}`,
                }}
                onClick={(e) => selectSlot(e, slot.id)}
                title={slot.label}
              >
                <SlotContents slot={slot} item={it} size={sz} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="gear-detail" ref={detailRef}>
        {!selectedSlot ? (
          <div className="gd-empty">
            <span className="gd-hint-kbd">click</span>
            <span>any slot to author it. Each slot can be a specific unique or a description of the rare to hunt for.</span>
          </div>
        ) : (
          <SlotDetail
            slot={selectedSlot}
            item={selectedItem}
            onMode={(mode) => updateItem(selectedSlot.id, { mode })}
            onName={(n) => updateItem(selectedSlot.id, { unique_name: n })}
            onDesc={(d) => updateItem(selectedSlot.id, { desc: d })}
            onConvert={() => updateItem(selectedSlot.id, selectedItem?.mode === 'unique' ? { mode: 'rare', unique_name: undefined } : { mode: 'unique', desc: undefined })}
            onClear={() => clearSlot(selectedSlot.id)}
          />
        )}
      </div>
    </section>
  );
}

// ── Slot content (the small visual inside the grid cell) ────────────────────

function SlotContents({ slot, item, size }) {
  if (!item) {
    return <EmptySlotContent slot={slot} size={size} />;
  }
  if (item.mode === 'unique') return <UniqueSlotContent slot={slot} item={item} size={size} />;
  return <RareSlotContent slot={slot} item={item} size={size} />;
}

function EmptySlotContent({ slot, size }) {
  if (size === 'micro') {
    return (
      <div className="igs-inner igs-inner-empty">
        <div className="igs-empty-glyph" aria-hidden="true">＋</div>
      </div>
    );
  }
  return (
    <div className="igs-inner igs-inner-empty">
      <div className="igs-empty-glyph" aria-hidden="true">＋</div>
      <div className="igs-empty-lbl mono">{slot.label}</div>
    </div>
  );
}

function UniqueSlotContent({ slot, item, size }) {
  const isMicro = size === 'micro';
  const isTiny = size === 'tiny';
  const showsName = !isMicro;
  const showsBase = size === 'large' || size === 'medium';
  const base = UNIQUE_CATALOG.find((u) => u.name === item.unique_name)?.base;
  return (
    <div className="igs-inner igs-inner-unique">
      {!isMicro && !isTiny && <div className="igs-tag mono">UNIQUE</div>}
      {showsName && (
        <div className="igs-name">{item.unique_name || <span className="igs-name-empty">unnamed</span>}</div>
      )}
      {showsBase && base && <div className="igs-base">{base}</div>}
      {isMicro && <div className="igs-micro-glyph" />}
      <div className="igs-slot-lbl mono">{slot.label}</div>
    </div>
  );
}

function RareSlotContent({ slot, item, size }) {
  const isMicro = size === 'micro';
  const isTiny = size === 'tiny';
  const showsPreview = !isMicro;
  // Strip markup tags for the in-cell preview (a single line)
  const stripped = (item.desc || '').replace(/<[^>]+>/g, '').replace(/[{}]/g, '').trim();
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

// ── Detail strip ─────────────────────────────────────────────────────────────

function SlotDetail({ slot, item, onMode, onName, onDesc, onConvert, onClear }) {
  const mode = item?.mode;
  return (
    <div className="gd">
      <div className="gd-head">
        <div className="gd-head-meta">
          <span className="gd-head-slot mono">{slot.label.toUpperCase()}</span>
          {mode && (
            <span className={`gd-head-mode gd-head-mode-${mode}`}>
              {mode === 'unique' ? 'Specific unique' : 'Described rare'}
            </span>
          )}
        </div>
        <div className="gd-head-actions">
          {item && (
            <button className="gd-act" onClick={onConvert} title={mode === 'unique' ? 'Switch to rare description' : 'Switch to specific unique'}>
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M1 3 L9 3 M7 1 L9 3 L7 5 M9 7 L1 7 M3 5 L1 7 L3 9" stroke="currentColor" strokeWidth="0.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{mode === 'unique' ? 'Use rare instead' : 'Use unique instead'}</span>
            </button>
          )}
          {item && (
            <button className="gd-act gd-act-x" onClick={onClear} title="Clear slot">×</button>
          )}
        </div>
      </div>

      {!item && <SlotPickModeRow slot={slot} onMode={onMode} />}
      {item?.mode === 'unique' && <UniqueDetailEditor item={item} slot={slot} onName={onName} />}
      {item?.mode === 'rare' && <RareDetailEditor item={item} onDesc={onDesc} />}
    </div>
  );
}

function SlotPickModeRow({ slot, onMode }) {
  return (
    <div className="gd-pick">
      <div className="gd-pick-hint">How will players acquire this slot?</div>
      <div className="gd-pick-row">
        <button className="gd-pick-btn gd-pick-unique" onClick={() => onMode('unique')}>
          <span className="gd-pick-name">Specific unique</span>
          <span className="gd-pick-sub">name the exact item</span>
        </button>
        <button className="gd-pick-btn gd-pick-rare" onClick={() => onMode('rare')}>
          <span className="gd-pick-name">Described rare</span>
          <span className="gd-pick-sub">describe what to hunt for</span>
        </button>
      </div>
    </div>
  );
}

function UniqueDetailEditor({ item, slot, onName }) {
  const inpRef = React.useRef(null);
  const [query, setQuery] = React.useState(item.unique_name || '');
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => { setQuery(item.unique_name || ''); }, [item.unique_name]);

  const matches = UNIQUE_CATALOG
    .filter((u) => u.name.toLowerCase().includes((query || '').toLowerCase()))
    .slice(0, 5);

  const apply = (name) => { onName(name); setQuery(name); setOpen(false); };

  return (
    <div className="gd-unique">
      <div className="gd-field">
        <label className="gd-field-lbl mono">UNIQUE NAME</label>
        <div className="gd-search">
          <input
            ref={inpRef}
            value={query}
            placeholder="Type a unique name…"
            onChange={(e) => { setQuery(e.target.value); onName(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
          />
          {open && (
            <div className="gd-search-results">
              {matches.length === 0 ? (
                <div className="gd-search-empty">No matches in catalog. The name will still export.</div>
              ) : matches.map((m) => (
                <button key={m.name} className="gd-search-item"
                        onMouseDown={(e) => { e.preventDefault(); apply(m.name); }}>
                  <span className="gd-search-name">{m.name}</span>
                  <span className="gd-search-base">{m.base}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {item.unique_name && (
        <div className="gd-field">
          <label className="gd-field-lbl mono">BASE</label>
          <div className="gd-base">{UNIQUE_CATALOG.find((u) => u.name === item.unique_name)?.base || <span className="gd-base-unknown">not in local catalog</span>}</div>
        </div>
      )}
    </div>
  );
}

function RareDetailEditor({ item, onDesc }) {
  const taRef = React.useRef(null);
  React.useEffect(() => { taRef.current?.focus(); }, []);
  return (
    <div className="gd-rare">
      <div className="gd-field">
        <label className="gd-field-lbl mono">DESCRIPTION</label>
        <textarea
          ref={taRef}
          value={item.desc || ''}
          placeholder="What rare should the player look for? e.g. life · 30% movement speed · two resists"
          onChange={(e) => onDesc(e.target.value)}
        />
      </div>
    </div>
  );
}

window.GearPanel = GearPanel;
