# Pantalla 2 — Super Claude Bros (motor de plataformas 2D)

Juego **original**: protagonista *Ato* (robot-científico redondo con casco-burbuja y un átomo orbitando), enemigos-error, jefes
*Gran Ejercicio* y *Rey Entropía*. Todo el arte y el audio se generan por código (sin imágenes ni sonidos externos).

`PCB.screens.juego = { mount(host, {capId, nivel, capitulo}), unmount() }` — al terminar llama a
`PCB.flow.finNivel({capId, gano, vidasRestantes, coleccionados, jefeDerrotado})`.

## Archivos (orden de carga alfabético)
| Archivo | Contenido |
|---|---|
| `00-base.js` | `PCB.juego`, utilidades de píxel-art (`arte`, `mezcla`, `hash`) |
| `10-sprites.js` | Ato (poses idle/correr/saltar/caer/morir), 6 skins de enemigo, gema-fórmula, resorte, checkpoint, portal, palanca, engranajes |
| `20-temas.js` | Temas (`laboratorio-neon`, `lava-fortaleza`, `cielo-ondas`, fallback), tiles, parallax de 3–4 capas, peligro bajo los fosos |
| `30-audio.js` | Chiptune original WebAudio (4 músicas de bucle + 16 efectos) |
| `40-mundo.js` | `crearMundo`, colisiones AABB por ejes, simulación del jugador, enemigos, objetos, puentes, palancas, arena |
| `45-quiz.js` | **Modo Quiz Quest**: bloques `?`, ladrillos, tuberías, puertas, plataformas que caen, plantas carnívoras, bonus de monedas, premios, enemigos acuáticos, capa de agua |
| `50-jefes.js` | IA y dibujo de los jefes (golem, Rey Entropía, Pulpo Ácido, Dragón de Tormenta), proyectiles, modo `jefe_quiz` |
| `60-ui.js` | Entrada (teclado/táctil/gamepad) y capa DOM (HUD, avisos KaTeX, **modal de pregunta** opción/numérica, pausa, fin) |
| `70-juego.js` | Montaje, bucle de paso fijo, render |
| `validador.js` | **Física (`FIS`), geometría de tiles y validador** (navegador y Node) |

## Cómo probar
```
node server.js                       # http://127.0.0.1:3000  (PORT=31xx node server.js para otro puerto)
# en la consola del navegador:
PCB.router.go('juego', {capId:'_demo', nivel: await PCB.data.nivel('_demo'), capitulo:{}})
# validar niveles sin navegador:
node js/juego/validador.js contenido/niveles/x.json [otro.json ...]     # exit code 1 si hay errores
```
Depuración: `PCB.juego.estado()` devuelve la partida en curso (jugador, mundo, jefe…); `PCB.juego.pausar()`.
`?touch=1` en la URL fuerza los botones táctiles.

## Sistema de coordenadas
- **1 tile = 1 unidad = 16 px.** `x` crece hacia la derecha desde 0; **`y` crece hacia abajo, `y=0` es el borde superior**.
- Vista interna **512×288 px = 32×18 tiles**, escalada con factor entero (`image-rendering: pixelated`).
  Con `alto_tiles: 18` se ve el nivel entero en vertical; si es mayor, la cámara también sigue en vertical.
- Cámara: scroll lateral suave con anticipación; en la arena del jefe se fija sobre la arena.
- Todo objeto `(x, y)` es la **casilla** que ocupa (esquina superior izquierda). Un enemigo/coleccionable con `y=13` sobre un
  suelo en `y=14` está de pie encima. El jugador nace en `x=2` sobre el suelo de esa columna.

## Física y límites de salto (para autores de niveles)
Unidades: tiles y segundos. Constantes en `PCB.juego.FIS` (`validador.js`).

