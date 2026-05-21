// app.jsx — Root component. Wires state, selection, onboarding, export.

function App() {
  // Locked: density=tight, font=inter, headerGradients=off, treatment=curved.
  // Sample is still mutable so the onboarding picker can switch templates.
  const [sample, setSample] = React.useState('warrior');
  // Build state — initially seeded from the chosen sample
  const [build, setBuild] = React.useState(() => deepCopy(SAMPLE_BUILDS[sample] || SAMPLE_BUILDS.empty));
  const [selection, setSelection] = React.useState(null);
  const [showOnboard, setShowOnboard] = React.useState(sample === 'empty');

  // Side rail width — persisted per browser via localStorage
  const [sideW, setSideW] = React.useState(() => {
    try {
      const v = parseInt(localStorage.getItem('buildEditor.sideW'), 10);
      if (v >= 360 && v <= 800) return v;
    } catch (e) { /* noop */ }
    return 460;
  });
  React.useEffect(() => {
    try { localStorage.setItem('buildEditor.sideW', String(sideW)); } catch (e) { /* noop */ }
  }, [sideW]);

  // Gear panel height — drives the split between skills and gear
  const [gearH, setGearH] = React.useState(() => {
    try {
      const v = parseInt(localStorage.getItem('buildEditor.gearH'), 10);
      if (v >= 320 && v <= 800) return v;
    } catch (e) { /* noop */ }
    return 500;
  });
  React.useEffect(() => {
    try { localStorage.setItem('buildEditor.gearH', String(gearH)); } catch (e) { /* noop */ }
  }, [gearH]);

  // Switch sample when picked from onboarding
  const lastSampleRef = React.useRef(sample);
  React.useEffect(() => {
    if (sample !== lastSampleRef.current) {
      setBuild(deepCopy(SAMPLE_BUILDS[sample] || SAMPLE_BUILDS.empty));
      setSelection(null);
      setShowOnboard(sample === 'empty');
      lastSampleRef.current = sample;
    }
  }, [sample]);

  // ── Export ──
  const onExport = () => {
    const json = buildToJson(build);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safe = (build.name || 'MyBuild').replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'MyBuild';
    a.download = `${safe}.build`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const onNew = () => {
    setShowOnboard(true);
    setSelection(null);
  };

  const pickTemplate = (kind) => {
    setSample(kind);
    setShowOnboard(false);
  };

  return (
    <div className="app density-tight font-inter no-header-gradients" style={{ '--side-w': `${sideW}px` }}>
      <TopBar build={build} setBuild={setBuild} onExport={onExport} onNew={onNew} />

      <main className="workspace">
        <section className="tree-section">
          <PassiveTree
            nodes={TREE_NODES}
            edges={TREE_EDGES}
            labels={TREE_LABELS}
            build={build}
            setBuild={setBuild}
            selection={selection}
            setSelection={setSelection}
            treatment="curved"
            density="tight"
          />
          {showOnboard && (
            <OnboardingOverlay onPick={pickTemplate} onDismiss={() => setShowOnboard(false)} hasContent={build.skills?.length > 0 || build.allocated?.length > 0} />
          )}
        </section>

        <aside className="side">
          <Resizer width={sideW} setWidth={setSideW} />
          <SkillsPanel build={build} setBuild={setBuild} selection={selection} setSelection={setSelection} />
          <HResizer height={gearH} setHeight={setGearH} />
          <GearPanel build={build} setBuild={setBuild} selection={selection} setSelection={setSelection} gearH={gearH} />
        </aside>
      </main>
    </div>
  );
}

function Resizer({ width, setWidth }) {
  const [active, setActive] = React.useState(false);
  const onDown = (e) => {
    e.preventDefault();
    setActive(true);
    document.body.classList.add('resizing');
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev) => {
      // Side is on the right, so DRAGGING LEFT widens the rail (increases sideW)
      const dx = startX - ev.clientX;
      const next = Math.max(360, Math.min(800, startW + dx));
      setWidth(next);
    };
    const onUp = () => {
      setActive(false);
      document.body.classList.remove('resizing');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const onDouble = () => setWidth(460);
  return (
    <div className="resizer" data-active={active ? '1' : '0'}
         onMouseDown={onDown} onDoubleClick={onDouble}
         title="Drag to resize. Double-click to reset." />
  );
}

// HResizer: horizontal split between the skills and gear panels in the side rail.
function HResizer({ height, setHeight }) {
  const [active, setActive] = React.useState(false);
  const onDown = (e) => {
    e.preventDefault();
    setActive(true);
    document.body.classList.add('resizing-v');
    const startY = e.clientY;
    const startH = height;
    const onMove = (ev) => {
      // Gear is below the handle; dragging UP grows the gear panel.
      const dy = startY - ev.clientY;
      const next = Math.max(320, Math.min(800, startH + dy));
      setHeight(next);
    };
    const onUp = () => {
      setActive(false);
      document.body.classList.remove('resizing-v');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const onDouble = () => setHeight(500);
  return (
    <div className="hresizer" data-active={active ? '1' : '0'}
         onMouseDown={onDown} onDoubleClick={onDouble}
         title="Drag to resize. Double-click to reset." />
  );
}

function OnboardingOverlay({ onPick, onDismiss, hasContent }) {
  return (
    <div className="onboard">
      <div className="onboard-card-wrap">
        <div className="onboard-head">
          <div className="onboard-eyebrow">START</div>
          <h1 className="onboard-h1">Author a build players can drop into PoE 2.</h1>
          <p className="onboard-sub">Pick a starting point. You'll author <em>what the build is</em> — the game highlights it during gameplay.</p>
        </div>
        <div className="onboard-cards">
          <button className="onboard-card" onClick={() => onPick('empty')}>
            <div className="onboard-card-icon">
              <svg viewBox="0 0 40 40" width="40" height="40">
                <circle cx="20" cy="20" r="14" fill="none" stroke="#5a5d65" strokeWidth="1.2" strokeDasharray="3 3" />
                <circle cx="20" cy="20" r="2" fill="#c9a36b" />
              </svg>
            </div>
            <div className="onboard-card-name">Blank slate</div>
            <div className="onboard-card-desc">Start with nothing. Pick an ascendancy and place your first node.</div>
          </button>

          <button className="onboard-card" onClick={() => onPick('warrior')}>
            <div className="onboard-card-icon">
              <svg viewBox="0 0 40 40" width="40" height="40">
                <path d="M20 4 L34 20 L20 36 L6 20 Z" fill="none" stroke="#c9a36b" strokeWidth="1.4" />
                <path d="M20 10 L30 20 L20 30 L10 20 Z" fill="#c9a36b" opacity="0.45" />
                <circle cx="20" cy="20" r="2.5" fill="#c9a36b" />
              </svg>
            </div>
            <div className="onboard-card-name">Bleedchain Titan</div>
            <div className="onboard-card-desc">Two-hander Warrior · sustained physical bleeds · Crimson Engine keystone.</div>
            <div className="onboard-card-meta mono">14 passives · 4 skills · 9 items</div>
          </button>

          <button className="onboard-card" onClick={() => onPick('sorceress')}>
            <div className="onboard-card-icon">
              <svg viewBox="0 0 40 40" width="40" height="40">
                <path d="M20 6 L24 18 L36 20 L24 22 L20 34 L16 22 L4 20 L16 18 Z" fill="none" stroke="#7fa9d4" strokeWidth="1.2" />
                <circle cx="20" cy="20" r="3" fill="#7fa9d4" opacity="0.7" />
              </svg>
            </div>
            <div className="onboard-card-name">Frostbite Stormweaver</div>
            <div className="onboard-card-desc">Sorceress · cold-conversion cast-on-crit · glacial scaffolding from L24.</div>
            <div className="onboard-card-meta mono">14 passives · 3 skills · 9 items</div>
          </button>
        </div>
        {hasContent && (
          <button className="onboard-dismiss" onClick={onDismiss}>Keep current build</button>
        )}
      </div>
    </div>
  );
}

function deepCopy(v) { return JSON.parse(JSON.stringify(v)); }

// Translate the editor's working build into the .build schema described in the brief.
// additional_text is always emitted (per schema), but always empty — the editor
// no longer exposes a note-authoring affordance.
function buildToJson(build) {
  return {
    name: build.name || 'Untitled build',
    description: build.description || '',
    ascendancy: build.ascendancy || '',
    passives: (build.allocated || []).map((id) => ({
      id,
      level_interval: [(build.nodeLevels?.[id]) || 1, 100],
      weapon_set: 0,
      additional_text: '',
    })),
    skills: (build.skills || []).map((s) => ({
      id: s.skillId || s.id,
      level_interval: s.levelInterval || [1, 100],
      additional_text: '',
      support_skills: (s.supports || []).map((sup) => ({
        id: sup.skillId || sup.id,
        level_interval: sup.levelInterval || [1, 100],
        additional_text: '',
      })),
    })),
    items: (build.items || []).map((i) => ({
      inventory_id: i.slot,
      slot_x: 0,
      slot_y: 0,
      level_interval: i.levelInterval || [1, 100],
      unique_name: i.mode === 'unique' ? (i.unique_name || '') : '',
      // For rare items the description IS the additional_text (per schema).
      additional_text: i.mode === 'rare' ? (i.desc || '') : '',
    })),
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
