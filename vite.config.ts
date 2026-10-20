import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
// Build trafia na GitHub Pages pod https://ztestuje442.github.io/angielski/; dev i testy działają pod „/”.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/angielski/' : '/',
  plugins: [react()],
  test: { include: ['tests/**/*.test.ts'] },
}))
