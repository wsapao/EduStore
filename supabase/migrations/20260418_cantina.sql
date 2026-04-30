-- ============================================================
-- Módulo Cantina — migração completa
-- ============================================================

-- ── 1. cantina_produtos ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS cantina_produtos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id             UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  nome                  TEXT NOT NULL,
  descricao             TEXT,
  preco                 DECIMAL(10,2) NOT NULL CHECK (preco >= 0),
  categoria             TEXT NOT NULL DEFAULT 'lanche',
  icone                 TEXT NOT NULL DEFAULT '🍽️',
  ativo                 BOOLEAN NOT NULL DEFAULT true,
  estoque               INT,
  alergenos             TEXT[] NOT NULL DEFAULT '{}',
  disponivel_presencial BOOLEAN NOT NULL DEFAULT true,
  disponivel_online     BOOLEAN NOT NULL DEFAULT true,
  ordem                 INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. cantina_carteiras ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS cantina_carteiras (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id         UUID NOT NULL UNIQUE REFERENCES alunos(id) ON DELETE CASCADE,
  escola_id        UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  saldo            DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  limite_diario    DECIMAL(10,2),
  ativo            BOOLEAN NOT NULL DEFAULT true,
  bloqueio_motivo  TEXT,
  qr_token         TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  nfc_id           TEXT UNIQUE,
  senha_pin        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. cantina_movimentacoes ─────────────────────────────────
CREATE TABLE IF NOT EXISTS cantina_movimentacoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carteira_id         UUID NOT NULL REFERENCES cantina_carteiras(id) ON DELETE CASCADE,
  tipo                TEXT NOT NULL CHECK (tipo IN ('recarga','consumo','estorno','ajuste_manual')),
  valor               DECIMAL(10,2) NOT NULL CHECK (valor > 0),
  saldo_apos          DECIMAL(10,2) NOT NULL,
  descricao           TEXT,
  operador_id         UUID,
  pedido_cantina_id   UUID,
  gateway_pagamento_id TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. cantina_pedidos ───────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS cantina_pedidos_numero_seq;

CREATE TABLE IF NOT EXISTS cantina_pedidos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id       UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  aluno_id        UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  operador_id     UUID,
  tipo            TEXT NOT NULL CHECK (tipo IN ('presencial','online')),
  status          TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','confirmado','pronto','retirado','cancelado')),
  total           DECIMAL(10,2) NOT NULL,
  numero          BIGINT NOT NULL DEFAULT nextval('cantina_pedidos_numero_seq'),
  observacao      TEXT,
  movimentacao_id UUID REFERENCES cantina_movimentacoes(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. cantina_pedido_itens ──────────────────────────────────
CREATE TABLE IF NOT EXISTS cantina_pedido_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID NOT NULL REFERENCES cantina_pedidos(id) ON DELETE CASCADE,
  produto_id      UUID NOT NULL REFERENCES cantina_produtos(id) ON DELETE RESTRICT,
  quantidade      INT NOT NULL CHECK (quantidade > 0),
  preco_unitario  DECIMAL(10,2) NOT NULL
);

-- ── 6. cantina_restricoes ────────────────────────────────────
CREATE TABLE IF NOT EXISTS cantina_restricoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id    UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  produto_id  UUID REFERENCES cantina_produtos(id) ON DELETE CASCADE,
  categoria   TEXT,
  motivo      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cantina_carteiras_aluno      ON cantina_carteiras(aluno_id);
CREATE INDEX IF NOT EXISTS idx_cantina_carteiras_escola      ON cantina_carteiras(escola_id);
CREATE INDEX IF NOT EXISTS idx_cantina_movimentacoes_carteira ON cantina_movimentacoes(carteira_id);
CREATE INDEX IF NOT EXISTS idx_cantina_movimentacoes_tipo    ON cantina_movimentacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_cantina_movimentacoes_created ON cantina_movimentacoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cantina_produtos_escola       ON cantina_produtos(escola_id);
CREATE INDEX IF NOT EXISTS idx_cantina_produtos_ativo        ON cantina_produtos(ativo);
CREATE INDEX IF NOT EXISTS idx_cantina_pedidos_aluno         ON cantina_pedidos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_cantina_pedidos_escola        ON cantina_pedidos(escola_id);
CREATE INDEX IF NOT EXISTS idx_cantina_pedidos_status        ON cantina_pedidos(status);
CREATE INDEX IF NOT EXISTS idx_cantina_restricoes_aluno      ON cantina_restricoes(aluno_id);

-- ── RPC: debitar_saldo_cantina ───────────────────────────────
CREATE OR REPLACE FUNCTION debitar_saldo_cantina(
  p_carteira_id  UUID,
  p_valor        DECIMAL,
  p_descricao    TEXT    DEFAULT NULL,
  p_operador_id  UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_carteira        cantina_carteiras%ROWTYPE;
  v_consumo_hoje    DECIMAL(10,2);
  v_saldo_apos      DECIMAL(10,2);
  v_movimentacao_id UUID;
BEGIN
  -- Lock da linha para evitar race conditions
  SELECT * INTO v_carteira
  FROM cantina_carteiras
  WHERE id = p_carteira_id
  FOR UPDATE;

  -- Validações
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Carteira não encontrada.');
  END IF;

  IF NOT v_carteira.ativo THEN
    RETURN jsonb_build_object('ok', false, 'erro',
      COALESCE('Carteira bloqueada: ' || v_carteira.bloqueio_motivo, 'Carteira bloqueada.'));
  END IF;

  IF v_carteira.saldo < p_valor THEN
    RETURN jsonb_build_object('ok', false, 'erro',
      'Saldo insuficiente. Saldo atual: R$ ' || v_carteira.saldo::text);
  END IF;

  -- Verificar limite diário
  IF v_carteira.limite_diario IS NOT NULL THEN
    SELECT COALESCE(SUM(valor), 0) INTO v_consumo_hoje
    FROM cantina_movimentacoes
    WHERE carteira_id = p_carteira_id
      AND tipo = 'consumo'
      AND created_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';

    IF (v_consumo_hoje + p_valor) > v_carteira.limite_diario THEN
      RETURN jsonb_build_object('ok', false, 'erro',
        'Limite diário excedido. Disponível hoje: R$ ' ||
        GREATEST(0, v_carteira.limite_diario - v_consumo_hoje)::text);
    END IF;
  END IF;

  -- Débito
  v_saldo_apos := v_carteira.saldo - p_valor;

  UPDATE cantina_carteiras
  SET saldo = v_saldo_apos, updated_at = now()
  WHERE id = p_carteira_id;

  INSERT INTO cantina_movimentacoes (carteira_id, tipo, valor, saldo_apos, descricao, operador_id)
  VALUES (p_carteira_id, 'consumo', p_valor, v_saldo_apos, p_descricao, p_operador_id)
  RETURNING id INTO v_movimentacao_id;

  RETURN jsonb_build_object(
    'ok', true,
    'saldo_apos', v_saldo_apos,
    'movimentacao_id', v_movimentacao_id
  );
END;
$$;

-- ── RPC: creditar_saldo_cantina ──────────────────────────────
CREATE OR REPLACE FUNCTION creditar_saldo_cantina(
  p_carteira_id   UUID,
  p_valor         DECIMAL,
  p_descricao     TEXT    DEFAULT NULL,
  p_operador_id   UUID    DEFAULT NULL,
  p_gateway_id    TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_saldo_apos      DECIMAL(10,2);
  v_movimentacao_id UUID;
BEGIN
  UPDATE cantina_carteiras
  SET saldo = saldo + p_valor, updated_at = now()
  WHERE id = p_carteira_id
  RETURNING saldo INTO v_saldo_apos;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Carteira não encontrada.');
  END IF;

  INSERT INTO cantina_movimentacoes (
    carteira_id, tipo, valor, saldo_apos, descricao, operador_id, gateway_pagamento_id
  )
  VALUES (
    p_carteira_id, 'recarga', p_valor, v_saldo_apos, p_descricao, p_operador_id, p_gateway_id
  )
  RETURNING id INTO v_movimentacao_id;

  RETURN jsonb_build_object(
    'ok', true,
    'saldo_apos', v_saldo_apos,
    'movimentacao_id', v_movimentacao_id
  );
END;
$$;

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE cantina_produtos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cantina_carteiras      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cantina_movimentacoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cantina_pedidos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cantina_pedido_itens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cantina_restricoes     ENABLE ROW LEVEL SECURITY;

-- Produtos: todos autenticados veem produtos ativos
CREATE POLICY "cantina_produtos_select_auth"
  ON cantina_produtos FOR SELECT
  TO authenticated
  USING (ativo = true);

CREATE POLICY "cantina_produtos_all_admin"
  ON cantina_produtos FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Carteiras: responsável vê carteiras dos seus alunos
CREATE POLICY "cantina_carteiras_responsavel_select"
  ON cantina_carteiras FOR SELECT
  TO authenticated
  USING (
    aluno_id IN (
      SELECT ra.aluno_id
      FROM responsavel_aluno ra
      WHERE ra.responsavel_id = auth.uid()
    )
  );

CREATE POLICY "cantina_carteiras_admin_all"
  ON cantina_carteiras FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'operador'
  );

-- Movimentações: responsável vê movimentações das carteiras dos seus alunos
CREATE POLICY "cantina_movimentacoes_responsavel_select"
  ON cantina_movimentacoes FOR SELECT
  TO authenticated
  USING (
    carteira_id IN (
      SELECT cc.id
      FROM cantina_carteiras cc
      JOIN responsavel_aluno ra ON ra.aluno_id = cc.aluno_id
      WHERE ra.responsavel_id = auth.uid()
    )
  );

CREATE POLICY "cantina_movimentacoes_admin_all"
  ON cantina_movimentacoes FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'operador'
  );

-- Pedidos: responsável vê pedidos dos seus alunos
CREATE POLICY "cantina_pedidos_responsavel_select"
  ON cantina_pedidos FOR SELECT
  TO authenticated
  USING (
    aluno_id IN (
      SELECT ra.aluno_id
      FROM responsavel_aluno ra
      WHERE ra.responsavel_id = auth.uid()
    )
  );

CREATE POLICY "cantina_pedidos_admin_all"
  ON cantina_pedidos FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'operador'
  );

