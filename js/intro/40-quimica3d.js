// =====================================================================================
// 40-quimica3d.js — INTRO-B · estilo de intro "quimica3d" (Three.js clásico, global THREE)
//
// Este archivo contiene DOS cosas:
//  1) La BIBLIOTECA 3D COMPARTIDA  window.PCB.intro3d  (la usan quimica3d y fisica3d):
//       - crearEstilo3D(ctx, cfg): renderer + escena + cámara + pool de actores + vectores
//         + trayectorias + partículas + bocadillos + resaltado, todo a partir del estado S.
//       - utilidades: mat(), geo(), textSprite(), bubbleSprite(), crearFlecha(), crearFX()...
//       - lib.builders[tipo] = fábrica de la forma 3D de cada tipo de actor.
//  2) El estilo 'quimica3d' (moléculas bola-y-varilla CPK, átomos, iones, vidrio, reacciones).
//
// Carga: 40-quimica3d.js se carga ANTES que 50-fisica3d.js (orden alfabético).
// Coordenadas: S usa 0..1 (x derecha, y abajo, 16:9). El mundo 3D es de 16 x 9 unidades,
//   centrado en el origen (x3=(x-.5)*16, y3=(.5-y)*9), el plano z=0 es la "pantalla" y la
//   cámara está a 14 unidades, de modo que a zoom 1 el plano z=0 llena exactamente 16:9.
// =====================================================================================
(function () {
  'use strict';
  const PCB = (window.PCB = window.PCB || {});
  const T = window.THREE;
  if (!T) { console.warn('[intro] quimica3d: THREE no disponible, estilo no registrado'); return; }
  const lib = (PCB.intro3d = PCB.intro3d || {});
  lib.builders = lib.builders || {};

  // ---------- constantes y helpers numéricos ----------
  const W = 16, H = 9, D0 = 14, RAD = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const fract = (x) => x - Math.floor(x);
  const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const reducedMotion = () => { try { return PCB.util && PCB.util.reducedMotion ? PCB.util.reducedMotion() : false; } catch (e) { return false; } };
  Object.assign(lib, { W, H, D0, RAD, clamp, lerp, smooth, hash, fract, T });
  lib.mapX = (x) => (x - 0.5) * W;
  lib.mapY = (y) => (0.5 - y) * H;

  /** Registra un estilo en el motor de INTRO-A (o lo deja en cola si el motor aún no existe). */
  lib.registrar = function (id, def) {
    PCB.intro = PCB.intro || {};
    if (typeof PCB.intro.registerStyle === 'function') PCB.intro.registerStyle(id, def);
    else (PCB.intro._pendientes = PCB.intro._pendientes || []).push([id, def]);
  };

  // ---------- colores ----------
  const _col = {};
  /** Color THREE a partir de cualquier string CSS (con caché). Nunca lanza. */
  lib.color = function (c, def) {
    const k = c || def || '#ffffff';
    if (_col[k]) return _col[k];
    let col;
    try { col = new T.Color(k); } catch (e) { col = new T.Color(def || '#ffffff'); }
    return (_col[k] = col);
  };

  // ---------- geometrías compartidas (caché global) ----------
  const _geo = {};
  lib.geo = (k, f) => _geo[k] || (_geo[k] = f());
  const G = (lib.G = {
    sphere: () => lib.geo('sphere', () => new T.SphereGeometry(1, 22, 15)),
    sphereLo: () => lib.geo('sphereLo', () => new T.SphereGeometry(1, 10, 7)),
    ico: () => lib.geo('ico', () => new T.IcosahedronGeometry(1, 1)),
    cyl: () => lib.geo('cyl', () => new T.CylinderGeometry(1, 1, 1, 14, 1)), // eje Y, altura 1
    cylLo: () => lib.geo('cylLo', () => new T.CylinderGeometry(1, 1, 1, 8, 1)),
    box: () => lib.geo('box', () => new T.BoxGeometry(1, 1, 1)),
    cone: () => lib.geo('cone', () => new T.ConeGeometry(1, 1, 14)),
    circle: () => lib.geo('circle', () => new T.CircleGeometry(1, 36)),
    ring: () => lib.geo('ring', () => new T.RingGeometry(0.94, 1, 56)),
    unitCircle: () => lib.geo('unitCircle', () => {
      const p = []; for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2; p.push(new T.Vector3(Math.cos(a), Math.sin(a), 0)); }
      return new T.BufferGeometry().setFromPoints(p);
    }),
  });

  // ---------- materiales (siempre NUEVOS por actor: así el alpha/resaltado no se mezcla) ----------
  lib.mat = function (color, o) {
    o = o || {};
    return new T.MeshPhongMaterial({
      color: lib.color(color).clone(), shininess: o.shininess != null ? o.shininess : 50, specular: o.specular != null ? o.specular : 0x444444,
      emissive: new T.Color(o.emissive != null ? o.emissive : 0x000000), flatShading: !!o.flat,
      transparent: !!o.transparent || (o.opacity != null && o.opacity < 1), opacity: o.opacity != null ? o.opacity : 1,
      side: o.side != null ? o.side : T.FrontSide, depthWrite: o.depthWrite != null ? o.depthWrite : true,
    });
  };
  lib.basic = function (color, o) {
    o = o || {};
    return new T.MeshBasicMaterial({
      color: lib.color(color).clone(), transparent: o.transparent !== false && (o.opacity != null || !!o.additive || !!o.transparent), opacity: o.opacity != null ? o.opacity : 1,
      blending: o.additive ? T.AdditiveBlending : T.NormalBlending, depthWrite: o.depthWrite != null ? o.depthWrite : !o.additive,
      depthTest: o.depthTest !== false, side: o.side != null ? o.side : T.FrontSide,
    });
  };
  lib.mesh = function (geo, mat, x, y, z, sx, sy, sz) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.scale.set(sx != null ? sx : 1, sy != null ? sy : (sx != null ? sx : 1), sz != null ? sz : (sx != null ? sx : 1));
    return m;
  };
  /** Orienta un cilindro unitario (eje Y, altura 1) entre dos puntos. */
  const _up = new T.Vector3(0, 1, 0), _d = new T.Vector3();
  lib.ponerVarilla = function (mesh, p0, p1, radio) {
    _d.subVectors(p1, p0); const len = _d.length() || 1e-4;
    mesh.position.addVectors(p0, p1).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(_up, _d.multiplyScalar(1 / len));
    mesh.scale.set(radio, len, radio);
  };

  // ---------- textura de punto suave (partículas, resplandores) ----------
  let _puntoTex = null;
  lib.puntoTex = function () {
    if (_puntoTex) return _puntoTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (_puntoTex = new T.CanvasTexture(c));
  };
  /** Resplandor aditivo (sprite) */
  lib.glow = function (color, tam, op) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: lib.puntoTex(), color: lib.color(color).clone(), transparent: true, opacity: op != null ? op : 0.8, blending: T.AdditiveBlending, depthWrite: false }));
    s.scale.set(tam, tam, 1); return s;
  };

  // ---------- sprites de texto (etiquetas, cargas) y bocadillos ----------
  const _tex = {};
  /** Sprite con texto. o:{color,h(alto en unidades),px,bg,circle,depthTest} */
  lib.textSprite = function (text, o) {
    o = o || {};
    const color = o.color || '#ffffff', px = o.px || 54, h = o.h || 0.5;
    const font = o.font || `600 ${px}px UI, system-ui, sans-serif`;
    const key = [text, color, font, o.bg || '', o.circle ? 'c' : ''].join('|');
    let rec = _tex[key];
    if (!rec) {
      const c = document.createElement('canvas'); const g = c.getContext('2d');
      g.font = font; const tw = Math.ceil(g.measureText(text).width); const pad = Math.round(px * 0.3);
      const cw = o.circle ? Math.max(tw, px) + pad * 2 : tw + pad * 2, ch = Math.round(px * 1.5);
      c.width = o.circle ? Math.max(cw, ch) : cw; c.height = ch;
      const g2 = c.getContext('2d'); g2.font = font; g2.textAlign = 'center'; g2.textBaseline = 'middle';
      if (o.bg) {
        g2.fillStyle = o.bg; g2.beginPath();
        if (o.circle) g2.arc(c.width / 2, ch / 2, ch / 2 - 2, 0, Math.PI * 2); else if (g2.roundRect) g2.roundRect(2, 2, c.width - 4, ch - 4, ch / 3); else g2.rect(2, 2, c.width - 4, ch - 4);
        g2.fill();
      }
      if (o.outline !== false && !o.bg) { g2.lineJoin = 'round'; g2.lineWidth = px * 0.16; g2.strokeStyle = 'rgba(0,0,0,.75)'; g2.strokeText(text, c.width / 2, ch / 2 + px * 0.04); }
      g2.fillStyle = color; g2.fillText(text, c.width / 2, ch / 2 + px * 0.04);
      const tex = new T.CanvasTexture(c); tex.minFilter = T.LinearFilter; tex.generateMipmaps = false;
      rec = _tex[key] = { tex, aspect: c.width / ch };
    }
    const s = new T.Sprite(new T.SpriteMaterial({ map: rec.tex, transparent: true, depthTest: !!o.depthTest, depthWrite: false }));
    s.scale.set(h * rec.aspect, h, 1); s.renderOrder = 20;
    return s;
  };
  /** Bocadillo de diálogo (ancla = punta inferior central). */
  lib.bubbleSprite = function (text) {
    const key = 'bubble|' + text; let rec = _tex[key];
    if (!rec) {
      const px = 34, pad = 22, tail = 24, font = `600 ${px}px UI, system-ui, sans-serif`;
      const c = document.createElement('canvas'); const g = c.getContext('2d'); g.font = font;
      const words = String(text).split(/\s+/), lines = []; let cur = '';
      for (const w of words) { const test = cur ? cur + ' ' + w : w; if (g.measureText(test).width > 330 && cur) { lines.push(cur); cur = w; } else cur = test; }
      if (cur) lines.push(cur);
      const lw = Math.max(...lines.map((l) => g.measureText(l).width));
      c.width = Math.ceil(lw + pad * 2 + 8); c.height = Math.ceil(lines.length * px * 1.25 + pad * 2 + tail + 8);
      const g2 = c.getContext('2d'); g2.font = font; g2.textBaseline = 'top';
      const bw = c.width - 8, bh = c.height - tail - 8;
      g2.lineWidth = 4; g2.strokeStyle = '#1b2547'; g2.fillStyle = '#ffffff'; g2.beginPath();
      if (g2.roundRect) g2.roundRect(4, 4, bw, bh, 22); else g2.rect(4, 4, bw, bh);
      g2.moveTo(c.width / 2 - 14, bh + 3); g2.lineTo(c.width / 2, bh + tail + 3); g2.lineTo(c.width / 2 + 14, bh + 3);
      g2.fill(); g2.stroke();
      g2.fillStyle = '#10183a'; lines.forEach((l, i) => g2.fillText(l, pad + 4, pad + 4 + i * px * 1.25));
      const tex = new T.CanvasTexture(c); tex.minFilter = T.LinearFilter; tex.generateMipmaps = false;
      rec = _tex[key] = { tex, w: c.width, h: c.height };
    }
    const s = new T.Sprite(new T.SpriteMaterial({ map: rec.tex, transparent: true, depthTest: false, depthWrite: false }));
    s.center.set(0.5, 0); s.scale.set(rec.w / 105, rec.h / 105, 1); s.renderOrder = 30; s.userData.base = [rec.w / 105, rec.h / 105];
    return s;
  };
  lib.limpiarCaches = function () { for (const k in _tex) { _tex[k].tex.dispose(); delete _tex[k]; } };

  // ---------- flecha 3D (vectores) ----------
  lib.crearFlecha = function (color) {
    const g = new T.Group();
    const m = new T.MeshBasicMaterial({ color: lib.color(color).clone(), transparent: true, depthTest: false });
    const shaft = new T.Mesh(G.cylLo(), m), head = new T.Mesh(G.cone(), m);
    shaft.renderOrder = head.renderOrder = 15; g.add(shaft, head);
    g.userData = { shaft, head, mat: m }; return g;
  };
  /** Coloca la flecha de (x0,y0) a (x1,y1) en el plano z. */
  lib.ponerFlecha = function (f, x0, y0, x1, y1, z, grosor) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1e-4;
    const hd = Math.min(0.5, len * 0.45), sl = Math.max(len - hd, 0.001), r = grosor || 0.07;
    f.position.set(x0, y0, z); f.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    const u = f.userData; u.shaft.position.y = sl / 2; u.shaft.scale.set(r, sl, r);
    u.head.position.y = sl + hd / 2; u.head.scale.set(r * 3.2, hd, r * 3.2);
  };

  // ---------- partículas globales (burbujas / chispas / polvo): sin estado, solo f(t - t0) ----------
  lib.crearFX = function (scene, reducido) {
    const MAXE = reducido ? 4 : 8, N = reducido ? 12 : 26;
    const tipos = {
      burbujas: { size: 0.3, color: 0xbfe9ff, life: 3.4, sp: 0.11 },
      chispas: { size: 0.17, color: 0xffb347, life: 1.2, sp: 0.025 },
      polvo: { size: 0.5, color: 0xc9b38f, life: 2.8, sp: 0.07 },
    };
    const sistemas = {};
    for (const k in tipos) {
      const tp = tipos[k], geo = new T.BufferGeometry();
      const pos = new Float32Array(MAXE * N * 3), col = new Float32Array(MAXE * N * 3);
      geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
      const pts = new T.Points(geo, new T.PointsMaterial({ size: tp.size, map: lib.puntoTex(), vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true }));
      pts.frustumCulled = false; pts.renderOrder = 12; scene.add(pts);
      sistemas[k] = { tp, pos, col, geo, pts, c: new T.Color(tp.color) };
    }
    return {
      update(lista, t) {
        for (const k in sistemas) {
          const s = sistemas[k], tp = s.tp, em = [];
          for (const p of lista) if (p.tipo === k && p.t0 <= t) em.push(p);
          const ult = em.slice(-MAXE);
          for (let e = 0; e < MAXE; e++) {
            const p = ult[e];
            for (let kk = 0; kk < N; kk++) {
              const i = (e * N + kk) * 3; let vivo = false;
              if (p) {
                const age = t - (p.t0 + kk * tp.sp);
                if (age >= 0 && age <= tp.life) {
                  vivo = true; const u = age / tp.life, sd = e * 97 + kk * 13.7;
                  const px = lib.mapX(p.x), py = lib.mapY(p.y);
                  let x = px, y = py, z = 0.4, f = 1 - u;
                  if (k === 'burbujas') { x += (hash(sd) - 0.5) * 0.7 + Math.sin(age * 4 + sd) * 0.12; y += age * (0.9 + hash(sd + 1) * 0.8); z += (hash(sd + 2) - 0.5) * 0.6; f = Math.sin(u * Math.PI); }
                  else if (k === 'chispas') { const a = hash(sd) * 6.283, v = 1.5 + hash(sd + 1) * 3.2; x += Math.cos(a) * v * age; y += Math.sin(a) * v * age - 3.2 * age * age; z += (hash(sd + 2) - 0.5) * 0.8; f = (1 - u) * (1 - u); }
                  else { x += (hash(sd) - 0.5) * 1.6 * (0.3 + u); y += age * 0.35 + hash(sd + 1) * 0.25; z += (hash(sd + 2) - 0.5) * 0.8; f = Math.sin(u * Math.PI) * 0.55; }
                  s.pos[i] = x; s.pos[i + 1] = y; s.pos[i + 2] = z;
                  s.col[i] = s.c.r * f; s.col[i + 1] = s.c.g * f; s.col[i + 2] = s.c.b * f;
                }
              }
              if (!vivo) { s.pos[i] = 0; s.pos[i + 1] = -999; s.pos[i + 2] = 0; s.col[i] = s.col[i + 1] = s.col[i + 2] = 0; }
            }
          }
          s.geo.attributes.position.needsUpdate = true; s.geo.attributes.color.needsUpdate = true;
        }
      },
    };
  };

  /** Campo de puntos flotantes de fondo (polvo/burbujas/estrellas). Devuelve Points. */
  lib.crearCampo = function (scene, o) {
    const n = o.n, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c1 = lib.color(o.color1), c2 = lib.color(o.color2 || o.color1);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (hash(i + 1) - 0.5) * o.ancho; pos[i * 3 + 1] = (hash(i + 500) - 0.5) * o.alto; pos[i * 3 + 2] = o.z0 + hash(i + 900) * (o.z1 - o.z0);
      const m = hash(i + 1300), b = 0.35 + hash(i + 1700) * 0.65;
      col[i * 3] = lerp(c1.r, c2.r, m) * b; col[i * 3 + 1] = lerp(c1.g, c2.g, m) * b; col[i * 3 + 2] = lerp(c1.b, c2.b, m) * b;
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
    const pts = new T.Points(geo, new T.PointsMaterial({ size: o.size || 0.2, map: lib.puntoTex(), vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true }));
    pts.frustumCulled = false; scene.add(pts); return pts;
  };

  // =====================================================================================
  //  MOTOR 3D GENÉRICO: crearEstilo3D(ctx, cfg)  ->  { update(S,dt), resize(w,h), dispose() }
  //   cfg: { fondo (css), luces(scene,api), ambiente(scene,api)->{tick(t)}, camAz(t,red), camEl(t,red),
  //          niebla, antes(S,ents,api), despues(S,dt,api), frame(S,dt,api), trayColor }
  // =====================================================================================
  lib.crearEstilo3D = function (ctx, cfg) {
    const reduced = ctx.reduced !== undefined ? !!ctx.reduced : reducedMotion();
    const host = ctx.host;
    const defs = {};
    ((ctx.guion && ctx.guion.actores) || []).forEach((d) => { defs[d.id] = d; });

    // --- DOM: contenedor propio detrás del overlay del motor ---
    const wrap = document.createElement('div');
    wrap.className = 'intro3d-wrap';
    wrap.style.cssText = 'position:absolute;inset:0;overflow:hidden;z-index:0;background:' + cfg.fondo;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    wrap.appendChild(canvas);
    try { if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; } catch (e) {}
    host.insertBefore(wrap, host.firstChild);

    let renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { wrap.remove(); throw e; }
    renderer.setPixelRatio(Math.min(ctx.dpr || window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(35, 16 / 9, 0.1, 300);
    let aspect = 16 / 9;
    const api = { T, lib, scene, camera, renderer, reduced, defs, ents: {}, fx: null };
    const ents = api.ents;
    if (cfg.niebla) scene.fog = new T.Fog(cfg.niebla.color, cfg.niebla.near, cfg.niebla.far);

    function resize(w, h) {
      w = w || wrap.clientWidth || 960; h = h || wrap.clientHeight || 540;
      renderer.setSize(w, h, false); aspect = w / h; camera.aspect = aspect;
      // el rectángulo 16:9 siempre cabe entero (letterbox de composición); el fondo llena todo
      const halfH = Math.max(H / 2, W / 2 / aspect);
      camera.fov = (2 * Math.atan(halfH / D0)) / RAD; camera.updateProjectionMatrix();
    }
    resize(ctx.w, ctx.h);
    let ro = null, rw = 0, rh = 0;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => { if (wrap.clientWidth !== rw || wrap.clientHeight !== rh) { rw = wrap.clientWidth; rh = wrap.clientHeight; if (rw && rh) resize(rw, rh); } });
      ro.observe(wrap);
    }

    if (cfg.luces) cfg.luces(scene, api);
    const amb = cfg.ambiente ? cfg.ambiente(scene, api) : null;
    const fx = (api.fx = lib.crearFX(scene, reduced));
    if (cfg.init) cfg.init(api);

    // ----- actores -----
    // Cajas de cada tipo (alto de escena, igual que el motor/monigotes): [ancho, alto, ancla]
    //  ancla: 'base' (pies/ruedas), 'centro', 'pivote' (pendulo, arriba), 'izq' (resorte, pared)
    const EXT = lib.EXT;
    const fusionar = (d, a) => { const o = Object.assign({}, d); for (const k in a) if (a[k] != null && k !== 'def') o[k] = a[k]; return o; };
    function coleccionarMats(root) {
      const mats = [];
      root.traverse((o) => {
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        ms.forEach((m) => {
          if (!m.userData) m.userData = {};
          if (m.userData.baseOp === undefined) { m.userData.baseOp = m.opacity; m.userData.baseTr = m.transparent; if (m.emissive) m.userData.baseEm = m.emissive.clone(); }
          if (!mats.includes(m)) mats.push(m);
        });
      });
      return mats;
    }
    /** Caja (x,y) de las mallas del objeto, ignorando sprites/puntos/líneas y lo marcado userData.noBox */
    const _bb = new T.Box3(), _bt = new T.Box3();
    function cajaDe(obj) {
      obj.updateMatrixWorld(true); _bb.makeEmpty();
      obj.traverse((o) => {
        if (!o.isMesh || o.userData.noBox || !o.geometry) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        _bt.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); _bb.union(_bt);
      });
      return _bb.isEmpty() ? null : _bb.clone();
    }
    function crearActor(id, a) {
      const spec = fusionar(Object.assign({}, defs[id] || {}, a.def || {}), a);
      const fab = lib.builders[spec.tipo] || lib.builders.__fallback;
      let b;
      try { b = fab(spec, api); } catch (err) { console.error('[intro3d] error construyendo', spec.tipo, err); b = lib.builders.__fallback(spec, api); }
      const ext = EXT[spec.tipo] || [0.12, 0.12, 'centro'];
      // tamaño natural del modelo -> se ajusta a la caja del tipo (misma composición que monigotes)
      let nw = 2, nh = 2, ax = 0, ay = 0;
      const bx = cajaDe(b.obj);
      if (bx) {
        nw = Math.max(0.05, bx.max.x - bx.min.x); nh = Math.max(0.05, bx.max.y - bx.min.y);
        const cx = (bx.max.x + bx.min.x) / 2, cy = (bx.max.y + bx.min.y) / 2;
        if (ext[2] === 'base') { ax = cx; ay = bx.min.y; } else if (ext[2] === 'pivote') { ax = cx; ay = bx.max.y; } else if (ext[2] === 'izq') { ax = bx.min.x; ay = cy; } else { ax = cx; ay = cy; }
      }
      if (b.caja) { nw = b.caja[0]; nh = b.caja[1]; }
      if (b.ancla) { ax = b.ancla[0]; ay = b.ancla[1]; }
      const fit = (b.fit != null ? b.fit : Math.sqrt((ext[0] * H / nw) * (ext[1] * H / nh))) * (b.fitK || 1);
      const holder = new T.Group(); holder.scale.setScalar(fit); holder.position.set(-ax * fit, -ay * fit, 0); holder.add(b.obj);
      const root = new T.Group(); root.add(holder); scene.add(root);
      const w = nw * fit, h = nh * fit;
      // centro visual del actor respecto al ancla (escala 1) y distancia al borde superior
      const cOff = ext[2] === 'base' ? [0, h / 2] : ext[2] === 'pivote' ? [0, -h / 2] : ext[2] === 'izq' ? [w / 2, 0] : [0, 0];
      const arriba = ext[2] === 'base' ? h : ext[2] === 'pivote' ? 0.1 : h / 2;
      return { id, spec, b, root, holder, mats: coleccionarMats(root), alpha: 1, res: 0, lastColor: spec.color, bubble: null, bubbleTxt: null, bubbleK: 0, halo: null, oculto: false,
        radio: Math.max(w, h) / 2, w, h, cOff, arriba, ext };
    }
    /** centro visual del actor en el mundo (aprox., sin rotación) */
    const centroDe = (e, out) => out.set(e.root.position.x + e.cOff[0] * e.root.scale.x, e.root.position.y + e.cOff[1] * e.root.scale.x, 0);
    function aplicarEstado(e, alpha, res) {
      if (Math.abs(alpha - e.alpha) < 0.002 && Math.abs(res - e.res) < 0.004) return;
      e.alpha = alpha; e.res = res;
      for (const m of e.mats) {
        const u = m.userData; m.opacity = u.baseOp * alpha; m.transparent = u.baseTr || alpha < 0.999;
        if (m.emissive && u.baseEm) { const k = res * 0.5; m.emissive.setRGB(u.baseEm.r + k, u.baseEm.g + k, u.baseEm.b + k); }
      }
    }
    function bocadillo(e, a, dt) {
      const txt = a.hablando && e.root.visible ? String(a.hablando) : null;
      if (txt !== e.bubbleTxt) {
        if (e.bubble) { scene.remove(e.bubble); e.bubble.material.dispose(); e.bubble = null; }
        e.bubbleTxt = txt;
        if (txt) { e.bubble = lib.bubbleSprite(txt); scene.add(e.bubble); e.bubbleK = 0; }
      }
      if (!e.bubble) return;
      e.bubbleK = Math.min(1, e.bubbleK + dt * 5);
      const vz = api.vista || { tx: 0, ty: 0, z: 1 }, zi = 1 / Math.max(0.6, vz.z);   // el bocadillo mantiene su tamaño en pantalla
      const k = 1 + 0.12 * Math.sin(e.bubbleK * Math.PI); const pop = smooth(0, 1, e.bubbleK) * k, bs0 = e.bubble.userData.base;
      const bs = [bs0[0] * zi, bs0[1] * zi];
      e.bubble.scale.set(bs[0] * pop, bs[1] * pop, 1);
      // se mantiene dentro de lo que ve la cámara (zoom/centro) con un margen; el plano z=1.2 está algo más cerca
      const vw = (W / 2) / vz.z * 0.9, vh = (H / 2) / vz.z * 0.9, hw = bs[0] / 2;
      const bx = clamp(e.root.position.x, vz.tx - vw + hw + 0.2, vz.tx + vw - hw - 0.2);
      const by = Math.min(e.root.position.y + e.arriba * e.root.scale.x + 0.3, vz.ty + vh - bs[1] - 0.1);
      e.bubble.position.set(bx, by, 1.2);
    }
    const _c = new T.Vector3();
    function halo(e, a, t) {
      if (e.res < 0.01) { if (e.halo) e.halo.visible = false; return; }
      if (!e.halo) { e.halo = new T.Mesh(G.ring(), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthTest: false, depthWrite: false, side: T.DoubleSide })); e.halo.renderOrder = 10; scene.add(e.halo); }
      const r = e.radio * e.root.scale.x * 1.3 * (1 + 0.06 * Math.sin(t * 7));
      e.halo.visible = true; centroDe(e, _c); e.halo.position.copy(_c); e.halo.position.z += 0.3; e.halo.quaternion.copy(camera.quaternion);
      e.halo.scale.set(r, r, 1); e.halo.material.opacity = e.res * 0.85;
    }

    // ----- vectores (flechas con etiqueta) -----
    const vecPool = [];
    const colorVec = (et) => { const c = String(et || '').replace(/[\\$\s{]|vec/g, '')[0]; return c === 'v' || c === 'V' ? '#4cc9f0' : c === 'a' ? '#2ee59d' : c === 'p' ? '#c77dff' : c === 'F' || c === 'f' || c === 'Σ' ? '#ff6b6b' : '#ffb830'; };
    function vectores(S) {
      const lista = S.vectores || [];
      for (let i = 0; i < Math.max(lista.length, vecPool.length); i++) {
        const v = lista[i]; let slot = vecPool[i];
        if (!v) { if (slot) { slot.arrow.visible = false; if (slot.lab) slot.lab.visible = false; } continue; }
        const e = ents[v.actor], a = S.actores && S.actores[v.actor];
        if (!e || !a || !e.root.visible) { if (slot) { slot.arrow.visible = false; if (slot.lab) slot.lab.visible = false; } continue; }
        if (!slot) { slot = vecPool[i] = { arrow: lib.crearFlecha('#ffb830'), lab: null, txt: null, col: '' }; scene.add(slot.arrow); }
        const col = colorVec(v.etiqueta); if (col !== slot.col) { slot.col = col; slot.arrow.userData.mat.color.copy(lib.color(col)); }
        let dx = (v.dx || 0) * W, dy = -(v.dy || 0) * H; const L = Math.hypot(dx, dy);
        if (L > 6.5) { dx *= 6.5 / L; dy *= 6.5 / L; }
        const ux = L > 1e-4 ? dx / Math.hypot(dx, dy) : 1, uy = L > 1e-4 ? dy / Math.hypot(dx, dy) : 0;
        centroDe(e, _c);
        const off = e.radio * e.root.scale.x * 0.5;
        const x0 = _c.x + ux * off, y0 = _c.y + uy * off;
        const alpha = v.alpha != null ? v.alpha : 1;
        slot.arrow.visible = alpha > 0.01; slot.arrow.userData.mat.opacity = alpha;
        lib.ponerFlecha(slot.arrow, x0, y0, x0 + dx, y0 + dy, 1.0, 0.075);
        const et = v.etiqueta ? lib.texPlano(v.etiqueta) : '';
        if (et !== slot.txt) { if (slot.lab) { scene.remove(slot.lab); slot.lab.material.dispose(); slot.lab = null; } slot.txt = et; if (et) { slot.lab = lib.textSprite(et, { color: '#ffffff', h: 0.5, px: 60 }); scene.add(slot.lab); } }
        if (slot.lab) { slot.lab.visible = alpha > 0.01; slot.lab.material.opacity = alpha; slot.lab.position.set(x0 + dx + ux * 0.5 - uy * 0.15, y0 + dy + uy * 0.5 + 0.28, 1.2); }
      }
    }

    // ----- trayectorias (curva con estela) -----
    const trays = {}, MAXP = 240;
    function trayectorias(S) {
      const T0 = S.trayectorias || {};
      for (const id in trays) if (!T0[id]) trays[id].line.visible = trays[id].pts.visible = false;
      for (const id in T0) {
        let pts = T0[id]; if (!pts || pts.length < 2) continue;
        let tr = trays[id];
        if (!tr) {
          const geo = new T.BufferGeometry();
          geo.setAttribute('position', new T.BufferAttribute(new Float32Array(MAXP * 3), 3)); geo.setAttribute('color', new T.BufferAttribute(new Float32Array(MAXP * 3), 3));
          const line = new T.Line(geo, new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthTest: false }));
          const pp = new T.Points(geo, new T.PointsMaterial({ size: 0.16, map: lib.puntoTex(), vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending }));
          line.frustumCulled = pp.frustumCulled = false; line.renderOrder = 9; pp.renderOrder = 9; scene.add(line, pp);
          tr = trays[id] = { geo, line, pts: pp, n: -1, c: '' };
        }
        const a = S.actores && S.actores[id];
        const base = lib.color(a && a.color, cfg.trayColor || '#ffd166');
        const n = Math.min(pts.length, MAXP), paso = pts.length / n;
        const P = tr.geo.attributes.position.array, C = tr.geo.attributes.color.array;
        for (let i = 0; i < n; i++) {
          const q = pts[Math.min(pts.length - 1, Math.round(i * paso))], f = 0.25 + 0.75 * (i / (n - 1));
          P[i * 3] = lib.mapX(q[0]); P[i * 3 + 1] = lib.mapY(q[1]); P[i * 3 + 2] = 0.1;
          C[i * 3] = base.r * f; C[i * 3 + 1] = base.g * f; C[i * 3 + 2] = base.b * f;
        }
        tr.geo.setDrawRange(0, n); tr.geo.attributes.position.needsUpdate = true; tr.geo.attributes.color.needsUpdate = true;
        tr.line.visible = tr.pts.visible = true;
      }
    }

    // ----- cámara -----
    function camara(S, t) {
      const c = S.camara || {}, z = clamp(c.zoom || 1, 0.3, 6);
      const tx = lib.mapX(c.cx != null ? c.cx : 0.5), ty = lib.mapY(c.cy != null ? c.cy : 0.5);
      const az = cfg.camAz ? cfg.camAz(t, reduced) : 0, el = cfg.camEl ? cfg.camEl(t, reduced) : 0, d = D0 / z;
      camera.position.set(tx + Math.sin(az) * Math.cos(el) * d, ty + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
      camera.lookAt(tx, ty, 0);
      api.vista = { tx, ty, z };
    }

    // ----- bucle principal -----
    let lastT = 0;
    function update(S, dt) {
      dt = clamp(dt || 0.016, 0, 0.1);
      const t = S.t || 0; const acts = S.actores || {};
      S.i = S.reloj != null ? S.reloj : t; // reloj "idle": sigue corriendo durante las pausas del guion
      if (t < lastT - 0.4 && cfg.reinicio) cfg.reinicio(api);
      lastT = t;
      for (const id in acts) if (!ents[id]) ents[id] = crearActor(id, acts[id]);
      if (cfg.antes) cfg.antes(S, ents, api);
      let zi = 0;
      for (const id in ents) {
        const e = ents[id], a = acts[id];
        if (!a) { e.root.visible = false; if (e.bubble) e.bubble.visible = false; continue; }
        const alphaS = a.alpha != null ? a.alpha : 1;
        const vis = !e.oculto && a.visible !== false && alphaS > 0.01;
        const res = clamp(a.resaltado || 0, 0, 1);
        e.root.position.set(lib.mapX(a.x), lib.mapY(a.y), (zi++ % 7) * 0.02);
        e.root.scale.setScalar(Math.max(0.001, (a.escala != null ? a.escala : 1) * (1 + 0.1 * res * (0.6 + 0.4 * Math.sin(S.i * 8)))));
        e.root.rotation.z = e.b.rotPropia ? 0 : -(a.rot || 0);   // rot llega en RADIANES (00-engine.js)
        e.root.visible = vis;
        if (e.oculto && e.b.update) e.b.update(a, S, dt, e);       // sigue "viva" para que la reacción lea sus átomos
        if (!vis) { if (e.bubble) e.bubble.visible = false; continue; }
        if (a.color && a.color !== e.lastColor && e.b.tint) { e.lastColor = a.color; const c = lib.color(a.color); e.b.tint.forEach((m) => m.color.copy(c)); }
        if (e.b.update) e.b.update(a, S, dt, e);
        aplicarEstado(e, alphaS, res);
        if (e.bubble) e.bubble.visible = true;
        bocadillo(e, a, dt); halo(e, a, S.i);
      }
      if (cfg.despues) cfg.despues(S, dt, api);
      vectores(S); trayectorias(S);
      fx.update(S.particulas || [], t);
      camara(S, S.i);
      if (amb && amb.tick) amb.tick(S.i);
      if (cfg.frame) cfg.frame(S, dt, api);
      renderer.render(scene, camera);
    }

    function dispose() {
      if (ro) ro.disconnect();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      });
      for (const k in _geo) { try { _geo[k].dispose(); } catch (e) {} delete _geo[k]; }
      lib.limpiarCaches();
      if (_puntoTex) { _puntoTex.dispose(); _puntoTex = null; }
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {}
      wrap.remove();
    }
    return { update, resize, dispose };
  };

  // =====================================================================================
  //  CONSTRUCTORES GENÉRICOS (lib.builders). Firma: fab(spec, api) -> { obj, radio, base?, update?(a,S,dt,e), tint?, rotPropia? }
  //  Aquí: bola, texto, fallback y los de química. Física: en 50-fisica3d.js
  // =====================================================================================
  const B = lib.builders;

  B.bola = function (spec) {
    const m = lib.mat(spec.color || '#ffd166', { shininess: 90 });
    const g = new T.Group(); g.add(lib.mesh(G.sphere(), m, 0, 0, 0, 0.5));
    return { obj: g, radio: 0.55, tint: [m] };
  };
  B.__fallback = B.bola;

  B.texto = function (spec) {
    const txt = String(spec.texto || spec.etiqueta || spec.formula || spec.nombre || spec.id || '');
    const s = lib.textSprite(txt, { color: spec.color || '#ffffff', h: 0.8, px: 64 });
    const g = new T.Group(); g.add(s);
    return { obj: g, radio: Math.max(0.5, s.scale.x / 2) };
  };

  // ---------- elementos químicos (colores CPK) ----------
  const ELEM = {
    H: ['#ffffff', 0.32], He: ['#d9ffff', 0.35], Li: ['#cc80ff', 0.6], Be: ['#c2ff00', 0.5], B: ['#ffb5b5', 0.5], C: ['#4a4d57', 0.5], N: ['#3050f8', 0.47],
    O: ['#ff2a2a', 0.46], F: ['#90e050', 0.42], Ne: ['#b3e3f5', 0.4], Na: ['#ab5cf2', 0.72], Mg: ['#8aff00', 0.62], Al: ['#bfa6a6', 0.6], Si: ['#f0c8a0', 0.58],
    P: ['#ff8000', 0.56], S: ['#f5e62a', 0.58], Cl: ['#1ff01f', 0.62], Ar: ['#80d1e3', 0.5], K: ['#8f40d4', 0.85], Ca: ['#3dff00', 0.75], Fe: ['#e06633', 0.62],
    Cu: ['#c88033', 0.6], Zn: ['#7d80b0', 0.6], Br: ['#a62929', 0.66], Ag: ['#c0c0c0', 0.68], I: ['#940094', 0.8], Au: ['#ffd123', 0.68], Pb: ['#575961', 0.75],
    Ba: ['#00c900', 0.85], Mn: ['#9c7ac7', 0.6], Cr: ['#8a99c7', 0.6], Ni: ['#50d050', 0.6], Co: ['#f090a0', 0.6], Sn: ['#668080', 0.7], Hg: ['#b8b8d0', 0.72],
  };
  const SIMBOLOS = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr'.split(' ');
  const infoEl = (el) => { const e = ELEM[el] || ['#c9a0dc', 0.55]; return { c: e[0], r: e[1] }; };
  lib.infoElemento = infoEl;

  /** Formula -> {cuentas:{El:n}, carga:int, orden:[El...]}  (admite subíndices/superíndices unicode) */
  function parseFormula(txt) {
    let s = String(txt || '').replace(/\s+/g, '');
    s = s.replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080)).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => '0123456789'['⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)]).replace(/⁺/g, '+').replace(/⁻|−|–/g, '-');
    let carga = 0; const m = s.match(/\^?\{?(\d*)([+-])\}?$/);
    if (m && s.length > m[0].length) { carga = (m[1] ? +m[1] : 1) * (m[2] === '+' ? 1 : -1); s = s.slice(0, s.length - m[0].length); }
    const cuentas = {}, orden = []; const re = /([A-Z][a-z]?)(\d*)/g; let r, ok = false;
    while ((r = re.exec(s))) { ok = true; if (!(r[1] in cuentas)) { cuentas[r[1]] = 0; orden.push(r[1]); } cuentas[r[1]] += r[2] ? +r[2] : 1; }
    return ok && s.replace(/([A-Z][a-z]?)(\d*)/g, '') === '' ? { cuentas, carga, orden } : null;
  }
  lib.parseFormula = parseFormula;
  const firma = (c) => Object.keys(c).sort().map((k) => k + (c[k] > 1 ? c[k] : '')).join('');

  // Biblioteca de geometrías moleculares (longitud de enlace ~1). bonds: [i,j,orden]
  const tetra = (c) => [[c, 0.58, 0.58, 0.58], [c, 0.58, -0.58, -0.58], [c, -0.58, 0.58, -0.58], [c, -0.58, -0.58, 0.58]];
  const MOLS = {
    H2O: { a: [['O', 0, 0.2, 0], ['H', -0.78, -0.4, 0], ['H', 0.78, -0.4, 0]], b: [[0, 1, 1], [0, 2, 1]] },
    CO2: { a: [['C', 0, 0, 0], ['O', -1.2, 0, 0], ['O', 1.2, 0, 0]], b: [[0, 1, 2], [0, 2, 2]] },
    CH4: { a: [['C', 0, 0, 0], ...tetra('H')], b: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] },
    H3N: { a: [['N', 0, 0.3, 0], ['H', 0.9, -0.2, 0], ['H', -0.45, -0.2, 0.78], ['H', -0.45, -0.2, -0.78]], b: [[0, 1, 1], [0, 2, 1], [0, 3, 1]] },
    H3O: { a: [['O', 0, 0.3, 0], ['H', 0.9, -0.2, 0], ['H', -0.45, -0.2, 0.78], ['H', -0.45, -0.2, -0.78]], b: [[0, 1, 1], [0, 2, 1], [0, 3, 1]] },
    H4N: { a: [['N', 0, 0, 0], ...tetra('H')], b: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] },
    O2: { a: [['O', -0.6, 0, 0], ['O', 0.6, 0, 0]], b: [[0, 1, 2]] },
    H2: { a: [['H', -0.4, 0, 0], ['H', 0.4, 0, 0]], b: [[0, 1, 1]] },
    N2: { a: [['N', -0.55, 0, 0], ['N', 0.55, 0, 0]], b: [[0, 1, 3]] },
    Cl2: { a: [['Cl', -0.95, 0, 0], ['Cl', 0.95, 0, 0]], b: [[0, 1, 1]] },
    ClH: { a: [['H', -0.62, 0, 0], ['Cl', 0.62, 0, 0]], b: [[0, 1, 1]] },
    ClNa: { a: [['Na', -1.0, 0, 0], ['Cl', 1.0, 0, 0]], b: [] },
    H2O2: { a: [['O', -0.7, 0, 0], ['O', 0.7, 0, 0], ['H', -1.15, 0.75, 0.3], ['H', 1.15, -0.75, 0.3]], b: [[0, 1, 1], [0, 2, 1], [1, 3, 1]] },
    HO: { a: [['O', -0.45, 0, 0], ['H', 0.5, 0, 0]], b: [[0, 1, 1]] },
    CH4O: { a: [['C', -0.7, 0, 0], ['O', 0.7, 0, 0], ['H', 1.2, -0.75, 0], ['H', -1.1, 0.9, 0], ['H', -1.1, -0.45, 0.8], ['H', -1.1, -0.45, -0.8]], b: [[0, 1, 1], [1, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1]] },
    C2H6: { a: [['C', -0.78, 0, 0], ['C', 0.78, 0, 0], ['H', -1.2, 0.95, 0], ['H', -1.2, -0.48, 0.82], ['H', -1.2, -0.48, -0.82], ['H', 1.2, 0.95, 0], ['H', 1.2, -0.48, 0.82], ['H', 1.2, -0.48, -0.82]], b: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [1, 5, 1], [1, 6, 1], [1, 7, 1]] },
    C2H4: { a: [['C', -0.67, 0, 0], ['C', 0.67, 0, 0], ['H', -1.25, 0.92, 0], ['H', -1.25, -0.92, 0], ['H', 1.25, 0.92, 0], ['H', 1.25, -0.92, 0]], b: [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1]] },
    C2H6O: { a: [['C', -1.4, -0.2, 0], ['C', 0, 0.4, 0], ['O', 1.2, -0.3, 0], ['H', 1.9, 0.2, 0], ['H', -1.9, 0.5, 0.75], ['H', -1.9, 0.4, -0.8], ['H', -1.5, -1.2, 0.1], ['H', 0, 1.1, 0.8], ['H', 0, 1.0, -0.85]], b: [[0, 1, 1], [1, 2, 1], [2, 3, 1], [0, 4, 1], [0, 5, 1], [0, 6, 1], [1, 7, 1], [1, 8, 1]] },
    C2H4O2: { a: [['C', -1.3, 0, 0], ['C', 0, 0, 0], ['O', 0.6, 1.0, 0], ['O', 0.7, -1.0, 0], ['H', 1.6, -0.9, 0], ['H', -1.7, 0.95, 0], ['H', -1.7, -0.5, 0.82], ['H', -1.7, -0.5, -0.82]], b: [[0, 1, 1], [1, 2, 2], [1, 3, 1], [3, 4, 1], [0, 5, 1], [0, 6, 1], [0, 7, 1]] },
    O4S: { a: [['S', 0, 0, 0], ...tetra('O').map((p) => [p[0], p[1] * 1.7, p[2] * 1.7, p[3] * 1.7])], b: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] },
    NO3: { a: [['N', 0, 0, 0], ['O', 1.05, 0, 0], ['O', -0.52, 0.91, 0], ['O', -0.52, -0.91, 0]], b: [[0, 1, 2], [0, 2, 1], [0, 3, 1]] },
    CO3: { a: [['C', 0, 0, 0], ['O', 1.05, 0, 0], ['O', -0.52, 0.91, 0], ['O', -0.52, -0.91, 0]], b: [[0, 1, 2], [0, 2, 1], [0, 3, 1]] },
  };
  const NOMBRES = { agua: 'H2O', water: 'H2O', eau: 'H2O', metano: 'CH4', methane: 'CH4', amoniaco: 'NH3', ammoniac: 'NH3', oxigeno: 'O2', dioxigeno: 'O2', dioxygène: 'O2', hidrogeno: 'H2', dihidrogeno: 'H2', dihydrogène: 'H2', nitrogeno: 'N2', co2: 'CO2', 'dioxido de carbono': 'CO2', 'dioxyde de carbone': 'CO2', etanol: 'C2H5OH', ethanol: 'C2H5OH', metanol: 'CH3OH', 'acido acetico': 'CH3COOH', 'acide éthanoïque': 'CH3COOH', 'acide acétique': 'CH3COOH', oxonio: 'H3O+', hidroxido: 'HO-', hydroxyde: 'HO-', hidronio: 'H3O+', 'sal': 'NaCl', cloro: 'Cl2', dicloro: 'Cl2', peroxido: 'H2O2', etileno: 'C2H4', etano: 'C2H6' };

  // El guion rara vez trae `formula`: se deduce del id del actor (agua1, h3o_a, hcl, alcohol...).
  const IDF = [
    [/^(h2o2|peroxid)/, 'H2O2'], [/^(agua|eau|water|h2o)/, 'H2O'], [/^(co2|dioxido|dioxyde)/, 'CO2'], [/^(o2|oxigeno|dioxigeno)/, 'O2'], [/^(h2|hidrogeno|dihidrogeno)$/, 'H2'],
    [/^(n2|nitrogeno)/, 'N2'], [/^(ch4|metano|methane)/, 'CH4'], [/^(nh3|amoniaco|ammoniac|base)/, 'NH3'], [/^(nh4|amonio)/, 'NH4+'], [/^(alcohol|etanol|ethanol)/, 'C2H5OH'],
    [/^(acido|acid|ah$|acetico|etanoico|acide|ethanoique)/, 'CH3COOH'], [/^(hcl|clorhidrico)/, 'HCl'], [/^(h3o|oxonio|hidronio)/, 'H3O+'], [/^(ho|oh|hidroxido|hydroxyde)$/, 'HO-'],
    [/^(proton|h\+)/, 'H+'], [/^(ab$|acetato|ethanoate)/, 'CH3COO-'], [/^(cl|cloruro|chlorure)/, 'Cl-'], [/^(zn|zinc|metal)/, 'Zn2+'], [/^(yodo|diyodo|iode|i2$)/, 'I2'],
    [/^(i\d*|yoduro|iodure)$/, 'I-'], [/^(na|sodio)/, 'Na+'], [/^(cu|cobre)/, 'Cu2+'], [/^(ag|plata)/, 'Ag+'], [/^(fe|hierro)/, 'Fe2+'], [/^(ca)\d*$/, 'Ca2+'],
  ];
  /** Fórmula "oficial" del actor: campo explícito del guion o deducida del id. null si no se sabe. */
  lib.formulaDeActor = function (spec) {
    for (const c of [spec.formula, spec.molecula, spec.simbolo, spec.elemento]) if (c) return String(c);
    const base = String(spec.id || '').toLowerCase().replace(/_.*$/, '');
    for (const [re, f] of IDF) if (re.test(base)) return f;
    return null;
  };
  // Cajas por tipo (idénticas a K.EXT del motor 00-engine.js): [ancho, alto, ancla] en "alturas de escena"
  lib.EXT = {
    auto: [0.32, 0.15, 'base'], perro: [0.18, 0.13, 'base'], humano: [0.11, 0.28, 'base'], cohete: [0.08, 0.24, 'centro'], planeta: [0.17, 0.17, 'centro'], luna: [0.09, 0.09, 'centro'],
    tubo_ensayo: [0.07, 0.24, 'base'], vaso: [0.13, 0.16, 'base'], bola: [0.07, 0.07, 'centro'], molecula: [0.15, 0.13, 'centro'], atomo: [0.15, 0.15, 'centro'], ion: [0.09, 0.09, 'centro'],
    electron: [0.035, 0.035, 'centro'], circuito: [0.36, 0.24, 'centro'], pendulo: [0.12, 0.34, 'pivote'], resorte: [0.34, 0.07, 'izq'], onda: [0.5, 0.13, 'centro'], lente: [0.09, 0.3, 'centro'],
    rayo: [0.28, 0.04, 'centro'], flecha: [0.16, 0.05, 'centro'], bloque: [0.12, 0.1, 'base'], fluido: [0.5, 0.2, 'centro'], termometro: [0.05, 0.24, 'base'], texto: [0.22, 0.06, 'centro'],
  };
  /** LaTeX sencillo -> texto plano unicode (usa el kit del motor si existe) */
  lib.texPlano = function (s) {
    const K = PCB.intro && PCB.intro.kit;
    const r = K && K.texPlano ? K.texPlano(s) : String(s == null ? '' : s).replace(/\$|\\(?:vec|text|mathrm)|[{}]/g, '').replace(/\\([A-Za-z]+)/g, '$1');
    return r.replace(/\u20d7/g, ''); // la flecha combinante no existe en la mayoría de fuentes
  };

  /** spec -> {atomos:[{el,p:[x,y,z]}], enlaces:[[i,j,ord]], carga, generica} */
  function resolverMolecula(spec) {
    const cand = [spec.formula, spec.molecula, spec.simbolo, spec.texto, spec.etiqueta, spec.nombre, lib.formulaDeActor(spec), spec.id].filter(Boolean).map(String);
    let parsed = null, nombreKey = null;
    for (const c of cand) {
      const k = c.toLowerCase().trim(); if (NOMBRES[k]) { nombreKey = NOMBRES[k]; parsed = parseFormula(nombreKey); break; }
      const p = parseFormula(c); if (p && (MOLS[firma(p.cuentas)] || !parsed)) { parsed = p; if (MOLS[firma(p.cuentas)]) break; }
    }
    if (!parsed) { const gen = ['CO2', 'O2', 'N2', 'CH4', 'H3N', 'H2O']; parsed = parseFormula(gen[Math.floor(hash(String(spec.id || 'x').split('').reduce((q, c) => q + c.charCodeAt(0), 7)) * gen.length)].replace('H3N', 'NH3')); }
    const sig = firma(parsed.cuentas), lib0 = MOLS[sig];
    if (lib0) return { atomos: lib0.a.map((q) => ({ el: q[0], p: [q[1], q[2], q[3]] })), enlaces: lib0.b, carga: parsed.carga, generica: false };
    // Genérico: átomo central (el menos abundante no-H, o el primero) con los demás en esfera de Fibonacci
    const lista = []; parsed.orden.forEach((el) => { for (let i = 0; i < parsed.cuentas[el]; i++) lista.push(el); });
    if (lista.length === 1) return { atomos: [{ el: lista[0], p: [0, 0, 0] }], enlaces: [], carga: parsed.carga, generica: true };
    if (lista.length > 14) lista.length = 14;
    let ci = 0, best = 1e9; lista.forEach((el, i) => { const sc = (el === 'H' ? 100 : 0) + parsed.cuentas[el]; if (sc < best) { best = sc; ci = i; } });
    const centro = lista.splice(ci, 1)[0], at = [{ el: centro, p: [0, 0, 0] }], en = [];
    lista.forEach((el, i) => {
      const n = lista.length, y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), th = i * 2.399963;
      const rad = el === 'H' ? 0.95 : 1.15; at.push({ el, p: [Math.cos(th) * r * rad, y * rad, Math.sin(th) * r * rad] }); en.push([0, i + 1, 1]);
    });
    return { atomos: at, enlaces: en, carga: parsed.carga, generica: true };
  }
  lib.resolverMolecula = resolverMolecula;

  const _vp0 = new T.Vector3(), _vp1 = new T.Vector3(), _perp = new T.Vector3();
  const MATBOND = { color: '#cfd6e6' };

  B.molecula = function (spec) {
    const m = resolverMolecula(spec), K = 1.1, grp = new T.Group(), spin = new T.Group(); grp.add(spin);
    const matEl = {}, atomos = [], enlaces = [];
    let rmax = 0.5;
    m.atomos.forEach((at) => {
      const inf = infoEl(at.el);
      const mt = matEl[at.el] || (matEl[at.el] = lib.mat(inf.c, { shininess: 80, specular: 0x666666 }));
      const r = inf.r * 0.82 * K, mesh = lib.mesh(G.sphere(), mt, at.p[0] * K, at.p[1] * K, at.p[2] * K, r);
      spin.add(mesh); atomos.push({ mesh, el: at.el, r, lp: new T.Vector3(at.p[0] * K, at.p[1] * K, at.p[2] * K), mat: mt });
      rmax = Math.max(rmax, Math.hypot(at.p[0], at.p[1], at.p[2]) * K + r);
    });
    const mb = lib.mat(MATBOND.color, { shininess: 60 });
    m.enlaces.forEach(([i, j, ord]) => {
      if (!ord) return;
      const p0 = atomos[i].lp, p1 = atomos[j].lp; _perp.subVectors(p1, p0).normalize();
      let ref = Math.abs(_perp.z) > 0.9 ? _vp1.set(0, 1, 0) : _vp1.set(0, 0, 1);
      _perp.cross(ref).normalize();
      const offs = ord === 1 ? [0] : ord === 2 ? [-0.11, 0.11] : [-0.2, 0, 0.2], rad = ord === 1 ? 0.08 : 0.055;
      offs.forEach((o) => { const c = new T.Mesh(G.cylLo(), mb); lib.ponerVarilla(c, _vp0.copy(p0).addScaledVector(_perp, o), _vp1.copy(p1).addScaledVector(_perp, o), rad); spin.add(c); enlaces.push({ mesh: c, i, j, ord }); });
    });
    // insignia de carga (iones poliatómicos / moleculares)
    if (m.carga) {
      const txt = (Math.abs(m.carga) > 1 ? Math.abs(m.carga) : '') + (m.carga > 0 ? '+' : '−');
      const bd = lib.textSprite(txt, { color: '#fff', bg: m.carga > 0 ? '#e5384f' : '#2f6bff', circle: true, h: 0.62, px: 50 });
      bd.position.set(rmax * 0.8, rmax * 0.8, 0.5); grp.add(bd);
    }
    // resplandor del color del actor (identifica a cada molécula del guion) + átomos "pesados" virados a ese color
    const glow = lib.glow('#ffffff', rmax * 3.2, 0.3); glow.userData.noBox = true; grp.add(glow);
    let colAct = null;
    const pintar = (c) => {
      colAct = c; const cc = c && !/^#f{3,6}$/i.test(c) ? lib.color(c) : null;
      for (const el in matEl) { const m0 = matEl[el]; m0.color.copy(lib.color(infoEl(el).c)); if (cc && el !== 'H') m0.color.lerp(cc, 0.2); m0.emissive.copy(m0.color).multiplyScalar(0.28); if (m0.userData.baseEm) m0.userData.baseEm.copy(m0.emissive); }
      glow.visible = !!cc; if (cc) glow.material.color.copy(cc);
    };
    pintar(spec.color);
    const fase = hash([...String(spec.id || 'x')].reduce((q, c) => q + c.charCodeAt(0), 3)) * 6.28;
    return {
      obj: grp, radio: rmax + 0.3, mol: { atomos, enlaces, spin, K, m },
      update(a, S, dt) {
        spin.rotation.y = 0.8 * Math.sin(S.i * 0.7 + fase); spin.rotation.x = 0.3 * Math.sin(S.i * 0.45 + fase * 1.7); // vaivén: nunca queda de canto
        if (a.color && a.color !== colAct) pintar(a.color);
      },
    };
  };

  // ---------- átomo con núcleo, órbitas y electrones ----------
  function zDe(spec) {
    if (spec.Z || spec.z) { zDe.conocido = true; return +(spec.Z || spec.z); }
    zDe.conocido = false;
    for (const c of [spec.elemento, spec.simbolo, spec.formula, spec.texto, spec.etiqueta, spec.nombre, lib.formulaDeActor(spec)]) {
      if (!c) continue; const p = parseFormula(c); if (p && p.orden.length === 1) { const i = SIMBOLOS.indexOf(p.orden[0]); if (i >= 0) { zDe.conocido = true; return i + 1; } }
    }
    return 6;
  }
  B.atomo = function (spec) {
    const Z = zDe(spec), conocido = zDe.conocido, el = SIMBOLOS[Z - 1] || 'C', inf = infoEl(el), col = spec.color || (el === 'C' ? '#4cc9f0' : inf.c);
    const grp = new T.Group(), nuc = new T.Group(); grp.add(nuc);
    const mr = lib.mat('#ff5d73', { shininess: 80 }), mb = lib.mat('#8ea0ff', { shininess: 80 });
    for (let i = 0; i < 8; i++) {
      const y = 1 - (i / 7) * 2, r = Math.sqrt(1 - y * y), th = i * 2.4;
      nuc.add(lib.mesh(G.sphereLo(), i % 2 ? mb : mr, Math.cos(th) * r * 0.2, y * 0.2, Math.sin(th) * r * 0.2, 0.17));
    }
    nuc.add(lib.glow(col, 1.9, 0.7));
    const capas = []; let rest = Z; for (const cap of [2, 8, 8, 18]) { if (rest <= 0) break; capas.push(Math.min(cap, rest)); rest -= cap; }
    const matOrb = new T.LineBasicMaterial({ color: lib.color(col).clone(), transparent: true, opacity: 0.55 });
    const matEl2 = lib.mat('#7fe8ff', { emissive: 0x2299cc, shininess: 100 });
    const elec = [];
    capas.forEach((n, k) => {
      const R = 0.95 + 0.7 * k, og = new T.Group(); og.rotation.set(1.15 + k * 0.28, k * 0.55, k * 1.0);
      const ln = new T.LineLoop(G.unitCircle(), matOrb); ln.scale.set(R, R, 1); og.add(ln);
      for (let i = 0; i < n; i++) { const e = lib.mesh(G.sphereLo(), matEl2, 0, 0, 0, 0.1); og.add(e); elec.push({ e, R, ph: (i / n) * Math.PI * 2 + k, w: 1.7 / (1 + 0.55 * k) }); }
      grp.add(og);
    });
    if (conocido) { const etq = lib.textSprite(el, { color: '#fff', h: 0.42, px: 60 }); etq.position.set(0, -(0.95 + 0.7 * (capas.length - 1)) * 0.6 - 0.3, 0.3); grp.add(etq); }
    return {
      obj: grp, radio: 0.95 + 0.7 * (capas.length - 1) + 0.3, tint: null, caja: [2 * (0.95 + 0.7 * (capas.length - 1)), 2 * (0.95 + 0.7 * (capas.length - 1))], ancla: [0, 0], fitK: 1.6,
      update(a, S) {
        for (const q of elec) { const th = q.ph + S.i * q.w; q.e.position.set(Math.cos(th) * q.R, Math.sin(th) * q.R, 0); }
        grp.rotation.y = 0.4 * Math.sin(S.i * 0.3);
      },
    };
  };

  // ---------- ion: esfera + carga bien visible ----------
  B.ion = function (spec) {
    const ftxt = lib.formulaDeActor(spec) || spec.texto || spec.etiqueta || spec.nombre || spec.id;
    const p = parseFormula(ftxt) || { orden: [], carga: 0, cuentas: {} };
    const el = p.orden[0] || 'Na';
    const poli = p.orden.length > 1 || (p.cuentas[el] || 1) > 1;
    let carga = spec.carga != null ? (typeof spec.carga === 'number' ? spec.carga : (parseFormula('X' + spec.carga) || {}).carga || 0) : p.carga;
    if (!carga) carga = ['Cl', 'F', 'O', 'Br', 'I', 'S'].includes(el) ? -1 : 1;
    const inf = infoEl(el), grp = new T.Group();
    const col = spec.color || inf.c, r = poli ? 0.62 : inf.r * (carga < 0 ? 1.45 : 1.15);
    const mt = lib.mat(col, { shininess: 90, specular: 0x777777 });
    grp.add(lib.mesh(G.sphere(), mt, 0, 0, 0, r));
    const halo = lib.basic(carga > 0 ? '#ff4d6d' : '#4d7bff', { additive: true, opacity: 0.22, side: T.BackSide });
    const hm = lib.mesh(G.sphere(), halo, 0, 0, 0, r * 1.45); hm.userData.noBox = true; grp.add(hm);
    const SUB = '₀₁₂₃₄₅₆₇₈₉';
    const etq = poli ? p.orden.map((e) => e + (p.cuentas[e] > 1 ? String(p.cuentas[e]).replace(/\d/g, (d) => SUB[d]) : '')).join('') : el;
    const sim = lib.textSprite(etq, { color: '#ffffff', h: 0.5 * Math.max(0.8, r * 1.2) * (etq.length > 3 ? 0.8 : 1), px: 64 }); sim.position.set(0, 0, r + 0.1); grp.add(sim);
    const txt = (Math.abs(carga) > 1 ? Math.abs(carga) : '') + (carga > 0 ? '+' : '−');
    const bd = lib.textSprite(txt, { color: '#fff', bg: carga > 0 ? '#e5384f' : '#2f6bff', circle: true, h: 0.72, px: 56 });
    bd.position.set(r * 0.85, r * 0.85, 0.4); grp.add(bd);
    // para las reacciones: un ion poliatómico expone sus átomos (dentro de la esfera) y sus enlaces
    let mol = { atomos: [{ el, r: r, lp: new T.Vector3(), mesh: null }], enlaces: [], spin: grp };
    if (poli) {
      const mm = resolverMolecula({ formula: ftxt, id: spec.id });
      mol = { atomos: mm.atomos.map((at) => ({ el: at.el, r: infoEl(at.el).r * 0.5, lp: new T.Vector3(at.p[0] * 0.5, at.p[1] * 0.5, at.p[2] * 0.5), mesh: null })), enlaces: mm.enlaces.map(([i, j, ord]) => ({ i, j, ord })), spin: grp };
    }
    return { obj: grp, radio: r * 1.5, tint: [mt], mol, caja: [r * 2.4, r * 2.4], ancla: [0, 0], update(a, S) { grp.position.y = Math.sin(S.i * 1.3 + r) * 0.05; } };
  };

  // ---------- electrón: bolita brillante con estela ----------
  B.electron = function (spec) {
    const col = spec.color || '#5fe0ff', grp = new T.Group(), mt = lib.mat(col, { emissive: 0x2288aa, shininess: 120 });
    grp.add(lib.mesh(G.sphere(), mt, 0, 0, 0, 0.2));
    grp.add(lib.glow(col, 1.3, 0.9));
    const lab = lib.textSprite('e−', { color: '#bff4ff', h: 0.34, px: 60 }); lab.position.set(0.0, 0.42, 0.2); grp.add(lab);
    return { obj: grp, radio: 0.45, tint: [mt], update(a, S) { grp.position.set(Math.sin(S.i * 9) * 0.035, Math.cos(S.i * 11) * 0.035, 0); } };
  };

  // ---------- recipientes de vidrio con líquido y burbujas ----------
  function perfilTubo(R, y0, y1) {
    const p = []; for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI / 2; p.push(new T.Vector2(R * Math.sin(a), y0 + R - R * Math.cos(a))); }
    p.push(new T.Vector2(R, y1), new T.Vector2(R + 0.05, y1 + 0.06)); return p;
  }
  function perfilLiquidoTubo(R, y0, lvl) {
    const p = []; for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI / 2; p.push(new T.Vector2(R * Math.sin(a), y0 + R - R * Math.cos(a))); }
    p.push(new T.Vector2(R, lvl), new T.Vector2(0, lvl)); return p;
  }
  function recipiente(spec, tipo) {
    const tubo = tipo === 'tubo_ensayo';
    const R = tubo ? 0.42 : 0.9, y0 = tubo ? -1.6 : -0.95, y1 = tubo ? 1.6 : 0.95;
    const frac = spec.nivel != null ? spec.nivel : tubo ? 0.55 : 0.6, lvl = y0 + (y1 - y0) * frac;
    const gOut = lib.geo('vidrio_' + tipo, () => new T.LatheGeometry(tubo ? perfilTubo(R, y0, y1)
      : [new T.Vector2(0, y0), new T.Vector2(R * 0.88, y0), new T.Vector2(R * 0.97, y0 + 0.1), new T.Vector2(R * 1.06, y1), new T.Vector2(R * 1.1, y1 + 0.06)], 36));
    const Rl = tubo ? R - 0.06 : R * 0.93;
    const gLiq = lib.geo('liq_' + tipo + frac, () => new T.LatheGeometry(tubo ? perfilLiquidoTubo(Rl, y0 + 0.05, lvl)
      : [new T.Vector2(0, y0 + 0.05), new T.Vector2(Rl * 0.9, y0 + 0.05), new T.Vector2(Rl, y0 + 0.15), new T.Vector2(Rl * 1.05, lvl), new T.Vector2(0, lvl)], 36));
    const grp = new T.Group();
    const vidrio = lib.mat('#d8efff', { shininess: 120, specular: 0xffffff, opacity: 0.2, transparent: true, side: T.DoubleSide, depthWrite: false });
    const liq = lib.mat(spec.color || '#4fc3f7', { opacity: 0.82, transparent: true, side: T.DoubleSide, specular: 0x223344, shininess: 25 });
    const mLiq = new T.Mesh(gLiq, liq); mLiq.renderOrder = 1; grp.add(mLiq);
    const mV = new T.Mesh(gOut, vidrio); mV.renderOrder = 2; grp.add(mV);
    // reflejo vertical (franja brillante)
    const franja = lib.basic('#ffffff', { opacity: 0.22, transparent: true, depthWrite: false });
    const fr = lib.mesh(lib.geo('plano', () => new T.PlaneGeometry(1, 1)), franja, -R * 0.62, (y0 + y1) / 2 - 0.1, R * 0.7, 0.06, (y1 - y0) * 0.7, 1); fr.renderOrder = 3; grp.add(fr);
    // burbujas
    const NB = reduced0() ? 7 : 16, pos = new Float32Array(NB * 3), geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const bub = new T.Points(geo, new T.PointsMaterial({ size: tubo ? 0.15 : 0.19, map: lib.puntoTex(), color: 0xeaf8ff, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true }));
    bub.frustumCulled = false; bub.renderOrder = 4; grp.add(bub);
    const liqColor = lib.color(spec.color || '#4fc3f7').clone();
    let inten = 0;
    return {
      obj: grp, radio: tubo ? 1.8 : 1.3, base: 1,
      update(a, S, dt, e) {
        if (a.color) { const tgt = lib.color(a.color); liqColor.lerp(tgt, 1 - Math.exp(-dt * 7)); liq.color.copy(liqColor); }
        // intensidad de burbujeo: 'burbujas' recientes cerca de este recipiente
        let want = 0.12;
        for (const p of S.particulas || []) if (p.tipo === 'burbujas' && p.t0 <= S.t) {
          const age = S.t - p.t0; if (age < 6 && Math.hypot(lib.mapX(p.x) - e.root.position.x, lib.mapY(p.y) - e.root.position.y) < 3.2) want = Math.max(want, 1 - age / 6);
        }
        for (const r of S.reacciones || []) if (r.progreso > 0 && r.progreso < 1 && ((r.de || []).includes(e.id) || (r.a || []).includes(e.id))) want = 1;
        inten += (want - inten) * Math.min(1, dt * 3);
        const n = Math.max(2, Math.round(NB * (0.15 + 0.85 * inten)));
        const rr = Rl * 0.7, h = lvl - (y0 + 0.2);
        for (let i = 0; i < NB; i++) {
          const ph = fract(S.i * (0.18 + 0.2 * hash(i + 3) + 0.25 * inten) + hash(i)), ang = hash(i + 9) * 6.28 + S.i * 0.5;
          pos[i * 3] = Math.cos(ang) * rr * hash(i + 20) + Math.sin(S.i * 3 + i) * 0.03;
          pos[i * 3 + 1] = i < n ? y0 + 0.2 + ph * h : -999;
          pos[i * 3 + 2] = Math.sin(ang) * rr * hash(i + 20);
        }
        geo.attributes.position.needsUpdate = true;
      },
    };
  }
  function reduced0() { return reducedMotion(); }
  B.tubo_ensayo = (spec) => recipiente(spec, 'tubo_ensayo');
  B.vaso = (spec) => recipiente(spec, 'vaso');

  // =====================================================================================
  //  Estilo 'quimica3d'
  // =====================================================================================
  const cfgQuimica = {
    fondo: 'radial-gradient(ellipse at 50% 38%, #174a4c 0%, #0c2036 48%, #170a2a 100%)',
    trayColor: '#2ee59d',
    luces(scene) {
      scene.add(new T.HemisphereLight(0xdcefff, 0x3a2058, 1.25));
      const d = new T.DirectionalLight(0xffffff, 1.05); d.position.set(-5, 8, 10); scene.add(d);
      const r = new T.PointLight(0xff3da6, 0.9, 40); r.position.set(7, -3, 6); scene.add(r);
    },
    ambiente(scene, api) {
      const campo = lib.crearCampo(scene, { n: api.reduced ? 40 : 110, ancho: 26, alto: 15, z0: -9, z1: -1, color1: '#2ee59d', color2: '#ff3da6', size: 0.28 });
      return { tick(t) { campo.rotation.y = Math.sin(t * 0.07) * 0.08; campo.position.y = Math.sin(t * 0.25) * 0.35; } };
    },
    camAz: (t, red) => (red ? 0.18 : Math.sin(t * 0.28) * 0.42),
    camEl: (t, red) => (red ? 0.08 : 0.1 + 0.05 * Math.sin(t * 0.21)),
    init() { reaccionesEstado.vis = {}; reaccionesEstado.activas.length = 0; },
    antes(S, ents, api) { reaccionesAntes(S, ents, api); },
    despues(S, dt, api) { reaccionesDespues(S, dt, api); },
  };

  // ---------- reacciones: los átomos de 'de' viajan a las posiciones de 'a', se rompen y forman varillas ----------
  const reaccionesEstado = { vis: {}, activas: [] };
  function reaccionesAntes(S, ents, api) {
    const est = reaccionesEstado; est.activas.length = 0;
    for (const id in ents) ents[id].oculto = false;
    // El motor ya funde `de` (0..15 %) y `a` (85..100 %) con su alpha; aquí sólo cedemos el sitio
    // a los átomos viajeros mientras 0 < progreso < 1.
    (S.reacciones || []).forEach((r, idx) => {
      const p = r.progreso || 0, key = (r.de || []).join(',') + '>' + (r.a || []).join(',') + '#' + idx;
      const de = (r.de || []).map((i) => ents[i]).filter((e) => e && e.b.mol), pr = (r.a || []).map((i) => ents[i]).filter((e) => e && e.b.mol);
      if (p > 0.002 && p < 1) { de.forEach((e) => { e.oculto = true; }); if (p < 0.88) pr.forEach((e) => { e.oculto = true; }); est.activas.push({ key, p, de, pr }); }
    });
  }
  const _wp = new T.Vector3();
  function posMundo(ref, out) { out.copy(ref.at.lp); return ref.mol.spin.localToWorld(out); } // requiere matrixWorld al día
  function reaccionesDespues(S, dt, api) {
    const est = reaccionesEstado, scene = api.scene;
    for (const k in est.vis) est.vis[k].grp.visible = false;
    for (const rx of est.activas) {
      let v = est.vis[rx.key];
      if (!v) v = est.vis[rx.key] = construirReaccion(rx, api);
      v.grp.visible = true; animarReaccion(v, rx.p, S.t, api);
    }
  }
  function construirReaccion(rx, api) {
    rx.de.concat(rx.pr).forEach((e) => e.root.updateMatrixWorld(true));
    const A = [], Bp = [];
    rx.de.forEach((e) => e.b.mol.atomos.forEach((at, i) => A.push({ at, mol: e.b.mol, e, i })));
    rx.pr.forEach((e) => e.b.mol.atomos.forEach((at, i) => Bp.push({ at, mol: e.b.mol, e, i })));
    const usados = new Set(), par = A.map((a) => {
      let mejor = -1, d = 1e9; const pa = posMundo(a, new T.Vector3());
      Bp.forEach((b, j) => { if (usados.has(j) || b.at.el !== a.at.el) return; const dd = pa.distanceTo(posMundo(b, _wp)); if (dd < d) { d = dd; mejor = j; } });
      if (mejor >= 0) usados.add(mejor); return mejor;
    });
    const atomos = A.map((a, k) => ({ src: a, dst: par[k] >= 0 ? Bp[par[k]] : null, el: a.at.el }));
    const idxB = Bp.map(() => -1); par.forEach((j, k) => { if (j >= 0) idxB[j] = k; });
    Bp.forEach((b, j) => { if (idxB[j] < 0) { idxB[j] = atomos.length; atomos.push({ src: null, dst: b, el: b.at.el }); } });
    // enlaces (índices dentro de 'atomos')
    const enR = [], enP = []; let off = 0;
    rx.de.forEach((e) => { e.b.mol.enlaces.forEach((b) => enR.push({ i: off + b.i, j: off + b.j, ord: b.ord })); off += e.b.mol.atomos.length; });
    off = 0;
    rx.pr.forEach((e) => { e.b.mol.enlaces.forEach((b) => enP.push({ i: idxB[off + b.i], j: idxB[off + b.j], ord: b.ord })); off += e.b.mol.atomos.length; });
    const grp = new T.Group(), mats = {};
    atomos.forEach((q) => { const inf = infoEl(q.el); const mt = mats[q.el] || (mats[q.el] = lib.mat(inf.c, { shininess: 80 })); q.mesh = lib.mesh(G.sphere(), mt, 0, 0, 0, 0.3); q.p = new T.Vector3(); grp.add(q.mesh); });
    const mb = lib.mat(MATBOND.color, { shininess: 60 });
    const mkBond = (b) => { b.mesh = new T.Mesh(G.cylLo(), mb); grp.add(b.mesh); };
    enR.forEach(mkBond); enP.forEach(mkBond);
    const flash = lib.glow('#fff6b0', 3.5, 0); grp.add(flash);
    api.scene.add(grp);
    return { grp, atomos, enR, enP, flash, rx };
  }
  const _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3();
  function animarReaccion(v, p, t, api) {
    const ease = smooth(0.05, 0.95, p);
    v.rx.de.concat(v.rx.pr).forEach((e) => e.root.updateMatrixWorld(true));
    let cx = 0, cy = 0, cz = 0;
    v.atomos.forEach((q, k) => {
      const p1 = q.dst ? posMundo(q.dst, _b) : null, p0 = q.src ? posMundo(q.src, _a) : null;
      const from = p0 || _c.copy(p1), to = p1 || p0;
      q.p.copy(from).lerp(to, ease);
      const s = Math.sin(Math.PI * ease), sg = k % 2 ? 1 : -1;
      q.p.y += s * 0.55 * sg; q.p.z += s * 0.7 * Math.sin(k * 1.7); q.p.x += s * 0.25 * Math.cos(k * 2.3);
      const esc = (e) => e.root.scale.x * e.holder.scale.x;
      const s0 = q.src ? esc(q.src.e) : 0, s1 = q.dst ? esc(q.dst.e) : 0;
      const r0 = q.src ? q.src.at.r * s0 : 0, r1 = q.dst ? q.dst.at.r * s1 : 0;
      q.sc = lerp(s0 || s1, s1 || s0, ease);
      q.mesh.position.copy(q.p); q.mesh.scale.setScalar(Math.max(0.001, lerp(r0, r1, ease)));
      cx += q.p.x; cy += q.p.y; cz += q.p.z;
    });
    const n = Math.max(1, v.atomos.length);
    const kR = 1 - smooth(0.12, 0.5, p), kP = smooth(0.5, 0.88, p);
    v.enR.forEach((b) => { b.mesh.visible = kR > 0.02; if (b.mesh.visible) lib.ponerVarilla(b.mesh, v.atomos[b.i].p, v.atomos[b.j].p, 0.08 * v.atomos[b.i].sc * kR * (b.ord > 1 ? 1.4 : 1)); });
    v.enP.forEach((b) => { b.mesh.visible = kP > 0.02; if (b.mesh.visible) lib.ponerVarilla(b.mesh, v.atomos[b.i].p, v.atomos[b.j].p, 0.08 * v.atomos[b.i].sc * kP * (b.ord > 1 ? 1.4 : 1)); });
    v.flash.position.set(cx / n, cy / n, cz / n + 0.5);
    const f = Math.exp(-Math.pow((p - 0.5) / 0.12, 2)); v.flash.material.opacity = 0.6 * f; v.flash.scale.setScalar(1.6 + 1.8 * f);
  }

  lib.registrar('quimica3d', { nombre: 'Química 3D', init(ctx) { return lib.crearEstilo3D(ctx, cfgQuimica); } });
})();
