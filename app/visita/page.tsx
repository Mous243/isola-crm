'use client'
import { useEffect, useState } from 'react'
import { supabase, type Cliente, type Producto } from '@/lib/supabase'

type LineaPedido = { nombre: string; cajas: number; precio_caja: number; subtotal: number }

export default function RegistrarVisita() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [catSel, setCatSel] = useState('Todas')
  const [prodsSel, setProdsSel] = useState<string[]>([])
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [form, setForm] = useState({
    cliente_id: '',
    fecha: new Date().toISOString().split('T')[0],
    hora_llegada: new Date().toTimeString().slice(0, 5),
    hora_salida: new Date().toTimeString().slice(0, 5),
    resultado: 'pedido',
    moneda: 'USD',
    monto_manual: 0,
    notas_visita: '',
  })
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    supabase.from('clientes').select('id, nombre_negocio, zona').in('status', ['activo', 'nuevo']).order('nombre_negocio')
      .then(({ data }) => {
        setClientes(data || [])
        if (data && data.length > 0) setForm(f => ({ ...f, cliente_id: String(data[0].id) }))
      })
    supabase.from('productos').select('*').eq('activo', true).order('categoria').order('nombre')
      .then(({ data }) => {
        setProductos(data || [])
        const cats = [...new Set((data || []).map((p: Producto) => p.categoria))]
        setCategorias(cats)
      })
  }, [])

  const prodsFiltrados = catSel === 'Todas' ? productos : productos.filter(p => p.categoria === catSel)

  const toggleProd = (nombre: string) => {
    setProdsSel(prev => prev.includes(nombre) ? prev.filter(x => x !== nombre) : [...prev, nombre])
    setCantidades(prev => ({ ...prev, [nombre]: prev[nombre] || 1 }))
  }

  const lineas: LineaPedido[] = prodsSel.map(nombre => {
    const p = productos.find(x => x.nombre === nombre)!
    const cajas = cantidades[nombre] || 1
    return { nombre, cajas, precio_caja: p.precio_caja || 0, subtotal: cajas * (p.precio_caja || 0) }
  })
  const totalCalculado = lineas.reduce((a, l) => a + l.subtotal, 0)

  const guardar = async () => {
    if (!form.cliente_id) return alert('Selecciona un cliente')
    setSaving(true)
    await supabase.from('visitas').insert({
      cliente_id: +form.cliente_id,
      fecha: form.fecha,
      hora_llegada: form.hora_llegada,
      hora_salida: form.hora_salida,
      resultado: form.resultado,
      moneda: form.moneda,
      monto_pedido: form.monto_manual || totalCalculado,
      productos_pedidos: lineas.length > 0 ? lineas : [],
      notas_visita: form.notas_visita,
    })
    await supabase.from('clientes').update({ fecha_ultima_visita: form.fecha }).eq('id', +form.cliente_id)
    setSaving(false)
    setOk(true)
    setProdsSel([])
    setCantidades({})
    setForm(f => ({ ...f, notas_visita: '', monto_manual: 0, resultado: 'pedido' }))
    setTimeout(() => setOk(false), 3000)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-violet-400">Registrar Visita</h1>

      {ok && <div className="bg-green-900/40 border border-green-700/50 text-green-400 rounded-xl p-3 text-center font-medium">✅ Visita registrada correctamente</div>}

      {clientes.length === 0
        ? <p className="text-slate-400 bg-slate-900 rounded-xl p-4">Agrega clientes primero en la sección Clientes.</p>
        : <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-4">

            <label className="block">
              <span className="text-xs text-slate-400">Cliente *</span>
              <select value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_negocio} {c.zona ? `(${c.zona})` : ''}</option>)}
              </select>
            </label>

            <div className="grid grid-cols-3 gap-2">
              <label>
                <span className="text-xs text-slate-400">Fecha</span>
                <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm" />
              </label>
              <label>
                <span className="text-xs text-slate-400">Llegada</span>
                <input type="time" value={form.hora_llegada} onChange={e => setForm({ ...form, hora_llegada: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm" />
              </label>
              <label>
                <span className="text-xs text-slate-400">Salida</span>
                <input type="time" value={form.hora_salida} onChange={e => setForm({ ...form, hora_salida: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="text-xs text-slate-400">Resultado *</span>
                <select value={form.resultado} onChange={e => setForm({ ...form, resultado: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                  {['pedido', 'no_compro', 'no_estaba', 'cerrado', 'reprogramar'].map(r => <option key={r}>{r}</option>)}
                </select>
              </label>
              <label>
                <span className="text-xs text-slate-400">Moneda</span>
                <select value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                  <option>USD</option><option>Bs</option>
                </select>
              </label>
            </div>

            {/* Selector de productos */}
            {productos.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Productos pedidos (catálogo)</p>
                <div className="flex gap-2 overflow-x-auto pb-1 mb-2">
                  {['Todas', ...categorias].map(cat => (
                    <button key={cat} onClick={() => setCatSel(cat)}
                      className={`shrink-0 px-3 py-1 rounded-full text-xs ${catSel === cat ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-800/50 rounded-lg p-2">
                  {prodsFiltrados.map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input type="checkbox" checked={prodsSel.includes(p.nombre)} onChange={() => toggleProd(p.nombre)}
                        className="accent-violet-500" />
                      <span className="text-sm flex-1">{p.nombre}</span>
                      <span className="text-xs text-slate-400">${(p.precio_caja || 0).toFixed(2)}/caja</span>
                    </label>
                  ))}
                </div>

                {prodsSel.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-slate-400">Cantidades (cajas):</p>
                    {lineas.map(l => (
                      <div key={l.nombre} className="flex items-center gap-2">
                        <span className="text-xs flex-1 truncate">{l.nombre}</span>
                        <input type="number" min={1} max={99} value={l.cajas}
                          onChange={e => setCantidades(prev => ({ ...prev, [l.nombre]: +e.target.value }))}
                          className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-center" />
                        <span className="text-xs text-violet-400 w-16 text-right">${l.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 border-t border-slate-700 font-medium">
                      <span className="text-sm">Total calculado</span>
                      <span className="text-violet-400">${totalCalculado.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <label>
              <span className="text-xs text-slate-400">Monto total (USD) — editar si es diferente</span>
              <input type="number" step="0.01" min={0}
                value={form.monto_manual || totalCalculado}
                onChange={e => setForm({ ...form, monto_manual: +e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </label>

            <label>
              <span className="text-xs text-slate-400">Notas de la visita</span>
              <textarea value={form.notas_visita} onChange={e => setForm({ ...form, notas_visita: e.target.value })}
                rows={3} placeholder="Qué dijeron, qué necesitan, próxima visita..."
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </label>

            <button onClick={guardar} disabled={saving}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-3 rounded-lg font-medium">
              {saving ? 'Guardando...' : '✅ Registrar Visita'}
            </button>
          </div>
      }
    </div>
  )
}
