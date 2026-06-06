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
              <span className="text-slate-500">{expandido === d.id ? '▲' : '▼'}</span>
            </button>

            {expandido === d.id && (
              <div className="border-t border-slate-800 p-3 space-y-2">
                {its.length === 0 && <p className="text-sm text-slate-500 px-1">Sin clientes tuyos en esta guía.</p>}
                {its.map(i => {
                  const cl = i.clientes as any
                  return (
                    <div key={i.id} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
                      <span className="text-lg">{i.estado === 'entregado' ? '✅' : '⏳'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cl?.nombre_negocio}</p>
                        <p className="text-xs text-slate-500">
                          {i.codigo_guia ? `Cód. ${i.codigo_guia} · ` : ''}{i.bultos ?? '?'} bultos
                          {i.estado === 'entregado' && i.fecha_entrega ? ` · entregado ${i.fecha_entrega}` : ''}
                        </p>
                      </div>
                      {i.estado !== 'entregado' && (
                        <button onClick={() => abrirModal(i)}
                          className="shrink-0 bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-xs">
                          Marcar entregado
                        </button>
                      )}
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
    </div>
  )
}
