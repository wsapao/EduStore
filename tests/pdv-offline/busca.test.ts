import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { getDb, resetDbForTests } from '@/lib/pdv-offline/db'
import { buscarAlunoLocal, contarAlunosLocais } from '@/lib/pdv-offline/busca'

async function clearDb() {
  resetDbForTests()
  const db = getDb()
  await db.alunos.clear()
  await db.carteiras.clear()
  await db.produtos.clear()
  await db.restricoes.clear()
  await db.meta.clear()
}

async function seedBasico() {
  const db = getDb()
  await db.alunos.bulkPut([
    { id: 'a1', nome: 'Ana Beatriz',  serie: '5', turma: 'A', escola_id: 'esc-1', ativo: true },
    { id: 'a2', nome: 'Bruno Alves',  serie: '6', turma: 'B', escola_id: 'esc-1', ativo: true },
    { id: 'a3', nome: 'Carla Souza',  serie: '7', turma: 'C', escola_id: 'esc-1', ativo: true },
    // Aluno sem carteira — deve ser ignorado.
    { id: 'a4', nome: 'Daniel Sem Carteira', serie: '8', turma: 'D', escola_id: 'esc-1', ativo: true },
  ])
  await db.carteiras.bulkPut([
    { id: 'c1', aluno_id: 'a1', escola_id: 'esc-1', saldo: 50, limite_diario: 20, ativo: true,  bloqueio_motivo: null },
    { id: 'c2', aluno_id: 'a2', escola_id: 'esc-1', saldo: 10, limite_diario: null, ativo: false, bloqueio_motivo: 'inadimplente' },
    { id: 'c3', aluno_id: 'a3', escola_id: 'esc-1', saldo: 0,  limite_diario: 30, ativo: true,  bloqueio_motivo: null },
  ])
  await db.restricoes.bulkPut([
    { aluno_id: 'a1', produto_id: 'p1', motivo: 'alergia' },
    { aluno_id: 'a1', produto_id: 'p2', motivo: null },
  ])
}

describe('buscarAlunoLocal', () => {
  beforeEach(async () => {
    await clearDb()
  })

  afterEach(async () => {
    await clearDb()
  })

  it('retorna vazio se termo tem menos de 2 caracteres', async () => {
    await seedBasico()
    expect(await buscarAlunoLocal('')).toEqual([])
    expect(await buscarAlunoLocal('a')).toEqual([])
    expect(await buscarAlunoLocal('  ')).toEqual([])
  })

  it('faz match case-insensitive por substring', async () => {
    await seedBasico()
    const r1 = await buscarAlunoLocal('ana')
    expect(r1.map((a) => a.id)).toEqual(['a1'])

    const r2 = await buscarAlunoLocal('ANA')
    expect(r2.map((a) => a.id)).toEqual(['a1'])

    const r3 = await buscarAlunoLocal('Alv')
    expect(r3.map((a) => a.id)).toEqual(['a2'])

    const r4 = await buscarAlunoLocal('souza')
    expect(r4.map((a) => a.id)).toEqual(['a3'])
  })

  it('junta carteira e restrições corretamente', async () => {
    await seedBasico()
    const [aluno] = await buscarAlunoLocal('ana')
    expect(aluno).toMatchObject({
      id: 'a1',
      nome: 'Ana Beatriz',
      serie: '5',
      carteira: {
        id: 'c1',
        saldo: 50,
        limite_diario: 20,
        ativo: true,
        bloqueio_motivo: null,
      },
      gastoHoje: 0,
    })
    expect(aluno.restricoes).toHaveLength(2)
    expect(aluno.restricoes.map((r) => r.produto_id).sort()).toEqual(['p1', 'p2'])
    // categoria sempre null no shape offline.
    expect(aluno.restricoes.every((r) => r.categoria === null)).toBe(true)
  })

  it('reflete bloqueio_motivo quando carteira está bloqueada', async () => {
    await seedBasico()
    const [aluno] = await buscarAlunoLocal('bruno')
    expect(aluno.carteira.ativo).toBe(false)
    expect(aluno.carteira.bloqueio_motivo).toBe('inadimplente')
  })

  it('ignora aluno sem carteira', async () => {
    await seedBasico()
    const r = await buscarAlunoLocal('daniel')
    expect(r).toEqual([])
  })

  it('respeita limite MAX_RESULTADOS (10)', async () => {
    const db = getDb()
    // Cria 15 alunos com "Teste" no nome + 15 carteiras.
    const alunos = Array.from({ length: 15 }, (_, i) => ({
      id: `t${i}`,
      nome: `Teste ${i}`,
      serie: '5',
      turma: 'A',
      escola_id: 'esc-1',
      ativo: true,
    }))
    const carteiras = Array.from({ length: 15 }, (_, i) => ({
      id: `ct${i}`,
      aluno_id: `t${i}`,
      escola_id: 'esc-1',
      saldo: 10,
      limite_diario: null,
      ativo: true,
      bloqueio_motivo: null,
    }))
    await db.alunos.bulkPut(alunos)
    await db.carteiras.bulkPut(carteiras)

    const r = await buscarAlunoLocal('teste')
    expect(r.length).toBeLessThanOrEqual(10)
    expect(r.length).toBe(10)
  })

  it('retorna vazio quando IDB está vazia', async () => {
    expect(await buscarAlunoLocal('qualquer')).toEqual([])
  })
})

describe('contarAlunosLocais', () => {
  beforeEach(async () => {
    await clearDb()
  })

  afterEach(async () => {
    await clearDb()
  })

  it('retorna 0 com IDB vazia', async () => {
    expect(await contarAlunosLocais()).toBe(0)
  })

  it('reflete contagem real após inserts', async () => {
    await seedBasico()
    // seedBasico insere 4 alunos.
    expect(await contarAlunosLocais()).toBe(4)
  })
})
