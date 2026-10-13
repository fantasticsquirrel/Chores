import { Budget } from './limits';
import type { NormalizedEdge, PreparedGraph } from './types';
export class AncestryCycle extends Error {}
/** Kahn ranking plus parent-connected components. No repeated generation relaxation, recursion or spouse unioning. */
export function rankAncestry<N, E>(graph: PreparedGraph<N, E>, budget: Budget): { ranks: Map<number, number>; components: Map<number, number> } {
  const ranks = new Map<number, number>(), degree = new Map<number, number>();
  for (const node of graph.nodes) { budget.step(); ranks.set(node.id, 0); degree.set(node.id, graph.parents.get(node.id)!.length); }
  const queue = graph.nodes.filter(node => degree.get(node.id) === 0).map(node => node.id);
  let visited = 0;
  for (let head = 0; head < queue.length; head++) {
    budget.step(); const id = queue[head]; visited++;
    for (const edge of graph.children.get(id) ?? []) {
      budget.step(); ranks.set(edge.target, Math.max(ranks.get(edge.target)!, ranks.get(id)! + 1));
      const next = degree.get(edge.target)! - 1; degree.set(edge.target, next);
      if (next === 0) queue.push(edge.target);
    }
  }
  if (visited !== graph.nodes.length) throw new AncestryCycle();
  const components = new Map<number, number>();
  for (const node of graph.nodes) {
    budget.step(); if (components.has(node.id)) continue;
    const members = [node.id]; components.set(node.id, node.id);
    for (let head = 0; head < members.length; head++) {
      budget.step(); const id = members[head];
      for (const edge of graph.neighbors.get(id) ?? []) {
        budget.step(); if (edge.type !== 'parent') continue;
        const next = edge.source === id ? edge.target : edge.source;
        if (!components.has(next)) { components.set(next, node.id); members.push(next); }
      }
    }
  }
  return { ranks, components };
}
/** Translate entire ancestry components only. Incompatible partner constraints stay explicit cross-row routes. */
export function alignPartners(ranks: Map<number, number>, components: Map<number, number>, edges: readonly NormalizedEdge[], focusId: number, budget: Budget): Map<number, number> {
  const componentEdges = new Map<number, NormalizedEdge[]>();
  const componentIds = [...new Set(components.values())].sort((a, b) => a - b);
  for (const id of componentIds) componentEdges.set(id, []);
  for (const edge of edges) {
    budget.step(); if (edge.type !== 'partner') continue;
    const a = components.get(edge.source)!, b = components.get(edge.target)!;
    if (a === b) continue;
    componentEdges.get(a)!.push(edge); componentEdges.get(b)!.push(edge);
  }
  const focusComponent = components.get(focusId)!, focusRank = ranks.get(focusId)!;
  const offsets = new Map<number, number>([[focusComponent, 0]]);
  for (const seed of [focusComponent, ...componentIds.filter(id => id !== focusComponent)]) {
    budget.step(); if (offsets.has(seed) && seed !== focusComponent) continue;
    if (!offsets.has(seed)) offsets.set(seed, focusRank);
    const queue = [seed];
    for (let head = 0; head < queue.length; head++) {
      budget.step(); const component = queue[head];
      for (const edge of componentEdges.get(component) ?? []) {
        budget.step();
        const sourceComponent = components.get(edge.source)!, targetComponent = components.get(edge.target)!;
        const from = sourceComponent === component ? edge.source : edge.target, to = from === edge.source ? edge.target : edge.source;
        const destination = sourceComponent === component ? targetComponent : sourceComponent;
        if (!offsets.has(destination)) { offsets.set(destination, offsets.get(component)! + ranks.get(from)! - ranks.get(to)!); queue.push(destination); }
      }
    }
  }
  const rows = new Map<number, number>();
  for (const [id, rank] of ranks) { budget.step(); rows.set(id, rank + offsets.get(components.get(id)!)! - focusRank); }
  return rows;
}
