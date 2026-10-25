'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Linea = 'osole_cmp' | 'osole_spp' | 'alka' | 'ole_spp'
type Cartera = {
  codigo: string
  cliente: string
  dia: string | null
  venta: number
  con_venta: boolean
  con_deuda: boolean
  corte: string
} & Record<Linea, boolean>
type ClienteCrm = { id: number; codigo_cliente: string; telefono?: string; fecha_ultima_visita?: string; nombre_negocio: string }

const LINEAS: { k: Linea; label: string }[] = [
  { k: 'osole_cmp', label: 'OSOLE Compotas' },
  { k: 'osole_spp', label: 'OSOLE Salsas' },
  { k: 'ole_spp', label: 'OLE Salsas' },
  { k: 'alka', label: 'ALKA' },
]
const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES']
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })
const diaHoy = () => {
  const n = new Date(hoy() + 'T12:00:00').getDay() // 0 dom
  return n >= 1 && n <= 5 ? DIAS[n - 1] : 'TODOS'
}
const diasDesde = (f?: string) => f ? Math.round((new Date(hoy() + 'T00:00:00').getTime() - new Date(f + 'T00:00:00').getTime()) / 864e5) : null
const tel58 = (t?: string) => {
  const d = (t || '').replace(/\D/g, '')
  if (!d) return null
  return d.startsWith('58') ? d : '58' + d.replace(/^0/, '')
}

export default function CarteraPage() {
  const [cartera, setCartera] = useState<Cartera[]>([])
  const [crm, setCrm] = useState<Record<string, ClienteCrm>>({})
  const [dia, setDia] = useState(diaHoy())
  const [vista, setVista] = useState<'sin_venta' | 'lineas'>('sin_venta')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('cartera_isola').select('*'),
      supabase.from('clientes').select('id, codigo_cliente, telefono, fecha_ultima_visita, nombre_negocio'),
    ]).then(([a, b]) => {
      setCartera((a.data || []) as Cartera[])
      const m: Record<string, ClienteCrm> = {}
      for (const c of (b.data || []) as ClienteCrm[]) if (c.codigo_cliente) m[c.codigo_cliente] = c
      setCrm(m)
      setCargando(false)
    })
  }, [])

  const sinVenta = cartera.filter(c => !c.con_venta)
  const porDia = (arr: Cartera[]) => dia === 'TODOS' ? arr : arr.filter(c => c.dia === dia)
  const conVentaIncompleta = cartera.filter(c => c.con_venta && LINEAS.some(l => !c[l.k]))

  const lista = (vista === 'sin_venta' ? porDia(sinVenta) : porDia(conVentaIncompleta))
    .map(c => ({ c, cl: crm[c.codigo], dv: diasDesde(crm[c.codigo]?.fecha_ultima_visita) }))
    .sort((a, b) => vista === 'sin_venta'
      ? (b.dv ?? 9999) - (a.dv ?? 9999)
      : LINEAS.filter(l => !b.c[l.k]).length - LINEAS.filter(l => !a.c[l.k]).length || b.c.venta - a.c.venta)

  const wa = (cl: ClienteCrm | undefined, nombre: string) => {
    const t = tel58(cl?.telefono)
    if (!t) return null
    const msg = `Hola ${nombre}, buenos días. Le escribo de ISOLA para coordinar su pedido de esta semana. ¿Qué necesita?`
    return `https://wa.me/${t}?text=${encodeURIComponent(msg)}`
  }

  const corte = cartera[0]?.corte
  const totSin = sinVenta.length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-emerald-400">Cartera ISOLA</h1>
        <Link href="/cobros" className="ml-auto text-sm text-slate-400 hover:text-white">← Cobros</Link>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <p className="text-2xl font-bold">{cartera.length}</p><p className="text-xs text-slate-400">Clientes</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <p className="text-2xl font-bold text-green-400">{cartera.length - totSin}</p><p className="text-xs text-slate-400">Con venta</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <p className="text-2xl font-bold text-orange-400">{totSin}</p><p className="text-xs text-slate-400">Sin venta</p>
        </div>
      </div>
      {corte && <p className="text-xs text-slate-500">Datos del reporte de ISOLA al {corte.split('-').reverse().join('/')} (mes en curso).</p>}

      <div className="flex gap-2">
        {([['sin_venta', `Sin venta (${porDia(sinVenta).length})`], ['lineas', `Líneas por activar (${porDia(conVentaIncompleta).length})`]] as const).map(([v, t]) => (
          <button key={v} onClick={() => setVista(v)}
            className={`px-3 py-1.5 rounded-lg text-sm ${vista === v ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{t}</button>
        ))}
      </div>

      <div className="flex gap-1 flex-wrap">
        {['TODOS', ...DIAS].map(d => (
          <button key={d} onClick={() => setDia(d)}
            className={`px-2.5 py-1 rounded-lg text-xs ${dia === d ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {d === 'MIERCOLES' ? 'MIÉ' : d.slice(0, 3)}{d !== 'TODOS' && ` ${(vista === 'sin_venta' ? sinVenta : conVentaIncompleta).filter(c => c.dia === d).length}`}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {lista.map(({ c, cl, dv }) => {
          const link = wa(cl, (cl?.nombre_negocio || c.cliente).split(',')[0])
          return (
            <div key={c.codigo} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{cl?.nombre_negocio || c.cliente}</p>
                  <p className="text-xs text-slate-400">
                    {c.codigo} · {c.dia || 'sin día'}
                    {!cl && <span className="text-yellow-500"> · no está en el CRM</span>}
                  </p>
                </div>
                <div className="text-right text-xs">
                  {vista === 'sin_venta'
                    ? <span className={dv === null ? 'text-slate-500' : dv > 21 ? 'text-red-400' : 'text-slate-400'}>
                        {dv === null ? 'sin visitas' : dv === 0 ? 'visitado hoy' : `${dv}d sin visita`}</span>
                    : <span className="text-green-400">{c.venta} cajas</span>}
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap items-center">
                {LINEAS.map(l => (
                  <span key={l.k} className={`text-[11px] px-2 py-0.5 rounded-full ${c[l.k]
                    ? 'bg-green-900/50 text-green-300' : 'bg-slate-800 text-slate-500'}`}>
                    {c[l.k] ? '✓' : '○'} {l.label}
                  </span>
                ))}
                {c.con_deuda && <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-900/50 text-orange-300">💰 con deuda: cobrar primero</span>}
                {link && (
                  <a href={link} target="_blank" rel="noreferrer"
                    className="ml-auto bg-green-800/50 hover:bg-green-700/50 text-green-400 px-3 py-1 rounded-lg text-xs">📱 WhatsApp</a>
                )}
              </div>
            </div>
          )
        })}
        {!cargando && lista.length === 0 && <p className="text-slate-400 text-center py-8">Nada para este filtro.</p>}
      </div>
    </div>
  )
}
