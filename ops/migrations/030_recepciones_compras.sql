-- Recepción física de mercancía separada de compras.
-- Idempotente: seguro ejecutar más de una vez.

CREATE TABLE IF NOT EXISTS bot_recepciones (
  nid SERIAL PRIMARY KEY,
  ncompra_id INTEGER REFERENCES bot_compras(nid),
  ccodigo VARCHAR(40) NOT NULL UNIQUE,
  cestado VARCHAR(20) NOT NULL DEFAULT 'RECIBIDA',
  cnotas TEXT,
  cincidencias TEXT,
  nusuario_id INTEGER REFERENCES bot_usuarios(nid),
  cusuario VARCHAR(120),
  tcreado TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tmodifi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_recepcion_det (
  nid SERIAL PRIMARY KEY,
  nrecepcion_id INTEGER NOT NULL REFERENCES bot_recepciones(nid) ON DELETE CASCADE,
  nproducto_id INTEGER REFERENCES bot_productos(nid),
  ncantidad_esperada NUMERIC(12,2) NOT NULL DEFAULT 0,
  ncantidad_recibida NUMERIC(12,2) NOT NULL DEFAULT 0,
  cincidencia TEXT,
  tcreado TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_recepciones_compra ON bot_recepciones(ncompra_id);
CREATE INDEX IF NOT EXISTS idx_bot_recepcion_det_recepcion ON bot_recepcion_det(nrecepcion_id);
