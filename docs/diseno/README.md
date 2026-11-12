# Diseño de referencia — dentro

Fuente de verdad del diseño aprobado en V3 (2026-11-10). Claude Code debe replicar estas pantallas **respetando diseño, funciones, estructura y secciones**.

| Archivo | Qué es |
|---|---|
| `tokens.json` | Tokens del sistema de diseño "dentro": colores (claro/oscuro), tipografía, espaciado, radios |
| `marca-dentro.md` | Guía de marca: uso del logo, proporción de colores, tono de voz |
| `pantallas/*.dc.html` | Mockups exactos de cada pantalla (HTML con estilos en línea). Son **referencia visual**, no código para copiar tal cual: se reconstruyen como componentes React con los tokens |
| `/public/brand/*.svg` | Logos de dentro (horizontal color, horizontal negativo, isotipo) |

## Mapa de mockups
| Mockup | Pantalla |
|---|---|
| `Menu.dc.html` | Menú lateral (identidad de la clínica arriba, "Hecho con dentro" abajo, guía de inicio) |
| `Barra.dc.html` | Barra superior (búsqueda, sucursal, notificaciones, "+ Nuevo") |
| `Main-Bienvenida.dc.html` | P06 primer inicio: recorrido, guía de 7 tareas, estados vacíos |
| `Onboarding-Identidad.dc.html` | P04 paso 1: identidad de la clínica con vista previa |
| `Onboarding.dc.html` | P04 paso 4: tratamientos y precios |
| `Main.dc.html` | P06 dashboard del dueño |
| `Agenda.dc.html` | P08 agenda por doctor + detalle de cita |
| `Leads.dc.html` | P11 Kanban de leads |
| `Paciente.dc.html` | P15 ficha 360 con pestañas |
| `Presupuestos.dc.html` | P18 Kanban de presupuestos |
| `NuevoPresupuesto.dc.html` | P19 crear presupuesto + vista previa del PDF |
| `Comisiones.dc.html` | P28 comisiones por doctor |
| `Movil-*.dc.html` | Versiones móviles (Mi día, ficha, enviar presupuesto) |
| `Demo.dc.html` | Portada de la demo (no es pantalla del producto) |

## Reglas
- Los datos de los mockups son **ficticios**. En el producto nada se muestra con datos simulados.
- La etiqueta "Demo · datos de ejemplo" de la barra es solo de la demo; no va en el producto.
- Color de la clínica (`brand_color`): solo en identidad (menú, PDF, link de pago, mensajes, perfil público). Botones y estados usan los tokens de dentro.
- Mobile first; en móvil, barra inferior Inicio · Agenda · Pacientes · Leads · Más y botón flotante "+ Nuevo".
