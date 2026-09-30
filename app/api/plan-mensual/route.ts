export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Meta = { periodo: string; meta_monto: number; meta_cobranza: number; meta_cajas: number; meta_visitas: number }

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function hoyCaracas() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' }) }

// ─── feriados de Venezuela (calculados, no memorizados) ──────────────────────

function easterDate(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r }
function fmtDate(d: Date) { return d.toISOString().split('T')[0] }

function feriadosVenezuela(year: number): { fecha: string; nombre: string }[] {
  const pascua = easterDate(year)
  return [
    { fecha: `${year}-01-01`, nombre: 'Año Nuevo' },
    { fecha: fmtDate(addDays(pascua, -48)), nombre: 'Lunes de Carnaval' },
    { fecha: fmtDate(addDays(pascua, -47)), nombre: 'Martes de Carnaval' },
    { fecha: fmtDate(addDays(pascua, -3)), nombre: 'Jueves Santo' },
    { fecha: fmtDate(addDays(pascua, -2)), nombre: 'Viernes Santo' },
    { fecha: `${year}-04-19`, nombre: 'Declaración de la Independencia' },
    { fecha: `${year}-05-01`, nombre: 'Día del Trabajador' },
    { fecha: `${year}-06-24`, nombre: 'Batalla de Carabobo' },
    { fecha: `${year}-07-05`, nombre: 'Día de la Independencia' },
    { fecha: `${year}-07-24`, nombre: 'Natalicio de Simón Bolívar' },
    { fecha: `${year}-10-12`, nombre: 'Día de la Resistencia Indígena' },
    { fecha: `${year}-12-25`, nombre: 'Navidad' },
  ]
}

function vacacionesEscolares(month: number): string | undefined {
  if (month === 7 || month === 8) return 'Vacaciones escolares de mitad de año (fechas exactas varían según decreto del Ministerio de Educación).'
  if (month === 12) return 'Vacaciones escolares de fin de año desde mediados de diciembre.'
  if (month === 1) return 'Vacaciones escolares de fin de año hasta principios de enero.'
  return undefined
}

// ─── Telegram ───────────────────────────────────────────────────────────────

async function sendTelegram(text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
    })
  } catch { /* no bloquear la generación del plan por un fallo de Telegram */ }
}

// ─── resumen vía Groq (solo redacta, no inventa cifras) ──────────────────────

async function generarResumen(datos: {
  nombreMes: string; year: number
  metaMonto: number; metaCobranza: number; metaCajas: number; metaVisitas: number; metaReferencia: boolean
  totalVencido: number; countVencidas: number
  feriados: { fecha: string; nombre: string }[]
  vacaciones?: string
}): Promise<string | null> {
  const groqKey = (process.env.GROQ_API_KEY || '').replace(/^﻿/, '').trim()
  if (!groqKey) return null

  const prompt = `Eres un asistente que redacta el resumen inicial de un plan de trabajo mensual para un vendedor de campo de ISOLA Foods en Venezuela. Usa ÚNICAMENTE estos datos reales, no inventes cifras, eventos ni contexto adicional:

- Mes: ${datos.nombreMes} ${datos.year}
- Meta: $${datos.metaMonto} en ventas, $${datos.metaCobranza} en cobranza, ${datos.metaCajas} cajas, ${datos.metaVisitas} visitas${datos.metaReferencia ? ' (meta de referencia del mes anterior, la de este mes aún no ha sido cargada)' : ''}
- Cartera vencida al iniciar el mes: $${datos.totalVencido.toFixed(2)} en ${datos.countVencidas} facturas
- Feriados del mes: ${datos.feriados.length ? datos.feriados.map(f => `${f.nombre} (${f.fecha})`).join(', ') : 'ninguno'}
${datos.vacaciones ? `- Vacaciones escolares: ${datos.vacaciones}` : ''}

Escribe un resumen de 2 a 3 líneas, en español, tono directo tipo reporte para el vendedor, que combine el objetivo del mes con la cobranza pendiente y mencione los feriados si afectan días laborables. Sin encabezados ni introducción, solo el párrafo.`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 220,
        temperature: 0.4,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || null
  } catch {
    return null
  }
}

