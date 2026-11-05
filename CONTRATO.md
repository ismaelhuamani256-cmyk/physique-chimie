# CONTRATO — Physique-Chimie BAC · Super Claude Bros

Léelo completo antes de escribir código. Todos los agentes trabajan contra este contrato. **Cada agente solo toca SUS archivos** (ver §9). Si necesitas algo de otro módulo, usa la API pública descrita aquí.

Usuario: Santiago, 18 años, Arequipa, bac por CNED, spé physique-chimie. **Interfaz en español**, contenido del cours en **francés** (términos del cours se quedan en francés).

## 0. Decisiones (cambian el spec original)
- **SIN API de Anthropic, SIN `.env`, SIN llamadas a la nube desde la app.** Todo el contenido (capítulos, niveles, intros, quizzes, mapeos de animación) lo **generan los agentes Sonnet aquí, leyendo el libro**, y se guarda ya hecho en `contenido/` (tracked en git). La app solo lee JSON → 100 % offline.
- Libro: `cours/*.pdf` = 13 trozos **escaneados** (sin capa de texto) del manual Bordas Tle spé PC, 628 páginas pdf. `contenido/indice.json` tiene los 20 capítulos con `pdf_ini/pdf_fin` (pagina_pdf = impresa + 18). Para leer una página como imagen: `pdftoppm -r 90 -f N -l N -jpeg ARCHIVO SALIDA` (N relativo al archivo; mapa archivo↔páginas en `indice.json → archivos_pdf`) y luego `Read` de la imagen (los agentes pueden ver imágenes). Salida en tu scratchpad, nunca en el repo.
- **Fidelidad total al cours**: nada inventado (fórmulas, constantes, ejercicios). Si falta: `"no está en el cours"`. Todo dato lleva `pagina_pdf`.
- **Originalidad** (franquicias): protagonista, sprites, música, niveles y enemigos son propios. Nada de personajes/sprites/música de Nintendo ni de ninguna franquicia. El jefe de fortaleza es **"Rey Entropía"** (diseño propio: gran criatura de lava y engranajes), NO un personaje existente.
- Sin build step: HTML + JS clásico (scripts normales, **no módulos ES**), globales bajo `window.PCB`. Three.js 0.159 (`lib/three/three.min.js`, global `THREE`), KaTeX local (`lib/katex/`). Sin CDN, sin npm en runtime.
- Servido por `server.js` (Node sin dependencias) en `http://127.0.0.1:3000`. Persistencia del progreso en `data/progreso.json` (vía `/api/progreso`), con fallback a `localStorage`.

## 1. Estructura
```
index.html                 shell (lo escribe el orquestador)
server.js                  servidor estático + /api/progreso + /api/contenido   (orquestador)
iniciar.bat / iniciar.command
css/base.css               tokens, tipografías, componentes comunes            (orquestador)
js/core.js                 PCB: store, router, util, flow, eventos             (orquestador)
js/anim-core.js            motor de animaciones de fórmulas + modal            (orquestador)
js/mapa.js                 Pantalla 1: mapa 3D                                 (agente MAPA)
js/juego/*.js              Pantalla 2: plataformas                             (agente JUEGO)
js/intro/engine.js …       Pantalla 3: intros                                  (agentes INTRO-A / INTRO-B)
js/estudio/*.js            Pantalla 4: capítulo, quiz, tracker                 (agente ESTUDIO)
js/anim/*.js               presets de animación (4 archivos, ver §7 y §9)      (agentes ANIM-*)
contenido/indice.json      20 capítulos + mundos + mapa de PDFs
contenido/capitulos/<id>.json   cours estructurado (esquema §3)
contenido/niveles/<id>.json     nivel de plataformas (esquema §4)
contenido/intros/<id>.json      guion de intro (esquema §5)
contenido/quizzes/<id>.json     quiz + ejercicios (esquema §6)
lib/…                      three, katex, fuentes (ya instalado)
```
Fuentes ya en `lib/fonts/`: `Press Start 2P` (HUD del juego), `Inter` (UI), `Source Serif 4` (estudio) — las declara `css/base.css` con los nombres de familia `PixelHUD`, `UI`, `Estudio`.

