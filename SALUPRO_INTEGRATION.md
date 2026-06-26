# Integración Apoyo-SaluPro ↔ SaluPro API

## Contexto

El sistema **Apoyo-SaluPro** registra víctimas de catástrofe con sus datos médicos (cédula, motivo de consulta, diagnóstico, destino). El objetivo es poder enviar esos casos directamente a **SaluPro** para que el equipo clínico de CGM los gestione como pre-casos de telemedicina (estado `PENDIENTE`), sin necesidad de ingresarlos manualmente.

---

## Por qué CGM como TPA es la clave

CGM opera en SaluPro como **TPA (Gestor de Citas / manager)**, no como aseguradora ni como contratante.

| Atributo | Valor |
|---|---|
| Tipo de cliente (`clientType`) | `manager` |
| CGM Manager ID | `b0ca9085-9321-4994-8e67-f546170c0a73` |
| API Key | Configurada en `SALUPRO_API_KEY` |

Esto es importante porque en la lógica de permisos de la API de integración, los clientes de tipo **manager/TPA no tienen restricción de scope**:

- Pueden crear titulares para **cualquier convenio** de la organización
- Pueden vincular beneficiarios a **cualquier titular** de la organización
- No están limitados a "sus propios" pacientes como sí lo están las aseguradoras o contratantes

Esto da flexibilidad total para registrar víctimas de catástrofe que no pertenecen a ningún seguro previo.

---

## El problema central

El endpoint de consultas externas (`POST /v1/data/receive`) busca al paciente por cédula en la tabla `patients`:

```typescript
const patient = await this.prisma.patients.findFirst({
  where: { ci: cleanCi, isActive: true, organization_id: ctx.organizationId },
});
if (!patient) throw new NotFoundException(...)
```

Si la víctima **no existe previamente** en SaluPro como paciente → responde **404** y no crea el pre-caso.

Las víctimas de catástrofe, en su mayoría, **no son beneficiarios previos de ningún seguro**, por lo que habrá un alto porcentaje de casos con 404.

---

## Solución: Flujo en dos pasos

### Paso 1 — Intentar enviar la consulta directamente

```
POST https://api.salu.pro/v1/data/receive
x-api-key: <SALUPRO_API_KEY>
Content-Type: multipart/form-data

cedula:       <cédula de la víctima>
diagnostico:  <motivo_principal_consulta>
correo_1:     apoyo@salupro.dummy
telefono_1:   04120000000
tipo_consulta: CONSULTA
referido_a:   <hospital o destino, si existe>
```

→ Si responde **201**: listo, pre-caso creado en estado `PENDIENTE`.

→ Si responde **404**: la víctima no existe como paciente. Ir al Paso 2.

---

### Paso 2 — Registrar a la víctima como titular en SaluPro

```
POST https://api.salu.pro/v1/titulares-de-seguros
x-api-key: <SALUPRO_API_KEY>
Content-Type: application/json

{
  "ci":             "<cédula, solo dígitos>",
  "name":           "<nombre completo>",
  "phone":          "<teléfono o dummy 04120000000>",
  "state":          "<SALUPRO_DEFAULT_STATE_ID>",
  "clientId":       "<SALUPRO_CGM_CLIENT_ID>",
  "createAsPatient": true
}
```

**Por qué `POST /v1/titulares-de-seguros` y no `POST /v1/beneficiarios`:**

- `POST /v1/beneficiarios` requiere un `holders[]` con el UUID de un titular ya existente (necesitaría saber de antemano qué titular usar).
- `POST /v1/titulares-de-seguros` con `createAsPatient: true` (valor por defecto) hace **todo en una sola transacción**:
  1. Crea el registro en `insurance_holders`
  2. Crea el registro en `patients` con la misma cédula
  3. Crea la relación en `holder_patient_relationships` con `relationshipType: 'Titular'`
- Al finalizar, la víctima es tanto titular como paciente activo en SaluPro.

→ Si responde **201**: ir al Paso 3.

→ Si responde **409** (ya existe un titular con esa cédula): la víctima ya es titular pero quizás el patient está inactivo. Este caso es poco común; el sistema debe reportar el error con el mensaje de SaluPro para intervención manual.

---

### Paso 3 — Reintentar la consulta externa

Repetir el Paso 1 con los mismos datos. Esta vez el paciente ya existe y la respuesta debe ser **201**.

---

## Diagrama de flujo

```
Botón "Enviar a SaluPro"
          │
          ▼
POST /v1/data/receive
          │
    ┌─────┴─────┐
   201         404
    │           │
    ▼           ▼
  ✅ Listo   POST /v1/titulares-de-seguros
             (createAsPatient: true)
                   │
             ┌─────┴─────┐
            201          409
             │            │
             ▼            ▼
        POST /v1/    ❌ Error reportado
        data/receive    (requiere intervención)
             │
           201
             │
             ▼
           ✅ Listo
```

