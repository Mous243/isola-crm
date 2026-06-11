'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, type Cliente, type Producto, type Visita } from '@/lib/supabase'
import ClienteFichaModal from '@/components/ClienteFichaModal'

type LineaPedido = { nombre: string; codigo?: string; cajas: number; precio_caja: number; subtotal: number; imagen_url?: string }

function waConfirmacionPedido(cliente: Cliente, monto: number, moneda: string, lineas: LineaPedido[], nroFactura: string | null) {
  const nombre = cliente.propietario || cliente.nombre_negocio
  const detalle = lineas.length > 0 ? `: ${lineas.map(l => `${l.cajas} cj ${l.nombre}`).join(', ')}` : ''
  const factura = nroFactura ? ` (factura ${nroFactura})` : ''
  const msg = `Hola ${nombre}, te confirmo que tu pedido de hoy quedó registrado${detalle}, por un total de ${moneda} ${monto.toFixed(2)}${factura}. Lo estaremos despachando según lo acordado. ¡Gracias por seguir confiando en nosotros! 🙌 — Guaramato, ISOLA`
  return `https://wa.me/${(cliente.telefono || '').replace('+', '')}?text=${encodeURIComponent(msg)}`
}

const RESULTADO_LABEL: Record<string, string> = {
  visita_efectiva: 'Visita efectiva',
  cliente_con_stock: 'Con stock',
  encargado_no_encontrado: 'Encargado ausente',
  factura_pendiente: 'Factura pendiente',
  cliente_cerrado: 'Cerrado',
}
const RESULTADO_COLOR: Record<string, string> = {
  visita_efectiva: 'bg-green-900/40 text-green-400',
  cliente_con_stock: 'bg-yellow-900/40 text-yellow-400',
  encargado_no_encontrado: 'bg-orange-900/40 text-orange-400',
  factura_pendiente: 'bg-red-900/40 text-red-400',
  cliente_cerrado: 'bg-slate-800 text-slate-400',
}

const DIAS_ES: Record<number, string> = { 0: 'domingo', 1: 'lunes', 2: 'martes', 3: 'miercoles', 4: 'jueves', 5: 'viernes', 6: 'sabado' }

const RESULTADOS = [
  { value: 'visita_efectiva',        label: 'Visita efectiva',               color: 'bg-green-700/40 border-green-600 text-green-300' },
  { value: 'cliente_con_stock',      label: 'Cliente con stock de mercancía', color: 'bg-yellow-700/40 border-yellow-600 text-yellow-300' },
  { value: 'encargado_no_encontrado',label: 'Encargado no se encuentra',      color: 'bg-orange-700/40 border-orange-600 text-orange-300' },
  { value: 'factura_pendiente',      label: 'Cliente con factura pendiente',  color: 'bg-red-700/40 border-red-600 text-red-300' },
  { value: 'cliente_cerrado',        label: 'Cliente cerrado',                color: 'bg-slate-700/60 border-slate-500 text-slate-300' },
  { value: 'otro',                   label: 'Otro (escribir)',                color: 'bg-violet-700/40 border-violet-600 text-violet-300' },
]

