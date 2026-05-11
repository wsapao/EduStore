-- ============================================================
-- Tabela escola_configuracoes
-- 1:1 com escolas, guarda todas as configurações operacionais
-- não-sensíveis (pagamentos, cantina, checkout, loja online).
-- ============================================================

CREATE TABLE IF NOT EXISTS escola_configuracoes (
  escola_id                       UUID PRIMARY KEY REFERENCES escolas(id) ON DELETE CASCADE,

  -- Pagamentos
  metodos_aceitos_padrao          TEXT[]  NOT NULL DEFAULT ARRAY['pix','cartao','boleto'],
  max_parcelas_padrao             INT     NOT NULL DEFAULT 12 CHECK (max_parcelas_padrao BETWEEN 1 AND 12),
  pix_expiracao_segundos          INT     NOT NULL DEFAULT 1800 CHECK (pix_expiracao_segundos > 0),
  taxa_cartao_repassada           BOOLEAN NOT NULL DEFAULT false,
  taxa_cartao_percentual          NUMERIC(5,2) CHECK (taxa_cartao_percentual IS NULL OR (taxa_cartao_percentual >= 0 AND taxa_cartao_percentual <= 100)),
  asaas_webhook_secret            TEXT,
  pix_chave_recebedora            TEXT,

  -- Cantina (Fase 2)
  cantina_recarga_min             NUMERIC(10,2) NOT NULL DEFAULT 10 CHECK (cantina_recarga_min >= 0),
  cantina_recarga_max             NUMERIC(10,2) NOT NULL DEFAULT 500 CHECK (cantina_recarga_max >= cantina_recarga_min),
  cantina_metodos_recarga         TEXT[]  NOT NULL DEFAULT ARRAY['pix','cartao'],
  cantina_exige_pin               BOOLEAN NOT NULL DEFAULT true,
  cantina_pin_tamanho             INT     NOT NULL DEFAULT 4 CHECK (cantina_pin_tamanho BETWEEN 4 AND 6),
  cantina_saldo_negativo          BOOLEAN NOT NULL DEFAULT false,

  -- Checkout (Fase 2)
  termo_padrao_compra             TEXT,
  permite_multiplos_alunos        BOOLEAN NOT NULL DEFAULT true,
  mensagem_pos_compra             TEXT,
  carrinho_expiracao_minutos      INT     NOT NULL DEFAULT 60 CHECK (carrinho_expiracao_minutos > 0),
  exige_cpf_responsavel           BOOLEAN NOT NULL DEFAULT true,

  -- Loja Online (Fase 2)
  modo_manutencao                 BOOLEAN NOT NULL DEFAULT false,
  modo_manutencao_mensagem        TEXT,
  layout_home                     TEXT    NOT NULL DEFAULT 'grid' CHECK (layout_home IN ('grid','lista')),
  mostrar_estoque_baixo           BOOLEAN NOT NULL DEFAULT true,
  texto_rodape                    TEXT,

  -- E-mail (Fase 2)
  email_remetente_nome            TEXT,
  email_remetente_endereco        TEXT,
  email_logo_url                  TEXT,

  -- LGPD (Fase 2)
  dpo_email                       TEXT,

  -- Integrações (Fase 2 — flags simples; credenciais ainda em env)
  activesoft_ativo                BOOLEAN NOT NULL DEFAULT false,
  crm_ativo                       BOOLEAN NOT NULL DEFAULT false,
  ga4_id                          TEXT,
  meta_pixel_id                   TEXT,

  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escola_configuracoes_set_updated_at ON escola_configuracoes;
CREATE TRIGGER escola_configuracoes_set_updated_at
  BEFORE UPDATE ON escola_configuracoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed: cria linha em escola_configuracoes para cada escola existente
INSERT INTO escola_configuracoes (escola_id)
SELECT id FROM escolas
ON CONFLICT (escola_id) DO NOTHING;

-- Trigger para criar configuração automaticamente quando uma escola é criada
CREATE OR REPLACE FUNCTION criar_escola_configuracoes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO escola_configuracoes (escola_id) VALUES (NEW.id)
  ON CONFLICT (escola_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escolas_criar_configuracoes ON escolas;
CREATE TRIGGER escolas_criar_configuracoes
  AFTER INSERT ON escolas
  FOR EACH ROW EXECUTE FUNCTION criar_escola_configuracoes();
