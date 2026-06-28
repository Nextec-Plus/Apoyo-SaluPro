-- Referencia al reporte de origen (p. ej. ficha_url de venezuelareporta.org).
-- Permite importaciones idempotentes y deduplicar contra la fuente en re-corridas.
--
-- Un UNIQUE index normal trata los NULL como distintos, así que las filas sin
-- origen (carga manual previa) conviven sin problema, y ON CONFLICT (origen_url)
-- queda disponible para upserts idempotentes.
ALTER TABLE missing_persons
  ADD COLUMN IF NOT EXISTS origen_url text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_missing_persons_origen_url
  ON missing_persons (origen_url);
