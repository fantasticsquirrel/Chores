export default {
  test: {
    include: ['packages/family-tree-core/benchmarks/*.bench.test.ts', 'benchmarks/*.bench.test.ts'],
    environment: 'node',
    silent: false,
    passWithNoTests: false,
  },
};
