// Adapter para a SigaWeb API (ActiveSoft).
// Centraliza todas as chamadas ao ERP escolar — quando trocarmos de fornecedor
// ou o ActiveSoft mudar contrato, alteramos só este arquivo.
//
// Endpoint base e versão: https://siga02.activesoft.com.br/api/v0/...
// Auth: header `Authorization: Bearer <token>` (token amarrado à instituição).

const BASE_URL = process.env.ACTIVESOFT_BASE_URL || 'https://siga02.activesoft.com.br/api/v0';
const TOKEN = process.env.ACTIVESOFT_TOKEN || '';

export class ActiveSoftAuthError extends Error {
  constructor() {
    super('ACTIVESOFT_TOKEN não configurado ou inválido. Sem token, a integração com o SIGA não pode operar.');
    this.name = 'ActiveSoftAuthError';
  }
}

export class ActiveSoftHttpError extends Error {
  constructor(public readonly status: number, public readonly body: unknown, endpoint: string) {
    super(`SigaWeb ${endpoint} respondeu ${status}`);
    this.name = 'ActiveSoftHttpError';
  }
}

async function request<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  if (!TOKEN) throw new ActiveSoftAuthError();

  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/json',
    },
  });

  if (res.status === 401) throw new ActiveSoftAuthError();
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ActiveSoftHttpError(res.status, body, path);
  }
  return res.json() as Promise<T>;
}

// ============================================================================
// Tipos — formato de retorno real conforme inspeção em 2026-04-27.
// ============================================================================

export type Aluno = {
  id: number;
  matricula?: string;
  nome: string;
  cpf?: string;
  sexo?: string;
  data_nascimento?: string;
  celular?: string | null;
  email?: string | null;
  responsavel_id?: number | null;
  responsavel_secundario_id?: number | null;
  filiacao_1_id?: number | null;
  filiacao_2_id?: number | null;
  unidade_id?: number;
  id_turmas?: number[];
};

export type AlunoSensivel = Aluno & {
  nome_civil?: string | null;
  rg?: string | null;
  rg_orgao_emissao?: string | null;
  rg_orgao_emissao_uf?: string | null;
  naturalidade_cidade?: string;
  naturalidade_uf?: string;
  nacionalidade?: string;
  mae_id?: number | null;
  pai_id?: number | null;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
};

export type Responsavel = {
  id: number;
  login?: string;
  cpf_cnpj?: string | null;
  nome: string;
  data_nascimento?: string | null;
  sexo?: string | null;
  celular?: string | null;
  email?: string | null;
  unidade_id?: number;
};

export type Turma = {
  id: number;
  serie_id: number;
  curso_nome: string;
  curso_id: number;
  serie_nome: string;
  serie_codigo?: string;
  nome: string;
  turno: string;          // "Manhã" | "Tarde" | "Integral" | "Noite"
  unidade: string;
  unidade_id: number;
  sigla_periodo: string;  // "2026  "
};

export type FrequenciaMarcacao = {
  aluno_id: number;
  data_hora: string;
  tipo: 'E' | 'S';
};

export type Diario = {
  id: number;
  descricao: string;
  turma: number;
  disciplina: number;
  nome_disciplina: string;
  fase_nota: number;            // ID da fase (trimestre)
  nome_fase: string;            // "1º TRIMESTRE", "RECUPERAÇÃO 1º TRIMESTRE"
  qtde_maxima_aulas: number;
  qtde_minima_aulas: number;
  data_inicial_periodo_aula: string | null;
  data_final_periodo_aula: string | null;
  qtde_aulas_registradas: number;
};

/** Linha do diário com slots presenca_falta_01..60 — "P", "F" ou null. */
export type DiarioFrequenciaLinha = {
  matricula: string;
  diario: number;
} & { [k: `presenca_falta_${string}`]: 'P' | 'F' | null };

