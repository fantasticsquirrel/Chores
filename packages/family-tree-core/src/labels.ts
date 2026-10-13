import { birthYearPresentation } from './dates';
import { edgeKey, historical } from './limits';
import type { BirthYearPresentation } from './dates';
import type { EdgePattern, GraphNode, ListRow, NormalizedEdge, PreparedGraph } from './types';
const parentLabels = { biological: 'Recorded biological parent', adoptive: 'Recorded adoptive parent', step: 'Recorded step parent', unknown: 'Recorded parent (type unknown)' };
const partnerLabels = { married: 'Married', civil_union: 'Civil union', partners: 'Partners', unknown: 'Partnership (kind unknown)' };
export function relationshipLabel(edge: NormalizedEdge, from = edge.source): string {
  if (edge.type === 'parent') return from === edge.source ? parentLabels[edge.kind] : `Recorded child through ${edge.kind === 'unknown' ? 'parent of unknown type' : `${edge.kind} parent`}`;
  if (edge.type === 'care') return edge.kind === 'guardian' ? 'Guardian connection' : 'Caregiver connection';
  return `${partnerLabels[edge.kind]} · ${edge.status}`;
}
export function relationshipPattern(edge: NormalizedEdge): EdgePattern {
  if (edge.type === 'care') return 'dashed';
  if (edge.type === 'partner') return historical(edge) ? 'dashed' : edge.status === 'unknown' || edge.kind === 'unknown' ? 'dotted' : 'solid';
  return { biological: 'solid', adoptive: 'double', step: 'dash-dot', unknown: 'dotted' }[edge.kind] as EdgePattern;
}
export const RELATIONSHIP_LEGEND = Object.freeze([
  { type: 'parent', kind: 'biological', label: parentLabels.biological, pattern: 'solid' },
  { type: 'parent', kind: 'adoptive', label: parentLabels.adoptive, pattern: 'double' },
  { type: 'parent', kind: 'step', label: parentLabels.step, pattern: 'dash-dot' },
  { type: 'parent', kind: 'unknown', label: parentLabels.unknown, pattern: 'dotted' },
  { type: 'care', kind: 'guardian', label: 'Guardian connection', pattern: 'dashed' },
  { type: 'care', kind: 'caregiver', label: 'Caregiver connection', pattern: 'dashed' },
  { type: 'partner', label: 'Explicit current partnership', pattern: 'solid' },
  { type: 'partner', label: 'Explicit ended or separated partnership', pattern: 'dashed' },
  { type: 'partner', label: 'Partnership kind or status unknown', pattern: 'dotted' },
  { type: 'co-parent-junction', label: 'Recorded co-parents (not a partnership)', pattern: 'solid' },
] as const);
export function safeBirthYear(node: GraphNode): BirthYearPresentation {
  try { return birthYearPresentation(node.birthDate ?? null); }
  catch { return { label: 'Birth date invalid; review recorded value', bucket: { kind: 'unknown', label: 'Birth year unknown' } }; }
}
/** One bounded relationship pass, not a scan of all candidate people per card. */
export function listRows<N, E>(graph: PreparedGraph<N, E>, ids: ReadonlySet<number>, edges: readonly NormalizedEdge<E>[]): ListRow<N, E>[] {
  const rows = graph.nodes.filter(node => ids.has(node.id)).map(node => ({ node, birthYear: safeBirthYear(node), relationships: [] as ListRow<N, E>['relationships'][number][] }));
  const byId = new Map(rows.map(row => [row.node.id, row]));
  for (const edge of edges) {
    byId.get(edge.source)?.relationships.push({ key: edgeKey(edge), edge, otherId: edge.target, label: relationshipLabel(edge), pattern: relationshipPattern(edge) });
    byId.get(edge.target)?.relationships.push({ key: edgeKey(edge), edge, otherId: edge.source, label: relationshipLabel(edge, edge.target), pattern: relationshipPattern(edge) });
  }
  return rows;
}
