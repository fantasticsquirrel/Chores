/** Pure author recorder. Only bounded declarative SVG crosses the worker boundary. */
export const Fragment = "fragment";
export const useId = () => "illustration";
export function h(tag: any, props: any, ...children: any[]): any {
  const values = children
    .flat(Infinity)
    .filter((v) => v !== null && v !== undefined && v !== false && v !== true)
    .map((v) => (typeof v === "number" ? String(v) : v));
  if (typeof tag === "function") return tag({ ...props, children: values });
  if (tag === Fragment) return values;
  const attrs: any = {};
  for (const [k, v] of Object.entries(props ?? {})) {
    if (
      ["key", "className", "role", "style"].includes(k) ||
      k.startsWith("on") ||
      k.startsWith("aria-") ||
      k.startsWith("data-")
    )
      continue;
    if (v !== undefined) attrs[k] = v;
  }
  return { tag, attrs, children: values };
}
export function svgNodes(tree: any): any[] {
  const found: any[] = [];
  function visit(n: any) {
    if (!n || typeof n !== "object") return;
    if (n.tag === "svg") found.push(n);
    else for (const child of n.children ?? []) visit(child);
  }
  visit(tree);
  return found;
}
