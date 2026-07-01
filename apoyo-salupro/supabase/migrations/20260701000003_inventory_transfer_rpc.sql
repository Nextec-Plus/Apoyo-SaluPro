-- Traslado de stock entre ubicaciones: función atómica que registra una
-- salida en la ubicación origen y una entrada en la ubicación destino por
-- cada artículo, reusando el trigger apply_inventory_movement ya existente.
-- Toda la función corre en una única transacción: si cualquier línea falla
-- (stock insuficiente, artículo inexistente), se revierte todo (todo o nada).

CREATE OR REPLACE FUNCTION transfer_inventory_stock(
  p_item_ids   uuid[],
  p_cantidades integer[],
  p_origen     uuid,
  p_destino    uuid,
  p_center     uuid,
  p_user       uuid,
  p_nota       text DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  origen_nombre  text;
  destino_nombre text;
  i              integer;
  v_item_id      uuid;
  v_cantidad     integer;
  v_item_center  uuid;
  nota_salida    text;
  nota_entrada   text;
BEGIN
  IF p_origen = p_destino THEN
    RAISE EXCEPTION 'La ubicación origen y destino no pueden ser la misma';
  END IF;
  IF array_length(p_item_ids, 1) IS NULL OR array_length(p_item_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Debe indicar al menos un artículo para trasladar';
  END IF;
  IF array_length(p_item_ids, 1) <> array_length(p_cantidades, 1) THEN
    RAISE EXCEPTION 'La cantidad de artículos y cantidades no coincide';
  END IF;

  SELECT name INTO origen_nombre FROM inventory_locations WHERE id = p_origen AND acopio_center_id = p_center;
  IF origen_nombre IS NULL THEN
    RAISE EXCEPTION 'Ubicación origen inválida';
  END IF;
  SELECT name INTO destino_nombre FROM inventory_locations WHERE id = p_destino AND acopio_center_id = p_center;
  IF destino_nombre IS NULL THEN
    RAISE EXCEPTION 'Ubicación destino inválida';
  END IF;

  nota_salida  := 'Traslado → ' || destino_nombre || COALESCE(' · ' || NULLIF(trim(p_nota), ''), '');
  nota_entrada := 'Traslado ← ' || origen_nombre  || COALESCE(' · ' || NULLIF(trim(p_nota), ''), '');

  FOR i IN 1 .. array_length(p_item_ids, 1) LOOP
    v_item_id  := p_item_ids[i];
    v_cantidad := p_cantidades[i];

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el artículo %', v_item_id;
    END IF;

    SELECT acopio_center_id INTO v_item_center FROM inventory_items WHERE id = v_item_id;
    IF v_item_center IS NULL OR v_item_center <> p_center THEN
      RAISE EXCEPTION 'Artículo % no pertenece a este centro', v_item_id;
    END IF;

    INSERT INTO inventory_movements (
      acopio_center_id, item_id, tipo, cantidad, location_id, nota, created_by
    ) VALUES (
      p_center, v_item_id, 'salida', v_cantidad, p_origen, nota_salida, p_user
    );

    INSERT INTO inventory_movements (
      acopio_center_id, item_id, tipo, cantidad, location_id, nota, created_by
    ) VALUES (
      p_center, v_item_id, 'entrada', v_cantidad, p_destino, nota_entrada, p_user
    );
  END LOOP;
END;
$$;
