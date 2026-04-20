-- ─────────────────────────────────────────────────────────────────────────────
-- Admin hardening — rodar no Supabase SQL Editor antes do go-live.
--
-- Este script NÃO é uma migration automática: contém passos destrutivos
-- (remoção de usuário de teste, troca de senha) que devem ser auditados
-- e adaptados por um humano antes da execução.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Listar todos os usuários admin para revisão prévia.
--    Rode somente este bloco primeiro para ver o que existe:
--
-- select id, email, created_at, raw_app_meta_data->>'role' as role
-- from auth.users
-- where raw_app_meta_data->>'role' = 'admin'
-- order by created_at;


-- 2) REMOVER o usuário de teste usado em desenvolvimento.
--    AJUSTE o email antes de rodar.
--
-- delete from auth.users where email = 'teste@lojaescolar.com.br';


-- 3) CRIAR um novo admin em produção (ajuste email e senha forte).
--    Use uma senha gerada (mínimo 16 caracteres) e guarde-a em cofre
--    (1Password, Bitwarden, etc). O convite por email é preferível
--    ao set_password direto.
--
--    Caminho recomendado (via painel Supabase):
--      Authentication → Users → Invite user → marcar role depois
--
--    Caminho SQL (menos recomendado — senha em plaintext no log):
--
-- select auth.admin_create_user(
--   email       := 'admin@seudominio.com.br',
--   password    := 'TROQUE-ESTA-SENHA-16-CHARS-MIN',
--   email_confirm := true
-- );


-- 4) PROMOVER um usuário existente a admin.
--    AJUSTE o email.
--
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
-- where email = 'admin@seudominio.com.br';


-- 5) Auditoria final — confirme que só existe o admin esperado.
--
-- select id, email, raw_app_meta_data->>'role' as role, last_sign_in_at
-- from auth.users
-- where raw_app_meta_data->>'role' = 'admin'
-- order by created_at;


-- 6) Recomendações operacionais pós-execução:
--    a) Habilitar MFA no painel Supabase para cada admin
--       (Auth → Users → ... → Factor (TOTP)).
--    b) Ativar "Confirm email" em Auth → Providers → Email.
--    c) Em Auth → URL Configuration, garantir que só as URLs de produção
--       aparecem em Redirect URLs.
--    d) Revisar Auth → Rate Limits: OTPs, reset, sign-up dentro dos limites
--       adequados ao tamanho da base.
