# CLAUDE.md — dentro

Reglas para cualquier sesión de Claude o Claude Code en este repositorio.

## Antes de empezar
1. Leer `estado.md` y `docs/decisiones.md`.
2. Revisar `git status`.
3. Identificar la fase actual. **No avanzar de fase sin aprobación explícita de Diego.**

## Flujo de fases
V0 validación → V1 modelo de negocio → V2 estructura → **V3 diseño y demo** → E0–E9 desarrollo → C1 lanzamiento → C2 salida.
- No se escribe código del producto hasta aprobar la V3.
- Un prompt o tarea = un incremento verificable.

## Alcance
- **El alcance del MVP está congelado (2026-11-05):** M1–M13, ver `docs/roadmap.md`. Cambio aprobado el 2026-11-26: entra **M7-B · Historia clínica** (`docs/historia-clinica.md`).
- Una idea nueva va a la lista Fase 2+. Entra antes solo si un piloto la pide o paga por ella, y con aprobación de Diego.
- No cambiar el alcance por iniciativa propia: proponer y esperar confirmación.

## Base técnica (`core-base`)
- dentro se construye sobre `core-base`, extraído de Realt-In.
- **Repositorio y proyecto de Supabase propios.** Nada de Realt-In ni del CRM de Inver360 (datos, claves, ref de Supabase, dominio) se hereda sin confirmación.
- Nunca mezclar datos o contexto de clientes de Inver360 con este producto.
- Desde la primera migración: `tenant_id` + RLS + FK compuestas + escrituras por RPC; helpers de RLS envueltos en `(select …)`; índices por `tenant_id`; tipos regenerados después de cada migración; paginación en servidor; tokens de diseño y mobile first.
- Señalar explícitamente lo que deba subir al Core.

## Datos de salud
- Los datos de pacientes son **sensibles** (LFPDPPP 2025): consentimiento expreso, aviso versionado, ARCO, bitácora de accesos.
- Documentos en Storage privado con URLs firmadas y temporales; retención mínima de 5 años (NOM-004).
- Pagos: nunca custodiar fondos de terceros; el dinero va directo a la clínica (cuentas conectadas).

## Seguridad y operación
- **Nunca** incluir claves, tokens o secretos en código, documentos, commits ni respuestas. `.env` siempre fuera de git.
- Sin migraciones remotas, push, despliegues ni servicios de pago sin aprobación de Diego.
- Flujo de entornos: LOCAL → STAGING → PRODUCCIÓN.

## Cierre de cada tarea
Actualizar `estado.md` (y `docs/decisiones.md` si hubo decisiones) y reportar:
ETAPA / IMPLEMENTADO / VERIFICACIÓN / ARCHIVOS / ESTADO / SIGUIENTE PASO / APROBACIÓN.

## Diseño
- Sistema de diseño "dentro": https://claude.ai/artifact/KVHXFVpN2iCzjCSe5rbfrW
- 100% responsivo. Escritorio: sidebar en `night`. Móvil: barra inferior + botón flotante "+ Nuevo".
- Tono: de tú con la clínica, frases cortas, sin emojis en la interfaz.

