'use client'
import { useEffect, useState } from 'react'
import { supabase, type PlanTrabajo } from '@/lib/supabase'

type Tipo = 'mensual' | 'semanal' | 'diario'

const TABS: [Tipo, string, string][] = [
  ['mensual', 'Mes', '🗓️'],
  ['semanal', 'Semana', '📅'],
  ['diario', 'Hoy', '☀️'],
]

export default function Planificacion() {
  const [planes, setPlanes] = useState<PlanTrabajo[]>([])
  const [tab, setTab] = useState<Tipo>('diario')
  const [expandidoHist, setExpandidoHist] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('planes_trabajo').select('*').order('fecha_inicio', { ascending: false })
      .then(({ data }) => setPlanes(data || []))
  }, [])

  const delTipo = planes.filter(p => p.tipo === tab)
  const actual = delTipo[0]
  const historial = delTipo.slice(1)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-violet-400">🎯 Planificación</h1>
      <p className="text-sm text-slate-400">
        Plan mensual (inicio de mes), semanal (cada domingo) y diario (cada mañana), armado a partir de la cartera + situación país.
      </p>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(([val, label, icon]) => (
          <button key={val} onClick={() => setTab(val)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === val ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {!actual && (
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 text-center text-slate-400 text-sm">
          Todavía no hay plan {tab} generado.
        </div>
      )}

      {actual && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-4">
          <div>
            <p className="font-semibold text-base">{actual.titulo}</p>
            <p className="text-xs text-slate-500 mt-0.5">{actual.fecha_inicio} → {actual.fecha_fin}</p>
            {actual.resumen && <p className="text-sm text-slate-300 mt-2">{actual.resumen}</p>}
          </div>

          {actual.contexto?.situacion_pais && (
            <div className="bg-amber-950/30 rounded-lg p-3 border border-amber-900/50">
              <p className="text-xs font-semibold text-amber-400 mb-1">🌎 Situación país</p>
              <p className="text-sm text-slate-300">{actual.contexto.situacion_pais}</p>
            </div>
          )}

          {actual.contexto?.festividades && actual.contexto.festividades.length > 0 && (
            <div className="bg-blue-950/30 rounded-lg p-3 border border-blue-900/50">
              <p className="text-xs font-semibold text-blue-400 mb-2">🎉 Feriados / fechas clave</p>
              <div className="space-y-1">
                {actual.contexto.festividades.map((f, i) => (
                  <div key={i} className="flex justify-between text-sm gap-2">
                    <span className="text-slate-300">{f.nombre}</span>
                    <span className="text-slate-500 text-xs shrink-0">{f.fecha}{f.impacto ? ` · ${f.impacto}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {actual.contexto?.vacaciones_escolares && (
            <p className="text-xs text-slate-400">🏫 <strong className="text-slate-300">Vacaciones escolares:</strong> {actual.contexto.vacaciones_escolares}</p>
          )}

          {actual.contenido?.secciones?.map((s, i) => (
            <div key={i} className="border-t border-slate-800 pt-3">
              <p className="text-sm font-semibold text-slate-200 mb-1.5">{s.titulo}</p>
              {s.texto && <p className="text-sm text-slate-400 whitespace-pre-line">{s.texto}</p>}
              {s.items && (
                <ul className="space-y-1">
                  {s.items.map((it, j) => (
                    <li key={j} className="text-sm text-slate-400 flex gap-2">
                      <span className="text-slate-600 shrink-0">→</span>{it}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {actual.contexto?.fuentes && actual.contexto.fuentes.length > 0 && (
            <p className="text-[11px] text-slate-600 border-t border-slate-800 pt-2">
              Fuentes: {actual.contexto.fuentes.join(' · ')}
            </p>
          )}
        </div>
      )}

      {historial.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Historial</p>
          {historial.map(p => (
            <div key={p.id} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <button onClick={() => setExpandidoHist(expandidoHist === p.id ? null : p.id)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-800/40">
                <div>
                  <p className="text-sm font-medium">{p.titulo}</p>
                  <p className="text-xs text-slate-500">{p.fecha_inicio} → {p.fecha_fin}</p>
                </div>
                <span className="text-slate-500">{expandidoHist === p.id ? '▲' : '▼'}</span>
              </button>
              {expandidoHist === p.id && (
                <div className="border-t border-slate-800 p-3 space-y-3">
                  {p.resumen && <p className="text-sm text-slate-300">{p.resumen}</p>}
                  {p.contenido?.secciones?.map((s, i) => (
                    <div key={i}>
                      <p className="text-sm font-semibold text-slate-200 mb-1">{s.titulo}</p>
                      {s.texto && <p className="text-sm text-slate-400 whitespace-pre-line">{s.texto}</p>}
                      {s.items && (
                        <ul className="space-y-1">
                          {s.items.map((it, j) => <li key={j} className="text-sm text-slate-400">→ {it}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
