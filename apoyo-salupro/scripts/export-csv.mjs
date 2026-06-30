// Exporta dos CSV para compartir con otras plataformas:
//  1) Apoyo.salu.pro-personas-desaparecidas.csv  → MISMA estructura de columnas
//     que el feed que recibimos (venezuelareporta.org), poblado con nuestros datos.
//  2) Apoyo.salu.pro-pacientes-atendidos.csv      → todos los pacientes del
//     módulo de catástrofe (víctimas + ficha de triaje).
//
// Uso:  node scripts/export-csv.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const supabase = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const SITE = 'https://apoyo.salu.pro'
const IMG_BASE = `${SUPABASE_URL}/storage/v1/object/public/missing-persons-images`

// ── CSV helpers ───────────────────────────────────────────────────────────
function cell(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const row = (arr) => arr.map(cell).join(',')
function writeCsv(path, header, rows) {
  // BOM para que Excel/otras plataformas reconozcan UTF-8.
  const body = '﻿' + [row(header), ...rows.map(row)].join('\r\n') + '\r\n'
  writeFileSync(path, body, 'utf8')
}

const ESTADO_TO_STATUS = {
  Desaparecido: 'buscando',
  Avistado: 'avistado',
  Encontrado: 'encontrado',
  'Confirmado Fallecido': 'fallecido',
}
const GEN_TO_WORD = { M: 'masculino', F: 'femenino', Otro: 'otro' }

async function paginate(table, select, perPage = 1000) {
  const out = []
  for (let from = 0; ; from += perPage) {
    const { data, error } = await supabase.from(table).select(select)
      .order('created_at', { ascending: false }).range(from, from + perPage - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < perPage) break
  }
  return out
}

// ── 1) Personas desaparecidas (estructura del feed recibido) ───────────────
async function exportMissing() {
  const HEADER = ['fuente', 'tipo', 'status', 'categoria', 'nombre', 'cedula', 'genero',
    'edad', 'ciudad', 'zona', 'ultima_vez', 'descripcion', 'foto_url', 'origen', 'contacto',
    'telefono', 'verificado', 'ficha_url', 'created_at', 'lat', 'lng', 'horario', 'info']

  const data = await paginate('missing_persons',
    'id,nombre,apellido,cedula,edad_aproximada,genero,ultimo_lugar_visto,informacion_adicional,estado,motivo_fallecimiento,fallecimiento_confirmado,contacto_nombre,contacto_apellido,contacto_telefono_nacional,contacto_telefono_internacional,origen_url,created_at,has_image,missing_person_images(storage_path)')

  const rows = data.map((p) => {
    const nombre = [p.nombre, p.apellido].filter(Boolean).join(' ').trim()
    const contacto = [p.contacto_nombre, p.contacto_apellido].filter(Boolean).join(' ').trim()
    const telefono = p.contacto_telefono_nacional || p.contacto_telefono_internacional || ''
    const img = p.missing_person_images?.[0]?.storage_path
    const foto = img ? `${IMG_BASE}/${img}` : ''
    const info = p.fallecimiento_confirmado && p.motivo_fallecimiento
      ? `Fallecimiento: ${p.motivo_fallecimiento}` : ''
    return [
      'apoyo.salu.pro',
      'persona',
      ESTADO_TO_STATUS[p.estado] || p.estado,
      '',                               // categoria
      nombre,
      p.cedula || '',
      GEN_TO_WORD[p.genero] || p.genero || '',
      p.edad_aproximada ?? '',
      p.ultimo_lugar_visto || '',       // ciudad
      '',                               // zona
      '',                               // ultima_vez
      p.informacion_adicional || '',    // descripcion
      foto,
      p.origen_url || '',               // origen (provenencia original si la hubo)
      contacto,
      telefono,
      '',                               // verificado (no lo rastreamos)
      `${SITE}/persona/${p.id}`,        // ficha_url → nuestra ficha pública
      p.created_at || '',
      '', '',                           // lat, lng
      '',                               // horario
      info,
    ]
  })

  writeCsv('Apoyo.salu.pro-personas-desaparecidas.csv', HEADER, rows)
  console.log(`personas desaparecidas: ${rows.length} filas`)
}

// ── 2) Pacientes atendidos (víctimas + ficha de triaje) ────────────────────
async function exportPatients() {
  const HEADER = ['fuente', 'tipo', 'registro', 'nombre', 'cedula', 'genero', 'edad',
    'telefono', 'sector_comunidad', 'edificio_casa', 'apartamento_casa', 'ubicacion_refugio',
    'triage', 'estado_destino', 'destino', 'motivo_consulta', 'alergias',
    'condiciones_preexistentes', 'tratamiento_medicamentos', 'fecha_entrada',
    'created_at', 'updated_at']

  const data = await paginate('catastrophe_victims',
    'id,registration_number,nombre_completo,cedula,genero,edad,telefono_contacto,sector_comunidad,nombre_edificio_casa,numero_apartamento_casa,ubicacion_actual_refugio,notas,created_at,updated_at,catastrophe_victim_info(triage_category,estado_destino,motivo_principal_consulta,alergias,condiciones_preexistentes,tratamiento_medicamentos,fecha_hora_entrada)')

  const rows = data.map((v) => {
    const i = Array.isArray(v.catastrophe_victim_info)
      ? v.catastrophe_victim_info[0] : v.catastrophe_victim_info
    return [
      'apoyo.salu.pro',
      'paciente',
      v.registration_number || '',
      v.nombre_completo || '',
      v.cedula || '',
      GEN_TO_WORD[v.genero] || v.genero || '',
      v.edad ?? '',
      v.telefono_contacto || '',
      v.sector_comunidad || '',
      v.nombre_edificio_casa || '',
      v.numero_apartamento_casa || '',
      v.ubicacion_actual_refugio || '',
      i?.triage_category || '',
      i?.estado_destino || '',
      v.notas || '',                    // destino (ej. "Dado de alta (Ambulatorio)")
      i?.motivo_principal_consulta || '',
      i?.alergias || '',
      i?.condiciones_preexistentes || '',
      i?.tratamiento_medicamentos || '',
      i?.fecha_hora_entrada || '',
      v.created_at || '',
      v.updated_at || '',
    ]
  })

  writeCsv('Apoyo.salu.pro-pacientes-atendidos.csv', HEADER, rows)
  console.log(`pacientes atendidos: ${rows.length} filas`)
}

;(async () => {
  await exportMissing()
  await exportPatients()
  console.log('LISTO.')
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
