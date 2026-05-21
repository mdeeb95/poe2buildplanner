"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AddPicker } from "@/components/AddPicker";
import { GemIcon } from "@/components/GemIcon";
import { LevelPickerPopover } from "@/components/LevelPickerPopover";
import {
  activeToPickerRow,
  supportToPickerRow,
  type GemPickerRow,
} from "@/lib/build/gem-ui";
import { fetchAppJson } from "@/lib/data/fetch-app-json";
import { formatGemLevel, normalizeLevelInterval } from "@/lib/build/levels";
import {
  defaultSkillAdditionalText,
  defaultSupportAdditionalText,
  syncBuildGemAdditionalText,
} from "@/lib/build/gem-additional-text";
import { defaultSkillLevelInterval } from "@/lib/build/skill-craft-level";
import {
  nextSupportTierId,
  supportFamilyKey,
  supportPickerRank,
  normalizeSupportFamilyIntervals,
  supportSetupsForAdd,
  type SupportPickerRankContext,
} from "@/lib/build/support-gem-family";
import {
  defaultSupportLevelInterval,
  supportCraftRequirementLevel,
} from "@/lib/build/support-craft-level";
import { fuzzyMatchAny } from "@/lib/build/fuzzy-search";
import type { BuildState, SkillSetup } from "@/schemas/build";
import { GemsFileSchema, type ActiveGem, type GemsFile } from "@/schemas/gem";

interface SkillsPanelProps {
  build: BuildState;
  setBuild: React.Dispatch<React.SetStateAction<BuildState>>;
}

type AddingState =
  | { mode: "skill" }
  | { mode: "support"; parentId: string; replaceSupportId?: string }
  | null;

type GemLevelTarget =
  | { kind: "skill"; skillId: string }
  | { kind: "support"; skillId: string; supportId: string };

interface LevelPickerState {
  target: GemLevelTarget;
  currentInterval: [number, number];
  clientX: number;
  clientY: number;
}