export type Boleto = {
  titulo: number;                     // ID do título
  dt_vencimento: string;
  dt_pagamento?: string | null;
  dt_documento?: string;
  valor_documento: number;            // valor nominal
  valor_recebido_total?: number;
  valor_recebido_multa?: number;
  valor_recebido_juros?: number;
  situacao_titulo: string;            // "LIQ" liquidado | "ABE" aberto | "VEN" vencido | etc
  situacao_no_agente?: string;
  parcela_cobranca?: string;          // "01/12 "
  nome_servico?: string;              // "Mens Ensino Fundamental/1º Ano M (01/12)"
  pagador?: string;                   // "NOME (CPF)"
  pagador_endereco?: string;
  aluno?: string;
  aluno_matricula?: string;
  turma?: string;
  beneficiario?: string;
  link_boleto?: string | null;
  link_pagamento?: string | null;
};

export type BoletoResposta = {
  resultados: Boleto[];
  resumo?: { total_aberto?: number; total_pago?: number; total_vencido?: number };
};

export type DetalheBoletim = {
  aluno_id: number;
  ano_letivo: number;
  serie: string;
  disciplinas: Array<{
    nome: string;
    nota_final?: number;
    carga_horaria?: number;
    situacao?: string;
  }>;
  dias_letivos?: number;
  horas_letivas?: number;
  frequencia_anual?: number;
  resultado?: string;
};

// ============================================================================
// Helpers
// ============================================================================

const norm = (s: string | undefined | null) =>
  String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const onlyDigits = (s: string | undefined | null) => String(s || '').replace(/\D/g, '');

const TURNO_TO_HORARIO: Record<string, string> = {
  'manha': '07:30h às 11:30h',
  'manhã': '07:30h às 11:30h',
  'tarde': '13:00h às 17:00h',
  'integral': '07:30h às 17:00h',
  'noite': '19:00h às 22:00h',
};

export function turnoToHorario(turno: string | undefined): string {
  return turno ? (TURNO_TO_HORARIO[norm(turno)] || '') : '';
}

// ============================================================================
// Métodos
// ============================================================================

export const activesoft = {
  isConfigured: () => !!TOKEN,

  /** Lista completa de alunos (campos básicos + filiação_1/2_id). */
  listAlunos: () => request<Aluno[]>('/lista_alunos/', { version: 0 }),

  /** Lista com dados sensíveis (mae_id, pai_id, endereço, naturalidade). */
  listAlunosSensiveis: () => request<AlunoSensivel[]>('/lista_alunos_dados_sensiveis/', { version: 0 }),

  /** Lista todos os responsáveis (CPF, nome, contato). */
  listResponsaveis: () => request<Responsavel[]>('/lista_responsaveis/', { version: 0 }),

  /** Lista de turmas com curso/série/turno. */
  listTurmas: () => request<Turma[]>('/lista_turmas/', { version: 0 }),

  /** Busca um aluno específico (filtra a lista, já que a API não tem GET por id). */
  async getAluno(id: number): Promise<Aluno | null> {
    const list = await this.listAlunos();
    return list.find(a => a.id === id) || null;
  },

  async getAlunoSensivel(id: number): Promise<AlunoSensivel | null> {
    const list = await this.listAlunosSensiveis();
    return list.find(a => a.id === id) || null;
  },

  async getResponsavel(id: number): Promise<Responsavel | null> {
    const list = await this.listResponsaveis();
    return list.find(r => r.id === id) || null;
  },

  async getTurma(id: number): Promise<Turma | null> {
    const list = await this.listTurmas();
    return list.find(t => t.id === id) || null;
  },

  /** Encontra um aluno pelo CPF (do aluno) ou pelo CPF do responsável. */
  async findAlunosByResponsavelCpf(cpf: string): Promise<Aluno[]> {
    const cpfDigits = onlyDigits(cpf);
    const [resps, alunos] = await Promise.all([
      this.listResponsaveis(),
      this.listAlunos(),
    ]);
    const respIds = new Set(
      resps.filter(r => onlyDigits(r.cpf_cnpj) === cpfDigits).map(r => r.id)
    );
    if (respIds.size === 0) return [];
    return alunos.filter(a =>
      (a.responsavel_id && respIds.has(a.responsavel_id)) ||
      (a.responsavel_secundario_id && respIds.has(a.responsavel_secundario_id)) ||
      (a.filiacao_1_id && respIds.has(a.filiacao_1_id)) ||
      (a.filiacao_2_id && respIds.has(a.filiacao_2_id))
    );
  },

  /** Frequência via catraca/portaria (acesso físico). Não é frequência escolar. */
  listFrequencia: (aluno_id: number, data_inicial?: string, data_final?: string) =>
    request<FrequenciaMarcacao[]>('/listar_frequencia_aluno/', {
      aluno_id, data_inicial, data_final, version: 0,
    }),

  /** Diários de uma turma (1 por disciplina × fase/trimestre). */
  listDiarios: (turma_id: number) =>
    request<Diario[]>('/diarios/', { turma: turma_id, version: 0 }),

  /** Frequência registrada no diário de classe (presença/falta por aula). */
  getDiarioFrequencia: (diario_id: number) =>
    request<DiarioFrequenciaLinha[]>('/diario_frequencia/', { diario: diario_id, version: 0 }),

  /** Boletos do aluno (financeiro). Retorna { resultados: [...] }. */
  async listBoletos(aluno_id: number): Promise<Boleto[]> {
    const r = await request<BoletoResposta>('/informacoes_boleto/', { id_aluno: aluno_id, version: 0 });
    return r.resultados || [];
  },

  /** Boletim com notas e CH por disciplina. */
  getDetalheBoletim: (aluno_id: number, ano_letivo: number) =>
    request<DetalheBoletim>('/detalhe_boletim/', { aluno_id, ano: ano_letivo, version: 0 }),
};