## 2. API global `window.PCB` (js/core.js)
```js
PCB.util.el(tag, attrs, ...children)     // crea DOM: attrs {class, style:{}, on:{click:fn}, ...}
PCB.util.tex(latex, host, {display})     // KaTeX.render con throwOnError:false
PCB.util.fetchJSON(url)                  // con caché en memoria
PCB.util.reducedMotion()                 // true si prefers-reduced-motion o ajuste del usuario
PCB.util.rng(seed)                       // PRNG determinista -> () => [0,1)
PCB.bus.on(ev, fn) / .off / .emit(ev, data)
PCB.data.indice()                        // Promise<indice.json>
PCB.data.capitulo(id) / .nivel(id) / .intro(id) / .quiz(id)   // Promise<json|null>
PCB.store.get() -> progreso              // objeto, ver abajo
PCB.store.update(fn)                     // fn(progreso) muta; persiste (debounced)
PCB.store.cap(id) -> registro del capítulo (lo crea si no existe)
PCB.store.addXP(n, motivo)
PCB.router.go(pantalla, ctx)             // 'mapa'|'juego'|'intro'|'capitulo'
PCB.flow.entrarCapitulo(capId)           // mapa -> (nivel) -> intro -> capitulo
PCB.flow.finNivel({capId, gano, vidasRestantes, coleccionados, jefeDerrotado})
PCB.flow.saltarJuego(capId)              // directo a intro/capítulo
PCB.flow.finIntro(capId)                 // -> capítulo
PCB.settings                             // {reducirAnimaciones, estiloIntro:'auto'|id, musica, sfx}
```
### Pantallas (cada módulo se registra así)
```js
PCB.screens.mapa = { mount(host, ctx) {...}, unmount() {...} }
PCB.screens.juego = { mount(host, {capId, nivel, capitulo}) , unmount() }
PCB.screens.intro = { mount(host, {capId, guion, onFin}) , unmount() }
PCB.screens.capitulo = { mount(host, {capId, capitulo, quiz, tab?}) , unmount() }
```
`host` es un `<div>` vacío a pantalla completa. `unmount` debe liberar rAF, listeners, WebGL (`renderer.dispose()`), AudioContext.

### Progreso (`PCB.store.get()`)
```json
{ "version":1, "xp":0, "racha":{"dias":0,"ultimo":null}, "ajustes":{},
  "capitulos":{ "<capId>":{ "nivelJugado":false,"nivelGanado":false,"jefeDerrotado":false,
     "introVista":false,"formulasDominadas":["f1"],"ejerciciosResueltos":["e1"],
     "quizMejor":0,"estrellas":0,"estado":"disponible|completado|dominado" } } }
```

