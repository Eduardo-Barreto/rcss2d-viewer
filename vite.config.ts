import { readFileSync } from 'node:fs'
import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/** Ships NOTICE with the site: the fonts' OFL and the MIT texts of the bundled CSS live there. */
function notice(): Plugin {
  return {
    name: 'rcss2d-notice',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'NOTICE.txt',
        source: readFileSync(path.resolve(__dirname, 'NOTICE'), 'utf8'),
      })
    },
  }
}

export default defineConfig(({ command, mode }) => ({
  // Prefix '' loads BASE_PATH from `.env` for plain `vite build` too, not only under `bun run`.
  base: loadEnv(mode, process.cwd(), '').BASE_PATH ?? '/',
  // Dev-only LAN exposure; never applied to `vite build`.
  server: command === 'serve' ? { host: true, allowedHosts: true } : undefined,
  build: { license: { fileName: 'third-party-licenses.md' } },
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    notice(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
}))
