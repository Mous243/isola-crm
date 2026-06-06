'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Cliente, type Visita } from '@/lib/supabase'

const STATUS_OPTS = ['activo', 'inactivo', 'nuevo', 'perdido']
const FREQ_OPTS = ['diario', 'semanal', 'quincenal', 'mensual']
const DIAS = ['lunes', 'martes-a', 'martes-b', 'miercoles', 'jueves', 'viernes']
const DIA_LABEL: Record<string, string> = { lunes: 'Lun', 'martes-a': 'Mar·A', 'martes-b': 'Mar·B', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie' }

const empty: Partial<Cliente> = {
  nombre_negocio: '', propietario: '', telefono: '', direccion: '',
  zona: '', sector: '', hora_ideal_visita: '', frecuencia_visita: 'semanal',
  notas_personales: '', status: 'activo', deuda_pendiente: 0, moneda_deuda: 'USD',
  tags: [], productos_habituales: [],
}

export default function Clientes() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtro, setFiltro] = useState('')
  const [filtroDia, setFiltroDia] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [expandido, setExpandido] = useState<number | null>(null)
  const [historial, setHistorial] = useState<Record<number, Visita[]>>({})
  const [modo, setModo] = useState<'lista' | 'form' | 'csv'>('lista')
  const [form, setForm] = useState<Partial<Cliente>>(empty)
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [csvPreview, setCsvPreview] = useState<Partial<Cliente>[]>([])
  const [csvImportando, setCsvImportando] = useState(false)
  const [csvResultado, setCsvResultado] = useState<string | null>(null)

  const cargar = async () => {
    const { data } = await supabase.from('clientes').select('*').order('nombre_negocio')
    setClientes(data || [])
  }
  useEffect(() => { cargar() }, [])

  const descargarPlantilla = async () => {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    // Encabezado
    doc.setFillColor(124, 58, 237)
    doc.rect(0, 0, 297, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Plantilla de Importacion de Clientes — ISOLA CRM', 14, 14)

    // Instrucciones
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Como usar: 1) Abra Excel o Google Sheets  2) Copie los nombres de columna en la fila 1  3) Ingrese un cliente por fila desde la fila 2  4) Guarde como CSV  5) Importe en Clientes > CSV', 14, 30)
    doc.setTextColor(239, 68, 68)
    doc.text('Solo "nombre_negocio" es obligatorio. El resto puede dejarse vacio.', 14, 36)

    // Cabecera CSV
    doc.setFillColor(30, 41, 59)
    doc.rect(14, 39, 269, 8, 'F')
    doc.setTextColor(165, 243, 252)
    doc.setFontSize(7)
    doc.setFont('courier', 'normal')
    doc.text('nombre_negocio,propietario,telefono,direccion,zona,sector,hora_ideal_visita,frecuencia_visita,notas_personales,status,deuda_pendiente,moneda_deuda', 16, 44.5)

    // Tabla de campos
    autoTable(doc, {
      startY: 50,
      head: [['Campo (nombre columna)', 'Descripcion', 'Ejemplo', 'Requerido']],
      body: [
        ['nombre_negocio', 'Nombre del negocio o razon social', 'Bodega El Sol', 'SI'],
        ['propietario', 'Nombre del dueno o contacto principal', 'Juan Perez', 'No'],
        ['telefono', 'Telefono en formato internacional sin +', '584121234567', 'No'],
        ['direccion', 'Direccion completa del negocio', 'Av. Principal Casa 12, Caucaguita', 'No'],
        ['zona', 'Zona o ciudad', 'GUARENAS', 'No'],
        ['sector', 'Sector especifico dentro de la zona', 'El Carmen', 'No'],
        ['hora_ideal_visita', 'Horario preferido para la visita', '08:00-10:00', 'No'],
        ['frecuencia_visita', 'Cada cuanto se visita: diario / semanal / quincenal / mensual', 'semanal', 'No'],
        ['notas_personales', 'Notas privadas sobre el cliente', 'Le gusta el cafe, muy puntual', 'No'],
        ['status', 'Estado del cliente: activo / inactivo / nuevo / perdido', 'activo', 'No'],
        ['deuda_pendiente', 'Monto de deuda pendiente (solo el numero)', '0', 'No'],
        ['moneda_deuda', 'Moneda de la deuda: USD o VES', 'USD', 'No'],
      ],
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [124, 58, 237], cellWidth: 45 },
        1: { cellWidth: 100 },
        2: { textColor: [5, 150, 105], fontStyle: 'italic', cellWidth: 80 },
        3: { halign: 'center', cellWidth: 25 },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    })

    doc.save('plantilla_clientes_ISOLA.pdf')
  }

  const exportarPDF = async () => {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    doc.setFillColor(124, 58, 237)
    doc.rect(0, 0, 297, 20, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Cartera de Clientes — ISOLA CRM', 14, 13)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Total: ${filtrados.length} clientes   |   ${new Date().toLocaleDateString('es-VE')}`, 200, 13)

    const dias: Record<string, string> = { lunes: 'LUN', martes: 'MAR', 'martes-a': 'MAR·A', 'martes-b': 'MAR·B', miercoles: 'MIE', jueves: 'JUE', viernes: 'VIE' }

    autoTable(doc, {
      startY: 24,
      head: [['#', 'Nombre del Negocio', 'Propietario', 'Telefono', 'Zona', 'Dia Visita', 'Estado', 'Deuda']],
      body: filtrados.map((c, i) => [
        i + 1,
        c.nombre_negocio,
        c.propietario || '—',
        c.telefono || '—',
        c.zona || '—',
        dias[c.dia_visita || ''] || c.dia_visita || '—',
        c.status || 'activo',
        (c.deuda_pendiente || 0) > 0 ? `${c.moneda_deuda} ${Number(c.deuda_pendiente).toFixed(2)}` : '—',
      ]),
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 70, fontStyle: 'bold' },
        2: { cellWidth: 45 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30 },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 18, halign: 'center' },
        7: { cellWidth: 25, halign: 'right' },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        if (data.column.index === 6 && data.section === 'body') {
          const v = String(data.cell.raw)
          if (v === 'activo') data.cell.styles.textColor = [5, 150, 105]
          else if (v === 'inactivo' || v === 'perdido') data.cell.styles.textColor = [239, 68, 68]
          else if (v === 'nuevo') data.cell.styles.textColor = [59, 130, 246]
        }
        if (data.column.index === 7 && data.section === 'body' && String(data.cell.raw) !== '—') {
          data.cell.styles.textColor = [239, 68, 68]
        }
      },
      margin: { left: 14, right: 14 },
    })

    doc.save(`clientes_ISOLA_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const parsearCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.trim().split('\n')
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/"/g, ''))
        const obj: Record<string, string> = {}
        headers.forEach((h, i) => { obj[h] = vals[i] || '' })
        return {
          nombre_negocio: obj.nombre_negocio || obj['Nombre'] || obj['nombre'] || '',
          propietario: obj.propietario || obj['Propietario'] || '',
          telefono: obj.telefono || obj['Teléfono'] || obj['Telefono'] || '',
          direccion: obj.direccion || obj['Dirección'] || obj['Direccion'] || '',
          zona: obj.zona || obj['Zona'] || '',
          sector: obj.sector || obj['Sector'] || '',
          hora_ideal_visita: obj.hora_ideal_visita || '',
          frecuencia_visita: obj.frecuencia_visita || 'semanal',
          notas_personales: obj.notas_personales || obj['Notas'] || '',
          status: obj.status || 'activo',
          deuda_pendiente: parseFloat(obj.deuda_pendiente || '0') || 0,
          moneda_deuda: obj.moneda_deuda || 'USD',
          tags: [], productos_habituales: [],
        } as Partial<Cliente>
      }).filter(r => r.nombre_negocio)
      setCsvPreview(rows)
      setCsvResultado(null)
    }
    reader.readAsText(file)
  }

  const importarCSV = async () => {
    if (csvPreview.length === 0) return
    setCsvImportando(true)
    const { error } = await supabase.from('clientes').insert(csvPreview)
    setCsvImportando(false)
    if (error) {
      setCsvResultado(`❌ Error: ${error.message}`)
    } else {
      setCsvResultado(`✅ ${csvPreview.length} clientes importados correctamente`)
      setCsvPreview([])
      cargar()
    }
  }

  const verHistorial = async (clienteId: number) => {
    if (historial[clienteId]) return
    const { data } = await supabase.from('visitas')
      .select('*').eq('cliente_id', clienteId)
      .order('fecha', { ascending: false }).limit(10)
    setHistorial(prev => ({ ...prev, [clienteId]: data || [] }))
  }

  const filtrados = clientes.filter(c => {
    const textMatch = c.nombre_negocio.toLowerCase().includes(filtro.toLowerCase()) ||
      (c.propietario || '').toLowerCase().includes(filtro.toLowerCase()) ||
      (c.zona || '').toLowerCase().includes(filtro.toLowerCase()) ||
      (c.codigo_cliente || '').toLowerCase().includes(filtro.toLowerCase())
    let diaMatch = true
    if (filtroDia === 'martes-a') diaMatch = c.dia_visita === 'martes' && !(c.tags || []).includes('quincenal')
    else if (filtroDia === 'martes-b') diaMatch = c.dia_visita === 'martes'
    else if (filtroDia) diaMatch = c.dia_visita === filtroDia
    const statusMatch = !filtroStatus || c.status === filtroStatus
    return textMatch && diaMatch && statusMatch
  })

  const editar = (c: Cliente) => {
    setForm({ ...c })
    setEditId(c.id)
    setModo('form')
  }

  const guardar = async () => {
    if (!form.nombre_negocio?.trim()) return alert('El nombre es obligatorio')
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, created_at: _cat, ...rest } = form as Cliente
    const data = { ...rest, tags: rest.tags || [], productos_habituales: rest.productos_habituales || [] }
    if (editId) {
      await supabase.from('clientes').update(data).eq('id', editId)
    } else {
      await supabase.from('clientes').insert(data)
    }
    setSaving(false)
    setModo('lista')
    setForm(empty)
    setEditId(null)
    cargar()
  }

  const statusColor: Record<string, string> = {
    activo: 'text-green-400', inactivo: 'text-red-400', nuevo: 'text-blue-400', perdido: 'text-slate-500'
  }

  if (modo === 'form') return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => { setModo('lista'); setForm(empty); setEditId(null) }}
          className="text-slate-400 hover:text-white">← Volver</button>
        <h1 className="text-xl font-bold">{editId ? 'Editar cliente' : 'Nuevo cliente'}</h1>
      </div>

      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2">
            <span className="text-xs text-slate-400">Nombre del negocio *</span>
            <input value={form.nombre_negocio || ''} onChange={e => setForm({ ...form, nombre_negocio: e.target.value })}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="text-xs text-slate-400">Propietario</span>
            <input value={form.propietario || ''} onChange={e => setForm({ ...form, propietario: e.target.value })}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="text-xs text-slate-400">Teléfono</span>
            <input value={form.telefono || ''} onChange={e => setForm({ ...form, telefono: e.target.value })}
              placeholder="584121234567"
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="col-span-2">
            <span className="text-xs text-slate-400">Dirección</span>
            <input value={form.direccion || ''} onChange={e => setForm({ ...form, direccion: e.target.value })}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="text-xs text-slate-400">Zona</span>
            <input value={form.zona || ''} onChange={e => setForm({ ...form, zona: e.target.value })}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="text-xs text-slate-400">Sector</span>
            <input value={form.sector || ''} onChange={e => setForm({ ...form, sector: e.target.value })}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="text-xs text-slate-400">Horario ideal</span>
            <input value={form.hora_ideal_visita || ''} onChange={e => setForm({ ...form, hora_ideal_visita: e.target.value })}
              placeholder="08:00-10:00"
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="text-xs text-slate-400">Frecuencia</span>
            <select value={form.frecuencia_visita || 'semanal'} onChange={e => setForm({ ...form, frecuencia_visita: e.target.value })}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
              {FREQ_OPTS.map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs text-slate-400">Estado</span>
            <select value={form.status || 'activo'} onChange={e => setForm({ ...form, status: e.target.value })}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
              {STATUS_OPTS.map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs text-slate-400">Deuda</span>
            <input type="number" value={form.deuda_pendiente || 0} onChange={e => setForm({ ...form, deuda_pendiente: +e.target.value })}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="col-span-2">
            <span className="text-xs text-slate-400">Notas personales</span>
            <textarea value={form.notas_personales || ''} onChange={e => setForm({ ...form, notas_personales: e.target.value })}
              rows={3} placeholder="Personalidad, preferencias, qué temas le gustan..."
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="col-span-2">
            <span className="text-xs text-slate-400">Tags (separados por coma)</span>
            <input value={(form.tags || []).join(', ')}
              onChange={e => setForm({ ...form, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
              placeholder="buen_pagador, potencial_alto"
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </label>
        </div>

        <button onClick={guardar} disabled={saving}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium">
          {saving ? 'Guardando...' : editId ? 'Actualizar cliente' : 'Crear cliente'}
        </button>
      </div>
    </div>
  )

  if (modo === 'csv') return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => { setModo('lista'); setCsvPreview([]); setCsvResultado(null) }}
          className="text-slate-400 hover:text-white">← Volver</button>
        <h1 className="text-xl font-bold">Importar clientes desde CSV</h1>
      </div>

      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-slate-300">1. Descarga la plantilla y llénala con tus clientes</p>
          <button onClick={descargarPlantilla}
            className="bg-slate-700 hover:bg-slate-600 text-sm px-4 py-2 rounded-lg">
            ⬇️ Descargar plantilla CSV
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-slate-300">2. Sube el archivo CSV con tus clientes</p>
          <input type="file" accept=".csv,text/csv" onChange={parsearCSV}
            className="block w-full text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-violet-600 file:text-white hover:file:bg-violet-700 cursor-pointer" />
        </div>

        {csvPreview.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-300">3. Revisa los datos — se importarán <span className="text-violet-400 font-medium">{csvPreview.length} clientes</span></p>
            <div className="max-h-48 overflow-y-auto space-y-1 bg-slate-800/50 rounded-lg p-2">
              {csvPreview.map((c, i) => (
                <div key={i} className="flex gap-2 text-xs py-0.5">
                  <span className="text-white font-medium w-40 truncate">{c.nombre_negocio}</span>
                  <span className="text-slate-400 w-28 truncate">{c.propietario || '—'}</span>
                  <span className="text-slate-500 truncate">{c.telefono || '—'}</span>
                  <span className="text-slate-500 truncate">{c.zona || '—'}</span>
                </div>
              ))}
            </div>
            <button onClick={importarCSV} disabled={csvImportando}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium">
              {csvImportando ? 'Importando...' : `✅ Importar ${csvPreview.length} clientes`}
            </button>
          </div>
        )}

        {csvResultado && (
          <p className={`text-sm p-3 rounded-lg ${csvResultado.startsWith('✅') ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
            {csvResultado}
          </p>
        )}

        <div className="border-t border-slate-700 pt-3">
          <p className="text-xs text-slate-500">Columnas soportadas: nombre_negocio, propietario, telefono, direccion, zona, sector, hora_ideal_visita, frecuencia_visita, notas_personales, status, deuda_pendiente, moneda_deuda</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-violet-400">Clientes</h1>
        <div className="ml-auto flex gap-2">
          <button onClick={exportarPDF}
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm">
            📄 PDF
          </button>
          <button onClick={() => setModo('csv')}
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm">
            📥 CSV
          </button>
          <button onClick={() => { setForm(empty); setEditId(null); setModo('form') }}
            className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-sm">
            + Nuevo
          </button>
        </div>
      </div>

      <input value={filtro} onChange={e => setFiltro(e.target.value)}
        placeholder="Buscar por nombre, propietario, zona o código..."
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" />

      {/* Filtro día */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setFiltroDia('')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!filtroDia ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
          Todos
        </button>
        {DIAS.map(d => (
          <button key={d} onClick={() => setFiltroDia(filtroDia === d ? '' : d)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filtroDia === d ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            {DIA_LABEL[d]}
          </button>
        ))}
        <span className="w-px bg-slate-700 mx-1" />
        {STATUS_OPTS.map(s => (
          <button key={s} onClick={() => setFiltroStatus(filtroStatus === s ? '' : s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filtroStatus === s ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            {s}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500">{filtrados.length} clientes</p>

      <div className="space-y-2">
        {filtrados.map(c => (
          <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <button onClick={() => { const next = expandido === c.id ? null : c.id; setExpandido(next); if (next) verHistorial(next) }}
              className="w-full flex items-center gap-3 p-3 text-left">
              <span className="text-2xl">🏪</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{c.nombre_negocio}</p>
                  {c.codigo_cliente && <span className="text-xs text-violet-400 font-mono shrink-0">{c.codigo_cliente}</span>}
                </div>
                <p className="text-xs text-slate-400">{c.dia_visita ? ({ lunes: 'Lun', martes: (c.tags || []).includes('quincenal') ? 'Mar·B' : 'Mar·A', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie' }[c.dia_visita] ?? c.dia_visita) : '—'} · {c.zona || '—'} · {c.propietario || '—'}</p>
              </div>
              <span className={`text-xs font-medium ${statusColor[c.status || 'activo']}`}>{c.status}</span>
              <span className="text-slate-500 ml-1">{expandido === c.id ? '▲' : '▼'}</span>
            </button>

            {expandido === c.id && (
              <div className="px-4 pb-4 space-y-2 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-sm">
                  <p><span className="text-slate-400">Tel:</span> {c.telefono || '—'}</p>
                  <p><span className="text-slate-400">Sector:</span> {c.sector || '—'}</p>
                  <p><span className="text-slate-400">Horario:</span> {c.hora_ideal_visita || '—'}</p>
                  <p><span className="text-slate-400">Frecuencia:</span> {c.frecuencia_visita}</p>
                  <p><span className="text-slate-400">Últ. visita:</span> {c.fecha_ultima_visita || 'Nunca'}</p>
                  {(c.deuda_pendiente || 0) > 0 && (
                    <p className="text-red-400 font-medium">Deuda: {c.moneda_deuda} {c.deuda_pendiente?.toFixed(2)}</p>
                  )}
                </div>
                {c.notas_personales && (
                  <p className="text-sm bg-slate-800 rounded p-2 text-slate-300">{c.notas_personales}</p>
                )}
                {(c.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(c.tags || []).map(t => (
                      <span key={t} className="bg-violet-900/40 text-violet-300 text-xs px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => router.push(`/visita?cliente_id=${c.id}`)}
                    className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                    📋 Registrar visita
                  </button>
                  {c.telefono && (
                    <a href={`https://wa.me/${c.telefono.replace('+', '')}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-2 bg-green-700/30 hover:bg-green-700/50 text-green-400 px-3 py-1.5 rounded-lg text-sm">
                      📱 WhatsApp
                    </a>
                  )}
                  <button onClick={() => editar(c)}
                    className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-sm">
                    ✏️ Editar
                  </button>
                </div>

                {/* Historial de visitas */}
                <div className="mt-3 border-t border-slate-800 pt-3">
                  <p className="text-xs text-slate-400 font-medium mb-2">Últimas visitas</p>
                  {!historial[c.id]
                    ? <p className="text-xs text-slate-500">Cargando...</p>
                    : historial[c.id].length === 0
                      ? <p className="text-xs text-slate-500">Sin visitas registradas</p>
                      : <div className="space-y-1">
                          {historial[c.id].map(v => (
                            <div key={v.id} className="flex items-center gap-2 text-xs py-1">
                              <span className="text-slate-400 w-20 shrink-0">{v.fecha}</span>
                              <span className={`px-2 py-0.5 rounded-full shrink-0 ${
                                v.resultado === 'pedido' ? 'bg-green-900/40 text-green-400' :
                                v.resultado === 'no_compro' ? 'bg-yellow-900/40 text-yellow-400' :
                                'bg-slate-800 text-slate-400'
                              }`}>{v.resultado}</span>
                              {(v.monto_pedido || 0) > 0 && (
                                <span className="text-violet-400">${v.monto_pedido?.toFixed(2)}</span>
                              )}
                                {v.notas_visita && (
                                <span className="text-slate-500 truncate">{v.notas_visita}</span>
                              )}
                              {v.foto_url && (
                                <a href={v.foto_url} target="_blank" rel="noreferrer" className="text-violet-400 shrink-0">📷</a>
                              )}
                            </div>
                          ))}
                        </div>
                  }
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
