-- Migration 005: Link missing persons found via medical record (ficha) match

CREATE TYPE missing_person_match_type AS ENUM ('cedula', 'nombre');

CREATE TABLE missing_person_found (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  missing_person_id     UUID NOT NULL REFERENCES missing_persons (id) ON DELETE CASCADE,
  catastrophe_victim_id UUID NOT NULL REFERENCES catastrophe_victims (id) ON DELETE CASCADE,
  match_type            missing_person_match_type NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (missing_person_id, catastrophe_victim_id)
);

CREATE INDEX idx_missing_person_found_person ON missing_person_found (missing_person_id);
CREATE INDEX idx_missing_person_found_victim ON missing_person_found (catastrophe_victim_id);
CREATE INDEX idx_missing_person_found_created ON missing_person_found (created_at DESC);

ALTER TABLE missing_person_found ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_select_missing_person_found" ON missing_person_found
  FOR SELECT USING (true);

CREATE POLICY "service_insert_missing_person_found" ON missing_person_found
  FOR INSERT WITH CHECK (true);
