import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    define: {
      __BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0])
    },
    server: {
      port: 3333
    },
    resolve: {
      alias: {
        '@features': resolve('src/renderer/src/features'),
        '@data': resolve('src/renderer/src/data'),
        '@lib': resolve('src/renderer/src/lib'),
        '@shared': resolve('src/shared'),
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
