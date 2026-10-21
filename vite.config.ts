import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const base = process.env.BASE_PATH ?? '/'

export default defineConfig(({ command }) => ({
  base,
  // Dev-only LAN exposure; never applied to `vite build`.
  server: command === 'serve' ? { host: true, allowedHosts: true } : undefined,
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
}))
