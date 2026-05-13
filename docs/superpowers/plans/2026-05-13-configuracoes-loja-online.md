# Configuracoes - Modulo Loja Online (Plano de Implementacao)

**Goal:** implementar `/admin/configuracoes/loja-online` e fazer a loja publica respeitar modo manutencao, horario opcional de funcionamento, categorias visiveis/reordenadas, produtos em destaque, layout da home e texto de rodape.

**Architecture:** a configuracao continua centralizada em `escola_configuracoes`. O que ja existe (`modo_manutencao`, `modo_manutencao_mensagem`, `layout_home`, `mostrar_estoque_baixo`, `texto_rodape`) permanece na mesma tabela. O que falta para fechar o escopo sera adicionado em uma migration incremental: horario opcional da loja, lista ordenada de categorias visiveis e lista ordenada de produtos em destaque. A tela admin salva tudo por uma unica Server Action. A loja publica e `createOrderAction` reutilizam o mesmo helper para aplicar manutencao e horario sem divergencia.

**Tech Stack:** Next.js 15 App Router · Supabase · TypeScript · Vitest

**Spec:** `docs/superpowers/specs/2026-05-11-configuracoes-loja-design.md` secao 5.6

**Branch:** `feat/configuracoes-loja-online`

## Ajuste de escopo

O roadmap `2026-05-12-roadmap-fases-2-3.md` marca este modulo como "sem migration", mas o estado atual da base nao possui persistencia para:

- horario de funcionamento da loja
- categorias visiveis da home com ordem configuravel
- produtos em destaque

Portanto, o plano executavel correto inclui **1 migration pequena** para completar `escola_configuracoes`.

## Decisoes fechadas neste plano

1. **Permissao:** usar `configuracoes.editar_identidade`, seguindo o spec e a sidebar atual.
2. **Horario opcional:** se `loja_funcionamento` estiver vazio, a loja fica **24h aberta**.
3. **Visibilidade + ordem das categorias:** um unico array `categorias_home_visiveis` guarda os nomes das categorias na ordem desejada. Categoria omitida = categoria escondida. Valor `null` = usar todas as categorias encontradas na loja.
4. **Produtos em destaque:** `produtos_home_destaque` guarda ate 6 IDs de produtos, preservando a ordem escolhida no admin.
5. **Reordenacao no admin:** usar botoes `↑` e `↓` no primeiro corte. Nao adicionar drag-and-drop agora.
6. **Enforcement real:** manutencao e horario nao ficam so na UI da home; `createOrderAction` tambem bloqueia pedido fora da regra.
7. **Horario com multiplas janelas:** salvar como lista de janelas independentes (`dia`, `inicio`, `fim`). Array vazio continua significando 24h aberto.

## Modelo de dados

### Colunas novas

Criar migration:

`supabase/migrations/20260513_loja_online_complementos.sql`

SQL alvo:

```sql
ALTER TABLE escola_configuracoes
  ADD COLUMN IF NOT EXISTS loja_funcionamento JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS categorias_home_visiveis TEXT[],
  ADD COLUMN IF NOT EXISTS produtos_home_destaque UUID[] NOT NULL DEFAULT '{}'::uuid[];
```

### Formato de `loja_funcionamento`

```json
[
  { "dia": 1, "inicio": "07:00", "fim": "12:00" },
  { "dia": 1, "inicio": "13:00", "fim": "18:00" },
  { "dia": 2, "inicio": "07:00", "fim": "18:00" }
]
```

Regras:

