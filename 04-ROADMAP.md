# Roadmap por fases + checklist de producción

> Calendario realista para una persona o un equipo chico (1–3 devs).
> Cada fase termina con un release vendible: nada de "está casi listo" durante 6 meses.

---

## Cómo leer este roadmap

- **Sprints** de 1 semana. Estimaciones para 1 dev full-time o 2 part-time.
- **DoD (Definition of Done)** = lo que tiene que ser cierto para cerrar la fase y poder cobrar.
- **Demo-able** = lo que puedes mostrar en venta sin disculpas.

---

## Fase 0 — Fundaciones (semana 1–2)

**Objetivo:** entorno reproducible y la DB lista en Supabase.

| Sprint | Entregables |
|--------|-------------|
| S1 | Repos `inventario-backend` y `inventario-frontend` creados. Pre-commit (ruff, prettier, eslint). CI mínimo en GitHub Actions. `.env.example` versionado. Aplicar `01-schema.sql`, `02-rls.sql`, `03-seed.sql` en Supabase. Probar RLS con dos JWT diferentes (que A no vea data de B). |
| S2 | `backend/` con FastAPI hello world + healthcheck + middleware de tenant context (lee JWT de Supabase, setea `app.current_empresa_id`). `frontend/` con Vite + Tailwind + shadcn instalados, layout base (sidebar/topbar) renderizado con datos mock. Deploy de prueba: backend en Hetzner staging, frontend en Cloudflare Pages preview. |

**DoD Fase 0:** un `curl` con JWT válido al backend devuelve `{ ok: true, empresa_id: '...' }`. El frontend en preview muestra el shell logueado con datos mock.

---

## Fase 1 — Auth, empresas, inventario (semanas 3–7)

**Objetivo:** primer cliente puede entrar, dar de alta su empresa, productos y movimientos. **Vendible.**

| Sprint | Entregables |
|--------|-------------|
| S3 | **Auth**: login, refresh, logout. Onboarding de empresa nueva (wizard 3 pasos: empresa, primer admin, plan trial). Selector de empresa al login (si user pertenece a varias). Política de sesión básica (`empresa_politicas_acceso`). |
| S4 | **Inventario backend**: CRUD productos, categorías, unidades, almacenes. Endpoint `POST /movimientos` que llama a `registrar_movimiento_stock`. Auditoría escribiendo en `auditoria`. Test de integración: crear producto → entrada de stock → consulta de stock → salida. |
| S5 | **Inventario frontend**: lista paginada de productos con búsqueda, formulario crear/editar, modal de ajuste de stock, vista de almacenes, vista de movimientos con filtros (fecha, producto, tipo). Atajo `Cmd+K`, atajo `N`, skeletons al cargar, toasts al guardar. |
| S6 | **Reportes básicos**: stock por almacén exportable a Excel, kardex de un producto, productos bajo mínimo, movimientos por período. |
| S7 | **Hardening**: tests E2E con Playwright cubriendo el flujo principal. Sentry en backend y frontend. Logs estructurados. Dashboard de health (uptime + p95 latencia). Documentación de onboarding para clientes. |

**DoD Fase 1:** un nuevo cliente puede registrarse, configurar su empresa, cargar 100 productos, hacer 50 movimientos y exportar el kardex. Sin que tú toques la DB. **Empieza el cobro.**

---

## Fase 2 — Ventas y compras (semanas 8–12)

**Objetivo:** cubrir el ciclo comercial completo. Salto de "control de inventario" a "operaciones".

| Sprint | Entregables |
|--------|-------------|
| S8 | Esquema SQL: clientes, ventas (cabecera + detalle), pagos, formas de pago, condiciones de pago. Reaplicar el patrón multi-tenant + RLS. Trigger que al cerrar una venta llama a `registrar_movimiento_stock` por cada línea. |
| S9 | Backend ventas: cotizaciones → ventas → pagos. Cálculo de totales con descuentos e impuestos. Anulación con reverso automático de stock. |
| S10 | Frontend ventas: punto de venta (POS) rápido teclado-friendly + flujo "cotización-venta-cobro". Búsqueda de productos por SKU/código de barras. |
| S11 | Compras: proveedores, órdenes de compra, recepción. Al recibir, descarga al stock con costo y recalcula promedio. |
| S12 | Dashboard ejecutivo: ventas del día/semana/mes, productos top, clientes top, margen bruto. Charts con Recharts/Chart.js. |

**DoD Fase 2:** una distribuidora pequeña reemplaza su Excel con esto.

---

## Fase 3 — Distribuidoras (semanas 13–17)

**Objetivo:** vendedores en la calle, control comercial real.

| Sprint | Entregables |
|--------|-------------|
| S13 | App móvil PWA: login simple, ruta del día, lista de clientes asignados, mapa, "iniciar visita". |
| S14 | Pedido en campo offline-first: capturar pedidos sin red, sincronizar al volver online. Conflictos de stock resueltos en server. |
| S15 | Vehículos como almacén móvil: carga del camión al inicio del día, devoluciones al final. |
| S16 | Comisiones por vendedor, por producto, por meta. Liquidación quincenal exportable. |
| S17 | Multi-sucursal: transferencias entre sucursales con aprobación. Reportes consolidados y por sucursal. |

**DoD Fase 3:** una distribuidora con 5 vendedores en la calle opera completamente con esto.

---

## Fase 4 — Addons monetizables (semanas 18+)

Cada addon es un sprint independiente — se desbloquea cuando hay 3+ clientes pidiéndolo. **No construir antes de demanda.**

