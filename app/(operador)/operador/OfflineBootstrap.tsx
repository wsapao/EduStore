'use client'

/**
 * Bootstrap inicial do PDV Offline-First (Fase 1).
 *
 * Na primeira visita:
 *  - Registra o service worker (prod only, helper já gateia).
 *  - Se a IDB local está vazia, mostra overlay "sincronizando" e
 *    dispara `pullSnapshot()` antes de liberar a tela.
 *  - Inicia o loop em background pra atualizar a cada 60s.
 *
 * Em sessões subsequentes (IDB já populada) o componente é invisível
 * — só liga o background sync e some.
 */
import { useEffect, useState } from 'react'
import { contarAlunosLocais } from '@/lib/pdv-offline/busca'
import { pullSnapshot, startBackgroundSync } from '@/lib/pdv-offline/sync'
import { registerPdvServiceWorker } from '@/lib/pdv-offline/sw-register'

type EstadoBootstrap = 'verificando' | 'baixando' | 'pronto' | 'erro'

// Tempo máximo que o overlay de bootstrap fica esperando o pull inicial.
// Sem timeout, uma rede pendurada (ex.: captive portal) deixava o operador
// preso na tela "Sincronizando…" sem botão de retry.
const BOOTSTRAP_TIMEOUT_MS = 30_000

async function pullComTimeout() {
  return Promise.race([
    pullSnapshot(),
    new Promise<{ ok: false; error: string }>((resolve) =>
      setTimeout(
        () => resolve({ ok: false, error: 'Tempo esgotado (30s). Verifique sua conexão.' }),
        BOOTSTRAP_TIMEOUT_MS,
      ),
    ),
  ])
}

export function OfflineBootstrap() {
  const [estado, setEstado] = useState<EstadoBootstrap>('verificando')
  const [mensagem, setMensagem] = useState('Verificando dados locais…')

  useEffect(() => {
    let stop: (() => void) | null = null
    let cancelled = false

    async function init() {
      // Registra SW. Helper já gateia por NODE_ENV — em dev não faz nada.
      void registerPdvServiceWorker({
        onUpdate: () => console.info('[PDV] Nova versão disponível — recarregue a página'),
      })

      const count = await contarAlunosLocais()
      if (cancelled) return

      if (count === 0) {
        setEstado('baixando')
        setMensagem('Sincronizando dados para uso offline (pode levar alguns segundos)…')
        const res = await pullComTimeout()
        if (cancelled) return
        if (!res.ok) {
          setEstado('erro')
          setMensagem(`Erro ao sincronizar: ${res.error}`)
          return
        }
        setMensagem(`Pronto! ${res.counts.alunos} alunos baixados.`)
      }

      setEstado('pronto')
      stop = startBackgroundSync({ intervalMs: 60_000 })
    }

    void init()
    return () => { cancelled = true; stop?.() }
  }, [])

  // 'verificando' é tipicamente instantâneo (count na IDB local); renderizar
  // overlay nele causaria flash visual. Só mostramos overlay quando há
  // trabalho real ('baixando') ou quando algo deu errado ('erro').
  if (estado === 'pronto' || estado === 'verificando') return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, color: 'white', textAlign: 'center', padding: 24,
    }}>
      <div>
        <div style={{ fontSize: 56, marginBottom: 16 }}>
          {estado === 'erro' ? '⚠️' : '🔄'}
        </div>
        <div style={{ fontSize: 18, maxWidth: 420 }}>{mensagem}</div>
        {estado === 'erro' && (
          <button
            onClick={() => location.reload()}
            style={{
              marginTop: 16, padding: '10px 18px', borderRadius: 8,
              background: 'white', color: '#0f172a', border: 'none',
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  )
}
