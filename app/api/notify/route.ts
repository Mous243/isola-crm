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

async function buildPayload() {
  const hora = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', hour12: false })
  const h = parseInt(hora)

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
