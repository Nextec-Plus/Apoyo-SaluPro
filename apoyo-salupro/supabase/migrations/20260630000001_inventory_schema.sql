-- Migration: Inventory schema for Apoyo-SaluPro
-- Gestiona localizaciones, categorias (con subcategorias), materiales,
-- centros medicos y asignaciones de inventario.
-- Sigue las convenciones de las migraciones previas:
--   UUID PK, organization_id, RLS para authenticated, trigger updated_at,
--   borrado logico via is_active (no DELETE fisico).

-- ── ENUMs ────────────────────────────────────────────────────────────────────
CREATE TYPE assignment_status AS ENUM ('Despachado', 'Recibido', 'Cancelado');

-- ── inventory_locations: secciones fisicas del almacen (Seccion A, B, ...) ────
CREATE TABLE inventory_locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name            TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE INDEX idx_inventory_locations_org ON inventory_locations (organization_id);

-- ── inventory_categories: categorias y subcategorias (auto-referencia) ────────
-- parent_id NULL  => categoria de primer nivel (lleva la localizacion)
-- parent_id != NULL => subcategoria (hereda la localizacion del padre)
CREATE TABLE inventory_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code            TEXT,
  name            TEXT NOT NULL,
  description     TEXT,
  parent_id       UUID REFERENCES inventory_categories (id) ON DELETE CASCADE,
  location_id     UUID REFERENCES inventory_locations (id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE INDEX idx_inventory_categories_org    ON inventory_categories (organization_id);
CREATE INDEX idx_inventory_categories_parent ON inventory_categories (parent_id);

-- Nombre unico por nivel (insensible a mayusculas).
CREATE UNIQUE INDEX uq_inventory_categories_top_name
  ON inventory_categories (organization_id, lower(name))
  WHERE parent_id IS NULL;
CREATE UNIQUE INDEX uq_inventory_categories_sub_name
  ON inventory_categories (organization_id, parent_id, lower(name))
  WHERE parent_id IS NOT NULL;

-- ── inventory_materials: catalogo de materiales ───────────────────────────────
CREATE TABLE inventory_materials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name            TEXT NOT NULL,
  category_id     UUID REFERENCES inventory_categories (id) ON DELETE SET NULL,
  description     TEXT,
  unit            TEXT,
  stock           INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_materials_org      ON inventory_materials (organization_id);
CREATE INDEX idx_inventory_materials_category ON inventory_materials (category_id);
CREATE INDEX idx_inventory_materials_name     ON inventory_materials (lower(name));

-- ── inventory_medical_centers: centros medicos receptores ─────────────────────
CREATE TABLE inventory_medical_centers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name            TEXT NOT NULL,
  location        TEXT,
  contact         TEXT,
  phone           TEXT,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE INDEX idx_inventory_medical_centers_org ON inventory_medical_centers (organization_id);

-- ── inventory_assignments: despachos de material a centros medicos ────────────
CREATE TABLE inventory_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL,
  material_id       UUID NOT NULL REFERENCES inventory_materials (id) ON DELETE CASCADE,
  medical_center_id UUID NOT NULL REFERENCES inventory_medical_centers (id) ON DELETE CASCADE,
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  status            assignment_status NOT NULL DEFAULT 'Despachado',
  notes             TEXT,
  fecha             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_assignments_org      ON inventory_assignments (organization_id);
CREATE INDEX idx_inventory_assignments_material ON inventory_assignments (material_id);
CREATE INDEX idx_inventory_assignments_center   ON inventory_assignments (medical_center_id);
CREATE INDEX idx_inventory_assignments_status   ON inventory_assignments (status);
CREATE INDEX idx_inventory_assignments_fecha    ON inventory_assignments (fecha);

-- ── Triggers updated_at (reusa update_updated_at_column de la migracion 001) ──
CREATE TRIGGER inventory_locations_updated_at
  BEFORE UPDATE ON inventory_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER inventory_categories_updated_at
  BEFORE UPDATE ON inventory_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER inventory_materials_updated_at
  BEFORE UPDATE ON inventory_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER inventory_medical_centers_updated_at
  BEFORE UPDATE ON inventory_medical_centers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER inventory_assignments_updated_at
  BEFORE UPDATE ON inventory_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Row Level Security: staff autenticado con acceso total (patron migr. 004) ─
ALTER TABLE inventory_locations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_materials       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_medical_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_assignments     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_inventory_locations" ON inventory_locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_inventory_categories" ON inventory_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_inventory_materials" ON inventory_materials
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_inventory_medical_centers" ON inventory_medical_centers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_inventory_assignments" ON inventory_assignments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Vista: estado de asignacion por material ──────────────────────────────────
-- cantidad_asignada  = suma de despachos no cancelados
-- cantidad_disponible = stock - cantidad_asignada
-- security_invoker => respeta el RLS de las tablas base.
CREATE VIEW inventory_materials_assignment_status
WITH (security_invoker = on) AS
SELECT
  m.id,
  m.organization_id,
  m.name,
  m.category_id,
  m.description,
  m.unit,
  m.stock,
  m.is_active,
  m.created_at,
  m.updated_at,
  COALESCE(SUM(CASE WHEN a.status <> 'Cancelado' THEN a.quantity ELSE 0 END), 0) AS cantidad_asignada,
  m.stock - COALESCE(SUM(CASE WHEN a.status <> 'Cancelado' THEN a.quantity ELSE 0 END), 0) AS cantidad_disponible,
  CASE
    WHEN COUNT(CASE WHEN a.status <> 'Cancelado' THEN 1 END) > 0 THEN 'Asignado'
    ELSE 'Sin Asignar'
  END AS estado_asignacion
FROM inventory_materials m
LEFT JOIN inventory_assignments a ON a.material_id = m.id
GROUP BY m.id;

-- ── Seed: localizaciones (Seccion A .. Seccion L) ─────────────────────────────
INSERT INTO inventory_locations (organization_id, name)
SELECT 'a0000000-0000-4000-8000-000000000001', 'Sección ' || s
FROM (VALUES ('A'),('B'),('C'),('D'),('E'),('F'),('G'),('H'),('I'),('J'),('K'),('L')) AS v(s)
ON CONFLICT (organization_id, name) DO NOTHING;

-- ── Seed: categorias de primer nivel (con su localizacion) ────────────────────
INSERT INTO inventory_categories (organization_id, code, name, location_id)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  v.code,
  v.name,
  (SELECT id FROM inventory_locations
   WHERE organization_id = 'a0000000-0000-4000-8000-000000000001' AND name = v.loc)
FROM (VALUES
  ('1',  'Analgésicos y Antipiréticos',                    'Sección A'),
  ('2',  'Antibióticos',                                   'Sección B'),
  ('3',  'Antialérgicos',                                  'Sección C'),
  ('4',  'Hidratación',                                    'Sección D'),
  ('5',  'Vitaminas y Nutrición',                          'Sección E'),
  ('6',  'Material Médico Quirúrgico (Insumos y Curas)',   'Sección F'),
  ('7',  'Cuidado de la Piel y Tópicos',                   'Sección G'),
  ('8',  'Equipos Médicos',                                'Sección H'),
  ('9',  'Equipos Generales (Logística e Infraestructura)','Sección I'),
  ('10', 'Ropa y Textiles',                                'Sección J'),
  ('11', 'Alimentos',                                      'Sección K'),
  ('12', 'Higiene Personal y Misceláneos',                 'Sección L')
) AS v(code, name, loc)
ON CONFLICT (organization_id, code) DO NOTHING;

-- ── Seed: subcategorias ───────────────────────────────────────────────────────
INSERT INTO inventory_categories (organization_id, code, name, description, parent_id)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  v.code,
  v.name,
  v.descr,
  (SELECT id FROM inventory_categories
   WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
     AND code = v.parent AND parent_id IS NULL)
FROM (VALUES
  ('1.1', 'Pediátricos',                 'Jarabes, gotas y supositorios infantiles (ej. Acetaminofén/Ibuprofeno pediátrico).', '1'),
  ('1.2', 'Adultos',                     'Tabletas y cápsulas (ej. Acetaminofén, Diclofenac, Ibuprofeno).',                    '1'),
  ('1.3', 'Inyectables',                 'Ampollas para uso intravenoso o intramuscular.',                                    '1'),
  ('2.1', 'Pediátricos',                 'Polvo para suspensión oral y gotas.',                                               '2'),
  ('2.2', 'Adultos',                     'Tabletas y cápsulas (ej. Penicilina, Amoxicilina).',                                '2'),
  ('2.3', 'Tópicos',                     'Cremas y ungüentos antibióticos.',                                                  '2'),
  ('2.4', 'Inyectables',                 'Viales y ampollas.',                                                                '2'),
  ('3.1', 'Pediátricos',                 'Jarabes y gotas infantiles (ej. Loratadina, Cetirizina en jarabe).',                '3'),
  ('3.2', 'Adultos',                     'Tabletas y grageas.',                                                               '3'),
  ('3.3', 'Tópicos',                     'Cremas antialérgicas o con corticoesteroides.',                                     '3'),
  ('3.4', 'Inyectables',                 'Ampollas para emergencias alérgicas.',                                              '3'),
  ('4.1', 'Sueros Orales Pediátricos',   'Soluciones infantiles listas para tomar o sobres de sabores.',                      '4'),
  ('4.2', 'Sueros Orales Adultos',       'Sobres estándar.',                                                                  '4'),
  ('4.3', 'Soluciones Intravenosas',     'Solución fisiológica (0.9%), Ringer Lactato, Solución Glucosada.',                  '4'),
  ('5.1', 'Pediátricos',                 'Multivitamínicos en gomitas, jarabes o gotas.',                                     '5'),
  ('5.2', 'Adultos',                     'Multivitamínicos en tabletas y cápsulas (ej. Vitamina C, Complejo B).',             '5'),
  ('5.3', 'Suplementos Nutricionales',   'Fórmulas líquidas o en polvo fortificadas para recuperación.',                      '5'),
  ('6.1', 'Material de Curas',           'Gasas (estériles y no estériles), compresas, algodón, curitas, hisopos.',           '6'),
  ('6.2', 'Fijación y Vendajes',         'Adhesivos, cinta micropore, vendas elásticas y de gasa.',                           '6'),
  ('6.3', 'Descartables',                'Inyectadoras, agujas, yelcos, mariposas (scalp), guantes, tapabocas.',              '6'),
  ('6.4', 'Antisépticos',                'Alcohol, agua oxigenada, povidona yodada (Betadine), clorhexidina.',                '6'),
  ('7.1', 'Humectantes Generales',       'Cremas corporales, lociones hidratantes, vaselina.',                                '7'),
  ('7.2', 'Cuidado Pediátrico',          'Cremas antipañalitis.',                                                             '7'),
  ('7.3', 'Tratamiento Especializado',   'Cremas cicatrizantes, pomadas para quemaduras (ej. Sulfadiazina de plata).',        '7'),
  ('8.1', 'Equipos de Diagnóstico',      'Tensiómetros, termómetros, oxímetros de pulso, glucómetros (con sus cintas).',      '8'),
  ('8.2', 'Terapia Respiratoria',        'Nebulizadores, mascarillas para nebulizar, inhalocámaras.',                         '8'),
  ('8.3', 'Soporte y Movilidad',         'Sillas de ruedas, muletas, bastones, collarines, férulas.',                         '8'),
  ('9.1', 'Refugio y Descanso',          'Carpas, toldos, colchonetas, sacos de dormir.',                                     '9'),
  ('9.2', 'Saneamiento y Organización',  'Papeleras, bolsas de basura industriales, tobos (cubetas).',                        '9'),
  ('9.3', 'Mobiliario y Logística',      'Sillas y mesas plegables, cavas (hieleras), linternas, baterías/pilas.',            '9'),
  ('10.1','Ropa Pediátrica',             'Bebés y niños (separada por tallas o rangos de edad).',                             '10'),
  ('10.2','Ropa de Adultos',             'Hombres y mujeres (separada por tallas).',                                          '10'),
  ('10.3','Ropa de Frío',                'Abrigos, suéteres, gorros, guantes.',                                               '10'),
  ('10.4','Lencería Básica',             'Sábanas, fundas, cobijas, mantas, toallas.',                                        '10'),
  ('11.1','Alimentación Infantil',       'Fórmulas lácteas, compotas, cereales infantiles.',                                  '11'),
  ('11.2','Secos y No Perecederos',      'Arroz, pasta, harina (maíz y trigo), granos, azúcar, sal.',                         '11'),
  ('11.3','Enlatados y Proteínas',       'Atún, sardinas, jamonilla, vegetales enlatados.',                                   '11'),
  ('11.4','Bebidas y Listos',            'Agua potable embotellada, galletas, barras energéticas.',                           '11'),
  ('12.1','Higiene Pediátrica',          'Pañales para bebés (separados por etapas), toallitas húmedas.',                     '12'),
  ('12.2','Higiene Femenina',            'Toallas sanitarias, protectores diarios, tampones.',                                '12'),
  ('12.3','Cuidado de Adultos Mayores',  'Pañales de adulto, centros de cama (protectores absorbentes).',                     '12'),
  ('12.4','Aseo Diario',                 'Jabón, champú, desodorante, crema dental, cepillos, papel higiénico.',              '12')
) AS v(code, name, descr, parent)
ON CONFLICT (organization_id, code) DO NOTHING;