- **Agente IA**: asistente con contexto de la empresa (sugerir reorden, detectar mermas, responder en lenguaje natural).
- **E-commerce**: tienda pública conectada al stock, pagos con Stripe/Tigo Money/QR.
- **Geolocalización**: tracking en tiempo real de vendedores, geocercas en visitas.
- **Crédito avanzado**: scoring, líneas de crédito, recordatorios automáticos.
- **Notificaciones**: WhatsApp Business API, email transaccional, plantillas por evento.
- **Analítica avanzada**: cohortes de clientes, predicción de demanda.
- **Facturación SIAT (Bolivia)**: integración oficial.
- **Seguridad por dispositivo/IP**: ya hay tablas; el frontend de configuración es lo que falta.

---

## Checklist de producción (no salir a vender sin esto)

### Seguridad
- [ ] Todas las tablas operativas con RLS activo (`select tablename, rowsecurity from pg_tables where schemaname='public'` → todas `true`).
- [ ] El rol del backend NO es superuser y NO tiene `BYPASSRLS`.
- [ ] Service-role key solo en variables de entorno del backend, nunca expuesta al frontend.
- [ ] HTTPS forzado (Cloudflare + Let's Encrypt en Nginx).
- [ ] Headers: HSTS, X-Frame-Options DENY, CSP estricto, X-Content-Type-Options nosniff.
- [ ] Rate limiting por IP y por user_id en endpoints sensibles (login, password reset).
- [ ] Bloqueo temporal tras N intentos fallidos de login.
- [ ] Passwords con bcrypt/argon2 (Supabase Auth ya cumple).
- [ ] Backups automáticos diarios + test de restore mensual.
- [ ] Logs sin secretos (filtrar Authorization header).
- [ ] Dependencias auditadas (Dependabot, `pip-audit`, `npm audit`).

### Multi-tenant
- [ ] Test automatizado: usuario A no puede leer ni escribir data de empresa B (intentar a través de la API; tiene que devolver 0 filas o 403).
- [ ] Verificar que `empresa_id` está en TODAS las tablas operativas.
- [ ] Verificar que el JWT contiene `empresa_id` y se valida en cada request.
- [ ] Test E2E que cambia de empresa en runtime (multi-empresa por usuario).

### Performance
- [ ] Índices en `(empresa_id, ...)` en TODAS las tablas operativas grandes.
- [ ] EXPLAIN ANALYZE de las 5 consultas más usadas, sin Seq Scan.
- [ ] React Query con `staleTime` configurado por tipo de dato.
- [ ] Bundle frontend < 300 KB initial gzip. Lazy load por módulo.
- [ ] Imágenes optimizadas (WebP, lazy loading nativo).
- [ ] CDN para estáticos (Cloudflare Pages lo da gratis).

### Observabilidad
- [ ] Sentry en backend y frontend con tags `empresa_id`, `user_id`, `version`.
- [ ] Logs estructurados JSON con `correlation_id` por request.
- [ ] Healthcheck `/health` que valida DB + dependencias críticas.
- [ ] Uptime monitor externo (Better Stack / UptimeRobot).
- [ ] Métricas: requests/min, p50/p95/p99 latencia, error rate, por endpoint.

### Operación
- [ ] Migraciones versionadas con Alembic. Cada PR que toca DB tiene su migration.
- [ ] Pipeline CI bloquea merge si tests fallan, lint falla o coverage baja.
- [ ] Pipeline CD con aprobación manual para producción.
- [ ] Procedimiento documentado de rollback (DB + app).
- [ ] Runbook de incidentes (qué revisar primero ante cada tipo de alerta).

### Negocio / legal
- [ ] Términos y condiciones, política de privacidad firmadas legalmente.
- [ ] Procesador de pagos integrado (Stripe / pasarela local) y probado.
- [ ] Facturación a clientes automatizada (al menos email con detalle).
- [ ] Proceso de exportación de datos del cliente (data portability).
- [ ] Proceso de eliminación de cuenta (con período de gracia).
- [ ] SLA documentado y comunicado.

### UX
- [ ] Onboarding < 5 minutos hasta el primer producto cargado.
- [ ] Mensajes de error en español, accionables, sin códigos crípticos.
- [ ] Estado vacío cuidado en cada pantalla (no "no hay datos" pelado).
- [ ] Loaders consistentes (skeletons) en cargas > 200ms.
- [ ] Atajos de teclado documentados y descubribles.
- [ ] PWA instalable y funcional offline en lo crítico (móvil de vendedores).
- [ ] Probado en Chrome, Safari, Firefox; iOS y Android; tablet.

---

## Decisiones que NO se posponen

Estas son las que se vuelven caras de cambiar después. Hay que tenerlas resueltas antes del primer cliente pago:

1. **Multi-tenant por columna + RLS** — ya decidido y aplicado.
2. **Hexagonal en backend** — disciplina de imports desde el día 1.
3. **Money con `numeric` y `Decimal`** — un solo float en producción contamina todo el cálculo posterior.
4. **Soft delete + auditoría** — recuperar data borrada por error es la diferencia entre churn y cliente feliz.
5. **Migraciones versionadas** — sin esto, el día que crezcas no podrás reproducir el schema.
6. **Logs estructurados con `empresa_id`** — sin esto, depurar incidencias multi-tenant es un infierno.

---

## Lo que viene después de validar este bundle

1. Aplicas `01-schema.sql`, `02-rls.sql`, `03-seed.sql` en Supabase.
2. Verificas con la query del final de `03-seed.sql` que los planes/módulos quedaron bien mapeados.
3. Pruebas RLS manualmente: en SQL editor de Supabase, abre dos tabs, en cada una corre `SELECT set_config('app.current_empresa_id', '<uuid>', true);` con UUIDs diferentes (insertando 2 empresas de prueba), insertas un producto en cada empresa, y validas que cada tab solo ve el suyo.
4. Avisas y arrancamos la siguiente sesión: scaffolding del backend FastAPI con auth + módulo inventario.
