import { defineConfig, devices } from '@playwright/test'

const port = 5183
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `bun run dev:host --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
})
