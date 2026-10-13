import type { Diagnostic, GraphLimits, NormalizedEdge } from './types';
export const DEFAULT_LIMITS: Readonly<GraphLimits> = Object.freeze({ maxNodes: 250, maxEdges: 500, maxIterations: 20000 });
export const HARD_LIMITS: Readonly<GraphLimits> = Object.freeze({ maxNodes: 500, maxEdges: 1000, maxIterations: 100000 });
export const positiveId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
export const edgeKey = (edge: Pick<NormalizedEdge, 'type' | 'id'>) => `${edge.type}:${edge.id}`;
const edgeOrder = { parent: 0, care: 1, partner: 2 };
export const compareEdges = (a: NormalizedEdge, b: NormalizedEdge) => edgeOrder[a.type] - edgeOrder[b.type] || a.id - b.id;
export function resolveLimits(request: Partial<GraphLimits> = {}): { limits: GraphLimits; diagnostics: Diagnostic[] } {
  const limits = { ...DEFAULT_LIMITS }, diagnostics: Diagnostic[] = [];
  for (const key of ['maxNodes', 'maxEdges', 'maxIterations'] as const) {
    const value = request[key];
    if (value === undefined) continue;
    if (!Number.isSafeInteger(value) || value < 1 || value > HARD_LIMITS[key]) diagnostics.push({ code: 'invalid_options', severity: 'error', message: `Invalid ${key}; bounded list fallback used.` });
    else limits[key] = value;
  }
  return { limits, diagnostics };
}
export class IterationLimit extends Error {}
export class Budget {
  iterations = 0;
  constructor(readonly maximum: number) {}
  step(): void {
    if (this.iterations >= this.maximum) throw new IterationLimit();
    this.iterations++;
  }
}
export const historical = (edge: NormalizedEdge) => edge.type === 'partner' && (edge.status === 'ended' || edge.status === 'separated');
export function hasErrors(diagnostics: readonly Diagnostic[]): boolean { return diagnostics.some(d => d.severity === 'error'); }
