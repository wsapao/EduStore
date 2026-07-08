'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  criarInscricaoConcurso,
  consultarStatusInscricao,
  gerarNovoPixInscricao,
  type PixInfo,
} from '@/app/actions/concurso'
import { CONCURSO, MODALIDADES, SERIES_2026 } from '@/lib/concurso/config'
import type { InscricaoInput } from '@/lib/concurso/validacao'
import { ESJT } from '../esjt-theme'
import { formatarContador, mascararCPF } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de estilo (mockup aprovado: fundo #f6f8fc, cards brancos)
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_BG = '#f6f8fc'
const CARD_BORDER = '#E4EAF3'

const fld: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #D5D5D7',
  borderRadius: 6,
  padding: '10px 12px',
  fontSize: 13,
  color: '#181D23',
  width: '100%',
  fontFamily: 'inherit',
}

const lbl: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: ESJT.navy,
  display: 'block',
  margin: '0 0 5px',
}

const btnPrimario: React.CSSProperties = {
  background: ESJT.red,
  color: '#fff',
  padding: '11px 22px',
  borderRadius: 6,
  fontWeight: 700,
  fontSize: 13,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnVoltar: React.CSSProperties = {
  background: 'transparent',
  color: ESJT.navy,
  fontWeight: 600,
  fontSize: 13,
  border: 'none',
  cursor: 'pointer',
  padding: '11px 0',
  fontFamily: 'inherit',
}

const valorFmt = CONCURSO.valorInscricao.toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const FORM_INICIAL: InscricaoInput = {
  aluno_nome: '', aluno_nascimento: '', serie_2026: '',
  modalidade: '', instituicao_atual: '',
  resp1_nome: '', resp1_cpf: '', resp1_email: '',
  resp1_telefone: '', resp1_endereco: '', resp1_profissao: '', resp1_parentesco: '',
  resp2_nome: '', resp2_endereco: '', resp2_telefone: '',
  resp2_profissao: '', resp2_parentesco: '',
  tem_irmaos: false, irmaos_series_2026: '',
  consentimento: false,
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────────────────────

function Stepper({ passo }: { passo: 1 | 2 | 3 }) {
  const etapas = ['Aluno', 'Responsáveis', 'Pagamento'] as const
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, fontSize: 12 }}>
      {etapas.map((nome, i) => {
        const n = i + 1
        const done = n < passo
        const ativo = n === passo
        const circulo: React.CSSProperties = {
          width: 22, height: 22, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: done ? ESJT.navy : ativo ? ESJT.red : '#dbe3f0',
          color: done || ativo ? '#fff' : ESJT.gray,
          fontWeight: 700, flexShrink: 0,
        }
        return (
          <span key={nome} style={{ display: 'contents' }}>
            {i > 0 && (
              <span style={{ flex: 1, height: 2, background: n <= passo ? ESJT.red : '#dbe3f0' }} />
            )}
            <span
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                color: done ? ESJT.navy : ativo ? ESJT.red : '#96989B',
                fontWeight: done || ativo ? 700 : 500,
              }}
            >
              <span style={circulo}>{done ? '✓' : n}</span>
              {nome}
            </span>
          </span>
        )
      })}
    </div>
  )
}

function Campo({
  label, obrigatorio, hint, span2, children,
}: {
  label: string
  obrigatorio?: boolean
  hint?: string
  span2?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={span2 ? { gridColumn: '1 / -1' } : undefined}>
      <label style={lbl}>
        {label}
        {obrigatorio ? ' *' : ''}
        {hint ? <span style={{ color: ESJT.red, fontWeight: 500 }}> ({hint})</span> : null}
      </label>
      {children}
    </div>
  )
}

function TituloPasso({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <>
      <h3 style={{ color: ESJT.navy, fontSize: 17, margin: '0 0 4px', fontFamily: 'var(--font-esjt-title)' }}>
        {titulo}
      </h3>
      <p style={{ fontSize: 12, color: ESJT.gray, margin: '0 0 14px' }}>{subtitulo}</p>
    </>
  )
}

