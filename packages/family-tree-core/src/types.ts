import type { BirthYearPresentation, DateInput } from './dates';
export type ParentKind = 'biological' | 'adoptive' | 'step' | 'unknown';
export type CareKind = 'guardian' | 'caregiver';
export type PartnerKind = 'married' | 'civil_union' | 'partners' | 'unknown';
export type PartnerStatus = 'current' | 'separated' | 'ended' | 'unknown';
export interface GraphNode<M = unknown> {
  readonly id: number;
  readonly label: string;
  readonly birthDate?: DateInput;
  readonly archived?: boolean;
  readonly mergedIntoId?: number | null;
  readonly metadata?: M;
}
export interface SourceTarget { readonly source: number; readonly target: number }
interface EdgeBase<M> {
  readonly id: number;
  readonly metadata?: M;
  readonly startDate?: DateInput;
  readonly endDate?: DateInput;
}
export type GraphEdge<M = unknown> =
  | (EdgeBase<M> & { readonly type: 'parent'; readonly kind: ParentKind } & (SourceTarget | { readonly parent: number; readonly child: number }))
  | (EdgeBase<M> & SourceTarget & { readonly type: 'care'; readonly kind: CareKind })
  | (EdgeBase<M> & SourceTarget & { readonly type: 'partner'; readonly kind: PartnerKind; readonly status: PartnerStatus });
export type NormalizedEdge<M = unknown> = GraphEdge<M> & SourceTarget;
export interface GraphInput<N = unknown, E = unknown> { readonly nodes: readonly GraphNode<N>[]; readonly edges: readonly GraphEdge<E>[] }
export interface GraphLimits { maxNodes: number; maxEdges: number; maxIterations: number }
export type DiagnosticCode = 'invalid_node' | 'duplicate_node' | 'invalid_edge' | 'duplicate_edge' | 'missing_endpoint' | 'invalid_date' | 'node_limit' | 'edge_limit' | 'invalid_options' | 'focus_missing' | 'ancestry_cycle' | 'iteration_limit' | 'cross_row_partner' | 'also_connected';
export interface Diagnostic { code: DiagnosticCode; severity: 'warning' | 'error'; message: string; personId?: number; edgeKey?: string }
export interface Truncation { nodes: boolean; edges: boolean; requiresExpansion: boolean; inputNodeCount: number; inputEdgeCount: number }
export interface PreparedGraph<N = unknown, E = unknown> {
  readonly prepared: true;
  readonly nodes: readonly GraphNode<N>[];
  readonly edges: readonly NormalizedEdge<E>[];
  readonly nodesById: ReadonlyMap<number, GraphNode<N>>;
  readonly parents: ReadonlyMap<number, readonly NormalizedEdge<E>[]>;
  readonly children: ReadonlyMap<number, readonly NormalizedEdge<E>[]>;
  readonly neighbors: ReadonlyMap<number, readonly NormalizedEdge<E>[]>;
  readonly diagnostics: readonly Diagnostic[];
  readonly truncation: Truncation;
  readonly limits: GraphLimits;
}
export interface LayoutOptions {
  focusId?: number;
  ancestorDepth?: number;
  descendantDepth?: number;
  includePartners?: boolean;
  includeCare?: boolean;
  showHistoricalPartners?: boolean;
  collapsedAncestors?: readonly number[];
  collapsedDescendants?: readonly number[];
  limits?: Partial<GraphLimits>;
  columnGap?: number;
  rowGap?: number;
}
export interface CompareOptions { limits?: Partial<GraphLimits>; showHistoricalPartners?: boolean }
export type EdgePattern = 'solid' | 'double' | 'dashed' | 'dotted' | 'dash-dot';
export interface Point { x: number; y: number }
export interface LayoutNode<N = unknown> extends Point { node: GraphNode<N>; row: number; birthYear: BirthYearPresentation }
export interface EdgeRoute<E = unknown> { key: string; edge: NormalizedEdge<E>; label: string; pattern: EdgePattern; crossRow: boolean; points: readonly Point[]; junctionId?: string }
export interface ParentJunction extends Point { id: string; type: 'co-parent-junction'; childId: number; parentIds: readonly number[]; label: 'Recorded co-parents (not a partnership)' }
export interface ListRelationship<E = unknown> { key: string; edge: NormalizedEdge<E>; otherId: number; label: string; pattern: EdgePattern }
export interface ListRow<N = unknown, E = unknown> { node: GraphNode<N>; birthYear: BirthYearPresentation; relationships: readonly ListRelationship<E>[] }
export interface Expansion { personId: number; direction: 'ancestors' | 'descendants'; count: number; reason: 'collapsed' | 'depth'; }
export interface LayoutResult<N = unknown, E = unknown> {
  mode: 'graph' | 'list' | 'empty';
  nodes: readonly LayoutNode<N>[];
  routes: readonly EdgeRoute<E>[];
  junctions: readonly ParentJunction[];
  list: readonly ListRow<N, E>[];
  diagnostics: readonly Diagnostic[];
  expansions: readonly Expansion[];
  truncation: Truncation;
  limits: GraphLimits;
  stats: { iterations: number; visibleNodes: number; visibleEdges: number };
}
export interface ConnectionStep<E = unknown> { from: number; to: number; edge: NormalizedEdge<E>; label: string }
export interface ComparisonResult<E = unknown> {
  status: 'connected' | 'disconnected' | 'invalid' | 'limited';
  distance: number | null;
  steps: readonly ConnectionStep<E>[];
  diagnostics: readonly Diagnostic[];
  iterations: number;
}
