# Historia clínica odontológica de dentro — propuesta
2026-11-26 · Estado: **APROBADA por Diego el 2026-11-26** (cambia el alcance congelado: entra al MVP como M7-B, ver §7 y §8)

Base: formato en Word de Diego (`historia_clinica_odontologica_1_2.docx`, 16 secciones, en blanco) comparado con la **NOM-004-SSA3-2012** (6.1 historia clínica, 6.2 nota de evolución, 5.9–5.10 identificación y firma, 4.2 consentimiento) y la **NOM-013-SSA2-2015** (9.1–9.6 expediente estomatológico). Referencia técnica, no es asesoría legal: requiere revisión profesional antes de C1 (P5).

## 1. Diagnóstico del formato actual

**Qué está bien y se conserva:** identificación, motivo de consulta con semiología del dolor, heredofamiliares, patológicos, no patológicos, farmacológicos y alergias, gineco-obstétricos condicionales, antecedentes odontológicos, signos vitales, exploración extraoral e intraoral, odontograma con nomenclatura FDI, estudios complementarios, diagnóstico y pronóstico, plan de tratamiento, notas de evolución y declaración del paciente.

**Qué falta según la norma:**
| # | Falta | Norma | Cómo lo resolvemos |
|---|---|---|---|
| F1 | Identificación del consultorio (nombre, domicilio) y nombre del odontólogo en el encabezado | NOM-013 9.1 | Automático desde la clínica, la sucursal y el doctor |
| F2 | Interrogatorio por aparatos y sistemas | NOM-004 6.1.1 | Sección nueva, compacta («sin alteraciones» / «con alteración» + nota) |
| F3 | Peso y talla en la exploración física | NOM-004 6.1.2 | Dos campos en signos vitales + IMC calculado |
| F4 | Periodontograma inicial y de seguimiento | NOM-013 9.2.2.8–9 | Versión simplificada en el MVP (§3.13); la completa en Fase 2 (decisión D2) |
| F5 | Diagnóstico con la Clasificación Internacional de Enfermedades | NOM-013 9.2.2.11 | Buscador CIE-10 (capítulo K00–K14 y los más usados) + texto libre |
| F6 | Hora, nombre completo y cédula en cada nota de evolución | NOM-004 5.10 | Fecha y hora automáticas; nombre y cédula del doctor que firma |
| F7 | Medicamentos indicados con dosis, vía y periodicidad | NOM-004 6.2 | Lista estructurada en la nota de evolución |
| F8 | Firma del responsable en la interpretación de estudios | NOM-013 9.2.2.10 | Se registra quién la escribe y se firma con la historia |
| F9 | Responsable o tutor del paciente menor de edad | NOM-004 4.2 | Datos del tutor obligatorios si el paciente es menor |
| F10 | Carta de consentimiento informado por procedimiento (con testigo) | NOM-013 9.6 | Documento aparte, no es la «declaración» del formato (§5) |

**Qué sobra o está duplicado:**
- **Edad:** se calcula de la fecha de nacimiento, no se escribe.
- **Higiene oral:** aparece en §4 y en §10. Queda en §4 (hábitos) y en §10 solo el hallazgo clínico (índice de placa).
- **Complicaciones con anestesia:** aparece en §5 y §7. Queda una sola vez, en alergias y reacciones.
- **Presupuesto presentado / aceptado:** en la app sale del módulo de Presupuestos (M4), no se captura a mano.
- **Leyenda de privacidad en la declaración:** ya se firmó el consentimiento de datos al dar de alta al paciente (M2). La declaración solo dice que la información es verdadera.

## 2. Cómo se organiza en la app

En la **ficha del paciente**, la pestaña nueva **«Historia clínica»** tiene 4 partes:

1. **Antecedentes** (se llena una vez y se actualiza): identificación complementaria, motivo, antecedentes, aparatos y sistemas, gineco-obstétricos y odontológicos.
2. **Exploración inicial:** signos vitales, extraoral, intraoral, odontograma, periodontograma simplificado y estudios.
3. **Diagnóstico y plan:** diagnósticos CIE-10, pronóstico y plan de tratamiento, con el botón **«Crear presupuesto con este plan»** (M4).
4. **Notas de evolución:** una por atención, ligada a la cita (M3).

