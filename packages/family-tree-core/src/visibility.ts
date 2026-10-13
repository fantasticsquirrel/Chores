import { Budget, edgeKey, historical, positiveId } from './limits';
import type { Diagnostic, Expansion, LayoutOptions, NormalizedEdge, PreparedGraph } from './types';
export function boundedCollapse(ids: readonly number[] | undefined): readonly number[] {
  return Array.isArray(ids) ? ids.slice(0, 500) : [];
}
export interface Visibility<E> { ids: Set<number>; edges: NormalizedEdge<E>[]; expansions: Expansion[]; diagnostics: Diagnostic[] }
export function validateOptions(options: LayoutOptions): Diagnostic[] {
  const invalid = (message: string): Diagnostic => ({ code: 'invalid_options', severity: 'error', message });
  const result: Diagnostic[] = [];
  for (const depth of [options.ancestorDepth, options.descendantDepth]) if (depth !== undefined && (!Number.isSafeInteger(depth) || depth < 0 || depth > 32)) result.push(invalid('Depth must be an integer between 0 and 32.'));
  for (const gap of [options.columnGap, options.rowGap]) if (gap !== undefined && (!Number.isFinite(gap) || gap < 1 || gap > 10000)) result.push(invalid('Layout spacing must be finite and between 1 and 10000.'));
  for (const ids of [options.collapsedAncestors, options.collapsedDescendants]) if (ids !== undefined && (!Array.isArray(ids) || ids.length > 500 || ids.some(id => !positiveId(id)))) result.push(invalid('Invalid bounded collapse identifiers.'));
  for (const flag of [options.includePartners, options.includeCare, options.showHistoricalPartners]) if (flag !== undefined && typeof flag !== 'boolean') result.push(invalid('Context filters must be explicit booleans.'));
  return result;
}
/** Context is transitive partner/care context only; it never opens ancestry behind the requested lens. */
export function visibility<N, E>(graph: PreparedGraph<N, E>, options: LayoutOptions, budget: Budget): Visibility<E> {
  const ids = new Set<number>([options.focusId!]), hidden = new Set<string>(), expansions: Expansion[] = [], diagnostics: Diagnostic[] = [];
  const collapseUp = new Set(boundedCollapse(options.collapsedAncestors)), collapseDown = new Set(boundedCollapse(options.collapsedDescendants));
  for (const direction of ['ancestors', 'descendants'] as const) {
    const queue: [number, number][] = [[options.focusId!, 0]], visited = new Set<number>([options.focusId!]);
    const maximum = direction === 'ancestors' ? options.ancestorDepth ?? 2 : options.descendantDepth ?? 2;
    const collapse = direction === 'ancestors' ? collapseUp : collapseDown;
    const lookup = direction === 'ancestors' ? graph.parents : graph.children;
    for (let head = 0; head < queue.length; head++) {
      budget.step();
      const [id, depth] = queue[head], edges = lookup.get(id) ?? [];
      if (collapse.has(id) || depth === maximum) {
        if (edges.length) expansions.push({ personId: id, direction, count: new Set(edges.map(edge => direction === 'ancestors' ? edge.source : edge.target)).size, reason: collapse.has(id) ? 'collapsed' : 'depth' });
        continue;
      }
      for (const edge of edges) {
        budget.step();
        const next = direction === 'ancestors' ? edge.source : edge.target;
        ids.add(next);
        if (!visited.has(next)) { visited.add(next); queue.push([next, depth + 1]); }
      }
    }
  }
  // Explicitly hide every collapsed directional fact, even if context or another branch reveals its endpoints.
  for (const edge of graph.edges) {
    budget.step();
    if (edge.type === 'parent' && (collapseDown.has(edge.source) || collapseUp.has(edge.target))) hidden.add(edgeKey(edge));
  }
  const contextQueue = [...ids].sort((a, b) => a - b);
  for (let head = 0; head < contextQueue.length; head++) {
    budget.step();
    const id = contextQueue[head];
    for (const edge of graph.neighbors.get(id) ?? []) {
      budget.step();
      if (edge.type === 'parent' || (edge.type === 'partner' && (!options.includePartners || (options.showHistoricalPartners === false && historical(edge)))) || (edge.type === 'care' && !options.includeCare)) continue;
      const next = edge.source === id ? edge.target : edge.source;
      if (!ids.has(next)) { ids.add(next); contextQueue.push(next); }
    }
  }
  const edges = graph.edges.filter(edge => {
    if (!ids.has(edge.source) || !ids.has(edge.target)) return false;
    if (hidden.has(edgeKey(edge))) {
      diagnostics.push({ code: 'also_connected', severity: 'warning', message: 'Also connected through another branch; collapsed relationship remains hidden.', personId: collapseDown.has(edge.source) ? edge.target : edge.source, edgeKey: edgeKey(edge) });
      return false;
    }
    return edge.type === 'parent' || (edge.type === 'care' && options.includeCare === true) || (edge.type === 'partner' && options.includePartners === true && (options.showHistoricalPartners !== false || !historical(edge)));
  });
  expansions.sort((a, b) => a.personId - b.personId || (a.direction < b.direction ? -1 : a.direction > b.direction ? 1 : 0));
  return { ids, edges, expansions, diagnostics };
}
