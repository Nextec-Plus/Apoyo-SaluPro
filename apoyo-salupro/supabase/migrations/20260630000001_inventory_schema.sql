-- Módulo de Inventario para Centro de Acopio.
-- Reemplaza un esquema de inventario previo (incompleto). Artículo = subcategoría
-- del catálogo estándar; varias presentaciones por artículo; ubicación fija por
-- artículo; kardex de entradas/salidas con stock atómico; acceso por asignación
-- usuario→centro + RLS.

-- ── Limpieza del esquema previo ──────────────────────────────────────────────
DROP VIEW  IF EXISTS inventory_materials_assignment_status CASCADE;
DROP TABLE IF EXISTS inventory_assignments     CASCADE;
DROP TABLE IF EXISTS inventory_materials        CASCADE;
DROP TABLE IF EXISTS inventory_medical_centers  CASCADE;
DROP TABLE IF EXISTS inventory_categories       CASCADE;
DROP TABLE IF EXISTS inventory_locations        CASCADE;
DROP TYPE  IF EXISTS assignment_status;

-- ── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE inventory_movement_type AS ENUM ('entrada', 'salida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Centros de acopio ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS acopio_centers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name            TEXT NOT NULL,
  ubicacion       TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

-- Asignación usuario → centro (1 centro por usuario). Habilita el módulo.
CREATE TABLE IF NOT EXISTS acopio_user_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  acopio_center_id UUID NOT NULL REFERENCES acopio_centers (id) ON DELETE CASCADE,
  role             TEXT NOT NULL DEFAULT 'inventory' CHECK (role IN ('inventory', 'admin')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acopio_assign_center ON acopio_user_assignments (acopio_center_id);

-- ── Catálogo estándar (global) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory_subcategories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id    UUID NOT NULL REFERENCES inventory_sections (id) ON DELETE CASCADE,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  display_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_subcat_section ON inventory_subcategories (section_id);

-- ── Ubicaciones por centro ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_locations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acopio_center_id UUID NOT NULL REFERENCES acopio_centers (id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (acopio_center_id, name)
);

-- ── Items: artículo concreto (centro, subcategoría, presentación) ─────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acopio_center_id UUID NOT NULL REFERENCES acopio_centers (id) ON DELETE CASCADE,
  subcategory_id   UUID NOT NULL REFERENCES inventory_subcategories (id) ON DELETE RESTRICT,
  presentacion     TEXT NOT NULL,
  location_id      UUID REFERENCES inventory_locations (id) ON DELETE SET NULL,
  stock            INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (acopio_center_id, subcategory_id, presentacion)
);
CREATE INDEX IF NOT EXISTS idx_items_center   ON inventory_items (acopio_center_id);
CREATE INDEX IF NOT EXISTS idx_items_subcat   ON inventory_items (subcategory_id);
CREATE INDEX IF NOT EXISTS idx_items_location ON inventory_items (location_id);

-- ── Movimientos (kardex) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acopio_center_id UUID NOT NULL REFERENCES acopio_centers (id) ON DELETE CASCADE,
  item_id          UUID NOT NULL REFERENCES inventory_items (id) ON DELETE CASCADE,
  tipo             inventory_movement_type NOT NULL,
  cantidad         INTEGER NOT NULL CHECK (cantidad > 0),
  location_id      UUID REFERENCES inventory_locations (id) ON DELETE SET NULL,
  entregado_por    TEXT,   -- entrada: quién entrega
  destinatario     TEXT,   -- salida: a quién se envía
  medio_transporte TEXT,   -- salida: medio de transporte
  nota             TEXT,
  previous_stock   INTEGER NOT NULL DEFAULT 0,
  new_stock        INTEGER NOT NULL DEFAULT 0,
  created_by       UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mov_item   ON inventory_movements (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mov_center ON inventory_movements (acopio_center_id, created_at DESC);

-- ── Trigger: aplica el movimiento al stock de forma atómica ───────────────────
CREATE OR REPLACE FUNCTION apply_inventory_movement()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  cur integer;
  centro uuid;
BEGIN
  SELECT stock, acopio_center_id INTO cur, centro
  FROM inventory_items WHERE id = NEW.item_id FOR UPDATE;
  IF cur IS NULL THEN
    RAISE EXCEPTION 'El artículo % no existe', NEW.item_id;
  END IF;
  IF NEW.acopio_center_id IS NULL THEN NEW.acopio_center_id := centro; END IF;

  IF NEW.tipo = 'entrada' THEN
    NEW.previous_stock := cur;
    NEW.new_stock := cur + NEW.cantidad;
  ELSE -- salida
    IF cur < NEW.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente: disponible %, solicitado %', cur, NEW.cantidad;
    END IF;
    NEW.previous_stock := cur;
    NEW.new_stock := cur - NEW.cantidad;
  END IF;

  UPDATE inventory_items SET stock = NEW.new_stock, updated_at = now() WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_movements_apply ON inventory_movements;
CREATE TRIGGER inventory_movements_apply
  BEFORE INSERT ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION apply_inventory_movement();

-- ── updated_at (reusa update_updated_at_column de la migración 001) ───────────
DROP TRIGGER IF EXISTS acopio_centers_updated_at ON acopio_centers;
CREATE TRIGGER acopio_centers_updated_at BEFORE UPDATE ON acopio_centers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS inventory_locations_updated_at ON inventory_locations;
CREATE TRIGGER inventory_locations_updated_at BEFORE UPDATE ON inventory_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS inventory_items_updated_at ON inventory_items;
CREATE TRIGGER inventory_items_updated_at BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE acopio_centers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE acopio_user_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_sections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_locations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements     ENABLE ROW LEVEL SECURITY;

-- Catálogos globales: lectura para autenticados.
CREATE POLICY sel_sections ON inventory_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY sel_subcats  ON inventory_subcategories FOR SELECT TO authenticated USING (true);

-- Asignación: el usuario ve la suya.
CREATE POLICY sel_own_assignment ON acopio_user_assignments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Centros y datos del centro: acotados a los centros asignados al usuario.
CREATE POLICY all_own_centers ON acopio_centers
  FOR ALL TO authenticated
  USING (id IN (SELECT acopio_center_id FROM acopio_user_assignments WHERE user_id = auth.uid()))
  WITH CHECK (id IN (SELECT acopio_center_id FROM acopio_user_assignments WHERE user_id = auth.uid()));

CREATE POLICY all_own_locations ON inventory_locations
  FOR ALL TO authenticated
  USING (acopio_center_id IN (SELECT acopio_center_id FROM acopio_user_assignments WHERE user_id = auth.uid()))
  WITH CHECK (acopio_center_id IN (SELECT acopio_center_id FROM acopio_user_assignments WHERE user_id = auth.uid()));

CREATE POLICY all_own_items ON inventory_items
  FOR ALL TO authenticated
  USING (acopio_center_id IN (SELECT acopio_center_id FROM acopio_user_assignments WHERE user_id = auth.uid()))
  WITH CHECK (acopio_center_id IN (SELECT acopio_center_id FROM acopio_user_assignments WHERE user_id = auth.uid()));

CREATE POLICY all_own_movements ON inventory_movements
  FOR ALL TO authenticated
  USING (acopio_center_id IN (SELECT acopio_center_id FROM acopio_user_assignments WHERE user_id = auth.uid()))
  WITH CHECK (acopio_center_id IN (SELECT acopio_center_id FROM acopio_user_assignments WHERE user_id = auth.uid()));

-- ── Seed: catálogo estándar ───────────────────────────────────────────────────
INSERT INTO inventory_sections (code, name, display_order) VALUES
  ('1','Analgésicos y Antipiréticos',1),
  ('2','Antibióticos',2),
  ('3','Antialérgicos',3),
  ('4','Hidratación',4),
  ('5','Vitaminas y Nutrición',5),
  ('6','Material Médico Quirúrgico (Insumos y Curas)',6),
  ('7','Cuidado de la Piel y Tópicos',7),
  ('8','Equipos Médicos',8),
  ('9','Equipos Generales (Logística e Infraestructura)',9),
  ('10','Ropa y Textiles',10),
  ('11','Alimentos',11),
  ('12','Higiene Personal y Misceláneos',12)
ON CONFLICT (code) DO NOTHING;

INSERT INTO inventory_subcategories (section_id, code, name, description, display_order)
SELECT s.id, v.code, v.name, v.description, v.ord
FROM (VALUES
  ('1','1a','Pediátricos','Jarabes, gotas y supositorios infantiles',1),
  ('1','1b','Adultos','Tabletas y cápsulas',2),
  ('1','1c','Inyectables','Ampollas intravenosas o intramusculares',3),
  ('2','2a','Pediátricos','Polvo para suspensión oral y gotas',4),
  ('2','2b','Adultos','Tabletas y cápsulas',5),
  ('2','2c','Tópicos','Cremas y ungüentos antibióticos',6),
  ('2','2d','Inyectables','Viales y ampollas',7),
  ('3','3a','Pediátricos','Jarabes y gotas infantiles',8),
  ('3','3b','Adultos','Tabletas y grageas',9),
  ('3','3c','Tópicos','Cremas antialérgicas o con corticoesteroides',10),
  ('3','3d','Inyectables','Ampollas para emergencias',11),
  ('4','4a','Sueros Orales Pediátricos','Listos para tomar o sobres de sabores',12),
  ('4','4b','Sueros Orales Adultos','Sobres estándar',13),
  ('4','4c','Soluciones Intravenosas','Solución fisiológica 0.9%, Ringer Lactato, Glucosada',14),
  ('5','5a','Pediátricos','Gomitas, jarabes o gotas',15),
  ('5','5b','Adultos','Tabletas y cápsulas (Ej. Vitamina C, Complejo B)',16),
  ('5','5c','Suplementos Nutricionales','Fórmulas fortificadas para recuperación',17),
  ('6','6a','Material de Curas','Gasas, compresas, algodón, curitas, hisopos',18),
  ('6','6b','Fijación y Vendajes','Adhesivos, micropore, vendas elásticas y de gasa',19),
  ('6','6c','Descartables','Inyectadoras, agujas, yelcos, guantes, tapabocas',20),
  ('6','6d','Antisépticos','Alcohol, agua oxigenada, Betadine, Gerdex',21),
  ('7','7a','Humectantes Generales','Cremas corporales, lociones, vaselina',22),
  ('7','7b','Cuidado Pediátrico','Cremas antipañalitis',23),
  ('7','7c','Tratamiento Especializado','Cicatrizantes, pomadas para quemaduras',24),
  ('8','8a','Equipos de Diagnóstico','Tensiómetros, termómetros, oxímetros, glucómetros',25),
  ('8','8b','Terapia Respiratoria','Nebulizadores, mascarillas, inhalocámaras',26),
  ('8','8c','Soporte y Movilidad','Sillas de ruedas, muletas, bastones, collarines, férulas',27),
  ('9','9a','Refugio y Descanso','Carpas, toldos, colchonetas, sacos de dormir',28),
  ('9','9b','Saneamiento y Organización','Papeleras, bolsas industriales, tobos/cubetas',29),
  ('9','9c','Mobiliario y Logística Básica','Sillas/mesas plegables, cavas, linternas, pilas',30),
  ('10','10a','Ropa Pediátrica','Bebés y niños por tallas',31),
  ('10','10b','Ropa de Adultos','Hombres y mujeres por tallas',32),
  ('10','10c','Ropa de Frío','Abrigos, suéteres, gorros, guantes',33),
  ('10','10d','Lencería Básica','Sábanas, fundas, cobijas, toallas',34),
  ('11','11a','Alimentación Infantil','Fórmulas lácteas, compotas, cereales',35),
  ('11','11b','Secos y No Perecederos','Arroz, pasta, harinas, granos, azúcar, sal',36),
  ('11','11c','Enlatados y Proteínas','Atún, sardinas, jamonilla, vegetales',37),
  ('11','11d','Bebidas y Listos para Consumir','Agua potable, galletas, barras energéticas',38),
  ('12','12a','Higiene Pediátrica','Pañales por etapas, toallitas húmedas',39),
  ('12','12b','Higiene Femenina','Toallas sanitarias, tampones, protectores',40),
  ('12','12c','Cuidado Especial/Adulto Mayor','Pañales de adulto, centros de cama',41),
  ('12','12d','Aseo Diario','Jabón, champú, desodorante, crema dental, cepillos, papel higiénico',42)
) AS v(section_code, code, name, description, ord)
JOIN inventory_sections s ON s.code = v.section_code
ON CONFLICT (code) DO NOTHING;

-- ── Seed: centro placeholder + ubicación por defecto ─────────────────────────
WITH c AS (
  INSERT INTO acopio_centers (organization_id, name, ubicacion)
  VALUES ('a0000000-0000-4000-8000-000000000001',
          'Centro de Acopio La Guaira – Campo de Golf',
          'La Guaira – Campo de Golf')
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id
)
INSERT INTO inventory_locations (acopio_center_id, name, description)
SELECT id, 'Almacén principal', 'Ubicación por defecto' FROM c;
