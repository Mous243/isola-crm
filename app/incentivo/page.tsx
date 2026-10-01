'use client'
import { useEffect, useState } from 'react'
import { supabase, type IncentivoProducto } from '@/lib/supabase'

function hoy() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' }) }
function periodoActual() { return hoy().slice(0, 7) }

// Tren Verano cerro en septiembre pero el resultado final (trofeo) todavia no llega del coordinador.
// Se oculta todo lo de Tren Verano sin borrar nada; cuando el usuario traiga el corte final se vuelve a
// activar (y esa seccion pasa a mostrarse como el trofeo ganado, no como incentivo en curso).
const MOSTRAR_TREN_VERANO = false

const OLE_Q4_SKUS: [string, string[]][] = [
  ['Mayonesa Olé', ['mayonesa ole']],
  ['Pizza+ Olé', ['pizza']],
]

function puntosTabulador(pvar: number): number {
  if (pvar > 100) return 150
  if (pvar < 10) return 0
  return Math.min(Math.floor(pvar / 10) * 10, 100)
}

type Fila = IncentivoProducto & { logro: number; pvar: number; puntos: number }
type VisitaMin = { cliente_id: number; productos_pedidos: { nombre?: string; cajas?: number }[] | null }
type ClienteMin = { id: number; nombre_negocio: string; dia_visita?: string }
type Dropsize = { nombre: string; volumen: number; clientesActivos: number; dropsize: number }
type Categoria = { nombre: string; kws: string[]; clientesActivos: number; oportunidad: ClienteMin[] }
type Exhibicion = { id: number; cliente_id: number; hecha: boolean; fecha_hecha: string | null; confirmada_isola: boolean; fecha_confirmada: string | null; marca: 'osole' | 'renata'; clientes: { nombre_negocio: string; dia_visita: string | null } | null }
type Suc10Row = { vendedor: string; sucursal: string; puntos: number }
type OleQ4Item = { nombre: string; cuota: number; logro: number; activos: ClienteMin[]; inactivos: ClienteMin[] }
type Snapshot = {
  puesto_nacional: number | null; total_rdv: number | null; puntos_totales: number | null
  territorio_propio: number | null; territorio_rival: number | null; territorio_rival_nombre: string | null
  corte_fecha: string | null
  captaciones_mes: number | null; captaciones_lider: boolean | null
  volumen_jun: number | null; volumen_jul: number | null; volumen_ago: number | null
  facturacion_isola: number | null; cobranza_isola: number | null
}
const DROPSIZE_KEYWORDS: [string, string[]][] = [
  ['Osole - Aceitunas', ['aceituna']],
  ['GP - Baterías', ['pila', 'bateria']],
]

// las otras 4 "Categorías Clave" del acelerador de Activación (no llevan cuota, cuentan clientes activos)
const ACTIVACION_KEYWORDS: [string, string[]][] = [
  ['Ole - Pizza+', ['pizza']],
  ['Osole - Aceitunas', ['aceituna']],
  ['Ole - Aderezos', ['mayonesa ole', 'mostaza ole', 'ketchup ole', 'aderezar ole']],
  ['Osole - Compotas 150g', ['compota']],
]

function matchVolumen(visitas: VisitaMin[], kws: string[]) {
  let volumen = 0
  const clientes = new Set<number>()
  for (const v of visitas) {
    const prods = v.productos_pedidos || []
    for (const item of prods) {
      const nombre = (item.nombre || '').toLowerCase()
      if (kws.some(k => nombre.includes(k))) {
        volumen += item.cajas || 0
        clientes.add(v.cliente_id)
      }
    }
  }
  return { volumen, clientesActivos: clientes.size, idsActivos: clientes }
}