- `dia`: `0-6` (`0 = domingo`)
- `inicio` e `fim`: `HH:mm`
- `inicio < fim`
- array vazio = sem restricao de horario

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260513_loja_online_complementos.sql` | Completar `escola_configuracoes` |
| `types/database.ts` | Tipos de `EscolaConfiguracoes` |
| `lib/loja-online/config.ts` | Helper de leitura, normalizacao e regras operacionais |
| `tests/lib/loja-online-config.test.ts` | Testes do helper |
| `app/actions/configuracoes/loja-online.ts` | Server Action unica do modulo |
| `tests/configuracoes/loja-online.test.ts` | Testes da action |
| `app/(admin)/admin/configuracoes/loja-online/page.tsx` | Pagina server do admin |
| `app/(admin)/admin/configuracoes/loja-online/LojaOnlineForm.tsx` | Form client do modulo |
| `app/(admin)/admin/configuracoes/page.tsx` | Card de acesso ao modulo |
| `app/(loja)/loja/page.tsx` | Home publica respeitando a configuracao |
| `components/loja/CategoryFilter.tsx` | Tabs dinamicas em vez de mapa hard-coded |
| `components/loja/ProductCard.tsx` | Badge de escassez condicionado a config |
| `app/actions/orders.ts` | Bloqueio real de pedidos em manutencao/fora do horario |

## Task 1: Helper de dominio e testes

**Files:**

- Create: `lib/loja-online/config.ts`
- Create: `tests/lib/loja-online-config.test.ts`

- [ ] Escrever testes para:
  - array de horario vazio => loja disponivel 24h
  - horario configurado e agora dentro da janela => disponivel
  - horario configurado e agora fora da janela => indisponivel
  - categorias visiveis `null` => usa todas as categorias presentes na loja
  - lista de categorias configurada => filtra e preserva ordem
  - produtos em destaque com mais de 6 IDs => helper limita a 6
  - produtos em destaque com IDs inexistentes/inativos => helper ignora

- [ ] Rodar:

```bash
npm test -- loja-online-config
```

Expected: FAIL por modulo inexistente.

- [ ] Implementar `lib/loja-online/config.ts` com:
  - `type LojaFuncionamentoSlot = { dia: number; inicio: string; fim: string }`
  - `normalizeLojaFuncionamento(raw): LojaFuncionamentoSlot[]`
  - `isLojaDisponivelAgora(slots, now = new Date()): boolean`
  - `buildCategoriasHome({ categoriasConfig, categoriasDescobertas }): string[]`
  - `pickProdutosDestaque(ids, produtos): Produto[]`

- [ ] Rodar novamente:

```bash
npm test -- loja-online-config
```

Expected: PASS.

- [ ] Commit sugerido:

```bash
git add lib/loja-online/config.ts tests/lib/loja-online-config.test.ts
git commit -m "test(loja-online): cobre regras de manutencao e horario da loja"
```

## Task 2: Migration e sincronizacao de tipos

**Files:**

- Create: `supabase/migrations/20260513_loja_online_complementos.sql`
- Update: `types/database.ts`

- [ ] Criar a migration incremental com as 3 colunas faltantes.
- [ ] Atualizar `EscolaConfiguracoes` com:
  - `loja_funcionamento: Array<{ dia: number; inicio: string; fim: string }>`
  - `categorias_home_visiveis: string[] | null`
  - `produtos_home_destaque: string[]`

- [ ] Garantir que o tipo continue alinhado com o que a pagina admin e a home vao consumir.

- [ ] Rodar:

```bash
npm run build
```

Expected: sem erro de tipos relacionado a `EscolaConfiguracoes`.

- [ ] Commit sugerido:

```bash
git add supabase/migrations/20260513_loja_online_complementos.sql types/database.ts
git commit -m "feat(db): completa schema da loja online"
```

## Task 3: Server Action `atualizarLojaOnlineAction`

**Files:**

- Create: `app/actions/configuracoes/loja-online.ts`
- Create: `tests/configuracoes/loja-online.test.ts`

- [ ] Escrever testes para:
  - exige `requirePermission('configuracoes.editar_identidade')`
  - rejeita `layout_home` invalido
  - aceita horario vazio e persiste `[]`
  - rejeita slot com hora invalida
  - rejeita slot com `inicio >= fim`
  - rejeita mais de 6 produtos em destaque
  - normaliza/remueve duplicados em categorias e produtos
  - persiste payload completo no caminho feliz
  - retorna erro quando `escola_id` nao for encontrado
  - retorna erro quando o `update` falhar

- [ ] Rodar:

```bash
npm test -- loja-online
```

Expected: FAIL por action inexistente.

- [ ] Implementar a action:
  - chamar `requirePermission('configuracoes.editar_identidade')`
  - obter `escolaId` via `getEscolaIdParaAdmin`
  - ler `modo_manutencao`, `modo_manutencao_mensagem`, `layout_home`, `mostrar_estoque_baixo`, `texto_rodape`
  - ler JSON de `loja_funcionamento`
  - ler arrays de `categorias_home_visiveis` e `produtos_home_destaque`
  - validar `layout_home in ('grid', 'lista')`
  - validar slots de horario
  - permitir `loja_funcionamento = []` sem erro
  - deduplicar categorias e produtos preservando ordem
  - rejeitar mais de 6 produtos em destaque
  - opcionalmente validar que os produtos destacados pertencem a escola e estao ativos
  - atualizar `escola_configuracoes`
  - `revalidatePath('/admin/configuracoes/loja-online')`
  - `revalidatePath('/loja')`

- [ ] Rodar novamente:

```bash
npm test -- loja-online
```

Expected: PASS.

- [ ] Commit sugerido:

```bash
git add app/actions/configuracoes/loja-online.ts tests/configuracoes/loja-online.test.ts
git commit -m "feat(config): adiciona action de loja online"
```

## Task 4: Tela admin `/admin/configuracoes/loja-online`

**Files:**

- Create: `app/(admin)/admin/configuracoes/loja-online/page.tsx`
- Create: `app/(admin)/admin/configuracoes/loja-online/LojaOnlineForm.tsx`
- Update: `app/(admin)/admin/configuracoes/page.tsx`

- [ ] Criar `page.tsx` espelhando o padrao de `pagamentos/page.tsx`:
  - guard com `hasPermission('configuracoes.editar_identidade')`
  - buscar `escola_configuracoes`
  - buscar `categorias_produto` da escola
  - buscar produtos ativos da escola para a selecao de destaque

- [ ] Criar `LojaOnlineForm.tsx` com 5 blocos:
  - **Modo manutencao**
    - checkbox
    - textarea de mensagem custom
  - **Horario de funcionamento**
    - texto explicativo: "Deixe sem horarios para manter a loja aberta 24h."
    - lista editavel de slots com `dia`, `inicio`, `fim`
    - botoes adicionar/remover
  - **Layout e apresentacao**
    - radio `grid` / `lista`
    - toggle `mostrar_estoque_baixo`
    - textarea `texto_rodape`
  - **Categorias visiveis na home**
    - lista ordenavel com `↑` e `↓`
    - checkbox para mostrar/esconder
  - **Produtos em destaque**
    - seletor com no maximo 6 itens
    - ordem preservada

- [ ] Atualizar `app/(admin)/admin/configuracoes/page.tsx` para incluir o card:
  - href: `/admin/configuracoes/loja-online`
  - titulo: `Loja Online`
  - descricao: `Manutencao, horario, layout e destaque da home`
  - perm: `configuracoes.editar_identidade`

- [ ] Rodar:

```bash
npm run build
```

Expected: rota admin compila sem erro.

- [ ] Commit sugerido:

```bash
git add app/(admin)/admin/configuracoes/loja-online app/(admin)/admin/configuracoes/page.tsx
git commit -m "feat(config): cria tela de loja online no admin"
```

## Task 5: Home publica `/loja`

**Files:**

- Update: `app/(loja)/loja/page.tsx`
- Update: `components/loja/CategoryFilter.tsx`
- Update: `components/loja/ProductCard.tsx`

- [ ] Refatorar `app/(loja)/loja/page.tsx` para ler `escola_configuracoes` da escola do responsavel.

- [ ] Aplicar comportamento:
  - se `modo_manutencao = true`, renderizar tela de bloqueio com a mensagem configurada e nao mostrar catalogo
  - se `isLojaDisponivelAgora(...) = false`, mostrar aviso de loja fechada acima do catalogo
  - se `categorias_home_visiveis = null`, usar todas as categorias encontradas nos produtos
  - se `categorias_home_visiveis` vier preenchido, mostrar apenas essas categorias e nessa ordem
  - montar secao de **Destaques** antes das secoes normais quando houver produtos configurados
  - respeitar `layout_home`:
    - `lista`: manter cards empilhados como hoje
    - `grid`: usar `gridTemplateColumns: repeat(auto-fit, minmax(260px, 1fr))`
  - renderizar `texto_rodape` no final da pagina quando existir

- [ ] Refatorar `CategoryFilter.tsx`:
  - parar de depender apenas de `CATEGORIAS` hard-coded
  - aceitar uma lista dinamica de tabs/meta vinda da pagina
  - usar fallback local para label/icon quando a categoria nao existir em `categorias_produto`

- [ ] Refatorar `ProductCard.tsx`:
  - adicionar prop opcional `showLowStockBadge?: boolean`
  - quando `false`, esconder badges de baixa disponibilidade
  - quando `true`, manter badge para estoque/vagas baixas

- [ ] Rodar:

```bash
npm run build
```

Expected: home publica compila com as novas props e sem regressao de tipo.

- [ ] Commit sugerido:

```bash
git add app/(loja)/loja/page.tsx components/loja/CategoryFilter.tsx components/loja/ProductCard.tsx
git commit -m "feat(loja): aplica configuracoes da home publica"
```

## Task 6: Enforcement no checkout

**Files:**

- Update: `app/actions/orders.ts`

- [ ] Importar o helper de disponibilidade da loja.
- [ ] Antes de criar o pedido:
  - buscar `escola_configuracoes` da escola do responsavel
  - se `modo_manutencao`, retornar erro amigavel
  - se `loja_funcionamento` estiver configurado e agora estiver fora da janela, retornar erro amigavel
  - se `loja_funcionamento` estiver vazio, nao bloquear

- [ ] Mensagens sugeridas:
  - manutencao: `A loja esta temporariamente em manutencao. Tente novamente mais tarde.`
  - fora do horario: `A loja esta fechada neste horario. Tente novamente durante o periodo de funcionamento.`

- [ ] Rodar:

```bash
npm test -- loja-online
```

Expected: testes do helper/action continuam verdes.

- [ ] Commit sugerido:

```bash
git add app/actions/orders.ts
git commit -m "feat(checkout): bloqueia pedidos fora das regras da loja"
```

## Task 7: Validacao final

- [ ] Rodar testes focados:

```bash
npm test -- loja-online
npm test -- loja-online-config
```

Expected: PASS.

- [ ] Rodar regressao de configuracoes:

```bash
npm test -- configuracoes
```

Expected: PASS.

- [ ] Rodar build:

```bash
npm run build
```

Expected: build completa sem erros.

- [ ] Smoke manual:
  - abrir `/admin/configuracoes/loja-online`
  - salvar sem horarios configurados e confirmar comportamento 24h
  - ligar manutencao e validar bloqueio visual na `/loja`
  - configurar um horario curto e validar banner/fechamento fora da janela
  - selecionar categorias e alterar ordem com `↑` / `↓`
  - selecionar ate 6 destaques
  - alternar `layout_home` entre `grid` e `lista`
  - preencher `texto_rodape`
  - tentar finalizar pedido fora do horario e confirmar bloqueio em `createOrderAction`

## Riscos e pontos de atencao

- A home atual usa categorias hard-coded em `CategoryFilter`; esse trecho precisa virar dinamico sem quebrar labels existentes.
- O roadmap original nao previa migration; sem corrigi-lo, a implementacao ficaria inconsistente com o schema atual.
- `grid` e `lista` sao conceitos novos para a home atual; a mudanca precisa preservar boa leitura em mobile.
- `mostrar_estoque_baixo` deve controlar os badges de baixa disponibilidade; nao criar uma segunda regra paralela.
- Como o horario e opcional, o caso vazio precisa ser testado explicitamente para nao virar falso negativo de "loja fechada".

## Definicao de pronto

O modulo so esta concluido quando:

- existe tela admin funcional em `/admin/configuracoes/loja-online`
- a configuracao persiste em `escola_configuracoes`
- a home publica respeita manutencao, horario, layout, categorias, destaques e rodape
- `createOrderAction` tambem respeita manutencao/horario
- testes e build passam
