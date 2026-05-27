'use client'
import { useEffect, useState } from 'react'
import { supabase, type Cliente } from '@/lib/supabase'

const STATUS_OPTS = ['activo', 'inactivo', 'nuevo', 'perdido']
const FREQ_OPTS = ['diario', 'semanal', 'quincenal', 'mensual']

const empty: Partial<Cliente> = {
  nombre_negocio: '', propietario: '', telefono: '', direccion: '',
  zona: '', sector: '', hora_ideal_visita: '', frecuencia_visita: 'semanal',
  notas_personales: '', status: 'activo', deuda_pendiente: 0, moneda_deuda: 'USD',
  tags: [], productos_habituales: [],
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtro, setFiltro] = useState('')
  const [expandido, setExpandido] = useState<number | null>(null)
  const [modo, setModo] = useState<'lista' | 'form'>('lista')
  const [form, setForm] = useState<Partial<Cliente>>(empty)
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const cargar = async () => {
    const { data } = await supabase.from('clientes').select('*').order('nombre_negocio')
    setClientes(data || [])
  }
  useEffect(() => { cargar() }, [])

  const filtrados = clientes.filter(c =>
    c.nombre_negocio.toLowerCase().includes(filtro.toLowerCase()) ||
    (c.propietario || '').toLowerCase().includes(filtro.toLowerCase()) ||
    (c.zona || '').toLowerCase().includes(filtro.toLowerCase())
  )

  const editar = (c: Cliente) => {
    setForm({ ...c })
    setEditId(c.id)
    setModo('form')
  }

  const guardar = async () => {
    if (!form.nombre_negocio?.trim()) return alert('El nombre es obligatorio')
    setSaving(true)
    const data = { ...form, tags: form.tags || [], productos_habituales: form.productos_habituales || [] }
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-violet-400">Clientes</h1>
        <button onClick={() => { setForm(empty); setEditId(null); setModo('form') }}
          className="ml-auto bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-sm">
          + Nuevo
        </button>
      </div>

      <input value={filtro} onChange={e => setFiltro(e.target.value)}
        placeholder="Buscar por nombre, propietario o zona..."
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
      <p className="text-xs text-slate-500">{filtrados.length} clientes</p>

      <div className="space-y-2">
        {filtrados.map(c => (
          <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <button onClick={() => setExpandido(expandido === c.id ? null : c.id)}
              className="w-full flex items-center gap-3 p-3 text-left">
              <span className="text-2xl">🏪</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.nombre_negocio}</p>
                <p className="text-xs text-slate-400">{c.zona || '—'} · {c.propietario || '—'}</p>
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
                {c.telefono && (
                  <a href={`https://wa.me/${c.telefono.replace('+', '')}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-green-700/30 hover:bg-green-700/50 text-green-400 px-3 py-1.5 rounded-lg text-sm">
                    📱 WhatsApp
                  </a>
                )}
                <button onClick={() => editar(c)}
                  className="ml-2 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-sm">
                  ✏️ Editar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
