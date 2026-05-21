# Unofficial PoE2 Build Planner

Filterblade-style **Path of Exile 2** build planner: passive tree, gear, and skills in the browser. **Unofficial fan tool — not affiliated with Grinding Gear Games.**

- **Source:** [github.com/mdeeb95/poe2buildplanner](https://github.com/mdeeb95/poe2buildplanner)
- **License:** MIT for application code — see [`LICENSE`](LICENSE)
- **Game data:** GGG-derived assets from Path of Building — see [`DATA.md`](DATA.md)

## Quickstart (app)

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # production build + standalone asset copy
pnpm start      # run standalone server (after build)
```

Requires Node **≥ 22.13** and pnpm **11.x**.

## Data pipeline

Game catalogs and tree art are synced from [PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2) at the pin in [`POB_VERSION`](POB_VERSION):

```bash
pnpm sync       # fetch + parse + validate + write data/*.json + public/tree/
pnpm test       # unit tests
pnpm verify     # data integrity + tree SVG render checks
```

Re-run `pnpm sync` after bumping `POB_VERSION`. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full workflow.

## Layout

- `app/`, `components/` — Next.js UI
- `lib/build/` — build state, gems, allocation logic
- `scripts/sync/` — fetch + parse + normalize + validate + write
- `scripts/parse/` — Lua AST parser
- `scripts/verify/` — verification harness ([details](scripts/verify/README.md))
- `src/schemas/` — Zod schemas
- `src/geometry/` — passive tree polar→screen math
- `data/` — committed JSON served at runtime
- `public/tree/` — passive tree icon atlases and frames (from sync)
- `.cache/` — gitignored raw PoB files keyed by commit SHA

## Deploy (maintainer)

Hosted on [Railway](https://railway.app) with Railpack (`railway.toml`). Production needs **no API keys** today.

```bash
pnpm build:railway   # full or cached Next standalone build
pnpm deploy          # railway up (requires Railway CLI + project link)
```

Standalone output uses `next.config.mjs` `output: "standalone"`; `scripts/copy-standalone-assets.mjs` bundles `public/`, static assets, and `data/`.

Optional env vars: see [`.env.example`](.env.example).

## Data sources

All upstream paths are under `https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/<sha>/`:

- `src/TreeData/0_4/tree.json`
- `src/Data/Gems.lua` + `Data/Skills/*.lua`
- `src/Data/Bases/*.lua`
- `src/Data/StatDescriptions/*.lua`
- `src/TreeData/0_4/` — tree JSON plus icon/frame atlases (`.dds.zst`)

Passive node icons and frames are **not** read from a local PoE install. `pnpm sync` converts PoB atlases to WebP under `public/tree/` and writes `data/tree-art.json`.

## Legal

- **This repo's code:** MIT ([`LICENSE`](LICENSE)).
- **Shipped game data and art:** Grinding Gear Games copyright; community fan-use posture as with Path of Building. Details in [`DATA.md`](DATA.md).

## Contributing & security

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
