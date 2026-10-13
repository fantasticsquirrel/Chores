import { describe, it, expect } from 'vitest';
import { layoutGraph, prepareGraph, comparePeople, RELATIONSHIP_LEGEND } from './index';
import type { GraphInput, GraphEdge, GraphNode } from './index';
const node = (id: number, extra = {}): GraphNode => ({ id, label: `Person ${id}`, ...extra });
const parent = (id: number, source: number, target: number, kind = 'biological'): GraphEdge => ({ id, type: 'parent', source, target, kind } as GraphEdge);
const partner = (id: number, source: number, target: number, status = 'current'): GraphEdge => ({ id, type: 'partner', source, target, kind: 'married', status } as GraphEdge);
const graph = (ids: number[], edges: GraphEdge[]): GraphInput => ({ nodes: ids.map(id => node(id)), edges });
const opts = { focusId: 1, ancestorDepth: 10, descendantDepth: 10, includePartners: true, includeCare: true };
const ids = (result: ReturnType<typeof layoutGraph>) => result.list.map(row => row.node.id);
const routeKeys = (result: ReturnType<typeof layoutGraph>) => result.routes.map(route => route.key);

describe('bounded deterministic graph stages', () => {
  it('keeps empty input usable and missing focus a directory fallback instead of picking an inserted person', () => {
    expect(layoutGraph(graph([], []), opts)).toMatchObject({ mode: 'empty', nodes: [], list: [], routes: [] });
    const result = layoutGraph(graph([7, 3], []), opts);
    expect(result.mode).toBe('list');
    expect(ids(result)).toEqual([3, 7]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'focus_missing' }));
  });
  it('normalizes parent/child and canonical partner endpoint aliases while retaining all typed metadata', () => {
    const metadata = { source: 'Family letter', flags: ['review'], uncertain: true };
    const input: GraphInput = { nodes: [node(1, { metadata, birthDate: { value: '1984-02', uncertain: true } }), node(2)], edges: [
      { id: 1, type: 'parent', parent: 1, child: 2, kind: 'adoptive', metadata },
      { id: 1, type: 'partner', source: 2, target: 1, kind: 'civil_union', status: 'ended', startDate: { value: '2001', uncertain: true }, metadata },
    ] };
    const prepared = prepareGraph(input);
    expect(prepared.edges.map(edge => [edge.type, edge.source, edge.target])).toEqual([['parent', 1, 2], ['partner', 1, 2]]);
    const result = layoutGraph(prepared, opts);
    expect(result.nodes.find(n => n.node.id === 1)?.node.metadata).toBe(metadata);
    expect(result.routes.find(r => r.key === 'partner:1')?.edge).toMatchObject({ kind: 'civil_union', status: 'ended', startDate: { value: '2001', uncertain: true }, metadata });
    expect(result.routes.find(r => r.key === 'parent:1')?.label).toBe('Recorded adoptive parent');
  });
  it('preserves explicit cross-generation partnerships and ancestry precedence', () => {
    const result = layoutGraph(graph([1, 2, 3], [parent(1, 1, 2), parent(2, 2, 3), partner(1, 1, 3)]), opts);
    expect(result.mode).toBe('graph');
    expect(result.nodes.map(n => [n.node.id, n.row])).toEqual([[1, 0], [2, 1], [3, 2]]);
    expect(result.routes.find(r => r.key === 'partner:1')).toMatchObject({ crossRow: true, label: 'Married · current · cross-generation partnership' });
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'cross_row_partner', edgeKey: 'partner:1' }));
  });
  it('aligns an unrelated childless partner branch without flattening its ancestry', () => {
    const result = layoutGraph(graph([1, 2, 3, 4], [parent(1, 1, 2), parent(2, 3, 4), partner(1, 2, 3)]), { ...opts, focusId: 2 });
    const rows = new Map(result.nodes.map(n => [n.node.id, n.row]));
    expect(rows.get(1)).toBe(-1);
    expect(rows.get(2)).toBe(0);
    expect(rows.get(3)).toBe(0);
    expect(result.routes.find(r => r.key === 'partner:1')?.crossRow).toBe(false);
    expect(ids(layoutGraph(graph([1, 2], [partner(1, 1, 2)]), opts))).toEqual([1, 2]);
  });
  it('retains all parent types and care labels without generating genetic kinship or a marriage', () => {
    const input = graph([1, 2, 3, 4, 5], [parent(1, 1, 5), parent(2, 2, 5, 'adoptive'), parent(3, 3, 5, 'step'), parent(4, 4, 5, 'unknown'), { id: 1, type: 'care', source: 1, target: 4, kind: 'guardian' }]);
    const result = layoutGraph(input, { ...opts, focusId: 5 });
    expect(result.routes.filter(r => r.edge.type === 'parent').map(r => r.label)).toEqual(['Recorded biological parent', 'Recorded adoptive parent', 'Recorded step parent', 'Recorded parent (type unknown)']);
    expect(result.routes.some(r => r.edge.type === 'partner')).toBe(false);
    expect(result.junctions).toContainEqual(expect.objectContaining({ type: 'co-parent-junction', childId: 5, parentIds: [1, 2, 3, 4], label: 'Recorded co-parents (not a partnership)' }));
    expect(result.routes.find(r => r.edge.type === 'care')).toMatchObject({ label: 'Guardian connection', pattern: 'dashed' });
    expect(RELATIONSHIP_LEGEND.some(entry => entry.label === 'Guardian connection')).toBe(true);
  });
  it('lets reciprocal guardian/caregiver networks terminate without imposing ancestry ranks', () => {
    const result = layoutGraph(graph([1, 2], [{ id: 1, type: 'care', source: 1, target: 2, kind: 'guardian' }, { id: 2, type: 'care', source: 2, target: 1, kind: 'caregiver' }]), opts);
    expect(result.mode).toBe('graph');
    expect(result.nodes.map(n => n.row)).toEqual([0, 0]);
    expect(result.stats.iterations).toBeLessThan(100);
  });
  it('keeps repeated/current/divorced episodes and applies an explicit historical filter', () => {
    const input = graph([1, 2, 3], [partner(1, 1, 2, 'ended'), partner(2, 1, 2), partner(3, 1, 3, 'separated'), partner(4, 1, 3, 'unknown')]);
    expect(routeKeys(layoutGraph(input, opts))).toEqual(['partner:1', 'partner:2', 'partner:3', 'partner:4']);
    const result = layoutGraph(input, { ...opts, showHistoricalPartners: false });
    expect(routeKeys(result)).toEqual(['partner:2', 'partner:4']);
    expect(result.routes[1].label).toContain('unknown');
    expect(layoutGraph(input, { ...opts, includePartners: false }).routes).toEqual([]);
  });
  it('does not redraw a collapsed descendant edge when a shared descendant remains reachable elsewhere', () => {
    const input = graph([1, 2, 3, 4], [parent(1, 1, 2), parent(2, 1, 3), parent(3, 2, 4), parent(4, 3, 4)]);
    const result = layoutGraph(input, { ...opts, collapsedDescendants: [2] });
    expect(ids(result)).toEqual([1, 2, 3, 4]);
    expect(routeKeys(result)).toEqual(['parent:1', 'parent:2', 'parent:4']);
    expect(result.list.find(row => row.node.id === 2)?.relationships.some(r => r.key === 'parent:3')).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'also_connected', personId: 4, edgeKey: 'parent:3' }));
    expect(ids(layoutGraph(input, { ...opts, collapsedDescendants: [1] }))).toEqual([1]);
  });
  it('supports independent ancestor collapse on shared pedigree without restoring its hidden edge', () => {
    const input = graph([1, 2, 3, 4], [parent(1, 1, 2), parent(2, 1, 3), parent(3, 2, 4), parent(4, 3, 4)]);
    const result = layoutGraph(input, { ...opts, focusId: 4, collapsedAncestors: [2] });
    expect(ids(result)).toEqual([1, 2, 3, 4]);
    expect(routeKeys(result)).not.toContain('parent:1');
    expect(routeKeys(result)).toContain('parent:2');
  });
  it('gives corrupt parent cycles a diagnostic and a bounded usable typed list', () => {
    const result = layoutGraph(graph([1, 2], [parent(1, 1, 2), parent(2, 2, 1, 'step')]), opts);
    expect(result.mode).toBe('list');
    expect(result.nodes).toEqual([]);
    expect(result.routes).toEqual([]);
    expect(ids(result)).toEqual([1, 2]);
    expect(result.list[0].relationships[0].label).toBe('Recorded biological parent');
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'ancestry_cycle' }));
    expect(result.stats.iterations).toBeLessThan(100);
  });
  it('is stable under node/edge reorder, and keeps same-row cards apart', () => {
    const input = graph([5, 3, 1, 4, 2], [parent(3, 2, 5), parent(1, 1, 2), parent(2, 1, 3), partner(1, 2, 4)]);
    const a = layoutGraph(input, opts), b = layoutGraph({ nodes: [...input.nodes].reverse(), edges: [...input.edges].reverse() }, opts);
    expect(a).toEqual(b);
    const positions = a.nodes.map(n => `${n.x}:${n.y}`);
    expect(new Set(positions).size).toBe(a.nodes.length);
  });
  it('does not mutate frozen projected data or lose single names, flags, nulls or unknown dates', () => {
    const input = Object.freeze({ nodes: Object.freeze([Object.freeze(node(1, { label: 'Mo', birthDate: null, metadata: Object.freeze({ is_locked: true, tags: ['research'], maiden_name: null }) }))]), edges: Object.freeze([]) });
    const result = layoutGraph(input, opts);
    expect(result.list[0].node).toBe(input.nodes[0]);
    expect(result.nodes[0].birthYear.label).toBe('Birth year unknown');
    expect(result.nodes[0].birthYear.bucket.kind).toBe('unknown');
  });
  it('omits archived and merged aliases while keeping a disconnected component focusable', () => {
    const input = { nodes: [node(1), node(2, { archived: true }), node(3, { mergedIntoId: 1 }), node(7)], edges: [parent(1, 1, 2)] };
    expect(ids(layoutGraph(input, opts))).toEqual([1]);
    expect(ids(layoutGraph(input, { ...opts, focusId: 7 }))).toEqual([7]);
    expect(layoutGraph(input, { ...opts, focusId: 3 }).mode).toBe('list');
  });
  it('returns explicit truncation/expansion diagnostics at default and configurable hard ceilings', () => {
    const input = graph(Array.from({ length: 500 }, (_, i) => i + 1), Array.from({ length: 499 }, (_, i) => parent(i + 1, i + 1, i + 2)));
    const limited = layoutGraph(input, { ...opts, descendantDepth: 32 });
    expect(limited.mode).toBe('list');
    expect(limited.list.length).toBeLessThanOrEqual(250);
    expect(limited.truncation).toMatchObject({ nodes: true, requiresExpansion: true, inputNodeCount: 500 });
    expect(limited.diagnostics).toContainEqual(expect.objectContaining({ code: 'node_limit' }));
    const explicit = layoutGraph(input, { ...opts, limits: { maxNodes: 500, maxEdges: 1000 }, descendantDepth: 32 });
    expect(explicit.mode).toBe('graph');
    expect(explicit.truncation.nodes).toBe(false);
    expect(ids(explicit)).toHaveLength(33);
    expect(explicit.expansions).toContainEqual(expect.objectContaining({ personId: 33, direction: 'descendants', count: 1 }));
    expect(layoutGraph(input, { ...opts, limits: { maxNodes: 501 } }).diagnostics).toContainEqual(expect.objectContaining({ code: 'invalid_options' }));
  });
  it('bounds dense edge input separately and iteration exhaustion never emits partial geometry', () => {
    const input = graph([1, 2], Array.from({ length: 501 }, (_, i) => partner(i + 1, 1, 2)));
    const result = layoutGraph(input, opts);
    expect(result.mode).toBe('list');
    expect(result.truncation.edges).toBe(true);
    expect(result.list[0].relationships.length).toBeLessThanOrEqual(500);
    const exhausted = layoutGraph(graph([1, 2], [parent(1, 1, 2)]), { ...opts, limits: { maxIterations: 1 } });
    expect(exhausted).toMatchObject({ mode: 'list', nodes: [], routes: [], stats: { iterations: 1 } });
    expect(exhausted.diagnostics).toContainEqual(expect.objectContaining({ code: 'iteration_limit' }));
  });
  it.each([
    graph([1, 1], []), graph([0, 1], []), graph([1, 2], [parent(1, 1, 99)]), graph([1, 2], [parent(1, 1, 2), parent(1, 1, 2)]),
    { nodes: [node(1, { birthDate: { value: '2023-02-29' } })], edges: [] },
    graph([1, 2], [{ id: 1, type: 'parent', source: 1, target: 2, kind: 'invented' } as never]),
  ])('falls back safely for malformed input %#', input => {
    const result = layoutGraph(input, opts);
    expect(result.mode).toBe('list');
    expect(result.nodes).toEqual([]);
    expect(result.diagnostics.some(d => d.severity === 'error')).toBe(true);
  });
  it('defaults to two ancestor/descendant levels and explicitly requested care/partner context', () => {
    const input = graph([1, 2, 3, 4, 5], [parent(1, 1, 2), parent(2, 2, 3), parent(3, 3, 4), partner(1, 1, 5)]);
    expect(ids(layoutGraph(input, { focusId: 1 }))).toEqual([1, 2, 3]);
    expect(ids(layoutGraph(input, { focusId: 1, includePartners: true }))).toEqual([1, 2, 3, 5]);
  });
});

