# Auditoría de `core-base` (Realt-In) — dentro
E0-A · 2026-11-15 · Estado: PROPUESTA (pendiente de aprobación de Diego)

## 1. Qué se auditó
- **Fuente:** `REALT-IN-BASE-DENTRO.zip` (generado a partir de Realt-In el 2026-11-14). Es una copia **depurada** con autenticación, multiempresa, roles con RLS y layout del panel. Trae 133 archivos, unas 5,900 líneas de TypeScript y una migración SQL.
- **Cómo:** solo lectura. Se extrajo en una carpeta temporal fuera del repositorio. **No se ejecutó nada**: ni `npm install`, ni pruebas, ni scripts. Al repo de dentro no se copió ningún archivo.
- **Secretos:** no se encontraron claves, tokens, URL ni referencias al proyecto Supabase de Realt-In. `.env.example` trae solo valores ficticios. Los correos de las pruebas usan dominios reservados (`example.test`, `ejemplo.test`).
- **Datos ajenos:** no hay datos de clientes. Sí quedan restos de marca y de dominio de otro producto: «REALT-IN», «AVIOR», asesores, inmobiliarias y propiedades. Se listan en §4 para quitarlos.
- **No verificado:** el paquete dice que pasa 230 pruebas y la prueba de base de datos. Eso se comprueba al portar cada pieza (§6).

## 2. Qué trae
| Pieza | Contenido | Valor para dentro |
|---|---|---|
| Migración `e1_core_tenancy` | Esquema `private`. Tablas `profiles`, `tenants`, `memberships`, `audit_logs` y `private.platform_admins`. Helpers `is_member`, `has_role`, `can_write`, `is_platform_admin` y `shares_tenant_with`. RPC `create_tenant` y `admin_set_tenant_status`. Trigger `handle_new_user`. Estatus `active` / `suspended` (solo lectura) / `cancelled` (sin acceso) | **Alto.** Es el núcleo multiempresa que pide la arquitectura |
| Rollback y pruebas SQL | `.down.sql`, una suite de aislamiento con 7 actores (79 aserciones, termina en ROLLBACK) y una comprobación posterior a aplicar | **Alto.** Es el patrón de «pruebas A/B/C + anónimo» de E1 |
| `scripts/test-db.mjs` | Prueba la base en un PostgreSQL 17 desechable (`embedded-postgres`): stub de Supabase, migración, suite, rollback y reaplicación. No toca ningún Supabase | **Alto.** Permite probar migraciones en LOCAL antes de STAGING |
| Autenticación (`src/auth`, `src/lib`, `src/pages/auth`) | PKCE. Correo y contraseña. Código OTP opcional. Enlaces `token_hash` que se verifican al tocar un botón (los escáneres de correo no los gastan). Invitación, recuperación, guardas `RequireAuth` / `GuestOnly`, `safeNextPath` contra redirecciones abiertas y errores traducidos | **Alto.** Es justo lo que falta en E1 |
| `WorkspaceProvider` y `data/workspace.ts` | Membresías, empresa activa (preferencia local; la RLS sigue filtrando), perfil, superadmin, equipo y auditoría | **Alto.** Sustituye la identidad TEMPORAL de E1-A |
| `CreateTenantPage` | Alta obligatoria de la primera empresa | **Medio.** Se adapta como paso 1 del onboarding P04 |
| `components/feedback`, `auth`, `common` y `Sheet` | `toast`, `confirm` y `alert` accesibles. Entrada OTP. Reenvío de confirmación. Errores por sección. Hoja inferior | **Medio.** Hay que pasarlos a los tokens de dentro |
| `AppLayout`, `components/ui`, `index.css`, `sx`, `Logo` | Layout y estilos de Realt-In (Tailwind con colores `slate` y marca propia) | **Bajo.** Lo reemplazan el layout y los componentes de E1-A |

