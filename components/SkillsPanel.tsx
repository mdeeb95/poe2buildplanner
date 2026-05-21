"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AddPicker } from "@/components/AddPicker";
import { GemIcon } from "@/components/GemIcon";
import {
  activeToPickerRow,
  supportToPickerRow,
  type GemPickerRow,
} from "@/lib/build/gem-ui";
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

export function SkillsPanel({ build, setBuild }: SkillsPanelProps) {
  const [gems, setGems] = useState<GemsFile | null>(null);
  const [adding, setAdding] = useState<AddingState>(null);
  const [query, setQuery] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedSupportId, setSelectedSupportId] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    fetch("/gems", { cache: "force-cache" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
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

  const addItem = useCallback(
    (item: GemPickerRow) => {
      if (!adding) return;

      if (adding.mode === "skill") {
        const newSkill: SkillSetup = {
          id: `${item.id}-${Date.now()}`,
          skillId: item.id,
          name: item.name,
          color: item.color,
          levelInterval: [1, 100],
          supports: [],
        };
        setBuild((prev) => ({ ...prev, skills: [...prev.skills, newSkill] }));
      } else {
        setBuild((prev) => ({
          ...prev,
          skills: prev.skills.map((s) => {
            if (s.id !== adding.parentId) return s;
            const newSupport = {
              id: `${item.id}-${Date.now()}`,
              skillId: item.id,
              name: item.name,
              color: item.color,
              levelInterval: [1, 100] as [number, number],
            };
            if (adding.replaceSupportId) {
              return {
                ...s,
                supports: s.supports.map((sup) =>
                  sup.id === adding.replaceSupportId ? newSupport : sup,
                ),
              };
            }
            return { ...s, supports: [...s.supports, newSupport] };
          }),
        }));
      }
      setAdding(null);
    },
    [adding, setBuild],
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
      skills: prev.skills.map((s) =>
        s.id !== sid
          ? s
          : { ...s, supports: s.supports.filter((su) => su.id !== supId) },
      ),
    }));
    if (selectedSupportId === supId) setSelectedSupportId(null);
  };

  const parentSkillForAdding =
    adding?.mode === "support"
      ? build.skills.find((s) => s.id === adding.parentId)
      : undefined;

  const catalog = adding?.mode === "skill" ? activeRows : supportRows;

  const suggestedIds = useMemo(() => {
    if (!gems || !parentSkillForAdding || adding?.mode !== "support") {
      return undefined;
    }
    const active = gems.active[parentSkillForAdding.skillId] as ActiveGem | undefined;
    if (!active) return undefined;
    return new Set(active.compatibleSupports);
  }, [gems, parentSkillForAdding, adding]);

  const filtered = useMemo(() => {
    if (!adding) return [];
    let list = catalog.filter((c) => fuzzyMatchAny([c.name, c.desc], query));
    if (suggestedIds && suggestedIds.size > 0) {
      list = [...list].sort((a, b) => {
        const aS = suggestedIds.has(a.id) ? 0 : 1;
        const bS = suggestedIds.has(b.id) ? 0 : 1;
        return aS - bS || a.name.localeCompare(b.name);
      });
    }
    return list;
  }, [adding, catalog, query, suggestedIds]);

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
          return (
            <div key={s.id} className={`skill-row ${isSel ? "is-sel" : ""}`}>
              <div
                className="skill-main"
                onClick={() => setSelectedSkillId(s.id)}
              >
                <GemIcon color={s.color} size={26} kind="skill" />
                <div className="skill-name-wrap">
                  <span className="skill-name">{s.name}</span>
                  <span className="skill-lvl mono">
                    L{s.levelInterval[0]}–{s.levelInterval[1]}
                  </span>
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

              <div className="supports">
                {s.supports.map((sup) => {
                  const supSel = selectedSupportId === sup.id;
                  const isSwapping =
                    adding?.mode === "support" &&
                    adding.parentId === s.id &&
                    adding.replaceSupportId === sup.id;
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
                        />
                      ) : (
                        <div
                          className={`support-row ${supSel ? "is-sel" : ""}`}
                          onClick={() => {
                            setSelectedSupportId(sup.id);
                            openSwapSupport(s.id, sup.id);
                          }}
                        >
                          <span className="support-rail" />
                          <GemIcon color={sup.color} size={18} kind="support" />
                          <span className="support-name">{sup.name}</span>
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
    </section>
  );
}
