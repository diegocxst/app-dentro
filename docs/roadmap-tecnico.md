# Roadmap técnico — dentro
E0 · 2026-11-10 · Estado: PROPUESTO

Objetivo: **terminar el MVP (M1–M13) lo antes posible** y validarlo con dentistas durante el desarrollo. Una tarea = un incremento verificable. Estados: PENDIENTE · EN_PROGRESO · BLOQUEADO · EN_PRUEBAS · COMPLETADO.

| Etapa | Contenido | Criterios de aceptación | Estado |
|---|---|---|---|
| **E0** Auditoría y planificación | Arquitectura, modelo de datos, roadmap; auditoría de Realt-In para `core-base`; confirmar Supabase y Hostinger | Docs aprobados por Diego; inventario de `core-base` con qué se copia, qué se renombra y qué se descarta | EN_PROGRESO |
| **E1** Fundamentos y seguridad | Proyecto Vite + `core-base`; Auth (registro, login, recuperación, invitaciones); `tenants`, `memberships`, roles; RLS y helpers; aviso de privacidad y consentimientos; `audit_log`; identidad de la clínica; Storage privado | Pruebas A/B/C + anónimo: ninguna clínica ve datos de otra; colaborador no ve finanzas; `anon` sin lectura de tablas; lint, typecheck y build limpios | PENDIENTE |
| **E2** Interfaz y estructura | Layout del diseño aprobado (menú con identidad de la clínica, barra, botón "+ Nuevo", barra inferior móvil); onboarding de 5 pasos; guía de inicio; recorrido; estados vacío, carga y error | Coincide con el lienzo V3; funciona en escritorio, tablet y móvil; accesibilidad básica | PENDIENTE |
| **E3** Módulos esenciales (uno por uno) | 1) M10 Configuración · 2) M2 Pacientes + M7 Documentos · 3) M3 Agenda · 4) M1 Leads · 5) M4 Presupuestos + PDF · 6) M5 Pagos (registro) · 7) M6 Doctores y comisiones · 8) M8 Tareas | Cada módulo: base de datos, RPC, interfaz, validaciones, errores, pruebas positivas y negativas; nada con datos simulados | PENDIENTE |
| **E4** Procesos | Lead → paciente; presupuesto → aceptado → en tratamiento; comisiones al registrar pago; recordatorios internos; historial / actividad del paciente | Flujos F1–F4 completos de punta a punta | PENDIENTE |
| **E5** Métricas y administración | M9 Dashboard con indicadores reales; reportes; panel de plataforma (organizaciones, bandeja de M12) | Ningún indicador con datos ficticios | PENDIENTE |
| **E6** Integraciones | M11 Meta Lead Ads + formulario web; link de pago (Mercado Pago / Stripe Connect); M13 perfil público; M12 catálogo; correo transaccional | Webhooks firmados e idempotentes; secretos fuera del repo; pruebas de cada integración | PENDIENTE (requiere la revisión de Meta y las cuentas de pago) |
| **E7** Optimización | Rendimiento, índices, carga diferida, SEO del perfil público, UX móvil | | PENDIENTE |
| **E8** Pruebas integrales | Flujos completos, seguridad entre cuentas, casos negativos, móvil real | | PENDIENTE |
| **E9** Publicación controlada | Staging, plan de pago de Supabase con respaldos, Hostinger, `dentro.mx`, rollback, aprobación explícita | | PENDIENTE |

## Ruta rápida (para salir antes)
- **Primera versión vendible = E1 + E2 + E3 (pasos 1 a 6) + M9 básico.** Con eso una clínica ya puede operar: pacientes, documentos, agenda, leads, presupuestos con PDF y cobros.
- M6, M8, M11, M12 y M13 completan el MVP congelado en las siguientes semanas.
- Validación con dentistas al cerrar cada módulo de E3 (tu cuñada como primera usuaria de prueba).

## Bloqueos y aprobaciones
| # | Bloqueo | Bloquea | Aprueba |
|---|---|---|---|
| B1 | Acceso al código de Realt-In (respaldo de Lalo) para auditar `core-base` | E0 → E1 | Diego / Lalo |
| B2 | Crear `dentro-dentistas-app` en Supabase y compartir URL y ref (nunca claves en el chat ni en el repo) | E1 | Diego |
| B3 | Plan de Hostinger contratado (compartido o con Node / VPS) | Decisión de M13 y E9 | Diego |
| B4 | Correo transaccional | Cierre de E1 (invitaciones y recuperación) | Diego |
| B5 | Revisión de la app de Meta | M11 en E6 | Lalo |
| B6 | Cuentas de Mercado Pago / Stripe y empresa propia | Link de pago en E6 y cobro de suscripciones | Diego |
| — | Migraciones remotas, despliegues, secretos | Siempre | Diego |
