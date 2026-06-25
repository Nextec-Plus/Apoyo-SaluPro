-- Migration 002: Missing persons reporting (public, no auth required)

CREATE TYPE missing_person_status AS ENUM ('Desaparecido', 'Encontrado', 'Confirmado Fallecido');

CREATE TABLE missing_persons (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID,

  -- Identity
  nombre                    TEXT NOT NULL,
  apellido                  TEXT NOT NULL,
  cedula                    TEXT,
  edad_aproximada           INTEGER,
  genero                    TEXT CHECK (genero IN ('M', 'F', 'Otro')),

  -- Last known location and details
  ultimo_lugar_visto        TEXT,
  informacion_adicional     TEXT,

  -- Status
  estado                    missing_person_status NOT NULL DEFAULT 'Desaparecido',

  -- Contact info: who to reach if someone has information about this person
  contacto_nombre           TEXT NOT NULL,
  contacto_apellido         TEXT NOT NULL,
  contacto_correo           TEXT,
  contacto_telefono_nacional       TEXT,
  contacto_telefono_internacional  TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_missing_persons_org      ON missing_persons (organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_missing_persons_cedula   ON missing_persons (cedula) WHERE cedula IS NOT NULL;
CREATE INDEX idx_missing_persons_estado   ON missing_persons (estado);
CREATE INDEX idx_missing_persons_nombre   ON missing_persons (nombre, apellido);

-- Images associated with a missing person report
CREATE TABLE missing_person_images (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  missing_person_id UUID NOT NULL REFERENCES missing_persons (id) ON DELETE CASCADE,
  storage_path      TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_missing_person_images_person ON missing_person_images (missing_person_id);

-- updated_at trigger (reuses function from migration 001)
CREATE TRIGGER missing_persons_updated_at
  BEFORE UPDATE ON missing_persons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE missing_persons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE missing_person_images ENABLE ROW LEVEL SECURITY;

-- Public: read and report without authentication
CREATE POLICY "public_select_missing_persons" ON missing_persons
  FOR SELECT USING (true);

CREATE POLICY "public_insert_missing_persons" ON missing_persons
  FOR INSERT WITH CHECK (true);

-- Only authenticated org members can update status (mark as found, etc.)
CREATE POLICY "org_update_missing_persons" ON missing_persons
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND (
      organization_id IS NULL
      OR organization_id = (auth.jwt() ->> 'organization_id')::uuid
    )
  );

-- Images: public read and insert, authenticated delete
CREATE POLICY "public_select_missing_person_images" ON missing_person_images
  FOR SELECT USING (true);

CREATE POLICY "public_insert_missing_person_images" ON missing_person_images
  FOR INSERT WITH CHECK (true);

CREATE POLICY "authenticated_delete_missing_person_images" ON missing_person_images
  FOR DELETE USING (auth.role() = 'authenticated');
