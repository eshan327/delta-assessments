import { defineConfig, devices } from '@playwright/test'

const remote = process.env.DELTA_TEST_BASE_URL

export default defineConfig({
  testDir: './src/tests/e2e',
  timeout: 65_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: 'line',
  use: { baseURL: remote ?? 'http://127.0.0.1:4173/delta-assessments/', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: remote ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/delta-assessments/',
    reuseExistingServer: !process.env.CI,
  },
})
