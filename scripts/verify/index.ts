import { verifyTreeIntegrity } from "./tree-integrity.js";
import { renderTreeSvg } from "./render-tree-svg.js";

async function main() {
  let exitCode = 0;

  console.log("[verify] Layer 2: tree integrity");
  const integrity = await verifyTreeIntegrity();
  for (const [k, v] of Object.entries(integrity.stats)) {
    console.log(`           ${k}: ${v}`);
  }
  if (integrity.ok) {
    console.log("           ✓ all checks passed");
  } else {
    console.log("           ✗ FAILED");
    for (const f of integrity.failures) {
      console.log(`           [${f.layer}] ${f.message}`);
    }
    exitCode = 1;
  }

  console.log("\n[verify] Layer 3: render full-tree SVG");
  const svg = await renderTreeSvg();
  console.log(`           wrote ${svg.outputPath} (${svg.nodeCount} nodes, ${svg.edgeCount} edges)`);
  console.log(`           open it in a browser and compare against a PoB/in-game tree screenshot`);

  if (exitCode === 0) {
    console.log("\n[verify] All layers passed.");
  } else {
    console.log("\n[verify] One or more layers failed.");
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("[verify] FAILED:", err);
  process.exit(1);
});
