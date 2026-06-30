import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { DATASETS, streamDatasetRows, csvCell } from '@/lib/exports/datasets'

/**
 * GET /api/export?dataset=<clave>&format=csv|json
 *
 * Exportación autenticada para socios externos (en vez de enviar CSV a mano).
 * Streamea el dataset completo para soportar decenas de miles de filas sin
 * cargar todo en memoria.
 *
 * Auth: cabecera `X-API-Key: <token>` (o `Authorization: Bearer <token>`)
 *       contra la lista EXPORT_API_TOKENS (separada por comas) del entorno.
 *
 * Datasets:
 *  - personas-desaparecidas : misma estructura del feed que intercambiamos.
 *  - pacientes              : sin campos clínicos sensibles.
 *
 * Usa service_role server-side (la autorización la hace el token, no RLS), y
 * solo emite las columnas curadas de cada dataset — nunca columnas crudas.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Comparación en tiempo (casi) constante para no filtrar el token por timing. */
function tokenAllowed(provided: string, allowed: string[]): boolean {
  let ok = false
  for (const t of allowed) {
    if (t.length === provided.length) {
      let diff = 0
      for (let i = 0; i < t.length; i++) diff |= t.charCodeAt(i) ^ provided.charCodeAt(i)
      if (diff === 0) ok = true
    }
  }
  return ok
}

export async function GET(request: NextRequest) {
  const tokens = (process.env.EXPORT_API_TOKENS ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean)
  if (tokens.length === 0) {
    return Response.json(
      { error: 'Export deshabilitado: configura EXPORT_API_TOKENS en el entorno.' },
      { status: 503 },
    )
  }

  const provided =
    request.headers.get('x-api-key') ??
    (request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '')
  if (!provided || !tokenAllowed(provided, tokens)) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const datasetKey = searchParams.get('dataset') ?? ''
  const format = (searchParams.get('format') ?? 'csv').toLowerCase()
  const def = DATASETS[datasetKey]
  if (!def) {
    return Response.json(
      { error: `dataset inválido. Opciones: ${Object.keys(DATASETS).join(', ')}` },
      { status: 400 },
    )
  }

  const supabase = await createServiceClient()
  const encoder = new TextEncoder()

  if (format === 'json') {
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode('['))
          let first = true
          for await (const row of streamDatasetRows(supabase, def)) {
            controller.enqueue(encoder.encode((first ? '' : ',') + JSON.stringify(row)))
            first = false
          }
          controller.enqueue(encoder.encode(']'))
          controller.close()
        } catch (e) {
          controller.error(e)
        }
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${def.filename}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // CSV (por defecto). BOM para que Excel reconozca UTF-8.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode('﻿' + def.columns.join(',') + '\r\n'))
        for await (const row of streamDatasetRows(supabase, def)) {
          controller.enqueue(encoder.encode(def.columns.map((c) => csvCell(row[c])).join(',') + '\r\n'))
        }
        controller.close()
      } catch (e) {
        controller.error(e)
      }
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${def.filename}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