- `gravedad` multiplica la gravedad base `G0 = 20.57 tiles/s²`. `salto` es la velocidad inicial (tiles/s) de un salto.
- Velocidad horizontal máxima **5.5 tiles/s**. `friccion` = factor por fotograma (60 Hz) que se conserva de `vx` al soltar en suelo
  (0.85 normal, 0.97 hielo). `viento` = aceleración horizontal constante (tiles/s²).
- Salto variable (soltar corta el salto al 45 %), **coyote time 0.1 s**, **jump buffer 0.1 s**.

**Con `gravedad:1, salto:12`:**
| | teórico (medido) | **límite del validador** | recomendado al diseñar |
|---|---|---|---|
| Altura de salto | 3.50 tiles | 3.15 | **≤ 3 tiles** de desnivel |
| Distancia horizontal corriendo (mismo nivel) | 6.42 tiles | **6.0 tiles** de hueco (foso) | **≤ 5 tiles** |
| Toque corto de salto | ≈ 1.2 tiles | | |
| Resorte (`resorte`) | 7.36 tiles de altura | 7.0 | ≤ 6.5 tiles |

Fórmulas (para otras físicas): `hMax = salto²/(2·20.57·gravedad)`, `tVuelo = 2·salto/(20.57·gravedad)`,
`hueco_seguro(dy) = 5.5·t(dy) − 0.4 − 0.7·|viento|` con `t(dy) = (salto + √(salto² − 2·g·dy))/g` (`dy>0` = destino más alto).
`PCB.juego.fisica(nivel)` devuelve `hMax, hSeguro, distMax, gapSeguro…` para cualquier nivel.
Ejemplos con `salto:12`: gravedad 0.85 → 4.1 tiles / hueco 7.6; gravedad 1.2 → 2.9 tiles / hueco 4.9 (el validador lo recalcula).
Hielo: `friccion` 0.97 (derrapa ≈1 s). Una `zona_campo` con `fy<0` reduce la gravedad dentro de ella (el validador lo tiene en cuenta).

## Esquema de nivel (CONTRATO §4) tal como lo interpreta el motor
- **plataforma** `{x,y,largo}`: si `y >= alto_tiles-6` es **suelo** (sólido, se extiende hasta abajo). Si no, es una **plataforma
  flotante de 1 tile, de un solo sentido** (se atraviesa saltando desde abajo y se aterriza encima). Extensiones opcionales:
  `solido:true` fuerza suelo; `grosor:n` crea un bloque sólido de n tiles (no de un solo sentido).
  El suelo debe tener `y ≤ alto_tiles-3`; las flotantes `y ≥ 2`.
- **foso** `{x,largo}`: corta el suelo en esas columnas. Caer por debajo de `alto_tiles-1` mata (ácido/lava/vacío según tema).
- **plataforma_movil** `{x,y,largo,recorrido,eje,periodo}`: de un solo sentido, oscila de forma suave entre su posición `(x,y)`
  y `(x+recorrido, y)` (`eje:"x"`) o `(x, y+recorrido)` (`eje:"y"`); `recorrido` puede ser **negativo** (p. ej. `-6` sube). `periodo` en
  segundos (1.5–12). Arrastra al jugador. Puede tapar un foso (el validador acepta fosos > 6 si una móvil lo cubre).
- **resorte** `{x,y}`: ocupa la casilla; si cae dentro de un sólido (p. ej. `y` = fila del suelo) se apoya encima.
- **coleccionable** `{x,y,ref,latex,nombre}`: gema; al cogerla sale un aviso con la fórmula (KaTeX) y su nombre. Debe ser alcanzable
  (altura máx. ≈ 4 tiles sobre una superficie, 3 con margen) y no estar dentro de un sólido.
- **enemigo** `{x,y,enemigo,nombre,correccion}`: patrulla a pie sobre su plataforma, da la vuelta en bordes y paredes. Skin elegido por
  `hash(enemigo) % 6`. Pisarlo muestra la `correccion`; tocarlo de lado quita una vida (1.8 s de invulnerabilidad).