Encima de la ficha y en la agenda aparece la **barra de alertas médicas**, que sale de los antecedentes: alergias, anticoagulantes, embarazo, hipertensión, diabetes, cardiopatía, coagulopatías y reacción a anestésicos. Es la función que más valor da al doctor en el sillón.

Se guarda **por versiones**: cada actualización de antecedentes crea una versión nueva con quién y cuándo. Nada se borra (retención de 5 años).

## 3. Campos (versión dentro)

Convenciones: **(O)** obligatorio para firmar la historia · *(cond.)* solo se muestra si aplica · las listas «Sí/No» empiezan **sin respuesta**, nunca en «No».

### 3.0 Encabezado (automático)
Clínica (nombre, logo, domicilio de la sucursal), doctor responsable (nombre completo, cédula profesional), paciente (nombre, edad, sexo, n.º de expediente), fecha y hora de elaboración.

### 3.1 Identificación (sale de la ficha, M2; se completan los que falten)
Nombre completo (O), fecha de nacimiento (O) → edad, sexo (O), estado civil, ocupación, teléfono (O), correo, domicilio, contacto y teléfono de emergencia, **CURP** (opcional). *(cond.)* menor de edad: **nombre, parentesco y teléfono del tutor (O)**.

### 3.2 Motivo de consulta y padecimiento actual
- Motivo de consulta (O), texto libre.
- ¿Presenta dolor? Sí/No → *(cond.)* localización (piezas FDI, selección múltiple), intensidad 0–10 (escala), inicio y duración, tipo (punzante, pulsátil, sordo, agudo, irradiado, otro), qué lo desencadena (frío, calor, dulce, masticar, espontáneo, nocturno, otro) y qué lo alivia.

### 3.3 Heredofamiliares
Diabetes, hipertensión, cardiopatías, cáncer, enfermedades hemorrágicas, renales, otro → cada uno con **parentesco**. Opción «Ninguno conocido».

### 3.4 Personales patológicos
Diabetes, hipertensión, cardiopatías, hepática, renal, gastrointestinal, asma, epilepsia, tiroides, coagulación, VIH, hepatitis, cáncer, osteoporosis, autoinmunes, otras (texto). Hospitalizaciones (lista: motivo y fecha), cirugías (lista: cuál y fecha), transfusiones Sí/No.

### 3.5 Personales no patológicos y hábitos
Tabaquismo (Sí/No + cigarros al día), alcohol (Sí/No + frecuencia), otras sustancias (Sí/No + cuál), actividad física (Sí/No), cepillado (veces al día), hilo dental, enjuague. Hábitos parafuncionales: bruxismo, onicofagia, respiración bucal, otros.

### 3.6 Farmacológicos y alergias (alimenta las alertas)
- Medicamentos actuales: lista (nombre, dosis, frecuencia). Atajo **«Toma anticoagulantes o bifosfonatos»**: Sí/No (O).
- Alergias: lista (tipo: medicamento, alimento, material —látex, metales—, otro · a qué · reacción).
- Reacciones adversas o complicaciones con anestésicos locales: Sí/No + cuál (O).

### 3.7 Aparatos y sistemas (nuevo, NOM-004)
Cardiovascular, respiratorio, digestivo, nervioso, endocrino, genitourinario, musculoesquelético, piel, hematológico → «Sin alteraciones» / «Con alteración» + nota. Botón «Todo sin alteraciones».

### 3.8 Gineco-obstétricos *(cond.: sexo femenino y 10 años o más)*
Embarazo Sí/No → semanas de gestación; lactancia Sí/No; FUM.

### 3.9 Antecedentes odontológicos
Última visita, tratamientos previos (extracciones, endodoncias, prótesis, ortodoncia, implantes, otros), experiencias negativas, sensibilidad, sangrado gingival, dolor de ATM.

