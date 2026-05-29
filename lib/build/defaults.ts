import type { BuildState } from "@/schemas/build";

export function createEmptyBuild(): BuildState {
  return {
    name: "Untitled build",
    description: "",
    className: "",
    ascendancy: "",
    allocated: [],
    passiveWeaponSet: {},
    nodeLevels: {},
    nodeNotes: {},
    skills: [],
    items: [],
  };
}
