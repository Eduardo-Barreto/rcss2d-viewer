import { defineConfig, devices } from '@playwright/test'

const port = 5185
const baseURL = `http://localhost:${port}`

/** The live smoke against a real rcssserver; `just live-smoke` starts the server and relay. */
export default defineConfig({
  testDir: './e2e/real',
  reporter: 'line',
  use: { baseURL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `bun run dev:host --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
})
