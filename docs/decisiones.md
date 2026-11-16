# Registro de decisiones — dentro

| Fecha | Decisión | Aprobó |
|---|---|---|
| 2026-10-27 | Posicionamiento: CRM de conversión y retención para clínicas dentales | Diego |
| 2026-10-27 | Expediente en 3 niveles; MVP = repositorio documental (Nivel 1) | Diego |
| 2026-10-27 | Segmento de entrada: clínicas de 2–5 doctores; consultorio independiente como plan de entrada | Diego |
| 2026-11-04 | Los cuestionarios de validación no son requisito para programar; se usan como referencia (riesgo aceptado) | Diego |
| 2026-11-04 | MVP = panel de la clínica; app del paciente en Fase 2; directorio de clínicas en Fase 3 | Diego |
| 2026-11-04 | Multi-sucursal en la base de datos desde el MVP; visible según el plan | Diego |
| 2026-11-05 | Jerarquía: organización única (consultorio o clínica según el plan) + usuarios globales para doctores y pacientes | Diego |
| 2026-11-05 | Separación de captación (M11, software) y servicios (M12 "Crece tu clínica", catálogo propio); M12 conserva su nombre | Diego |
| 2026-11-05 | Link de pago por WhatsApp en el MVP; el dinero va directo a la cuenta de la clínica | Diego |
| 2026-11-05 | M8 Seguimientos manual en el MVP; la automatización es requisito para Fase 2 | Diego |
| 2026-11-05 | La base del producto incluye todo `core-base` de Realt-In; se agregan M13 (perfil público de la clínica) y el PDF de presupuestos en M4 | Diego |
| 2026-11-05 | Galería antes/después y tienda de plantillas a Fase 2+ | Diego |
| 2026-11-05 | La facturación será con una empresa propia (por constituir) | Diego |
| 2026-11-05 | Nombre del producto: **dentro**; sistema de diseño "dentro" | Diego |
| 2026-11-05 | **V2 cerrada; alcance del MVP congelado (M1–M13)** | Diego |
| 2026-11-06 | Repositorio `diegocxst/app-dentro` (privado) con la documentación inicial | Diego |
| 2026-11-10 | V3: mapa de pantallas (34) y 4 flujos aprobados; diseño de las 8 pantallas clave aprobado como base (respetar diseño, funciones y secciones) | Diego |
| 2026-11-10 | Personalización por clínica (dentro de M10 + P04): logo, nombre, responsable y color de marca. Se aplican en el encabezado del menú, PDF de presupuestos, link de pago, mensajes y perfil público. La interfaz (botones y estados) conserva los colores de dentro | Diego |
| 2026-11-10 | Menú: logo y nombre de la clínica arriba con la responsable debajo; "Hecho con dentro" abajo | Diego |
| 2026-11-10 | Demo navegable lista (pantalla de inicio "Demo" con 4 recorridos; marcada como datos de ejemplo) | Diego |
| 2026-11-10 | V3 cerrada sin validar la demo con 3–5 prospectos; la validación se hace en paralelo a E0 (riesgo aceptado) | Diego |
| 2026-11-10 | Se omite la demo con prospectos por ahora; se valida durante el desarrollo para terminar lo antes posible | Diego |
| 2026-11-10 | Realt-In ya está respaldado por Lalo; se usa como fuente para auditar `core-base` | Diego |
| 2026-11-10 | Supabase: proyecto `dentro-dentistas-app`, plan gratuito por ahora; plan de pago más adelante | Diego |
| 2026-11-10 | Proyecto Supabase dev confirmado: `dentro-dentistas-app`, ref `iacdtcrzmavbjhgtdchl`. Es el único proyecto válido para dentro en desarrollo | Diego |
| 2026-11-10 | Hosting: Hostinger | Diego |
| 2026-11-10 | Desarrollo: Diego y Lalo; empieza Diego | Diego |
| 2026-11-10 | Dominio: `dentro.mx` (disponible) | Diego |
| 2026-11-10 | Correo transaccional: se define más adelante (antes de cerrar E1) | Diego |
| 2026-11-10 | Se abrirán las cuentas de pago y se iniciará la revisión de la app de Meta | Diego |
| 2026-11-10 | Primer inicio guiado (dentro de P04/P06 y Soporte V1): onboarding de 5 pasos, guía de inicio de 7 tareas en el menú, recorrido de 4 pasos, estados vacíos explicativos y opción de explorar con datos de ejemplo | Diego |
| 2026-11-12 | E1-A: el menú lateral aparece desde 1024 px; en tablet y móvil se usan la barra inferior y el botón flotante "+ Nuevo" | Diego |
| 2026-11-12 | E1-A: "Más" en móvil es una página (`/mas`) con las secciones restantes y la guía de inicio | Diego |
| 2026-11-12 | Tokens derivados aceptados (`on-violet`, `border-strong`, `night-raised`, `night-active`, textos sobre `night`); se proponen al sistema de diseño. En oscuro el texto de botones va en `night` | Diego |
| 2026-11-12 | La etiqueta "automático" usa texto `ink` con punto turquesa, porque `turquoise-text` sobre `turquoise-soft` no llega a AA en claro | Diego |
| 2026-11-12 | Suben a `core-base`: `color.ts` (contraste y validación de `brand_color`), `useDismiss` y los componentes base | Diego |
| 2026-11-12 | Se aceptan las 10 vulnerabilidades moderadas de `npm audit` (solo dependencias de desarrollo, ESLint); se revisan al actualizar dependencias | Diego |
| 2026-11-15 | El superadmin (`platform_admin`) ve clínicas, perfiles y membresías de todas las clínicas; no ve datos clínicos (pacientes, documentos, citas, presupuestos, pagos) | Diego |
| 2026-11-15 | E0-A aprobada: `core-base` = copia depurada de Realt-In (`REALT-IN-BASE-DENTRO.zip`), portada pieza por pieza según `docs/auditoria-core-base.md` | Diego |
| 2026-11-15 | D1: la clave pública de Supabase se llama `VITE_SUPABASE_PUBLISHABLE_KEY` (formato `sb_publishable_…`) | Diego |
| 2026-11-15 | D2: tipos de tenant `independent` (consultorio) y `clinic` (clínica) | Diego |
| 2026-11-15 | D3: acceso con correo y contraseña; el código por correo (OTP) queda apagado hasta tener correo transaccional (B4) | Diego |
| 2026-11-15 | D4: registro abierto para dueños; doctores y recepción solo por invitación | Diego |
| 2026-11-15 | D5: un usuario puede crear 1 clínica en el MVP; más según el plan después | Diego |
| 2026-11-15 | D6: la bitácora se llama `audit_logs` (como Realt-In) | Diego |
| 2026-11-15 | D7: las migraciones se prueban primero en un PostgreSQL local desechable (`embedded-postgres`, dependencia de desarrollo) | Diego |
| 2026-11-15 | D8: las mejoras de seguridad (escrituras por RPC, FK compuestas, `(select …)`, roles genéricos) se devuelven a `core-base` | Diego |
| 2026-11-15 | E0 cerrada; arranca E1-B1 (migración del núcleo probada en PostgreSQL local) | Diego |
| 2026-11-15 | E1-B1: `create_tenant` crea automáticamente la «Sucursal principal» | Diego |
| 2026-11-15 | E1-B1: una membresía sin sucursales asignadas puede trabajar en todas | Diego |
| 2026-11-15 | E1-B1: las sucursales no se borran, se desactivan; siempre queda al menos una activa | Diego |
| 2026-11-15 | E1-B1: el superadmin no edita la identidad de una clínica; solo cambia su estatus, con motivo | Diego |
| 2026-11-15 | E1-B1: cambios de rol, revocar miembros e invitaciones quedan para E1-B5 | Diego |
| 2026-11-15 | E1-B3: en el alta de la clínica el logo se sube después (requiere Storage privado, E1-B5); mientras, se usan las iniciales | Diego |
| 2026-11-15 | E1-B3: WhatsApp de la clínica y Ciudad se agregan a `tenants` en una migración junto con E1-B4 | Diego |
| 2026-11-15 | E1-B3: el alta incluye la elección Clínica / Consultorio (D2) y la dirección del perfil público (`dentro.mx/…`, M13) | Diego |
| 2026-11-15 | E1-B3: sin «Hacerlo después» (la clínica es obligatoria para entrar) ni «Agenda una llamada» por ahora | Diego |
| 2026-11-15 | E1-B3: los pasos 2 a 5 del onboarding solo se muestran; se construyen en E2 | Diego |
| 2026-11-15 | E1-B4 autorizada: migraciones 0001 y 0002 aplicadas en el proyecto dev `dentro-dentistas-app` | Diego |
| 2026-11-15 | El CLI de Supabase vive como dependencia de desarrollo del proyecto (`npx supabase`), no instalado globalmente | Diego |
| 2026-11-15 | Los avisos del asesor de Supabase sobre RPC `SECURITY DEFINER` ejecutables por `authenticated` se aceptan: es el diseño de escrituras por RPC | Diego |
| 2026-11-15 | E1-A a E1-B4 integradas en `main` local (sin push) | Diego |
| 2026-11-15 | Push de `main` a `diegocxst/app-dentro` (E1-A a E1-B4) | Diego |
| 2026-11-15 | E1-B5 se divide en B5a (aviso y consentimientos), B5b (logo en Storage privado) y B5c (invitaciones) | Diego |
| 2026-11-15 | B5a: migración 0003 aplicada en dev; el consentimiento de B5a es solo de las cuentas (el de pacientes llega con M2, por clínica); sin aviso vigente publicado, la app no bloquea el acceso | Diego |
| 2026-11-15 | B5b: migración 0004 aplicada en dev; logo sin SVG (solo PNG, JPG, WebP); cambiar el logo después llega con Configuración (M10) | Diego |
| 2026-11-15 | B5c: migración 0005 aplicada en dev, secreto SITE_URL y Edge Function invite-member desplegada; las invitaciones a cualquier correo esperan el correo transaccional (B4) | Diego |
| 2026-11-15 | E1-B5a a E1-B5c integradas en `main` y push a `diegocxst/app-dentro` | Diego |
| 2026-11-15 | E1 cerrada con B4 (correo transaccional) pendiente; arranca E2, dividida en E2-A, E2-B y E2-C | Diego |
| 2026-11-16 | E2-A: migración 0006 aplicada en dev; sin video, manuales ni WhatsApp de soporte por ahora; «Explorar con datos de ejemplo» se diseña aparte; saludo neutro «Hola, {nombre}» | Diego |
| 2026-11-16 | E2-B: migración 0007 aplicada en dev; duración de cita en minutos o «Varía»; pasos 2, 4 y 5 exigen sillón, tratamiento con precio y WhatsApp; el 3 es opcional; editar identidad llega con Configuración (E3) | Diego |
| 2026-11-16 | E2-A a E2-C integradas en `main` y push a `diegocxst/app-dentro` | Diego |
| 2026-11-16 | E2 cerrada; arranca E3 con M10 Configuración (identidad, horarios, mi perfil) | Diego |
| 2026-11-16 | M10: migración 0008 aplicada en dev; horario en hora local (zona horaria con M3); dirección del perfil público fija hasta M13; cambio de contraseña desde Mi perfil después | Diego |
