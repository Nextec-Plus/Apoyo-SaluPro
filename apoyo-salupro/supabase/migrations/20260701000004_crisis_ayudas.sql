-- Registro de ayudas humanitarias entregadas (alimentos, higiene, etc.) por
-- cédula. Independiente de catastrophe_victims: cualquier persona puede
-- recibir ayuda sin estar registrada como paciente/víctima.
--
-- Los tipos de ayuda son un catálogo editable (tabla ayuda_tipos), no un
-- enum fijo: el usuario puede crear y renombrar tipos de ayuda desde la UI.

-- Limpieza defensiva: una corrida anterior de esta migración (versión previa
-- con enum ayuda_tipo en vez de catálogo) pudo haber dejado las tablas a
-- medio crear. Sin datos reales todavía, es seguro tirar todo y recrear.
DROP FUNCTION IF EXISTS create_ayuda_entrega(uuid, text, text, uuid[], integer[], uuid);
DROP FUNCTION IF EXISTS create_ayuda_entrega(uuid, text, text, ayuda_tipo[], integer[], uuid);
DROP TABLE IF EXISTS ayuda_entrega_items CASCADE;
DROP TABLE IF EXISTS ayuda_entregas CASCADE;
DROP TABLE IF EXISTS ayuda_tipos CASCADE;
DROP TYPE IF EXISTS ayuda_tipo;

-- ── Catálogo de tipos de ayuda ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ayuda_tipos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL,
  nombre           TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_ayuda_tipos_org ON ayuda_tipos (organization_id);

ALTER TABLE ayuda_tipos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_ayuda_tipos" ON ayuda_tipos
  USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE TRIGGER ayuda_tipos_updated_at
  BEFORE UPDATE ON ayuda_tipos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Semilla: los 4 tipos que ya se venían entregando manualmente, para el
-- centro por defecto (ver DEFAULT_ORGANIZATION_ID en lib/config.ts).
INSERT INTO ayuda_tipos (organization_id, nombre) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Higiene'),
  ('a0000000-0000-4000-8000-000000000001', 'Combo alimentario'),
  ('a0000000-0000-4000-8000-000000000001', 'Combo infantil'),
  ('a0000000-0000-4000-8000-000000000001', 'Pañales')
ON CONFLICT (organization_id, nombre) DO NOTHING;

-- ── Entrega (cabecera): una cédula + fecha ───────────────────────────────────
CREATE TABLE IF NOT EXISTS ayuda_entregas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL,
  cedula           TEXT NOT NULL,
  nombre_completo  TEXT NOT NULL,
  created_by       UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ayuda_entregas_org    ON ayuda_entregas (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ayuda_entregas_cedula ON ayuda_entregas (organization_id, cedula);

-- ── Items de la entrega: tipo de ayuda (catálogo) + cantidad ─────────────────
CREATE TABLE IF NOT EXISTS ayuda_entrega_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id  UUID NOT NULL REFERENCES ayuda_entregas (id) ON DELETE CASCADE,
  tipo_id     UUID NOT NULL REFERENCES ayuda_tipos (id) ON DELETE RESTRICT,
  cantidad    INTEGER NOT NULL CHECK (cantidad > 0)
);
CREATE INDEX IF NOT EXISTS idx_ayuda_entrega_items_entrega ON ayuda_entrega_items (entrega_id);
CREATE INDEX IF NOT EXISTS idx_ayuda_entrega_items_tipo    ON ayuda_entrega_items (tipo_id);

ALTER TABLE ayuda_entregas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ayuda_entrega_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_ayuda_entregas" ON ayuda_entregas
  USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "org_isolation_ayuda_entrega_items" ON ayuda_entrega_items
  USING (
    entrega_id IN (
      SELECT id FROM ayuda_entregas
      WHERE organization_id = (auth.jwt() ->> 'organization_id')::uuid
    )
  );

-- ── RPC: crea la entrega + sus items en una sola transacción (todo o nada) ───
CREATE OR REPLACE FUNCTION create_ayuda_entrega(
  p_organization_id uuid,
  p_cedula          text,
  p_nombre_completo text,
  p_tipo_ids        uuid[],
  p_cantidades      integer[],
  p_user            uuid DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_entrega_id uuid;
  i            integer;
BEGIN
  IF array_length(p_tipo_ids, 1) IS NULL OR array_length(p_tipo_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Debe indicar al menos una ayuda entregada';
  END IF;
  IF array_length(p_tipo_ids, 1) <> array_length(p_cantidades, 1) THEN
    RAISE EXCEPTION 'La cantidad de ayudas y cantidades no coincide';
  END IF;

  INSERT INTO ayuda_entregas (organization_id, cedula, nombre_completo, created_by)
  VALUES (p_organization_id, p_cedula, p_nombre_completo, p_user)
  RETURNING id INTO v_entrega_id;

  FOR i IN 1 .. array_length(p_tipo_ids, 1) LOOP
    IF p_cantidades[i] IS NULL OR p_cantidades[i] <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para la ayuda %', p_tipo_ids[i];
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM ayuda_tipos WHERE id = p_tipo_ids[i] AND organization_id = p_organization_id
    ) THEN
      RAISE EXCEPTION 'Tipo de ayuda % no pertenece a este centro', p_tipo_ids[i];
    END IF;
    INSERT INTO ayuda_entrega_items (entrega_id, tipo_id, cantidad)
    VALUES (v_entrega_id, p_tipo_ids[i], p_cantidades[i]);
  END LOOP;

  RETURN v_entrega_id;
END;
$$;
