#!/usr/bin/env bash
set -euo pipefail

DB_TARGET="${1:-${DATABASE_URL:-botica_db_staging_20260817_231749}}"
export PGOPTIONS="${PGOPTIONS:---search_path=public,extensions}"

psql "$DB_TARGET" -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
\echo === identity ===
SELECT current_database() AS db, current_user AS user_name, now() AS audited_at;

\echo === object_counts ===
SELECT 'tables' AS item, COUNT(*) AS value
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'views', COUNT(*)
FROM information_schema.views
WHERE table_schema = 'public'
UNION ALL
SELECT 'rls_enabled_tables', COUNT(*)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
UNION ALL
SELECT 'rls_policies', COUNT(*)
FROM pg_policies
WHERE schemaname='public';

\echo === core_counts ===
SELECT 'bot_productos' AS item, COUNT(*) AS value FROM bot_productos UNION ALL
SELECT 'bot_lotes', COUNT(*) FROM bot_lotes UNION ALL
SELECT 'bot_kardex', COUNT(*) FROM bot_kardex UNION ALL
SELECT 'bot_compras', COUNT(*) FROM bot_compras UNION ALL
SELECT 'bot_compras_det', COUNT(*) FROM bot_compras_det UNION ALL
SELECT 'bot_ventas', COUNT(*) FROM bot_ventas UNION ALL
SELECT 'bot_ventas_det', COUNT(*) FROM bot_ventas_det UNION ALL
SELECT 'bot_producto_precios', COUNT(*) FROM bot_producto_precios UNION ALL
SELECT 'bot_producto_precios_hist', COUNT(*) FROM bot_producto_precios_hist UNION ALL
SELECT 'bot_familias_producto', COUNT(*) FROM bot_familias_producto UNION ALL
SELECT 'bot_categorias_producto', COUNT(*) FROM bot_categorias_producto
ORDER BY item;

\echo === blockers ===
SELECT 'lotes_activos_vencidos_con_stock' AS check_name, COUNT(*) AS value
FROM bot_lotes
WHERE cestado='ACTIVO' AND ncantidad > 0 AND dfechavencimiento < CURRENT_DATE
UNION ALL
SELECT 'productos_stock_vs_lotes_mismatch', COUNT(*)
FROM (
  SELECT p.nid
  FROM bot_productos p
  LEFT JOIN (
    SELECT nproducto_id, SUM(ncantidad) AS stock_lotes
    FROM bot_lotes
    WHERE cestado='ACTIVO'
    GROUP BY nproducto_id
  ) l ON l.nproducto_id = p.nid
  WHERE p.cestado='A'
    AND COALESCE(p.lrequiere_lote, TRUE)=TRUE
    AND COALESCE(p.nstock,0) <> COALESCE(l.stock_lotes,0)
) x
UNION ALL
SELECT 'productos_sin_familia_id', COUNT(*) FROM bot_productos WHERE cestado='A' AND nfamilia_id IS NULL
UNION ALL
SELECT 'productos_sin_categoria_id', COUNT(*) FROM bot_productos WHERE cestado='A' AND ncategoria_id IS NULL
UNION ALL
SELECT 'productos_sin_precio_1', COUNT(*)
FROM bot_productos p
WHERE p.cestado='A'
  AND NOT EXISTS (
    SELECT 1 FROM bot_producto_precios pp
    WHERE pp.nproducto_id=p.nid AND pp.cnombre='PRECIO_1' AND pp.lactivo=TRUE
  )
UNION ALL
SELECT 'compras_sin_detalle', COUNT(*)
FROM bot_compras c
WHERE NOT EXISTS (SELECT 1 FROM bot_compras_det d WHERE d.ncompra_id=c.nid)
UNION ALL
SELECT 'ventas_sin_detalle', COUNT(*)
FROM bot_ventas v
WHERE NOT EXISTS (SELECT 1 FROM bot_ventas_det d WHERE d.nventa_id=v.nid);

\echo === fk_dup_compras_usuario ===
SELECT COUNT(*) AS compras_usuario_fk_count
FROM pg_constraint
WHERE conrelid='bot_compras'::regclass
  AND contype='f'
  AND pg_get_constraintdef(oid) LIKE '%nusuario_id%';

\echo === view_security_invoker ===
SELECT c.relname AS view_name, COALESCE(c.reloptions::TEXT, '{}') AS reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='v'
ORDER BY c.relname;

\echo === client_table_grants ===
SELECT grantee, table_name, privilege_type, COUNT(*) AS grants_count
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND grantee IN ('anon','authenticated')
GROUP BY grantee, table_name, privilege_type
ORDER BY grantee, table_name, privilege_type;

\echo === function_public_execute_grants ===
SELECT routine_name, privilege_type, grantee
FROM information_schema.routine_privileges
WHERE routine_schema='public'
  AND grantee IN ('PUBLIC','anon','authenticated')
ORDER BY routine_name, grantee;
SQL
