import { z } from "zod";
import { BuildStateSchema, type BuildState } from "@/schemas/build";

/** Live working build, autosaved so a refresh doesn't lose it. */
const DRAFT_KEY = "buildEditor.draft";
/** Named library of saved builds. */
const SAVED_KEY = "buildEditor.savedBuilds";
/** Id of the library entry the working build derives from (or absent). */
const CURRENT_ID_KEY = "buildEditor.currentId";

export const SavedBuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  build: BuildStateSchema,
  savedAt: z.number(),
});

export type SavedBuild = z.infer<typeof SavedBuildSchema>;

const SavedBuildListSchema = z.array(SavedBuildSchema);

export function newSavedId(): string {
  return `build-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---- Draft (current working build) ----------------------------------------

export function loadDraft(): BuildState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = BuildStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveDraft(build: BuildState): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(build));
  } catch {
    /* storage full or unavailable — ignore */
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* noop */
  }
}

// ---- Saved-builds library --------------------------------------------------

export function loadSavedBuilds(): SavedBuild[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = SavedBuildListSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function writeSavedBuilds(list: SavedBuild[]): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

// ---- Current library id ----------------------------------------------------

export function loadCurrentId(): string | null {
  try {
    return localStorage.getItem(CURRENT_ID_KEY) || null;
  } catch {
    return null;
  }
}

export function writeCurrentId(id: string | null): void {
  try {
    if (id) localStorage.setItem(CURRENT_ID_KEY, id);
    else localStorage.removeItem(CURRENT_ID_KEY);
  } catch {
    /* noop */
  }
}
