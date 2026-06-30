-- Migration: Inventory schema for Apoyo-SaluPro
-- Gestiona materiales, centros medicos y asignaciones de inventario.
-- Sigue las convenciones de las migraciones anteriores (UUID, organization_id, RLS, triggers).

-- ENUMs
CREATE TYPE assignment_status AS ENUM ('Despachado', 'Recibido', 'Cancelado');

CREATE TABLE locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
);

CREATE TABLE material_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parent_id       UUID REFERENCES material_categories (id) ON DELETE SET NULL,
  location_id     UUID REFERENCES locations (id) ON DELETE SET NULL,
  UNIQUE (organization_id, name)
);

-- inventory: catalogo de materiales
CREATE TABLE inventory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  material_name            TEXT NOT NULL,
  category_id     UUID REFERENCES material_categories (id) ON DELETE SET NULL,
  unidad          TEXT,
  stock           INTEGER NOT NULL CHECK (stock >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id)
);

CREATE INDEX idx_inventory_org       ON inventory (organization_id);
CREATE INDEX idx_inventory_categoria ON inventory (category_id);
CREATE INDEX idx_inventory_nombre    ON inventory (material_name);

CREATE TABLE batches_movements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id      UUID NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
  assignment_id    UUID REFERENCES inventory_assignments (id) ON DELETE SET NULL,
  previous_stock   INTEGER NOT NULL CHECK (previous_stock >= 0),
  new_stock        INTEGER NOT NULL CHECK (new_stock >= 0)
);

-- inventory_medical_centers: centros medicos receptores de materiales
CREATE TABLE medical_centers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name          TEXT NOT NULL,
  location       TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE INDEX idx_medical_centers_org ON medical_centers (organization_id);

-- inventory_assignments: asignaciones de materiales a centros medicos
CREATE TABLE inventory_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  material_id     UUID NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
  centro_medico_id UUID NOT NULL REFERENCES medical_centers (id) ON DELETE CASCADE,
  assignment_status assignment_status NOT NULL DEFAULT 'Despachado',
  fecha          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_assignments_org      ON inventory_assignments (organization_id);
CREATE INDEX idx_inventory_assignments_material ON inventory_assignments (material_id);
CREATE INDEX idx_inventory_assignments_centro   ON inventory_assignments (centro_medico_id);
CREATE INDEX idx_inventory_assignments_estado   ON inventory_assignments (assignment_status);
CREATE INDEX idx_inventory_assignments_fecha    ON inventory_assignments (fecha);

-- Triggers updated_at (reusa la funcion update_updated_at_column de la migracion 001)
CREATE TRIGGER inventory_materials_updated_at
  BEFORE UPDATE ON inventory_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER inventory_medical_centers_updated_at
  BEFORE UPDATE ON inventory_medical_centers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER inventory_assignments_updated_at
  BEFORE UPDATE ON inventory_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE inventory_materials      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_medical_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_assignments    ENABLE ROW LEVEL SECURITY;

-- RLS: usuarios autenticados con acceso total (patron de la migracion 004)
CREATE POLICY "auth_all_inventory_materials" ON inventory_materials
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_inventory_medical_centers" ON inventory_medical_centers
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_inventory_assignments" ON inventory_assignments
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Vista: estado de asignacion por material (Asignado / Sin Asignar)
-- Devuelve cantidad asignada (activa), disponible y estado de asignacion.
CREATE VIEW inventory_materials_assignment_status AS
SELECT
  m.id,
  m.organization_id,
  m.nombre,
  m.categoria,
  m.descripcion,
  m.codigo,
  m.unidad,
  m.stock_total,
  m.created_at,
  m.updated_at,
  COALESCE(
    SUM(CASE WHEN a.estado = 'Activa' THEN a.cantidad ELSE 0 END),
    0
  ) AS cantidad_asignada,
  m.stock_total - COALESCE(
    SUM(CASE WHEN a.estado = 'Activa' THEN a.cantidad ELSE 0 END),
    0
  ) AS cantidad_disponible,
  CASE
    WHEN COUNT(CASE WHEN a.estado = 'Activa' THEN 1 END) > 0
      THEN 'Asignado'
    ELSE 'Sin Asignar'
  END AS estado_asignacion
FROM inventory_materials m
LEFT JOIN inventory_assignments a ON a.material_id = m.id
GROUP BY m.id, m.organization_id, m.nombre, m.categoria, m.descripcion,
         m.codigo, m.unidad, m.stock_total, m.created_at, m.updated_at;

-- La vista hereda el RLS de las tablas subyacentes; no necesita politicas propias.