### 3.10 Signos vitales y somatometría
PA (mmHg), FC (lpm), FR (rpm), temperatura (°C), SpO₂ (%), glucosa capilar si se indica (mg/dL), **peso (kg), talla (cm) → IMC**. Valores fuera de rango marcados en ámbar (umbrales configurables por la clínica; dentro no da indicaciones clínicas).

### 3.11 Exploración extraoral
Simetría facial, perfil (recto, cóncavo, convexo), ganglios, ATM (ruidos, desviación, dolor), apertura bucal (mm), labios, otros hallazgos → cada uno «Normal» / «Alterado» + nota.

### 3.12 Exploración intraoral
Mucosa yugal, lengua, piso de boca, paladar duro y blando, orofaringe, encía, periodonto, saliva, oclusión (clase de Angle I/II/III, mordidas), **índice de placa** (%), hallazgos dentales → «Normal» / «Alterado» + nota.

### 3.13 Odontograma (FDI)
- Dentición **permanente (11–48)**, **temporal (51–85)** o **mixta**.
- Por pieza y por superficie (oclusal/incisal, mesial, distal, vestibular, lingual/palatina): sano, caries, restauración (resina, amalgama, ionómero), sellador, fractura, ausente, extracción indicada, endodoncia, corona, puente, implante, prótesis removible, movilidad.
- Dos capas: **actual** (lo que se encontró) y **plan** (lo que se va a hacer). Al registrar la nota de evolución, lo hecho pasa de «plan» a «actual» y queda la fecha: es el **odontograma de seguimiento** que pide la NOM-013.
- **Periodontograma simplificado (MVP):** por pieza, profundidad de sondaje máxima (mm), sangrado al sondaje y movilidad. El periodontograma completo de 6 puntos queda en Fase 2 (decisión D2).

### 3.14 Estudios complementarios
Periapicales, interproximales, panorámica, tomografía, fotografías, modelos, otros → cada uno **se liga al archivo en Documentos (M7)**. Interpretación (texto) con autor.

### 3.15 Diagnóstico y pronóstico
Diagnóstico principal (O) y secundarios: buscador CIE-10 + texto libre. Pronóstico: favorable, reservado o desfavorable + nota.

### 3.16 Plan de tratamiento
Filas: pieza(s) · diagnóstico · tratamiento (del catálogo de la clínica, M10) · fase (urgencia, básica, restauradora, rehabilitación, mantenimiento) · fecha estimada · estado. Botón **«Crear presupuesto con este plan»**: arma el presupuesto en M4 con precios del catálogo.

### 3.17 Notas de evolución (una por atención)
Fecha y hora (automáticas), cita ligada (M3), doctor (nombre completo y cédula, automáticos), procedimiento realizado (del catálogo) y piezas, evolución clínica, signos vitales (opcional), diagnóstico y pronóstico si cambian, **indicaciones y medicamentos (nombre, dosis, vía, periodicidad)**, próxima cita (abre Nueva cita). **Al firmarse no se edita**: las correcciones van como **adenda** con fecha, hora y autor.

### 3.18 Declaración y firmas
Declaración de veracidad (texto versionado, sin la parte de privacidad) + firma del paciente o tutor + firma del odontólogo con cédula, con fecha y hora. Opciones: **firma en pantalla** (tablet o celular) o **papel escaneado** (M7), igual que el consentimiento de datos.

## 4. Permisos
| Rol | Antecedentes | Exploración, diagnóstico y plan | Notas de evolución |
|---|---|---|---|
| Dueña o dueño, admin | Ver y editar | Ver | Ver |
| Doctor tratante, colaborador, pasante (de sus pacientes) | Ver y editar | Ver y editar | Crear, firmar, adenda |
| Recepción | **Precaptura** (identificación y cuestionario), la valida el doctor | No | No |
| Superadmin | No (datos clínicos) | No | No |
Todo acceso de lectura y escritura queda en la bitácora (sin contenido clínico en `audit_logs`).

**Sugerencia (Fase 2):** que el paciente llene sus antecedentes **antes de la cita** con un enlace (WhatsApp) y el doctor solo valide. Ahorra 10 a 15 minutos de consulta (SUPUESTO, validar con la cuñada de Diego).

