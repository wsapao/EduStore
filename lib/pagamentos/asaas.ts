/**
 * Gateway de pagamento Asaas (produção/sandbox).
 * Documentação: https://docs.asaas.com
 *
 * Variáveis de ambiente necessárias:
 *   ASAAS_API_KEY        — chave $aact_...
 *   ASAAS_ENVIRONMENT    — 'sandbox' | 'production'
 */
import type {
  GatewayPagamento,
  CriarPagamentoInput,
  ResultadoPagamento,
} from './types'

// ── Helpers de URL e fetch ─────────────────────────────────────────────────────

function baseUrl() {
  const env = process.env.ASAAS_ENVIRONMENT ?? 'sandbox'
  return env === 'production'
    ? 'https://api.asaas.com/api/v3'
    : 'https://sandbox.asaas.com/api/v3'
}

async function asaasGet<T>(path: string): Promise<T> {
  const key = process.env.ASAAS_API_KEY
  if (!key) throw new Error('ASAAS_API_KEY não configurada.')

  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'GET',
    headers: { accept: 'application/json', access_token: key },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Asaas GET ${path} → ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

async function asaasPost<T>(path: string, body: unknown): Promise<T> {
  const key = process.env.ASAAS_API_KEY
  if (!key) throw new Error('ASAAS_API_KEY não configurada.')

  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      access_token: key,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Asaas POST ${path} → ${res.status}: ${errBody}`)
  }
  return res.json() as Promise<T>
}

// ── Tipos internos da API Asaas ───────────────────────────────────────────────

interface AsaasCustomer {
  id: string
  name: string
  cpfCnpj: string
  email: string
}

interface AsaasCustomerList {
  data: AsaasCustomer[]
  totalCount: number
}

interface AsaasPayment {
  id: string
  status: string
  billingType: string
  value: number
  dueDate: string
  bankSlipUrl?: string
}

interface AsaasPixQrCode {
  encodedImage: string  // base64 PNG
  payload: string       // texto copia-e-cola
  expirationDate: string
}

interface AsaasBoletoField {
  identificationField: string
  nossoNumero: string
  barCode: string
}

// ── Helpers de negócio ────────────────────────────────────────────────────────

/** Busca cliente por CPF; cria um novo se não existir. */
async function findOrCreateCustomer(
  cpf: string,
  nome: string,
  email: string,
): Promise<string> {
  const cleanCpf = cpf.replace(/\D/g, '')

  const list = await asaasGet<AsaasCustomerList>(
    `/customers?cpfCnpj=${cleanCpf}&limit=1`,
  )

  if (list.data && list.data.length > 0) {
    return list.data[0].id
  }

  const created = await asaasPost<AsaasCustomer>('/customers', {
    name: nome,
    cpfCnpj: cleanCpf,
    email,
    notificationDisabled: true,
  })
  return created.id
}

/** Converte status Asaas → status interno */
function mapStatus(
  asaasStatus: string,
): 'aguardando' | 'confirmado' | 'falhou' | 'expirado' | 'reembolsado' {
  switch (asaasStatus) {
    case 'CONFIRMED':
    case 'RECEIVED':
    case 'RECEIVED_IN_CASH':
      return 'confirmado'
    case 'OVERDUE':
    case 'AWAITING_RISK_ANALYSIS':
      return 'aguardando'
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
      return 'reembolsado'
    case 'CHARGEBACK_REQUESTED':
    case 'CHARGEBACK_DISPUTE':
    case 'DUNNING_REQUESTED':
    case 'DUNNING_RECEIVED':
      return 'falhou'
    default:
      return 'aguardando'
  }
}

// ── Implementação do gateway ──────────────────────────────────────────────────

export const asaasGateway: GatewayPagamento = {
  async criarPagamento(input: CriarPagamentoInput): Promise<ResultadoPagamento> {
    const customerId = await findOrCreateCustomer(
      input.responsavel.cpf,
      input.responsavel.nome,
      input.responsavel.email,
    )

    // Data de vencimento: hoje + 1 dia (mínimo exigido pelo Asaas para boleto/PIX)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dueDate = tomorrow.toISOString().split('T')[0]

    if (input.metodo === 'pix') {
      const payment = await asaasPost<AsaasPayment>('/payments', {
        customer: customerId,
        billingType: 'PIX',
        value: input.total,
        dueDate,
        description: input.descricao,
        externalReference: input.referencia,
      })

      const qr = await asaasGet<AsaasPixQrCode>(`/payments/${payment.id}/pixQrCode`)

      const expiracao = qr.expirationDate
        ? new Date(qr.expirationDate).toISOString()
        : new Date(Date.now() + 30 * 60 * 1000).toISOString()

      return {
        metodo: 'pix',
        gateway_id: payment.id,
        qr_code: qr.payload,
        qr_code_imagem: `data:image/png;base64,${qr.encodedImage}`,
        tx_id: payment.id,
        expiracao,
        status: 'aguardando',
      }
    }

    if (input.metodo === 'boleto') {
      const boletoVenc = new Date()
      boletoVenc.setDate(boletoVenc.getDate() + 3)
      const boletoDueDate = boletoVenc.toISOString().split('T')[0]

      const payment = await asaasPost<AsaasPayment>('/payments', {
        customer: customerId,
        billingType: 'BOLETO',
        value: input.total,
        dueDate: boletoDueDate,
        description: input.descricao,
        externalReference: input.referencia,
        fine: { value: 2 },     // 2% de multa
        interest: { value: 1 }, // 1% a.m. de juros
      })

      const campo = await asaasGet<AsaasBoletoField>(
        `/payments/${payment.id}/identificationField`,
      )

      return {
        metodo: 'boleto',
        gateway_id: payment.id,
        codigo: campo.barCode ?? campo.nossoNumero,
        linha_digitavel: campo.identificationField,
        vencimento: boletoDueDate,
        url: payment.bankSlipUrl ?? `https://www.asaas.com/b/${payment.id}`,
        status: 'aguardando',
      }
    }

    // cartão de crédito
    if (!input.dadosCartao) {
      throw new Error('Dados do cartão são obrigatórios para pagamento com cartão.')
    }

    const [mesStr, anoStr] = input.dadosCartao.validade.split('/')
    const expiryYear = anoStr.length === 2 ? `20${anoStr}` : anoStr

    const payment = await asaasPost<AsaasPayment>('/payments', {
      customer: customerId,
      billingType: 'CREDIT_CARD',
      value: input.total,
      dueDate,
      description: input.descricao,
      externalReference: input.referencia,
      installmentCount: (input.parcelas ?? 1) > 1 ? input.parcelas : undefined,
      installmentValue: (input.parcelas ?? 1) > 1
        ? parseFloat((input.total / input.parcelas!).toFixed(2))
        : undefined,
      creditCard: {
        holderName: input.dadosCartao.nome,
        number: input.dadosCartao.numero.replace(/\s/g, ''),
        expiryMonth: mesStr.padStart(2, '0'),
        expiryYear,
        ccv: input.dadosCartao.cvv,
      },
      creditCardHolderInfo: {
        name: input.responsavel.nome,
        email: input.responsavel.email,
        cpfCnpj: input.responsavel.cpf.replace(/\D/g, ''),
        postalCode: '00000000', // fallback — idealmente coleta do usuário
        addressNumber: '0',
        phone: '',
      },
    })

    const numero = input.dadosCartao.numero.replace(/\s/g, '')
    const bandeira = numero.startsWith('4')
      ? 'Visa'
      : numero.startsWith('5')
        ? 'Mastercard'
        : numero.startsWith('3')
          ? 'Amex'
          : 'Outro'

    const status = mapStatus(payment.status)

    return {
      metodo: 'cartao',
      gateway_id: payment.id,
      status: status === 'confirmado' ? 'confirmado' : 'falhou',
      parcelas: input.parcelas ?? 1,
      bandeira,
      ultimos_digitos: numero.slice(-4),
    }
  },

  async consultarStatus(gateway_id) {
    const payment = await asaasGet<AsaasPayment>(`/payments/${gateway_id}`)
    return mapStatus(payment.status)
  },
}
