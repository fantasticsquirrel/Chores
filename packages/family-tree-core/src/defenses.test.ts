import { describe, it, expect } from 'vitest';
import { layoutGraph, comparePeople, parsePartialDate, prepareGraph } from './index';
import type { GraphInput, GraphEdge } from './index';
const nodes = (count: number) => Array.from({ length: count }, (_, i) => ({ id: i + 1, label: `Person ${i + 1}` }));
const edge = (id: number, source: number, target: number): GraphEdge => ({ id, source, target, type: 'parent', kind: 'unknown' });

describe('hard-ceiling and corruption defenses', () => {
  it('rejects explicit null uncertainty instead of silently coercing it to certain', () => {
    expect(() => parsePartialDate({ value: '1984', uncertain: null } as never)).toThrow(/uncertain/);
  });
  it('rejects partial conflicting source/target aliases rather than repairing source silently', () => {
    const input = { nodes: nodes(3), edges: [{ id: 1, type: 'parent', kind: 'step', source: 3, parent: 1, child: 2 }] } as unknown as GraphInput;
    const result = layoutGraph(input, { focusId: 1 });
    expect(result.mode).toBe('list');
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'invalid_edge' }));
  });
  it('omits all ambiguous duplicate nodes rather than arbitrarily selecting different metadata by input order', () => {
    const a = { id: 1, label: 'A', metadata: { note: 'A' } }, b = { id: 1, label: 'B', metadata: { note: 'B' } };
    const one = layoutGraph({ nodes: [a, b], edges: [] }, { focusId: 1 });
    const two = layoutGraph({ nodes: [b, a], edges: [] }, { focusId: 1 });
    expect(one.list).toEqual([]);
    expect(one).toEqual(two);
  });
  it('caps work before reading oversized node/edge inputs, and announces partial lists', () => {
    let touchedNodes = 0, touchedEdges = 0;
    const people = nodes(10000), edges = Array.from({ length: 10000 }, (_, i) => edge(i + 1, 1, 2));
    for (let i = 500; i < people.length; i++) Object.defineProperty(people, i, { get() { touchedNodes++; throw new Error('Unbounded node read'); } });
    for (let i = 1000; i < edges.length; i++) Object.defineProperty(edges, i, { get() { touchedEdges++; throw new Error('Unbounded edge read'); } });
    const result = layoutGraph({ nodes: people, edges }, { focusId: 1, limits: { maxNodes: 500, maxEdges: 1000 } });
    expect(result.mode).toBe('list');
    expect(result.list).toHaveLength(500);
    expect(result.truncation).toMatchObject({ nodes: true, edges: true, inputNodeCount: 10000, inputEdgeCount: 10000, requiresExpansion: true });
    expect(touchedNodes + touchedEdges).toBe(0);
  });
  it('caps invalid collapse arrays before a fallback tries to consume them', () => {
    const collapse = Array.from({ length: 501 }, (_, i) => i + 1);
    Object.defineProperty(collapse, 500, { get() { throw new Error('Unbounded collapse read'); } });
    const result = layoutGraph({ nodes: nodes(2), edges: [edge(1, 1, 2)] }, { focusId: 1, collapsedDescendants: collapse });
    expect(result.mode).toBe('list');
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'invalid_options' }));
  });
  it('keeps previously truncated indexes truncated when a caller increases limits', () => {
    const prepared = prepareGraph({ nodes: nodes(300), edges: [] });
    expect(layoutGraph(prepared, { focusId: 1, limits: { maxNodes: 500 } }).truncation.nodes).toBe(true);
    expect(layoutGraph(prepared, { focusId: 1, limits: { maxNodes: 500 } }).mode).toBe('list');
  });
  it('rejects impossible relationship intervals and preserves review warnings for uncertain intervals', () => {
    const certain: GraphInput = { nodes: nodes(2), edges: [{ id: 1, type: 'partner', source: 1, target: 2, kind: 'partners', status: 'ended', startDate: '2001', endDate: '2000' }] };
    expect(layoutGraph(certain, { focusId: 1, includePartners: true }).mode).toBe('list');
    const uncertain = { ...certain, edges: [{ ...certain.edges[0], startDate: { value: '2001', uncertain: true } }] };
    expect(layoutGraph(uncertain, { focusId: 1, includePartners: true }).mode).toBe('graph');
    expect(layoutGraph(uncertain, { focusId: 1, includePartners: true }).diagnostics).toContainEqual(expect.objectContaining({ code: 'invalid_date', severity: 'warning' }));
  });
  it('never rediscovers a collapsed edge through partner context, including list fallback', () => {
    const input: GraphInput = { nodes: nodes(3), edges: [edge(1, 1, 2), { id: 1, type: 'partner', source: 1, target: 3, kind: 'partners', status: 'current' }, { id: 2, type: 'partner', source: 2, target: 3, kind: 'partners', status: 'current' }] };
    const options = { focusId: 1, collapsedDescendants: [1], includePartners: true };
    const result = layoutGraph(input, options);
    expect(result.list).toHaveLength(3);
    expect(result.routes.some(r => r.key === 'parent:1')).toBe(false);
    const fallback = layoutGraph(input, { ...options, limits: { maxIterations: 1 } });
    expect(fallback.mode).toBe('list');
    expect(fallback.list.flatMap(row => row.relationships).some(r => r.key === 'parent:1')).toBe(false);
  });
  it('detects even an off-lens ancestry cycle and rejects invalid numeric spacing/depth/limits', () => {
    const input = { nodes: nodes(3), edges: [edge(1, 2, 3), edge(2, 3, 2)] };
    expect(layoutGraph(input, { focusId: 1 }).diagnostics).toContainEqual(expect.objectContaining({ code: 'ancestry_cycle' }));
    for (const option of [{ rowGap: Number.POSITIVE_INFINITY }, { columnGap: 0 }, { ancestorDepth: -1 }, { descendantDepth: 33 }, { limits: { maxIterations: NaN } }, { limits: { maxEdges: 1001 } }]) {
      expect(layoutGraph({ nodes: nodes(2), edges: [] }, { focusId: 1, ...option }).mode).toBe('list');
    }
  });
  it('rejects malformed projection containers and collapse options with a safe diagnostic list', () => {
    for (const input of [{ nodes: null, edges: [] }, { nodes: nodes(2), edges: null }]) {
      expect(layoutGraph(input as never, { focusId: 1 }).mode).toBe('list');
    }
    for (const collapse of ['bad', 1, { length: 2 }]) {
      expect(layoutGraph({ nodes: nodes(2), edges: [] }, { focusId: 1, collapsedDescendants: collapse as never }).mode).toBe('list');
    }
  });
  it('validates exact 500-node/1000-edge boundaries with explicit limits and bounded iterations', () => {
    const input: GraphInput = { nodes: nodes(500), edges: [
      ...Array.from({ length: 499 }, (_, i) => edge(i + 1, Math.floor(i / 2) + 1, i + 2)),
      ...Array.from({ length: 501 }, (_, i) => ({ id: i + 1, type: 'partner' as const, kind: 'partners' as const, status: 'current' as const, source: 1, target: 2 + i % 499 })),
    ] };
    const result = layoutGraph(input, { focusId: 1, descendantDepth: 32, includePartners: true, limits: { maxNodes: 500, maxEdges: 1000 } });
    expect(result.mode).toBe('graph');
    expect(result.list).toHaveLength(500);
    expect(result.routes).toHaveLength(1000);
    expect(result.stats.iterations).toBeLessThanOrEqual(result.limits.maxIterations);
    expect(result.truncation.requiresExpansion).toBe(false);
    expect(comparePeople(input, 1, 500, { limits: { maxNodes: 500, maxEdges: 1000 } }).status).toBe('connected');
  });
});
