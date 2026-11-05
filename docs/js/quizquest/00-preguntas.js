// =====================================================================================
// 00-preguntas.js — QUIZ QUEST · banco de preguntas por capítulo
//
//   PCB.quizquest.banco(capId, semilla) -> Promise<{ preguntas:[Q…], jefe:[Q…], ctx:{cap, nivelBase, quiz}, meta }>
//
// Mezcla TRES fuentes, todas fieles al cours (nada inventado):
//   1) contenido/quizzes/<id>.json                    (opción y numéricas, tal cual)
//   2) contenido/niveles/<id>.json -> segmento jefe   (preguntas del jefe del capítulo → banco `jefe`)
//   3) preguntas GENERADAS por código desde capitulo.json:
//        · formula   «¿Qué fórmula corresponde a “nombre”?»              (opciones LaTeX)
//        · nombre    «¿Cómo se llama la relación  $latex$ ?»
//        · simbolo   «En “nombre”, ¿qué representa el símbolo X?»
//        · inverso   «¿Qué símbolo de “nombre” representa “significado”?» (opciones LaTeX)
//        · unidad    «¿En qué unidad se mide X?»  (distractores = otras unidades con OTRA dimensión)
//        · nocion    «¿Qué descripción corresponde a “noción”?» / «¿A qué noción corresponde …?»
//        · error     «Error típico “…”: ¿cuál es la corrección?»
//        · constante «¿Cuál es el valor de “constante”?»
//
// Esquema Q (CONTRATO §6/§4b):
//   {id, tipo:'opcion', enunciado, opciones[], correcta (índice 0-based), explicacion, pagina_pdf, latex_opciones?, cat}
//   {id, tipo:'numerico', enunciado, valor, unidad, tolerancia_rel, cifras_sig, pasos, pagina_pdf, cat}
// El enunciado, las opciones y la explicación admiten LaTeX en línea entre $…$ (igual que las del jefe).
// Con `latex_opciones:true` TODA la opción es LaTeX.
//
// Determinista: el orden de las opciones y la elección de distractores dependen de (capId, semilla).
// Funciona en navegador y en Node (para las pruebas).
// =====================================================================================
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const PCB = (root.PCB = root.PCB || {});
  const QQ = (PCB.quizquest = PCB.quizquest || {});

  // ---------------------------------------------------------------------------------
  // Utilidades compartidas (también las usa 10-generador.js)
  // ---------------------------------------------------------------------------------
  const U = (QQ.util = QQ.util || {});
  /** Hash FNV-1a de 32 bits de un texto → entero sin signo. */
  U.hash = (s) => { let h = 0x811c9dc5; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
  /** PRNG determinista mulberry32 (mismo algoritmo que PCB.util.rng, pero sin depender del navegador). */
  U.rng = (seed) => { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  /** Copia barajada (Fisher-Yates) con un rnd dado. */
  U.shuffle = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  /** Minúsculas sin tildes (para comparar textos). */
  U.quita = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  /** Palabras “significativas” (>3 letras) de un texto, normalizadas. */
  U.palabras = (s) => U.quita(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
  U.pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

  const { hash, shuffle, quita, palabras } = U;
  const mayus1 = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // ---------------------------------------------------------------------------------
  // KaTeX: ¿se puede renderizar este LaTeX? (en Node sin KaTeX se da por bueno)
  // ---------------------------------------------------------------------------------
  const _texOk = new Map();
  function texOk(latex) {
    if (_texOk.has(latex)) return _texOk.get(latex);
    let ok = true;
    if (root.katex && root.katex.renderToString) {
      try { root.katex.renderToString(latex, { throwOnError: true, strict: 'ignore' }); } catch (e) { ok = false; }
    }
    _texOk.set(latex, ok);
    return ok;
  }
  U.texOk = texOk;

  // ---------------------------------------------------------------------------------
  // Unidades: analizador de dimensiones (para que un distractor NUNCA sea una unidad equivalente a la correcta)
  // ---------------------------------------------------------------------------------
  // vector = [kg, m, s, A, K, mol] + etiqueta (para distinguir Hz/Bq, rad, dB, %…)
  const D = (kg, m, s, A, K, mol, tag) => ({ v: [kg, m, s, A, K, mol], tag: tag || '' });
  const UBASE = {
    kg: D(1, 0, 0, 0, 0, 0), g: D(1, 0, 0, 0, 0, 0), m: D(0, 1, 0, 0, 0, 0), s: D(0, 0, 1, 0, 0, 0), A: D(0, 0, 0, 1, 0, 0), K: D(0, 0, 0, 0, 1, 0), mol: D(0, 0, 0, 0, 0, 1),
    L: D(0, 3, 0, 0, 0, 0), N: D(1, 1, -2, 0, 0, 0), J: D(1, 2, -2, 0, 0, 0), eV: D(1, 2, -2, 0, 0, 0), W: D(1, 2, -3, 0, 0, 0), Pa: D(1, -1, -2, 0, 0, 0), bar: D(1, -1, -2, 0, 0, 0),
    C: D(0, 0, 1, 1, 0, 0), V: D(1, 2, -3, -1, 0, 0), F: D(-1, -2, 4, 2, 0, 0), 'Ω': D(1, 2, -3, -2, 0, 0), S: D(-1, -2, 3, 2, 0, 0), Hz: D(0, 0, -1, 0, 0, 0),
    Bq: D(0, 0, -1, 0, 0, 0, 'bq'), min: D(0, 0, 1, 0, 0, 0), an: D(0, 0, 1, 0, 0, 0), '°C': D(0, 0, 0, 0, 1, 0), '°': D(0, 0, 0, 0, 0, 0, 'ang'), rad: D(0, 0, 0, 0, 0, 0, 'ang'),
    dB: D(0, 0, 0, 0, 0, 0, 'db'), '%': D(0, 0, 0, 0, 0, 0, 'pct'),
  };
  const PREFIJOS = new Set(['m', 'k', 'c', 'µ', 'n', 'd', 'M', 'p']);
  const SUP = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };

  /** Limpia una unidad del cours ("J (o eV)", "N·kg⁻¹ = m·s⁻²"…) → texto de unidad simple o null si no es limpia. */
  function unidadLimpia(u) {
    if (u == null) return null;
    let t = String(u).trim();
    if (!t || /^[—–-]+$/.test(t) || /sin unidad|misma unidad|minute d/i.test(t) && !/^%/.test(t)) return null;
    t = t.split(/\s*\(|\s+o\s+|\s*=\s*/)[0].trim();
    if (!t || /[,;]/.test(t) || t.length > 24) return null;
    return dimension(t) ? t : null;
  }
  /** Dimensión de una unidad simple como clave de texto, o null si no se entiende. */
  function dimension(u) {
    const tot = [0, 0, 0, 0, 0, 0]; let tag = '';
    const trozos = String(u).split(/·|\.|\*/);
    for (const tr0 of trozos) {
      let tr = tr0.trim(); if (!tr) return null;
      // exponente: superíndices (⁻¹, ²…) o ^-1
      let exp = 1; const m = tr.match(/^(.*?)([⁻]?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
      if (m) { exp = parseInt([...m[3]].map((c) => SUP[c]).join(''), 10) * (m[2] ? -1 : 1); tr = m[1]; }
      let base = UBASE[tr], mult = 1;
      if (!base && tr.length > 1 && PREFIJOS.has(tr[0]) && UBASE[tr.slice(1)]) { base = UBASE[tr.slice(1)]; mult = 1; }
      if (!base) return null;
      for (let i = 0; i < 6; i++) tot[i] += base.v[i] * exp;
      if (base.tag) tag += base.tag + exp;
      void mult;
    }
    return tot.join(',') + '|' + tag;
  }
  U.unidadLimpia = unidadLimpia; U.dimension = dimension;

  // ---------------------------------------------------------------------------------
  // Símbolos: ¿hace falta LaTeX para mostrarlos?
  // ---------------------------------------------------------------------------------
  const necesitaTex = (s) => /[\\_^{}]/.test(s) || /^[A-Za-zα-ωΑ-Ω]$/.test(s);
  /** Símbolo para insertar dentro de una frase: LaTeX en línea o texto entre «» */
  const simboloInline = (s) => (necesitaTex(s) && texOk(s) ? '$' + s + '$' : '«' + s + '»');
  // Símbolos Unicode (H₃O⁺, A⁻, λ…) → LaTeX limpio (\mathrm{H_{3}O^{+}}), para no depender de métricas de fuente en modo texto.
  const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₊': '+', '₋': '-', 'ᵢ': 'i', 'ₐ': 'a', 'ₙ': 'n', 'ₓ': 'x' };
  const SUPER = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', 'ᵃ': 'a', 'ᵇ': 'b', 'ⁿ': 'n' };
  const GRIEGO = { 'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ', 'δ': '\\delta ', 'Δ': '\\Delta ', 'λ': '\\lambda ', 'ν': '\\nu ', 'μ': '\\mu ', 'µ': '\\mu ', 'ρ': '\\rho ', 'σ': '\\sigma ', 'τ': '\\tau ', 'θ': '\\theta ', 'φ': '\\varphi ', 'ε': '\\varepsilon ', 'ω': '\\omega ', 'Ω': '\\Omega ', 'η': '\\eta ', 'π': '\\pi ' };
  function uniATex(s) {
    let o = '', modo = '';                                  // modo: '' | '_' | '^'
    const cierra = () => { if (modo) { o += '}'; modo = ''; } };
    for (const c of String(s)) {
      if (SUB[c] != null) { if (modo !== '_') { cierra(); o += '_{'; modo = '_'; } o += SUB[c]; }
      else if (SUPER[c] != null) { if (modo !== '^') { cierra(); o += '^{'; modo = '^'; } o += SUPER[c]; }
      else { cierra(); o += GRIEGO[c] || (/[{}\\_^$%&#~]/.test(c) ? '' : c); }
    }
    cierra();
    return o;
  }
  /** Símbolo como opción LaTeX pura (para latex_opciones:true) */
  const simboloOpcion = (s) => (necesitaTex(s) ? s : '\\mathrm{' + uniATex(s) + '}');

  /** Acorta un texto del cours (quita paréntesis largos / trozos tras ; o ,). null si sigue siendo demasiado largo. */
  function corto(txt, max) {
    max = max || 88;
    let t = String(txt == null ? '' : txt).replace(/\s+/g, ' ').trim();
    if (t.length > max) t = t.replace(/\s*\([^)]*\)/g, '').trim();
    if (t.length > max) t = t.split(/;| — /)[0].trim();
    if (t.length > max) t = t.split(/,/)[0].trim();
    if (t.length < 3 || t.length > max + 12) return null;
    return t;
  }
  /** Primera frase de un texto (sin cortar en abreviaturas). null si es demasiado corta/larga. */
  function primeraFrase(txt, min, max) {
    min = min || 22; max = max || 150;
    const t = String(txt || '').replace(/\s+/g, ' ').trim();
    const ABREV = /(?:^|\s)(?:p|ej|Fig|fig|etc|vs|aprox|cf|Ex|ex|n|núm|pág)$/;
    const re = /[.!?]\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/g; let m, fin = t.length;
    while ((m = re.exec(t))) {
      const antes = t.slice(0, m.index);
      if (ABREV.test(antes) || /(?:^|\s)[A-Z]$/.test(antes)) continue;
      if (antes.length < min) continue;               // frase demasiado corta: sigue con la siguiente
      fin = m.index + 1; break;
    }
    let f = t.slice(0, fin).replace(/[.]+$/, '').trim();
    if (f.length < min || f.length > max) return null;
    return f;
  }

  // ---------------------------------------------------------------------------------
  // Construcción de una pregunta de opción (baraja y calcula `correcta`)
  // ---------------------------------------------------------------------------------
  /** op = {id, cat, enunciado, correcta:'texto', distractores:[…], explicacion, pagina_pdf, latex_opciones} */
  function opcion(op, rnd) {
    const todas = shuffle([op.correcta].concat(op.distractores), rnd);
    return {
      id: op.id, tipo: 'opcion', cat: op.cat, enunciado: op.enunciado, opciones: todas, correcta: todas.indexOf(op.correcta),
      explicacion: op.explicacion || '', pagina_pdf: op.pagina_pdf || 0, latex_opciones: op.latex_opciones ? true : undefined,
    };
  }
  /** Elige `n` distractores de `cands` (ya filtrados), con preferencia por mayor `score` pero con azar. null si no hay bastantes. */
  function elegir(cands, n, rnd, score) {
    if (cands.length < n) return null;
    let orden = shuffle(cands, rnd);
    if (score) orden = orden.map((c) => ({ c, s: score(c) + rnd() * 1.5 })).sort((a, b) => b.s - a.s).map((o) => o.c);
    return orden.slice(0, n);
  }
  /** ¿Mismas variables (conjunto de símbolos)? Si sí, dos fórmulas suelen ser reordenaciones una de otra. */
  const simbolosDe = (f) => new Set((f.variables || []).map((v) => quita(v.simbolo).replace(/\s+/g, '')));
  const mismoConjunto = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
  const interseccion = (a, b) => [...a].filter((x) => b.has(x)).length;

  // ---------------------------------------------------------------------------------
  // Generadores desde capitulo.json
  // ---------------------------------------------------------------------------------
  function generarDesdeCapitulo(cap, rnd) {
    const out = [];
    const fs = (cap.formulas || []).filter((f) => f && f.latex && f.nombre && texOk(f.latex));
    const pag = (o) => (o && o.pagina_pdf) || 0;
    const pagTxt = (p) => (p ? ' (cours, p. ' + p + ')' : '');

    // ---- 1) «¿Qué fórmula corresponde a “nombre”?» y 2) «¿Cómo se llama esta relación?» ----
    for (const f of fs) {
      const sf = simbolosDe(f);
      const otras = fs.filter((g) => g !== f && quita(g.latex).replace(/\s+/g, '') !== quita(f.latex).replace(/\s+/g, '') && !mismoConjunto(simbolosDe(g), sf));
      // (A) fórmula a partir del nombre
      if (f.latex.length <= 100) {
        const cand = otras.filter((g) => g.latex.length <= 120);
        const d = elegir(cand, 3, rnd, (g) => interseccion(sf, simbolosDe(g)) * 0.6 - Math.abs(g.latex.length - f.latex.length) / 40);
        if (d) out.push(opcion({
          id: 'g-f-' + f.id, cat: 'formula', enunciado: '¿Qué fórmula corresponde a «' + f.nombre + '»?',
          correcta: f.latex, distractores: d.map((g) => g.latex), latex_opciones: true,
          explicacion: 'Es $' + f.latex + '$. ' + (f.explicacion || '') + pagTxt(f.pagina_pdf), pagina_pdf: pag(f),
        }, rnd));
      }
      // (B) nombre a partir de la fórmula
      if (f.latex.length <= 90) {
        const nom = (g) => corto(g.nombre, 80);
        const cn = nom(f);
        const cand = otras.filter((g) => nom(g) && quita(nom(g)) !== quita(cn));
        const d = cn && elegir(cand, 3, rnd, (g) => interseccion(sf, simbolosDe(g)) * 0.5);
        if (d) out.push(opcion({
          id: 'g-n-' + f.id, cat: 'nombre', enunciado: '¿Cómo se llama la relación $' + f.latex + '$ ?',
          correcta: cn, distractores: d.map(nom),
          explicacion: '$' + f.latex + '$ es «' + f.nombre + '». ' + (f.explicacion || '') + pagTxt(f.pagina_pdf), pagina_pdf: pag(f),
        }, rnd));
      }
    }

    // ---- variables: significado, símbolo inverso y unidad ----
    const todasVars = [];
    for (const f of fs) for (const v of f.variables || []) if (v && v.simbolo) todasVars.push({ f, v });
    const vistoSig = new Set(), vistoInv = new Set(), vistoUni = new Set();
    // para repartir: como mucho 2 preguntas de cada tipo por fórmula
    const cont = { simbolo: new Map(), inverso: new Map(), unidad: new Map() };
    const masDe = (tipo, f, max) => (cont[tipo].get(f.id) || 0) >= max;
    const suma = (tipo, f) => cont[tipo].set(f.id, (cont[tipo].get(f.id) || 0) + 1);

    // (C) «¿qué representa el símbolo X?»
    for (const { f, v } of shuffle(todasVars, rnd)) {
      const sig = corto(v.significado); if (!sig || masDe('simbolo', f, 2)) continue;
      const clave = quita(v.simbolo) + '|' + quita(sig); if (vistoSig.has(clave)) continue;
      const w0 = palabras(sig)[0];
      const cand = []; const vistos = new Set([quita(sig)]);
      for (const o of todasVars) {
        const s2 = corto(o.v.significado); if (!s2) continue;
        const q2 = quita(s2); if (vistos.has(q2)) continue;
        if (q2.includes(quita(sig)) || quita(sig).includes(q2)) continue;
        if (w0 && palabras(s2)[0] === w0) continue;                     // “masa …” vs “masa …”: demasiado parecidas
        if (quita(o.v.simbolo) === quita(v.simbolo)) continue;          // mismo símbolo con otro significado: ambiguo
        vistos.add(q2); cand.push(s2);
      }
      const d = elegir(cand, 3, rnd);
      if (!d) continue;
      vistoSig.add(clave); suma('simbolo', f);
      const formula = f.latex.length <= 80 ? ' ($' + f.latex + '$)' : '';
      out.push(opcion({
        id: 'g-s-' + f.id + '-' + hash(v.simbolo).toString(36), cat: 'simbolo',
        enunciado: 'En «' + f.nombre + '»' + formula + ', ¿qué representa ' + simboloInline(v.simbolo) + '?',
        correcta: mayus1(sig), distractores: d.map(mayus1),
        explicacion: simboloInline(v.simbolo) + ' = ' + (v.significado || sig) + (v.unidad && v.unidad !== '—' ? ' [' + v.unidad + ']' : '') + '.' + pagTxt(f.pagina_pdf), pagina_pdf: pag(f),
      }, rnd));
    }

    // (D) inverso: «¿qué símbolo representa “significado”?»  (opciones LaTeX)
    for (const { f, v } of shuffle(todasVars, rnd)) {
      const sig = corto(v.significado, 80); if (!sig || masDe('inverso', f, 1)) continue;
      if (!necesitaTex(v.simbolo) && !/^[\wΑ-ωΔ⁺⁻₀-₉]{1,6}$/.test(v.simbolo)) continue;
      const clave = quita(v.simbolo) + '|' + quita(sig); if (vistoInv.has(clave)) continue;
      const vistos = new Set([quita(v.simbolo)]); const cand = [];
      for (const o of f.variables) { const k = quita(o.simbolo); if (!vistos.has(k) && o.simbolo.length <= 24) { vistos.add(k); cand.push(o.simbolo); } }
      // completa con símbolos de otras fórmulas del capítulo
      for (const o of shuffle(todasVars, rnd)) { const k = quita(o.v.simbolo); if (!vistos.has(k) && o.v.simbolo.length <= 24 && quita(o.v.significado) !== quita(v.significado)) { vistos.add(k); cand.push(o.v.simbolo); } }
      const dentro = f.variables.filter((o) => quita(o.simbolo) !== quita(v.simbolo)).map((o) => o.simbolo);
      const d = elegir(cand, 3, rnd, (s) => (dentro.includes(s) ? 2 : 0));
      if (!d || ![v.simbolo].concat(d).every((s) => texOk(simboloOpcion(s)))) continue;
      vistoInv.add(clave); suma('inverso', f);
      out.push(opcion({
        id: 'g-i-' + f.id + '-' + hash(v.simbolo).toString(36), cat: 'inverso',
        enunciado: 'En «' + f.nombre + '»' + (f.latex.length <= 80 ? ' ($' + f.latex + '$)' : '') + ', ¿qué símbolo representa «' + sig + '»?',
        correcta: simboloOpcion(v.simbolo), distractores: d.map(simboloOpcion), latex_opciones: true,
        explicacion: 'En esta relación ' + simboloInline(v.simbolo) + ' es ' + (v.significado || sig) + '.' + pagTxt(f.pagina_pdf), pagina_pdf: pag(f),
      }, rnd));
    }

    // (E) unidad
    const unidadesCap = []; const dimsVistas = new Set();
    for (const { v } of todasVars) { const u = unidadLimpia(v.unidad); const dm = u && dimension(u); if (u && !dimsVistas.has(dm)) { dimsVistas.add(dm); unidadesCap.push({ u, dm }); } }
    const POOL = ['m', 's', 'kg', 'mol', 'K', 'A', 'N', 'J', 'W', 'Hz', 'Pa', 'V', 'C', 'm·s⁻¹'];
    for (const { f, v } of shuffle(todasVars, rnd)) {
      const u = unidadLimpia(v.unidad); const sig = corto(v.significado, 70); if (!u || !sig || masDe('unidad', f, 2)) continue;
      const dm = dimension(u); const clave = quita(v.simbolo) + '|' + dm; if (vistoUni.has(clave)) continue;
      const usadas = new Set([dm]); const cand = [];
      for (const o of shuffle(unidadesCap, rnd)) if (!usadas.has(o.dm)) { usadas.add(o.dm); cand.push(o.u); }
      let d = cand.slice(0, 3);
      for (const p of shuffle(POOL, rnd)) { if (d.length >= 3) break; const dp = dimension(p); if (!usadas.has(dp)) { usadas.add(dp); d.push(p); } }
      if (d.length < 3) continue;
      vistoUni.add(clave); suma('unidad', f);
      out.push(opcion({
        id: 'g-u-' + f.id + '-' + hash(v.simbolo).toString(36), cat: 'unidad',
        enunciado: 'En «' + f.nombre + '», ¿en qué unidad se mide ' + simboloInline(v.simbolo) + ' (' + sig + ')?',
        correcta: u, distractores: d,
        explicacion: simboloInline(v.simbolo) + ' se expresa en ' + u + (String(v.unidad).trim() !== u ? ' (en el cours: «' + v.unidad + '»)' : '') + '.' + pagTxt(f.pagina_pdf), pagina_pdf: pag(f),
      }, rnd));
    }

    // ---- 3) nociones clave ----
    const nc = [];
    for (const n of cap.nociones_clave || []) {
      const fr = corto(n.fr, 70), fra = primeraFrase(n.es);
      if (fr && fra) nc.push({ n, fr, fra });
    }
    nc.forEach((a, i) => {
      const otros = nc.filter((b, j) => j !== i && quita(b.fra) !== quita(a.fra) && quita(b.fr) !== quita(a.fr) && interseccion(new Set(palabras(a.fr)), new Set(palabras(b.fr))) <= 1);
      const dirDescripcion = rnd() < 0.5;
      const d = elegir(otros, 3, rnd);
      if (!d) return;
      const expl = '«' + a.n.fr + '»: ' + a.n.es + pagTxt(a.n.pagina_pdf);
      if (dirDescripcion) out.push(opcion({
        id: 'g-d-' + i, cat: 'nocion', enunciado: '¿Qué descripción corresponde a «' + a.fr + '»?',
        correcta: a.fra, distractores: d.map((b) => b.fra), explicacion: expl, pagina_pdf: pag(a.n),
      }, rnd));
      else out.push(opcion({
        id: 'g-d-' + i, cat: 'nocion', enunciado: '¿A qué noción del cours corresponde esto? «' + a.fra + '»',
        correcta: a.fr, distractores: d.map((b) => b.fr), explicacion: expl, pagina_pdf: pag(a.n),
      }, rnd));
    });

    // ---- 4) errores típicos ----
    const errs = (cap.errores_tipicos || []).map((e) => ({ e, nom: corto(e.nombre, 90), cor: corto(e.correccion, 150) })).filter((x) => x.nom && x.cor);
    errs.forEach((a, i) => {
      const otros = errs.filter((b, j) => j !== i && quita(b.cor) !== quita(a.cor));
      const d = elegir(otros, 3, rnd);
      if (!d) return;
      out.push(opcion({
        id: 'g-e-' + (a.e.id || i), cat: 'error', enunciado: 'Error típico: «' + a.nom + '». ¿Cuál es la forma correcta de proceder?',
        correcta: a.cor, distractores: d.map((b) => b.cor), explicacion: a.e.correccion + pagTxt(a.e.pagina_pdf), pagina_pdf: pag(a.e),
      }, rnd));
    });

    // ---- 5) constantes (solo valores numéricos limpios y nombres no repetidos) ----
    const num = (s) => parseFloat(String(s).replace(/\s/g, '').replace(',', '.').replace(/×10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/, (m, e) => 'e' + (e[0] === '⁻' ? '-' : '') + [...e].filter((c) => c !== '⁻').map((c) => SUP[c]).join('')));
    const cons = [];
    const clavesNombre = {};
    for (const c of cap.constantes || []) { const k = quita(String(c.nombre).replace(/\(.*$/, '')).trim(); clavesNombre[k] = (clavesNombre[k] || 0) + 1; }
    for (const c of cap.constantes || []) {
      const k = quita(String(c.nombre).replace(/\(.*$/, '')).trim();
      if (clavesNombre[k] > 1 || !/^[\d\s,.×⁰¹²³⁴⁵⁶⁷⁸⁹⁻/-]+$/.test(String(c.valor)) || !isFinite(num(c.valor))) continue;
      const u0 = String(c.unidad || '').trim(); const u = unidadLimpia(u0) || (/^(—|–|-|sin unidad)?$/i.test(u0) ? '' : null);
      const nom = corto(c.nombre, 80); if (u == null || !nom) continue;
      cons.push({ c, nom, txt: c.valor + (u ? ' ' + u : ''), v: num(c.valor) });
    }
    cons.forEach((a, i) => {
      const vt = new Set();
      const otros = cons.filter((b, j) => { if (j === i || quita(b.txt) === quita(a.txt) || Math.abs(b.v - a.v) <= Math.abs(a.v) * 0.03 || vt.has(quita(b.txt))) return false; vt.add(quita(b.txt)); return true; });
      const d = elegir(otros, 3, rnd, (b) => (b.txt.split(' ').slice(1).join(' ') === a.txt.split(' ').slice(1).join(' ') ? 1 : 0));
      if (!d) return;
      out.push(opcion({
        id: 'g-c-' + i, cat: 'constante', enunciado: '¿Cuál es el valor de «' + a.nom + '» según el cours?',
        correcta: a.txt, distractores: d.map((b) => b.txt), explicacion: a.nom + ' = ' + a.txt + ' (cours, p. ' + (a.c.pagina_pdf || '?') + ').', pagina_pdf: pag(a.c),
      }, rnd));
    });

    return out;
  }

  // ---------------------------------------------------------------------------------
  // Preguntas “de autor”: quiz del capítulo y jefe del nivel
  // ---------------------------------------------------------------------------------
  // Si alguna opción depende de las demás (“todas las anteriores”, “ninguna…”) NO se baraja.
  const DEPENDE = /\b(toutes|tous|aucune?|les deux|ninguna|ninguno|todas|ambas|a et b|ni l'une)\b/i;
  function desdeQuiz(q, rnd, prefijo) {
    if (q.tipo === 'numerico') return Object.assign({}, q, { id: prefijo + q.id, cat: 'quiz' });
    const ops = (q.opciones || []).slice(); const ok = ops[q.correcta];
    if (ops.length < 2 || ok == null) return null;
    const fijo = ops.some((o) => DEPENDE.test(o));
    const fin = fijo ? ops : shuffle(ops, rnd);
    return {
      id: prefijo + q.id, tipo: 'opcion', cat: 'quiz', enunciado: q.enunciado || q.pregunta, opciones: fin, correcta: fin.indexOf(ok),
      explicacion: q.explicacion || '', pagina_pdf: q.pagina_pdf || 0,
    };
  }

  const sig = (q) => quita(q.enunciado).replace(/\W+/g, ' ').trim() + '|' + (q.tipo === 'numerico' ? q.valor : quita(q.opciones[q.correcta]));

  // ---------------------------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------------------------
  /** Construye el banco a partir de datos ya cargados (síncrono; lo usan las pruebas). */
  QQ.bancoDesdeDatos = function (capId, semilla, cap, quiz, nivelBase) {
    semilla = semilla | 0;
    const rnd = U.rng(hash('banco|' + capId) ^ Math.imul(semilla, 2654435761));
    const vistos = new Set(); let n = 0;
    const admite = (q) => { if (!q) return false; const s = sig(q); if (vistos.has(s)) return false; vistos.add(s); return true; };

    // 1) jefe del capítulo (preguntas curadas del nivel original)
    const jefe = [];
    const segJefe = ((nivelBase && nivelBase.segmentos) || []).find((s) => s.tipo === 'jefe');
    ((segJefe && segJefe.preguntas) || []).forEach((p, i) => {
      const q = desdeQuiz({ id: 'j' + (i + 1), tipo: 'opcion', enunciado: p.pregunta, opciones: p.opciones, correcta: p.correcta, explicacion: p.explicacion, pagina_pdf: p.pagina_pdf }, rnd, '');
      if (q) { q.cat = 'jefe'; if (admite(q)) jefe.push(q); }
    });
    // 2) quiz del capítulo
    const preguntas = [];
    ((quiz && quiz.preguntas) || []).forEach((q) => { const x = desdeQuiz(q, rnd, ''); if (admite(x)) preguntas.push(x); });
    // 3) generadas desde el cours
    for (const q of generarDesdeCapitulo(cap || {}, rnd)) if (admite(q)) preguntas.push(q);
    // ids únicos (por si dos fuentes coinciden)
    const ids = new Set();
    for (const q of jefe.concat(preguntas)) { while (ids.has(q.id)) q.id += '_' + (++n); ids.add(q.id); }
    return { preguntas, jefe, ctx: { cap: cap || {}, nivelBase: nivelBase || null, quiz: quiz || null }, meta: { capId, semilla, total: preguntas.length + jefe.length } };
  };

  /** PCB.quizquest.banco(capId, semilla) -> Promise<{preguntas, jefe, ctx, meta}> */
  QQ.banco = async function (capId, semilla) {
    const [cap, quiz, nivelBase] = await Promise.all([PCB.data.capitulo(capId), PCB.data.quiz(capId), PCB.data.nivel(capId)]);
    return QQ.bancoDesdeDatos(capId, semilla == null ? 1 : semilla, cap, quiz, nivelBase);
  };
})();
