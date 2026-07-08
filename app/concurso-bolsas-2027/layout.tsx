import type { Metadata } from 'next'
import { Roboto, Roboto_Slab } from 'next/font/google'

// Fontes do site real da ESJT (esjt.com.br), escopadas a este segmento:
// as variáveis CSS só existem dentro deste wrapper, sem afetar o resto do app.
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-esjt-text',
})
const robotoSlab = Roboto_Slab({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--font-esjt-title',
})

export const metadata: Metadata = {
  title: 'Concurso de Bolsas Esportivas 2027 — Educandário São Judas Tadeu',
  description:
    'Bolsas de até 100% para alunos atletas. Inscrições de 06/07 a 23/08/2026. Taxa R$ 25,00 via Pix.',
}

export default function ConcursoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${roboto.variable} ${robotoSlab.variable}`}
      style={{
        fontFamily: 'var(--font-esjt-text), sans-serif',
        background: '#fff',
        minHeight: '100dvh',
      }}
    >
      {children}
    </div>
  )
}
