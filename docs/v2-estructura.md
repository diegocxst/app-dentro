# dentro — V2 Estructura del producto (CERRADA)
Cierre: 2026-11-05 · Aprobó: Diego · Siguiente fase: V3 (diseño y demo)

**dentro** es un CRM SaaS para clínicas y consultorios dentales en México: leads, pacientes, citas, doctores, presupuestos, pagos, documentos y seguimientos en una sola app, enfocado en el dueño y la administración interna. Se vende solo y en combo con servicios de marketing. Precio pensado: $399–$800 MXN/mes, solo la app (SUPUESTO, se valida en V1).

> **Alcance del MVP congelado desde el 2026-11-05.** Una idea nueva va a la lista Fase 2+; entra antes solo si un piloto la pide o paga por ella. Los módulos de Fase 2+ se agregan después del MVP (v1.1, v1.2…), según los tiempos.

---

## 1. Estado de validación
- V0 sin entrevistas aplicadas. Scorecard preliminar: 3.55 (AJUSTAR).
- Decisión de Diego: los cuestionarios **no son requisito para programar**; se usan como referencia. Riesgo aceptado y registrado.
- Cuestionario listo: doc "Cuestionario de Validación — Clínicas Dentales" (dueños + versión corta para doctor colaborador).
- V1 (pricing / unit economics) queda pendiente.

## 2. Segmento
- Entrada: clínicas con **2–5 doctores** (incluye doctores colaboradores).
- Plan de entrada: dentista o consultorio independiente.
- El corte exacto entre planes se define en V1.

## 3. Jerarquía (aprobada)
```
Plataforma (super admin · nosotros)
├── Organizaciones ← quien paga la suscripción
│   ├── Tipo: Consultorio independiente | Clínica (lo define el plan, mismo modelo de datos)
│   └── Sucursales → sillones, horarios, equipo
└── Usuarios globales ← una cuenta vinculada a N organizaciones
    ├── Profesionales: un doctor colaborador ve sus agendas y comisiones de cada clínica con una sola cuenta
    └── Pacientes: una cuenta; cada clínica solo ve su relación con el paciente
```
- Multi-sucursal desde el MVP en la base de datos; visible según el plan.
- Clínica y consultorio independiente NO son modelos distintos.

## 4. Roles
| Rol | Ve | Puede |
|---|---|---|
| Dueño / Admin | Todo de su organización | Configurar, finanzas, comisiones, usuarios |
| Recepción | Agenda, leads, pacientes, pagos | Agendar, cobrar, dar seguimiento, subir documentos |
| Doctor fijo | Sus pacientes y agenda | Notas, documentos, presupuestos |
| Doctor colaborador | Solo sus pacientes, agenda y comisiones | Igual que el fijo, sin finanzas generales |
| Paciente (Fase 2) | Su información en cada clínica | Citas, pagos, documentos liberados, subir los suyos |

Pendiente para validar: ¿de quién es el paciente cuando un colaborador deja la clínica? Supuesto: de la organización.

## 5. Ciclo de vida del paciente
**Lead → Valoración → Presupuesto → Aceptado (anticipo) → En tratamiento (citas + abonos) → Terminado → Recall**, con venta de productos en cualquier momento (Fase 2).

## 6. Base heredada de Realt-In (`core-base`)
Auth (login, registro, recuperación, OTP) · multiempresa con `tenant_id` + RLS + FK compuestas + escrituras por RPC · privacidad LFPDPPP (aviso versionado, consentimiento, ARCO) **a nivel datos de salud** · captación pública blindada (honeypot, throttle, idempotencia) · layout (sidebar + topbar + botón flotante), tokens, mobile first · paginación en servidor y búsqueda sin acentos · notificaciones internas · analítica sin cookies · Soporte V1 · feature flags · billing con Stripe (se activa con la empresa propia) · pruebas (arnés PG17, usuarios A/B/C).

Reglas: el código se reutiliza; **repositorio y proyecto de Supabase separados**. Nada de Realt-In (datos, claves, ref de Supabase, dominio) se hereda.

