-- Migration 007: búsqueda acento-insensible e indexada para catastrophe_victims
--
-- Análoga a la migración 006 (missing_persons). Reutiliza la función
-- immutable_unaccent() y las extensiones unaccent/pg_trgm ya creadas allí.
--
-- El endpoint /api/catastrophe/victims usa la columna `search_index`
-- automáticamente en cuanto esta migración está aplicada (degradación elegante
-- si no lo está, vía lib/text-search.ts).

-- Columna generada: nombre completo + cédula, sin acentos y en minúsculas.
ALTER TABLE catastrophe_victims
  ADD COLUMN IF NOT EXISTS search_index text
  GENERATED ALWAYS AS (
    immutable_unaccent(lower(
      coalesce(nombre_completo, '') || ' ' ||
      coalesce(cedula, '')
    ))
  ) STORED;

-- Índice de trigramas: `search_index ILIKE '%texto%'` rápido incluso con
-- comodín a la izquierda.
CREATE INDEX IF NOT EXISTS idx_catastrophe_victims_search_trgm
  ON catastrophe_victims USING gin (search_index gin_trgm_ops);
