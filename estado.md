# estado.md — dentro
Última actualización: 2026-11-23 · Por: Diego (con Claude)

## ▶ PUNTO DE RETORNO (leer primero al abrir una conversación nueva)

### Dónde estamos (2026-11-23)
- **Fase E3 · Módulos esenciales** (aprobada por Diego). Orden del roadmap: M10 → M2+M7 → M3 → M1 → M4 → **M5** → M6 → M8.
- **En `main` y en GitHub (`diegocxst/app-dentro`):** E1, E2, M10, M2-A, M7, M2-B, M3-A, M3-B, M1-A, M1-B, M4-A, M4-B, M5-A, Ajustes-A, Ajustes-B, M5-B (**M5 Pagos completo**) y **M6-A** (comisiones). Último push: ver «Integración».
- **Paquete de Ajustes cerrado** (observaciones 1, 2, 4, 6 y 9). M5-B dejó el comprobante de pago en PDF con envío por WhatsApp; el PDF y el envío se comparten con presupuestos (`useShareFile`, `useClinicPdf`, `src/pages/pdf/pdfBase.tsx`).
- **M6-A · Comisiones** integrada en `main` (rama `feature/e3-m6a-comisiones`). Migración **0017** `20261123000100_commissions` (**aplicada en dev** el 2026-11-23; suites de comisiones y pagos pasan en el proyecto real; tipos reales; asesores: solo los avisos esperados de RPC `security definer` y la protección de contraseñas filtradas): esquemas por doctor (% de lo cobrado o renta de unidad dental; uno vigente, los anteriores se cierran), comisión calculada por trigger al registrar cada pago, anulación o ajuste negativo al anular, pagos a doctores (`pay_commissions`, la renta una vez por periodo) y corte por clínica (`tenants.commission_period`: quincenal o mensual). Pantalla `/doctores` (P28): periodo, indicadores, tabla por doctor, detalle con movimientos paginados, «Marcar como pagada», esquema y exportar CSV; cada doctor ve solo lo suyo y recepción no ve comisiones. Verificado: typecheck, lint, 309 pruebas (3 corridas), `test:db` (17 migraciones), 3 mutaciones, build y revisión visual en escritorio y móvil (en dev solo existe la dueña: fila «Sin comisión»). Diego hizo sus pruebas guiadas con un doctor invitado (sus observaciones 10–18 quedaron repartidas en M6-B, M6-C, Ajustes-C y Fase 2). Incluye «Doctor» en «+ Nuevo» y la aceptación del enlace de invitación por omisión de Supabase.
- **INTEGRADA — M6-B1 · Equipo de doctores** (rama `feature/e3-m6b1-equipo`, en `main` desde el 2026-11-24). Migración **0018** `20261123000200_doctors` (**aplicada en dev** el 2026-11-24; suites de doctores, comisiones, invitaciones, agenda y ARCO pasan en el proyecto real; tipos reales; asesores: solo los avisos esperados de RPC `security definer` —5 nuevos— y la protección de contraseñas filtradas; `invite-member` desplegada): nombre dentro de la clínica (`memberships.display_name`, no toca la cuenta), perfil del doctor (`doctor_settings`: especialidad, color en la agenda y teléfono), **doctores sin acceso** (membresía sin cuenta, solo doctor o colaborador) e invitación ligada a su registro (`invitations.membership_id`; al aceptar conserva pacientes, citas, presupuestos y comisiones; «Reenviar» no rompe el vínculo). Agenda, exportación ARCO y comisiones usan el nombre en la clínica. RPC `create_doctor` y `update_doctor_profile` (solo gerencia). Edge Function `invite-member` acepta `membership_id`. Pantallas: `/doctores` (P26, lista con «Sin acceso»), `/doctores/nuevo` (con o sin correo; «+ Nuevo › Doctor» lleva aquí), `/doctores/:id` (P27: perfil, acceso e invitación, esquema de comisión) y `/doctores/comisiones` (P28, con pestañas). La vista Mes usa el color de cada doctor. Verificado: typecheck, lint, 321 pruebas (3 corridas), `test:db` (18 migraciones), 3 mutaciones, build y revisión visual en escritorio y móvil (sin crear datos). También en la rama: **corrección de la agenda** (al pasar de Semana a Día ya no se cuelan citas de otros días mientras carga; prueba nueva, 322 pruebas). Pruebas guiadas de Diego (pasos 1–10): **todo bien** (2026-11-24). Integrada en `main` y subida.
- **Números:** 18 migraciones (0001–0018 aplicadas en dev), 18 suites `*_rls_isolation.sql`, 321 pruebas de la app, Edge Functions `invite-member` y `document-url` desplegadas.

### Lo próximo, en orden
1. **Ajustes-D · Menú por rol** (EN CURSO en `feature/e3-ajustes-d`, sin migración: `src/lib/access.ts` decide qué ve cada rol; doctores sin Leads, Crece, guía, Identidad, Sucursales ni gestión del equipo, «Doctores» es «Mis comisiones» y solo abren su perfil; recepción sin Crece, guía, Identidad ni Sucursales; rutas ocultas redirigen; «Tu equipo» es directorio con especialidad y teléfono; Inicio del doctor con «Mi día» y «Mi resumen». Tras la prueba de Diego: el menú muestra **tu cuenta** (nombre en la clínica, rol —la dueña o el dueño con su título, p. ej. «Propietario»— y correo) y el directorio ya no ofrece «Invitarlo» a quien no es gerencia. Verificado: typecheck, lint, 340 pruebas (3 corridas), 3 mutaciones y build; revisión visual como propietario. **Falta:** pruebas guiadas de Diego con una cuenta de doctor y «Sí, integra y sube»). Después **M6-B2 · Reportes y horario** (horario del doctor que no deja agendar fuera de él, presupuestos por doctor —obs. 11—, desglose de la clínica —15—, esquema en cada movimiento —18—, **rol «Pasante»** sin comisiones ni montos e **historial del doctor** en su perfil, solo para la dueña o el dueño). **M8** suma el aviso «Confirmar cita» un día antes (tarea para recepción y campana). Lo planeado para M6-B completo era: **M6-B · Doctores:** lista y perfil del doctor (P26–P27: especialidad, color en agenda y horario que limita su agenda), con su esquema de comisión en el perfil, **doctores sin acceso** (sin correo), presupuestos por doctor (obs. 11), nombre editable por la gerencia (obs. 17), desglose de lo que le queda a la clínica (obs. 15) y esquema visible en cada movimiento (obs. 18). Luego **M6-C** comisión por tratamiento (obs. 14) y catálogo propio del doctor con aprobación de la gerencia y **Ajustes-C** (obs. 12, 13 y 16; falta aclarar qué «estado» lleva la tarjeta del paciente). Obs. 10 (firma digital) queda en Fase 2.
   - **Invitaciones (hallazgo 2026-11-23):** el correo de invitación de dev llega con la plantilla por omisión de Supabase (`/auth/v1/verify`), no con `supabase/templates/invite_user.html`; por eso la app dice «La invitación no es válida». Supabase ya no deja editar plantillas sin SMTP propio (B4). **Decisión de Diego:** la app acepta también el enlace de la plantilla por omisión (sesión en el fragmento con `type=invite`; se abre con `setSession` solo al tocar «Aceptar invitación»). Con B4 se vuelve a la plantilla de dentro. Riesgo aceptado: un filtro de correo puede gastar el enlace; se reenvía.
2. **M8 · Tareas:** incluye «Recordarme si no responde» (presupuestos, P20) y «Tareas de hoy» en Mi día.
3. Después: **E4** (procesos de punta a punta F1–F4), **E5** (M9 tablero con datos reales), **E6** integraciones (M11 Meta, link de pago con cuentas de la clínica —B6—, M13 perfil público, correo —B4—).
4. **Al final (decisión de Diego):** guía de pruebas por módulo para Diego y su cuñada.

### Observaciones de Diego (2026-11-20)
- Anotadas y clasificadas en `docs/observaciones.md` (9 al momento). Propuesta: paquete de **Ajustes** (1 recorrido que señala cada parte, 2 logo hasta 20 MB reducido en el navegador, 4 «Unidad dental», 6 vista mensual, 9 menú hamburguesa en móvil) (siguiente). **Decididas el 2026-11-23** (ver `docs/decisiones.md`): 3 límites por plan, 5 Google Calendar (E6), 7 landing con 30 días gratis y 8 anuncios; faltan detalles y etapas (ver la tabla).

