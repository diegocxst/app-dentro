# Roadmap — dentro

## MVP (congelado el 2026-11-05; cambio aprobado por Diego el 2026-11-26: entra M7-B)

**Base `core-base`:** auth · multiempresa (`tenant_id`, RLS, RPC) · privacidad LFPDPPP/ARCO a nivel datos de salud · captación pública blindada · layout, tokens y mobile first · paginación en servidor · notificaciones internas · analítica sin cookies · Soporte V1 · feature flags · billing con Stripe (se activa con la empresa propia) · pruebas.

| # | Módulo | Alcance MVP |
|---|---|---|
| M1 | Leads | Kanban, origen y estado |
| M2 | Pacientes | Ficha 360 |
| M3 | Agenda | Por doctor, sillón y sucursal |
| M4 | Presupuestos / planes de tratamiento | Kanban de conversión, catálogo de tratamientos, PDF con la marca de la clínica |
| M5 | Pagos y abonos | Registro manual + link de pago por WhatsApp |
| M6 | Doctores y comisiones | Esquemas de comisión, reportes, horarios |
| M7 | Documentos / expediente Nivel 1 | Repositorio por paciente con bitácora |
| M7-B | Historia clínica estructurada (agregado el 2026-11-26) | Antecedentes y alertas médicas, exploración, diagnóstico CIE-10, plan de tratamiento → presupuesto, odontograma FDI, periodontograma simplificado, notas de evolución y firmas (NOM-004 y NOM-013). Ver `docs/historia-clinica.md`; incrementos HC-A a HC-D |
| M8 | Seguimientos | Tareas y recordatorios manuales (base lista para automatizar) |
| M9 | Dashboard del dueño | Orientado a acción |
| M10 | Configuración | Sucursales, sillones, horarios, tratamientos, usuarios y roles |
| M11 | Captación | Meta Lead Ads + formulario web → M1 |
| M12 | Crece tu clínica | Catálogo propio de servicios + solicitud + estados |
| M13 | Perfil público de la clínica | Mini-sitio + agendar / dejar datos → M1 |

## Fase 2+ (después del MVP, en orden sugerido)
1. Seguimiento Ninja automático + WhatsApp API
2. App del paciente
3. Pagos dentro de la app y firma digital
4. Tienda de productos de la clínica
5. Tienda de plantillas
6. Galería antes/después
7. Lo que queda del expediente estructurado tras M7-B: periodontograma completo de 6 puntos (D2), personalización de la historia por clínica (D5, propuesto), interconsulta y referencia, hoja de egreso voluntario y antecedentes llenados por el paciente antes de la cita
8. Chatbot IA, Google Ads
9. Contratación y pago de servicios en línea; proveedores externos
10. Directorio / marketplace de clínicas
11. Facturación CFDI integrada

> Regla: una idea nueva se anota aquí y se evalúa al terminar el MVP. Entra antes solo si un piloto la pide o paga por ella.
