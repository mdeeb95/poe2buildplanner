// skills.jsx — Flat list of skill setups, supports indented under each skill.
// Direct manipulation: click a row to select, click + to add, inline search.

const GEM_COLORS = {
  red:   { bg: '#3a1d1d', border: '#6e2f2f', glyph: '#e2a0a0' },
  green: { bg: '#1d2e1f', border: '#365d3a', glyph: '#a3d0a8' },
  blue:  { bg: '#1a2540', border: '#365b8a', glyph: '#9fc1ec' },
  white: { bg: '#2a2a2e', border: '#5a5a60', glyph: '#cfcfd2' },
};

// Catalog the search picker draws from.
const SKILL_CATALOG = [
  { id: 'BleedingEdge', name: 'Bleeding Edge', color: 'red', kind: 'skill', desc: 'Two-handed slash that applies bleed.' },
  { id: 'LeapSlam', name: 'Leap Slam', color: 'red', kind: 'skill', desc: 'Jump and slam, knocking back enemies.' },
  { id: 'Sunder', name: 'Sunder', color: 'red', kind: 'skill', desc: 'Wave that splits on hit.' },
  { id: 'WarBanner', name: 'War Banner', color: 'red', kind: 'skill', desc: 'Aura banner buffing allies.' },
  { id: 'IceNova', name: 'Ice Nova', color: 'blue', kind: 'skill', desc: 'Ring of cold around the caster.' },
  { id: 'Frostbolt', name: 'Frostbolt', color: 'blue', kind: 'skill', desc: 'Slow cold projectile.' },
  { id: 'FrostWall', name: 'Frost Wall', color: 'blue', kind: 'skill', desc: 'Conjures a wall of ice.' },
  { id: 'Fireball', name: 'Fireball', color: 'blue', kind: 'skill', desc: 'Single-target fire projectile.' },
  { id: 'LightningArrow', name: 'Lightning Arrow', color: 'green', kind: 'skill', desc: 'Bow attack that chains.' },
];

const SUPPORT_CATALOG = [
  { id: 'Brutality', name: 'Brutality', color: 'red', kind: 'support', desc: 'More physical damage; no elemental or chaos.' },
  { id: 'BloodlustSupport', name: 'Bloodlust', color: 'red', kind: 'support', desc: 'More damage vs. bleeding enemies.' },
  { id: 'MartialTempo', name: 'Martial Tempo', color: 'green', kind: 'support', desc: 'More attack speed.' },
  { id: 'OverpowerSupport', name: 'Overpower', color: 'red', kind: 'support', desc: 'Bypass armor on attacks.' },
  { id: 'LongerLeap', name: 'Reaching', color: 'green', kind: 'support', desc: 'Greater leap distance.' },
  { id: 'Momentum', name: 'Momentum', color: 'green', kind: 'support', desc: 'Damage scales with travel.' },
  { id: 'Iron', name: 'Iron Will', color: 'red', kind: 'support', desc: 'Strength bonuses apply to spells.' },
  { id: 'AddedCold', name: 'Added Cold Damage', color: 'blue', kind: 'support', desc: 'Adds cold damage.' },
  { id: 'SpellEcho', name: 'Spell Echo', color: 'blue', kind: 'support', desc: 'Repeats spells once.' },
  { id: 'Hypothermia', name: 'Hypothermia', color: 'blue', kind: 'support', desc: 'More damage vs. chilled.' },
  { id: 'GMP', name: 'Greater Multiple Projectiles', color: 'green', kind: 'support', desc: 'Fires extra projectiles.' },
  { id: 'Pierce', name: 'Pierce', color: 'green', kind: 'support', desc: 'Projectiles pierce.' },
  { id: 'Cull', name: 'Culling Strike', color: 'green', kind: 'support', desc: 'Kill low-HP enemies on hit.' },
];

