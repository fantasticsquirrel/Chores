import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useNavigate, useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import { useTreeWorkspaceMode } from "./useTreeWorkspaceMode";

it("preserves the graph URL lens through mode changes and browser history", () => {
  const { result } = renderHook(() => {
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    return { ...useTreeWorkspaceMode(params, setParams), params, navigate };
  }, { wrapper: ({ children }: { children: ReactNode }) =>
    <MemoryRouter initialEntries={["/family-tree/people/3?focus=7&up=4&down=1&care=1&collapsedDown=9"]}>{children}</MemoryRouter> });
  act(() => result.current.changeMode("people"));
  expect(result.current.mode).toBe("people");
  for (const [key, value] of [["focus", "7"], ["up", "4"], ["down", "1"], ["care", "1"], ["collapsedDown", "9"]]) {
    expect(result.current.params.get(key)).toBe(value);
  }
  act(() => result.current.changeMode("people"));
  act(() => result.current.navigate(-1));
  expect(result.current.mode).toBe("tree");
  act(() => result.current.navigate(1));
  expect(result.current.mode).toBe("people");
  expect(result.current.params.get("focus")).toBe("7");
});