---

## Variables de entorno requeridas

| Variable | Descripción | Valor |
|---|---|---|
| `SALUPRO_API_KEY` | API Key de CGM para la API de integración | `ssk_283000...` (en `.env.local`) |
| `SALUPRO_CGM_CLIENT_ID` | UUID del convenio "Víctimas de Catástrofe CGM" en SaluPro | `393bfcfa-65e8-4e22-8585-befb3a481bd1` (en `.env.local`) |

El estado venezolano **no necesita env var** — se deriva del campo `sector_comunidad` de la víctima. Todos los sectores registrados en la app (Maiquetía, Caraballeda, Macuto, La Guaira, Naiguatá, Caruao, Tanaguarena) pertenecen al estado **Vargas, ID = 22** según `GET /v1/estados`.

---

## Campos que se mapean de Apoyo-SaluPro a SaluPro

### Para `POST /v1/titulares-de-seguros`

| Campo SaluPro | Fuente en Apoyo-SaluPro | Fallback |
|---|---|---|
| `ci` | `catastrophe_victims.cedula` (solo dígitos) | — (requerido) |
| `name` | `catastrophe_victims.nombre_completo` | — (requerido) |
| `phone` | `catastrophe_victims.telefono_contacto` | `04120000000` |
| `state` | Derivado de `catastrophe_victims.sector_comunidad` → mapa a ID Vargas (22) | `22` (Vargas, todos los sectores registrados) |
| `clientId` | — | `SALUPRO_CGM_CLIENT_ID` |
| `createAsPatient` | — | `true` (siempre) |

### Para `POST /v1/data/receive`

| Campo SaluPro | Fuente en Apoyo-SaluPro | Fallback |
|---|---|---|
| `cedula` | `catastrophe_victims.cedula` | — (requerido) |
| `diagnostico` | `catastrophe_victim_info.motivo_principal_consulta` | `"Sin diagnóstico"` |
| `correo_1` | — | `apoyo@salupro.dummy` |
| `telefono_1` | — | `04120000000` |
| `tipo_consulta` | — | `CONSULTA` (siempre) |
| `referido_a` | `parseDestino(victim.notas).hospital` o `.destino` | omitido si vacío |

---

## Precondiciones en SaluPro antes de usar la integración

1. **Convenio de catástrofe** — UUID `393bfcfa-65e8-4e22-8585-befb3a481bd1` ya confirmado y configurado en `SALUPRO_CGM_CLIENT_ID`.

2. **Estado Vargas** — ID `22` confirmado via `GET /v1/estados`. Se deriva automáticamente del `sector_comunidad` de la víctima; no requiere configuración adicional.

3. **El API Key** (`SALUPRO_API_KEY`) ya está configurado y validado.

---

## Consideraciones y limitaciones

- **Idempotencia del titular**: `POST /v1/titulares-de-seguros` **no es idempotente** — si se llama dos veces con la misma cédula responde 409. Solo se llama cuando el Paso 1 devuelve 404.
- **Idempotencia del paciente dentro del titular**: Si ya existe un `patients` con esa cédula, el código de la API lo reutiliza y solo crea la relación faltante.
- **Cédulas sin prefijo**: El API de SaluPro acepta cédulas con prefijo embebido (`"V12345678"`) o solo dígitos. Se envían los dígitos de la cédula tal como están en `catastrophe_victims.cedula` después de limpiar no-dígitos.
- **Teléfono dummy**: `telefono_1` y `correo_1` son requeridos por el API pero no hay datos reales disponibles para la consulta externa; se usan valores dummy. Si la víctima tiene `telefono_contacto`, se usa como `phone` en el registro de titular.
- **pre_telemedicina**: Los casos creados quedan en estado `PENDIENTE` en la tabla `pre_telemedicina` de SaluPro. El equipo CGM los procesa desde su panel y los convierte en casos formales.
- **CGM como TPA**: Al ser TPA (manager), el API Key de CGM puede crear titulares para cualquier convenio de la organización, sin restricción de scope. Esto es lo que permite registrar víctimas de catástrofe bajo un convenio específico aunque no tengan seguro previo.

---

## Endpoint de la integración en Apoyo-SaluPro

```
POST /api/catastrophe/victims/[id]/send-to-salupro
```

Implementado en: `apoyo-salupro/app/api/catastrophe/victims/[id]/send-to-salupro/route.ts`

Este route actúa como **proxy server-side** — nunca expone el API Key al cliente. El botón en el modal del paciente llama a este endpoint interno, que a su vez gestiona todo el flujo con SaluPro.
