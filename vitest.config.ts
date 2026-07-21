import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  // tsconfig usa "jsx": "preserve" (consumido pelo compilador do Next.js);
  // o esbuild do Vite precisa de um modo próprio para os poucos testes que
  // renderizam componentes React (tests/**/*.test.tsx) — automatic runtime,
  // sem exigir `import React` manual.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
