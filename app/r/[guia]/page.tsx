'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase, type Despacho, type DespachoItem } from '@/lib/supabase'

function direccionDe(cliente: any): string | null {
  if (!cliente) return null
  return cliente.direccion || (cliente.zona ? `${cliente.zona}, Venezuela` : null)
}

function linkCliente(direccion: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`
}

function linkRutaCompleta(direcciones: string[]) {
  const destino = direcciones[direcciones.length - 1]
  const waypoints = direcciones.slice(0, -1).map(d => encodeURIComponent(d)).join('|')
  const params = new URLSearchParams({ api: '1', destination: destino, travelmode: 'driving' })
  let url = `https://www.google.com/maps/dir/?${params.toString()}`
  if (waypoints) url += `&waypoints=${waypoints}`
  return url
}

export default function Rutero() {
  const { guia } = useParams<{ guia: string }>()
  const [despacho, setDespacho] = useState<Despacho | null>(null)
  const [items, setItems] = useState<(DespachoItem & { clientes?: any })[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!guia) return
    supabase.from('despachos').select('*').eq('numero_guia', guia).maybeSingle().then(async ({ data: d }) => {
      setDespacho(d)
      if (d) {
        const { data: it } = await supabase
          .from('despacho_items').select('*, clientes(nombre_negocio, direccion, zona, propietario, telefono)')
          .eq('despacho_id', d.id).order('id')
        setItems(it || [])
      }
      setCargando(false)
    })
  }, [guia])

  if (cargando) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Cargando...</div>
  if (!despacho) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Guía #{guia} no encontrada.</div>

  const direcciones = items.map(i => direccionDe(i.clientes)).filter((d): d is string => !!d)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-violet-400">Guía #{despacho.numero_guia}</h1>
        <p className="text-sm text-slate-400">
          {despacho.conductor_nombre}{despacho.placa ? ` · ${despacho.placa}` : ''} · {despacho.fecha_guia}
        </p>
      </div>

      {direcciones.length > 1 && (
        <a href={linkRutaCompleta(direcciones)} target="_blank" rel="noopener noreferrer"
          className="block w-full text-center bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-xl font-medium">
          🗺️ Ver ruta completa en Maps ({direcciones.length} paradas)
        </a>
      )}

      <div className="space-y-2">
        {items.map(item => {
          const cl = item.clientes as any
          const direccion = direccionDe(cl)
          return (
            <div key={item.id} className="bg-slate-900 rounded-xl border border-slate-800 p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-snug">{cl?.nombre_negocio}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {item.codigo_guia ? `Cód. ${item.codigo_guia} · ` : ''}{item.bultos ?? '?'} bultos
                  {!cl?.direccion && cl?.zona ? ' · ubicación aproximada (solo zona)' : ''}
                </p>
              </div>
              {direccion ? (
                <a href={linkCliente(direccion)} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 bg-violet-900/50 hover:bg-violet-800/50 text-violet-300 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">
                  📍 Cómo llegar
                </a>
              ) : (
                <span className="shrink-0 text-xs text-slate-600">Sin ubicación</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