## Forma de trabajo (ciclo de cada incremento de E3)
Diego aprueba cada paso con frases cortas; respetar el orden:
1. **Requisitos:** `docs/roadmap.md`, `docs/modelo-datos.md`, `docs/v3-mapa-pantallas.md`, `docs/arquitectura.md` y la maqueta en `docs/diseno/pantallas/*.dc.html` (texto + datos del `<script>`).
2. **Decisiones:** preguntar a Diego (máx. 4 preguntas, la recomendada primero). Si es grande, partirlo en incrementos A/B. Registrar lo decidido en `docs/decisiones.md`.
3. **Rama** `feature/e3-<módulo>` desde `main`.
4. **Base de datos:** migración `supabase/migrations/AAAAMMDDhhmmss_<nombre>.sql` (encabezado con las reglas aprobadas) + `supabase/rollback/<mismo>.down.sql` + suite `supabase/tests/<nombre>_rls_isolation.sql` (6 actores: owner_a, reception_a, doctor_a, doctor2_a, owner_b, super; termina en ROLLBACK). `npm run test:db` y **3 pruebas de mutación** (romper una regla y comprobar que la suite falla; restaurar). Commit.
5. **Tipos provisionales** en `src/lib/database.types.ts` con el aviso `⚠️ PROVISIONAL` hasta aplicar la migración.
6. **Interfaz:** `src/lib/<x>.ts` (reglas puras), `src/data/<x>.ts` (Supabase), páginas en `src/pages/<x>/`; soporte en `src/test/fakeSupabase.ts` (debe imitar los límites del servidor) y pruebas `*.test.tsx`.
7. **Verificación completa:** `npx tsc -b --noEmit`, `npx eslint .`, `npx vitest run` (3 corridas), `npm run test:db`, `npm run build`. Actualizar `estado.md`, commit y reporte con el formato de cierre.
8. Con **«Sí, apruébalo y aplica»:** `npx supabase db push --remote --dry-run --yes` → `npx supabase db push --remote --yes` → las suites en el proyecto real (`npx supabase db query --remote --yes -f <suite>`) → `npx supabase gen types typescript --remote --schema public` (con 2 líneas de encabezado) → `npx supabase db advisors --remote` → revisión visual con `dentro-dev` (`localhost:5173`) y **solo datos ficticios** → **pruebas guiadas para Diego** (pasos numerados: rol, datos ficticios y qué debe ver) y esperar su resultado → commit.
9. Con **«Sí, integra y sube»:** `git merge --ff-only` en `main`, verificación completa en `main`, revisar que no haya secretos en `git diff origin/main..main`, línea en «Integración» de `estado.md`, commit y `git push origin main`.
- Commits en español; terminar con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Convenciones técnicas
- Escrituras **solo por RPC `security definer`** con `set search_path = ''`; `authenticated` solo tiene SELECT con RLS. Errores con `errcode` (P0002 no encontrado, 42501 permiso, 22023 dato inválido, 23P01 traslape, DH001 fuera de horario).
- Permisos por rol con los helpers de `private` (`has_role`, `can_write`, `can_see_patient`, `my_membership`…). El **superadmin no ve datos clínicos**. Doctores: solo sus pacientes.
- Nada se borra en datos de salud o dinero: se **archiva o anula con motivo**. Auditoría (`write_audit`) **sin datos del paciente ni montos**.
- Folios por clínica con un contador en `tenants` (`quote_seq`, `payment_seq`).
- Componentes base en `src/components/ui`; textos en español de México; precios con `money()` de `src/lib/quotes.ts`.

## Trampas conocidas (ya nos pasaron)
- **CLI de Supabase lenta:** correr `db push` y las suites remotas **en segundo plano**; `db query` con varias sentencias en una línea se puede colgar (usar una sola o la app con la sesión de Diego para leer).
- **No usar** un modo «sin backend»: ya se quitó de `.claude/launch.json` porque impedía iniciar sesión. Usar siempre `dentro-dev`.
- Un `CHECK (char_length(x) > 0)` **deja pasar NULL**: usar `coalesce(char_length(btrim(x)), 0) > 0`.
- El generador de tipos marca como `string` los argumentos sin default aunque acepten NULL: castear con un comentario (ver `src/data/quotes.ts`).
- **PDF (`@react-pdf/renderer`):** cargarlo con `import()` dinámico; el pie con `top`, no `bottom`; Helvetica no trae «−» (usar «-»); desactivar la división silábica; el logo WebP se convierte a PNG en el navegador.
- **Lint:** `react-refresh/only-export-components` (hooks y utilidades en archivos aparte), `set-state-in-effect` (actualizar estado en el `.then`), `purity` (`Date.now()` dentro de `useState(() => …)`).
- **Pruebas:** esperar cargas asíncronas (`findBy`/`waitFor`); evitar nombres accesibles duplicados; el fake debe aplicar los mismos límites que la base (p. ej. rangos de 400 días en `list_appointments`).
- **Revisión visual:** no crear datos reales, no descargar archivos al equipo de Diego sin permiso y no tocar sus datos de dev salvo para probar con fichas ficticias.
