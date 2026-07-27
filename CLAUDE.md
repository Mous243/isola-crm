# ISOLA CRM Web

CRM de campo para un vendedor de ISOLA (Venezuela). PWA instalable en Next.js 16 (App Router) + Supabase + Vercel. Deploy en producción: https://isola-crm-web.vercel.app

Para el estado detallado del proyecto (sesiones de trabajo, pendientes, credenciales, decisiones tomadas), ver [CONTINUACION.md](CONTINUACION.md) — es el doc canónico y se mantiene actualizado en cada sesión.

## Stack
- Next.js 16.2.6 (App Router, `app/`), React 19, TypeScript
- Tailwind CSS 4
- Supabase (`lib/supabase.ts`) — proyecto `qymlqfcdmgyqipkznrvv`
- Groq (análisis IA en ficha de cliente)
- Cron jobs en Vercel (`vercel.json`) para notificaciones por Telegram

## Estructura
- `app/` — páginas: dashboard (`page.tsx`), `clientes/`, `cobros/`, `despachos/`, `visita/`, `metricas/`, `catalogo/`, `guia/`, `planificacion/` (plan mensual/semanal/diario), `r/[guia]/` (rutero público para choferes)
- `app/api/` — rutas API: `analisis-ia`, `clientes`, `cobros`, `notify`, `productos`, `visitas`
- `components/` — `PinGate.tsx` (auth simple por PIN), `Nav.tsx`, `InstallBanner.tsx`, `ClienteFichaModal.tsx`
- `supabase_schema.sql` — esquema base de la base de datos (algunas tablas como `despachos`, `despacho_items`, `metas_variables` y `planes_trabajo` se agregaron después vía SQL directo en Supabase, no están en este archivo)

## Automatizaciones por Telegram (PM2, en `Desktop/isola-crm/telegram-alert/`)
- `reporte_metas.py` — RDV diario 7am (lun-vie), formato fijo por día de semana + alerta de pedidos sin despachar
- `cobros_diarios.py` — 8am (lun-vie), cobros vencidos/por vencer con link de WhatsApp pre-redactado por cliente (usuario autoriza tocando el link)
- `sugerencias_clientes.py` — 9pm, sugerencias de venta para la ruta del día siguiente

## Notas
- No confundir con `Desktop/isola-crm/` (versión Streamlit local con SQLite + bots de Telegram) — es un proyecto hermano, no relacionado por datos (usan bases distintas).
- El usuario trabaja el día a día en esta app web (Supabase), no en la local.
