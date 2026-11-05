// =====================================================================================
// 00-numerico.js — corrector numérico (SIN IA: todo lo calcula el código)
//   PCB.estudio.normalizarUnidad(texto)  -> {ok, factor, dims, off, vacia, texto}
//   PCB.estudio.parsearNumero(texto)     -> {ok, valor, sigMin, sigMax, resto}
//   PCB.estudio.corregirNumerico(respuesta:{valor,unidad}, esperado:{valor,unidad,tolerancia_rel,cifras_sig})
//        -> {ok, valorOk, unidadOk, cifrasOk, mensaje, ...}
// Funciona en el navegador (cuelga de window.PCB.estudio) y en Node (module.exports) para los tests.
// =====================================================================================
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? (window.PCB = window.PCB || {}) : {};
  const E = (root.estudio = root.estudio || {});

  // ---------------------------------------------------------------------------
  // 1. UNIDADES: dimensión = vector de exponentes [m, kg, s, A, K, mol, cd]; factor = valor en SI
  // ---------------------------------------------------------------------------
  const D = (m = 0, kg = 0, s = 0, A = 0, K = 0, mol = 0, cd = 0) => [m, kg, s, A, K, mol, cd];
  const dJ = D(2, 1, -2), dPa = D(-1, 1, -2), dHz = D(0, 0, -1);
  // Tabla de símbolos (sensible a mayúsculas). 'g' es 1e-3 kg, así 'kg' = k·g = 1 kg.
  const UNI = {
    m: { f: 1, d: D(1) }, g: { f: 1e-3, d: D(0, 1) }, s: { f: 1, d: D(0, 0, 1) }, A: { f: 1, d: D(0, 0, 0, 1) },
    K: { f: 1, d: D(0, 0, 0, 0, 1) }, mol: { f: 1, d: D(0, 0, 0, 0, 0, 1) }, cd: { f: 1, d: D(0, 0, 0, 0, 0, 0, 1) },
    L: { f: 1e-3, d: D(3) }, l: { f: 1e-3, d: D(3) },
    M: { f: 1e3, d: D(-3, 0, 0, 0, 0, 1) },            // molar = mol·L⁻¹
    Hz: { f: 1, d: dHz }, Bq: { f: 1, d: dHz },
    N: { f: 1, d: D(1, 1, -2) }, Pa: { f: 1, d: dPa }, J: { f: 1, d: dJ }, W: { f: 1, d: D(2, 1, -3) },
    C: { f: 1, d: D(0, 0, 1, 1) }, V: { f: 1, d: D(2, 1, -3, -1) }, 'Ω': { f: 1, d: D(2, 1, -3, -2) }, ohm: { f: 1, d: D(2, 1, -3, -2) },
    S: { f: 1, d: D(-2, -1, 3, 2) }, F: { f: 1, d: D(-2, -1, 4, 2) }, T: { f: 1, d: D(0, 1, -2, -1) }, H: { f: 1, d: D(2, 1, -2, -2) },
    Wb: { f: 1, d: D(2, 1, -2, -1) },
    eV: { f: 1.602176634e-19, d: dJ }, cal: { f: 4.184, d: dJ }, Wh: { f: 3600, d: dJ },
    bar: { f: 1e5, d: dPa }, atm: { f: 101325, d: dPa }, mmHg: { f: 133.322, d: dPa },
    min: { f: 60, d: D(0, 0, 1) }, h: { f: 3600, d: D(0, 0, 1) },
    u: { f: 1.66053906660e-27, d: D(0, 1) }, Da: { f: 1.66053906660e-27, d: D(0, 1) },
    'Å': { f: 1e-10, d: D(1) }, t: { f: 1000, d: D(0, 1) },
    rad: { f: 1, d: D() }, '°': { f: Math.PI / 180, d: D() }, '%': { f: 0.01, d: D() }, dB: { f: 1, d: D() }, pH: { f: 1, d: D() },
    '°C': { f: 1, d: D(0, 0, 0, 0, 1), off: 273.15 },
  };
  // Unidades de tiempo en palabras (cours en francés/español) y "unidades de cuenta" sin dimensión (noyaux, núcleos…)
  ['an', 'ans', 'año', 'años', 'année', 'années'].forEach((k) => (UNI[k] = { f: 3.15576e7, d: D(0, 0, 1) }));
  ['jour', 'jours', 'd', 'día', 'días'].forEach((k) => (UNI[k] = { f: 86400, d: D(0, 0, 1) }));
  ['heure', 'heures', 'hora', 'horas'].forEach((k) => (UNI[k] = { f: 3600, d: D(0, 0, 1) }));
  ['minute', 'minutes', 'minuto', 'minutos'].forEach((k) => (UNI[k] = { f: 60, d: D(0, 0, 1) }));
  ['seconde', 'secondes', 'segundo', 'segundos'].forEach((k) => (UNI[k] = { f: 1, d: D(0, 0, 1) }));
  UNI['°D'] = { f: 1, d: D() }; // grado Dornic (acidez de la leche)
  ['noyau', 'noyaux', 'núcleo', 'núcleos', 'nucléide', 'atome', 'atomes', 'átomo', 'átomos', 'molécule', 'molécules', 'molécula', 'moléculas', 'ion', 'ions', 'iones', 'photon', 'photons', 'fotón', 'fotones', 'électron', 'électrons', 'electrón', 'electrones']
    .forEach((k) => (UNI[k] = { f: 1, d: D() }));
  // Prefijos SI (sensibles a mayúsculas). 'u' se acepta como micro (conflicto con la unidad 'u': se resuelve primero la exacta).
  const PREF = { Y: 24, Z: 21, E: 18, P: 15, T: 12, G: 9, M: 6, k: 3, h: 2, da: 1, d: -1, c: -2, m: -3, 'µ': -6, 'μ': -6, u: -6, n: -9, p: -12, f: -15, a: -18 };
  const PREF_ORD = Object.keys(PREF).sort((a, b) => b.length - a.length); // 'da' antes que 'd'
  // Búsqueda "indulgente" sin distinguir mayúsculas (mol/l, j, hz…). Se usa solo si la estricta falla.
  const LOWER = {};
  Object.keys(UNI).forEach((k) => { const l = k.toLowerCase(); if (!(l in LOWER)) LOWER[l] = k; });
  LOWER.ohm = 'ohm';

  function buscarSimbolo(t, indulgente) {
    const tabla = indulgente ? (x) => (LOWER[x.toLowerCase()] ? UNI[LOWER[x.toLowerCase()]] : null) : (x) => UNI[x] || null;
    const ex = tabla(t); if (ex) return { f: ex.f, d: ex.d, off: ex.off || 0 };
    for (const p of PREF_ORD) {
      if (t.length > p.length && t.startsWith(p)) {
        const u = tabla(t.slice(p.length));
        if (u && !u.off) return { f: u.f * Math.pow(10, PREF[p]), d: u.d, off: 0 };
      }
    }
    return null;
  }
  const resolver = (t) => buscarSimbolo(t, false) || buscarSimbolo(t, true);

  const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+', '−': '-', '–': '-' };
  /** Convierte superíndices Unicode a ^exp: 'L⁻¹' -> 'L^-1' */
  function limpiarSup(s) {
    return s.replace(/[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => '^' + [...m].map((c) => SUP[c]).join(''));
  }

  const DIMLESS = new Set(['', '1', '-', '—', 'sansunité', 'sinunidad', 'adimensionnel', 'adimensional', 'sansunite', 'u.a.', 'ua']);

  /**
   * normalizarUnidad('mmol·L⁻¹') -> {ok:true, factor:1, dims:[…], off, vacia, texto:'mmol·L⁻¹'}
   * factor = cuántas unidades SI vale 1 de esta unidad (mol/L -> 1000 mol/m³).
   */
  function normalizarUnidad(texto) {
    const orig = String(texto == null ? '' : texto);
    let s = limpiarSup(orig.replace(/[   ]/g, ' ').trim()).replace(/\s*\^\s*/g, '^');
    if (DIMLESS.has(s.toLowerCase().replace(/\s+/g, ''))) return { ok: true, factor: 1, dims: D(), off: 0, vacia: true, texto: orig };
    let i = 0;
    const fin = () => i >= s.length;
    const sp = () => { while (!fin() && s[i] === ' ') i++; };
    // Gramática: expr := termino ( (sep|'/') termino )* ; termino := (símbolo | '(' expr ')') exponente?
    function expr() {
      let r = { f: 1, d: D(), off: 0 }, primero = true, op = 1, n = 0;
      while (!fin()) {
        sp(); if (fin()) break;
        const c = s[i];
        if (c === ')') break;
        if (c === '/' || c === '÷') { i++; op = -1; continue; }
        if (c === '·' || c === '⋅' || c === '∙' || c === '*' || c === '×' || c === '.') { i++; op = 1; continue; }
        const t = termino(); if (!t) return null;
        r.f *= Math.pow(t.f, op); r.d = r.d.map((x, k) => x + op * t.d[k]);
        if (primero && op === 1) r.off = t.off;
        primero = false; n++; op = 1;
      }
      if (n !== 1) r.off = 0; // el desfase (°C) solo cuenta si la unidad es un único símbolo
      return n ? r : null;
    }
    function termino() {
      let base;
      if (s[i] === '(') { i++; base = expr(); if (!base || s[i] !== ')') return null; i++; }
      else {
        const m = /^[\p{L}µ°%]+/u.exec(s.slice(i)); if (!m) return null;
        base = resolver(m[0]); if (!base) return null; i += m[0].length;
        base = { f: base.f, d: base.d.slice(), off: base.off };
      }
      // exponente: '^-1', '-1', '2' pegado al símbolo
      let e = 1;
      const me = /^\^?\(?([+-]?\d+)\)?/.exec(s.slice(i));
      if (me) { e = parseInt(me[1], 10); i += me[0].length; }
      return { f: Math.pow(base.f, e), d: base.d.map((x) => x * e), off: e === 1 ? base.off : 0 };
    }
    let r = null;
    try { r = expr(); } catch (err) { r = null; }
    if (!r || !fin()) return { ok: false, error: 'No reconozco la unidad «' + orig + '».', texto: orig };
    return { ok: true, factor: r.f, dims: r.d, off: r.off || 0, vacia: false, texto: orig };
  }
  const mismaDim = (a, b) => a.every((x, k) => x === b[k]);

  // ---------------------------------------------------------------------------
  // 2. NÚMEROS: coma/punto decimal, notación científica en varias formas, cifras significativas
  // ---------------------------------------------------------------------------
  /**
   * parsearNumero('1,5×10^-3 mol/L') -> {ok, valor:0.0015, sigMin:2, sigMax:2, resto:'mol/L'}
   * Acepta: 1,5  1.5  1,5e-3  1.5E-3  1,5×10^-3  1,5 x 10⁻³  1.5*10-3  1,5·10^(-3)  1,5.10^-3  10^-3  -2,0  "1 000,5"
   */
  function parsearNumero(texto) {
    let s = limpiarSup(String(texto == null ? '' : texto)).replace(/[   ]/g, ' ').trim();
    s = s.replace(/[−–]/g, '-').replace(/\\times|\\cdot/g, '×');
    // quita espacios entre dígitos y alrededor de operadores del exponente
    let t = s.replace(/(\d)\s+(?=\d)/g, '$1').replace(/\s*([×x*·⋅])\s*/g, '$1');
    // solo 10^n
    let m = /^([+-]?)10\^\(?([+-]?\d+)\)?(.*)$/.exec(t.replace(/\s+/g, ' '));
    if (m) {
      const v = (m[1] === '-' ? -1 : 1) * Math.pow(10, parseInt(m[2], 10));
      return { ok: true, valor: v, sigMin: 1, sigMax: 1, resto: m[3].trim() };
    }
    m = /^([+-]?)(\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE]([+-]?\d+)|(?:[×x*·⋅.]|)10\^?\(?([+-]?\d+)\)?)?(.*)$/.exec(t);
    if (!m) return { ok: false, valor: NaN, sigMin: 0, sigMax: 0, resto: '' };
    // cuidado: sin operador, "10" pegado a la mantisa ("1,510") no es notación; lo exigimos con operador o 'e'
    let mant = m[2], expTxt = m[3] !== undefined ? m[3] : m[4];
    let resto = m[5] || '';
    if (expTxt !== undefined && m[3] === undefined) {
      // se necesitaba operador explícito para la forma "×10": verificamos en el texto original
      if (!/[×x*·⋅.]\s*10/.test(t.slice(m[1].length + mant.length))) { expTxt = undefined; resto = t.slice(m[1].length + mant.length); }
    }
    const mantNum = parseFloat(mant.replace(',', '.'));
    if (!isFinite(mantNum)) return { ok: false, valor: NaN, sigMin: 0, sigMax: 0, resto: '' };
    const valor = (m[1] === '-' ? -1 : 1) * mantNum * Math.pow(10, expTxt !== undefined ? parseInt(expTxt, 10) : 0);
    // cifras significativas de la mantisa
    const tieneDec = /[.,]/.test(mant);
    const digs = mant.replace(/[.,]/g, '');
    const sinCeros = digs.replace(/^0+/, '');
    let sigMin, sigMax;
    if (!sinCeros.length) { sigMin = sigMax = 1; }
    else if (tieneDec || expTxt !== undefined) { sigMin = sigMax = sinCeros.length; }
    else { sigMax = sinCeros.length; sigMin = sinCeros.replace(/0+$/, '').length || 1; } // "500": ambiguo 1..3
    return { ok: true, valor, sigMin, sigMax, resto: resto.trim() };
  }

  // ---------------------------------------------------------------------------
  // 3. FORMATO de salida (coma decimal, notación científica en español/francés)
  // ---------------------------------------------------------------------------
  const SUPCH = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  /** Número legible: 0,5 · 1,5×10⁻³ */
  function formatearNumero(v, cifras) {
    if (v == null || !isFinite(v)) return String(v);
    const c = cifras || 4;
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a < 1e-3 || a >= 1e6) {
      const [mant, ex] = v.toExponential(Math.max(0, c - 1)).split('e');
      const m = mant.replace(/\.?0+$/, '').replace('.', ',');
      return m + '×10' + [...String(parseInt(ex, 10))].map((ch) => SUPCH[ch] || ch).join('');
    }
    return String(parseFloat(v.toPrecision(c))).replace('.', ',');
  }
  /** Igual que formatearNumero pero en LaTeX (para KaTeX) */
  function numeroTex(v, cifras) {
    const s = formatearNumero(v, cifras);
    const m = /^(.*)×10([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)$/.exec(s);
    if (!m) return s.replace(',', '{,}');
    const ex = [...m[2]].map((c) => (c === '⁻' ? '-' : Object.keys(SUPCH).find((k) => SUPCH[k] === c))).join('');
    return m[1].replace(',', '{,}') + '\\times10^{' + ex + '}';
  }

  // ---------------------------------------------------------------------------
  // 4. CORRECTOR
  // ---------------------------------------------------------------------------
  /**
   * corregirNumerico({valor:'1,5e-3', unidad:'mol/L'}, {valor:0.0015, unidad:'mol·L⁻¹', tolerancia_rel:0.02, cifras_sig:2})
   * -> {ok, valorOk, unidadOk, cifrasOk, mensaje, avisos[], valorConvertido}
   *   ok = valorOk && unidadOk  (las cifras significativas son un aviso suave y no invalidan)
   */
  function corregirNumerico(respuesta, esperado) {
    respuesta = respuesta || {}; esperado = esperado || {};
    const R = { ok: false, valorOk: false, unidadOk: false, cifrasOk: true, mensaje: '', avisos: [] };
    const tol = esperado.tolerancia_rel > 0 ? esperado.tolerancia_rel : 0.01;
    const uEspTxt = esperado.unidad == null ? '' : String(esperado.unidad);
    const uEsp = normalizarUnidad(uEspTxt);

    // --- número (y posible unidad pegada en el mismo campo: "0,5 mol/L") ---
    const num = parsearNumero(respuesta.valor);
    if (!num.ok) { R.mensaje = 'No entiendo ese número. Escribe por ejemplo 0,25 · 1,5e-3 · 1,5×10^-3.'; return R; }
    let uRespTxt = respuesta.unidad == null ? '' : String(respuesta.unidad).trim();
    if (!uRespTxt && num.resto) uRespTxt = num.resto;
    else if (num.resto && uRespTxt && num.resto !== uRespTxt) R.avisos.push('Escribiste texto extra junto al número («' + num.resto + '»); lo ignoré.');
    const uResp = normalizarUnidad(uRespTxt);

    // --- unidad ---
    let factorResp = 1, factorEsp = 1, offResp = 0, offEsp = 0, comparable = true;
    if (!uEsp.ok) { // unidad esperada no reconocida (contenido raro): comparación de texto
      const clean = (x) => String(x).toLowerCase().replace(/[\s·.*]/g, '');
      R.unidadOk = clean(uRespTxt) === clean(uEspTxt); comparable = R.unidadOk;
    } else if (!uRespTxt) {
      R.unidadOk = !!uEsp.vacia;
      if (!R.unidadOk) R.mensaje = 'Falta la unidad (se espera ' + uEspTxt + ').';
    } else if (!uResp.ok) {
      R.unidadOk = false; comparable = false;
      R.mensaje = uResp.error + (uEspTxt ? ' Se espera ' + uEspTxt + '.' : '');
    } else if (!mismaDim(uResp.dims, uEsp.dims)) {
      R.unidadOk = false; comparable = false;
      R.mensaje = 'Unidad incorrecta: escribiste «' + uRespTxt + '» y la magnitud pide ' + (uEspTxt || 'una cantidad sin unidad') + '.';
    } else {
      R.unidadOk = true; factorResp = uResp.factor; factorEsp = uEsp.factor; offResp = uResp.off; offEsp = uEsp.off;
    }
    // si la unidad es vacía en ambos lados o falta, comparamos el valor tal cual
    if (!uRespTxt && uEsp.ok && !uEsp.vacia) { factorResp = factorEsp = 1; }
    if (!uEsp.ok || !comparable) { factorResp = factorEsp = 1; }

    // --- valor ---
    const vEsp = Number(esperado.valor);
    const a = num.valor * factorResp + offResp, b = vEsp * factorEsp + offEsp;
    const err = b === 0 ? Math.abs(a) : Math.abs(a - b) / Math.abs(b);
    R.valorOk = isFinite(err) && (b === 0 ? Math.abs(a) <= 1e-12 : err <= Math.max(tol, 1e-9));
    R.valorConvertido = a;
    // pista de potencia de 10 (error típico)
    let pista = '';
    if (!R.valorOk && a !== 0 && b !== 0 && isFinite(a / b)) {
      const lg = Math.log10(Math.abs(a / b));
      if (Math.abs(lg - Math.round(lg)) < 0.03 && Math.round(lg) !== 0) pista = ' Ojo: tu resultado difiere en un factor 10^' + Math.round(lg) + ' (¿conversión de unidades o potencias de 10?).';
    }

    // --- cifras significativas (aviso suave) ---
    if (esperado.cifras_sig && R.valorOk) {
      const n = esperado.cifras_sig;
      R.cifrasOk = n >= num.sigMin && n <= num.sigMax;
      if (!R.cifrasOk) {
        const tuyas = num.sigMin === num.sigMax ? num.sigMin : num.sigMin + '–' + num.sigMax;
        R.avisos.push('Cifras significativas: escribiste ' + tuyas + ' y el cours da ' + n + '.');
      }
    }

    R.ok = R.valorOk && R.unidadOk;
    // --- mensaje final ---
    if (R.ok) {
      const conv = uEsp.ok && uResp.ok && Math.abs(factorResp / factorEsp - 1) > 1e-9;
      R.mensaje = (conv ? '¡Correcto! Tu respuesta en «' + uRespTxt + '» equivale a ' : '¡Correcto! ') + (conv ? formatearNumero(b / factorEsp, esperado.cifras_sig || 4) + ' ' + uEspTxt + '.' : '');
    } else if (R.valorOk && !R.unidadOk) {
      R.mensaje = 'El valor está bien, pero ' + (R.mensaje ? R.mensaje.charAt(0).toLowerCase() + R.mensaje.slice(1) : 'la unidad no es correcta.');
    } else if (!R.valorOk && !R.unidadOk && R.mensaje) {
      R.mensaje = 'El valor no coincide (tolerancia ±' + formatearNumero(tol * 100, 3) + ' %). ' + R.mensaje + pista;
    } else if (!R.valorOk && R.unidadOk && R.mensaje === '') {
      R.mensaje = 'El valor no coincide (tolerancia ±' + formatearNumero(tol * 100, 3) + ' %).' + pista;
    } else if (!R.valorOk && !R.mensaje) {
      R.mensaje = 'El valor no coincide.' + pista;
    }
    if (R.avisos.length) R.mensaje += ' ' + R.avisos.join(' ');
    R.mensaje = R.mensaje.replace(/\s+/g, ' ').trim();
    return R;
  }

  Object.assign(E, { normalizarUnidad, parsearNumero, corregirNumerico, formatearNumero, numeroTex });
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
})();
