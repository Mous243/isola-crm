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

function diaHoyVE(): string {
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Caracas', weekday: 'long' })
  const idx = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(now)
  return DIAS_ES[idx] ?? DIAS_ES[new Date().getDay()]
}

async function buildPayload() {
  const hora = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', hour12: false })
  const h = parseInt(hora)

  if (h >= 6 && h < 9) {
    const hace7dias = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const diaHoy = diaHoyVE()
    const hoyStr = new Date().toLocaleString('es-VE', {
      timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric',
    })

    const [{ data: rutaHoy }, { data: sinVisitar }, { data: cobros }, { data: despachos }] = await Promise.all([
      supabase
        .from('clientes').select('nombre_negocio')
        .in('status', ['activo', 'nuevo'])
        .ilike('dia_visita', diaHoy),
      supabase
        .from('clientes').select('id').in('status', ['activo', 'nuevo'])
        .or(`fecha_ultima_visita.is.null,fecha_ultima_visita.lt.${hace7dias}`),
      supabase
        .from('cobros').select('id').not('estado', 'in', '(pagado,cancelado)').lte('fecha_vencimiento', en3Dias()),
      supabase
        .from('despachos').select('id,numero_guia,conductor_nombre,conductor_telefono,placa,fecha_guia,despacho_items(estado)'),
    ])

    const lineas: string[] = [
      `☀️ Buenos días — ISOLA CRM`,
      `${diaHoy.charAt(0).toUpperCase() + diaHoy.slice(1)} ${hoyStr}`,
      '',
    ]

    // Ruta de hoy
    const totalRuta = rutaHoy?.length || 0
    if (totalRuta > 0) {
      lineas.push(`📍 Ruta de hoy: ${totalRuta} clientes`)
      const muestra = rutaHoy!.slice(0, 5).map(c => `  • ${c.nombre_negocio}`)
      lineas.push(...muestra)
      if (totalRuta > 5) lineas.push(`  ... (+${totalRuta - 5} más)`)
    } else {
      lineas.push(`📍 Ruta de hoy: sin clientes asignados para ${diaHoy}`)
    }

    // Sin visitar
    lineas.push('')
    lineas.push(`⚠️ Sin visitar esta semana: ${sinVisitar?.length || 0}`)

    // Despachos
    lineas.push('')
    type DespachoRow = { id: number; numero_guia: string; conductor_nombre: string; conductor_telefono: string; placa: string; fecha_guia: string; despacho_items: { estado: string }[] }
    const pendientes: DespachoRow[] = []
    const completados: DespachoRow[] = []
    for (const d of (despachos as DespachoRow[] | null) ?? []) {
      const items = d.despacho_items ?? []
      if (items.length === 0) continue
      const tienePendiente = items.some(i => i.estado === 'pendiente')
      if (tienePendiente) pendientes.push(d)
      else completados.push(d)
    }

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
    for (const d of completados) {
      lineas.push(`✅ Guía #${d.numero_guia} ya fue entregada completa`)
    }

    // Cobros
    lineas.push('')
    lineas.push(`💰 Cobros urgentes: ${cobros?.length || 0}`)

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
    const payload = isTest
      ? { title: '✅ Prueba — ISOLA CRM', body: 'Las notificaciones están funcionando correctamente.' }
      : await buildPayload()
    if (!payload) return NextResponse.json({ ok: true, sent: 0 })

    const msg = payload.title ? `${payload.title}\n${payload.body}` : payload.body
    const r = await sendTelegram(msg)
    return NextResponse.json({ ok: true, sent: r.status < 300 ? 1 : 0, result: r })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