## 3. `contenido/capitulos/<id>.json` — el cours
```json
{
 "id":"acide-base ← igual al id de indice.json","titulo":"…","materia":"chimie|physique","mundo":"constitucion|mouvement|energie|ondes",
 "pdf_ini":34,"pdf_fin":57,
 "resumen":"3-4 líneas en español","resumen_fr":"opcional",
 "nociones_clave":[{"fr":"…","es":"explicación corta en español","pagina_pdf":36}],
 "formulas":[{
   "id":"f1","latex":"C = \\dfrac{n}{V}","nombre":"Concentration molaire","nombre_fr":"…",
   "variables":[{"simbolo":"C","significado":"concentración molar","unidad":"mol·L⁻¹"}],
   "explicacion":"1-2 frases en español","ejemplo":{"enunciado":"del cours","resultado":"…","pagina_pdf":70}|null,
   "pagina_pdf":70,
   "animacion":{"preset":"concentracion","params":{"n":0.2,"V":0.5},"leyenda":"qué ve el alumno al pulsar (1 frase)"}
 }],
 "constantes":[{"nombre":"g","valor":"9,81","unidad":"m·s⁻²","pagina_pdf":3}],
 "metodos":[{"titulo":"…","pasos":["…"],"pagina_pdf":0}],
 "errores_tipicos":[{"id":"err1","nombre":"Error de unidades","correccion":"una línea","pagina_pdf":0}],
 "experiencias":[{"titulo":"TP …","descripcion":"…","pagina_pdf":0}],
 "ejercicios_bac":[{"id":"e1","enunciado":"…","datos":{"m":"250 g"},"respuesta":"texto del corrigé","respuesta_numerica":{"valor":0.5,"unidad":"mol·L⁻¹","tolerancia_rel":0.02}|null,"pasos":["…"],"pagina_pdf":0,"corrige_pagina_pdf":0}],
 "laboratorio":[{"preset":"dilucion","params":{},"titulo":"…","relacion":"qué parte del cours ilustra"}],
 "nivel_juego":{"tema_visual":"laboratorio-neon|…","mecanica_especial":"…"},
 "estilo_intro_sugerido":"monigotes|matrix|quimica3d|fisica3d|minimalista|comic|lego|ps2"
}
```
Reglas: LaTeX válido para KaTeX (sin paquetes raros). `animacion.preset` **debe existir** en la lista de §7. Fórmulas sin animación posible → `"animacion":{"preset":"generico","params":{…}}` (gráfica y vs x con sliders; ver §7).

## 4. `contenido/niveles/<id>.json` — nivel de plataformas
Unidades en **tiles** (1 tile = 1 unidad; el suelo "y" crece hacia abajo, y=0 arriba; el motor documenta su sistema, el agente JUEGO lo fija en `js/juego/README.md` y valida contra él).
```json
{
 "capitulo_id":"…","tipo_nivel":"normal|fortaleza","tema_visual":"laboratorio-neon|lava-fortaleza|cielo-ondas|…",
 "fisica_juego":{"gravedad":1.0,"friccion":0.85,"salto":12,"viento":0},
 "ancho_tiles":160,"alto_tiles":18,
 "segmentos":[
  {"tipo":"plataforma","x":0,"y":14,"largo":20},
  {"tipo":"foso","x":20,"largo":4},
  {"tipo":"plataforma_movil","x":28,"y":10,"largo":4,"recorrido":6,"eje":"x|y","periodo":3},
  {"tipo":"resorte","x":40,"y":14},
  {"tipo":"coleccionable","x":12,"y":12,"ref":"f1","latex":"C=\\frac{n}{V}","nombre":"Concentration molaire"},
  {"tipo":"enemigo","x":35,"y":13,"enemigo":"error_unidades","nombre":"Error de unidades","correccion":"Convertir a mol·L⁻¹ antes de calcular."},
  {"tipo":"zona_campo","x":50,"y":8,"w":10,"h":6,"fx":0,"fy":-0.6},
  {"tipo":"checkpoint","x":80},
  {"tipo":"jefe","x":150,"jefe":"ejercicio_bac_1","titulo":"…","preguntas":[{"pregunta":"…","opciones":["a","b","c"],"correcta":1,"explicacion":"…","pagina_pdf":0}]},
  {"tipo":"meta","x":158}
 ]
}
```
- Mecánica especial por capítulo vía `fisica_juego` + segmentos (hielo = `friccion` baja, gravedad reducida, `zona_campo` empuja, plataformas oscilantes = periodo, `resorte` = rebote elástico).
- **Nivel `fortaleza`** (capítulos 1, 10, 15, 17, 20): tema lava/castillo, **puente** sobre lava, interruptor ("palanca de Entropía") que hace caer el puente, y jefe **"rey_entropia"** con 3 fases (esquiva ataques: bolas de fuego/ondas; cada fase se "stunnea" y respondes una pregunta del cours; 3 aciertos = derrotado). El segmento jefe lleva `jefe:"rey_entropia"` y `preguntas` (≥3).
- El nivel debe ser **jugable**: ningún foso > salto máximo (el validador de `js/juego/validador.js` lo comprueba; `PCB.juego.validar(nivel) -> {ok, errores[]}`), toda plataforma alcanzable, meta accesible. Duración objetivo: 60–120 s para un nivel normal.
- Coleccionables = fórmulas/nociones del capítulo (≥ 5, cada `ref` existe en `formulas[]` o `nociones_clave`). Enemigos = `errores_tipicos` (≥ 3).

