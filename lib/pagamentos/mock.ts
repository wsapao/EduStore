/**
 * Gateway de pagamento MOCK.
 * Substituir por Asaas ou Pagar.me em produção.
 * Mantém a mesma interface GatewayPagamento para troca sem alterar o restante da app.
 */
import QRCode from 'qrcode'
import type {
  GatewayPagamento,
  CriarPagamentoInput,
  ResultadoPagamento,
} from './types'

function uid() {
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

function pixPayload(txId: string, valor: number, nome: string): string {
  // EMV simplificado para fins de demonstração
  const merchantCity = 'SAO PAULO'
  const merchantName = nome.toUpperCase().slice(0, 25)
  const amount = valor.toFixed(2)
  const key = `mock_pix_${txId}@lojaescolar.com.br`

  function tlv(tag: string, value: string) {
    const len = value.length.toString().padStart(2, '0')
    return `${tag}${len}${value}`
  }

  const gui = tlv('00', 'BR.GOV.BCB.PIX')
  const chave = tlv('01', key)
  const pixInfo = tlv('26', gui + chave)
  const mcc = tlv('52', '0000')
  const currency = tlv('53', '986')
  const amountField = tlv('54', amount)
  const country = tlv('58', 'BR')
  const nameField = tlv('59', merchantName)
  const cityField = tlv('60', merchantCity)
  const refLabel = tlv('62', tlv('05', txId.slice(0, 25)))

  const body = `000201${pixInfo}${mcc}${currency}${amountField}${country}${nameField}${cityField}${refLabel}6304`
  // CRC16 simplificado (placeholder)
  const crc = 'ABCD'
  return body + crc
}

export const mockGateway: GatewayPagamento = {
  async criarPagamento(input: CriarPagamentoInput): Promise<ResultadoPagamento> {
    // Simula latência de gateway
    await new Promise(r => setTimeout(r, 400))

    const gwId = `MOCK_${uid()}`

    if (input.metodo === 'pix') {
      const txId = `TX${uid()}`
      const payload = pixPayload(txId, input.total, input.responsavel.nome)

      // Gera QR code como base64 data URL (server-side via qrcode package)
      const qrImagem = await QRCode.toDataURL(payload, {
        width: 240,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })

      // Expira em 30 minutos
      const expiracao = new Date(Date.now() + 30 * 60 * 1000).toISOString()

      return {
        metodo: 'pix',
        gateway_id: gwId,
        qr_code: payload,
        qr_code_imagem: qrImagem,
        tx_id: txId,
        expiracao,
        status: 'aguardando',
      }
    }

    if (input.metodo === 'cartao') {
      // Mock: aprova se CVV não for '000'
      const aprovado = input.dadosCartao?.cvv !== '000'
      const num = input.dadosCartao?.numero ?? ''
      return {
        metodo: 'cartao',
        gateway_id: gwId,
        status: aprovado ? 'confirmado' : 'falhou',
        parcelas: input.parcelas ?? 1,
        bandeira: num.startsWith('4') ? 'Visa' : num.startsWith('5') ? 'Mastercard' : 'Outro',
        ultimos_digitos: num.replace(/\s/g, '').slice(-4),
      }
    }

    // boleto
    const vencimento = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const dataVenc = vencimento.toISOString().split('T')[0]
    const linha = `34191.75402 51004.791007 00000.000000 8 ${Date.now().toString().slice(-5)}${input.total.toFixed(0).padStart(10,'0')}`
    return {
      metodo: 'boleto',
      gateway_id: gwId,
      codigo: linha.replace(/\s/g, ''),
      linha_digitavel: linha,
      vencimento: dataVenc,
      url: `https://boleto.mock/${gwId}.pdf`,
      status: 'aguardando',
    }
  },

  async consultarStatus(gateway_id: string) {
    // Mock sempre retorna 'aguardando' em chamadas diretas
    void gateway_id
    return 'aguardando'
  },
}
