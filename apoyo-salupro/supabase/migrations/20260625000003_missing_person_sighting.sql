-- Migration 003: Add 'Avistado' status to missing_person_status enum
-- Allows public sighting reports without closing the missing person case

ALTER TYPE missing_person_status ADD VALUE 'Avistado';
