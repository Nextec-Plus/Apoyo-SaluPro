-- ============================================================================
-- INSERT TRASLADOS — Crisis La Guaira 2026
-- 7 pacientes registrados como Transferido (Trasladado a Refugio Oficial)
-- Organization: a0000000-0000-4000-8000-000000000001 (Clínica Móvil La Guaira)
--
-- Ejecutar en: Supabase SQL Editor
--   https://qgalaewrpqvdpfuuwlrs.supabase.co
--
-- El registration_number (V-NNN) se auto-calcula correlativo a los existentes.
-- ============================================================================

DO $$
DECLARE
  org_id     UUID    := 'a0000000-0000-4000-8000-000000000001';
  base_count INTEGER;
  idx        INTEGER := 0;
  v_id       UUID;
  reg_num    TEXT;
  p          JSONB;

  patients JSONB[] := ARRAY[

    '{
      "nombre":"Yohanny Linares",
      "cedula":"30370021","edad":22,"genero":"F","telefono":"04129329702",
      "sector":"Urba la Páez","edificio":"Vereda #2 parte alta","apto":null,
      "dx":"Fx Pelvis","triage":"Rojo"
    }'::jsonb,

    '{
      "nombre":"Vilsaet Lugo",
      "cedula":"16309175","edad":43,"genero":"F","telefono":"04241346472",
      "sector":"Av la Atlántida","edificio":"calle #5 (Banesco)","apto":null,
      "dx":"Abdomen Médico Qx","triage":"Rojo"
    }'::jsonb,

    '{
      "nombre":"Yoldri Piñero",
      "cedula":"26478330","edad":29,"genero":"M","telefono":"04242007304",
      "sector":"Urb Playa Grande","edificio":"Resd Luisa Cáceres de Arismendi","apto":"piso 10",
      "dx":"Fx de Pelvis","triage":"Rojo"
    }'::jsonb,

    '{
      "nombre":"Edelvis Flores de Piñero",
      "cedula":"12460599","edad":53,"genero":"F","telefono":"04242007304",
      "sector":"Urb Playa Grande","edificio":"Resd Luisa Cáceres de Arismendi","apto":"piso 10",
      "dx":"Fx de Fémur Der","triage":"Rojo"
    }'::jsonb,

    '{
      "nombre":"Richard Gil",
      "cedula":"12884866","edad":53,"genero":"M","telefono":"04127037114",
      "sector":"Maiquetia","edificio":"Edif Américas","apto":"piso 12 Apto 144-B",
      "dx":"TCE Moderado / Tx de Hombro","triage":"Rojo"
    }'::jsonb,

    '{
      "nombre":"Tahina Presilla",
      "cedula":"14633222","edad":47,"genero":"F","telefono":"04241543275",
      "sector":"La Soublette Sector Sta Cruz","edificio":null,"apto":null,
      "dx":"Hipotension","triage":"Rojo"
    }'::jsonb,

    '{
      "nombre":"Carmen Poleo",
      "cedula":"6481485","edad":65,"genero":"F","telefono":"04122564652",
      "sector":"Arrecife Villa del Mar","edificio":"Callé Bolivar","apto":null,
      "dx":"Asma Moderada","triage":"Amarillo"
    }'::jsonb

  ];

BEGIN
  -- Punto de partida: el número V-NNN más alto YA usado (no count(*),
  -- porque puede haber huecos por victims borradas y chocar con V-NNN existentes).
  SELECT COALESCE(MAX((regexp_replace(registration_number, '[^0-9]', '', 'g'))::int), 0)
    INTO base_count
    FROM catastrophe_victims
   WHERE organization_id = org_id
     AND registration_number ~ '^V-[0-9]+$';

  FOREACH p IN ARRAY patients LOOP
    idx := idx + 1;
    reg_num := 'V-' || lpad((base_count + idx)::text, 3, '0');

    -- 1) Ficha del paciente (catastrophe_victims)
    INSERT INTO catastrophe_victims (
      organization_id, registration_number, nombre_completo,
      cedula, edad, genero, telefono_contacto,
      sector_comunidad, nombre_edificio_casa, numero_apartamento_casa,
      notas
    )
    VALUES (
      org_id, reg_num, p->>'nombre',
      NULLIF(p->>'cedula',''), (p->>'edad')::int, NULLIF(p->>'genero',''),
      NULLIF(p->>'telefono',''),
      NULLIF(p->>'sector',''), NULLIF(p->>'edificio',''), NULLIF(p->>'apto',''),
      'Trasladado a Refugio Oficial'
    )
    RETURNING id INTO v_id;

    -- 2) Ficha clínica (catastrophe_victim_info) — 1:1 con la víctima
    INSERT INTO catastrophe_victim_info (
      organization_id, victim_id,
      triage_category, motivo_principal_consulta,
      estado_destino, fecha_hora_entrada
    )
    VALUES (
      org_id, v_id,
      (p->>'triage')::triage_category, p->>'dx',
      'Transferido', NOW()
    );
  END LOOP;

  RAISE NOTICE 'OK — % pacientes insertados como traslados (V-%s a V-%s).',
    idx, lpad((base_count+1)::text,3,'0'), lpad((base_count+idx)::text,3,'0');
END $$;


-- ============================================================================
-- VERIFICACIÓN: coincidencias con personas desaparecidas activas
-- (SOLO LECTURA — no marca nada, solo reporta si hay match)
-- Match por cédula normalizada (solo dígitos) o por nombre normalizado
-- ============================================================================

WITH inserted AS (
  SELECT registration_number, nombre_completo, cedula
  FROM catastrophe_victims
  WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
    AND cedula IN ('30370021','16309175','26478330','12460599',
                   '12884866','14633222','6481485')
)
SELECT
  i.registration_number,
  i.nombre_completo   AS paciente,
  i.cedula,
  mp.id               AS missing_person_id,
  mp.nombre || ' ' || mp.apellido AS desaparecido,
  mp.estado           AS estado_desaparecido,
  CASE
    WHEN regexp_replace(i.cedula, '[^0-9]', '', 'g')
       = regexp_replace(COALESCE(mp.cedula,''), '[^0-9]', '', 'g')
     AND i.cedula IS NOT NULL
     AND regexp_replace(i.cedula, '[^0-9]', '', 'g') <> ''
      THEN 'cedula'
    ELSE 'nombre'
  END AS match_type
FROM inserted i
JOIN missing_persons mp
  ON mp.estado IN ('Desaparecido', 'Avistado')
  AND (
    -- cédula: comparar solo dígitos (ignora V-/E-, espacios, guiones, puntos)
    ( regexp_replace(i.cedula, '[^0-9]', '', 'g')
      = regexp_replace(COALESCE(mp.cedula,''), '[^0-9]', '', 'g')
      AND regexp_replace(i.cedula, '[^0-9]', '', 'g') <> '' )
    OR
    -- nombre: minúsculas, sin acentos, espacios colapsados
    ( lower(regexp_replace(
        translate(lower(i.nombre_completo),
                  'áéíóúñüÁÉÍÓÚÑÜ','aeiounuAEIOUNU'), '\s+',' ','g'))
      = lower(regexp_replace(
        translate(lower(mp.nombre || ' ' || mp.apellido),
                  'áéíóúñüÁÉÍÓÚÑÜ','aeiounuAEIOUNU'), '\s+',' ','g')) )
  )
ORDER BY i.registration_number;
