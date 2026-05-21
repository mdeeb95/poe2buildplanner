"use client";

import { useCallback, useState } from "react";

interface VResizerProps {
  width: number;
  setWidth: (w: number) => void;
  min?: number;
  max?: number;
  defaultWidth?: number;
}

export function VResizer({
  width,
  setWidth,
  min = 360,
  max = 800,
  defaultWidth = 460,
}: VResizerProps) {
  const [active, setActive] = useState(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setActive(true);
      document.body.classList.add("resizing");
      const startX = e.clientX;
      const startW = width;
      const onMove = (ev: MouseEvent) => {
        const dx = startX - ev.clientX;
        const next = Math.max(min, Math.min(max, startW + dx));
        setWidth(next);
      };
      const onUp = () => {
        setActive(false);
        document.body.classList.remove("resizing");
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [width, setWidth, min, max],
  );

  return (
    <div
      className="resizer"
      data-active={active ? "1" : "0"}
      onMouseDown={onMouseDown}
      onDoubleClick={() => setWidth(defaultWidth)}
      title="Drag to resize. Double-click to reset."
    />
  );
}

interface HResizerProps {
  height: number;
  setHeight: (h: number) => void;
  min?: number;
  max?: number;
  defaultHeight?: number;
  /** Sized panel is above the handle (drag down to enlarge). Default: gear-on-top layout. */
  panelAbove?: boolean;
}

export function HResizer({
  height,
  setHeight,
  min = 320,
  max = 800,
  defaultHeight = 500,
  panelAbove = true,
}: HResizerProps) {
  const [active, setActive] = useState(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setActive(true);
      document.body.classList.add("resizing-v");
      const startY = e.clientY;
      const startH = height;
      const onMove = (ev: MouseEvent) => {
        const rawDy = ev.clientY - startY;
        const dy = panelAbove ? rawDy : -rawDy;
        const next = Math.max(min, Math.min(max, startH + dy));
        setHeight(next);
      };
      const onUp = () => {
        setActive(false);
        document.body.classList.remove("resizing-v");
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [height, setHeight, min, max, panelAbove],
  );

  return (
    <div
      className="hresizer"
      data-active={active ? "1" : "0"}
      onMouseDown={onMouseDown}
      onDoubleClick={() => setHeight(defaultHeight)}
      title="Drag to resize. Double-click to reset."
    />
  );
}
