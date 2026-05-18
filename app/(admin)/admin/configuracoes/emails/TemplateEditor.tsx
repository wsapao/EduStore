'use client'

import { useRef, useState, useTransition } from 'react'
import { EMAIL_TEMPLATE_META } from '@/lib/email/templates-config'
import { renderEmailTemplate } from '@/lib/email/render'
import {
  salvarTemplateEmailAction,
  restaurarPadraoTemplateAction,
  enviarTesteEmailAction,
} from '@/app/actions/configuracoes/emails'
import type { TemplateEntry } from './EmailsView'

const ASSUNTO_MAX = 200
const CORPO_MAX = 5000

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function TemplateEditor({ entry }: { entry: TemplateEntry }) {
  const meta = EMAIL_TEMPLATE_META[entry.tipo]
  const [assunto, setAssunto] = useState(entry.assunto)
  const [corpo, setCorpo] = useState(entry.corpo)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [previewAberto, setPreviewAberto] = useState(false)
  const [preview, setPreview] = useState<{ assunto: string; corpo: string } | null>(null)
  const corpoRef = useRef<HTMLTextAreaElement | null>(null)

  function inserirVariavel(chave: string) {
    const ta = corpoRef.current
    const token = `{{${chave}}}`
    if (ta && document.activeElement === ta) {
      const start = ta.selectionStart ?? corpo.length
      const end = ta.selectionEnd ?? corpo.length
      const novo = corpo.slice(0, start) + token + corpo.slice(end)
      setCorpo(novo)
      // restaura cursor após inserção
      requestAnimationFrame(() => {
        ta.focus()
        const pos = start + token.length
        ta.setSelectionRange(pos, pos)
      })
    } else {
      setCorpo((c) => c + (c.endsWith('\n') || c.length === 0 ? '' : ' ') + token)
    }
  }

  function atualizarPreview() {
    const exemplos: Record<string, string> = {}
    for (const v of meta.variaveis) exemplos[v.chave] = v.exemplo
    const r = renderEmailTemplate(entry.tipo, { assunto, corpo }, exemplos)
    setPreview(r)
    setPreviewAberto(true)
  }

  function salvar() {
    setMsg(null)
    startTransition(async () => {
      const r = await salvarTemplateEmailAction({ tipo: entry.tipo, assunto, corpo })
      if ('error' in r) setMsg({ tipo: 'erro', texto: r.error })
      else setMsg({ tipo: 'ok', texto: 'Template salvo!' })
    })
  }

  function restaurar() {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Restaurar texto padrão? Sua versão customizada será apagada.')
      if (!ok) return
    }
    setMsg(null)
    startTransition(async () => {
      const r = await restaurarPadraoTemplateAction({ tipo: entry.tipo })
      if ('error' in r) setMsg({ tipo: 'erro', texto: r.error })
      else {
        setMsg({ tipo: 'ok', texto: 'Padrão restaurado. Recarregue a página para ver os textos atualizados.' })
        setAssunto(meta.defaultAssunto)
        setCorpo(meta.defaultCorpo)
      }
    })
  }

  function enviarTeste() {
    setMsg(null)
    startTransition(async () => {
      const r = await enviarTesteEmailAction({ tipo: entry.tipo })
      if ('error' in r) setMsg({ tipo: 'erro', texto: r.error })
      else setMsg({ tipo: 'ok', texto: `E-mail de teste enviado para ${r.destinatario}.` })
    })
  }

  return (
    <section
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 24,
      }}
    >
      <header style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>{meta.label}</h2>
          {entry.customizado ? (
            <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.18)', color: '#86efac', fontWeight: 700 }}>
              CUSTOMIZADO
              {entry.updated_by_email && ` · por ${entry.updated_by_email}`}
              {entry.updated_at && ` · ${fmtDate(entry.updated_at)}`}
            </span>
          ) : (
            <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(148,163,184,0.18)', color: 'var(--text-2)', fontWeight: 700 }}>
              PADRÃO
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>{meta.descricao}</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>
            Assunto
          </label>
          <input
            type="text"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value.slice(0, ASSUNTO_MAX))}
            maxLength={ASSUNTO_MAX}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 13,
              borderRadius: 8,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text-1)',
              marginBottom: 14,
            }}
          />

          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>
            Corpo (texto)
          </label>
          <textarea
            ref={corpoRef}
            value={corpo}
            onChange={(e) => setCorpo(e.target.value.slice(0, CORPO_MAX))}
            rows={18}
            maxLength={CORPO_MAX}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: 13,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              lineHeight: 1.6,
              borderRadius: 8,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text-1)',
              resize: 'vertical',
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, textAlign: 'right' }}>
            {corpo.length} / {CORPO_MAX} caracteres
          </div>
        </div>

        <aside>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>
            Variáveis
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {meta.variaveis.map((v) => (
              <button
                key={v.chave}
                type="button"
                onClick={() => inserirVariavel(v.chave)}
                title={`${v.descricao}\nExemplo: ${v.exemplo}`}
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  fontSize: 11,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 6,
                  color: '#c7d2fe',
                  cursor: 'pointer',
                }}
              >
                {`{{${v.chave}}}`}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.5 }}>
            Clique numa variável para inseri-la na posição do cursor.
          </p>
        </aside>
      </div>

      <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <button
          type="button"
          onClick={() => (previewAberto ? setPreviewAberto(false) : atualizarPreview())}
          style={{
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 700,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text-2)',
            cursor: 'pointer',
            marginBottom: previewAberto ? 12 : 0,
          }}
        >
          {previewAberto ? 'Fechar preview' : 'Visualizar preview'}
        </button>
        {previewAberto && preview && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <button
              type="button"
              onClick={atualizarPreview}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                background: 'rgba(99,102,241,0.18)',
                border: '1px solid rgba(99,102,241,0.4)',
                borderRadius: 6,
                color: '#c7d2fe',
                cursor: 'pointer',
                marginBottom: 12,
              }}
            >
              Atualizar preview
            </button>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>
              Assunto
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>{preview.assunto}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>
              Corpo
            </div>
            <pre
              style={{
                margin: 0,
                padding: 12,
                background: 'var(--surface-2)',
                borderRadius: 8,
                color: 'var(--text-2)',
                fontSize: 13,
                lineHeight: 1.6,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {preview.corpo}
            </pre>
          </div>
        )}
      </div>

      {msg && (
        <div
          style={{
            marginTop: 14,
            padding: '10px 14px',
            background: msg.tipo === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            border: '1px solid ' + (msg.tipo === 'ok' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'),
            borderRadius: 8,
            color: msg.tipo === 'ok' ? '#86efac' : '#fca5a5',
            fontSize: 13,
          }}
        >
          {msg.texto}
        </div>
      )}

      <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={salvar}
            disabled={pending}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 800,
              background: pending ? 'rgba(249,115,22,.35)' : 'linear-gradient(135deg, #f97316, #ec4899)',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              cursor: pending ? 'not-allowed' : 'pointer',
            }}
          >
            {pending ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={enviarTeste}
            disabled={pending}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text-1)',
              cursor: pending ? 'not-allowed' : 'pointer',
            }}
          >
            Enviar teste pra mim
          </button>
        </div>
        {entry.customizado && (
          <button
            type="button"
            onClick={restaurar}
            disabled={pending}
            style={{
              padding: '10px 16px',
              fontSize: 12,
              fontWeight: 700,
              background: 'transparent',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 10,
              color: '#fca5a5',
              cursor: pending ? 'not-allowed' : 'pointer',
            }}
          >
            Restaurar padrão
          </button>
        )}
      </div>
    </section>
  )
}