// ─── route ──────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const force = searchParams.get('force') === '1'
    const periodo = searchParams.get('periodo') || hoyCaracas().slice(0, 7) // 'YYYY-MM'
    const [yearStr, monthStr] = periodo.split('-')
    const year = +yearStr, month = +monthStr // month: 1-12
    const fechaInicio = `${periodo}-01`
    const fechaFin = fmtDate(new Date(Date.UTC(year, month, 0)))
    const nombreMes = MESES[month - 1]
    const nombreMesTitulo = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)

    const { data: existente } = await supabase.from('planes_trabajo')
      .select('id').eq('tipo', 'mensual').eq('fecha_inicio', fechaInicio).maybeSingle()
    if (existente && !force) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'ya existe un plan mensual para este período', id: existente.id })
    }

    // meta del mes (o la más reciente como referencia si aún no se cargó)
    let metaRow: Meta | null = null
    let metaReferencia = false
    const { data: metaMes } = await supabase.from('metas').select('*').eq('periodo', periodo).eq('tipo', 'mensual').maybeSingle()
    if (metaMes) {
      metaRow = metaMes
    } else {
      const { data: metaUltima } = await supabase.from('metas').select('*').eq('tipo', 'mensual').order('periodo', { ascending: false }).limit(1)
      metaRow = metaUltima?.[0] || null
      metaReferencia = !!metaRow
    }

    // cartera vencida al iniciar el mes
    const { data: cobrosVencidos } = await supabase.from('cobros')
      .select('monto, moneda, origen, clientes(nombre_negocio)')
      .in('estado', ['pendiente', 'parcial'])
      .lt('fecha_vencimiento', fechaInicio)
      .order('monto', { ascending: false })
    const cv = cobrosVencidos || []
    const totalVencido = cv.reduce((a, c) => a + Number(c.monto), 0)
    const totalCxc = cv.filter(c => c.origen === 'isola_cxc').reduce((a, c) => a + Number(c.monto), 0)
    const totalCrm = totalVencido - totalCxc
    const topDeudores = cv.slice(0, 5)

    // despachos sin confirmar entrega
    const { count: despachosPendientes } = await supabase.from('despacho_items')
      .select('id', { count: 'exact', head: true }).in('estado', ['pendiente', 'pendiente_reentrega'])

    // cartera activa
    const { count: clientesActivos } = await supabase.from('clientes')
      .select('id', { count: 'exact', head: true }).eq('status', 'activo')

    // incentivo/concurso vigente (solo si el corte es reciente respecto al inicio del mes)
    const { data: incentivoRows } = await supabase.from('incentivo_snapshot').select('*').order('id', { ascending: false }).limit(1)
    const incentivo = incentivoRows?.[0]
    const incentivoVigente = incentivo?.corte_fecha &&
      (new Date(fechaInicio).getTime() - new Date(incentivo.corte_fecha).getTime()) / 864e5 < 40

    const feriadosDelMes = feriadosVenezuela(year).filter(f => f.fecha >= fechaInicio && f.fecha <= fechaFin)
    const vacaciones = vacacionesEscolares(month)

    const resumenIA = await generarResumen({
      nombreMes: nombreMesTitulo, year,
      metaMonto: Number(metaRow?.meta_monto || 0), metaCobranza: Number(metaRow?.meta_cobranza || 0),
      metaCajas: Number(metaRow?.meta_cajas || 0), metaVisitas: Number(metaRow?.meta_visitas || 0),
      metaReferencia,
      totalVencido, countVencidas: cv.length,
      feriados: feriadosDelMes, vacaciones,
    })
    const resumen = resumenIA || `${nombreMesTitulo} ${year}: $${totalVencido.toFixed(0)} en cartera vencida (${cv.length} facturas) al iniciar el mes` +
      (metaRow ? `, meta de $${Number(metaRow.meta_monto).toFixed(0)} en ventas y $${Number(metaRow.meta_cobranza).toFixed(0)} en cobranza${metaReferencia ? ' (referencia, sin confirmar aún)' : ''}.` : ', sin meta cargada todavía.')

    const secciones: { titulo: string; texto?: string; items?: string[] }[] = [
      {
        titulo: '🎯 Meta del mes',
        texto: metaRow
          ? `${metaReferencia ? `Meta oficial de ${periodo} aún no cargada — usando la de ${metaRow.periodo} como referencia: ` : ''}$${Number(metaRow.meta_monto).toLocaleString()} en ventas, $${Number(metaRow.meta_cobranza).toLocaleString()} en cobranza, ${Number(metaRow.meta_cajas).toLocaleString()} cajas, ${metaRow.meta_visitas} visitas.`
          : 'Todavía no hay meta cargada para este mes ni de referencia. Avísame la cuota cuando ISOLA la confirme.',
      },
      {
        titulo: '💰 Cobranza — cartera vencida al inicio de mes',
        texto: `$${totalVencido.toFixed(2)} en ${cv.length} facturas vencidas (CxC ISOLA: $${totalCxc.toFixed(2)} · CRM propio: $${totalCrm.toFixed(2)}).${topDeudores.length ? ' Prioriza estos primero:' : ''}`,
        items: topDeudores.length ? topDeudores.map(d => `${(d.clientes as { nombre_negocio?: string } | null)?.nombre_negocio || 'Cliente'} — ${d.moneda} ${Number(d.monto).toFixed(2)}`) : undefined,
      },
      {
        titulo: '🚚 Despachos',
        texto: (despachosPendientes || 0) > 0
          ? `${despachosPendientes} items de guías sin confirmar entrega todavía. Revísalos en /despachos antes de que se acumulen.`
          : 'Sin despachos pendientes de confirmar al inicio de mes.',
      },
      { titulo: '👥 Cartera', texto: `${clientesActivos ?? 0} clientes activos.` },
    ]
    if (incentivoVigente) {
      secciones.push({
        titulo: '🏆 Incentivo / concurso en curso',
        texto: `Puesto nacional #${incentivo.puesto_nacional} de ${incentivo.total_rdv} · ${incentivo.puntos_totales} pts (corte ${incentivo.corte_fecha}). Detalle en /incentivo.`,
      })
    }

    const { data: inserted, error } = await supabase.from('planes_trabajo').insert({
      tipo: 'mensual',
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      titulo: `Plan de Trabajo — ${nombreMesTitulo} ${year}`,
      resumen,
      contenido: { secciones },
      contexto: {
        festividades: feriadosDelMes.length ? feriadosDelMes : undefined,
        vacaciones_escolares: vacaciones,
        fuentes: ['Datos del CRM (Supabase)', 'Calendario de feriados de Venezuela (calculado)', ...(resumenIA ? ['Resumen redactado por IA (Groq)'] : [])],
      },
      enviado_telegram: true,
    }).select('id').single()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    await sendTelegram(`📅 Plan de trabajo de ${nombreMesTitulo} ${year} generado.\n\n${resumen}\n\nRevísalo completo en /planificacion.`)

    return NextResponse.json({ ok: true, id: inserted.id, periodo, titulo: `Plan de Trabajo — ${nombreMesTitulo} ${year}`, resumen })
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
