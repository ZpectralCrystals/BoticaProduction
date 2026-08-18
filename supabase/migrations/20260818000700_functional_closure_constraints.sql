-- Cierre funcional: evita registrar dos veces el mismo comprobante de compra.
-- El numero se normaliza para impedir duplicados por espacios o mayusculas.

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
