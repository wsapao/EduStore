import Link from 'next/link'
import { CONCURSO, MODALIDADES, inscricoesAbertas } from '@/lib/concurso/config'
import { ESJT } from './esjt-theme'

// A janela de inscrições muda o estado dos botões; revalida a cada hora para
// que a página estática não fique presa ao estado do momento do build.
export const revalidate = 3600

const ETAPAS = [
  { n: 1, titulo: 'Inscrição + Pix', desc: '06/07 a 23/08 · pagamento até 26/08' },
  { n: 2, titulo: 'Prova pedagógica', desc: '30/08 · 08h30–11h30 · na ESJT' },
  { n: 3, titulo: 'Seletiva técnica', desc: '09 a 19/09 · avaliação prática' },
  { n: 4, titulo: 'Resultado', desc: 'até 30/09 · matrícula até 03/10' },
] as const

const BOLSAS = [
  { media: '10', desconto: '100%' },
  { media: '9,0 a 9,9', desconto: '50%' },
  { media: '8,0 a 8,9', desconto: '30%' },
  { media: '7,0 a 7,9', desconto: '8%' },
] as const

export default function ConcursoBolsasPage() {
  const abertas = inscricoesAbertas()
  const taxa = `R$ ${CONCURSO.valorInscricao},00`

  return (
    <>
      {/* ── Top strip ── */}
      <div
        style={{
          background: ESJT.navy,
          color: ESJT.blueBorder,
          fontSize: 12,
          padding: '7px 26px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <span>📞 (81) 3458-1047 &nbsp;·&nbsp; Camaragibe/PE</span>
        <span>Facebook &nbsp;·&nbsp; Instagram</span>
      </div>

      {/* ── Header ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
          padding: '14px 26px',
          background: '#fff',
          borderBottom: '1px solid #eef1f6',
        }}
      >
        {/*
          Monograma-fallback da logo. Quando a escola enviar o arquivo oficial
          para public/concurso/logo-esjt.png, substituir este bloco por:
          <img src="/concurso/logo-esjt.png" alt="Educandário São Judas Tadeu" style={{ height: 46 }} />
        */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 9,
              background: ESJT.navy,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            ESJT
          </span>
          <span style={{ fontWeight: 800, color: ESJT.navy, lineHeight: 1.1, fontSize: 14 }}>
            Educandário
            <br />
            São Judas Tadeu
          </span>
        </div>

        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 22,
            fontSize: 14,
            fontWeight: 500,
            color: ESJT.navy,
          }}
        >
          <a href="#concurso" style={navLinkStyle}>O Concurso</a>
          <a href="#modalidades" style={navLinkStyle}>Modalidades</a>
          <a href="#etapas" style={navLinkStyle}>Etapas</a>
          <a href="#bolsas" style={navLinkStyle}>Bolsas</a>
          {abertas ? (
            <Link href="/concurso-bolsas-2027/inscricao" style={{ ...btnRedStyle, padding: '10px 20px' }}>
              Inscreva-se
            </Link>
          ) : (
            <span style={{ ...pillEncerradasStyle, padding: '10px 20px' }}>Inscrições encerradas</span>
          )}
        </nav>
      </header>

      <main>
        {/* ── Hero ── */}
        <section
          style={{
            background: `linear-gradient(135deg, ${ESJT.navy} 0%, ${ESJT.footer} 100%)`,
            color: '#fff',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 'clamp(40px, 7vw, 52px) clamp(20px, 5vw, 40px)', maxWidth: 640 }}>
            <div
              style={{
                display: 'inline-block',
                background: ESJT.red,
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1,
                padding: '6px 14px',
                borderRadius: 4,
                textTransform: 'uppercase',
              }}
            >
              Seletivas Esportivas 2027
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-esjt-title)',
                fontSize: 'clamp(28px, 6vw, 40px)',
                fontWeight: 800,
                lineHeight: 1.1,
                margin: '16px 0 12px',
              }}
            >
              Concurso de Bolsas de até{' '}
              <span style={{ color: ESJT.yellow }}>100%</span> para atletas
            </h1>
            <p style={{ fontSize: 16, color: '#E4EAF3', margin: '0 0 26px', maxWidth: 520, lineHeight: 1.6 }}>
              Para estudantes do 2º ano do Fundamental à 3ª série do Médio, no turno da
              tarde. Inscrições de 06/07 a 23/08/2026.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              {abertas ? (
                <Link href="/concurso-bolsas-2027/inscricao" style={btnRedStyle}>
                  Fazer inscrição — {taxa}
                </Link>
              ) : (
                <span style={pillEncerradasStyle}>Inscrições encerradas</span>
              )}
              <a
                href={CONCURSO.editalPdfUrl}
                style={{
                  border: '2px solid #fff',
                  color: '#fff',
                  padding: '11px 22px',
                  borderRadius: 6,
                  fontWeight: 700,
                  display: 'inline-block',
                  textDecoration: 'none',
                }}
              >
                📄 Baixar edital
              </a>
            </div>
          </div>
        </section>

        {/* ── Stats strip ── */}
        <section
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            background: ESJT.blueBg,
            borderBottom: '1px solid #e4eaf3',
          }}
        >
          {[
            { valor: 'até 100%', legenda: 'de bolsa na mensalidade' },
            { valor: String(MODALIDADES.length), legenda: 'modalidades esportivas' },
            { valor: `R$ ${CONCURSO.valorInscricao}`, legenda: 'taxa de inscrição (Pix)' },
          ].map((stat, i) => (
            <div
              key={stat.legenda}
              style={{
                flex: '1 1 140px',
                textAlign: 'center',
                padding: 20,
                borderLeft: i > 0 ? `1px solid ${ESJT.blueLine}` : 'none',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-esjt-title)',
                  fontSize: 26,
                  fontWeight: 800,
                  color: ESJT.navy,
                }}
              >
                {stat.valor}
              </div>
              <div style={{ fontSize: 12, color: '#5a6577' }}>{stat.legenda}</div>
            </div>
          ))}
        </section>

        {/* ── O Concurso ── */}
        <section id="concurso" style={{ padding: '44px clamp(20px, 5vw, 40px)', textAlign: 'center' }}>
          <div
            style={{
              color: ESJT.red,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            O Concurso
          </div>
          <h2 style={{ ...h2Style, margin: '8px 0 12px' }}>
            Talento esportivo que vira oportunidade
          </h2>
          <p style={{ maxWidth: 640, margin: '0 auto', color: '#5a6577', fontSize: 15, lineHeight: 1.7 }}>
            O Educandário São Judas Tadeu abre inscrições para o Concurso de Bolsas –
            Seletivas Esportivas 2027, concedendo bolsas parciais e integrais a alunos
            atletas, conforme o desempenho nas etapas pedagógica e técnica.
          </p>
        </section>

        {/* ── Modalidades ── */}
        <section
          id="modalidades"
          style={{ padding: '20px clamp(20px, 5vw, 40px) 46px', background: ESJT.blueBg }}
        >
          <h2 style={{ ...h2Style, textAlign: 'center', fontSize: 24, margin: '26px 0 6px' }}>
            Modalidades
          </h2>
          <p style={{ textAlign: 'center', color: '#5a6577', fontSize: 13, margin: '0 0 24px' }}>
            Escolha 1 modalidade por inscrição · categorias masculina e feminina
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            {MODALIDADES.map((m) => (
              <div
                key={m.slug}
                style={{ ...cardStyle, padding: '20px 28px', textAlign: 'center', minWidth: 120 }}
              >
                <div style={{ fontSize: 30 }}>{m.icone}</div>
                <b style={{ color: ESJT.navy }}>{m.nome}</b>
              </div>
            ))}
          </div>
        </section>

        {/* ── Como funciona ── */}
        <section id="etapas" style={{ padding: '46px clamp(20px, 5vw, 40px)' }}>
          <h2 style={{ ...h2Style, textAlign: 'center', fontSize: 24, margin: '0 0 26px' }}>
            Como funciona
          </h2>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {ETAPAS.map((etapa) => (
              <div key={etapa.n} style={{ ...cardStyle, flex: '1 1 170px', padding: 20 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: ESJT.red,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  {etapa.n}
                </div>
                <b style={{ color: ESJT.navy }}>{etapa.titulo}</b>
                <p style={{ fontSize: 13, color: '#5a6577', margin: '6px 0 0' }}>{etapa.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bolsas ── */}
        <section id="bolsas" style={{ padding: '10px clamp(20px, 5vw, 40px) 46px' }}>
          <h2 style={{ ...h2Style, textAlign: 'center', fontSize: 24, margin: '0 0 22px' }}>
            Percentual da bolsa por desempenho
          </h2>
          <div style={{ ...cardStyle, maxWidth: 460, margin: '0 auto', overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '14px 22px',
                background: ESJT.navy,
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <span>Média final</span>
              <span>Desconto</span>
            </div>
            {BOLSAS.map((faixa, i) => (
              <div
                key={faixa.media}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '13px 22px',
                  borderBottom: i < BOLSAS.length - 1 ? '1px solid #eef1f6' : 'none',
                }}
              >
                <span style={{ color: ESJT.navy }}>{faixa.media}</span>
                <b style={{ color: ESJT.red }}>{faixa.desconto}</b>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA band ── */}
        <section style={{ background: ESJT.red, color: '#fff', textAlign: 'center', padding: 40 }}>
          <h2 style={{ ...h2Style, fontSize: 26, color: '#fff', margin: '0 0 8px' }}>
            Garanta a vaga do seu filho
          </h2>
          <p style={{ opacity: 0.9, margin: '0 0 22px' }}>
            Inscrição rápida e pagamento por Pix na hora.
          </p>
          {abertas ? (
            <Link
              href="/concurso-bolsas-2027/inscricao"
              style={{
                background: '#fff',
                color: ESJT.red,
                padding: '14px 34px',
                borderRadius: 6,
                fontWeight: 800,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Fazer inscrição — {taxa}
            </Link>
          ) : (
            <span style={{ ...pillEncerradasStyle, background: '#fff' }}>
              Inscrições encerradas
            </span>
          )}
        </section>
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          background: ESJT.footer,
          color: ESJT.blueBorder,
          padding: '30px clamp(20px, 5vw, 40px)',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20,
          lineHeight: 1.6,
        }}
      >
        <div>
          <b style={{ color: '#fff' }}>Educandário São Judas Tadeu</b>
          <br />
          Rua Amaro Albino Pimentel, 79B
          <br />
          Bairro Novo do Carmo · Camaragibe/PE
        </div>
        <div>
          <b style={{ color: '#fff' }}>Contato</b>
          <br />
          (81) 3458-1047
          <br />
          Facebook · Instagram
        </div>
        <div style={{ alignSelf: 'flex-end', opacity: 0.7 }}>
          © 2026 ESJT · Concurso de Bolsas Esportivas 2027
        </div>
      </footer>
    </>
  )
}

const navLinkStyle: React.CSSProperties = {
  color: ESJT.navy,
  textDecoration: 'none',
}

const btnRedStyle: React.CSSProperties = {
  background: ESJT.red,
  color: '#fff',
  padding: '13px 26px',
  borderRadius: 6,
  fontWeight: 700,
  display: 'inline-block',
  textDecoration: 'none',
  boxShadow: '0 6px 16px rgba(193,22,26,.28)',
}

const pillEncerradasStyle: React.CSSProperties = {
  background: '#E3E7EF',
  // Navy em vez de gray: contraste AA em texto pequeno sobre fundo claro.
  color: ESJT.navy,
  padding: '13px 26px',
  borderRadius: 999,
  fontWeight: 700,
  display: 'inline-block',
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E4EAF3',
  borderRadius: 10,
  boxShadow: '0 4px 18px rgba(52,67,107,.07)',
}

const h2Style: React.CSSProperties = {
  fontFamily: 'var(--font-esjt-title)',
  fontSize: 26,
  fontWeight: 700,
  color: ESJT.navy,
}
