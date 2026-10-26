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
- Integración CXC ISOLA: proceso repetible cada viernes (ver sesión 2026-09-29) — el CxC de ISOLA es ahora la **única fuente de cobros pendientes**; `/visita` ya no crea cobros automáticos (desde 2026-09-29) ni captura montos (desde 2026-10-20: solo productos/cajas)
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

## Sesión 2026-10-25 — resumen de lo trabajado

- **CxC ISOLA cargado (corte 23/10/2026)**, archivo `DANIEL GUARAMATO DOLARES ($) (8).pdf` (119 facturas, 85 clientes, $31,674.89). Reconciliación por `nro_documento_isola` normalizado: 26 facturas nuevas (vencimiento = emisión + 21), 1 abono parcial (MIR4223 A15012723 → $82.23), 5 marcadas pagadas (ids 478, 972, 967, 977, 946). Resultado: 112 pendientes/parciales, $31,569.78. La diferencia de $105.11 vs el PDF son 7 facturas ya pagadas por el usuario cuyo saldo ISOLA aún muestra: **son notas de crédito por volumen (5%)**, no deuda.
- **Notas de crédito** (`/notas-credito`, tabla `solicitudes_nc`): botón "🧾 Agregar a NC" en cada factura de `/cobros`; la lista guarda código, cliente, factura, monto (de la factura), N/C (monto × 5%, editable), negociación ("Volumen 5%") y observación. Exporta Excel (mismo formato de `Formato NC Isola.xlsx`, con fórmula del 5%) y PDF; tras descargar ofrece marcar como "enviadas" (historial). Usa `exceljs`. Commit `2ffe67b`.
- **Corrección NC (2026-10-26)**: MONTO = **total original de la factura**; N/C = **saldo que ISOLA aún muestra** (≈5%, no se calcula). Antes se calculaba N/C = monto × 5% sobre el saldo, error que salió en el primer envío. `cobros.monto_original` guarda el total (null = desconocido → se usa `monto`); `monto` es el saldo y ISOLA lo reduce con abonos. **Al cargar cada CxC, guardar el Neto del PDF en `monto_original`.** `solicitudes_nc` quedó con 8 filas por enviar (A15013210 se quitó: no era NC). Totales confirmados por el usuario: A15011604 323.64/16.18, A15012463 209.90/10.50, A15012730 197.76/9.89.
- **Cartera ISOLA** (`/cartera`, tabla `cartera_isola`, 147 clientes de `Reporte Venta 0.xlsx`, hoja Tabla Clientes, corte 25/10): clientes **sin venta** (79 en el reporte, 71 con match en el CRM) ordenados por días sin visita, filtro por día de visita, aviso "con deuda: cobrar primero", WhatsApp; y pestaña **líneas por activar** (OSOLE Compotas, OSOLE Salsas, OLE Salsas, ALKA). La ficha del cliente muestra sus líneas activas. 8 clientes de la cartera ISOLA no existen aún en `clientes` (MIR4588, 4589, 4590, 4607, 4608, 4648, 4655, 4656); 28 del CRM no están en la cartera ISOLA.
- **Semáforo ISOLA** en `/cobros`: % CxC >21 y >30 días y días calle, calculados en vivo desde `fecha_emision` (así los mide ISOLA; el EDC del 23/10 dice $30,978 CxC, 85% >21d, 80% >30d, 69.7 días calle). Muestra el total de NC en lista.
- Los reportes de `Desktop/Nueva carpeta/` (EDC VD, Reporte de Seguimiento, Reporte Venta 0) son corporativos de todas las sucursales; solo se usó la fila ISOLA MIRANDA / DANIEL GUARAMATO. `cartera_isola` es una foto: hay que recargarla cuando llegue un reporte nuevo.

---

## Sesión 2026-10-20 — resumen de lo trabajado

