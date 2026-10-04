import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    // Retained CI checks exercise real fsynced stores and process trees.
    // Serialize them so disk contention cannot consume another case's deadline.
    maxWorkers: process.env.CI ? 1 : 4,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx', 'electron/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx', 'electron/**/*.ts'],
      exclude: ['src/main.tsx', 'electron/preload.ts', 'dist/**', 'dist-electron/**', 'node_modules/**'],
    },
  },
})
