-- ============================================================
-- Permissão concurso.ver (Concurso de Bolsas Esportivas)
--
-- 1) Concede concurso.ver aos papéis existentes que já têm
--    pedidos.ver (Admin, Gerente, Financeiro, Operador,
--    Visualizador) — mesmo conjunto de acesso ao admin.
-- 2) Atualiza seed_papeis_presets() para que novas escolas
--    recebam a chave (c_all/c_visualizador espelham
--    lib/permissoes/keys.ts).
-- ============================================================

-- 1) Grant para papéis existentes (idempotente)
INSERT INTO papel_permissoes (papel_id, chave)
SELECT DISTINCT papel_id, 'concurso.ver'
FROM papel_permissoes
WHERE chave = 'pedidos.ver'
ON CONFLICT DO NOTHING;

-- 2) Atualiza a função de seed dos papéis de fábrica
CREATE OR REPLACE FUNCTION seed_papeis_presets(p_escola_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin_id        UUID;
  v_gerente_id      UUID;
  v_financeiro_id   UUID;
  v_cantineiro_id   UUID;
  v_operador_id     UUID;
  v_visualizador_id UUID;

  -- Lista completa de chaves de permissão (espelha lib/permissoes/keys.ts)
  c_all TEXT[] := ARRAY[
    'produtos.ver','produtos.criar','produtos.editar','produtos.excluir',
    'categorias.ver','categorias.gerenciar',
    'pedidos.ver','pedidos.estornar','pedidos.cancelar',
    'pagamentos.ver','pagamentos.estornar',
    'vouchers.ver','vouchers.gerenciar',
    'alunos.ver','alunos.editar',
    'responsaveis.ver','responsaveis.editar',
    'checkin.usar',
    'pdv.usar',
    'cantina.ver','cantina.operar','cantina.gerenciar',
    'relatorios.ver',
    'receita.ver',
    'configuracoes.ver','configuracoes.editar_identidade','configuracoes.editar_pagamentos','configuracoes.gerenciar_usuarios','configuracoes.gerenciar_papeis',
    'concurso.ver'
  ];

  c_visualizador TEXT[] := ARRAY[
    'produtos.ver','categorias.ver','pedidos.ver','pagamentos.ver','vouchers.ver',
    'alunos.ver','responsaveis.ver','cantina.ver','relatorios.ver','receita.ver',
    'configuracoes.ver','concurso.ver'
  ];
BEGIN
  -- Admin: todas
  INSERT INTO papeis (escola_id, nome, descricao, preset, chave_preset)
    VALUES (p_escola_id, 'Admin', 'Acesso total ao sistema', true, 'admin')
  ON CONFLICT (escola_id, chave_preset) DO NOTHING
  RETURNING id INTO v_admin_id;
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM papeis WHERE escola_id = p_escola_id AND chave_preset = 'admin';
  END IF;
  INSERT INTO papel_permissoes (papel_id, chave)
    SELECT v_admin_id, unnest(c_all)
  ON CONFLICT DO NOTHING;

  -- Gerente: todas exceto gerenciar usuários e gerenciar papéis
  INSERT INTO papeis (escola_id, nome, descricao, preset, chave_preset)
    VALUES (p_escola_id, 'Gerente', 'Acesso operacional completo, sem gestão de usuários/papéis', true, 'gerente')
  ON CONFLICT (escola_id, chave_preset) DO NOTHING
  RETURNING id INTO v_gerente_id;
  IF v_gerente_id IS NULL THEN
    SELECT id INTO v_gerente_id FROM papeis WHERE escola_id = p_escola_id AND chave_preset = 'gerente';
  END IF;
  INSERT INTO papel_permissoes (papel_id, chave)
    SELECT v_gerente_id, c FROM unnest(c_all) AS c
    WHERE c NOT IN ('configuracoes.gerenciar_usuarios','configuracoes.gerenciar_papeis')
  ON CONFLICT DO NOTHING;

  -- Financeiro: visualizações + estornos + relatórios + receita
  INSERT INTO papeis (escola_id, nome, descricao, preset, chave_preset)
    VALUES (p_escola_id, 'Financeiro', 'Visualização ampla + estornos e relatórios', true, 'financeiro')
  ON CONFLICT (escola_id, chave_preset) DO NOTHING
  RETURNING id INTO v_financeiro_id;
  IF v_financeiro_id IS NULL THEN
    SELECT id INTO v_financeiro_id FROM papeis WHERE escola_id = p_escola_id AND chave_preset = 'financeiro';
  END IF;
  INSERT INTO papel_permissoes (papel_id, chave) VALUES
    (v_financeiro_id, 'produtos.ver'),
    (v_financeiro_id, 'categorias.ver'),
    (v_financeiro_id, 'pedidos.ver'),
    (v_financeiro_id, 'pedidos.estornar'),
    (v_financeiro_id, 'pagamentos.ver'),
    (v_financeiro_id, 'pagamentos.estornar'),
    (v_financeiro_id, 'vouchers.ver'),
    (v_financeiro_id, 'alunos.ver'),
    (v_financeiro_id, 'responsaveis.ver'),
    (v_financeiro_id, 'cantina.ver'),
    (v_financeiro_id, 'relatorios.ver'),
    (v_financeiro_id, 'receita.ver'),
    (v_financeiro_id, 'configuracoes.ver'),
    (v_financeiro_id, 'concurso.ver')
  ON CONFLICT DO NOTHING;

  -- Cantineiro: cantina.* + alunos.ver + pdv.usar
  INSERT INTO papeis (escola_id, nome, descricao, preset, chave_preset)
    VALUES (p_escola_id, 'Cantineiro', 'Operação de cantina e PDV', true, 'cantineiro')
  ON CONFLICT (escola_id, chave_preset) DO NOTHING
  RETURNING id INTO v_cantineiro_id;
  IF v_cantineiro_id IS NULL THEN
    SELECT id INTO v_cantineiro_id FROM papeis WHERE escola_id = p_escola_id AND chave_preset = 'cantineiro';
  END IF;
  INSERT INTO papel_permissoes (papel_id, chave) VALUES
    (v_cantineiro_id, 'cantina.ver'),
    (v_cantineiro_id, 'cantina.operar'),
    (v_cantineiro_id, 'cantina.gerenciar'),
    (v_cantineiro_id, 'alunos.ver'),
    (v_cantineiro_id, 'pdv.usar')
  ON CONFLICT DO NOTHING;

  -- Operador: pdv.usar + checkin.usar + pedidos.ver + concurso.ver
  INSERT INTO papeis (escola_id, nome, descricao, preset, chave_preset)
    VALUES (p_escola_id, 'Operador', 'PDV e check-in de pedidos', true, 'operador')
  ON CONFLICT (escola_id, chave_preset) DO NOTHING
  RETURNING id INTO v_operador_id;
  IF v_operador_id IS NULL THEN
    SELECT id INTO v_operador_id FROM papeis WHERE escola_id = p_escola_id AND chave_preset = 'operador';
  END IF;
  INSERT INTO papel_permissoes (papel_id, chave) VALUES
    (v_operador_id, 'pdv.usar'),
    (v_operador_id, 'checkin.usar'),
    (v_operador_id, 'pedidos.ver'),
    (v_operador_id, 'concurso.ver')
  ON CONFLICT DO NOTHING;

  -- Visualizador: somente leituras
  INSERT INTO papeis (escola_id, nome, descricao, preset, chave_preset)
    VALUES (p_escola_id, 'Visualizador', 'Somente leitura', true, 'visualizador')
  ON CONFLICT (escola_id, chave_preset) DO NOTHING
  RETURNING id INTO v_visualizador_id;
  IF v_visualizador_id IS NULL THEN
    SELECT id INTO v_visualizador_id FROM papeis WHERE escola_id = p_escola_id AND chave_preset = 'visualizador';
  END IF;
  INSERT INTO papel_permissoes (papel_id, chave)
    SELECT v_visualizador_id, unnest(c_visualizador)
  ON CONFLICT DO NOTHING;
END;
$$;