## 7. MVP congelado (panel de la clínica)
| # | Módulo | Alcance MVP |
|---|---|---|
| M1 | Leads | Kanban, origen y estado |
| M2 | Pacientes | Ficha 360: datos, citas, presupuestos, pagos, documentos |
| M3 | Agenda | Por doctor, sillón y sucursal; estados de cita |
| M4 | Presupuestos / planes de tratamiento | Kanban de conversión, catálogo de tratamientos y **PDF con la marca de la clínica** |
| M5 | Pagos y abonos | Registro manual + **link de pago por WhatsApp** (Stripe Connect / Mercado Pago; el dinero va directo a la clínica) |
| M6 | Doctores y comisiones | Esquemas (% de lo cobrado, renta de sillón, fijo por procedimiento), reporte por doctor, horarios |
| M7 | Documentos / expediente Nivel 1 | Repositorio por paciente (radiografías, recetas, consentimientos), Storage privado, URLs firmadas, bitácora de accesos, retención mínima de 5 años |
| M8 | Seguimientos | Tareas y recordatorios **manuales**; la base de datos se diseña para automatizar después (requisito) |
| M9 | Dashboard del dueño | Orientado a acción: conversión, no-shows, ingresos por doctor, cartera |
| M10 | Configuración | Sucursales, sillones, horarios, tratamientos, usuarios y roles |
| M11 | Captación | Meta Lead Ads + formulario web → M1 |
| M12 | Crece tu clínica | Catálogo propio de servicios de marketing + solicitud + estados |
| M13 | Perfil público de la clínica | Mini-sitio: tratamientos, doctores, sucursales, ubicación, agendar / dejar datos → M1 |

### Separación captación vs. servicios (aprobada)
- **M11 (software):** en Configuración → Integraciones. Incluido en la suscripción o como add-on.
- **M12 (servicios):** sección propia en el menú. El catálogo es **global** (lo administra la plataforma); las solicitudes pertenecen a la clínica (`tenant_id`) y llegan a la bandeja de plataforma. Estados: Recibida → Cotizada → En producción → Entregada. La cotización, la producción y el cobro van por fuera del sistema en el MVP. Detrás de un feature flag.

## 8. Roadmap Fase 2+ (orden sugerido)
1. Seguimiento Ninja automático + WhatsApp API (falta compartir la lógica de Inver360)
2. App del paciente (citas, presupuestos, pagos, documentos, seguimiento de tratamiento)
3. Pagos dentro de la app y firma digital
4. Tienda de productos de la clínica (solo recolección en clínica)
5. Tienda de plantillas (por analizar)
6. Galería antes/después (requiere consentimiento expreso)
7. Expediente estructurado NOM-013 (Nivel 2) + revisión legal
8. Chatbot IA, Google Ads
9. Contratación y pago de servicios en línea; proveedores externos
10. Directorio / marketplace de clínicas
11. Facturación CFDI integrada

## 9. Marco regulatorio (referencia, no es asesoría legal)
- NOM-004-SSA3-2012 (expediente; conservación ≥ 5 años desde el último acto médico; propiedad del prestador).
- NOM-013-SSA2-2015 (el expediente odontológico se estructura conforme a esta norma).
- NOM-024-SSA3-2012 (sistemas de registro electrónico). Hay zona gris para el sector privado.
- LFPDPPP 2025: datos de salud = sensibles → consentimiento expreso y por escrito.
- Contrato: la clínica es **responsable** de los datos; nosotros, **encargado**. Requiere revisión de un abogado en salud antes de C1.
- Pagos: nunca custodiar fondos de terceros (cuentas conectadas).

## 10. Diseño (para V3)
- Sistema de diseño **"dentro"** (artifact): https://claude.ai/artifact/KVHXFVpN2iCzjCSe5rbfrW
- Social UX = estándar de experiencia: mobile first, 100% responsivo, poca fricción, estados claros.
- Escritorio: sidebar en `night`. Móvil: barra inferior (Agenda, Pacientes, Leads, Cobros, Más) + botón flotante "+ Nuevo".
- Cuidar que los neutros dominen (55%) para una sensación limpia y clínica.
- No prometer "seguimiento automático" en la venta hasta la Fase 2.

## 11. Bloqueos y pendientes
Ver [`../estado.md`](../estado.md).

## 12. Registro de decisiones
Ver [`decisiones.md`](decisiones.md).

## 13. Traspaso para Lalo
dentro es un CRM SaaS dental construido sobre `core-base` (extraído de Realt-In) con un repositorio y un proyecto de Supabase nuevos. La V2 está cerrada: 13 módulos de MVP (sección 7) con el alcance congelado. Lo primero técnico es respaldar Realt-In en GitHub (P1) y arrancar la revisión de la app de Meta (P3). Siguiente fase: V3, diseño y demo navegable con el sistema de diseño "dentro". No se escribe código del producto hasta aprobar la V3.
