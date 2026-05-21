// tree.jsx — Passive tree canvas. Interactive: click to allocate, drag to pan,
// wheel to zoom, click empty space to clear selection. Supports three visual
// treatments (curved / hex / schematic) toggled via the Tweaks panel.

function buildAdjacency(edges) {
  const adj = new Map();
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  }
  return adj;
}

function PassiveTree({
  nodes, edges, labels,
  build, setBuild,
  selection, setSelection,
  treatment = 'curved',
  density = 'comfortable',
}) {
  const wrapRef = React.useRef(null);
  const svgRef = React.useRef(null);
  const [view, setView] = React.useState({ x: 0, y: 0, scale: 1 });
  const [hover, setHover] = React.useState(null);
  const [dragging, setDragging] = React.useState(false);
  const dragStartRef = React.useRef(null);
  const movedRef = React.useRef(false);

  const adj = React.useMemo(() => buildAdjacency(edges), [edges]);
  const allocated = React.useMemo(() => new Set(build.allocated || []), [build.allocated]);

  // Available nodes = direct neighbors of allocated nodes (not yet allocated themselves)
  const available = React.useMemo(() => {
    const out = new Set();
    for (const id of allocated) {
      const ns = adj.get(id);
      if (!ns) continue;
      for (const n of ns) if (!allocated.has(n)) out.add(n);
    }
    if (allocated.size === 0) out.add('origin');
    return out;
  }, [allocated, adj]);

  const nodeById = React.useMemo(() => {
    const m = new Map();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const toggle = (id) => {
    const nextAlloc = new Set(allocated);
    if (nextAlloc.has(id)) {
      // Don't allow deallocating the origin
      if (id === 'origin') return;
      nextAlloc.delete(id);
    } else {
      // Only allow allocation if it's available (a neighbor) — or origin
      if (id !== 'origin' && !available.has(id)) return;
      nextAlloc.add(id);
    }
    setBuild({ ...build, allocated: Array.from(nextAlloc) });
  };

  const onNodeClick = (e, n) => {
    e.stopPropagation();
    if (movedRef.current) return; // ignore click after a pan
    toggle(n.id);
    setSelection({
      kind: 'passive',
      id: n.id,
      name: n.name || (n.tier === 'small' ? 'Minor node' : 'Node'),
      tier: n.tier,
      levelInterval: (build.nodeLevels && build.nodeLevels[n.id]) ? [build.nodeLevels[n.id], 100] : [1, 100],
      anchorRef: e.currentTarget,
    });
  };

  // Pan / zoom
  const onBgMouseDown = (e) => {
    if (e.button !== 0) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    movedRef.current = false;
    setDragging(true);
  };
  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (ev) => {
      const s = dragStartRef.current;
      if (!s) return;
      const dx = ev.clientX - s.x;
      const dy = ev.clientY - s.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) movedRef.current = true;
      setView((v) => ({ ...v, x: s.vx + dx, y: s.vy + dy }));
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const onWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setView((v) => {
      const ns = Math.max(0.5, Math.min(2.4, v.scale * factor));
      // zoom toward cursor: keep cursor's tree-space point stable
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return { ...v, scale: ns };
      const cx = e.clientX - r.left - r.width / 2;
      const cy = e.clientY - r.top - r.height / 2;
      const k = ns / v.scale;
      const nx = cx - (cx - v.x) * k;
      const ny = cy - (cy - v.y) * k;
      return { x: nx, y: ny, scale: ns };
    });
  };

  const onBgClick = (e) => {
    if (movedRef.current) { movedRef.current = false; return; }
    setSelection(null);
  };

  const resetView = () => setView({ x: 0, y: 0, scale: 1 });
  const zoom = (d) => setView((v) => ({ ...v, scale: Math.max(0.5, Math.min(2.4, v.scale * (d > 0 ? 1.15 : 0.87))) }));

  // Render helpers per treatment
  const sizeFor = (tier) => {
    if (treatment === 'schematic') {
      return tier === 'keystone' ? 8 : tier === 'notable' ? 6 : 3.5;
    }
    return tier === 'keystone' ? 14 : tier === 'notable' ? 9 : 5;
  };

  const renderNode = (n) => {
    const isAlloc = allocated.has(n.id);
    const isAvail = available.has(n.id);
    const isSel = selection && selection.kind === 'passive' && selection.id === n.id;
    const isHover = hover === n.id;
    const r = sizeFor(n.tier);
    const lvl = build.nodeLevels && build.nodeLevels[n.id];
    const stateClass = [
      'pn',
      `pn-${n.tier}`,
      isAlloc ? 'pn-alloc' : (isAvail ? 'pn-avail' : 'pn-locked'),
      isSel ? 'pn-sel' : '',
      isHover ? 'pn-hover' : '',
    ].join(' ');

    const shape =
      treatment === 'hex' ? hexPath(n.x, n.y, r * 1.1)
      : null;

    return (
      <g key={n.id}
         className={stateClass}
         transform={`translate(${n.x}, ${n.y})`}
         onClick={(e) => onNodeClick(e, n)}
         onMouseEnter={() => setHover(n.id)}
         onMouseLeave={() => setHover((h) => h === n.id ? null : h)}>
        {/* selection ring */}
        {isSel && <circle r={r + 5} className="pn-ring" />}
        {/* halo for allocated */}
        {isAlloc && n.tier !== 'small' && <circle r={r + 3.5} className="pn-halo" />}

        {treatment === 'hex' ? (
          <path d={hexPathLocal(r * 1.1)} className="pn-shape" />
        ) : treatment === 'schematic' ? (
          n.tier === 'keystone'
            ? <rect x={-r} y={-r} width={r*2} height={r*2} className="pn-shape" />
            : <circle r={r} className="pn-shape" />
        ) : (
          <circle r={r} className="pn-shape" />
        )}

        {/* keystone inner mark */}
        {n.tier === 'keystone' && treatment !== 'schematic' && (
          <path d={`M ${-r*0.5} 0 L 0 ${-r*0.5} L ${r*0.5} 0 L 0 ${r*0.5} Z`} className="pn-inner" />
        )}

        {/* level overlay */}
        {isAlloc && lvl != null && n.tier !== 'small' && (
          <g className="pn-lvl">
            <circle r={6.5} cx={r + 3} cy={-r - 1} className="pn-lvl-bg" />
            <text x={r + 3} y={-r - 1} className="pn-lvl-tx" textAnchor="middle" dominantBaseline="central">{lvl}</text>
          </g>
        )}
      </g>
    );
  };

  // ── Edge rendering ──
  const renderEdge = ([a, b], i) => {
    const A = nodeById.get(a), B = nodeById.get(b);
    if (!A || !B) return null;
    const aA = allocated.has(a), aB = allocated.has(b);
    const isAlloc = aA && aB;
    const isAvail = (aA && available.has(b)) || (aB && available.has(a));
    const cls = `pe ${isAlloc ? 'pe-alloc' : (isAvail ? 'pe-avail' : 'pe-locked')}`;
    return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} className={cls} />;
  };

  // tree-space bounds
  const PAD = 80;
  const minX = Math.min(...nodes.map((n) => n.x)) - PAD;
  const maxX = Math.max(...nodes.map((n) => n.x)) + PAD;
  const minY = Math.min(...nodes.map((n) => n.y)) - PAD;
  const maxY = Math.max(...nodes.map((n) => n.y)) + PAD;
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  const hoverNode = hover ? nodeById.get(hover) : null;

  return (
    <div className={`tree tree-${treatment}`} ref={wrapRef}
         onWheel={onWheel} onMouseDown={onBgMouseDown} onClick={onBgClick}
         data-dragging={dragging ? '1' : '0'}>
      {treatment === 'schematic' && <div className="tree-grid" />}

      <svg ref={svgRef} className="tree-svg"
           viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
           preserveAspectRatio="xMidYMid meet">
        <g transform={`translate(${view.x / view.scale}, ${view.y / view.scale}) scale(${view.scale})`}>
          {/* edges first so they sit under nodes */}
          <g className="pe-layer">{edges.map(renderEdge)}</g>
          <g className="pn-layer">{nodes.map(renderNode)}</g>
          <g className="pl-layer">
            {labels.map((l, i) => (
              <text key={i} x={l.x} y={l.y} className="pl" textAnchor="middle">{l.label}</text>
            ))}
          </g>
        </g>
      </svg>

      {/* status overlay */}
      <div className="tree-status">
        <div className="tree-stat-cluster">
          <span className="tree-stat-n">{allocated.size}</span>
          <span className="tree-stat-l">allocated</span>
        </div>
        <div className="tree-stat-divider" />
        <div className="tree-stat-cluster tree-stat-muted">
          <span className="tree-stat-n">{available.size}</span>
          <span className="tree-stat-l">available</span>
        </div>
      </div>

      {/* hover tooltip */}
      {hoverNode && hoverNode.name && (
        <NodeTooltip node={hoverNode}
          allocated={allocated.has(hoverNode.id)}
          available={available.has(hoverNode.id)}
          level={build.nodeLevels?.[hoverNode.id]} />
      )}

      {/* zoom controls */}
      <div className="tree-zoom">
        <button onClick={() => zoom(1)} title="Zoom in">＋</button>
        <button onClick={() => zoom(-1)} title="Zoom out">−</button>
        <button onClick={resetView} title="Reset view">⟲</button>
      </div>

      {/* legend */}
      <div className="tree-legend">
        <div className="legend-row"><span className="dot dot-alloc" /> Allocated</div>
        <div className="legend-row"><span className="dot dot-avail" /> Reachable</div>
        <div className="legend-row"><span className="dot dot-locked" /> Locked</div>
      </div>
    </div>
  );
}

function NodeTooltip({ node, allocated, available, level }) {
  const status = allocated ? 'allocated' : available ? 'reachable' : 'locked';
  return (
    <div className="node-tip">
      <div className="node-tip-tier">{node.tier === 'keystone' ? 'KEYSTONE' : node.tier === 'notable' ? 'NOTABLE' : 'MINOR'}</div>
      <div className="node-tip-name">{node.name || 'Minor node'}</div>
      <div className="node-tip-meta">
        <span className={`node-tip-pill node-tip-${status}`}>{status}</span>
        {level != null && <span className="node-tip-level">taken at L{level}</span>}
      </div>
    </div>
  );
}

// Hex helpers — flat-top hex
function hexPathLocal(r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    pts.push(`${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

window.PassiveTree = PassiveTree;
