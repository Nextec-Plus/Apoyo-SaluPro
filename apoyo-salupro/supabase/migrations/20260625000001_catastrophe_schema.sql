-- Migration 001: Catastrophe schema for Apoyo-SaluPro
-- Retrocompatible with cgm.salu.pro MySQL catastrophe tables
-- Run in Supabase SQL Editor: https://qgalaewrpqvdpfuuwlrs.supabase.co

-- ENUMs (match exact values from SaluPro constants.ts)
CREATE TYPE triage_category AS ENUM ('Rojo', 'Amarillo', 'Verde');
CREATE TYPE care_state AS ENUM ('Triaje', 'En Atención', 'Hospitalizado', 'Transferido', 'Alta Médica', 'Anulado');
CREATE TYPE field_type AS ENUM ('text', 'textarea', 'select', 'boolean', 'number', 'date', 'datetime', 'file');

-- catastrophe_victims: independent victim registration (exists before a formal case)
CREATE TABLE catastrophe_victims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  registration_number TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  cedula TEXT,
  edad INTEGER,
  genero TEXT CHECK (genero IN ('M', 'F', 'Otro')),
  telefono_contacto TEXT,
  sector_comunidad TEXT,
  nombre_edificio_casa TEXT,
  numero_apartamento_casa TEXT,
  ubicacion_actual_refugio TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, registration_number)
);

CREATE INDEX idx_catastrophe_victims_org ON catastrophe_victims (organization_id);
CREATE INDEX idx_catastrophe_victims_cedula ON catastrophe_victims (cedula) WHERE cedula IS NOT NULL;

-- catastrophe_victim_info: clinical/medical data linked to victim + optional case
CREATE TABLE catastrophe_victim_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  victim_id UUID NOT NULL REFERENCES catastrophe_victims (id) ON DELETE CASCADE,
  case_id UUID,
  triage_category triage_category NOT NULL,
  motivo_principal_consulta TEXT,
  condiciones_preexistentes TEXT,
  alergias TEXT,
  tratamiento_medicamentos TEXT,
  estado_destino care_state NOT NULL DEFAULT 'Triaje',
  fecha_hora_entrada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (victim_id)
);

CREATE INDEX idx_catastrophe_victim_info_org ON catastrophe_victim_info (organization_id);
CREATE INDEX idx_catastrophe_victim_info_victim ON catastrophe_victim_info (victim_id);
CREATE INDEX idx_catastrophe_victim_info_triage ON catastrophe_victim_info (triage_category);
CREATE INDEX idx_catastrophe_victim_info_estado ON catastrophe_victim_info (estado_destino);

-- catastrophe_family_contacts: family/emergency contact registry per victim
CREATE TABLE catastrophe_family_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  victim_id UUID NOT NULL REFERENCES catastrophe_victims (id) ON DELETE CASCADE,
  nombre_contacto TEXT NOT NULL,
  relacion TEXT NOT NULL,
  telefono_nacional TEXT,
  telefono_internacional TEXT,
  is_emergency_contact BOOLEAN NOT NULL DEFAULT FALSE,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_catastrophe_family_contacts_org ON catastrophe_family_contacts (organization_id);
CREATE INDEX idx_catastrophe_family_contacts_victim ON catastrophe_family_contacts (victim_id);

-- catastrophe_care_requirements: configurable field requirements per care state
CREATE TABLE catastrophe_care_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provider_id UUID,
  provider_type TEXT,
  care_state care_state NOT NULL,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type field_type NOT NULL DEFAULT 'text',
  field_options JSONB,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, provider_id, care_state, field_name)
);

CREATE INDEX idx_catastrophe_care_req_org ON catastrophe_care_requirements (organization_id);
CREATE INDEX idx_catastrophe_care_req_provider ON catastrophe_care_requirements (provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX idx_catastrophe_care_req_state ON catastrophe_care_requirements (care_state);

-- Trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER catastrophe_victims_updated_at
  BEFORE UPDATE ON catastrophe_victims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER catastrophe_victim_info_updated_at
  BEFORE UPDATE ON catastrophe_victim_info
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER catastrophe_family_contacts_updated_at
  BEFORE UPDATE ON catastrophe_family_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER catastrophe_care_requirements_updated_at
  BEFORE UPDATE ON catastrophe_care_requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE catastrophe_victims ENABLE ROW LEVEL SECURITY;
ALTER TABLE catastrophe_victim_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE catastrophe_family_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE catastrophe_care_requirements ENABLE ROW LEVEL SECURITY;

-- RLS Policies: restrict access by organization_id from JWT claim
CREATE POLICY "org_isolation_victims" ON catastrophe_victims
  USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "org_isolation_victim_info" ON catastrophe_victim_info
  USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "org_isolation_family_contacts" ON catastrophe_family_contacts
  USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "org_isolation_care_requirements" ON catastrophe_care_requirements
  USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);
