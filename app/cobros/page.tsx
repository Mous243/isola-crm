'use client'
import { useEffect, useState } from 'react'
import { supabase, type Cobro, type Cliente } from '@/lib/supabase'

const DIAS_CREDITO = 10
const DIAS_LIMITE = 21 // tope de antigüedad que se controla para el cierre de mes
function hoy() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' }) }
function sumarDias(fechaStr: string, dias: number) {
  const d = new Date(fechaStr + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}
// último día del mes en curso (hora Venezuela)
function finDeMes() {
  const [a, m] = hoy().split('-').map(Number)
  return new Date(a, m, 0).toLocaleDateString('en-CA')
}
function diasEntre(desde: string, hasta: string) {
  return Math.round((new Date(hasta + 'T00:00:00').getTime() - new Date(desde + 'T00:00:00').getTime()) / 864e5)
}

export default function Cobros() {
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtroEstado, setFiltroEstado] = useState('pendiente')
  const [tab, setTab] = useState<'lista' | 'nuevo' | 'cierre'>('lista')
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
  const [entregaCobro, setEntregaCobro] = useState<Cobro | null>(null)
  const [fechaEntregaInput, setFechaEntregaInput] = useState(hoy())
  const [guardandoEntrega, setGuardandoEntrega] = useState(false)
  const [pagoModal, setPagoModal] = useState<Cobro | null>(null)
  const [fechaPagoInput, setFechaPagoInput] = useState(hoy())
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [mostrarCxcAntiguos, setMostrarCxcAntiguos] = useState(false)

  const cargar = async () => {
    const q = supabase.from('cobros').select('*, clientes(nombre_negocio, propietario, telefono, codigo_cliente)').order('fecha_vencimiento')
    if (filtroEstado !== 'todos') q.eq('estado', filtroEstado)
    const { data } = await q
    setCobros(data || [])
  }
  useEffect(() => { cargar() }, [filtroEstado])

  // ── Cierre de mes: solo lo que sigue debiendo (al marcar pagado desaparece) ──
  const [cierre, setCierre] = useState<Cobro[]>([])
  const [cargandoCierre, setCargandoCierre] = useState(false)
  const cargarCierre = async () => {
    setCargandoCierre(true)
    const { data } = await supabase.from('cobros')
      .select('*, clientes(nombre_negocio, propietario, telefono, zona, codigo_cliente)')
      .in('estado', ['pendiente', 'parcial'])
      .order('fecha_emision')
    setCierre(data || [])
    setCargandoCierre(false)
  }
  useEffect(() => { if (tab === 'cierre') cargarCierre() }, [tab])
  useEffect(() => {
    supabase.from('clientes').select('id, nombre_negocio').in('status', ['activo', 'nuevo']).order('nombre_negocio')
      .then(({ data }) => {
        setClientes(data || [])
        if (data && data.length) setForm(f => ({ ...f, cliente_id: String(data[0].id) }))
      })
  }, [])

  const marcar = async (id: number, estado: string) => {
    await supabase.from('cobros').update({ estado }).eq('id', id)
    setCobros(prev => prev.map(c => c.id === id ? { ...c, estado } : c))
  }

  const confirmarPago = async () => {
    if (!pagoModal) return
    setGuardandoPago(true)
    await supabase.from('cobros').update({ estado: 'pagado', fecha_pago: fechaPagoInput }).eq('id', pagoModal.id)
    setCobros(prev => prev.map(c => c.id === pagoModal.id ? { ...c, estado: 'pagado', fecha_pago: fechaPagoInput } as any : c))
    setCierre(prev => prev.filter(c => c.id !== pagoModal.id)) // sale del cierre de mes al cobrarse
    setGuardandoPago(false)
    setPagoModal(null)
  }

  const confirmarEntrega = async () => {
    if (!entregaCobro) return
    setGuardandoEntrega(true)
    const venc = sumarDias(fechaEntregaInput, DIAS_CREDITO)
    await supabase.from('cobros').update({ fecha_entrega: fechaEntregaInput, fecha_vencimiento: venc }).eq('id', entregaCobro.id)
    setCobros(prev => prev.map(c => c.id === entregaCobro.id ? { ...c, fecha_entrega: fechaEntregaInput, fecha_vencimiento: venc } : c))
    setGuardandoEntrega(false)
    setEntregaCobro(null)
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

  const totalPendiente = cobros.filter(c => c.estado === 'pendiente' && c.origen !== 'isola_cxc').reduce((a, c) => a + c.monto, 0)
  const totalIsolaCxc = cobros.filter(c => (c.estado === 'pendiente' || c.estado === 'parcial') && c.origen === 'isola_cxc').reduce((a, c) => a + c.monto, 0)

  const esCxcAntiguo = (c: Cobro) => c.origen === 'isola_cxc' && c.estado === 'pendiente' && c.fecha_vencimiento < hoy()
  const cxcAntiguosCount = cobros.filter(esCxcAntiguo).length

  const cobrosFiltrados = cobros.filter(c => {
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      const cl = c.clientes as any
      return cl?.nombre_negocio?.toLowerCase().includes(q)
        || cl?.propietario?.toLowerCase().includes(q)
        || cl?.codigo_cliente?.toLowerCase().includes(q)
        || (c.descripcion || '').toLowerCase().includes(q)
    }
    if (!mostrarCxcAntiguos && esCxcAntiguo(c)) return false
    return true
  })

  const diasColor = (venc: string) => {
    const d = Math.ceil((new Date(venc).getTime() - Date.now()) / 864e5)
    if (d < 0) return 'text-red-400'
    if (d <= 3) return 'text-yellow-400'
    return 'text-green-400'
  }

  const waMsg = (c: Cobro) => {
    const cl = c.clientes as any
    const negocio = cl?.nombre_negocio || ''
    const saludo = cl?.propietario ? `${cl.propietario} (${negocio})` : negocio
    const dias = Math.ceil((new Date(c.fecha_vencimiento).getTime() - Date.now()) / 864e5)
    const cuando = dias <= 0
      ? `Venció: ${c.fecha_vencimiento} (hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'})`
      : `Vence: ${c.fecha_vencimiento} (en ${dias} día${dias === 1 ? '' : 's'})`
    const msg = `Hola ${saludo} 👋\n\nLe recordamos que tiene una factura pendiente:\n\n💵 Monto: ${c.moneda} ${c.monto.toFixed(2)}\n📅 ${cuando}\n\n¿Podemos coordinar el pago? Quedamos atentos.\n\nSaludos,\nDaniel Guaramato — ISOLA Foods`
      .replace(/&/g, 'y') // el "&" literal corta el link al abrirlo en algunas apps
    return `https://wa.me/${(cl?.telefono || '').replace('+', '')}?text=${encodeURIComponent(msg)}`
  }

  // ── Agrupación para el cierre de mes ────────────────────────────────────────
  const HOY = hoy(), FIN = finDeMes()
  const baseFecha = (c: Cobro) => c.fecha_emision || c.fecha_vencimiento
  type Fila = { clienteId: number; nombre: string; telefono: string; zona: string; total: number; diasHoy: number; diasFin: number; docs: Cobro[] }

  const agrupar = (lista: Cobro[]): Fila[] => {
    const m = new Map<number, Fila>()
    for (const c of lista) {
      const cl = c.clientes as any
      const f: Fila = m.get(c.cliente_id) || {
        clienteId: c.cliente_id, nombre: cl?.nombre_negocio || '?', telefono: cl?.telefono || '',
        zona: cl?.zona || '', total: 0, diasHoy: 0, diasFin: 0, docs: [],
      }
      f.total += c.monto
      f.diasHoy = Math.max(f.diasHoy, diasEntre(baseFecha(c), HOY))
      f.diasFin = Math.max(f.diasFin, diasEntre(baseFecha(c), FIN))
      f.docs.push(c)
      m.set(c.cliente_id, f)
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }

  const grupoA = agrupar(cierre.filter(c => diasEntre(baseFecha(c), HOY) > DIAS_LIMITE))
  const grupoB = agrupar(cierre.filter(c => {
    const dh = diasEntre(baseFecha(c), HOY)
    return dh <= DIAS_LIMITE && diasEntre(baseFecha(c), FIN) >= DIAS_LIMITE
  }))
  const totA = grupoA.reduce((a, f) => a + f.total, 0)
  const totB = grupoB.reduce((a, f) => a + f.total, 0)
  const diasAlCierre = diasEntre(HOY, FIN)

  const cobradoDelMes = cobros.filter(c => c.estado === 'pagado' && (c.fecha_pago || '').slice(0, 7) === HOY.slice(0, 7))
  const totalCobradoMes = cobradoDelMes.reduce((a, c) => a + c.monto, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-violet-400">Cobros</h1>
        <button onClick={() => setTab(tab === 'cierre' ? 'lista' : 'cierre')}
          className={`ml-auto px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'cierre'
            ? 'bg-amber-500 text-slate-950'
            : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/40'}`}>
          {tab === 'cierre' ? '← Lista' : '📅 Cierre de mes'}
        </button>
        <button onClick={() => setTab(tab === 'nuevo' ? 'lista' : 'nuevo')}
          className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-sm">
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

      {tab === 'cierre' && <>
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-1">
          <p className="text-sm text-slate-300">
            Corte: <b className="text-white">{FIN.split('-').reverse().join('/')}</b>
            <span className="text-slate-500"> · faltan {diasAlCierre} día{diasAlCierre === 1 ? '' : 's'}</span>
          </p>
          <p className="text-xs text-slate-500">
            Antigüedad contada desde la emisión de cada factura. Al marcar una como pagada sale de esta lista.
          </p>
          <div className="flex gap-2 flex-wrap pt-2">
            <div className="bg-red-950/60 border border-red-500/40 rounded-lg px-3 py-1.5">
              <span className="text-xs text-red-300">Ya pasan de {DIAS_LIMITE}d: </span>
              <span className="text-red-400 font-bold">${totA.toFixed(2)}</span>
              <span className="text-xs text-slate-500"> ({grupoA.length})</span>
            </div>
            <div className="bg-amber-950/60 border border-amber-500/40 rounded-lg px-3 py-1.5">
              <span className="text-xs text-amber-300">Llegan a {DIAS_LIMITE}d: </span>
              <span className="text-amber-400 font-bold">${totB.toFixed(2)}</span>
              <span className="text-xs text-slate-500"> ({grupoB.length})</span>
            </div>
            <div className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5">
              <span className="text-xs text-slate-400">Total en riesgo: </span>
              <span className="text-white font-bold">${(totA + totB).toFixed(2)}</span>
            </div>
            {totalCobradoMes > 0 && (
              <div className="bg-green-950/60 border border-green-500/40 rounded-lg px-3 py-1.5">
                <span className="text-xs text-green-300">Cobrado este mes: </span>
                <span className="text-green-400 font-bold">${totalCobradoMes.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {cargandoCierre && <p className="text-sm text-slate-500">Calculando…</p>}

        {[
          { titulo: `🔴 GRUPO A — ya pasan de ${DIAS_LIMITE} días`, filas: grupoA, total: totA,
            nota: 'Deuda que ya está fuera de plazo.', color: 'red' },
          { titulo: `🟠 GRUPO B — llegan a ${DIAS_LIMITE} días el ${FIN.split('-').reverse().slice(0, 2).join('/')}`, filas: grupoB, total: totB,
            nota: 'Todavía se salvan: si cobras antes del cierre, no cruzan el límite.', color: 'amber' },
        ].map(g => (
          <div key={g.titulo} className="space-y-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className={`text-sm font-bold ${g.color === 'red' ? 'text-red-400' : 'text-amber-400'}`}>{g.titulo}</h2>
              <span className="text-xs text-slate-500">{g.filas.length} clientes · ${g.total.toFixed(2)}</span>
            </div>
            <p className="text-xs text-slate-500">{g.nota}</p>
            {!g.filas.length && !cargandoCierre && (
              <p className="text-sm text-green-400 bg-green-950/40 border border-green-500/30 rounded-lg px-3 py-2">
                Nada aquí ✓
              </p>
            )}
            {g.filas.map(f => (
              <div key={f.clienteId}
                className={`bg-slate-900 border-y border-r border-slate-800 border-l-4 rounded-xl p-3 ${
                  g.color === 'red' ? 'border-l-red-500' : 'border-l-amber-500'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{f.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {f.zona || 'sin zona'} · {f.docs.length} factura{f.docs.length === 1 ? '' : 's'}
                      {' · '}
                      {g.color === 'red'
                        ? <span className="text-red-400">{f.diasHoy}d vencido</span>
                        : <span className="text-amber-400">hoy {f.diasHoy}d → {f.diasFin}d al cierre</span>}
                    </p>
                  </div>
                  <p className="text-lg font-bold whitespace-nowrap">${f.total.toFixed(2)}</p>
                </div>

                <div className="mt-2 space-y-1">
                  {f.docs.map(d => (
                    <div key={d.id} className="flex items-center gap-2 text-xs bg-slate-950/60 rounded-lg px-2 py-1.5">
                      <span className="text-slate-500 font-mono">{d.nro_documento_isola || d.descripcion || '—'}</span>
                      <span className="text-slate-600">{baseFecha(d)}</span>
                      <span className="ml-auto text-slate-300">${d.monto.toFixed(2)}</span>
                      {d.estado === 'parcial' && <span className="text-yellow-400">parcial</span>}
                      <button onClick={() => { setPagoModal(d); setFechaPagoInput(hoy()) }}
                        className="bg-green-600 hover:bg-green-500 text-white px-2 py-0.5 rounded font-medium">
                        ✓ Pagado
                      </button>
                    </div>
                  ))}
                </div>

                {f.telefono && (
                  <a href={waMsg(f.docs[0])} target="_blank" rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg">
                    📱 WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        ))}
      </>}

      {tab === 'lista' && <>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm">
            {['pendiente', 'parcial', 'pagado', 'cancelado', 'todos'].map(e => <option key={e}>{e}</option>)}
          </select>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar por cliente, dueño o N° factura..."
            className="flex-1 min-w-[200px] bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm" />
          {filtroEstado !== 'pagado' && (
            <div className="flex gap-2 flex-wrap">
              <div className="bg-slate-900 rounded-lg px-3 py-1.5 border border-slate-800">
                <span className="text-xs text-slate-400">Mi cartera: </span>
                <span className="text-violet-400 font-medium">${totalPendiente.toFixed(2)}</span>
              </div>
              {totalIsolaCxc > 0 && (
                <div className="bg-slate-900 rounded-lg px-3 py-1.5 border border-slate-700">
                  <span className="text-xs text-slate-500">📋 ISOLA CXC: </span>
                  <span className="text-slate-400 font-medium">${totalIsolaCxc.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {cxcAntiguosCount > 0 && (
          <button onClick={() => setMostrarCxcAntiguos(v => !v)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            {mostrarCxcAntiguos ? '▲ ocultar antiguos ISOLA CXC' : `👁 ver ${cxcAntiguosCount} cobro${cxcAntiguosCount > 1 ? 's' : ''} ISOLA CXC antiguos sin gestión`}
          </button>
        )}

        <div className="space-y-2">
          {cobrosFiltrados.map(c => {
            const cl = c.clientes as any
            const dias = Math.ceil((new Date(c.fecha_vencimiento).getTime() - Date.now()) / 864e5)
            return (
              <div key={c.id} onClick={() => abrirDetalle(c)}
                className={`border-y border-r rounded-xl p-4 cursor-pointer transition-colors border-l-4 ${
                  c.estado === 'pagado' ? 'bg-green-950/60 border-slate-800 border-l-green-400' :
                  c.estado === 'parcial' ? 'bg-yellow-950/60 border-slate-800 border-l-yellow-400' :
                  c.estado === 'cancelado' ? 'bg-red-950/60 border-slate-800 border-l-red-500' :
                  'bg-slate-900 border-slate-800 border-l-slate-700 hover:border-l-slate-500'
                }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{cl?.nombre_negocio}</p>
                      {c.origen === 'isola_cxc' && (
                        <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded font-mono">📋 ISOLA</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{cl?.propietario || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-violet-400">{c.moneda} {c.monto.toFixed(2)}</p>
                    <p className={`text-xs font-semibold ${diasColor(c.fecha_vencimiento)}`}>
                      {dias < 0 ? `⚠ ${Math.abs(dias)}d vencido` : dias === 0 ? 'Vence hoy' : `Vence en ${dias}d`}
                    </p>
                  </div>
                </div>
                {c.descripcion && <p className="text-xs text-slate-500 mt-1">{c.descripcion}</p>}
                <div className="flex gap-2 mt-3 flex-wrap items-center" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => { if (c.estado !== 'pagado') { setPagoModal(c); setFechaPagoInput(hoy()) } }}
                    className={c.estado === 'pagado'
                      ? 'bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium'
                      : 'bg-green-800/50 hover:bg-green-700/50 text-green-400 px-3 py-1 rounded-lg text-xs'}>
                    ✅ Pagado
                  </button>
                  <button
                    onClick={() => { if (c.estado !== 'pagado' && c.estado !== 'parcial') marcar(c.id, 'parcial') }}
                    className={c.estado === 'parcial'
                      ? 'bg-yellow-500 text-white px-3 py-1 rounded-lg text-xs font-medium'
                      : 'bg-yellow-800/50 hover:bg-yellow-700/50 text-yellow-400 px-3 py-1 rounded-lg text-xs'}>
                    ⚡ Parcial
                  </button>
                  <button
                    onClick={() => { if (c.estado !== 'pagado' && c.estado !== 'cancelado') marcar(c.id, 'cancelado') }}
                    className={c.estado === 'cancelado'
                      ? 'bg-red-700 text-white px-3 py-1 rounded-lg text-xs font-medium'
                      : 'bg-red-900/30 hover:bg-red-900/50 text-red-400 px-3 py-1 rounded-lg text-xs'}>
                    ❌ Cancelar
                  </button>
                  {c.fecha_entrega ? (
                    <span className="bg-blue-900/30 text-blue-400 px-3 py-1 rounded-lg text-xs">
                      📦 Entregado {c.fecha_entrega}
                    </span>
                  ) : (
                    <button onClick={() => { setEntregaCobro(c); setFechaEntregaInput(hoy()) }}
                      className="bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 px-3 py-1 rounded-lg text-xs">
                      📦 Entregado
                    </button>
                  )}
                  {cl?.telefono && c.estado !== 'pagado' && (
                    <a href={waMsg(c)} target="_blank" rel="noreferrer"
                      className={dias <= 3
                        ? 'bg-orange-600/80 hover:bg-orange-600 text-white px-3 py-1 rounded-lg text-xs font-medium animate-pulse'
                        : 'bg-green-800/50 hover:bg-green-700/50 text-green-400 px-3 py-1 rounded-lg text-xs'}>
                      {dias <= 3 ? '📱 Recordar ahora' : '📱 WhatsApp'}
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
                {cobroDetalle.nro_documento_isola && (
                  <div className="flex justify-between"><span className="text-slate-400">N° documento ISOLA</span><span className="font-mono text-slate-300">{cobroDetalle.nro_documento_isola}</span></div>
                )}
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
                    {['pendiente', 'parcial', 'pagado', 'cancelado'].map(e => <option key={e}>{e}</option>)}
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

      {pagoModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setPagoModal(null)}>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold">✅ Confirmar pago — {(pagoModal.clientes as any)?.nombre_negocio}</h2>
            <p className="text-sm text-slate-400">{pagoModal.moneda} {pagoModal.monto.toFixed(2)}</p>
            <label className="block">
              <span className="text-xs text-slate-400">Fecha real del pago</span>
              <input type="date" value={fechaPagoInput} onChange={e => setFechaPagoInput(e.target.value)}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setPagoModal(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg text-sm">Cancelar</button>
              <button onClick={confirmarPago} disabled={guardandoPago}
                className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                {guardandoPago ? 'Guardando...' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {entregaCobro && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEntregaCobro(null)}>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold">📦 Confirmar entrega — {(entregaCobro.clientes as any)?.nombre_negocio}</h2>
            <label className="block">
              <span className="text-xs text-slate-400">Fecha real de entrega de la mercancía</span>
              <input type="date" value={fechaEntregaInput} onChange={e => setFechaEntregaInput(e.target.value)}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </label>
            <p className="text-xs text-slate-400">
              El crédito ({DIAS_CREDITO} días) empieza a contar desde esta fecha · Nuevo vencimiento: <span className="text-violet-400 font-medium">{sumarDias(fechaEntregaInput, DIAS_CREDITO)}</span>
            </p>
            <div className="flex gap-2">
              <button onClick={() => setEntregaCobro(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg text-sm">Cancelar</button>
              <button onClick={confirmarEntrega} disabled={guardandoEntrega}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                {guardandoEntrega ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
