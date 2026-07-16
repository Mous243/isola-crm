import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Cliente = {
  id: number
  nombre_negocio: string
  propietario?: string
  telefono?: string
  direccion?: string
  zona?: string
  sector?: string
  hora_ideal_visita?: string
  frecuencia_visita?: string
  productos_habituales?: string[]
  notas_personales?: string
  fecha_ultima_visita?: string
  fecha_proxima_visita?: string
  deuda_pendiente?: number
  moneda_deuda?: string
  status?: string
  tags?: string[]
  dia_visita?: string
  codigo_cliente?: string
  lista_precio?: string
  lat?: number
  lng?: number
  created_at?: string
}

export type Visita = {
  id: number
  cliente_id: number
  fecha: string
  hora_llegada?: string
  hora_salida?: string
  resultado: string
  monto_pedido?: number
  moneda?: string
  productos_pedidos?: object[]
  notas_visita?: string
  foto_url?: string
  dias_credito?: number
  nro_factura?: string
  confirmado_sin_guia?: boolean
  created_at?: string
  clientes?: { nombre_negocio: string; propietario?: string }
}

export type Cobro = {
  id: number
  cliente_id: number
  monto: number
  moneda?: string
  descripcion?: string
  fecha_emision?: string
  fecha_vencimiento: string
  fecha_entrega?: string
  estado?: string
  origen?: string
  nro_documento_isola?: string
  created_at?: string
  clientes?: { nombre_negocio: string; propietario?: string; telefono?: string; codigo_cliente?: string }
}

export type Despacho = {
  id: number
  numero_guia: string
  fecha_guia: string
  conductor_nombre?: string
  conductor_telefono?: string
  placa?: string
  created_at?: string
}

export type DespachoItem = {
  id: number
  despacho_id: number
  cliente_id: number
  codigo_guia?: string
  bultos?: number
  estado?: string
  fecha_entrega?: string
  cobro_id?: number
  created_at?: string
  clientes?: { nombre_negocio: string; propietario?: string; telefono?: string }
}

export type PlanTrabajo = {
  id: number
  tipo: 'mensual' | 'semanal' | 'diario'
  fecha_inicio: string
  fecha_fin: string
  titulo: string
  resumen?: string
  contenido: { secciones: { titulo: string; texto?: string; items?: (string | { texto: string; hecho?: boolean })[] }[] }
  contexto?: { situacion_pais?: string; festividades?: { fecha: string; nombre: string; impacto?: string }[]; vacaciones_escolares?: string; fuentes?: string[] }
  enviado_telegram?: boolean
  created_at?: string
}

export type Producto = {
  id: number
  codigo?: string
  cod_barra?: string
  nombre: string
  categoria: string
  precio_und?: number
  precio_caja?: number
  und_caja?: number
  activo?: boolean
}
