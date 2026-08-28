import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { dataApiPlugin } from './src/api/dataPlugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_SRC = path.resolve(__dirname, '../../goblin_native/src')
const DATA_DIR = path.resolve(__dirname, 'data')
const SCENARIOS_DIR = path.resolve(__dirname, '../../goblin_native/scripts/balance/scenarios')
const REPORTS_DIR = path.resolve(__dirname, '../../goblin_native/reports')
const BALANCE_OUT_DIR = path.resolve(__dirname, '../../goblin_native/scripts/balance/out')

export default defineConfig({
  plugins: [
    react(),
    dataApiPlugin({
      appSrc: APP_SRC,
      dataDir: DATA_DIR,
      scenariosDir: SCENARIOS_DIR,
      reportsDir: REPORTS_DIR,
      balanceOutDir: BALANCE_OUT_DIR,
    }),
  ],
  resolve: {
    alias: {
      '@studio': path.resolve(__dirname, 'src'),
      '@app': APP_SRC,
      '@': APP_SRC,
    },
  },
  server: {
    port: 5180,
    strictPort: true,
  },
})