- **zona_campo** `{x,y,w,h,fx,fy}`: rectángulo en tiles; `fx,fy` son **múltiplos de la gravedad base** como aceleración extra
  (`fy:-0.6` empuja hacia arriba, `fy:+0.5` hacia abajo). Rango admitido |f| ≤ 3.
- **checkpoint** `{x}`: poste sobre el suelo de esa columna; al pasar fija el punto de reaparición.
- **puente** `{x,y,largo,id,cae_con?}`: plataforma **sólida de 1 tile** sobre lava (sin suelo debajo) que puede caer.
- **palanca** `{x,y,efecto:"cae_puente",objetivo?,id?}`: se acciona **al tocarla** o pulsando ↓/E cerca; hace caer el puente
  `objetivo` (o el que declare `cae_con` con su `id`; si no hay ninguno, el último puente). Si el jefe está de pie sobre el puente
  cuando cae, se precipita a la lava y queda derrotado.
- **jefe** `{x,jefe,titulo,preguntas[≥3]}` y **meta** `{x}`: ver siguiente sección. La meta es un portal de 2×3 tiles que necesita
  **2 columnas de suelo a la misma altura** (`meta.x` y `meta.x+1`); `meta.x ≤ ancho_tiles-2`.

### Arena del jefe
Se define por posición: **izquierda = `jefe.x − 12`, derecha = `meta.x − 1`** (muros de energía en ambos extremos). Reglas: interior
(`derecha − izquierda − 1`) ≥ 14 tiles, **suelo plano y continuo** de `jefe.x−12` a `meta.x−1`, `jefe.x ≥ 16`.
Al entrar (a 3 tiles del muro izquierdo) se cierra la arena y aparece el jefe; el muro derecho y el portal quedan bloqueados hasta
derrotarlo. Si mueres en la arena el jefe se reinicia pero **conserva los aciertos**.
- **ejercicio_bac_N («Gran Ejercicio»)**: golem de ecuaciones que embiste y salta (ondas de choque). Al estrellarse contra el muro
  queda **aturdido**: píscalo → pregunta. Acierto = −1 (3 aciertos lo derrotan); fallo = se **enfurece** (más rápido).
- **rey_entropia** (Rey Entropía, `tipo_nivel:"fortaleza"`): criatura de lava y engranajes, 3 fases según aciertos (bolas de fuego a
  dos alturas, arcos, ondas de choque, lluvia de brasas con aviso en el suelo). Tras cada ronda se **sobrecalienta** (aturdido):
  píscalo y responde. Al derrotarlo se abre la meta y, tras la explosión, **el nivel se da por ganado** (también se puede llegar al portal).
- Preguntas: `opciones` (2–6) y `correcta` (índice 0-based); el enunciado, opciones y explicación admiten LaTeX en línea entre `$…$`.

## Validador (`PCB.juego.validar(nivel) → {ok, errores[], avisos[]}`)
Comprueba, con la física anterior: campos y rangos de `fisica_juego`; `ancho_tiles`/`alto_tiles` y que nada se salga (y que no sobren más
de 14 tiles tras la meta); fosos > salto máximo seguro; **alcanzabilidad** de toda plataforma/móvil desde el inicio (BFS sobre
superficies, probando 9 posiciones de cada móvil, resortes y zonas de campo); meta accesible con 2 columnas de suelo; coleccionables
(≥5, alcanzables, no en sólidos, `ref` único, `latex`/`nombre`) y enemigos (≥3, apoyados, no en sólidos, `correccion`); palancas y
puentes (ids, objetivo existente); jefe (≥3 preguntas con `correcta` válida, arena plana, `rey_entropia` obligatorio en fortaleza).
Exit code del CLI: 0 = jugable, 1 = errores, 2 = uso incorrecto.

