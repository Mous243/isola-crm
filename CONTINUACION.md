# ISOLA CRM — Estado del Proyecto

> Nota: este archivo es un espejo de `Desktop/isola-crm/CONTINUACION.md` (doc canónico del proyecto completo). Se mantiene también aquí para que quede visible directamente en el repo de `isola-crm-web`.

## URLs en producción
- **Web App (PWA):** https://isola-crm-web.vercel.app
- **GitHub:** https://github.com/Mous243/isola-crm
- **Supabase:** proyecto `qymlqfcdmgyqipkznrvv` (org Mous)

## Directorios locales
| Ruta | Descripción |
|------|-------------|
| `Desktop/isola-crm/` | App Streamlit local (puerto 8503) + bots Telegram |
| `Desktop/isola-crm-web/` | App Next.js PWA (Vercel + Supabase) — **este directorio** |

---

## Sistema completo — componentes (actualizado 2026-06-10)

### CRM Web (Next.js + Supabase + Vercel)
- Páginas: Dashboard, Clientes, Ficha de cliente (con Análisis IA vía Groq), Registrar Visita, Cobros, Despachos, Métricas, Catálogo, Guía diaria, **Rutero por guía (`/r/[numero_guia]`, pública, para choferes)**
- PWA instalable, banner de alertas in-app por horario (6-9am, 9-11am cobros, 8-10pm)
- Tablas Supabase: `clientes` (con `lat`/`lng` desde 2026-06-24), `visitas`, `cobros`, `push_subscriptions`, `metas` (con `meta_cajas`), `metas_variables`, `despachos`, `despacho_items`
- Cron jobs Vercel: notificaciones push **6am** (mensaje RDV diario), 10am, 9pm
- Integración CXC ISOLA: 90 cobros importados (`origen='isola_cxc'`), numeración de facturas nueva (10000001+)
- Fix timezone UTC→Venezuela aplicado en dashboard y cobros

### Bot Telegram (@IsolaCRM_bot)
- Reemplazó al bot de WhatsApp (`isola-bot`, eliminado de PM2 el 2026-06-07)
- Alertas automáticas 7am (resumen + metas + ruta del día) y 9pm (sugerencias del día siguiente)
- Comandos: /estado, /cobros, /sinvisitar, /ayuda
- Lee del SQLite local (`isola_crm.db`), NO del CRM web
- Config: `Desktop/isola-crm/telegram-alert/.env`

### Generador de Status WhatsApp
- Script `generar_status.py` — imagen 1080x1080 con logo ISOLA + producto + precio

---

## Sesión 2026-07-02 — resumen de lo trabajado

- **Flujo de carga de guías de despacho (PDF)**: el usuario envía fotos/PDF de las guías de ISOLA cada noche. Regla clave: **solo se registra en Supabase la guía si tiene al menos un cliente de la cartera propia del usuario** (tabla `clientes`, matcheado por nombre). Si ninguno de los clientes de la guía coincide con la cartera, NO se crea el registro en `despachos` (antes se creaba igual con `despacho_items` vacío y mostraba "Sin clientes tuyos en esta guía" — se descartó ese enfoque).
- **No crear clientes nuevos al cargar una guía**: solo se insertan `despacho_items` para clientes que YA existen en `clientes`. No se crean clientes nuevos aunque aparezcan en la guía (son clientes de otros vendedores/rutas de ISOLA, no del usuario).
- Registradas guías #0624, #0625, #0626, #0628 (01/07/2026) y #0629 (02/07/2026) — 14 `despacho_items` en total, todos de clientes ya existentes. Se guarda también `conductor_telefono` cuando el PDF lo trae (aparece como segundo número bajo "CONTRATADO" o "(GOA)", formato venezolano `04XXXXXXXXX`).
- **Nueva sección "⏳ Pedidos sin despachar aún"** en `/despachos` (`app/despachos/page.tsx`): cruza `visitas` (efectivas, `monto_pedido>0`) contra `despacho_items` por `cliente_id` + fecha, para detectar pedidos tomados que el cliente aún no recibió en ninguna guía. Corte fijo `CUTOFF_PEDIDOS_PENDIENTES = '2026-07-01'` (antes era ventana móvil de 30 días, se cambió porque mostraba ruido de pedidos viejos de junio).
- Nota: los números de factura de `visitas.nro_factura` (interno, `10000xxx`) NO coinciden con los de la guía de ISOLA (`codigo_guia`, `5009xxx`) — son numeraciones distintas, el cruce de pendientes se hace por `cliente_id`, no por número.
- Nota PWA: cambios de código no se ven de inmediato en el celular por el service worker — hay que forzar refresh/reinstalar la PWA tras cada deploy.
- Archivos tocados: `app/despachos/page.tsx` (pusheado a GitHub/Vercel, commits `eb54cd4` y `98f7a4d`)

