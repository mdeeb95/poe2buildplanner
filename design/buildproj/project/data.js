// data.js — sample data + procedural tree generation for the .build editor
// All node IDs are stable strings; positions are in an abstract -500..500 space.

(function () {
  // ── Tree generation ──────────────────────────────────────────────────────
  // Six spokes from a central origin, each carrying three clusters that end
  // in a keystone. Small nodes are scattered along each branch with side
  // tendrils. Layout is deterministic — no RNG.

  const NODES = [];
  const EDGES = [];

  // tier: 'small' | 'notable' | 'keystone'
  const addNode = (id, x, y, tier, name) => {
    NODES.push({ id, x, y, tier, name });
  };
  const addEdge = (a, b) => EDGES.push([a, b]);

  // central origin
  addNode('origin', 0, 0, 'notable', 'Path of Exiles');

  const SPOKE_NAMES = [
    'Bloodfields',     // martial bleed
    'Stormhold',       // lightning
    'Frostmire',       // cold
    'Pyrelight',       // fire
    'Hollow Veil',     // chaos / spectral
    'Stoneward',       // armor / minion
  ];

  const SPOKE_KEYSTONES = [
    'Crimson Engine',
    'Tempest Conduit',
    'Glacial Refrain',
    'Cinder Pact',
    'Veiled Reckoning',
    'Bulwark Doctrine',
  ];

  const NOTABLE_POOL = [
    'Sanguine Edge','Razor Cadence','Open Wound','Slow Bleed','Crimson Dance',
    'Voltaic Field','Stormcrash','Conduction','Galvanic Wake','Static Bind',
    'Hoarfrost','Bonemarrow','Brittle Touch','Glacial Aim','Cryomancy',
    'Cinder Pact','Wildfire','Combustion','Pyre Mastery','Smoldering',
    'Spectral Aim','Profane Ward','Hex Reach','Withering Touch','Soul Eater',
    'Iron Reflex','Bastion','Phalanx Drill','Shield Crash','Aegis Reflex',
  ];

  // 6 spokes radiating out at 60° intervals
  for (let s = 0; s < 6; s++) {
    const ang = (s / 6) * Math.PI * 2 - Math.PI / 2; // start up
    const ux = Math.cos(ang), uy = Math.sin(ang);
    // perpendicular for side branches
    const px = -uy, py = ux;

    const spokeId = `spoke-${s}`;
    // First step out from origin: small connector
    const c0 = `${spokeId}-c0`;
    addNode(c0, ux * 50, uy * 50, 'small', '');
    addEdge('origin', c0);

    // Three clusters along the spoke at radii 140 / 260 / 380
    const radii = [140, 260, 380];
    let prevHub = c0;
    for (let r = 0; r < radii.length; r++) {
      const rad = radii[r];
      const hubId = `${spokeId}-h${r}`;
      const hx = ux * rad;
      const hy = uy * rad;
      // Notable at each hub
      const notableName = NOTABLE_POOL[s * 5 + r] || `Notable ${s}-${r}`;
      addNode(hubId, hx, hy, 'notable', notableName);
      addEdge(prevHub, hubId);

      // 3-4 small nodes flanking the hub
      const sideCount = r === 0 ? 3 : 4;
      for (let i = 0; i < sideCount; i++) {
        const t = (i + 1) / (sideCount + 1) - 0.5; // -0.5..0.5
        const off = 50 + (i % 2) * 16;
        const sxp = hx + px * t * 90 + ux * (i % 2 === 0 ? -off * 0.4 : off * 0.4);
        const syp = hy + py * t * 90 + uy * (i % 2 === 0 ? -off * 0.4 : off * 0.4);
        const sid = `${spokeId}-h${r}-s${i}`;
        addNode(sid, sxp, syp, 'small', '');
        addEdge(hubId, sid);
        if (i > 0) addEdge(`${spokeId}-h${r}-s${i - 1}`, sid);
      }
      prevHub = hubId;
    }
    // Keystone at the tip
    const ksId = `${spokeId}-keystone`;
    const ksName = SPOKE_KEYSTONES[s];
    addNode(ksId, ux * 470, uy * 470, 'keystone', ksName);
    addEdge(prevHub, ksId);

    // A couple of small approach nodes around the keystone
    for (let i = 0; i < 3; i++) {
      const t = (i - 1) * 36;
      const angle = ang + (t * Math.PI) / 180;
      const ksx = Math.cos(angle) * 415;
      const ksy = Math.sin(angle) * 415;
      const sid = `${ksId}-app${i}`;
      addNode(sid, ksx, ksy, 'small', '');
      addEdge(ksId, sid);
      if (i === 1) addEdge(prevHub, sid);
    }
  }

  // Inter-spoke connectors at outer ring — gives the tree network feel
  for (let s = 0; s < 6; s++) {
    const ns = (s + 1) % 6;
    addEdge(`spoke-${s}-h2`, `spoke-${ns}-h2`);
  }

  // Spoke labels (for the cluster headings overlaid on the canvas)
  const SPOKE_LABELS = SPOKE_NAMES.map((label, s) => {
    const ang = (s / 6) * Math.PI * 2 - Math.PI / 2;
    return {
      label,
      x: Math.cos(ang) * 460,
      y: Math.sin(ang) * 460 - 40, // sit above the keystone
    };
  });

  window.TREE_NODES = NODES;
  window.TREE_EDGES = EDGES;
  window.TREE_LABELS = SPOKE_LABELS;

  // ── Sample builds ────────────────────────────────────────────────────────

  // Helper to derive a path-ish allocation by picking a spoke and the chain along it
  const allocateChain = (spokeIdx, depth = 3) => {
    const ids = ['origin', `spoke-${spokeIdx}-c0`];
    for (let r = 0; r < depth; r++) {
      ids.push(`spoke-${spokeIdx}-h${r}`);
      // include 1-2 side smalls per cluster
      ids.push(`spoke-${spokeIdx}-h${r}-s0`);
      if (r >= 1) ids.push(`spoke-${spokeIdx}-h${r}-s1`);
    }
    if (depth >= 3) ids.push(`spoke-${spokeIdx}-keystone`);
    return ids;
  };

  const WARRIOR = {
    name: 'Bleedchain Titan',
    description: 'Sustained physical bleeds on a slow two-hander. Stack hits, then watch them tick.',
    ascendancy: 'Titan',
    class: 'Warrior',
    allocated: allocateChain(0, 3).concat(allocateChain(5, 2)),
    // tiny per-node level overlays (which level the node is taken)
    nodeLevels: {
      'origin': 1, 'spoke-0-c0': 2,
      'spoke-0-h0': 6, 'spoke-0-h0-s0': 8,
      'spoke-0-h1': 18, 'spoke-0-h1-s0': 19, 'spoke-0-h1-s1': 20,
      'spoke-0-h2': 38, 'spoke-0-h2-s0': 39, 'spoke-0-h2-s1': 41,
      'spoke-0-keystone': 56,
      'spoke-5-c0': 28,
      'spoke-5-h0': 32, 'spoke-5-h0-s0': 33,
      'spoke-5-h1': 48, 'spoke-5-h1-s0': 49, 'spoke-5-h1-s1': 50,
    },
    skills: [
      {
        id: 'BleedingEdge', name: 'Bleeding Edge', color: 'red',
        levelInterval: [12, 100],
        supports: [
          { id: 'Brutality', name: 'Brutality', color: 'red', levelInterval: [18, 100] },
          { id: 'BloodlustSupport', name: 'Bloodlust', color: 'red', levelInterval: [24, 100] },
          { id: 'MartialTempo', name: 'Martial Tempo', color: 'green', levelInterval: [16, 100] },
          { id: 'OverpowerSupport', name: 'Overpower', color: 'red', levelInterval: [28, 100] },
        ],
      },
      {
        id: 'LeapSlam', name: 'Leap Slam', color: 'red',
        levelInterval: [2, 100],
        supports: [
          { id: 'LongerLeap', name: 'Reaching', color: 'green', levelInterval: [8, 100] },
          { id: 'Momentum', name: 'Momentum', color: 'green', levelInterval: [14, 100] },
        ],
      },
      {
        id: 'Sunder', name: 'Sunder', color: 'red',
        levelInterval: [4, 60],
        supports: [
          { id: 'Iron', name: 'Iron Will', color: 'red', levelInterval: [10, 60] },
          { id: 'StunSupport', name: 'Heavy Swing', color: 'red', levelInterval: [12, 60] },
        ],
      },
      {
        id: 'WarBanner', name: 'War Banner', color: 'red',
        levelInterval: [24, 100],
        supports: [
          { id: 'AuraSupport', name: 'Empower', color: 'red', levelInterval: [32, 100] },
        ],
      },
    ],
    items: [
      { slot: 'Weapon1', mode: 'unique', unique_name: "The Crimson Storm", levelInterval: [40, 100] },
      { slot: 'BodyArmour', mode: 'rare', desc: 'Rare body armour with 120+ life, 30%+ chaos resistance, and an open prefix for crafting.', levelInterval: [50, 100] },
      { slot: 'Helmet', mode: 'rare', desc: 'Life, accuracy, one resist. Look for a fractured base.', levelInterval: [35, 100] },
      { slot: 'Gloves', mode: 'unique', unique_name: 'Reaver\u2019s Cuffs', levelInterval: [44, 100] },
      { slot: 'Boots', mode: 'rare', desc: 'Movement speed 25%+, life, two resists.', levelInterval: [28, 100] },
      { slot: 'Belt', mode: 'rare', desc: 'Heavy belt. Life, armor, flask charges, one resist.', levelInterval: [30, 100] },
      { slot: 'Amulet', mode: 'unique', unique_name: 'Throatseeker', levelInterval: [55, 100] },
      { slot: 'Ring1', mode: 'rare', desc: 'Life, one resist, mana.', levelInterval: [20, 100] },
      { slot: 'Ring2', mode: 'rare', desc: 'Life, two resists.', levelInterval: [20, 100] },
    ],
  };

  const SORC = {
    name: 'Frostbite Stormweaver',
    description: 'Cold-conversion cast-on-crit. Glacial scaffolding from L24.',
    ascendancy: 'Stormweaver',
    class: 'Sorceress',
    allocated: allocateChain(2, 3).concat(allocateChain(1, 2)),
    nodeLevels: {
      'origin': 1, 'spoke-2-c0': 2,
      'spoke-2-h0': 6, 'spoke-2-h0-s0': 7,
      'spoke-2-h1': 16, 'spoke-2-h1-s0': 17, 'spoke-2-h1-s1': 18,
      'spoke-2-h2': 34, 'spoke-2-h2-s0': 35, 'spoke-2-h2-s1': 36,
      'spoke-2-keystone': 50,
      'spoke-1-c0': 22,
      'spoke-1-h0': 26, 'spoke-1-h0-s0': 28,
      'spoke-1-h1': 42, 'spoke-1-h1-s0': 43, 'spoke-1-h1-s1': 44,
    },
    skills: [
      {
        id: 'IceNova', name: 'Ice Nova', color: 'blue',
        levelInterval: [10, 100],
        supports: [
          { id: 'AddedCold', name: 'Added Cold Damage', color: 'blue', levelInterval: [12, 100] },
          { id: 'SpellEcho', name: 'Spell Echo', color: 'blue', levelInterval: [18, 100] },
          { id: 'Hypothermia', name: 'Hypothermia', color: 'blue', levelInterval: [28, 100] },
        ],
      },
      {
        id: 'Frostbolt', name: 'Frostbolt', color: 'blue',
        levelInterval: [2, 100],
        supports: [
          { id: 'GMP', name: 'Greater Multiple Projectiles', color: 'green', levelInterval: [20, 100] },
          { id: 'Pierce', name: 'Pierce', color: 'green', levelInterval: [10, 100] },
        ],
      },
      {
        id: 'FrostWall', name: 'Frost Wall', color: 'blue',
        levelInterval: [8, 100],
        supports: [
          { id: 'Cull', name: 'Culling Strike', color: 'green', levelInterval: [28, 100] },
        ],
      },
    ],
    items: [
      { slot: 'Weapon1', mode: 'unique', unique_name: 'The Whispering Ice', levelInterval: [33, 100] },
      { slot: 'BodyArmour', mode: 'rare', desc: 'Energy shield, two resists, life roll.', levelInterval: [44, 100] },
      { slot: 'Helmet', mode: 'rare', desc: 'Energy shield, mana, one resist. Lab enchant for Ice Nova.', levelInterval: [38, 100] },
      { slot: 'Gloves', mode: 'rare', desc: 'Cast speed, ES, life.', levelInterval: [30, 100] },
      { slot: 'Boots', mode: 'rare', desc: '30% movement speed, ES, two resists.', levelInterval: [28, 100] },
      { slot: 'Belt', mode: 'unique', unique_name: 'Bitterbind Point', levelInterval: [45, 100] },
      { slot: 'Amulet', mode: 'rare', desc: 'Spell damage, mana, +1 cold gems.', levelInterval: [40, 100] },
      { slot: 'Ring1', mode: 'rare', desc: 'Life, mana, one resist.', levelInterval: [20, 100] },
      { slot: 'Ring2', mode: 'unique', unique_name: 'Pyroshock Clasp', levelInterval: [44, 100] },
    ],
  };

  const EMPTY = {
    name: 'Untitled build',
    description: '',
    ascendancy: '',
    class: '',
    allocated: [],
    nodeLevels: {},
    skills: [],
    items: [],
  };

  // PoE2-style inventory grid (8 cols × 7 rows). Weapon-set slots carry a
  // `set` flag so the gear panel can swap them via the I/II tabs.
  const SLOT_LAYOUT = [
    { id: 'Weapon1',    label: 'Weapon',  set: 1, x: 0, y: 0, w: 2, h: 4 },
    { id: 'Offhand1',   label: 'Offhand', set: 1, x: 6, y: 0, w: 2, h: 4 },
    { id: 'Weapon2',    label: 'Weapon',  set: 2, x: 0, y: 0, w: 2, h: 4 },
    { id: 'Offhand2',   label: 'Offhand', set: 2, x: 6, y: 0, w: 2, h: 4 },
    { id: 'Helmet',     label: 'Helm',           x: 3, y: 0, w: 2, h: 2 },
    { id: 'Amulet',     label: 'Amulet',         x: 5, y: 0, w: 1, h: 1 },
    { id: 'BodyArmour', label: 'Body',           x: 3, y: 2, w: 2, h: 3 },
    { id: 'Ring1',      label: 'Ring',           x: 2, y: 3, w: 1, h: 1 },
    { id: 'Ring2',      label: 'Ring',           x: 5, y: 3, w: 1, h: 1 },
    { id: 'Belt',       label: 'Belt',           x: 3, y: 5, w: 2, h: 1 },
    { id: 'Gloves',     label: 'Gloves',         x: 0, y: 5, w: 2, h: 2 },
    { id: 'Boots',      label: 'Boots',          x: 6, y: 5, w: 2, h: 2 },
  ];

  const ASCENDANCIES = {
    Warrior: ['Titan', 'Warbringer'],
    Sorceress: ['Stormweaver', 'Chronomancer'],
    Ranger: ['Deadeye', 'Pathfinder'],
    Witch: ['Infernalist', 'Blood Mage'],
    Monk: ['Invoker', 'Acolyte of Chayula'],
    Mercenary: ['Witchhunter', 'Gemling Legionnaire'],
  };

  window.SAMPLE_BUILDS = { empty: EMPTY, warrior: WARRIOR, sorceress: SORC };
  window.SLOT_LAYOUT = SLOT_LAYOUT;
  window.ASCENDANCIES = ASCENDANCIES;
})();
