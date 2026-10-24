import { useEffect, useRef, useState } from "react";
import type { SetURLSearchParams } from "react-router-dom";

/** View state changes never replace the graph's focus, lens, or paging state. */
export function useTreeWorkspaceMode(params: URLSearchParams, setParams: SetURLSearchParams) {
  const mode: "tree" | "people" = params.get("view") === "people" ? "people" : "tree";
  const graphRegion = useRef<HTMLDivElement>(null);
  const [reveal, setReveal] = useState(0);
  function changeMode(nextMode: "tree" | "people") {
    if (mode === nextMode) return;
    const next = new URLSearchParams(params);
    next.set("view", nextMode);
    setParams(next);
  }
  useEffect(() => {
    if (mode !== "tree" || !reveal) return;
    graphRegion.current?.scrollIntoView?.({ block: "start" });
    graphRegion.current?.focus();
  }, [mode, reveal]);
  return { mode, graphRegion, changeMode, revealGraph: () => setReveal((value) => value + 1) };
}
