import { relationshipLabel } from './labels';
import { Budget, compareEdges, hasErrors, historical, IterationLimit, positiveId } from './limits';
import { inputGraph } from './layout';
import type { CompareOptions, ComparisonResult, ConnectionStep, GraphInput, PreparedGraph } from './types';
/** Undirected shortest recorded-fact path, not a named kinship or genetic-degree calculator. */
export function comparePeople<N, E>(input: GraphInput<N, E> | PreparedGraph<N, E>, source: number, target: number, options: CompareOptions = {}): ComparisonResult<E> {
  const graph = inputGraph(input, options.limits), diagnostics = [...graph.diagnostics], budget = new Budget(graph.limits.maxIterations);
  const result = (status: ComparisonResult<E>['status'], steps: ConnectionStep<E>[] = []): ComparisonResult<E> => ({ status, distance: status === 'connected' ? steps.length : null, steps, diagnostics, iterations: budget.iterations });
  if (options.showHistoricalPartners !== undefined && typeof options.showHistoricalPartners !== 'boolean') diagnostics.push({ code: 'invalid_options', severity: 'error', message: 'History filter must be a boolean.' });
  if (hasErrors(diagnostics)) return result('invalid');
  if (!positiveId(source) || !positiveId(target) || !graph.nodesById.has(source) || !graph.nodesById.has(target)) {
    diagnostics.push({ code: 'focus_missing', severity: 'error', message: 'Choose two people present in this authorized projection.' }); return result('invalid');
  }
  if (source === target) return result('connected');
  const queue = [source], visited = new Set([source]), previous = new Map<number, ConnectionStep<E>>();
  try {
    for (let head = 0; head < queue.length; head++) {
      budget.step(); const from = queue[head];
      const neighbors = [...(graph.neighbors.get(from) ?? [])].sort((a, b) => (a.source === from ? a.target : a.source) - (b.source === from ? b.target : b.source) || compareEdges(a, b));
      for (const edge of neighbors) {
        budget.step(); if (options.showHistoricalPartners === false && historical(edge)) continue;
        const to = edge.source === from ? edge.target : edge.source;
        if (visited.has(to)) continue;
        visited.add(to); previous.set(to, { from, to, edge, label: relationshipLabel(edge, from) });
        if (to === target) {
          const path: ConnectionStep<E>[] = [];
          for (let id = target; id !== source;) { budget.step(); const step = previous.get(id)!; path.push(step); id = step.from; }
          return result('connected', path.reverse());
        }
        queue.push(to);
      }
    }
    return result('disconnected');
  } catch (error) {
    if (!(error instanceof IterationLimit)) throw error;
    diagnostics.push({ code: 'iteration_limit', severity: 'error', message: 'Connection work limit reached; narrow the requested projection.' });
    return result('limited');
  }
}
