'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
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

export default function FichaCliente() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [catalog, setCatalog] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase.from('visitas').select('*').eq('cliente_id', id).order('fecha', { ascending: false }).limit(20),
      supabase.from('productos').select('id,nombre,categoria').eq('activo', true).limit(500),
    ]).then(([c, v, p]) => {
      setCliente(c.data)
      setVisitas(v.data || [])
      setCatalog(p.data || [])
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400">Cargando...</div>
  if (!cliente) return <div className="text-center py-20 text-red-400">Cliente no encontrado</div>

  const analisis = analizar(visitas, catalog)
  const diaLabel: Record<string, string> = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes' }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">← Volver</button>
      </div>

      {/* Info cliente */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight">{cliente.nombre_negocio}</h1>
            {cliente.propietario && <p className="text-sm text-slate-400 mt-0.5">{cliente.propietario}</p>}
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
            cliente.status === 'activo' ? 'bg-green-900/40 text-green-400' :
            cliente.status === 'nuevo' ? 'bg-blue-900/40 text-blue-400' :
            'bg-slate-800 text-slate-400'
          }`}>{cliente.status}</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-sm">
          {cliente.dia_visita && <p><span className="text-slate-500">Día:</span> {diaLabel[cliente.dia_visita] ?? cliente.dia_visita}</p>}
          {cliente.zona && <p><span className="text-slate-500">Zona:</span> {cliente.zona}</p>}
          {cliente.hora_ideal_visita && <p><span className="text-slate-500">Horario:</span> {cliente.hora_ideal_visita}</p>}
          {cliente.telefono && <p><span className="text-slate-500">Tel:</span> {cliente.telefono}</p>}
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          {cliente.telefono && (
            <a href={`https://wa.me/${cliente.telefono.replace('+', '')}`} target="_blank" rel="noreferrer"
              className="bg-green-800/40 hover:bg-green-700/40 text-green-400 px-3 py-1.5 rounded-lg text-xs">
              📱 WhatsApp
            </a>
          )}
          <Link href={`/visita?cliente_id=${cliente.id}`}
            className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
            📋 Registrar visita
          </Link>
        </div>
      </div>

      {/* SUGERENCIAS */}
      <div className={`rounded-xl p-4 border ${analisis.sinCompra ? 'bg-red-950/40 border-red-900/50' : 'bg-violet-950/40 border-violet-900/50'}`}>
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          🧠 Sugerencias antes de entrar
          {analisis.sinCompra && <span className="text-xs bg-red-900/60 text-red-300 px-2 py-0.5 rounded-full">Sin compras</span>}
        </h2>

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
              <p className="text-sm text-slate-300">→ Pregúntale qué productos le rotan más rápido en su negocio</p>
              <p className="text-sm text-slate-300">→ Lleva 2-3 productos físicos para que los vea</p>
              <p className="text-sm text-slate-300">→ Menciona que otros negocios del sector ya los compran</p>
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

      {/* Historial */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
        <h2 className="font-semibold mb-3">Historial de visitas</h2>
        {visitas.length === 0
          ? <p className="text-slate-500 text-sm">Sin visitas registradas.</p>
          : <div className="space-y-2">
              {visitas.map(v => {
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
    </div>
  )
}