---

## Pendiente / Ideas para continuar
- [ ] FASE 4: Dashboard de métricas avanzadas (bajo demanda)
- [x] Auth simple (PIN) para proteger el CRM web — ya existe (`components/PinGate.tsx`, PIN `1234`, se guarda en localStorage del dispositivo)
- [ ] Foto de evidencia en visitas (Supabase Storage)
- [ ] Importar clientes desde CSV
- [ ] Modo offline mejorado (service worker)
- [ ] Factor de equivalencia por caja (ej. galletas = 0.25) — columna `peso_caja_kg` ya creada en `productos` (Supabase), vacía. Falta que ISOLA/supervisor confirme el peso real por producto o categoría para poder calcular "cajas equivalentes"
- [ ] Asignar `dia_visita` a 4 clientes que quedaron sin día (ids 61, 71, 75, 86) — el usuario no sabe cuál les toca todavía
- [ ] Completar `lat`/`lng` del resto de los clientes (se va llenando solo cuando el usuario los visita y toca "Guardar mi ubicación aquí" en `/visita`) — hasta que eso pase, el rutero de choferes usa el texto de `direccion`/`zona`, que en Venezuela suele ubicar mal en Maps
- [ ] Completar `direccion` de los 5 clientes nuevos sin dirección (ids 148-152: Comercializadora Nuevo Mundo 2021, Víveres 88 2010, Inversiones Kong Cing Super Todo, Grupo Plazaholass, Inversiones Buenos Aires 2022) — solo tienen `zona`

> Bot WhatsApp con Baileys (Fase 2 original) fue descartado — Telegram cubre la necesidad de alertas y comandos.

---

## Sesión 2026-06-24 — resumen de lo trabajado

- **Registrada guía de despacho #0608** (23/06/2026, conductor YORBY SALAZAR) en Supabase — 12 items, 5 clientes nuevos creados (no existían en `clientes`: Comercializadora Nuevo Mundo 2021, Víveres 88 2010, Inversiones Kong Cing Super Todo, Grupo Plazaholass, Inversiones Buenos Aires 2022)
- **Rediseñado el mensaje matutino de Telegram** (antes resumen genérico 7am) a formato "RDV {Día} / RDV Daniel Guaramato" con: clientes planificados (solo cantidad), volumen diario de cajas según cuota mensual (`metas.meta_cajas`, default 50/día si ya se superó la cuota), cobros pendientes de cartera propia (`origen='crm'`, excluye deuda vieja `isola_cxc`) con los 6 más urgentes, productos foco del mes (Ketchup 200gr, Atomatados Ole, Wafer, Mayonesa OSOLE, Bon o Bon, Maíz Dulce, Guisantes), y aviso si ayer no se registró guía de logística. Ya no envía sábado/domingo. Cron movido de 7am a **6am** hora Caracas
- **Despachos**: ya no se muestran guías históricas entregadas, solo las pendientes desde la guía #0608 en adelante (`CUTOFF_DESPACHOS` en `app/api/notify/route.ts`)
- **Nueva página pública `/r/[numero_guia]`** ("rutero") para choferes: lista los clientes de una guía con botón individual "📍 Cómo llegar" (Google Maps) y un botón de ruta completa multi-parada. En `/despachos` hay un botón "🔗 Copiar rutero" junto a "📞 Llamar chofer" para copiar el link y reenviarlo por WhatsApp
- **Captura de GPS exacto por cliente**: como las direcciones de texto de ISOLA ubican mal en Maps (direcciones informales venezolanas sin numeración real), se agregaron columnas `lat`/`lng` a `clientes` y un botón "📍 Guardar mi ubicación aquí" en `/visita` (usa `navigator.geolocation`, una sola vez por cliente). El rutero usa la coordenada si existe, si no cae al texto de dirección/zona
- Archivos tocados (todos en `isola-crm-web`, pusheados): `app/api/notify/route.ts`, `app/metricas/page.tsx`, `app/despachos/page.tsx`, `app/visita/page.tsx`, `app/r/[guia]/page.tsx` (nuevo), `lib/supabase.ts`, `vercel.json`
- Migraciones Supabase: `metas.meta_cajas`, `clientes.lat`/`clientes.lng`

