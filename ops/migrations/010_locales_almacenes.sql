-- ============================================================
-- 010 – Locales, Almacenes, Movimientos entre almacenes
--       y extensión de bot_lotes con almacen_id
-- ============================================================
-- Idempotente: cada CREATE / ALTER usa IF NOT EXISTS / IF EXISTS
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. bot_locales
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_locales (
  nid          SERIAL PRIMARY KEY,
  cnombre      VARCHAR(120)  NOT NULL,
  ccodigo      VARCHAR(20)   NOT NULL UNIQUE,
  ctipo_local  VARCHAR(20)   NOT NULL DEFAULT 'BOTICA',
  cdireccion   VARCHAR(250),
  ctelefono    VARCHAR(30),
  cestado      CHAR(1)       NOT NULL DEFAULT 'A',
  tcreado      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  tmodifi      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_locales_tipo   CHECK (ctipo_local IN ('BOTICA','CLINICA','OTRO')),
  CONSTRAINT chk_locales_estado CHECK (cestado IN ('A','I'))
);

-- ────────────────────────────────────────────────────────────
-- 2. bot_almacenes
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_almacenes (
  nid                     SERIAL PRIMARY KEY,
  nlocal_id               INT          NOT NULL REFERENCES bot_locales(nid) ON DELETE RESTRICT,
  cnombre                 VARCHAR(120) NOT NULL,
  ccodigo                 VARCHAR(30)  NOT NULL UNIQUE,
  ctipo_almacen           VARCHAR(30)  NOT NULL DEFAULT 'DISPONIBLE',
  bpermite_venta          BOOLEAN      NOT NULL DEFAULT FALSE,
  bpermite_consumo_clinico BOOLEAN     NOT NULL DEFAULT FALSE,
  brequiere_revision      BOOLEAN      NOT NULL DEFAULT FALSE,
  cestado                 CHAR(1)      NOT NULL DEFAULT 'A',
  tcreado                 TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  tmodifi                 TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_almacen_tipo CHECK (
    ctipo_almacen IN (
      'DISPONIBLE',
      'CUARENTENA',
      'DEVOLUCION_CLIENTE',
      'DEVOLUCION_PROVEEDOR',
      'BAJA',
      'PROCEDIMIENTOS',
      'CONTROL_ESPECIAL'
    )
  ),
  CONSTRAINT chk_almacen_estado CHECK (cestado IN ('A','I'))
);

CREATE INDEX IF NOT EXISTS idx_almacenes_local  ON bot_almacenes(nlocal_id);
CREATE INDEX IF NOT EXISTS idx_almacenes_tipo   ON bot_almacenes(ctipo_almacen);

