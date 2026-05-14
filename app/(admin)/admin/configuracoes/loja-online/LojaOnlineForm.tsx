'use client'

import { useState, useTransition } from 'react'

import { atualizarLojaOnlineAction } from '@/app/actions/configuracoes/loja-online'
import type { EscolaConfiguracoes, LojaFuncionamentoSlot } from '@/types/database'

type CategoriaOption = {
  id: string
  nome: string
  icone: string
  ativo: boolean
}

type ProdutoOption = {
  id: string
  nome: string
  categoria: string
  ativo: boolean
}

const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
]

export function LojaOnlineForm({
  config,
  categorias,
  produtos,
}: {
  config: EscolaConfiguracoes
  categorias: CategoriaOption[]
  produtos: ProdutoOption[]
}) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [modoManutencao, setModoManutencao] = useState(config.modo_manutencao)
  const [layoutHome, setLayoutHome] = useState<'grid' | 'lista'>(config.layout_home)
  const [mostrarEstoqueBaixo, setMostrarEstoqueBaixo] = useState(config.mostrar_estoque_baixo)
  const [lojaFuncionamento, setLojaFuncionamento] = useState<LojaFuncionamentoSlot[]>(
    config.loja_funcionamento ?? [],
  )
  const [usarCategoriasAutomáticas, setUsarCategoriasAutomáticas] = useState(
    config.categorias_home_visiveis === null,
  )
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>(
    config.categorias_home_visiveis ?? [],
  )
  const [produtosDestaque, setProdutosDestaque] = useState<string[]>(
    config.produtos_home_destaque ?? [],
  )

  async function onSubmit(formData: FormData) {
    setMsg(null)

    formData.set('loja_funcionamento', JSON.stringify(lojaFuncionamento))
    if (usarCategoriasAutomáticas) {
      formData.delete('categorias_home_visiveis')
    } else {
      formData.delete('categorias_home_visiveis')
      categoriasSelecionadas.forEach((categoria) => {
        formData.append('categorias_home_visiveis', categoria)
      })
    }

    formData.delete('produtos_home_destaque')
    produtosDestaque.forEach((produtoId) => {
      formData.append('produtos_home_destaque', produtoId)
    })

    startTransition(async () => {
      const result = await atualizarLojaOnlineAction(formData)
      if ('error' in result && result.error) {
        setMsg({ tipo: 'erro', texto: result.error })
        return
      }

      setMsg({ tipo: 'ok', texto: 'Configurações salvas!' })
    })
  }

  function addSlot() {
    setLojaFuncionamento((current) => [
      ...current,
      { dia: 1, inicio: '07:00', fim: '18:00' },
    ])
  }

  function updateSlot(index: number, patch: Partial<LojaFuncionamentoSlot>) {
    setLojaFuncionamento((current) =>
      current.map((slot, slotIndex) => (
        slotIndex === index ? { ...slot, ...patch } : slot
      )),
    )
  }

  function removeSlot(index: number) {
    setLojaFuncionamento((current) => current.filter((_, slotIndex) => slotIndex !== index))
  }

  function toggleCategoria(nome: string) {
    setUsarCategoriasAutomáticas(false)
    setCategoriasSelecionadas((current) => (
      current.includes(nome)
        ? current.filter((item) => item !== nome)
        : [...current, nome]
    ))
  }

  function moveCategoria(nome: string, direction: -1 | 1) {
    setCategoriasSelecionadas((current) => moveItem(current, nome, direction))
  }

  function addProdutoDestaque(id: string) {
    setProdutosDestaque((current) => {
      if (current.includes(id) || current.length >= 6) return current
      return [...current, id]
    })
  }

  function removeProdutoDestaque(id: string) {
    setProdutosDestaque((current) => current.filter((item) => item !== id))
  }

  function moveProdutoDestaque(id: string, direction: -1 | 1) {
    setProdutosDestaque((current) => moveItem(current, id, direction))
  }

  const produtosSelecionados = produtosDestaque
    .map((id) => produtos.find((produto) => produto.id === id))
    .filter((produto): produto is ProdutoOption => Boolean(produto))

  return (
    <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <input type="hidden" name="loja_funcionamento" value={JSON.stringify(lojaFuncionamento)} />

      <Section
        title="Modo manutenção"
        description="Feche a loja temporariamente sem derrubar o restante da operação."
      >
        <ToggleRow
          checked={modoManutencao}
          label="Loja em manutenção"
          onChange={setModoManutencao}
          name="modo_manutencao"
        />

        <Field label="Mensagem exibida ao responsavel">
          <textarea
            name="modo_manutencao_mensagem"
            rows={3}
            placeholder="Estamos atualizando a loja. Tente novamente em breve."
            defaultValue={config.modo_manutencao_mensagem ?? ''}
            style={textareaStyle}
          />
        </Field>
      </Section>

      <Section
        title="Horário de funcionamento"
        description="Deixe sem horários para manter a loja aberta 24h."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lojaFuncionamento.length === 0 ? (
            <div style={hintBoxStyle}>
              Nenhum horário configurado. A loja ficara aberta 24 horas por dia.
            </div>
          ) : (
            lojaFuncionamento.map((slot, index) => (
              <div key={`${slot.dia}-${slot.inicio}-${slot.fim}-${index}`} style={slotRowStyle}>
                <select
                  value={String(slot.dia)}
                  onChange={(event) => updateSlot(index, { dia: Number(event.target.value) })}
                  style={selectStyle}
                >
                  {DIAS_SEMANA.map((dia) => (
                    <option key={dia.value} value={dia.value}>{dia.label}</option>
                  ))}
                </select>

                <input
                  type="time"
                  value={slot.inicio}
                  onChange={(event) => updateSlot(index, { inicio: event.target.value })}
                  style={inputStyle}
                />

                <input
                  type="time"
                  value={slot.fim}
                  onChange={(event) => updateSlot(index, { fim: event.target.value })}
                  style={inputStyle}
                />

                <button type="button" onClick={() => removeSlot(index)} style={btnGhost}>
                  Remover
                </button>
              </div>
            ))
          )}

          <button type="button" onClick={addSlot} style={btnSecondary}>
            Adicionar janela
          </button>
        </div>
      </Section>

      <Section
        title="Layout e apresentacao"
        description="Controle como a home publica apresenta o catalogo."
      >
        <Field label="Layout da home">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <RadioCard
              checked={layoutHome === 'grid'}
              label="Grid"
              description="Cards lado a lado quando houver espaco."
              name="layout_home"
              value="grid"
              onChange={setLayoutHome}
            />
            <RadioCard
              checked={layoutHome === 'lista'}
              label="Lista"
              description="Cards empilhados como na home atual."
              name="layout_home"
              value="lista"
              onChange={setLayoutHome}
            />
          </div>
        </Field>

        <ToggleRow
          checked={mostrarEstoqueBaixo}
          label="Mostrar aviso de estoque baixo / vagas limitadas"
          onChange={setMostrarEstoqueBaixo}
          name="mostrar_estoque_baixo"
        />

        <Field label="Texto do rodape">
          <textarea
            name="texto_rodape"
            rows={3}
            placeholder="Secretaria: (81) 0000-0000 · atendimento@escola.com"
            defaultValue={config.texto_rodape ?? ''}
            style={textareaStyle}
          />
        </Field>
      </Section>

      <Section
        title="Categorias visíveis na home"
        description="Escolha entre usar todas automáticamente ou definir uma ordem customizada."
      >
        <ToggleRow
          checked={usarCategoriasAutomáticas}
          label="Usar todas as categorias publicadas automáticamente"
          onChange={setUsarCategoriasAutomáticas}
        />

        {!usarCategoriasAutomáticas && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {categorias.map((categoria) => {
              const isSelected = categoriasSelecionadas.includes(categoria.nome)
              const index = categoriasSelecionadas.indexOf(categoria.nome)

              return (
                <div key={categoria.id} style={listRowStyle}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCategoria(categoria.nome)}
                      style={checkboxStyle}
                    />
                    <span style={{ fontSize: 16 }}>{categoria.icone || '📦'}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700 }}>{categoria.nome}</span>
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>
                        {isSelected ? `Posicao ${index + 1} na home` : 'Oculta na home'}
                      </span>
                    </div>
                  </label>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      disabled={!isSelected || index <= 0}
                      onClick={() => moveCategoria(categoria.nome, -1)}
                      style={btnMini}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={!isSelected || index === -1 || index >= categoriasSelecionadas.length - 1}
                      onClick={() => moveCategoria(categoria.nome, 1)}
                      style={btnMini}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      <Section
        title="Produtos em destaque"
        description="Selecione ate 6 itens para ganhar uma faixa propria na home."
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={hintBoxStyle}>
            Selecionados: {produtosSelecionados.length} / 6
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {produtosSelecionados.length === 0 ? (
              <div style={hintBoxStyle}>Nenhum produto em destaque no momento.</div>
            ) : (
              produtosSelecionados.map((produto, index) => (
                <div key={produto.id} style={listRowStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                    <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700 }}>{produto.nome}</span>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>
                      {produto.categoria} · posicao {index + 1}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      disabled={index <= 0}
                      onClick={() => moveProdutoDestaque(produto.id, -1)}
                      style={btnMini}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index >= produtosSelecionados.length - 1}
                      onClick={() => moveProdutoDestaque(produto.id, 1)}
                      style={btnMini}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeProdutoDestaque(produto.id)}
                      style={btnGhost}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {produtos.map((produto) => {
              const selected = produtosDestaque.includes(produto.id)
              return (
                <div key={produto.id} style={listRowStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                    <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700 }}>{produto.nome}</span>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>{produto.categoria}</span>
                  </div>

                  <button
                    type="button"
                    disabled={selected || produtosDestaque.length >= 6}
                    onClick={() => addProdutoDestaque(produto.id)}
                    style={btnSecondary}
                  >
                    {selected ? 'Ja selecionado' : 'Adicionar'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" disabled={pending} style={btnPrimary}>
          {pending ? 'Salvando...' : 'Salvar configuracoes'}
        </button>
        {msg && (
          <span style={{ fontSize: 13, color: msg.tipo === 'ok' ? '#22c55e' : '#ef4444' }}>
            {msg.texto}
          </span>
        )}
      </div>
    </form>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', margin: 0 }}>{title}</h3>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{description}</p>
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>{label}</span>
      {children}
    </label>
  )
}

function ToggleRow({
  checked,
  label,
  onChange,
  name,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
  name?: string
}) {
  return (
    <label style={toggleRowStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700 }}>{label}</span>
      </div>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={checkboxStyle}
      />
    </label>
  )
}

function RadioCard({
  checked,
  label,
  description,
  name,
  value,
  onChange,
}: {
  checked: boolean
  label: string
  description: string
  name: string
  value: 'grid' | 'lista'
  onChange: (value: 'grid' | 'lista') => void
}) {
  return (
    <label style={{
      ...radioCardStyle,
      borderColor: checked ? 'rgba(245,158,11,0.9)' : 'rgba(255,255,255,0.1)',
      background: checked ? 'rgba(245,158,11,0.12)' : 'rgba(0,0,0,0.18)',
    }}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        style={checkboxStyle}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700 }}>{label}</span>
        <span style={{ color: '#94a3b8', fontSize: 11 }}>{description}</span>
      </div>
    </label>
  )
}

function moveItem(items: string[], id: string, direction: -1 | 1) {
  const index = items.indexOf(id)
  if (index === -1) return items

  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= items.length) return items

  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(nextIndex, 0, item)
  return next
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#f8fafc',
  fontSize: 14,
  outline: 'none',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  minWidth: 140,
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: 'inherit',
  resize: 'vertical',
}

const btnPrimary: React.CSSProperties = {
  background: '#f59e0b',
  border: 'none',
  borderRadius: 10,
  padding: '10px 18px',
  color: '#0a1628',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '8px 14px',
  color: '#f8fafc',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '8px 12px',
  color: '#cbd5e1',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

const btnMini: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  width: 36,
  height: 36,
  color: '#f8fafc',
  fontSize: 14,
  fontWeight: 800,
  cursor: 'pointer',
}

const checkboxStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  cursor: 'pointer',
  accentColor: '#f59e0b',
}

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  background: 'rgba(0,0,0,0.18)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: '12px 14px',
}

const hintBoxStyle: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(0,0,0,0.18)',
  color: '#94a3b8',
  fontSize: 12,
  padding: '12px 14px',
}

const slotRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const listRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(0,0,0,0.18)',
  borderRadius: 12,
  padding: '12px 14px',
}

const radioCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: '12px 14px',
  flex: '1 1 240px',
}
