'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarProdutoAction, editarProdutoAction } from '@/app/actions/admin'
import type { Produto, CategoriaProduto, MetodoPagamento, ProdutoVariante } from '@/types/database'

// ── Constantes ────────────────────────────────────────────────────────────────
const CATEGORIAS: { value: CategoriaProduto; label: string; icon: string }[] = [
  { value: 'eventos',         label: 'Eventos',       icon: '🎉' },
  { value: 'passeios',        label: 'Passeios',      icon: '🚌' },
  { value: 'segunda_chamada', label: '2ª Chamada',    icon: '📝' },
  { value: 'materiais',       label: 'Materiais',     icon: '📚' },
  { value: 'uniforme',        label: 'Uniforme',      icon: '👕' },
  { value: 'outros',          label: 'Outros',        icon: '📦' },
]

const METODOS: { value: MetodoPagamento; label: string; icon: string }[] = [
  { value: 'pix',    label: 'PIX',    icon: '⚡' },
  { value: 'cartao', label: 'Cartão', icon: '💳' },
  { value: 'boleto', label: 'Boleto', icon: '📄' },
]

const SERIES_OPTIONS = [
  'Berçário I', 'Berçário II', 'Maternal I', 'Maternal II', 'Jardim I', 'Jardim II',
  '1º ano EF', '2º ano EF', '3º ano EF', '4º ano EF', '5º ano EF',
  '6º ano EF', '7º ano EF', '8º ano EF', '9º ano EF',
  '1º ano EM', '2º ano EM', '3º ano EM',
]