- **Decisión de flujo (usuario): el dinero vive 100% en el CxC de ISOLA; las visitas solo llevan productos/cajas.** `/visita` es para dar seguimiento a incentivos/concursos y a lo que ISOLA exige facturar; los montos y fechas exactas llegan con el CxC (cada viernes) y los pagos los marca el usuario ahí.
- **Limpieza de cobros `origen=crm`**: se borraron los 18 pendientes/parciales ($4,990.40): duplicados del CxC (301, 873, 874), parciales ya pagados en el CxC (19, 38), la factura de La Rana por $3,152.60 (id 607) y 13 facturas chicas de sep (no aparecían en ningún corte del CxC). **Respaldo en la tabla `cobros_crm_backup`** (Supabase) por si hay que revertir. Resultado verificado: solo queda `isola_cxc` pendiente — 98 facturas, 72 clientes, **$29,573.04**. (El `DELETE` lo ejecutó el usuario en el editor SQL; el clasificador de permisos lo había bloqueado de nuevo.)
- **`/visita` sin monto** (commit `174341f`, desplegado READY): se quitó el campo de monto, el total del pedido y el `$` del historial; `monto_pedido` se guarda en 0 en visitas nuevas (las viejas conservan su monto). El mensaje de WhatsApp de confirmación sale sin total.
- **Señal de "visita con pedido"** ahora es `tienePedido()` en `lib/supabase.ts`: visita efectiva con `productos_pedidos` no vacío (o `monto_pedido > 0` para el histórico). `cajasVisita()` suma las cajas. Se usa en Dashboard, Despachos (pedidos sin despachar), Métricas, fichas de cliente (ticket promedio → cajas/pedido), resumen Telegram de las 9pm, `/clientes`. En Métricas se quitó la barra "Monto del mes" y el input "Meta USD"; los $ pasaron a cajas. `/incentivo` ordena por cajas y su respaldo de facturado/cobrado ahora lee `isola_cxc` (antes `crm`). El Análisis IA ya no recibe montos.
- **Pendiente detectado — fechas de vencimiento del CxC**: las facturas cargadas antes del corte del 16/10 tienen `fecha_vencimiento = fecha_emision` (las del 16/10 en adelante usan emisión + 21 días). Eso infla los "días vencidos" de las viejas en 21 días en cobros/dashboard. Con la regla emisión+21: **51 facturas vencidas de 31 clientes, $25,333.29** (1-30d $1,153.15 · 31-90d $12,475.43 · +90d $11,704.71). Falta decidir si se corrige con un `UPDATE` (no toca montos).
- **Concentración de deuda**: La Rana ($10,450.20, 3 facturas, 39-40 días vencida) y Lunchería Gilchris III ($6,023.26, ~300 días) = 56% del total.

---

## Sesión 2026-10-16 — resumen de lo trabajado

