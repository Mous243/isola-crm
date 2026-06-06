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

async function buildPayload() {
  const hora = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', hour12: false })
  const h = parseInt(hora)

  if (h >= 6 && h < 9) {
    const { data: sinVisitar } = await supabase
      .from('clientes').select('id').in('status', ['activo', 'nuevo'])
      .lt('fecha_ultima_visita', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
    const { data: cobros } = await supabase
      .from('cobros').select('id').not('estado', 'in', '(pagado,cancelado)').lte('fecha_vencimiento', en3Dias())
    return {
      title: '☀️ Buenos días — ISOLA CRM',
      body: `${sinVisitar?.length || 0} clientes sin visitar · ${cobros?.length || 0} cobros urgentes`,
    }
  }

  if (h >= 20 && h < 22) {
    const { data: visitas } = await supabase
      .from('visitas').select('resultado, monto_pedido').eq('fecha', hoy())
    const total = visitas?.length || 0
    const conPedido = visitas?.filter((v: { resultado: string }) => v.resultado === 'pedido').length || 0
    const monto = visitas?.reduce((a: number, v: { monto_pedido?: number }) => a + (v.monto_pedido || 0), 0) || 0
    return {
      title: '🌙 Resumen del día — ISOLA CRM',
      body: `${conPedido}/${total} visitas con pedido · $${monto.toFixed(0)} total`,
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

    const r = await sendTelegram(`${payload.title}\n${payload.body}`)
    return NextResponse.json({ ok: true, sent: r.status < 300 ? 1 : 0, result: r })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