export default function Incentivo() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [cobranza, setCobranza] = useState<{ facturado: number; cobrado: number } | null>(null)
  const [dropsizes, setDropsizes] = useState<Dropsize[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [exhibiciones, setExhibiciones] = useState<Exhibicion[]>([])
  const [exhibExpandido, setExhibExpandido] = useState(false)
  const [exhibExpandidoRenata, setExhibExpandidoRenata] = useState(false)
  const [suc10, setSuc10] = useState<Suc10Row[]>([])
  const [oleQ4, setOleQ4] = useState<OleQ4Item[]>([])
  const [oleQ4Cartera, setOleQ4Cartera] = useState(0)
  const [expandidoOle, setExpandidoOle] = useState<string | null>(null)

  useEffect(() => {
    const periodo = periodoActual()
    const inicioMes = `${periodo}-01`

    Promise.all([
      supabase.from('incentivo_productos').select('*').eq('periodo', periodo).order('id'),
      supabase.from('visitas').select('cliente_id, productos_pedidos').gte('fecha', inicioMes),
      supabase.from('cobros').select('monto, estado').eq('origen', 'crm').gte('fecha_emision', inicioMes),
      supabase.from('clientes').select('id, nombre_negocio, dia_visita').in('status', ['activo', 'nuevo']).order('nombre_negocio'),
      supabase.from('incentivo_snapshot').select('*').eq('periodo', periodo).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('visitas').select('cliente_id, monto_pedido').eq('resultado', 'visita_efectiva'),
      supabase.from('incentivo_exhibiciones').select('id, cliente_id, hecha, fecha_hecha, confirmada_isola, fecha_confirmada, marca, clientes(nombre_negocio, dia_visita)').eq('candidato', true).order('id'),
      supabase.from('incentivo_suc10').select('vendedor, sucursal, puntos').eq('periodo', periodo).order('corte_fecha', { ascending: false }),
    ]).then(([prodRes, visRes, cobRes, cliRes, snapRes, valRes, exhibRes, suc10Res]) => {
      const productos = prodRes.data || []
      const visitas = (visRes.data || []) as VisitaMin[]
      const cobros = cobRes.data || []
      const clientesData = (cliRes.data || []) as ClienteMin[]
      setSnapshot(snapRes.data as Snapshot | null)
      const ordenDias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
      const exhibOrdenadas = ((exhibRes.data as unknown as Exhibicion[]) || []).slice().sort((a, b) => {
        const da = ordenDias.indexOf(a.clientes?.dia_visita || '')
        const db = ordenDias.indexOf(b.clientes?.dia_visita || '')
        return (da === -1 ? 99 : da) - (db === -1 ? 99 : db)
      })
      setExhibiciones(exhibOrdenadas)

      const vistos = new Set<string>()
      const suc10Latest = ((suc10Res.data as unknown as Suc10Row[]) || []).filter(r => {
        if (vistos.has(r.vendedor)) return false
        vistos.add(r.vendedor)
        return true
      }).sort((a, b) => b.puntos - a.puntos)
      setSuc10(suc10Latest)

      const valorPorCliente = new Map<number, number>()
      for (const v of (valRes.data || [])) {
        valorPorCliente.set(v.cliente_id, (valorPorCliente.get(v.cliente_id) || 0) + Number(v.monto_pedido || 0))
      }

      const calculadas: Fila[] = productos.map(p => {
        const kws: string[] = p.keyword.split(',').map((k: string) => k.trim().toLowerCase())
        const { volumen: logro } = matchVolumen(visitas, kws)
        const pvar = p.base_cuota > 0 ? ((logro - p.base_cuota) / p.base_cuota) * 100 : (logro > 0 ? 100 : 0)
        return { ...p, logro, pvar, puntos: puntosTabulador(pvar) }
      })
      setFilas(calculadas)

      const drops: Dropsize[] = DROPSIZE_KEYWORDS.map(([nombre, kws]) => {
        const { volumen, clientesActivos } = matchVolumen(visitas, kws)
        return { nombre, volumen, clientesActivos, dropsize: clientesActivos > 0 ? volumen / clientesActivos : 0 }
      })
      setDropsizes(drops)

      // 8 categorias clave: las 4 de volumen + las 4 de activacion, todas con lista de oportunidad
      // ordenada por lo que ese cliente ya te ha comprado historicamente (mayor potencial primero)
      const todasCategorias: [string, string[]][] = [
        ...productos.map(p => [p.producto, p.keyword.split(',').map((k: string) => k.trim().toLowerCase())] as [string, string[]]),
        ...ACTIVACION_KEYWORDS,
      ]
      const cats: Categoria[] = todasCategorias.map(([nombre, kws]) => {
        const { clientesActivos, idsActivos } = matchVolumen(visitas, kws)
        const oportunidad = clientesData
          .filter(c => !idsActivos.has(c.id))
          .sort((a, b) => (valorPorCliente.get(b.id) || 0) - (valorPorCliente.get(a.id) || 0))
        return { nombre, kws, clientesActivos, oportunidad }
      })
      setCategorias(cats)

      const oleItems: OleQ4Item[] = OLE_Q4_SKUS.map(([nombre, kws]) => {
        const cuotaRow = productos.find(p => p.producto === nombre)
        const { volumen, idsActivos } = matchVolumen(visitas, kws)
        const activos = clientesData.filter(c => idsActivos.has(c.id))
        const inactivos = clientesData
          .filter(c => !idsActivos.has(c.id))
          .sort((a, b) => (valorPorCliente.get(b.id) || 0) - (valorPorCliente.get(a.id) || 0))
        return { nombre, cuota: cuotaRow?.base_cuota ?? 50, logro: volumen, activos, inactivos }
      })
      setOleQ4(oleItems)
      setOleQ4Cartera(clientesData.length)

      const facturado = cobros.reduce((a, c) => a + Number(c.monto), 0)
      const cobrado = cobros.filter(c => c.estado === 'pagado').reduce((a, c) => a + Number(c.monto), 0)
      setCobranza({ facturado, cobrado })

      setCargando(false)
    })
  }, [])

  const totalPuntos = filas.reduce((a, f) => a + f.puntos, 0)
  const facturadoMostrar = snapshot?.facturacion_isola ?? cobranza?.facturado ?? 0
  const cobradoMostrar = snapshot?.cobranza_isola ?? cobranza?.cobrado ?? 0
  const pctCobranza = facturadoMostrar > 0 ? (cobradoMostrar / facturadoMostrar) * 100 : 0
  const exhibOsole = exhibiciones.filter(e => e.marca === 'osole')
  const exhibRenata = exhibiciones.filter(e => e.marca === 'renata')
  const exhibHechas = exhibOsole.filter(e => e.hecha)
  const exhibConfirmadas = exhibOsole.filter(e => e.confirmada_isola)
  const exhibPendientesValidar = exhibHechas.filter(e => !e.confirmada_isola)
  const puntosExhibConfirmados = exhibConfirmadas.length * 25
  const exhibHechasRenata = exhibRenata.filter(e => e.hecha)
  const exhibConfirmadasRenata = exhibRenata.filter(e => e.confirmada_isola)
  const exhibPendientesValidarRenata = exhibHechasRenata.filter(e => !e.confirmada_isola)
  const puntosExhibConfirmadosRenata = exhibConfirmadasRenata.length * 25

  async function marcarExhibicion(id: number, hecha: boolean) {
    const fecha_hecha = hecha ? hoy() : null
    setExhibiciones(prev => prev.map(e => e.id === id ? { ...e, hecha, fecha_hecha } : e))
    await supabase.from('incentivo_exhibiciones').update({ hecha, fecha_hecha }).eq('id', id)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-violet-400">🏆 Incentivo</h1>

      {oleQ4.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-amber-400">🍅 Concurso Olé Q4 — Oct-Nov 2026</h2>
            <span className="text-[11px] bg-amber-900/40 text-amber-300 px-2 py-1 rounded-full shrink-0">$200 · Grupo Miranda+Caracas Este</span>
          </div>
          <p className="text-xs text-slate-400">
            Premio &quot;mejor asesor del grupo&quot;: 80% volumen (40% c/u) + 20% activación (10% c/u) sobre tu cartera activa ({oleQ4Cartera} clientes). Cuota tentativa mientras ISOLA confirma la real.
          </p>

          {oleQ4.map(item => {
            const pctCumpl = item.cuota > 0 ? (item.logro / item.cuota) * 100 : 0
            const pctActiv = oleQ4Cartera > 0 ? (item.activos.length / oleQ4Cartera) * 100 : 0
            const keyAct = `${item.nombre}-activos`
            const keyInact = `${item.nombre}-inactivos`
            return (
              <div key={item.nombre} className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{item.nombre}</p>
                  <span className="text-xs text-slate-500">cuota tentativa: {item.cuota} cajas</span>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Volumen: <strong className="text-slate-200">{item.logro}</strong> / {item.cuota} cajas</span>
                    <span className={pctCumpl >= 100 ? 'text-green-400' : 'text-amber-400'}>{pctCumpl.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.min(pctCumpl, 100)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Activación: <strong className="text-slate-200">{item.activos.length}</strong> / {oleQ4Cartera} clientes</span>
                    <span className="text-blue-400">{pctActiv.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(pctActiv, 100)}%` }} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setExpandidoOle(expandidoOle === keyAct ? null : keyAct)}
                    className="flex-1 text-xs bg-green-950/40 hover:bg-green-900/40 text-green-400 border border-green-900/50 rounded-lg py-1.5">
                    ✅ {item.activos.length} activados
                  </button>
                  <button onClick={() => setExpandidoOle(expandidoOle === keyInact ? null : keyInact)}
                    className="flex-1 text-xs bg-red-950/30 hover:bg-red-900/30 text-red-400 border border-red-900/50 rounded-lg py-1.5">
                    ❌ {item.inactivos.length} sin activar
                  </button>
                </div>

                {expandidoOle === keyAct && (
                  <div className="border-t border-slate-800 pt-2 max-h-56 overflow-y-auto space-y-1">
                    {item.activos.length === 0 && <p className="text-xs text-slate-500">Ninguno todavía este mes.</p>}
                    {item.activos.map(c => (
                      <div key={c.id} className="flex justify-between text-sm">
                        <span className="text-slate-300 truncate">{c.nombre_negocio}</span>
                        <span className="text-xs text-slate-500 shrink-0 ml-2">{c.dia_visita || 'sin día'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {expandidoOle === keyInact && (
                  <div className="border-t border-slate-800 pt-2 max-h-56 overflow-y-auto space-y-1">
                    {item.inactivos.map(c => (
                      <div key={c.id} className="flex justify-between text-sm">
                        <span className="text-slate-300 truncate">{c.nombre_negocio}</span>
                        <span className="text-xs text-slate-500 shrink-0 ml-2">{c.dia_visita || 'sin día'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {MOSTRAR_TREN_VERANO && snapshot && (
        <>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Ranking nacional</p>
                <p className="text-2xl font-bold text-white">#{snapshot.puesto_nacional} <span className="text-sm font-normal text-slate-500">de {snapshot.total_rdv}</span></p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Puntos totales</p>
                <p className="text-2xl font-bold text-violet-400">{snapshot.puntos_totales}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <p className="font-semibold text-sm mb-2">🏍️ Territorio (SUC 10) — premio de la moto</p>
            <div className="flex items-center justify-between text-sm">
              <span className={(snapshot.territorio_propio ?? 0) >= (snapshot.territorio_rival ?? 0) ? 'text-green-400 font-bold' : 'text-slate-300'}>Isola Miranda: {snapshot.territorio_propio}</span>
              <span className={(snapshot.territorio_rival ?? 0) > (snapshot.territorio_propio ?? 0) ? 'text-red-400 font-bold' : 'text-slate-300'}>{snapshot.territorio_rival_nombre}: {snapshot.territorio_rival}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {(snapshot.territorio_rival ?? 0) > (snapshot.territorio_propio ?? 0)
                ? `Vas perdiendo por ${(snapshot.territorio_rival ?? 0) - (snapshot.territorio_propio ?? 0)} puntos`
                : `Vas ganando por ${(snapshot.territorio_propio ?? 0) - (snapshot.territorio_rival ?? 0)} puntos`}
            </p>
          </div>

          {suc10.length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <p className="font-semibold text-sm mb-2">📊 Posición de cada RDV — SUC10</p>
              <div className="space-y-3">
                {(['ISOLA MIRANDA', 'ISOLA CARACAS ESTE'] as const).map(suc => {
                  const filasSuc = suc10.filter(r => r.sucursal === suc)
                  const totalSuc = filasSuc.reduce((a, r) => a + r.puntos, 0)
                  return (
                    <div key={suc}>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span className="font-medium">{suc === 'ISOLA MIRANDA' ? '🔵 Isola Miranda' : '🔴 Isola Caracas Este'}</span>
                        <span>{totalSuc.toLocaleString()} pts</span>
                      </div>
                      <div className="space-y-1">
                        {filasSuc.map((r, i) => (
                          <div key={r.vendedor} className={`flex items-center justify-between text-sm rounded px-2 py-1 ${r.vendedor === 'DANIEL GUARAMATO' ? 'bg-violet-950/40 border border-violet-900/50' : ''}`}>
                            <span className={r.vendedor === 'DANIEL GUARAMATO' ? 'text-violet-300 font-semibold' : 'text-slate-300'}>{i + 1}. {r.vendedor}</span>
                            <span className="text-slate-400">{r.puntos.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <p className="text-xs text-amber-400/80 -mt-2">
            ⚠️ Datos del incentivo actualizados al {snapshot.corte_fecha?.split('-').reverse().join('/')} — pásame el Excel nuevo cuando lo tengas para actualizarlo.
          </p>

          {(snapshot.captaciones_mes != null || snapshot.volumen_ago != null) && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-2">
              <p className="font-semibold text-sm">📈 Tu tendencia</p>
              {snapshot.captaciones_mes != null && (
                <p className="text-sm text-slate-300">
                  Captaciones de agosto: <strong className="text-green-400">{snapshot.captaciones_mes} clientes nuevos</strong>
                  {snapshot.captaciones_lider && <span className="text-xs text-amber-400"> — líder de tu sucursal 🥇</span>}
                </p>
              )}
              {(snapshot.volumen_jun != null || snapshot.volumen_jul != null || snapshot.volumen_ago != null) && (
                <div className="flex items-end gap-3 pt-1">
                  {[['Jun', snapshot.volumen_jun], ['Jul', snapshot.volumen_jul], ['Ago*', snapshot.volumen_ago]].map(([mes, val]) => (
                    <div key={mes as string} className="text-center flex-1">
                      <div className="bg-violet-500/70 rounded-t mx-auto" style={{ height: `${Math.max(((val as number) || 0) / 8, 4)}px`, width: '70%' }} />
                      <p className="text-xs text-slate-400 mt-1">{mes}</p>
                      <p className="text-xs font-semibold text-slate-200">{val ?? '—'}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-500">*Agosto parcial · cajas de todas las categorías, no solo las 4 clave del incentivo</p>
            </div>
          )}
        </>
      )}

      {cargando && <p className="text-sm text-slate-500">Cargando...</p>}

      {!cargando && MOSTRAR_TREN_VERANO && (
        <>
          {filas.length > 0 && (
            <>
              <div className="bg-violet-950/30 rounded-xl p-4 border border-violet-900/50 flex items-center justify-between">
                <span className="text-sm font-semibold text-violet-300">🎯 Total puntos de volumen (mes)</span>
                <span className="text-2xl font-bold text-violet-300">{totalPuntos}</span>
              </div>

              <div className="space-y-2">
                {filas.map(f => (
                  <div key={f.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">{f.producto}</p>
                      <span className="text-xs bg-slate-800 px-2 py-1 rounded-full text-slate-300">{f.puntos} pts</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Logro: <strong className="text-slate-200">{f.logro}</strong> / base {f.base_cuota}</span>
                      <span className={f.pvar >= 0 ? 'text-green-400' : 'text-red-400'}>{f.pvar >= 0 ? '+' : ''}{f.pvar.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full transition-all"
                        style={{ width: `${Math.min(Math.max((f.logro / (f.base_cuota || 1)) * 100, 0), 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <p className="font-semibold text-sm mb-2">💰 Cobranza del mes (acelerador +100 pts si estás Top 10 nacional)</p>
            <p className="text-xs text-slate-400 mb-2">
              Facturado: ${facturadoMostrar.toFixed(0)} · Cobrado: ${cobradoMostrar.toFixed(0)}
              {snapshot?.facturacion_isola != null && <span className="text-slate-600"> (real ISOLA)</span>}
            </p>
            <div className="flex items-center justify-between">
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden flex-1 mr-3">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(pctCobranza, 100)}%` }} />
              </div>
              <span className="text-sm font-bold text-green-400">{pctCobranza.toFixed(0)}%</span>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
            <p className="font-semibold text-sm">📦 Dropsize (acelerador +100 pts si estás Top 10 nacional)</p>
            <p className="text-xs text-slate-500">Volumen ÷ clientes activos, solo Osole-Aceitunas y GP-Baterías.</p>
            {dropsizes.map(d => (
              <div key={d.nombre} className="flex items-center justify-between text-sm border-t border-slate-800 pt-2">
                <span className="text-slate-300">{d.nombre}</span>
                <span className="text-slate-400 text-xs">{d.volumen} cajas / {d.clientesActivos} cliente{d.clientesActivos === 1 ? '' : 's'} = <strong className="text-blue-400">{d.dropsize.toFixed(2)}</strong></span>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <p className="font-semibold text-sm mb-1">✅ Top Nacional Activación</p>
            <p className="text-xs text-slate-500">Clientes activos este mes en cada una de las 8 categorías clave (4 de volumen + 4 de activación). El RDV con más clientes en cada una gana +100 pts.</p>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <button onClick={() => setExhibExpandido(!exhibExpandido)} className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/40">
              <div>
                <p className="font-semibold text-sm text-amber-400">🖼️ Exhibición adicional Osole SPP</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {exhibHechas.length} de {exhibOsole.length} marcadas · <strong className="text-green-400">{exhibConfirmadas.length} confirmadas por ISOLA</strong> ({puntosExhibConfirmados} pts)
                  {exhibPendientesValidar.length > 0 && <> · <span className="text-amber-400">{exhibPendientesValidar.length} pendientes de validar</span></>}
                </p>
              </div>
              <span className="text-slate-500">{exhibExpandido ? '▲' : '▼'}</span>
            </button>
            {exhibExpandido && (
              <div className="border-t border-slate-800 p-3 max-h-96 overflow-y-auto space-y-1">
                <p className="text-[11px] text-slate-500 pb-2">+25 pts por cada exhibición confirmada en carnicería/punto de proteína. Márcala cuando la montes y la reportes a tu supervisor.</p>
                {exhibOsole.map(e => (
                  <label key={e.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                    <input type="checkbox" checked={e.hecha} onChange={ev => marcarExhibicion(e.id, ev.target.checked)}
                      className="w-4 h-4 accent-amber-500 shrink-0" />
                    <span className={e.hecha ? 'text-slate-500 line-through flex-1 truncate' : 'text-slate-300 flex-1 truncate'}>{e.clientes?.nombre_negocio || `Cliente #${e.cliente_id}`}</span>
                    {e.confirmada_isola
                      ? <span className="text-[10px] bg-green-950/50 text-green-400 border border-green-900/50 px-1.5 py-0.5 rounded-full shrink-0">✅ confirmada</span>
                      : e.hecha && <span className="text-[10px] bg-amber-950/50 text-amber-400 border border-amber-900/50 px-1.5 py-0.5 rounded-full shrink-0">🕐 sin validar</span>}
                    <span className="text-xs text-slate-500 shrink-0">{e.clientes?.dia_visita || ''}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <button onClick={() => setExhibExpandidoRenata(!exhibExpandidoRenata)} className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/40">
              <div>
                <p className="font-semibold text-sm text-pink-400">🖼️ Exhibición adicional Renata</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {exhibHechasRenata.length} de {exhibRenata.length} marcadas · <strong className="text-green-400">{exhibConfirmadasRenata.length} confirmadas por ISOLA</strong> ({puntosExhibConfirmadosRenata} pts)
                  {exhibPendientesValidarRenata.length > 0 && <> · <span className="text-amber-400">{exhibPendientesValidarRenata.length} pendientes de validar</span></>}
                </p>
              </div>
              <span className="text-slate-500">{exhibExpandidoRenata ? '▲' : '▼'}</span>
            </button>
            {exhibExpandidoRenata && (
              <div className="border-t border-slate-800 p-3 max-h-96 overflow-y-auto space-y-1">
                <p className="text-[11px] text-slate-500 pb-2">Exhibición adicional de línea Renata (galletas, sopas, mezclas para torta). Márcala cuando la montes y la reportes a tu supervisor.</p>
                {exhibRenata.map(e => (
                  <label key={e.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                    <input type="checkbox" checked={e.hecha} onChange={ev => marcarExhibicion(e.id, ev.target.checked)}
                      className="w-4 h-4 accent-pink-500 shrink-0" />
                    <span className={e.hecha ? 'text-slate-500 line-through flex-1 truncate' : 'text-slate-300 flex-1 truncate'}>{e.clientes?.nombre_negocio || `Cliente #${e.cliente_id}`}</span>
                    {e.confirmada_isola
                      ? <span className="text-[10px] bg-green-950/50 text-green-400 border border-green-900/50 px-1.5 py-0.5 rounded-full shrink-0">✅ confirmada</span>
                      : e.hecha && <span className="text-[10px] bg-amber-950/50 text-amber-400 border border-amber-900/50 px-1.5 py-0.5 rounded-full shrink-0">🕐 sin validar</span>}
                    <span className="text-xs text-slate-500 shrink-0">{e.clientes?.dia_visita || ''}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-200">📍 Oportunidades por categoría — ordenadas por el cliente que más te compra</p>
            {categorias.map(cat => (
              <div key={cat.nombre} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <button onClick={() => setExpandido(expandido === cat.nombre ? null : cat.nombre)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-800/40">
                  <div>
                    <p className="text-sm font-medium">{cat.nombre}</p>
                    <p className="text-xs text-slate-500">{cat.clientesActivos} compraron · {cat.oportunidad.length} sin comprar</p>
                  </div>
                  <span className="text-slate-500">{expandido === cat.nombre ? '▲' : '▼'}</span>
                </button>
                {expandido === cat.nombre && (
                  <div className="border-t border-slate-800 p-3 max-h-72 overflow-y-auto space-y-1">
                    {cat.oportunidad.map(c => (
                      <div key={c.id} className="flex justify-between text-sm">
                        <span className="text-slate-300 truncate">{c.nombre_negocio}</span>
                        <span className="text-xs text-slate-500 shrink-0 ml-2">{c.dia_visita || 'sin día'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
