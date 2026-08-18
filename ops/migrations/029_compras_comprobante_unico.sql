-- Espejo operativo de supabase/migrations/20260818000700_functional_closure_constraints.sql

CREATE UNIQUE INDEX IF NOT EXISTS uq_bot_compras_proveedor_comprobante
  ON public.bot_compras (
    nproveedor_id,
    ctipo_comprobante,
    UPPER(BTRIM(cdocumento))
  )
  WHERE nproveedor_id IS NOT NULL
    AND ctipo_comprobante IS NOT NULL
    AND cdocumento IS NOT NULL
    AND BTRIM(cdocumento) <> '';
