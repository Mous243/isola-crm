'use client'
import { useState } from 'react'

// Sprint de fin de año — corte del archivo "Sprint de fin de año.xlsx" (02/11/2026), hojas RANKING, SUC,
// VD VOLUMEN y VD ACTIVACION, filas de DANIEL GUARAMATO / ISOLA MIRANDA. Son cifras oficiales de ISOLA
// (no se calculan desde el CRM: aún no hay bases del concurso). Para un corte nuevo, reemplazar este objeto.
const CORTE = '02/11/2026'

const RDV = { puesto: 11, de: 214, total: 805, ptsAct: 45, ptsVol: 0, accOle: 680, accOsole: 80, lider: 1880, puesto10: 850 }

const VOLUMEN = [
  { cat: 'Osole SPP', base: 170, logro: 57, pts: 0 },
  { cat: 'Osole BPC', base: 25, logro: 18, pts: 0 },
  { cat: 'Olé CMP', base: 20, logro: 2, pts: 0 },
  { cat: 'Galo Pastas', base: 90, logro: 70, pts: 0 },
]

const ACTIVACION = [
  { cat: 'Osole SPP', logro: 15, pts: 0 },
  { cat: 'Osole CMP', logro: 34, pts: 15 },
  { cat: 'Osole MML', logro: 1, pts: 0 },
  { cat: 'Osole BPC', logro: 9, pts: 0 },
  { cat: 'Olé SPP', logro: 42, pts: 20 },
  { cat: 'Olé CMP', logro: 2, pts: 0 },
  { cat: 'GP Baterías', logro: 24, pts: 10 },
  { cat: 'Galo Pastas', logro: 12, pts: 0 },
]
const CARTERA_ACT = 100

const SUCURSAL = { nombre: 'Miranda', grupo: 'B', puesto: 3, de: 8, total: 935.9, lider: 'Monagas', liderTotal: 1281, segundo: 'Falcón', segundoTotal: 955.8 }
const UNO_A_UNO = [
  { nombre: 'Atomatados 1:1', puesto: 1, de: 20, ole: 158, osole: 216, pct: 73.1 },
  { nombre: 'Compotas 1:1', puesto: 10, de: 20, ole: 78, osole: 312, pct: 25.0 },
]

export default function SprintFinAno() {
  const [abierto, setAbierto] = useState(true)
  const faltaTop10 = RDV.puesto10 - RDV.total
  const activacionesOrdenadas = [...ACTIVACION].sort((a, b) => b.logro - a.logro)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-emerald-400">🎄 Sprint de fin de año</h2>
        <span className="text-[11px] bg-emerald-900/40 text-emerald-300 px-2 py-1 rounded-full shrink-0">corte {CORTE}</span>
      </div>
      <p className="text-xs text-slate-400">
        Cifras oficiales del archivo de ISOLA (no salen de tus pedidos del CRM). Todavía no tenemos las bases del concurso, por eso solo se muestra lo que dice el reporte.
      </p>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-slate-500">Ranking nacional</p>
            <p className="text-3xl font-bold text-emerald-400">#{RDV.puesto} <span className="text-sm text-slate-500 font-normal">de {RDV.de} RDV</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Puntos</p>
            <p className="text-3xl font-bold">{RDV.total}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ['Activación', RDV.ptsAct], ['Volumen', RDV.ptsVol], ['Acc. Olé', RDV.accOle], ['Acc. Osole', RDV.accOsole],
          ].map(([l, v]) => (
            <div key={l as string} className="bg-slate-800/60 rounded-lg py-2">
              <p className="text-base font-semibold">{v}</p>
              <p className="text-[10px] text-slate-500">{l}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          Para entrar al top 10 te faltan <strong className="text-amber-400">{faltaTop10} pts</strong> (el #10 tiene {RDV.puesto10}). El líder va en {RDV.lider}. Lo que más pesa en tu total son las acciones Olé ({RDV.accOle} pts); volumen aún no suma nada.
        </p>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <button onClick={() => setAbierto(!abierto)} className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/40">
          <p className="font-semibold text-sm text-emerald-400">Detalle por categoría</p>
          <span className="text-slate-500">{abierto ? '▲' : '▼'}</span>
        </button>
        {abierto && (
          <div className="border-t border-slate-800 p-4 space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-300">Volumen (logro / base, cajas)</p>
              {VOLUMEN.map(v => {
                const pct = (v.logro / v.base) * 100
                return (
                  <div key={v.cat}>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>{v.cat}: <strong className="text-slate-200">{v.logro}</strong> / {v.base} · faltan {v.base - v.logro}</span>
                      <span className="text-amber-400">{pct.toFixed(0)}% · {v.pts} pts</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-300">Activación (clientes activos sobre {CARTERA_ACT} de cartera)</p>
              {activacionesOrdenadas.map(a => {
                const pct = (a.logro / CARTERA_ACT) * 100
                return (
                  <div key={a.cat}>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>{a.cat}: <strong className="text-slate-200">{a.logro}</strong> clientes</span>
                      <span className={a.pts > 0 ? 'text-green-400' : 'text-blue-400'}>{pct.toFixed(0)}% · {a.pts} pts</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${a.pts > 0 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
              <p className="text-[11px] text-slate-500">Hoy puntúan Olé SPP (20), Osole CMP (15) y GP Baterías (10). Las que están por debajo del 20% todavía no suman.</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Sucursal {SUCURSAL.nombre} — Grupo {SUCURSAL.grupo}</p>
          <span className="text-emerald-400 font-bold">#{SUCURSAL.puesto} <span className="text-xs text-slate-500 font-normal">de {SUCURSAL.de}</span></span>
        </div>
        <p className="text-xs text-slate-400">
          {SUCURSAL.total} pts. Delante: {SUCURSAL.lider} ({SUCURSAL.liderTotal}) y {SUCURSAL.segundo} ({SUCURSAL.segundoTotal}), a {(SUCURSAL.segundoTotal - SUCURSAL.total).toFixed(1)} pts del segundo puesto.
        </p>
        {UNO_A_UNO.map(u => (
          <div key={u.nombre} className="flex items-center justify-between text-xs bg-slate-800/50 rounded-lg px-3 py-2">
            <span className="text-slate-300">{u.nombre} <span className="text-slate-500">(Olé {u.ole} / Osole {u.osole})</span></span>
            <span className={u.puesto <= 3 ? 'text-green-400' : 'text-slate-300'}>{u.pct.toFixed(1)}% · #{u.puesto}/{u.de}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
