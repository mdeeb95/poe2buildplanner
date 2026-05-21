# buildProj

PoE2 build authoring tool (Filterblade-style). This repo currently hosts the **data extraction layer** — a sync pipeline that pulls PoE2 game data from PathOfBuilding-PoE2's upstream Lua files and normalizes them into typed JSON the UI will consume later.

## Quickstart

```bash
pnpm install
pnpm sync     # fetch + parse + validate + write data/*.json
pnpm test     # Layer 1 verification (algorithmic unit tests)
pnpm verify   # Layer 2 + 3 verification (data integrity + SVG render)
```

## Layout

- `scripts/sync/` — fetch + parse + normalize + validate + write
- `scripts/parse/` — Lua AST parser
- `scripts/verify/` — three-layer verification harness
- `src/schemas/` — Zod schemas (importable by the future Next.js app)
- `src/geometry/` — passive tree polar→screen math
- `data/` — committed output JSON files
- `.cache/` — gitignored raw PoB files keyed by commit SHA
- `POB_VERSION` — pinned PoB commit SHA (plain text)

## Data sources

All from `https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/<sha>/`:
- `src/TreeData/0_4/tree.json`
- `src/Data/Gems.lua` + `Data/Skills/*.lua`
- `src/Data/Bases/*.lua`
- `src/Data/StatDescriptions/*.lua`

Licensing: PoB's Lua extractor is MIT, but the extracted **data** is GGG-copyrighted under tolerated fan-use. Shipping this data carries the same risk PoB lives with.
