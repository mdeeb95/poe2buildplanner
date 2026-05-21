# Contributing

Thanks for helping improve the PoE2 build planner.

## Development

```bash
pnpm install
pnpm dev          # Next.js dev server (http://localhost:3000 by default)
pnpm test         # unit tests (vitest)
pnpm verify       # data integrity + tree SVG checks (after sync)
pnpm build        # production build + standalone asset copy
```

Requires Node **≥ 22.13** and pnpm **11.x** (see `packageManager` in `package.json`).

## Pull requests

1. Branch from `main`.
2. Run `pnpm test` before opening a PR.
3. If you change game data or tree art, run `pnpm sync` and `pnpm verify`, then commit the updated `data/` and `public/tree/` outputs with a note in the PR describing the `POB_VERSION` bump.

## Updating game data

1. Set a new commit SHA in [`POB_VERSION`](POB_VERSION).
2. Run `pnpm sync` (downloads PoB upstream into `.cache/`, writes JSON + WebP).
3. Run `pnpm verify`.
4. Commit `POB_VERSION`, `data/_meta.json`, and any changed `data/*.json` / `public/tree/` files.

See [`DATA.md`](DATA.md) for licensing notes on shipped game data.

## Questions

Open a [GitHub issue](https://github.com/mdeeb95/poe2buildplanner/issues) for bugs or feature ideas.