## 5. `contenido/intros/<id>.json` — intro animada (15–30 s)
```json
{ "titulo":"Inercia: el auto que frena","estilo":"monigotes","duracion_seg":22,
  "actores":[{"id":"auto","tipo":"auto","pos":[0.1,0.7],"color":"#e63946","escala":1}],
  "pasos":[
   {"t":0,"accion":"mueve","actor":"auto","a":[0.8,0.7],"dur":4},
   {"t":4,"accion":"frena","actor":"auto"},
   {"t":6,"accion":"formula","latex":"\\sum \\vec F=\\vec 0 \\Rightarrow \\vec v = \\text{cte}"},
   {"t":8,"accion":"subtitulo","texto":"Sin fuerza neta, el movimiento no cambia."} ] }
```
Coordenadas normalizadas `[0..1]` (x derecha, y abajo) sobre la escena. **Vocabulario fijo** (el motor INTRO-A lo implementa, el resto de estilos lo respeta):
- **actores.tipo**: `auto, perro, humano, cohete, planeta, luna, tubo_ensayo, vaso, bola, molecula, atomo, ion, electron, circuito, pendulo, resorte, onda, lente, rayo, flecha, bloque, fluido, termometro, texto`
- **acciones**: `mueve{actor,a,dur,ease?}`, `frena{actor}`, `aparece{actor,dur?}`, `desaparece{actor}`, `gira{actor,grados,dur}`, `escala{actor,a,dur}`, `color{actor,color}`, `habla{actor,texto}` (bocadillo), `vector{actor,dx,dy,etiqueta}` (flecha de fuerza/velocidad), `trayectoria{actor,puntos[]}`, `particulas{tipo:'burbujas|chispas|polvo',pos}`, `resalta{actor}`, `camara{zoom,centro,dur}`, `formula{latex,pos?}`, `subtitulo{texto}`, `pausa{dur}`, `reaccion{de:[ids],a:[ids]}` (átomos que se reordenan; química), `valor{id,desde,hasta,dur,etiqueta}` (contador numérico).
- Estilos: `monigotes` (default), `minimalista`, `matrix`, `quimica3d`, `fisica3d`, `comic`, `lego`, `ps2`. Estilos no implementados → el motor cae a `monigotes`.
- Historia visual con **humor/narrativa** (perro en cohete, auto que frena…), actores genéricos propios. `subtitulo` siempre en español; `formula` en LaTeX.
- Contenido fiel al capítulo: presenta **la idea central** del cours.

### 5b. API de estilos de intro (INTRO-A implementa el motor; INTRO-A e INTRO-B la respetan)
El **motor** (`js/intro/00-engine.js`) lee el guion, avanza el reloj `t` (play/pausa/saltar/repetir), **resuelve la línea de tiempo** en un estado de escena `S` por frame (interpolaciones de `mueve/gira/escala/...`) y dibuja él mismo el **overlay DOM**: `subtitulo`, `formula` (KaTeX) y `valor` (contadores). Los **estilos solo dibujan actores, vectores, trayectorias, partículas, bocadillos, fondo y cámara**.
```js
PCB.intro.registerStyle('monigotes', { init(ctx){ /* ctx:{host:div, guion, w, h, dpr, rng} */ return estilo } })
estilo = { update(S, dt), resize(w,h), dispose() }     // update dibuja un frame
S = { t, dur, camara:{zoom,cx,cy},
      actores:{ id:{ id,tipo,x,y,rot,escala,alpha,color,visible,vx,vy,frenando,hablando:'texto'|null,resaltado:0..1 } },
      vectores:[{actor,dx,dy,etiqueta,alpha}], trayectorias:{actorId:[[x,y],…]}, particulas:[{tipo,x,y,t0}],
      reacciones:[{de:[ids],a:[ids],progreso:0..1}] }
PCB.intro.play(host, guion, {onFin, estilo?}) -> {dispose(), pause(), resume(), replay()}   // lo usa PCB.screens.intro
```
Coordenadas de S: normalizadas 0..1 (x derecha, y abajo). El estilo debe mapearlas al tamaño del `host` (aspecto 16:9 con letterbox). Estilo desconocido → `monigotes`.

