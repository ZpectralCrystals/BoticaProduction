-- P1: correlativos seguros para ventas y compras bajo concurrencia.
-- Evita generar ccodigo con COUNT(*) + 1.

CREATE SEQUENCE IF NOT EXISTS public.bot_ventas_codigo_seq
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.bot_compras_codigo_seq
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

DO $$
DECLARE
  venta_max BIGINT;
  compra_max BIGINT;
BEGIN
  SELECT COALESCE(MAX(substring(ccodigo FROM '^VTA-[0-9]{8}-([0-9]+)$')::BIGINT), 0)
  INTO venta_max
  FROM bot_ventas
  WHERE ccodigo ~ '^VTA-[0-9]{8}-[0-9]+$';

  PERFORM setval('public.bot_ventas_codigo_seq', GREATEST(venta_max, 1), venta_max > 0);

  SELECT COALESCE(MAX(substring(ccodigo FROM '^CMP-[0-9]{8}-([0-9]+)$')::BIGINT), 0)
  INTO compra_max
  FROM bot_compras
  WHERE ccodigo ~ '^CMP-[0-9]{8}-[0-9]+$';

  PERFORM setval('public.bot_compras_codigo_seq', GREATEST(compra_max, 1), compra_max > 0);
END $$;