// ============================================================================
// Helpers de alto nível para casar 1:1 com cada documento
// ============================================================================

export type DadosMatricula = {
  alunoNome: string;
  matricula: string;
  serie: string;       // "3º Ano do Ensino Médio"
  curso: string;       // "Ensino Médio"
  turma: string;       // "3A"
  turno: string;       // "Manhã" | "Tarde" | ...
  anoLetivo: number;
  horario: string;
  naturalidade: string;    // cidade de nascimento
  dataNascimento: string;  // dd/MM/yyyy
  motherName?: string;
  fatherName?: string;
  responsavelPrincipal?: string;
};

export type ParcelaPaga = {
  competencia: string;        // "01/12"
  servico: string;            // descrição
  vencimento: string;         // ISO
  pagamento: string;          // ISO
  valor: number;
};

export type DadosRecibo = {
  alunoNome: string;
  pagador?: string;
  anoLetivo: number;
  parcelas: ParcelaPaga[];
  totalPago: number;
};

export type DadosNadaConsta = {
  alunoNome: string;
  responsavel?: string;
  anoLetivo: number;
  temPendencia: boolean;
  parcelasAbertas: number;
};

const STATUS_LIQUIDADO = ['LIQ', 'PAG', 'BAI'];
const STATUS_ABERTO = ['ABE', 'AB', 'VEN'];

export type FrequenciaTrimestre = {
  fase: string;                  // "1º TRIMESTRE"
  totalAulas: number;
  presencas: number;
  faltas: number;
  percentual: number | null;     // null se totalAulas == 0
};

export type DadosFrequencia = {
  alunoNome: string;
  matricula: string;
  serie: string;
  anoLetivo: number;
  inep?: string;
  trimestres: FrequenciaTrimestre[];
  percentualGeral: number | null;
};

/** Conta P/F nos slots presenca_falta_NN da linha do diário. */
function contarSlots(linha: DiarioFrequenciaLinha): { p: number; f: number } {
  let p = 0, f = 0;
  for (const k of Object.keys(linha)) {
    if (!k.startsWith('presenca_falta_')) continue;
    const v = (linha as any)[k];
    if (v === 'P') p++;
    else if (v === 'F') f++;
  }
  return { p, f };
}

