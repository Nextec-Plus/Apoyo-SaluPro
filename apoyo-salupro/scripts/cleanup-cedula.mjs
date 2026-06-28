// Deduplica missing_persons con DOS criterios conservadores, unidos por union-find:
//
//  1) CÉDULA: misma cédula (por dígitos, ignora V-/E-/puntos) Y el nombre coincide
//     (mismo 1er token + apellido compartido, o subconjunto). Misma cédula con
//     nombres distintos = personas diferentes (error de captura) → se conservan.
//
//  2) NOMBRE COMPLETO: nombre completo idéntico con >=4 tokens (2 nombres + 2
//     apellidos, ej. "Dilan Emmanuel Gutierrez Colmenares"). Si dentro de un
//     mismo nombre hay >=2 cédulas distintas (homónimos), NO se fusiona.
//
// Sobreviviente del cluster: TIENE FOTO > más campos llenos > estado más
// resuelto > más antiguo. Las fotos de los perdedores se reasignan al
// sobreviviente (FK ON DELETE CASCADE) antes de borrar.
//
// Uso:  node scripts/cleanup-cedula.mjs [--apply]   (sin --apply = dry-run)
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const APPLY = process.argv.includes('--apply')

const stripDia = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
const digits = (s) => String(s ?? '').replace(/\D/g, '')
const tokens = (s) => stripDia(s).toLowerCase().split(/\s+/).filter((t) => t.length >= 2)
const cedDig = (r) => digits(r.cedula)
const hasCed = (r) => cedDig(r).length >= 5
const STATUS_RANK = { 'Confirmado Fallecido': 0, Encontrado: 1, Avistado: 2, Desaparecido: 3 }

/** ¿La distancia de edición entre dos cédulas (dígitos) es <=1? (typo). */
function lev1(a, b) {
  if (a === b) return true
  const la = a.length, lb = b.length
  if (Math.abs(la - lb) > 1) return false
  if (la === lb) {
    let d = 0
    for (let i = 0; i < la; i++) if (a[i] !== b[i]) { d++; if (d > 1) return false }
    return d === 1
  }
  const s = la < lb ? a : b, t = la < lb ? b : a // s = más corta
  let i = 0, j = 0, diff = 0
  while (i < s.length && j < t.length) {
    if (s[i] === t[j]) { i++; j++ } else { diff++; if (diff > 1) return false; j++ }
  }
  return true
}

function namesMatch(a, b) {
  const ta = tokens(a), tb = tokens(b)
  if (ta.length === 0 || tb.length === 0) return false
  const sa = new Set(ta), sb = new Set(tb)
  const inter = ta.filter((t) => sb.has(t))
  const subset = ta.every((t) => sb.has(t)) || tb.every((t) => sa.has(t))
  if (subset && ta[0] === tb[0]) return true
  return ta[0] === tb[0] && inter.length >= 2
}

