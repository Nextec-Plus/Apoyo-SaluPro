# Módulo de Inventario — Centro de Acopio

Documento de implementación. CRUD de inventario para un centro de acopio, con
kardex de entradas/salidas, operado por un usuario asignado a un único centro.

## 1. Objetivo y alcance

- Un **usuario de inventario** inicia sesión y entra **directo al módulo de
  inventario** de **su** centro de acopio (no ve pacientes/desaparecidos).
- Cada usuario está asignado a **un (1) centro de acopio**.
- No se cargan productos comerciales: cada **subcategoría** de la categorización
  estándar es un **artículo**. Se registra **cantidad + presentación**
  (ej. "12 cajas de Antibióticos Pediátricos") para saber el stock al día.
- Registrar **entradas** y **salidas** con un formulario simple. El sistema indica
  **a qué ubicación** llevar / **de qué ubicación** sacar (ubicación fija por
  artículo).
- **Salida**: a quién se envía + medio de transporte.
- **Entrada**: quién entrega (el medio de transporte no importa).
- **Kardex** básico: histórico de entradas/salidas con saldo corrido por artículo.

## 2. Decisiones (confirmadas)

| Tema | Decisión |
|---|---|
| Centros | **Uno** por ahora (placeholder a renombrar). Esquema soporta varios. |
| Artículo | = **subcategoría** del catálogo estándar (global, sembrado). |
| Presentación | **Varias por artículo** → una línea de stock por `(centro, subcategoría, presentación)`. |
| Ubicación | **Fija por artículo**: cada línea de stock tiene su `location_id`; el form la muestra. |
| Acceso | **Solo inventario** de su centro (gating por ruta + RLS por asignación). |
| Destinatario / entrega / transporte | **Texto libre** (MVP; se puede volver catálogo luego). |

## 3. Modelo de datos

Migración: `supabase/migrations/20260630000001_inventory_schema.sql`.

- **`acopio_centers`** — centros de acopio (`name`, `ubicacion`, `is_active`).
- **`acopio_user_assignments`** — `user_id` (auth.users) → `acopio_center_id` + `role`
  (`inventory` | `admin`). `UNIQUE(user_id)`: un centro por usuario. Es lo que
  habilita el acceso al módulo.
- **`inventory_sections`** — 12 secciones (catálogo global). `code` `1`..`12`.
- **`inventory_subcategories`** — 42 subcategorías = artículos plantilla (global).
  `code` `1a`..`12d`, `name`, `description`.
- **`inventory_locations`** — ubicaciones/zonas dentro de un centro (`name`).
- **`inventory_items`** — el artículo concreto en el centro:
  `(acopio_center_id, subcategory_id, presentacion)` único, con `location_id`
  (ubicación fija) y `stock`. Varias presentaciones = varias filas.
- **`inventory_movements`** — **kardex**: `tipo` (`entrada`|`salida`), `cantidad`,
  `location_id`, `entregado_por` (entrada), `destinatario` + `medio_transporte`
  (salida), `nota`, `previous_stock`, `new_stock`, `created_by`, `created_at`.

### Stock atómico (trigger)
`BEFORE INSERT` en `inventory_movements` ejecuta `apply_inventory_movement()`:
bloquea la fila del item, calcula `previous_stock`/`new_stock` (suma en entrada,
resta en salida, **rechaza** si no hay stock suficiente) y actualiza
`inventory_items.stock`. Así el kardex y el stock nunca se desincronizan.

### Kardex
Listado de `inventory_movements` de un item ordenado por fecha, mostrando
`previous_stock → new_stock`. El saldo corrido ya viene calculado.

## 4. Acceso y seguridad

- **Gating de ruta**: el middleware (o el layout de `/inventario`) verifica que el
  usuario tenga fila en `acopio_user_assignments`; si no, redirige.
- **Login → destino**: si el usuario tiene asignación de inventario, redirigir a
  `/inventario` en vez de `/dashboard`.
- **RLS** (defensa en profundidad):
  - Catálogos (`inventory_sections`, `inventory_subcategories`): `SELECT` para
    cualquier `authenticated`.
  - `acopio_centers`, `inventory_locations`, `inventory_items`,
    `inventory_movements`: `USING`/`WITH CHECK` acotado a los centros del usuario
    vía `acopio_user_assignments` (`auth.uid()`).
  - `acopio_user_assignments`: el usuario ve su propia asignación.
- El módulo corre con la **sesión del usuario** (anon key + cookies), por lo que
  RLS aplica de verdad (a diferencia de rutas que usan `service_role`).

## 5. Interfaz (siguiente fase)

Rutas bajo `/inventario` (protegidas por asignación):

- **`/inventario`** — tablero: stock por sección/artículo (cantidad por
  presentación + ubicación), buscador, alertas de bajo stock.
- **Movimiento de entrada** — form: artículo (sección→subcategoría→presentación),
  cantidad, **quién entrega**, nota. La ubicación se muestra (fija del artículo).
- **Movimiento de salida** — form: artículo, cantidad, **destinatario**, **medio
  de transporte**, nota. Valida stock disponible.
- **Kardex** — por artículo: tabla de movimientos con saldo corrido; export CSV/PDF.
- **Administración** (rol admin / opcional): ubicaciones del centro, asignar
  ubicación fija a cada artículo, alta de items (presentaciones).

API: rutas server-side bajo `/api/inventario/*` usando el cliente con sesión
(RLS). Patrón igual al resto del proyecto.

## 6. Pendiente para finalizar el wiring (datos)

1. **Nombre y ubicación** del centro de acopio real (para renombrar el placeholder).
2. **Email del usuario de inventario** (auth.users) para crear su
   `acopio_user_assignments` → su centro.

## 7. Estado

- [x] Esquema de tablas + catálogo sembrado (12 secciones, 42 subcategorías).
- [x] RLS + trigger de kardex.
- [ ] Wiring del centro real + usuario.
- [ ] UI del módulo (`/inventario`) + APIs.
- [ ] Login routing al módulo.