---

## Sesión 2026-06-19 — resumen de lo trabajado
**Importante: el CRM que el usuario usa día a día es el WEB (`isola-crm-web`, Vercel), no el Streamlit local.**

- Registradas guías de despacho #0598 y #0599 (18/06/2026) en Supabase — 6 items de la cartera del usuario, quedaron en estado `pendiente` (no confirmada la entrega aún)
- Agregada métrica **"Cajas facturadas"** del mes en `/metricas` (suma el campo `cajas` de `productos_pedidos` en `visitas`) — también se replicó en el CRM local (`app.py`/`database.py::get_cajas_mes`) por si se usa a futuro
- Agregado **ranking "Cajas facturadas por cliente (mes)"** en `/metricas` y dato individual en la ficha del cliente (`components/ClienteFichaModal.tsx`)
- Auditoría completa de datos: zona completada para 58 clientes (derivada de `direccion`), detectados $14,051 en cobros vencidos pendientes (de los cuales $11,855 son deuda vieja ISOLA CXC sin acción posible)
- **Deuda vieja ISOLA CXC oculta por defecto**: ya no aparece en dashboard ("cobros urgentes"), ni en el reporte de Telegram 7am, ni en `/cobros` por defecto — hay un botón "👁 ver antiguos" en `/cobros` para revisarla cuando se necesite
- Archivos tocados: `app/metricas/page.tsx`, `app/page.tsx`, `app/cobros/page.tsx`, `components/ClienteFichaModal.tsx` (todos en `isola-crm-web`, ya pusheados a GitHub/Vercel)

---

## Credenciales y configuración

### Supabase
- **Project ID:** `qymlqfcdmgyqipkznrvv`
- **URL:** `https://qymlqfcdmgyqipkznrvv.supabase.co`
- **Anon key:** en `.env.local` y en Vercel (encrypted)

### Telegram Bot
- Config en `Desktop/isola-crm/telegram-alert/.env`
- Variables: `TELEGRAM_TOKEN` y `TELEGRAM_CHAT_ID`

### Vercel
- Proyecto: `isola-crm-web` en team `mous243s-projects`
- Auto-deploy desde GitHub rama `main`

### Groq (Análisis IA en ficha de cliente)
- `GROQ_API_KEY` en Vercel env y `.env.local`

---

## Comandos útiles

```bash
# Correr CRM local
cd Desktop/isola-crm
streamlit run app.py --server.port 8503

# Correr bot Telegram
cd Desktop/isola-crm/telegram-alert
python bot.py

# Deploy manual a Vercel
cd Desktop/isola-crm-web
git add . && git commit -m "mensaje" && git push origin main

# Recargar catálogo de productos (SQLite local)
cd Desktop/isola-crm
python cargar_catalogo.py
```

---

## Notas importantes
- El CRM **NO interfiere** con la app oficial de ISOLA — es complementario
- Los datos se ingresan **manualmente** (ISOLA no tiene API pública)
- La app de ISOLA requiere GPS físico en el cliente para tomar pedidos
- El usuario registra visitas en el CRM **WEB** (Supabase), no en el local
- **Fecha de inicio trabajo:** lunes 2 junio 2026
- Estado detallado y completo del proyecto (PM2, métricas, bugs, despachos) está en la memoria de Claude (`project_isola_crm.md`)