async function fetchAll() {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('missing_persons')
      .select('id,nombre,apellido,cedula,estado,created_at,edad_aproximada,genero,ultimo_lugar_visto,informacion_adicional')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

async function imageCounts(ids) {
  const counts = new Map()
  const CH = 100
  for (let i = 0; i < ids.length; i += CH) {
    const { data, error } = await supabase
      .from('missing_person_images').select('missing_person_id').in('missing_person_id', ids.slice(i, i + CH))
    if (error) throw error
    for (const r of data || []) counts.set(r.missing_person_id, (counts.get(r.missing_person_id) || 0) + 1)
  }
  return counts
}

;(async () => {
  const rows = await fetchAll()
  console.log(`total filas: ${rows.length}`)
  const idx = new Map(rows.map((r, i) => [r.id, i]))

  // union-find
  const parent = rows.map((_, i) => i)
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb }

  // Índices auxiliares
  const byCed = new Map(), byName = new Map()
  rows.forEach((r, i) => {
    if (hasCed(r)) {
      const d = cedDig(r); if (!byCed.has(d)) byCed.set(d, []); byCed.get(d).push(i)
    }
    const fn = tokens(r.nombre + ' ' + r.apellido)
    if (fn.length >= 4) { const k = fn.join(' '); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(i) }
  })

  // Regla 1: cédula + nombre coincide
  const divergentCed = []
  for (const [d, list] of byCed) {
    if (list.length < 2) continue
    for (let a = 0; a < list.length; a++)
      for (let b = a + 1; b < list.length; b++)
        if (namesMatch(rows[list[a]].nombre + ' ' + rows[list[a]].apellido, rows[list[b]].nombre + ' ' + rows[list[b]].apellido))
          union(list[a], list[b])
    const roots = new Set(list.map((i) => find(i)))
    if (roots.size > 1) divergentCed.push({ ced: d, nombres: [...new Set(list.map((i) => `${rows[i].nombre} ${rows[i].apellido}`))] })
  }

  // Regla 2: nombre completo idéntico (>=4 tokens). Las cédulas que difieren
  // por un typo (<=1 dígito) se tratan como la misma persona; cédulas muy
  // distintas = homónimos/familiares y se conservan separados.
  const divergentName = []
  for (const [k, list] of byName) {
    if (list.length < 2) continue
    const withCed = list.filter((i) => hasCed(rows[i]))
    // Agrupar las cédulas presentes por similitud (<=1 edición = mismo dueño).
    const cedClusters = []
    for (const i of withCed) {
      const hit = cedClusters.find((cl) => lev1(cedDig(rows[i]), cedDig(rows[cl[0]])))
      if (hit) hit.push(i); else cedClusters.push([i])
    }
    for (const cl of cedClusters) for (let a = 1; a < cl.length; a++) union(cl[0], cl[a])
    if (cedClusters.length <= 1) {
      // 0 ó 1 dueño de cédula: fusiona todo (incluye filas sin cédula).
      for (let a = 1; a < list.length; a++) union(list[0], list[a])
    } else {
      // Varias cédulas realmente distintas: homónimos → se conservan separados.
      divergentName.push({ nombre: k, cedulas: cedClusters.map((cl) => cedDig(rows[cl[0]])) })
    }
  }

  // Clusters
  const groups = new Map()
  rows.forEach((_, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i) })
  const dupClusters = [...groups.values()].filter((g) => g.length > 1)

  const involved = dupClusters.flat().map((i) => rows[i].id)
  const imgs = await imageCounts(involved)
  const filled = (r) => (r.edad_aproximada != null) + (r.genero != null) + (r.ultimo_lugar_visto != null) + (r.informacion_adicional != null)

  const toDelete = [], reassign = []
  for (const g of dupClusters) {
    const sorted = g.map((i) => rows[i]).sort((a, b) => {
      const ia = (imgs.get(a.id) || 0) > 0, ib = (imgs.get(b.id) || 0) > 0
      if (ia !== ib) return ia ? -1 : 1
      if (filled(b) !== filled(a)) return filled(b) - filled(a)
      const sa = STATUS_RANK[a.estado] ?? 9, sb = STATUS_RANK[b.estado] ?? 9
      if (sa !== sb) return sa - sb
      return new Date(a.created_at) - new Date(b.created_at)
    })
    const survivor = sorted[0]
    for (const loser of sorted.slice(1)) {
      toDelete.push(loser.id)
      if ((imgs.get(loser.id) || 0) > 0) reassign.push({ from: loser.id, to: survivor.id })
    }
  }

  console.log(`clusters de duplicados: ${dupClusters.length}`)
  console.log(`filas a ELIMINAR: ${toDelete.length}`)
  console.log(`fotos a reasignar al sobreviviente: ${reassign.length}`)
  console.log(`\n[CONSERVADOS] misma cédula, nombres distintos: ${divergentCed.length}`)
  for (const d of divergentCed.slice(0, 40)) console.log(`  ${d.ced}: ${d.nombres.join('  |  ')}`)
  console.log(`\n[CONSERVADOS] mismo nombre completo, cédulas distintas: ${divergentName.length}`)
  for (const d of divergentName.slice(0, 40)) console.log(`  "${d.nombre}": ${d.cedulas.join(', ')}`)

  if (!APPLY) { console.log('\n[DRY-RUN] nada se modificó. Re-ejecuta con --apply.'); return }

  for (const { from, to } of reassign) {
    const { error } = await supabase.from('missing_person_images').update({ missing_person_id: to }).eq('missing_person_id', from)
    if (error) { console.error(`reassign ${from}->${to}: ${error.message}`); process.exit(1) }
  }
  console.log(`fotos reasignadas: ${reassign.length}`)

  let del = 0
  for (let i = 0; i < toDelete.length; i += 100) {
    const { error } = await supabase.from('missing_persons').delete().in('id', toDelete.slice(i, i + 100))
    if (error) { console.error(`delete: ${error.message}`); process.exit(1) }
    del += Math.min(100, toDelete.length - i)
  }
  console.log(`ELIMINADAS: ${del}. LISTO.`)
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