/** Coleta frequência por trimestre, agregando todas as disciplinas. */
export async function coletarDadosFrequencia(aluno_id: number, anoLetivo?: number): Promise<DadosFrequencia> {
  const ano = anoLetivo || new Date().getFullYear();
  const [basico, sensivel] = await Promise.all([
    activesoft.getAluno(aluno_id),
    activesoft.getAlunoSensivel(aluno_id),
  ]);
  if (!basico || !sensivel) throw new Error(`Aluno ${aluno_id} não encontrado no SIGA.`);

  const turmaIds = basico.id_turmas || [];
  const turmas = await Promise.all(turmaIds.map(id => activesoft.getTurma(id)));
  const turmasDoAno = turmas.filter((t): t is Turma => !!t && parseInt(t.sigla_periodo.trim(), 10) === ano);

  // Junta diários de todas as turmas do ano (exclui recuperação para não contar duas vezes).
  const diariosArrays = await Promise.all(turmasDoAno.map(t => activesoft.listDiarios(t.id)));
  const diarios = diariosArrays.flat().filter(d => !/RECUP/i.test(d.nome_fase));

  // Para cada diário, busca a linha do aluno e soma P/F na fase correspondente.
  const porFase = new Map<string, { totalAulas: number; presencas: number; faltas: number }>();

  await Promise.all(diarios.map(async (d) => {
    if (!porFase.has(d.nome_fase)) porFase.set(d.nome_fase, { totalAulas: 0, presencas: 0, faltas: 0 });
    if (!d.qtde_aulas_registradas || d.qtde_aulas_registradas === 0) return;

    const linhas = await activesoft.getDiarioFrequencia(d.id);
    const linha = linhas.find(l => l.matricula === basico.matricula);
    if (!linha) return;

    // Convenção do ActiveSoft: o professor marca apenas as faltas; slots vazios
    // entre 1..qtde_aulas_registradas significam presença implícita.
    const { f } = contarSlots(linha);
    const total = d.qtde_aulas_registradas;
    const presencas = total - f;

    const acc = porFase.get(d.nome_fase)!;
    acc.totalAulas += total;
    acc.presencas += presencas;
    acc.faltas += f;
  }));

  const trimestres: FrequenciaTrimestre[] = Array.from(porFase.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fase, v]) => ({
      fase,
      totalAulas: v.totalAulas,
      presencas: v.presencas,
      faltas: v.faltas,
      percentual: v.totalAulas > 0 ? Math.round((v.presencas / v.totalAulas) * 1000) / 10 : null,
    }));

  const totalGeral = trimestres.reduce((s, t) => s + t.totalAulas, 0);
  const presGeral = trimestres.reduce((s, t) => s + t.presencas, 0);
  const percentualGeral = totalGeral > 0 ? Math.round((presGeral / totalGeral) * 1000) / 10 : null;

  const turma0 = turmasDoAno[0];
  return {
    alunoNome: basico.nome,
    matricula: basico.matricula || '',
    serie: turma0 ? `${turma0.serie_nome} do ${turma0.curso_nome}` : '',
    anoLetivo: ano,
    inep: undefined,  // Endpoint /parametro/ retornou 500 — pode ser preenchido manualmente
    trimestres,
    percentualGeral,
  };
}

// ----------------------------------------------------------------------------
// Boletim
// ----------------------------------------------------------------------------

export type BoletimEntry = {
  IdDisciplina: number;
  NomeDisciplina: string;
  CabecBoletim: string;        // "1º TRI", "MED1T", "MA", "MF"...
  NumeroFase: number;
  NotaFase: number | null;
  Faltas: number | null;
  QuantAulasDadas: number | null;
  IdTurma: number;
  IdAluno: number;
  SituacaoAtual: string;
};

export type DetalheBoletimResposta = {
  aluno: string;
  aluno_matricula: string;
  turma: string;
  situacao_aluno_turma: string;
  boletim: BoletimEntry[];
};

export const detalheBoletimRequest = (aluno_id: number, turma_id: number) =>
  request<DetalheBoletimResposta>('/detalhe_boletim/', { aluno_id, turma_id, version: 0 });

// ----------------------------------------------------------------------------
// Ficha (Histórico Escolar) — Ensino Fundamental
// ----------------------------------------------------------------------------

export type DisciplinaAnual = {
  nome: string;
  notaAnual: number | null;
  faltas: number | null;
  cargaHoraria: number | null;
};

export type AnoCursado = {
  serie: string;
  anoLetivo: number;
  estabelecimento: string;
  cidadeUf: string;
  diasLetivos?: number;
  horasLetivas?: number;
  frequenciaPercentual: number | null;
  resultado: string;            // "Progressão Plena", "Cursando", etc
  disciplinas: DisciplinaAnual[];
  preenchidoAutomatico: boolean; // true só pro ano corrente; false = secretaria preenche
};

export type DadosFicha = {
  aluno: AlunoSensivel;
  pai?: string;
  mae?: string;
  certidaoNascimento?: string;
  nivel: 'fundamental' | 'medio';
  anosCursados: AnoCursado[];
};