## Controles
← → / A D mover · Espacio / ↑ / W / Z saltar (mantén para saltar más alto) · ↓ / E palanca · P / Esc pausa (continuar, reiniciar, música y
efectos on/off) · en las preguntas 1–6 o clic y Enter para continuar. Botones táctiles automáticos en pantallas táctiles. Gamepad:
stick/cruceta, A (o X/↑) salto, Start pausa. La barra global ya aporta «Saltar juego».

## Audio
El `AudioContext` se crea en la primera tecla/clic/toque y se cierra en `unmount`. Música (bucle por tema) solo si
`PCB.settings.musica`; efectos si `PCB.settings.sfx !== false` (se comprueba en cada nota). La pausa permite activarlos.

## Fin de partida
Pantalla ✔/✖ con fórmulas, vidas y XP estimado (`50 + 5·fórmulas + 50 si jefe`, igual que `PCB.flow.finNivel`). «Continuar» llama a
`finNivel`; si perdiste las 3 vidas también hay «Reintentar».

## Modo Quiz Quest (CONTRATO §4b)
`PCB.screens.juego.mount(host, {capId, nivel, capitulo, onFin?, modoQuiz?})`: si hay `ctx.onFin(res)` se llama ahí (al pulsar «Continuar» de la
pantalla final) con `res = {capId, gano, vidasRestantes, coleccionados, jefeDerrotado, respuestas:{correctas,total}, premios:{moneda,vida,pista,escudo,estrella,reloj}}`;
si no, se llama a `PCB.flow.finNivel` (solo los 5 campos del contrato §2). `modoQuiz` se activa solo con `tipo_nivel` `quiz_*`.
`PCB.juego.validar` y el CLI (`node js/juego/validador.js nivel.json`) entienden los tipos `quiz_tierra|quiz_agua|quiz_castillo` y todos los segmentos nuevos.
Niveles de ejemplo (con preguntas reales de bachillerato): `contenido/niveles/_demo-quiz-tierra.json`, `_demo-quiz-agua.json`, `_demo-quiz-castillo.json`.

**Pregunta Q** (esquema §6): `{id, tipo:"opcion"|"numerico", enunciado, opciones, correcta, explicacion, valor, unidad, tolerancia_rel, cifras_sig, pasos, pagina_pdf, latex_opciones?}`
(también se acepta `pregunta` como alias de `enunciado`). El modal pausa el juego, renderiza `$…$` y `latex_opciones` con KaTeX, acepta teclas 1–6 / clic /
Enter (en `numerico`: campo valor + unidad corregidos con `PCB.estudio.corregirNumerico({valor,unidad},{valor,unidad,tolerancia_rel,cifras_sig})`), muestra la
explicación y los pasos y cuenta `{correctas,total}`. Se usa en bloques, tuberías, puertas y jefes (también los `jefe` clásicos).