- **CxC ISOLA cargado (corte 16/10/2026)**, archivo `DANIEL GUARAMATO DOLARES ($) (1).pdf` (134 facturas + 2 ADEL, total PDF $33,187.17). Misma reconciliación de siempre, comparando por `nro_documento_isola` normalizado (`00005011230` → `5011230`; `A100005013102` → `A15013102`): 27 facturas nuevas insertadas (vencimiento = emisión + 21 días), 4 saldos actualizados por abono parcial, 7 marcadas pagadas por haber desaparecido del reporte (fecha_pago 2026-10-16). Cliente nuevo: MIR4669 INVERSIONES VALERO 1518 C.A (Guarenas), sin `dia_visita`. Resultado: 124 pendientes/parciales, $31,721.09. La diferencia de $1,466.08 contra el PDF son 10 facturas que el usuario ya había marcado pagadas y ISOLA aún muestra (se dejan pagadas, no se reabren). Casos raros: A15012730 (MIR3616) CxC muestra $9.89 vs $197.76 pagado en la base; A15013150 (MIR2156) $1,152.38 vs $1,165.02.
- **Limpieza de `cobros` origen=crm pendiente — SIN HACER**: el clasificador de permisos bloqueó el `DELETE`. Duplicados ya cubiertos por el CxC: ids 873, 866, 877, 871, 874, 301. Los ids 19 y 38 (parciales) coinciden con facturas del CxC ya pagadas, falta decidir.
- **Primer avance Concurso Olé Q4 VD** (`Concurso Olé Q4 VD.pdf`, 16/10): ponderación por producto **activación 40% (0.40 pts c/u) + volumen 10% (0.10 pts por caja)**, Mayonesa y Pizza+ valen igual. Mayonesa 170g/340g = 1 activación por cliente; Pizza+ = 5 productos (caja mixta, tradicional 200g/300g, maíz, jamón, pepperoni), cada uno 1 activación. Sucursales: ranking 20→1 en activación (% sobre cartera) y volumen (% cuota octubre). Cortes mensuales.
  - Daniel: **12.80 pts, #1 del Grupo 1** (Teymar Manaure 10.40, Charles Briceño 8.30, Gabriela Ramos 8.10), ~#5 nacional. Mayonesa 28 cajas/20 act; Pizza+ 4 cajas/4 act (maíz 1, tradicional 1, mix 2). Sucursal Miranda 31 pts (#3): volumen #1, activación #10.
  - Cifras a nivel sucursal de Miranda (9 Pizza+/15 mayo act) no cuadran con la suma de sus RDV (~46/~47) — pendiente preguntar a ISOLA. El PDF no trae detalle por cliente.
- **`/incentivo` corregido** (commit `c88250e`, desplegado): el conteo ahora es por **código de producto** y no por nombre — antes `pizza` en el nombre metía la caja CSPL001 (salsa de tomate mixta boloñesa/napolitana/pizza/tradicional), que NO es Pizza+ (23 clientes la habían pedido). Códigos que cuentan: Mayonesa `SPAOLE007`, `OLE-6-22-51`; Pizza+ `SPL003`, `SPL012`, `1573`, `SPL006`, `SPL007`, `CSPL002`. Se corrigió la guía (estaba 80/20 volumen/activación, ahora 40/10 del PDF), se muestra qué producto compró cada activado y los puntos estimados. Estado al 16/10: Mayonesa 21 clientes activados en el CRM (ISOLA acredita 20), Pizza+ 4 (Alimentos Plaza Mayorss, Izcalago 2021, Las Dos M 2022, Eglis Quintero) — solo Alimentos Plaza tiene ambos.
  - **Por confirmar con ISOLA**: si `1573` (340g) cuenta como tradicional, si la caja mixta es `CSPL002` (maíz/jamón/pepperoni), y que CSPL001 no cuenta. Nadie ha pedido jamón ni pepperoni aún.

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
- [x] Upgrade de Next.js a 16.3.7: ya commiteado (`3e9e1cf`) y desplegado; `tsc` pasa limpio (2026-10-16)
- [ ] Cargar la meta oficial de octubre en `metas` (periodo `2026-10`) — el plan mensual de octubre usó la de agosto como referencia porque todavía no estaba cargada
- [x] Concurso Olé Q4: sección en `/incentivo` construida (ver sesión 2026-10-16). Falta: confirmar con ISOLA los códigos dudosos (1573, CSPL002, CSPL001) y la cuota individual real de cajas Mayonesa/Pizza+ (la de la app es tentativa)
- [x] Borrar cobros `crm` duplicados/pendientes — hecho 2026-10-20 (18 filas; respaldo en `cobros_crm_backup`, se puede borrar esa tabla cuando ya no haga falta)
- [ ] Corregir `fecha_vencimiento` de las facturas `isola_cxc` cargadas antes del 16/10 (hoy = emisión; debería ser emisión + 21). `UPDATE` pendiente de aprobación del usuario
- [ ] Asignar `dia_visita` a MIR4669 Inversiones Valero 1518 (cliente nuevo del CxC del 16/10)
- [ ] Preguntar a ISOLA por qué las activaciones de la sucursal Miranda (9/15) no cuadran con la suma de sus RDV
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
