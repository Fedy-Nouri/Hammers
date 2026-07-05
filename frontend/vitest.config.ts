import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Automatic JSX runtime — no need to import React in components/tests. The plugin used for
  // the app build (Fast Refresh) isn't needed here, so esbuild handles the transform directly.
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
