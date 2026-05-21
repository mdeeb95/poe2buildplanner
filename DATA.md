# Game data and assets

This repository ships JSON catalogs and passive-tree artwork used by the web app. They are **not** original Grinding Gear Games content.

## Source

Data is extracted from [PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2) at the commit pinned in [`POB_VERSION`](POB_VERSION). Run `pnpm sync` to refresh from upstream.

| Output | Upstream |
|--------|----------|
| `data/tree.json`, `data/gems.json`, `data/bases.json`, `data/uniques.json` | PoB Lua / JSON under `src/Data/` and `src/TreeData/0_4/` |
| `data/tree-art.json`, `public/tree/*.webp` | PoB `TreeData/0_4` DDS atlases (converted during sync) |
| `data/stat-descriptions.json` | PoB stat description Lua (synced for future use; **not** served by the app today) |

Provenance metadata lives in `data/_meta.json` (`pobCommit`, `fetchedAt`).

## Licensing

- **Path of Building tooling** (Lua extractor, tree math) is MIT-licensed in the PoB project.
- **Extracted game data and art** remain copyright of Grinding Gear Games. Community fan tools (including Path of Building) operate under the same tolerated fan-use posture as other PoE planners. This project does **not** grant you rights to redistribute GGG assets beyond that community practice.

## Your responsibilities

If you fork or redeploy:

1. Keep `POB_VERSION` and attribution honest when you re-sync.
2. Do not imply official affiliation with Grinding Gear Games (see the in-app footer).
3. Read [GGG's legal / fan-site guidance](https://www.pathofexile.com/legal) before large public promotion.

Application **source code** in this repo is MIT-licensed — see [`LICENSE`](LICENSE).
