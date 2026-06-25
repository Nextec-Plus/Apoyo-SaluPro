export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type TriageCategory = 'Rojo' | 'Amarillo' | 'Verde'

export type CareState =
  | 'Triaje'
  | 'En Atención'
  | 'Hospitalizado'
  | 'Transferido'
  | 'Alta Médica'
  | 'Anulado'

export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'boolean'
  | 'number'
  | 'date'
  | 'datetime'
  | 'file'

export type Genero = 'M' | 'F' | 'Otro'

export type FieldOption = { value: string; label: string }

// Row types (what SELECT returns)
export interface CatastropheVictim {
  id: string
  organization_id: string
  registration_number: string
  nombre_completo: string
  cedula: string | null
  edad: number | null
  genero: Genero | null
  telefono_contacto: string | null
  sector_comunidad: string | null
  nombre_edificio_casa: string | null
  numero_apartamento_casa: string | null
  ubicacion_actual_refugio: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

export interface CatastropheVictimInfo {
  id: string
  organization_id: string
  victim_id: string
  case_id: string | null
  triage_category: TriageCategory
  motivo_principal_consulta: string | null
  condiciones_preexistentes: string | null
  alergias: string | null
  tratamiento_medicamentos: string | null
  estado_destino: CareState
  fecha_hora_entrada: string
  created_at: string
  updated_at: string
}

export interface CatastropheFamilyContact {
  id: string
  organization_id: string
  victim_id: string
  nombre_contacto: string
  relacion: string
  telefono_nacional: string | null
  telefono_internacional: string | null
  is_emergency_contact: boolean
  notas: string | null
  created_at: string
  updated_at: string
}

export interface CatastropheCareRequirement {
  id: string
  organization_id: string
  provider_id: string | null
  provider_type: string | null
  care_state: CareState
  field_name: string
  field_label: string
  field_type: FieldType
  field_options: Json | null
  is_required: boolean
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

// Database schema type for Supabase client
export interface Database {
  public: {
    Tables: {
      catastrophe_victims: {
        Row: CatastropheVictim
        Relationships: []
        Insert: {
          id?: string
          organization_id: string
          registration_number: string
          nombre_completo: string
          cedula?: string | null
          edad?: number | null
          genero?: Genero | null
          telefono_contacto?: string | null
          sector_comunidad?: string | null
          nombre_edificio_casa?: string | null
          numero_apartamento_casa?: string | null
          ubicacion_actual_refugio?: string | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          registration_number?: string
          nombre_completo?: string
          cedula?: string | null
          edad?: number | null
          genero?: Genero | null
          telefono_contacto?: string | null
          sector_comunidad?: string | null
          nombre_edificio_casa?: string | null
          numero_apartamento_casa?: string | null
          ubicacion_actual_refugio?: string | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      catastrophe_victim_info: {
        Row: CatastropheVictimInfo
        Relationships: []
        Insert: {
          id?: string
          organization_id: string
          victim_id: string
          case_id?: string | null
          triage_category: TriageCategory
          motivo_principal_consulta?: string | null
          condiciones_preexistentes?: string | null
          alergias?: string | null
          tratamiento_medicamentos?: string | null
          estado_destino?: CareState
          fecha_hora_entrada?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          victim_id?: string
          case_id?: string | null
          triage_category?: TriageCategory
          motivo_principal_consulta?: string | null
          condiciones_preexistentes?: string | null
          alergias?: string | null
          tratamiento_medicamentos?: string | null
          estado_destino?: CareState
          fecha_hora_entrada?: string
          created_at?: string
          updated_at?: string
        }
      }
      catastrophe_family_contacts: {
        Row: CatastropheFamilyContact
        Relationships: []
        Insert: {
          id?: string
          organization_id: string
          victim_id: string
          nombre_contacto: string
          relacion: string
          telefono_nacional?: string | null
          telefono_internacional?: string | null
          is_emergency_contact?: boolean
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          victim_id?: string
          nombre_contacto?: string
          relacion?: string
          telefono_nacional?: string | null
          telefono_internacional?: string | null
          is_emergency_contact?: boolean
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      catastrophe_care_requirements: {
        Row: CatastropheCareRequirement
        Relationships: []
        Insert: {
          id?: string
          organization_id: string
          provider_id?: string | null
          provider_type?: string | null
          care_state: CareState
          field_name: string
          field_label: string
          field_type?: FieldType
          field_options?: Json | null
          is_required?: boolean
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          provider_id?: string | null
          provider_type?: string | null
          care_state?: CareState
          field_name?: string
          field_label?: string
          field_type?: FieldType
          field_options?: Json | null
          is_required?: boolean
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      triage_category: TriageCategory
      care_state: CareState
      field_type: FieldType
    }
    CompositeTypes: Record<string, never>
  }
}

// Convenience aliases
export type InsertCatastropheVictim = Database['public']['Tables']['catastrophe_victims']['Insert']
export type UpdateCatastropheVictim = Database['public']['Tables']['catastrophe_victims']['Update']
export type InsertCatastropheVictimInfo = Database['public']['Tables']['catastrophe_victim_info']['Insert']
export type UpdateCatastropheVictimInfo = Database['public']['Tables']['catastrophe_victim_info']['Update']
export type InsertCatastropheFamilyContact = Database['public']['Tables']['catastrophe_family_contacts']['Insert']
export type UpdateCatastropheFamilyContact = Database['public']['Tables']['catastrophe_family_contacts']['Update']
export type InsertCatastropheCareRequirement = Database['public']['Tables']['catastrophe_care_requirements']['Insert']
export type UpdateCatastropheCareRequirement = Database['public']['Tables']['catastrophe_care_requirements']['Update']
