import { listRows, relationshipLabel, relationshipPattern, safeBirthYear } from './labels';
import { Budget, edgeKey, hasErrors, historical, IterationLimit, positiveId, resolveLimits } from './limits';
import { prepareGraph } from './normalize';
import { alignPartners, AncestryCycle, rankAncestry } from './ranking';
import { boundedCollapse, validateOptions, visibility } from './visibility';
import type { Visibility } from './visibility';
import type { Diagnostic, EdgeRoute, GraphInput, GraphLimits, LayoutNode, LayoutOptions, LayoutResult, NormalizedEdge, ParentJunction, PreparedGraph } from './types';
export function inputGraph<N, E>(input: GraphInput<N, E> | PreparedGraph<N, E>, request?: Partial<GraphLimits>): PreparedGraph<N, E> {
  if (!('prepared' in input)) return prepareGraph(input, request);
  if (!request) return input;
  const resolved = resolveLimits({ ...input.limits, ...request });
  if (resolved.limits.maxNodes < input.nodes.length || resolved.limits.maxEdges < input.edges.length) {
    const smaller = prepareGraph(input, resolved.limits);
    return { ...smaller, diagnostics: [...input.diagnostics, ...resolved.diagnostics, ...smaller.diagnostics], truncation: { ...smaller.truncation, inputNodeCount: input.truncation.inputNodeCount, inputEdgeCount: input.truncation.inputEdgeCount } };
  }
  return { ...input, limits: resolved.limits, diagnostics: [...input.diagnostics, ...resolved.diagnostics] };
}
function fallbackEdges<E>(edges: readonly NormalizedEdge<E>[], options: LayoutOptions): NormalizedEdge<E>[] {
  const up = new Set(boundedCollapse(options.collapsedAncestors)), down = new Set(boundedCollapse(options.collapsedDescendants));
  return edges.filter(edge => edge.type === 'parent' ? !down.has(edge.source) && !up.has(edge.target) : edge.type === 'care' ? options.includeCare === true : options.includePartners === true && (options.showHistoricalPartners !== false || !historical(edge)));
}
function place<N, E>(graph: PreparedGraph<N, E>, visible: Visibility<E>, rows: ReadonlyMap<number, number>, options: LayoutOptions, budget: Budget): LayoutNode<N>[] {
  const groups = new Map<number, number[]>(), partnerNeighbors = new Map<number, number[]>();
  for (const node of graph.nodes) {
    budget.step(); if (!visible.ids.has(node.id)) continue;
    const row = rows.get(node.id)!; if (!groups.has(row)) groups.set(row, []);
    groups.get(row)!.push(node.id); partnerNeighbors.set(node.id, []);
  }
  for (const edge of visible.edges) {
    budget.step(); if (edge.type !== 'partner' || rows.get(edge.source) !== rows.get(edge.target)) continue;
    partnerNeighbors.get(edge.source)!.push(edge.target); partnerNeighbors.get(edge.target)!.push(edge.source);
  }
  const coordinates = new Map<number, { x: number; y: number }>();
  for (const [row, members] of groups) {
    const ordered: number[] = [], visited = new Set<number>();
    for (const seed of members) {
      budget.step(); if (visited.has(seed)) continue;
      const block = [seed]; visited.add(seed);
      for (let head = 0; head < block.length; head++) {
        budget.step();
        for (const next of partnerNeighbors.get(block[head]) ?? []) {
          budget.step(); if (!visited.has(next)) { visited.add(next); block.push(next); }
        }
      }
      ordered.push(...block.sort((a, b) => a - b));
    }
    for (let i = 0; i < ordered.length; i++) { budget.step(); coordinates.set(ordered[i], { x: (i - (ordered.length - 1) / 2) * (options.columnGap ?? 240), y: row * (options.rowGap ?? 180) }); }
  }
  return graph.nodes.filter(node => visible.ids.has(node.id)).map(node => ({ node, row: rows.get(node.id)!, ...coordinates.get(node.id)!, birthYear: safeBirthYear(node) }));
}
function route<E>(nodes: readonly LayoutNode[], edges: readonly NormalizedEdge<E>[], options: LayoutOptions, budget: Budget, diagnostics: Diagnostic[]): { routes: EdgeRoute<E>[]; junctions: ParentJunction[] } {
  const byId = new Map(nodes.map(node => [node.node.id, node])), parentGroups = new Map<number, Set<number>>();
  for (const edge of edges) {
    budget.step(); if (edge.type !== 'parent') continue;
    if (!parentGroups.has(edge.target)) parentGroups.set(edge.target, new Set());
    parentGroups.get(edge.target)!.add(edge.source);
  }
  const junctions: ParentJunction[] = [], junctionByChild = new Map<number, ParentJunction>();
  for (const [childId, parents] of parentGroups) {
    budget.step(); if (parents.size < 2) continue;
    const child = byId.get(childId)!;
    const junction: ParentJunction = { id: `coparents:${childId}`, type: 'co-parent-junction', childId, parentIds: [...parents].sort((a, b) => a - b), label: 'Recorded co-parents (not a partnership)', x: child.x, y: child.y - (options.rowGap ?? 180) / 2 };
    junctions.push(junction); junctionByChild.set(childId, junction);
  }
  junctions.sort((a, b) => a.childId - b.childId);
  const routes: EdgeRoute<E>[] = [], right = Math.max(0, ...nodes.map(node => node.x)), gap = options.columnGap ?? 240;
  for (const edge of edges) {
    budget.step(); const a = byId.get(edge.source)!, b = byId.get(edge.target)!;
    const key = edgeKey(edge), crossRow = edge.type === 'partner' && a.row !== b.row;
    let label = relationshipLabel(edge), junctionId: string | undefined;
    const first = { x: a.x, y: a.y }, last = { x: b.x, y: b.y };
    let points = [first, last];
    if (crossRow) {
      label += ' · cross-generation partnership';
      diagnostics.push({ code: 'cross_row_partner', severity: 'warning', message: 'Recorded ancestry takes precedence; explicit partnership is routed across rows.', edgeKey: key });
      const lane = right + gap * (1 + routes.length / 10);
      points = [first, { x: lane, y: a.y }, { x: lane, y: b.y }, last];
    } else if (edge.type === 'parent' && junctionByChild.has(edge.target)) {
      const junction = junctionByChild.get(edge.target)!; junctionId = junction.id;
      points = [first, { x: a.x, y: junction.y }, { x: junction.x, y: junction.y }, last];
    } else {
      const middle = a.y === b.y ? a.y - Math.min((options.rowGap ?? 180) * 0.4, 16 + routes.length * 4) : (a.y + b.y) / 2;
      points = [first, { x: a.x, y: middle }, { x: b.x, y: middle }, last];
    }
    routes.push({ key, edge, label, pattern: relationshipPattern(edge), crossRow, points, ...(junctionId ? { junctionId } : {}) });
  }
  return { routes, junctions };
}
export function layoutGraph<N, E>(input: GraphInput<N, E> | PreparedGraph<N, E>, options: LayoutOptions = {}): LayoutResult<N, E> {
  const graph = inputGraph(input, options.limits), diagnostics = [...graph.diagnostics, ...validateOptions(options)], budget = new Budget(graph.limits.maxIterations);
  let visible: Visibility<E> = { ids: new Set(graph.nodes.map(node => node.id)), edges: fallbackEdges(graph.edges, options), expansions: [], diagnostics: [] };
  const fallback = (mode: 'list' | 'empty' = 'list'): LayoutResult<N, E> => ({ mode, nodes: [], routes: [], junctions: [], list: listRows(graph, visible.ids, visible.edges), diagnostics, expansions: visible.expansions, truncation: graph.truncation, limits: graph.limits, stats: { iterations: budget.iterations, visibleNodes: visible.ids.size, visibleEdges: visible.edges.length } });
  if (hasErrors(diagnostics)) return fallback();
  if (!graph.nodes.length) return fallback('empty');
  if (!positiveId(options.focusId) || !graph.nodesById.has(options.focusId)) {
    diagnostics.push({ code: 'focus_missing', severity: 'warning', message: 'Select a person from the authorized directory to focus this projection.' }); return fallback();
  }
  try {
    visible = visibility(graph, options, budget); diagnostics.push(...visible.diagnostics);
    const ranked = rankAncestry(graph, budget), rows = alignPartners(ranked.ranks, ranked.components, visible.edges, options.focusId, budget);
    const nodes = place(graph, visible, rows, options, budget), routed = route(nodes, visible.edges, options, budget, diagnostics);
    return { mode: 'graph', nodes, ...routed, list: listRows(graph, visible.ids, visible.edges), diagnostics, expansions: visible.expansions, truncation: graph.truncation, limits: graph.limits, stats: { iterations: budget.iterations, visibleNodes: nodes.length, visibleEdges: routed.routes.length } };
  } catch (error) {
    if (error instanceof AncestryCycle) diagnostics.push({ code: 'ancestry_cycle', severity: 'error', message: 'Recorded parentage contains a cycle. Use the relationship list and correct the facts.' });
    else if (error instanceof IterationLimit) diagnostics.push({ code: 'iteration_limit', severity: 'error', message: 'Layout work limit reached. Use the bounded list or request a narrower lens.' });
    else throw error;
    return fallback();
  }
}