/** Consolida o boletim do ano em "uma linha por disciplina" com nota anual. */
function consolidarBoletim(entries: BoletimEntry[]): DisciplinaAnual[] {
  const porDisciplina = new Map<string, BoletimEntry[]>();
  for (const e of entries) {
    if (!porDisciplina.has(e.NomeDisciplina)) porDisciplina.set(e.NomeDisciplina, []);
    porDisciplina.get(e.NomeDisciplina)!.push(e);
  }

  const result: DisciplinaAnual[] = [];
  for (const [nome, list] of porDisciplina.entries()) {
    const byCabec = (c: string) => list.find(e => e.CabecBoletim === c);
    // Nota anual: MF -> MA -> média(MED1T+MED2T+MED3T)
    let nota: number | null = byCabec('MF')?.NotaFase ?? byCabec('MA')?.NotaFase ?? null;
    if (nota === null) {
      const meds = ['MED1T', 'MED2T', 'MED3T'].map(c => byCabec(c)?.NotaFase).filter((n): n is number => n != null);
      if (meds.length > 0) nota = Math.round((meds.reduce((s, n) => s + n, 0) / meds.length) * 10) / 10;
    }
    // Faltas e CH: somar dos trimestres
    const trims = ['1º TRI', '2º TRI', '3º TRI'].map(c => byCabec(c)).filter((e): e is BoletimEntry => !!e);
    const faltas = trims.reduce((s, e) => s + (e.Faltas || 0), 0);
    const ch = trims.reduce((s, e) => s + (e.QuantAulasDadas || 0), 0);
    result.push({ nome, notaAnual: nota, faltas, cargaHoraria: ch });
  }
  return result.sort((a, b) => a.nome.localeCompare(b.nome));
}

/** Coleta os dados disponíveis pra Ficha 18 / Ficha 19. */
export async function coletarDadosFicha(aluno_id: number, nivel: 'fundamental' | 'medio'): Promise<DadosFicha> {
  const [basico, sensivel] = await Promise.all([
    activesoft.getAluno(aluno_id),
    activesoft.getAlunoSensivel(aluno_id),
  ]);
  if (!sensivel || !basico) throw new Error(`Aluno ${aluno_id} não encontrado no SIGA.`);

  const [mae, pai] = await Promise.all([
    sensivel.mae_id ? activesoft.getResponsavel(sensivel.mae_id) : Promise.resolve(null),
    sensivel.pai_id ? activesoft.getResponsavel(sensivel.pai_id) : Promise.resolve(null),
  ]);

  const turmaId = basico.id_turmas?.[0];
  const turma = turmaId ? await activesoft.getTurma(turmaId) : null;
  const anoCorrente: AnoCursado[] = [];

  if (turma && turmaId) {
    const det = await detalheBoletimRequest(aluno_id, turmaId);
    const disciplinas = consolidarBoletim(det.boletim);
    const totalCH = disciplinas.reduce((s, d) => s + (d.cargaHoraria || 0), 0);
    const totalFaltas = disciplinas.reduce((s, d) => s + (d.faltas || 0), 0);
    const freq = totalCH > 0 ? Math.round((1 - totalFaltas / totalCH) * 1000) / 10 : null;

    anoCorrente.push({
      serie: turma.serie_nome,
      anoLetivo: parseInt(turma.sigla_periodo.trim(), 10) || new Date().getFullYear(),
      estabelecimento: 'EDUCANDÁRIO SÃO JUDAS TADEU',
      cidadeUf: 'CAMARAGIBE/PE',
      frequenciaPercentual: freq,
      resultado: det.situacao_aluno_turma,
      disciplinas,
      preenchidoAutomatico: true,
    });
  }

  return {
    aluno: sensivel,
    mae: mae?.nome,
    pai: pai?.nome,
    nivel,
    anosCursados: anoCorrente,
  };
}

