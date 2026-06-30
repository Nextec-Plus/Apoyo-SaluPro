-- Migration: 20260630000002_supply_requests
-- Tabla pública de solicitudes de insumos.
-- Cualquier persona puede enviar una solicitud sin autenticación.
-- El personal interno gestiona las solicitudes desde el módulo de inventario.

-- ── ENUMs ────────────────────────────────────────────────────────────────────
CREATE TYPE supply_request_status AS ENUM (
  'Pendiente',
  'En revisión',
  'Aprobado',
  'Despachado',
  'Cerrado'
);

CREATE TYPE solicitor_type AS ENUM (
  'Persona',
  'Clínica / Hospital',
  'Centro de acopio'
);

-- ── supply_requests ───────────────────────────────────────────────────────────
CREATE TABLE supply_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                TEXT NOT NULL,
  cedula_rif            TEXT,
  telefono              TEXT NOT NULL,
  correo                TEXT,
  tipo_solicitante      solicitor_type NOT NULL DEFAULT 'Persona',
  latitud               NUMERIC(9, 6),
  longitud              NUMERIC(9, 6),
  direccion             TEXT,
  secciones_solicitadas JSONB NOT NULL DEFAULT '[]',
  notas                 TEXT,
  estado                supply_request_status NOT NULL DEFAULT 'Pendiente',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_supply_requests_estado  ON supply_requests (estado);
CREATE INDEX idx_supply_requests_created ON supply_requests (created_at DESC);
CREATE INDEX idx_supply_requests_tipo    ON supply_requests (tipo_solicitante);

-- Trigger updated_at (reusa update_updated_at_column de migración 001)
CREATE TRIGGER supply_requests_updated_at
  BEFORE UPDATE ON supply_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE supply_requests ENABLE ROW LEVEL SECURITY;

-- Cualquier visitante (anon o auth) puede enviar solicitudes.
CREATE POLICY "anon_insert_supply_requests"
  ON supply_requests FOR INSERT
  WITH CHECK (true);

-- Solo personal autenticado puede ver solicitudes.
CREATE POLICY "auth_select_supply_requests"
  ON supply_requests FOR SELECT
  TO authenticated
  USING (true);

-- Solo personal autenticado puede actualizar el estado.
CREATE POLICY "auth_update_supply_requests"
  ON supply_requests FOR UPDATE
  TO authenticated
  USING (true);

-- Lectura anónima del catálogo global (datos no sensibles).
CREATE POLICY "anon_read_inventory_sections"
  ON inventory_sections FOR SELECT
  USING (true);

CREATE POLICY "anon_read_inventory_subcategories"
  ON inventory_subcategories FOR SELECT
  USING (true);
