'use client'
import { useEffect, useState } from 'react'
import { supabase, type Cobro } from '@/lib/supabase'

const TOLERANCIA_MONTO = 2 // USD de diferencia permitida para considerarlo "el mismo" cobro
const TOLERANCIA_DIAS = 15 // dias de diferencia en fecha_emision para intentar el cruce

type Par = { crm: Cobro; cxc: Cobro; diffMonto: number }

function diasEntre(a?: string, b?: string): number {
  if (!a || !b) return 9999
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000)
}

export default function Conciliacion() {
  const [coinciden, setCoinciden] = useState<Par[]>([])
  const [diferencias, setDiferencias] = useState<Par[]>([])
  const [soloEnCxc, setSoloEnCxc] = useState<Cobro[]>([])
  const [soloEnCrm, setSoloEnCrm] = useState<Cobro[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase.from('cobros').select('*, clientes(nombre_negocio)')
      .in('estado', ['pendiente'])
      .then(({ data }) => {
        const todos = data || []
        const crm = todos.filter(c => c.origen === 'crm')
        const cxc = todos.filter(c => c.origen === 'isola_cxc')

        const crmUsados = new Set<number>()
        const okPares: Par[] = []
        const diffPares: Par[] = []
        const cxcSinMatch: Cobro[] = []

        for (const c of cxc) {
          const candidatos = crm.filter(r =>
            !crmUsados.has(r.id) &&
            r.cliente_id === c.cliente_id &&
            diasEntre(r.fecha_emision, c.fecha_emision) <= TOLERANCIA_DIAS
          )
          if (candidatos.length === 0) { cxcSinMatch.push(c); continue }
          candidatos.sort((a, b) => Math.abs(Number(a.monto) - Number(c.monto)) - Math.abs(Number(b.monto) - Number(c.monto)))
          const mejor = candidatos[0]
          crmUsados.add(mejor.id)
          const diffMonto = Math.abs(Number(mejor.monto) - Number(c.monto))
          const par: Par = { crm: mejor, cxc: c, diffMonto }
          if (diffMonto <= TOLERANCIA_MONTO) okPares.push(par)
          else diffPares.push(par)
        }

        const crmSinMatch = crm.filter(r => !crmUsados.has(r.id))

        setCoinciden(okPares)
        setDiferencias(diffPares)
        setSoloEnCxc(cxcSinMatch)
        setSoloEnCrm(crmSinMatch)
        setCargando(false)
      })
  }, [])

  const nombre = (c: Cobro) => (c.clientes as { nombre_negocio?: string } | undefined)?.nombre_negocio || '?'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-violet-400">🔍 Conciliación CxC</h1>
      <p className="text-sm text-slate-400">
        Cruza lo que tienes registrado (origen tuyo) contra el último CxC de ISOLA cargado, por cliente + monto parecido (±${TOLERANCIA_MONTO}) + fecha cercana (±{TOLERANCIA_DIAS}d).
      </p>

      {cargando && <p className="text-sm text-slate-500">Cargando...</p>}

      {!cargando && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-950/30 rounded-xl p-3 border border-green-900/50 text-center">
              <p className="text-2xl font-bold text-green-400">{coinciden.length}</p>
              <p className="text-xs text-slate-400">✅ Coinciden</p>
            </div>
            <div className="bg-yellow-950/30 rounded-xl p-3 border border-yellow-900/50 text-center">
              <p className="text-2xl font-bold text-yellow-400">{diferencias.length}</p>
              <p className="text-xs text-slate-400">⚠️ Monto distinto</p>
            </div>
            <div className="bg-red-950/30 rounded-xl p-3 border border-red-900/50 text-center">
              <p className="text-2xl font-bold text-red-400">{soloEnCxc.length}</p>
              <p className="text-xs text-slate-400">❌ Solo en CxC de ISOLA</p>
            </div>
            <div className="bg-blue-950/30 rounded-xl p-3 border border-blue-900/50 text-center">
              <p className="text-2xl font-bold text-blue-400">{soloEnCrm.length}</p>
              <p className="text-xs text-slate-400">📋 Solo en tu CRM</p>
            </div>
          </div>

          {diferencias.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-yellow-400">⚠️ Monto o factura no coincide ({diferencias.length})</p>
              {diferencias.map(({ crm, cxc, diffMonto }) => (
                <div key={crm.id + '-' + cxc.id} className="bg-slate-900 rounded-xl border border-yellow-900/40 p-3 text-sm space-y-1">
                  <p className="font-medium">{nombre(crm)}</p>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Tu registro: {crm.moneda} {Number(crm.monto).toFixed(2)} · {crm.descripcion}</span>
                    <span>CxC ISOLA: {cxc.moneda} {Number(cxc.monto).toFixed(2)} · doc {cxc.nro_documento_isola}</span>
                  </div>
                  <p className="text-xs text-yellow-500">Diferencia: ${diffMonto.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}

          {soloEnCxc.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-400">❌ ISOLA dice que existe, tú no lo tienes registrado ({soloEnCxc.length})</p>
              {soloEnCxc.map(c => (
                <div key={c.id} className="bg-slate-900 rounded-xl border border-red-900/40 p-3 text-sm">
                  <p className="font-medium">{nombre(c)}</p>
                  <p className="text-xs text-slate-400">{c.moneda} {Number(c.monto).toFixed(2)} · doc {c.nro_documento_isola} · emitido {c.fecha_emision}</p>
                </div>
              ))}
            </div>
          )}

          {soloEnCrm.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-blue-400">📋 Tú lo tienes, ISOLA no lo refleja en el último CxC ({soloEnCrm.length})</p>
              {soloEnCrm.map(c => (
                <div key={c.id} className="bg-slate-900 rounded-xl border border-blue-900/40 p-3 text-sm">
                  <p className="font-medium">{nombre(c)}</p>
                  <p className="text-xs text-slate-400">{c.moneda} {Number(c.monto).toFixed(2)} · {c.descripcion} · emitido {c.fecha_emision}</p>
                </div>
              ))}
            </div>
          )}

          {diferencias.length === 0 && soloEnCxc.length === 0 && soloEnCrm.length === 0 && (
            <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 text-center text-slate-400 text-sm">
              {coinciden.length > 0 ? 'Todo cuadra 🎉' : 'Aún no hay CxC de ISOLA cargado para comparar.'}
            </div>
          )}
        </>
      )}
    </div>
  )
}
