# Modelo de datos — dentro
E0 · 2026-11-10 · Estado: BORRADOR (se ajusta con la auditoría de `core-base`)

Convenciones: `id uuid`, `tenant_id uuid NOT NULL` en toda tabla de negocio, `created_at` / `updated_at`, `created_by`. FK compuestas `(tenant_id, …)`. RLS activo en todas. Escrituras por RPC.

## Core (de `core-base`)
| Tabla | Para qué | Notas |
|---|---|---|
| `tenants` | La clínica o consultorio que paga | plan, tipo (`independiente` / `clinica`), estado, identidad (`display_name`, `owner_display_name`, `owner_title`, `logo_path`, `brand_color`), `onboarding_state` |
| `profiles` | Datos de la cuenta global | 1:1 con `auth.users` |
| `memberships` | Usuario ↔ tenant ↔ rol | rol (§3 de arquitectura), estado, sucursales permitidas |
| `invitations` | Invitar doctores y recepción | token de un solo uso, expira |
| `plans`, `subscriptions` | Billing (se activa con la empresa propia) | estados `trial` / `active` / `past_due` / `canceled` |
| `feature_flags`, `tenant_features` | Encender funciones por plan o por clínica | Fase 2+ apagada por defecto |
| `privacy_notices`, `consents` | Aviso versionado y consentimiento | consentimiento por paciente (datos de salud) |
| `audit_log` | Operaciones críticas | sin datos personales en claro |
| `notifications` | Notificaciones internas | |
| `onboarding_tasks` | Guía de inicio (7 tareas) | estado por tenant |

## Operación de la clínica
| Tabla | Módulo | Campos clave |
|---|---|---|
| `branches` | M10 | nombre, dirección, horario |
| `chairs` | M10 | `branch_id`, nombre |
| `doctor_settings` | M6 / M10 | `membership_id`, especialidad, color en agenda, horario |
| `treatments` | M10 / M4 | categoría, nombre, precio MXN, duración, activo |

## Pacientes y leads
| Tabla | Módulo | Campos clave |
|---|---|---|
| `leads` | M1 | nombre, teléfono, correo, interés, `source` (meta / perfil / referido / whatsapp / manual), `status` (nuevo / contactado / valoración / convertido / perdido), motivo de pérdida, `assigned_to`, `converted_patient_id`, `first_response_at` |
| `patients` | M2 | nombre, fecha de nacimiento, teléfono, correo, origen, `primary_doctor_id`, etiquetas, `consent_id`, archivado |
| `patient_notes` | M2 | autor, texto |
| `documents` | M7 | `patient_id`, tipo (rx / foto / receta / consentimiento / presupuesto / formulario / modelo), `storage_path`, tamaño, `uploaded_by`, `retain_until` |
| `document_access_log` | M7 | `document_id`, usuario, acción (ver / descargar / subir / archivar), fecha |

## Agenda
| Tabla | Módulo | Campos clave |
|---|---|---|
| `appointments` | M3 | `branch_id`, `chair_id`, `doctor_id`, `patient_id` o `lead_id`, inicio, fin, tipo (valoración / tratamiento / revisión), `status` (programada / confirmada / llegó / no asistió / cancelada / reagendada), notas |

Restricción: no se traslapan citas del mismo sillón o del mismo doctor (constraint de exclusión con `tstzrange`).

## Presupuestos, pagos y comisiones
| Tabla | Módulo | Campos clave |
|---|---|---|
| `quotes` | M4 | folio por tenant, `patient_id`, `doctor_id`, `status` (borrador / presentado / en duda / aceptado / en tratamiento / terminado / perdido), total, vigencia, motivo de pérdida, `sent_at`, `last_followup_at` |
| `quote_items` | M4 | `treatment_id`, concepto, cantidad, precio, descuento |
| `payment_plans` | M4 / M5 | `quote_id`, anticipo, número de mensualidades, monto, fecha de inicio |
| `payments` | M5 | `patient_id`, `quote_id`, `doctor_id` (a quién se atribuye), monto, método, `paid_at`, `payment_link_id`, registrado por |
| `payment_links` | M5 / E6 | proveedor, id externo, monto, estado, expiración |
| `commission_schemes` | M6 | `membership_id`, tipo (`percent_collected` / `chair_rent` / `fixed_per_procedure`), valor, vigencia |
| `commission_entries` | M6 | `payment_id`, `doctor_id`, base, monto, periodo, estado (por pagar / pagada) |

## Seguimientos
| Tabla | Módulo | Campos clave |
|---|---|---|
| `tasks` | M8 | entidad relacionada (lead / paciente / presupuesto / cita), título, `due_at`, `assigned_to`, `status`, `origin` (`manual` en el MVP; `auto` en Fase 2) |

## Marketing y presencia
| Tabla | Módulo | Campos clave |
|---|---|---|
| `integrations` | M11 | tipo (meta / formulario), estado, referencia al secreto en Vault (nunca el token) |
| `public_profiles` | M13 | `slug` único global, publicado, secciones visibles, SEO |
| `service_catalog` | M12 | **global (plataforma)**: servicio, descripción, desde-precio, activo |
| `service_requests` | M12 | `tenant_id`, `service_id`, mensaje, `status` (recibida / cotizada / en producción / entregada) |

## Reglas de negocio clave
1. Una comisión solo nace de un `payment` registrado.
2. Un `quote` pasa a `aceptado` cuando se registra el pago del anticipo (o manualmente, con permiso).
3. Convertir un lead crea el `patient` y conserva `lead.converted_patient_id`.
4. Los documentos no se borran durante la retención; se archivan.
5. `doctor_collab` solo lee filas donde es el doctor asignado, más sus `commission_entries`.

## Pendiente de la auditoría
- Qué tablas y RPC de Realt-In se reutilizan tal cual y cuáles se renombran a genéricos.
