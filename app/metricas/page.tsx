'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

export default function Metricas() {
  const [semana, setSemana] = useState<any>(null)
  const [historial, setHistorial] = useState<any[]>([])
  const [top, setTop] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [mes, setMes] = useState<{ monto: number; visitas: number; cobranza: number; visitas_efectivas: number }>({ monto: 0, visitas: 0, cobranza: 0, visitas_efectivas: 0 })
  const [metaForm, setMetaForm] = useState({ monto: '', visitas: '', cobranza: '', visitas_efectivas: '' })
  const [editMeta, setEditMeta] = useState(false)
  const [metasVar, setMetasVar] = useState<any[]>([])
  const [noVisitados, setNoVisitados] = useState<string[]>([])
  const [showNoVisitados, setShowNoVisitados] = useState(false)
  const [showTasaInfo, setShowTasaInfo] = useState(false)
  const [addingVar, setAddingVar] = useState(false)
  const [expandedMeta, setExpandedMeta] = useState<number | null>(null)
  const [varForm, setVarForm] = useState({ nombre: '', tipo: 'captaciones', meta_valor: '', producto_keyword: '' })
  const periodo = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    const hace7 = new Date(Date.now() - 6 * 864e5).toISOString().split('T')[0]
    const hace30 = new Date(Date.now() - 29 * 864e5).toISOString().split('T')[0]

    const inicioMes = `${periodo}-01`

    Promise.all([
      supabase.from('visitas').select('resultado, monto_pedido, cliente_id').gte('fecha', inicioMes),
      supabase.from('visitas').select('fecha, resultado, monto_pedido').gte('fecha', hace30).order('fecha'),
      supabase.from('metas').select('*').eq('periodo', periodo).eq('tipo', 'mensual').maybeSingle(),
      supabase.from('visitas').select('cliente_id, monto_pedido, resultado, clientes(nombre_negocio)')
        .eq('resultado', 'visita_efectiva').gt('monto_pedido', 0).gte('fecha', hace30),
      supabase.from('visitas').select('resultado, monto_pedido, cliente_id, productos_pedidos, clientes(nombre_negocio)').gte('fecha', inicioMes),
      supabase.from('cobros').select('monto').eq('estado', 'pagado').gte('fecha_pago', inicioMes),
      supabase.from('metas_variables').select('*').eq('periodo', periodo),
      supabase.from('clientes').select('id', { count: 'exact', head: true }).gte('fecha_captacion', inicioMes),
      supabase.from('clientes').select('id, nombre_negocio').in('status', ['activo', 'nuevo', 'inactivo']).order('nombre_negocio'),
    ]).then(([vs, hist, m, topVs, mesVs, cobranzaVs, metasVarRes, captRes, carteraRes]) => {
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
      const cobranzaTotal = (cobranzaVs.data || []).reduce((a: number, x: any) => a + Number(x.monto), 0)
      const captaciones = captRes.count || 0
      const todosClientes: any[] = carteraRes.data || []
      const totalCartera = todosClientes.length
      const visitadosSet = new Set(mv.map((x: any) => x.cliente_id))
      const clientesNoVisitados = todosClientes.filter((c: any) => !visitadosSet.has(c.id)).map((c: any) => c.nombre_negocio)
      setNoVisitados(clientesNoVisitados)
      setMes({
        monto: mv.reduce((a: number, x: any) => a + (x.monto_pedido || 0), 0),
        visitas: visitadosSet.size,
        cobranza: cobranzaTotal,
        visitas_efectivas: new Set(mv.filter((x: any) => x.resultado === 'visita_efectiva' && (x.monto_pedido || 0) > 0).map((x: any) => x.cliente_id)).size,
      })
      const efectivosMes = mv.filter((x: any) => x.resultado === 'visita_efectiva' && (x.monto_pedido || 0) > 0)
      const clientesEfectivos = new Set(efectivosMes.map((x: any) => x.cliente_id)).size
      const calculadas = (metasVarRes.data || []).map((mv2: any) => {
        if (mv2.tipo === 'captaciones') {
          return { ...mv2, actual: captaciones, base: null }
        }
        if (mv2.tipo === 'producto_porcentaje') {
          const kw = (mv2.producto_keyword || '').toLowerCase()
          const excludes = (mv2.exclude_keyword || '').toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean)
          const visConProd = efectivosMes.filter((x: any) =>
            (x.productos_pedidos || []).some((p: any) => {
              const nombre = (p.nombre || '').toLowerCase()
              return nombre.includes(kw) && excludes.every((ex: string) => !nombre.includes(ex))
            })
          )
          const mapaClientes = new Map(visConProd.map((x: any) => [x.cliente_id, (x.clientes as any)?.nombre_negocio || `#${x.cliente_id}`]))
          const conProd = mapaClientes.size
          const clientesLista = [...mapaClientes.values()] as string[]
          const pctActual = clientesEfectivos > 0 ? Math.round(conProd / clientesEfectivos * 100) : 0
          return { ...mv2, actual: pctActual, conProducto: conProd, base: clientesEfectivos, clientesLista }
        }
        if (mv2.tipo === 'producto_cartera') {
          const kw = (mv2.producto_keyword || '').toLowerCase()
          const excludes = (mv2.exclude_keyword || '').toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean)
          const visConProd = efectivosMes.filter((x: any) =>
            (x.productos_pedidos || []).some((p: any) => {
              const nombre = (p.nombre || '').toLowerCase()
              return nombre.includes(kw) && excludes.every((ex: string) => !nombre.includes(ex))
            })
          )
          const mapaClientes = new Map(visConProd.map((x: any) => [x.cliente_id, (x.clientes as any)?.nombre_negocio || `#${x.cliente_id}`]))
          const conProd = mapaClientes.size
          const clientesLista = [...mapaClientes.values()] as string[]
          const pctActual = totalCartera > 0 ? Math.round(conProd / totalCartera * 100) : 0
          return { ...mv2, actual: pctActual, conProducto: conProd, base: totalCartera, clientesLista }
        }
        return { ...mv2, actual: 0, base: null }
      })
      setMetasVar(calculadas)
    })
  }, [])

  const guardarMeta = async () => {
    const d = { periodo, tipo: 'mensual', meta_monto: +metaForm.monto, meta_visitas: +metaForm.visitas, meta_cobranza: +metaForm.cobranza, meta_visitas_efectivas: +metaForm.visitas_efectivas }
    if (meta) await supabase.from('metas').update(d).eq('id', meta.id)
    else await supabase.from('metas').insert(d)
    setMeta(d)
    setEditMeta(false)
  }

  const guardarMetaVar = async () => {
    if (!varForm.nombre || !varForm.meta_valor) return
    await supabase.from('metas_variables').insert({
      periodo, nombre: varForm.nombre, tipo: varForm.tipo,
      meta_valor: +varForm.meta_valor,
      producto_keyword: varForm.tipo === 'producto_porcentaje' ? varForm.producto_keyword : null,
    })
    setAddingVar(false)
    setVarForm({ nombre: '', tipo: 'captaciones', meta_valor: '', producto_keyword: '' })
    window.location.reload()
  }

  const eliminarMetaVar = async (id: number) => {
    if (!confirm('¿Eliminar esta meta del supervisor?')) return
    await supabase.from('metas_variables').delete().eq('id', id)
    setMetasVar(prev => prev.filter((m: any) => m.id !== id))
  }

  const mesActual = new Date().toISOString().slice(0, 7)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-violet-400">Mis Métricas</h1>

      {/* Semana */}
      {semana && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 mb-2">Este mes</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { label: 'Visitas', value: semana.total },
              { label: 'Clientes', value: semana.clientes },
              { label: 'Con pedido', value: semana.con_pedido },
              { label: 'Monto USD', value: `$${semana.monto.toFixed(0)}` },
            ].map(m => (
              <div key={m.label} className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-center">
                <p className="text-xl font-bold text-violet-400">{m.value}</p>
                <p className="text-xs text-slate-500">{m.label}</p>
              </div>
            ))}
            <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-center col-span-2 md:col-span-1">
              <div className="flex items-center justify-center gap-1.5">
                <p className={`text-xl font-bold ${semana.tasa >= 50 ? 'text-green-400' : semana.tasa >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {semana.tasa}%
                </p>
                <button onClick={() => setShowTasaInfo(v => !v)} className="text-slate-600 hover:text-slate-400 text-xs leading-none mt-0.5">ⓘ</button>
              </div>
              <p className="text-xs text-slate-500">Tasa cierre</p>
              {showTasaInfo && (
                <div className="mt-2 text-left space-y-1 border-t border-slate-800 pt-2">
                  <p className={`text-xs ${semana.tasa < 30 ? 'text-red-400 font-semibold' : 'text-slate-500'}`}>{'< 30% — Revisar argumentos'}</p>
                  <p className={`text-xs ${semana.tasa >= 30 && semana.tasa < 50 ? 'text-yellow-400 font-semibold' : 'text-slate-500'}`}>30–50% — Normal en campo</p>
                  <p className={`text-xs ${semana.tasa >= 50 ? 'text-green-400 font-semibold' : 'text-slate-500'}`}>{'>= 50% — Excelente'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Meta mensual */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-semibold">Meta del mes ({mesActual})</h2>
          <button onClick={() => { setEditMeta(!editMeta); setMetaForm({ monto: String(meta?.meta_monto || ''), visitas: String(meta?.meta_visitas || ''), cobranza: String(meta?.meta_cobranza || ''), visitas_efectivas: String(meta?.meta_visitas_efectivas || '') }) }}
            className="ml-auto text-xs text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded">
            {editMeta ? 'Cancelar' : 'Editar'}
          </button>
        </div>
        {editMeta && (
          <div className="flex gap-2 mb-3 flex-wrap">
            <input type="number" placeholder="Meta USD" value={metaForm.monto} onChange={e => setMetaForm({ ...metaForm, monto: e.target.value })}
              className="flex-1 min-w-[100px] bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm" />
            <input type="number" placeholder="Meta visitas" value={metaForm.visitas} onChange={e => setMetaForm({ ...metaForm, visitas: e.target.value })}
              className="flex-1 min-w-[100px] bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm" />
            <input type="number" placeholder="Meta cobranza USD" value={metaForm.cobranza} onChange={e => setMetaForm({ ...metaForm, cobranza: e.target.value })}
              className="flex-1 min-w-[100px] bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm" />
            <input type="number" placeholder="Meta v. efectivas" value={metaForm.visitas_efectivas} onChange={e => setMetaForm({ ...metaForm, visitas_efectivas: e.target.value })}
              className="flex-1 min-w-[100px] bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm" />
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
            {meta.meta_visitas_efectivas > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Visitas efectivas del mes</span>
                  <span className="text-orange-400">{mes.visitas_efectivas} / {meta.meta_visitas_efectivas}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full transition-all"
                    style={{ width: `${Math.min(mes.visitas_efectivas / meta.meta_visitas_efectivas * 100, 100)}%` }} />
                </div>
              </div>
            )}
            {meta.meta_cobranza > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Cobranza del mes</span>
                  <span className="text-green-400">${mes.cobranza.toFixed(0)} / ${meta.meta_cobranza}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-600 rounded-full transition-all"
                    style={{ width: `${Math.min(mes.cobranza / meta.meta_cobranza * 100, 100)}%` }} />
                </div>
              </div>
            )}
            {meta.meta_visitas > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Visitas del mes</span>
                  <span className="text-blue-400">{mes.visitas} / {meta.meta_visitas}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(mes.visitas / meta.meta_visitas * 100, 100)}%` }} />
                </div>
                {noVisitados.length > 0 && (
                  <div className="mt-1.5">
                    <button onClick={() => setShowNoVisitados(v => !v)}
                      className="text-xs text-slate-500 hover:text-blue-400 transition-colors">
                      {showNoVisitados ? '▲ ocultar' : `▼ ${noVisitados.length} cliente${noVisitados.length !== 1 ? 's' : ''} sin visitar este mes`}
                    </button>
                    {showNoVisitados && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {noVisitados.map((nombre, i) => (
                          <span key={i} className="text-xs bg-blue-900/30 text-blue-300 border border-blue-800/50 rounded-full px-2.5 py-0.5">
                            {nombre}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Configura una meta mensual para ver el progreso.</p>
        )}
      </div>

      {/* Metas variables del supervisor */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-semibold">Metas del supervisor ({mesActual})</h2>
          <button onClick={() => setAddingVar(v => !v)}
            className="ml-auto text-xs text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded">
            {addingVar ? 'Cancelar' : '+ Agregar'}
          </button>
        </div>

        {addingVar && (
          <div className="flex gap-2 mb-3 flex-wrap">
            <input type="text" placeholder="Nombre de la meta" value={varForm.nombre}
              onChange={e => setVarForm({ ...varForm, nombre: e.target.value })}
              className="flex-1 min-w-[140px] bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm" />
            <select value={varForm.tipo} onChange={e => setVarForm({ ...varForm, tipo: e.target.value })}
              className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm">
              <option value="captaciones">Captaciones</option>
              <option value="producto_porcentaje">Producto (%)</option>
            </select>
            <input type="number" placeholder="Meta" value={varForm.meta_valor}
              onChange={e => setVarForm({ ...varForm, meta_valor: e.target.value })}
              className="w-20 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm" />
            {varForm.tipo === 'producto_porcentaje' && (
              <input type="text" placeholder="Keyword producto (ej: ketchup 200)" value={varForm.producto_keyword}
                onChange={e => setVarForm({ ...varForm, producto_keyword: e.target.value })}
                className="flex-1 min-w-[180px] bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm" />
            )}
            <button onClick={guardarMetaVar} className="bg-violet-600 text-white px-3 py-1.5 rounded text-sm">OK</button>
          </div>
        )}

        {metasVar.length === 0 && !addingVar
          ? <p className="text-slate-400 text-sm">No hay metas del supervisor para este mes.</p>
          : <div className="space-y-3">
              {metasVar.map((m: any) => {
                const esPct = m.tipo === 'producto_porcentaje'
                const esCartera = m.tipo === 'producto_cartera'
                const pctBarra = (esPct || esCartera)
                  ? Math.min(m.actual, 100)
                  : Math.min(m.actual / m.meta_valor * 100, 100)
                return (
                  <div key={m.id}>
                    <div className="flex justify-between text-sm mb-1 gap-2">
                      <span className="flex items-center gap-1.5">
                        {m.nombre}
                        <button onClick={() => eliminarMetaVar(m.id)} className="text-slate-600 hover:text-red-400 text-xs leading-none">✕</button>
                      </span>
                      <span className="text-violet-400 text-xs shrink-0">
                        {esPct
                          ? `${m.conProducto} / ${Math.round(m.base * m.meta_valor / 100)} cl. (meta ${m.meta_valor}% de ${m.base})`
                          : esCartera
                          ? `${m.conProducto} / ${m.base} cl. (${m.actual}%)`
                          : `${m.actual} / ${m.meta_valor}`}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full transition-all"
                        style={{ width: `${pctBarra}%` }} />
                    </div>
                    {(esPct || esCartera) && m.clientesLista?.length > 0 && (
                      <div className="mt-1">
                        <button onClick={() => setExpandedMeta(expandedMeta === m.id ? null : m.id)}
                          className="text-xs text-slate-500 hover:text-violet-400 transition-colors">
                          {expandedMeta === m.id ? '▲ ocultar clientes' : `▼ ver ${m.clientesLista.length} cliente${m.clientesLista.length !== 1 ? 's' : ''}`}
                        </button>
                        {expandedMeta === m.id && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {m.clientesLista.map((nombre: string, i: number) => (
                              <span key={i} className="text-xs bg-violet-900/30 text-violet-300 border border-violet-800/50 rounded-full px-2.5 py-0.5">
                                {nombre}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
        }
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