const ICONS_SUGESTOES = ['🎉', '🚌', '📝', '📚', '👕', '📦', '🎭', '🏊', '🎨', '🏅', '🌿', '🎸', '⚽', '🎓']
const VARIANTES_PRESETS = [
  { label: 'P / M / G / GG', values: ['P', 'M', 'G', 'GG'] },
  { label: 'Infantil 2-10', values: ['2', '4', '6', '8', '10'] },
  { label: 'Numeração 34-40', values: ['34', '36', '38', '40'] },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDatetimeLocal(iso: string | null) {
  if (!iso) return ''
  return iso.slice(0, 16) // "YYYY-MM-DDTHH:MM"
}

function toDateLocal(iso: string | null) {
  if (!iso) return ''
  return iso.slice(0, 10) // "YYYY-MM-DD"
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  produto?: Produto   // undefined = criação, definido = edição
  variantesDetalhadas: ProdutoVariante[]
}

export function ProdutoForm({ produto, variantesDetalhadas }: Props) {
  const router  = useRouter()
  const isEdit  = !!produto
  const [isPending, startTransition] = useTransition()
  const [error, setError]   = useState('')

  // Estado do formulário
  const [categoria,    setCategoria]    = useState<CategoriaProduto>(produto?.categoria ?? 'eventos')
  const [metodos,      setMetodos]      = useState<MetodoPagamento[]>(produto?.metodos_aceitos ?? ['pix'])
  const [series,       setSeries]       = useState<string[]>(produto?.series ?? [])
  const [geraIngresso, setGeraIngresso] = useState(produto?.gera_ingresso ?? false)
  const [temCartao,    setTemCartao]    = useState(produto?.metodos_aceitos?.includes('cartao') ?? false)
  const [iconVal,      setIconVal]      = useState(produto?.icon ?? '')
  const [ativo,        setAtivo]        = useState(produto?.ativo ?? true)
  const [variantesState, setVariantesState] = useState<Array<{
    id?: string
    nome: string
    disponivel: boolean
    estoque: string
  }>>(
    variantesDetalhadas.map((variante) => ({
      id: variante.id.startsWith('fallback-') ? undefined : variante.id,
      nome: variante.nome,
      disponivel: variante.disponivel,
      estoque: variante.estoque?.toString() ?? '',
    }))
  )
  const variantesPreenchidas = variantesState.filter((variante) => variante.nome.trim())
  const variantesDisponiveis = variantesPreenchidas.filter((variante) => variante.disponivel)
  const variantesComEstoqueControlado = variantesPreenchidas.filter((variante) => variante.estoque.trim() !== '')
  const variantesSemEstoque = variantesPreenchidas.filter((variante) => variante.estoque.trim() === '0')
  const variantesBaixoEstoque = variantesPreenchidas.filter((variante) => {
    if (variante.estoque.trim() === '') return false
    const estoque = Number(variante.estoque)
    return estoque > 0 && estoque <= 3
  })

  function toggleMetodo(m: MetodoPagamento) {
    setMetodos(prev => {
      const next = prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
      setTemCartao(next.includes('cartao'))
      return next.length ? next : [m] // mínimo 1
    })
  }

  function toggleSerie(s: string) {
    setSeries(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function updateVariante(index: number, patch: Partial<{ nome: string; disponivel: boolean; estoque: string }>) {
    setVariantesState((prev) => prev.map((variante, i) => i === index ? { ...variante, ...patch } : variante))
  }

  function addVariante() {
    setVariantesState((prev) => [...prev, { nome: '', disponivel: true, estoque: '' }])
  }

  function removeVariante(index: number) {
    setVariantesState((prev) => prev.filter((_, i) => i !== index))
  }

  function applyPreset(values: string[]) {
    const existentes = new Set(
      variantesState.map((variante) => variante.nome.trim().toLowerCase()).filter(Boolean)
    )

    const novas = values
      .filter((value) => !existentes.has(value.trim().toLowerCase()))
      .map((value) => ({ nome: value, disponivel: true, estoque: '' }))

    if (novas.length === 0) return
    setVariantesState((prev) => [...prev, ...novas])
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    const fd = new FormData(e.currentTarget)
    // Adiciona os estados controlados
    fd.delete('metodos_aceitos')
    metodos.forEach(m => fd.append('metodos_aceitos', m))
    fd.delete('series')
    series.forEach(s => fd.append('series', s))
    fd.set('variantes_json', JSON.stringify(
      variantesState
        .map((variante, index) => ({
          id: variante.id,
          nome: variante.nome.trim(),
          disponivel: variante.disponivel,
          estoque: variante.estoque.trim() === '' ? null : Number(variante.estoque),
          ordem: index,
        }))
        .filter((variante) => variante.nome)
    ))
    if (geraIngresso) fd.set('gera_ingresso', 'on')
    else fd.delete('gera_ingresso')
    if (ativo) fd.set('ativo', 'on')
    else fd.delete('ativo')

    startTransition(async () => {
      const res = isEdit
        ? await editarProdutoAction(produto!.id, fd)
        : await criarProdutoAction(fd)

      if (!res.success) { setError(res.error ?? 'Erro ao salvar.'); return }
      router.push('/admin/produtos')
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Seção: Identificação ── */}
      <Section title="Identificação do produto">

        {/* Ícone + Nome */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ width: 90, flexShrink: 0 }}>
            <Label>ÍCONE</Label>
            <input
              name="icon"
              value={iconVal}
              onChange={e => setIconVal(e.target.value)}
              placeholder="🎉"
              maxLength={4}
              style={{ ...inputStyle, textAlign: 'center', fontSize: 22, height: 52 }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {ICONS_SUGESTOES.map(ic => (
                <button key={ic} type="button" onClick={() => setIconVal(ic)}
                  style={{
                    fontSize: 16, background: iconVal === ic ? '#ede9fe' : 'var(--surface-2)',
                    border: iconVal === ic ? '1.5px solid #a78bfa' : '1.5px solid var(--border)',
                    borderRadius: 6, cursor: 'pointer', width: 30, height: 30,
                  }}
                >{ic}</button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <Label req>NOME DO PRODUTO</Label>
            <input
              name="nome"
              defaultValue={produto?.nome}
              required
              placeholder="Ex: Festa Junina 2026"
              style={{ ...inputStyle, height: 52, fontSize: 15, fontWeight: 600 }}
            />
          </div>
        </div>

        {/* Descrição */}
        <div>
          <Label>DESCRIÇÃO</Label>
          <textarea
            name="descricao"
            defaultValue={produto?.descricao ?? ''}
            rows={3}
            placeholder="Detalhes adicionais que o responsável verá na loja…"
            style={{
              ...inputStyle, height: 'auto', padding: '10px 14px',
              resize: 'vertical', lineHeight: 1.5,
            }}
          />
        </div>

        {/* Categoria */}
        <div>
          <Label req>CATEGORIA</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {CATEGORIAS.map(c => (
              <button
                key={c.value} type="button"
                onClick={() => setCategoria(c.value)}
                style={{
                  padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                  border: categoria === c.value ? '2px solid var(--brand)' : '1.5px solid var(--border)',
                  background: categoria === c.value ? '#eff6ff' : 'var(--surface-2)',
                  fontWeight: 700, fontSize: 13, color: categoria === c.value ? 'var(--brand)' : 'var(--text-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <span>{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="categoria" value={categoria} />
        </div>
      </Section>

      {/* ── Seção: Preço e Pagamento ── */}
      <Section title="Preço e pagamento">

        {/* Preço + Parcelas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Label req>PREÇO (R$)</Label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                fontSize: 13, fontWeight: 700, color: 'var(--text-3)',
              }}>R$</span>
              <input
                name="preco"
                type="number"
                step="0.01"
                min="0"
                defaultValue={produto?.preco ?? ''}
                required
                placeholder="0,00"
                style={{ ...inputStyle, paddingLeft: 36 }}
              />
            </div>
          </div>
          <div style={{ opacity: temCartao ? 1 : .4 }}>
            <Label>MAX. PARCELAS</Label>
            <select
              name="max_parcelas"
              defaultValue={produto?.max_parcelas ?? 1}
              disabled={!temCartao}
              style={{ ...inputStyle, appearance: 'none', cursor: temCartao ? 'pointer' : 'not-allowed' }}
            >
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x`}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Métodos de pagamento */}
        <div>
          <Label req>MÉTODOS ACEITOS</Label>
          <div style={{ display: 'flex', gap: 10 }}>
            {METODOS.map(m => {
              const ativo = metodos.includes(m.value)
              return (
                <button
                  key={m.value} type="button"
                  onClick={() => toggleMetodo(m.value)}
                  style={{
                    flex: 1, height: 48, borderRadius: 10, cursor: 'pointer',
                    border: ativo ? '2px solid var(--brand)' : '1.5px solid var(--border)',
                    background: ativo ? '#eff6ff' : 'var(--surface-2)',
                    fontWeight: 700, fontSize: 13,
                    color: ativo ? 'var(--brand)' : 'var(--text-3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {m.icon} {m.label}
                </button>
              )
            })}
          </div>
          {metodos.length === 0 && (
            <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Selecione ao menos um método.</p>
          )}
        </div>
      </Section>

      <Section title="Variantes e tamanhos">
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:10,
          }}>
            <MiniStat
              label="Variantes"
              value={String(variantesPreenchidas.length)}
              tone="neutral"
            />
            <MiniStat
              label="Disponíveis"
              value={String(variantesDisponiveis.length)}
              tone="success"
            />
            <MiniStat
              label="Sem estoque"
              value={String(variantesSemEstoque.length)}
              tone={variantesSemEstoque.length > 0 ? 'danger' : 'neutral'}
            />
            <MiniStat
              label="Baixo estoque"
              value={String(variantesBaixoEstoque.length)}
              tone={variantesBaixoEstoque.length > 0 ? 'warning' : 'neutral'}
            />
          </div>

          <div style={{
            padding:'12px 14px', borderRadius:12, border:'1.5px solid var(--border)',
            background:'linear-gradient(135deg,#f8fafc,#eef2ff)', display:'flex',
            flexDirection:'column', gap:10,
          }}>
            <div>
              <div style={{ fontSize:12, fontWeight:800, color:'var(--text-1)' }}>
                Atalhos para tamanhos
              </div>
              <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2, lineHeight:1.5 }}>
                Use um preset para montar a grade mais rápido. As variantes já existentes não são duplicadas.
              </div>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {VARIANTES_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.values)}
                  style={{
                    height:36, padding:'0 12px', borderRadius:999, border:'1.5px solid #c7d2fe',
                    background:'#fff', color:'#4338ca', fontSize:12, fontWeight:700, cursor:'pointer',
                  }}
                >
                  + {preset.label}
                </button>
              ))}
            </div>
          </div>

          {variantesState.length === 0 && (
            <div style={{
              padding:'14px 16px', borderRadius:12, border:'1.5px dashed var(--border)',
              color:'var(--text-3)', fontSize:13, background:'var(--surface-2)',
            }}>
              Nenhuma variante cadastrada. Adicione tamanhos como P, M, G ou numerações.
            </div>
          )}

          {variantesState.map((variante, index) => (
            <div key={variante.id ?? `nova-${index}`} style={{
              display:'grid', gridTemplateColumns:'1.6fr .9fr auto auto', gap:10,
              alignItems:'end', padding:'12px', borderRadius:12, border:'1.5px solid var(--border)',
              background:'var(--surface-2)',
            }}>
              <div>
                <Label req>NOME</Label>
                <input
                  value={variante.nome}
                  onChange={(e) => updateVariante(index, { nome: e.target.value })}
                  placeholder="Ex: P, M, G, 38, Infantil 6"
                  style={inputStyle}
                />
              </div>

              <div>
                <Label>ESTOQUE</Label>
                <input
                  value={variante.estoque}
                  onChange={(e) => updateVariante(index, { estoque: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder="Livre"
                  style={inputStyle}
                />
              </div>

              <label style={{ display:'flex', alignItems:'center', gap:8, height:46, fontSize:13, fontWeight:700, color:'var(--text-2)' }}>
                <input
                  type="checkbox"
                  checked={variante.disponivel}
                  onChange={(e) => updateVariante(index, { disponivel: e.target.checked })}
                />
                Disponível
              </label>

              <button
                type="button"
                onClick={() => removeVariante(index)}
                style={{
                  height:46, padding:'0 14px', borderRadius:10, border:'1.5px solid #fecaca',
                  background:'#fff', color:'#b91c1c', fontSize:13, fontWeight:700, cursor:'pointer',
                }}
              >
                Remover
              </button>
            </div>
          ))}

          <div>
            <button
              type="button"
              onClick={addVariante}
              style={{
                height:42, padding:'0 16px', borderRadius:10, border:'1.5px dashed #a5b4fc',
                background:'#eef2ff', color:'#4338ca', fontSize:13, fontWeight:700, cursor:'pointer',
              }}
            >
              + Adicionar variante
            </button>
          </div>

          <div style={{
            fontSize:12, color:'var(--text-3)', lineHeight:1.6,
            padding:'12px 14px', borderRadius:12, background:'var(--surface-2)',
            border:'1px solid var(--border)',
          }}>
            Estoque em branco significa ilimitado. Estoque `0` bloqueia a compra daquele tamanho.
            Variantes marcadas como indisponíveis continuam cadastradas, mas não aparecem como opção de compra.
            {variantesComEstoqueControlado.length > 0 && ` ${variantesComEstoqueControlado.length} variante(s) estão com estoque controlado agora.`}
          </div>
        </div>
      </Section>

      {/* ── Seção: Prazos e Evento ── */}
      <Section title="Prazos e evento">

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Label>PRAZO DE COMPRA</Label>
            <input
              name="prazo_compra"
              type="datetime-local"
              defaultValue={toDatetimeLocal(produto?.prazo_compra ?? null)}
              style={inputStyle}
            />
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
              Após este prazo, o produto deixa de aparecer na loja.
            </p>
          </div>
          <div>
            <Label>DATA DO EVENTO</Label>
            <input
              name="data_evento"
              type="date"
              defaultValue={toDateLocal(produto?.data_evento ?? null)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Label>HORÁRIO</Label>
            <input
              name="hora_evento"
              type="time"
              defaultValue={produto?.hora_evento?.slice(0, 5) ?? ''}
              style={inputStyle}
            />
          </div>
          <div>
            <Label>LOCAL / ENDEREÇO</Label>
            <input
              name="local_evento"
              defaultValue={produto?.local_evento ?? ''}
              placeholder="Ex: Quadra poliesportiva"
              style={inputStyle}
            />
          </div>
        </div>
      </Section>

      {/* ── Seção: Ingressos ── */}
      <Section title="Ingressos digitais">
        <Toggle
          checked={geraIngresso}
          onChange={setGeraIngresso}
          label="Gerar ingresso digital ao confirmar pagamento"
          desc="Ativa o QR Code de entrada para este produto."
        />

        {geraIngresso && (
          <div style={{ marginTop: 12 }}>
            <Label>CAPACIDADE (vagas)</Label>
            <input
              name="capacidade"
              type="number"
              min="1"
              defaultValue={produto?.capacidade ?? ''}
              placeholder="Deixe em branco para ilimitado"
              style={{ ...inputStyle, maxWidth: 240 }}
            />
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
              Quando atingido, o produto é marcado como esgotado automaticamente.
            </p>
          </div>
        )}
      </Section>

      {/* ── Seção: Restrição por série ── */}
      <Section title="Séries permitidas">
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 10px', lineHeight: 1.5 }}>
          Selecione as séries que podem comprar este produto. Se nenhuma for selecionada, o produto aparece para todos.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SERIES_OPTIONS.map(s => {
            const sel = series.includes(s)
            return (
              <button
                key={s} type="button"
                onClick={() => toggleSerie(s)}
                style={{
                  padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                  border: sel ? '1.5px solid var(--brand)' : '1.5px solid var(--border)',
                  background: sel ? '#eff6ff' : 'var(--surface-2)',
                  fontSize: 12, fontWeight: 600,
                  color: sel ? 'var(--brand)' : 'var(--text-3)',
                }}
              >
                {sel ? '✓ ' : ''}{s}
              </button>
            )
          })}
        </div>
        {series.length > 0 && (
          <button
            type="button"
            onClick={() => setSeries([])}
            style={{
              marginTop: 8, fontSize: 11, color: 'var(--text-3)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            ✕ Limpar seleção (mostrar para todos)
          </button>
        )}
      </Section>

      {/* ── Seção: Status ── */}
      <Section title="Publicação">
        <Toggle
          checked={ativo}
          onChange={setAtivo}
          label="Produto ativo (visível na loja)"
          desc="Desative para salvar como rascunho sem publicar."
        />
      </Section>

      {/* ── Erro ── */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5',
          borderRadius: 10, padding: '12px 16px',
          fontSize: 13, color: '#b91c1c',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Ações ── */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="submit"
          disabled={isPending || metodos.length === 0}
          style={{
            flex: 1, height: 52, borderRadius: 12, border: 'none',
            background: isPending || metodos.length === 0 ? '#94a3b8' : '#0f172a',
            color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {isPending ? 'Salvando…' : isEdit ? '💾 Salvar alterações' : '✅ Criar produto'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/produtos')}
          style={{
            height: 52, padding: '0 24px', borderRadius: 12,
            background: 'var(--surface-2)', color: 'var(--text-2)',
            border: '1.5px solid var(--border)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', border: '1.5px solid var(--border)',
      borderRadius: 16, overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        fontSize: 13, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-.01em',
      }}>
        {title}
      </div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  )
}

function Label({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return (
    <label style={{
      display: 'block', fontSize: 11, fontWeight: 700,
      color: 'var(--text-3)', marginBottom: 6, letterSpacing: '.04em',
    }}>
      {children}{req && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
    </label>
  )
}

function Toggle({ checked, onChange, label, desc }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; desc: string
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        cursor: 'pointer', userSelect: 'none',
      }}
    >
      {/* Switch */}
      <div style={{
        width: 44, height: 24, borderRadius: 999, flexShrink: 0,
        background: checked ? 'var(--brand)' : '#d1d5db',
        position: 'relative', transition: 'background .2s',
      }}>
        <div style={{
          position: 'absolute', width: 18, height: 18, borderRadius: '50%',
          background: '#fff', top: 3,
          left: checked ? 23 : 3, transition: 'left .2s',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        }} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, tone }: {
  label: string
  value: string
  tone: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  const tones: Record<typeof tone, { bg: string; border: string; value: string }> = {
    neutral: { bg: '#f8fafc', border: '#e2e8f0', value: '#0f172a' },
    success: { bg: '#ecfdf5', border: '#bbf7d0', value: '#166534' },
    warning: { bg: '#fffbeb', border: '#fde68a', value: '#92400e' },
    danger: { bg: '#fef2f2', border: '#fecaca', value: '#b91c1c' },
  }

  return (
    <div style={{
      padding:'12px 14px', borderRadius:12, border:`1.5px solid ${tones[tone].border}`,
      background:tones[tone].bg,
    }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.06em' }}>
        {label}
      </div>
      <div style={{ fontSize:24, fontWeight:800, color:tones[tone].value, marginTop:4, letterSpacing:'-.03em' }}>
        {value}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 14px',
  borderRadius: 10, border: '1.5px solid var(--border)',
  fontSize: 14, color: 'var(--text-1)',
  background: 'var(--surface-2)', boxSizing: 'border-box',
}
