import Link from 'next/link'
import { inscricoesAbertas } from '@/lib/concurso/config'
import { ESJT } from '../esjt-theme'
import { InscricaoClient } from './InscricaoClient'

export const metadata = { title: 'Inscrição — Concurso de Bolsas Esportivas 2027' }

// A janela de inscrições muda o gate; revalida a cada hora (mesmo padrão da landing).
export const revalidate = 3600

export default function InscricaoPage() {
  if (!inscricoesAbertas()) {
    return (
      <main style={{ maxWidth: 560, margin: '80px auto', textAlign: 'center', padding: 24 }}>
        <h1 style={{ color: ESJT.navy, fontFamily: 'var(--font-esjt-title)' }}>Inscrições encerradas</h1>
        <p style={{ color: '#5a6577' }}>O período de inscrições foi de 06/07 a 23/08/2026.</p>
        <Link href="/concurso-bolsas-2027" style={{ color: ESJT.red, fontWeight: 700 }}>← Voltar</Link>
      </main>
    )
  }
  return <InscricaoClient />
}
