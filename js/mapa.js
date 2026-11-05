// =====================================================================================
// mapa.js — Pantalla 1: MAPA DE MUNDOS EN 3D (Three.js clásico, global THREE)
//
//  · 4 islas flotantes (una por mundo) unidas por un camino de baldosas que pasa por los
//    20 capítulos en orden. Cada capítulo es una torre/matraz (o un mini castillo con lava
//    si es fortaleza: caps 1, 10, 15, 17, 20) con su número flotando encima.
//  · Estado de cada nodo leído de PCB.store.cap(id): disponible · completado · dominado.
//    Sin contenido generado (PCB.data.disponibles()) → apagado, con candado, no clicable.
//  · "Ato", el protagonista (robot-científico con casco-burbuja y un átomo orbitando),
//    camina por el camino hasta el nodo elegido y luego se llama PCB.flow.entrarCapitulo.
//  · Cámara orbital con parallax, arrastre / rueda / pellizco, botones por mundo.
//  · Panel lateral (XP, racha, progreso, respaldo, leyenda) y "Vista lista" accesible.
//  · Rendimiento: pixelRatio ≤ 2, 30 fps en reposo, pausa con pestaña oculta,
//    prefers-reduced-motion respetado, unmount() libera TODO.
//
// Registro: PCB.screens.mapa = { mount(host, ctx), unmount() }
// Utilidad para pruebas: PCB.mapa.pantallaDe(id) → {x,y} (px de cliente del nodo).
// =====================================================================================
(function () {
  'use strict';
  const PCB = (window.PCB = window.PCB || {});
  PCB.screens = PCB.screens || {};

  // ---------------------------------------------------------------------------------
  // Datos fijos del mapa
  // ---------------------------------------------------------------------------------
  /** Capítulos con fortaleza (mini castillo + lava + jefe Rey Entropía) */
  const FORTALEZAS = new Set([1, 10, 15, 17, 20]);
  const CLAVE_ATO = 'pcb_mapa_ato'; // último capítulo visitado (para que Ato reaparezca ahí)

  /**
   * Layout de cada isla: centro [x,y,z], radio R y posición local [x,z] de cada nodo
   * (en el orden de los capítulos del mundo). El camino une todo en una sola curva.
   */
  const MUNDOS = {
    constitucion: {
      corto: 'Materia', tok: ['--c-quimica', '--c-quimica2'], def: ['#2ee59d', '#ff3da6'],
      centro: [-34, 0, 8], R: 19,
      nodos: [[-9, 9], [-3, 9], [3, 9], [8, 0], [2.5, 0], [-4, 0], [-10, -9], [-3.5, -9], [3, -9]],
    },
    mouvement: {
      corto: 'Movimiento', tok: ['--c-fisica', '--c-fisica2'], def: ['#2f6bff', '#00d4ff'],
      centro: [-2, 5, -36], R: 16,
      nodos: [[-11, 6], [-5, 0], [1, 5], [6, -2], [10, -7]],
    },
    energie: {
      corto: 'Energía', tok: ['--c-energia', '--c-energia2'], def: ['#ff9f1c', '#ffd166'],
      centro: [32, 9, -40], R: 11,
      nodos: [[-5, 3], [4, -3]],
    },
    ondes: {
      corto: 'Ondas', tok: ['--c-ondas', '--c-ondas2'], def: ['#9b5de5', '#4cc9f0'],
      centro: [44, 16, -8], R: 15,
      nodos: [[3, -9], [-4, -4], [3, 1], [-2, 8]],
    },
  };
  const ORDEN_MUNDOS = ['constitucion', 'mouvement', 'energie', 'ondes'];
  const TXT_ESTADO = { bloqueado: 'En preparación', disponible: 'Disponible', completado: 'Completado', dominado: 'Dominado' };

  /** Último nodo visitado (sobrevive a desmontar / montar el mapa) */
  let ultimoId = null;
  try { ultimoId = localStorage.getItem(CLAVE_ATO); } catch (e) { /* sin storage */ }

  let instancia = null;   // mapa activo
  let tokenMontaje = 0;   // evita carreras si se desmonta mientras se carga

  // ---------------------------------------------------------------------------------
  // Utilidades pequeñas
  // ---------------------------------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const h = (...a) => PCB.util.el(...a);
  const lienzo = (w, hh) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; return c; };
  /** Fija --a/--b (colores del mundo) en un elemento: PCB.util.el no admite variables CSS en style */
  const colorear = (el, pal) => { if (pal) { el.style.setProperty('--a', pal.a); el.style.setProperty('--b', pal.b); } return el; };
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  // =================================================================================
  // CREACIÓN DEL MAPA
  // =================================================================================
  function crearMapa(host, indice, disponibles) {
    const T = THREE;
    const liberables = [];             // todo lo que hay que .dispose() al desmontar
    const reg = (o) => (liberables.push(o), o);
    const animados = [];               // funciones (t, dt) que animan decoración
    const limpiezas = [];              // funciones a ejecutar al desmontar (listeners…)
    let destruido = false;

    // ---------- estado de ejecución ----------
    let rm = PCB.util.reducedMotion();           // reduced motion (se refresca cada medio segundo)
    let dirty = true;                            // en modo reducido solo se pinta si algo cambió
    let tiempo = 0;                              // segundos de animación
    let raf = 0, ultimoFrame = 0, ultimaInteraccion = performance.now();
    let listaVisible = false;
    let viaje = null;                            // viaje de Ato en curso
    let hover = null;                            // nodo bajo el puntero
    let tooltipNodo = null, tooltipFijo = false, tooltipTimer = 0;
    let firmaEstados = '';
    let mundoActivo = '';
    let msFrame = [0, 0];
    let contadorFrames = 0;                      // frames pintados (para pruebas)

    // =============================================================================
    // Renderer, escena, cámara
    // =============================================================================
    const canvasHost = h('div', { class: 'mapa-lienzo' });
    host.append(canvasHost);
    const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x0a0f22, 1);
    const canvas = renderer.domElement;
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Mapa 3D de mundos con 20 capítulos. Para navegar con teclado usa el botón Vista lista. Flechas: girar; más y menos: zoom.');
    canvasHost.append(canvas);

    const scene = new T.Scene();
    scene.fog = new T.FogExp2(0x0c1230, 0.0042);
    const camera = new T.PerspectiveCamera(45, 1, 0.5, 1500);

    // ---------- helpers de materiales / mallas (todo se registra para liberarlo) ----------
    const stdM = (o) => reg(new T.MeshStandardMaterial(o));
    const basM = (o) => reg(new T.MeshBasicMaterial(o));
    const mesh = (g, m) => new T.Mesh(reg(g), m);
    const canvasTex = (c, srgb = true) => {
      const t = reg(new T.CanvasTexture(c));
      if (srgb) t.colorSpace = T.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };

    // ---------- paleta por mundo (desde los tokens CSS) ----------
    const css = getComputedStyle(document.documentElement);
    const PAL = {};
    for (const id of ORDEN_MUNDOS) {
      const m = MUNDOS[id];
      PAL[id] = { a: css.getPropertyValue(m.tok[0]).trim() || m.def[0], b: css.getPropertyValue(m.tok[1]).trim() || m.def[1] };
    }

    // ---------- texturas compartidas ----------
    // Brillo radial (falso bloom): se tiñe con SpriteMaterial.color
    const texGlow = (() => {
      const c = lienzo(128, 128), g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,.55)');
      gr.addColorStop(0.55, 'rgba(255,255,255,.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      return canvasTex(c);
    })();
    // Punto redondo para partículas y estrellas
    const texPunto = (() => {
      const c = lienzo(64, 64), g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return canvasTex(c);
    })();
    // Sombra de contacto suave bajo las torres
    const texSombra = (() => {
      const c = lienzo(64, 64), g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(0,0,0,.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return canvasTex(c);
    })();
    // Estrella dorada (progreso 0-3) y flecha "siguiente"
    const texEstrella = (() => {
      const c = lienzo(64, 64), g = c.getContext('2d');
      g.translate(32, 33); g.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 27, a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fillStyle = '#ffd166'; g.shadowColor = '#ffb703'; g.shadowBlur = 8; g.fill();
      g.lineWidth = 2.5; g.strokeStyle = '#b8750a'; g.stroke();
      return canvasTex(c);
    })();
    const texFlecha = (() => {
      const c = lienzo(96, 96), g = c.getContext('2d');
      g.beginPath(); g.moveTo(48, 84); g.lineTo(14, 36); g.lineTo(34, 36); g.lineTo(34, 8); g.lineTo(62, 8); g.lineTo(62, 36); g.lineTo(82, 36); g.closePath();
      g.fillStyle = '#ffd166'; g.shadowColor = '#ffb703'; g.shadowBlur = 12; g.fill(); g.lineWidth = 3; g.strokeStyle = '#b8750a'; g.stroke();
      return canvasTex(c);
    })();
    // Lava animada (se desplaza el offset)
    const texLava = (() => {
      const c = lienzo(256, 256), g = c.getContext('2d'), rnd = PCB.util.rng(77);
      g.fillStyle = '#c13a06'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 70; i++) {
        const x = rnd() * 256, y = rnd() * 256, r = 8 + rnd() * 26;
        for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { // envuelve para que sea teselable
          const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
          const caliente = rnd() > 0.45;
          gr.addColorStop(0, caliente ? 'rgba(255,200,60,.95)' : 'rgba(70,14,4,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
        }
      }
      const t = canvasTex(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1.4, 1.4);
      return t;
    })();

    // ---------- sprites ----------
    const sprGlow = (color, escala, opacidad) => {
      const m = reg(new T.SpriteMaterial({ map: texGlow, color, transparent: true, opacity: opacidad, blending: T.AdditiveBlending, depthWrite: false }));
      const s = new T.Sprite(m); s.scale.set(escala, escala, 1); return s;
    };

    // =============================================================================
    // Cielo, estrellas, nebulosas, partículas
    // =============================================================================
    // Esfera de cielo con degradado vertical (vertex colors, sin niebla)
    {
      const g = reg(new T.SphereGeometry(700, 24, 16));
      const col = [], pos = g.attributes.position, cA = new T.Color(0x05081a), cB = new T.Color(0x1d1646), cC = new T.Color(0x0a1230), c = new T.Color();
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / 700;
        if (y > 0) c.copy(cB).lerp(cA, Math.pow(y, 0.6)); else c.copy(cB).lerp(cC, Math.pow(-y, 0.7));
        col.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      scene.add(new T.Mesh(g, basM({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false })));
    }
    // Estrellas lejanas
    const estrellas = (() => {
      const n = 1700, rnd = PCB.util.rng(11), p = new Float32Array(n * 3), c = new Float32Array(n * 3);
      const tintes = [new T.Color(0xffffff), new T.Color(0xaec6ff), new T.Color(0xffd9f0), new T.Color(0xbdf4ff)];
      for (let i = 0; i < n; i++) {
        const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = 420 + rnd() * 120, s = Math.sqrt(1 - u * u);
        p[i * 3] = Math.cos(a) * s * r; p[i * 3 + 1] = u * r; p[i * 3 + 2] = Math.sin(a) * s * r;
        const t = tintes[Math.floor(rnd() * tintes.length)], b = 0.55 + rnd() * 0.45;
        c[i * 3] = t.r * b; c[i * 3 + 1] = t.g * b; c[i * 3 + 2] = t.b * b;
      }
      const g = reg(new T.BufferGeometry());
      g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('color', new T.BufferAttribute(c, 3));
      const pts = new T.Points(g, reg(new T.PointsMaterial({ size: 2.6, map: texPunto, vertexColors: true, transparent: true, depthWrite: false, fog: false, sizeAttenuation: true })));
      scene.add(pts); return pts;
    })();
    // Nebulosas: sprites enormes y tenues en colores de cada mundo (atmósfera / bloom falso)
    [[-150, 30, -40, 'constitucion', 260], [-20, 60, -170, 'mouvement', 240], [120, 70, -90, 'energie', 230], [150, 40, 40, 'ondes', 260], [-40, -60, 60, 'ondes', 200]]
      .forEach(([x, y, z, mundo, e]) => {
        const s = sprGlow(PAL[mundo].a, e, 0.16); s.material.fog = false; s.position.set(x, y, z); scene.add(s);
      });
    // Motas de polvo / chispas que suben lentamente por el mapa
    const motas = (() => {
      const n = 320, rnd = PCB.util.rng(5), p = new Float32Array(n * 3), v = new Float32Array(n), c = new Float32Array(n * 3);
      const tint = ORDEN_MUNDOS.map((id) => new T.Color(PAL[id].b));
      for (let i = 0; i < n; i++) {
        p[i * 3] = -60 + rnd() * 125; p[i * 3 + 1] = -6 + rnd() * 36; p[i * 3 + 2] = -62 + rnd() * 95; v[i] = 0.25 + rnd() * 0.6;
        const t = tint[Math.floor(rnd() * 4)]; c[i * 3] = t.r; c[i * 3 + 1] = t.g; c[i * 3 + 2] = t.b;
      }
      const g = reg(new T.BufferGeometry());
      g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('color', new T.BufferAttribute(c, 3));
      const pts = new T.Points(g, reg(new T.PointsMaterial({ size: 0.55, map: texPunto, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending })));
      scene.add(pts); return { pts, p, v, n };
    })();

    // =============================================================================
    // Iluminación
    // =============================================================================
    scene.add(new T.HemisphereLight(0xa9bdff, 0x2c1e52, 1.05));
    const sol = new T.DirectionalLight(0xfff0dd, 1.5); sol.position.set(-60, 90, 70); scene.add(sol);
    // Una luz puntual tintada por isla (da vida de color a las torres)
    for (const id of ORDEN_MUNDOS) {
      const m = MUNDOS[id], l = new T.PointLight(PAL[id].a, 55, 46, 1.6);
      l.position.set(m.centro[0], m.centro[1] + 9, m.centro[2]); scene.add(l);
    }

    // =============================================================================
    // Nodos (datos) y colocación sobre las islas
    // =============================================================================
    const hayDisp = disponibles && Array.isArray(disponibles.capitulos) ? new Set(disponibles.capitulos) : null;
    const nodos = [];
    const porMundo = {};
    indice.capitulos.forEach((cap) => {
      (porMundo[cap.mundo] ||= []).push(cap);
    });
    for (const idM of ORDEN_MUNDOS) {
      const M = MUNDOS[idM], lista = porMundo[idM] || [];
      lista.forEach((cap, k) => {
        let lx, lz;
        if (M.nodos[k]) [lx, lz] = M.nodos[k];
        else { const a = k * 2.4; lx = Math.cos(a) * M.R * 0.5; lz = Math.sin(a) * M.R * 0.5; } // respaldo si el índice crece
        nodos.push({
          id: cap.id, num: cap.num, titulo: cap.titulo, materia: cap.materia, mundo: idM,
          fort: FORTALEZAS.has(cap.num),
          disp: hayDisp ? hayDisp.has(cap.id) : true, // si no se pudo consultar, no bloqueamos nada
          pos: new T.Vector3(M.centro[0] + lx, M.centro[1] + 0.12, M.centro[2] + lz),
          estado: 'disponible', lift: 0, liftObj: 0,
        });
      });
    }
    nodos.sort((a, b) => a.num - b.num);
    const porId = new Map(nodos.map((n) => [n.id, n]));

    // =============================================================================
    // Camino: curva Catmull-Rom por todos los nodos (con 2 puntos intermedios en los puentes)
    // =============================================================================
    const ctrl = [];
    nodos.forEach((n, i) => {
      if (i > 0 && n.mundo !== nodos[i - 1].mundo) {
        const a = nodos[i - 1].pos, b = n.pos;
        for (const f of [1 / 3, 2 / 3]) {
          const s = f * f * (3 - 2 * f); // suaviza el cambio de altura
          ctrl.push({ p: new T.Vector3(lerp(a.x, b.x, f), lerp(a.y, b.y, s) + Math.sin(f * Math.PI) * 1.2, lerp(a.z, b.z, f)), nodo: null });
        }
      }
      ctrl.push({ p: n.pos, nodo: n });
    });
    const curva = new T.CatmullRomCurve3(ctrl.map((c) => c.p), false, 'centripetal');
    const DIV = 3000;
    curva.arcLengthDivisions = DIV;
    const largos = curva.getLengths(DIV);
    const LARGO = largos[largos.length - 1];
    ctrl.forEach((c, i) => {
      if (!c.nodo) return;
      const f = (i / (ctrl.length - 1)) * DIV, i0 = Math.floor(f);
      c.nodo.u = lerp(largos[i0], largos[Math.min(DIV, i0 + 1)], f - i0) / LARGO; // posición del nodo en [0,1] por longitud de arco
    });
    const puntoEn = (u, out) => curva.getPointAt(clamp(u, 0, 1), out || new T.Vector3());
    const tangenteEn = (u) => curva.getTangentAt(clamp(u, 0, 1), new T.Vector3());

    // Muestras XZ del camino (para colocar decoración sin pisarlo)
    const muestras = [];
    for (let i = 0; i <= 500; i++) muestras.push(puntoEn(i / 500));
    const libreDeCamino = (x, z, d) => muestras.every((p) => Math.hypot(p.x - x, p.z - z) > d);

    // Lado donde se levanta la torre de cada nodo (hacia el interior de la isla) y su posición
    nodos.forEach((n) => {
      const M = MUNDOS[n.mundo], tg = tangenteEn(n.u);
      let nx = -tg.z, nz = tg.x; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      const haciaCentro = (M.centro[0] - n.pos.x) * nx + (M.centro[2] - n.pos.z) * nz;
      if (haciaCentro < 0) { nx = -nx; nz = -nz; }
      n.lado = new T.Vector3(nx, 0, nz);
      n.escala = n.fort ? 1.12 : 1.35;   // las torres se ven más grandes
      n.off = n.fort ? 3.4 : 2.15;
      n.torrePos = n.pos.clone().addScaledVector(n.lado, n.off);
    });

    // =============================================================================
    // Islas flotantes
    // =============================================================================
    function crearIsla(idM, k) {
      const M = MUNDOS[idM], pal = PAL[idM], R = M.R;
      const g = new T.Group(); g.position.set(M.centro[0], M.centro[1], M.centro[2]); scene.add(g);
      // forma irregular del borde (función del ángulo → coincide entre la tapa y el cuerpo)
      const fb = (th) => 1 + 0.05 * Math.sin(3 * th + k * 5) + 0.035 * Math.sin(5 * th + k * 9 + 1.2) + 0.02 * Math.sin(9 * th + k * 2.3);
      const SEG = 64;

      // Tapa superior con rejilla "laboratorio neón"
      const cv = lienzo(256, 256), cx = cv.getContext('2d'), ca = new T.Color(pal.a);
      cx.fillStyle = `rgb(${Math.round(14 + ca.r * 16)},${Math.round(22 + ca.g * 16)},${Math.round(40 + ca.b * 18)})`; cx.fillRect(0, 0, 256, 256);
      for (let i = 0; i <= 8; i++) {
        cx.strokeStyle = pal.a; cx.globalAlpha = i % 4 === 0 ? 0.75 : 0.28; cx.lineWidth = i % 4 === 0 ? 3 : 1.5;
        const v = i * 32; cx.beginPath(); cx.moveTo(v, 0); cx.lineTo(v, 256); cx.moveTo(0, v); cx.lineTo(256, v); cx.stroke();
      }
      cx.globalAlpha = 1;
      const tg = canvasTex(cv); tg.wrapS = tg.wrapT = T.RepeatWrapping; tg.repeat.set(R / 4, R / 4);
      const gTop = new T.CircleGeometry(R, SEG); gTop.rotateX(-Math.PI / 2);
      for (let i = 0; i < gTop.attributes.position.count; i++) {
        const x = gTop.attributes.position.getX(i), z = gTop.attributes.position.getZ(i), f = fb(Math.atan2(z, x));
        gTop.attributes.position.setX(i, x * f); gTop.attributes.position.setZ(i, z * f);
      }
      g.add(mesh(gTop, stdM({ map: tg, emissiveMap: tg, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.85, metalness: 0.05 })));

      // Cuerpo de roca (lathe con ruido) coloreado por profundidad
      const perfil = [[R, 0], [R * 1.0, -0.6], [R * 0.9, -1.8], [R * 0.74, -3.6], [R * 0.54, -6.2], [R * 0.36, -9.4], [R * 0.2, -13], [0.001, -16.5]]
        .map(([r, y]) => new T.Vector2(r, y));
      const gB = new T.LatheGeometry(perfil, SEG);
      const pos = gB.attributes.position, col = [], cRoca = new T.Color(0x3a3f66).lerp(new T.Color(pal.a), 0.12), cFondo = new T.Color(0x151a36), cc = new T.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), th = Math.atan2(z, x);
        const ruido = y < -0.7 ? 1 + 0.1 * Math.sin(th * 7 + y * 1.3 + k) * Math.cos(th * 3 - y * 0.6) : 1;
        const f = fb(th) * ruido;
        pos.setXYZ(i, x * f, y + (y < -0.7 && y > -16 ? 0.5 * Math.sin(th * 5 + y) : 0), z * f);
        cc.copy(cRoca).lerp(cFondo, clamp(-y / 15, 0, 1)); col.push(cc.r, cc.g, cc.b);
      }
      gB.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      g.add(mesh(gB, stdM({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 })));

      // Borde de neón alrededor de la tapa
      const gR = new T.RingGeometry(R * 0.985, R * 1.012, SEG, 1); gR.rotateX(-Math.PI / 2);
      for (let i = 0; i < gR.attributes.position.count; i++) {
        const x = gR.attributes.position.getX(i), z = gR.attributes.position.getZ(i), f = fb(Math.atan2(z, x));
        gR.attributes.position.setX(i, x * f); gR.attributes.position.setZ(i, z * f);
      }
      gR.translate(0, 0.04, 0);
      g.add(mesh(gR, basM({ color: pal.a, transparent: true, opacity: 0.9 })));

      // Resplandor bajo la isla (energía que la mantiene flotando)
      const glow = sprGlow(pal.a, R * 2.3, 0.28); glow.position.y = -9; g.add(glow);

      // Rocas flotantes que orbitan lentamente alrededor
      const rnd = PCB.util.rng(100 + k), matRoca = stdM({ color: 0x4a5080, flatShading: true, roughness: 0.9 });
      for (let i = 0; i < 7; i++) {
        const a = rnd() * Math.PI * 2, r = R * (1.12 + rnd() * 0.3), s = 0.4 + rnd() * 1.1;
        const roca = mesh(new T.IcosahedronGeometry(s, 0), matRoca);
        const y0 = -3 + rnd() * 6, ph = rnd() * 6;
        roca.position.set(Math.cos(a) * r, y0, Math.sin(a) * r); roca.rotation.set(rnd() * 3, rnd() * 3, 0);
        g.add(roca);
        animados.push((t) => { roca.position.y = y0 + Math.sin(t * 0.5 + ph) * 0.6; roca.rotation.y += 0.002; });
      }
      return g;
    }
    const islas = {};
    ORDEN_MUNDOS.forEach((id, k) => { islas[id] = crearIsla(id, k); });

    // =============================================================================
    // Decoración temática de cada isla (lejos del camino y de las torres)
    // =============================================================================
    function decorar(idM, k) {
      const M = MUNDOS[idM], pal = PAL[idM], rnd = PCB.util.rng(900 + k * 17), g = islas[idM];
      const libre = (x, z, d = 3.2) => libreDeCamino(M.centro[0] + x, M.centro[2] + z, d)
        && nodos.every((n) => Math.hypot(n.torrePos.x - (M.centro[0] + x), n.torrePos.z - (M.centro[2] + z)) > d + 1.4);
      const lugar = (rmin, rmax, d) => {
        for (let i = 0; i < 60; i++) {
          const a = rnd() * Math.PI * 2, r = (rmin + rnd() * (rmax - rmin)) * M.R;
          const x = Math.cos(a) * r, z = Math.sin(a) * r;
          if (libre(x, z, d)) return [x, z];
        }
        return null;
      };
      const emis = (c, i = 0.7, extra = {}) => stdM({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.35, ...extra });
      const geoOct = reg(new T.OctahedronGeometry(1, 0)), geoCono = reg(new T.ConeGeometry(1, 1, 8, 1, true));
      const nDec = 9;
      for (let i = 0; i < nDec; i++) {
        const p = lugar(0.3, 0.88, 2.8); if (!p) continue;
        const grupo = new T.Group(); grupo.position.set(p[0], 0.05, p[1]); g.add(grupo);
        const ph = rnd() * 6;
        if (idM === 'constitucion') {
          if (i % 3 === 0) { // molécula flotante: 3 átomos + 2 enlaces
            const cols = [0xffffff, pal.a, pal.b], ps = [[0, 0, 0], [0.9, 0.4, 0], [-0.8, 0.5, 0.3]];
            ps.forEach((q, j) => { const s = mesh(new T.SphereGeometry(j === 0 ? 0.42 : 0.3, 14, 10), emis(cols[j], 0.45)); s.position.set(...q); grupo.add(s); });
            [1, 2].forEach((j) => {
              const q = new T.Vector3(...ps[j]), b = mesh(new T.CylinderGeometry(0.06, 0.06, q.length(), 6), stdM({ color: 0xcfd8ff }));
              b.position.copy(q).multiplyScalar(0.5); b.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), q.clone().normalize()); grupo.add(b);
            });
            grupo.position.y = 3.2;
            animados.push((t) => { grupo.rotation.y = t * 0.4 + ph; grupo.position.y = 3.2 + Math.sin(t * 0.8 + ph) * 0.35; });
          } else { // racimo de cristales
            for (let j = 0; j < 3; j++) {
              const c = mesh(geoOct, emis(j % 2 ? pal.b : pal.a, 0.55, { transparent: true, opacity: 0.92 }));
              const s = 0.5 + rnd() * 0.5; c.scale.set(s * 0.45, s * 1.5, s * 0.45);
              c.position.set((rnd() - 0.5) * 1.2, s * 1.4, (rnd() - 0.5) * 1.2); c.rotation.set((rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4);
              grupo.add(c);
            }
          }
        } else if (idM === 'mouvement') { // pilón con anillo giratorio
          const poste = mesh(new T.CylinderGeometry(0.14, 0.2, 2.6, 8), stdM({ color: 0x5a6aa8, roughness: 0.5, emissive: 0x16204a, emissiveIntensity: 0.6 })); poste.position.y = 1.3; grupo.add(poste);
          const anillo = mesh(new T.TorusGeometry(0.62, 0.07, 8, 28), emis(i % 2 ? pal.b : pal.a, 0.9)); anillo.position.y = 2.1; anillo.rotation.x = Math.PI / 2.4; grupo.add(anillo);
          const punta = mesh(new T.SphereGeometry(0.2, 10, 8), emis(0xffffff, 0.9)); punta.position.y = 2.75; grupo.add(punta);
          animados.push((t) => { anillo.rotation.z = t * 1.2 + ph; });
        } else if (idM === 'energie') { // llamas y chimeneas
          if (i % 3 === 2) {
            const ch = mesh(new T.CylinderGeometry(0.5, 0.75, 2.2, 8), stdM({ color: 0x3a2a30, roughness: 0.8, flatShading: true })); ch.position.y = 1.1; grupo.add(ch);
            const bo = mesh(new T.CylinderGeometry(0.42, 0.42, 0.08, 10), basM({ color: 0xff7a1a })); bo.position.y = 2.22; grupo.add(bo);
          } else {
            const cols = [0xff6a00, 0xffb703, 0xfff1b8], hs = [1.7, 1.2, 0.7], rs = [0.5, 0.34, 0.18], flamas = [];
            cols.forEach((c, j) => { const f = mesh(new T.ConeGeometry(rs[j], hs[j], 8), basM({ color: c })); f.position.y = hs[j] / 2; grupo.add(f); flamas.push(f); });
            const gl = sprGlow(0xff8a1f, 3.4, 0.55); gl.position.y = 0.9; grupo.add(gl);
            animados.push((t) => flamas.forEach((f, j) => { f.scale.y = 1 + 0.18 * Math.sin(t * (7 + j * 2) + ph); f.scale.x = f.scale.z = 1 + 0.08 * Math.sin(t * 9 + ph + j); }));
          }
        } else { // ondes: giroscopio de anillos, onda senoidal flotante, prismas
          if (i % 3 === 0) {
            const pts = []; for (let j = 0; j <= 40; j++) { const x = (j / 40 - 0.5) * 5; pts.push(new T.Vector3(x, Math.sin(x * 2.2) * 0.45, 0)); }
            const onda = mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 60, 0.08, 6), emis(pal.b, 0.9));
            onda.position.y = 3.4; onda.rotation.y = rnd() * 3; grupo.add(onda);
            animados.push((t) => { onda.position.y = 3.4 + Math.sin(t * 0.9 + ph) * 0.3; });
          } else if (i % 3 === 1) {
            const a1 = mesh(new T.TorusGeometry(1.0, 0.06, 8, 36), emis(pal.a, 0.9)), a2 = mesh(new T.TorusGeometry(0.72, 0.05, 8, 32), emis(pal.b, 0.9));
            grupo.add(a1, a2); grupo.position.y = 3.4;
            animados.push((t) => { a1.rotation.set(t * 0.7 + ph, t * 0.4, 0); a2.rotation.set(0.5, t * 0.9 + ph, t * 0.3); grupo.position.y = 3.4 + Math.sin(t * 0.7 + ph) * 0.3; });
          } else {
            const pr = mesh(new T.ConeGeometry(0.55, 1.8, 3), emis(i % 2 ? pal.a : pal.b, 0.7, { transparent: true, opacity: 0.9 })); pr.position.y = 1.0; grupo.add(pr);
            animados.push((t) => { pr.rotation.y = t * 0.6 + ph; });
          }
        }
      }
    }
    ORDEN_MUNDOS.forEach((id, k) => decorar(id, k));

    // =============================================================================
    // Baldosas del camino (InstancedMesh) + cable luminoso. Se recolorean según el progreso.
    // =============================================================================
    const tilesDatos = [];   // {u, mundoId, esPuente}
    const muestraTile = [];  // matrices ya calculadas
    {
      const paso = 0.8, dummy = new T.Object3D(), up = new T.Vector3(0, 1, 0);
      for (let s = 0.2; s < LARGO; s += paso) {
        const u = s / LARGO, p = puntoEn(u), tg = tangenteEn(u);
        // ¿sobre una isla o en un puente?
        let mundoId = null, mejor = 1e9;
        for (const id of ORDEN_MUNDOS) {
          const M = MUNDOS[id], d = Math.hypot(p.x - M.centro[0], p.z - M.centro[2]) / M.R;
          if (d < mejor) { mejor = d; mundoId = id; }
        }
        const puente = mejor > 0.93;
        dummy.position.set(p.x, p.y, p.z);
        dummy.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(tg.x, 0, tg.z).normalize());
        if (tg.y) dummy.rotateX(-Math.atan2(tg.y, Math.hypot(tg.x, tg.z)) * 0.9);
        dummy.scale.set(puente ? 0.9 : 1.55, 1, 0.64);
        dummy.updateMatrix();
        tilesDatos.push({ u, mundoId, puente }); muestraTile.push(dummy.matrix.clone());
      }
    }
    const tiles = new T.InstancedMesh(reg(new T.BoxGeometry(1, 0.13, 1)), basM({ color: 0xffffff }), tilesDatos.length);
    tilesDatos.forEach((_, i) => tiles.setMatrixAt(i, muestraTile[i]));
    tiles.instanceMatrix.needsUpdate = true; tiles.frustumCulled = false; scene.add(tiles);

    // Cable luminoso bajo las baldosas (rellena los huecos y refuerza el neón)
    const cableGeo = reg(new T.TubeGeometry(curva, 900, 0.09, 5, false));
    cableGeo.setAttribute('color', new T.BufferAttribute(new Float32Array(cableGeo.attributes.position.count * 3), 3));
    const cable = new T.Mesh(cableGeo, basM({ vertexColors: true, transparent: true, opacity: 0.9 }));
    cable.position.y = -0.03; scene.add(cable);

    /** Color del camino en u: interpola entre los colores de los mundos de nodos vecinos */
    function colorCamino(u, alt) {
      let i = 0; while (i < nodos.length - 1 && nodos[i + 1].u < u) i++;
      const a = nodos[i], b = nodos[Math.min(i + 1, nodos.length - 1)];
      const f = a === b ? 0 : clamp((u - a.u) / (b.u - a.u), 0, 1);
      const ca = new T.Color(PAL[a.mundo][alt ? 'b' : 'a']), cb = new T.Color(PAL[b.mundo][alt ? 'b' : 'a']);
      return ca.lerp(cb, f);
    }
    /** Ilumina el camino hasta el último nodo completado; el resto queda apagado */
    function pintarCamino() {
      let uLit = 0;
      nodos.forEach((n) => { if (n.estado === 'completado' || n.estado === 'dominado') uLit = Math.max(uLit, n.u); });
      const apagado = new T.Color(0x2a3358), c = new T.Color();
      tilesDatos.forEach((t, i) => {
        const alt = i % 6 === 0;
        c.copy(colorCamino(t.u, alt));
        if (t.u > uLit) c.lerp(apagado, 0.68).multiplyScalar(0.8); else c.multiplyScalar(1.05);
        tiles.setColorAt(i, c);
      });
      tiles.instanceColor.needsUpdate = true;
      const col = cableGeo.attributes.color, np = col.count, seg = 900 + 1; // (tubular+1) anillos de (radial+1) vértices
      const radial = np / seg;
      for (let i = 0; i < seg; i++) {
        const u = i / 900; c.copy(colorCamino(u, false));
        if (u > uLit) c.lerp(apagado, 0.7).multiplyScalar(0.55);
        for (let j = 0; j < radial; j++) col.setXYZ(i * radial + j, c.r, c.g, c.b);
      }
      col.needsUpdate = true; dirty = true;
    }

    // =============================================================================
    // Nodos 3D: torre (matraz o pilón) o mini castillo con lava
    // =============================================================================
    const cacheBadge = new Map();
    function texBadge(num, estado, hex) {
      const clave = `${num}|${estado}|${hex}`;
      if (cacheBadge.has(clave)) return cacheBadge.get(clave);
      const S = 192, c = lienzo(S, S), g = c.getContext('2d');
      const borde = { bloqueado: '#59618a', disponible: hex, completado: '#2ee59d', dominado: '#ffd166' }[estado];
      g.beginPath(); g.arc(96, 96, 84, 0, 7); g.fillStyle = estado === 'bloqueado' ? '#151b33' : '#0b1020'; g.fill();
      g.lineWidth = 12; g.strokeStyle = borde; g.shadowColor = borde; g.shadowBlur = estado === 'bloqueado' ? 0 : 14; g.stroke(); g.shadowBlur = 0;
      g.fillStyle = estado === 'bloqueado' ? '#7d86ad' : '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `700 ${num >= 10 ? 80 : 94}px UI, system-ui, sans-serif`; g.fillText(String(num), 96, 100);
      if (estado !== 'disponible') { // insignia abajo a la derecha
        g.beginPath(); g.arc(150, 150, 33, 0, 7); g.fillStyle = borde; g.fill();
        g.lineWidth = 8; g.strokeStyle = '#0b1020'; g.fillStyle = '#0b1020'; g.lineCap = 'round'; g.lineJoin = 'round';
        if (estado === 'bloqueado') { g.fillRect(137, 148, 26, 19); g.beginPath(); g.arc(150, 148, 9, Math.PI, 0); g.lineWidth = 5; g.stroke(); }
        else if (estado === 'completado') { g.beginPath(); g.moveTo(136, 151); g.lineTo(146, 161); g.lineTo(165, 140); g.stroke(); }
        else { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 7 : 18, a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(150 + Math.cos(a) * r, 152 + Math.sin(a) * r); } g.closePath(); g.fill(); }
      }
      const t = canvasTex(c); cacheBadge.set(clave, t); return t;
    }

    /** Corona dorada que flota sobre los nodos dominados */
    function crearCorona() {
      const g = new T.Group(), oro = stdM({ color: 0xffd166, emissive: 0xffa400, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.7 });
      g.add(mesh(new T.CylinderGeometry(0.34, 0.3, 0.2, 12, 1, true), Object.assign(oro, { side: T.DoubleSide })));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2, c = mesh(new T.ConeGeometry(0.075, 0.28, 6), oro);
        c.position.set(Math.cos(a) * 0.32, 0.22, Math.sin(a) * 0.32); g.add(c);
        const b = mesh(new T.SphereGeometry(0.055, 8, 6), stdM({ color: 0xff3da6, emissive: 0xff3da6, emissiveIntensity: 0.8 }));
        b.position.set(Math.cos(a) * 0.32, 0.38, Math.sin(a) * 0.32); g.add(b);
      }
      g.visible = false; return g;
    }

    function construirNodo(n) {
      const pal = PAL[n.mundo], quim = n.materia === 'chimie';
      // materiales propios del nodo (cambian según el estado)
      const m = n.m = {
        cuerpo: stdM({ color: pal.a, emissive: pal.a, emissiveIntensity: 0.3, roughness: 0.45, metalness: 0.15 }),
        acento: stdM({ color: pal.b, emissive: pal.b, emissiveIntensity: 0.6, roughness: 0.3 }),
        piedra: stdM({ color: 0x2b3560, roughness: 0.8, flatShading: true }),
        vidrio: reg(new T.MeshPhongMaterial({ color: 0xd8ecff, transparent: true, opacity: 0.26, shininess: 90, depthWrite: false, side: T.DoubleSide })),
        liquido: stdM({ color: pal.a, emissive: pal.a, emissiveIntensity: 0.8, roughness: 0.2 }),
        lava: basM({ map: texLava, color: 0xffffff }),
      };
      // --- plataforma circular sobre el camino ---
      const rPad = n.fort ? 1.7 : 2.2;
      const pad = new T.Group(); pad.position.copy(n.pos); scene.add(pad);
      const disco = mesh(new T.CylinderGeometry(rPad, rPad + 0.15, 0.16, 36), m.piedra); disco.position.y = 0.01; pad.add(disco);
      const aro = mesh(new T.TorusGeometry(rPad, 0.045, 6, 48), m.acento); aro.rotation.x = Math.PI / 2; aro.position.y = 0.09; pad.add(aro);
      n.pad = pad;

      // --- torre / castillo (grupo que se levanta al pasar el ratón) ---
      const grupo = n.grupo = new T.Group(); grupo.position.copy(n.torrePos); scene.add(grupo);
      grupo.rotation.y = Math.atan2(-n.lado.x, -n.lado.z); // la "cara" mira al camino
      const sombra = new T.Mesh(reg(new T.PlaneGeometry(n.fort ? 6 : 4.4, n.fort ? 6 : 4.4)), basM({ map: texSombra, transparent: true, depthWrite: false }));
      sombra.rotation.x = -Math.PI / 2; sombra.position.copy(n.torrePos); sombra.position.y += 0.03; scene.add(sombra);

      if (n.fort) {
        // === mini castillo sobre piedra, rodeado de un foso de lava ===
        const lava = mesh(new T.CircleGeometry(2.3, 32), m.lava); lava.rotation.x = -Math.PI / 2; lava.position.copy(n.torrePos); lava.position.y += 0.07; scene.add(lava);
        const brillo = sprGlow(0xff7a1a, 8, 0.5); brillo.position.copy(n.torrePos); brillo.position.y += 1.2; scene.add(brillo);
        n.brilloLava = brillo;
        // tablones que cruzan la lava hacia la puerta
        for (let i = 0; i < 3; i++) {
          const tab = mesh(new T.BoxGeometry(0.9, 0.08, 0.34), stdM({ color: 0x6b4a2f, roughness: 0.9 }));
          tab.position.copy(n.torrePos).addScaledVector(n.lado, -(1.2 + i * 0.42)); tab.position.y += 0.13; tab.rotation.y = Math.atan2(n.lado.x, n.lado.z) + Math.PI / 2; scene.add(tab);
        }
        const base = mesh(new T.CylinderGeometry(1.2, 1.35, 0.5, 10), m.piedra); base.position.y = 0.25; grupo.add(base);
        const keep = mesh(new T.BoxGeometry(1.5, 1.8, 1.5), m.cuerpo); keep.position.y = 0.5 + 0.9; grupo.add(keep);
        for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { // 4 torreones con techo cónico
          const t = mesh(new T.CylinderGeometry(0.33, 0.38, 2.4, 10), m.cuerpo); t.position.set(sx * 0.85, 1.7, sz * 0.85); grupo.add(t);
          const te = mesh(new T.ConeGeometry(0.46, 0.7, 10), m.acento); te.position.set(sx * 0.85, 3.25, sz * 0.85); grupo.add(te);
        }
        for (let i = 0; i < 8; i++) { // almenas entre torreones
          const a = (i / 8) * Math.PI * 2, al = mesh(new T.BoxGeometry(0.26, 0.28, 0.26), m.cuerpo);
          al.position.set(Math.cos(a) * 0.62, 2.44, Math.sin(a) * 0.62); grupo.add(al);
        }
        const puerta = mesh(new T.BoxGeometry(0.55, 0.9, 0.06), basM({ color: 0xff8a1f })); puerta.position.set(0, 0.95, 0.77); grupo.add(puerta);
        const mastil = mesh(new T.CylinderGeometry(0.03, 0.03, 1, 6), m.piedra); mastil.position.set(0, 3.15, 0); grupo.add(mastil);
        const bandera = mesh(new T.BoxGeometry(0.6, 0.34, 0.03), m.acento); bandera.position.set(0.3, 3.4, 0); grupo.add(bandera);
        animados.push((t) => { bandera.rotation.y = Math.sin(t * 3) * 0.25; });
        n.altura = 3.8;
      } else if (quim) {
        // === matraz de Erlenmeyer de cristal con líquido luminoso y burbujas ===
        const perfilV = [[0.001, 0], [0.82, 0], [0.84, 0.06], [0.44, 1.2], [0.27, 1.55], [0.31, 1.68], [0.001, 1.68]].map(([r, y]) => new T.Vector2(r, y));
        const perfilL = [[0.001, 0.05], [0.76, 0.05], [0.56, 0.75], [0.001, 0.75]].map(([r, y]) => new T.Vector2(r, y));
        const base = mesh(new T.CylinderGeometry(0.95, 1.05, 0.2, 10), m.piedra); base.position.y = 0.1; grupo.add(base);
        const liq = mesh(new T.LatheGeometry(perfilL, 24), m.liquido); liq.position.y = 0.2; grupo.add(liq);
        const vid = mesh(new T.LatheGeometry(perfilV, 24), m.vidrio); vid.position.y = 0.2; grupo.add(vid);
        const tapon = mesh(new T.CylinderGeometry(0.2, 0.17, 0.26, 10), m.acento); tapon.position.y = 1.98; grupo.add(tapon);
        const burbujas = [0, 1, 2].map((i) => { const b = mesh(new T.SphereGeometry(0.07 + i * 0.015, 8, 6), basM({ color: 0xffffff, transparent: true, opacity: 0.7 })); grupo.add(b); return b; });
        animados.push((t) => burbujas.forEach((b, i) => { const f = ((t * 0.35 + i / 3) % 1); b.position.set(Math.sin(t + i * 2) * 0.22, 0.3 + f * 0.62, Math.cos(t * 1.3 + i) * 0.2); b.material.opacity = 0.75 * (1 - f); }));
        n.altura = 2.1;
      } else {
        // === pilón hexagonal con anillo orbital y cristal superior ===
        const base = mesh(new T.CylinderGeometry(0.95, 1.05, 0.2, 6), m.piedra); base.position.y = 0.1; grupo.add(base);
        const cu = mesh(new T.CylinderGeometry(0.5, 0.68, 1.9, 6), m.cuerpo); cu.position.y = 1.15; grupo.add(cu);
        for (const y of [0.65, 1.15, 1.65]) { const b = mesh(new T.TorusGeometry(0.62 - (y - 0.65) * 0.1, 0.035, 5, 6), m.acento); b.rotation.x = Math.PI / 2; b.position.y = y; b.rotation.z = Math.PI / 6; grupo.add(b); }
        const cris = mesh(new T.OctahedronGeometry(0.34, 0), m.acento); cris.position.y = 2.5; grupo.add(cris);
        const anillo = mesh(new T.TorusGeometry(0.85, 0.045, 6, 36), m.acento); anillo.position.y = 2.15; anillo.rotation.x = Math.PI / 2.3; grupo.add(anillo);
        animados.push((t) => { cris.rotation.y = t * 1.2; cris.position.y = 2.5 + Math.sin(t * 2) * 0.06; anillo.rotation.z = t * 0.9; });
        n.altura = 2.8;
      }

      // --- resplandor (bloom falso) en la base ---
      const glow = n.glow = sprGlow(pal.a, n.fort ? 6.5 : 5, 0.55); glow.position.copy(n.torrePos); glow.position.y += 0.9; scene.add(glow);

      // --- corona, insignia con el número, estrellas, flecha "siguiente" ---
      const corona = n.corona = crearCorona(); corona.position.y = n.altura + 0.3; grupo.add(corona);
      const badgeMat = n.badgeMat = reg(new T.SpriteMaterial({ map: texBadge(n.num, 'disponible', pal.a), transparent: true, depthTest: false, depthWrite: false }));
      const badge = n.badge = new T.Sprite(badgeMat); badge.renderOrder = 10; badge.position.y = n.altura + 1.15; grupo.add(badge);
      n.estrellasSpr = [0, 1, 2].map((i) => {
        const s = new T.Sprite(reg(new T.SpriteMaterial({ map: texEstrella, transparent: true, depthTest: false, depthWrite: false })));
        s.renderOrder = 11; s.visible = false; grupo.add(s); return s;
      });
      const flecha = n.flecha = new T.Sprite(reg(new T.SpriteMaterial({ map: texFlecha, transparent: true, depthTest: false, depthWrite: false })));
      flecha.renderOrder = 12; flecha.visible = false; grupo.add(flecha);

      // --- malla invisible para el picking con el ratón ---
      const rHit = n.fort ? 1.9 : 1.15; // (en espacio local del grupo ya escalado)
      const hit = n.hit = new T.Mesh(reg(new T.CylinderGeometry(rHit, rHit, n.altura + 0.3, 10)), basM({ visible: false }));
      hit.position.y = (n.altura + 0.3) / 2; hit.userData.nodo = n; grupo.add(hit);

      n.baseY = n.torrePos.y;
      // animación del brillo de lava / glow
      animados.push((t) => {
        if (n.fort) { n.brilloLava.material.opacity = 0.42 + 0.12 * Math.sin(t * 2.3 + n.num); }
        if (n.corona.visible) n.corona.rotation.y = t * 1.5;
      });
    }
    nodos.forEach(construirNodo);
    // la lava se desplaza suavemente (una sola textura compartida)
    animados.push((t) => { texLava.offset.set(t * 0.012, t * 0.008); });

    /** Estado visual de un nodo a partir del progreso guardado */
    function estadoDe(n) {
      if (!n.disp) return 'bloqueado';
      const c = PCB.store.cap(n.id);
      if (c.estado === 'dominado' || c.estrellas >= 3) return 'dominado';
      if (c.estado === 'completado') return 'completado';
      return 'disponible';
    }
    /** Primer capítulo disponible no completado → recibe la flecha "¡aquí!" */
    function nodoSiguiente() {
      return nodos.find((n) => n.disp && n.estado === 'disponible') || null;
    }
    function aplicarEstado(n) {
      const pal = PAL[n.mundo], e = n.estado, m = n.m, c = PCB.store.cap(n.id);
      const gris = e === 'bloqueado';
      m.cuerpo.color.set(gris ? '#454d70' : pal.a); m.cuerpo.emissive.set(gris ? '#000000' : pal.a);
      m.cuerpo.emissiveIntensity = gris ? 0 : e === 'disponible' ? 0.3 : 0.6;
      m.acento.color.set(gris ? '#586088' : e === 'dominado' ? '#ffd166' : pal.b); m.acento.emissive.set(gris ? '#000000' : e === 'dominado' ? '#ffb703' : pal.b);
      m.acento.emissiveIntensity = gris ? 0 : 0.65;
      m.liquido.color.set(gris ? '#3a4162' : pal.a); m.liquido.emissive.set(gris ? '#000000' : pal.a); m.liquido.emissiveIntensity = gris ? 0 : 0.85;
      m.lava.color.set(gris ? '#6a6a78' : '#ffffff');
      n.glow.visible = !gris; n.glow.material.color.set(e === 'dominado' ? '#ffd166' : e === 'completado' ? '#2ee59d' : pal.a);
      n.glow.material.opacity = e === 'disponible' ? 0.5 : 0.7;
      if (n.brilloLava) n.brilloLava.visible = !gris;
      n.badgeMat.map = texBadge(n.num, e, pal.a); n.badgeMat.needsUpdate = true;
      n.corona.visible = e === 'dominado';
      const ne = gris ? 0 : clamp(c.estrellas || 0, 0, 3);
      n.estrellasSpr.forEach((s, i) => { s.visible = i < ne; });
    }
    function refrescarEstados() {
      nodos.forEach((n) => { n.estado = estadoDe(n); });
      const firma = nodos.map((n) => n.estado + PCB.store.cap(n.id).estrellas).join(',');
      if (firma !== firmaEstados) {
        firmaEstados = firma;
        nodos.forEach(aplicarEstado);
        const sig = nodoSiguiente();
        nodos.forEach((n) => { n.esSiguiente = n === sig; n.flecha.visible = n === sig; });
        pintarCamino();
      }
      dirty = true;
    }

    // =============================================================================
    // Ato — protagonista (robot-científico redondo, casco-burbuja, átomo orbitando)
    // =============================================================================
    const ato = (() => {
      const g = new T.Group(), cuerpo = stdM({ color: 0xeef5ff, roughness: 0.35, metalness: 0.1 });
      const oscuro = stdM({ color: 0x1b2a5c, roughness: 0.4 }), azul = stdM({ color: 0x2f6bff, roughness: 0.4 });
      const luz = basM({ color: 0x7ffbe3 });
      // piernas (pivote en la cadera para balancearlas)
      const piernas = [-0.17, 0.17].map((x) => {
        const p = new T.Group(); p.position.set(x, 0.42, 0);
        const cil = mesh(new T.CylinderGeometry(0.085, 0.085, 0.3, 8), azul); cil.position.y = -0.16; p.add(cil);
        const pie = mesh(new T.SphereGeometry(0.15, 10, 8), oscuro); pie.scale.set(1, 0.5, 1.4); pie.position.set(0, -0.31, 0.05); p.add(pie);
        g.add(p); return p;
      });
      // torso redondo + panel luminoso en el pecho
      const torso = mesh(new T.SphereGeometry(0.42, 22, 16), cuerpo); torso.scale.set(1, 0.92, 0.95); torso.position.y = 0.76; g.add(torso);
      const panel = mesh(new T.CircleGeometry(0.11, 16), luz); panel.position.set(0, 0.74, 0.4); g.add(panel);
      const anilloPanel = mesh(new T.TorusGeometry(0.13, 0.02, 6, 20), azul); anilloPanel.position.set(0, 0.74, 0.395); g.add(anilloPanel);
      // brazos
      const brazos = [-1, 1].map((s) => {
        const p = new T.Group(); p.position.set(s * 0.46, 0.9, 0);
        const b = mesh(new T.CylinderGeometry(0.07, 0.07, 0.34, 8), cuerpo); b.position.y = -0.17; p.add(b);
        const mano = mesh(new T.SphereGeometry(0.1, 10, 8), azul); mano.position.y = -0.37; p.add(mano);
        p.rotation.z = s * 0.25; g.add(p); return p;
      });
      // cabeza oscura con ojos y sonrisa
      const cab = mesh(new T.SphereGeometry(0.33, 20, 16), oscuro); cab.position.y = 1.42; g.add(cab);
      const ojos = [-0.13, 0.13].map((x) => { const o = mesh(new T.SphereGeometry(0.065, 10, 8), luz); o.scale.set(1, 1.25, 0.5); o.position.set(x, 1.47, 0.29); g.add(o); return o; });
      const sonrisa = mesh(new T.TorusGeometry(0.075, 0.016, 6, 14, Math.PI), luz); sonrisa.rotation.z = Math.PI; sonrisa.position.set(0, 1.37, 0.31); g.add(sonrisa);
      // casco-burbuja (cristal) con reflejo
      const casco = mesh(new T.SphereGeometry(0.52, 24, 18), reg(new T.MeshPhongMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.2, shininess: 120, depthWrite: false, side: T.DoubleSide })));
      casco.position.y = 1.42; g.add(casco);
      const reflejo = mesh(new T.SphereGeometry(0.1, 8, 6), basM({ color: 0xffffff, transparent: true, opacity: 0.55 })); reflejo.scale.set(1.6, 0.7, 0.4); reflejo.position.set(-0.22, 1.72, 0.3); reflejo.rotation.z = 0.6; g.add(reflejo);
      const aroCasco = mesh(new T.TorusGeometry(0.4, 0.035, 6, 24), azul); aroCasco.rotation.x = Math.PI / 2; aroCasco.position.y = 1.14; g.add(aroCasco);
      // átomo orbitando sobre la cabeza: núcleo + 3 órbitas con electrones
      const atomo = new T.Group(); atomo.position.y = 2.2; g.add(atomo);
      atomo.add(mesh(new T.SphereGeometry(0.085, 10, 8), basM({ color: 0xffb347 })));
      const nucleoGlow = sprGlow(0xffb347, 0.7, 0.8); atomo.add(nucleoGlow);
      const electrones = [0, 1, 2].map((i) => {
        const orb = new T.Group(); orb.rotation.set(0, (i * Math.PI) / 3, i === 0 ? 0 : Math.PI / 3 * i * 0.6 + 0.9); atomo.add(orb);
        const anillo = mesh(new T.TorusGeometry(0.3, 0.008, 4, 36), basM({ color: 0x7ffbe3, transparent: true, opacity: 0.7 })); orb.add(anillo);
        const e = mesh(new T.SphereGeometry(0.048, 8, 6), basM({ color: i === 1 ? 0xff3da6 : 0xffffff })); orb.add(e);
        return { e, fase: i * 2.1 };
      });
      // brillo bajo los pies
      const halo = sprGlow(0x7ffbe3, 2.2, 0.45); halo.position.y = 0.05; g.add(halo);
      g.scale.setScalar(1.15); scene.add(g);
      return { g, piernas, brazos, ojos, atomo, electrones, torso, u: 0, rot: 0, vel: 0, saltoY: 0, escala: 1.15, parpadeo: 0 };
    })();

    /** Anima a Ato: piernas/brazos si camina (vel 0..1), respiración, parpadeo y átomo */
    function animarAto(dt, t) {
      const camina = ato.vel, f = t * 11;
      ato.piernas[0].rotation.x = Math.sin(f) * 0.8 * camina; ato.piernas[1].rotation.x = -Math.sin(f) * 0.8 * camina;
      ato.brazos[0].rotation.x = -Math.sin(f) * 0.7 * camina; ato.brazos[1].rotation.x = Math.sin(f) * 0.7 * camina;
      ato.torso.position.y = 0.76 + Math.abs(Math.sin(f)) * 0.07 * camina + (rm ? 0 : Math.sin(t * 2) * 0.012);
      if (!rm) {
        ato.atomo.rotation.y = t * 1.6;
        ato.atomo.position.y = 2.2 + Math.sin(t * 2.4) * 0.05;
        ato.electrones.forEach((el) => { const a = t * 3.2 + el.fase; el.e.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0); });
        ato.parpadeo -= dt; if (ato.parpadeo < -3.2) ato.parpadeo = 0.14; // parpadea cada ~3 s
        const cierre = ato.parpadeo > 0 ? 0.1 : 1.25; ato.ojos.forEach((o) => { o.scale.y = cierre; });
      }
    }
    /** Coloca a Ato en la posición u del camino (y desplazamiento opcional hacia el lado de la torre) */
    const _p = new T.Vector3();
    function colocarAto(u, lateral = 0, ladoVec = null) {
      puntoEn(u, _p);
      ato.g.position.set(_p.x, _p.y + 0.08 + ato.saltoY, _p.z);
      if (lateral && ladoVec) ato.g.position.addScaledVector(ladoVec, lateral);
    }
    // Aparición inicial: en el último nodo visitado, o en el primero pendiente
    {
      const inicio = (ultimoId && porId.get(ultimoId)) || null;
      ato.u = inicio ? inicio.u : 0;
      colocarAto(ato.u);
      const tg = tangenteEn(ato.u); ato.rot = Math.atan2(tg.x, tg.z); ato.g.rotation.y = ato.rot;
    }

    // =============================================================================
    // Cámara orbital
    // =============================================================================
    const VISTA_TODO = { target: new T.Vector3(8, 6, -12), radius: 100, phi: 0.98, theta: 0 };
    const goal = { theta: VISTA_TODO.theta, phi: VISTA_TODO.phi, radius: VISTA_TODO.radius, target: VISTA_TODO.target.clone() };
    const cur = { theta: goal.theta - (rm ? 0 : 0.6), phi: goal.phi, logR: Math.log(rm ? goal.radius : goal.radius * 1.5), target: goal.target.clone() };
    const par = { x: 0, y: 0 };      // parallax suavizado
    let idleAmt = 0;                 // 0..1, cuánto "respira" la cámara en reposo
    const LIM_PAN = { x: [-70, 75], z: [-70, 45], y: [-4, 26] };

    /** En pantallas verticales hay que alejar más la cámara para que quepa el ancho */
    const factorAspecto = () => clamp(1.5 / camera.aspect, 1, 2.4);
    function volarA(vista) {
      goal.target.copy(vista.target); goal.radius = vista.radius * factorAspecto();
      if (vista.phi != null) goal.phi = vista.phi;
      if (vista.theta != null) goal.theta = vista.theta;
      ultimaInteraccion = performance.now(); dirty = true;
    }
    const vistaMundo = (id) => {
      const M = MUNDOS[id];
      return { target: new T.Vector3(M.centro[0], M.centro[1] + 2, M.centro[2]), radius: M.R * 1.85 + 10, phi: 1.0 };
    };
    function actualizarCamara(dt) {
      const k = rm ? 1 : 1 - Math.exp(-dt * 4.2);
      cur.theta += (goal.theta - cur.theta) * k; cur.phi += (goal.phi - cur.phi) * k;
      cur.logR += (Math.log(goal.radius) - cur.logR) * k; cur.target.lerp(goal.target, k);
      const reposo = !viaje && !ptr.arrastre && performance.now() - ultimaInteraccion > 2500;
      idleAmt += ((reposo && !rm ? 1 : 0) - idleAmt) * (1 - Math.exp(-dt * 0.7));
      const th = cur.theta + (rm ? 0 : idleAmt * 0.2 * Math.sin(tiempo * 0.07));
      const r = Math.exp(cur.logR), sp = Math.sin(cur.phi);
      camera.position.set(cur.target.x + r * sp * Math.sin(th), cur.target.y + r * Math.cos(cur.phi), cur.target.z + r * sp * Math.cos(th));
      camera.lookAt(cur.target);
      if (!rm) { // parallax con el ratón: desplaza la cámara en el plano de la pantalla
        const kp = 1 - Math.exp(-dt * 3);
        par.x += (ptr.nx - par.x) * kp; par.y += (ptr.ny - par.y) * kp;
        camera.translateX(par.x * r * 0.02); camera.translateY(par.y * r * 0.012);
      }
    }
    const camaraQuieta = () => Math.abs(goal.theta - cur.theta) < 0.002 && Math.abs(goal.phi - cur.phi) < 0.002
      && Math.abs(Math.log(goal.radius) - cur.logR) < 0.002 && goal.target.distanceToSquared(cur.target) < 0.01;

    // =============================================================================
    // Interfaz HTML: panel, mundos, ayuda, tooltip, lista
    // =============================================================================
    const toast = (m) => PCB.util.toast(m);
    const live = h('div', { class: 'sr-solo', 'aria-live': 'polite', role: 'status' });

    // ---- panel lateral ----
    const inputArch = h('input', {
      type: 'file', accept: 'application/json,.json', class: 'sr-solo', tabindex: '-1', 'aria-hidden': 'true',
      on: {
        change: async (e) => {
          const f = e.target.files && e.target.files[0]; if (!f) return;
          try { toast(PCB.store.importar(JSON.parse(await f.text())) ? 'Respaldo importado' : 'El archivo no es un respaldo válido'); }
          catch (err) { toast('No se pudo leer el archivo'); }
          e.target.value = '';
        },
      },
    });
    const elXP = h('b', {}, '0'), elRacha = h('b', {}, '0'), elProgTxt = h('b', {}, '0/20');
    const elBarra = h('i'), mundosProg = {};
    const listaMundosProg = h('div', { class: 'mp-mundos' }, ORDEN_MUNDOS.map((id) => {
      const barra = h('i', { style: { width: '0%', background: `linear-gradient(90deg,${PAL[id].a},${PAL[id].b})` } }), txt = h('span', {}, '0/0');
      mundosProg[id] = { barra, txt };
      return h('div', { class: 'mp-mundo' }, h('span', { class: 'pt', style: { background: PAL[id].a, boxShadow: `0 0 6px ${PAL[id].a}` } }), h('span', { style: { width: '78px' } }, MUNDOS[id].corto), h('span', { class: 'barra' }, barra), txt);
    }));
    const btnColapsar = h('button', {
      class: 'btn mini', type: 'button', 'aria-expanded': 'true', 'aria-label': 'Mostrar u ocultar el panel', title: 'Panel',
      on: { click: () => alternarPanel() },
    }, '☰');
    const cuerpoPanel = h('div', { class: 'mp-cuerpo' },
      h('div', { class: 'mp-stats' },
        h('div', { class: 'mp-stat xp' }, h('small', {}, 'Experiencia'), h('b', {}, '★ ', elXP)),
        h('div', { class: 'mp-stat' }, h('small', {}, 'Racha'), h('b', {}, '🔥 ', elRacha, ' d'))),
      h('div', { class: 'mp-prog' }, h('small', {}, 'Progreso global', elProgTxt), h('div', { class: 'mp-barra' }, elBarra), listaMundosProg),
      h('div', { class: 'mp-acciones' },
        h('button', { class: 'btn', type: 'button', title: 'Descargar tu progreso como archivo', on: { click: () => PCB.store.exportar() } }, '⬇ Exportar'),
        h('button', { class: 'btn', type: 'button', title: 'Cargar un respaldo guardado', on: { click: () => inputArch.click() } }, '⬆ Importar'),
        h('button', { class: 'btn ancho', type: 'button', on: { click: () => mostrarLista(true) } }, '☰ Vista lista (teclado)')),
      h('div', {}, h('p', { class: 'mp-sub' }, 'Leyenda'),
        h('ul', { class: 'mp-leyenda' },
          h('li', {}, h('span', { class: 'ico disponible' }, '1'), 'Disponible'),
          h('li', {}, h('span', { class: 'ico completado' }, '✓'), 'Completado'),
          h('li', {}, h('span', { class: 'ico dominado' }, '★'), 'Dominado (corona y estrellas)'),
          h('li', {}, h('span', { class: 'ico bloqueado' }, '🔒'), 'Contenido en preparación'),
          h('li', {}, h('span', { class: 'ico fortaleza' }, '♜'), 'Fortaleza con jefe Rey Entropía'))),
      inputArch);
    const panel = h('aside', { class: 'mapa-panel vidrio', 'aria-label': 'Panel de progreso' },
      h('div', { class: 'mp-cab' }, h('h2', {}, 'MAPA DE MUNDOS'), btnColapsar), cuerpoPanel);
    function alternarPanel(forzar) {
      const colapsar = forzar != null ? forzar : !panel.classList.contains('colapsado');
      panel.classList.toggle('colapsado', colapsar); btnColapsar.setAttribute('aria-expanded', String(!colapsar));
    }
    if (host.clientWidth && host.clientWidth < 1400) alternarPanel(true);

    // ---- selector de mundos ----
    const botonesMundo = {};
    const mkMundoBtn = (id, etiqueta, sub, onClick, extra) => {
      const b = colorear(h('button', { type: 'button', class: 'mm ' + (extra || ''), 'aria-label': `Ir a ${etiqueta}`, on: { click: onClick } },
        h('span', { class: 'pt' }), etiqueta, sub ? h('small', {}, sub) : null), id ? PAL[id] : null);
      botonesMundo[id || 'todo'] = b; return b;
    };
    const barraMundos = h('nav', { class: 'mapa-mundos vidrio', 'aria-label': 'Saltar entre mundos' },
      mkMundoBtn(null, 'Todo el mapa', '', () => volarA(VISTA_TODO), 'todo'),
      ORDEN_MUNDOS.map((id) => mkMundoBtn(id, MUNDOS[id].corto, '', () => volarA(vistaMundo(id)))));

    const ayuda = h('div', { class: 'mapa-ayuda' }, h('b', {}, 'Arrastra'), ' para girar · ', h('b', {}, 'rueda'), ' para acercar · ', h('b', {}, 'clic derecho'), ' para mover', h('br'), 'Pasa el ratón por un nodo y haz clic para viajar con Ato');
    const btnLista = h('button', { class: 'btn mapa-btn-lista vidrio', type: 'button', on: { click: () => mostrarLista(true) } }, '☰ Vista lista');

    // ---- tooltip ----
    const tooltip = h('div', { class: 'mapa-tooltip vidrio', role: 'dialog', 'aria-label': 'Detalle del capítulo' });
    let tooltipSobre = false; // con el puntero encima, el tooltip se queda quieto para poder pulsar sus botones
    tooltip.addEventListener('pointerenter', () => { clearTimeout(tooltipTimer); tooltipSobre = true; });
    tooltip.addEventListener('pointerleave', () => { tooltipSobre = false; if (!tooltipFijo) programarOcultar(); });

    function filaProg(etq, valor, ok) { return [h('dt', {}, etq), h('dd', { class: ok === true ? 'si' : ok === false ? 'no' : '' }, valor)]; }
    function contenidoTooltip(n) {
      const c = PCB.store.cap(n.id), M = MUNDOS[n.mundo], mundoNombre = (indice.mundos.find((x) => x.id === n.mundo) || {}).nombre || M.corto;
      const cab = h('div', { class: 'mt-cab' }, h('span', { class: 'mt-num' }, String(n.num)),
        h('div', {}, h('b', {}, n.titulo), h('small', {}, `${n.materia === 'chimie' ? 'Química' : 'Física'} · ${mundoNombre}${n.fort ? ' · Fortaleza' : ''}`)));
      const estado = h('span', { class: 'chip mt-estado ' + n.estado }, TXT_ESTADO[n.estado]);
      if (n.estado === 'bloqueado') {
        return [cab, estado, h('div', { class: 'mt-prep' }, '🔒 Contenido en preparación. Estará disponible cuando se genere este capítulo.')];
      }
      const est = clamp(c.estrellas || 0, 0, 3);
      const estrellas = h('span', { class: 'mt-estrellas', 'aria-label': `${est} de 3 estrellas` }, '★'.repeat(est), h('span', { class: 'off' }, '★'.repeat(3 - est)));
      const quiz = c.quizMejor ? (c.quizMejor <= 1 ? Math.round(c.quizMejor * 100) + ' %' : String(c.quizMejor)) : 'sin intentar';
      const filas = h('dl', { class: 'mt-filas' },
        filaProg('Estrellas', estrellas),
        filaProg('Nivel', c.nivelGanado ? 'ganado' : c.nivelJugado ? 'jugado, sin ganar' : 'pendiente', c.nivelGanado ? true : c.nivelJugado ? null : false),
        filaProg(n.fort ? 'Rey Entropía' : 'Jefe', c.jefeDerrotado ? 'derrotado' : 'pendiente', c.jefeDerrotado),
        filaProg('Intro', c.introVista ? 'vista' : 'pendiente', c.introVista),
        filaProg('Quiz', quiz, c.quizMejor ? true : false));
      const acc = h('div', { class: 'mt-acciones' },
        h('button', { class: 'btn primario', type: 'button', on: { click: () => clicNodo(n, 'mouse', true) } }, n.fort ? '⚔ Entrar a la fortaleza' : '▶ Entrar al nivel'),
        h('button', { class: 'btn', type: 'button', on: { click: () => irDirecto(n) } }, 'Ir directo al capítulo →'));
      return [cab, estado, filas, acc];
    }
    function mostrarTooltip(n, fijo) {
      clearTimeout(tooltipTimer);
      if (tooltipNodo !== n) {
        tooltipNodo = n;
        tooltip.replaceChildren(...contenidoTooltip(n));
        tooltip.style.setProperty('--a', PAL[n.mundo].a); tooltip.style.setProperty('--b', PAL[n.mundo].b);
      }
      tooltipFijo = !!fijo;
      tooltip.classList.add('visible'); posicionarTooltip();
    }
    function ocultarTooltip() { clearTimeout(tooltipTimer); tooltipSobre = false; tooltipNodo = null; tooltipFijo = false; tooltip.classList.remove('visible'); }
    function programarOcultar() { clearTimeout(tooltipTimer); tooltipTimer = setTimeout(() => { if (!tooltipFijo || !hover) ocultarTooltip(); }, 380); }
    const _v = new T.Vector3();
    function posicionarTooltip() {
      if (!tooltipNodo || tooltipSobre) return;
      const n = tooltipNodo, w = host.clientWidth, hh = host.clientHeight;
      _v.copy(n.torrePos); _v.y = n.baseY + n.lift * 0.55 + (n.altura + 1.9) * n.escala; _v.project(camera);
      const sx = (_v.x * 0.5 + 0.5) * w, sy = (-_v.y * 0.5 + 0.5) * hh;
      const tw = tooltip.offsetWidth || 280, th = tooltip.offsetHeight || 200;
      const x = clamp(sx, tw / 2 + 8, w - tw / 2 - 8);
      const debajo = sy - th - 40 < 8;
      tooltip.classList.toggle('debajo', debajo);
      tooltip.style.left = x + 'px';
      tooltip.style.top = clamp(debajo ? sy + 70 : sy - 14, 8, hh - 8) + 'px';
    }

    // ---- vista lista accesible ----
    const contLista = h('section', { class: 'mapa-lista', 'aria-label': 'Lista de capítulos', tabindex: '-1' });
    function construirLista() {
      const secciones = ORDEN_MUNDOS.map((id) => {
        const del = nodos.filter((n) => n.mundo === id), nombre = (indice.mundos.find((x) => x.id === id) || {}).nombre || MUNDOS[id].corto;
        const hechos = del.filter((n) => n.estado === 'completado' || n.estado === 'dominado').length;
        const filas = del.map((n) => {
          const c = PCB.store.cap(n.id), bloq = n.estado === 'bloqueado', est = clamp(c.estrellas || 0, 0, 3);
          const principal = h('button', {
            type: 'button', class: 'principal', 'aria-disabled': bloq ? 'true' : null,
            'aria-label': `Capítulo ${n.num}: ${n.titulo}. ${n.materia === 'chimie' ? 'Química' : 'Física'}. ${TXT_ESTADO[n.estado]}.${est ? ' ' + est + ' estrellas.' : ''}${n.fort ? ' Fortaleza con jefe.' : ''}`,
            on: { click: () => { if (bloq) { live.textContent = `Capítulo ${n.num}: contenido en preparación`; toast('Contenido en preparación'); return; } entrarYa(n); } },
          },
            h('span', { class: 'n' }, String(n.num)),
            h('span', { class: 't' }, h('b', {}, n.titulo), h('small', {}, `${n.materia === 'chimie' ? 'Química' : 'Física'}${n.fort ? ' · Fortaleza' : ''}`)),
            h('span', { class: 'st ' + n.estado }, bloq ? '🔒 En preparación' : TXT_ESTADO[n.estado] + (est ? ' ' + '★'.repeat(est) : '')));
          return h('li', { class: 'ml-fila' }, principal,
            bloq ? null : h('button', { type: 'button', class: 'directo', 'aria-label': `Ir directo al capítulo ${n.num}`, title: 'Saltar el nivel y la intro', on: { click: () => irDirecto(n) } }, 'Directo →'));
        });
        return colorear(h('div', { class: 'ml-mundo' },
          h('h3', {}, nombre, h('small', {}, `${hechos}/${del.length} completados`)), h('ul', {}, filas)), PAL[id]);
      });
      contLista.replaceChildren(h('div', { class: 'ml-in' },
        h('div', { class: 'ml-cab' }, h('h2', {}, 'Capítulos'),
          h('button', { class: 'btn primario', type: 'button', id: 'mapa-volver-3d', on: { click: () => mostrarLista(false) } }, '← Volver al mapa 3D')),
        h('p', { class: 'ml-nota' }, 'Vista alternativa del mapa: usa Tab para moverte y Enter para entrar. Esc vuelve al mapa 3D.'), secciones));
    }
    function mostrarLista(si) {
      listaVisible = si; host.classList.toggle('ver-lista', si);
      if (si) { ocultarTooltip(); construirLista(); const b = contLista.querySelector('.principal'); (b || contLista).focus(); parar(); }
      else { arrancar(); canvas.focus({ preventScroll: true }); }
      dirty = true;
    }

    // ---- ensamblar DOM ----
    host.classList.add('pantalla-mapa-activa');
    host.append(ayuda, barraMundos, panel, btnLista, tooltip, contLista, live);

    function actualizarPanel() {
      const p = PCB.store.get(), hechos = nodos.filter((n) => n.estado === 'completado' || n.estado === 'dominado').length;
      elXP.textContent = String(p.xp || 0); elRacha.textContent = String((p.racha && p.racha.dias) || 0);
      elProgTxt.textContent = `${hechos}/${nodos.length}`; elBarra.style.width = (nodos.length ? (hechos / nodos.length) * 100 : 0) + '%';
      ORDEN_MUNDOS.forEach((id) => {
        const del = nodos.filter((n) => n.mundo === id), ok = del.filter((n) => n.estado === 'completado' || n.estado === 'dominado').length;
        mundosProg[id].barra.style.width = (del.length ? (ok / del.length) * 100 : 0) + '%'; mundosProg[id].txt.textContent = `${ok}/${del.length}`;
      });
    }
    const alCambiarStore = () => {
      if (destruido) return;
      refrescarEstados(); actualizarPanel();
      if (listaVisible) construirLista();
      if (tooltipNodo) { const n = tooltipNodo; tooltipNodo = null; mostrarTooltip(n, tooltipFijo); }
      rm = PCB.util.reducedMotion();
    };
    PCB.bus.on('store', alCambiarStore);
    limpiezas.push(() => PCB.bus.off('store', alCambiarStore));

    // =============================================================================
    // Interacción: puntero (arrastre, rueda, pellizco), hover, clic y teclado
    // =============================================================================
    const ptr = { x: 0, y: 0, nx: 0, ny: 0, dentro: false, arrastre: false, down: false, boton: 0, sx: 0, sy: 0, t0: 0 };
    const punteros = new Map();   // pointerId → {x,y} (para pellizco)
    let distPellizco = 0;
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    const hits = nodos.map((n) => n.hit);

    function pick(cx, cy) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1));
      ray.setFromCamera(ndc, camera);
      const i = ray.intersectObjects(hits, false)[0];
      return i ? i.object.userData.nodo : null;
    }
    const tocar = () => { ultimaInteraccion = performance.now(); dirty = true; };

    const onDown = (e) => {
      if (viaje || listaVisible) return;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (punteros.size === 2) { const [a, b] = [...punteros.values()]; distPellizco = Math.hypot(a.x - b.x, a.y - b.y); ptr.arrastre = true; }
      ptr.down = true; ptr.boton = e.button; ptr.sx = ptr.x = e.clientX; ptr.sy = ptr.y = e.clientY; ptr.t0 = performance.now(); ptr.arrastre = punteros.size > 1;
      tocar();
    };
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      ptr.nx = ((e.clientX - r.left) / r.width) * 2 - 1; ptr.ny = ((e.clientY - r.top) / r.height) * 2 - 1; ptr.dentro = true;
      ptr.cx = e.clientX; ptr.cy = e.clientY; ptr.tipo = e.pointerType;
      if (punteros.has(e.pointerId)) punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (punteros.size === 2) { // pellizco = zoom
        const [a, b] = [...punteros.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (distPellizco) goal.radius = clamp(goal.radius * (distPellizco / d), 14, 280);
        distPellizco = d; tocar(); return;
      }
      if (ptr.down && !viaje) {
        const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
        if (!ptr.arrastre && Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) > 5) { ptr.arrastre = true; host.classList.add('arrastrando'); ocultarTooltip(); }
        if (ptr.arrastre) {
          if (ptr.boton === 2 || e.shiftKey) { // desplazar (pan) en el plano del suelo
            const r2 = Math.exp(cur.logR) * 0.0018, s = Math.sin(cur.theta), c = Math.cos(cur.theta);
            goal.target.x = clamp(goal.target.x - (dx * c - dy * s) * r2, ...LIM_PAN.x);
            goal.target.z = clamp(goal.target.z + (dx * s + dy * c) * r2, ...LIM_PAN.z);
          } else { goal.theta -= dx * 0.0055; goal.phi = clamp(goal.phi - dy * 0.0045, 0.22, 1.5); }
        }
        ptr.x = e.clientX; ptr.y = e.clientY; tocar();
      } else { ptr.x = e.clientX; ptr.y = e.clientY; dirty = true; }
    };
    const onUp = (e) => {
      const eraClic = ptr.down && !ptr.arrastre && performance.now() - ptr.t0 < 700 && punteros.size <= 1;
      punteros.delete(e.pointerId); if (punteros.size < 2) distPellizco = 0;
      if (!punteros.size) { ptr.down = false; ptr.arrastre = false; host.classList.remove('arrastrando'); }
      if (eraClic && ptr.boton === 0 && !viaje) { const n = pick(e.clientX, e.clientY); if (n) clicNodo(n, e.pointerType); else if (e.pointerType === 'touch') ocultarTooltip(); }
      tocar();
    };
    const onLeave = () => { ptr.dentro = false; ptr.nx = 0; ptr.ny = 0; };
    const onWheel = (e) => {
      if (viaje || listaVisible) return; e.preventDefault();
      goal.radius = clamp(goal.radius * Math.exp(e.deltaY * 0.0012), 14, 280); tocar();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (listaVisible) { mostrarLista(false); e.preventDefault(); }
        else if (viaje) { cancelarViaje(); e.preventDefault(); }
        else if (tooltipNodo) ocultarTooltip();
        return;
      }
      if (e.target !== canvas || viaje) return;
      const paso = { ArrowLeft: [0.12, 0, 1], ArrowRight: [-0.12, 0, 1], ArrowUp: [0, -0.08, 1], ArrowDown: [0, 0.08, 1], '+': [0, 0, 0.88], '=': [0, 0, 0.88], '-': [0, 0, 1.14] }[e.key];
      if (!paso) return;
      e.preventDefault(); goal.theta += paso[0]; goal.phi = clamp(goal.phi + paso[1], 0.22, 1.5); goal.radius = clamp(goal.radius * paso[2], 14, 280); tocar();
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKey);
    limpiezas.push(() => window.removeEventListener('keydown', onKey));

    /** Hover: raycast contra las 20 mallas de picking (barato). Se llama cada frame con el ratón dentro. */
    function actualizarHover() {
      let n = null;
      if (ptr.dentro && !ptr.arrastre && !viaje && !listaVisible && ptr.tipo !== 'touch') n = pick(ptr.cx, ptr.cy);
      if (n !== hover) {
        hover = n; dirty = true;
        host.classList.toggle('sobre-nodo', !!n && n.disp); host.classList.toggle('sobre-bloqueado', !!n && !n.disp);
        if (n) mostrarTooltip(n, false); else if (tooltipNodo && !tooltipFijo) programarOcultar();
      }
    }

    // =============================================================================
    // Viaje de Ato: cámara vuela, Ato camina por el camino, salta a la torre y se entra
    // =============================================================================
    function clicNodo(n, tipo, desdeTooltip) {
      if (viaje || destruido) return;
      if (!n.disp) { mostrarTooltip(n, true); live.textContent = `Capítulo ${n.num}: contenido en preparación`; return; }
      if (tipo === 'touch' && !desdeTooltip && tooltipNodo !== n) { mostrarTooltip(n, true); return; } // en táctil, el primer toque muestra el detalle
      iniciarViaje(n);
    }
    function iniciarViaje(n) {
      ocultarTooltip(); hover = null; host.classList.add('viajando'); host.classList.remove('sobre-nodo');
      const dist = Math.abs(n.u - ato.u) * LARGO;
      viaje = { n, fase: 'camina', t: 0, u0: ato.u, u1: n.u, dur: clamp(dist / 15, 0.9, 4.6), canceladoPorUsuario: false };
      goal.radius = Math.min(goal.radius, 24); goal.phi = clamp(goal.phi, 0.75, 1.15);
      live.textContent = `Viajando al capítulo ${n.num}: ${n.titulo}`;
      if (rm || dist < 0.5) { viaje.dur = 0.01; }
      ultimaInteraccion = performance.now(); dirty = true;
    }
    function cancelarViaje() {
      if (!viaje) return;
      viaje = null; host.classList.remove('viajando'); ato.vel = 0; ato.saltoY = 0; ato.g.scale.setScalar(ato.escala); dirty = true;
    }
    /** Entrar al capítulo sin animar (vista lista) */
    function entrarYa(n) {
      recordar(n); live.textContent = `Entrando al capítulo ${n.num}`;
      PCB.flow.entrarCapitulo(n.id);
    }
    function irDirecto(n) { recordar(n); ocultarTooltip(); PCB.flow.irCapituloDirecto(n.id); }
    function recordar(n) { ultimoId = n.id; try { localStorage.setItem(CLAVE_ATO, n.id); } catch (e) { /* sin storage */ } }

    function actualizarViaje(dt) {
      if (!viaje) {
        // reposo: Ato quieto en su nodo, mirando hacia donde sigue el camino
        ato.vel += (0 - ato.vel) * 0.2; return;
      }
      const v = viaje; v.t += dt;
      if (v.fase === 'camina') {
        const p = clamp(v.t / v.dur, 0, 1), e = easeIO(p), antes = ato.u;
        ato.u = lerp(v.u0, v.u1, e);
        const dir = Math.sign(v.u1 - v.u0) || 1, tg = tangenteEn(ato.u);
        const objetivo = Math.atan2(tg.x * dir, tg.z * dir);
        let d = objetivo - ato.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); ato.rot += d * Math.min(1, dt * 10);
        ato.vel = clamp(Math.abs(ato.u - antes) * LARGO / Math.max(dt, 1e-3) / 9, 0, 1);
        colocarAto(ato.u);
        goal.target.copy(ato.g.position); goal.target.y += 0.9;     // la cámara sigue a Ato
        if (p >= 1) { v.fase = 'salto'; v.t = 0; ato.vel = 0; }
      } else if (v.fase === 'salto') {
        // pequeño salto hacia el pie de la torre, mirando a ella
        const dur = rm ? 0.01 : 0.55, p = clamp(v.t / dur, 0, 1), n = v.n;
        const lateral = (n.off - (n.fort ? 1.5 : 1.2) * n.escala) * easeIO(p);
        ato.saltoY = Math.sin(p * Math.PI) * 0.9;
        const d = Math.atan2(n.lado.x, n.lado.z) - ato.rot; ato.rot += Math.atan2(Math.sin(d), Math.cos(d)) * Math.min(1, dt * 12);
        colocarAto(ato.u, lateral, n.lado);
        goal.target.copy(ato.g.position); goal.target.y += 1; goal.radius = 14;
        if (p >= 1) { v.fase = 'entra'; v.t = 0; ato.saltoY = 0; }
      } else if (v.fase === 'entra') {
        // Ato "entra" a la torre: se encoge mientras se enciende el nodo
        const dur = rm ? 0.05 : 0.45, p = clamp(v.t / dur, 0, 1);
        ato.g.scale.setScalar(ato.escala * (1 - easeIO(p) * 0.92)); v.n.glow.material.opacity = 0.55 + p * 0.45;
        v.n.glow.scale.setScalar((v.n.fort ? 6.5 : 5) * (1 + p * 0.6));
        if (p >= 1) {
          const n = v.n; viaje = null; recordar(n); host.classList.remove('viajando');
          live.textContent = `Entrando al capítulo ${n.num}`;
          PCB.flow.entrarCapitulo(n.id);
          // por si el flujo no cambia de pantalla (p.ej. capítulo sin contenido), Ato reaparece
          setTimeout(() => { if (!destruido) { ato.g.scale.setScalar(ato.escala); n.glow.scale.setScalar(n.fort ? 6.5 : 5); dirty = true; } }, 800);
        }
      }
      ultimaInteraccion = performance.now();
    }

    // =============================================================================
    // Bucle de animación y render
    // =============================================================================
    function tamano() {
      const w = Math.max(1, host.clientWidth), hh = Math.max(1, host.clientHeight);
      renderer.setSize(w, hh, false); camera.aspect = w / hh;
      // en pantallas verticales/estrechas se aleja un poco para que quepa
      camera.fov = w / hh < 1 ? 58 : 45; camera.updateProjectionMatrix(); dirty = true;
      
    }
    const ro = new ResizeObserver(tamano); ro.observe(host);
    limpiezas.push(() => ro.disconnect());

    const _wp = new T.Vector3();
    function actualizar(dt) {
      tiempo += dt;
      actualizarCamara(dt);
      actualizarViaje(dt);
      if (viaje == null) { // Ato en reposo: orientado hacia donde sigue el camino
        const tg = tangenteEn(ato.u), d = Math.atan2(tg.x, tg.z) - ato.rot;
        if (!rm) ato.rot += Math.atan2(Math.sin(d), Math.cos(d)) * Math.min(1, dt * 2); else ato.rot = Math.atan2(tg.x, tg.z);
        colocarAto(ato.u);
      }
      ato.g.rotation.y = ato.rot;
      animarAto(dt, tiempo);
      actualizarHover();
      // elevación suave de los nodos con el ratón encima
      const dist0 = camera.position.distanceTo(cur.target);
      nodos.forEach((n) => {
        const meta = hover === n && n.disp ? 1 : hover === n ? 0.35 : 0;
        n.lift = rm ? meta : n.lift + (meta - n.lift) * (1 - Math.exp(-dt * 10));
        n.grupo.position.y = n.baseY + n.lift * 0.55;
        n.grupo.scale.setScalar(n.escala * (1 + n.lift * 0.07));
        // las insignias crecen con la distancia para seguir siendo legibles
        _wp.copy(n.torrePos); const d = camera.position.distanceTo(_wp);
        const s = 1.4 * clamp(Math.pow(d / 38, 0.58), 0.5, 2.1);
        n.badge.scale.set(s, s, 1); n.badge.position.y = n.altura + 0.75 + s * 0.45;
        const ss = s * 0.34;
        n.estrellasSpr.forEach((e, i) => { e.scale.set(ss, ss, 1); e.position.set((i - 1) * ss * 1.05, n.badge.position.y + s * 0.5 + ss * 0.55, 0); });
        n.flecha.scale.set(ss * 1.1, ss * 1.1, 1);
        n.flecha.position.set(0, n.badge.position.y + s * 0.62 + ss * (n.estrellasSpr[0].visible ? 1.35 : 0.8) + (rm ? 0 : Math.abs(Math.sin(tiempo * 3)) * ss * 0.5), 0);
      });
      if (!rm) {
        animados.forEach((f) => f(tiempo, dt));
        estrellas.rotation.y += dt * 0.004;
        // motas ascendentes
        const { p, v, n } = motas;
        for (let i = 0; i < n; i++) { p[i * 3 + 1] += v[i] * dt; if (p[i * 3 + 1] > 32) p[i * 3 + 1] = -6; }
        motas.pts.geometry.attributes.position.needsUpdate = true;
        // pulso de los resplandores de los nodos disponibles
        nodos.forEach((n) => { if (n.estado !== 'bloqueado') n.glow.material.opacity = (n.estado === 'disponible' ? 0.42 : 0.62) + 0.12 * Math.sin(tiempo * 2 + n.num) + n.lift * 0.25; });
      } else {
        // en modo reducido: una sola vez (los animados fijan una pose estática)
        if (dirty) animados.forEach((f) => f(0, 0));
      }
      // ¿ratón sobre el tooltip → mantenerlo posicionado
      if (tooltipNodo) posicionarTooltip();
      // mundo activo (para resaltar el botón)
      let mejor = '', md = 1e9;
      ORDEN_MUNDOS.forEach((id) => { const M = MUNDOS[id], d = Math.hypot(goal.target.x - M.centro[0], goal.target.z - M.centro[2]); if (d < md) { md = d; mejor = id; } });
      const todo = goal.radius > 70 * factorAspecto(); const clave = todo ? 'todo' : mejor;
      if (clave !== mundoActivo) { mundoActivo = clave; Object.entries(botonesMundo).forEach(([k, b]) => b.classList.toggle('activo', k === clave)); }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (destruido || document.hidden || listaVisible) return;
      // Límite de FPS: 60 mientras algo se mueve por el usuario, 30 en reposo
      const interactuando = viaje || ptr.arrastre || !camaraQuieta() || now - ultimaInteraccion < 1500;
      const fps = rm ? 20 : interactuando ? 60 : 30;
      if (now - ultimoFrame < 1000 / fps - 2) return;
      const dt = Math.min(0.1, (now - ultimoFrame) / 1000 || 0.016); ultimoFrame = now;
      if (Math.floor(now / 500) !== Math.floor((now - dt * 1000) / 500)) rm = PCB.util.reducedMotion();
      if (rm && !dirty && !viaje) return; // modo reducido: solo se pinta cuando algo cambió
      const tt0 = performance.now();
      actualizar(dt);
      const tt1 = performance.now();
      renderer.render(scene, camera); contadorFrames++;
      msFrame = [tt1 - tt0, performance.now() - tt1];
      if (rm && !viaje && camaraQuieta()) dirty = false;
    }
    function arrancar() {
      if (raf || destruido || listaVisible || document.hidden) return;
      ultimoFrame = performance.now(); raf = requestAnimationFrame(frame);
    }
    function parar() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    const alVisibilidad = () => { if (document.hidden) parar(); else { arrancar(); dirty = true; } };
    document.addEventListener('visibilitychange', alVisibilidad);
    limpiezas.push(() => document.removeEventListener('visibilitychange', alVisibilidad));
    // si el navegador pierde el contexto WebGL, se avisa (la lista sigue funcionando)
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); parar(); host.append(h('div', { class: 'mapa-sin-webgl vidrio' }, 'Se perdió el contexto 3D. Usa la Vista lista o vuelve a entrar al mapa.')); });

    // =============================================================================
    // Arranque
    // =============================================================================
    tamano();
    goal.radius = VISTA_TODO.radius * factorAspecto(); cur.logR = Math.log(rm ? goal.radius : goal.radius * 1.5);
    refrescarEstados(); actualizarPanel();
    actualizar(0.016); renderer.render(scene, camera);
    arrancar();

    // API pública mínima para pruebas / depuración
    PCB.mapa = {
      /** Coordenadas de cliente (px) de la parte alta del nodo (para simular clic/hover) */
      pantallaDe(id) {
        const n = porId.get(id); if (!n) return null;
        const v = new T.Vector3(n.torrePos.x, n.baseY + n.altura * 0.5 * n.escala, n.torrePos.z).project(camera), r = canvas.getBoundingClientRect();
        return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
      },
      estado: (id) => (porId.get(id) || {}).estado,
      viajando: () => !!viaje,
      frames: () => contadorFrames,
      ms: () => msFrame,
      atoEn: () => ato.u,
      volarA: (id) => volarA(id === 'todo' ? VISTA_TODO : vistaMundo(id)),
    };

    // ---------- destrucción ----------
    function destruir() {
      if (destruido) return; destruido = true;
      parar(); clearTimeout(tooltipTimer);
      limpiezas.forEach((f) => { try { f(); } catch (e) { /* ya liberado */ } });
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('wheel', onWheel);
      liberables.forEach((o) => { try { o.dispose(); } catch (e) { /* ya liberado */ } });
      cacheBadge.clear();
      scene.clear();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) { /* sin extensión */ }
      canvas.remove();
      host.replaceChildren();
      delete PCB.mapa;
    }
    return { destruir };
  }

  // =================================================================================
  // Lista de reserva si no hay WebGL: el mapa 3D no se puede crear, pero se puede jugar
  // =================================================================================
  function crearSoloLista(host, indice, disponibles) {
    const hay = disponibles && Array.isArray(disponibles.capitulos) ? new Set(disponibles.capitulos) : null;
    const cont = h('section', { class: 'mapa-lista', style: { display: 'block' }, 'aria-label': 'Lista de capítulos' });
    const defPal = (id) => ({ a: (MUNDOS[id] || {}).def ? MUNDOS[id].def[0] : '#2f6bff', b: (MUNDOS[id] || {}).def ? MUNDOS[id].def[1] : '#00d4ff' });
    const secciones = (indice.mundos || []).map((m) => colorear(h('div', { class: 'ml-mundo' },
      h('h3', {}, m.nombre),
      h('ul', {}, indice.capitulos.filter((c) => c.mundo === m.id).map((c) => {
        const ok = hay ? hay.has(c.id) : true;
        return h('li', { class: 'ml-fila' }, h('button', {
          type: 'button', class: 'principal', 'aria-disabled': ok ? null : 'true',
          on: { click: () => { if (ok) { ultimoId = c.id; PCB.flow.entrarCapitulo(c.id); } else PCB.util.toast('Contenido en preparación'); } },
        }, h('span', { class: 'n' }, String(c.num)), h('span', { class: 't' }, h('b', {}, c.titulo)), h('span', { class: 'st' }, ok ? '' : '🔒 En preparación')));
      }))), defPal(m.id)));
    cont.append(h('div', { class: 'ml-in' }, h('div', { class: 'ml-cab' }, h('h2', {}, 'Capítulos')),
      h('p', { class: 'ml-nota' }, 'No se pudo iniciar la vista 3D en este navegador (WebGL no disponible). Esta lista funciona igual.'), secciones));
    host.append(cont);
    return { destruir: () => host.replaceChildren() };
  }

  // =================================================================================
  // Registro de la pantalla
  // =================================================================================
  PCB.screens.mapa = {
    async mount(host, ctx) {
      const mi = ++tokenMontaje;
      host.classList.add('pantalla-mapa');
      // datos + fuente de las insignias (con límite de tiempo para no bloquear)
      const [indice, disp] = await Promise.all([
        PCB.data.indice(), PCB.data.disponibles(),
        Promise.race([document.fonts && document.fonts.load('700 40px UI').catch(() => 0), delay(700)]),
      ]).then((r) => [r[0], r[1]]);
      if (mi !== tokenMontaje) return; // se desmontó mientras cargaba
      if (!indice || !indice.capitulos) { host.append(h('pre', { style: { padding: '20px' } }, 'No se pudo leer contenido/indice.json')); return; }
      if (ctx && ctx.capId) { ultimoId = ctx.capId; }
      try {
        if (!window.THREE) throw new Error('THREE no está cargado');
        instancia = crearMapa(host, indice, disp);
      } catch (e) {
        console.error('[mapa] fallo al crear el 3D:', e);
        host.replaceChildren();
        instancia = crearSoloLista(host, indice, disp);
      }
    },
    unmount() {
      tokenMontaje++;
      if (instancia) { try { instancia.destruir(); } catch (e) { console.error(e); } instancia = null; }
    },
  };
})();