describe('typed bounded connection comparison', () => {
  it('finds a deterministic shortest explainable path without unqualified kinship inference', () => {
    const input = graph([1, 2, 3, 4], [{ id: 1, type: 'care', source: 1, target: 2, kind: 'guardian', metadata: { source: 'Letter' } }, parent(1, 2, 4, 'adoptive'), partner(1, 1, 3), parent(2, 3, 4)]);
    const result = comparePeople(input, 1, 4);
    expect(result.status).toBe('connected');
    expect(result.distance).toBe(2);
    expect(result.steps.map(s => s.to)).toEqual([2, 4]);
    expect(result.steps[0]).toMatchObject({ label: 'Guardian connection', edge: { kind: 'guardian', metadata: { source: 'Letter' } } });
    expect(result.steps[1].label).toBe('Recorded adoptive parent');
    expect(JSON.stringify(result)).not.toMatch(/genetic|half-sibling|full-sibling/);
    expect(comparePeople({ nodes: [...input.nodes].reverse(), edges: [...input.edges].reverse() }, 1, 4)).toEqual(result);
  });
  it('reports self distance, disconnected branches, reversed semantics and explicit bounded exhaustion', () => {
    const input = graph([1, 2, 3], [parent(1, 1, 2, 'step')]);
    expect(comparePeople(input, 1, 1)).toMatchObject({ status: 'connected', distance: 0, steps: [] });
    expect(comparePeople(input, 1, 3)).toMatchObject({ status: 'disconnected', distance: null, steps: [] });
    expect(comparePeople(input, 2, 1).steps[0].label).toBe('Recorded child through step parent');
    expect(comparePeople(input, 1, 2, { limits: { maxIterations: 1 } })).toMatchObject({ status: 'limited', distance: null, steps: [] });
    expect(comparePeople(input, 1, 99).status).toBe('invalid');
  });
  it('uses visited defenses on reciprocal care and never claims hidden historical episodes form a path', () => {
    const input = graph([1, 2, 3], [{ id: 1, type: 'care', source: 1, target: 2, kind: 'caregiver' }, { id: 2, type: 'care', source: 2, target: 1, kind: 'guardian' }, partner(1, 2, 3, 'ended')]);
    expect(comparePeople(input, 1, 3).distance).toBe(2);
    expect(comparePeople(input, 1, 3, { showHistoricalPartners: false }).status).toBe('disconnected');
  });
});
