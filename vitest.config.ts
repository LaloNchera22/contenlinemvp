import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // contracts.test.ts corre con Hardhat (npm run hardhat:test), no con Vitest.
    include: ['test/**/*.test.ts'],
    exclude: ['test/contracts.test.ts', 'node_modules/**'],
  },
});
