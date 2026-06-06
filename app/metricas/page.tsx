'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

export default function Metricas() {
  const [semana, setSemana] = useState<any>(null)
  const [historial, setHistorial] = useState<any[]>([])
  const [top, setTop] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [mes, setMes] = useState<{ monto: number; visitas: number }>({ monto: 0, visitas: 0 })
  const [metaForm, setMetaForm] = useState({ monto: '', visitas: '' })
  const [editMeta, setEditMeta] = useState(false)
  const periodo = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    const hace7 = new Date(Date.now() - 6 * 864e5).toISOString().split('T')[0]
    const hace30 = new Date(Date.now() - 29 * 864e5).toISOString().split('T')[0]

    const inicioMes = `${periodo}-01`

    Promise.all([
      supabase.from('visitas').select('resultado, monto_pedido, cliente_id').gte('fecha', hace7),
      supabase.from('visitas').select('fecha, resultado, monto_pedido').gte('fecha', hace30).order('fecha'),
      supabase.from('metas').select('*').eq('periodo', periodo).eq('tipo', 'mensual').maybeSingle(),
      supabase.from('visitas').select('cliente_id, monto_pedido, resultado, clientes(nombre_negocio)')
        .eq('resultado', 'visita_efectiva').gt('monto_pedido', 0).gte('fecha', hace30),
      supabase.from('visitas').select('resultado, monto_pedido').gte('fecha', inicioMes),
    ]).then(([vs, hist, m, topVs, mesVs]) => {
      const v = vs.data || []
      const conPedido = v.filter((x: any) => x.resultado === 'visita_efectiva' && (x.monto_pedido || 0) > 0)
      setSemana({
        total: v.length,
        con_pedido: conPedido.length,
        tasa: v.length ? Math.round(conPedido.length / v.length * 100) : 0,
        monto: v.reduce((a: number, x: any) => a + (x.monto_pedido || 0), 0),
        clientes: new Set(v.map((x: any) => x.cliente_id)).size,
      })

      const porFecha: Record<string, any> = {}
      for (const row of hist.data || []) {
        if (!porFecha[row.fecha]) porFecha[row.fecha] = { fecha: row.fecha, visitas: 0, pedidos: 0, monto: 0 }
        porFecha[row.fecha].visitas++
        if (row.resultado === 'visita_efectiva' && (row.monto_pedido || 0) > 0) { porFecha[row.fecha].pedidos++; porFecha[row.fecha].monto += row.monto_pedido || 0 }
      }
      setHistorial(Object.values(porFecha).map((r: any) => ({ ...r, fecha: r.fecha.slice(5) })))

      const porCliente: Record<number, any> = {}
      for (const row of topVs.data || []) {
        if (!porCliente[row.cliente_id]) porCliente[row.cliente_id] = { nombre: (row.clientes as any)?.nombre_negocio, monto: 0, visitas: 0 }
        porCliente[row.cliente_id].monto += row.monto_pedido || 0
        porCliente[row.cliente_id].visitas++
      }
      setTop(Object.values(porCliente).sort((a: any, b: any) => b.monto - a.monto).slice(0, 8))

      setMeta(m.data)
      const mv = mesVs.data || []
      setMes({
        monto: mv.reduce((a: number, x: any) => a + (x.monto_pedido || 0), 0),
        visitas: mv.length,
      })
    })
  }, [])

  const guardarMeta = async () => {
    const d = { periodo, tipo: 'mensual', meta_monto: +metaForm.monto, meta_visitas: +metaForm.visitas }
    if (meta) await supabase.from('metas').update(d).eq('id', meta.id)
    else await supabase.from('metas').insert(d)
    setMeta(d)
    setEditMeta(false)
  }

  const mesActual = new Date().toISOString().slice(0, 7)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-violet-400">Mis Métricas</h1>

      {/* Semana */}
      {semana && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 mb-2">Esta semana</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { label: 'Visitas', value: semana.total },
              { label: 'Clientes', value: semana.clientes },
              { label: 'Con pedido', value: semana.con_pedido },
              { label: 'Tasa cierre', value: `${semana.tasa}%` },
              { label: 'Monto USD', value: `$${semana.monto.toFixed(0)}` },
            ].map(m => (
              <div key={m.label} className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-center">
                <p className="text-xl font-bold text-violet-400">{m.value}</p>
                <p className="text-xs text-slate-500">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta mensual */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-semibold">Meta del mes ({mesActual})</h2>
          <button onClick={() => { setEditMeta(!editMeta); setMetaForm({ monto: String(meta?.meta_monto || ''), visitas: String(meta?.meta_visitas || '') }) }}
            className="ml-auto text-xs text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded">
            {editMeta ? 'Cancelar' : 'Editar'}
          </button>
        </div>
        {editMeta && (
          <div className="flex gap-2 mb-3">
            <input type="number" placeholder="Meta USD" value={metaForm.monto} onChange={e => setMetaForm({ ...metaForm, monto: e.target.value })}
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm" />
            <input type="number" placeholder="Meta visitas" value={metaForm.visitas} onChange={e => setMetaForm({ ...metaForm, visitas: e.target.value })}
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm" />
            <button onClick={guardarMeta} className="bg-violet-600 text-white px-3 py-1.5 rounded text-sm">OK</button>
          </div>
        )}
        {meta && meta.meta_monto > 0 ? (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Monto del mes</span>
                <span className="text-violet-400">${mes.monto.toFixed(0)} / ${meta.meta_monto}</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-violet-600 rounded-full transition-all"
                  style={{ width: `${Math.min(mes.monto / meta.meta_monto * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Configura una meta mensual para ver el progreso.</p>
        )}
      </div>

      {/* Historial */}
      {historial.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
          <h2 className="font-semibold mb-3">Actividad últimos 30 días</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={historial}>
              <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <Bar dataKey="visitas" fill="#38bdf8" radius={[2, 2, 0, 0]} />
              <Bar dataKey="pedidos" fill="#f97316" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={historial}>
              <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <Line dataKey="monto" stroke="#a78bfa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top clientes */}
      {top.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
          <h2 className="font-semibold mb-3">Top clientes (30 días)</h2>
          <div className="space-y-2">
            {top.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-slate-500 text-sm w-5">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-0.5">
                    <span className="truncate">{c.nombre}</span>
                    <span className="text-violet-400 shrink-0">${c.monto.toFixed(0)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full">
                    <div className="h-full bg-violet-600/60 rounded-full"
                      style={{ width: `${c.monto / top[0].monto * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!semana && <p className="text-slate-400 text-center py-8">Registra visitas para ver métricas.</p>}
    </div>
  )
}
