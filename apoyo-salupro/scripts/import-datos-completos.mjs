// Importa datos_completos.csv (convertido a JSON) a missing_persons.
// - Dedup contra existentes: cédula (dígitos) cuando hay; si no, nombre+apellido+ubicación normalizados.
// - Idempotente vía origen_url (ficha_url) + índice único parcial.
// - Fase fotos: descarga foto_url externa y la re-sube al bucket público.
//
// Uso:
//   node scripts/import-datos-completos.mjs <datos.json> [--persons-only|--images-only]
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// ── env ───────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const ORG_ID = 'a0000000-0000-4000-8000-000000000001'
const BUCKET = 'missing-persons-images'
const DATA_PATH = process.argv[2]
const ONLY = process.argv[3] || ''

// ── helpers ─────────────────────────────────────────────────────────────────
const stripDia = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (s) => stripDia(s).toLowerCase().replace(/\s+/g, ' ').trim()
const cedDigits = (s) => String(s ?? '').replace(/\D/g, '')
const STATUS = { buscando: 'Desaparecido', encontrado: 'Encontrado', a_salvo: 'Encontrado' }
const GEN = { femenino: 'F', masculino: 'M', otro: 'Otro' }

function splitName(full) {
  const toks = String(full ?? '').trim().split(/\s+/).filter(Boolean)
  if (toks.length === 0) return null
  if (toks.length === 1) return { nombre: toks[0], apellido: '—' }
  return { nombre: toks[0], apellido: toks.slice(1).join(' ') }
}
function parseAge(v) {
  const m = String(v ?? '').match(/\d+/)
  if (!m) return null
  const n = parseInt(m[0], 10)
  return n > 0 && n < 130 ? n : null
}
function ubic(r) {
  const c = String(r.ciudad ?? '').trim()
  const z = String(r.zona ?? '').trim()
  const parts = []
  if (c) parts.push(c)
  if (z && norm(z) !== norm(c)) parts.push(z)
  return parts.join(', ') || null
}
function infoText(r) {
  const lines = []
  const d = String(r.descripcion ?? '').trim()
  if (d) lines.push(d)
  const u = String(r.ultima_vez ?? '').trim()
  if (u) lines.push('Última vez: ' + u)
  const h = String(r.horario ?? '').trim()
  if (h) lines.push('Horario: ' + h)
  const i = String(r.info ?? '').trim()
  if (i) lines.push(i)
  return lines.join('\n') || null
}
function parseDate(v) {
  const s = String(v ?? '').trim()
  if (!s) return undefined
  const d = new Date(s)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}
const loadData = () => JSON.parse(readFileSync(DATA_PATH, 'utf8').replace(/^﻿/, ''))

async function loadExisting() {
  const seenCed = new Set(), seenName = new Set(), seenOrigen = new Set()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('missing_persons')
      .select('nombre,apellido,cedula,ultimo_lugar_visto,origen_url')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data) {
      const ced = cedDigits(r.cedula)
      if (ced.length >= 5) seenCed.add(ced)
      seenName.add(norm((r.nombre || '') + ' ' + (r.apellido || '')) + '|' + norm(r.ultimo_lugar_visto || ''))
      if (r.origen_url) seenOrigen.add(r.origen_url)
    }
    if (data.length < PAGE) break
  }
  return { seenCed, seenName, seenOrigen }
}

// ── fase 1: personas ────────────────────────────────────────────────────────
async function importPersons() {
  console.log('Cargando claves existentes…')
  const { seenCed, seenName, seenOrigen } = await loadExisting()
  console.log(`existentes: ${seenCed.size} cédulas, ${seenName.size} nombre+ubic, ${seenOrigen.size} origen_url`)

  const all = loadData()
  const personas = all.filter((r) => r.tipo === 'persona')
  const toInsert = []
  const stats = { skipNoName: 0, skipOrigen: 0, skipCed: 0, skipName: 0 }

  for (const r of personas) {
    const sp = splitName(r.nombre)
    if (!sp || !sp.nombre) { stats.skipNoName++; continue }
    const origen = String(r.ficha_url ?? '').trim() || null
    if (origen && seenOrigen.has(origen)) { stats.skipOrigen++; continue }
    const ced = cedDigits(r.cedula)
    const u = ubic(r)
    const nameKey = norm(sp.nombre + ' ' + sp.apellido) + '|' + norm(u || '')
    if (ced.length >= 5 && seenCed.has(ced)) { stats.skipCed++; continue }
    if (ced.length < 5 && seenName.has(nameKey)) { stats.skipName++; continue }

    if (ced.length >= 5) seenCed.add(ced)
    seenName.add(nameKey)
    if (origen) seenOrigen.add(origen)

    toInsert.push({
      organization_id: ORG_ID,
      nombre: sp.nombre,
      apellido: sp.apellido,
      cedula: String(r.cedula ?? '').trim() || null,
      edad_aproximada: parseAge(r.edad),
      genero: GEN[norm(r.genero)] || null,
      ultimo_lugar_visto: u,
      informacion_adicional: infoText(r),
      estado: STATUS[String(r.status ?? '').trim()] || 'Desaparecido',
      contacto_nombre: 'Venezuela',
      contacto_apellido: 'Reporta',
      fallecimiento_confirmado: false,
      created_at: parseDate(r.created_at),
      origen_url: origen,
    })
  }

  console.log(`personas CSV: ${personas.length}`)
  console.log(`a insertar: ${toInsert.length}`)
  console.log(`omitidos -> sin nombre: ${stats.skipNoName}, ya import (origen): ${stats.skipOrigen}, dup cédula: ${stats.skipCed}, dup nombre+ubic: ${stats.skipName}`)

  const BATCH = 500
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const { error } = await supabase
      .from('missing_persons')
      .upsert(batch, { onConflict: 'origen_url', ignoreDuplicates: true })
    if (error) {
      console.error(`ERROR batch ${i}-${i + batch.length}: ${error.message}`)
      process.exitCode = 1
      return
    }
    inserted += batch.length
    if (i % 5000 === 0) console.log(`  …procesadas ${inserted}/${toInsert.length}`)
  }
  console.log(`Fase 1 OK: ${inserted} filas enviadas (upsert idempotente por origen_url).`)
}

