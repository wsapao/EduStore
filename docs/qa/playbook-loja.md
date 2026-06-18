# Playbook de QA — Loja virtual

O agente segue este playbook E tem licença para exploração livre além dele.
Para cada fluxo: **pré-condição → passos → resultado esperado**. Dados de teste sempre
com prefixo `QA-`. Pagamentos sempre em **sandbox**.

## Credenciais de teste (preencher por ambiente)
- Responsável: CPF `___`, senha `___`
- Admin: CPF `___`, senha `___`
- Operador: CPF `___`, senha `___`

## Perfil: Autenticação
1. **Cadastro** (`/cadastro`): preencher com CPF válido novo + dados → conta criada, login automático ou redirect ao login.
2. **Login** (`/login`): CPF + senha válidos → entra; CPF/senha inválidos → mensagem de erro, sem entrar.
3. **Recuperar senha** (aba em `/login`): CPF válido → confirmação de envio; não vaza se o CPF existe.
4. **Nova senha** (`/nova-senha`): token válido → troca; token inválido/expirado → erro.

## Perfil: Responsável (loja)
1. **Vitrine** (`/loja`): lista produtos; busca/filtro funciona.
2. **Produto** (`/loja/produto/[id]`): detalhes, escolher variação/qtd, adicionar ao carrinho.
3. **Checkout** (`/checkout`): revisar carrinho → escolher PIX → gera QR/código sandbox; escolher cartão → fluxo sandbox (aprovado e recusado).
4. **Pedidos** (`/pedidos`, `/pedido/[id]`): histórico e detalhe; status reflete o pagamento.
5. **Ingresso** (`/ingresso/[token]`): QR/validação do ingresso.
6. **Perfil** (`/perfil`, `/perfil/alunos`, `/perfil/senha`, `/perfil/privacidade`): editar dados, gerenciar alunos, trocar senha, exportar/gerir privacidade (LGPD).

## Perfil: Responsável (cantina)
1. **Cartão** (`/cantina/[aluno_id]/cartao`): exibe saldo/cartão.
2. **Recarga** (`/cantina/[aluno_id]/recarga`): escolher valor → gerar PIX sandbox → confirmar → **saldo atualiza** → e-mail p/ caixa de teste; `recarga/[recarga_id]` mostra status.
3. **Extrato** (`/cantina/[aluno_id]/extrato`): lançamentos batem com recargas/consumos.
4. **Configurar** (`/cantina/[aluno_id]/configurar`): limites/restrições salvam.

## Perfil: Admin
1. **Dashboard** (`/admin`): cards/resumos carregam.
2. **Alunos / Responsáveis** (`/admin/alunos`, `/admin/responsaveis` + export): CRUD + exportação.
3. **Produtos** (`/admin/produtos`, `/novo`, `/[id]/editar`, `/categorias`): CRUD + **upload de imagem** (subir arquivo aleatório, ver renderizar; rejeitar tipo/tamanho inválido).
4. **Pedidos** (`/admin/pedidos`): listar/filtrar, mudar status.
5. **Cantina admin** (`/admin/cantina`, `/recargas`, `/carteiras`, `/produtos`): operações de cantina.
6. **Vouchers / Check-in / Receita / Relatório** (`/admin/vouchers`, `/checkin`, `/receita`, `/relatorio`): geração, leitura, consistência.
7. **PDV** (`/admin/pdv`): venda offline/online, IndexedDB, sincronização.
8. **Configurações** (`/admin/configuracoes/*`): papéis (novo/[id]), cantina, pagamentos, e-mails, loja-online, checkout, termos, usuários, integrações, dados, auditoria, conta — cada um salva e reflete.

## Perfil: Operador
1. **Operador** (`/operador`): fluxo do operador (vendas/atendimento conforme permissão).

## Casos-limite transversais (aplicar em formulários)
- Campo obrigatório vazio → validação bloqueia.
- CPF inválido / e-mail malformado → erro claro.
- Arquivo de tipo errado (ex.: .txt onde espera imagem) ou gigante → rejeitado com mensagem.
- Texto com caracteres especiais / tentativa de `<script>` → tratado, sem quebrar/sem XSS.
- Valores negativos / zero onde não cabe → bloqueado.
- **Permissão (RLS):** perfil sem acesso não consegue abrir/agir em telas de admin (espera 403/redirect).
- Sessão expirada → redireciona ao login.

## Severidade
- **P0** bloqueia lançamento (fluxo de receita quebrado, dados vazando, crash).
- **P1** grave (funcionalidade importante quebrada, workaround difícil).
- **P2** menor (erro localizado, workaround fácil).
- **P3** cosmético.
