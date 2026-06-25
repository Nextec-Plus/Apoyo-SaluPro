/** Organización por defecto — Clínica Móvil La Guaira (crisis 2026) */
export const DEFAULT_ORGANIZATION_ID = 'a0000000-0000-4000-8000-000000000001'

export function getOrganizationId(): string {
  return (
    process.env.ORGANIZATION_ID ??
    process.env.NEXT_PUBLIC_ORGANIZATION_ID ??
    DEFAULT_ORGANIZATION_ID
  )
}

export function getClientOrganizationId(): string {
  return process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? DEFAULT_ORGANIZATION_ID
}

const TRIAGE_UI_TO_DB = {
  verde: 'Verde',
  amarillo: 'Amarillo',
  rojo: 'Rojo',
} as const

export type TriageUiId = keyof typeof TRIAGE_UI_TO_DB

export function triageUiToDb(id: TriageUiId) {
  return TRIAGE_UI_TO_DB[id]
}

const GENERO_UI_TO_DB: Record<string, 'M' | 'F' | 'Otro'> = {
  Masculino: 'M',
  Femenino: 'F',
  Otro: 'Otro',
}

export function generoUiToDb(label: string) {
  return GENERO_UI_TO_DB[label] ?? null
}

const GENERO_DB_TO_UI: Record<string, string> = {
  M: 'Masculino',
  F: 'Femenino',
  Otro: 'Otro',
}

export function generoDbToUi(code: string | null | undefined) {
  if (!code) return '—'
  return GENERO_DB_TO_UI[code] ?? code
}