## 3. Comparación con las reglas de dentro
| Regla (CLAUDE.md / arquitectura) | Realt-In | Acción en dentro |
|---|---|---|
| `tenant_id` + RLS en toda tabla | ✅ Sí, con RLS explícita y privilegios por omisión revocados | Conservar |
| Helpers de RLS en `private`, `security definer`, `search_path = ''` | ✅ Sí | Conservar |
| Helpers envueltos en `(select …)` | ⚠️ Parcial: `auth.uid()` sí va envuelto; `private.is_platform_admin()` (sin argumentos) se llama por fila | Envolver los helpers sin argumentos: `(select private.is_platform_admin())` |
| **Escrituras solo por RPC** | ❌ Hay `UPDATE` directo en `tenants.name` y en `profiles` (con permiso por columna) | Quitar esos `grant update`. Crear las RPC `update_tenant_identity` y `update_my_profile` |
| **FK compuestas `(tenant_id, id)`** | ❌ No aparecen (solo hay tablas raíz) | Agregar `unique (tenant_id, id)` en `memberships` y usar FK compuestas en toda tabla hija (`branches`, `membership_branches`, `doctor_settings`…) |
| Índices que empiezan por `tenant_id` | ✅ En `audit_logs`. ⚠️ `memberships` solo tiene `unique (tenant_id, user_id)`, que sirve | Mantener el patrón en las tablas nuevas |
| Roles `owner`, `admin`, `reception`, `doctor`, `doctor_collab` | ❌ Solo `owner`, `admin` y `agent` | Enum `tenant_role` = `owner`, `admin`, `reception`, `doctor`, `doctor_collab`. Se quita `agent` |
| `platform_admin` sin datos clínicos | ✅ Lo resuelve una tabla `private.platform_admins` que solo se otorga por SQL. ⚠️ Hoy el superadmin **lee todas** las membresías, perfiles y la auditoría | Mantener la tabla. En las tablas clínicas, el superadmin **no** entra en las políticas |
| Tipo de tenant | `independent` / `brokerage` | `independent` / `clinic` |
| Identidad de la clínica | ❌ No existe | Agregar a `tenants`: `display_name`, `owner_display_name`, `owner_title`, `logo_path`, `brand_color` (con `check` de formato hex; el contraste se valida en la RPC) y `onboarding_state` |
| Sucursales (multi-sucursal desde el MVP) | ❌ No existe | Tablas `branches` y `membership_branches` |
| Invitaciones desde la app | ⚠️ Solo desde el panel de Supabase (en Realt-In, las RPC de equipo eran del módulo 21, en E6) | Tabla `invitations` + Edge Function que invita con la clave de servicio en el servidor (nunca en el navegador) |
| Aviso versionado y consentimientos (LFPDPPP) | ❌ No existe; `PrivacyPage` es el borrador de otra empresa | Tablas `privacy_notices` y `consents`. Aviso propio revisado por un abogado (P5) |
| Bitácora sin datos personales | ✅ `audit_logs` documenta «no guardar PII en details» | Conservar. **Decidir el nombre** (§7, D6) |
| Límite de empresas por usuario | 5 por usuario en `create_tenant` | Definir (§7, D5). Los doctores colaboradores entran por invitación, no por alta |
| Paginación en servidor | ⚠️ Equipo sin paginar; la auditoría con `limit` | Paginar las listas de E3 desde el inicio |
| TanStack Query | ❌ No se usa (hay `useEffect` + estado) | Se adopta en E3, como propone la arquitectura. No bloquea E1 |
| Claves de Supabase | `VITE_SUPABASE_PUBLISHABLE_KEY` (formato nuevo `sb_publishable_…`) | Adoptar ese nombre en `.env.example` (§7, D1) |

## 4. Inventario: copiar, renombrar, descartar
### Copiar casi tal cual (con pruebas)
- `src/auth/AuthProvider.tsx` y `src/auth/guards.tsx` (en dentro, `/app` → `/`).
- `src/lib`: `emailLink`, `otp`, `pkceExchange`, `signupAccess`, `errors`, `schemas`, `formDrafts`, `pendingSignup`, `phone`, `slug`, `authDiag`, `env` y `scrollLock`.
- `src/hooks/useKeyboardInset.ts`.
- `src/components/feedback/*`, `src/components/auth/*`, `src/components/common/LoadError.tsx` y `components/ui/Sheet.tsx` y `Spinner.tsx` (estilos pasados a los tokens de dentro).
- `src/workspace/WorkspaceProvider.tsx` y `src/data/workspace.ts`.
- `scripts/test-db.mjs` y `supabase/tests/local/supabase_stub.sql`.
- Las 24 suites de Vitest que acompañan a estas piezas.

