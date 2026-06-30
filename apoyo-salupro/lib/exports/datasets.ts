/* ───────────────────────────────────────────────────────────────────────────
 * Definición de los datasets exportables para socios externos.
 *
 * Un único contrato de columnas por dataset, consumido por el endpoint
 * /api/export. Mantiene la MISMA forma que los CSV que ya compartimos:
 *  - personas-desaparecidas: estructura del feed que intercambiamos.
 *  - pacientes: SIN campos clínicos sensibles (alergias/condiciones/
 *    tratamiento/motivo) — solo identidad, ubicación, triaje y estado.
 * ─────────────────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cliente PostgREST genérico
type SupabaseLike = any

const SITE = 'https://apoyo.salu.pro'
const IMG_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/missing-persons-images`

const ESTADO_TO_STATUS: Record<string, string> = {
  Desaparecido: 'buscando',
  Avistado: 'avistado',
  Encontrado: 'encontrado',
  'Confirmado Fallecido': 'fallecido',
}
const GEN_TO_WORD: Record<string, string> = { M: 'masculino', F: 'femenino', Otro: 'otro' }

export type ExportRow = Record<string, string | number | null>

export type DatasetDef = {
  table: string
  select: string
  filename: string
  columns: string[]
  map: (rec: Record<string, unknown>) => ExportRow
}

export const DATASETS: Record<string, DatasetDef> = {
  'personas-desaparecidas': {
    table: 'missing_persons',
    filename: 'Apoyo.salu.pro-personas-desaparecidas',
    select:
      'id,nombre,apellido,cedula,edad_aproximada,genero,ultimo_lugar_visto,informacion_adicional,estado,motivo_fallecimiento,fallecimiento_confirmado,contacto_nombre,contacto_apellido,contacto_telefono_nacional,contacto_telefono_internacional,origen_url,created_at,missing_person_images(storage_path)',
    columns: ['fuente', 'tipo', 'status', 'categoria', 'nombre', 'cedula', 'genero', 'edad',
      'ciudad', 'zona', 'ultima_vez', 'descripcion', 'foto_url', 'origen', 'contacto', 'telefono',
      'verificado', 'ficha_url', 'created_at', 'lat', 'lng', 'horario', 'info'],
    map: (p) => {
      const imgs = p.missing_person_images as Array<{ storage_path: string }> | undefined
      const img = imgs?.[0]?.storage_path
      return {
        fuente: 'apoyo.salu.pro',
        tipo: 'persona',
        status: ESTADO_TO_STATUS[p.estado as string] ?? (p.estado as string) ?? '',
        categoria: '',
        nombre: [p.nombre, p.apellido].filter(Boolean).join(' ').trim(),
        cedula: (p.cedula as string) ?? '',
        genero: GEN_TO_WORD[p.genero as string] ?? (p.genero as string) ?? '',
        edad: (p.edad_aproximada as number) ?? '',
        ciudad: (p.ultimo_lugar_visto as string) ?? '',
        zona: '',
        ultima_vez: '',
        descripcion: (p.informacion_adicional as string) ?? '',
        foto_url: img ? `${IMG_BASE}/${img}` : '',
        origen: (p.origen_url as string) ?? '',
        contacto: [p.contacto_nombre, p.contacto_apellido].filter(Boolean).join(' ').trim(),
        telefono: (p.contacto_telefono_nacional as string) || (p.contacto_telefono_internacional as string) || '',
        verificado: '',
        ficha_url: `${SITE}/persona/${p.id}`,
        created_at: (p.created_at as string) ?? '',
        lat: '',
        lng: '',
        horario: '',
        info: p.fallecimiento_confirmado && p.motivo_fallecimiento ? `Fallecimiento: ${p.motivo_fallecimiento}` : '',
      }
    },
  },

  pacientes: {
    table: 'catastrophe_victims',
    filename: 'Apoyo.salu.pro-pacientes-atendidos',
    // Sin campos clínicos sensibles (motivo/alergias/condiciones/tratamiento).
    select:
      'id,registration_number,nombre_completo,cedula,genero,edad,telefono_contacto,sector_comunidad,nombre_edificio_casa,numero_apartamento_casa,ubicacion_actual_refugio,notas,created_at,updated_at,catastrophe_victim_info(triage_category,estado_destino,fecha_hora_entrada)',
    columns: ['fuente', 'tipo', 'registro', 'nombre', 'cedula', 'genero', 'edad', 'telefono',
      'sector_comunidad', 'edificio_casa', 'apartamento_casa', 'ubicacion_refugio', 'triage',
      'estado_destino', 'destino', 'fecha_entrada', 'created_at', 'updated_at'],
    map: (v) => {
      const info = v.catastrophe_victim_info as Record<string, unknown> | Record<string, unknown>[] | null
      const i = (Array.isArray(info) ? info[0] : info) ?? {}
      return {
        fuente: 'apoyo.salu.pro',
        tipo: 'paciente',
        registro: (v.registration_number as string) ?? '',
        nombre: (v.nombre_completo as string) ?? '',
        cedula: (v.cedula as string) ?? '',
        genero: GEN_TO_WORD[v.genero as string] ?? (v.genero as string) ?? '',
        edad: (v.edad as number) ?? '',
        telefono: (v.telefono_contacto as string) ?? '',
        sector_comunidad: (v.sector_comunidad as string) ?? '',
        edificio_casa: (v.nombre_edificio_casa as string) ?? '',
        apartamento_casa: (v.numero_apartamento_casa as string) ?? '',
        ubicacion_refugio: (v.ubicacion_actual_refugio as string) ?? '',
        triage: (i.triage_category as string) ?? '',
        estado_destino: (i.estado_destino as string) ?? '',
        destino: (v.notas as string) ?? '',
        fecha_entrada: (i.fecha_hora_entrada as string) ?? '',
        created_at: (v.created_at as string) ?? '',
        updated_at: (v.updated_at as string) ?? '',
      }
    },
  },
}

/** Pagina la tabla del dataset y va emitiendo las filas ya mapeadas. */
export async function* streamDatasetRows(
  supabase: SupabaseLike,
  def: DatasetDef,
  perPage = 1000,
): AsyncGenerator<ExportRow> {
  for (let from = 0; ; from += perPage) {
    const { data, error } = await supabase
      .from(def.table)
      .select(def.select)
      .order('created_at', { ascending: false })
      .range(from, from + perPage - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const rec of data) yield def.map(rec as Record<string, unknown>)
    if (data.length < perPage) break
  }
}

/** Escapa un valor para una celda CSV (RFC 4180). */
export function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
