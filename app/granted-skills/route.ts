import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GrantedSkill } from "@/schemas/granted-skills";

// Derives the tree's passively-granted active skills (e.g. ascendancy notables
// like Spirit Walker's "Wild Protector") from `Grants Skill: X` node stats, and
// links each to a catalog active gem by name when one exists so the Skills
// panel gets real support compatibility + gem colour. Skills with no catalog
// entry (many ascendancy grants) fall back to a synthetic id + the node icon.

const TREE_PATH = path.join(process.cwd(), "data", "tree.json");
const GEMS_PATH = path.join(process.cwd(), "data", "gems.json");
const GRANTS_RE = /^Grants Skill:\s*(.+)$/;

type UiColor = "red" | "green" | "blue" | "white";

function colorFromGem(c: unknown): UiColor {
  return c === "str" ? "red" : c === "dex" ? "green" : c === "int" ? "blue" : "white";
}

interface RawNode {
  name?: string;
  icon?: string | null;
  stats?: string[];
}
interface RawActiveGem {
  name?: string;
  baseTypeName?: string;
  color?: string;
  tags?: Record<string, boolean>;
}

let cache: { etag: string; body: string } | null = null;

async function buildBody(): Promise<string> {
  const [treeRaw, gemsRaw] = await Promise.all([
    readFile(TREE_PATH, "utf8"),
    readFile(GEMS_PATH, "utf8").catch(() => null),
  ]);

  const tree = JSON.parse(treeRaw) as { nodes?: Record<string, RawNode> };
  const gems = gemsRaw
    ? (JSON.parse(gemsRaw) as { active?: Record<string, RawActiveGem> })
    : null;

  // name → { skillId, color } for active gems that grant a skill (ascendancy etc.).
  const byName = new Map<string, { skillId: string; color: UiColor }>();
  if (gems?.active) {
    for (const [id, g] of Object.entries(gems.active)) {
      if (!g?.tags?.grants_active_skill) continue;
      const entry = { skillId: id, color: colorFromGem(g.color) };
      for (const key of [g.name, g.baseTypeName]) {
        if (key && !byName.has(key)) byName.set(key, entry);
      }
    }
  }

  const skills: GrantedSkill[] = [];
  for (const [nodeId, node] of Object.entries(tree.nodes ?? {})) {
    if (!node || !Array.isArray(node.stats)) continue;
    let grantedName: string | null = null;
    for (const stat of node.stats) {
      const m = GRANTS_RE.exec(stat);
      if (m) {
        grantedName = m[1]!.trim();
        break;
      }
    }
    if (!grantedName) continue;
    const match = byName.get(grantedName);
    skills.push({
      nodeId,
      skillId: match?.skillId ?? `granted:${nodeId}`,
      name: grantedName,
      icon: node.icon ?? null,
      color: match?.color ?? "white",
    });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return JSON.stringify({ skills });
}

export async function GET(request: Request) {
  if (!cache) {
    const body = await buildBody();
    cache = { etag: `"granted-${body.length}"`, body };
  }
  if (request.headers.get("if-none-match") === cache.etag) {
    return new Response(null, { status: 304, headers: { ETag: cache.etag } });
  }
  return new Response(cache.body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      ETag: cache.etag,
    },
  });
}
