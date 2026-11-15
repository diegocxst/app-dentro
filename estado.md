# estado.md — dentro
Última actualización: 2026-11-15 · Por: Diego (con Claude)

## Fase actual
| Fase | Estado |
|---|---|
| V0 Validación | Sin entrevistas aplicadas; scorecard preliminar 3.55 (AJUSTAR). Los cuestionarios son referencia, no requisito (decisión de Diego). |
| V1 Modelo de negocio | Pendiente (pricing y cortes de plan). Supuesto: $399–$800 MXN/mes. |
| V2 Estructura | ✅ **Cerrada el 2026-11-05.** Alcance del MVP congelado. |
| V3 Diseño y demo | ✅ **Cerrada el 2026-11-10.** Demo navegable en el lienzo "dentro — Pantallas clave V3". Se omite la validación previa con prospectos: se valida durante el desarrollo (riesgo aceptado). |
| **E0 Auditoría y planificación** | **EN_PRUEBAS.** Auditoría de Realt-In (E0-A) entregada el 2026-11-15 en `docs/auditoria-core-base.md`; falta la aprobación de Diego (decisiones D1–D8). |
| **E1-A Estructura y layout** | **EN_PRUEBAS** desde el 2026-11-11; decisiones aprobadas el 2026-11-12, falta revisión en local y merge. Rama local `feature/e1a-estructura` (sin push). Sin Supabase, auth ni base de datos. |

## E0-A — Auditoría de `core-base` (EN_PRUEBAS)
- Fuente: `REALT-IN-BASE-DENTRO.zip` (copia depurada de Realt-In del 2026-11-14), revisada en modo de solo lectura fuera del repo. No se ejecutó nada ni se copió código.
- Sin secretos ni datos de clientes. Quedan restos de marca de Realt-In/AVIOR por quitar al portar.
- Resultado: núcleo multiempresa, auth y pruebas de RLS reutilizables. Brechas contra las reglas de dentro: escrituras directas (no por RPC), sin FK compuestas, roles distintos, sin identidad de clínica, sucursales, invitaciones desde la app ni consentimientos.
- Plan E1-B1 a E1-B5 y decisiones D1–D8 en `docs/auditoria-core-base.md` §6–§7.

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
- **Aprobar la auditoría E0-A** (decisiones D1–D8) para cerrar E0.
- **E1-B1:** migración `0001_core_tenancy` adaptada + rollback + suite de aislamiento, probadas en PostgreSQL local desechable (sin Supabase).
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
