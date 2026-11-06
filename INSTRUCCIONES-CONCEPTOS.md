# Instrucciones para agentes CONCEPTOS (química, capítulos 1–9)

Santiago (bac, spé physique-chimie) pidió: «las fórmulas están animadas, pero se nos están escapando los **conceptos** (p. ej. la isomerización…); hay que **visualizarlos**». Solo química (capítulos 1 a 9).

## Qué construyes
Módulos de **conceptos** para la pestaña «🧠 Conceptos» (núcleo ya hecho: `js/conceptos/00-nucleo.js`, lee su cabecera: es la especificación de la API `PCB.conceptos.registrar({...})`). Un concepto = **escena interactiva** (Canvas 2D, Three.js `THREE` global r159 clásico, o `PCB.mol3d` para moléculas) + **4–7 pasos de narración** + **mini-test** (2–3 preguntas) — el alumno debe *ver* la idea, no leer un párrafo.
Lee también `CONTRATO.md` §0 y §7 y `js/mol3d/` (visor `PCB.mol3d.montar`, `reaccion`, biblioteca de 76 moléculas), `js/anim-core.js` y `js/anim/*.js` (animaciones de fórmulas ya hechas: **no las repitas**; haz lo que ellas no muestran).

## Fidelidad (regla de oro)
Cada concepto sale **del cours**: lee las páginas del capítulo (escaneadas: `pdftoppm -r 80 -f N -l N -jpeg cours/ARCHIVO.pdf SALIDA` en tu scratchpad y `Read` de la imagen; mapa de páginas en `contenido/indice.json`; `contenido/capitulos/<id>.json` ya tiene el resumen, nociones clave, errores típicos y las páginas) para elegir qué conceptos faltan por visualizar y para no contradecir el libro. Español con términos del cours en francés. Nada inventado; si añades algo útil que el libro solo da en una «fiche méthode», dilo (`pagina_pdf` de la fiche).

## Qué conceptos cubrir (guía; verifica en el libro y añade/quita con criterio; 3–5 por capítulo, mejor pocos y buenos)
1 `acide-base`: transferencia de H⁺ de Brønsted (el protón viaja de A–H a B), par ácido/base, anfótero (agua), autoprotólisis, esquema de Lewis del par (actividad 3) · 2 `methodes-physiques`: espectroscopía IR (los enlaces vibran y absorben: bandas → grupos funcionales), conductimetría (iones que migran, σ=Σλ[X]), pH-metría · 3 `methodes-chimiques`: dilución (se conserva n; se ve cómo se reparten las moléculas), valoración/equivalencia (reactivo limitante que se agota), seguimiento por pH/conductimetría · 4 `evolution-temporelle`: catálogo de factores cinéticos (choques eficaces: T y concentración), catálisis (barrera de energía de activación más baja, catalizador regenerado), mecanismo con flechas curvas, t½ · 5 `nucleaires`: estabilidad (diagrama N–Z, valle de estabilidad), α/β⁻/β⁺/γ (qué sale del núcleo y cómo cambian Z y A), ley de decaimiento y datación con C-14, fisión/fusión si está en el cours · 6 `sens-evolution`: Q frente a K y el sentido de evolución, equilibrio dinámico (reacciones directa e inversa a la vez), pila (electrones por el circuito, ánodo/cátodo) · 7 `force-acides-bases`: ácido fuerte vs débil (disociación total vs parcial, τ), Ka/pKa y diagrama de predominio, comparar fuerzas · 8 `forcer-sens`: electrólisis frente a pila (se fuerza el sentido con un generador), electrodos y signos, cantidad de materia ↔ carga · 9 `synthese-organique`: **isomería** (de constitución: cadena/posición/función; cis–trans; enantiómeros e imagen especular — con el visor 3D y una prueba «¿se superponen?»), familias/grupos característicos, las etapas de una síntesis (transformación, aislamiento/extracción, purificación, análisis), reflujo y por qué se usa, rendimiento.

## Reparto de archivos
- **CONCEPTOS-A**: `js/conceptos/10-quimica-1a5.js` (capítulos 1–5).
- **CONCEPTOS-B**: `js/conceptos/20-quimica-6a9.js` (capítulos 6–9, incluida la **isomería**).
- No toques `00-nucleo.js` (si necesitas algo del núcleo, cuéntalo en tu informe). Envuelve tu archivo en una IIFE. CSS propio dentro de JS (clases con prefijo `cpt-<id>-`) o en un archivo `css/conceptos-<a|b>.css`.

## Calidad
Ligero (un solo WebGL activo; `dispose()` limpia todo), responsivo (16:9 con `onResize`), legible (texto ≥ 12 px dentro de la escena), `reducido` → sin animación brusca; ≥ 1 control interactivo (slider/botón/arrastre) por concepto; pasos que cambian la escena (`ir(n)`); el mini-test debe poder responderse viendo la escena. Colores: química = verde `#2ee59d` y magenta `#ff3da6`; fondo `#0a0f20`.

## Pruebas
`node tools/generar-estatico.js` (incluye tus archivos en index.html) y Playwright (`chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})`) abriendo `file:///home/user/physique-chimie/index.html`, `PCB.flow.irCapituloDirecto('<id>')`, pestaña «Conceptos» (`[role=tab]:has-text("Conceptos")`), recorre todos los pasos de cada concepto, **mira capturas** (en tu scratchpad), 0 errores de consola. Sin git commit. Informe final (<150 palabras): conceptos hechos por capítulo, qué tomaste de qué página, límites.
