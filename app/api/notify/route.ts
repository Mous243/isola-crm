export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Telegram ───────────────────────────────────────────────────────────────

async function sendTelegram(text: string): Promise<{ status: number; text: string }> {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
  })
  return { status: res.status, text: await res.text() }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function hoy() { return new Date().toISOString().split('T')[0] }
function en3Dias() {
  const d = new Date(); d.setDate(d.getDate() + 3)
  return d.toISOString().split('T')[0]
}

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DIAS_DB = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const CUTOFF_DESPACHOS = '2026-06-23' // primera guía registrada en el CRM; antes de esto no se muestran

function diaIdxVE(): number {
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Caracas', weekday: 'long' })
  const idx = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(now)
  return idx >= 0 ? idx : new Date().getDay()
}

function diaHoyVE(): string {
  return DIAS_ES[diaIdxVE()]
}

function periodoActualVE(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`
}

function diasHabilesRestantesVE(): number {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const anio = +parts.find(p => p.type === 'year')!.value
  const mes = +parts.find(p => p.type === 'month')!.value
  const diaActual = +parts.find(p => p.type === 'day')!.value
  const ultimoDia = new Date(anio, mes, 0).getDate()
  let count = 0
  for (let d = diaActual; d <= ultimoDia; d++) {
    const dow = new Date(anio, mes - 1, d).getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

async function buildPayload(forzarManana = false) {
  const hora = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', hour12: false })
  const h = parseInt(hora)

  if ((h >= 6 && h < 9) || forzarManana) {
    const diaIdx = diaIdxVE()
    if (diaIdx === 0 || diaIdx === 6) return null // sábado y domingo no se trabaja

    const diaHoy = diaHoyVE()
    const diaHoyDb = DIAS_DB[diaIdx]
    const periodo = periodoActualVE()
    const inicioMes = `${periodo}-01`
    const hoyStr = new Date().toLocaleString('es-VE', {
      timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric',
    })

    const [
      { count: totalRuta },
      { data: despachos },
      { data: visitasMes },
      { data: metaRow },
      { data: cobrosCartera },
      { data: productosFoco },
    ] = await Promise.all([
      supabase
        .from('clientes').select('id', { count: 'exact', head: true })
        .in('status', ['activo', 'nuevo'])
        .ilike('dia_visita', diaHoyDb),
      supabase
        .from('despachos').select('id,numero_guia,conductor_nombre,conductor_telefono,placa,fecha_guia,despacho_items(estado)')
        .gte('fecha_guia', CUTOFF_DESPACHOS),
      supabase
        .from('visitas').select('productos_pedidos').gte('fecha', inicioMes),
      supabase
        .from('metas').select('meta_cajas').eq('periodo', periodo).eq('tipo', 'mensual').maybeSingle(),
      supabase
        .from('cobros').select('monto, moneda, fecha_vencimiento, clientes(nombre_negocio)')
        .eq('origen', 'crm').not('estado', 'in', '(pagado,cancelado)')
        .order('fecha_vencimiento', { ascending: true }),
      supabase
        .from('metas_variables').select('nombre').eq('periodo', periodo).in('tipo', ['producto_porcentaje', 'producto_cartera']),
    ])

    const lineas: string[] = [
      `☀️ RDV ${diaHoy.charAt(0).toUpperCase() + diaHoy.slice(1)}`,
      `RDV Daniel Guaramato`,
      hoyStr,
      '',
    ]

    // Ruta de hoy
    lineas.push(`📍 Clientes planificados: ${totalRuta || 0}`)

    // Volumen planificado (cuota mensual de cajas)
    type ProdPedido = { cajas?: number }
    const cajasMes = (visitasMes ?? []).reduce((acc, v) => {
      const prods = (v.productos_pedidos ?? []) as ProdPedido[]
      return acc + prods.reduce((s, p) => s + (p.cajas || 0), 0)
    }, 0)
    const metaCajas = metaRow?.meta_cajas || 0
    const diasRestantes = diasHabilesRestantesVE()
    const restante = metaCajas - cajasMes
    const volumenHoy = restante <= 0 ? 50 : Math.ceil(restante / diasRestantes)
    lineas.push('')
    lineas.push(`📦 Volumen planificado hoy: ${volumenHoy} cajas`)
    lineas.push(`  (cuota ${metaCajas} · quedan ${diasRestantes} días hábiles)`)

    // Cobros de cartera propia
    type CobroRow = { monto: number; moneda: string; fecha_vencimiento: string; clientes?: { nombre_negocio: string } }
    const cobros = (cobrosCartera ?? []) as unknown as CobroRow[]
    const totalCobrar = cobros.reduce((a, c) => a + Number(c.monto), 0)
    lineas.push('')
    lineas.push(`💰 Cobros pendientes (mi cartera): ${cobros.length} · $${totalCobrar.toFixed(0)}`)

    const focoCobro = cobros.slice(0, 6)
    if (focoCobro.length > 0) {
      lineas.push('')
      lineas.push(`📌 Clientes foco de cobro hoy:`)
      for (const c of focoCobro) {
        lineas.push(`  • ${c.clientes?.nombre_negocio} — $${Number(c.monto).toFixed(0)}`)
      }
    }

    // Productos foco del mes
    if (productosFoco && productosFoco.length > 0) {
      lineas.push('')
      lineas.push(`🎯 Productos foco del mes:`)
      for (const p of productosFoco) lineas.push(`  • ${p.nombre}`)
    }

    // Despachos (solo guías sin entregar, desde que se empezó a registrar en el CRM)
    type DespachoRow = { id: number; numero_guia: string; conductor_nombre: string; conductor_telefono: string; placa: string; fecha_guia: string; despacho_items: { estado: string }[] }
    const pendientes: DespachoRow[] = []
    for (const d of (despachos as DespachoRow[] | null) ?? []) {
      const items = d.despacho_items ?? []
      if (items.length === 0) continue
      const tienePendiente = items.some(i => i.estado === 'pendiente')
      if (tienePendiente) pendientes.push(d)
    }

    lineas.push('')
    if (pendientes.length > 0) {
      lineas.push(`🚚 Despachos pendientes: ${pendientes.length}`)
      for (const d of pendientes) {
        const tel = d.conductor_telefono ? ` | ${d.conductor_telefono}` : ''
        const placa = d.placa ? ` | ${d.placa}` : ''
        lineas.push(`  • Guía #${d.numero_guia} — ${d.conductor_nombre}${tel}${placa} — ${d.fecha_guia}`)
      }
    } else {
      lineas.push(`🚚 Sin despachos pendientes`)
    }

    return { title: '', body: lineas.join('\n') }
  }

  if (h >= 20 && h < 22) {
    const { data: visitas } = await supabase
      .from('visitas').select('resultado, monto_pedido').eq('fecha', hoy())
    const total = visitas?.length || 0
    const conPedido = visitas?.filter((v: { resultado: string; monto_pedido?: number }) => v.resultado === 'visita_efectiva' && (v.monto_pedido || 0) > 0).length || 0
    const monto = visitas?.reduce((a: number, v: { monto_pedido?: number }) => a + (v.monto_pedido || 0), 0) || 0
    return {
      title: '🌙 Resumen del día — ISOLA CRM',
      body: `${conPedido}/${total} visitas con pedido · $${monto.toFixed(0)} total\n\n📦 ¿Ya te llegó la guía de despacho de hoy? Pásamela por aquí para registrarla en /despachos.`,
    }
  }

  if (h >= 9 && h < 11) {
    const { data: cobros } = await supabase
      .from('cobros').select('monto, fecha_vencimiento, clientes(nombre_negocio)')
      .not('estado', 'in', '(pagado,cancelado)').lte('fecha_vencimiento', en3Dias())
    if (!cobros?.length) return null
    const hoyStr = hoy()
    const vencidos = cobros.filter((c: { fecha_vencimiento: string }) => c.fecha_vencimiento < hoyStr).length
    const partes = []
    if (vencidos > 0) partes.push(`${vencidos} vencido${vencidos > 1 ? 's' : ''}`)
    const porVencer = cobros.length - vencidos
    if (porVencer > 0) partes.push(`${porVencer} por vencer en 3 días`)
    return {
      title: '💰 Cobros pendientes — ISOLA CRM',
      body: partes.join(' · '),
    }
  }

  return null
}

// ─── route ──────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const isTest = searchParams.get('test') === '1'
    const forzarManana = searchParams.get('test') === '2'
    const payload = isTest
      ? { title: '✅ Prueba — ISOLA CRM', body: 'Las notificaciones están funcionando correctamente.' }
      : await buildPayload(forzarManana)
    if (!payload) return NextResponse.json({ ok: true, sent: 0 })

    const msg = payload.title ? `${payload.title}\n${payload.body}` : payload.body
    const r = await sendTelegram(msg)
    return NextResponse.json({ ok: true, sent: r.status < 300 ? 1 : 0, result: r })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
