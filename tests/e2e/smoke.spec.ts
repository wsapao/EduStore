// tests/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test'

test('a vitrine pública da loja carrega sem erro', async ({ page }) => {
  await page.goto('/loja')
  await expect(page).toHaveTitle(/.+/)
  await expect(page.locator('body')).not.toContainText(
    /Application error|Internal Server Error|This page could not be found/i,
  )
})