### Datos ficticios que existen en dev (no son reales; no borrar sin permiso)
- Clínica de Diego «Dientitos» (color #0E5E8A, sin logo cargado). Sucursal principal, sillones No.1 y No.2, horario 09:00–20:00.
- «Paciente Ficticio Prueba» (`ce3d88e9-aac9-4ae1-8950-3e3b3059cddf`): documento «Radiografia ficticia», solicitud ARCO atendida, cita mar 17 nov 10:00 (confirmada), presupuesto **P-0001** (`cfdb8dde-71ab-49cd-b780-b7c739d0eb1b`, Endodoncia + Resina = $3,950, 6 meses con $1,000 de anticipo, **Aceptado**) y pago **R-0001** ($1,000, transferencia).
- «Lead Ficticio Prueba» → convertido en un 2.º paciente (`9f76352f-4001-44cc-b7e0-57aae75550df`) con su valoración del mar 17 nov 11:00.
- La guía de inicio de Diego está en 1/7: **él mismo desmarcó las tareas** el 17 nov (consta en la auditoría); no es un error.

### Pendientes y decisiones de Diego (no bloquean E3)
- **B4** correo transaccional · **protección de contraseñas filtradas** en Supabase Auth · **P5** revisión legal (avisos, contrato) · revisar con su contador el **precio sin desglose de IVA** (CFDI en Fase 2) · **B6** cuentas de Mercado Pago/Stripe para el link de pago (E6) · ¿permitir a la gerencia agendar **fuera de horario** con motivo? (hoy no se puede) · M2-B: vista de **solicitudes ARCO de toda la clínica** (propuesta) · arrastrar tarjetas en los Kanban y el horario por doctor (M6) quedan para después.

## Integración
- 2026-11-24: E3 · M6-B1 Equipo de doctores (con la corrección de la agenda Semana → Día) integrada en `main` (avance directo) y **push** con aprobación de Diego. Verificado en `main`: lint, typecheck, 322 pruebas (3 corridas), `test:db` (18 migraciones) y build; sin secretos.
- 2026-11-23: E3 · M6-A Comisiones integrada en `main` (avance directo) y **push** con aprobación de Diego. Verificado en `main`: lint, typecheck, 309 pruebas (3 corridas), `test:db` (17 migraciones) y build; sin secretos.
- 2026-11-23: E3 · M5-B Comprobante de pago integrada en `main` (avance directo) y **push** con aprobación de Diego. **M5 Pagos completo** (el link de pago queda para E6). Verificado en `main`: lint, typecheck, 297 pruebas (3 corridas), `test:db` (16 migraciones) y build; sin secretos.
- 2026-11-23: E3 · Ajustes-B (vista Mes y recorrido que resalta cada parte) integrada en `main` (avance directo) y **push** con aprobación de Diego. **Paquete de Ajustes completo.** Verificado en `main`: lint, typecheck, 292 pruebas (3 corridas), `test:db` (16 migraciones) y build; sin secretos.
- 2026-11-23: E3 · Ajustes-A (logo 20 MB, «Unidad dental», menú ☰ en móvil) integrada en `main` (avance directo) y **push** con aprobación de Diego. Verificado en `main`: lint, typecheck, 285 pruebas (3 corridas), `test:db` (16 migraciones) y build; sin secretos.
- 2026-11-23: E3 · M5-A Pagos integrada en `main` (avance directo) y **push** con aprobación de Diego. Verificado en `main`: lint, typecheck, 281 pruebas (3 corridas), `test:db` (16 migraciones) y build; sin secretos.
- 2026-11-19: E3 · M4-B Presupuestos (PDF y WhatsApp) integrada en `main` (avance directo) y **push** con aprobación de Diego. **M4 Presupuestos completo.** Verificado en `main`: lint, typecheck, 274 pruebas (3 corridas), `test:db` (15 migraciones) y build; sin secretos.
- 2026-11-18: E3 · M4-A Presupuestos integrada en `main` (avance directo) y **push** con aprobación de Diego. Verificado en `main`: lint, typecheck, 269 pruebas (3 corridas), `test:db` (15 migraciones) y build; sin secretos.
- 2026-11-18: E3 · M1-B Leads (valoración y conversión) integrada en `main` (avance directo) y **push** con aprobación de Diego. **M1 Leads completo.** Verificado en `main`: lint, typecheck, 261 pruebas (3 corridas), `test:db` (14 migraciones) y build; sin secretos.
- 2026-11-16: E3 · M1-A Leads integrada en `main` (avance directo) y **push** con aprobación de Diego. Verificado en `main`: lint, typecheck, 254 pruebas (3 corridas), `test:db` (13 migraciones) y build; sin secretos.
- 2026-11-16: E3 · M3-B Agenda (Semana, Por sillón, Mi día) integrada en `main` (avance directo) y **push** con aprobación de Diego. **M3 Agenda completo.** Verificado en `main`: lint, typecheck, 245 pruebas (3 corridas), `test:db` (12 migraciones) y build; sin secretos.
- 2026-11-16: E3 · M3-A Agenda integrada en `main` (avance directo) y **push** con aprobación de Diego. Verificado en `main`: lint, typecheck, 237 pruebas (3 corridas), `test:db` (12 migraciones) y build; sin secretos.
- 2026-11-16: E3 · M2-B Privacidad y ARCO integrada en `main` (avance directo) y **push** con aprobación de Diego. Verificado en `main`: lint, typecheck, 224 pruebas (3 corridas), `test:db` (11 migraciones) y build; sin secretos. Se estabilizaron 2 pruebas del logo que fallaban de forma intermitente (encontraban las iniciales antes que la imagen firmada); 15 corridas sin fallas.
- 2026-11-16: E3 · M7 Documentos integrada en `main` (avance directo) y **push** con aprobación de Diego. Verificado en `main`: lint, typecheck, 217 pruebas, `test:db` (10 migraciones) y build; sin secretos.
- 2026-11-15: E1-A, E1-B1, E1-B2, E1-B3 y E1-B4 integradas en `main` **local** (avance directo, sin conflictos). Verificado en `main`: lint, typecheck, 109 pruebas, `test:db` y build. Las ramas `feature/*` se conservan (solo locales).
- 2026-11-15: **push de `main`** a `diegocxst/app-dentro` con aprobación de Diego (`cb84157..798284e`, sin forzar; revisado sin secretos).
- 2026-11-15: E1-B5a, E1-B5b y E1-B5c integradas en `main` (avance directo) y **push** con aprobación de Diego. Verificado en `main`: lint, typecheck, 147 pruebas, `test:db` (5 migraciones) y build; sin secretos.
- 2026-11-16: E3 · M2-A integrada en `main` (avance directo) y **push** con aprobación de Diego. Verificado en `main`: lint, typecheck, 203 pruebas, `test:db` (9 migraciones) y build; sin secretos.
- 2026-11-16: E3 · M10 integrada en `main` (avance directo) y **push** con aprobación de Diego. Verificado en `main`: lint, typecheck, 187 pruebas, `test:db` (8 migraciones) y build; sin secretos.
- 2026-11-16: E2-A, E2-B y E2-C integradas en `main` (avance directo) y **push** con aprobación de Diego. Verificado en `main`: lint, typecheck, 177 pruebas, `test:db` (7 migraciones) y build; sin secretos.

## Fase actual
> Historial de cada incremento. Todo lo de E1, E2 y E3 hasta **M4-B** ya está en `main`; solo **M5-A** sigue en su rama (ver «Punto de retorno»). Las ramas `feature/*` se conservan solo en local.

| Fase | Estado |
|---|---|
| V0 Validación | Sin entrevistas aplicadas; scorecard preliminar 3.55 (AJUSTAR). Los cuestionarios son referencia, no requisito (decisión de Diego). |
| V1 Modelo de negocio | Pendiente (pricing y cortes de plan). Supuesto: $399–$800 MXN/mes. |
| V2 Estructura | ✅ **Cerrada el 2026-11-05.** Alcance del MVP congelado. |
| V3 Diseño y demo | ✅ **Cerrada el 2026-11-10.** Demo navegable en el lienzo "dentro — Pantallas clave V3". Se omite la validación previa con prospectos: se valida durante el desarrollo (riesgo aceptado). |
| **E0 Auditoría y planificación** | ✅ **Cerrada el 2026-11-15** (auditoría E0-A aprobada con D1–D8). |
| **E1 Fundamentos y seguridad** | ✅ **Cerrada el 2026-11-15** por Diego, con B4 (correo transaccional) pendiente. |
| **E2 Interfaz y estructura** | ✅ **Cerrada el 2026-11-16** por Diego (E2-A, E2-B y E2-C en `main` y en GitHub). |
| **E3 · M5-A Pagos (registro, cobros y saldos)** | **EN_PRUEBAS** desde el 2026-11-19. Rama local `feature/e3-m5-pagos` (sin push). Migración 0016 **aplicada en dev** con aprobación de Diego. |
| **E3 · M4-B Presupuestos (PDF y WhatsApp)** | **EN_PRUEBAS** desde el 2026-11-18. Rama local `feature/e3-m4b-pdf-whatsapp` (sin push). **Sin migraciones.** |
| **E3 · M4-A Presupuestos (crear, Kanban y ficha)** | **EN_PRUEBAS** desde el 2026-11-18. Rama local `feature/e3-m4-presupuestos` (sin push). Migración 0015 **aplicada en dev** con aprobación de Diego. |
| **E3 · M1-B Leads (valoración y conversión)** | **EN_PRUEBAS** desde el 2026-11-16. Rama local `feature/e3-m1b-conversion` (sin push). Migración 0014 **aplicada en dev** con aprobación de Diego. |
| **E3 · M1-A Leads (Kanban y seguimiento)** | **EN_PRUEBAS** desde el 2026-11-16. Rama local `feature/e3-m1-leads` (sin push). Migración 0013 **aplicada en dev** con aprobación de Diego. |
| **E3 · M3-B Agenda (Semana, Por sillón y Mi día)** | **EN_PRUEBAS** desde el 2026-11-16. Rama local `feature/e3-m3b-agenda-vistas` (sin push). **Sin migraciones** (usa la tabla de 0012). |
| **E3 · M3-A Agenda (citas y vista del día)** | **EN_PRUEBAS** desde el 2026-11-16. Rama local `feature/e3-m3-agenda` (sin push). Migración 0012 **aplicada en dev** con aprobación de Diego. |
| **E3 · M2-B Privacidad y ARCO** | **EN_PRUEBAS** desde el 2026-11-16. Rama local `feature/e3-m2b-arco` (sin push). Migración 0011 **aplicada en dev** con aprobación de Diego. |
| **E3 · M7 Documentos** | **EN_PRUEBAS** desde el 2026-11-16. Rama local `feature/e3-m7-documentos` (sin push). Migración 0010 **aplicada en dev** y Edge Function `document-url` **desplegada**, con aprobación de Diego. |
| **E3 · M2-A Pacientes** | **EN_PRUEBAS** desde el 2026-11-16. Rama local `feature/e3-m2a-pacientes` (sin push). Migración 0009 **aplicada en dev** con aprobación de Diego. |
| **E3 · M10 Configuración** | **EN_PRUEBAS** desde el 2026-11-16. Rama local `feature/e3-m10-configuracion` (sin push). Migración 0008 **aplicada en dev** con aprobación de Diego. |
| **E2-C Estados vacío, carga y error** | **EN_PRUEBAS** desde el 2026-11-16. Rama local `feature/e2c-estados` (sin push). Sin migraciones. |
| **E2-B Onboarding pasos 2 a 5** | **EN_PRUEBAS** desde el 2026-11-16. Rama local `feature/e2b-onboarding` (sin push). Migración 0007 **aplicada en dev** con aprobación de Diego. |
| **E2-A Inicio de primer uso** | **EN_PRUEBAS** desde el 2026-11-16. Rama local `feature/e2a-bienvenida` (sin push). Migración 0006 **aplicada en dev** con aprobación de Diego. |
| **E1-B5c Invitaciones de equipo** | **EN_PRUEBAS** desde el 2026-11-15. Rama local `feature/e1b5c-invitations` (sin push). Migración 0005 aplicada, secreto `SITE_URL` y Edge Function `invite-member` desplegada en dev, con aprobación de Diego. Plantilla «Invite user» pegada por Diego. |
| **E1-B5b Logo en Storage privado** | **EN_PRUEBAS** desde el 2026-11-15. Rama local `feature/e1b5b-logo` (sin push). Migración 0004 **aplicada en dev** con aprobación de Diego. |
| **E1-B5a Aviso y consentimientos** | **EN_PRUEBAS** desde el 2026-11-15. Rama local `feature/e1b5a-consents` (sin push). Migración 0003 **aplicada en dev** con aprobación de Diego. |
| **E1-B4 Conexión al proyecto dev** | **EN_PRUEBAS** desde el 2026-11-15. Migraciones 0001 y 0002 **aplicadas en `dentro-dentistas-app`** con aprobación de Diego. Rama local `feature/e1b4-dev-connect` (sin push). |
| **E1-B3 Clínica activa y alta** | **EN_PRUEBAS** desde el 2026-11-15. Rama local `feature/e1b3-workspace` (sin push). Supabase simulado en pruebas. Diferencias con el mockup aprobadas el 2026-11-15. |
| **E1-B2 Auth en el frontend** | **EN_PRUEBAS** desde el 2026-11-15. Rama local `feature/e1b2-auth` (sin push). Supabase simulado en pruebas; sin conexión al proyecto. |
| **E1-B1 Migración del núcleo** | **EN_PRUEBAS** desde el 2026-11-15. Rama local `feature/e1b1-core-tenancy` (sin push). Probada solo en PostgreSQL local; nada aplicado en Supabase. Decisiones aprobadas el 2026-11-15. |
| **E1-A Estructura y layout** | **EN_PRUEBAS** desde el 2026-11-11; decisiones aprobadas el 2026-11-12, falta revisión en local y merge. Rama local `feature/e1a-estructura` (sin push). Sin Supabase, auth ni base de datos. |

## E2 — Interfaz y estructura
E2 se divide en **E2-A** inicio de primer uso (guía, recorrido, indicadores vacíos), **E2-B** pasos 2 a 5 del onboarding (dependen de tablas nuevas: se propone antes) y **E2-C** estados vacío, carga y error en toda la app.

## E3 — Módulos esenciales
Uno por uno, según el roadmap: 1) M10 Configuración · 2) M2 Pacientes + M7 Documentos · 3) M3 Agenda · 4) M1 Leads · 5) M4 Presupuestos + PDF · 6) M5 Pagos · 7) M6 Doctores y comisiones · 8) M8 Tareas.

