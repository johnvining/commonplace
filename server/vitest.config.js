import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.test.js'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
})
