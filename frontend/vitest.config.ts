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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Measure application source only; exclude entrypoints, generated/config, and types
      // that carry no meaningful logic. No hard thresholds yet — reporting first so we can
      // grow coverage deliberately rather than fail the build on day one.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
      ],
    },
  },
})
