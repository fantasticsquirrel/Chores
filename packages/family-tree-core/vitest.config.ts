export default {
  test: {
    include: ['packages/family-tree-core/src/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: false,
  },
};
