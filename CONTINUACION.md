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

## Sistema completo — componentes (actualizado 2026-09-30)

### CRM Web (Next.js + Supabase + Vercel)
- Páginas: Dashboard, Clientes, Ficha de cliente (con Análisis IA vía Groq), Registrar Visita, Cobros (con vista "Cierre de mes"), Despachos (arranque limpio desde 2026-09-29, ver sesión), Métricas, Catálogo, Guía diaria, **Planificación** (plan mensual autogenerado cada mes vía `/api/plan-mensual` + semanal/diario manual, con checklist), **Incentivo** (seguimiento en vivo del concurso Tren Verano Solidario 2026), **Rutero por guía (`/r/[numero_guia]`, pública, para choferes)**
- PWA instalable, banner de alertas in-app por horario (6-9am, 9-11am cobros, 8-10pm)
- Tablas Supabase: `clientes` (con `lat`/`lng`), `visitas`, `cobros` (con `origen`: `crm` o `isola_cxc`), `metas` (con `meta_cajas`), `metas_variables`, `despachos`, `despacho_items`, `planes_trabajo`, `incentivo_snapshot`, `incentivo_exhibiciones`, `incentivo_suc10` — RLS habilitado en todas (desde 2026-09-30)
- `push_subscriptions` fue eliminada (2026-07-25, feature muerta sin uso — notificaciones van 100% por Telegram)
- Cron jobs Vercel: `/api/notify` diario (resumen 9pm + recordatorio de guía), `/api/plan-mensual` día 1 de cada mes 6am Caracas (nuevo, 2026-09-30)
- Integración CXC ISOLA: proceso repetible cada viernes (ver sesión 2026-09-29) — el CxC de ISOLA es ahora la **única fuente de cobros pendientes**; `/visita` ya no crea cobros automáticos (desde 2026-09-29)
- Fix timezone UTC→Venezuela aplicado en dashboard y cobros
- IA vía Groq (Análisis IA + resumen de plan mensual) usa modelo `openai/gpt-oss-20b` (cambiado 2026-09-30, el anterior `llama-3.1-8b-instant` dejó de estar disponible en la cuenta)

### Bot Telegram (@IsolaCRM_bot)
- Reemplazó al bot de WhatsApp (`isola-bot`, eliminado de PM2 el 2026-06-07)
- Alertas automáticas 7am (resumen + metas + ruta del día) y 9pm (sugerencias del día siguiente)
- Comandos: /estado, /cobros, /sinvisitar, /ayuda
- Lee del SQLite local (`isola_crm.db`), NO del CRM web
- Config: `Desktop/isola-crm/telegram-alert/.env`

### Generador de Status WhatsApp
- Script `generar_status.py` — imagen 1080x1080 con logo ISOLA + producto + precio

---

## Sesión 2026-09-30 — resumen de lo trabajado

- **Despachos: reinicio limpio desde hoy**: había decenas de guías viejas (desde junio) sin confirmar entrega, generando ruido. Se agregó `CUTOFF_DESPACHOS_VISIBLE = '2026-09-29'` en `app/despachos/page.tsx` — las guías/pedidos sin despachar anteriores a esa fecha quedan ocultos por defecto (siguen intactos en Supabase, no se borraron), con un toggle "ver guías antiguas" para consultarlos. Mismo patrón que ya existía para el CxC viejo en `/cobros`. Commit `c6cac85`.
- **Plan mensual automático (nueva ruta `/api/plan-mensual`)**: el usuario pidió que la pestaña "Mes" de `/planificacion` deje de mostrar el plan de julio congelado y se regenere cada mes solo. Se construyó una ruta con cron en Vercel (`0 10 1 * *`, día 1 de cada mes 6am Caracas) que arma el plan de forma **determinista** (meta del mes o la anterior como referencia, cartera vencida con top deudores, despachos pendientes, cartera activa, incentivo vigente, feriados de Venezuela calculados con la fórmula de Pascua — no de memoria) y usa Groq **solo** para redactar el párrafo de resumen a partir de esos datos reales (instruido a no inventar nada). Envía aviso por Telegram al generarse. Commits `c9b0ad4`, `1632265`, `37528fa`, `e2854a9`, `aeb8e3d`.
  - Ya se generó y quedó en producción el plan de **Octubre 2026** (id 16 en `planes_trabajo`).
  - **Bug encontrado de paso**: el modelo de Groq `llama-3.1-8b-instant` ya no está disponible en la cuenta (404 model_not_found). Esto también rompía en silencio el "Análisis IA" de la ficha de cliente (`app/api/analisis-ia/route.ts`), llevaba tiempo devolviendo `null` sin avisar. Se cambiaron ambas rutas a `openai/gpt-oss-20b` — es un modelo "razonador", necesita `reasoning_effort: 'low'` e `include_reasoning: false` en el body o manda la respuesta al campo `reasoning` en vez de `content`.
  - La ruta soporta `?periodo=YYYY-MM`, `?force=1` y `?debug=1` (expone el motivo si Groq falla, sin persistirlo en la BD) para pruebas manuales.
