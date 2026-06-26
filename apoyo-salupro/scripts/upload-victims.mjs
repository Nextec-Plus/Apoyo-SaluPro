/**
 * Script: upload-victims.mjs
 * Lee un Excel con la estructura de víctimas de catástrofe y los sube a Supabase.
 *
 * Columnas esperadas en el Excel (en cualquier orden, insensible a mayúsculas/espacios):
 *   FECHA | NOMBRE | APELLIDO | CEDULA | TELEFONO | DIRECCION | EDAD | DIAGNOSTICO | TRIAJE
 *
 * Uso:
 *   node scripts/upload-victims.mjs <ruta-del-excel> <organization_id>
 *
 * Requiere variables de entorno (en .env.local o exportadas):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const [,, excelPath, organizationId] = process.argv

if (!excelPath || !organizationId) {
  console.error('Uso: node scripts/upload-victims.mjs <ruta-del-excel> <organization_id>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Mapeo de columnas ─────────────────────────────────────────────────────────

/** Normaliza un header del Excel para matchear sin importar mayúsculas ni espacios */
function normalizeHeader(h) {
  return String(h).trim().toLowerCase().replace(/\s+/g, '_')
}

const COLUMN_MAP = {
  fecha:       'fecha',
  nombre:      'nombre',
  apellido:    'apellido',
  cedula:      'cedula',
  telefono:    'telefono',
  direccion:   'direccion',
  edad:        'edad',
  diagnostico: 'diagnostico',
  triaje:      'triaje',
}

/** Mapea valores del Excel al enum triage_category de Supabase */
function parseTriage(raw) {
  const val = String(raw ?? '').trim().toLowerCase()
  if (val === 'rojo')     return 'Rojo'
  if (val === 'amarillo') return 'Amarillo'
  if (val === 'verde')    return 'Verde'
  throw new Error(`Valor de TRIAJE inválido: "${raw}". Esperado: Rojo, Amarillo o Verde`)
}

/**
 * Parsea fechas del Excel: acepta strings DD/M/YYYY, DD-M-YYYY,
 * y números seriales de Excel (días desde 1900-01-01).
 */
function parseDate(raw) {
  if (!raw) return null
  if (typeof raw === 'number') {
    // Número serial de Excel → Date
    const date = XLSX.SSF.parse_date_code(raw)
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}T00:00:00+00:00`
  }
  const str = String(raw).trim()
  // Formatos: 26/6/2026 o 26-6-2026
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (match) {
    const [, d, m, y] = match
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00+00:00`
  }
  // ISO o cualquier otro formato que Date pueda parsear
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) return parsed.toISOString()
  throw new Error(`Fecha inválida: "${raw}"`)
}

// ── Leer Excel ────────────────────────────────────────────────────────────────

console.log(`\nLeyendo: ${resolve(excelPath)}`)
const workbook = XLSX.readFile(resolve(excelPath))
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null })

if (rawRows.length === 0) {
  console.error('El Excel está vacío.')
  process.exit(1)
}

// Normalizar headers
const rows = rawRows.map(row => {
  const normalized = {}
  for (const [key, value] of Object.entries(row)) {
    const nk = normalizeHeader(key)
    const mapped = COLUMN_MAP[nk]
    if (mapped) normalized[mapped] = value
  }
  return normalized
})

console.log(`Filas encontradas: ${rows.length}`)

// Validar que las columnas requeridas existen
const requiredCols = ['nombre', 'apellido', 'triaje']
const firstRow = rows[0]
for (const col of requiredCols) {
  if (!(col in firstRow)) {
    console.error(`Columna requerida no encontrada: "${col.toUpperCase()}". Verifica los headers del Excel.`)
    process.exit(1)
  }
}

// ── Obtener el último registration_number para continuar desde ahí ────────────

const { data: maxRow, error: maxError } = await supabase
  .from('catastrophe_victims')
  .select('registration_number')
  .eq('organization_id', organizationId)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

if (maxError) {
  console.error('Error al consultar registration_number:', maxError.message)
  process.exit(1)
}

let currentCount = 0
if (maxRow?.registration_number) {
  const match = maxRow.registration_number.match(/(\d+)$/)
  if (match) currentCount = parseInt(match[1], 10)
}

console.log(`Último registration_number en la organización: ${maxRow?.registration_number ?? 'ninguno'} → siguiente: V-${String(currentCount + 1).padStart(3, '0')}\n`)

// ── Subir fila por fila ───────────────────────────────────────────────────────

let success = 0
let failed = 0

for (let i = 0; i < rows.length; i++) {
  const row = rows[i]
  const rowNum = i + 2 // +2 porque la fila 1 es el header en Excel

  try {
    // Validar campos mínimos
    if (!row.nombre && !row.apellido) {
      throw new Error('NOMBRE y APELLIDO están vacíos')
    }

    // Intentar insertar con reintentos si el registration_number ya existe
    let victim = null
    let registration_number = ''
    let attempts = 0
    const MAX_ATTEMPTS = 20

    while (!victim && attempts < MAX_ATTEMPTS) {
      currentCount++
      attempts++
      registration_number = `V-${String(currentCount).padStart(3, '0')}`

      const { data, error: victimError } = await supabase
        .from('catastrophe_victims')
        .insert({
          organization_id:   organizationId,
          registration_number,
          nombre_completo:   `${String(row.nombre ?? '').trim()} ${String(row.apellido ?? '').trim()}`.trim(),
          cedula:            row.cedula    ? String(row.cedula).trim()    : null,
          edad:              row.edad      ? Number(row.edad)             : null,
          telefono_contacto: row.telefono  ? String(row.telefono).trim()  : null,
          sector_comunidad:  row.direccion ? String(row.direccion).trim() : null,
        })
        .select('id, organization_id')
        .single()

      if (!victimError) {
        victim = data
      } else if (victimError.code === '23505' && victimError.message.includes('registration_number')) {
        // Número duplicado → reintentar con el siguiente
        console.warn(`  ↻ ${registration_number} ya existe, probando siguiente...`)
      } else {
        throw new Error(`catastrophe_victims: ${victimError.message}`)
      }
    }

    if (!victim) throw new Error(`No se encontró registration_number libre tras ${MAX_ATTEMPTS} intentos`)

    // 2. Insertar en catastrophe_victim_info
    const { error: infoError } = await supabase
      .from('catastrophe_victim_info')
      .insert({
        organization_id:           victim.organization_id,
        victim_id:                 victim.id,
        triage_category:           parseTriage(row.triaje),
        motivo_principal_consulta: row.diagnostico ? String(row.diagnostico).trim() : null,
        estado_destino:            'Triaje',
        fecha_hora_entrada:        parseDate(row.fecha) ?? new Date().toISOString(),
      })

    if (infoError) throw new Error(`catastrophe_victim_info: ${infoError.message}`)

    console.log(`✓ Fila ${rowNum} — ${registration_number} — ${String(row.nombre ?? '').trim()} ${String(row.apellido ?? '').trim()}`)
    success++

  } catch (err) {
    console.error(`✗ Fila ${rowNum} — ERROR: ${err.message}`)
    failed++
  }
}

// ── Resumen ───────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────`)
console.log(`Completado: ${success} subidos, ${failed} fallidos`)
if (failed > 0) process.exit(1)
