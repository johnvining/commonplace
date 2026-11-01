import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Parcel's url: imports (icons) resolve to their path.
  plugins: [
    {
      name: 'parcel-url',
      resolveId(id) {
        if (id.startsWith('url:')) return '\0' + id
      },
      load(id) {
        if (id.startsWith('\0url:')) return `export default ${JSON.stringify(id.slice(5))}`
      },
    },
  ],
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.tsx'],
  },
})
