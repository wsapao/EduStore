-- ============================================================
-- Cria a função seed_papeis_presets(escola_id) que insere os 6
-- papéis de fábrica e suas permissões para uma escola.
-- Roda automaticamente para escolas existentes e fica conectada
-- a um trigger AFTER INSERT em escolas.
--
-- Mapa de permissões reflete o spec (seção 3.5).
-- ============================================================

CREATE OR REPLACE FUNCTION seed_papeis_presets(p_escola_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
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
    'configuracoes.ver','configuracoes.editar_identidade','configuracoes.editar_pagamentos','configuracoes.gerenciar_usuarios','configuracoes.gerenciar_papeis'
  ];

  c_visualizador TEXT[] := ARRAY[
    'produtos.ver','categorias.ver','pedidos.ver','pagamentos.ver','vouchers.ver',
    'alunos.ver','responsaveis.ver','cantina.ver','relatorios.ver','receita.ver',
    'configuracoes.ver'
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
    (v_financeiro_id, 'configuracoes.ver')
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

  -- Operador: pdv.usar + checkin.usar + pedidos.ver
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
    (v_operador_id, 'pedidos.ver')
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

-- Seed para escolas existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM escolas LOOP
    PERFORM seed_papeis_presets(r.id);
  END LOOP;
END;
$$;

-- Trigger pra novas escolas
CREATE OR REPLACE FUNCTION trg_seed_papeis_nova_escola()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM seed_papeis_presets(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escolas_seed_papeis ON escolas;
CREATE TRIGGER escolas_seed_papeis
  AFTER INSERT ON escolas
  FOR EACH ROW EXECUTE FUNCTION trg_seed_papeis_nova_escola();