## E3 · M5-A — Pagos: registro, cobros y saldos (EN_PRUEBAS)
- **Migración 0016** `20261119000100_payments`: `payments` (folio por clínica R-0001…, paciente, presupuesto opcional, doctor al que se atribuye —el del presupuesto o el tratante, base de comisiones de M6—, monto, forma de pago, fecha, referencia, nota, anulación con motivo). RPC `register_payment`, `void_payment`, `patient_account`, `payment_stats`, `receivables`; `quote_stats` ahora incluye lo cobrado.
- **Reglas en la base:** registran **gerencia y recepción**; el doctor **ve los pagos de sus pacientes** pero no registra ni ve totales o saldos de la clínica; superadmin y otras clínicas, nada. **No se borran: la gerencia los anula con motivo** (dejan de contar). Un pago **no supera el saldo** del presupuesto; un borrador o perdido no se cobra; sin fechas futuras ni de hace más de un año. **El primer pago de un presupuesto presentado o en duda lo pasa a «Aceptado».** Abonos sueltos sin presupuesto permitidos. Auditoría sin montos ni datos del paciente.
- **P21 Cobros (`/cobros`):** cobrado hoy, cobrado este mes (con número de pagos) y **por cobrar**; pestañas **Pagos** (paginados en el servidor, 25) y **Saldos** (pacientes con saldo y «Registrar pago»). Doctores: mensaje explicativo.
- **P22 Registrar pago (`/cobros/nuevo`):** paciente, presupuesto con saldo (o abono suelto), **monto sugerido** (el anticipo si no hay pagos, luego la mensualidad, nunca más que el saldo), forma de pago (efectivo, transferencia, débito, crédito, otro), fecha, referencia y nota; avisa si aceptará el presupuesto. Vuelve a donde se abrió con «Listo. Registramos el pago R-0001 por $5,000.»
- **Ficha 360:** la tarjeta **Cuenta** muestra el saldo y lo pagado; pestaña **Pagos** con pagado, saldo por presupuesto, lista de pagos (anular para la gerencia) y «Registrar pago». Con esto **todas las pestañas de la ficha tienen contenido** (se quitaron los avisos «llega con…»).
- **Presupuesto:** tarjeta **Pagos** (pagado, saldo, «Registrar pago», lista). **Kanban:** indicador «Cobrado en presupuestos» del mes. **Agenda:** «Registrar cobro» en el detalle de la cita (gerencia y recepción).
- Suite `payments_rls_isolation.sql` (6 actores) y `test:db` con 16 migraciones en verde. **Pruebas de mutación:** recepción anulando, anticipo que no acepta el presupuesto y pago mayor al saldo → las 3 las detecta la suite.
- 281 pruebas de la app (antes 274), estables en 3 corridas.
- **En dev (2026-11-19, aprobado por Diego):** migración 0016 aplicada (dry-run antes); las 16 suites en verde en el proyecto real; tipos regenerados (0001–0016); asesores sin avisos nuevos (solo las 5 RPC nuevas en el aviso esperado de SECURITY DEFINER).
- **Revisión con la cuenta de Diego:** desde el presupuesto ficticio P-0001 se registró el **pago ficticio R-0001** (anticipo sugerido de $1,000, transferencia, nota «Pago ficticio de prueba»): el presupuesto pasó solo a **«Aceptado»**, muestra «Pagado $1,000 · Saldo $2,950» y el aviso al volver; **Cobros** muestra cobrado hoy y del mes $1,000, por cobrar $2,950 y el pago en la lista.

### Puntos para aprobación
1. Aplicar la migración 0016 en dev: **aprobado y hecho** el 2026-11-19.
2. **M5-B:** comprobante de pago en PDF con la marca de la clínica y envío por WhatsApp (como el presupuesto). El **link de pago** sigue en E6 (cuentas de la clínica, B6).

