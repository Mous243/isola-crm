'use client'
import { useEffect, useState } from 'react'
import { supabase, type Cobro, type Cliente } from '@/lib/supabase'

export default function Cobros() {
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtroEstado, setFiltroEstado] = useState('pendiente')
  const [tab, setTab] = useState<'lista' | 'nuevo'>('lista')
  const [form, setForm] = useState({
    cliente_id: '', monto: '', moneda: 'USD', descripcion: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
  })
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState(false)

  const cargar = async () => {
    const q = supabase.from('cobros').select('*, clientes(nombre_negocio, propietario, telefono)').order('fecha_vencimiento')
    if (filtroEstado !== 'todos') q.eq('estado', filtroEstado)
    const { data } = await q
    setCobros(data || [])
  }
  useEffect(() => { cargar() }, [filtroEstado])
  useEffect(() => {
    supabase.from('clientes').select('id, nombre_negocio').in('status', ['activo', 'nuevo']).order('nombre_negocio')
      .then(({ data }) => {
        setClientes(data || [])
        if (data && data.length) setForm(f => ({ ...f, cliente_id: String(data[0].id) }))
      })
  }, [])

  const marcar = async (id: number, estado: string) => {
    await supabase.from('cobros').update({ estado }).eq('id', id)
    cargar()
  }

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este cobro?')) return
    await supabase.from('cobros').delete().eq('id', id)
    cargar()
  }

  const guardar = async () => {
    if (!form.cliente_id || !form.monto || !form.fecha_vencimiento) return alert('Faltan campos obligatorios')
    setSaving(true)
    await supabase.from('cobros').insert({
      cliente_id: +form.cliente_id, monto: +form.monto, moneda: form.moneda,
      descripcion: form.descripcion, fecha_emision: form.fecha_emision,
      fecha_vencimiento: form.fecha_vencimiento,
    })
    setSaving(false)
    setOk(true)
    setForm(f => ({ ...f, monto: '', descripcion: '', fecha_vencimiento: '' }))
    setTimeout(() => setOk(false), 2000)
    cargar()
    setTab('lista')
  }

  const totalPendiente = cobros.filter(c => c.estado === 'pendiente').reduce((a, c) => a + c.monto, 0)

  const diasColor = (venc: string) => {
    const d = Math.ceil((new Date(venc).getTime() - Date.now()) / 864e5)
    if (d < 0) return 'text-red-400'
    if (d <= 3) return 'text-yellow-400'
    return 'text-green-400'
  }

  const waMsg = (c: Cobro) => {
    const cl = c.clientes as any
    const nombre = cl?.propietario || cl?.nombre_negocio || ''
    const msg = `Hola ${nombre}, espero que estés bien 😊 Solo recordarte que la factura por ${c.moneda} ${c.monto.toFixed(2)} vence el ${c.fecha_vencimiento}. Cualquier consulta me avisas. — Daniel ISOLA`
    return `https://wa.me/${(cl?.telefono || '').replace('+', '')}?text=${encodeURIComponent(msg)}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-violet-400">Cobros</h1>
        <button onClick={() => setTab(tab === 'nuevo' ? 'lista' : 'nuevo')}
          className="ml-auto bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-sm">
          {tab === 'nuevo' ? '← Lista' : '+ Nuevo'}
        </button>
      </div>

      {tab === 'nuevo' && (
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-3">
          {ok && <p className="text-green-400 text-sm">Cobro registrado ✓</p>}
          <label className="block">
            <span className="text-xs text-slate-400">Cliente *</span>
            <select value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_negocio}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-xs text-slate-400">Monto *</span>
              <input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="text-xs text-slate-400">Moneda</span>
              <select value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                <option>USD</option><option>Bs</option>
              </select>
            </label>
            <label>
              <span className="text-xs text-slate-400">Emisión</span>
              <input type="date" value={form.fecha_emision} onChange={e => setForm({ ...form, fecha_emision: e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="text-xs text-slate-400">Vencimiento *</span>
              <input type="date" value={form.fecha_vencimiento} onChange={e => setForm({ ...form, fecha_vencimiento: e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </label>
          </div>
          <label>
            <span className="text-xs text-slate-400">Descripción / Nro. factura</span>
            <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </label>
          <button onClick={guardar} disabled={saving}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium">
            {saving ? 'Guardando...' : 'Registrar cobro'}
          </button>
        </div>
      )}

      {tab === 'lista' && <>
        <div className="flex items-center gap-3">
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm">
            {['pendiente', 'parcial', 'pagado', 'todos'].map(e => <option key={e}>{e}</option>)}
          </select>
          {filtroEstado !== 'pagado' && (
            <div className="bg-slate-900 rounded-lg px-3 py-1.5 border border-slate-800">
              <span className="text-xs text-slate-400">Total pendiente: </span>
              <span className="text-violet-400 font-medium">${totalPendiente.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {cobros.map(c => {
            const cl = c.clientes as any
            const dias = Math.ceil((new Date(c.fecha_vencimiento).getTime() - Date.now()) / 864e5)
            return (
              <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{cl?.nombre_negocio}</p>
                    <p className="text-xs text-slate-400">{cl?.propietario || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-violet-400">{c.moneda} {c.monto.toFixed(2)}</p>
                    <p className={`text-xs ${diasColor(c.fecha_vencimiento)}`}>
                      {dias < 0 ? `Vencido hace ${Math.abs(dias)}d` : dias === 0 ? 'Vence hoy' : `Vence en ${dias}d`}
                    </p>
                  </div>
                </div>
                {c.descripcion && <p className="text-xs text-slate-500 mt-1">{c.descripcion}</p>}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {c.estado !== 'pagado' && (
                    <button onClick={() => marcar(c.id, 'pagado')}
                      className="bg-green-800/50 hover:bg-green-700/50 text-green-400 px-3 py-1 rounded-lg text-xs">
                      ✅ Pagado
                    </button>
                  )}
                  {c.estado === 'pendiente' && (
                    <button onClick={() => marcar(c.id, 'parcial')}
                      className="bg-yellow-800/50 hover:bg-yellow-700/50 text-yellow-400 px-3 py-1 rounded-lg text-xs">
                      ⚡ Parcial
                    </button>
                  )}
                  {cl?.telefono && (
                    <a href={waMsg(c)} target="_blank" rel="noreferrer"
                      className="bg-green-800/50 hover:bg-green-700/50 text-green-400 px-3 py-1 rounded-lg text-xs">
                      📱 WhatsApp
                    </a>
                  )}
                  <button onClick={() => eliminar(c.id)}
                    className="bg-red-900/30 hover:bg-red-900/50 text-red-400 px-3 py-1 rounded-lg text-xs ml-auto">
                    🗑️
                  </button>
                </div>
              </div>
            )
          })}
          {cobros.length === 0 && <p className="text-slate-400 text-center py-8">Sin cobros {filtroEstado}</p>}
        </div>
      </>}
    </div>
  )
}