| Segmento | Campos | Comportamiento |
|---|---|---|
| `bloque_pregunta` | `x,y,pregunta,premio,fallo` | Se golpea con la cabeza (desde abajo). Acierto: premio `moneda\|vida\|pista\|escudo\|estrella\|reloj` y queda gris; fallo: se agrieta/cierra (con `fallo:"enemigo"` suelta un bichito que, pisado, enseña la explicación). Debe haber una superficie alcanzable 2–5 tiles por debajo |
| `ladrillo` | `x,y,largo,contenido:"nada\|moneda\|moneda_multi\|pregunta"` | Cerámica de laboratorio que se **rompe desde abajo** con fragmentos; `moneda` +1; `moneda_multi` hasta 6 monedas y luego queda como bloque usado; `pregunta` = bloque_pregunta con aspecto de ladrillo (usa `pregunta`/`premio`/`fallo`) |
| `tuberia` | `x,y,alto(1–3),pregunta,preguntas_reserva?,destino:"atajo\|bonus",salida_x,salida_y` | 2 tiles de ancho; `y` = cualquier fila sobre su suelo. **↓ / E encima** → pregunta. Acierto: `atajo` te lleva a `salida_x/salida_y` (y fija ahí el punto de reaparición); `bonus` abre una sala de monedas generada (30 s, tubería de salida) y vuelves. Fallo: **sale una planta carnívora** y la tubería se cierra 2.5 s; con `preguntas_reserva` se puede reintentar con otra pregunta, si no queda atascada |
| `puerta` | `x,y,alto(2–6),pregunta,preguntas_reserva?` | Sólida. **↑ / E** delante (↑ no salta cerca de una puerta): pregunta; acierto la disuelve; fallo: sigue cerrada y se reintenta tras 3 s (con la siguiente de `preguntas_reserva`) |
| `plataforma_cae` | `x,y,largo,retardo,reaparece` | De un solo sentido; tiembla `retardo` s (0.2–3) tras pisarla, cae y reaparece `reaparece` s (1–15) después (deja un fantasma). El validador la exige **alcanzable pero no como camino único**: no se usa para llegar a otras plataformas |
| `planta_carnivora` | `x,y,ciclo(1.5–12),visible(0.3…ciclo−0.5)` | Bulbo con colmillos y ácido (diseño propio). Sale de la tubería situada en `x` (o del suelo si no hay) durante `visible` s de cada `ciclo`; muerde, no se pisa; **no sale** si estás encima o pegado a su tubería (≤1.6 tiles) |
| `zona_agua` | `x,y,w,h,corriente_x,corriente_y` | Física de **natación**: hundimiento suave (≈1.8 tiles/s), cada pulsación de salto = brazada (≈2.1 tiles, `NAT.BRAZADA`), ↓ bucea, velocidad horizontal máx. 3.6 tiles/s, la corriente arrastra a ≈ `corriente·0.8` tiles/s, burbujas, sonido amortiguado (paso-bajo), fondo invisible si la zona llega al suelo del nivel (no hay foso mortal), techo si `y=0`; en la superficie (`y>0`) una brazada te saca del agua. Tema `submarino` |
| enemigos `enemigo` ∈ `medusa\|pez\|erizo\|anguila` | como `enemigo` | Nadan (medusa vertical senoidal, pez horizontal, erizo bamboleante e **impisable**, anguila persigue despacio). Se pisan (salvo el erizo); al tocar muestran la `correccion` |
| `jefe_quiz` | `x,jefe:"rey_entropia\|golem_formulas\|pulpo_acido\|dragon_tormenta",vidas,preguntas[≥5]` | Jefe **blindado** (escudo hexagonal con «?»). Pisarlo abre una pregunta: acierto → −1 vida del jefe, rebote; fallo → escudo destella, contraataque y pierdes 1 corazón (el escudo `premio` lo absorbe). Ataca entre preguntas (nunca se aturde). Misma arena que `jefe` (`jefe.x−12` … `meta.x−1`, suelo plano). `pulpo_acido` y `dragon_tormenta` siempre son modo quiz |

Premios: moneda (+1, se cuentan), vida (hasta 5), pista, **escudo** (absorbe un golpe), **estrella** (8 s invulnerable; tocar un enemigo lo derrota), **reloj** (8 s de enemigos, jefes y plataformas a mitad de velocidad).
Controles añadidos: ↓ / E = acción (tuberías, palancas, puertas; botón ⬇ en táctil), ↑ / E ante una puerta.
Jefes nuevos (diseño propio): **Pulpo Ácido** (tinta, chorro de embestida, tentáculos que azotan el suelo) y **Dragón de Tormenta** (rayos con aviso desde las nubes, embestida, ráfaga de bolas eléctricas).

**Validador Quiz Quest**: tipos de nivel nuevos; preguntas (`opcion`: 2–6 opciones y `correcta` válida; `numerico`: `valor` numérico, `tolerancia_rel` en (0,0.5]); bloques/ladrillos golpeables desde abajo;
tuberías (alto 1–3, suelo a la misma altura bajo las 2 columnas, `destino`, salida con suelo y despejada); puertas; plantas (tubería o suelo bajo `x`);
`quiz_agua`: sin límite de foso, alcanzabilidad **nadando** por flood-fill (meta, gemas, bloques —casilla de debajo—, bocas de tubería y puertas); `jefe_quiz` ≥5 preguntas; en niveles `quiz_*` no se exigen ≥5 coleccionables ni ≥3 enemigos.
Nota: `index.html` es estático (lo genera `node tools/generar-estatico.js`): hay que regenerarlo para que cargue `js/juego/45-quiz.js`.

