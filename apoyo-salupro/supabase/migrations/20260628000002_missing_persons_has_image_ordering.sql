-- Orden "con foto primero" en los listados públicos de personas desaparecidas.
--
-- Como la paginación es server-side (cursor en /desaparecidos, páginas numeradas
-- en la landing), el orden debe resolverse en la base. `has_image` es una columna
-- booleana mantenida por trigger para poder ordenar e indexar por presencia de
-- foto sin un JOIN/agregado en cada consulta.

ALTER TABLE missing_persons
  ADD COLUMN IF NOT EXISTS has_image boolean NOT NULL DEFAULT false;

-- Backfill del estado actual.
UPDATE missing_persons mp
SET has_image = EXISTS (
  SELECT 1 FROM missing_person_images i WHERE i.missing_person_id = mp.id
)
WHERE mp.has_image IS DISTINCT FROM EXISTS (
  SELECT 1 FROM missing_person_images i WHERE i.missing_person_id = mp.id
);

-- Trigger: sincroniza has_image ante insert/update/delete de imágenes.
-- SECURITY DEFINER para actualizar missing_persons sin tropezar con RLS.
CREATE OR REPLACE FUNCTION sync_missing_person_has_image()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE missing_persons SET has_image = true
      WHERE id = NEW.missing_person_id AND has_image = false;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE missing_persons SET has_image = EXISTS (
      SELECT 1 FROM missing_person_images WHERE missing_person_id = OLD.missing_person_id
    ) WHERE id = OLD.missing_person_id;
  ELSIF (TG_OP = 'UPDATE' AND NEW.missing_person_id <> OLD.missing_person_id) THEN
    UPDATE missing_persons SET has_image = true
      WHERE id = NEW.missing_person_id AND has_image = false;
    UPDATE missing_persons SET has_image = EXISTS (
      SELECT 1 FROM missing_person_images WHERE missing_person_id = OLD.missing_person_id
    ) WHERE id = OLD.missing_person_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS missing_person_images_sync_has_image ON missing_person_images;
CREATE TRIGGER missing_person_images_sync_has_image
  AFTER INSERT OR UPDATE OR DELETE ON missing_person_images
  FOR EACH ROW EXECUTE FUNCTION sync_missing_person_has_image();

-- Índices que cubren el nuevo orden (con foto primero, luego recientes).
CREATE INDEX IF NOT EXISTS idx_missing_persons_hasimg_order
  ON missing_persons (has_image DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_missing_persons_estado_hasimg_order
  ON missing_persons (estado, has_image DESC, created_at DESC, id DESC);
