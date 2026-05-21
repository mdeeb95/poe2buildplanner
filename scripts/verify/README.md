# Verification harness

Three layers, all required to pass before `data/tree.json` is trusted for pixel-exact rendering downstream.

## Layer 1 — Algorithmic (run via `pnpm test`)

`src/geometry/tree-position.test.ts` proves the polar→screen formula port is correct against hand-computed synthetic cases:
- Group center at orbit 0
- 12 / 3 / 6 / 9 o'clock cardinal angles on orbit 1
- Off-center group + non-cardinal angle
- Out-of-range orbit / orbitIndex / non-integer inputs throw

No PoB install required.

## Layer 2 — Data integrity (run via `pnpm verify`)

`scripts/verify/tree-integrity.ts` checks the synced `data/tree.json` for:
- Every node's `orbit` and `orbitIndex` are in range per `constants.skillsPerOrbit`.
- Every non-null `group` reference points to a valid group entry.
- Computed `(x, y)` falls within `bounds ± max orbit radius`.
- Adjacency is symmetric (every neighbor pointer has a reverse).
- Node count is plausible (≥1000 — sanity bound for the PoE2 0.4 tree).
- `(group, orbit, orbitIndex)` collisions are accounted for. PoE2 masteries deliberately share a center with their parent notable; these are detected and excluded. Any *unexplained* collision (neither side is a mastery) fails the run.

## Layer 3 — Visual sanity (run via `pnpm verify`)

`scripts/verify/render-tree-svg.ts` emits `data/_verify/tree.svg` — every node drawn as a colored circle at its computed `(x, y)`, every edge as a line.

Open it in a browser (`xdg-open data/_verify/tree.svg`) and compare to a known-good tree screenshot:
- The overall **shape** should match a PoE2 passive tree (six radial start branches, ascendancy clusters arranged around the perimeter).
- **Class start positions** (large green circles) should line up with PoB's class-start arrows.
- **Keystones** (large red circles) should sit where you'd expect from the in-game tree.
- **Ascendancy clusters** (purple) should appear as small subtrees outside the main ring.
- Edges should not show stretched diagonal lines spanning the whole tree — those would indicate wrong group references.

The SVG uses straight-line edges only. PoB renders curved arcs for circumferential connections — that's a downstream rendering concern, not a positioning concern.

### Capturing a reference screenshot

For a repeatable side-by-side check:
1. Open PoB-PoE2 or the in-game passive tree at a known character class.
2. Zoom to fit the whole tree.
3. Screenshot to `scripts/verify/fixtures/pob-tree-reference.png` (gitignored).
4. Open both side-by-side. Notable density and class-start angles should match.