-- ────────────────────────────────────────────────────────────
-- 3. Extender bot_lotes con nalmacen_id
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_lotes' AND column_name = 'nalmacen_id'
  ) THEN
    ALTER TABLE bot_lotes ADD COLUMN nalmacen_id INT;
    ALTER TABLE bot_lotes
      ADD CONSTRAINT fk_lotes_almacen
        FOREIGN KEY (nalmacen_id) REFERENCES bot_almacenes(nid)
        ON DELETE RESTRICT;
    CREATE INDEX idx_lotes_almacen ON bot_lotes(nalmacen_id);
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────
-- 4. bot_movimientos_almacen
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_movimientos_almacen (
  nid                 SERIAL PRIMARY KEY,
  nproducto_id        INT          NOT NULL REFERENCES bot_productos(nid) ON DELETE RESTRICT,
  nlote_id            INT                   REFERENCES bot_lotes(nid)     ON DELETE SET NULL,
  nalmacen_origen_id  INT                   REFERENCES bot_almacenes(nid) ON DELETE RESTRICT,
  nalmacen_destino_id INT                   REFERENCES bot_almacenes(nid) ON DELETE RESTRICT,
  ctipo_movimiento    VARCHAR(30)  NOT NULL,
  ncantidad           INT          NOT NULL CHECK (ncantidad > 0),
  cdetalle            TEXT,
  nusuario_id         INT,
  cusuario            VARCHAR(100),
  tcreado             TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_mov_tipo CHECK (
    ctipo_movimiento IN (
      'COMPRA',
      'VENTA',
      'CONSUMO_CLINICO',
      'TRASLADO',
      'DEVOLUCION_CLIENTE',
      'DEVOLUCION_PROVEEDOR',
      'BAJA',
      'AJUSTE'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_mov_producto  ON bot_movimientos_almacen(nproducto_id);
CREATE INDEX IF NOT EXISTS idx_mov_lote      ON bot_movimientos_almacen(nlote_id);
CREATE INDEX IF NOT EXISTS idx_mov_origen    ON bot_movimientos_almacen(nalmacen_origen_id);
CREATE INDEX IF NOT EXISTS idx_mov_destino   ON bot_movimientos_almacen(nalmacen_destino_id);
CREATE INDEX IF NOT EXISTS idx_mov_tipo      ON bot_movimientos_almacen(ctipo_movimiento);
CREATE INDEX IF NOT EXISTS idx_mov_fecha     ON bot_movimientos_almacen(tcreado DESC);

-- ────────────────────────────────────────────────────────────
-- 5. Extender bot_kardex con nalmacen_id (opcional, para trazabilidad)
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_kardex' AND column_name = 'nalmacen_id'
  ) THEN
    ALTER TABLE bot_kardex ADD COLUMN nalmacen_id INT REFERENCES bot_almacenes(nid);
    CREATE INDEX idx_kardex_almacen ON bot_kardex(nalmacen_id) WHERE nalmacen_id IS NOT NULL;
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────
-- 6. Seed: locales por defecto
-- ────────────────────────────────────────────────────────────
INSERT INTO bot_locales (cnombre, ccodigo, ctipo_local)
SELECT 'Botica El Pueblo', 'LOC-BOTICA', 'BOTICA'
WHERE NOT EXISTS (SELECT 1 FROM bot_locales WHERE ccodigo = 'LOC-BOTICA');

INSERT INTO bot_locales (cnombre, ccodigo, ctipo_local)
SELECT 'Clínica El Pueblo', 'LOC-CLINICA', 'CLINICA'
WHERE NOT EXISTS (SELECT 1 FROM bot_locales WHERE ccodigo = 'LOC-CLINICA');

-- ────────────────────────────────────────────────────────────
-- 7. Seed: almacenes por defecto para Botica
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_loc_botica  INT;
  v_loc_clinica INT;
BEGIN
  SELECT nid INTO v_loc_botica  FROM bot_locales WHERE ccodigo = 'LOC-BOTICA';
  SELECT nid INTO v_loc_clinica FROM bot_locales WHERE ccodigo = 'LOC-CLINICA';

  -- Botica: disponible (vendible)
  INSERT INTO bot_almacenes (nlocal_id, cnombre, ccodigo, ctipo_almacen, bpermite_venta, bpermite_consumo_clinico, brequiere_revision)
  SELECT v_loc_botica, 'Botica – Disponible', 'ALM-BOT-DISP', 'DISPONIBLE', TRUE, FALSE, FALSE
  WHERE NOT EXISTS (SELECT 1 FROM bot_almacenes WHERE ccodigo = 'ALM-BOT-DISP');

  -- Botica: cuarentena
  INSERT INTO bot_almacenes (nlocal_id, cnombre, ccodigo, ctipo_almacen, bpermite_venta, bpermite_consumo_clinico, brequiere_revision)
  SELECT v_loc_botica, 'Botica – Cuarentena', 'ALM-BOT-CUAR', 'CUARENTENA', FALSE, FALSE, TRUE
  WHERE NOT EXISTS (SELECT 1 FROM bot_almacenes WHERE ccodigo = 'ALM-BOT-CUAR');

  -- Botica: devoluciones cliente
  INSERT INTO bot_almacenes (nlocal_id, cnombre, ccodigo, ctipo_almacen, bpermite_venta, bpermite_consumo_clinico, brequiere_revision)
  SELECT v_loc_botica, 'Botica – Devoluciones Cliente', 'ALM-BOT-DEVC', 'DEVOLUCION_CLIENTE', FALSE, FALSE, TRUE
  WHERE NOT EXISTS (SELECT 1 FROM bot_almacenes WHERE ccodigo = 'ALM-BOT-DEVC');

  -- Botica: devolución proveedor
  INSERT INTO bot_almacenes (nlocal_id, cnombre, ccodigo, ctipo_almacen, bpermite_venta, bpermite_consumo_clinico, brequiere_revision)
  SELECT v_loc_botica, 'Botica – Devolución Proveedor', 'ALM-BOT-DEVP', 'DEVOLUCION_PROVEEDOR', FALSE, FALSE, FALSE
  WHERE NOT EXISTS (SELECT 1 FROM bot_almacenes WHERE ccodigo = 'ALM-BOT-DEVP');

  -- Botica: baja / vencidos
  INSERT INTO bot_almacenes (nlocal_id, cnombre, ccodigo, ctipo_almacen, bpermite_venta, bpermite_consumo_clinico, brequiere_revision)
  SELECT v_loc_botica, 'Botica – Baja / Vencidos', 'ALM-BOT-BAJA', 'BAJA', FALSE, FALSE, FALSE
  WHERE NOT EXISTS (SELECT 1 FROM bot_almacenes WHERE ccodigo = 'ALM-BOT-BAJA');

  -- Clínica: disponible para procedimientos
  INSERT INTO bot_almacenes (nlocal_id, cnombre, ccodigo, ctipo_almacen, bpermite_venta, bpermite_consumo_clinico, brequiere_revision)
  SELECT v_loc_clinica, 'Clínica – Procedimientos', 'ALM-CLI-PROC', 'PROCEDIMIENTOS', FALSE, TRUE, FALSE
  WHERE NOT EXISTS (SELECT 1 FROM bot_almacenes WHERE ccodigo = 'ALM-CLI-PROC');

  -- Clínica: disponible (vendible)
  INSERT INTO bot_almacenes (nlocal_id, cnombre, ccodigo, ctipo_almacen, bpermite_venta, bpermite_consumo_clinico, brequiere_revision)
  SELECT v_loc_clinica, 'Clínica – Disponible', 'ALM-CLI-DISP', 'DISPONIBLE', TRUE, FALSE, FALSE
  WHERE NOT EXISTS (SELECT 1 FROM bot_almacenes WHERE ccodigo = 'ALM-CLI-DISP');

  -- Asignar almacén Botica Disponible a lotes existentes que no tengan almacén
  UPDATE bot_lotes SET nalmacen_id = (SELECT nid FROM bot_almacenes WHERE ccodigo = 'ALM-BOT-DISP')
  WHERE nalmacen_id IS NULL;

END
$$;

-- ────────────────────────────────────────────────────────────
-- 8. Vista: stock por producto, almacén y local
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_stock_por_almacen AS
SELECT
  p.nid          AS producto_id,
  p.ccodigo      AS producto_codigo,
  p.cnombre      AS producto_nombre,
  a.nid          AS almacen_id,
  a.cnombre      AS almacen_nombre,
  a.ctipo_almacen,
  a.bpermite_venta,
  a.bpermite_consumo_clinico,
  l2.nid          AS local_id,
  l2.cnombre      AS local_nombre,
  l2.ctipo_local,
  COALESCE(SUM(lo.ncantidad) FILTER (WHERE lo.cestado = 'ACTIVO'), 0) AS stock_disponible,
  COUNT(lo.nid) FILTER (WHERE lo.cestado = 'ACTIVO' AND lo.ncantidad > 0) AS lotes_activos,
  MIN(lo.dfechavencimiento) FILTER (WHERE lo.cestado = 'ACTIVO' AND lo.ncantidad > 0) AS proximo_vencimiento
FROM bot_productos p
CROSS JOIN bot_almacenes a
JOIN bot_locales l2 ON l2.nid = a.nlocal_id
LEFT JOIN bot_lotes lo ON lo.nproducto_id = p.nid AND lo.nalmacen_id = a.nid
WHERE p.cestado = 'A' AND a.cestado = 'A' AND l2.cestado = 'A'
GROUP BY p.nid, p.ccodigo, p.cnombre, a.nid, a.cnombre, a.ctipo_almacen, a.bpermite_venta, a.bpermite_consumo_clinico, l2.nid, l2.cnombre, l2.ctipo_local
HAVING COALESCE(SUM(lo.ncantidad) FILTER (WHERE lo.cestado = 'ACTIVO'), 0) > 0;

COMMIT;
