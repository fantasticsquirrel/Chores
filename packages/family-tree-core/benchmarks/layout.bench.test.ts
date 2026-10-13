import { it, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { cpus, platform, arch, release, availableParallelism, totalmem } from 'node:os';
import { layoutGraph } from '../src/index';
import { syntheticProjection } from './synthetic';

it('measures only pure TypeScript layout on the current Linux host', () => {
  const samples = 200, warmups = 25;
  const machine = { platform: platform(), architecture: arch(), kernel: release(), cpu: cpus()[0]?.model, availableParallelism: availableParallelism(), memoryGiB: totalmem() / 1024 ** 3, node: process.version };
  const measurements = ([100, 500] as const).map(size => {
    const input = syntheticProjection(size);
    const options = { focusId: 1, ancestorDepth: 32, descendantDepth: 32, includePartners: true, includeCare: true, limits: { maxNodes: 500, maxEdges: 1000 } };
    for (let i = 0; i < warmups; i++) layoutGraph(input, options);
    const durations: number[] = [];
    let result = layoutGraph(input, options);
    for (let i = 0; i < samples; i++) {
      const start = performance.now(); result = layoutGraph(input, options); durations.push(performance.now() - start);
    }
    expect(result.mode).toBe('graph');
    expect(result.nodes).toHaveLength(size);
    expect(result.routes).toHaveLength(input.edges.length);
    expect(result.truncation.requiresExpansion).toBe(false);
    expect(result.stats.iterations).toBeLessThanOrEqual(result.limits.maxIterations);
    const sorted = [...durations].sort((a, b) => a - b);
    const round = (n: number) => Number(n.toFixed(3));
    return { nodes: size, edges: input.edges.length, warmups, samples, iterations: result.stats.iterations, milliseconds: { min: round(sorted[0]), p50: round(sorted[Math.ceil(samples * 0.50) - 1]), p95: round(sorted[Math.ceil(samples * 0.95) - 1]), max: round(sorted.at(-1)!), mean: round(durations.reduce((a, b) => a + b, 0) / samples) } };
  });
  console.log('FAMILY_TREE_CORE_BENCHMARK ' + JSON.stringify({ machine, measurements, scope: 'In-process pure layout including normalization, list construction and routing; no network, rendering, desktop interaction, Android, iOS or native evidence.' }, null, 2));
}, 30000);
