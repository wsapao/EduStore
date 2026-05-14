'use client'

import { useState, useTransition } from 'react'
import { publicarVersaoTermosAction } from '@/app/actions/configuracoes/termos'

type TipoTermo = 'termos_uso' | 'privacidade'

type VersaoAtual = { versao: number; conteudo: string; publicado_em: string } | null

type ItemHistorico = {
  id: string
  versao: number
  publicado_em: string
  publicado_por_email: string | null
}

const PLACEHOLDERS: Record<TipoTermo, string> = {
  termos_uso:
    '1. Aceitação\nAo utilizar este aplicativo, você concorda com estes Termos de Uso...\n\n2. Cadastro\n...\n\n3. Pagamentos\n...',
  privacidade:
    '1. Coleta de dados\nColetamos os seguintes dados pessoais: nome, e-mail, CPF...\n\n2. Uso\n...\n\n3. Compartilhamento\n...',
}

export function TermosForm({
  tipo,
  titulo,
  versaoAtual,
  historico,
}: {
  tipo: TipoTermo
  titulo: string
  versaoAtual: VersaoAtual
  historico: ItemHistorico[]
}) {
  const [pending, startTransition] = useTransition()
  const [conteudo, setConteudo] = useState<string>(versaoAtual?.conteudo ?? '')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [historicoAberto, setHistoricoAberto] = useState(false)

  function onPublicar() {
    setMsg(null)
    if (conteudo.trim().length < 50) {
      setMsg({ tipo: 'erro', texto: 'Conteúdo muito curto (mínimo 50 caracteres).' })
      return
    }
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        'Publicar nova versão? Os usuários verão essa versão imediatamente.',
      )
      if (!ok) return
    }
    startTransition(async () => {
      const r = await publicarVersaoTermosAction({ tipo, conteudo })
      if ('error' in r) {
        setMsg({ tipo: 'erro', texto: r.error })
      } else {
        setMsg({ tipo: 'ok', texto: `Publicada v${r.versao}!` })
      }
    })
  }

  return (
    <section
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 24,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          gap: 12,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', margin: 0 }}>{titulo}</h2>
        {versaoAtual ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '.05em',
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(34,197,94,.15)',
              color: '#22c55e',
            }}
          >
            VERSÃO {versaoAtual.versao} ATUAL
          </span>
        ) : (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '.05em',
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(245,158,11,.15)',
              color: '#f59e0b',
            }}
          >
            NUNCA PUBLICADA
          </span>
        )}
      </div>

      <textarea
        value={conteudo}
        onChange={(e) => setConteudo(e.target.value)}
        rows={18}
        placeholder={PLACEHOLDERS[tipo]}
        style={{
          width: '100%',
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10,
          padding: '12px 14px',
          color: '#f8fafc',
          fontSize: 14,
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          lineHeight: 1.55,
          outline: 'none',
          resize: 'vertical',
          minHeight: 320,
        }}
      />

      <div
        style={{
          marginTop: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={onPublicar}
          disabled={pending}
          style={{
            background: '#f59e0b',
            border: 'none',
            borderRadius: 10,
            padding: '10px 18px',
            color: '#0a1628',
            fontSize: 13,
            fontWeight: 800,
            cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? 'Publicando…' : 'Publicar nova versão'}
        </button>
        {msg && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: msg.tipo === 'ok' ? '#22c55e' : '#ef4444',
            }}
          >
            {msg.texto}
          </span>
        )}
        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>
          {conteudo.trim().length} caracteres
        </span>
      </div>

      <div style={{ marginTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
        <button
          type="button"
          onClick={() => setHistoricoAberto((v) => !v)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#cbd5e1',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ display: 'inline-block', transform: historicoAberto ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s' }}>
            ▶
          </span>
          Histórico ({historico.length} {historico.length === 1 ? 'versão' : 'versões'})
        </button>

        {historicoAberto && (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '12px 0 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {historico.length === 0 && (
              <li style={{ fontSize: 12, color: '#64748b' }}>Nenhuma versão publicada ainda.</li>
            )}
            {historico.map((h) => (
              <li
                key={h.id}
                style={{
                  fontSize: 12,
                  color: '#94a3b8',
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.2)',
                }}
              >
                <strong style={{ color: '#cbd5e1' }}>v{h.versao}</strong>
                {' — '}
                {formatarData(h.publicado_em)}
                {h.publicado_por_email && (
                  <>
                    {' por '}
                    <span style={{ color: '#cbd5e1' }}>{h.publicado_por_email}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function formatarData(iso: string): string {
  try {
    const d = new Date(iso)
    const data = d.toLocaleDateString('pt-BR')
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${data} às ${hora}`
  } catch {
    return iso
  }
}
