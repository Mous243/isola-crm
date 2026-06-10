'use client'
import { useEffect, useState } from 'react'
import { supabase, type Cliente, type Visita, type Producto } from '@/lib/supabase'

const CATS_CATALOG_ORDER = [
  'Compotas', 'Galletas', 'Pastas', 'Salsas OLE', 'Condimentos',
  'Confitería', 'Wafers', 'Crackers', 'Galletas Sandwich', 'Bebidas',
  'Conservas Vegetales', 'Conservas Dulces', 'Aceitunas', 'Tortas',
  'Mini Tortas', 'Mezclas Torta', 'Sopas', 'Aceites', 'Café', 'Electrónica',
]

function findCategory(productName: string, catalog: Producto[]): string | null {
  const words = new Set(productName.toLowerCase().split(/\s+/))
  let bestCat: string | null = null
  let bestScore = 0
  for (const p of catalog) {
    const catWords = new Set(p.nombre.toLowerCase().split(/\s+/))
    const score = [...words].filter(w => catWords.has(w)).length
    if (score > bestScore) { bestScore = score; bestCat = p.categoria }
  }
  return bestScore >= 2 ? bestCat : null
}

function ejemploProducto(cat: string, catalog: Producto[]): string {
  const p = catalog.find(x => x.categoria === cat)
  if (!p) return ''
  return p.nombre.length > 42 ? p.nombre.slice(0, 42) + '...' : p.nombre
}

function analizar(visitas: Visita[], catalog: Producto[]) {
  const conPedido = visitas.filter(v => (v.monto_pedido || 0) > 0)
  if (!conPedido.length) {
    return { sinCompra: true, visitasTotal: visitas.length, catsCompradas: new Set<string>(), catsFaltantes: [] as string[], ticketProm: 0, productosTop: [] as string[] }
  }
  const catsCompradas = new Set<string>()
  const prodCount: Record<string, number> = {}
  for (const v of conPedido) {
    for (const p of (v.productos_pedidos as any[] || [])) {
      const nombre = p.nombre || ''
      prodCount[nombre] = (prodCount[nombre] || 0) + 1
      const cat = findCategory(nombre, catalog)
      if (cat) catsCompradas.add(cat)
    }
  }
  const catsFaltantes = CATS_CATALOG_ORDER.filter(c => !catsCompradas.has(c)).slice(0, 4)
  const ticketProm = conPedido.reduce((a, v) => a + (v.monto_pedido || 0), 0) / conPedido.length
  const productosTop = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n)
  return { sinCompra: false, visitasTotal: visitas.length, catsCompradas, catsFaltantes, ticketProm, productosTop }
}

interface Props {
  clienteId: number
  onClose: () => void
}

