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
  const [busqueda, setBusqueda] = useState('')
  const [cobroDetalle, setCobroDetalle] = useState<Cobro | null>(null)
  const [editando, setEditando] = useState(false)
  const [editForm, setEditForm] = useState({ monto: '', moneda: 'USD', descripcion: '', fecha_emision: '', fecha_vencimiento: '', estado: 'pendiente' })
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

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

  const abrirDetalle = (c: Cobro) => {
    setCobroDetalle(c)
    setEditando(false)
    setEditForm({
      monto: String(c.monto), moneda: c.moneda || 'USD', descripcion: c.descripcion || '',
      fecha_emision: c.fecha_emision || '', fecha_vencimiento: c.fecha_vencimiento,
      estado: c.estado || 'pendiente',
    })
  }

  const guardarEdicion = async () => {
    if (!cobroDetalle) return
    setGuardandoEdicion(true)
    await supabase.from('cobros').update({
      monto: +editForm.monto, moneda: editForm.moneda, descripcion: editForm.descripcion,
      fecha_emision: editForm.fecha_emision || null, fecha_vencimiento: editForm.fecha_vencimiento,
      estado: editForm.estado,
    }).eq('id', cobroDetalle.id)
    setGuardandoEdicion(false)
    setCobroDetalle(null)
    setEditando(false)
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

  const cobrosFiltrados = cobros.filter(c => {
    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase()
    const cl = c.clientes as any
    return cl?.nombre_negocio?.toLowerCase().includes(q)
      || cl?.propietario?.toLowerCase().includes(q)
      || (c.descripcion || '').toLowerCase().includes(q)
  })

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
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm">
            {['pendiente', 'parcial', 'pagado', 'todos'].map(e => <option key={e}>{e}</option>)}
          </select>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar por cliente, dueño o N° factura..."
            className="flex-1 min-w-[200px] bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm" />
          {filtroEstado !== 'pagado' && (
            <div className="bg-slate-900 rounded-lg px-3 py-1.5 border border-slate-800">
              <span className="text-xs text-slate-400">Total pendiente: </span>
              <span className="text-violet-400 font-medium">${totalPendiente.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {cobrosFiltrados.map(c => {
            const cl = c.clientes as any
            const dias = Math.ceil((new Date(c.fecha_vencimiento).getTime() - Date.now()) / 864e5)
            return (
              <div key={c.id} onClick={() => abrirDetalle(c)}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 cursor-pointer transition-colors">
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
                <div className="flex gap-2 mt-3 flex-wrap" onClick={e => e.stopPropagation()}>
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
          {cobrosFiltrados.length === 0 && <p className="text-slate-400 text-center py-8">Sin cobros {busqueda ? 'que coincidan' : filtroEstado}</p>}
        </div>
      </>}

      {cobroDetalle && (
        <div onClick={() => { setCobroDetalle(null); setEditando(false) }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{editando ? 'Editar cobro' : 'Detalle del cobro'}</h3>
              <button onClick={() => { setCobroDetalle(null); setEditando(false) }} className="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button>
            </div>

            <div>
              <p className="font-medium">{(cobroDetalle.clientes as any)?.nombre_negocio}</p>
              <p className="text-xs text-slate-400">{(cobroDetalle.clientes as any)?.propietario || '—'} · {(cobroDetalle.clientes as any)?.telefono || 'sin teléfono'}</p>
            </div>

            {!editando ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Monto</span><span className="font-medium text-violet-400">{cobroDetalle.moneda} {cobroDetalle.monto.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">N° factura / descripción</span><span className="font-mono">{cobroDetalle.descripcion || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Emisión</span><span>{cobroDetalle.fecha_emision || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Vencimiento</span><span className={diasColor(cobroDetalle.fecha_vencimiento)}>{cobroDetalle.fecha_vencimiento}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Estado</span><span className="capitalize">{cobroDetalle.estado}</span></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="text-xs text-slate-400">Monto</span>
                    <input type="number" value={editForm.monto} onChange={e => setEditForm({ ...editForm, monto: e.target.value })}
                      className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
                  </label>
                  <label>
                    <span className="text-xs text-slate-400">Moneda</span>
                    <select value={editForm.moneda} onChange={e => setEditForm({ ...editForm, moneda: e.target.value })}
                      className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                      <option>USD</option><option>Bs</option>
                    </select>
                  </label>
                  <label>
                    <span className="text-xs text-slate-400">Emisión</span>
                    <input type="date" value={editForm.fecha_emision} onChange={e => setEditForm({ ...editForm, fecha_emision: e.target.value })}
                      className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
                  </label>
                  <label>
                    <span className="text-xs text-slate-400">Vencimiento</span>
                    <input type="date" value={editForm.fecha_vencimiento} onChange={e => setEditForm({ ...editForm, fecha_vencimiento: e.target.value })}
                      className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs text-slate-400">N° factura / descripción</span>
                  <input value={editForm.descripcion} onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-400">Estado</span>
                  <select value={editForm.estado} onChange={e => setEditForm({ ...editForm, estado: e.target.value })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                    {['pendiente', 'parcial', 'pagado'].map(e => <option key={e}>{e}</option>)}
                  </select>
                </label>
              </div>
            )}

            <div className="flex gap-2">
              {editando ? (
                <>
                  <button onClick={() => setEditando(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm">Cancelar</button>
                  <button onClick={guardarEdicion} disabled={guardandoEdicion}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                    {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </>
              ) : (
                <button onClick={() => setEditando(true)} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white py-2 rounded-lg text-sm font-medium">
                  ✏️ Editar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
