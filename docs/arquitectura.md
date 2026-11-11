# Arquitectura — dentro
E0 · 2026-11-10 · Estado: PROPUESTA (se confirma al cerrar E0)

> **Confirmado** = decidido por Diego. **Propuesto** = recomendación pendiente de validar en la auditoría de Realt-In o en E1.

## 1. Stack
| Capa | Tecnología | Estado |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript estricto + Tailwind + React Router + react-hook-form + Zod + lucide | Propuesto (el mismo que Realt-In, para reutilizar `core-base`) |
| Datos en frontend | TanStack Query para caché, reintentos y descarte de respuestas | Propuesto (R10 de Realt-In) |
| Backend | Supabase: Auth (PKCE), Postgres con RLS, Storage, Edge Functions, pg_cron | Confirmado |
| Proyecto Supabase (dev) | `dentro-dentistas-app`, plan gratuito | Confirmado |
| Hosting | Hostinger | Confirmado. Falta confirmar el tipo de plan (ver §8) |
| Dominio | `dentro.mx` (disponible) | Confirmado |
| Repositorio | `diegocxst/app-dentro`, ramas `main` / `staging` / `feature/*` | Confirmado |
| Pruebas | Vitest (UI y reglas) + suites SQL con ROLLBACK + arnés PG17 con usuarios A/B/C | Propuesto (de Realt-In) |
| Errores en producción | Sentry o equivalente | Pendiente |
| Correo transaccional | Pendiente: definir antes de cerrar E1 (el SMTP por defecto de Supabase no sirve para producción) | Pendiente |

## 2. Modelo multiempresa
- **Un proyecto de Supabase por entorno**: `dentro-dentistas-app` (dev); después staging y producción. Nunca compartido con Realt-In ni con el CRM de Inver360.
- Todas las clínicas viven en la misma base, aisladas por **`tenant_id` + RLS**. Usamos `tenant_id`, igual que Realt-In; la adenda dice `organization_id` y se actualizará.
- Toda tabla de negocio: `tenant_id NOT NULL`, **FK compuestas `(tenant_id, id)`** para que no se puedan cruzar filas de dos clínicas, índices que empiezan por `tenant_id`.
- **Escrituras solo por RPC `security definer`**, que validan membresía, rol y que la clínica esté activa. El rol `authenticated` solo tiene SELECT con RLS.
- Helpers de RLS en el esquema `private`, siempre envueltos en `(select …)` (R5 de Realt-In).
- `anon` no lee tablas; solo ejecuta las RPC públicas del perfil (M13) y del formulario de leads (M11).

## 3. Usuarios, roles y jerarquía
```
Plataforma (super admin)
└── tenants (organización: consultorio o clínica; lo define el plan)
    └── branches (sucursales) → chairs (sillones)
auth.users + profiles (cuenta global)
└── memberships (usuario ↔ tenant ↔ rol [↔ sucursales])
```
| Rol | Alcance |
|---|---|
| `owner` | Todo su tenant, finanzas, comisiones, usuarios, identidad |
| `admin` | Igual que owner, sin facturación de la suscripción |
| `reception` | Agenda, leads, pacientes, cobros, documentos; sin comisiones ni finanzas globales |
| `doctor` | Sus pacientes, su agenda, sus presupuestos y notas |
| `doctor_collab` | Igual que doctor + ve solo **sus** comisiones; nada de finanzas generales |
| `platform_admin` | Solo panel de plataforma (catálogo y bandeja de "Crece tu clínica", organizaciones). No ve datos clínicos de los tenants |

- **Doctor colaborador en varias clínicas:** una cuenta y una membresía por tenant. Selector de clínica en la barra superior.
- **Paciente (Fase 2):** en el MVP el paciente es un registro **por tenant** (`patients`). La cuenta global del paciente se agrega después (`patient_accounts` + vínculos por tenant) sin migrar datos clínicos entre clínicas.

## 4. Datos de salud y documentos (M7)
- Bucket **privado** `patient-documents`, ruta `tenant_id/patient_id/uuid.ext`. Nunca público.
- Descarga solo con **URL firmada de corta duración** emitida por RPC/Edge Function que valida permisos.
- **Bitácora de accesos** (`document_access_log`): quién vio, descargó o subió, y cuándo.
- **Borrado bloqueado** durante la retención (5 años desde el último acto, NOM-004); solo "archivar".
- **Consentimiento** expreso registrado por paciente con la versión del aviso de privacidad.
- `audit_log` sin datos personales en claro.
- Plan gratuito: **solo datos ficticios**. Nada de pacientes reales hasta tener un plan de pago con respaldos.

## 5. Personalización por clínica
- Campos en `tenants`: `display_name`, `owner_display_name`, `owner_title`, `logo_path`, `brand_color`.
- `brand_color` se valida (contraste mínimo 4.5:1 con blanco; si no pasa, se oscurece automáticamente).
- Se aplica en: encabezado del menú, PDF de presupuestos, link de pago, mensajes y perfil público. **Botones y estados conservan los tokens de dentro.**

## 6. Pagos (M5)
- MVP: registro manual + **link de pago** (Mercado Pago o Stripe con **cuentas conectadas de cada clínica**). El dinero nunca pasa por nosotros.
- Webhooks verificados por firma, idempotentes, con registro en `audit_log` (E6).
- Comisiones: se generan al **registrar un pago** (sobre lo cobrado), nunca sobre lo presupuestado.

## 7. Integraciones (E6)
- **WhatsApp MVP:** `wa.me` con mensaje prellenado; el usuario envía. Sin API.
- **Meta Lead Ads (M11):** app de Meta con `leads_retrieval`, revisión en curso. Webhook → Edge Function → RPC `submit_lead`.
- Credenciales en Supabase Vault / secretos de Edge Functions; nunca en tablas en claro ni en el repo.

## 8. Hosting en Hostinger: lo que hay que confirmar
- **Plan compartido / web hosting:** solo sirve la SPA estática (build de Vite) con reglas de reescritura a `index.html`. Funciona para el panel.
- **Riesgo M13 (perfil público):** una SPA no da buen SEO por sí sola (R11 de Realt-In: el parche con PHP). Opciones, de menor a mayor esfuerzo:
  1. Páginas públicas pre-renderizadas en el build (sirve si se regeneran al publicar cambios).
  2. Un PHP mínimo que entregue meta-etiquetas por clínica (como Realt-In).
  3. Plan de Hostinger con Node.js / VPS para renderizar en servidor.
- **Decisión pendiente:** qué plan de Hostinger tienen contratado.

## 9. Entornos
LOCAL → STAGING → PRODUCCIÓN. Migraciones versionadas con archivo de rollback. Ningún cambio remoto (migraciones, despliegues, secretos) sin aprobación de Diego.

## 10. Costos de infraestructura (por documentar)
Supabase (gratis en dev; plan de pago antes de datos reales), Hostinger, dominio `dentro.mx`, correo transaccional, Sentry. Se calcula el costo por clínica en V1/C1.