// ── fase 2: fotos ────────────────────────────────────────────────────────────
function extFrom(url, ct) {
  const m = String(url).split('?')[0].match(/\.(jpe?g|png|webp|gif|heic)$/i)
  if (m) return m[1].toLowerCase()
  if (ct?.includes('png')) return 'png'
  if (ct?.includes('webp')) return 'webp'
  if (ct?.includes('gif')) return 'gif'
  return 'jpg'
}

async function importImages() {
  const all = loadData()
  const fotoMap = new Map() // origen_url -> foto_url
  for (const r of all) {
    if (r.tipo !== 'persona') continue
    const origen = String(r.ficha_url ?? '').trim()
    const foto = String(r.foto_url ?? '').trim()
    if (origen && foto) fotoMap.set(origen, foto)
  }
  const origenes = [...fotoMap.keys()]
  console.log(`personas con foto: ${origenes.length}`)

  // Resolver id de cada origen_url que está en la DB y aún no tiene imagen.
  // CH pequeño: origen_url son URLs largas y .in() las mete en el querystring;
  // 200 superaba el límite de headers (~16KB) del servidor.
  const targets = [] // {id, foto}
  const CH = 50
  for (let i = 0; i < origenes.length; i += CH) {
    const chunk = origenes.slice(i, i + CH)
    const { data: persons, error } = await supabase
      .from('missing_persons')
      .select('id,origen_url')
      .in('origen_url', chunk)
    if (error) throw error
    if (!persons || persons.length === 0) continue
    const ids = persons.map((p) => p.id)
    const { data: imgs, error: e2 } = await supabase
      .from('missing_person_images')
      .select('missing_person_id')
      .in('missing_person_id', ids)
    if (e2) throw e2
    const withImg = new Set((imgs || []).map((x) => x.missing_person_id))
    for (const p of persons) {
      if (!withImg.has(p.id)) targets.push({ id: p.id, foto: fotoMap.get(p.origen_url) })
    }
  }
  console.log(`imágenes a migrar (en DB y sin foto aún): ${targets.length}`)

  let ok = 0, fail = 0
  const CONC = 8
  for (let i = 0; i < targets.length; i += CONC) {
    const slice = targets.slice(i, i + CONC)
    await Promise.all(
      slice.map(async (t) => {
        try {
          const res = await fetch(t.foto)
          if (!res.ok) throw new Error('HTTP ' + res.status)
          const ct = res.headers.get('content-type') || 'image/jpeg'
          const buf = Buffer.from(await res.arrayBuffer())
          if (buf.length === 0) throw new Error('empty')
          const ext = extFrom(t.foto, ct)
          const path = `${t.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
          const up = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: ct, upsert: false })
          if (up.error) throw new Error('upload: ' + up.error.message)
          const ins = await supabase.from('missing_person_images').insert({ missing_person_id: t.id, storage_path: path })
          if (ins.error) throw new Error('insert: ' + ins.error.message)
          ok++
        } catch (err) {
          fail++
          if (fail <= 30) console.error(`  foto fail ${t.id}: ${err.message}`)
        }
      }),
    )
    if (i % 400 === 0) console.log(`  …fotos ${ok + fail}/${targets.length} (ok ${ok}, fail ${fail})`)
  }
  console.log(`Fase 2 OK: ${ok} imágenes subidas, ${fail} fallidas.`)
}

// ── run ──────────────────────────────────────────────────────────────────────
;(async () => {
  if (ONLY !== '--images-only') await importPersons()
  if (ONLY !== '--persons-only') await importImages()
  console.log('LISTO.')
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
