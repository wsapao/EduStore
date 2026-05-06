-- Renomeia senha_pin para senha_pin_hash — deixa explícito que é um hash bcrypt.
-- PINs existentes em plaintext são invalidados: usuários precisarão redefinir o PIN.
ALTER TABLE cantina_carteiras
  RENAME COLUMN senha_pin TO senha_pin_hash;

UPDATE cantina_carteiras SET senha_pin_hash = NULL WHERE senha_pin_hash IS NOT NULL;

COMMENT ON COLUMN cantina_carteiras.senha_pin_hash IS 'bcrypt hash do PIN de 4 dígitos. NULL = sem PIN configurado.';
