-- =============================================================
-- Migración 003: Tabla bot_kardex — Kardex real de inventario
-- Fecha: Abril 2026
-- Autor: Implementación de trazabilidad farmacéutica
--
-- PROPÓSITO:
--   Registrar todo movimiento de stock en una tabla de Kardex
--   para auditoría, trazabilidad y cumplimiento regulatorio.
--
-- OPERACIONES QUE REGISTRAN KARDEX:
--   - Ventas    → VENTA       (negativo — salida)
--   - Compras   → COMPRA      (positivo — entrada)
--   - Transferencias → TRANSFERENCIA | MERMA (negativo)
--   - Entradas  → ENTRADA | DONACION | REGALO | MUESTRA (positivo)
--
-- EJECUCIÓN:
--   psql -U <usuario> -d botica_db -f 003_bot_kardex.sql
-- =============================================================

-- Crear tabla bot_kardex si no existe (idempotente)
CREATE TABLE IF NOT EXISTS bot_kardex (
    nid          SERIAL PRIMARY KEY,
    nproducto_id INTEGER      NOT NULL,
    ctipo        VARCHAR(30)  NOT NULL,   -- 'VENTA','COMPRA','TRANSFERENCIA','MERMA','ENTRADA',...
    cref_tabla   VARCHAR(40),             -- 'bot_ventas','bot_compras','bot_transferencias'
    nref_id      INTEGER,                 -- ID del documento origen
    ncantidad    INTEGER      NOT NULL,   -- Positivo = entrada, Negativo = salida
    nstock_anterior INTEGER  NOT NULL,
    nstock_nuevo    INTEGER  NOT NULL,
    cdetalle     TEXT,
    nusuario_id  INTEGER,
    cusuario     VARCHAR(100),
    tcreado      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_kardex_producto
        FOREIGN KEY (nproducto_id)
        REFERENCES bot_productos(nid)
        ON DELETE RESTRICT
);

-- Índices para consultas frecuentes de auditoría
CREATE INDEX IF NOT EXISTS idx_bot_kardex_producto
    ON bot_kardex(nproducto_id, tcreado DESC);

CREATE INDEX IF NOT EXISTS idx_bot_kardex_tipo
    ON bot_kardex(ctipo);

CREATE INDEX IF NOT EXISTS idx_bot_kardex_ref
    ON bot_kardex(cref_tabla, nref_id);

CREATE INDEX IF NOT EXISTS idx_bot_kardex_fecha
    ON bot_kardex(tcreado DESC);

-- Verificar resultado
SELECT
    'bot_kardex creada' AS status,
    COUNT(*) AS filas_actuales
FROM bot_kardex;
