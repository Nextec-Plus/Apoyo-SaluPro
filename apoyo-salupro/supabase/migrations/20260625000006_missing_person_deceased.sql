-- Migration 006: Registro interno de personas fallecidas
--
-- Permite que el dashboard (autenticado) registre una persona como fallecida.
--  - motivo_fallecimiento: reemplaza a "último lugar visto" en el formulario
--    cuando el registro es de tipo fallecido. Opcional.
--  - fallecimiento_confirmado: TRUE solo cuando una persona que ya estaba
--    reportada como Desaparecida/Avistada se confirma fallecida (por cédula).
--    En un alta directa como fallecido permanece FALSE.
--
-- El estado 'Confirmado Fallecido' ya existe en el enum missing_person_status.

ALTER TABLE missing_persons
  ADD COLUMN motivo_fallecimiento      TEXT,
  ADD COLUMN fallecimiento_confirmado  BOOLEAN NOT NULL DEFAULT false;

-- El índice idx_missing_persons_cedula (migración 002) ya cubre la búsqueda por
-- cédula que usa la confirmación automática de fallecimiento.
