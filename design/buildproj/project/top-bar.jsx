// top-bar.jsx — Build metadata + ascendancy dropdown + export.

function TopBar({ build, setBuild, onExport, onNew }) {
  const [ascOpen, setAscOpen] = React.useState(false);
  const ascRef = React.useRef(null);

  React.useEffect(() => {
    if (!ascOpen) return;
    const onDown = (e) => {
      if (ascRef.current && !ascRef.current.contains(e.target)) setAscOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [ascOpen]);

  const passiveCount = build.allocated?.length || 0;
  const skillCount = build.skills?.length || 0;
  const itemCount = build.items?.length || 0;

  return (
    <header className="topbar">
      <div className="tb-mark" title="Build editor">
        <svg viewBox="0 0 22 22" width="20" height="20" aria-hidden="true">
          <path d="M11 1 L20 6 V16 L11 21 L2 16 V6 Z" fill="none" stroke="#c9a36b" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M11 6 V16 M6.5 8.5 L15.5 13.5 M15.5 8.5 L6.5 13.5" stroke="#c9a36b" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
        </svg>
      </div>

      <div className="tb-meta">
        <div className="tb-meta-row">
          <input
            className="tb-name"
            value={build.name || ''}
            placeholder="Untitled build"
            onChange={(e) => setBuild({ ...build, name: e.target.value })}
            spellCheck={false}
          />
          <div className="tb-asc" ref={ascRef}>
            <button className="tb-asc-btn" onClick={() => setAscOpen((v) => !v)}>
              <span className="tb-asc-class">{build.class || 'Class'}</span>
              <span className="tb-asc-dot">·</span>
              <span className="tb-asc-name">{build.ascendancy || 'Choose ascendancy'}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
            </button>
            {ascOpen && (
              <div className="tb-asc-menu" role="menu">
                {Object.entries(ASCENDANCIES).map(([cls, ascs]) => (
                  <div key={cls} className="tb-asc-group">
                    <div className="tb-asc-group-h">{cls}</div>
                    {ascs.map((a) => (
                      <button key={a}
                        className="tb-asc-item"
                        data-on={build.ascendancy === a ? '1' : '0'}
                        onClick={() => { setBuild({ ...build, class: cls, ascendancy: a }); setAscOpen(false); }}>
                        <span>{a}</span>
                        {build.ascendancy === a && <span className="tb-asc-tick">✓</span>}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <input
          className="tb-desc"
          value={build.description || ''}
          placeholder="One line of context — what this build does and when it comes online."
          onChange={(e) => setBuild({ ...build, description: e.target.value })}
          spellCheck={false}
        />
      </div>

      <div className="tb-stats">
        <div className="tb-stat"><span className="tb-stat-n">{passiveCount}</span><span className="tb-stat-l">passives</span></div>
        <div className="tb-stat"><span className="tb-stat-n">{skillCount}</span><span className="tb-stat-l">skills</span></div>
        <div className="tb-stat"><span className="tb-stat-n">{itemCount}</span><span className="tb-stat-l">items</span></div>
      </div>

      <div className="tb-actions">
        <button className="tb-btn" onClick={onNew} title="Start over from a template">New</button>
        <button className="tb-btn tb-btn-primary" onClick={onExport}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M6 1 V8 M3 5 L6 8 L9 5 M2 10 H10" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Export <span className="tb-btn-ext">.build</span></span>
        </button>
      </div>
    </header>
  );
}

window.TopBar = TopBar;