## Límites conocidos
- No hay selección de jefe por nivel aparte de `jefe.jefe` (`rey_entropia` ⇒ jefe de fortaleza; cualquier otro id ⇒ Gran Ejercicio).
- Las plataformas móviles y flotantes son de un solo sentido (no bloquean lateralmente ni desde abajo).
- Un solo `jefe`/`jefe_quiz` y una sola `meta` por nivel; el validador exige que la arena sea plana.
- La sala de monedas (bonus) se genera siempre igual (44×18 tiles) y no tiene enemigos; el modo agua no admite fosos/lava mortales en el fondo.
- El HUD usa PixelHUD, que no pinta bien mayúsculas con tilde: en el HUD se quitan las tildes (el texto de preguntas usa `UI`).

## Ítems y jefes de física moderna (etapa 1, hechos por el orquestador)
**`48-items.js`** — cápsulas `{"tipo":"item","x","y","item":"zapatos|iman|mochila|canon|escudo|estrella|reloj|vida"}`:
- `zapatos` *Botas de Hooke*: salto ×1,35 durante 15 s · `iman` *Imán*: atrae átomos, gemas y monedas (15 s) ·
  `mochila` *Mochila propulsora*: mantén SALTO en el aire para propulsarte (2,8 s de combustible, se recarga en suelo) ·
  `canon` *Cañón de fotones*: **X / F / J** disparan (10 fotones): matan enemigos (muestran la corrección), rompen ladrillos, abren bloques `?` y **detonan minas a distancia**.
- `escudo`, `estrella` (*Supernova*) y `reloj` van a la **reserva** (3 casillas abajo en el centro); **Q** (o clic en la casilla) usa la primera. `vida` suma al instante.
- Los bloques `?` y ladrillos del Quiz Quest también pueden dar `zapatos|iman|mochila|canon` (`premio`).
**Jefes nuevos** (`jefe_quiz`, `jefe` = `isotopo_inestable | foton_veloz | bombardero_neutron`; reutilizan la IA flotante del dragón con otra piel y ataques):
- *Isótopo Inestable*: núcleo radiactivo con cara; cada acierto pierde la mitad de sus nucleones (12 → 6 → 3, la semivida). Ataques: ráfaga (α), rayo (γ), embestida.
- *Fotón Veloz*: orbe de luz muy rápido que deja estelas al embestir (velocidad de la luz = lo más rápido que existe).
- *Bombardero Neutrón*: reactor volador; hace dos pasadas soltando cargas que caen por gravedad y solo se le pisa cuando baja. Ataque nuevo `bombardeo`.
Asignación actual: ch.5 `nucleaires` → Isótopo (nivel normal) y Bombardero (Quiz Quest); ch.19 `photons` → Fotón Veloz.

