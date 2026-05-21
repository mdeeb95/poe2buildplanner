// Fields containing PoB's damage-math primitives (mod() / skill() / flag() calls).
// We're not doing damage evaluation, so dropping these keeps the output clean
// instead of emitting half-populated arrays with values stripped to undefined.
export const STATMAP_SKIP_KEYS = new Set<string>([
  "statMap",
  "statMapMult",
  "supportStatMap",
  "baseMods",
  "constantMods",
  "preMod",
  "postMod",
]);
