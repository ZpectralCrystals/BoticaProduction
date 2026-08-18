BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bot_ventas'
      AND column_name = 'npaciente_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bot_ventas'
      AND column_name = 'ncliente_clinico_id'
  ) THEN
    UPDATE bot_ventas
    SET ncliente_clinico_id = npaciente_id
    WHERE ncliente_clinico_id IS NULL
      AND npaciente_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bot_ventas'
      AND column_name = 'npaciente_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bot_ventas'
      AND column_name = 'ncliente_clinico_id'
  ) THEN
    ALTER TABLE bot_ventas RENAME COLUMN npaciente_id TO ncliente_clinico_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bot_ventas_npaciente_id_fkey'
  ) AND EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bot_ventas_ncliente_clinico_id_fkey'
  ) THEN
    ALTER TABLE bot_ventas
      DROP CONSTRAINT bot_ventas_npaciente_id_fkey;
  ELSIF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bot_ventas_npaciente_id_fkey'
  ) THEN
    ALTER TABLE bot_ventas
      RENAME CONSTRAINT bot_ventas_npaciente_id_fkey TO bot_ventas_ncliente_clinico_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'bot_ventas'
      AND indexname = 'idx_ventas_paciente_id'
  ) AND EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'bot_ventas'
      AND indexname = 'idx_ventas_cliente_clinico_id'
  ) THEN
    DROP INDEX idx_ventas_paciente_id;
  ELSIF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'bot_ventas'
      AND indexname = 'idx_ventas_paciente_id'
  ) THEN
    ALTER INDEX idx_ventas_paciente_id RENAME TO idx_ventas_cliente_clinico_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ventas_cliente_clinico_id
  ON bot_ventas (ncliente_clinico_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bot_ventas'
      AND column_name = 'npaciente_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bot_ventas'
      AND column_name = 'ncliente_clinico_id'
  ) THEN
    ALTER TABLE bot_ventas DROP COLUMN npaciente_id;
  END IF;
END $$;

COMMIT;
