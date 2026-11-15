# estado.md — dentro
Última actualización: 2026-11-15 · Por: Diego (con Claude)

## Integración
- 2026-11-15: E1-A, E1-B1, E1-B2, E1-B3 y E1-B4 integradas en `main` **local** (avance directo, sin conflictos). Verificado en `main`: lint, typecheck, 109 pruebas, `test:db` y build. Las ramas `feature/*` se conservan (solo locales).
- 2026-11-15: **push de `main`** a `diegocxst/app-dentro` con aprobación de Diego (`cb84157..798284e`, sin forzar; revisado sin secretos).

## Fase actual
| Fase | Estado |
|---|---|
| V0 Validación | Sin entrevistas aplicadas; scorecard preliminar 3.55 (AJUSTAR). Los cuestionarios son referencia, no requisito (decisión de Diego). |
| V1 Modelo de negocio | Pendiente (pricing y cortes de plan). Supuesto: $399–$800 MXN/mes. |
| V2 Estructura | ✅ **Cerrada el 2026-11-05.** Alcance del MVP congelado. |
| V3 Diseño y demo | ✅ **Cerrada el 2026-11-10.** Demo navegable en el lienzo "dentro — Pantallas clave V3". Se omite la validación previa con prospectos: se valida durante el desarrollo (riesgo aceptado). |
| **E0 Auditoría y planificación** | ✅ **Cerrada el 2026-11-15** (auditoría E0-A aprobada con D1–D8). |
| **E1-B5a Aviso y consentimientos** | **EN_PRUEBAS** desde el 2026-11-15. Rama local `feature/e1b5a-consents` (sin push). Migración 0003 **aplicada en dev** con aprobación de Diego. |
| **E1-B4 Conexión al proyecto dev** | **EN_PRUEBAS** desde el 2026-11-15. Migraciones 0001 y 0002 **aplicadas en `dentro-dentistas-app`** con aprobación de Diego. Rama local `feature/e1b4-dev-connect` (sin push). |
| **E1-B3 Clínica activa y alta** | **EN_PRUEBAS** desde el 2026-11-15. Rama local `feature/e1b3-workspace` (sin push). Supabase simulado en pruebas. Diferencias con el mockup aprobadas el 2026-11-15. |
| **E1-B2 Auth en el frontend** | **EN_PRUEBAS** desde el 2026-11-15. Rama local `feature/e1b2-auth` (sin push). Supabase simulado en pruebas; sin conexión al proyecto. |
| **E1-B1 Migración del núcleo** | **EN_PRUEBAS** desde el 2026-11-15. Rama local `feature/e1b1-core-tenancy` (sin push). Probada solo en PostgreSQL local; nada aplicado en Supabase. Decisiones aprobadas el 2026-11-15. |
| **E1-A Estructura y layout** | **EN_PRUEBAS** desde el 2026-11-11; decisiones aprobadas el 2026-11-12, falta revisión en local y merge. Rama local `feature/e1a-estructura` (sin push). Sin Supabase, auth ni base de datos. |

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
- Cierre de V3 y decisiones de infraestructura de E0.
- Borradores de `docs/arquitectura.md`, `docs/modelo-datos.md` y `docs/roadmap-tecnico.md`.

## Siguiente tarea
- **Revisar y aprobar E1-A** (correr `npm install` y `npm run dev`), y hacer merge de `feature/e1a-estructura`.
- **E1-B5:** invitaciones de equipo (Edge Function), aviso de privacidad y consentimientos (`privacy_notices`, `consents`), Storage privado para el logo. Requiere correo transaccional (B4) para producción.
- ~~E0-A~~ (entregada): auditoría de solo lectura del código de Realt-In (respaldo de Lalo) para definir `core-base` → `docs/auditoria-core-base.md`. La ejecuta Diego con Claude Code en su Mac (prompt E0-A).

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
