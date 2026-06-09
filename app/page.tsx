'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Stats = { total: number; con_pedido: number; sin_pedido: number; monto: number }

function waRecordatorio(c: any) {
  const cl = c.clientes
  const nombre = cl?.propietario || cl?.nombre_negocio || ''
  const dias = Math.ceil((new Date(c.fecha_vencimiento).getTime() - Date.now()) / 864e5)
  const cuando = dias <= 0 ? `que venció el ${c.fecha_vencimiento}` : `con vencimiento el ${c.fecha_vencimiento} (en ${dias}d)`
  const msg = `Hola ${nombre}, esperamos que todo marche bien. Le recordamos que tiene una factura pendiente por ${c.moneda} ${Number(c.monto).toFixed(2)}, ${cuando}. Quedamos atentos para coordinar el pago o resolver cualquier duda. Saludos cordiales — Guaramato, ISOLA`
  return `https://wa.me/${(cl?.telefono || '').replace('+', '')}?text=${encodeURIComponent(msg)}`
}

function AlertaBanner({ stats, cobrosUrgentes, sinVisitar }: {
  stats: Stats; cobrosUrgentes: any[]; sinVisitar: any[]
}) {
  const h = parseInt(new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', hour12: false }))
  const [visible, setVisible] = useState(true)
  if (!visible || !loaded) return null

  let tipo: 'manana' | 'tarde' | 'noche' | null = null
  if (h >= 6 && h < 9) tipo = 'manana'
  else if (h >= 9 && h < 11) tipo = 'tarde'
  else if (h >= 20 && h < 22) tipo = 'noche'
  if (!tipo) return null

  const cfg = {
    manana: {
      icon: '☀️', color: 'border-yellow-500/40 bg-yellow-900/20',
      title: 'Buenos días',
      msg: `${sinVisitar.length} clientes sin visitar · ${cobrosUrgentes.length} cobros urgentes`,
    },
    tarde: cobrosUrgentes.length === 0 ? null : {
      icon: '💰', color: 'border-orange-500/40 bg-orange-900/20',
      title: 'Cobros próximos',
      msg: `${cobrosUrgentes.length} cobro${cobrosUrgentes.length > 1 ? 's' : ''} vence${cobrosUrgentes.length > 1 ? 'n' : ''} en 3 días`,
    },
    noche: stats.total === 0 ? null : {
      icon: '🌙', color: 'border-blue-500/40 bg-blue-900/20',
      title: 'Resumen del día',
      msg: `${stats.con_pedido}/${stats.total} visitas con pedido · $${stats.monto.toFixed(0)} total`,
    },
  }[tipo]

  if (!cfg) return null

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${cfg.color} relative`}>
      <span className="text-2xl">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{cfg.title}</p>
        <p className="text-xs text-slate-300 mt-0.5">{cfg.msg}</p>
      </div>
      <button onClick={() => setVisible(false)} className="text-slate-500 hover:text-slate-300 text-lg leading-none shrink-0">×</button>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, con_pedido: 0, sin_pedido: 0, monto: 0 })
  const [cobrosUrgentes, setCobrosUrgentes] = useState<any[]>([])
  const [sinVisitar, setSinVisitar] = useState<any[]>([])
  const [visitasHoy, setVisitasHoy] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)

  const hoy = new Date().toISOString().split('T')[0]
  const hace7 = new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0]
  const en3 = new Date(Date.now() + 3 * 864e5).toISOString().split('T')[0]

  useEffect(() => {
    Promise.all([
      supabase.from('visitas').select('resultado, monto_pedido, notas_visita, clientes(nombre_negocio)').eq('fecha', hoy),
      supabase.from('cobros').select('*, clientes(nombre_negocio, telefono)').eq('estado', 'pendiente').lte('fecha_vencimiento', en3).order('fecha_vencimiento'),
      supabase.from('clientes').select('id, nombre_negocio, fecha_ultima_visita').eq('status', 'activo').or(`fecha_ultima_visita.is.null,fecha_ultima_visita.lt.${hace7}`).order('fecha_ultima_visita', { nullsFirst: true }),
    ]).then(([v, c, s]) => {
      const vs = v.data || []
      setVisitasHoy(vs)
      const conPedido = vs.filter((x: any) => x.resultado === 'visita_efectiva' && (x.monto_pedido || 0) > 0).length
      setStats({
        total: vs.length,
        con_pedido: conPedido,
        sin_pedido: vs.length - conPedido,
        monto: vs.reduce((a: number, x: any) => a + (x.monto_pedido || 0), 0),
      })
      setCobrosUrgentes(c.data || [])
      setSinVisitar(s.data || [])
      setLoaded(true)
    })
  }, [])

  return (
    <div className="space-y-6">
      <AlertaBanner stats={stats} cobrosUrgentes={cobrosUrgentes} sinVisitar={sinVisitar} />
      <div>
        <h1 className="text-2xl font-bold text-violet-400">Dashboard</h1>
        <p className="text-slate-400 text-sm">{new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Visitas hoy', value: stats.total, color: 'text-blue-400' },
          { label: 'Con pedido', value: stats.con_pedido, color: 'text-green-400' },
          { label: 'Sin pedido', value: stats.sin_pedido, color: 'text-red-400' },
          { label: 'Monto USD', value: `$${stats.monto.toFixed(2)}`, color: 'text-violet-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-500 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            ⚠️ Cobros urgentes
            <span className="ml-auto text-xs text-slate-500">próx. 3 días</span>
          </h2>
          {cobrosUrgentes.length === 0
            ? <p className="text-green-400 text-sm">Sin cobros urgentes ✓</p>
            : cobrosUrgentes.map(c => {
                const dias = Math.ceil((new Date(c.fecha_vencimiento).getTime() - Date.now()) / 864e5)
                return (
                  <div key={c.id} className="mb-2 p-2 bg-red-950/50 rounded-lg border border-red-900/40 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{(c.clientes as any)?.nombre_negocio}</p>
                      <p className="text-xs text-slate-400">{c.moneda} {c.monto.toFixed(2)} · {dias <= 0 ? 'VENCIDO' : `vence en ${dias}d`}</p>
                    </div>
                    {(c.clientes as any)?.telefono && (
                      <a href={waRecordatorio(c)} target="_blank" rel="noreferrer"
                        className="shrink-0 bg-green-800/50 hover:bg-green-700/50 text-green-400 px-2 py-1 rounded-lg text-xs">
                        📱 Recordar
                      </a>
                    )}
                  </div>
                )
              })
          }
        </div>

        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            📋 Sin visitar
            <span className="ml-auto text-xs text-slate-500">{sinVisitar.length} clientes</span>
          </h2>
          {sinVisitar.length === 0
            ? <p className="text-green-400 text-sm">Todos visitados ✓</p>
            : sinVisitar.slice(0, 6).map(c => (
                <div key={c.id} className="flex justify-between items-center py-1 border-b border-slate-800/60 last:border-0">
                  <p className="text-sm">{c.nombre_negocio}</p>
                  <p className="text-xs text-slate-500">{c.fecha_ultima_visita || 'Nunca'}</p>
                </div>
              ))
          }
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
        <h2 className="font-semibold mb-3">📅 Visitas de hoy</h2>
        {visitasHoy.length === 0
          ? <div className="text-center py-6">
              <p className="text-slate-400 mb-3">Sin visitas registradas hoy</p>
              <Link href="/visita" className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm">
                + Registrar primera visita
              </Link>
            </div>
          : visitasHoy.map((v: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
                <span className="text-lg">{v.resultado === 'visita_efectiva' && (v.monto_pedido || 0) > 0 ? '✅' : '❌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{(v.clientes as any)?.nombre_negocio}</p>
                  {v.notas_visita && <p className="text-xs text-slate-400 truncate">{v.notas_visita}</p>}
                </div>
                <span className="text-sm text-violet-400 shrink-0">${(v.monto_pedido || 0).toFixed(2)}</span>
              </div>
            ))
        }
      </div>
    </div>
  )
}
