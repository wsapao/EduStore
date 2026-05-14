'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  listarAuditoriaAction,
  exportarAuditoriaCsvAction,
  type AuditEntry,
  type AuditFiltro,
} from '@/app/actions/configuracoes/auditoria'
import { AuditoriaFilters } from './AuditoriaFilters'
import { AuditoriaTable } from './AuditoriaTable'

export function AuditoriaView({
  initialEntries,
  initialError,
}: {
  initialEntries: AuditEntry[]
  initialError: string | null
}) {
  const [entries, setEntries] = useState<AuditEntry[]>(initialEntries)
  const [erro, setErro] = useState<string | null>(initialError)
  const [filtro, setFiltro] = useState<AuditFiltro>({})
  const [busca, setBusca] = useState('')
  const [pending, startTransition] = useTransition()
  const [exporting, startExport] = useTransition()

  function aplicar(novoFiltro: AuditFiltro) {
    setFiltro(novoFiltro)
    setErro(null)
    startTransition(async () => {
      const r = await listarAuditoriaAction(novoFiltro)
      if ('error' in r) {
        setErro(r.error)
        setEntries([])
      } else {
        setEntries(r.entries)
      }
    })
  }

  function exportar() {
    setErro(null)
    startExport(async () => {
      const r = await exportarAuditoriaCsvAction(filtro)
      if ('error' in r) {
        setErro(r.error)
        return
      }
      const blob = new Blob([r.csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = r.filename
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const filtradas = useMemo(() => {
    if (!busca.trim()) return entries
    const q = busca.trim().toLowerCase()
    return entries.filter((e) => {
      const blob = [
        e.modulo,
        e.acao,
        e.descricao,
        e.user_email,
        e.ip,
        JSON.stringify(e.metadata ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [entries, busca])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AuditoriaFilters
        busca={busca}
        onBuscaChange={setBusca}
        onAplicar={aplicar}
        onExportar={exportar}
        loading={pending}
        exporting={exporting}
      />

      {erro && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(239,68,68,.12)',
            border: '1px solid rgba(239,68,68,.4)',
            borderRadius: 8,
            color: '#fecaca',
            fontSize: 13,
          }}
        >
          {erro}
        </div>
      )}

      <AuditoriaTable entries={filtradas} loading={pending} />

      <div style={{ fontSize: 12, color: '#94a3b8' }}>
        Exibindo {filtradas.length} de {entries.length} registros{' '}
        (limite de 100 por consulta — refine os filtros para ver eventos mais antigos).
      </div>
    </div>
  )
}
