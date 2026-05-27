export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function hoy() { return new Date().toISOString().split('T')[0] }
function en3Dias() {
  const d = new Date(); d.setDate(d.getDate() + 3)
  return d.toISOString().split('T')[0]
}

async function buildPayload() {
  const hora = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', hour12: false })
  const h = parseInt(hora)

  // 7am — Resumen matutino
  if (h >= 6 && h < 9) {
    const { data: sinVisitar } = await supabase
      .from('clientes').select('id').in('status', ['activo', 'nuevo'])
      .lt('fecha_ultima_visita', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
    const { data: cobros } = await supabase
      .from('cobros').select('id').eq('estado', 'pendiente').eq('fecha_vencimiento', en3Dias())
    return {
      title: '☀️ Buenos días — ISOLA CRM',
      body: `${sinVisitar?.length || 0} clientes sin visitar · ${cobros?.length || 0} cobros urgentes`,
    }
  }

  // 9pm — Resumen nocturno
  if (h >= 20 && h < 22) {
    const { data: visitas } = await supabase
      .from('visitas').select('resultado, monto_pedido').eq('fecha', hoy())
    const total = visitas?.length || 0
    const conPedido = visitas?.filter(v => v.resultado === 'pedido').length || 0
    const monto = visitas?.reduce((a, v) => a + (v.monto_pedido || 0), 0) || 0
    return {
      title: '🌙 Resumen del día — ISOLA CRM',
      body: `${conPedido}/${total} visitas con pedido · $${monto.toFixed(0)} total`,
    }
  }

  // 10am — Cobros
  if (h >= 9 && h < 11) {
    const { data: cobros } = await supabase
      .from('cobros').select('monto, clientes(nombre_negocio)')
      .eq('estado', 'pendiente').eq('fecha_vencimiento', en3Dias())
    if (!cobros?.length) return null
    return {
      title: '💰 Cobros próximos — ISOLA CRM',
      body: `${cobros.length} cobro${cobros.length > 1 ? 's' : ''} vence en 3 días`,
    }
  }

  return null
}

export async function GET() {
  try {
    const payload = await buildPayload()
    if (!payload) return NextResponse.json({ ok: true, sent: 0 })

    const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
    if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 })

    let sent = 0
    for (const row of subs) {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify(payload))
        sent++
      } catch {
        // Suscripción expirada, ignorar
      }
    }

    return NextResponse.json({ ok: true, sent })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