function ErroBox({ mensagem }: { mensagem: string }) {
  return (
    <div
      role="alert"
      style={{
        background: '#fdecec', border: '1px solid #f3c2c3', borderRadius: 6,
        padding: '10px 14px', fontSize: 13, color: '#8a1013', marginTop: 14,
      }}
    >
      {mensagem}
    </div>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        width: 14, height: 14, border: `2px solid ${ESJT.red}`,
        borderTopColor: 'transparent', borderRadius: '50%',
        display: 'inline-block', animation: 'esjt-spin 0.8s linear infinite',
      }}
    />
  )
}

function LinhaResumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  if (!valor) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '3px 0' }}>
      <span style={{ color: ESJT.gray }}>{rotulo}</span>
      <span style={{ color: '#181D23', fontWeight: 500, textAlign: 'right' }}>{valor}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

interface Resultado {
  inscricao_id: string
  /** null quando o Pix foi gerado via retry (gerarNovoPixInscricao não retorna o número). */
  numero: string | null
  pix: PixInfo
}

export function InscricaoClient() {
  const [passo, setPasso] = useState<1 | 2 | 3>(1)
  const [form, setForm] = useState<InscricaoInput>(FORM_INICIAL)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [falhaComId, setFalhaComId] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [pago, setPago] = useState(false)
  const [expirado, setExpirado] = useState(false)
  const [resp2Aberto, setResp2Aberto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [msRestantes, setMsRestantes] = useState(0)

  const set = useCallback(<K extends keyof InscricaoInput>(campo: K, valor: InscricaoInput[K]) => {
    setForm(f => ({ ...f, [campo]: valor }))
  }, [])

  // ── Navegação entre passos (validação amigável; a autoridade final é o servidor) ──

  function avancarPasso1() {
    if (!form.aluno_nome.trim()) return setErro('Informe o nome completo do estudante.')
    if (!form.aluno_nascimento) return setErro('Informe a data de nascimento.')
    if (!form.serie_2026) return setErro('Selecione a série em 2026.')
    if (!form.modalidade) return setErro('Escolha a modalidade esportiva.')
    if (!form.instituicao_atual.trim()) return setErro('Informe a instituição de ensino atual.')
    setErro(null)
    setPasso(2)
  }

  function avancarPasso2() {
    if (!form.resp1_nome.trim()) return setErro('Informe o nome do responsável 1.')
    if (form.resp1_cpf.replace(/\D/g, '').length !== 11) return setErro('Informe o CPF completo do responsável 1.')
    if (!form.resp1_email.includes('@')) return setErro('Informe um e-mail válido para o responsável 1.')
    setErro(null)
    setPasso(3)
  }

  function voltar(p: 1 | 2) {
    setErro(null)
    setPasso(p)
  }

  // ── Submit / retry de Pix ──

  async function confirmar() {
    setEnviando(true)
    setErro(null)
    try {
      const res = await criarInscricaoConcurso(form)
      if (res.success) {
        setResultado({ inscricao_id: res.inscricao_id, numero: res.numero, pix: res.pix })
      } else {
        setErro(res.error)
        if (res.inscricao_id) setFalhaComId(res.inscricao_id)
      }
    } catch {
      setErro('Não foi possível enviar a inscrição. Verifique a conexão e tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  // Reaproveita a inscrição já gravada — NUNCA reenvia o formulário (evita duplicidade).
  async function tentarPixNovamente() {
    if (!falhaComId) return
    setEnviando(true)
    setErro(null)
    try {
      const res = await gerarNovoPixInscricao(falhaComId)
      if (res.success) {
        setResultado({ inscricao_id: falhaComId, numero: null, pix: res.pix })
        setFalhaComId(null)
      } else {
        setErro(res.error)
      }
    } catch {
      setErro('Falha ao gerar o Pix. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  async function gerarNovoPixExpirado() {
    if (!resultado) return
    setEnviando(true)
    setErro(null)
    try {
      const res = await gerarNovoPixInscricao(resultado.inscricao_id)
      if (res.success) {
        setResultado({ ...resultado, pix: res.pix })
        setExpirado(false)
      } else {
        setErro(res.error)
      }
    } catch {
      setErro('Falha ao gerar novo Pix. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  // ── Contador regressivo (1s) — expira também localmente ao chegar em 0 ──

  useEffect(() => {
    if (!resultado || pago || expirado) return
    const calc = () => new Date(resultado.pix.expiracao).getTime() - Date.now()
    setMsRestantes(calc())
    const iv = setInterval(() => {
      const ms = calc()
      setMsRestantes(ms)
      if (ms <= 0) {
        setExpirado(true)
        clearInterval(iv)
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [resultado, pago, expirado])

  // ── Polling do status (5s) ──

  useEffect(() => {
    if (!resultado || pago || expirado) return
    const iv = setInterval(async () => {
      const res = await consultarStatusInscricao(resultado.inscricao_id)
      if ('error' in res) return
      if (res.status === 'pago') {
        clearInterval(iv)
        setPago(true)
      } else if (res.status === 'expirado') {
        clearInterval(iv)
        setExpirado(true)
      }
    }, 5000)
    return () => clearInterval(iv)
  }, [resultado, pago, expirado])

  const copiarPix = useCallback(async () => {
    if (!resultado) return
    try {
      await navigator.clipboard.writeText(resultado.pix.qr_code)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // clipboard indisponível (contexto não seguro / WebView antiga)
    }
  }, [resultado])

  const modalidadeNome = MODALIDADES.find(m => m.slug === form.modalidade)?.nome ?? form.modalidade

  // ───────────────────────────────────────────────────────────────────────────
  // Telas pós-inscrição
  // ───────────────────────────────────────────────────────────────────────────

  const shell = (children: React.ReactNode) => (
    <main style={{ background: PAGE_BG, minHeight: '100dvh', padding: '32px 16px' }}>
      <style>{`@keyframes esjt-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>{children}</div>
    </main>
  )

  // ── Pago ──
  if (resultado && pago) {
    return shell(
      <div
        style={{
          background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: 10,
          padding: '36px 28px', textAlign: 'center', maxWidth: 420, margin: '40px auto',
        }}
      >
        <div style={{ fontSize: 56 }}>✅</div>
        <h1 style={{ color: ESJT.navy, fontSize: 24, margin: '12px 0 6px', fontFamily: 'var(--font-esjt-title)' }}>
          Inscrição confirmada!
        </h1>
        {resultado.numero && (
          <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: ESJT.navy, marginBottom: 10 }}>
            {resultado.numero}
          </div>
        )}
        <p style={{ fontSize: 13, color: ESJT.gray, margin: '0 0 14px' }}>
          Enviamos o comprovante para <strong>{form.resp1_email.trim()}</strong>.
        </p>
        <div
          style={{
            background: ESJT.blueBg, border: `1px solid ${ESJT.blueBorder}`, borderRadius: 8,
            padding: '12px 14px', fontSize: 12.5, color: ESJT.navy, textAlign: 'left', lineHeight: 1.55,
          }}
        >
          <strong>Prova pedagógica:</strong> 30/08/2026 (domingo), 08h30–11h30, na sede da ESJT.
          Leve declaração de saúde e o boletim escolar.
        </div>
        <div style={{ marginTop: 20 }}>
          <Link href="/concurso-bolsas-2027" style={{ color: ESJT.red, fontWeight: 700, fontSize: 13 }}>
            ← Voltar ao início
          </Link>
        </div>
      </div>
    )
  }

  // ── Expirado ──
  if (resultado && expirado) {
    return shell(
      <div
        style={{
          background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: 10,
          padding: '36px 28px', textAlign: 'center', maxWidth: 420, margin: '40px auto',
        }}
      >
        <div style={{ fontSize: 56 }}>⏰</div>
        <h1 style={{ color: ESJT.navy, fontSize: 24, margin: '12px 0 6px', fontFamily: 'var(--font-esjt-title)' }}>
          O Pix expirou
        </h1>
        <p style={{ fontSize: 13, color: ESJT.gray, margin: '0 0 18px' }}>
          O prazo de pagamento deste QR Code encerrou. Gere um novo Pix para concluir a inscrição.
        </p>
        {erro && <ErroBox mensagem={erro} />}
        <button onClick={gerarNovoPixExpirado} disabled={enviando} style={{ ...btnPrimario, marginTop: 14, opacity: enviando ? 0.7 : 1 }}>
          {enviando ? 'Gerando…' : 'Gerar novo Pix'}
        </button>
      </div>
    )
  }

  // ── Pix (aguardando pagamento) ──
  if (resultado) {
    return shell(
      <div
        style={{
          background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: 10,
          padding: 24, maxWidth: 380, margin: '24px auto', textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 12, color: ESJT.gray }}>Taxa de inscrição · {modalidadeNome}</div>
        {resultado.numero ? (
          <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: ESJT.navy, marginTop: 2 }}>
            {resultado.numero}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: ESJT.navy, fontWeight: 600, marginTop: 2 }}>Inscrição registrada</div>
        )}
        <div
          style={{
            fontFamily: 'var(--font-esjt-title)', fontSize: 30, fontWeight: 800,
            color: ESJT.navy, margin: '2px 0 6px',
          }}
        >
          {valorFmt}
        </div>
        <div
          style={{
            display: 'inline-block', background: '#FFF3CD', color: '#8a6d00',
            fontSize: 11, padding: '3px 10px', borderRadius: 20,
          }}
        >
          ⏳ expira em {formatarContador(msRestantes)}
        </div>

        <div style={{ margin: '16px auto', width: 180, height: 180 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resultado.pix.qr_code_imagem}
            alt="QR Code Pix"
            style={{ width: 180, height: 180, display: 'block', borderRadius: 8 }}
          />
        </div>

        <div style={{ fontSize: 11, color: ESJT.gray, marginBottom: 4 }}>Pix copia e cola</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            readOnly
            value={resultado.pix.qr_code}
            onFocus={e => e.currentTarget.select()}
            style={{ ...fld, fontSize: 11, fontFamily: 'monospace' }}
            aria-label="Código Pix copia e cola"
          />
          <button
            onClick={copiarPix}
            style={{
              background: copiado ? '#1a7f37' : ESJT.navy, color: '#fff',
              padding: '9px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {copiado ? 'Copiado ✓' : 'Copiar'}
          </button>
        </div>

        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginTop: 16, color: ESJT.gray, fontSize: 13,
          }}
        >
          <Spinner />
          Aguardando pagamento…
        </div>
        <p style={{ fontSize: 11, color: '#96989B', margin: '10px 0 0' }}>
          A confirmação é automática. Assim que o pagamento compensar, esta tela confirma e
          enviaremos o comprovante por e-mail.
        </p>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Wizard (passos 1–3)
  // ───────────────────────────────────────────────────────────────────────────

  return shell(
    <>
      <h1
        style={{
          color: ESJT.navy, fontSize: 22, margin: '0 0 4px',
          fontFamily: 'var(--font-esjt-title)',
        }}
      >
        Inscrição — Concurso de Bolsas Esportivas 2027
      </h1>
      <p style={{ fontSize: 13, color: ESJT.gray, margin: '0 0 18px' }}>
        Preencha os dados abaixo. Taxa de inscrição: <strong>{valorFmt}</strong> via Pix.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: 22 }}>
        <Stepper passo={passo} />

        {/* ── Passo 1 — Aluno ── */}
        {passo === 1 && (
          <>
            <TituloPasso titulo="Dados do estudante" subtitulo="Quem vai participar do concurso" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Campo label="Nome completo" obrigatorio span2>
                <input
                  style={fld}
                  value={form.aluno_nome}
                  onChange={e => set('aluno_nome', e.target.value)}
                  autoComplete="name"
                />
              </Campo>
              <Campo label="Data de nascimento" obrigatorio>
                <input
                  type="date"
                  style={fld}
                  value={form.aluno_nascimento}
                  onChange={e => set('aluno_nascimento', e.target.value)}
                />
              </Campo>
              <Campo label="Turno">
                <select style={{ ...fld, background: '#f3f4f6' }} value="tarde" disabled>
                  <option value="tarde">Tarde</option>
                </select>
              </Campo>
              <Campo label="Série em 2026" obrigatorio>
                <select style={fld} value={form.serie_2026} onChange={e => set('serie_2026', e.target.value)}>
                  <option value="">Selecione…</option>
                  {SERIES_2026.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Instituição de ensino atual" obrigatorio>
                <input
                  style={fld}
                  value={form.instituicao_atual}
                  onChange={e => set('instituicao_atual', e.target.value)}
                />
              </Campo>
              <Campo label="Modalidade esportiva" obrigatorio span2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))', gap: 8 }}>
                  {MODALIDADES.map(m => {
                    const on = form.modalidade === m.slug
                    return (
                      <button
                        key={m.slug}
                        type="button"
                        onClick={() => set('modalidade', m.slug)}
                        aria-pressed={on}
                        style={{
                          background: on ? ESJT.blueBg : '#fff',
                          border: `2px solid ${on ? ESJT.red : '#D5D5D7'}`,
                          borderRadius: 8, padding: '10px 6px', cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          fontFamily: 'inherit',
                        }}
                      >
                        <span style={{ fontSize: 22 }}>{m.icone}</span>
                        <span style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: ESJT.navy }}>
                          {m.nome}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Campo>
            </div>
            {erro && <ErroBox mensagem={erro} />}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={avancarPasso1} style={btnPrimario}>Continuar →</button>
            </div>
          </>
        )}

        {/* ── Passo 2 — Responsáveis ── */}
        {passo === 2 && (
          <>
            <TituloPasso titulo="Responsável 1" subtitulo="Quem preenche e realiza o pagamento" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Campo label="Nome completo" obrigatorio span2>
                <input style={fld} value={form.resp1_nome} onChange={e => set('resp1_nome', e.target.value)} />
              </Campo>
              <Campo label="CPF" obrigatorio hint="necessário para gerar o Pix">
                <input
                  style={fld}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={form.resp1_cpf}
                  onChange={e => set('resp1_cpf', mascararCPF(e.target.value))}
                />
              </Campo>
              <Campo label="E-mail" obrigatorio>
                <input
                  type="email"
                  style={fld}
                  value={form.resp1_email}
                  onChange={e => set('resp1_email', e.target.value)}
                  autoComplete="email"
                />
              </Campo>
              <Campo label="Telefone / WhatsApp">
                <input
                  style={fld}
                  inputMode="tel"
                  value={form.resp1_telefone}
                  onChange={e => set('resp1_telefone', e.target.value)}
                />
              </Campo>
              <Campo label="Profissão">
                <input style={fld} value={form.resp1_profissao} onChange={e => set('resp1_profissao', e.target.value)} />
              </Campo>
              <Campo label="Endereço completo" span2>
                <input style={fld} value={form.resp1_endereco} onChange={e => set('resp1_endereco', e.target.value)} />
              </Campo>
              <Campo label="Grau de parentesco">
                <input style={fld} value={form.resp1_parentesco} onChange={e => set('resp1_parentesco', e.target.value)} />
              </Campo>
            </div>

            {/* Responsável 2 (opcional, colapsável) */}
            <button
              type="button"
              onClick={() => setResp2Aberto(a => !a)}
              style={{
                marginTop: 18, background: 'transparent', border: 'none', cursor: 'pointer',
                color: ESJT.navy, fontWeight: 700, fontSize: 13, padding: 0, fontFamily: 'inherit',
              }}
              aria-expanded={resp2Aberto}
            >
              {resp2Aberto ? '▾' : '▸'} Responsável 2 (opcional)
            </button>
            {resp2Aberto && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                <Campo label="Nome completo" span2>
                  <input style={fld} value={form.resp2_nome} onChange={e => set('resp2_nome', e.target.value)} />
                </Campo>
                <Campo label="Telefone / WhatsApp">
                  <input style={fld} inputMode="tel" value={form.resp2_telefone} onChange={e => set('resp2_telefone', e.target.value)} />
                </Campo>
                <Campo label="Profissão">
                  <input style={fld} value={form.resp2_profissao} onChange={e => set('resp2_profissao', e.target.value)} />
                </Campo>
                <Campo label="Endereço completo" span2>
                  <input style={fld} value={form.resp2_endereco} onChange={e => set('resp2_endereco', e.target.value)} />
                </Campo>
                <Campo label="Grau de parentesco">
                  <input style={fld} value={form.resp2_parentesco} onChange={e => set('resp2_parentesco', e.target.value)} />
                </Campo>
              </div>
            )}

            {/* Irmãos */}
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
                fontSize: 13, color: ESJT.navy, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={form.tem_irmaos}
                onChange={e => set('tem_irmaos', e.target.checked)}
              />
              Possui irmã(o)s em idade escolar
            </label>
            {form.tem_irmaos && (
              <div style={{ marginTop: 10 }}>
                <Campo label="Série do(s) irmão(s) em 2026">
                  <textarea
                    style={{ ...fld, resize: 'vertical', minHeight: 60 }}
                    value={form.irmaos_series_2026}
                    onChange={e => set('irmaos_series_2026', e.target.value)}
                    placeholder="Ex.: João — 4º ano EF; Ana — 8º ano EF"
                  />
                </Campo>
              </div>
            )}

            {erro && <ErroBox mensagem={erro} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button onClick={() => voltar(1)} style={btnVoltar}>← Voltar</button>
              <button onClick={avancarPasso2} style={btnPrimario}>Continuar →</button>
            </div>
          </>
        )}

        {/* ── Passo 3 — Revisão + LGPD ── */}
        {passo === 3 && (
          <>
            <TituloPasso titulo="Revisão e pagamento" subtitulo="Confira os dados antes de gerar o Pix" />

            <div
              style={{
                background: PAGE_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 8,
                padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: ESJT.red, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                  Aluno
                </div>
                <LinhaResumo rotulo="Nome" valor={form.aluno_nome} />
                <LinhaResumo rotulo="Nascimento" valor={form.aluno_nascimento.split('-').reverse().join('/')} />
                <LinhaResumo rotulo="Turno" valor="Tarde" />
                <LinhaResumo rotulo="Série em 2026" valor={form.serie_2026} />
                <LinhaResumo rotulo="Modalidade" valor={modalidadeNome} />
                <LinhaResumo rotulo="Instituição atual" valor={form.instituicao_atual} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: ESJT.red, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                  Responsável 1
                </div>
                <LinhaResumo rotulo="Nome" valor={form.resp1_nome} />
                <LinhaResumo rotulo="CPF" valor={form.resp1_cpf} />
                <LinhaResumo rotulo="E-mail" valor={form.resp1_email} />
                <LinhaResumo rotulo="Telefone" valor={form.resp1_telefone} />
                <LinhaResumo rotulo="Endereço" valor={form.resp1_endereco} />
                <LinhaResumo rotulo="Profissão" valor={form.resp1_profissao} />
                <LinhaResumo rotulo="Parentesco" valor={form.resp1_parentesco} />
              </div>
              {form.resp2_nome.trim() && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ESJT.red, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                    Responsável 2
                  </div>
                  <LinhaResumo rotulo="Nome" valor={form.resp2_nome} />
                  <LinhaResumo rotulo="Telefone" valor={form.resp2_telefone} />
                  <LinhaResumo rotulo="Endereço" valor={form.resp2_endereco} />
                  <LinhaResumo rotulo="Profissão" valor={form.resp2_profissao} />
                  <LinhaResumo rotulo="Parentesco" valor={form.resp2_parentesco} />
                </div>
              )}
              {form.tem_irmaos && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ESJT.red, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                    Irmãos
                  </div>
                  <LinhaResumo rotulo="Série(s) em 2026" valor={form.irmaos_series_2026 || '—'} />
                </div>
              )}
              <div
                style={{
                  borderTop: `1px solid ${CARD_BORDER}`, paddingTop: 10,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, color: ESJT.gray }}>Taxa de inscrição (Pix)</span>
                <span style={{ fontFamily: 'var(--font-esjt-title)', fontSize: 20, fontWeight: 800, color: ESJT.navy }}>
                  {valorFmt}
                </span>
              </div>
            </div>

            <label
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 16,
                fontSize: 12.5, color: '#3d4557', lineHeight: 1.5, cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={form.consentimento}
                onChange={e => set('consentimento', e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                Autorizo o tratamento dos dados informados para fins de inscrição e comunicação
                sobre o Concurso de Bolsas 2027, conforme o edital e a LGPD.
              </span>
            </label>

            {erro && <ErroBox mensagem={erro} />}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => voltar(2)} style={btnVoltar} disabled={enviando}>← Voltar</button>
              {falhaComId ? (
                <button
                  onClick={tentarPixNovamente}
                  disabled={enviando}
                  style={{ ...btnPrimario, opacity: enviando ? 0.7 : 1 }}
                >
                  {enviando ? 'Gerando…' : 'Tentar gerar o Pix novamente'}
                </button>
              ) : (
                <button
                  onClick={confirmar}
                  disabled={enviando || !form.consentimento}
                  style={{ ...btnPrimario, opacity: enviando || !form.consentimento ? 0.6 : 1, cursor: enviando || !form.consentimento ? 'not-allowed' : 'pointer' }}
                >
                  {enviando ? 'Gerando Pix…' : 'Confirmar e gerar Pix'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
