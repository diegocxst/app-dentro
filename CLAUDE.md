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
- **El alcance del MVP está congelado (2026-11-05):** M1–M13, ver `docs/roadmap.md`.
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
