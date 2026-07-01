-- Permite que un artículo (inventory_items) tenga stock repartido en varias
-- ubicaciones (inventory_locations) en vez de una sola. El stock por ubicación
-- vive en inventory_item_stock; inventory_items.stock se mantiene como total
-- cacheado (lo recalcula el trigger de movimientos) para no romper reportes
-- que ya suman/filtran por stock total.

-- ── Nueva tabla: stock por (artículo, ubicación) ─────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_item_stock (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id          UUID NOT NULL REFERENCES inventory_items (id) ON DELETE CASCADE,
  location_id      UUID NOT NULL REFERENCES inventory_locations (id) ON DELETE RESTRICT,
  acopio_center_id UUID NOT NULL REFERENCES acopio_centers (id) ON DELETE CASCADE,
  stock            INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_item_stock_item     ON inventory_item_stock (item_id);
CREATE INDEX IF NOT EXISTS idx_item_stock_location ON inventory_item_stock (location_id);
CREATE INDEX IF NOT EXISTS idx_item_stock_center   ON inventory_item_stock (acopio_center_id);

ALTER TABLE inventory_item_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY all_own_item_stock ON inventory_item_stock
  FOR ALL TO authenticated
  USING (acopio_center_id IN (SELECT acopio_center_id FROM acopio_user_assignments WHERE user_id = auth.uid()))
  WITH CHECK (acopio_center_id IN (SELECT acopio_center_id FROM acopio_user_assignments WHERE user_id = auth.uid()));

-- ── Backfill: mueve el stock existente (item.location_id, item.stock) a la
--    nueva tabla. Los artículos sin ubicación pero con stock > 0 se asignan a
--    la primera ubicación registrada de su centro (fallback razonable dado
--    que antes la ubicación era opcional). ────────────────────────────────────
INSERT INTO inventory_item_stock (item_id, location_id, acopio_center_id, stock)
SELECT i.id, i.location_id, i.acopio_center_id, i.stock
FROM inventory_items i
WHERE i.location_id IS NOT NULL AND i.stock > 0
ON CONFLICT (item_id, location_id) DO NOTHING;

INSERT INTO inventory_item_stock (item_id, location_id, acopio_center_id, stock)
SELECT i.id, loc.id, i.acopio_center_id, i.stock
FROM inventory_items i
JOIN LATERAL (
  SELECT l.id FROM inventory_locations l
  WHERE l.acopio_center_id = i.acopio_center_id
  ORDER BY l.created_at ASC
  LIMIT 1
) loc ON true
WHERE i.location_id IS NULL AND i.stock > 0
ON CONFLICT (item_id, location_id) DO NOTHING;

-- ── inventory_items ya no apunta a una única ubicación ───────────────────────
ALTER TABLE inventory_items DROP COLUMN IF EXISTS location_id;

-- ── Trigger: ahora ajusta el stock de la ubicación del movimiento y
--    recalcula el total cacheado en inventory_items.stock ────────────────────
CREATE OR REPLACE FUNCTION apply_inventory_movement()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  centro  uuid;
  loc_cur integer;
BEGIN
  SELECT acopio_center_id INTO centro FROM inventory_items WHERE id = NEW.item_id;
  IF centro IS NULL THEN
    RAISE EXCEPTION 'El artículo % no existe', NEW.item_id;
  END IF;
  IF NEW.acopio_center_id IS NULL THEN NEW.acopio_center_id := centro; END IF;
  IF NEW.location_id IS NULL THEN
    RAISE EXCEPTION 'Debe indicar la ubicación del movimiento';
  END IF;

  IF NEW.tipo = 'entrada' THEN
    INSERT INTO inventory_item_stock (item_id, location_id, acopio_center_id, stock)
    VALUES (NEW.item_id, NEW.location_id, centro, NEW.cantidad)
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET stock = inventory_item_stock.stock + NEW.cantidad, updated_at = now()
    RETURNING stock INTO NEW.new_stock;
    NEW.previous_stock := NEW.new_stock - NEW.cantidad;
  ELSE -- salida
    SELECT stock INTO loc_cur FROM inventory_item_stock
      WHERE item_id = NEW.item_id AND location_id = NEW.location_id FOR UPDATE;
    IF loc_cur IS NULL THEN loc_cur := 0; END IF;
    IF loc_cur < NEW.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente en esa ubicación: disponible %, solicitado %', loc_cur, NEW.cantidad;
    END IF;
    NEW.previous_stock := loc_cur;
    NEW.new_stock := loc_cur - NEW.cantidad;
    UPDATE inventory_item_stock SET stock = NEW.new_stock, updated_at = now()
      WHERE item_id = NEW.item_id AND location_id = NEW.location_id;
  END IF;

  UPDATE inventory_items
    SET stock = (SELECT COALESCE(SUM(stock), 0) FROM inventory_item_stock WHERE item_id = NEW.item_id),
        updated_at = now()
  WHERE id = NEW.item_id;

  RETURN NEW;
END;
$$;