## Ambiente, peligros del entorno y enemigos con comportamiento (`49-ambiente.js`, hecho por el orquestador)
- **Temas nuevos** (`20-temas.js`): `caverna`, `mina-uranio`, `pista-hielo-newton`, `espacio-orbital`, `horno-termico`, `laboratorio-verde|ambar|violeta`, `camara-fotoelectrica`, `pista-campo-uniforme` (además de `laboratorio-neon`, `lava-fortaleza`, `cielo-ondas`, `submarino`). Cada uno trae paleta, textura de suelo, fondo en parallax (cueva con estalactitas y cristales, hielo con aurora y montañas, espacio con planeta y asteroides…) y partículas ambientales.
- **Props automáticos** según el estilo del tema (matraces, pantallas, antorchas, estandartes, cristales, hongos, muñecos de nieve, antenas, tuberías con vapor…) y elementos colgantes del techo (estalactitas decorativas con goteo, carámbanos, cadenas, cables). Se colocan solos, sin tocar el nivel.
- **Segmentos nuevos**: `{"tipo":"estalactita","x"}` (tiembla 0,65 s y cae cuando pasas debajo; se rompe y reaparece), `{"tipo":"lluvia_rocas","x","w","periodo"}` (sombra de aviso y roca que cae), `{"tipo":"bicho","x","y","bicho":"embestidor|demonio|murcielago|neutrino","nombre","correccion"}`.
- **Bichos**: *embestidor* («Toro Basáltico»: te ve, resopla con «!» y embiste hasta chocar o llegar a un borde, luego se cansa), *demonio* («Diablillo de Entropía»: merodea, marca tu posición y pica en picado), *murcielago* (zigzag veloz), *neutrino* (fantasma tímido: si lo miras se queda quieto y translúcido e inofensivo; si le das la espalda te persigue atravesando paredes; no se pisa: usa fotones o la supernova). Se pisan y muestran la corrección del error típico (cada bicho lleva uno del capítulo).
- `tools`: los 20 niveles se enriquecieron con 100 elementos (script de ejemplo en el historial); el campo `ambiente` del nivel es informativo.

## Relieve del terreno (`44-relieve.js`, hecho por el orquestador)
Los niveles ya no son una tira plana. `PCB.juego.Relieve.aplicar(nivel, {seed, intensidad, techo})` (navegador y Node) devuelve un nivel nuevo con:
- **Perfil de alturas** del suelo: colinas y escalones de ±1/±2 tiles (filas 12–15). Quedan planos el inicio, los fosos y puentes, el tramo de sprint y la arena del jefe; no hay escalones bajo plataformas flotantes ni junto a objetos de varias casillas.
- **Todo lo que había encima se recoloca** con el desnivel (enemigos, átomos, ítems, carteles, minas, tuberías, puentes…); lo que va sobre una plataforma flotante hereda el desplazamiento de esa plataforma.
- **Islas flotantes** escalonadas (hasta 3 pisos) con rastro de monedas, **hileras de ladrillos** sobre la cabeza (algunos dan monedas), **arcos de monedas sobre cada foso** que dibujan el salto, escalinatas de bloques cuando caben y, en cuevas y hornos, **techo irregular** (`techo:true`, el validador no exige alcanzarlo) con las estalactitas colgando de él.
- Herramienta: `node tools/relieve-niveles.js` aplica el relieve a `contenido/niveles/*.json` (una vez; `--forzar` repite), reintenta con menos intensidad y semillas distintas hasta que el nivel pasa el validador. El generador del Quiz Quest también lo aplica a las fases de tierra y castillo.
- **Aire** (`Rel.poblarAire`, `tools/aire-niveles.js`): añade **plataformas móviles** (ascensores verticales hacia las islas altas y lanzaderas horizontales que cruzan fosos, siempre a 2–3 tiles del suelo para que se alcancen de un salto) y **enemigos voladores** (murciélago, diablillo que pica y, en laboratorios/espacio, el neutrino) con el error típico del capítulo. Solo se colocan en huecos libres: evitan estructuras sólidas y otros voladores, pero sobrevuelan monedas y gemas. El Quiz Quest lo aplica también a sus fases de tierra y castillo.

