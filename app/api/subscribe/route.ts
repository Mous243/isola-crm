import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const subscription = await req.json()
  await supabase.from('push_subscriptions').upsert(
    { subscription },
    { onConflict: 'id' }
  )
  return NextResponse.json({ ok: true })
}