## 5. Lo que NO es esta historia clínica
- **Carta de consentimiento informado por procedimiento** (NOM-013 9.6: riesgos, beneficios, alternativas, firma del paciente, del odontólogo y de un testigo). En el MVP: plantillas imprimibles por tratamiento y el escaneo en M7; firma digital en Fase 2 (obs. 10).
- **Notas de interconsulta y referencia** (9.4–9.5) y **hoja de egreso voluntario** (9.7): Fase 2.

## 6. Modelo de datos (borrador)
| Tabla | Para qué |
|---|---|
| `clinical_histories` | Una por paciente y clínica; estado (borrador, firmada), versión vigente |
| `clinical_history_versions` | Contenido de antecedentes y exploración en `jsonb` con `schema_version`; autor, fecha, firma |
| `medical_alerts` | Alertas derivadas (alergia, anticoagulante, embarazo…) para la barra y la agenda |
| `vital_signs` | Toma de signos vitales (en la historia o en una nota) |
| `odontogram_entries` | Pieza FDI, superficie, condición, capa (actual o plan), fecha, nota de evolución que la cambió |
| `perio_entries` | Sondaje máximo, sangrado y movilidad por pieza (simplificado) |
| `diagnoses` | Código CIE-10, descripción, principal o secundario, pronóstico |
| `treatment_plan_items` | Pieza, diagnóstico, tratamiento del catálogo, fase, estado, `quote_item_id` |
| `evolution_notes`, `evolution_note_addenda` | Nota inmutable al firmarse; adendas con autor y hora |
| `signatures` | Firma del paciente o tutor y del doctor (imagen privada en Storage, hash, fecha, hora, IP) |
Reglas: `tenant_id` + RLS + escrituras por RPC; doctor solo sus pacientes; nada se borra; plantilla de la historia versionada para poder agregar campos sin romper las anteriores.

## 7. Alcance y propuesta de incrementos
Hoy el MVP congelado incluye solo **M7 Documentos (Nivel 1)**; la historia estructurada es el punto 7 de **Fase 2+**. Propuesta: **adelantarla** como **M7-B**, porque un dentista no adopta un sistema de su clínica sin historia clínica (SUPUESTO, validar con la cuñada de Diego).

| Incremento | Contenido |
|---|---|
| **HC-A** | Antecedentes completos (§3.1–3.9), alertas médicas en la ficha y la agenda, versiones, precaptura de recepción |
| **HC-B** | Signos vitales, exploración extra e intraoral, estudios ligados a M7, diagnóstico CIE-10, pronóstico, plan de tratamiento → presupuesto, declaración y firmas, PDF imprimible con la identidad de la clínica |
| **HC-C** | Odontograma interactivo (actual y plan) + periodontograma simplificado |
| **HC-D** | Notas de evolución ligadas a la cita, inmutables con adenda, odontograma de seguimiento |

## 8. Decisiones
| # | Decisión | Estado |
|---|---|---|
| D1 | La historia clínica estructurada se adelanta al MVP como **M7-B** (sale del punto 7 de Fase 2+), en 4 incrementos HC-A a HC-D | ✅ Aprobada 2026-11-26 |
| D2 | Periodontograma **simplificado** en el MVP (sondaje máximo, sangrado y movilidad por pieza); el completo de 6 puntos en Fase 2 | ✅ Aprobada 2026-11-26 |
| D3 | Recepción **puede precapturar** identificación y antecedentes; el doctor los valida antes de firmar | ✅ Aprobada 2026-11-26 |
| D4 | **Firma en pantalla** (tablet o celular) con fecha, hora, dispositivo e IP; el papel escaneado sigue como opción. Validar con abogado antes de C1 (P5) | ✅ Aprobada 2026-11-26 |
| D5 | Personalización por clínica (ocultar secciones opcionales, preguntas propias) | Pendiente · propuesta: Fase 2 |
| D6 | Orden: en qué punto del roadmap de E3 entra HC-A | Pendiente · se decide al arrancar |
