import type { GraphEdge, GraphInput } from '../src/index';
/** Disposable synthetic fixtures only: binary ancestry, directed care and cross-row episodes. */
export function syntheticProjection(size: 100 | 500): GraphInput {
  const nodes = Array.from({ length: size }, (_, i) => ({ id: i + 1, label: `Synthetic ${i + 1}`, birthDate: i % 5 === 0 ? null : { value: String(1900 + i % 100), uncertain: i % 7 === 0 }, metadata: { tags: ['benchmark-only'], is_locked: i % 11 === 0 } }));
  const edges: GraphEdge[] = [];
  for (let child = 2; child <= size; child++) edges.push({ id: child - 1, type: 'parent', kind: child % 4 === 0 ? 'adoptive' : child % 4 === 1 ? 'step' : child % 4 === 2 ? 'unknown' : 'biological', source: Math.floor(child / 2), target: child });
  for (let i = 1; i <= size / 2; i++) {
    edges.push({ id: i, type: 'partner', source: i, target: size - i + 1, kind: 'partners', status: i % 3 === 0 ? 'ended' : 'current', startDate: { value: '2000', uncertain: true }, metadata: { source: 'Synthetic episode' } });
    edges.push({ id: i, type: 'care', source: size - i + 1, target: i, kind: i % 2 === 0 ? 'guardian' : 'caregiver' });
  }
  return { nodes, edges };
}