/** Coleta dados pra Recibo de Quitação (todas as parcelas pagas no ano). */
export async function coletarDadosRecibo(aluno_id: number, anoLetivo?: number): Promise<DadosRecibo> {
  const ano = anoLetivo || new Date().getFullYear();
  const [boletos, sensivel] = await Promise.all([
    activesoft.listBoletos(aluno_id),
    activesoft.getAlunoSensivel(aluno_id),
  ]);

  const pagas = boletos
    .filter(b => STATUS_LIQUIDADO.includes(b.situacao_titulo))
    .filter(b => b.dt_pagamento && new Date(b.dt_pagamento).getFullYear() === ano)
    .map<ParcelaPaga>(b => ({
      competencia: (b.parcela_cobranca || '').trim(),
      servico: b.nome_servico || '',
      vencimento: b.dt_vencimento,
      pagamento: b.dt_pagamento!,
      valor: b.valor_recebido_total ?? b.valor_documento,
    }))
    .sort((a, b) => a.pagamento.localeCompare(b.pagamento));

  return {
    alunoNome: sensivel?.nome || boletos[0]?.aluno || '',
    pagador: boletos[0]?.pagador,
    anoLetivo: ano,
    parcelas: pagas,
    totalPago: pagas.reduce((s, p) => s + (p.valor || 0), 0),
  };
}

/** Coleta dados pra Declaração Nada Consta (verifica débitos em aberto). */
export async function coletarDadosNadaConsta(aluno_id: number, anoLetivo?: number): Promise<DadosNadaConsta> {
  const ano = anoLetivo || new Date().getFullYear();
  const [boletos, sensivel, basico] = await Promise.all([
    activesoft.listBoletos(aluno_id),
    activesoft.getAlunoSensivel(aluno_id),
    activesoft.getAluno(aluno_id),
  ]);

  const abertasNoAno = boletos.filter(b => {
    const stOpen = STATUS_ABERTO.includes(b.situacao_titulo);
    const venc = b.dt_vencimento ? new Date(b.dt_vencimento).getFullYear() : null;
    return stOpen && venc === ano;
  });

  const respId = sensivel?.responsavel_id || basico?.responsavel_id;
  const responsavel = respId ? (await activesoft.getResponsavel(respId))?.nome : undefined;

  return {
    alunoNome: sensivel?.nome || boletos[0]?.aluno || '',
    responsavel,
    anoLetivo: ano,
    temPendencia: abertasNoAno.length > 0,
    parcelasAbertas: abertasNoAno.length,
  };
}

/** Coleta todos os dados necessários pra Declaração de Matrícula. */
export async function coletarDadosMatricula(aluno_id: number): Promise<DadosMatricula> {
  // sensivel traz mae_id/pai_id; aluno básico traz id_turmas — precisamos dos dois.
  const [sensivel, basico] = await Promise.all([
    activesoft.getAlunoSensivel(aluno_id),
    activesoft.getAluno(aluno_id),
  ]);
  if (!sensivel) throw new Error(`Aluno ${aluno_id} não encontrado no SIGA.`);

  const turmaId = basico?.id_turmas?.[0];
  const [turma, mae, pai, principal] = await Promise.all([
    turmaId ? activesoft.getTurma(turmaId) : Promise.resolve(null),
    sensivel.mae_id ? activesoft.getResponsavel(sensivel.mae_id) : Promise.resolve(null),
    sensivel.pai_id ? activesoft.getResponsavel(sensivel.pai_id) : Promise.resolve(null),
    sensivel.responsavel_id ? activesoft.getResponsavel(sensivel.responsavel_id) : Promise.resolve(null),
  ]);

  const serieFmt = turma ? `${turma.serie_nome} do ${turma.curso_nome}` : '';
  const anoLetivo = turma?.sigla_periodo ? parseInt(turma.sigla_periodo.trim(), 10) || new Date().getFullYear() : new Date().getFullYear();

  // Formata data de nascimento como dd/MM/yyyy
  const dataNascimentoFmt = sensivel.data_nascimento
    ? new Date(sensivel.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    : '';

  return {
    alunoNome: sensivel.nome,
    matricula: basico?.matricula || sensivel.matricula || '',
    serie: serieFmt,
    curso: turma?.curso_nome || '',
    turma: turma?.nome || '',
    turno: turma?.turno || '',
    anoLetivo,
    horario: turnoToHorario(turma?.turno),
    naturalidade: sensivel.naturalidade_cidade || '',
    dataNascimento: dataNascimentoFmt,
    motherName: mae?.nome,
    fatherName: pai?.nome,
    responsavelPrincipal: principal?.nome,
  };
}
