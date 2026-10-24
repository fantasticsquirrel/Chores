/** Author-only element recorder. Functions/events never cross the worker boundary. */
export const Fragment = "fragment";
let nextId = 0;
export const resetVectorIds = () => {
  nextId = 0;
};
export const useId = () => `illustration${nextId++}`;
export const useRef = (value: unknown) => ({ current: value });
export function h(
  tag: string | ((props: Record<string, unknown>) => unknown),
  props: Record<string, unknown> | null,
  ...children: unknown[]
): any {
  if (typeof tag === "function") return tag({ ...props, children });
  const nodes = children
    .flat(Infinity)
    .filter((v) => v !== null && v !== undefined && v !== false && v !== true)
    .map((v) => (typeof v === "number" ? String(v) : v));
  if (tag === Fragment) return nodes;
  const attrs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props ?? {})) {
    if (
      ["key", "className", "role", "style", "viewBox"].includes(k) ||
      k.startsWith("on") ||
      k.startsWith("aria-") ||
      k.startsWith("data-")
    )
      continue;
    if (v !== undefined) attrs[k] = v;
  }
  return { tag, attrs, children: nodes };
}