- **Chequeo general de seguridad/performance del CRM** (a pedido del usuario): usando los advisors de Supabase + `npm audit`.
  - **RLS estaba deshabilitado en 6 tablas** (`incentivo_productos`, `metas_variables`, `incentivo_snapshot`, `incentivo_suc10`, `planes_trabajo`, `incentivo_exhibiciones`) — ya se habilitó con una política `anon_all_<tabla>` (FOR ALL USING true) igual a la que ya tenían el resto de las tablas, así que no cambió el comportamiento de la app (verificado con curl directo al REST de Supabase, sigue en 200). Adevisors de seguridad ahora en `[]`.
  - Se agregaron los 3 índices de foreign key que faltaban (`cobros.cliente_id`, `despacho_items.cobro_id`, `incentivo_exhibiciones.cliente_id`).
  - Next.js actualizado de `16.2.6` a `^16.3.7` (`npm install next@16.3.7`) — corrige 1 vulnerabilidad crítica (RCE, no aplicaba directo en Vercel pero sí otras: SSRF, DoS por SVG, confusión de caché) y varias altas. **Pendiente**: quedó interrumpida la verificación (`tsc`/`build`) y el commit+push por una falla transitoria del clasificador de permisos de shell — falta retomar esto la próxima sesión antes de dar por cerrado el upgrade.
  - PIN de `PinGate.tsx` (`1234`) sigue siendo solo cosmético (vive en localStorage del navegador, no protege el backend) — se le explicó al usuario que la seguridad real depende de RLS + que nadie filtre la anon key, no del PIN.

---

## Sesión 2026-09-29 — resumen de lo trabajado

- **CxC ISOLA cargado (corte 25/09/2026)**: reconciliación completa — 1 pago real confirmado (JOSEPH BECEL DUBREUSE, doc A15012472, $11.76, ya no aparecía en el CxC nuevo → marcado pagado), ~23 documentos nuevos importados, saldos actualizados donde hubo abono parcial. Resultado: 93 pendientes en `isola_cxc`, $29,103.27. De paso se corrigieron 4 filas legacy duplicadas (formato de factura sin normalizar de antes de la regla de normalización) que se iban a marcar "pagado" por error — se borraron en vez de eso.
- **Cliente nuevo detectado en el CxC**: MIR4591 ORLANDO ENRIQUE DAVILA JULIO (id=198), zona Caracas/La Cruz — agregado a `clientes`, sin `dia_visita` asignado todavía (pendiente).
- **Cambio de flujo de cobros (decisión del usuario)**: como el CxC se actualiza todos los viernes, `/visita` **ya no crea un cobro automático** (`origen=crm`) al registrar una venta — eso duplicaba la misma factura que después entra por el CxC. La visita sigue guardando `nro_factura`/`monto_pedido`/productos para métricas, solo se quitó el `cobros.insert` de `guardar()` en `app/visita/page.tsx` (commit `3d1836f`, pusheado y desplegado). El dinero pendiente ahora vive 100% en el CxC.
- **Limpieza de cobros `crm` pendientes**: de 82 pendientes (~$18,911), se borraron 20 que eran duplicado exacto de algo ya en el CxC (~$9,621). Los 62 restantes (~$9,290, facturas muy recientes que el CxC aún no alcanzaba a reflejar) se dejaron a propósito — se limpiarán solos el próximo viernes cuando el CxC los alcance.
- **Tren Verano — corte revisado**: archivo nacional recibido con puntajes recalculados. Daniel Guaramato: ranking nacional #28 de 187 (bajó de #23, más competencia), pero el total subió de 2717.5 a **2805 pts**. Sigue **#1 de su grupo** (Miranda+Caracas Este) por amplio margen. A nivel territorio, Caracas Este le sigue ganando a Miranda en el comparativo (7,815 vs 7,250 pts). El archivo nacional solo trae puntaje agregado por vendedor, no el detalle de qué cliente contó para exhibiciones — ese detalle vive únicamente en el checklist propio del CRM (`incentivo_exhibiciones`): Osole 12 confirmados por ISOLA / 65 marcados hechos sin confirmar / 79 sin hacer; Renata 112 hechos / 0 confirmados / 44 sin hacer.
- **Próximo concurso "Olé Q4" analizado (aún sin construir en el CRM)**: octubre-noviembre 2026, categoría Mayonesa Olé + Pizza+ Olé, canal venta directa. El premio que le aplica a Daniel es "mejor asesor del grupo" ($200, compite solo contra RDV de Miranda+Caracas Este, criterio: % activación sobre cartera). Dato preocupante: en el corte de Tren Verano su activación en esas 2 categorías está en 0 puntos (Pizza+ 3/105 clientes, Aderezos 15/105) — entra al concurso nuevo con poca base ganada ahí. El usuario pidió tener el análisis listo pero no construir nada todavía; avisará cuándo arrancar (previsiblemente 1 de octubre, al cerrar Tren Verano).

