"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  BUILD_HISTORY_MAX,
  buildStatesEqual,
  cloneBuild,
} from "@/lib/build/build-history";
import type { BuildState } from "@/schemas/build";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export interface BuildHistoryControls {
  build: BuildState;
  setBuild: Dispatch<SetStateAction<BuildState>>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useBuildHistory(initial: BuildState): BuildHistoryControls {
  const [build, setBuildInternal] = useState(initial);
  const pastRef = useRef<BuildState[]>([]);
  const futureRef = useRef<BuildState[]>([]);
  const buildRef = useRef(build);
  const skipHistoryRef = useRef(false);
  const [historyTick, setHistoryTick] = useState(0);

  buildRef.current = build;

  const bumpHistory = useCallback(() => {
    setHistoryTick((n) => n + 1);
  }, []);

  const pushPast = useCallback(
    (snapshot: BuildState) => {
      const stack = pastRef.current;
      const last = stack[stack.length - 1];
      if (last && buildStatesEqual(last, snapshot)) return;
      stack.push(cloneBuild(snapshot));
      if (stack.length > BUILD_HISTORY_MAX) stack.shift();
      futureRef.current = [];
      bumpHistory();
    },
    [bumpHistory],
  );

  const setBuild: Dispatch<SetStateAction<BuildState>> = useCallback(
    (action) => {
      setBuildInternal((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        if (!skipHistoryRef.current && !buildStatesEqual(prev, next)) {
          pushPast(prev);
        }
        skipHistoryRef.current = false;
        return next;
      });
    },
    [pushPast],
  );

  const undo = useCallback(() => {
    const stack = pastRef.current;
    if (stack.length === 0) return;
    const previous = stack.pop()!;
    futureRef.current.push(cloneBuild(buildRef.current));
    skipHistoryRef.current = true;
    setBuildInternal(previous);
    bumpHistory();
  }, [bumpHistory]);

  const redo = useCallback(() => {
    const stack = futureRef.current;
    if (stack.length === 0) return;
    const next = stack.pop()!;
    pushPast(buildRef.current);
    skipHistoryRef.current = true;
    setBuildInternal(next);
    bumpHistory();
  }, [pushPast, bumpHistory]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isEditableTarget(e.target)) return;

      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  void historyTick;

  return {
    build,
    setBuild,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
