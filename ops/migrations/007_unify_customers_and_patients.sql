BEGIN;

ALTER TABLE bot_pacientes
  ADD COLUMN IF NOT EXISTS cesgenerico CHAR(1) NOT NULL DEFAULT 'N'
  CHECK (cesgenerico IN ('S', 'N'));

UPDATE bot_pacientes
SET cesgenerico = 'N'
WHERE cesgenerico IS DISTINCT FROM 'S';

INSERT INTO bot_pacientes (cnombre, cnrodni, ctelefono, nedad, cnotas, cestado, cesgenerico, tultvisita)
SELECT
  'CLIENTE GENERICO',
  '00000000',
  NULL,
  0,
  'Registro tecnico para ventas de clientes no registrados en botica.',
  'A',
  'S',
  CURRENT_DATE
WHERE NOT EXISTS (
  SELECT 1
  FROM bot_pacientes
  WHERE cnrodni = '00000000'
);

UPDATE bot_pacientes
SET
  cnombre = 'CLIENTE GENERICO',
  cnotas = 'Registro tecnico para ventas de clientes no registrados en botica.',
  cestado = 'A',
  cesgenerico = 'S'
WHERE cnrodni = '00000000';

ALTER TABLE bot_ventas
  ADD COLUMN IF NOT EXISTS npaciente_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bot_ventas_npaciente_id_fkey'
  ) THEN
    ALTER TABLE bot_ventas
      ADD CONSTRAINT bot_ventas_npaciente_id_fkey
      FOREIGN KEY (npaciente_id) REFERENCES bot_pacientes(nid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ventas_paciente_id
  ON bot_ventas (npaciente_id);

UPDATE bot_ventas v
SET npaciente_id = p.nid
FROM bot_pacientes p
WHERE v.npaciente_id IS NULL
  AND p.cestado = 'A'
  AND COALESCE(p.cesgenerico, 'N') = 'N'
  AND NULLIF(BTRIM(v.cnrodni_cli), '') IS NOT NULL
  AND BTRIM(v.cnrodni_cli) = BTRIM(p.cnrodni);

UPDATE bot_ventas v
SET npaciente_id = p.nid
FROM bot_pacientes p
WHERE v.npaciente_id IS NULL
  AND p.cestado = 'A'
  AND COALESCE(p.cesgenerico, 'N') = 'N'
  AND LOWER(BTRIM(v.ccliente)) = LOWER(BTRIM(p.cnombre));

UPDATE bot_ventas v
SET npaciente_id = p.nid
FROM bot_pacientes p
WHERE v.npaciente_id IS NULL
  AND p.cnrodni = '00000000';

COMMIT;
