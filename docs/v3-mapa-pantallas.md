# dentro — V3 Mapa de pantallas y flujos
Aprobado: 2026-11-10 · Aprobó: Diego

Diseño de las 8 pantallas clave (escritorio) + 3 de móvil: lienzo "dentro — Pantallas clave V3" (https://claude.ai/artifact/L5UjFfyKV4nzWER6ymjWY7), con el sistema de diseño "dentro". Datos de una clínica ficticia ("Clínica Dental Sonríe", 3 doctores, 2 sillones).

## Navegación
- **Escritorio:** sidebar en `night` con Inicio · Agenda · Leads · Pacientes · Presupuestos · Cobros · Seguimientos · Doctores · Crece tu clínica · Configuración.
- **Barra superior:** búsqueda global · selector de sucursal · notificaciones · botón "+ Nuevo".
- **Móvil:** barra inferior Inicio · Agenda · Pacientes · Leads · Más + botón flotante "+ Nuevo".

## Pantallas del MVP (34)
| Área | Pantallas |
|---|---|
| Acceso y alta | P01 Login · P02 Registro · P03 Recuperar contraseña · **P04 Onboarding** · P05 Aceptar invitación |
| Inicio | **P06 Dashboard del dueño** · P07 Mi día (doctor y recepción) |
| Agenda | **P08 Agenda** · P09 Nueva / editar cita · P10 Detalle de cita |
| Leads | **P11 Kanban de leads** · P12 Detalle del lead · P13 Convertir a paciente |
| Pacientes | P14 Lista · **P15 Ficha 360** · P16 Nuevo paciente + consentimiento · P17 Visor de documentos |
| Presupuestos | **P18 Kanban** · **P19 Crear presupuesto** · P20 PDF / enviar por WhatsApp |
| Cobros | P21 Cobros y saldos · P22 Registrar pago · P23 Link de pago |
| Seguimientos | P24 Tareas · P25 Nueva tarea |
| Doctores | P26 Lista · P27 Perfil del doctor · **P28 Comisiones** |
| Crece tu clínica | P29 Catálogo · P30 Mis solicitudes |
| Configuración | P31 Clínica y sucursales · P32 Tratamientos y precios · P33 Usuarios y roles · P34 Integraciones y perfil público |
| Público (M13) | Perfil público + formulario "Agenda tu valoración" |
| Plataforma | Bandeja de solicitudes · Organizaciones |

**En negritas:** las 8 diseñadas en esta ronda. Móvil: Mi día, Ficha del paciente y Enviar presupuesto (P20).

## Flujos principales
1. **F1 Lead → cita:** Meta / perfil público → Kanban de leads → WhatsApp → valoración agendada → paciente.
2. **F2 Presupuesto → anticipo:** valoración → presupuesto con catálogo → PDF con la marca de la clínica → WhatsApp con link de pago → tarea si no responde → aceptado.
3. **F3 Día en recepción:** Mi día → confirmar → llegó / no asistió → registrar abono → tareas.
4. **F4 Dueño:** dashboard → presupuestos sin seguimiento → tareas → comisiones del periodo.

## Decisiones de diseño
- La Ficha 360 es el centro: se llega en un clic desde agenda, leads, presupuestos y cobros.
- Onboarding de 5 pasos con datos de ejemplo precargados (meta: menos de 10 minutos).
- Las comisiones se calculan sobre lo cobrado, no sobre lo presupuestado.
- El envío por WhatsApp abre la app con el mensaje listo (`wa.me`); el usuario lo envía. Nada se automatiza en el MVP.
- El pago llega directo a la cuenta de la clínica; dentro solo genera el link.
