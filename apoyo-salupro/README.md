This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## API de exportación de datos (para plataformas aliadas)

Endpoint único, autenticado, para consultar nuestros datos sin intercambiar archivos a mano.
Devuelve el conjunto **completo** en streaming, en **CSV** (por defecto) o **JSON**.

### Endpoint

```
GET https://apoyo.salu.pro/api/export?dataset=<dataset>&format=<csv|json>
```

### Autenticación

Toda petición requiere un token entregado por Apoyo SaluPro, en la cabecera:

```
X-API-Key: <TU_TOKEN>
```

(También se acepta `Authorization: Bearer <TU_TOKEN>`.) Sin token válido se responde `401`.

### Datasets disponibles

| `dataset` | Contenido |
|---|---|
| `personas-desaparecidas` | Personas reportadas (misma estructura del feed estándar de intercambio). |
| `pacientes` | Pacientes atendidos en los módulos móviles (**sin** datos clínicos sensibles). |

### Parámetros

| Parámetro | Valores | Default | Descripción |
|---|---|---|---|
| `dataset` | `personas-desaparecidas` \| `pacientes` | — | Requerido. |
| `format` | `csv` \| `json` | `csv` | Formato de salida. |

### Ejemplos

```bash
# CSV de personas desaparecidas
curl -H "X-API-Key: <TU_TOKEN>" \
  "https://apoyo.salu.pro/api/export?dataset=personas-desaparecidas&format=csv" \
  -o personas-desaparecidas.csv

# JSON de pacientes
curl -H "X-API-Key: <TU_TOKEN>" \
  "https://apoyo.salu.pro/api/export?dataset=pacientes&format=json" \
  -o pacientes.json
```

```python
# Python
import requests
r = requests.get(
    "https://apoyo.salu.pro/api/export",
    params={"dataset": "personas-desaparecidas", "format": "json"},
    headers={"X-API-Key": "<TU_TOKEN>"},
    timeout=180,
)
data = r.json()
print(len(data), "registros")
```

### Columnas

**`personas-desaparecidas`** — `fuente, tipo, status, categoria, nombre, cedula, genero, edad,
ciudad, zona, ultima_vez, descripcion, foto_url, origen, contacto, telefono, verificado,
ficha_url, created_at, lat, lng, horario, info`

- `status`: `buscando` | `avistado` | `encontrado` | `fallecido`.
- `foto_url`: URL pública de la foto (si existe). `ficha_url`: ficha pública en apoyo.salu.pro.

**`pacientes`** — `fuente, tipo, registro, nombre, cedula, genero, edad, telefono,
sector_comunidad, edificio_casa, apartamento_casa, ubicacion_refugio, triage, estado_destino,
destino, fecha_entrada, created_at, updated_at`

- No incluye motivo de consulta, alergias, condiciones preexistentes ni tratamiento.

### Notas

- La respuesta es completa y puede ser grande (decenas de miles de filas); usa un timeout amplio.
- El CSV se entrega en UTF-8 con BOM (compatible con Excel) y comillas RFC 4180.
- Los tokens son por aliado y revocables; no los compartas públicamente.

### Configuración (interno)

El endpoint lee los tokens válidos de la variable de entorno `EXPORT_API_TOKENS`
(separados por coma). Si no está configurada, responde `503` a propósito.