function GemIcon({ color, size = 22, kind = 'skill' }) {
  const c = GEM_COLORS[color] || GEM_COLORS.white;
  // skill = filled rounded square; support = diamond (visual distinction)
  if (kind === 'support') {
    return (
      <svg width={size} height={size} viewBox="0 0 22 22" className="gem">
        <path d="M11 2 L20 11 L11 20 L2 11 Z" fill={c.bg} stroke={c.border} strokeWidth="1" />
        <path d="M11 7 L15 11 L11 15 L7 11 Z" fill={c.glyph} opacity="0.85" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" className="gem">
      <rect x="2" y="2" width="18" height="18" rx="3" fill={c.bg} stroke={c.border} strokeWidth="1" />
      <circle cx="11" cy="11" r="4.5" fill={c.glyph} opacity="0.85" />
    </svg>
  );
}

function SkillsPanel({ build, setBuild, selection, setSelection }) {
  const [adding, setAdding] = React.useState(null); // {parent: skillId|null}
  const [query, setQuery] = React.useState('');

  const openAddSkill = () => { setAdding({ parent: null }); setQuery(''); };
  const openAddSupport = (skillId) => { setAdding({ parent: skillId }); setQuery(''); };

  const closeAdd = () => setAdding(null);

  const addItem = (item) => {
    if (!adding) return;
    if (adding.parent == null) {
      const newSkill = {
        id: `${item.id}-${Date.now()}`,
        skillId: item.id,
        name: item.name,
        color: item.color,
        levelInterval: [1, 100],
        supports: [],
      };
      setBuild({ ...build, skills: [...(build.skills || []), newSkill] });
    } else {
      const skills = (build.skills || []).map((s) =>
        s.id !== adding.parent ? s : {
          ...s,
          supports: [...(s.supports || []), {
            id: `${item.id}-${Date.now()}`,
            skillId: item.id,
            name: item.name,
            color: item.color,
            levelInterval: [1, 100],
          }],
        });
      setBuild({ ...build, skills });
    }
    setAdding(null);
  };

  const removeSkill = (sid) => {
    setBuild({ ...build, skills: (build.skills || []).filter((s) => s.id !== sid) });
    if (selection?.kind === 'skill' && selection.id === sid) setSelection(null);
  };
  const removeSupport = (sid, supId) => {
    const skills = (build.skills || []).map((s) =>
      s.id !== sid ? s : { ...s, supports: (s.supports || []).filter((su) => su.id !== supId) });
    setBuild({ ...build, skills });
    if (selection?.kind === 'support' && selection.id === supId) setSelection(null);
  };

  const selectSkill = (e, s) => {
    e.stopPropagation();
    setSelection({
      kind: 'skill', id: s.id, name: s.name, color: s.color,
      levelInterval: s.levelInterval, anchorRef: e.currentTarget,
    });
  };
  const selectSupport = (e, sup, parent) => {
    e.stopPropagation();
    setSelection({
      kind: 'support', id: sup.id, name: sup.name, color: sup.color,
      parentSkillId: parent.id,
      levelInterval: sup.levelInterval, anchorRef: e.currentTarget,
    });
  };

  const catalog = adding?.parent == null ? SKILL_CATALOG : SUPPORT_CATALOG;
  const filtered = adding ? catalog.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())) : [];

  return (
    <section className="panel skills-panel">
      <header className="panel-h">
        <h2>Skills</h2>
        <span className="panel-h-meta">{(build.skills || []).length} setup{(build.skills || []).length === 1 ? '' : 's'}</span>
      </header>

      <div className="skills-list">
        {(build.skills || []).map((s) => {
          const isSel = selection?.kind === 'skill' && selection.id === s.id;
          return (
            <div key={s.id} className={`skill-row ${isSel ? 'is-sel' : ''}`}>
              <div className="skill-main" onClick={(e) => selectSkill(e, s)}>
                <GemIcon color={s.color} size={26} kind="skill" />
                <div className="skill-name-wrap">
                  <span className="skill-name">{s.name}</span>
                  <span className="skill-lvl mono">L{s.levelInterval?.[0] ?? 1}–{s.levelInterval?.[1] ?? 100}</span>
                </div>
                <button className="row-x" onClick={(e) => { e.stopPropagation(); removeSkill(s.id); }} title="Remove">×</button>
              </div>

              <div className="supports">
                {(s.supports || []).map((sup) => {
                  const supSel = selection?.kind === 'support' && selection.id === sup.id;
                  return (
                    <div key={sup.id} className={`support-row ${supSel ? 'is-sel' : ''}`}
                         onClick={(e) => selectSupport(e, sup, s)}>
                      <span className="support-rail" />
                      <GemIcon color={sup.color} size={18} kind="support" />
                      <span className="support-name">{sup.name}</span>
                      <button className="row-x" onClick={(e) => { e.stopPropagation(); removeSupport(s.id, sup.id); }} title="Remove">×</button>
                    </div>
                  );
                })}
                {adding?.parent === s.id ? (
                  <AddPicker query={query} setQuery={setQuery} results={filtered} onPick={addItem} onClose={closeAdd}
                    placeholder="Search support gems" />
                ) : (
                  <button className="add-btn add-btn-sub" onClick={() => openAddSupport(s.id)}>
                    <span className="add-plus">+</span> Support
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {adding?.parent == null ? (
          <AddPicker query={query} setQuery={setQuery} results={filtered} onPick={addItem} onClose={closeAdd}
            placeholder="Search skill gems" />
        ) : (
          (build.skills || []).length === 0 ? (
            <button className="add-btn add-btn-empty" onClick={openAddSkill}>
              <span className="add-plus">+</span> Add the first skill
            </button>
          ) : (
            <button className="add-btn" onClick={openAddSkill}>
              <span className="add-plus">+</span> Skill
            </button>
          )
        )}
      </div>
    </section>
  );
}

function AddPicker({ query, setQuery, results, onPick, onClose, placeholder }) {
  const inpRef = React.useRef(null);
  React.useEffect(() => { inpRef.current?.focus(); }, []);
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="add-picker" onClick={(e) => e.stopPropagation()}>
      <div className="add-picker-search">
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
          <circle cx="4.5" cy="4.5" r="3" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M7 7 L10 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
        <input ref={inpRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} />
        <button className="add-picker-x" onClick={onClose} title="Cancel (Esc)">esc</button>
      </div>
      <div className="add-picker-results">
        {results.length === 0 ? (
          <div className="add-picker-empty">No matches. The gem catalog ships with the build editor.</div>
        ) : (
          results.slice(0, 12).map((r) => (
            <button key={r.id} className="add-picker-item" onClick={() => onPick(r)}>
              <GemIcon color={r.color} size={20} kind={r.kind} />
              <span className="add-picker-name">{r.name}</span>
              <span className="add-picker-desc">{r.desc}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

window.SkillsPanel = SkillsPanel;
window.GemIcon = GemIcon;
