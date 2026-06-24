'use client'
import { useEffect, useState } from 'react'
import { supabase, type Despacho, type DespachoItem, type Cobro } from '@/lib/supabase'

const DIAS_CREDITO = 10

function sumarDias(fechaStr: string, dias: number) {
  const d = new Date(fechaStr + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}
function hoy() { return new Date().toISOString().split('T')[0] }

export default function Despachos() {
  const [despachos, setDespachos] = useState<Despacho[]>([])
  const [items, setItems] = useState<DespachoItem[]>([])
  const [expandido, setExpandido] = useState<number | null>(null)
  const [modal, setModal] = useState<DespachoItem | null>(null)
  const [fechaEntrega, setFechaEntrega] = useState(hoy())
  const [cobrosPendientes, setCobrosPendientes] = useState<Cobro[]>([])
  const [cobroSel, setCobroSel] = useState<string>('')
  const [guardando, setGuardando] = useState(false)
  const [devModal, setDevModal] = useState<DespachoItem | null>(null)
  const [tipoDevolucion, setTipoDevolucion] = useState<'definitiva' | 'reentrega'>('reentrega')
  const [motivoDev, setMotivoDev] = useState('')
  const [procesandoDev, setProcesandoDev] = useState(false)
  const [copiadoId, setCopiadoId] = useState<number | null>(null)

  const copiarRutero = async (d: Despacho) => {
    const url = `https://isola-crm-web.vercel.app/r/${d.numero_guia}`
    await navigator.clipboard.writeText(url)
    setCopiadoId(d.id)
    setTimeout(() => setCopiadoId(null), 2000)
  }

  const cargar = async () => {
    const { data: d } = await supabase.from('despachos').select('*').order('fecha_guia', { ascending: false })
    setDespachos(d || [])
    if (d?.length) setExpandido(prev => prev ?? d[0].id)
    const { data: it } = await supabase.from('despacho_items')
      .select('*, clientes(nombre_negocio, propietario, telefono)').order('id')
    setItems(it || [])
  }
  useEffect(() => { cargar() }, [])

  const abrirModal = async (item: DespachoItem) => {
    setModal(item)
    setFechaEntrega(hoy())
    setCobroSel('')
    const { data } = await supabase.from('cobros').select('*, clientes(nombre_negocio)')
      .eq('cliente_id', item.cliente_id).eq('estado', 'pendiente').order('fecha_emision', { ascending: false })
    setCobrosPendientes(data || [])
    if (data?.length === 1) setCobroSel(String(data[0].id))
  }

  const confirmarEntrega = async () => {
    if (!modal) return
    setGuardando(true)
    const venc = sumarDias(fechaEntrega, DIAS_CREDITO)
    await supabase.from('despacho_items').update({
      estado: 'entregado', fecha_entrega: fechaEntrega,
      cobro_id: cobroSel ? +cobroSel : null,
    }).eq('id', modal.id)
    if (cobroSel) {
      await supabase.from('cobros').update({
        fecha_entrega: fechaEntrega, fecha_vencimiento: venc,
      }).eq('id', +cobroSel)
    }
    setGuardando(false)
    setModal(null)
    cargar()
  }

  const procesarDevolucion = async () => {
    if (!devModal) return
    setProcesandoDev(true)
    if (tipoDevolucion === 'definitiva') {
      await supabase.from('despacho_items').update({
        estado: 'devuelto',
        notas_devolucion: motivoDev || null,
      }).eq('id', devModal.id)
      if (devModal.cobro_id) {
        await supabase.from('cobros').update({ estado: 'cancelado' }).eq('id', devModal.cobro_id)
      }
    } else {
      await supabase.from('despacho_items').update({
        estado: 'pendiente_reentrega',
        fecha_entrega: null,
        notas_devolucion: motivoDev || null,
      }).eq('id', devModal.id)
      if (devModal.cobro_id) {
        await supabase.from('cobros').update({ fecha_entrega: null }).eq('id', devModal.cobro_id)
      }
    }
    setProcesandoDev(false)
    setDevModal(null)
    setMotivoDev('')
    cargar()
  }

  const itemsDe = (despachoId: number) => items.filter(i => i.despacho_id === despachoId)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-violet-400">🚚 Despachos</h1>
      <p className="text-sm text-slate-400">
        Guías de despacho con tus clientes. Marca la entrega real para que el crédito ({DIAS_CREDITO} días) cuente desde ese día.
      </p>

      {despachos.length === 0 && (
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 text-center text-slate-400 text-sm">
          Aún no hay guías cargadas. Envíame el PDF cada noche y yo la registro aquí.
        </div>
      )}

      {despachos.map(d => {
        const its = itemsDe(d.id)
        const entregados = its.filter(i => i.estado === 'entregado').length
        return (
          <div key={d.id} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <button onClick={() => setExpandido(expandido === d.id ? null : d.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800/40">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Guía #{d.numero_guia} · {d.fecha_guia}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {d.conductor_nombre || 'Conductor s/n'} {d.placa ? `· ${d.placa}` : ''} · {entregados}/{its.length} entregados
                </p>
              </div>
              {d.conductor_telefono && (
                <a href={`tel:${d.conductor_telefono}`} onClick={e => e.stopPropagation()}
                  className="shrink-0 bg-green-800/50 hover:bg-green-700/50 text-green-400 px-3 py-1.5 rounded-lg text-xs">
                  📞 Llamar chofer
                </a>
              )}
              <button onClick={e => { e.stopPropagation(); copiarRutero(d) }}
                className="shrink-0 bg-blue-900/50 hover:bg-blue-800/50 text-blue-300 px-3 py-1.5 rounded-lg text-xs">
                {copiadoId === d.id ? '✅ Copiado' : '🔗 Copiar rutero'}
              </button>
              <span className="text-slate-500">{expandido === d.id ? '▲' : '▼'}</span>
            </button>

            {expandido === d.id && (
              <div className="border-t border-slate-800 p-3 space-y-2">
                {its.length === 0 && <p className="text-sm text-slate-500 px-1">Sin clientes tuyos en esta guía.</p>}
                {its.map(i => {
                  const cl = i.clientes as any
                  const estadoIcon = i.estado === 'entregado' ? '✅' : i.estado === 'devuelto' ? '❌' : i.estado === 'pendiente_reentrega' ? '🔄' : '⏳'
                  const estadoBg = i.estado === 'entregado' ? 'bg-green-950/40' : i.estado === 'devuelto' ? 'bg-red-950/40' : i.estado === 'pendiente_reentrega' ? 'bg-yellow-950/40' : 'bg-slate-800/50'
                  return (
                    <div key={i.id} className={`flex items-start gap-2 p-2 ${estadoBg} rounded-lg`}>
                      <span className="text-lg shrink-0">{estadoIcon}</span>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-sm font-medium leading-snug">{cl?.nombre_negocio}</p>
                        <p className="text-xs text-slate-500">
                          {i.codigo_guia ? `Cód. ${i.codigo_guia} · ` : ''}{i.bultos ?? '?'} bultos
                          {i.estado === 'entregado' && i.fecha_entrega ? ` · entregado ${i.fecha_entrega}` : ''}
                          {i.estado === 'pendiente_reentrega' ? ' · pendiente reentrega' : ''}
                          {i.estado === 'devuelto' ? ' · devuelto definitivo' : ''}
                        </p>
                        {(i as any).notas_devolucion && (
                          <p className="text-xs text-yellow-400 italic">Motivo: {(i as any).notas_devolucion}</p>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          {(i.estado === 'pendiente' || i.estado === 'pendiente_reentrega') && (
                            <button onClick={() => abrirModal(i)}
                              className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-xs">
                              Marcar entregado
                            </button>
                          )}
                          {i.estado === 'entregado' && (
                            <button onClick={() => { setDevModal(i); setTipoDevolucion('reentrega'); setMotivoDev('') }}
                              className="bg-orange-800/50 hover:bg-orange-700/50 text-orange-400 px-3 py-1.5 rounded-lg text-xs">
                              ↩ Devolver
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold">Confirmar entrega — {(modal.clientes as any)?.nombre_negocio}</h2>
            <label className="block">
              <span className="text-xs text-slate-400">Fecha real de entrega</span>
              <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Cobro/factura asociado (recalcula vencimiento a {DIAS_CREDITO} días desde la entrega)</span>
              <select value={cobroSel} onChange={e => setCobroSel(e.target.value)}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                <option value="">— Sin cobro / no recalcular —</option>
                {cobrosPendientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.moneda} {Number(c.monto).toFixed(2)} · vence {c.fecha_vencimiento} · {c.descripcion || 'sin descripción'}
                  </option>
                ))}
              </select>
              {cobrosPendientes.length === 0 && (
                <p className="text-xs text-yellow-500 mt-1">Este cliente no tiene cobros pendientes registrados.</p>
              )}
            </label>
            {cobroSel && (
              <p className="text-xs text-slate-400">
                Nuevo vencimiento: <span className="text-violet-400 font-medium">{sumarDias(fechaEntrega, DIAS_CREDITO)}</span>
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg text-sm">Cancelar</button>
              <button onClick={confirmarEntrega} disabled={guardando}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                {guardando ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {devModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setDevModal(null)}>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold">↩ Devolver — {(devModal.clientes as any)?.nombre_negocio}</h2>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTipoDevolucion('reentrega')}
                className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${tipoDevolucion === 'reentrega' ? 'bg-yellow-600 border-yellow-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                🔄 Reintentar
              </button>
              <button onClick={() => setTipoDevolucion('definitiva')}
                className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${tipoDevolucion === 'definitiva' ? 'bg-red-700 border-red-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                ❌ Definitivo
              </button>
            </div>

            <p className="text-xs text-slate-400">
              {tipoDevolucion === 'reentrega'
                ? 'El pedido vuelve al camión. Podrás marcarlo como entregado cuando se concrete la reentrega.'
                : 'El pedido se cancela definitivamente. El cobro asociado también se cancelará.'}
            </p>

            <label className="block">
              <span className="text-xs text-slate-400">Motivo (opcional)</span>
              <input type="text" value={motivoDev} onChange={e => setMotivoDev(e.target.value)}
                placeholder="Ej: cliente ausente, local cerrado..."
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </label>

            <div className="flex gap-2">
              <button onClick={() => setDevModal(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg text-sm">Cancelar</button>
              <button onClick={procesarDevolucion} disabled={procesandoDev}
                className={`flex-1 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium ${tipoDevolucion === 'definitiva' ? 'bg-red-700 hover:bg-red-800' : 'bg-yellow-600 hover:bg-yellow-700'}`}>
                {procesandoDev ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
