// tests/e2e/responsavel-checkout.spec.ts
import { test, expect } from '@playwright/test'
import { loginByCpf } from '../qa/fixtures/auth'

test('responsável conclui checkout via PIX (sandbox)', async ({ page }) => {
  await loginByCpf(page, {
    cpf: process.env.QA_RESPONSAVEL_CPF!,
    senha: process.env.QA_RESPONSAVEL_SENHA!,
  })

  // Vitrine → primeiro produto → adicionar ao carrinho
  await page.goto('/loja')
  await page.getByRole('link', { name: /ver|comprar|detalhe/i }).first().click()
  await page.getByRole('button', { name: /adicionar|carrinho|comprar/i }).first().click()

  // Checkout → PIX
  await page.goto('/checkout')
  await page.getByText(/pix/i).first().click()
  await page.getByRole('button', { name: /pagar|finalizar|gerar/i }).first().click()

  // Espera o código/QR PIX aparecer (sandbox)
  await expect(page.getByText(/pix|copia e cola|qr/i).first()).toBeVisible({ timeout: 20_000 })
})