## E3 · M4-B — Presupuestos: PDF con la marca y envío por WhatsApp (EN_PRUEBAS)
- **PDF con la identidad de la clínica** (`@react-pdf/renderer`, se carga solo al usarlo): franja con el **color de marca** (ya garantiza contraste con blanco) y el **logo** (PNG, JPG o **WebP convertido a PNG** en el navegador; si no hay o falla, las iniciales), nombre, dirección de la sucursal y WhatsApp; folio y fecha; paciente, doctor y tratamiento; partidas con nota (descuentos en verde), total, plan de pagos, vigencia («Precios en MXN.»), notas y pie con «página X de Y · hecho con dentro». Nombre de archivo limpio: «Presupuesto P-0142 Laura Mendez.pdf».
- **P20 Enviar (`/presupuestos/:id/enviar`):** paciente, teléfono y total; **mensaje editable** como la maqueta («Hola, Laura. Te comparto tu presupuesto de ortodoncia invisible con… Puedes apartar tu lugar con un anticipo de… y pagar el resto en N mensualidades de…»); casilla «Adjuntar PDF». **En el celular** abre el menú de compartir con el PDF adjunto (WhatsApp); **en la computadora** descarga el PDF y abre WhatsApp con el mensaje (se indica adjuntar el archivo). Sin teléfono, se elige el chat en WhatsApp. **Sin enlaces públicos.** El PDF se prepara al abrir la pantalla para que «Compartir» ocurra dentro del clic (lo exigen los navegadores).
- **Al enviar:** un borrador pasa a «Presentado»; uno presentado o en duda registra un **seguimiento**. Si se cancela el menú de compartir, no cambia nada.
- **Detalle del presupuesto:** «Descargar PDF» y «Enviar por WhatsApp».
- **Corregido al revisar:** (1) el signo «−» de los descuentos no existe en la fuente base del PDF y desaparecía (y desalineaba la fila) → en el PDF va «-»; (2) en la computadora el aviso «Adjúntalo en el chat de WhatsApp» se perdía detrás del de la etapa → ahora van juntos; (3) el mensaje decía «presupuesto de presupuesto…» si el título ya empezaba así.
- 274 pruebas de la app (antes 269), estables en 3 corridas (celular con compartir, cancelar, computadora con descarga + WhatsApp, descarga desde el detalle, mensaje y nombre de archivo). `test:db` sin cambios (15 migraciones) y build en verde.
- **Revisión en dev** (sin enviar nada): la pantalla de envío de P-0001 arma el PDF con los datos reales (la clínica no tiene logo cargado: usa iniciales con el color #0E5E8A) y la conversión WebP → PNG se comprobó en el navegador.

### Puntos para aprobación
1. El **link de pago del anticipo** en el mensaje y el PDF llega con **M5 / E6** (cuentas de la clínica); «Recordarme si no responde» con **M8 Tareas**.
2. El PDF usa Helvetica (sin descargar fuentes); se puede cambiar por la tipografía del sistema «dentro» más adelante.

## E3 · M4-A — Presupuestos: crear, Kanban y ficha (EN_PRUEBAS)
- **Migración 0015** `20261118000100_quotes`: `quotes` (folio consecutivo por clínica P-0001…, paciente, doctor, tratamiento principal, etapa, total, anticipo, mensualidades, vigencia —30 días por omisión—, notas, motivo de pérdida, fecha de presentación y último seguimiento) y `quote_items` (del catálogo o libres; precio negativo = descuento).
- **Reglas en la base:** los hacen y ven gerencia y recepción (cualquier paciente) y el **doctor solo de sus pacientes** (queda como doctor del presupuesto); superadmin y otras clínicas, nada. Al guardar se **recalcula el total** en la base (nunca negativo) y el anticipo no lo supera; de contado no hay anticipo. Etapas: borrador → presentado ⇄ en duda → aceptado → en tratamiento → terminado; abiertos → perdido (con motivo); perdido → reabrir. **Solo se edita** en borrador, presentado o en duda. Indicadores por RPC (`quote_stats`). Sin borrado; auditoría sin montos ni datos del paciente.
- **P18 Kanban (`/presupuestos`):** indicadores del mes (tasa de aceptación, en duda por recuperar, ticket promedio), filtro por doctor (no para doctores), siete columnas con cantidad y monto; tarjetas con paciente, monto, tratamiento · doctor y **seguimiento** («Enviado hace 1 día», «Sin respuesta 9 días» en ámbar/rojo).
- **P19 Crear / detalle (`/presupuestos/nuevo`, `/presupuestos/:id`):** paciente (búsqueda o desde la ficha), doctor, tratamiento principal; partidas **del catálogo**, concepto libre o **descuento**, con cantidad, precio e importe; **plan de pagos** (Contado, 6, 12, 18, 24 meses + anticipo, con la mensualidad redondeada hacia arriba); vigencia y notas; vista **«Así lo verá el paciente»**. En el detalle: etapa con sus botones (Marcar presentado, Aceptó, En duda, Empezó el tratamiento, Terminado, Reabrir), «Registrar seguimiento» y «Marcar perdido» con motivo. Crear el primero marca la tarea de la guía.
- **Ficha 360 › Presupuestos:** lista con folio, total y etapa, y «Nuevo presupuesto». «+ Nuevo › Presupuesto» abre el editor. La búsqueda de paciente se extrajo a `components/patients/PatientPicker` (Agenda y Presupuestos).
- **Precio final en MXN, sin desglose de IVA** («Precios en MXN.»). Revisarlo con su contador; CFDI en Fase 2.
- Suite `quotes_rls_isolation.sql` (6 actores) y `test:db` con 15 migraciones en verde. **Pruebas de mutación:** doctor viendo todos los presupuestos, doctor asignando a otro doctor y editar uno aceptado → las 3 las detecta la suite.
- 269 pruebas de la app (antes 261), estables en 3 corridas.
- **En dev (2026-11-18, aprobado por Diego):** migración 0015 aplicada (dry-run antes); las 15 suites en verde en el proyecto real; tipos regenerados (0001–0015; `p_quote`/`p_doctor` aceptan NULL aunque el generador los tipa como texto); asesores sin avisos nuevos (solo las 4 RPC nuevas en el aviso esperado de SECURITY DEFINER).
- **Revisión con la cuenta de Diego:** presupuesto **ficticio P-0001** para «Paciente Ficticio Prueba» con su catálogo real (Endodoncia $3,500 + Resina $450 = $3,950; 6 meses con $1,000 de anticipo → 6 mensualidades de $492, redondeo hacia arriba); se marcó presentado y el Kanban lo muestra en «Presentado» con «Enviado hoy»; editor en celular 390 px oscuro.
- **Corregido en la revisión:** (1) a ~1000 px el editor y la vista previa lado a lado apretaban las partidas («Quitar» se salía) → lado a lado solo desde 1280 px; (2) el contador de la guía no se actualizaba al crear el primer presupuesto → ahora refresca (como en Nuevo paciente).
- **Nota:** la guía de inicio de la clínica de Diego aparecía en 0/7: el registro de auditoría muestra que **su propia cuenta desmarcó las tareas** el 17 nov a las 20:56–20:57 (no es un error). Con este presupuesto quedó marcada «Crea tu primer presupuesto».
- **Entorno:** se quitó `dentro-dev-sin-backend` de `.claude/launch.json`: el panel lo volvía a abrir solo y en ese modo no se puede iniciar sesión.

### Puntos para aprobación
1. Aplicar la migración 0015 en dev: **aprobado y hecho** el 2026-11-18.
2. Las tarjetas se mueven desde el detalle; **arrastrar** entre columnas queda para Fase 2+ (como en Leads).
3. El indicador «Anticipos cobrados» de la maqueta llega con **M5 Pagos**; el link de pago del anticipo, con M5/E6; «Recordarme si no responde», con **M8 Tareas**.
4. **M4-B:** PDF con la marca de la clínica (logo y color) y envío por WhatsApp compartiendo el archivo (sin enlaces públicos).

## E3 · M1-B — Leads: valoración y conversión a paciente (EN_PRUEBAS)
- **Migración 0014** `20261116000900_lead_conversion`: una cita es **de un paciente o de un lead** (exactamente uno; las de lead son de valoración); `create_lead_appointment` (gerencia y recepción; mismas reglas de horario, sillón, doctor y traslapes; pasa el lead a «Valoración agendada»); `convert_lead` (crea el paciente **con su consentimiento** —mismas reglas que el alta— o lo **vincula con uno existente**; sus citas pasan a la ficha; el lead queda «Convertido» con el enlace); `lead_patient_matches` (mismo teléfono o correo); `list_appointments` muestra las citas de lead (nombre y teléfono del lead) y filtra por lead.
- **Permisos:** el doctor de la valoración la ve en su agenda (nombre y teléfono), pero no ve el Kanban ni puede agendar o convertir leads; otras clínicas y el superadmin, nada.
- **Interfaz:** en el detalle del lead, «Agendar valoración» (abre Nueva cita con el lead fijo y tipo Valoración) y «Convertir en paciente», más la lista de sus valoraciones y el historial («Agendó su valoración», «Lo convirtió en paciente»). En la agenda, la cita de lead lleva «Paciente nuevo» y, para gerencia y recepción, «Convertir en paciente» y «Abrir lead»; el doctor ve «Aún no es paciente». **P13 Convertir:** datos del lead, fecha de nacimiento y doctor tratante opcionales, consentimiento (papel o digital) obligatorio, y aviso si ya existe un paciente con su teléfono o correo con «Vincular con…».
- Suite `lead_conversion_rls_isolation.sql` (6 actores) y `test:db` con 14 migraciones en verde. **Pruebas de mutación:** convertir sin consentimiento, doctor agendando valoraciones de leads y citas que no pasan a la ficha → las 3 las detecta la suite.
- 261 pruebas de la app (antes 254), estables en 5 corridas (se estabilizó una prueba de la vista Semana que revisaba la consulta antes de que cargara la sucursal).
- **En dev (2026-11-16, aprobado por Diego):** migración 0014 aplicada (dry-run antes); las 14 suites en verde en el proyecto real; tipos regenerados (0001–0014); asesores sin avisos nuevos (solo las 3 RPC nuevas en el aviso esperado de SECURITY DEFINER).
- **Revisión con la cuenta de Diego:** desde el lead ficticio se agendó su **valoración** (mar 17 nov 11:00, sillón No.2, «Valoración inicial»): la agenda la muestra con «Paciente nuevo», «Confirmar por WhatsApp» a su teléfono y «Convertir en paciente». Se **convirtió** con consentimiento en papel (sin aviso de duplicado: nadie tenía su teléfono): la ficha nueva trae origen «Facebook o Instagram», el consentimiento con la versión del aviso y la valoración como «Próxima cita»; el lead quedó «Convertido en paciente» con el historial completo. Queda un **2.º paciente ficticio** («Lead Ficticio Prueba»).

### Puntos para aprobación
1. Aplicar la migración 0014 en dev: **aprobado y hecho** el 2026-11-16.
2. El botón manual «Valoración agendada» se reemplazó por «Agendar valoración» (ahora el estado lo pone la cita).

## E3 · M1-A — Leads: Kanban y seguimiento (EN_PRUEBAS)
- **Migración 0013** `20261116000800_leads`: `leads` (nombre, teléfono y/o correo, interés, origen, estado, motivo de pérdida, responsable —gerencia o recepción—, versión del aviso de privacidad, primera respuesta, `converted_patient_id` para M1-B) y `lead_activity` (alta, cambios de estado, notas, asignación, edición).
- **Reglas en la base:** solo **gerencia y recepción** ven y trabajan leads (doctores, otras clínicas y superadmin no); **alta manual solo confirmando el aviso de privacidad** (se guarda la versión vigente); teléfono o correo obligatorio; «perdido» exige motivo; «convertido» solo por la conversión (M1-B); el **tiempo de respuesta** es la primera salida de «nuevo» o la primera nota; indicadores del mes por RPC (`lead_stats`). Sin borrado; auditoría sin datos personales; con la clínica suspendida se leen pero no se mueven.
- **Corrección de 0011 (ARCO):** el CHECK «resuelta exige respuesta» dejaba pasar NULL (con NULL, `char_length(...) > 0` no falla). Se reemplazó por uno con `coalesce`; el mismo error se evitó en leads. Lo detectó una prueba nueva que escribe directo en la tabla.
- **P11 Kanban (`/leads`):** indicadores (leads este mes, % que llegó a valoración, tiempo de respuesta mediano, sin contestar hace más de 24 h en rojo), filtro por origen y cinco columnas como la maqueta (paginadas en el servidor, 50 por columna); tarjetas con nombre, antigüedad (roja si lleva más de 24 h sin respuesta), interés o motivo y origen. En celular las columnas se deslizan.
- **Nuevo lead (`/leads/nuevo`):** nombre, teléfono o correo, interés, origen, responsable y **casilla obligatoria del aviso** con su versión. «+ Nuevo › Lead» abre aquí.
- **P12 Detalle:** «Escribir por WhatsApp» (mensaje listo), estado y origen, aviso si nadie le ha contestado, **Seguimiento** (Marcar contactado → Valoración agendada; Marcar perdido con motivo; Reabrir), notas, historial con quién y cuándo, responsable y edición (manda solo lo que cambió).
- Suite `leads_rls_isolation.sql` (6 actores) y `test:db` con 13 migraciones en verde. **Pruebas de mutación:** alta sin aviso, doctores viendo leads y «perdido» sin motivo en la tabla → las 3 las detecta la suite.
- 254 pruebas de la app (antes 245), estables en 3 corridas.
- **En dev (2026-11-16, aprobado por Diego):** migración 0013 aplicada (dry-run antes); las 13 suites en verde en el proyecto real (incluida la corrección del CHECK de ARCO); tipos regenerados (0001–0013); asesores sin avisos nuevos (solo las 5 RPC nuevas en el aviso esperado de SECURITY DEFINER).
- **Revisión con la cuenta de Diego:** se registró un **lead ficticio** («Lead Ficticio Prueba», origen Meta) — sin la casilla del aviso no se guarda y lo explica —; se marcó contactado y se escribió una nota (ambos en el historial); el Kanban lo muestra en «Contactado» con los indicadores calculados en la base; celular 390 px en oscuro con columnas deslizables.
- **Corregido en la revisión:** en celular la descripción quedaba debajo del filtro y del botón → `PageHeader` admite descripción y el filtro «Origen» pasó arriba del tablero.

### Puntos para aprobación
1. Aplicar la migración 0013 en dev: **aprobado y hecho** el 2026-11-16.
2. En el Kanban las tarjetas se mueven desde el detalle (botones de Seguimiento); **arrastrar entre columnas** queda para Fase 2+.
3. **M1-B:** agendar la valoración del lead (cita con el lead, sin crearlo como paciente; pasa solo a «Valoración agendada») y **convertir en paciente** con consentimiento (la cita pasa a su ficha).

## E3 · M3-B — Agenda: Semana, Por sillón y Mi día (EN_PRUEBAS)
- **Selector Día / Semana / Por sillón** (como la maqueta; «Día» es la vista por doctor). La vista y la fecha viven en la URL.
- **Semana:** lunes a domingo de la sucursal, una columna por día, citas de varios doctores a la misma hora **lado a lado** (carriles), días cerrados sombreados, hoy resaltado, ◀ ▶ mueven 7 días, clic en un día abre su vista Día y un hueco agenda ese día a esa hora. En celular: lista agrupada por día.
- **Por sillón:** una columna por sillón activo de la sucursal (y los que tengan citas); el hueco abre «Nueva cita» con el sillón y la hora puestos. Sin sillones: aviso con enlace para agregarlos.
- **Mi día (Inicio):** citas de hoy de la sucursal activa (un doctor ve solo las suyas), cuántas faltan por confirmar y las siguientes (hora, sillón, paciente, tratamiento · doctor, estado; «Valoración» en violeta), con enlace a cada cita. Sin citas: «No tienes más citas hoy». Se quitó el indicador vacío «Citas de hoy» de primer uso porque ya lo muestra Mi día. **Sin «Tareas»** hasta M8.
- Sin migraciones ni cambios de permisos: todo usa `list_appointments` (máx. 7 días por consulta en estas vistas).
- 245 pruebas de la app (antes 237), estables en 3 corridas: semana (rango de 7 días en la zona de la sucursal, cada cita en su día, encabezado → Día, avanzar 7 días, hueco → nueva cita), por sillón (columnas, hueco con sillón), selector, carriles y Mi día (con la fecha fijada).
- **Revisión visual en dev** (con la cita ficticia del 17 nov): Semana a ~1000 px (los 7 días caben; se angostaron las columnas) y en celular oscuro; Por sillón; Mi día en Inicio en celular oscuro.

### Puntos para aprobación
1. «Mi día» va en **Inicio** para todos (en celular es la pantalla principal, como la maqueta). La cuadrícula «Tareas de hoy» se agrega con M8.
2. Las vistas Semana y Por sillón son de **consulta y agenda rápida**; mover citas arrastrando queda para Fase 2+ (hoy se usa «Reagendar»).

## E3 · M3-A — Agenda: citas y vista del día (EN_PRUEBAS)
- **Migración 0012** `20261116000700_appointments`: `branches.timezone` (zonas de México, por defecto Ciudad de México) y `appointments` (sucursal, sillón —FK compuesta que obliga a que sea de esa sucursal—, doctor, paciente, tratamiento opcional, tipo valoración/tratamiento/revisión, estado, inicio y fin por minuto, notas, motivo de cancelación).
- **Reglas en la base:** **nunca se traslapan** el mismo sillón ni el mismo doctor (EXCLUDE con `btree_gist`; las canceladas liberan el lugar); **no se agenda fuera del horario** de la sucursal ni en día cerrado, leído en su zona (error `DH001`); ni en el pasado. Gerencia y recepción agendan a cualquier doctor; **un doctor solo en su agenda y con sus pacientes**; se respetan las sucursales de cada membresía; el superadmin no ve citas. Estados: programada → confirmada → llegó / no asistió; cancelada es final; **reagendar = mover** y vuelve a «programada». Sin borrado; auditoría sin datos del paciente.
- **P08 Agenda (`/agenda`):** día por doctor como la maqueta (columnas por doctor, horas del horario, bloques por estado, leyenda), Hoy / anterior / siguiente / fecha, clic en un hueco para agendar ahí; en celular, lista por hora. Día cerrado explicado.
- **P10 Detalle:** estado, cuándo, doctor, lugar, motivo y notas; «Marcar confirmada», **«Confirmar por WhatsApp»** (mensaje listo para el paciente), «Llegó» / «No asistió» (desde 2 h antes), corregir, «Reagendar», «Cancelar cita» con motivo y «Abrir ficha del paciente».
- **P09 Nueva cita / Reagendar:** paciente (búsqueda), doctor, sillón, tratamiento (pone la duración), tipo, fecha, duración y **solo horas dentro del horario**; si no hay horario o el servidor lo rechaza: «Escribe a la clínica o al doctor para revisar este caso» con enlace al WhatsApp de la clínica.
- **Ficha 360:** «Próxima cita» en Resumen y pestaña **Citas** (próximas y anteriores, «Agendar cita»). «+ Nuevo › Cita» abre la nueva cita. **Configuración › Sucursales:** zona horaria.
- Suite `appointments_rls_isolation.sql` (6 actores) y `test:db` con 12 migraciones en verde. **Pruebas de mutación:** sin revisar horario, sin regla de traslape del doctor y doctor viendo todas las citas → las 3 las detecta la suite.
- 237 pruebas de la app (antes 224), estables en 3 corridas. Las pruebas encontraron un error real: al abrir «Nueva cita» directo, la sucursal aún no cargaba y no salían sillones (corregido). `database.types.ts` con entradas **provisionales** de 0012.
- **En dev (2026-11-16, aprobado por Diego):** migración 0012 aplicada (dry-run antes; `btree_gist` instalada); las 12 suites en verde en el proyecto real; tipos regenerados (0001–0012); asesores sin avisos nuevos (solo las 5 RPC nuevas en el aviso esperado de SECURITY DEFINER).
- **Revisión con la cuenta de Diego:** se agendó una **cita ficticia** (Paciente Ficticio Prueba, mar 17 nov 10:00, sillón No.1, «Valoración inicial» —la duración se puso sola en 30 min—) desde un hueco de la agenda; la base **rechazó un traslape** real (mismo doctor 10:15) con el mensaje correcto; se marcó confirmada; la ficha muestra «Próxima cita» y la pestaña Citas; móvil 390 px en oscuro con la lista por hora.
- **Corregido en la revisión:** (1) **la pestaña Citas de la ficha fallaba**: pedía 2 años y el servidor admite 400 días → ahora 6 meses atrás y 6 adelante, y el Supabase simulado aplica el mismo límite (una prueba lo detecta); (2) «De» en mayúscula en las fechas; (3) por debajo de 1280 px el detalle de la cita quedaba fuera de la vista → ahora se desplaza solo.

### Puntos para aprobación
1. Aplicar la migración 0012 en dev: **aprobado y hecho** el 2026-11-16.
2. «Fuera de horario» aplica a todos (también a la dueña); por ahora sin excepción para la gerencia (Diego siguió sin pedirla). Sillones: se quedan con ese nombre y obligatorios.
3. El horario es el de la **sucursal**; el horario de cada doctor llega con M6 (Doctores).
4. Las citas de **leads** (valoración sin paciente) llegan con M1; en M3-A cada cita es de un paciente registrado.
5. **M3-B:** vistas Semana y Por sillón, y «Mi día» en celular.

## E3 · M2-B — Privacidad y derechos ARCO (EN_PRUEBAS) · DATOS DE SALUD
- **Migración 0011** `20261116000600_arco`: `arco_requests` (derecho, canal, fecha de recepción, **vence a los 20 días hábiles**, detalles, estado, respuesta, quién y cuándo resolvió); la bitácora de pacientes admite `export`.
- **Reglas en la base:** registran dueña, administración o recepción; **solo la gerencia ve y responde**; resolver exige respuesta y no se reabre; **cancelación = solo se registra** (decisión de Diego; el expediente se conserva 5 años); `export_patient_data` solo gerencia, **también con la clínica suspendida**, y **registra el acceso**; superadmin, doctores y otras clínicas sin acceso; auditoría sin datos en claro.
- **Ficha 360 › Resumen › «Privacidad y derechos ARCO»:** exportar (descarga **PDF legible + JSON**), registrar solicitud (qué pide, cómo llegó, fecha, detalles) y lista con plazo («Vence en N días», «Vencida hace N días»), «Marcar en proceso» y «Responder» (atendida/improcedente + respuesta). Recepción solo registra; los doctores no ven la sección.
- **PDF:** `@react-pdf/renderer` 4.9.0 cargado solo al exportar (chunk aparte, ~445 KB gzip). Datos, consentimientos, notas, lista de documentos (los archivos van aparte), solicitudes y quién consultó sus datos; pie con «página X de Y». Revisado con datos ficticios (se corrigió el título encimado, la división silábica y el pie fuera de la hoja).
- Suite `arco_rls_isolation.sql` (6 actores) y `test:db` con 11 migraciones en verde. **Pruebas de mutación:** exportar sin bitácora, recepción leyendo solicitudes y doctor tratante exportando → las 3 las detecta la suite.
- 224 pruebas de la app (antes 217), estables en 3 corridas.
- **En dev (2026-11-16, aprobado por Diego):** migración 0011 aplicada (dry-run antes); las 11 suites en verde en el proyecto real; tipos regenerados (0001–0011); asesores sin avisos nuevos (solo las 3 RPC nuevas en el aviso esperado de SECURITY DEFINER).
- **Revisión con la cuenta de Diego y el paciente ficticio:** se registró una solicitud de acceso ficticia (vence el 14 dic, 20 días hábiles desde el lunes 16) y se respondió; la exportación real trae datos, consentimiento, documento, 13 accesos y la solicitud, **sin ids internos ni rutas de archivos**, y queda en la bitácora; el PDF se genera en el navegador (5.5 KB, 69 ms). No se descargó ningún archivo. Móvil 390 px en oscuro correcto.
- **Corregido en la revisión:** la fecha de vencimiento salía dos veces en cada solicitud; el aviso «Registramos la solicitud» se quedaba al responder (ahora confirma la respuesta).

### Puntos para aprobación
1. Aplicar la migración 0011 en dev: **aprobado y hecho** el 2026-11-16.
2. El plazo cuenta lunes a viernes **sin feriados** y es de 20 días hábiles; se ajusta con la revisión legal (P5).
3. No hay todavía una lista de solicitudes de toda la clínica (solo por paciente). Propuesta: «Configuración › Privacidad» con las pendientes y vencidas, en un incremento corto.

## E3 · M7 — Documentos del paciente (EN_PRUEBAS) · DATOS DE SALUD
- **Migración 0010** `20261116000500_patient_documents`: bucket **privado** `patient-documents` (`<clínica>/<paciente>/<uuid>.<ext>`; PDF, JPG, PNG, WebP y STL; hasta 25 MB), `patient_documents` (tipo, nombre, tamaño, `retain_until` = alta + 5 años, archivado) y `document_access_log` (subir, ver, descargar, archivar, reactivar).
- **Reglas en la base:** sube quien ve al paciente en una clínica activa; **nadie lee el bucket directo** (no hay política de lectura, edición ni borrado); `register_document` comprueba que el archivo exista y sea de ese paciente; `authorize_document_access` revisa permiso y **registra cada vista y descarga**; archivan solo gerencia y recepción; **no se borra** (NOM-004); el superadmin no ve documentos.
- **Edge Function `document-url`:** con la sesión del usuario llama a `authorize_document_access` y firma un enlace de **60 s** (`Cache-Control: no-store`). 6 pruebas del handler.
- **Pestaña Documentos** en la ficha 360: subir (elegir archivo o **Tomar foto** en móvil), nombre y tipo, lista en tarjetas, ver (pestaña nueva), descargar, archivar/reactivar y archivados; el contador aparece en la pestaña.
- Suite `documents_rls_isolation.sql` (6 actores) y `test:db` con 10 migraciones en verde. **Pruebas de mutación:** lectura directa del bucket, ver sin bitácora y subir a un paciente ajeno → las 3 las detecta la suite.
- 216 pruebas de la app (antes 209) estables en 3 corridas; 20 de Edge Functions; lint, typecheck y build en verde.
- **En dev (2026-11-16, aprobado por Diego):** migración 0010 aplicada (dry-run antes); las 10 suites en verde en el proyecto real, sin dejar datos (bucket y tabla en 0); `document-url` desplegada y responde 401 sin sesión; tipos regenerados (0001–0010); asesores sin avisos nuevos (solo las 3 RPC nuevas en el aviso esperado de SECURITY DEFINER).
- **Revisión en dev con la cuenta de Diego (2026-11-16, con su permiso):** se creó el paciente ficticio «Paciente Ficticio Prueba» y se subió «Radiografia ficticia» (PDF de 1 KB). Verificado: subir, contador en la pestaña, ver con enlace firmado, **el enlace vence a los 60 s** (400 `exp`), bitácora con subir + 2 vistas y su actor, y con la sesión de la dueña la app **no puede** descargar, firmar ni listar el bucket directo. Móvil 390 px en oscuro: «Tomar foto» visible y la tarjeta legible.
- **Corregido en la revisión:** (1) la cuadrícula de 2 columnas apretaba el nombre a ~1000 px → 2 columnas solo desde `xl`; (2) si el navegador bloquea la pestaña nueva, la app ya no se sale: muestra un enlace «Abrir …» que vence en un minuto (prueba nueva). 217 pruebas de la app.
- **Sin probar en el navegador:** «Descargar» (descarga un archivo; queda cubierto por las pruebas del handler).
- El paciente y el documento ficticios se quedan en dev (no se borran: se pueden archivar).

### Decisiones (aprobadas por Diego el 2026-11-16)
1. Aplicar la migración 0010 y desplegar `document-url` en dev. **Solo documentos ficticios.**
2. Si el registro falla después de subir, queda un archivo huérfano en el bucket (invisible e inaccesible). Propuesta: limpiarlos con una tarea programada en Fase 2+.
3. El STL se acepta por extensión (los navegadores no le asignan un tipo fijo); el bucket admite `application/octet-stream` solo para eso.
4. La bitácora se escribe **antes** de firmar el enlace: si la firma falla, queda un acceso registrado sin enlace entregado (preferimos registrar de más que de menos).

## E3 · M2-A — Pacientes (EN_PRUEBAS) · DATOS DE SALUD
- **Migración 0009** `20261116000400_patients`: `patients` (nombre, nacimiento, teléfono, correo, origen, doctor tratante con FK compuesta, etiquetas, archivado), `patient_consents` (método y versión del aviso de la clínica), `patient_notes` y `patient_access_log` (bitácora). `tenants.patient_notice_version` (borrador hasta P5).
- **Reglas en la base:** gerencia y recepción ven a todos; doctor y colaborador **solo a sus pacientes**; el superadmin **no** entra; **no hay alta sin consentimiento**; notas y consentimientos solo se leen con `open_patient`, que **registra el acceso**; sin borrado (archivar). Auditoría y bitácora sin datos del paciente en claro. Un doctor que da de alta queda como tratante; solo gerencia o recepción cambian al tratante o archivan.
- **P14 Lista:** búsqueda por nombre o teléfono y **paginación en el servidor** (25), activos y archivados, estados vacío, sin resultados, carga y error.
- **P16 Nuevo paciente:** datos + **consentimiento obligatorio** (papel o digital, con la versión del aviso). Marca «Registra tu primer paciente» en la guía y abre la ficha.
- **P15 Ficha 360:** encabezado (edad, teléfono, correo, origen, tratante, desde), WhatsApp, Editar, Archivar/Reactivar; pestañas Resumen (consentimiento, última nota), Notas (agregar) y Citas/Presupuestos/Pagos/Documentos explicadas hasta sus módulos. Edición manda solo lo que cambió.
- «+ Nuevo › Paciente» y la guía llevan a `/pacientes/nuevo`.
- Suite `patients_rls_isolation.sql` (6 actores) y `test:db` con 9 migraciones en verde. **Pruebas de mutación:** doctor que ve a todos, superadmin con acceso y abrir la ficha sin bitácora → las 3 las detecta la suite. Se corrigió el orden del rollback y el runner ahora cierra la transacción si un rollback falla.
- 203 pruebas de la app (antes 187), estables en 3 corridas.
- **En dev:** migración 0009 aplicada; las 9 suites en verde en el proyecto real; tipos regenerados; asesores sin avisos nuevos.
- **Revisión visual con la cuenta de Diego** (sin crear pacientes): lista vacía y nuevo paciente a 1440 px (claro) y 390 px (oscuro). Se corrigió: en móvil el botón «+» tapaba el botón final de los formularios (más espacio abajo en todo el panel).
- **Sin revisar con datos reales:** la ficha 360, porque la clínica de Diego aún no tiene pacientes (se puede crear uno ficticio).

### Decisiones (aprobadas por Diego el 2026-11-16)
1. Aplicar la migración 0009 en dev. **En el plan gratuito solo pacientes ficticios.**
2. La lista (nombre, teléfono, edad, tratante) se lee sin bitácora; se registra abrir la ficha, editar, archivar y escribir notas.
3. La pestaña Documentos y el escaneo del consentimiento firmado llegan con M7; exportar datos (ARCO), con M2-B.

## E3 · M10 — Configuración (EN_PRUEBAS)
M10 = P31 clínica y sucursales · P32 tratamientos y precios · P33 usuarios y roles (P34 integraciones y perfil público llega con E6). Sillones, tratamientos y equipo ya existían (E1-B5c, E2-B); M10 agrega:
- **Migración 0008** `20261116000300_branch_hours`: `branches.opening_hours` (lunes a domingo, hasta 3 horarios por día, en orden y sin encimarse; CHECK en la tabla) y RPC `set_branch_hours`. Base para la agenda (M3).
- **Horario de atención** en cada sucursal: resumen («Lun a Vie 09:00–18:00 · Sáb 09:00–13:00»), editor por día con abierto/cerrado y «Otro horario».
- **Identidad de tu clínica** (`/configuracion/identidad`): nombre, responsable y cargo, color (con ajuste de contraste), WhatsApp, ciudad y **logo** (subir, cambiar o quitar; el archivo anterior se borra de Storage), con la vista previa en vivo. Solo propietario o administración la cambian.
- **Mi perfil** (`/configuracion/perfil`): nombre y teléfono de la persona; muestra su correo y su rol.
- Configuración lista Identidad, Tu equipo, Sucursales y sillones, Tratamientos y precios y Mi perfil. La guía de Inicio («Identidad») lleva a Identidad.
- Suite `hours_rls_isolation.sql` y `test:db` con 8 migraciones en verde; prueba de mutación: al permitir horarios encimados, la suite falla. 187 pruebas (antes 177), estables en 3 corridas.
- Revisión visual con la cuenta de Diego (sin guardar nada): Configuración e Identidad a 1440 px (claro); horario de la sucursal a 390 px (oscuro).
- **En dev:** migración 0008 aplicada; las 8 suites en verde en el proyecto real; tipos regenerados; asesores sin avisos nuevos.

### Decisiones (aprobadas por Diego el 2026-11-16)
1. Aplicar la migración 0008 en dev.
2. El horario es la hora local de la sucursal; la zona horaria se agrega con la agenda (M3).
3. La dirección del perfil público (`dentro.mx/…`) se muestra pero no se cambia todavía (llega con M13, E6).
4. Cambiar la contraseña desde «Mi perfil» queda para después (hoy se hace con «¿Olvidaste tu contraseña?»).

## E2-C — Estados vacío, carga y error (EN_PRUEBAS)
- **Pantalla de error general** (`errorElement` del enrutador): si algo falla al mostrar cualquier pantalla, sale un aviso amable con «Volver a intentar» e «Ir a Inicio», sin rutas ni trazas. Distingue cuando no se pudo descargar una parte de la app (sin señal o versión nueva). Origen: core-base.
- **Error de sección** en el panel: si falla una pantalla, el menú sigue disponible; se limpia al cambiar de sección.
- **Aviso «Sin conexión»** en el panel y en el onboarding mientras el navegador no tenga internet.
- **Errores de carga con «Volver a intentar»** en Sucursales y sillones, Tratamientos y Tu equipo.
- Los estados vacíos de cada sección y los de carga (esqueletos) ya existían desde E1-A, E1-B3 y E2-A.
- 177 pruebas (antes 171), estables en 3 corridas. Revisión visual: pantalla de error a 390 px (claro) y aviso sin conexión a 1440 px (oscuro).

## E2-B — Onboarding pasos 2 a 5 (EN_PRUEBAS)
- **Migración 0007** `20261116000200_chairs_treatments`: tablas `chairs` (por sucursal, FK compuesta) y `treatments` (categoría, precio MXN, duración de la cita o «varía», activo). RPC `create_chair`, `update_chair` y `save_treatments` (varios a la vez, todo o nada). Lectura para miembros (agenda y presupuestos); escritura solo propietario o administración. No se borran: se desactivan.
- **Onboarding (P04)** con un marco común: pasos a la izquierda (hechos con palomita turquesa y enlazados), «Paso N de 5», barra de avance, «Atrás», «Hacerlo después» y «Continuar».
  - **Paso 1** identidad (ya existía): ahora sigue al paso 2.
  - **Paso 2** sucursales y sillones: editar nombre y dirección, agregar sucursales, agregar y quitar sillones. Exige al menos un sillón.
  - **Paso 3** tu equipo: el mismo formulario de invitación de «Tu equipo».
  - **Paso 4** tratamientos y precios (mockup Onboarding): categorías, lista con «Activo», precio y duración, «Agregar otro tratamiento». **Sugerencias sin precio y sin marcar**; solo se guardan los marcados con precio.
  - **Paso 5** WhatsApp: guarda el número normalizado. Meta (M11) solo se explica (E6).
  - Cada «Continuar» marca su tarea en la guía; «Hacerlo después» vuelve a Inicio sin marcar.
- **Configuración** › «Sucursales y sillones» y «Tratamientos y precios» reusan los mismos editores. La guía de Inicio lleva a los pasos del onboarding.
- **Errores encontrados por las pruebas:** (1) al crear la clínica, la guarda de la página mandaba a Inicio en lugar del paso 2; corregido. (2) Una prueba de acceso fallaba a veces por no esperar la redirección; corregida.
- Suite `catalog_rls_isolation.sql` y `test:db` con 7 migraciones en verde. 171 pruebas (antes 156), estables en 3 corridas.
- **En dev:** migración 0007 aplicada; las 7 suites en verde en el proyecto real; tipos regenerados; asesores sin avisos nuevos.
- **Revisión visual con la cuenta de Diego** (sin guardar nada): pasos 2 y 4 a 1440 px (claro) y paso 4 a 390 px (oscuro). Se corrigió: en tema oscuro la categoría elegida casi no se distinguía.
- Observación: la clínica de Diego muestra «Identidad» sin marcar porque el 2026-11-16 a las 00:08 se marcó y desmarcó desde la guía (auditoría); no es un error. Se puede volver a marcar desde Inicio.

### Decisiones (aprobadas por Diego el 2026-11-16)
1. Aplicar la migración 0007 en dev.
2. **Duración:** se guarda la de una cita en minutos (la agenda la usa) o «Varía»; el mockup muestra textos como «18 meses» o «3 citas», que irán en el plan de tratamiento del presupuesto (M4).
3. El paso 2 exige al menos un sillón; el paso 4, al menos un tratamiento con precio; el paso 5, el WhatsApp. El paso 3 se puede continuar sin invitar (consultorio sin equipo).
4. Editar la identidad (paso 1) después de creada la clínica llega con Configuración › Identidad (E3).

## E2-A — Inicio de primer uso (EN_PRUEBAS)
- **Migración 0006** `20261116000100_onboarding_tasks`: RPC `set_onboarding_task` (propietario o administración de clínica activa; solo las 7 tareas; con auditoría). Las clínicas nuevas (y las existentes) empiezan con «identity» hecha.
- **Inicio (mockup Main-Bienvenida):** «Hola, {nombre}. Terminemos de armar tu clínica.», **guía de 7 tareas** (avance en %, barra, minutos que faltan, marcar/desmarcar, botón principal en la primera pendiente), «¿Tienes dudas?» con «Repetir el recorrido» y **«Tu negocio, por dentro»** con 4 indicadores vacíos y su explicación. Con la guía completa, Inicio vuelve al tablero (E5). `/guia` muestra la misma guía; el contador del menú se actualiza.
- **Recorrido de 4 pasos** la primera vez (Saltar, Siguiente, Empezar, Escape); se recuerda por persona en sus metadatos de Auth. En móvil va encima del botón «+».
- Doctores y recepción ven la guía pero no la marcan.
- Suite `onboarding_rls_isolation.sql` y `test:db` con 6 migraciones en verde. 156 pruebas (antes 147), estables en 3 corridas; una verifica que las 7 tareas coincidan con la base.
- Revisión visual con la cuenta de Diego a 1440 px (claro) y 390 px (oscuro), sin marcar nada. Se corrigió: en móvil el recorrido tapaba el botón «+».
- **En dev:** migración 0006 aplicada; las 6 suites en verde en el proyecto real; la clínica de Diego quedó con «identity» hecha (1 de 7). Tipos regenerados. Asesores: solo los avisos ya conocidos (RPC por diseño y contraseñas filtradas).

### Decisiones (aprobadas por Diego el 2026-11-16)
1. Aplicar la migración 0006 en dev.
2. **Diferencias con el mockup:** se omitieron el video «Aprende dentro en 3 minutos», «Manuales paso a paso» y «Escríbenos por WhatsApp» (aún no existen) y la casilla **«Explorar con datos de ejemplo»** (choca con la regla «nada con datos simulados»; se propone diseñarla aparte).
3. Saludo neutro «Hola, Diego» en lugar de «Bienvenida, Ana».
4. Los botones de la guía llevan a Configuración, Pacientes y Presupuestos, que aún son páginas vacías hasta E2-B y E3.

## E1-B5c — Invitaciones de equipo (EN_PRUEBAS)
- **Migración 0005** `20261115000500_team_invitations`: tabla `invitations` (correo normalizado, rol distinto de `owner`, sucursales, vence en 7 días, una pendiente por correo y clínica). RPC: `create_invitation` (propietario o administración de clínica activa; rechaza a quien ya es miembro, roles y sucursales inválidos; reinvitar renueva), `revoke_invitation`, `accept_my_invitations` (solo con correo **confirmado**; convierte en membresías las invitaciones vigentes de ese correo, reactiva a quien fue quitado y nunca toca a la propietaria), `update_member_role` y `revoke_member` (nunca sobre la propietaria ni hacia `owner`). Auditoría sin correos.
- **Edge Function `invite-member`**: con el JWT de quien invita llama a `create_invitation` (la base decide permisos) y solo entonces envía el correo con `auth.admin.inviteUserByEmail` (clave de servicio, solo en el servidor). Si el correo ya tiene cuenta, la invitación queda lista para su próximo ingreso. La lógica vive en `handler.ts` con 14 pruebas; `index.ts` solo la conecta con Deno.
- **App:** al entrar, `accept_my_invitations` convierte invitaciones en membresías (así el invitado entra directo a la clínica). **Configuración › Tu equipo** (`/configuracion/equipo`): invitar (correo, rol, sucursales), lista del equipo con cambio de rol y «Quitar» con confirmación, invitaciones pendientes con «Reenviar» y «Cancelar». Doctores y recepción ven el equipo pero no lo editan.
- **Plantilla** `supabase/templates/invite_user.html` con la marca dentro; el enlace lleva a `/auth/invitacion` con `token_hash`.
- Suite `invitations_rls_isolation.sql` y `test:db` con las 5 migraciones en verde. Prueba de mutación: la primera versión de la suite no detectaba 2 cambios peligrosos (aceptar sin correo confirmado; quitarle el rol a la propietaria); se reforzó y ahora los detecta.
- 147 pruebas de la app (antes 122), estables en 3 corridas.
- **En dev:** migración 0005 aplicada (prueba en seco → `db push`), las 5 suites en verde en el proyecto real, secreto `SITE_URL=http://localhost:5173`, Edge Function `invite-member` desplegada (`--use-api`, `verify_jwt` activo; sin sesión responde 401). Tipos regenerados.
- **Prueba de punta a punta con la cuenta de Diego:** «Tu equipo» muestra su clínica y a Diego como propietario. Invitación a un correo ficticio: la cadena app → función → base → Supabase Auth funcionó; el correo NO salió (el correo por defecto solo envía a correos del equipo del proyecto) y la pantalla avisó «Guardamos la invitación, pero no pudimos enviar el correo». No se creó ningún usuario en Auth. Luego se canceló desde la pantalla. En dev quedan esa invitación (cancelada) y su auditoría.
- Se ajustó la pantalla: la descripción del rol va debajo del selector (antes se cortaba). Revisión a 1440 px (claro) y 390 px (oscuro), sin desplazamiento horizontal.
- Plantilla «Invite user» pegada en Supabase por Diego (2026-11-15).
- **Pendiente:** probar una invitación real cuando haya correo transaccional (B4) o con un correo del equipo del proyecto en Supabase.

### Decisiones (aprobadas por Diego el 2026-11-15)
1. Aplicar la migración 0005 en dev.
2. Definir el secreto `SITE_URL=http://localhost:5173` de las Edge Functions y **desplegar** `invite-member` en dev.
3. Pegar la plantilla «Invite user» en Supabase → Authentication → Emails (lo hace Diego).
4. Con el correo por defecto de Supabase **solo llegan invitaciones a correos del equipo del proyecto**; para invitar a cualquiera se necesita el correo transaccional (B4).

## E1-B5b — Logo de la clínica en Storage privado (EN_PRUEBAS)
- **Migración 0004** `20261115000400_tenant_logo`: bucket **privado** `tenant-branding` (1 MB; PNG, JPG o WebP), rutas `<clínica>/logo-<id>.<ext>`. Políticas en `storage.objects`: suben, cambian o borran solo propietario o administrador de una clínica **activa**; ven los miembros y el superadmin. `update_tenant_identity` solo acepta un logo de esa misma clínica (ni de otra ni URL externa).
- **Alta de la clínica:** bloque «Logo» del mockup (arrastrar o subir, «Cambiar», «Quitar logo», vista previa también en el menú, el PDF y el WhatsApp de ejemplo). Al crear la clínica se sube a Storage y se asigna por RPC; si la asignación falla se borra el archivo; si la subida falla, la clínica entra con sus iniciales.
- **Panel:** el menú muestra el logo con una URL firmada de 1 hora que se renueva sola (sobre fondo blanco para que se vea en `night`).
- Suite `logo_rls_isolation.sql` (propietaria, recepción, otra clínica, superadmin, clínica suspendida) y `test:db` con las 4 migraciones en verde. Prueba de mutación: al quitar la regla de la ruta, la suite falla.
- 122 pruebas de la app (antes 116), estables en 3 corridas. Revisión visual del bloque a 1440 y 390 px (con página temporal no guardada); se compactó a una fila como en el mockup.
- **Aplicada en dev:** las 4 suites en verde en el proyecto real (incluye las políticas sobre el `storage.objects` real); bucket privado de 1 MB con PNG/JPG/WebP y sus 4 políticas; sin archivos de prueba. Asesores: sin avisos nuevos.
- **No probado en real:** subir un logo con la app (la clínica de Diego ya existe y cambiar el logo llega con Configuración).

### Decisiones (aprobadas por Diego el 2026-11-15)
1. Aplicar la migración 0004 en `dentro-dentistas-app`.
2. **SVG no se permite** (el mockup dice «PNG o SVG»): un SVG puede llevar código; PNG, JPG y WebP bastan.
3. Cambiar el logo después de crear la clínica llega con Configuración (M10, E3).

## E1-B5a — Aviso de privacidad y consentimientos de las cuentas (EN_PRUEBAS)
E1-B5 se dividió en tres incrementos: **B5a** aviso y consentimientos, **B5b** logo en Storage privado, **B5c** invitaciones de equipo.
- **Migración 0003** `20261115000300_account_consents`: `privacy_notices` (versiones del aviso, una sola vigente; se publican por SQL, no desde la app) y `account_consents` (evidencia por cuenta y versión, con origen `signup` / `invite` / `renewal`; solo se agrega, nunca se edita ni se borra). RPC `accept_privacy_notice` (solo la versión vigente, idempotente). RLS: cada quien ve sus aceptaciones; el superadmin todas (ARCO). Versión vigente: `borrador-2026-11-15`.
- **Alcance:** es el consentimiento de las CUENTAS al aviso de dentro. El de los PACIENTES es de cada clínica y llega con M2 (`patient_consents`, por tenant).
- **`ConsentGate`** en el área privada: si la persona ya aceptó al registrarse o al activar su invitación, registra la evidencia sin volver a preguntar; si no, o si se publicó una versión nueva, muestra «Acepta el aviso» / «Actualizamos el aviso» antes de entrar.
- Suite `consents_rls_isolation.sql` y `test:db` en verde (con rollback y reaplicación de las 3 migraciones). 116 pruebas de la app (antes 109), estables en 3 corridas; una verifica que la versión del registro sea la vigente en la migración.
- **Aplicada en dev** (prueba en seco → `db push`): las 3 suites en verde en el proyecto real; tipos regenerados.
- **Con la cuenta de Diego:** al abrir el panel, `ConsentGate` registró sola la evidencia (`borrador-2026-11-15`, origen `signup`) porque la aceptó al registrarse; entró directo sin volver a preguntar.
- **Asesor nuevo:** `auth_leaked_password_protection` (Supabase Auth no revisa contraseñas filtradas). Es un ajuste del panel de Supabase: lo decide Diego.
- La pantalla «Acepta el aviso» solo se probó con Supabase simulado (la cuenta de Diego ya tenía la aceptación); usa `AuthLayout` y componentes ya revisados.

### Decisiones (aprobadas por Diego el 2026-11-15)
1. Aplicar la migración 0003 en `dentro-dentistas-app`.
2. Que este consentimiento sea solo de las cuentas; el de pacientes, con M2.
3. Si en el futuro no hay aviso vigente publicado, la app no bloquea el acceso (no hay nada que aceptar).

## E1-B4 — Conexión al proyecto dev (EN_PRUEBAS)
- **Migración 0002** `20261115000200_tenant_contact`: WhatsApp (`whatsapp_e164`, E.164) y ciudad (`city`) de la clínica; `create_tenant` y `update_tenant_identity` amplían su firma sin dejar sobrecargas. Rollback y suite `contact_rls_isolation.sql`. El alta pide ambos campos (WhatsApp normalizado con `lib/phone.ts` de core-base).
- **CLI de Supabase** como dependencia de desarrollo (`npx supabase`) y `supabase/config.toml`. Diego hizo `login` y `link` (sus credenciales nunca pasaron por Claude). `.env.local` solo en su Mac, excluido de git.
- **Aplicado en dev** (`iacdtcrzmavbjhgtdchl`): prueba en seco → `db push` de 0001 y 0002.
- **Verificación en el proyecto real:** suites `core_rls_isolation` y `contact_rls_isolation` en verde (ROLLBACK, sin residuos); comprobación posterior: RLS en todas las tablas, `anon` sin privilegios ni acceso a `private`, `authenticated` sin escrituras directas, todas las funciones con `search_path`.
- **Asesores de Supabase:** sin errores ni avisos de rendimiento. 7 avisos `authenticated_security_definer_function_executable` en las RPC de escritura: **es el diseño** (escrituras solo por RPC que validan rol y clínica; cubierto por la suite).
- **Tipos regenerados** desde el proyecto (`src/lib/database.types.ts`, no editar a mano) con alias en `src/lib/db.ts`.
- **Prueba de punta a punta con Diego:** registro con su correo → confirmación → alta de la clínica → panel con su clínica y «Sucursal principal». En la base: 1 usuario confirmado con nombre y aviso aceptado, 1 clínica activa con WhatsApp y ciudad, membresía `owner`, sucursal activa y auditoría `tenant.created`.
- Pruebas: 109 con Supabase simulado y `test:db` en verde. lint, typecheck y build limpios.
- Datos en dev: solo los de prueba de Diego (ficticios). Plan gratuito: nada de pacientes reales.

## E1-B3 — Clínica activa y alta de clínica (EN_PRUEBAS)
- **Se retiró la identidad TEMPORAL** de E1-A (`clinic-config.ts`). El menú, la barra y "Más" muestran la clínica real de la persona: nombre, responsable, cargo, iniciales con `brand_color` (validado otra vez por contraste) y avance de la guía desde `onboarding_state`.
- `WorkspaceProvider` (de core-base): perfil, membresías activas, superadmin, clínica activa y sucursal activa. Ambas se recuerdan en este dispositivo (`dentro.activeTenantId`, `dentro.activeBranchId.<clínica>`; solo ids).
- `RequireClinic`: sin clínica → `/bienvenida`; clínica cancelada → aviso sin acceso a datos (ni se piden sus sucursales); error de carga → "Volver a intentar". Clínica suspendida → aviso de solo lectura en el panel.
- **P04 paso 1 · `/bienvenida`** (mockup Onboarding-Identidad): pasos a la izquierda, tipo (clínica o consultorio, D2), nombre, responsable y cargo, color de marca (6 colores + código, con aviso si se oscurece), dirección del perfil (`dentro.mx/…`, sugerida desde el nombre y validada igual que la base) y vista previa en vivo (menú, PDF y WhatsApp, sin datos de ejemplo). "Continuar" llama a `create_tenant` y entra al panel.
- Selector de clínica en la barra (y en "Más") solo si la persona trabaja en más de una (doctor colaborador). Selector de sucursal con las sucursales reales.
- Pruebas: 106 (antes 89), estables en 8 corridas seguidas (se corrigió una prueba que a veces fallaba por no esperar a que se dibujara el panel; no era un error de la app). Una prueba verifica que las palabras reservadas de la dirección sean las mismas en TypeScript y en la migración.
- Revisión visual de `/bienvenida` a 1440 y 390 px, claro y oscuro (con una página temporal que no se guardó). Se corrigió: el PDF y la burbuja de WhatsApp de la vista previa se veían oscuros en tema oscuro; ahora siempre son blancos, como en la vida real.

### Diferencias con el mockup (aprobadas por Diego el 2026-11-15, ver `docs/decisiones.md`)
1. **Logo:** no se puede subir todavía (requiere Storage privado, E1-B5); se muestran las iniciales con un aviso.
2. **WhatsApp de la clínica y Ciudad:** el mockup los pide, pero no existen en `tenants`. Se agregan en una migración junto con E1-B4.
3. Se agregó la elección **Clínica / Consultorio** (D2) y la **dirección del perfil** (la exige la base para M13).
4. Se omitieron "Hacerlo después" (la clínica es obligatoria para entrar) y "Agenda una llamada" (aún no hay a dónde enviarla).
5. Pasos 2 a 5 del onboarding: solo se muestran; se construyen en E2.

## E1-B2 — Auth en el frontend (EN_PRUEBAS)
- Portado de `core-base` y adaptado a dentro: cliente de Supabase (PKCE, clave publishable, D1), `AuthProvider`, guardas `RequireAuth` / `GuestOnly`, `safeNextPath`, errores en español sin revelar si una cuenta existe, enlaces `token_hash` que solo se verifican al tocar el botón, canje PKCE, reenvío de confirmación con espera de 60 s.
- Pantallas con el diseño de dentro (`AuthLayout`: panel `night` con la promesa de marca en escritorio): P01 Ingresar (`/ingresar`), P02 Registro (`/registro`), P03 Recuperar y restablecer (`/recuperar`, `/restablecer`), confirmación de correo (`/auth/callback`), P05 Aceptar invitación (`/auth/invitacion`) y aviso de privacidad BORRADOR (`/aviso-de-privacidad`).
- Todo el panel exige sesión. "Cerrar sesión" en el menú lateral y en "Más". Si faltan variables de entorno, la app lo dice en lugar de fallar.
- D3: solo correo y contraseña; el código por correo (OTP) no se portó. D4: registro abierto para dueños.
- Nuevos componentes: `Alert`, `Checkbox`, `Spinner`, `BrandLogo` (logo a color o negativo según el tema); `Button` con `loading` y `block`.
- `database.types.ts` PROVISIONAL, escrito a mano desde la migración; se regenera en E1-B4.
- Pruebas: 89 (antes 66) con Supabase simulado: rutas protegidas, ingreso, registro, recuperación, invitación, confirmación, cierre de sesión, redirecciones seguras, errores y esquemas. Estables en 3 corridas seguidas.
- Las pruebas encontraron un error real: al entrar, `GuestOnly` mandaba al inicio en lugar de a la sección pedida. Corregido.
- Revisión visual a 1440, 768 y 390 px en claro y oscuro; sin errores en consola. Se corrigió el logo en tema oscuro (ahora usa la versión negativa).
- Aviso del build: el JavaScript pesa 699 kB (206 kB gzip) por supabase-js; se dividirá con carga diferida en E7.
- Pendiente para más adelante: borradores de formularios y avisos `toast`/`confirm` de core-base (se portan con E3); `.claude/launch.json` incluye `dentro-dev-sin-backend` para ver las pantallas sin Supabase.

## E1-B1 — Migración del núcleo multiempresa (EN_PRUEBAS)
- `supabase/migrations/20261115000100_core_tenancy.sql`: perfiles, clínicas con identidad (`display_name`, responsable, cargo, logo, `brand_color` ajustado a AA, `onboarding_state`), membresías con roles `owner` / `admin` / `reception` / `doctor` / `doctor_collab`, sucursales, sucursales por membresía, superadmin y `audit_logs`.
- Reglas de dentro aplicadas: `authenticated` solo lee (RLS); toda escritura por RPC (`create_tenant`, `update_tenant_identity`, `update_my_profile`, `create_branch`, `update_branch`, `set_membership_branches`, `admin_set_tenant_status`); FK compuestas `(tenant_id, id)`; helpers envueltos en `(select …)`; auditoría sin datos personales en claro.
- Rollback: `supabase/rollback/20261115000100_core_tenancy.down.sql`. Comprobación posterior: `supabase/tests/core_post_apply_check.sql`.
- Suite `supabase/tests/core_rls_isolation.sql` (93 comprobaciones, 9 actores + anónimo, termina en ROLLBACK).
- `npm run test:db` (PostgreSQL 17 local con `embedded-postgres`): migración → suite → paridad del `brand_color` SQL/TypeScript → rollback sin residuos → reaplicación → suite. **TODO OK.**
- Prueba de mutaciones: se rompió la migración 5 veces a propósito (sucursales visibles para todos, UPDATE directo, estatus ignorado, superadmin sin perfiles, límite de clínicas) y la suite detectó las 5.
- La suite encontró un error real en `update_tenant_identity` (armado del arreglo de campos), ya corregido.
- lint, typecheck, 66 pruebas y build limpios.

### Decisiones (aprobadas por Diego el 2026-11-15, ver `docs/decisiones.md`)
1. `create_tenant` crea automáticamente la «Sucursal principal».
2. Una membresía sin sucursales asignadas puede trabajar en todas.
3. Las sucursales no se borran: se desactivan (y siempre queda al menos una activa).
4. El superadmin ve todo el núcleo pero **no** puede editar la identidad de una clínica; solo cambia su estatus con motivo.
5. Cambios de rol, revocar miembros e invitaciones quedan para E1-B5.

## E0-A — Auditoría de `core-base` (APROBADA 2026-11-15)
- Fuente: `REALT-IN-BASE-DENTRO.zip` (copia depurada de Realt-In del 2026-11-14), revisada en modo de solo lectura fuera del repo. No se ejecutó nada ni se copió código.
- Sin secretos ni datos de clientes. Quedan restos de marca de Realt-In/AVIOR por quitar al portar.
- Resultado: núcleo multiempresa, auth y pruebas de RLS reutilizables. Brechas contra las reglas de dentro: escrituras directas (no por RPC), sin FK compuestas, roles distintos, sin identidad de clínica, sucursales, invitaciones desde la app ni consentimientos.
- Plan E1-B1 a E1-B5 en `docs/auditoria-core-base.md` §6. Decisiones D1–D8 aprobadas (`docs/decisiones.md`). El superadmin ve perfiles y membresías de todas las clínicas, pero no datos clínicos.
- Aplicado: `.env.example` usa `VITE_SUPABASE_PUBLISHABLE_KEY` (D1); `modelo-datos.md` usa `audit_logs` (D6) e `independent` / `clinic` (D2).

## E1-A — Estructura del proyecto y layout (EN_PRUEBAS)
Por indicación de Diego se adelantó el esqueleto del frontend mientras sigue pendiente la auditoría de Realt-In. No toca auth, base de datos ni Supabase.

- **Stack:** Vite 8 + React 19 + TypeScript 6 (estricto) + Tailwind 4 + React Router 8 + ESLint 10 + Vitest 5. Gestor npm.
- **Tokens:** `src/brand/tokens.css` (claro y oscuro) generado de `docs/diseno/tokens.json`; una prueba falla si dejan de coincidir. Tema de Tailwind en `src/index.css` solo con colores de dentro. Fuentes: Plus Jakarta Sans e Inter.
- **Componentes base** (`src/components/ui`): Button, Card, Badge, Input, Select, EmptyState, Skeleton, Icon.
- **Layout** (`src/layouts/AppLayout.tsx`, `src/components/layout`): menú lateral `night` con la identidad de la clínica, 10 secciones, Guía de inicio y "Hecho con dentro"; barra superior con búsqueda, sucursal, notificaciones y "+ Nuevo"; en móvil y tablet, barra inferior (Inicio · Agenda · Pacientes · Leads · Más) y botón flotante "+ Nuevo".
- **Identidad TEMPORAL:** `src/lib/clinic-config.ts` (se reemplaza en E1-B por `tenants`). `brand_color` se valida a 4.5:1 con blanco y se oscurece si no pasa (`src/lib/color.ts`).
- **Rutas:** `/`, `/agenda`, `/leads`, `/pacientes`, `/presupuestos`, `/cobros`, `/seguimientos`, `/doctores`, `/crece`, `/configuracion`, `/guia`, `/mas` y 404. Todas con estado vacío explicativo, sin datos de ejemplo.
- **Verificación:** lint, typecheck, 66 pruebas y build limpios. Revisado a 1440, 768 y 390 px en claro y oscuro.

### Decisiones (aprobadas por Diego el 2026-11-12, ver `docs/decisiones.md`)
1. **Punto de corte:** el menú lateral aparece desde 1024 px; en tablet (768 px) se usa la barra inferior.
2. **"Más" en móvil** es una página (`/mas`) con las secciones restantes y la guía.
3. **Tokens derivados** que no están en `tokens.json` (en `tokens.css`): `on-violet` (texto de botones; en oscuro va en `night` porque blanco sobre `#9B7BFF` da 3.15:1), `border-strong`, `night-raised`, `night-active` y textos sobre `night`. Proponer subirlos al sistema de diseño.
4. **Contraste:** `turquoise-text` sobre `turquoise-soft` da 4.26:1 en claro (no llega a AA). La etiqueta "automático" usa texto `ink` con un punto turquesa. Opción: oscurecer `turquoise-text` claro en el sistema de diseño.
5. **Subir a `core-base`:** `src/lib/color.ts` (contraste y validación de color), `useDismiss` y los componentes base.
6. `npm audit` reporta 10 vulnerabilidades moderadas solo en dependencias de desarrollo (ESLint → minimatch). No afectan el build.

## Última tarea validada
- E3 · M5-A Pagos aplicado en dev y revisado (2026-11-19); falta integrarlo en `main`.
- Cierre de V3 y decisiones de infraestructura de E0.
- Borradores de `docs/arquitectura.md`, `docs/modelo-datos.md` y `docs/roadmap-tecnico.md`.

## Siguiente tarea
- **E3 · M5-A Pagos:** integrar en `main` y push (con aprobación de Diego). Después **M5-B** (comprobante PDF y WhatsApp).
- Para revisar la app con datos usa `dentro-dev` (`localhost:5173`).
- **Al final (decisión de Diego):** guía de pruebas por módulo para Diego y su cuñada (validación con dentistas).
- **B4 (Diego):** elegir proveedor de correo transaccional para que confirmaciones, recuperación e invitaciones lleguen a cualquier correo.
- **Decidir (Diego):** activar la protección contra contraseñas filtradas en Supabase Auth.

## Bloqueos y pendientes
| # | Pendiente | Bloquea | Responsable |
|---|---|---|---|
| ~~B1~~ | ✅ Código de Realt-In recibido (zip depurado, 2026-11-15) | — | Diego |
| ~~B2~~ | ✅ Proyecto `dentro-dentistas-app` creado (2026-11-10) | — | Diego |
| B3 | Confirmar el plan de Hostinger (compartido o con Node / VPS) | Decisión de M13 y E9 | Diego |
| B4 | **Correo transaccional** (invitaciones y recuperación de contraseña). Recordar a Diego al iniciar E1 | Cierre de E1 | Diego |
| B5 | Revisión de la app de Meta (`leads_retrieval`) para M11 | M11 en E6 | Lalo |
| B6 | Abrir cuentas de Mercado Pago / Stripe; empresa propia | Link de pago (E6) y cobro de suscripciones (C1) | Diego |
| P4 | Lógica de Seguimiento Ninja | Fase 2 | Diego |
| P5 | Revisión legal (contrato responsable/encargado, aviso de privacidad) | C1 | Diego |
| P6 | V1: pricing y cortes de plan | C1 | Diego |
| P7 | Validar con dentistas durante el desarrollo (empezar con la cuñada de Diego) | — | Diego |

## Infraestructura
- Repositorio: `diegocxst/app-dentro` (privado). Carpeta local de Diego: `~/Memory Card/Proyecctos/Dentro-Dentistas`.
- Supabase (dev): `dentro-dentistas-app`, plan gratuito. **Creado.** URL `https://iacdtcrzmavbjhgtdchl.supabase.co` · ref `iacdtcrzmavbjhgtdchl` · entorno: desarrollo · sin datos. Claves solo en `.env` local (nunca en el repo). Solo datos ficticios hasta pasar a un plan de pago con respaldos.
- Hosting: Hostinger (plan por confirmar).
- Dominio: `dentro.mx` (disponible, por comprar).
- Equipo: Diego empieza el desarrollo; después se suma Lalo.