export default function ClienteFichaModal({ clienteId, onClose }: Props) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [catalog, setCatalog] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [analisisIA, setAnalisisIA] = useState<string | null>(null)
  const [loadingIA, setLoadingIA] = useState(false)
  const [errorIA, setErrorIA] = useState<string | null>(null)
  const [iaIntentada, setIaIntentada] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('*').eq('id', clienteId).single(),
      supabase.from('visitas').select('*').eq('cliente_id', clienteId).order('fecha', { ascending: false }).limit(20),
      supabase.from('productos').select('id,nombre,categoria').eq('activo', true).limit(500),
    ]).then(([c, v, p]) => {
      const clienteData = c.data
      const visitasData = v.data || []
      setCliente(clienteData)
      setVisitas(visitasData)
      setCatalog(p.data || [])
      setLoading(false)

      const tieneNotas = visitasData.some((v: any) => v.notas_visita?.trim())
      if (tieneNotas && clienteData) {
        setIaIntentada(true)
        setLoadingIA(true)
        fetch('/api/analisis-ia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cliente: clienteData, visitas: visitasData }),
        })
          .then(r => r.json())
          .then(d => {
            if (d.error) setErrorIA(d.error)
            setAnalisisIA(d.analisis)
            setLoadingIA(false)
          })
          .catch((e) => { setErrorIA(String(e)); setLoadingIA(false) })
      }
    })
  }, [clienteId])

  const analisis = !loading && cliente ? analizar(visitas, catalog) : null

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-slate-950 border border-slate-700 rounded-t-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header fijo */}
        <div className="sticky top-0 bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <h2 className="font-bold text-violet-400 text-sm">🧠 Ficha del cliente</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {loading && <p className="text-slate-400 text-sm text-center py-8">Cargando ficha...</p>}

          {!loading && cliente && analisis && (
            <>
              {/* Info básica */}
              <div>
                <p className="font-semibold text-white">{cliente.nombre_negocio}</p>
                {cliente.propietario && <p className="text-xs text-slate-400">{cliente.propietario}</p>}
                <p className="text-xs text-slate-500 mt-0.5">
                  📅 Última visita: <span className="text-white">{cliente.fecha_ultima_visita || 'Nunca'}</span>
                </p>
                {cliente.hora_ideal_visita && (
                  <p className="text-xs text-slate-500 mt-0.5">⏰ Mejor hora: {cliente.hora_ideal_visita}</p>
                )}
              </div>

              {/* Análisis IA */}
              {iaIntentada && (
                <div className="rounded-xl p-4 border bg-amber-950/30 border-amber-700/40">
                  <p className="text-xs font-semibold text-amber-400 mb-2">🤖 Análisis IA — basado en tus notas</p>
                  {loadingIA
                    ? <p className="text-xs text-slate-400 animate-pulse">Analizando notas...</p>
                    : errorIA
                    ? <p className="text-xs text-red-400">Error: {errorIA}</p>
                    : analisisIA
                    ? <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{analisisIA}</div>
                    : <p className="text-xs text-slate-400">No se generó análisis para este cliente.</p>
                  }
                </div>
              )}

              {/* Sugerencias */}
              <div className={`rounded-xl p-4 border ${analisis.sinCompra ? 'bg-red-950/40 border-red-900/50' : 'bg-violet-950/40 border-violet-900/50'}`}>
                <p className="font-semibold text-sm mb-3 flex items-center gap-2">
                  Sugerencias antes de entrar
                  {analisis.sinCompra && <span className="text-xs bg-red-900/60 text-red-300 px-2 py-0.5 rounded-full">Sin compras</span>}
                </p>

                {analisis.sinCompra ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-300">
                      {analisis.visitasTotal === 0
                        ? 'Primera visita — no hay historial aún.'
                        : `${analisis.visitasTotal} visita${analisis.visitasTotal > 1 ? 's' : ''} sin pedido todavía.`}
                    </p>
                    <div className="bg-slate-900/60 rounded-lg p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-yellow-400">Productos de entrada recomendados</p>
                      <p className="text-sm">→ <span className="text-white">COMPOTA DE MANZANA 100gr</span> <span className="text-slate-400 text-xs">(alta rotación, ~$12 caja)</span></p>
                      <p className="text-sm">→ <span className="text-white">GALLETAS RENATA CHOCOLATE 40g</span> <span className="text-slate-400 text-xs">(muy pedidas)</span></p>
                    </div>
                    <div className="bg-slate-900/60 rounded-lg p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-blue-400">Táctica de conversión</p>
                      <p className="text-sm text-slate-300">→ Pregúntale qué productos le rotan más rápido</p>
                      <p className="text-sm text-slate-300">→ Lleva 2-3 productos físicos para que los vea</p>
                      <p className="text-sm text-slate-300">→ Empieza con el ticket más bajo para generar confianza</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-3 text-sm">
                      <div className="bg-slate-900/60 rounded-lg p-2.5 flex-1 text-center">
                        <p className="text-lg font-bold text-violet-400">{analisis.visitasTotal}</p>
                        <p className="text-xs text-slate-500">compras</p>
                      </div>
                      <div className="bg-slate-900/60 rounded-lg p-2.5 flex-1 text-center">
                        <p className="text-lg font-bold text-green-400">${analisis.ticketProm.toFixed(0)}</p>
                        <p className="text-xs text-slate-500">ticket prom.</p>
                      </div>
                      <div className="bg-slate-900/60 rounded-lg p-2.5 flex-1 text-center">
                        <p className="text-lg font-bold text-blue-400">{analisis.catsCompradas.size}</p>
                        <p className="text-xs text-slate-500">categorías</p>
                      </div>
                    </div>

                    {analisis.productosTop.length > 0 && (
                      <div className="bg-slate-900/60 rounded-lg p-3 space-y-1">
                        <p className="text-xs font-semibold text-green-400">Siempre pide</p>
                        {analisis.productosTop.map((p, i) => (
                          <p key={i} className="text-sm text-slate-300">✓ {p.length > 48 ? p.slice(0, 48) + '...' : p}</p>
                        ))}
                      </div>
                    )}

                    {analisis.catsFaltantes.length > 0 && (
                      <div className="bg-slate-900/60 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-yellow-400">Categorías que nunca ha comprado — oportunidades</p>
                        {analisis.catsFaltantes.map(cat => {
                          const ej = ejemploProducto(cat, catalog)
                          return (
                            <div key={cat}>
                              <p className="text-sm font-medium text-white">{cat}</p>
                              {ej && <p className="text-xs text-slate-400 ml-2">→ {ej}</p>}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {analisis.catsCompradas.size > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1.5">Categorías activas</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[...analisis.catsCompradas].map(cat => (
                            <span key={cat} className="bg-violet-900/40 text-violet-300 text-xs px-2 py-0.5 rounded-full">{cat}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Historial reciente */}
              <div>
                <p className="text-xs text-slate-400 font-medium mb-2">Historial reciente</p>
                {visitas.length === 0
                  ? <p className="text-slate-500 text-sm">Sin visitas registradas.</p>
                  : <div className="space-y-2">
                      {visitas.slice(0, 5).map(v => {
                        const conPedido = (v.monto_pedido || 0) > 0
                        const prods = (v.productos_pedidos as any[]) || []
                        return (
                          <div key={v.id} className={`rounded-lg p-3 border-l-4 ${conPedido ? 'bg-green-950/30 border-l-green-500' : 'bg-slate-800/50 border-l-slate-600'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">{v.fecha}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${conPedido ? 'bg-green-900/40 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                                  {v.resultado}
                                </span>
                              </div>
                              {conPedido && <span className="text-sm font-medium text-green-400">${v.monto_pedido?.toFixed(2)}</span>}
                            </div>
                            {prods.length > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                {prods.map((p: any, i: number) => (
                                  <p key={i} className="text-xs text-slate-400">· {p.nombre} ({p.cajas} caja{p.cajas > 1 ? 's' : ''})</p>
                                ))}
                              </div>
                            )}
                            {v.notas_visita && <p className="text-xs text-slate-500 mt-1 italic">{v.notas_visita}</p>}
                          </div>
                        )
                      })}
                    </div>
                }
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
