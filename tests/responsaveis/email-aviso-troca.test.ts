import { describe, it, expect } from 'vitest'
import { emailAvisoTrocaEmail } from '@/lib/email/templates'

describe('emailAvisoTrocaEmail', () => {
  it('inclui nome, e-mail antigo e novo no corpo', () => {
    const { subject, html } = emailAvisoTrocaEmail({
      responsavelNome: 'Maria Silva',
      emailAntigo: 'errado@exemplo.com',
      emailNovo: 'certo@exemplo.com',
    })
    expect(subject.toLowerCase()).toContain('e-mail')
    expect(html).toContain('Maria Silva')
    expect(html).toContain('errado@exemplo.com')
    expect(html).toContain('certo@exemplo.com')
  })
})
