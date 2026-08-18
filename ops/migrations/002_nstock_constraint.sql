-- =============================================================
-- Migración 002: Constraint CHECK nstock >= 0 en bot_productos
-- Fecha: Abril 2026
-- Autor: Auditoría de seguridad pre-producción
-- 
-- PROPÓSITO:
--   Garantizar a nivel de base de datos que bot_productos.nstock
--   nunca pueda quedar negativo, incluso si hay un bug en el código
--   de la aplicación que bypasee la validación en el backend.
--
-- REQUISITO PREVIO:
--   No debe haber filas con nstock < 0. Verificar con:
--     SELECT nid, cnombre, nstock FROM bot_productos WHERE nstock < 0;
--   Si hay filas, corregirlas ANTES de ejecutar este script.
--
-- EJECUCIÓN:
--   psql -U <usuario> -d botica_db -f 002_nstock_constraint.sql
-- =============================================================

-- Paso 1: Verificar que no existan filas con stock negativo
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM bot_productos
    WHERE nstock < 0;

    IF v_count > 0 THEN
        RAISE EXCEPTION
            'No se puede aplicar la migración: existen % producto(s) con nstock < 0. '
            'Corrija esos registros primero.',
            v_count;
    END IF;

    RAISE NOTICE 'Verificación OK: ningún producto con nstock negativo.';
END;
$$;

-- Paso 2: Agregar el constraint si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'bot_productos'
          AND constraint_name = 'nstock_no_negativo'
    ) THEN
        ALTER TABLE bot_productos
            ADD CONSTRAINT nstock_no_negativo CHECK (nstock >= 0);

        RAISE NOTICE 'Constraint nstock_no_negativo creado correctamente.';
    ELSE
        RAISE NOTICE 'Constraint nstock_no_negativo ya existe. Nada que hacer.';
    END IF;
END;
$$;

-- Paso 3: Verificar que quedó aplicado
SELECT
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'bot_productos'
  AND tc.constraint_name = 'nstock_no_negativo';
