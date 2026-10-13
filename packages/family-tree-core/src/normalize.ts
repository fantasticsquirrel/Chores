import { assessChronology, parsePartialDate } from './dates';
import { compareEdges, edgeKey, HARD_LIMITS, positiveId, resolveLimits } from './limits';
import type { GraphEdge, GraphInput, GraphLimits, GraphNode, NormalizedEdge, PreparedGraph } from './types';
const kinds = { parent: ['biological', 'adoptive', 'step', 'unknown'], care: ['guardian', 'caregiver'], partner: ['married', 'civil_union', 'partners', 'unknown'] };
function endpoints<M>(edge: GraphEdge<M>): [number, number] | null {
  if (('source' in edge) !== ('target' in edge)) return null;
  if ('source' in edge && 'target' in edge) {
    // Reject ambiguous aliases rather than silently repairing contradictory endpoints.
    if ('parent' in edge && (edge.parent !== edge.source || !('child' in edge) || edge.child !== edge.target)) return null;
    return [edge.source, edge.target];
  }
  return edge.type === 'parent' && 'parent' in edge ? [edge.parent, edge.child] : null;
}
/** Build once for immutable authorized projections; callers may reuse this index across focus/lens changes. */
export function prepareGraph<N, E>(input: GraphInput<N, E>, request?: Partial<GraphLimits>): PreparedGraph<N, E> {
  const { limits, diagnostics } = resolveLimits(request);
  const inputNodes: readonly GraphNode<N>[] = Array.isArray(input.nodes) ? input.nodes : [];
  const inputEdges: readonly GraphEdge<E>[] = Array.isArray(input.edges) ? input.edges : [];
  if (!Array.isArray(input.nodes)) diagnostics.push({ code: 'invalid_node', severity: 'error', message: 'Person projection must be an array.' });
  if (!Array.isArray(input.edges)) diagnostics.push({ code: 'invalid_edge', severity: 'error', message: 'Relationship projection must be an array.' });
  const inputNodeCount = inputNodes.length, inputEdgeCount = inputEdges.length;
  const truncation = { nodes: inputNodeCount > limits.maxNodes, edges: inputEdgeCount > limits.maxEdges, requiresExpansion: inputNodeCount > limits.maxNodes || inputEdgeCount > limits.maxEdges, inputNodeCount, inputEdgeCount };
  if (truncation.nodes) diagnostics.push({ code: 'node_limit', severity: 'error', message: 'Node projection limit reached. Request a narrower lens or authorized server expansion.' });
  if (truncation.edges) diagnostics.push({ code: 'edge_limit', severity: 'error', message: 'Edge projection limit reached. Request a narrower lens or authorized server expansion.' });
  // Never sort or inspect arbitrarily oversized input: scan at most the immutable hard ceiling.
  const rawNodes = inputNodes.slice(0, HARD_LIMITS.maxNodes).sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0));
  const nodes: GraphNode<N>[] = [], nodesById = new Map<number, GraphNode<N>>(), excluded = new Set<number>();
  for (const node of rawNodes) {
    if (!node || !positiveId(node.id) || typeof node.label !== 'string' || !node.label.trim() || (node.mergedIntoId != null && !positiveId(node.mergedIntoId))) {
      diagnostics.push({ code: 'invalid_node', severity: 'error', message: 'Invalid person record; list fallback used.' }); continue;
    }
    if (nodesById.has(node.id) || excluded.has(node.id)) {
      nodesById.delete(node.id);
      const prior = nodes.findIndex(person => person.id === node.id);
      if (prior >= 0) nodes.splice(prior, 1);
      excluded.add(node.id);
      diagnostics.push({ code: 'duplicate_node', severity: 'error', message: 'Duplicate person identifier.', personId: node.id }); continue;
    }
    if (node.archived || node.mergedIntoId != null) { excluded.add(node.id); continue; }
    if (nodes.length >= limits.maxNodes) { excluded.add(node.id); continue; }
    try { parsePartialDate(node.birthDate ?? null); }
    catch { diagnostics.push({ code: 'invalid_date', severity: 'error', message: 'Invalid recorded birth date; list fallback used.', personId: node.id }); }
    nodes.push(node); nodesById.set(node.id, node);
  }
  const validEdges: NormalizedEdge<E>[] = [], seen = new Set<string>();
  for (const edge of inputEdges.slice(0, HARD_LIMITS.maxEdges)) {
    if (!edge || !positiveId(edge.id) || !Object.hasOwn(kinds, edge.type) || !kinds[edge.type].includes(edge.kind) || (edge.type === 'partner' && !['current', 'separated', 'ended', 'unknown'].includes(edge.status))) {
      diagnostics.push({ code: 'invalid_edge', severity: 'error', message: 'Invalid typed relationship; list fallback used.' }); continue;
    }
    const pair = endpoints(edge);
    if (!pair || !pair.every(positiveId) || pair[0] === pair[1]) { diagnostics.push({ code: 'invalid_edge', severity: 'error', message: 'Invalid relationship endpoints.', edgeKey: edgeKey(edge) }); continue; }
    let [source, target] = pair;
    if (edge.type === 'partner' && source > target) [source, target] = [target, source];
    const normalized = { ...edge, source, target } as NormalizedEdge<E>, key = edgeKey(normalized);
    if (seen.has(key)) { diagnostics.push({ code: 'duplicate_edge', severity: 'error', message: 'Duplicate relationship identifier within its type.', edgeKey: key }); continue; }
    seen.add(key);
    if (excluded.has(source) || excluded.has(target)) continue;
    if (!nodesById.has(source) || !nodesById.has(target)) { diagnostics.push({ code: 'missing_endpoint', severity: 'error', message: 'Relationship references a person absent from this projection.', edgeKey: key }); continue; }
    try {
      const chronology = assessChronology(edge.startDate ?? null, edge.endDate ?? null);
      if (chronology.status === 'error') throw new Error('Invalid chronology');
      if (chronology.status === 'warning') diagnostics.push({ code: 'invalid_date', severity: 'warning', message: chronology.message, edgeKey: key });
    } catch { diagnostics.push({ code: 'invalid_date', severity: 'error', message: 'Invalid relationship date range.', edgeKey: key }); }
    validEdges.push(normalized);
  }
  const edges = validEdges.sort(compareEdges).slice(0, limits.maxEdges);
  const parents = new Map<number, NormalizedEdge<E>[]>(), children = new Map<number, NormalizedEdge<E>[]>(), neighbors = new Map<number, NormalizedEdge<E>[]>();
  for (const node of nodes) { parents.set(node.id, []); children.set(node.id, []); neighbors.set(node.id, []); }
  for (const edge of edges) {
    neighbors.get(edge.source)!.push(edge); neighbors.get(edge.target)!.push(edge);
    if (edge.type === 'parent') { children.get(edge.source)!.push(edge); parents.get(edge.target)!.push(edge); }
  }
  // Diagnostic ordering must be deterministic too, including malformed accepted-size input.
  const textOrder = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  diagnostics.sort((a, b) => textOrder(a.code, b.code) || (a.personId ?? 0) - (b.personId ?? 0) || textOrder(a.edgeKey ?? '', b.edgeKey ?? '') || textOrder(a.message, b.message));
  return { prepared: true, nodes, edges, nodesById, parents, children, neighbors, diagnostics, truncation, limits };
}
