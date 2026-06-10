export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { cliente, visitas } = await req.json()

  const notasConTexto = (visitas as any[]).filter((v: any) => v.notas_visita?.trim())

  if (!notasConTexto.length) {
    return Response.json({ analisis: null })
  }

  const notasTexto = notasConTexto
    .slice(0, 10)
    .map((v: any) => `- ${v.fecha} (${v.resultado}, $${v.monto_pedido || 0}): "${v.notas_visita}"`)
    .join('\n')

  const prompt = `Eres un asistente de ventas para un vendedor de campo de ISOLA Foods Venezuela. Tu trabajo es ayudar al vendedor a resolver situaciones con sus clientes antes de la visita.

Cliente: ${cliente.nombre_negocio}${cliente.propietario ? `\nPropietario: ${cliente.propietario}` : ''}

Notas de visitas recientes:
${notasTexto}

Analiza estas notas y responde en español con exactamente este formato (sin introducción, directo al punto):

**Situación actual:** [qué problemas o casos están pendientes, máx 2 líneas]

**Cómo manejarlo hoy:**
→ [acción concreta 1]
→ [acción concreta 2]
→ [acción concreta 3 si aplica]

**Oportunidad:** [una cosa específica que puedes ofrecerle basado en su historial]`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 350,
      temperature: 0.3,
    }),
  })

  const data = await res.json()
  const analisis = data.choices?.[0]?.message?.content?.trim() || null

  return Response.json({ analisis })
}
