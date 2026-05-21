import { createEmptyBuild } from "./defaults";
import { fromLevelInterval, passiveExportLevel, toLevelInterval } from "./levels";
import type { BuildState, GearItem, SkillSetup } from "@/schemas/build";
import { BuildFileSchema, type BuildFile } from "@/schemas/build-file";
import type { TreeClass } from "@/schemas/tree";

function classForAscendancy(classes: TreeClass[], ascendancy: string): string {
  if (!ascendancy) return "";
  for (const cls of classes) {
    if (cls.ascendancies.some((a) => a.name === ascendancy)) return cls.name;
  }
  return "";
}

function newEditorId(prefix: string, gameId: string): string {
  return `${prefix}-${gameId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Editor working state → `.build` JSON object. */
export function buildToFile(build: BuildState): BuildFile {
  return {
    name: build.name || "Untitled build",
    description: build.description || "",
    ascendancy: build.ascendancy || "",
    passives: build.allocated.map((id) => ({
      id,
      level_interval: toLevelInterval(passiveExportLevel(build, id)),
      weapon_set: build.passiveWeaponSet[id] ?? 0,
      additional_text: "",
    })),
    skills: build.skills.map((s) => ({
      id: s.skillId,
      level_interval: s.levelInterval,
      additional_text: s.additionalText ?? "",
      support_skills: s.supports.map((sup) => ({
        id: sup.skillId,
        level_interval: sup.levelInterval,
        additional_text: sup.additionalText ?? "",
      })),
    })),
    items: build.items.map((i) => ({
      inventory_id: i.slot,
      slot_x: 0,
      slot_y: 0,
      level_interval: i.levelInterval,
      unique_name: i.mode === "unique" ? i.unique_name ?? "" : "",
      additional_text: i.mode === "rare" ? i.desc ?? "" : "",
    })),
  };
}

/** `.build` JSON object → editor working state. */
export function buildFromFile(raw: unknown, classes: TreeClass[]): BuildState {
  const parsed = BuildFileSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues[0];
    const where = detail?.path.join(".") || "file";
    throw new Error(`Invalid .build file (${where}): ${detail?.message ?? "parse error"}`);
  }
  const file = parsed.data;
  const base = createEmptyBuild();

  const allocated: string[] = [];
  const passiveWeaponSet: BuildState["passiveWeaponSet"] = {};
  const nodeLevels: Record<string, number> = {};

  for (const p of file.passives) {
    const id = p.id;
    if (!allocated.includes(id)) allocated.push(id);
    nodeLevels[id] = fromLevelInterval(p.level_interval);
    if (p.weapon_set === 1 || p.weapon_set === 2) {
      passiveWeaponSet[id] = p.weapon_set;
    }
  }

  const skills: SkillSetup[] = file.skills.map((s) => ({
    id: newEditorId("skill", s.id),
    skillId: s.id,
    name: s.id,
    color: "white" as const,
    levelInterval: s.level_interval,
    additionalText: s.additional_text ?? "",
    supports: s.support_skills.map((sup) => ({
      id: newEditorId("sup", sup.id),
      skillId: sup.id,
      name: sup.id,
      color: "white" as const,
      levelInterval: sup.level_interval,
      additionalText: sup.additional_text ?? "",
    })),
  }));

  const items: GearItem[] = file.items.map((i) => {
    const unique = (i.unique_name ?? "").trim();
    const desc = (i.additional_text ?? "").trim();
    if (unique) {
      return {
        slot: i.inventory_id,
        mode: "unique" as const,
        unique_name: unique,
        levelInterval: i.level_interval,
      };
    }
    return {
      slot: i.inventory_id,
      mode: "rare" as const,
      desc,
      levelInterval: i.level_interval,
    };
  });

  return {
    ...base,
    name: file.name,
    description: file.description,
    ascendancy: file.ascendancy,
    className: classForAscendancy(classes, file.ascendancy),
    allocated,
    passiveWeaponSet,
    nodeLevels,
    skills,
    items,
  };
}

export function buildFileDownloadName(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9_\- ]/g, "").trim() || "MyBuild";
  return `${safe}.build`;
}

export function downloadBuildFile(build: BuildState): void {
  const json = buildToFile(build);
  const blob = new Blob([JSON.stringify(json, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildFileDownloadName(build.name);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