function GemAdditionalEditor({
  value,
  placeholder,
  onChange,
  onReset,
  className,
}: {
  value: string;
  placeholder: string;
  onChange: (text: string) => void;
  onReset?: () => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const syncHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  return (
    <div
      className={`gem-additional-edit ${className ?? ""}`.trim()}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={inputRef}
        className="gem-additional-input"
        value={value}
        placeholder={placeholder}
        rows={1}
        onChange={(e) => {
          onChange(e.target.value);
          requestAnimationFrame(syncHeight);
        }}
      />
      {onReset ? (
        <button type="button" className="gem-additional-reset" onClick={onReset}>
          Reset to default
        </button>
      ) : null}
    </div>
  );
}

export function SkillsPanel({ build, setBuild }: SkillsPanelProps) {
  const [gems, setGems] = useState<GemsFile | null>(null);
  const [adding, setAdding] = useState<AddingState>(null);
  const [query, setQuery] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedSupportId, setSelectedSupportId] = useState<string | null>(null);
  const [levelPicker, setLevelPicker] = useState<LevelPickerState | null>(null);

  useEffect(() => {
    let aborted = false;
    fetchAppJson("/gems")
      .then(async (data) => {
        const parsed = GemsFileSchema.safeParse(data);
        if (!parsed.success) throw new Error(parsed.error.message.slice(0, 120));
        if (!aborted) setGems(parsed.data);
      })
      .catch(() => {
        /* gems unavailable — picker stays empty */
      });
    return () => {
      aborted = true;
    };
  }, []);

  useEffect(() => {
    if (!gems) return;
    setBuild((prev) => {
      const synced = syncBuildGemAdditionalText(prev, gems);
      return {
        ...synced,
        skills: synced.skills.map((s) => ({
          ...s,
          supports: normalizeSupportFamilyIntervals(s.supports, gems),
        })),
      };
    });
  }, [gems, setBuild]);

  const activeRows = useMemo(
    () => (gems ? Object.values(gems.active).map(activeToPickerRow) : []),
    [gems],
  );

  const supportRows = useMemo(
    () => (gems ? Object.values(gems.support).map(supportToPickerRow) : []),
    [gems],
  );

  const openAddSkill = () => {
    setAdding({ mode: "skill" });
    setQuery("");
  };

  const openAddSupport = (parentId: string) => {
    setAdding({ mode: "support", parentId });
    setQuery("");
  };

  const openSwapSupport = (parentId: string, replaceSupportId: string) => {
    setAdding({ mode: "support", parentId, replaceSupportId });
    setQuery("");
  };

  const closeAdd = () => setAdding(null);

  const updateSkillAdditionalText = useCallback(
    (skillRowId: string, text: string) => {
      setBuild((prev) => ({
        ...prev,
        skills: prev.skills.map((s) =>
          s.id === skillRowId ? { ...s, additionalText: text } : s,
        ),
      }));
    },
    [setBuild],
  );

  const updateSupportAdditionalText = useCallback(
    (skillRowId: string, supportRowId: string, text: string) => {
      setBuild((prev) => ({
        ...prev,
        skills: prev.skills.map((s) => {
          if (s.id !== skillRowId) return s;
          return {
            ...s,
            supports: s.supports.map((sup) =>
              sup.id === supportRowId ? { ...sup, additionalText: text } : sup,
            ),
          };
        }),
      }));
    },
    [setBuild],
  );

  const addItem = useCallback(
    (item: GemPickerRow) => {
      if (!adding) return;

      if (adding.mode === "skill") {
        const catalogGem = gems?.active[item.id];
        const levelInterval = catalogGem
          ? defaultSkillLevelInterval(catalogGem)
          : ([1, 100] as [number, number]);
        const additionalText = catalogGem ? defaultSkillAdditionalText(catalogGem) : "";

        const newSkill: SkillSetup = {
          id: `${item.id}-${Date.now()}`,
          skillId: item.id,
          name: item.name,
          color: item.color,
          levelInterval,
          additionalText,
          supports: [],
        };
        setBuild((prev) => ({ ...prev, skills: [...prev.skills, newSkill] }));
        setSelectedSkillId(newSkill.id);
        setSelectedSupportId(null);
      } else {
        const parentSkill = build.skills.find((s) => s.id === adding.parentId);
        if (!parentSkill) {
          setAdding(null);
          return;
        }

        const ts = Date.now();
        let selectSupportId: string | null = null;
        let nextSupports = parentSkill.supports;

        if (!gems) {
          const newSupport = {
            id: `${item.id}-${ts}`,
            skillId: item.id,
            name: item.name,
            color: item.color,
            levelInterval: [1, 100] as [number, number],
            additionalText: "",
          };
          selectSupportId = newSupport.id;
          nextSupports = adding.replaceSupportId
            ? parentSkill.supports.map((sup) =>
                sup.id === adding.replaceSupportId ? newSupport : sup,
              )
            : [...parentSkill.supports, newSupport];
        } else if (adding.replaceSupportId) {
          const catalogGem = gems.support[item.id];
          const nextId = catalogGem ? nextSupportTierId(gems, item.id) : undefined;
          const nextDrop =
            nextId != null ? supportCraftRequirementLevel(gems.support[nextId]!) : null;
          const newSupport = {
            id: `${item.id}-${ts}`,
            skillId: item.id,
            name: item.name,
            color: item.color,
            levelInterval: catalogGem
              ? defaultSupportLevelInterval(catalogGem, nextDrop)
              : ([1, 100] as [number, number]),
            additionalText: catalogGem ? defaultSupportAdditionalText(catalogGem) : "",
          };
          selectSupportId = newSupport.id;
          nextSupports = normalizeSupportFamilyIntervals(
            parentSkill.supports.map((sup) =>
              sup.id === adding.replaceSupportId ? newSupport : sup,
            ),
            gems,
          );
        } else {
          const seeds = supportSetupsForAdd(
            item.id,
            gems,
            item,
            parentSkill.supports.map((sup) => sup.skillId),
          );
          const newSupports = seeds.map((seed, i) => ({
            id: `${seed.skillId}-${ts}-${i}`,
            ...seed,
          }));
          if (newSupports.length > 0) {
            selectSupportId = newSupports[newSupports.length - 1]!.id;
          }
          nextSupports = normalizeSupportFamilyIntervals(
            [...parentSkill.supports, ...newSupports],
            gems,
          );
        }

        setBuild((prev) => ({
          ...prev,
          skills: prev.skills.map((s) =>
            s.id !== adding.parentId ? s : { ...s, supports: nextSupports },
          ),
        }));

        if (selectSupportId) setSelectedSupportId(selectSupportId);
      }
      setAdding(null);
    },
    [adding, build.skills, gems, setBuild],
  );

  const removeSkill = (sid: string) => {
    setBuild((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s.id !== sid),
    }));
    if (selectedSkillId === sid) setSelectedSkillId(null);
  };

  const removeSupport = (sid: string, supId: string) => {
    setBuild((prev) => ({
      ...prev,
      skills: prev.skills.map((s) => {
        if (s.id !== sid) return s;
        const supports = s.supports.filter((su) => su.id !== supId);
        return {
          ...s,
          supports: gems ? normalizeSupportFamilyIntervals(supports, gems) : supports,
        };
      }),
    }));
    if (selectedSupportId === supId) setSelectedSupportId(null);
  };

  const openSkillLevelPicker = (
    e: React.MouseEvent,
    skillId: string,
    interval: [number, number],
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setLevelPicker({
      target: { kind: "skill", skillId },
      currentInterval: interval,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  const openSupportLevelPicker = (
    e: React.MouseEvent,
    skillId: string,
    supportId: string,
    interval: [number, number],
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setLevelPicker({
      target: { kind: "support", skillId, supportId },
      currentInterval: interval,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  const defaultIntervalForPicker = useCallback(
    (target: GemLevelTarget): [number, number] => {
      if (target.kind === "skill") {
        const skill = build.skills.find((s) => s.id === target.skillId);
        const catalog = skill && gems?.active[skill.skillId];
        return catalog ? defaultSkillLevelInterval(catalog) : [1, 100];
      }
      const skill = build.skills.find((s) => s.id === target.skillId);
      const sup = skill?.supports.find((s) => s.id === target.supportId);
      const catalog = sup && gems?.support[sup.skillId];
      if (!catalog || !gems) return [1, 100];
      const nextId = nextSupportTierId(gems, sup.skillId);
      const nextDrop =
        nextId != null ? supportCraftRequirementLevel(gems.support[nextId]!) : null;
      return defaultSupportLevelInterval(catalog, nextDrop);
    },
    [build.skills, gems],
  );

  const applyGemInterval = useCallback(
    (interval: [number, number]) => {
      if (!levelPicker) return;
      const normalized = normalizeLevelInterval(interval[0], interval[1]);
      const target = levelPicker.target;
      setBuild((prev) => ({
        ...prev,
        skills: prev.skills.map((s) => {
          if (target.kind === "skill") {
            if (s.id !== target.skillId) return s;
            return { ...s, levelInterval: normalized };
          }
          if (s.id !== target.skillId) return s;
          return {
            ...s,
            supports: s.supports.map((sup) =>
              sup.id === target.supportId ? { ...sup, levelInterval: normalized } : sup,
            ),
          };
        }),
      }));
      setLevelPicker(null);
    },
    [levelPicker, setBuild],
  );

  const clearGemLevel = useCallback(() => {
    if (!levelPicker) return;
    const defaultInterval = defaultIntervalForPicker(levelPicker.target);
    const target = levelPicker.target;
    setBuild((prev) => ({
      ...prev,
      skills: prev.skills.map((s) => {
        if (target.kind === "skill") {
          if (s.id !== target.skillId) return s;
          return { ...s, levelInterval: defaultInterval };
        }
        if (s.id !== target.skillId) return s;
        return {
          ...s,
          supports: s.supports.map((sup) =>
            sup.id === target.supportId ? { ...sup, levelInterval: defaultInterval } : sup,
          ),
        };
      }),
    }));
    setLevelPicker(null);
  }, [levelPicker, setBuild, defaultIntervalForPicker]);

  const parentSkillForAdding =
    adding?.mode === "support"
      ? build.skills.find((s) => s.id === adding.parentId)
      : undefined;

  const catalog = adding?.mode === "skill" ? activeRows : supportRows;

  const supportPickerCtx = useMemo(() => {
    if (!gems || adding?.mode !== "support" || !parentSkillForAdding) return null;
    const activeGem = gems.active[parentSkillForAdding.skillId] as ActiveGem | undefined;
    const compatibleIds = activeGem ? new Set(activeGem.compatibleSupports) : new Set<string>();

    let replacing: SupportPickerRankContext["replacing"];
    if (adding.replaceSupportId) {
      const rep = parentSkillForAdding.supports.find((s) => s.id === adding.replaceSupportId);
      if (rep) {
        const cat = gems.support[rep.skillId];
        replacing = {
          skillId: rep.skillId,
          familyKey: cat ? supportFamilyKey(cat) : null,
          nextTierId: cat ? nextSupportTierId(gems, rep.skillId) ?? null : null,
        };
      }
    }
    return { compatibleIds, replacing };
  }, [gems, adding, parentSkillForAdding]);

  const upgradeHighlightIds = useMemo(() => {
    if (!gems || adding?.mode !== "support" || !adding.replaceSupportId || !parentSkillForAdding) {
      return undefined;
    }
    const rep = parentSkillForAdding.supports.find((s) => s.id === adding.replaceSupportId);
    if (!rep) return undefined;
    const nextId = nextSupportTierId(gems, rep.skillId);
    return nextId ? new Set([nextId]) : undefined;
  }, [gems, adding, parentSkillForAdding]);

  const filtered = useMemo(() => {
    if (!adding) return [];
    let list = catalog.filter((c) => fuzzyMatchAny([c.name, c.desc], query));
    if (supportPickerCtx && gems) {
      list = [...list].sort((a, b) => {
        const gemA = gems.support[a.id];
        const gemB = gems.support[b.id];
        if (!gemA || !gemB) return a.name.localeCompare(b.name);
        const rankA = supportPickerRank(a.id, gemA, supportPickerCtx);
        const rankB = supportPickerRank(b.id, gemB, supportPickerCtx);
        return rankA - rankB || a.name.localeCompare(b.name);
      });
    }
    return list;
  }, [adding, catalog, query, supportPickerCtx, gems]);

  return (
    <section className="panel skills-panel">
      <header className="panel-h">
        <h2>Skills</h2>
        <span className="panel-h-meta">
          {build.skills.length} setup{build.skills.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="skills-list">
        {build.skills.map((s) => {
          const isSel = selectedSkillId === s.id;
          const skillCatalog = gems?.active[s.skillId];
          const skillDefault = skillCatalog ? defaultSkillAdditionalText(skillCatalog) : "";
          const skillShowReset =
            skillCatalog && (s.additionalText ?? "").trim() !== skillDefault.trim();
          return (
            <div key={s.id} className={`skill-row ${isSel ? "is-sel" : ""}`}>
              <div
                className="skill-main"
                onClick={() => {
                  setSelectedSkillId(s.id);
                  setSelectedSupportId(null);
                }}
                onContextMenu={(e) => openSkillLevelPicker(e, s.id, s.levelInterval)}
              >
                <GemIcon color={s.color} size={26} kind="skill" />
                <div className="skill-name-wrap">
                  <span className="skill-name">{s.name}</span>
                  <span className="skill-lvl mono">{formatGemLevel(s.levelInterval)}</span>
                </div>
                <button
                  type="button"
                  className="row-x"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSkill(s.id);
                  }}
                  title="Remove"
                >
                  ×
                </button>
              </div>

              {isSel && !adding ? (
                <GemAdditionalEditor
                  className="skill-additional-edit"
                  value={s.additionalText ?? ""}
                  placeholder="Uncut tier, stat reqs, notes…"
                  onChange={(text) => updateSkillAdditionalText(s.id, text)}
                  onReset={
                    skillShowReset
                      ? () => updateSkillAdditionalText(s.id, skillDefault)
                      : undefined
                  }
                />
              ) : null}

              <div className="supports">
                {s.supports.map((sup) => {
                  const supSel = selectedSupportId === sup.id;
                  const isSwapping =
                    adding?.mode === "support" &&
                    adding.parentId === s.id &&
                    adding.replaceSupportId === sup.id;
                  const supCatalog = gems?.support[sup.skillId];
                  const supDefault = supCatalog ? defaultSupportAdditionalText(supCatalog) : "";
                  const supShowReset =
                    supCatalog && (sup.additionalText ?? "").trim() !== supDefault.trim();
                  return (
                    <div key={sup.id}>
                      {isSwapping ? (
                        <AddPicker
                          query={query}
                          setQuery={setQuery}
                          results={filtered}
                          onPick={addItem}
                          onClose={closeAdd}
                          placeholder="Search support gems"
                          highlightIds={upgradeHighlightIds}
                        />
                      ) : (
                        <div className={`support-entry ${supSel ? "is-sel" : ""}`}>
                          <div
                            className={`support-row ${supSel ? "is-sel" : ""}`}
                            onClick={() => {
                              setSelectedSkillId(s.id);
                              setSelectedSupportId(sup.id);
                            }}
                            onContextMenu={(e) =>
                              openSupportLevelPicker(e, s.id, sup.id, sup.levelInterval)
                            }
                          >
                            <span className="support-rail" />
                            <GemIcon color={sup.color} size={18} kind="support" />
                            <span className="support-name">{sup.name}</span>
                            <span className="skill-lvl mono">{formatGemLevel(sup.levelInterval)}</span>
                            {supSel ? (
                              <button
                                type="button"
                                className="support-change"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSwapSupport(s.id, sup.id);
                                }}
                                title="Change support gem"
                              >
                                Change
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="row-x"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSupport(s.id, sup.id);
                              }}
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                          {supSel && !adding ? (
                            <GemAdditionalEditor
                              className="support-additional-edit"
                              value={sup.additionalText ?? ""}
                              placeholder="Uncut tier, stat reqs, notes…"
                              onChange={(text) =>
                                updateSupportAdditionalText(s.id, sup.id, text)
                              }
                              onReset={
                                supShowReset
                                  ? () => updateSupportAdditionalText(s.id, sup.id, supDefault)
                                  : undefined
                              }
                            />
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
                {adding?.mode === "support" &&
                adding.parentId === s.id &&
                !adding.replaceSupportId ? (
                  <AddPicker
                    query={query}
                    setQuery={setQuery}
                    results={filtered}
                    onPick={addItem}
                    onClose={closeAdd}
                    placeholder="Search support gems"
                  />
                ) : (
                  <button
                    type="button"
                    className="add-btn add-btn-sub"
                    onClick={() => openAddSupport(s.id)}
                  >
                    <span className="add-plus">+</span> Support
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {adding?.mode === "skill" ? (
          <AddPicker
            query={query}
            setQuery={setQuery}
            results={filtered}
            onPick={addItem}
            onClose={closeAdd}
            placeholder="Search skill gems"
          />
        ) : build.skills.length === 0 ? (
          <button type="button" className="add-btn add-btn-empty" onClick={openAddSkill}>
            <span className="add-plus">+</span> Add the first skill
          </button>
        ) : (
          <button type="button" className="add-btn" onClick={openAddSkill}>
            <span className="add-plus">+</span> Skill
          </button>
        )}
      </div>

      {levelPicker && (
        <LevelPickerPopover
          anchor={{ clientX: levelPicker.clientX, clientY: levelPicker.clientY }}
          currentInterval={levelPicker.currentInterval}
          title={
            levelPicker.target.kind === "support"
              ? "Support active levels"
              : "Skill active levels"
          }
          onApplyInterval={applyGemInterval}
          onClear={clearGemLevel}
          onClose={() => setLevelPicker(null)}
        />
      )}
    </section>
  );
}
