import { defineConfig, devices } from '@playwright/test'
import { assertSafeTarget } from './tests/qa/fixtures/safety'

const baseURL = process.env.QA_BASE_URL
// Trava: aborta o carregamento se o alvo não for staging seguro.
assertSafeTarget({ baseURL, asaasEnv: process.env.ASAAS_ENVIRONMENT })

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  retries: 1,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
