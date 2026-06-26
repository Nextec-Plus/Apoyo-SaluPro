-- Migration 006: Track when a catastrophe victim has been sent to SaluPro
-- Prevents duplicate sends and provides audit trail

ALTER TABLE catastrophe_victim_info
  ADD COLUMN salupro_sent_at TIMESTAMPTZ;
