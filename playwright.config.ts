import { defineConfig, devices } from '@playwright/test'

import { LIVE_RELAY_PORT } from './e2e/live-port.ts'

const DEFAULT_PORT = 5183
const port = Number(process.env.E2E_PORT ?? DEFAULT_PORT)
const baseURL = `http://localhost:${port}`
const DEFAULT_PRERENDER_PORT = 5184
const PRERENDER_PORT = Number(process.env.E2E_PRERENDER_PORT ?? DEFAULT_PRERENDER_PORT)
const prerenderURL = `http://localhost:${PRERENDER_PORT}`

export default defineConfig({
  testDir: './e2e',
  testIgnore: 'real/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    {
      name: 'chromium',
      testIgnore: ['real/**', 'prerender.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'prerender',
      testMatch: 'prerender.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: prerenderURL },
    },
  ],
  webServer: [
    {
      command: `bun run dev:host --port ${port} --strictPort`,
      url: baseURL,
      reuseExistingServer: false,
    },
    {
      command: `bun run build && bun run preview --port ${PRERENDER_PORT} --strictPort`,
      url: prerenderURL,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    { command: 'bun e2e/live-server.ts', port: LIVE_RELAY_PORT, reuseExistingServer: false },
  ],
})