## Peligros nuevos (`51-peligros.js`) y reparto automático (`Rel.poblarPeligros`)
- **Segmentos**: `sierra` (fija, o en raíl con `eje:"x|y"` y `recorrido`, o en círculo `eje:"o"`), `torreta` (te apunta y dispara bolas de energía; se pisa o se dispara, muestra la corrección de un error típico), `canon_bala` (lanza una «bala cometa» gigante; se pisa o se dispara), `geiser` (columna de lava/ácido/agua según el tema; burbujea antes de brotar), `laser` (barrera horizontal o vertical que parpadea antes de encenderse) y `planta_techo` (tubería del techo con una planta carnívora que baja a morder).
- Los disparos del jugador llaman a `J.Peligros.golpe(g, x, y, radio)`.
- `tools/peligros-niveles.js` reparte peligros por los 20 niveles según su `ambiente` (laboratorio: láseres y torretas; castillo/horno: géiseres y sierras; cueva: picos y géiseres; hielo: cañones; espacio: láseres y minas…) con huecos de seguridad (nada junto a fosos, checkpoints, carteles, estaciones, sprint ni la arena del jefe) y valida cada resultado. De **27 peligros en total** (14 niveles sin ninguno) se pasó a **~230** (mínimo 9, media 11 por nivel). El generador del Quiz Quest hace lo mismo en sus fases de tierra y castillo.

## Rey Bomba y jefes de disparo (`50-jefes.js`)

`jefe: "rey_bomba"` (segmento `jefe`, 3+ preguntas): jefe **que se derrota disparando**. Tiene una *coraza* (8 puntos, +2 por fase): `fuego` = 1, perdigón de escopeta = 0,35, fotón = 1. Al romperla se apaga la mecha, queda **aturdido** y se le pisa para la pregunta del cours (acierto = nueva fase con coraza renovada; fallo = se enfurece). Ataques: `lanzar` (2–4 bombas en arco con mecha de 2 s; **si las disparas explotan lejos, y si explotan junto al rey le hacen 3 de daño**), `rodar` (embestida), `salto` (onda de choque), `mecha` (nova de explosión, hay que alejarse). Si no llevas munición al entrar en la arena, te da la flor de plasma. `tools/jefe-bomba.js nivel…` lo asigna a un nivel y deja una cápsula de escopeta antes de la arena (ya puesto en thermodynamique, ecoulement-fluide, sens-evolution y champ-uniforme). Hook genérico: `J.Jefe.recibirDisparo(g,x,y,por)` / `J.Jefe.danar(g,d)`.

## Cuevas submarinas y fauna (`44-cueva.js`, `52-fauna.js`)

`Cueva.aplicar(nivel,{seed,intensidad})` convierte un nivel `quiz_agua` en una **cueva**: techo rocoso (0–5 tiles, `plataforma{techo:true}`), jorobas de 0–3 tiles en el fondo y un pasillo siempre ≥ 6 tiles; no toca el inicio, puertas, tuberías, bloques, checkpoints ni la arena. El generador del Quiz Quest lo aplica a la fase de agua (con respaldo 1 → 0,7 → 0,45 si no valida) y `tools/cueva-niveles.js` mejora los niveles de agua ya guardados (`_demo-quiz-agua.json`). El validador acepta techos desde la fila 0 y `topAt` ignora los bloques de techo.

Segmento `{"tipo":"fauna","especie":…,"x","y"}`:
| especie | comportamiento |
|---|---|
| `pirana` | banco de 3; si te huele a < 9 tiles te **persigue** y se lanza en picado; se pisa o se dispara |
| `tiburon` | gigante: ronda, avisa (ojos rojos + «!») y **embiste** en línea recta; queda cansado; solo a tiros (6) |
| `langosta` | en el fondo; alza la pinza y suelta una **cavitación** (onda de choque que crece); se pisa o se dispara |
| `submarino` | te **persigue** y lanza torpedos teledirigidos; solo a tiros (4) |
| `globo` | se **hincha** si te acercas (hinchado = púas, no se pisa) |
| `mago` | se teletransporta junto a ti y lanza orbes que te buscan |
| `mina` | mina flotante con cadena; explota al tocarla o dispararla y arrastra a la fauna cercana |
Además se reparten `sierra` (en raíl) y `laser` horizontales de 51-peligros.js. Los disparos del jugador (`Items.impacto` y fotones) llaman a `Fauna.golpe`.
