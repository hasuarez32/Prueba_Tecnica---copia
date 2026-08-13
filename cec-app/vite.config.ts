import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base: './'` hace que los assets se resuelvan de forma relativa: el sitio
// funciona igual en la raíz de un dominio, en https://usuario.github.io/repo/
// y abierto desde el disco. Combinado con HashRouter, GitHub Pages no necesita
// ninguna regla de reescritura.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          xlsx: ['xlsx'],
          charts: ['recharts'],
        },
      },
    },
  },
  test: {
    // Por defecto Node (pruebas del ETL, que leen los Excel del disco). Las
    // pruebas de interfaz declaran jsdom con `@vitest-environment` en su cabecera.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30000,
  },
})
