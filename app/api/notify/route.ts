export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { webcrypto } from 'node:crypto'

const { subtle, getRandomValues } = webcrypto

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── utils ─────────────────────────────────────────────────────────────────

const enc = new TextEncoder()

function b64u(b: Uint8Array): string {
  return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function db64u(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'))
}

// ─── VAPID JWT (ES256) ──────────────────────────────────────────────────────

async function vapidJWT(audience: string): Promise<string> {
  const pub = db64u(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)
  const key = await subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: process.env.VAPID_PRIVATE_KEY!, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)) },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
  const h = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const p = b64u(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: process.env.VAPID_EMAIL!,
  })))
  const msg = `${h}.${p}`
  const sig = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(msg)))
  return `${msg}.${b64u(sig)}`
}

// ─── RFC 8291 payload encryption (aes128gcm) ───────────────────────────────

async function encryptPayload(payload: string, p256dh: string, auth: string): Promise<Uint8Array> {
  const clientPub = db64u(p256dh)
  const authSec = db64u(auth)

  const serverKP = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const serverPub = new Uint8Array(await subtle.exportKey('raw', serverKP.publicKey))

  const clientKey = await subtle.importKey('raw', clientPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverKP.privateKey, 256))

  // IKM = HKDF(salt=auth_secret, IKM=ecdh_secret, info="WebPush: info\0"||clientPub||serverPub, L=32)
  const ecdhKey = await subtle.importKey('raw', ecdhSecret, 'HKDF', false, ['deriveBits'])
  const ikmInfo = new Uint8Array([...enc.encode('WebPush: info\x00'), ...clientPub, ...serverPub])
  const ikm = new Uint8Array(await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSec, info: ikmInfo }, ecdhKey, 256
  ))

  const salt = getRandomValues(new Uint8Array(16))

  const cekInfo = enc.encode('Content-Encoding: aes128gcm\x00\x01')
  const nonceInfo = enc.encode('Content-Encoding: nonce\x00\x01')

  const ikmKey1 = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const cek = new Uint8Array(await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo }, ikmKey1, 128
  ))

  const ikmKey2 = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const nonce = new Uint8Array(await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, ikmKey2, 96
  ))

  const record = new Uint8Array([...enc.encode(payload), 0x02])
  const cekKey = await subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const ciphertext = new Uint8Array(await subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 }, cekKey, record
  ))

  // Header: salt(16) + rs(4,BE) + idlen(1) + serverPub(65) + ciphertext
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)
  return new Uint8Array([...salt, ...rs, serverPub.length, ...serverPub, ...ciphertext])
}

// ─── send one push ──────────────────────────────────────────────────────────

async function sendPush(
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string }
): Promise<void> {
  const body = await encryptPayload(JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth)
  const jwt = await vapidJWT(new URL(sub.endpoint).origin)
  await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt},k=${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
    },
    body: Buffer.from(body),
  })
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
      .from('cobros').select('id').eq('estado', 'pendiente').eq('fecha_vencimiento', en3Dias())
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

// ─── route ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const payload = await buildPayload()
    if (!payload) return NextResponse.json({ ok: true, sent: 0 })

    const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
    if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 })

    let sent = 0
    for (const row of subs) {
      try {
        await sendPush(row.subscription, payload)
        sent++
      } catch {
        // suscripción expirada o inválida
      }
    }

    return NextResponse.json({ ok: true, sent })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
