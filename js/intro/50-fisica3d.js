// =====================================================================================
// 50-fisica3d.js — INTRO-B · estilo de intro "fisica3d" (Three.js clásico)
//
// Depende de la biblioteca 3D compartida PCB.intro3d, definida en 40-quimica3d.js
// (se carga antes: orden alfabético). Aquí: los constructores low-poly de los actores
// de física (auto, perro, humano, cohete, planeta, luna, pendulo, resorte, onda, lente,
// rayo, flecha, bloque, circuito, fluido, termometro) + el entorno (suelo con cuadrícula
// o espacio con estrellas) + sombras de contacto. Los tipos de química (molecula, atomo,
// ion, electron, tubo_ensayo, vaso), bola y texto vienen de 40-quimica3d.js.
// =====================================================================================
(function () {
  'use strict';
  const PCB = (window.PCB = window.PCB || {});
  const lib = PCB.intro3d;
  const T = window.THREE;
  if (!T || !lib) { console.warn('[intro] fisica3d: falta THREE o 40-quimica3d.js; estilo no registrado'); return; }
  const B = lib.builders, G = lib.G, { W, H, clamp, lerp, smooth, hash, fract } = lib;
  const PI = Math.PI;
  const reducedMotion = () => { try { return PCB.util && PCB.util.reducedMotion ? PCB.util.reducedMotion() : false; } catch (e) { return false; } };

  /** Gira suavemente un ángulo hacia otro por el camino corto. */
  const aproxAng = (cur, tgt, k) => { let d = ((tgt - cur + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI; return cur + d * k; };
  const caja = (m, w, h, d, x, y, z) => lib.mesh(G.box(), m, x, y, z, w, h, d);

  // ------------------------------------------------------------------------------ auto
  B.auto = function (spec) {
    const col = spec.color || '#e63946';
    const raiz = new T.Group(), pitch = new T.Group(); raiz.add(pitch);
    const mB = lib.mat(col, { flat: true, shininess: 80 }), mCab = lib.mat(col, { flat: true, shininess: 60 });
    const mGl = lib.mat('#a8dcff', { shininess: 130, opacity: 0.8, transparent: true, specular: 0xffffff });
    const mRu = lib.mat('#1a1c26', { flat: true }), mLl = lib.mat('#d5d9e4', { shininess: 90 });
    const mFar = lib.mat('#fff4b8', { emissive: 0xffd24a }), mCol = lib.mat('#7a1018'), mFren = lib.mat('#ff2a2a', { emissive: 0xff1010 });
    pitch.add(caja(mB, 2.15, 0.5, 0.95, 0, -0.02, 0));
    pitch.add(caja(mB, 0.5, 0.18, 0.9, 0.82, 0.3, 0)); // capó
    const forma = (pts, d, key) => lib.geo(key, () => { const s = new T.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]))); const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g; });
    pitch.add(new T.Mesh(forma([[-0.62, 0.23], [-0.4, 0.68], [0.28, 0.68], [0.68, 0.23]], 0.86, 'cabina'), mCab));
    const gl = new T.Mesh(forma([[-0.5, 0.25], [-0.34, 0.6], [0.24, 0.6], [0.55, 0.25]], 0.9, 'vidrioCab'), mGl); pitch.add(gl);
    pitch.add(lib.mesh(G.sphereLo(), mFar, 1.08, 0.08, 0.3, 0.11), lib.mesh(G.sphereLo(), mFar, 1.08, 0.08, -0.3, 0.11));
    pitch.add(caja(mCol, 0.06, 0.12, 0.28, -1.08, 0.08, 0.3), caja(mCol, 0.06, 0.12, 0.28, -1.08, 0.08, -0.3));
    const fren = new T.Group(); fren.add(caja(mFren, 0.08, 0.15, 0.3, -1.1, 0.08, 0.3), caja(mFren, 0.08, 0.15, 0.3, -1.1, 0.08, -0.3), lib.glow('#ff3030', 1.1, 0.9)); fren.children[2].position.set(-1.25, 0.08, 0); fren.visible = false; pitch.add(fren);
    const ruedas = [];
    [[0.7, 0.52], [0.7, -0.52], [-0.7, 0.52], [-0.7, -0.52]].forEach(([x, z]) => {
      const p = new T.Group(); p.position.set(x, -0.28, z);
      const neum = lib.mesh(G.cyl(), mRu, 0, 0, 0, 0.3, 0.22, 0.3); neum.rotation.x = PI / 2; p.add(neum);
      const llanta = lib.mesh(G.cyl(), mLl, 0, 0, z > 0 ? 0.02 : -0.02, 0.17, 0.24, 0.17); llanta.rotation.x = PI / 2; p.add(llanta);
      p.add(caja(mRu, 0.34, 0.05, 0.25, 0, 0, 0)); // radio para ver el giro
      pitch.add(p); ruedas.push(p);
    });
    let giro = 0, cara = 0, cab = 0, sp0 = 0;
    return {
      obj: raiz, radio: 1.35, tint: [mB, mCab],
      update(a, S, dt) {
        const vx = (a.vx || 0) * W, v = Math.abs(vx);
        if (v > 0.15) cara = vx < 0 ? PI : 0; raiz.rotation.y = aproxAng(raiz.rotation.y, cara, Math.min(1, dt * 7));
        giro -= (v * dt) / 0.3; ruedas.forEach((r) => { r.rotation.z = giro; });
        const fr = !!a.frenando; fren.visible = fr;
        cab += ((fr ? -0.07 : 0) - cab) * Math.min(1, dt * 8); // el morro "se hunde" al frenar
        pitch.rotation.z = cab + Math.sin(S.t * 22) * 0.004 * Math.min(1, v);
        sp0 = v;
      },
    };
  };

  // ------------------------------------------------------------------------------ perro
  B.perro = function (spec) {
    const col = spec.color || '#c98b45';
    const raiz = new T.Group(), g = new T.Group(); raiz.add(g);
    const mP = lib.mat(col, { flat: true, shininess: 20 }), mO = lib.mat('#7a4a22', { flat: true }), mN = lib.mat('#1a1410'), mV = lib.mat('#f4e6d0', { flat: true });
    g.add(caja(mP, 1.0, 0.42, 0.4, 0, 0.1, 0));
    g.add(caja(mV, 0.45, 0.2, 0.34, 0.1, -0.03, 0)); // pecho/vientre claro
    const cabeza = new T.Group(); cabeza.position.set(0.62, 0.38, 0); g.add(cabeza);
    cabeza.add(caja(mP, 0.4, 0.36, 0.34, 0, 0, 0), caja(mV, 0.26, 0.17, 0.24, 0.27, -0.07, 0), caja(mN, 0.07, 0.07, 0.09, 0.41, -0.01, 0));
    cabeza.add(caja(mO, 0.1, 0.24, 0.08, -0.05, 0.25, 0.15), caja(mO, 0.1, 0.24, 0.08, -0.05, 0.25, -0.15));
    cabeza.add(lib.mesh(G.sphereLo(), mN, 0.16, 0.08, 0.12, 0.04), lib.mesh(G.sphereLo(), mN, 0.16, 0.08, -0.12, 0.04));
    const cola = new T.Group(); cola.position.set(-0.52, 0.28, 0); cola.add(caja(mO, 0.34, 0.08, 0.08, -0.15, 0.05, 0)); g.add(cola);
    const patas = [[0.36, 0.14], [0.36, -0.14], [-0.36, 0.14], [-0.36, -0.14]].map(([x, z], i) => { const p = new T.Group(); p.position.set(x, -0.05, z); p.add(caja(i % 2 ? mO : mP, 0.13, 0.42, 0.13, 0, -0.2, 0)); g.add(p); return p; });
    let fase = 0, cara = 0;
    return {
      obj: raiz, radio: 0.9, tint: [mP],
      update(a, S, dt) {
        const vx = (a.vx || 0) * W, vy = (a.vy || 0) * H, v = Math.hypot(vx, vy);
        if (Math.abs(vx) > 0.15) cara = vx < 0 ? PI : 0; raiz.rotation.y = aproxAng(raiz.rotation.y, cara, Math.min(1, dt * 8));
        const amp = clamp(v * 0.28, 0, 0.8); fase += dt * (2 + v * 3.2);
        patas.forEach((p, i) => { p.rotation.z = Math.sin(fase + (i === 0 || i === 3 ? 0 : PI)) * amp; });
        g.position.y = Math.abs(Math.sin(fase)) * 0.05 * (amp > 0.05 ? 1 : 0) + (amp < 0.05 ? Math.sin(S.t * 2.4) * 0.012 : 0);
        cola.rotation.z = 0.5 + Math.sin(S.t * (a.hablando ? 16 : 7)) * (0.3 + amp * 0.2);
        cabeza.rotation.z = Math.sin(S.t * 1.5) * 0.06;
      },
    };
  };

  // ------------------------------------------------------------------------------ humano
  B.humano = function (spec) {
    const raiz = new T.Group(), g = new T.Group(); raiz.add(g); g.scale.setScalar(1.1);
    const mC = lib.mat(spec.color || '#4cc9f0', { flat: true, shininess: 30 }), mPa = lib.mat('#2b3a67', { flat: true }), mPiel = lib.mat('#f1c27d', { flat: true, shininess: 30 }), mPelo = lib.mat('#3a2518', { flat: true }), mZ = lib.mat('#1a1c26');
    g.add(caja(mC, 0.52, 0.72, 0.3, 0, 0.3, 0));
    const cab = new T.Group(); cab.position.set(0, 0.95, 0); g.add(cab);
    cab.add(lib.mesh(G.sphere(), mPiel, 0, 0, 0, 0.25), lib.mesh(G.sphere(), mPelo, 0, 0.07, -0.03, 0.26, 0.2, 0.26), caja(mPiel, 0.07, 0.07, 0.07, 0.26, -0.02, 0));
    cab.add(lib.mesh(G.sphereLo(), mZ, 0.2, 0.06, 0.1, 0.035), lib.mesh(G.sphereLo(), mZ, 0.2, 0.06, -0.1, 0.035));
    const mk = (x, y, z, w, h, mat, pie) => { const p = new T.Group(); p.position.set(x, y, z); p.add(caja(mat, w, h, w, 0, -h / 2, 0)); if (pie) p.add(caja(mZ, w * 1.7, 0.08, w * 1.1, w * 0.4, -h + 0.03, 0)); g.add(p); return p; };
    const piernas = [mk(0, -0.05, 0.12, 0.2, 0.8, mPa, true), mk(0, -0.05, -0.12, 0.2, 0.8, mPa, true)];
    const brazos = [mk(0, 0.62, 0.35, 0.14, 0.62, mC), mk(0, 0.62, -0.35, 0.14, 0.62, mC)];
    brazos.forEach((b) => b.add(caja(mPiel, 0.13, 0.13, 0.13, 0, -0.66, 0)));
    let fase = 0, cara = 0;
    return {
      obj: raiz, radio: 1.2, tint: [mC],
      update(a, S, dt) {
        const vx = (a.vx || 0) * W, v = Math.abs(vx);
        if (v > 0.15) cara = vx < 0 ? PI : 0; raiz.rotation.y = aproxAng(raiz.rotation.y, cara, Math.min(1, dt * 8));
        const amp = clamp(v * 0.3, 0, 0.75); fase += dt * (2 + v * 2.6);
        piernas[0].rotation.z = Math.sin(fase) * amp; piernas[1].rotation.z = -Math.sin(fase) * amp;
        brazos[0].rotation.z = -Math.sin(fase) * amp * 0.9; brazos[1].rotation.z = Math.sin(fase) * amp * 0.9;
        if (a.hablando) brazos[0].rotation.z = -0.9 + Math.sin(S.t * 6) * 0.35; // gesticula al hablar
        g.position.y = amp > 0.05 ? Math.abs(Math.sin(fase)) * 0.04 : Math.sin(S.t * 1.8) * 0.01;
      },
    };
  };

  // ------------------------------------------------------------------------------ cohete (con llama de partículas)
  B.cohete = function (spec) {
    const raiz = new T.Group(), g = new T.Group(); raiz.add(g);
    const mBody = lib.mat(spec.color && spec.color !== '#ffffff' ? spec.color : '#eef1f8', { shininess: 90 }), mRojo = lib.mat('#e63946', { shininess: 80 }), mGl = lib.mat('#7fd0ff', { emissive: 0x1a4a70, shininess: 130 }), mOsc = lib.mat('#3a3f55', { flat: true });
    const cuerpo = lib.geo('cohete_cuerpo', () => new T.LatheGeometry([[0, -1], [0.36, -1], [0.43, -0.7], [0.45, 0.2], [0.42, 0.6], [0.4, 0.62]].map((p) => new T.Vector2(p[0], p[1])), 24));
    g.add(new T.Mesh(cuerpo, mBody));
    g.add(lib.mesh(lib.geo('cohete_cono', () => new T.ConeGeometry(1, 1, 24)), mRojo, 0, 1.08, 0, 0.4, 0.95, 0.4));
    g.add(lib.mesh(G.cyl(), mRojo, 0, -0.55, 0, 0.455, 0.14, 0.455));
    const ven = lib.mesh(G.sphere(), mGl, 0, 0.25, 0.36, 0.19, 0.19, 0.12); g.add(ven);
    const aro = new T.Mesh(lib.geo('cohete_aro', () => new T.TorusGeometry(0.19, 0.04, 6, 16)), mOsc); aro.position.set(0, 0.25, 0.4); g.add(aro);
    const aleta = lib.geo('cohete_aleta', () => { const s = new T.Shape(); [[0.38, 0.1], [0.92, -0.5], [0.92, -1.0], [0.38, -0.8]].forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]))); const e = new T.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false }); e.translate(0, 0, -0.03); return e; });
    for (let i = 0; i < 3; i++) { const al = new T.Mesh(aleta, mRojo); al.rotation.y = (i * 2 * PI) / 3; g.add(al); }
    const tobera = lib.mesh(G.cone(), mOsc, 0, -1.12, 0, 0.3, 0.3, 0.3); tobera.rotation.x = PI; g.add(tobera); // cono invertido
    // llama: dos conos aditivos + chorro de partículas
    const llama = new T.Group(); llama.position.y = -1.2; g.add(llama);
    const mF1 = lib.basic('#ff8a1f', { additive: true, opacity: 0.85 }), mF2 = lib.basic('#fff2a8', { additive: true, opacity: 0.95 });
    const f1 = lib.mesh(G.cone(), mF1, 0, -0.55, 0, 0.32, 1.1, 0.32), f2 = lib.mesh(G.cone(), mF2, 0, -0.35, 0, 0.17, 0.7, 0.17); f1.rotation.x = f2.rotation.x = PI; llama.add(f1, f2);
    const NP = reducedMotion() ? 10 : 30, pos = new Float32Array(NP * 3), col = new Float32Array(NP * 3), geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
    const chorro = new T.Points(geo, new T.PointsMaterial({ size: 0.3, map: lib.puntoTex(), vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); chorro.frustumCulled = false; llama.add(chorro);
    let ang = 0, inten = 0.4;
    return {
      obj: raiz, radio: 1.5, tint: [mBody],
      update(a, S, dt) {
        const vx = (a.vx || 0) * W, vy = -(a.vy || 0) * H, sp = Math.hypot(vx, vy);
        // el cohete apunta hacia donde va (si está parado, hacia arriba)
        ang = aproxAng(ang, sp > 0.4 ? Math.atan2(vy, vx) - PI / 2 : 0, Math.min(1, dt * 5)); g.rotation.z = ang;
        inten += ((sp > 0.3 ? 0.75 + Math.min(sp * 0.12, 0.6) : 0.4) - inten) * Math.min(1, dt * 5);
        const fl = 1 + Math.sin(S.t * 40) * 0.12 + Math.sin(S.t * 27) * 0.08;
        f1.scale.set(0.32 * fl, 1.1 * inten * fl, 0.32 * fl); f1.position.y = -0.55 * inten; f2.scale.set(0.17, 0.7 * inten * fl, 0.17); f2.position.y = -0.35 * inten;
        for (let i = 0; i < NP; i++) {
          const u = fract(S.t * 1.8 + i / NP), s = hash(i + 7) - 0.5, s2 = hash(i + 31) - 0.5;
          pos[i * 3] = s * 0.55 * u; pos[i * 3 + 1] = -0.2 - u * 2.4 * inten; pos[i * 3 + 2] = s2 * 0.55 * u;
          const k = (1 - u) * inten; col[i * 3] = k; col[i * 3 + 1] = k * (0.45 + 0.4 * (1 - u)); col[i * 3 + 2] = k * 0.12;
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      },
    };
  };

  // ------------------------------------------------------------------------------ planeta / luna
  function esferaRuidosa(radio, detalle, fnColor) {
    const g = new T.IcosahedronGeometry(radio, detalle), n = g.attributes.position.count, c = new Float32Array(n * 3), p = g.attributes.position, col = new T.Color();
    for (let i = 0; i < n; i++) { fnColor(p.getX(i) / radio, p.getY(i) / radio, p.getZ(i) / radio, col); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new T.BufferAttribute(c, 3)); return g;
  }
  B.planeta = function (spec) {
    const base = lib.color(spec.color, '#3b82d6'), tierra = lib.color('#58b368'), seco = lib.color('#c9a66b'), hielo = new T.Color('#f4f8ff');
    const geo = esferaRuidosa(1.25, 3, (x, y, z, out) => {
      const n = Math.sin(x * 3.1 + 1) * Math.sin(y * 4.2 + 2) * Math.sin(z * 3.7) + 0.4 * Math.sin(x * 9 + z * 7);
      out.copy(base); if (n > 0.18) out.lerp(n > 0.5 ? seco : tierra, 0.75); if (Math.abs(y) > 0.9) out.lerp(hielo, 0.9);
    });
    const mt = new T.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 25 });
    const grp = new T.Group(), p = new T.Mesh(geo, mt); grp.add(p);
    const atm = lib.basic(base, { additive: true, opacity: 0.2, side: T.BackSide }); grp.add(lib.mesh(G.sphere(), atm, 0, 0, 0, 1.4));
    grp.add(lib.glow(base, 4.4, 0.25));
    if (spec.anillo || /saturn/i.test(String(spec.nombre || spec.id || ''))) {
      const ring = new T.Mesh(new T.RingGeometry(1.7, 2.45, 64), lib.mat('#d9c08a', { opacity: 0.75, transparent: true, side: T.DoubleSide, flat: true })); ring.rotation.x = PI / 2 - 0.35; grp.add(ring);
    }
    return { obj: grp, radio: 1.45, update(a, S) { p.rotation.y = S.t * 0.18; } };
  };
  B.luna = function (spec) {
    const base = lib.color(spec.color, '#b9bcc6'), osc = base.clone().multiplyScalar(0.55);
    const geo = esferaRuidosa(0.6, 2, (x, y, z, out) => { const n = Math.sin(x * 11 + 1) * Math.sin(y * 9) * Math.sin(z * 10 + 2); out.copy(base); if (n > 0.35) out.lerp(osc, 0.8); });
    const grp = new T.Group(), m = new T.Mesh(geo, new T.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 8 })); grp.add(m);
    return { obj: grp, radio: 0.7, update(a, S) { m.rotation.y = S.t * 0.1; } };
  };

  // ------------------------------------------------------------------------------ péndulo
  B.pendulo = function (spec) {
    const raiz = new T.Group(), L = 2.3;
    const mS = lib.mat('#5a6280', { flat: true }), mH = lib.mat('#cbd2e6', { shininess: 80 }), mBob = lib.mat(spec.color && spec.color !== '#ffffff' ? spec.color : '#ff9f1c', { shininess: 100 });
    raiz.add(caja(mS, 1.5, 0.14, 0.4, 0, 1.55, 0));
    const brazo = new T.Group(); brazo.position.y = 1.48; raiz.add(brazo);
    brazo.add(lib.mesh(G.cylLo(), mH, 0, -L / 2, 0, 0.02, L, 0.02), lib.mesh(G.sphere(), mBob, 0, -L - 0.3, 0, 0.38));
    raiz.add(lib.mesh(G.sphereLo(), mH, 0, 1.48, 0.1, 0.07));
    return {
      obj: raiz, radio: 2.0, rotPropia: true, base: 1, tint: [mBob],
      update(a, S) {
        // si el guion no gira el péndulo, oscila solo (T ≈ 2.6 s)
        const th = Math.abs(a.rot || 0) > 0.01 ? -(a.rot || 0) * lib.RAD : 0.5 * Math.sin(S.t * 2.4);
        brazo.rotation.z = th;
      },
    };
  };

  // ------------------------------------------------------------------------------ resorte (hélice) + masa
  B.resorte = function (spec) {
    const mR = lib.mat(spec.color && spec.color !== '#ffffff' ? spec.color : '#cfd6ea', { shininess: 110, specular: 0xffffff }), mM = lib.mat('#ff9f1c', { shininess: 70 }), mP = lib.mat('#4a5170', { flat: true });
    class Hel extends T.Curve { getPoint(u, tg) { const a = u * PI * 2 * 9; return (tg || new T.Vector3()).set(u, 0.3 * Math.cos(a), 0.3 * Math.sin(a)); } }
    const geo = lib.geo('hel', () => new T.TubeGeometry(new Hel(), 160, 0.05, 6, false));
    const grp = new T.Group(), hel = new T.Mesh(geo, mR); hel.position.x = -1.3; grp.add(hel);
    grp.add(caja(mP, 0.18, 1.5, 1.0, -1.4, 0, 0));
    const masa = caja(mM, 0.7, 0.7, 0.7, 0, 0, 0); grp.add(masa);
    const cuerda = lib.mesh(G.cylLo(), mR, 0, 0, 0, 0.04, 0.0001, 0.04); cuerda.rotation.z = PI / 2;
    return {
      obj: grp, radio: 1.9, tint: [mM],
      update(a, S) {
        const len = 2.2 * (1 + 0.28 * Math.sin(S.t * 3.2)); // oscila (M.A.S.)
        hel.scale.x = len; masa.position.x = -1.3 + len + 0.35;
      },
    };
  };

  // ------------------------------------------------------------------------------ onda (superficie ondulante)
  B.onda = function (spec) {
    const NX = 60, NZ = 22, ancho = 4.2, fondo = 2.2;
    const geo = new T.PlaneGeometry(ancho, fondo, NX, NZ); geo.rotateX(-PI / 2);
    const n = geo.attributes.position.count; geo.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3), 3));
    const base = lib.color(spec.color && spec.color !== '#ffffff' ? spec.color : '#38bdf8'), claro = base.clone().lerp(new T.Color('#ffffff'), 0.7), osc = base.clone().multiplyScalar(0.35);
    const mt = new T.MeshPhongMaterial({ vertexColors: true, shininess: 90, specular: 0x88bbff, side: T.DoubleSide, transparent: true, opacity: 0.95 });
    const m = new T.Mesh(geo, mt); const grp = new T.Group(); grp.add(m); grp.rotation.x = 0.75;
    const pos = geo.attributes.position, col = geo.attributes.color, c = new T.Color();
    const red = reducedMotion();
    return {
      obj: grp, radio: 2.3, tint: null,
      update(a, S) {
        const k = (2 * PI) / 1.5, w = red ? 0 : 2.6;
        for (let i = 0; i < n; i++) {
          const x = pos.getX(i), z = pos.getZ(i), env = 1 - 0.55 * Math.pow(Math.abs(z) / (fondo / 2), 2);
          const y = 0.2 * env * Math.sin(k * x - w * S.t) + 0.05 * Math.sin(k * 1.9 * z + w * 0.7 * S.t);
          pos.setY(i, y); const q = clamp(y / 0.26 * 0.5 + 0.5, 0, 1);
          c.copy(osc).lerp(base, smooth(0, 0.5, q)).lerp(claro, smooth(0.6, 1, q)); col.setXYZ(i, c.r, c.g, c.b);
        }
        pos.needsUpdate = true; col.needsUpdate = true; geo.computeVertexNormals();
      },
    };
  };

  // ------------------------------------------------------------------------------ lente (convergente) con eje y focos
  B.lente = function (spec) {
    const grp = new T.Group();
    const mL = lib.mat(spec.color && spec.color !== '#ffffff' ? spec.color : '#8fe3ff', { shininess: 130, specular: 0xffffff, opacity: 0.5, transparent: true, side: T.DoubleSide, depthWrite: false });
    const lente = lib.mesh(G.sphere(), mL, 0, 0, 0, 0.26, 1.45, 0.95); lente.renderOrder = 2; grp.add(lente);
    const mAx = new T.LineDashedMaterial({ color: 0x9fb0d9, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.8 });
    const eje = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-3.4, 0, 0), new T.Vector3(3.4, 0, 0)]), mAx); eje.computeLineDistances(); grp.add(eje);
    const mF = lib.mat('#ffd166', { emissive: 0x665522 });
    [[-1.9, 'F'], [1.9, "F′"]].forEach(([x, t]) => { grp.add(lib.mesh(G.sphereLo(), mF, x, 0, 0, 0.09)); const s = lib.textSprite(t, { color: '#ffd166', h: 0.34, px: 60 }); s.position.set(x, -0.32, 0.1); grp.add(s); });
    return { obj: grp, radio: 1.6, tint: [mL] };
  };

  // ------------------------------------------------------------------------------ rayo (rayo de luz con fotones)
  B.rayo = function (spec) {
    const col = spec.color && spec.color !== '#ffffff' ? spec.color : '#ffe066', L = 3.2, grp = new T.Group();
    const mC = lib.basic('#ffffff', { opacity: 0.95, transparent: true }), mH = lib.basic(col, { additive: true, opacity: 0.35 });
    const core = lib.mesh(G.cylLo(), mC, L / 2, 0, 0, 0.035, L, 0.035); core.rotation.z = PI / 2;
    const halo = lib.mesh(G.cylLo(), mH, L / 2, 0, 0, 0.13, L, 0.13); halo.rotation.z = PI / 2;
    const punta = lib.mesh(G.cone(), lib.basic(col, { opacity: 0.95, transparent: true }), L + 0.12, 0, 0, 0.12, 0.3, 0.12); punta.rotation.z = -PI / 2;
    grp.add(core, halo, punta);
    const fot = [0, 1, 2, 3].map(() => { const s = lib.glow(col, 0.55, 0.95); grp.add(s); return s; });
    grp.position.x = -L / 2; const raiz = new T.Group(); raiz.add(grp);
    return { obj: raiz, radio: 1.7, update(a, S) { fot.forEach((s, i) => { s.position.set(fract(S.t * 0.7 + i / 4) * L, 0, 0.05); }); } };
  };

  // ------------------------------------------------------------------------------ flecha 3D
  B.flecha = function (spec) {
    const col = spec.color && spec.color !== '#ffffff' ? spec.color : '#ffd166', m = lib.mat(col, { emissive: 0x332200, shininess: 70 }), L = 2.2, grp = new T.Group();
    const sh = lib.mesh(G.cylLo(), m, (L - 0.6) / 2 - L / 2, 0, 0, 0.1, L - 0.6, 0.1); sh.rotation.z = PI / 2;
    const hd = lib.mesh(G.cone(), m, L / 2 - 0.3, 0, 0, 0.26, 0.7, 0.26); hd.rotation.z = -PI / 2;
    grp.add(sh, hd); return { obj: grp, radio: 1.2, tint: [m] };
  };

  // ------------------------------------------------------------------------------ bloque
  B.bloque = function (spec) {
    const m = lib.mat(spec.color && spec.color !== '#ffffff' ? spec.color : '#b9824b', { shininess: 40, flat: true }), grp = new T.Group();
    grp.add(caja(m, 1.6, 1.05, 1.1, 0, 0, 0));
    const ed = new T.LineSegments(lib.geo('bloque_ed', () => new T.EdgesGeometry(new T.BoxGeometry(1.6, 1.05, 1.1))), new T.LineBasicMaterial({ color: 0x2a1a0c, transparent: true, opacity: 0.7 })); grp.add(ed);
    grp.add(caja(lib.mat('#ffffff', { opacity: 0.12, transparent: true }), 1.4, 0.04, 0.9, 0, 0.54, 0));
    return { obj: grp, radio: 1.0, tint: [m] };
  };

  // ------------------------------------------------------------------------------ circuito (pila, bombilla, resistencia, electrones)
  B.circuito = function (spec) {
    const w = 3.4, h = 2.0, grp = new T.Group(), mW = lib.mat('#d9a441', { shininess: 90 }), mPila = lib.mat('#2f6bff', { shininess: 90 }), mTapa = lib.mat('#cfd6e6', { shininess: 90 });
    const hilo = (x0, y0, x1, y1) => { const m = new T.Mesh(G.cylLo(), mW); lib.ponerVarilla(m, new T.Vector3(x0, y0, 0), new T.Vector3(x1, y1, 0), 0.04); grp.add(m); };
    // lados (con huecos para la pila (izq.), la bombilla (arriba) y la resistencia (der.))
    hilo(-w / 2, -h / 2, w / 2, -h / 2); hilo(-w / 2, h / 2, -0.4, h / 2); hilo(0.4, h / 2, w / 2, h / 2);
    hilo(-w / 2, -h / 2, -w / 2, -0.4); hilo(-w / 2, 0.4, -w / 2, h / 2); hilo(w / 2, -h / 2, w / 2, -0.5); hilo(w / 2, 0.5, w / 2, h / 2);
    grp.add(lib.mesh(G.cyl(), mPila, -w / 2, 0, 0, 0.22, 0.8, 0.22), lib.mesh(G.cyl(), mTapa, -w / 2, 0.45, 0, 0.1, 0.1, 0.1));
    const plus = lib.textSprite('+', { color: '#ff7b8f', h: 0.4, px: 70 }); plus.position.set(-w / 2 - 0.4, 0.45, 0.1); grp.add(plus);
    const mBul = lib.mat('#fff2a0', { emissive: 0xffc83a, opacity: 0.9, transparent: true, shininess: 120 });
    grp.add(lib.mesh(G.sphere(), mBul, 0, h / 2 + 0.05, 0, 0.33), lib.mesh(G.cyl(), mTapa, 0, h / 2 - 0.3, 0, 0.14, 0.18, 0.14));
    const halo = lib.glow('#ffd24a', 2.4, 0.55); halo.position.set(0, h / 2 + 0.05, 0.1); grp.add(halo);
    grp.add(caja(lib.mat('#d8b890', { flat: true }), 0.3, 1.0, 0.3, w / 2, 0, 0));
    ['#c0392b', '#2c3e50', '#d4ac0d'].forEach((c, i) => grp.add(caja(lib.mat(c), 0.32, 0.08, 0.32, w / 2, -0.28 + i * 0.28, 0)));
    // electrones corriendo por el perímetro
    const NE = reducedMotion() ? 8 : 18, pos = new Float32Array(NE * 3), geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const pts = new T.Points(geo, new T.PointsMaterial({ size: 0.2, map: lib.puntoTex(), color: 0x7fe8ff, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); pts.frustumCulled = false; grp.add(pts);
    const P = 2 * (w + h);
    const enPerimetro = (s, out) => { let d = fract(s) * P; if (d < w) { out[0] = -w / 2 + d; out[1] = -h / 2; } else if ((d -= w) < h) { out[0] = w / 2; out[1] = -h / 2 + d; } else if ((d -= h) < w) { out[0] = w / 2 - d; out[1] = h / 2; } else { d -= w; out[0] = -w / 2; out[1] = h / 2 - d; } };
    const q = [0, 0];
    return {
      obj: grp, radio: 2.3,
      update(a, S) {
        for (let i = 0; i < NE; i++) { enPerimetro(S.t * 0.09 + i / NE, q); pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1]; pos[i * 3 + 2] = 0.08; }
        geo.attributes.position.needsUpdate = true;
        halo.material.opacity = 0.45 + 0.15 * Math.sin(S.t * 5) ; mBul.emissive.setRGB(1, 0.78 + 0.1 * Math.sin(S.t * 5), 0.23);
      },
    };
  };

  // ------------------------------------------------------------------------------ fluido (tubo de Venturi: continuidad y Bernoulli)
  B.fluido = function (spec) {
    const col = spec.color && spec.color !== '#ffffff' ? spec.color : '#4cc9f0', grp = new T.Group(), Lx = 2.2;
    const rad = (x) => 0.55 - 0.25 * Math.exp(-Math.pow(x / 0.75, 2));
    const perfil = []; for (let i = 0; i <= 48; i++) { const x = -Lx + (i / 48) * 2 * Lx; perfil.push(new T.Vector2(rad(x), x)); }
    const geoT = lib.geo('venturi', () => { const g = new T.LatheGeometry(perfil, 28); g.rotateZ(-PI / 2); return g; });
    const mV = lib.mat('#d8efff', { shininess: 120, specular: 0xffffff, opacity: 0.18, transparent: true, side: T.DoubleSide, depthWrite: false });
    const mAg = lib.mat(col, { opacity: 0.28, transparent: true, side: T.DoubleSide, depthWrite: false });
    const tub = new T.Mesh(geoT, mV); tub.renderOrder = 2; const agua = lib.mesh(geoT, mAg, 0, 0, 0, 0.95, 0.95, 0.95); agua.renderOrder = 1; grp.add(agua, tub);
    // tubos manométricos: más bajos donde el fluido va más rápido (Bernoulli)
    const mCol = lib.mat(col, { opacity: 0.9, transparent: true });
    [[-1.5, 0.85], [0, 0.45]].forEach(([x, hh]) => {
      const y0 = rad(x) - 0.02; grp.add(lib.mesh(G.cylLo(), lib.mat('#d8efff', { opacity: 0.2, transparent: true, depthWrite: false }), x, y0 + 0.55, 0, 0.07, 1.1, 0.07));
      grp.add(lib.mesh(G.cylLo(), mCol, x, y0 + hh / 2, 0, 0.05, hh, 0.05));
    });
    const NP = reducedMotion() ? 28 : 70, pos = new Float32Array(NP * 3), geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const part = Array.from({ length: NP }, (_, i) => ({ x: -Lx + hash(i) * 2 * Lx, u: (hash(i + 40) - 0.5) * 2, v: (hash(i + 80) - 0.5) * 2 }));
    const pts = new T.Points(geo, new T.PointsMaterial({ size: 0.14, map: lib.puntoTex(), color: 0xffffff, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); pts.frustumCulled = false; grp.add(pts);
    return {
      obj: grp, radio: 2.4, tint: null,
      update(a, S, dt) {
        for (let i = 0; i < NP; i++) {
          const p = part[i], r = rad(p.x); p.x += dt * 0.9 * Math.pow(0.55 / r, 2); // continuidad: v ∝ 1/S
          if (p.x > Lx) p.x -= 2 * Lx;
          pos[i * 3] = p.x; pos[i * 3 + 1] = p.u * r * 0.7; pos[i * 3 + 2] = p.v * r * 0.7;
        }
        geo.attributes.position.needsUpdate = true;
      },
    };
  };

  // ------------------------------------------------------------------------------ termómetro
  B.termometro = function (spec) {
    const col = spec.color && spec.color !== '#ffffff' ? spec.color : '#ff3b3b', grp = new T.Group();
    const mV = lib.mat('#d8efff', { shininess: 120, specular: 0xffffff, opacity: 0.25, transparent: true, depthWrite: false }), mH = lib.mat(col, { emissive: 0x330000, shininess: 80 }), mT = lib.mat('#e8ecf5');
    const tubo = lib.mesh(G.cyl(), mV, 0, 0.05, 0, 0.14, 2.5, 0.14), bulbo = lib.mesh(G.sphere(), mV, 0, -1.2, 0, 0.3); tubo.renderOrder = bulbo.renderOrder = 2;
    grp.add(tubo, bulbo, lib.mesh(G.sphere(), mH, 0, -1.2, 0, 0.21));
    const col2 = lib.mesh(G.cyl(), mH, 0, 0, 0, 0.065, 1, 0.065); grp.add(col2);
    for (let i = 0; i < 9; i++) grp.add(caja(mT, i % 4 === 0 ? 0.22 : 0.12, 0.02, 0.02, 0.24, -0.7 + i * 0.26, 0));
    return {
      obj: grp, radio: 1.6, tint: [mH],
      update(a, S) { const lv = 0.55 + 0.4 * Math.sin(S.t * 0.7 - 1.2), len = 0.2 + lv * 2.2; col2.scale.y = len; col2.position.y = -1.2 + len / 2; },
    };
  };

  // =====================================================================================
  //  Entorno y estilo 'fisica3d'
  // =====================================================================================
  const TIPOS_SUELO = ['auto', 'perro', 'humano', 'bloque', 'cohete', 'termometro'];
  function decidirModo(ctx) {
    const g = ctx.guion || {}, act = g.actores || [], tipos = act.map((a) => a.tipo), tiene = (...t) => t.some((x) => tipos.includes(x));
    const forzado = String(g.escenario || g.fondo || '').toLowerCase();
    if (/espac|space|cosmo/.test(forzado)) return 'espacio';
    if (/suelo|grid|ground|lab/.test(forzado)) return 'suelo';
    if (tiene('planeta', 'luna')) return 'espacio';
    if (tiene('cohete') && !tiene('auto', 'perro', 'humano', 'bloque', 'pendulo', 'resorte')) return 'espacio';
    return 'suelo';
  }
  let _sombraTex = null;
  function sombraTex() {
    if (_sombraTex) return _sombraTex;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (_sombraTex = new T.CanvasTexture(c));
  }

  function crearCfg(ctx) {
    const modo = decidirModo(ctx), act = (ctx.guion && ctx.guion.actores) || [];
    // y del suelo: justo bajo el actor "de suelo" más bajo
    let floorY = lib.mapY(0.82) - 0.6;
    const suelo = act.filter((a) => TIPOS_SUELO.includes(a.tipo) && a.pos);
    if (suelo.length) { const a = suelo.reduce((m, x) => (x.pos[1] > m.pos[1] ? x : m)); floorY = lib.mapY(a.pos[1]) - (a.tipo === 'perro' ? 0.5 : a.tipo === 'humano' ? 0.95 : a.tipo === 'cohete' ? 1.1 : a.tipo === 'bloque' ? 0.55 : 0.6) * (a.escala || 1); }
    const sombras = {};
    return {
      fondo: modo === 'espacio'
        ? 'radial-gradient(ellipse at 30% 35%, #1a1650 0%, #0a0c30 45%, #02030c 100%)'
        : 'linear-gradient(180deg, #050b26 0%, #13266f 52%, #0a1442 53%, #060b22 100%)',
      trayColor: '#ffd166',
      niebla: modo === 'suelo' ? { color: 0x0c1744, near: 16, far: 60 } : null,
      luces(scene) {
        scene.add(new T.HemisphereLight(modo === 'espacio' ? 0x9fb4ff : 0xaecbff, 0x1b2140, modo === 'espacio' ? 0.55 : 0.9));
        const d = new T.DirectionalLight(modo === 'espacio' ? 0xfff2dd : 0xffffff, modo === 'espacio' ? 1.35 : 1.0); d.position.set(-6, 9, 8); scene.add(d);
      },
      ambiente(scene, api) {
        if (modo === 'espacio') {
          const stars = lib.crearCampo(scene, { n: api.reduced ? 220 : 520, ancho: 120, alto: 70, z0: -90, z1: -30, color1: '#ffffff', color2: '#9fc4ff', size: 0.55 });
          const neb = [['#ff3da6', -9, 3, 0.09], ['#4cc9f0', 8, -3, 0.09], ['#9b5de5', 0, 6, 0.08]].map(([c, x, y, o]) => { const s = lib.glow(c, 34, o); s.position.set(x, y, -40); scene.add(s); return s; });
          return { tick(t) { stars.rotation.z = t * 0.004; } };
        }
        // suelo: cuadrícula que se pierde en la niebla
        const pts = [], paso = 1.5;
        for (let z = -60; z <= 8; z += paso) pts.push(-60, floorY, z, 60, floorY, z);
        for (let x = -60; x <= 60; x += paso) pts.push(x, floorY, -60, x, floorY, 8);
        const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
        const rej = new T.LineSegments(geo, new T.LineBasicMaterial({ color: 0x3f7bff, transparent: true, opacity: 0.55 })); rej.frustumCulled = false; scene.add(rej);
        const plano = new T.Mesh(new T.PlaneGeometry(120, 70).rotateX(-PI / 2), new T.MeshBasicMaterial({ color: 0x0a1233, transparent: true, opacity: 0.85 })); plano.position.set(0, floorY - 0.01, -26); scene.add(plano);
        return { tick(t) { rej.position.z = ((t * 0.0) % paso); } };
      },
      camAz: (t, red) => (red ? 0 : Math.sin(t * 0.22) * 0.11),
      camEl: () => (modo === 'espacio' ? 0.03 : 0.09),
      reinicio() {},
      // sombras de contacto bajo los actores "de suelo"
      frame(S, dt, api) {
        if (modo !== 'suelo') return;
        for (const id in api.ents) {
          const e = api.ents[id]; if (!TIPOS_SUELO.includes(e.spec.tipo) && e.spec.tipo !== 'bola') continue;
          let s = sombras[id];
          if (!s) { s = sombras[id] = new T.Mesh(G.circle(), new T.MeshBasicMaterial({ map: sombraTex(), transparent: true, depthWrite: false })); s.rotation.x = -PI / 2; s.renderOrder = 1; api.scene.add(s); }
          s.visible = e.root.visible;
          if (!s.visible) continue;
          const alto = Math.max(0, e.root.position.y - floorY), r = (e.b.radio || 1) * e.root.scale.x * 1.15;
          s.position.set(e.root.position.x, floorY + 0.02, 0); s.scale.set(r, r * 0.55, 1); s.scale.z = 1;
          s.material.opacity = (0.8 / (1 + alto * 0.3)) * e.alpha;
        }
      },
    };
  }

  lib.registrar('fisica3d', { init(ctx) { return lib.crearEstilo3D(ctx, crearCfg(ctx)); } });
})();
