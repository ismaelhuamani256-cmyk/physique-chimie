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
| `50-jefes.js` | IA y dibujo de los dos jefes, proyectiles |
| `60-ui.js` | Entrada (teclado/táctil/gamepad) y capa DOM (HUD, avisos KaTeX, preguntas, pausa, fin) |
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

## Límites conocidos
- No hay selección de jefe por nivel aparte de `jefe.jefe` (`rey_entropia` ⇒ jefe de fortaleza; cualquier otro id ⇒ Gran Ejercicio).
- Las plataformas móviles y flotantes son de un solo sentido (no bloquean lateralmente ni desde abajo).
- Un solo `jefe` y una sola `meta` por nivel; el validador exige que la arena sea plana.
- El HUD usa PixelHUD, que no pinta bien mayúsculas con tilde: en el HUD se quitan las tildes (el texto de preguntas usa `UI`).