-- Itens de pedido
CREATE POLICY "cantina_pedido_itens_responsavel_select"
  ON cantina_pedido_itens FOR SELECT
  TO authenticated
  USING (
    pedido_id IN (
      SELECT cp.id
      FROM cantina_pedidos cp
      JOIN responsavel_aluno ra ON ra.aluno_id = cp.aluno_id
      WHERE ra.responsavel_id = auth.uid()
    )
  );

CREATE POLICY "cantina_pedido_itens_admin_all"
  ON cantina_pedido_itens FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'operador'
  );

-- Restrições
CREATE POLICY "cantina_restricoes_responsavel_select"
  ON cantina_restricoes FOR SELECT
  TO authenticated
  USING (
    aluno_id IN (
      SELECT ra.aluno_id
      FROM responsavel_aluno ra
      WHERE ra.responsavel_id = auth.uid()
    )
  );

CREATE POLICY "cantina_restricoes_admin_all"
  ON cantina_restricoes FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ── updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_cantina_carteiras_updated_at'
  ) THEN
    CREATE TRIGGER trg_cantina_carteiras_updated_at
      BEFORE UPDATE ON cantina_carteiras
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_cantina_pedidos_updated_at'
  ) THEN
    CREATE TRIGGER trg_cantina_pedidos_updated_at
      BEFORE UPDATE ON cantina_pedidos
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;
