'use client'
import { useEffect, useState } from 'react'
import { supabase, type Producto } from '@/lib/supabase'

export default function Catalogo() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [catSel, setCatSel] = useState('Todas')
  const [buscar, setBuscar] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('productos').select('*').order('categoria').order('nombre')
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); return }
        const activos = (data || []).filter((p: Producto) => p.activo !== false)
        setProductos(activos)
        const cats = [...new Set(activos.map((p: Producto) => p.categoria))]
        setCategorias(cats)
      })
  }, [])

  const filtrados = productos.filter(p => {
    const matchCat = catSel === 'Todas' || p.categoria === catSel
    const matchBuscar = !buscar || p.nombre.toLowerCase().includes(buscar.toLowerCase())
    return matchCat && matchBuscar
  })

  const resumen = categorias.map(cat => {
    const ps = productos.filter(p => p.categoria === cat)
    return {
      cat,
      total: ps.length,
      minUnd: Math.min(...ps.map(p => p.precio_und || 0)),
      maxUnd: Math.max(...ps.map(p => p.precio_und || 0)),
    }
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-violet-400">Catálogo ISOLA</h1>
      <p className="text-xs text-slate-500">{productos.length} productos · {categorias.length} categorías</p>
      {error && <p className="text-red-400 text-xs bg-red-950/40 p-2 rounded">{error}</p>}

      <input value={buscar} onChange={e => setBuscar(e.target.value)}
        placeholder="Buscar producto..."
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['Todas', ...categorias].map(cat => (
          <button key={cat} onClick={() => setCatSel(cat)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${catSel === cat ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Resumen por categoría cuando no hay búsqueda */}
      {!buscar && catSel === 'Todas' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {resumen.map(r => (
            <button key={r.cat} onClick={() => setCatSel(r.cat)}
              className="bg-slate-900 border border-slate-800 hover:border-violet-700/50 rounded-xl p-3 text-left transition-colors">
              <p className="font-medium text-sm">{r.cat}</p>
              <p className="text-xs text-slate-500 mt-0.5">{r.total} productos</p>
              <p className="text-xs text-violet-400 mt-1">${r.minUnd.toFixed(2)} – ${r.maxUnd.toFixed(2)}/und</p>
            </button>
          ))}
        </div>
      )}

      {/* Lista de productos */}
      {(buscar || catSel !== 'Todas') && (
        <div className="space-y-1">
          {filtrados.length === 0
            ? <p className="text-slate-400 text-center py-8">Sin resultados</p>
            : filtrados.map(p => (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p.nombre}</p>
                    <p className="text-xs text-slate-500">{p.categoria}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-violet-400 font-medium text-sm">${(p.precio_und || 0).toFixed(2)}<span className="text-slate-500 font-normal">/und</span></p>
                    <p className="text-xs text-slate-500">${(p.precio_caja || 0).toFixed(2)}/caja ({p.und_caja}u)</p>
                  </div>
                </div>
              ))
          }
        </div>
      )}
    </div>
  )
}