export default function RegistrarVisita() {
  const searchParams = useSearchParams()
  const preClienteId = searchParams.get('cliente_id') || ''
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [mostrarLista, setMostrarLista] = useState(false)
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [catSel, setCatSel] = useState('Todas')
  const [busquedaProd, setBusquedaProd] = useState('')
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [form, setForm] = useState({
    cliente_id: '',
    fecha: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })(),
    resultado: 'visita_efectiva',
    resultado_otro: '',
    moneda: 'USD',
    monto_manual: 0,
    notas_visita: '',
    dias_credito: 21,
    nro_factura: '',
  })
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState(false)
  const [visitasHoy, setVisitasHoy] = useState(0)
  const [proximaFactura, setProximaFactura] = useState('')
  const [cobrosCliente, setCobrosCliente] = useState<{ id: number; monto: number; moneda: string; estado: string; descripcion: string | null; fecha_vencimiento: string }[]>([])
  const [siguienteCliente, setSiguienteCliente] = useState<Cliente | null>(null)
  const [confirmacionWA, setConfirmacionWA] = useState<{ telefono: string; link: string } | null>(null)
  const [visitadosIds, setVisitadosIds] = useState<Set<number>>(new Set())
  const [montoHoy, setMontoHoy] = useState(0)
  const [mostrarRuta, setMostrarRuta] = useState(false)
  const [productosFrecuentes, setProductosFrecuentes] = useState<{ nombre: string; codigo?: string; veces: number }[]>([])
  const [tab, setTab] = useState<'registrar' | 'historial'>('registrar')
  const [historial, setHistorial] = useState<(Visita & { clientes?: { nombre_negocio: string; codigo_cliente?: string } })[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [filtroFechaH, setFiltroFechaH] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })
  const [expandidoH, setExpandidoH] = useState<number | null>(null)
  const [editVisita, setEditVisita] = useState<Visita | null>(null)
  const [editForm, setEditForm] = useState({ resultado: '', resultado_otro: '', monto_pedido: 0, notas_visita: '', dias_credito: 21, nro_factura: '' })
  const [editCantidades, setEditCantidades] = useState<Record<string, number>>({})
  const [editCatSel, setEditCatSel] = useState('Todas')
  const [editBusquedaProd, setEditBusquedaProd] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [mostrarFicha, setMostrarFicha] = useState(false)

  const diaHoy = DIAS_ES[new Date().getDay()]

  const diaDefecha = (fecha: string) => {
    const [y, m, d] = fecha.split('-').map(Number)
    return DIAS_ES[new Date(y, m - 1, d).getDay()]
  }

  const diaActual = diaDefecha(form.fecha)

  useEffect(() => {
    supabase.from('productos').select('*').order('categoria').order('nombre')
      .then(({ data }) => {
        setProductos(data || [])
        const cats = [...new Set((data || []).map((p: Producto) => p.categoria))]
        setCategorias(cats)
      })
  }, [])

  const cargarProximaFactura = () => {
    supabase.from('visitas').select('nro_factura').not('nro_factura', 'is', null)
      .order('nro_factura', { ascending: false }).limit(1)
      .then(({ data }) => {
        const ultima = data?.[0]?.nro_factura as string | undefined
        if (!ultima || ultima.startsWith('600')) {
          setProximaFactura('10000001')
        } else {
          setProximaFactura(String(parseInt(ultima, 10) + 1))
        }
      })
  }
  useEffect(cargarProximaFactura, [])

  useEffect(() => {
    if (form.resultado === 'visita_efectiva' && !form.nro_factura && proximaFactura) {
      setForm(f => ({ ...f, nro_factura: proximaFactura }))
    }
  }, [form.resultado, proximaFactura])

  useEffect(() => {
    const dia = diaDefecha(form.fecha)
    setClientes([])
    setForm(f => ({ ...f, cliente_id: '' }))
    setBusqueda('')
    setMostrarLista(false)
    supabase.from('clientes').select('id, nombre_negocio, propietario, zona, dia_visita, codigo_cliente, fecha_ultima_visita, deuda_pendiente, moneda_deuda, telefono')
      .in('status', ['activo', 'nuevo'])
      .eq('dia_visita', dia)
      .order('nombre_negocio')
      .then(({ data }) => {
        const lista = data || []
        setClientes(lista)
        if (preClienteId) {
          const c = lista.find(x => String(x.id) === preClienteId)
          if (c) setForm(f => ({ ...f, cliente_id: preClienteId }))
        }
        if (lista.length > 0) {
          supabase.from('visitas').select('cliente_id, monto_pedido')
            .eq('fecha', form.fecha)
            .in('cliente_id', lista.map(c => c.id))
            .then(({ data }) => {
              const vs = data || []
              setVisitasHoy(vs.length)
              setVisitadosIds(new Set(vs.map((v: any) => v.cliente_id)))
              setMontoHoy(vs.reduce((a: number, v: any) => a + (v.monto_pedido || 0), 0))
            })
        } else {
          setVisitadosIds(new Set())
          setMontoHoy(0)
        }
      })
  }, [form.fecha])

  const clientesFiltrados = busqueda.length > 0
    ? clientes.filter(c => c.nombre_negocio.toLowerCase().includes(busqueda.toLowerCase()) || (c.codigo_cliente || '').toLowerCase().includes(busqueda.toLowerCase()))
    : clientes

  const clienteSel = clientes.find(c => String(c.id) === form.cliente_id)

  const rutaPorZona = clientes.reduce((acc: Record<string, Cliente[]>, c) => {
    const z = c.zona || 'Sin zona'
    ;(acc[z] ||= []).push(c)
    return acc
  }, {})

  useEffect(() => {
    if (!clienteSel?.id) { setCobrosCliente([]); return }
    supabase.from('cobros').select('id, monto, moneda, estado, descripcion, fecha_vencimiento')
      .eq('cliente_id', clienteSel.id).neq('estado', 'pagado').order('fecha_vencimiento')
      .then(({ data }) => setCobrosCliente(data || []))
  }, [clienteSel?.id])

  useEffect(() => {
    if (!clienteSel?.id) { setProductosFrecuentes([]); return }
    supabase.from('visitas').select('productos_pedidos')
      .eq('cliente_id', clienteSel.id).not('productos_pedidos', 'is', null)
      .order('fecha', { ascending: false }).limit(8)
      .then(({ data }) => {
        const conteo: Record<string, { nombre: string; codigo?: string; veces: number }> = {}
        for (const v of data || []) {
          for (const p of (v.productos_pedidos || []) as LineaPedido[]) {
            if (!conteo[p.nombre]) conteo[p.nombre] = { nombre: p.nombre, codigo: p.codigo, veces: 0 }
            conteo[p.nombre].veces++
          }
        }
        setProductosFrecuentes(Object.values(conteo).sort((a, b) => b.veces - a.veces).slice(0, 6))
      })
  }, [clienteSel?.id])

  const agregarProductoFrecuente = (nombre: string) => {
    setCantidades(prev => ({ ...prev, [nombre]: (prev[nombre] || 0) + 1 }))
  }

  const marcarCobroCliente = async (id: number, estado: string) => {
    await supabase.from('cobros').update({ estado }).eq('id', id)
    setCobrosCliente(cs => estado === 'pagado' ? cs.filter(c => c.id !== id) : cs.map(c => c.id === id ? { ...c, estado } : c))
  }

  const seleccionarCliente = (c: Cliente) => {
    setForm(f => ({ ...f, cliente_id: String(c.id) }))
    setBusqueda(c.nombre_negocio)
    setMostrarLista(false)
    setMostrarFicha(false)
  }

  const prodsFiltrados = productos.filter(p => {
    const catMatch = catSel === 'Todas' || p.categoria === catSel
    const textMatch = !busquedaProd || p.nombre.toLowerCase().includes(busquedaProd.toLowerCase())
    return catMatch && textMatch
  })

  const setCaja = (nombre: string, val: number) => {
    setCantidades(prev => ({ ...prev, [nombre]: Math.max(0, val) }))
  }

  const lineas: LineaPedido[] = productos
    .filter(p => (cantidades[p.nombre] || 0) > 0)
    .map(p => {
      const cajas = cantidades[p.nombre]
      return { nombre: p.nombre, codigo: p.codigo, cajas, precio_caja: p.precio_caja || 0, subtotal: cajas * (p.precio_caja || 0), imagen_url: (p as Producto & { imagen_url?: string }).imagen_url }
    })
  const totalCalculado = lineas.reduce((a, l) => a + l.subtotal, 0)

  const tieneProductos = lineas.length > 0
  useEffect(() => {
    if (tieneProductos) setForm(f => ({ ...f, resultado: 'visita_efectiva' }))
  }, [tieneProductos])

  const facturaDuplicada = async (numero: string, excluirId?: number) => {
    if (!numero) return false
    let q = supabase.from('visitas').select('id').eq('nro_factura', numero).limit(1)
    if (excluirId) q = q.neq('id', excluirId)
    const { data } = await q
    return (data?.length || 0) > 0
  }

  const guardar = async () => {
    if (!form.cliente_id) return alert('Selecciona un cliente')
    if (form.resultado === 'otro' && !form.resultado_otro.trim()) return alert('Escribe el caso puntual')
    if (form.nro_factura && await facturaDuplicada(form.nro_factura)) {
      return alert(`La factura ${form.nro_factura} ya está registrada. Verifica el número.`)
    }
    setSaving(true)
    const resultadoFinal = form.resultado === 'otro' ? form.resultado_otro.trim() : form.resultado
    const montoFinal = form.monto_manual || totalCalculado
    await supabase.from('visitas').insert({
      cliente_id: +form.cliente_id,
      fecha: form.fecha,
      resultado: resultadoFinal,
      moneda: form.moneda,
      monto_pedido: montoFinal,
      productos_pedidos: lineas.length > 0 ? lineas : [],
      notas_visita: form.notas_visita,
      dias_credito: form.dias_credito,
      nro_factura: form.nro_factura || null,
    })
    if (form.dias_credito > 0 && montoFinal > 0) {
      const [y, m, d] = form.fecha.split('-').map(Number)
      const venc = new Date(y, m - 1, d + form.dias_credito)
      const fechaVenc = `${venc.getFullYear()}-${String(venc.getMonth()+1).padStart(2,'0')}-${String(venc.getDate()).padStart(2,'0')}`
      await supabase.from('cobros').insert({
        cliente_id: +form.cliente_id,
        monto: montoFinal,
        moneda: form.moneda,
        descripcion: form.nro_factura || `Pedido ${form.fecha}`,
        fecha_emision: form.fecha,
        fecha_vencimiento: fechaVenc,
        estado: 'pendiente',
      })
    }
    await supabase.from('clientes').update({ fecha_ultima_visita: form.fecha }).eq('id', +form.cliente_id)
    setSaving(false)
    if (resultadoFinal === 'visita_efectiva' && montoFinal > 0 && clienteSel?.telefono) {
      setConfirmacionWA({
        telefono: clienteSel.telefono,
        link: waConfirmacionPedido(clienteSel, montoFinal, form.moneda, lineas, form.nro_factura || null),
      })
    } else {
      setConfirmacionWA(null)
    }
    setOk(true)
    setVisitasHoy(v => v + 1)
    setVisitadosIds(prev => new Set(prev).add(+form.cliente_id))
    setMontoHoy(m => m + (form.resultado === 'visita_efectiva' ? totalCalculado || form.monto_manual : 0))
    setCantidades({})
    const idxActual = clientes.findIndex(c => String(c.id) === form.cliente_id)
    const siguiente = clientes[idxActual + 1] || null
    setSiguienteCliente(siguiente)
    if (form.nro_factura) {
      setProximaFactura(String(parseInt(form.nro_factura, 10) + 1))
    }
    setForm(f => ({ ...f, notas_visita: '', monto_manual: 0, resultado: 'visita_efectiva', resultado_otro: '', nro_factura: '' }))
  }

  const cargarHistorial = async (fecha: string) => {
    setCargandoHistorial(true)
    const { data } = await supabase.from('visitas')
      .select('*, clientes(nombre_negocio, codigo_cliente)')
      .eq('fecha', fecha)
      .order('created_at', { ascending: false })
    setHistorial(data || [])
    setCargandoHistorial(false)
  }

  useEffect(() => {
    if (tab === 'historial') cargarHistorial(filtroFechaH)
  }, [tab, filtroFechaH])

  const abrirEditar = (v: Visita) => {
    setEditVisita(v)
    setEditForm({
      resultado: RESULTADO_LABEL[v.resultado] ? v.resultado : 'otro',
      resultado_otro: RESULTADO_LABEL[v.resultado] ? '' : v.resultado,
      monto_pedido: v.monto_pedido || 0,
      notas_visita: v.notas_visita || '',
      dias_credito: (v as Visita & { dias_credito?: number }).dias_credito || 21,
      nro_factura: (v as Visita & { nro_factura?: string }).nro_factura || '',
    })
    const cantInit: Record<string, number> = {}
    ;((v.productos_pedidos || []) as LineaPedido[]).forEach(l => { cantInit[l.nombre] = l.cajas })
    setEditCantidades(cantInit)
    setEditCatSel('Todas')
    setEditBusquedaProd('')
  }

  const guardarEdicion = async () => {
    if (!editVisita) return
    if (editForm.nro_factura && await facturaDuplicada(editForm.nro_factura, editVisita.id)) {
      return alert(`La factura ${editForm.nro_factura} ya está registrada en otra visita.`)
    }
    setSavingEdit(true)
    const resultadoFinal = editForm.resultado === 'otro' ? editForm.resultado_otro.trim() : editForm.resultado
    const editLineas: LineaPedido[] = productos
      .filter(p => (editCantidades[p.nombre] || 0) > 0)
      .map(p => ({ nombre: p.nombre, codigo: p.codigo, cajas: editCantidades[p.nombre], precio_caja: p.precio_caja || 0, subtotal: editCantidades[p.nombre] * (p.precio_caja || 0), imagen_url: (p as Producto & { imagen_url?: string }).imagen_url }))
    const editTotal = editLineas.reduce((a, l) => a + l.subtotal, 0)
    await supabase.from('visitas').update({
      resultado: resultadoFinal,
      monto_pedido: editForm.monto_pedido || editTotal,
      productos_pedidos: editLineas,
      notas_visita: editForm.notas_visita,
      dias_credito: editForm.dias_credito,
      nro_factura: editForm.nro_factura || null,
    }).eq('id', editVisita.id)
    setSavingEdit(false)
    setEditVisita(null)
    cargarHistorial(filtroFechaH)
  }

  const eliminarVisita = async (id: number) => {
    if (!confirm('¿Eliminar esta visita? Esta acción no se puede deshacer.')) return
    const visita = historial.find(v => v.id === id)
    await supabase.from('visitas').delete().eq('id', id)
    if (visita) {
      await supabase.from('cobros')
        .delete()
        .eq('cliente_id', visita.cliente_id)
        .eq('fecha_emision', visita.fecha)
        .eq('descripcion', `Pedido ${visita.fecha}`)
        .eq('estado', 'pendiente')
    }
    setHistorial(prev => prev.filter(v => v.id !== id))
    setVisitasHoy(v => Math.max(0, v - 1))
  }

  const diaLabel: Record<string, string> = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes' }

  return (
    <div className="space-y-4">
      {mostrarFicha && clienteSel && (
        <ClienteFichaModal clienteId={clienteSel.id!} onClose={() => setMostrarFicha(false)} />
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-violet-400">Visita</h1>
        <span className="text-xs bg-violet-900/40 text-violet-300 px-3 py-1 rounded-full">
          {diaLabel[diaActual] ?? diaActual} · {visitasHoy}/{clientes.length} visitados
        </span>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
        {(['registrar', 'historial'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t === 'registrar' ? '📋 Registrar' : '📅 Historial'}
          </button>
        ))}
      </div>

      {/* Ruta del día agrupada por zona */}
      {tab === 'registrar' && clientes.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <button onClick={() => setMostrarRuta(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800/50">
            <span>🗺️ Ruta del día · {visitasHoy}/{clientes.length} visitados{montoHoy > 0 && ` · $${montoHoy.toFixed(2)}`}</span>
            <span className="text-slate-500 text-xs">{mostrarRuta ? '▲ ocultar' : '▼ ver'}</span>
          </button>
          {mostrarRuta && (
            <div className="px-4 pb-3 space-y-3 max-h-96 overflow-y-auto">
              {Object.entries(rutaPorZona).sort(([a], [b]) => a.localeCompare(b)).map(([zona, lista]) => {
                const visitadosZona = lista.filter(c => visitadosIds.has(c.id)).length
                return (
                  <div key={zona}>
                    <p className="text-xs font-medium text-violet-400 mb-1">{zona} · {visitadosZona}/{lista.length}</p>
                    <div className="space-y-1">
                      {lista.map(c => (
                        <button key={c.id} onClick={() => {
                          setForm(f => ({ ...f, cliente_id: String(c.id) }))
                          setMostrarLista(false)
                          setOk(false)
                          setConfirmacionWA(null)
                          setMostrarRuta(false)
                        }}
                          className={`w-full flex items-center gap-2 text-left text-xs rounded-lg px-2 py-1.5 ${String(c.id) === form.cliente_id ? 'bg-violet-900/30' : 'bg-slate-800/50 hover:bg-slate-800'}`}>
                          <span>{visitadosIds.has(c.id) ? '✅' : '⬜'}</span>
                          <span className="flex-1 truncate">{c.nombre_negocio}</span>
                          {c.codigo_cliente && <span className="text-slate-500 font-mono">{c.codigo_cliente}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal editar */}
      {editVisita && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4" onClick={() => setEditVisita(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-violet-400">Editar visita</h3>
              <button onClick={() => setEditVisita(null)} className="text-slate-400 text-xl">✕</button>
            </div>
            <div>
              <span className="text-xs text-slate-400">Resultado</span>
              <select value={editForm.resultado} onChange={e => setEditForm(f => ({ ...f, resultado: e.target.value }))}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                {RESULTADOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {editForm.resultado === 'otro' && (
                <input value={editForm.resultado_otro} onChange={e => setEditForm(f => ({ ...f, resultado_otro: e.target.value }))}
                  placeholder="Caso puntual..." className="w-full mt-2 bg-slate-800 border border-violet-700 rounded-lg px-3 py-2 text-sm" />
              )}
            </div>
            <div>
              <span className="text-xs text-slate-400">Días de crédito</span>
              <div className="flex gap-2 mt-1">
                {[{ label: 'Contado', value: 0 }, { label: '7d', value: 7 }, { label: '15d', value: 15 }, { label: '21d', value: 21 }].map(op => (
                  <button key={op.value} onClick={() => setEditForm(f => ({ ...f, dias_credito: op.value }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${editForm.dias_credito === op.value ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Productos en el edit */}
            <div>
              <p className="text-xs text-slate-400 mb-1">Productos</p>
              <input value={editBusquedaProd} onChange={e => { setEditBusquedaProd(e.target.value); setEditCatSel('Todas') }}
                placeholder="Buscar producto..." className="w-full mb-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs" />
              <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2">
                {['Todas', ...categorias].map(cat => (
                  <button key={cat} onClick={() => { setEditCatSel(cat); setEditBusquedaProd('') }}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-xs ${editCatSel === cat && !editBusquedaProd ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1 bg-slate-800/50 rounded-lg p-2">
                {productos.filter(p => {
                  const cMatch = editCatSel === 'Todas' || p.categoria === editCatSel
                  const tMatch = !editBusquedaProd || p.nombre.toLowerCase().includes(editBusquedaProd.toLowerCase())
                  return cMatch && tMatch
                }).map(p => {
                  const qty = editCantidades[p.nombre] || 0
                  return (
                    <div key={p.id} className={`flex items-center gap-2 py-1 px-1 rounded-lg ${qty > 0 ? 'bg-violet-900/25' : ''}`}>
                      <span className="text-xs flex-1 line-clamp-2 leading-tight">{p.nombre}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setEditCantidades(prev => ({ ...prev, [p.nombre]: Math.max(0, (prev[p.nombre] || 0) - 1) }))}
                          className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-sm font-bold flex items-center justify-center">−</button>
                        <span className={`w-6 text-center text-xs font-medium ${qty > 0 ? 'text-violet-300' : 'text-slate-500'}`}>{qty}</span>
                        <button onClick={() => setEditCantidades(prev => ({ ...prev, [p.nombre]: (prev[p.nombre] || 0) + 1 }))}
                          className="w-6 h-6 rounded bg-violet-700 hover:bg-violet-600 text-sm font-bold flex items-center justify-center">+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {editForm.resultado === 'visita_efectiva' && (
              <div>
                <span className="text-xs text-slate-400">Nro. factura</span>
                <input value={editForm.nro_factura} onChange={e => setEditForm(f => ({ ...f, nro_factura: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  placeholder="10000001" inputMode="numeric"
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
            )}
            <label className="block">
              <span className="text-xs text-slate-400">Monto (USD)</span>
              <input type="number" step="0.01" min={0} value={editForm.monto_pedido}
                onChange={e => setEditForm(f => ({ ...f, monto_pedido: +e.target.value }))}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Notas</span>
              <textarea value={editForm.notas_visita} onChange={e => setEditForm(f => ({ ...f, notas_visita: e.target.value }))}
                rows={2} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </label>
            <button onClick={guardarEdicion} disabled={savingEdit}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium">
              {savingEdit ? 'Guardando...' : '💾 Guardar cambios'}
            </button>
          </div>
        </div>
      )}

      {tab === 'registrar' && ok && (
        <div className="bg-green-900/40 border border-green-700/50 text-green-400 rounded-xl p-3 space-y-2">
          <p className="text-center font-medium">✅ Visita registrada correctamente</p>
          {confirmacionWA && (
            <a href={confirmacionWA.link} target="_blank" rel="noreferrer"
              onClick={() => setConfirmacionWA(null)}
              className="block w-full text-center bg-green-800/60 hover:bg-green-700/60 border border-green-600 text-green-300 rounded-lg py-2 text-sm font-medium">
              📱 Confirmar pedido por WhatsApp
            </a>
          )}
          {siguienteCliente && (
            <button
              onClick={() => {
                setForm(f => ({ ...f, cliente_id: String(siguienteCliente.id) }))
                setOk(false)
                setSiguienteCliente(null)
                setMostrarLista(false)
                setConfirmacionWA(null)
              }}
              className="w-full bg-green-800/60 hover:bg-green-700/60 border border-green-600 text-green-300 rounded-lg py-2 text-sm font-medium">
              → Siguiente: {siguienteCliente.nombre_negocio}
            </button>
          )}
        </div>
      )}

      {tab === 'historial' && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-slate-400">Fecha</span>
            <input type="date" value={filtroFechaH} onChange={e => setFiltroFechaH(e.target.value)}
              className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </label>
          {cargandoHistorial
            ? <p className="text-slate-400 text-sm text-center py-4">Cargando...</p>
            : historial.length === 0
              ? <p className="text-slate-400 bg-slate-900 rounded-xl p-4 text-sm">No hay visitas registradas para esta fecha.</p>
              : <div className="space-y-2">
                  <p className="text-xs text-slate-500">{historial.length} visita{historial.length !== 1 ? 's' : ''}</p>
                  {historial.map(v => {
                    const rLabel = RESULTADO_LABEL[v.resultado] || v.resultado
                    const rColor = RESULTADO_COLOR[v.resultado] || 'bg-slate-800 text-slate-400'
                    const lineasV = (v.productos_pedidos || []) as LineaPedido[]
                    return (
                      <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <button onClick={() => setExpandidoH(expandidoH === v.id ? null : v.id)}
                          className="w-full flex items-center gap-3 p-3 text-left">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{v.clientes?.nombre_negocio || '—'}</p>
                            {v.clientes?.codigo_cliente && <span className="text-xs text-violet-400 font-mono">{v.clientes.codigo_cliente}</span>}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${rColor}`}>{rLabel}</span>
                          {(v.monto_pedido || 0) > 0 && <span className="text-xs text-violet-400 shrink-0">${Number(v.monto_pedido).toFixed(2)}</span>}
                          <span className="text-slate-500 ml-1">{expandidoH === v.id ? '▲' : '▼'}</span>
                        </button>
                        {expandidoH === v.id && (
                          <div className="px-3 pb-3 border-t border-slate-800 pt-2 space-y-2">
                            {(v as Visita & { nro_factura?: string }).nro_factura && (
                              <p className="text-xs text-slate-400">Factura: <span className="text-violet-300 font-mono">{(v as Visita & { nro_factura?: string }).nro_factura}</span></p>
                            )}
                            {(v as Visita & { dias_credito?: number }).dias_credito !== undefined && (
                              <p className="text-xs text-slate-400">Crédito: <span className="text-white">{(v as Visita & { dias_credito?: number }).dias_credito === 0 ? 'Contado' : `${(v as Visita & { dias_credito?: number }).dias_credito} días`}</span></p>
                            )}
                            {lineasV.length > 0 && (
                              <div className="bg-slate-800 rounded-xl overflow-hidden">
                                <div className="bg-slate-700/60 px-3 py-1.5">
                                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Lista de productos</span>
                                </div>
                                {lineasV.map((l, i) => (
                                  <div key={i} className="flex items-start gap-3 p-3 border-b border-slate-700/50 last:border-0">
                                    <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-slate-700 flex items-center justify-center">
                                      {l.imagen_url
                                        ? <img src={l.imagen_url} alt={l.nombre} className="w-full h-full object-cover" />
                                        : <span className="text-xl">📦</span>
                                      }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs text-white leading-snug">
                                        {l.nombre}{l.codigo ? <span className="text-slate-400"> ({l.codigo})</span> : ''}
                                      </p>
                                      <div className="flex items-center justify-between mt-1">
                                        <span className="text-xs text-slate-400">Solicitado: {l.cajas} x ${l.precio_caja.toFixed(2)}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${(v as Visita & { nro_factura?: string }).nro_factura ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                                          {(v as Visita & { nro_factura?: string }).nro_factura ? `Facturado` : 'No facturado'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {v.notas_visita && <p className="text-xs bg-slate-800 rounded p-2 text-slate-300">{v.notas_visita}</p>}
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => abrirEditar(v)}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-sm py-2 rounded-lg">✏️ Editar</button>
                              <button onClick={() => eliminarVisita(v.id)}
                                className="flex-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-sm py-2 rounded-lg">🗑️ Eliminar</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
          }
        </div>
      )}

      {tab === 'registrar' && clientes.length === 0
        ? <p className="text-slate-400 bg-slate-900 rounded-xl p-4">No hay clientes asignados para el {diaLabel[diaActual] ?? diaActual}.</p>
        : tab === 'registrar' && <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-4">

            {/* Selector de cliente */}
            <div>
              <span className="text-xs text-slate-400">Cliente *</span>
              <button onClick={() => { setMostrarLista(v => !v); setBusqueda('') }}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-left flex items-center justify-between">
                <span className={clienteSel ? 'text-white' : 'text-slate-500'}>
                  {clienteSel ? clienteSel.nombre_negocio : 'Seleccionar cliente...'}
                </span>
                <span className="text-slate-400">{mostrarLista ? '▲' : '▼'}</span>
              </button>
              {clienteSel && (
                <div className="mt-2 bg-slate-800/60 rounded-lg px-3 py-2 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {clienteSel.codigo_cliente && <span className="text-violet-400 font-mono text-xs">{clienteSel.codigo_cliente}</span>}
                    {clienteSel.zona && <span className="text-slate-400 text-xs">· {clienteSel.zona}</span>}
                    <div className="ml-auto flex items-center gap-2">
                      {clienteSel.telefono && (
                        <a href={`https://wa.me/${(clienteSel.telefono || '').replace('+','')}`} target="_blank" rel="noreferrer"
                          className="text-green-400 text-xs">📱 WhatsApp</a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-slate-400">Últ. visita: <span className="text-white">{clienteSel.fecha_ultima_visita || 'Nunca'}</span></span>
                  </div>
                  <button onClick={() => setMostrarFicha(true)}
                    className="w-full mt-1 bg-violet-900/40 hover:bg-violet-900/60 border border-violet-800/50 text-violet-300 text-sm font-medium py-2 rounded-lg">
                    🧠 Ver ficha del cliente
                  </button>
                  {cobrosCliente.length > 0 && (
                    <div className="mt-1 space-y-1.5 border-t border-slate-700/50 pt-2">
                      <p className="text-red-400 font-medium text-xs">⚠️ Cobros pendientes con este cliente:</p>
                      {cobrosCliente.map(c => {
                        const dias = Math.ceil((new Date(c.fecha_vencimiento).getTime() - Date.now()) / 864e5)
                        return (
                          <div key={c.id} className="flex items-center justify-between gap-2 text-xs bg-slate-900/60 rounded-lg px-2 py-1.5">
                            <div>
                              <span className="text-white font-medium">{c.moneda} {c.monto.toFixed(2)}</span>
                              {c.descripcion && <span className="text-slate-500 font-mono"> · {c.descripcion}</span>}
                              <span className={`ml-2 ${dias < 0 ? 'text-red-400' : dias <= 3 ? 'text-yellow-400' : 'text-slate-400'}`}>
                                {dias < 0 ? `Vencido hace ${Math.abs(dias)}d` : dias === 0 ? 'Vence hoy' : `Vence en ${dias}d`}
                              </span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {c.estado === 'pendiente' && (
                                <button onClick={() => marcarCobroCliente(c.id, 'parcial')}
                                  className="bg-yellow-800/50 hover:bg-yellow-700/50 text-yellow-400 px-2 py-1 rounded text-[11px]">⚡ Parcial</button>
                              )}
                              <button onClick={() => marcarCobroCliente(c.id, 'pagado')}
                                className="bg-green-800/50 hover:bg-green-700/50 text-green-400 px-2 py-1 rounded text-[11px]">✅ Cobrado</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              {mostrarLista && (
                <div className="mt-1 bg-slate-800 border border-slate-700 rounded-lg max-h-56 overflow-y-auto shadow-xl">
                  <div className="p-2 border-b border-slate-700">
                    <input
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      placeholder="Filtrar..."
                      autoFocus
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm" />
                  </div>
                  {clientesFiltrados.map(c => (
                    <button key={c.id} onClick={() => seleccionarCliente(c)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-slate-700 text-sm border-b border-slate-700/50 last:border-0 ${String(c.id) === form.cliente_id ? 'bg-violet-900/30' : ''}`}>
                      <span className="font-medium">{c.nombre_negocio}</span>
                      {c.codigo_cliente && <span className="text-violet-400 font-mono text-xs ml-2">{c.codigo_cliente}</span>}
                      {c.zona && <span className="text-slate-500 text-xs ml-1">· {c.zona}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fecha */}
            <label className="block">
              <span className="text-xs text-slate-400">Fecha</span>
              <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </label>

            {/* Productos frecuentes del cliente */}
            {productosFrecuentes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-400">🔁 Productos frecuentes de este cliente</p>
                <div className="flex flex-wrap gap-1.5">
                  {productosFrecuentes.map(p => (
                    <button key={p.nombre} onClick={() => agregarProductoFrecuente(p.nombre)}
                      className="flex items-center gap-1.5 bg-violet-900/25 hover:bg-violet-900/40 border border-violet-800/50 text-violet-300 rounded-full pl-3 pr-2 py-1 text-xs">
                      <span className="truncate max-w-[160px]">{p.nombre}</span>
                      <span className="text-violet-500">×{p.veces}</span>
                      <span className="bg-violet-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">+</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Productos */}
            {productos.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Productos pedidos</p>
                  {lineas.length > 0 && <span className="text-xs text-violet-400 font-medium">{lineas.length} seleccionado{lineas.length !== 1 ? 's' : ''} · ${totalCalculado.toFixed(2)}</span>}
                </div>
                <input
                  value={busquedaProd}
                  onChange={e => { setBusquedaProd(e.target.value); setCatSel('Todas') }}
                  placeholder="Buscar producto..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {['Todas', ...categorias].map(cat => (
                    <button key={cat} onClick={() => { setCatSel(cat); setBusquedaProd('') }}
                      className={`shrink-0 px-3 py-1 rounded-full text-xs ${catSel === cat && !busquedaProd ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
                {/* Cards de productos */}
                <div className="max-h-[480px] overflow-y-auto rounded-xl bg-slate-800 divide-y divide-slate-700/50">
                  {prodsFiltrados.map(p => {
                    const qty = cantidades[p.nombre] || 0
                    const imgUrl = (p as Producto & { imagen_url?: string }).imagen_url
                    return (
                      <div key={p.id} className={`flex items-start gap-3 p-3 ${qty > 0 ? 'bg-violet-900/20' : ''}`}>
                        <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-700 flex items-center justify-center">
                          {imgUrl
                            ? <img src={imgUrl} alt={p.nombre} className="w-full h-full object-cover" />
                            : <span className="text-2xl">📦</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white leading-snug">
                            {p.nombre}{p.codigo ? <span className="text-slate-400 text-xs"> ({p.codigo})</span> : ''}
                          </p>
                          <div className="flex items-center mt-1.5 gap-2">
                            <span className="text-xs text-slate-400 flex-1">
                              {qty > 0 ? `Solicitado: ${qty} x $${(p.precio_caja || 0).toFixed(2)}` : `$${(p.precio_caja || 0).toFixed(2)} / caja`}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => setCaja(p.nombre, qty - 1)}
                                className="w-7 h-7 rounded-lg bg-slate-600 hover:bg-slate-500 text-sm font-bold flex items-center justify-center text-white">−</button>
                              <span className={`w-7 text-center text-sm font-bold ${qty > 0 ? 'text-violet-300' : 'text-slate-500'}`}>{qty}</span>
                              <button onClick={() => setCaja(p.nombre, qty + 1)}
                                className="w-7 h-7 rounded-lg bg-violet-700 hover:bg-violet-600 text-sm font-bold flex items-center justify-center text-white">+</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Días de crédito */}
            <div>
              <span className="text-xs text-slate-400">Días de crédito</span>
              <div className="flex gap-2 mt-1">
                {[{ label: 'Contado', value: 0 }, { label: '7 días', value: 7 }, { label: '15 días', value: 15 }, { label: '21 días', value: 21 }].map(op => (
                  <button key={op.value} onClick={() => setForm(f => ({ ...f, dias_credito: op.value }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.dias_credito === op.value ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {form.resultado === 'visita_efectiva' && (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Nro. factura</span>
                  {proximaFactura && form.nro_factura !== proximaFactura && (
                    <button onClick={() => setForm(f => ({ ...f, nro_factura: proximaFactura }))} className="text-xs text-violet-400 hover:text-violet-300">
                      Usar sugerido: {proximaFactura}
                    </button>
                  )}
                </div>
                <div className="flex mt-1">
                  <input
                    value={form.nro_factura}
                    onChange={e => setForm({ ...form, nro_factura: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                    placeholder="10000001"
                    inputMode="numeric"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Sugerido automáticamente según la última factura registrada — puedes corregirlo si es necesario.</p>
              </div>
            )}

            <label className="block">
              <span className="text-xs text-slate-400">Monto total (USD) — editar si es diferente</span>
              <input type="number" step="0.01" min={0}
                value={form.monto_manual || totalCalculado}
                onChange={e => setForm({ ...form, monto_manual: +e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </label>

            <label className="block">
              <span className="text-xs text-slate-400">Notas de la visita</span>
              <textarea value={form.notas_visita} onChange={e => setForm({ ...form, notas_visita: e.target.value })}
                rows={3} placeholder="Qué dijeron, qué necesitan, próxima visita..."
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </label>

            {/* Resultado */}
            <div>
              <span className="text-xs text-slate-400">Resultado *</span>
              <select value={form.resultado} onChange={e => setForm({ ...form, resultado: e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                {RESULTADOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {form.resultado === 'otro' && (
                <input
                  value={form.resultado_otro}
                  onChange={e => setForm({ ...form, resultado_otro: e.target.value })}
                  placeholder="Describe el caso puntual..."
                  className="w-full mt-2 bg-slate-800 border border-violet-700 rounded-lg px-3 py-2 text-sm" />
              )}
            </div>

            <button onClick={guardar} disabled={saving}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-3 rounded-lg font-medium text-base">
              {saving ? 'Guardando...' : '✅ Registrar Visita'}
            </button>
          </div>
      }
    </div>
  )
}
