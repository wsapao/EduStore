'use client'

import { useState, useTransition } from 'react'
import { salvarProdutoCantinaAction, toggleProdutoCantinaAction } from '@/app/actions/cantina'
import type { CantinaProduto } from '@/types/database'

const CATEGORIAS = ['lanche', 'bebida', 'sobremesa', 'combo', 'outros']
const ALERGENOS_OPCOES = ['glúten', 'lactose', 'ovo', 'amendoim', 'soja', 'frutos do mar', 'nozes']
const ICONES = ['🍽️', '🥪', '🥗', '🍕', '🍔', '🌮', '🥞', '🍩', '🍰', '🧁', '🍫', '🥤', '🧃', '☕', '🍵', '💧', '🍎', '🍌', '🥕', '🥦']

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  produtos: CantinaProduto[]
}

interface FormState {
  id?: string
  nome: string
  descricao: string
  preco: string
  categoria: string
  icone: string
  disponivel_presencial: boolean
  disponivel_online: boolean
  alergenos: string[]
}

const FORM_VAZIO: FormState = {
  nome: '', descricao: '', preco: '', categoria: 'lanche',
  icone: '🍽️', disponivel_presencial: true, disponivel_online: true, alergenos: [],
}

export function ProdutosClient({ produtos: inicial }: Props) {
  const [produtos, setProdutos] = useState(inicial)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function abrirNovo() {
    setForm(FORM_VAZIO)
    setFormAberto(true)
    setMsg(null)
  }

  function abrirEditar(p: CantinaProduto) {
    setForm({
      id: p.id,
      nome: p.nome,
      descricao: p.descricao ?? '',
      preco: String(p.preco),
      categoria: p.categoria ?? 'lanche',
      icone: p.icone ?? '🍽️',
      disponivel_presencial: p.disponivel_presencial,
      disponivel_online: p.disponivel_online,
      alergenos: p.alergenos ?? [],
    })
    setFormAberto(true)
    setMsg(null)
  }

  function toggleAlergeno(al: string) {
    setForm(f => ({
      ...f,
      alergenos: f.alergenos.includes(al)
        ? f.alergenos.filter(a => a !== al)
        : [...f.alergenos, al],
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    const fd = new FormData()
    if (form.id) fd.append('id', form.id)
    fd.append('nome', form.nome)
    fd.append('descricao', form.descricao)
    fd.append('preco', form.preco)
    fd.append('categoria', form.categoria)
    fd.append('icone', form.icone)
    fd.append('disponivel_presencial', String(form.disponivel_presencial))
    fd.append('disponivel_online', String(form.disponivel_online))
    fd.append('alergenos', form.alergenos.join(','))

    startTransition(async () => {
      const res = await salvarProdutoCantinaAction(fd)
      if (res.error) { setMsg(`❌ ${res.error}`); return }
      setMsg('✅ Produto salvo com sucesso!')
      setFormAberto(false)
      // Revalida via router — em produção o Server Component atualiza
      window.location.reload()
    })
  }

  function handleToggle(p: CantinaProduto) {
    startTransition(async () => {
      await toggleProdutoCantinaAction(p.id, p.ativo)
      window.location.reload()
    })
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    borderRadius: 'var(--r-md)', border: '1.5px solid var(--border)',
    fontSize: 13, outline: 'none',
    transition: 'border-color .15s',
  }

  return (
    <div>
      {/* Barra de ação */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={abrirNovo} style={{
          padding: '10px 18px', borderRadius: 'var(--r-md)',
          background: 'var(--brand)', color: '#fff', border: 'none',
          fontSize: 13, fontWeight: 800, cursor: 'pointer',
        }}>
          + Novo produto
        </button>
      </div>

      {/* Formulário */}
      {formAberto && (
        <div style={{
          background: 'var(--surface)', border: '1.5px solid var(--brand)',
          borderRadius: 'var(--r-lg)', padding: '20px', marginBottom: 20,
          boxShadow: 'var(--shadow-md)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', marginBottom: 16 }}>
            {form.id ? '✏️ Editar produto' : '+ Novo produto'}
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Ícone */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8 }}>Ícone</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ICONES.map(ic => (
                  <button key={ic} type="button" onClick={() => setForm(f => ({ ...f, icone: ic }))} style={{
                    width: 38, height: 38, borderRadius: 'var(--r-md)', fontSize: 20, cursor: 'pointer',
                    border: `2px solid ${form.icone === ic ? 'var(--brand)' : 'var(--border)'}`,
                    background: form.icone === ic ? 'var(--brand-light)' : 'var(--surface)',
                  }}>{ic}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Nome *</label>
                <input required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }} placeholder="Ex: Sanduíche natural" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Preço (R$) *</label>
                <input required type="number" min="0.01" step="0.01" value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }} placeholder="Ex: 8.00" />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Descrição</label>
              <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }} placeholder="Opcional" />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Categoria</label>
              <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>

            {/* Alergenos */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8 }}>⚠️ Alergênicos</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ALERGENOS_OPCOES.map(al => (
                  <label key={al} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={form.alergenos.includes(al)} onChange={() => toggleAlergeno(al)} />
                    {al}
                  </label>
                ))}
              </div>
            </div>

            {/* Disponibilidade */}
            <div style={{ display: 'flex', gap: 20 }}>
              {[
                { key: 'disponivel_presencial', label: 'Disponível no PDV (presencial)' },
                { key: 'disponivel_online', label: 'Disponível online' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={form[key as keyof FormState] as boolean}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>

            {msg && <div style={{ fontSize: 13, fontWeight: 600, color: msg.startsWith('✅') ? '#065f46' : '#991b1b' }}>{msg}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={pending} style={{
                padding: '10px 20px', borderRadius: 'var(--r-md)',
                background: 'var(--brand)', color: '#fff', border: 'none',
                fontSize: 13, fontWeight: 800, cursor: pending ? 'not-allowed' : 'pointer',
              }}>
                {pending ? 'Salvando…' : 'Salvar'}
              </button>
              <button type="button" onClick={() => setFormAberto(false)} style={{
                padding: '10px 20px', borderRadius: 'var(--r-md)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de produtos */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
      }}>
        {produtos.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🍽️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>Nenhum produto cadastrado</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Clique em "Novo produto" para começar.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Produto', 'Categoria', 'Preço', 'Disponível', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {produtos.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: i < produtos.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{p.icone ?? '🍽️'}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{p.nome}</div>
                        {p.alergenos && p.alergenos.length > 0 && (
                          <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>⚠️ {p.alergenos.join(', ')}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-2)', textTransform: 'capitalize' }}>{p.categoria}</td>
                  <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>{fmtMoeda(p.preco)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-3)' }}>
                    {p.disponivel_presencial && '🏪 '}{p.disponivel_online && '📱'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: 'var(--r-pill)', fontSize: 11, fontWeight: 700,
                      background: p.ativo ? 'var(--success-light)' : 'var(--danger-light)',
                      color: p.ativo ? '#065f46' : '#991b1b',
                    }}>
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => abrirEditar(p)} style={{
                        padding: '6px 10px', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 700,
                        background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-2)',
                      }}>✏️ Editar</button>
                      <button onClick={() => handleToggle(p)} disabled={pending} style={{
                        padding: '6px 10px', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 700,
                        background: p.ativo ? 'var(--danger-light)' : 'var(--success-light)',
                        border: 'none', cursor: 'pointer',
                        color: p.ativo ? '#991b1b' : '#065f46',
                      }}>
                        {p.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
