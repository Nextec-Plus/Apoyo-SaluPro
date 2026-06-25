-- Migration 006: búsqueda acento-insensible e indexada para missing_persons
--
-- Objetivo: que el buscador (home + /desaparecidos) sea
--   · acento-insensible  ("Perez" encuentra "Pérez")
--   · case-insensitive
--   · por nombre completo (nombre + apellido + cédula en un solo campo)
--   · rápido a escala (índice GIN de trigramas en vez de seq scan por ilike %...%)
--
-- El endpoint /api/missing-persons usa la columna `search_index` automáticamente
-- en cuanto esta migración está aplicada (degradación elegante si no lo está).

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() de un solo argumento es STABLE y no puede usarse en columnas
-- generadas ni índices. Este wrapper con diccionario explícito es IMMUTABLE.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
AS $$ SELECT unaccent('unaccent', $1) $$;

-- Columna generada: nombre + apellido + cédula, sin acentos y en minúsculas.
ALTER TABLE missing_persons
  ADD COLUMN IF NOT EXISTS search_index text
  GENERATED ALWAYS AS (
    immutable_unaccent(lower(
      coalesce(nombre, '') || ' ' ||
      coalesce(apellido, '') || ' ' ||
      coalesce(cedula, '')
    ))
  ) STORED;

-- Índice de trigramas: hace que `search_index ILIKE '%texto%'` sea rápido
-- incluso con comodín a la izquierda (lo que un btree no puede acelerar).
CREATE INDEX IF NOT EXISTS idx_missing_persons_search_trgm
  ON missing_persons USING gin (search_index gin_trgm_ops);
