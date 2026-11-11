# estado.md — dentro
Última actualización: 2026-11-10 · Por: Diego (con Claude)

## Fase actual
| Fase | Estado |
|---|---|
| V0 Validación | Sin entrevistas aplicadas; scorecard preliminar 3.55 (AJUSTAR). Los cuestionarios son referencia, no requisito (decisión de Diego). |
| V1 Modelo de negocio | Pendiente (pricing y cortes de plan). Supuesto: $399–$800 MXN/mes. |
| V2 Estructura | ✅ **Cerrada el 2026-11-05.** Alcance del MVP congelado. |
| V3 Diseño y demo | ✅ **Cerrada el 2026-11-10** sin validación con prospectos (riesgo aceptado; se valida en paralelo a E0). Demo navegable en el lienzo "dentro — Pantallas clave V3". |
| **E0 Auditoría y planificación** | **En curso** desde el 2026-11-10. Sin código. |

## Última tarea validada
- Cierre de la V2 (`docs/v2-estructura.md`).
- Repositorio creado y documentación inicial subida.

## Siguiente tarea
**E0:** resolver las decisiones de infraestructura (Supabase, hosting, quién ejecuta) y respaldar Realt-In en GitHub para auditarlo y extraer `core-base`. En paralelo: mostrar la demo a 3–5 dentistas y registrar objeciones.

## Bloqueos y pendientes
| # | Pendiente | Bloquea | Responsable |
|---|---|---|---|
| P1 | Respaldar Realt-In en GitHub (repo privado) para extraer `core-base` | E0 | Diego / Lalo (el push lo aprueba Diego) |
| P2 | Empresa propia para facturar suscripciones | C1 | Diego |
| P3 | Iniciar la revisión de la app de Meta (`leads_retrieval`) para M11 | M11 en producción | Lalo |
| P4 | Lógica de Seguimiento Ninja | Fase 2 | Diego |
| P5 | Revisión legal (contrato responsable/encargado, aviso de privacidad) | C1 | Diego |
| P6 | V1: pricing y cortes de plan | C1 | Diego |
| P7 | Entrevistas con dueños de clínicas (referencia) | — | Diego |

## Infraestructura
- Repositorio: `diegocxst/app-dentro` (privado).
- Proyecto de Supabase: **no creado**. Será exclusivo de dentro.
- Hosting y dominio: sin decidir.
