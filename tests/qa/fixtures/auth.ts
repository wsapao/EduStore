// tests/qa/fixtures/auth.ts
// Login pela UI (a Loja autentica por CPF + senha).
import { Page, expect } from '@playwright/test'

export interface Credenciais {
  cpf: string   // com ou sem máscara
  senha: string
}

/** Faz login pela tela /login e espera sair de /login. */
export async function loginByCpf(page: Page, { cpf, senha }: Credenciais): Promise<void> {
  await page.goto('/login')
  await page.fill('input[name="cpf"]', cpf)
  await page.fill('input[name="senha"]', senha)
  await page.getByRole('button', { name: /entrar na loja/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 })
  // Sanidade: não deve haver mensagem de erro visível.
  await expect(page.locator('body')).not.toContainText(/CPF ou senha inválid/i)
}
