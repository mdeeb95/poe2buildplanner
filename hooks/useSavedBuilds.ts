"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadCurrentId,
  loadSavedBuilds,
  newSavedId,
  writeCurrentId,
  writeSavedBuilds,
  type SavedBuild,
} from "@/lib/build/storage";
import type { BuildState } from "@/schemas/build";

export interface SavedBuildsControls {
  savedBuilds: SavedBuild[];
  currentId: string | null;
  setCurrentId: (id: string | null) => void;
  /** Update the current entry in place, or create a new one if none is current. */
  saveCurrent: (build: BuildState) => void;
  /** Always create a fresh entry and make it current. */
  saveAsCopy: (build: BuildState) => void;
  remove: (id: string) => void;
  getBuild: (id: string) => BuildState | null;
}

export function useSavedBuilds(): SavedBuildsControls {
  const [savedBuilds, setSavedBuilds] = useState<SavedBuild[]>([]);
  const [currentId, setCurrentIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // Keep a ref so save/copy handlers don't capture a stale list.
  const buildsRef = useRef(savedBuilds);
  buildsRef.current = savedBuilds;

  useEffect(() => {
    setSavedBuilds(loadSavedBuilds());
    setCurrentIdState(loadCurrentId());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeSavedBuilds(savedBuilds);
  }, [savedBuilds, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeCurrentId(currentId);
  }, [currentId, hydrated]);

  const setCurrentId = useCallback((id: string | null) => {
    setCurrentIdState(id);
  }, []);

  const saveCurrent = useCallback(
    (build: BuildState) => {
      const list = buildsRef.current;
      const id = currentId;
      const savedAt = Date.now();
      if (id && list.some((b) => b.id === id)) {
        setSavedBuilds(
          list.map((b) =>
            b.id === id ? { ...b, name: build.name, build, savedAt } : b,
          ),
        );
        return;
      }
      const newId = newSavedId();
      setSavedBuilds([...list, { id: newId, name: build.name, build, savedAt }]);
      setCurrentIdState(newId);
    },
    [currentId],
  );

  const saveAsCopy = useCallback((build: BuildState) => {
    const newId = newSavedId();
    setSavedBuilds([
      ...buildsRef.current,
      { id: newId, name: build.name, build, savedAt: Date.now() },
    ]);
    setCurrentIdState(newId);
  }, []);

  const remove = useCallback(
    (id: string) => {
      setSavedBuilds(buildsRef.current.filter((b) => b.id !== id));
      if (currentId === id) setCurrentIdState(null);
    },
    [currentId],
  );

  const getBuild = useCallback((id: string): BuildState | null => {
    return buildsRef.current.find((b) => b.id === id)?.build ?? null;
  }, []);

  return {
    savedBuilds,
    currentId,
    setCurrentId,
    saveCurrent,
    saveAsCopy,
    remove,
    getBuild,
  };
}
