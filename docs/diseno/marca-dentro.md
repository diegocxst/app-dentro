# dentro

**Tu clínica, por dentro.** dentro es el CRM para clínicas y consultorios dentales en México y Latinoamérica: leads, pacientes, citas, doctores, presupuestos, pagos y seguimientos en una sola app, para que el dueño vea su negocio por dentro y lo haga crecer. Este sistema reúne la marca y las bases visuales de la app.

El manual de identidad completo (10 páginas, exportable a PDF) vive en el lienzo de diseño: https://claude.ai/code/artifact/6f594363-63b1-41d3-8966-5fa5416b36e1 (página “Manual de identidad”).

## Esencia

- **Nombre:** dentro, siempre en minúsculas. Une *dent* (dental) y *dentro* (todo en un solo lugar).
- **Promesa:** que ningún presupuesto se pierda y ningún paciente se olvide.
- **Para quién:** dueños y directores de clínicas pequeñas y medianas (2 a 5 doctores) y dentistas independientes.
- **Pilares:** Claridad (todo a la vista), Control (todo en un lugar, con seguimiento automático), Crecimiento (vender más y retener pacientes).
- **Personalidad:** el colega que sabe de negocio. Amable, claro y seguro. Premium sin ser frío, cercano sin ser infantil.

## Tono de voz

Siempre de **tú** con la clínica. Frases cortas, que digan qué pasó y qué sigue. Con el paciente, un punto más cálido y tranquilizador.

| Sí | No |
| --- | --- |
| “Tienes 4 presupuestos sin seguimiento esta semana. ¿Les escribimos?” | “Existen 4 registros en estado pendiente.” |
| “Listo. Enviamos el link de pago del anticipo a Laura.” | “¡¡Woohoo!! Tu pago se fue volando.” |
| “Tu cita de revisión es el jueves a las 10:00. Si necesitas moverla, aquí lo haces.” | “Recordatorio: cita programada. No responder a este mensaje.” |

Somos claros, seguros, cercanos y orientados a resultados. No somos técnicos, arrogantes, informales de más ni vendedores agresivos. Sin emojis en la interfaz.

## Logotipo

El logotipo es el isotipo + el nombre. Partes: la “d” con un **punto naranja** dentro (el paciente, en el centro de todo), una **sonrisa turquesa** bajo la “d” (el resultado que busca la clínica) y **“tro” en violeta** (el acento de marca). El texto ya está convertido a curvas: usa siempre los archivos del grupo **Logos**, nunca lo reescribas con una tipografía.

- **Versiones:** horizontal (principal), vertical (espacios cuadrados), solo nombre e isotipo. Cada una en color (fondos claros), negativo (fondo `night` u oscuros) y monocromo (una tinta `night`, o blanco sobre fotos).
- **Área de respeto:** alrededor del logo, un espacio igual a X = la altura de la letra “n”.
- **Tamaño mínimo:** horizontal 120 px de ancho (30 mm impreso); vertical 64 px (18 mm); solo nombre 80 px (20 mm); isotipo 16 px (8 mm). Si el horizontal queda por debajo de 120 px, usa el isotipo.
- **No:** deformar, rotar, cambiar colores, poner sobre fondos sin contraste (usa el negativo), agregar sombras o efectos, ni reescribir el nombre con otra letra.

## Isotipo e ícono de app

La “d” blanca con punto `orange` y sonrisa `turquoise` sobre un cuadro `violet-electric` con esquinas al 27% del lado (`radius-icon`). Para App Store y Google Play se entrega en cuadrado completo (`dentro-icono-app`), la tienda aplica su máscara. A 16 px el punto y la sonrisa casi no se leen: es aceptable para favicon.

## Color

Cada acento tiene un trabajo, y la proporción se respeta: neutros 55%, violetas 30%, turquesa 10%, naranja 5%.

- **Violetas = marca.** `night` para el logotipo y el menú lateral; `violet-electric` para el isotipo y superficies grandes; `violet` para botones y links; `lavender` para fondos suaves.
- **Turquesa = lo automático.** Recordatorios, seguimientos, chatbot e IA. `turquoise` en íconos y la sonrisa; `turquoise-text` para texto sobre blanco; `turquoise-logo` para la sonrisa del logotipo en claro.
- **Naranja = crecimiento.** “Crece tu clínica”, badges de “Nuevo”, tratamientos de alto valor y el punto del logo. Nunca de fondo grande.
- **Estados** (`success`, `warning`, `error`, `info` con su `-soft`): separados de la marca. La alerta es ámbar para no confundirse con el naranja; el éxito es verde bosque para no confundirse con el turquesa.

Contraste: sobre `turquoise` y `orange` el texto va siempre en `night`. El texto pequeño usa los tonos `-text`. `violet-electric` no se usa para texto pequeño.

## Tipografía

Tres familias de Google Fonts, cada una con un solo trabajo:

- **Nunito Black** (`logo`): solo el logotipo. No se usa en títulos ni textos.
- **Plus Jakarta Sans** (`display`): títulos, cifras grandes y anuncios. Pesos 600, 700 y 800.
- **Inter** (`sans`): textos, botones, tablas y montos con cifras tabulares. Pesos 400 a 700.

Escala: display 40/48, title 28/36, subtitle 20/28, body 16/24, ui 14/20, label 12/16 en mayúsculas con un poco de espacio entre letras.

## Interfaz

Inspirada en la claridad de los tableros por estados: fondo `surface`, tarjetas `surface-raised` con borde `border` y `radius-lg`, botones con `radius-md`, etiquetas de estado en píldora (`radius-pill`) con fondo `-soft` y texto del color del estado. El menú lateral va en `night`. La interfaz es 100% responsiva: en celular el menú se apila y las tablas se desplazan dentro de su caja.

## Archivos

Grupo **Logos**: SVG de todas las versiones, el ícono de app en SVG y PNG 1024, y el horizontal en PNG. El paquete completo (SVG, PNG, PDF para imprenta y favicon.ico) se entregó como `dentro-logo.zip`.
