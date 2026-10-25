'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type NC = {
  id: number
  cobro_id: number | null
  codigo: string | null
  cliente: string
  factura: string | null
  monto: number
  nc: number
  negociacion: string
  observacion: string | null
  estado: 'pendiente' | 'enviada'
  fecha_envio: string | null
}

const TITULO = 'SOLICITUD DE APROBACIÓN DE NC POR VOLUMEN'
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })
const r2 = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function NotasCredito() {
  const [filas, setFilas] = useState<NC[]>([])
  const [vista, setVista] = useState<'pendiente' | 'enviada'>('pendiente')
  const [cargando, setCargando] = useState(true)

  const cargar = async () => {
    const { data } = await supabase.from('solicitudes_nc').select('*').order('created_at')
    setFilas((data || []) as NC[])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const lista = filas.filter(f => f.estado === vista)
  const totMonto = lista.reduce((a, f) => a + f.monto, 0)
  const totNC = lista.reduce((a, f) => a + f.nc, 0)

  const cambiar = (id: number, campo: Partial<NC>) =>
    setFilas(prev => prev.map(f => f.id === id ? { ...f, ...campo } : f))
  const guardar = async (id: number, campo: Partial<NC>) => {
    await supabase.from('solicitudes_nc').update(campo).eq('id', id)
  }
  const quitar = async (f: NC) => {
    if (!confirm(`¿Quitar ${f.cliente} ${f.factura || ''} de la lista?`)) return
    await supabase.from('solicitudes_nc').delete().eq('id', f.id)
    setFilas(prev => prev.filter(x => x.id !== f.id))
  }

  const marcarEnviadas = async () => {
    const ids = lista.map(f => f.id)
    const fecha = hoy()
    await supabase.from('solicitudes_nc').update({ estado: 'enviada', fecha_envio: fecha }).in('id', ids)
    setFilas(prev => prev.map(f => ids.includes(f.id) ? { ...f, estado: 'enviada', fecha_envio: fecha } : f))
  }
  const despuesDeDescargar = async () => {
    if (vista === 'pendiente' && lista.length > 0 &&
      confirm('¿Marcar estas NC como enviadas? Pasarán al historial y no saldrán en la próxima solicitud.')) {
      await marcarEnviadas()
    }
  }

  const nombreArchivo = (ext: string) => `Solicitud NC Isola ${hoy()}.${ext}`

  const descargarExcel = async () => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Solicitud NC')
    ws.columns = [
      { width: 12 }, { width: 38 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 18 }, { width: 34 },
    ]
    ws.mergeCells('A1:G1')
    ws.getCell('A1').value = TITULO
    ws.getCell('A1').font = { bold: true, size: 14 }
    ws.getCell('A1').alignment = { horizontal: 'center' }
    ws.mergeCells('A2:G2')
    ws.getCell('A2').value = 'Vendedor MIR10 · Daniel Guaramato · ' + hoy().split('-').reverse().join('/')
    ws.getCell('A2').alignment = { horizontal: 'center' }
    const head = ws.getRow(4)
    head.values = ['CODIGO', 'CLIENTE', 'FACTURA', 'MONTO', 'N/C', 'NEGOCIACION', 'OBSERVACION']
    head.eachCell(c => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }
      c.alignment = { horizontal: 'center' }
    })
    lista.forEach((f, i) => {
      const n = 5 + i
      const row = ws.getRow(n)
      row.getCell(1).value = f.codigo || ''
      row.getCell(2).value = f.cliente
      row.getCell(3).value = f.factura || ''
      row.getCell(4).value = f.monto
      // misma fórmula del formato original (Monto x 5%); si se cambió el %, va el valor fijo
      row.getCell(5).value = r2(f.monto * 0.05) === f.nc
        ? { formula: `IF(D${n}="","",ROUND(D${n}*0.05,2))`, result: f.nc }
        : f.nc
      row.getCell(6).value = f.negociacion
      row.getCell(7).value = f.observacion || ''
      row.getCell(4).numFmt = '#,##0.00'
      row.getCell(5).numFmt = '#,##0.00'
      row.eachCell(c => { c.border = { bottom: { style: 'hair' } } })
    })
    const t = 5 + lista.length
    ws.getCell(`C${t}`).value = 'TOTAL'
    ws.getCell(`D${t}`).value = { formula: `SUM(D5:D${t - 1})`, result: r2(totMonto) }
    ws.getCell(`E${t}`).value = { formula: `SUM(E5:E${t - 1})`, result: r2(totNC) }
    ;['C', 'D', 'E'].forEach(col => {
      const c = ws.getCell(`${col}${t}`)
      c.font = { bold: true }
      c.numFmt = '#,##0.00'
      c.border = { top: { style: 'thin' } }
    })
    const buf = await wb.xlsx.writeBuffer()
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    const a = document.createElement('a')
    a.href = url; a.download = nombreArchivo('xlsx'); a.click()
    URL.revokeObjectURL(url)
    await despuesDeDescargar()
  }

  const descargarPDF = async () => {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text(TITULO, 14, 15)
    doc.setFontSize(9)
    doc.text('Vendedor MIR10 · Daniel Guaramato · ' + hoy().split('-').reverse().join('/'), 14, 21)
    autoTable(doc, {
      startY: 26,
      head: [['CODIGO', 'CLIENTE', 'FACTURA', 'MONTO', 'N/C', 'NEGOCIACION', 'OBSERVACION']],
      body: lista.map(f => [f.codigo || '', f.cliente, f.factura || '', fmt(f.monto), fmt(f.nc), f.negociacion, f.observacion || '']),
      foot: [['', '', 'TOTAL', fmt(totMonto), fmt(totNC), '', '']],
      headStyles: { fillColor: [31, 78, 120] },
      footStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold' },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
      styles: { fontSize: 9 },
    })
    doc.save(nombreArchivo('pdf'))
    await despuesDeDescargar()
  }

  const inp = 'bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm w-full'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-sky-400">Notas de crédito</h1>
        <Link href="/cobros" className="ml-auto text-sm text-slate-400 hover:text-white">← Cobros</Link>
      </div>

      <div className="flex gap-2">
        {(['pendiente', 'enviada'] as const).map(v => (
          <button key={v} onClick={() => setVista(v)}
            className={`px-3 py-1.5 rounded-lg text-sm ${vista === v ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {v === 'pendiente' ? 'Por enviar' : 'Enviadas'} ({filas.filter(f => f.estado === v).length})
          </button>
        ))}
      </div>

      {vista === 'pendiente' && (
        <p className="text-xs text-slate-500">
          Agrega facturas desde Cobros con el botón “🧾 Agregar a NC”. El N/C se calcula como monto × 5% y puedes cambiarlo.
        </p>
      )}

      <div className="space-y-2">
        {lista.map(f => (
          <div key={f.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{f.cliente}</p>
                <p className="text-xs text-slate-400">{f.codigo || '—'} · Factura {f.factura || '—'}
                  {f.fecha_envio ? ` · enviada ${f.fecha_envio}` : ''}</p>
              </div>
              <button onClick={() => quitar(f)} className="bg-red-900/30 hover:bg-red-900/50 text-red-400 px-2 py-1 rounded-lg text-xs">🗑️</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <label className="text-xs text-slate-400">Monto factura
                <input type="number" step="0.01" className={inp} value={f.monto}
                  onChange={e => cambiar(f.id, { monto: Number(e.target.value), nc: r2(Number(e.target.value) * 0.05) })}
                  onBlur={() => guardar(f.id, { monto: f.monto, nc: f.nc })} />
              </label>
              <label className="text-xs text-slate-400">N/C
                <input type="number" step="0.01" className={inp} value={f.nc}
                  onChange={e => cambiar(f.id, { nc: Number(e.target.value) })}
                  onBlur={() => guardar(f.id, { nc: f.nc })} />
              </label>
              <label className="text-xs text-slate-400">Negociación
                <input className={inp} value={f.negociacion}
                  onChange={e => cambiar(f.id, { negociacion: e.target.value })}
                  onBlur={() => guardar(f.id, { negociacion: f.negociacion })} />
              </label>
              <label className="text-xs text-slate-400">Observación
                <input className={inp} value={f.observacion || ''}
                  onChange={e => cambiar(f.id, { observacion: e.target.value })}
                  onBlur={() => guardar(f.id, { observacion: f.observacion })} />
              </label>
            </div>
          </div>
        ))}
        {!cargando && lista.length === 0 && (
          <p className="text-slate-400 text-center py-8">
            {vista === 'pendiente' ? 'No hay NC por enviar. Agrégalas desde Cobros.' : 'Aún no hay NC enviadas.'}
          </p>
        )}
      </div>

      {lista.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 sticky bottom-20 md:bottom-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Total ({lista.length})</span>
            <span>Monto <b>${fmt(totMonto)}</b> · N/C <b className="text-sky-400">${fmt(totNC)}</b></span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={descargarExcel} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm">📗 Descargar Excel</button>
            <button onClick={descargarPDF} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm">📕 Descargar PDF</button>
            {vista === 'pendiente' && (
              <button onClick={() => confirm('¿Marcar todas como enviadas?') && marcarEnviadas()}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg text-sm ml-auto">✔ Marcar enviadas</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
