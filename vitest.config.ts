import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@features': resolve(__dirname, 'src/renderer/src/features'),
      '@data': resolve(__dirname, 'src/renderer/src/data'),
      '@lib': resolve(__dirname, 'src/renderer/src/lib'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@': resolve(__dirname, 'src/renderer/src'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
    clearMocks: true,
    restoreMocks: true
  }
})
