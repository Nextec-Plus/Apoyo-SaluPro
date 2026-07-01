/* Tipos del payload de /api/inventory/reports (deben reflejar el route handler). */

export interface LabelValue {
  label: string
  value: number
}

/** Solicitud de insumos georreferenciada (marcador en el mapa de calor). */
export interface SolicitudGeoPoint {
  id: string
  lat: number
  lng: number
  nombre: string
  estado: string
  tipoSolicitante: string
  telefono: string | null
  correo: string | null
  cedulaRif: string | null
  direccion: string | null
  notas: string | null
  seccionesSolicitadas: unknown
  createdAt: string
}

export interface ReportData {
  error: null | string
  period: { from: string; to: string; umbral: number }
  kpis: {
    activeItems: number
    itemsConStock: number
    totalStock: number
    entradasCount: number
    entradasUnidades: number
    salidasCount: number
    salidasUnidades: number
    balanceNeto: number
    solicitudesPendientes: number
    solicitudesTotal: number
  }
  distribucion: {
    porDestinatario: LabelValue[]
    porCategoria: LabelValue[]
    porMedio: LabelValue[]
  }
  solicitudes: {
    vsInventario: { label: string; solicitudes: number; stock: number }[]
    porEstado: LabelValue[]
    porTipo: LabelValue[]
    geo: SolicitudGeoPoint[]
  }
  alertas: {
    enCero: { id: string; presentacion: string; section: string; subcategory: string }[]
    bajoUmbral: { id: string; presentacion: string; stock: number; section: string; subcategory: string }[]
    categoriasDesabastecidas: LabelValue[]
  }
  auditoria: {
    productividad: { operadorId: string; operador: string; entradas: number; salidas: number; total: number }[]
    movimientos: {
      id: string
      tipo: 'entrada' | 'salida'
      cantidad: number
      presentacion: string
      section: string
      subcategory: string
      detalle: string
      operador: string
      created_at: string
    }[]
  }
}

/* Paleta derivada del tema (globals.css). */
export const CHART = {
  primary: '#2d6a2d',
  primaryLight: '#66bb6a',
  primaryFaint: '#a5d6a7',
  crisis: '#c62828',
  amber: '#f59e0b',
  blue: '#2563eb',
  teal: '#0d9488',
  purple: '#7c3aed',
  gray: '#9ca3af',
}

/** Paleta cíclica para series categóricas. */
export const PALETTE = [
  CHART.primary,
  CHART.blue,
  CHART.amber,
  CHART.teal,
  CHART.purple,
  CHART.crisis,
  CHART.primaryLight,
  CHART.gray,
]
