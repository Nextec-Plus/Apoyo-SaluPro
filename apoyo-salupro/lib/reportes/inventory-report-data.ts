import { createServiceClient } from '@/lib/supabase/server'
import type { ReportData } from '@/app/inventario/reportes-types'

/* ────────────────────────────────────────────────────────────────────────────
 * Agregación server-side compartida por GET /api/inventory/reports (JSON) y
 * GET /api/inventory/reports/pdf (PDF). Acotado al centro del usuario.
 * ──────────────────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any

/** Trae todas las filas de una query paginando de 1000 en 1000 (sin tope). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T = any>(build: (from: number, to: number) => any): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  for (let i = 0; ; i++) {
    const { data, error } = await build(i * PAGE, i * PAGE + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

interface SectionRef { id: string; name: string }
interface ItemAgg {
  id: string
  presentacion: string
  stock: number
  subcategory: { id: string; name: string; section: SectionRef | null } | null
}
interface MovementAgg {
  id: string
  tipo: 'entrada' | 'salida'
  cantidad: number
  destinatario: string | null
  medio_transporte: string | null
  entregado_por: string | null
  nota: string | null
  created_by: string | null
  created_at: string
  item: { id: string; presentacion: string; subcategory: { id: string; name: string; section: SectionRef | null } | null } | null
}
interface RequestAgg {
  id: string
  nombre: string
  estado: string
  tipo_solicitante: string
  telefono: string | null
  correo: string | null
  cedula_rif: string | null
  direccion: string | null
  notas: string | null
  latitud: number | null
  longitud: number | null
  secciones_solicitadas: unknown
  created_at: string
}

function bump<K extends string>(map: Map<K, number>, key: K, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by)
}
function toSorted(map: Map<string, number>) {
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

export async function getCenterId(supabase: Supa) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('acopio_user_assignments')
    .select('acopio_center_id')
    .eq('user_id', user.id)
    .single()
  return data?.acopio_center_id ?? null
}

export async function buildInventoryReportData(
  supabase: Supa,
  centerId: string,
  from: string,
  to: string,
  umbral: number,
): Promise<Omit<ReportData, 'error'>> {
  /* ── Datos crudos ──────────────────────────────────────────────────── */
  const items = await fetchAll<ItemAgg>((lo, hi) =>
    supabase
      .from('inventory_items')
      .select('id, presentacion, stock, subcategory:inventory_subcategories(id, name, section:inventory_sections(id, name))')
      .eq('acopio_center_id', centerId)
      .range(lo, hi),
  )

  const movements = await fetchAll<MovementAgg>((lo, hi) =>
    supabase
      .from('inventory_movements')
      .select('id, tipo, cantidad, destinatario, medio_transporte, entregado_por, nota, created_by, created_at, item:inventory_items(id, presentacion, subcategory:inventory_subcategories(id, name, section:inventory_sections(id, name)))')
      .eq('acopio_center_id', centerId)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })
      .range(lo, hi),
  )

  const requests = await fetchAll<RequestAgg>((lo, hi) =>
    supabase
      .from('supply_requests')
      .select('id, nombre, estado, tipo_solicitante, telefono, correo, cedula_rif, direccion, notas, latitud, longitud, secciones_solicitadas, created_at')
      .gte('created_at', from)
      .lte('created_at', to)
      .range(lo, hi),
  )

  /* ── KPIs ──────────────────────────────────────────────────────────── */
  const entradas = movements.filter((m) => m.tipo === 'entrada')
  const salidas = movements.filter((m) => m.tipo === 'salida')
  const sum = (arr: MovementAgg[]) => arr.reduce((a, m) => a + (m.cantidad || 0), 0)
  const entradasUnidades = sum(entradas)
  const salidasUnidades = sum(salidas)

  const kpis = {
    activeItems: items.length,
    itemsConStock: items.filter((i) => i.stock > 0).length,
    totalStock: items.reduce((a, i) => a + (i.stock || 0), 0),
    entradasCount: entradas.length,
    entradasUnidades,
    salidasCount: salidas.length,
    salidasUnidades,
    balanceNeto: entradasUnidades - salidasUnidades,
    solicitudesPendientes: requests.filter((r) => r.estado === 'Pendiente').length,
    solicitudesTotal: requests.length,
  }

  /* ── Ayuda distribuida (solo salidas) ──────────────────────────────── */
  const porDestinatario = new Map<string, number>()
  const porCategoriaSalida = new Map<string, number>()
  const porMedio = new Map<string, number>()
  for (const m of salidas) {
    bump(porDestinatario, m.destinatario?.trim() || 'Sin especificar', m.cantidad)
    bump(porCategoriaSalida, m.item?.subcategory?.section?.name || 'Sin categoría', m.cantidad)
    bump(porMedio, m.medio_transporte?.trim() || 'Sin especificar', m.cantidad)
  }

  /* ── Solicitudes vs inventario ─────────────────────────────────────── */
  const stockPorSeccion = new Map<string, number>()
  for (const it of items) {
    bump(stockPorSeccion, it.subcategory?.section?.name || 'Sin categoría', it.stock || 0)
  }
  const demandaPorSeccion = new Map<string, number>()
  for (const r of requests) {
    const secs = Array.isArray(r.secciones_solicitadas) ? r.secciones_solicitadas : []
    const names = new Set<string>()
    for (const s of secs as { name?: string }[]) {
      if (s?.name) names.add(s.name)
    }
    for (const n of names) bump(demandaPorSeccion, n)
  }
  const seccionLabels = new Set<string>([...stockPorSeccion.keys(), ...demandaPorSeccion.keys()])
  const solicitudesVsInventario = [...seccionLabels]
    .map((name) => ({
      label: name,
      solicitudes: demandaPorSeccion.get(name) ?? 0,
      stock: stockPorSeccion.get(name) ?? 0,
    }))
    .sort((a, b) => b.solicitudes - a.solicitudes)

  const porEstado = new Map<string, number>()
  const porTipo = new Map<string, number>()
  for (const r of requests) {
    bump(porEstado, r.estado)
    bump(porTipo, r.tipo_solicitante)
  }

  const geo = requests
    .filter((r) => r.latitud !== null && r.longitud !== null)
    .map((r) => ({
      id: r.id,
      lat: r.latitud!,
      lng: r.longitud!,
      nombre: r.nombre,
      estado: r.estado,
      tipoSolicitante: r.tipo_solicitante,
      telefono: r.telefono,
      correo: r.correo,
      cedulaRif: r.cedula_rif,
      direccion: r.direccion,
      notas: r.notas,
      seccionesSolicitadas: r.secciones_solicitadas,
      createdAt: r.created_at,
    }))

  /* ── Alertas: faltantes ────────────────────────────────────────────── */
  const enCero = items
    .filter((i) => i.stock === 0)
    .map((i) => ({
      id: i.id,
      presentacion: i.presentacion,
      section: i.subcategory?.section?.name ?? '—',
      subcategory: i.subcategory?.name ?? '—',
    }))
  const bajoUmbral = items
    .filter((i) => i.stock > 0 && i.stock < umbral)
    .sort((a, b) => a.stock - b.stock)
    .map((i) => ({
      id: i.id,
      presentacion: i.presentacion,
      stock: i.stock,
      section: i.subcategory?.section?.name ?? '—',
      subcategory: i.subcategory?.name ?? '—',
    }))
  const categoriasDesabastecidas = toSorted(stockPorSeccion)
    .sort((a, b) => a.value - b.value) // menor stock primero

  /* ── Auditoría: productividad por operador ─────────────────────────── */
  const operadorEmail = new Map<string, string>()
  try {
    const admin = await createServiceClient()
    const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of usersData?.users ?? []) {
      if (u.email) operadorEmail.set(u.id, u.email)
    }
  } catch {
    // sin permisos admin → se mostrará identificador corto
  }

  const prodMap = new Map<string, { entradas: number; salidas: number }>()
  for (const m of movements) {
    const key = m.created_by ?? 'desconocido'
    const cur = prodMap.get(key) ?? { entradas: 0, salidas: 0 }
    if (m.tipo === 'entrada') cur.entradas++
    else cur.salidas++
    prodMap.set(key, cur)
  }
  const productividad = [...prodMap.entries()]
    .map(([id, v]) => ({
      operadorId: id,
      operador: operadorEmail.get(id) ?? (id === 'desconocido' ? 'Desconocido' : `Operador ${id.slice(0, 8)}`),
      entradas: v.entradas,
      salidas: v.salidas,
      total: v.entradas + v.salidas,
    }))
    .sort((a, b) => b.total - a.total)

  /* ── Movimientos para tabla de auditoría (acota a 500 recientes) ───── */
  const movimientos = movements.slice(0, 500).map((m) => ({
    id: m.id,
    tipo: m.tipo,
    cantidad: m.cantidad,
    presentacion: m.item?.presentacion ?? '—',
    section: m.item?.subcategory?.section?.name ?? '—',
    subcategory: m.item?.subcategory?.name ?? '—',
    detalle:
      m.tipo === 'entrada'
        ? (m.entregado_por || m.nota || '—')
        : [m.destinatario, m.medio_transporte, m.nota].filter(Boolean).join(' · ') || '—',
    operador: operadorEmail.get(m.created_by ?? '') ?? (m.created_by ? `Operador ${m.created_by.slice(0, 8)}` : '—'),
    created_at: m.created_at,
  }))

  return {
    period: { from, to, umbral },
    kpis,
    distribucion: {
      porDestinatario: toSorted(porDestinatario),
      porCategoria: toSorted(porCategoriaSalida),
      porMedio: toSorted(porMedio),
    },
    solicitudes: {
      vsInventario: solicitudesVsInventario,
      porEstado: toSorted(porEstado),
      porTipo: toSorted(porTipo),
      geo,
    },
    alertas: {
      enCero,
      bajoUmbral,
      categoriasDesabastecidas,
    },
    auditoria: {
      productividad,
      movimientos,
    },
  }
}