## 6. `contenido/quizzes/<id>.json`
```json
{ "capitulo_id":"…","preguntas":[
  {"id":"q1","tipo":"opcion","enunciado":"…(fr o es, como el cours)","opciones":["…","…","…","…"],"correcta":2,"explicacion":"…","pagina_pdf":70},
  {"id":"q2","tipo":"numerico","enunciado":"…","valor":0.5,"unidad":"mol·L⁻¹","tolerancia_rel":0.02,"cifras_sig":2,"pasos":["…"],"pagina_pdf":71} ] }
```
≥ 8 preguntas (≥ 3 numéricas). Cálculos **deben ser correctos** (verifica con Python). El corrector numérico (`PCB.estudio.corregirNumerico(resp, esperado)`) compara valor con tolerancia, cifras significativas y **unidades** (acepta equivalentes: `mol/L`=`mol·L⁻¹`=`mol.L-1`=`M`).

## 7. Motor de animaciones de fórmulas (`js/anim-core.js`) — LO PEDIDO POR SANTIAGO
Al **pulsar una fórmula** en el estudio se abre un modal con una animación que *muestra* lo que dice la fórmula (p. ej. concentración: un vaso con líquido y moléculas disueltas que se mueven; sliders de n y V cambian cuántas moléculas hay y el nivel del líquido; la fórmula en KaTeX arriba con los **valores en vivo**).
```js
PCB.anim.register('concentracion', {
  titulo:'Concentración molar', materia:'chimie',
  params:[{id:'n',label:'Cantidad n',min:0.01,max:1,step:0.01,def:0.2,unit:'mol'},
          {id:'V',label:'Volumen V',min:0.1,max:1,step:0.05,def:0.5,unit:'L'}],
  create(host, p){ return state },       // host:{w,h,dpr,rng}; p: valores actuales
  onParam(state, id, valor, p){},        // opcional; reacciona al mover un slider
  step(state, dt, p){},                  // dt en segundos (acotado)
  draw(state, ctx, w, h, p){},           // Canvas2D; limpiar el fondo tú mismo
  formula(p){ return 'C=\\dfrac{n}{V}=\\dfrac{0{,}20}{0{,}50}=0{,}40\\ \\text{mol·L}^{-1}' },  // LaTeX con valores en vivo
  lecturas(p){ return [{label:'C',valor:'0,40 mol·L⁻¹'}] },   // opcional
  dispose(state){}                       // opcional
})
PCB.anim.open('concentracion', {params:{n:0.3}, leyenda:'…', latexBase:'C=\\frac nV'})  // abre el modal
PCB.anim.mountInline(host, presetId, opts) -> {dispose()}   // para la pestaña Laboratorio (sin modal)
PCB.anim.presets()  -> ids registrados
```
Modo 3D opcional: un preset puede definir `mount(host, p) -> {setParam(id,v), dispose()}` en lugar de create/step/draw y usar Three.js.
**Presets obligatorios** (los content agents solo pueden referenciar estos ids; si un chapter necesita otro, usa `generico`):
- Química (`js/anim/quimica.js`): `concentracion`, `dilucion` (C₁V₁=C₂V₂), `masa-molar` (n=m/M), `ph` (pH=−log[H₃O⁺], escala de color + iones), `acido-base` (par ácido/base, Ka, pKa, diagrama de predominio), `titrage` (curva pH vs V + equivalencia, color del indicador), `conductimetria` (σ=Σλᵢ[Xᵢ]), `beer-lambert` (A=εℓc), `avance` (tableau d'avancement x, reactivos↔productos), `quotient-equilibre` (Qr vs K, sentido de evolución, moléculas), `cinetica` (v, orden 1, t½, concentración vs t), `pila` (electrones, ánodo/cátodo, puente salino), `radioactividad` (N=N₀e^(−λt), t½, núcleos que decaen), `gas-ideal-quimico` (cantidad de gas, volumen molar) y `generico`.
- Física (`js/anim/fisica.js`): `cinematica` (v=Δx/Δt, vectores v y a), `newton2` (ΣF=ma, bloque, fuerzas), `proyectil` (campo uniforme/tiro parabólico, g, v₀, α), `carga-campo` (electrón/protón en campo eléctrico uniforme, F=qE), `gravitacion` (F=GmM/r², órbitas, leyes de Kepler), `arquimedes` (Π=ρVg, flotación), `bernoulli` (continuidad + Bernoulli, tubo y velocidad), `torricelli` (chorro de agua), `gas-ideal` (PV=nRT, partículas en caja con pistón y T), `termodinamica` (ΔU=W+Q, pistón, transferencias), `enfriamiento-newton` (T(t) exponencial), `ondas` (λ=v/f, onda viajera, atenuación dB), `difraccion` (θ=λ/a, interferencias de dos fuentes), `doppler`, `lente` (relación de conjugación, rayos, imagen), `fotones` (E=hν, efecto fotoeléctrico), `condensador-rc` (circuito RC, τ=RC, carga/descarga) y `energia-mecanica` (Ec, Ep, Em).
**IDs de parámetros canónicos** (los presets DEBEN aceptar estos ids; pueden añadir más opcionales; los capítulos solo usan estos en `animacion.params`):
`concentracion{n mol,V L}` · `dilucion{C0 mol/L,V0 mL,Vf mL}` · `masa-molar{m g,M g/mol}` · `ph{pH}` · `acido-base{pKa,pH}` · `titrage{Ca,Va mL,Cb}` · `conductimetria{c mmol/L}` · `beer-lambert{eps,l cm,c}` · `avance{x mol,n1 mol,n2 mol}` · `quotient-equilibre{K,Q}` · `cinetica{c0,k,t}` · `radioactividad{N0,lam,t}` · `gas-ideal-quimico{n mol,T K,P kPa}` · `cinematica{v m/s,t s}` · `newton2{m kg,F N}` · `proyectil{v0 m/s,alpha °,g m/s²}` · `carga-campo{E V/m,v0 m/s}` · `gravitacion{M,r}` · `arquimedes{rho kg/m³,V m³}` · `bernoulli{v1,S1,S2}` · `torricelli{h m}` · `gas-ideal{n,T,V}` · `termodinamica{Q J,W J}` · `enfriamiento-newton{T0,Text,tau}` · `ondas{f Hz,v m/s}` · `difraccion{lam nm,a µm}` · `doppler{f0,vs}` · `lente{f cm,OA cm}` · `fotones{nu THz,W0 eV}` · `condensador-rc{R Ω,C µF,E V}` · `energia-mecanica{m,h,v}`.
Los archivos de presets son 4: `js/anim/10-quimica-a.js`, `11-quimica-b.js`, `20-fisica-a.js`, `21-fisica-b.js` (cada uno autocontenido; copia los helpers pequeños que necesites). Cada agente de ANIM deja documentados en un comentario de cabecera los params exactos de sus presets.
- `generico` (en anim-core.js): `params.expr` (JS seguro sobre variables), sliders para las variables, gráfica y vs x. Se usa cuando no hay preset específico.

Cada preset: visual **atractivo y fiel a la física/química** (vaso con vidrio y menisco, moléculas con movimiento browniano, burbujas, colores…), 60 fps, ligero, respeta `PCB.util.reducedMotion()` (menos partículas, sin shake), legible en pantalla pequeña (canvas responsivo).

## 8. Estética general
- Mundos: física azul eléctrico (`#2f6bff`/`#00d4ff`), química verde+magenta (`#2ee59d`/`#ff3da6`), energía naranja/ámbar, ondas violeta/cian. Tokens en `css/base.css` (`--c-fisica`, `--c-quimica`…).
- HUD del juego en `PixelHUD`; estudio en `Estudio` (serif) + `UI`.
- Respetar `prefers-reduced-motion` y el ajuste `PCB.settings.reducirAnimaciones`.
- Protagonista: **"Ato"**, robot-científico redondo con casco-burbuja y un átomo orbitando sobre la cabeza (dibujado por código, sin imágenes externas). Lo comparten mapa (figura simple 3D) y juego (sprite 2D en canvas).

## 9. Propiedad de archivos
**Carga de scripts**: `js/loader.js` pide `/api/scripts` y carga `core.js`, `anim-core.js`, luego **todos los `js/<carpeta>/*.js` en orden alfabético** (usa prefijos `00-`, `10-`… para el orden dentro de tu carpeta) y al final los `.js` sueltos de `js/` (p. ej. `mapa.js`). Los `css/*.css` se cargan solos. **Prueba siempre con `node server.js`** (puerto 3000; usa `PORT=31xx node server.js` si hay otro agente probando a la vez).
Nombres de archivo definitivos: INTRO-A → `js/intro/00-engine.js`, `10-monigotes.js`, `20-minimalista.js`; INTRO-B → `30-matrix.js`, `40-quimica3d.js`, `50-fisica3d.js`; ANIM → `js/anim/quimica.js`, `js/anim/fisica.js`.
El orquestador ya aporta: barra superior global (← Mapa, "Saltar juego", "Saltar intro", XP, racha, reducir animaciones) y todo el flujo `PCB.flow.*`; las pantallas **no** deben duplicarlos. El estudio debe ofrecer su propio botón de volver al mapa vía `PCB.flow.volverMapa()` si quiere.

| Agente | Posee |
|---|---|
| ORQUESTADOR | index.html, server.js, iniciar.*, css/base.css, js/core.js, js/anim-core.js, CONTRATO.md |
| MAPA | js/mapa.js, css/mapa.css |
| JUEGO | js/juego/*, css/juego.css, js/juego/README.md |
| INTRO-A | js/intro/engine.js, js/intro/monigotes.js, js/intro/minimalista.js, css/intro.css |
| INTRO-B | js/intro/matrix.js, js/intro/quimica3d.js, js/intro/fisica3d.js |
| ESTUDIO | js/estudio/*, css/estudio.css |
| ANIM-QUIM-A | js/anim/10-quimica-a.js: concentracion, dilucion, masa-molar, ph, acido-base, titrage, conductimetria |
| ANIM-QUIM-B | js/anim/11-quimica-b.js: beer-lambert, avance, quotient-equilibre, cinetica, pila, radioactividad, gas-ideal-quimico |
| ANIM-FIS-A | js/anim/20-fisica-a.js: cinematica, newton2, proyectil, carga-campo, gravitacion, energia-mecanica, arquimedes, torricelli, gas-ideal |
| ANIM-FIS-B | js/anim/21-fisica-b.js: bernoulli, termodinamica, enfriamiento-newton, ondas, difraccion, doppler, lente, fotones, condensador-rc |
| CONTENIDO-NN | contenido/{capitulos,niveles,intros,quizzes}/<sus ids>.json |

Nunca edites archivos ajenos; si encuentras un bug en ellos, repórtalo en tu mensaje final. No hagas `git commit`/`push` (lo hace el orquestador). Prueba tu módulo con Playwright (ya instalado: `require('playwright')`, `chromium.launch()`), sirviendo la carpeta con `node server.js` o `python3 -m http.server`. Código **claro y comentado en español**.
