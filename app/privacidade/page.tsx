import type { Metadata } from 'next'
import Link from 'next/link'

const escolaNome = process.env.NEXT_PUBLIC_ESCOLA_NOME ?? 'Loja Escolar'

export const metadata: Metadata = {
  title: `Política de Privacidade — ${escolaNome}`,
  description: `Como o ${escolaNome} coleta, usa e protege seus dados pessoais (LGPD).`,
}

export default function PrivacidadePage() {
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
        Política de Privacidade
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 32 }}>
        Última atualização: 19 de abril de 2026 · Conforme a Lei Geral de Proteção de
        Dados (Lei 13.709/2018)
      </p>

      <section style={sectionStyle}>
        <h2 style={h2Style}>1. Controlador dos dados</h2>
        <p style={pStyle}>
          O {escolaNome} é o controlador dos dados pessoais tratados nesta Plataforma.
          Para assuntos de privacidade e exercício dos seus direitos de titular, procure
          a secretaria da escola ou o canal oficial divulgado.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>2. Dados que coletamos</h2>
        <ul style={ulStyle}>
          <li><strong>Identificação do responsável:</strong> nome, CPF, email, telefone.</li>
          <li><strong>Identificação do aluno:</strong> nome, série, turma, restrições alimentares informadas.</li>
          <li><strong>Dados de pedidos:</strong> itens adquiridos, valores, datas, método de pagamento.</li>
          <li><strong>Dados de pagamento:</strong> informações mínimas necessárias repassadas ao gateway (Asaas), sem armazenamento de dados completos de cartão.</li>
          <li><strong>Dados técnicos:</strong> endereço IP, navegador, sistema operacional, logs de acesso.</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>3. Bases legais</h2>
        <p style={pStyle}>
          Tratamos seus dados com base em: execução de contrato (art. 7º, V da LGPD);
          cumprimento de obrigação legal (art. 7º, II); legítimo interesse para prevenção
          de fraude (art. 7º, IX); e consentimento (art. 7º, I) quando aplicável.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>4. Finalidades</h2>
        <ul style={ulStyle}>
          <li>Processar pedidos e pagamentos;</li>
          <li>Emitir ingressos e controlar vagas de eventos;</li>
          <li>Gerenciar a carteira de cantina do aluno;</li>
          <li>Enviar confirmações e notificações transacionais por email ou WhatsApp;</li>
          <li>Prevenir fraudes e garantir a segurança da Plataforma;</li>
          <li>Cumprir obrigações legais e fiscais.</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>5. Compartilhamento com terceiros</h2>
        <p style={pStyle}>
          Compartilhamos dados apenas com operadores essenciais à prestação do serviço:
        </p>
        <ul style={ulStyle}>
          <li><strong>Supabase</strong> — hospedagem do banco de dados e autenticação.</li>
          <li><strong>Asaas</strong> — processamento de pagamentos.</li>
          <li><strong>Resend</strong> — envio de emails transacionais.</li>
          <li><strong>Vercel</strong> — hospedagem da aplicação.</li>
          <li><strong>Sentry</strong> — monitoramento de erros (sem dados pessoais no payload).</li>
        </ul>
        <p style={pStyle}>
          Não vendemos, alugamos ou cedemos seus dados para fins de marketing de
          terceiros.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>6. Cookies</h2>
        <p style={pStyle}>
          Utilizamos cookies essenciais (autenticação, preferências) para o funcionamento
          da Plataforma, e cookies analíticos para métricas agregadas. Você pode aceitar
          ou recusar cookies não essenciais no banner de consentimento exibido na
          primeira visita.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>7. Retenção</h2>
        <p style={pStyle}>
          Manteremos seus dados pelo tempo necessário ao cumprimento das finalidades
          acima e das obrigações legais (em especial fiscais e contábeis — até 5 anos
          após o fim do vínculo).
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>8. Seus direitos (art. 18 da LGPD)</h2>
        <p style={pStyle}>Como titular, você pode a qualquer momento:</p>
        <ul style={ulStyle}>
          <li>Confirmar a existência de tratamento;</li>
          <li>Acessar e corrigir seus dados (na tela de Perfil);</li>
          <li>Solicitar a portabilidade (botão &quot;Exportar meus dados&quot;);</li>
          <li>Solicitar a exclusão (botão &quot;Excluir minha conta&quot;), ressalvados os dados que devemos reter por obrigação legal;</li>
          <li>Revogar consentimentos dados anteriormente.</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>9. Segurança</h2>
        <p style={pStyle}>
          Adotamos medidas técnicas e organizacionais razoáveis: criptografia em trânsito
          (HTTPS), controle de acesso por linha em banco (RLS), rate limiting em login,
          senhas em hash bcrypt, cabeçalhos de segurança (CSP, X-Frame-Options,
          Referrer-Policy) e monitoramento de erros.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>10. Menores</h2>
        <p style={pStyle}>
          A Plataforma é destinada a responsáveis legais. Dados de alunos menores são
          coletados com o consentimento do responsável, estritamente para a finalidade
          escolar.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>11. Alterações</h2>
        <p style={pStyle}>
          Esta política pode ser atualizada. A versão vigente estará sempre disponível
          nesta página. Alterações relevantes serão comunicadas por email.
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
const ulStyle: React.CSSProperties = {
  fontSize: 14.5,
  lineHeight: 1.8,
  color: 'var(--text-2)',
  paddingLeft: 20,
  marginBottom: 10,
}
