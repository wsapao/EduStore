/**
 * Gera public/concurso/edital-bolsas-esportivas-2027.pdf a partir do HTML abaixo.
 * Uso: node scripts/gerar-edital-concurso.mjs
 *
 * Texto-base: edital revisado pela escola em 02/07/2026 (docx), com os ajustes
 * já publicados no site: endereço da sede (Pedro de Paula Rocha, 188), link real
 * de inscrição e numeração oficial do edital.
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LOGO = readFileSync(path.join(ROOT, 'public/concurso/logo-esjt.png')).toString('base64')
const SAIDA = path.join(ROOT, 'public/concurso/edital-bolsas-esportivas-2027.pdf')

const NAVY = '#1f3864'
const RED = '#c00000'

const efRows = ['2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º']
  .map((s) => `<tr><td>${s} ano EF</td><td class="c">10</td><td class="c">10</td><td class="c">20</td></tr>`)
  .join('')

const emRows = ['1ª', '2ª', '3ª']
  .map((s) => `<tr><td>${s} série EM</td><td class="c">10</td><td class="c">10</td><td class="c">10</td><td class="c">10</td><td class="c">40</td></tr>`)
  .join('')

const cronograma = [
  ['Inscrições', '06/07/2026 a 23/08/2026'],
  ['Pagamento da taxa de inscrição', 'até 26/08/2026'],
  ['Etapa Pedagógica (prova), 08h30 às 11h30', '30/08/2026 (domingo)'],
  ['Divulgação do calendário da Etapa Técnica', '31/08/2026'],
  ['Etapa Técnica (seletiva esportiva)', '09/09/2026 a 19/09/2026'],
  ['Divulgação dos resultados', '22/09/2026 a 30/09/2026'],
  ['Reunião com pais e candidatos aprovados', '22/09/2026 a 30/09/2026'],
  ['Apresentação do boletim escolar', '22/09/2026 a 30/09/2026'],
  ['Entrega de documentos e matrícula', '03/10/2026'],
].map(([e, p]) => `<tr><td>${e}</td><td>${p}</td></tr>`).join('')

const desligamento = [
  'Deixar de participar injustificadamente dos treinamentos;',
  'Faltar injustificadamente às competições;',
  'Representar outra instituição esportiva sem autorização;',
  'Reprovar ao final do ano letivo;',
  'Apresentar rendimento escolar incompatível;',
  'Praticar falta disciplinar grave;',
  'Acumular número excessivo de faltas;',
  'Utilizar documentos falsos;',
  'Praticar conduta incompatível com os princípios institucionais;',
  'Perder a aptidão física, mediante laudo médico;',
  'Descumprir o Regimento Escolar;',
  'Descumprir este Edital;',
  'Deixar de atender às convocações da Comissão Técnica.',
].map((i) => `<li>${i}</li>`).join('')

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5px;
    line-height: 1.55;
    color: #1a1a1a;
    text-align: justify;
  }
  .masthead { text-align: center; margin-bottom: 18px; }
  .masthead img { height: 88px; margin-bottom: 10px; }
  .masthead h1 { font-size: 17px; color: ${NAVY}; letter-spacing: 1.5px; }
  .masthead .cnpj { font-size: 9.5px; color: #444; margin-top: 2px; }
  .masthead .endereco { font-size: 9.5px; color: #444; }
  .masthead .rule { border-bottom: 2.5px solid ${NAVY}; margin-top: 12px; }
  .titulo { text-align: center; margin: 22px 0 4px; }
  .titulo h2 { font-size: 16px; color: ${RED}; letter-spacing: 0.5px; }
  .titulo h3 { font-size: 12.5px; color: ${NAVY}; margin-top: 6px; letter-spacing: 0.3px; }
  .preambulo { margin-top: 16px; }
  h4.secao {
    font-size: 11.5px; color: ${NAVY}; text-transform: uppercase;
    border-bottom: 1px solid ${NAVY}; padding-bottom: 3px;
    margin: 18px 0 8px; page-break-after: avoid; text-align: left;
  }
  h4.secao .n { color: ${RED}; }
  p { margin-bottom: 7px; }
  p .item { color: ${NAVY}; font-weight: bold; }
  ul { margin: 4px 0 8px 22px; }
  li { margin-bottom: 3px; }
  ol.alineas { list-style: none; margin: 4px 0 8px 12px; }
  ol.alineas li { margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; page-break-inside: auto; }
  th {
    background: ${NAVY}; color: #fff; font-size: 10px; text-align: left;
    padding: 6px 9px; border: 1px solid ${NAVY};
  }
  td { padding: 5.5px 9px; border: 1px solid #c9d4e4; font-size: 10px; }
  tr:nth-child(even) td { background: #eaf0f8; }
  tr { page-break-inside: avoid; }
  td.c, th.c { text-align: center; }
  .pct { color: ${RED}; font-weight: bold; text-align: center; }
  .assinatura { text-align: center; margin-top: 36px; page-break-inside: avoid; }
  .assinatura .data { margin-bottom: 34px; }
  .assinatura .cargo { font-weight: bold; color: ${NAVY}; }
  a { color: ${NAVY}; }
</style>
</head>
<body>

<div class="masthead">
  <img src="data:image/png;base64,${LOGO}" alt="ESJT">
  <h1>EDUCANDÁRIO SÃO JUDAS TADEU</h1>
  <div class="cnpj">CNPJ 11.453.651/0001-53</div>
  <div class="endereco">Rua Pedro de Paula Rocha, 188 · Bairro Novo do Carmelo · Camaragibe/PE · CEP 54762-590</div>
  <div class="rule"></div>
</div>

<div class="titulo">
  <h2>EDITAL Nº 01/2026</h2>
  <h3>CONCURSO DE BOLSAS – SELETIVAS ESPORTIVAS 2027</h3>
</div>

<p class="preambulo">O <b>EDUCANDÁRIO SÃO JUDAS TADEU LTDA ME (ESJT)</b>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 11.453.651/0001-53, com sede na Rua Pedro de Paula Rocha, nº 188, Bairro Novo do Carmelo, Camaragibe/PE, CEP 54762-590, torna público o presente Edital, que estabelece as normas e condições para participação no <b>Concurso de Bolsas – Seletivas Esportivas 2027</b>, destinado à concessão de bolsas de estudo parciais e integrais a alunos atletas.</p>

<h4 class="secao"><span class="n">1.</span> DAS MODALIDADES</h4>
<p><span class="item">1.1.</span> O presente concurso atenderá às seguintes modalidades esportivas, nas categorias masculina e feminina:</p>
<ul>
  <li>Futsal</li>
  <li>Vôlei</li>
  <li>Judô</li>
  <li>Ginástica</li>
  <li>Natação</li>
</ul>
<p><span class="item">1.2.</span> Serão ofertadas bolsas de <b>até 100% (cem por cento)</b> sobre o valor das mensalidades, conforme classificação e desempenho nas etapas técnica e pedagógica.</p>
<p><span class="item">1.3.</span> As vagas destinam-se a estudantes regularmente matriculados do <b>2º ano do Ensino Fundamental à 3ª série do Ensino Médio</b>, exclusivamente no <b>turno da TARDE</b>.</p>

<h4 class="secao"><span class="n">2.</span> DAS INSCRIÇÕES</h4>
<p><span class="item">2.1.</span> As inscrições serão individuais e ocorrerão de <b>06 de julho a 23 de agosto de 2026</b>.</p>
<p><span class="item">2.2.</span> Para inscrever-se, o candidato deverá:</p>
<ol class="alineas">
  <li>a) Preencher o formulário eletrônico de inscrição disponível em <a href="https://loja.esjt.com.br/concurso-bolsas-2027"><b>loja.esjt.com.br/concurso-bolsas-2027</b></a>;</li>
  <li>b) Efetuar o pagamento da taxa de inscrição no valor de <b>R$ 25,00 (vinte e cinco reais)</b>, via Pix, ao final do preenchimento do formulário, até <b>26 de agosto de 2026</b>;</li>
  <li>c) Apresentar, no dia da seletiva, declaração de saúde emitida por profissional habilitado, atestando estar apto(a) à prática esportiva;</li>
  <li>d) Apresentar o boletim escolar do ano vigente;</li>
  <li>e) O candidato só poderá efetuar inscrição em <b>uma modalidade</b>. No caso de mais de uma inscrição, será considerada válida a última inscrição com pagamento da taxa confirmado.</li>
</ol>
<p><span class="item">2.3.</span> Não serão aceitas inscrições de candidatos que:</p>
<ul>
  <li>Estejam com pendências disciplinares graves ou histórico de comportamento incompatível com as normas do Educandário;</li>
  <li>Apresentem documentação incompleta ou irregular;</li>
  <li>Forneçam informações ou documentos falsos;</li>
  <li>Estejam desligados do Educandário por motivo disciplinar nos últimos 12 (doze) meses.</li>
</ul>
<p><b>Parágrafo único.</b> O descumprimento de qualquer requisito previsto neste Edital resultará na desclassificação imediata do candidato, sem direito a recurso.</p>

<h4 class="secao"><span class="n">3.</span> DAS ETAPAS</h4>
<p>O processo seletivo será realizado em duas etapas:</p>
<p><span class="item">3.1. ETAPA PEDAGÓGICA</span> (prova de sondagem) — realizada em <b>30 de agosto de 2026 (domingo)</b>, das <b>08h30 às 11h30</b> (duração de 3 horas), na sede do Educandário São Judas Tadeu (Rua Pedro de Paula Rocha, 188 — Bairro Novo do Carmelo, Camaragibe/PE).</p>
<p>A avaliação contemplará questões objetivas e subjetivas (discursivas, abertas e cálculos) nas disciplinas de <b>Língua Portuguesa e Matemática</b> para o Ensino Fundamental e de <b>Língua Portuguesa, Matemática, Ciências Humanas (CH) e Ciências da Natureza (CN)</b> para o Ensino Médio, além de uma proposta de <b>Redação</b> com texto de apoio, exigindo a produção de texto conforme o gênero estabelecido no conteúdo programático. As questões estarão distribuídas da seguinte forma:</p>

<table>
  <tr><th>Ensino Fundamental — série/ano</th><th class="c">Português</th><th class="c">Matemática</th><th class="c">Total de questões</th></tr>
  ${efRows}
</table>

<table>
  <tr><th>Ensino Médio — série</th><th class="c">Português</th><th class="c">Matemática</th><th class="c">CH</th><th class="c">CN</th><th class="c">Total de questões</th></tr>
  ${emRows}
</table>

<p>O conteúdo programático será divulgado no site e nas redes oficiais do Educandário.</p>
<p><span class="item">3.2. ETAPA TÉCNICA</span> — avaliação prática na modalidade esportiva escolhida, de <b>09 a 19 de setembro de 2026</b>, conforme calendário a ser divulgado nas redes sociais oficiais do ESJT em <b>31 de agosto de 2026</b>.</p>
<p><span class="item">3.3.</span> Cronograma geral:</p>
<table>
  <tr><th>Evento</th><th>Período</th></tr>
  ${cronograma}
</table>

<h4 class="secao"><span class="n">4.</span> DA CONCESSÃO DAS BOLSAS</h4>
<p><span class="item">4.1.</span> As bolsas terão validade exclusivamente para o ano letivo de 2027 e incidirão exclusivamente sobre as mensalidades escolares, não abrangendo:</p>
<ul>
  <li>Atividades extracurriculares;</li>
  <li>Horário estendido (integral);</li>
  <li>Alimentação.</li>
</ul>
<p><span class="item">4.2.</span> Os atletas titulares das equipes principais poderão receber bolsa de estudo de até 100% (cem por cento), observada a tabela prevista neste Edital, desde que atendam cumulativamente aos critérios técnicos, pedagógicos, disciplinares, administrativos e financeiros estabelecidos pelo ESJT.</p>
<p><span class="item">4.3.</span> Atletas não titulares poderão participar das escolinhas esportivas, mediante pagamento das mensalidades correspondentes.</p>
<p><span class="item">4.4.</span> A bolsa de estudo concedida possui natureza exclusivamente promocional, discricionária e anual, não constituindo direito adquirido, benefício permanente ou renovação automática para os anos letivos subsequentes, dependendo sua manutenção exclusivamente do cumprimento integral das condições previstas neste Edital e no Contrato de Prestação de Serviços Educacionais.</p>
<p><span class="item">4.5.</span> Tabela de descontos:</p>
<table>
  <tr><th class="c">Etapa Pedagógica</th><th class="c">Etapa Técnica</th><th class="c">Média final</th><th class="c">Percentual de bolsa</th></tr>
  <tr><td class="c">10</td><td class="c">10</td><td class="c">10,0</td><td class="pct">100%</td></tr>
  <tr><td class="c">Nota pedagógica</td><td class="c">Nota técnica</td><td class="c">9,0 a 9,9</td><td class="pct">50%</td></tr>
  <tr><td class="c">Nota pedagógica</td><td class="c">Nota técnica</td><td class="c">8,0 a 8,9</td><td class="pct">30%</td></tr>
  <tr><td class="c">Nota pedagógica</td><td class="c">Nota técnica</td><td class="c">7,0 a 7,9</td><td class="pct">8%</td></tr>
</table>

<h4 class="secao"><span class="n">5.</span> DA INEXISTÊNCIA DE VÍNCULO ESPORTIVO</h4>
<p>A participação do estudante nas equipes esportivas do Educandário São Judas Tadeu (ESJT) possui finalidade exclusivamente educacional e formativa, não caracterizando vínculo empregatício, profissional, federativo ou qualquer relação remuneratória entre o atleta e a instituição de ensino.</p>

<h4 class="secao"><span class="n">6.</span> DA BOLSA CONDICIONADA À EXISTÊNCIA DA EQUIPE</h4>
<p>O Educandário São Judas Tadeu (ESJT) poderá alterar, extinguir, substituir ou reorganizar modalidades esportivas, categorias ou equipes, em razão de questões pedagógicas, administrativas, financeiras, técnicas ou de número insuficiente de participantes, sem que isso gere direito à indenização ou manutenção automática da bolsa concedida.</p>

<h4 class="secao"><span class="n">7.</span> DO NÚMERO MÍNIMO DE ATLETAS</h4>
<p>A formação das equipes esportivas dependerá da existência de número mínimo de atletas, definido pela Coordenação Esportiva, podendo o processo seletivo ser cancelado parcial ou totalmente caso não haja quantitativo suficiente.</p>

<h4 class="secao"><span class="n">8.</span> DOS CRITÉRIOS DE DESEMPATE</h4>
<p>Em caso de empate, serão considerados, sucessivamente:</p>
<ul>
  <li>Maior nota técnica;</li>
  <li>Maior nota pedagógica;</li>
  <li>Melhor boletim escolar;</li>
  <li>Maior idade;</li>
  <li>Decisão fundamentada da Comissão Técnica.</li>
</ul>

<h4 class="secao"><span class="n">9.</span> DA MATRÍCULA</h4>
<p>A classificação no Concurso de Bolsas não assegura, por si só, a matrícula do candidato, a qual dependerá do cumprimento das exigências documentais, assinatura do Contrato de Prestação de Serviços Educacionais, inexistência de pendências cadastrais e disponibilidade de vaga na série pretendida.</p>
<p>A aprovação no concurso não dispensa o responsável da assinatura do Contrato de Prestação de Serviços Educacionais, do cumprimento do Regimento Escolar e do pagamento dos valores não abrangidos pela bolsa.</p>

<h4 class="secao"><span class="n">10.</span> DA INADIMPLÊNCIA</h4>
<p>A bolsa poderá ser cancelada caso haja inadimplência superior a 30 (trinta) dias, consecutivos ou alternados, durante o ano letivo.</p>

<h4 class="secao"><span class="n">11.</span> DA LGPD</h4>
<p>Os dados pessoais fornecidos serão tratados exclusivamente para execução deste processo seletivo, observando-se a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados – LGPD).</p>
<p>Os dados poderão ser compartilhados exclusivamente com profissionais envolvidos na execução do concurso, observadas as bases legais da Lei Geral de Proteção de Dados.</p>

<h4 class="secao"><span class="n">12.</span> DO USO DE IMAGEM</h4>
<p>O uso da imagem será realizado exclusivamente para divulgação institucional do Educandário São Judas Tadeu (ESJT), podendo a autorização ser revogada mediante solicitação escrita, ressalvadas as publicações já realizadas.</p>
<p>A revogação produzirá efeitos apenas para futuras divulgações, permanecendo válidas as divulgações anteriormente realizadas.</p>

<h4 class="secao"><span class="n">13.</span> DO RECURSO</h4>
<p>Caberá recurso administrativo, exclusivamente por escrito, no prazo de dois dias úteis após a divulgação do resultado preliminar, sendo a decisão da Comissão de Bolsas definitiva na esfera administrativa.</p>
<p>O recurso deverá conter fundamentação específica, não sendo admitidos recursos genéricos.</p>

<h4 class="secao"><span class="n">14.</span> DAS ALTERAÇÕES DO EDITAL</h4>
<p>O Educandário São Judas Tadeu (ESJT) poderá promover retificações neste Edital antes da realização das etapas do concurso, mediante publicação em seus canais oficiais.</p>

<h4 class="secao"><span class="n">15.</span> DA FORÇA MAIOR</h4>
<p>O cronograma poderá ser alterado por motivo de caso fortuito, força maior, condições climáticas, questões sanitárias, determinações de autoridades públicas ou razões administrativas.</p>

<h4 class="secao"><span class="n">16.</span> DA RESPONSABILIDADE MÉDICA</h4>
<p>A participação nas atividades esportivas ocorrerá por exclusiva responsabilidade dos pais ou responsáveis, que declaram possuir ciência das condições físicas do candidato, comprometendo-se a apresentar atestado médico atualizado quando solicitado.</p>
<p>O ESJT poderá exigir novo atestado médico sempre que entender necessário.</p>

<h4 class="secao"><span class="n">17.</span> DO SEGURO</h4>
<p>A participação nas seletivas esportivas não implica contratação de seguro individual pela instituição.</p>

<h4 class="secao"><span class="n">18.</span> DAS DECISÕES TÉCNICAS</h4>
<p>As decisões técnicas possuem natureza especializada e discricionária, sendo fundamentadas em critérios esportivos, pedagógicos e disciplinares.</p>

<h4 class="secao"><span class="n">19.</span> DAS DISPOSIÇÕES GERAIS</h4>
<p>O benefício poderá ser suspenso ou cancelado, mediante decisão fundamentada da Coordenação Esportiva e da Direção, quando o atleta:</p>
<ul>${desligamento}</ul>
<p><span class="item">19.1.</span> Os casos omissos — ou seja, situações, ocorrências ou circunstâncias não previstas neste regulamento —, bem como dúvidas quanto à interpretação das regras aqui estabelecidas, serão analisados e resolvidos pela Direção do Educandário São Judas Tadeu, ouvida a Comissão de Bolsas, observados os princípios da legalidade, razoabilidade, impessoalidade, transparência, boa-fé objetiva e interesse pedagógico, sendo suas decisões definitivas na esfera administrativa.</p>

<h4 class="secao"><span class="n">20.</span> DO FORO</h4>
<p>Fica eleito o Foro da Comarca de Camaragibe/PE para dirimir eventuais controvérsias oriundas deste Edital, com renúncia a qualquer outro, por mais privilegiado que seja.</p>

<div class="assinatura">
  <p class="data">Camaragibe/PE, 06 de julho de 2026.</p>
  <p class="cargo">Direção<br>Educandário São Judas Tadeu</p>
</div>

</body>
</html>`

const HEADER = `
<div style="font-family: Arial, sans-serif; font-size: 7.5px; color: #555; width: 100%;
            margin: 0 42px; padding-bottom: 5px; border-bottom: 1px solid ${NAVY};
            display: flex; justify-content: space-between;">
  <span>Educandário São Judas Tadeu</span>
  <span>Edital nº 01/2026 · Concurso de Bolsas – Seletivas Esportivas 2027</span>
</div>`

const FOOTER = `
<div style="font-family: Arial, sans-serif; font-size: 7.5px; color: #555; width: 100%;
            margin: 0 42px; padding-top: 5px; border-top: 1px solid ${NAVY};
            display: flex; justify-content: space-between;">
  <span>loja.esjt.com.br/concurso-bolsas-2027 · (81) 3458-1047</span>
  <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
</div>`

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'load' })
await page.pdf({
  path: SAIDA,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: HEADER,
  footerTemplate: FOOTER,
  margin: { top: '80px', bottom: '70px', left: '56px', right: '56px' },
})
await browser.close()
console.log(`PDF gerado: ${SAIDA}`)