### Copiar y adaptar
| Pieza | Cambio |
|---|---|
| Migración `e1_core_tenancy` | Pasa a `0001_core_tenancy` de dentro con todo lo de §3: roles, tipo, identidad, sucursales, RPC de escritura, FK compuestas y `(select …)`. Ajustar las palabras reservadas del slug y renombrar el ajuste `avior.audit_reason` a `dentro.audit_reason` |
| Rollback y suite de aislamiento | Actores de dentro (owner, admin, recepción, doctor, colaborador, otra clínica, sin clínica, superadmin, anónimo). Quitar las referencias a `media_worker_tick` / `pg_net` de Realt-In |
| `src/pages/auth/*` | Rediseño con los componentes de dentro. Textos en el tono de la marca |
| `CreateTenantPage` | Se integra al onboarding P04 (paso 1: identidad de la clínica) |
| `lib/labels.ts` | Etiquetas de roles y tipos de dentro |
| Claves de `localStorage` | `avior.activeTenantId` y `realtin.pendingSignup` → prefijo `dentro.` |
| Plantillas de correo | Reescribir con la marca dentro y la vigencia real del OTP |

### Descartar
- `src/lib/database.types.ts`: trae el esquema completo de Realt-In (propiedades, medios, amenidades). Se **regenera** desde el proyecto de dentro.
- Los tipos de propiedades en `src/lib/supabase.ts`.
- `pages/legal/PrivacyPage.tsx`: el responsable que aparece es otra empresa.
- `AppLayout`, `AuthLayout`, `components/ui` (Button, Card, Field…), `index.css`, `components/sx`, `Logo`, `brand/index.ts`, `DashboardHome` e `index.html`: los reemplaza el diseño de E1-A.

## 5. Riesgos
1. **Versiones:** Realt-In usa React Router 7, Vite 7, TypeScript 5.9 y Vitest 4; dentro va en Router 8, Vite 8, TS 6 y Vitest 5. Se porta pieza por pieza y se prueba en cada paso; no se copia el `package.json`.
2. **Dependencias nuevas:** `@supabase/supabase-js`, `react-hook-form`, `zod`, `@hookform/resolvers` y, para pruebas de base, `embedded-postgres` y `pg` (descargan un PostgreSQL local; no tocan ningún servidor).
3. **Correo transaccional (B4):** las invitaciones y la recuperación dependen de un SMTP propio. El de Supabase no sirve para producción.
4. **Superadmin:** en Realt-In ve perfiles y membresías de todas las empresas. En dentro hay que acotarlo para cumplir «no ve datos clínicos».

## 6. Plan propuesto para E1-B (una tarea = un incremento verificable)
| Paso | Contenido | Toca Supabase |
|---|---|---|
| **E1-B1** | Migración `0001_core_tenancy` adaptada + rollback + suite de aislamiento, probadas en el PostgreSQL desechable (`npm run test:db`) | No |
| **E1-B2** | Auth en el frontend: cliente, `AuthProvider`, guardas y pantallas de acceso con el diseño de dentro. Pruebas con Supabase simulado | No |
| **E1-B3** | `WorkspaceProvider` reemplaza `clinic-config` TEMPORAL; alta de clínica (P04 paso 1) | No (simulado) |
| **E1-B4** | Conectar al proyecto dev `dentro-dentistas-app`: `.env.local` con la clave publishable, aplicar la migración y correr la suite en el SQL Editor | **Sí. Requiere aprobación de Diego** |
| **E1-B5** | Invitaciones (Edge Function), aviso de privacidad y consentimientos, `audit_log` de accesos | Sí. Requiere aprobación y B4 (correo) |

## 7. Decisiones para Diego
| # | Decisión | Recomendación |
|---|---|---|
| D1 | Variable de la clave pública | `VITE_SUPABASE_PUBLISHABLE_KEY` (formato nuevo) en lugar de `VITE_SUPABASE_ANON_KEY` |
| D2 | Tipos de tenant | `independent` (consultorio) y `clinic` (clínica) |
| D3 | Métodos de acceso | Correo + contraseña desde el inicio; código OTP apagado hasta tener SMTP propio |
| D4 | Registro | Abierto para dueños; doctores y recepción solo por invitación |
| D5 | Clínicas que puede crear un usuario | 1 en el MVP (multi-clínica para el mismo dueño, después según el plan) |
| D6 | Nombre de la bitácora | `audit_logs` (como Realt-In, facilita portar) y se corrige `modelo-datos.md` |
| D7 | Pruebas de base local | Usar `embedded-postgres` (dependencia de desarrollo) para probar migraciones sin tocar Supabase |
| D8 | Qué sube al Core | Los cambios de §3 (RPC de escritura, FK compuestas, `(select …)`, roles genéricos) se devuelven a `core-base` para que Realt-In también los tenga |
