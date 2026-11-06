# Super Claude Bros · Physique-Chimie BAC

App **100 % local y offline** para estudiar tu manual de physique-chimie Tle (Bordas): un mapa 3D de mundos, un nivel de plataformas por capítulo, una intro animada y el capítulo para estudiar con **fórmulas animadas**.

Sin API, sin claves, sin cuentas: todo el contenido ya está generado dentro de `contenido/`.

## Cómo abrirla

**Lo más fácil (sin instalar nada): doble clic en `index.html`.** Se abre en tu navegador (mejor Chrome, Edge o Firefox) y funciona offline. Tu progreso (XP, estrellas, racha…) se guarda en el propio navegador; usa **Exportar / Importar** en el panel del mapa para hacer respaldo o pasarlo a otro equipo.

*Opcional — con servidor local:* si prefieres guardar el progreso en un archivo (`data/progreso.json`), instala **Node.js** (botón LTS en https://nodejs.org) y abre `iniciar.bat` (Windows) o `iniciar.command` (Mac; la primera vez clic derecho → Abrir). Se abre `http://127.0.0.1:3000`.

*En internet (GitHub Pages):* la carpeta `docs/` es lo que se publica (la app y el contenido empaquetado, **sin los PDF del manual**). Una vez activado Pages, queda en https://ismaelhuamani256-cmyk.github.io/physique-chimie/ . En Pages el progreso se guarda en el navegador de cada dispositivo (usa Exportar/Importar para moverlo).

*Si cambias algo en `contenido/`, `js/` o `css/`:* ejecuta `node tools/generar-estatico.js`; regenera `index.html`, `contenido/bundle.js` y la carpeta `docs/`.

## El ciclo

```
Mapa 3D ─▶ eliges capítulo ─▶ NIVEL de plataformas ─▶ (ganar o morir) ─▶ INTRO animada ─▶ CAPÍTULO
```
- **Saltar juego → capítulo** está siempre en la barra superior (y **Saltar intro**).
- Ganar da XP extra y una pista gratis en el quiz. Morir no bloquea nada.
- Controles del juego: flechas / WASD, Espacio o ↑ para saltar, P pausa. Hay botones táctiles.
- **🎮 Quiz Quest** (botón en la pestaña Quiz de cada capítulo): aventura de 3 fases (tierra, agua, castillo) donde bloques ?, tuberías, puertas y jefes solo se abren si respondes bien; hay ladrillos, plataformas que caen y plantas carnívoras.
- **🧬 Moléculas 3D**: pestaña en los capítulos de química (bolas y varillas CPK, geometría VSEPR, reacciones animadas) y constructor 3D dentro del juego (estaciones de moléculas).
- **Ítems**: botas de Hooke, imán, mochila propulsora, cañón de fotones y reserva de 3 casillas (Q). Jefes de física moderna: Isótopo Inestable, Fotón Veloz y Bombardero Neutrón.
- **Power-ups**: flor de plasma 🔥 (bolas rebotantes), escopeta de iones (10 balas), núcleo expansivo (grande, aguanta un golpe) y **Shift = correr**.
- **Jefes de disparo**: el **Rey Bomba** (bombas con mecha, coraza que se rompe a tiros y luego pisotón + pregunta) en 4 capítulos.
- **Cuevas submarinas** (Quiz Quest, fase de agua): techo rocoso, pirañas que persiguen, tiburón gigante, langostas con cavitación, submarinos, peces globo, magos y minas.
- **🧠 Conceptos (química 1–9)**: visualizaciones de ideas (transferencia de H⁺, isomería, equilibrio, pila, catálisis, datación C-14…) con mini-test; lo que no es del cours está marcado.
- **Lagos de lava** (parkour + magma), **gigantes y alados**, **espectros tímidos**, **Maestro Calavera**, doble salto y gravedad lunar.
- **20 niveles extra** (uno por capítulo, se encadenan al ganar): montañas, granja con OVNI, fundición con mecánicos, laberintos de llaves y circuitos ON/OFF.
- **Niveles `--3` por bioma** con matraces, gas, murciélagos, ácido, cristales, nubes, tormentas, asteroides, hielo, yunques, vapor, cadenas, tornados, espantapájaros, fantasmas, tablones y espejos; jefes Pozo Gravitatorio y Yeti Criogénico.
- **Nivel 4 parkour extremo** y **Nivel 5 batalla final** (jefe perseguidor + bombardeos) en cada capítulo.
- **Torres verticales**: champ-gravitation, images y evolution-temporelle se suben en zigzag hasta el jefe.
- **Fortalezas** (castillo de lava + jefe «Rey Entropía», que se derrota respondiendo preguntas del cours): capítulos 1, 10, 15, 17 y 20.

## Fórmulas animadas

En la pestaña **Fórmulas** de cada capítulo, pulsa una fórmula (o «Ver la animación») y se abre una animación: por ejemplo la concentración muestra un vaso con líquido y moléculas disueltas; los sliders cambian n y V y la fórmula se actualiza con los valores en vivo. La pestaña **Lab** reúne los simuladores del capítulo.
Hay 31 animaciones específicas (química y física) y una gráfica genérica para las fórmulas sin dibujo posible.

## Contenido y fidelidad

- Los 20 capítulos salen **solo de tu libro** (`cours/*.pdf`, escaneados). Cada dato lleva su `pagina_pdf` (página del PDF = página impresa + 18).
- Lo que no estaba en el libro está marcado **«no está en el cours»**; los resultados que no traían corrigé y se calcularon con las fórmulas del libro están marcados como *cálculo propio*.
- Los agentes detectaron **erratas del libro** (enunciado y corrigé que no cuadran); esos ejercicios se omitieron del quiz o se dejaron sin respuesta numérica para que el corrector no te dé por mala una respuesta buena.
- La corrección numérica la hace el código (valor con tolerancia, cifras significativas y unidades), no una IA.

## Estructura

```
index.html (la app, doble clic) · server.js + iniciar.* (opcionales) · tools/generar-estatico.js
css/   js/   (js/mapa.js, js/juego/, js/intro/, js/estudio/, js/anim/, js/anim-core.js, js/core.js)
contenido/  indice.json · capitulos/ · niveles/ · intros/ · quizzes/
lib/   three, katex y fuentes en local
cours/ tus PDF
CONTRATO.md · INSTRUCCIONES-CONTENIDO.md   (cómo está pensado y cómo se generó el contenido)
```
Comprobar un nivel: `node js/juego/validador.js contenido/niveles/<capitulo>.json`.

## Originalidad

El protagonista (**Ato**, robot-científico con un átomo orbitando), los sprites, la música (chiptune generado con WebAudio), los niveles y el jefe son originales; no se copia ningún personaje ni sonido de otras franquicias.

## 🛡 Modo Invasión (repaso espaciado como tower defense)

Botón **🛡 Invasión** en la barra superior. Flujo: **preparación** (40 problemas del cours: 16 fáciles · 16 medios · 8 difíciles; pagan ⚛ 10/20/35, +10 % por cada 3 aciertos seguidos, bonus por tiempo hasta 100 ⚛, máx. 760) → **defensa** (5 oleadas con torres láser, escudo ácido/base, bobina, campo magnético, radar y cañón de gas; ×2 de velocidad; con ≥ 3 capítulos hay 2 caminos, enemigos ×1,4 y pago +15 %) → **resultado** con cajas de Leitner (1·3·7·14·30 días; 60 % aciertos + 40 % salud de la base: ≥ 85 % y base ≥ 70 % sube caja, < 60 % baja 2).
Las torres no persisten; las **tecnologías** sí (1 crédito por capítulo con ≥ 85 % y +1 si la base acaba con ≥ 70 %: 3 torres, +5 vidas, +20 % daño). Un capítulo estudiado (≥ 2★) abarata su torre un 25 % y le da +20 % de daño. Hay también **invasión de práctica** (sin tocar las cajas) y la preparación es ajustable (15/30/45 min). El balance se calibró con bots: 330 ⚛ cae en la oleada 5, 530 ⚛ termina con 8–9 vidas, 700 ⚛ con ~17 y sin ⚛ cae en la oleada 2. Código: `js/invasion/00-invasion.js`.

## 🎮 Niveles extra
En el panel de cada capítulo del mapa (y en la vista lista) hay botones **Nivel 2** y **Nivel 3** (`<cap>--2`, `<cap>--3`) siempre disponibles; si ganas el principal, se encadenan solos.
