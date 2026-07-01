# Traslado de inventario entre ubicaciones — diseño

## Problema

Inventario ya soporta stock repartido en múltiples ubicaciones (`inventory_item_stock`), pero no hay forma de mover stock existente de una ubicación a otra dentro de la app. Cuando alguien carga un producto en la ubicación equivocada, la única corrección posible hoy es una salida manual + una entrada manual, hechas por separado, sin garantía de atomicidad ni UX dedicada. Esto ya causó un error de captura (producto cargado en ubicación incorrecta, debía reubicarse).

## Alcance

Nueva subtab **Traslado** dentro de `TabInventario`, junto a Tablero/Entrada/Salida/Kardex. Permite mover uno o varios artículos, cada uno con su propia cantidad, de una ubicación origen a una ubicación destino, en una sola operación atómica (todo o nada).

Fuera de alcance: traslados entre distintos centros de acopio (`acopio_center_id`), aprobaciones/flujos de autorización, deshacer traslados.

## Modelo de datos

Sin cambios de schema más allá de una función RPC nueva. Se reutiliza `inventory_movements` con los tipos existentes (`entrada`, `salida`) y el trigger `apply_inventory_movement` ya vigente — no se agrega valor al enum `inventory_movement_type` ni columnas nuevas.

### Nueva función `transfer_inventory_stock`

Migración nueva (`supabase/migrations/<timestamp>_inventory_transfer_rpc.sql`) crea:

```sql
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
AS $$ ... $$;
```

Comportamiento:
- Recorre `p_item_ids`/`p_cantidades` en paralelo (misma posición = mismo artículo).
- Por cada item, valida `item_id`/cantidad > 0 y que el artículo pertenezca a `p_center`.
- Inserta una fila `salida` en `inventory_movements` con `location_id = p_origen` (el trigger existente valida stock suficiente y lanza excepción si no alcanza).
- Inserta una fila `entrada` en `inventory_movements` con `location_id = p_destino`.
- Nota de cada fila: `"Traslado → {ubicación destino}"` (salida) / `"Traslado ← {ubicación origen}"` (entrada), concatenada con `p_nota` si viene.
- Toda la función corre en una única transacción implícita de Postgres: cualquier excepción (item no encontrado, stock insuficiente en cualquier línea) revierte **todas** las inserciones ya hechas en esa llamada — todo o nada, según se acordó.
- No se necesita `FOR UPDATE` manual adicional: el trigger existente ya bloquea la fila de `inventory_item_stock` antes de descontar.

## API

Nuevo endpoint `app/api/inventory/transfers/route.ts`:

`POST /api/inventory/transfers`
- Body: `{ location_origen_id: string, location_destino_id: string, items: { item_id: string; cantidad: number }[], nota?: string }`
- Validaciones antes de llamar al RPC: `location_origen_id !== location_destino_id`, `items.length > 0`, cada `cantidad` es número finito > 0.
- Resuelve `centerId`/`userId` igual que `movements/route.ts` (mismo helper `getCenterAndUser`, se puede extraer o duplicar según convención del archivo).
- Llama `supabase.rpc('transfer_inventory_stock', { p_item_ids, p_cantidades, p_origen, p_destino, p_center: centerId, p_user: userId, p_nota })`.
- Si el error de Postgres menciona "Stock insuficiente" → 409; cualquier otro error → 500.
- Éxito → `201` con `{ data: { count: items.length }, error: null }`.

## Frontend

### `tab-inventario.tsx`

- `SubView` gana el valor `"traslado"`.
- Nueva entrada en `subViewOpts`: `{ v: "traslado", label: "Traslado" }`, ubicada entre "Salida" y "Kardex".
- Nuevo bloque `{subView === "traslado" && <TrasladoForm items={items} sections={sections} locations={locations} loading={...} onCreated={loadItems} />}`.
- `TrasladoForm` no necesita `onCreateSection`/`onCreateSubcategory`/`onCreateLocation` — el traslado opera sobre catálogo ya existente, no crea artículos ni ubicaciones nuevas (evita el caso "producto no existe todavía", que no aplica a un traslado).

### Componente `TrasladoForm`

Estado: `locationOrigenId`, `locationDestinoId`, `sectionId`/`subcategoryId`/`itemId` (para la línea en construcción), `cantidad` (línea en construcción), `lineas: {item_id, presentacion, cantidad, stockOrigen}[]`, `nota`, `submitting`.

Flujo UI:
1. Combobox **Ubicación origen** (mismo componente `Combobox` ya usado en Entrada/Salida, sin `onCreate` — no se crean ubicaciones aquí).
2. Combobox **Ubicación destino** — deshabilitado hasta elegir origen; excluye la opción igual a `locationOrigenId`.
3. Selector de artículo a agregar (categoría → subcategoría → artículo, igual patrón cascada que `MovimientoForm`), pero `filteredItems` sólo incluye artículos cuyo `stock_locations` tenga `stock > 0` en `locationOrigenId`. Si no hay ninguno, mensaje "Sin stock disponible en esta ubicación".
4. Input cantidad (max = stock del artículo en origen), botón **Agregar** → valida cantidad ≤ stock disponible y que el artículo no esté ya en `lineas` (si ya está, suma a la cantidad existente en vez de duplicar fila), limpia selección de artículo/cantidad para la siguiente línea.
5. Tabla de líneas agregadas: artículo, cantidad, botón "Quitar" por fila.
6. Campo nota (opcional, libre).
7. Botón **Confirmar traslado** (deshabilitado si `lineas.length === 0` o falta origen/destino) → `POST /api/inventory/transfers` → toast éxito `"3 productos trasladados de X a L1"` (o error) → limpia `lineas` y llama `onCreated()` para refrescar stock.

Cambiar `locationOrigenId` después de agregar líneas limpia `lineas` (evita líneas huérfanas con stock de otro origen) — se avisa con confirm simple si `lineas.length > 0`.

## Manejo de errores

- Front valida: origen≠destino, cantidad > 0 y ≤ stock visible antes de enviar (misma UX que Salida ya hace con `stockAtLocation`).
- Errores de red/409 del RPC (alguien más movió stock entre que se cargó la pantalla y se envió el traslado) se muestran vía `toast.error` con el mensaje del RPC tal cual, sin aplicar parcialmente nada (atomicidad del RPC garantiza esto en el backend independientemente de la validación optimista del front).

## Testing

- Manual: traslado de 1 artículo, de varios artículos, traslado que excede stock en una línea (debe fallar completo y no mover ninguna línea), origen=destino bloqueado en UI.
- Revisar kardex del artículo trasladado: debe verse la salida en origen y entrada en destino con notas "Traslado → / ←".