---

## Julio-septiembre 2026 — reconstruido desde `git log` (no se había actualizado este doc en ese rango)

- **`/planificacion`** (desde 12/07): planes de trabajo mensual/semanal/diario, tabla `planes_trabajo`, checklist interactivo por ítem con barra de progreso.
- **Cobros — "Cierre de mes"** (desde 29/07, corregido 18-22/08): pestaña en `/cobros` que separa la deuda pendiente en Grupo A (facturas >21 días) y Grupo B (cruzan los 21 días antes de fin de mes). Corregido bug de duplicado crm+isola_cxc; desde el 22/08 usa el CxC oficial de ISOLA como fuente en vez de los cobros manuales.
- **`/incentivo` — Tren Verano Solidario 2026** (desde 03/08, evolución constante hasta hoy): trackea en vivo 4 productos clave de Venta Directa (Caramelos Alka, Osole BPC, Baterías GP, Ketchup Osole) vs cuota, dropsize, ranking nacional, comparativo de territorio Miranda vs Caracas Este, checklist de exhibiciones adicionales Osole (72 candidatos) y luego también Renata (72 más), distinción confirmada-por-ISOLA vs pendiente, facturación/cobranza oficial de ISOLA, y tabla de posición de cada RDV del grupo (`incentivo_suc10`).
- **Conciliación CxC** (18/08): vista `/conciliacion` que cruza cobros propios vs CxC de ISOLA por cliente+monto±$2+fecha±15d.
- Detalle completo de cada commit de este rango queda en la memoria de Claude (`project_isola_crm.md`, sección "Novedades julio-septiembre 2026").

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
- [ ] **Retomar upgrade de Next.js**: `npm install next@16.3.7` ya corrió (package.json en `^16.3.7`), pero falta correr `tsc`/`build` para confirmar que no rompió nada y hacer commit+push — quedó interrumpido por una falla transitoria del clasificador de permisos de shell (2026-09-30)
- [ ] Cargar la meta oficial de octubre en `metas` (periodo `2026-10`) — el plan mensual de octubre usó la de agosto como referencia porque todavía no estaba cargada
- [ ] Concurso Olé Q4: construir sección en `/incentivo` cuando el usuario avise que arranca (esperando su cuota individual de cajas Mayonesa/Pizza+, no viene en el PPTX del concurso)
- [ ] Asignar `dia_visita` a MIR4591 Orlando Davila Julio (cliente nuevo detectado en el CxC del 25/09)
- [ ] Revisar con ISOLA los 65 clientes de exhibiciones Osole marcados "hechos" que aún no confirman en el corte oficial (y las 112 de Renata, 0 confirmadas hasta ahora)
- [ ] Los 62 cobros `crm` pendientes que no matchean el CxC (facturas muy recientes) se resuelven solos cuando el próximo CxC los alcance — no requiere acción, solo monitorear
- [ ] FASE 4: Dashboard de métricas avanzadas (bajo demanda)
- [x] Auth simple (PIN) para proteger el CRM web — ya existe (`components/PinGate.tsx`, PIN `1234`, se guarda en localStorage del dispositivo). Nota (2026-09-30): es solo un filtro cosmético, no seguridad real — la seguridad real depende de RLS en Supabase (ya habilitado en todas las tablas) y de que la anon key no se filtre
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
