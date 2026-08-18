-- ═════════════════════════════════════════════════════════════
-- 014_usuarios_clerk_link.sql
-- Vinculación segura Clerk ↔ ERP en bot_usuarios.
--
-- Objetivo:
-- - agregar cclerk_user_id nullable
-- - garantizar unicidad cuando exista valor
-- - dejar migración idempotente
-- ═════════════════════════════════════════════════════════════

ALTER TABLE bot_usuarios
  ADD COLUMN IF NOT EXISTS cclerk_user_id VARCHAR(255);

-- Normaliza basura histórica ('' => NULL)
UPDATE bot_usuarios
SET cclerk_user_id = NULL
WHERE cclerk_user_id IS NOT NULL
  AND BTRIM(cclerk_user_id) = '';

-- Índice único parcial: solo aplica cuando el vínculo existe
CREATE UNIQUE INDEX IF NOT EXISTS ux_bot_usuarios_cclerk_user_id
  ON bot_usuarios (cclerk_user_id)
  WHERE cclerk_user_id IS NOT NULL;

COMMENT ON COLUMN bot_usuarios.cclerk_user_id IS
  'ID de usuario Clerk vinculado al usuario ERP. NULL cuando no está vinculado.';
