'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { configurarCarteiraAction, adicionarRestricaoAction, removerRestricaoAction } from '@/app/actions/cantina'

interface ProdutoRestrito {
  id: string
  nome: string
  categoria: string
}

interface Restricao {
  id: string
  produto_id: string | null
  categoria: string | null
  motivo: string | null
}

interface Props {
  alunoId: string
  alunoNome: string
  limiteDiario: number | null
  ativo: boolean
  bloqueioMotivo: string | null
  hasPin: boolean
  restricoes: Restricao[]
  produtos: ProdutoRestrito[]
}

export function ConfigurarClient({ alunoId, alunoNome, limiteDiario, ativo, bloqueioMotivo, hasPin, restricoes, produtos }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  
  // Limites e bloqueio total
  const [limite, setLimite] = useState<string>(limiteDiario != null ? String(limiteDiario) : '')
  const [semLimite, setSemLimite] = useState(limiteDiario == null)
  const [bloqueada, setBloqueada] = useState(!ativo)
  const [motivo, setMotivo] = useState(bloqueioMotivo ?? '')
  
  // PIN de Segurança
  const [pinEnabled, setPinEnabled] = useState(hasPin)
  const [pin, setPin] = useState('')
  
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Gestão Nutricional
  const [produtoIdBlock, setProdutoIdBlock] = useState('')
  const [motivoBlock, setMotivoBlock] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)

    const limiteFinal = semLimite ? null : parseFloat(limite.replace(',', '.'))
    if (!semLimite && (isNaN(limiteFinal!) || limiteFinal! <= 0)) {
      setMsg({ type: 'error', text: 'Digite um limite diário válido (maior que zero).' })
      return
    }
    const bloqueioFinal = bloqueada ? (motivo.trim() || 'Bloqueado pelo responsável') : null
    
    // Validar PIN se habilitado
    if (pinEnabled && pin.length > 0 && pin.length !== 4) {
      setMsg({ type: 'error', text: 'O PIN deve conter exatamente 4 dígitos.' })
      return
    }

    startTransition(async () => {
      // Se pinEnabled é falso, envia null para remover o PIN.
      // Se pinEnabled é true, só envia a nova string 'pin' se o pai digitou um novo PIN (length === 4).
      // Se o pai não digitou nada, enviamos undefined para não alterar o PIN atual no banco.
      let finalPin: string | null | undefined = undefined
      if (!pinEnabled) finalPin = null
      else if (pin.length === 4) finalPin = pin

      const res = await configurarCarteiraAction(alunoId, limiteFinal ?? null, bloqueioFinal, finalPin)
      if (res.error) {
        setMsg({ type: 'error', text: res.error })
      } else {
        setMsg({ type: 'success', text: 'Configurações salvas!' })
        setTimeout(() => router.push('/cantina'), 1200)
      }
    })
  }

  function handleAddBlock(e: React.FormEvent) {
    e.preventDefault()
    if (!produtoIdBlock) return
    startTransition(async () => {
      const res = await adicionarRestricaoAction(alunoId, produtoIdBlock, null, motivoBlock.trim() || null)
      if (res.error) {
        setMsg({ type: 'error', text: res.error })
      } else {
        setProdutoIdBlock('')
        setMotivoBlock('')
      }
    })
  }

  function handleRemoveBlock(restricaoId: string) {
    if (!confirm('Deseja remover este bloqueio?')) return
    startTransition(async () => {
      const res = await removerRestricaoAction(restricaoId, alunoId)
      if (res.error) {
        setMsg({ type: 'error', text: res.error })
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Formulário Principal: Limites e Bloqueio da Carteira */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Limite diário */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', padding: '20px', boxShadow: 'var(--shadow-xs)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>
            💳 Limite diário de gasto
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
            Define quanto {alunoNome.split(' ')[0]} pode gastar por dia na cantina.
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={semLimite}
              onChange={e => setSemLimite(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
              Sem limite diário
            </span>
          </label>

          {!semLimite && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>R$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="Ex: 20,00"
                value={limite}
                onChange={e => setLimite(e.target.value)}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 'var(--r-md)',
                  border: '1.5px solid var(--border)', fontSize: 15, fontWeight: 700,
                  outline: 'none', maxWidth: 160,
                }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>por dia</span>
            </div>
          )}
        </div>

        {/* PIN de Segurança */}
        <div style={{
          background: 'var(--surface)', border: `1.5px solid ${pinEnabled ? 'var(--brand)' : 'var(--border)'}`,
          borderRadius: 'var(--r-lg)', padding: '20px', boxShadow: 'var(--shadow-xs)',
          transition: 'border-color .2s',
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>
            🔒 PIN de Segurança (Maquininha)
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
            Exige uma senha de 4 dígitos na hora de comprar presencialmente na escola.
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={pinEnabled}
              onChange={e => setPinEnabled(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
              Proteger compras com senha
            </span>
          </label>

          {pinEnabled && (
            <div>
              {hasPin && (
                <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>
                  ✅ Senha já configurada. Preencha abaixo apenas se quiser alterar:
                </div>
              )}
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="Senha de 4 dígitos"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                style={{
                  width: '100%', padding: '10px 12px', letterSpacing: '0.5em', textAlign: 'center',
                  borderRadius: 'var(--r-md)', border: '1.5px solid var(--border)',
                  fontSize: 20, fontWeight: 800, outline: 'none', maxWidth: 200,
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                Apenas números (0-9).
              </div>
            </div>
          )}
        </div>

        {/* Bloquear carteira */}
        <div style={{
          background: 'var(--surface)', border: `1.5px solid ${bloqueada ? 'var(--danger)' : 'var(--border)'}`,
          borderRadius: 'var(--r-lg)', padding: '20px', boxShadow: 'var(--shadow-xs)',
          transition: 'border-color .2s',
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>
            🔒 Bloqueio Total da Carteira
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
            Impede qualquer compra enquanto estiver bloqueada.
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={bloqueada}
              onChange={e => setBloqueada(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: bloqueada ? 'var(--danger)' : 'var(--text-2)' }}>
              Carteira bloqueada
            </span>
          </label>

          {bloqueada && (
            <input
              type="text"
              placeholder="Motivo (opcional, ex: férias)"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              maxLength={100}
              style={{
                width: '100%', padding: '10px 12px',
                borderRadius: 'var(--r-md)', border: '1.5px solid var(--danger)',
                fontSize: 13, outline: 'none',
              }}
            />
          )}
        </div>

        {/* Feedback Principal */}
        {msg && (
          <div style={{
            padding: '12px 16px', borderRadius: 'var(--r-md)',
            background: msg.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            color: msg.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: 13, fontWeight: 600,
          }}>
            {msg.type === 'success' ? '✅' : '❌'} {msg.text}
          </div>
        )}

        {/* Botões do Formulário Principal */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" disabled={pending} style={{
            flex: 1, padding: '13px', borderRadius: 'var(--r-md)',
            background: pending ? 'var(--border)' : 'var(--brand)',
            color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer',
            fontSize: 14, fontWeight: 800,
            transition: 'all .2s',
          }}>
            {pending ? 'Salvando…' : 'Salvar limites e bloqueio'}
          </button>
          <button type="button" onClick={() => router.push('/cantina')} style={{
            padding: '13px 20px', borderRadius: 'var(--r-md)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text-2)', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}>
            Voltar
          </button>
        </div>
      </form>

      {/* Seção Separada: Gestão Nutricional (Bloqueio por Produto) */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', padding: '20px', boxShadow: 'var(--shadow-xs)',
        marginTop: 10,
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>
          🚫 Gestão Nutricional
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
          Bloqueie a compra de produtos específicos na cantina.
        </div>

        {/* Lista de bloqueios atuais */}
        {restricoes.length > 0 && (
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)' }}>
              Produtos Bloqueados:
            </div>
            {restricoes.map(r => {
              const p = produtos.find(x => x.id === r.produto_id)
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: 'var(--surface-2)',
                  borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
                      {p?.nome ?? 'Produto Desconhecido'}
                    </div>
                    {r.motivo && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.motivo}</div>}
                  </div>
                  <button onClick={() => handleRemoveBlock(r.id)} disabled={pending} style={{
                    background: 'none', border: 'none', color: 'var(--danger)',
                    cursor: pending ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
                    padding: '4px 8px'
                  }}>
                    Remover
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Adicionar novo bloqueio */}
        <form onSubmit={handleAddBlock} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', border: '1px dashed var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>Adicionar Novo Bloqueio</div>
          <select 
            value={produtoIdBlock} 
            onChange={e => setProdutoIdBlock(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', fontSize: 13 }}
            required
          >
            <option value="">Selecione o produto...</option>
            {produtos.filter(p => !restricoes.some(r => r.produto_id === p.id)).map(p => (
              <option key={p.id} value={p.id}>{p.nome} ({p.categoria})</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Motivo (ex: intolerância à lactose)"
            value={motivoBlock}
            onChange={e => setMotivoBlock(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', fontSize: 13 }}
          />
          <button type="submit" disabled={pending || !produtoIdBlock} style={{
            padding: '10px', borderRadius: 'var(--r-md)',
            background: 'var(--text-1)', color: 'var(--surface)',
            border: 'none', cursor: (pending || !produtoIdBlock) ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 700,
          }}>
            {pending ? 'Adicionando...' : 'Bloquear Produto'}
          </button>
        </form>
      </div>
    </div>
  )
}
