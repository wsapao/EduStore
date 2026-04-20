import type { Metadata } from 'next'
import Link from 'next/link'

const escolaNome = process.env.NEXT_PUBLIC_ESCOLA_NOME ?? 'Loja Escolar'

export const metadata: Metadata = {
  title: `Termos de Uso — ${escolaNome}`,
  description: `Termos e condições de uso da loja virtual ${escolaNome}.`,
}

export default function TermosPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 80px' }}>
      <Link
        href="/login"
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--accent)',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 24,
        }}
      >
        ← Voltar
      </Link>

      <h1
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: 'var(--text-1)',
          letterSpacing: '-0.03em',
          marginBottom: 8,
        }}
      >
        Termos de Uso
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 32 }}>
        Última atualização: 19 de abril de 2026
      </p>

      <section style={sectionStyle}>
        <h2 style={h2Style}>1. Sobre estes Termos</h2>
        <p style={pStyle}>
          Ao utilizar a loja virtual do {escolaNome} (a &quot;Plataforma&quot;), você
          concorda com estes Termos de Uso e com a{' '}
          <Link href="/privacidade" style={linkStyle}>
            Política de Privacidade
          </Link>
          . Leia com atenção. Se não concordar, não utilize a Plataforma.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>2. Cadastro e conta</h2>
        <p style={pStyle}>
          O cadastro é destinado a responsáveis legais de alunos matriculados. Você se
          compromete a fornecer dados verdadeiros, completos e atualizados. A guarda de
          login e senha é de responsabilidade exclusiva do usuário.
        </p>
        <p style={pStyle}>
          A conta pode ser bloqueada ou excluída em caso de fraude, uso indevido ou
          descumprimento destes Termos.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>3. Produtos, pedidos e pagamento</h2>
        <p style={pStyle}>
          A Plataforma comercializa itens escolares (eventos, passeios, uniformes,
          materiais, serviços e recargas de cantina). Os pagamentos são processados por
          gateways homologados (PIX, cartão de crédito e boleto bancário). Em caso de PIX
          ou boleto não pago dentro do prazo, o pedido é automaticamente expirado.
        </p>
        <p style={pStyle}>
          Eventos e passeios com vagas limitadas só são confirmados após a aprovação do
          pagamento.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>4. Reembolso e cancelamento</h2>
        <p style={pStyle}>
          Você tem o direito de arrependimento previsto no art. 49 do Código de Defesa do
          Consumidor: pode desistir da compra em até 7 dias após a contratação,
          recebendo o valor pago de volta, desde que o evento ou serviço ainda não tenha
          ocorrido. Após esse prazo, o reembolso seguirá as regras específicas do produto
          (informadas no detalhe de cada item).
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>5. Ingressos e check-in</h2>
        <p style={pStyle}>
          Ingressos são nominais e contêm QR Code único. O acesso ao evento depende da
          validação desse ingresso pela equipe do {escolaNome}. Ingressos já utilizados,
          cancelados ou de pedidos não pagos não concedem acesso.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>6. Carteira da cantina</h2>
        <p style={pStyle}>
          A carteira digital do aluno é uma ferramenta de controle do saldo para consumo
          na cantina. O saldo não gera juros e pode ser devolvido mediante solicitação
          formal. Limites diários e restrições alimentares configurados pelo responsável
          são respeitados nos débitos.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>7. Uso adequado</h2>
        <p style={pStyle}>
          É vedado: (a) tentar acessar contas de terceiros; (b) executar engenharia
          reversa, scraping ou qualquer forma de ataque; (c) utilizar a Plataforma para
          fins ilícitos ou contrários à moral. Tentativas de violação serão comunicadas
          às autoridades competentes.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>8. Limitação de responsabilidade</h2>
        <p style={pStyle}>
          O {escolaNome} envida esforços razoáveis para manter a Plataforma disponível e
          segura, mas não se responsabiliza por indisponibilidades causadas por terceiros
          (provedores de pagamento, operadoras de telecomunicações, força maior).
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>9. Alterações destes Termos</h2>
        <p style={pStyle}>
          Podemos alterar estes Termos a qualquer momento. Alterações relevantes serão
          comunicadas por email. O uso continuado da Plataforma após as alterações
          implica em aceite.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>10. Foro e contato</h2>
        <p style={pStyle}>
          Fica eleito o foro da comarca da sede do {escolaNome} para dirimir quaisquer
          controvérsias. Para dúvidas e solicitações, entre em contato com a secretaria
          da escola ou pelo canal oficial divulgado pela instituição.
        </p>
      </section>
    </main>
  )
}

const sectionStyle: React.CSSProperties = { marginBottom: 28 }
const h2Style: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: 'var(--text-1)',
  letterSpacing: '-0.02em',
  marginBottom: 10,
}
const pStyle: React.CSSProperties = {
  fontSize: 14.5,
  lineHeight: 1.7,
  color: 'var(--text-2)',
  marginBottom: 10,
}
const linkStyle: React.CSSProperties = {
  color: 'var(--accent)',
  fontWeight: 600,
  textDecoration: 'underline',
}
