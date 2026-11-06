// =====================================================================================
// 00-invasion.js — MODO INVASIÓN: repetición espaciada (cajas de Leitner) convertida en tower defense.
//   PCB.invasion.abrir()  abre la pantalla (también: botón «🛡 Invasión» de la barra superior)
//   1) PREPARACIÓN  40 problemas (16 fáciles · 16 medios · 8 difíciles) de los capítulos que toca repasar; aciertos pagan ⚛
//   2) DEFENSA      5 oleadas; torres láser · escudo ácido/base · bobina · campo magnético · radar · cañón de gas ideal
//   3) RESULTADO    60 % aciertos + 40 % salud de la base → sube/baja de caja (1·3·7·14·30 días) y gana créditos de tecnología
// Balance propuesto y aprobado (ver README). Persistencia híbrida: las torres NO persisten; las tecnologías SÍ.
// Todo en PCB.store (prog.invasion). Las preguntas salen del banco de Quiz Quest (cours) y las numéricas las corrige el código.
// =====================================================================================
(function () {
  const PCB = window.PCB, el = PCB.util.el, tex = PCB.util.tex, QQ = () => PCB.quizquest;
  const DIA = 86400000, DIAS = [1, 3, 7, 14, 30];
  const PAGO = { facil: 10, medio: 20, dificil: 35 }, MAXPAGO = 760;
  const HPM = 2.6;   // multiplicador de vida de los enemigos (calibrado con bots)
  const CELDA = 48, COLS = 16, FILAS = 9;
  const TORRES = {
    laser: { n: 'Láser', ico: '🔦', col: '#ff4d6d', coste: 80, rango: 3.2, dano: 28, cd: 0.8, aire: true, caps: ['images', 'photons'], desc: 'Daño alto a un objetivo. Daña voladores.' },
    acido: { n: 'Escudo ácido/base', ico: '🧪', col: '#9dff3a', coste: 90, rango: 2.6, dano: 14, cd: 0.6, aire: false, caps: ['acide-base', 'force-acides-bases'], desc: 'Corroe: +50 % de daño a blindados.' },
    bobina: { n: 'Bobina eléctrica', ico: '⚡', col: '#ffd23f', coste: 100, rango: 2.8, dano: 12, cd: 0.9, aire: false, caps: ['systeme-electrique', 'champ-uniforme'], desc: 'Cadena: golpea hasta 3 objetivos.' },
    campo: { n: 'Campo magnético', ico: '🧲', col: '#3ad0ff', coste: 110, rango: 2.8, dano: 0, cd: 0.1, aire: true, caps: ['champ-gravitation', 'newton-2'], desc: 'Frena un 40 % en su radio, sin daño.' },
    radar: { n: 'Radar/difracción', ico: '📡', col: '#c9a6ff', coste: 120, rango: 3.4, dano: 20, cd: 0.7, aire: true, caps: ['ondulatoires', 'description-mouvement'], desc: 'Daña voladores (junto al láser).' },
    gas: { n: 'Cañón de gas ideal', ico: '💥', col: '#ff9f1c', coste: 130, rango: 3.0, dano: 40, cd: 1.6, aire: false, caps: ['gaz-parfait', 'thermodynamique'], desc: 'Daño en área.' },
  };
  const INICIALES = ['laser', 'acido', 'bobina'];
  const ENEMIGOS = {
    corredor: { n: 'Corredor', hp: 40, v: 2.4, vida: 1, col: '#ff7a7a', aire: false },
    blindado: { n: 'Blindado', hp: 160, v: 1.2, vida: 2, col: '#8ea0c8', aire: false, armadura: 0.3 },
    volador: { n: 'Volador', hp: 70, v: 1.8, vida: 1, col: '#c9a6ff', aire: true },
    jefe: { n: 'Jefe', hp: 900, v: 0.8, vida: 5, col: '#ffd23f', aire: false, armadura: 0.0 },
  };
  const OLEADAS = [{ corredor: 8 }, { corredor: 6, blindado: 3 }, { corredor: 5, volador: 4 }, { blindado: 6, corredor: 6 }, { jefe: 1, blindado: 5, volador: 4 }];
  const TECNOLOGIAS = [
    { id: 'u-campo', n: 'Desbloquea Campo magnético', efecto: 'torre', torre: 'campo' }, { id: 'u-radar', n: 'Desbloquea Radar/difracción', efecto: 'torre', torre: 'radar' }, { id: 'u-gas', n: 'Desbloquea Cañón de gas ideal', efecto: 'torre', torre: 'gas' },
    ...[1, 2, 3, 4, 5].map((i) => ({ id: 'v' + i, n: 'Base reforzada ' + i + ' (+1 vida máx.)', efecto: 'vida' })),
    ...[1, 2, 3, 4, 5].map((i) => ({ id: 'd' + i, n: 'Daño mejorado ' + i + ' (+4 %)', efecto: 'dano' })),
  ];
  const CAMINO_A = [[-1, 1], [13, 1], [13, 4], [2, 4], [2, 7], [16, 7]];
  const CAMINO_B = [[16, 3], [6, 3], [6, 6], [10, 6], [10, 8], [16, 8]];

  // ---------- persistencia ----------
  const datos = () => { const p = PCB.store.get(); return (p.invasion ||= { cola: {}, tecnologias: [], creditos: 0, gastados: 0, ultimos: {}, historial: [], minutos: 30 }); };
  const guardar = (fn) => PCB.store.update((p) => { fn(datos()); });
  const hoy = () => Date.now();
  const estudiado = (capId) => { const c = PCB.store.get().capitulos[capId]; return !!(c && ((c.estrellas || 0) >= 2 || c.nivelGanado)); };
  const toca = (capId) => { const e = datos().cola[capId]; return !!(e && e.prox <= hoy()); };
  const tieneTech = (id) => datos().tecnologias.includes(id);
  const torresDisp = () => INICIALES.concat(TECNOLOGIAS.filter((t) => t.efecto === 'torre' && tieneTech(t.id)).map((t) => t.torre));
  const bonoVida = () => TECNOLOGIAS.filter((t) => t.efecto === 'vida' && tieneTech(t.id)).length;
  const bonoDano = () => TECNOLOGIAS.filter((t) => t.efecto === 'dano' && tieneTech(t.id)).length * 0.04;

  // ---------- utilidades de interfaz ----------
  function conTex(host, s) { String(s == null ? '' : s).split('$').forEach((t, i) => { if (i % 2) { const sp = el('span', { class: 'iv-tex' }); tex(t, sp); host.append(sp); } else host.append(document.createTextNode(t)); }); return host; }
  const fmt = (n) => Math.round(n);
  let host = null, timer = null, raf = 0, limpiar = [];
  const pantalla = (...kids) => { host.replaceChildren(el('div', { class: 'iv' }, ...kids)); host.scrollTop = 0; };
  const nombreCap = (id) => { const c = ((window.PCB_CONTENIDO && window.PCB_CONTENIDO.indice) || {}).capitulos; const x = c && c.find((q) => q.id === id); return x ? x.num + '. ' + x.titulo : id; };
  const capsLista = () => ((((window.PCB_CONTENIDO || {}).indice) || {}).capitulos || []).map((c) => c.id);

  // =====================================================================================
  // MENÚ
  // =====================================================================================
  function menu() {
    stopAll();
    guardar((x) => { x.auto = x.auto || {}; for (const id of capsLista()) if (estudiado(id) && !x.auto[id]) { x.auto[id] = 1; if (!x.cola[id]) x.cola[id] = { caja: 1, prox: hoy() + DIA, n: 0 }; } });   // capítulo completado (≥2★): primer repaso a +1 día
    const d = datos(), ids = capsLista(), pend = ids.filter(toca);
    const caja = (id) => (d.cola[id] ? d.cola[id].caja : 0);
    const filas = ids.map((id) => {
      const e = d.cola[id], est = estudiado(id), dias = e ? Math.ceil((e.prox - hoy()) / DIA) : null;
      const ck = el('input', { type: 'checkbox', checked: !!e, on: { change: (ev) => { guardar((x) => { if (ev.target.checked) x.cola[id] = x.cola[id] || { caja: 1, prox: hoy(), n: 0 }; else delete x.cola[id]; }); menu(); } } });
      return el('label', { class: 'iv-cap' + (toca(id) ? ' toca' : ''), title: est ? 'Capítulo estudiado (≥2★ en el quiz o nivel ganado)' : 'Aún sin estudiar' },
        ck, el('span', { class: 'iv-cap-n' }, nombreCap(id)), el('span', { class: 'iv-caja' }, e ? 'Caja ' + e.caja + '/5' : est ? 'sugerido' : '—'), el('span', { class: 'iv-prox' }, e ? (dias <= 0 ? '¡toca hoy!' : 'en ' + dias + ' d') : ''));
    });
    const sel = new Set(pend);
    pantalla(
      el('h1', {}, '🛡 Invasión'),
      el('p', { class: 'iv-sub' }, 'Repasa para ganar ⚛ y úsalos para defender tu base. Cuanto mejor repases, más sobrevives… y más espaciado el siguiente repaso.'),
      el('div', { class: 'iv-barra' }, el('span', {}, '⭐ Créditos de tecnología: ', el('b', {}, d.creditos - d.gastados)), el('span', {}, 'Tecnologías: ' + d.tecnologias.length + '/' + TECNOLOGIAS.length), el('button', { class: 'btn mini', on: { click: tecnologias } }, '🔬 Tecnologías')),
      el('h2', {}, 'Capítulos en tu cola de repaso'),
      el('p', { class: 'iv-sub' }, 'Marca los que quieras repasar (los que añadas tocan hoy; los completados con ≥ 2★ entran solos con primer repaso a +1 día). Un capítulo estudiado (≥ 2★) hace que su torre cueste −25 % y pegue +20 %.'),
      el('div', { class: 'iv-caps' }, ...filas),
      el('div', { class: 'iv-acciones' },
        el('button', { class: 'btn primario', disabled: pend.length ? null : true, on: { click: () => empezar(pend, false) } }, pend.length ? '🛡 Invasión de hoy (' + pend.length + ' cap.)' : '🛡 Nada toca hoy'),
        el('button', { class: 'btn', on: { click: () => practica() } }, '🎯 Invasión de práctica'),
        el('label', { class: 'iv-min' }, 'Preparación: ', el('select', { on: { change: (e) => guardar((x) => { x.minutos = +e.target.value; }) } }, ...[15, 30, 45].map((m) => el('option', { value: m, selected: d.minutos === m ? '' : null }, m + ' min'))))
      ),
      d.historial.length ? el('div', { class: 'iv-hist' }, el('h2', {}, 'Últimas invasiones'), ...d.historial.slice(-5).reverse().map((h) => el('div', {}, new Date(h.t).toLocaleDateString() + ' · ' + (h.practica ? 'práctica' : 'diaria') + ' · puntaje ' + h.puntaje + ' % · base ' + h.base + ' %'))) : null
    );
    void sel; void caja;
  }
  function practica() {
    const ids = capsLista();
    const marcas = new Set();
    pantalla(el('h1', {}, '🎯 Invasión de práctica'), el('p', { class: 'iv-sub' }, 'Elige 1 o más capítulos. No cambia tus cajas de repaso ni da créditos.'),
      el('div', { class: 'iv-caps' }, ...ids.map((id) => el('label', { class: 'iv-cap' }, el('input', { type: 'checkbox', on: { change: (e) => (e.target.checked ? marcas.add(id) : marcas.delete(id)) } }), el('span', { class: 'iv-cap-n' }, nombreCap(id))))),
      el('div', { class: 'iv-acciones' }, el('button', { class: 'btn primario', on: { click: () => (marcas.size ? empezar([...marcas], true) : PCB.util.toast('Elige al menos un capítulo')) } }, 'Empezar'), el('button', { class: 'btn', on: { click: menu } }, '← Volver')));
  }
  function tecnologias() {
    const d = datos(), libres = d.creditos - d.gastados;
    pantalla(el('h1', {}, '🔬 Tecnologías'), el('p', { class: 'iv-sub' }, 'Permanentes. Se ganan al consolidar capítulos (1 crédito por capítulo con ≥ 85 % y +1 si la base acaba con ≥ 70 %). Créditos libres: ', el('b', {}, libres)),
      el('div', { class: 'iv-techs' }, ...TECNOLOGIAS.map((t) => { const ya = tieneTech(t.id); return el('button', { class: 'iv-tech' + (ya ? ' ya' : ''), disabled: ya || libres < 1 ? true : null, on: { click: () => { guardar((x) => { x.tecnologias.push(t.id); x.gastados++; }); tecnologias(); } } }, (ya ? '✔ ' : '') + t.n, el('small', {}, ya ? 'obtenida' : '1 crédito')); })),
      el('div', { class: 'iv-acciones' }, el('button', { class: 'btn', on: { click: menu } }, '← Volver')));
  }

  // =====================================================================================
  // PREPARACIÓN
  // =====================================================================================
  const FACIL = ['formula', 'nombre', 'simbolo', 'inverso'], DIFICIL = ['error', 'jefe'];
  const dificultad = (q) => (q.tipo === 'numerico' || DIFICIL.includes(q.cat) ? 'dificil' : FACIL.includes(q.cat) ? 'facil' : 'medio');
  async function construirBanco(caps, practica) {
    const d = datos(), pool = { facil: [], medio: [], dificil: [] };
    for (const capId of caps) {
      const b = await QQ().banco(capId, (Math.random() * 1e6) | 0);
      const peso = practica ? 1 : (d.cola[capId] ? (d.cola[capId].caja <= 2 ? 1.6 : d.cola[capId].caja === 3 ? 1 : 0.6) : 1);
      const vetados = new Set((d.ultimos[capId] || []));
      for (const q of b.preguntas.concat(b.jefe)) { if (vetados.has(q.id)) continue; pool[dificultad(q)].push({ q, capId, w: peso * (0.5 + Math.random()) }); }
    }
    const tomar = (arr, n) => arr.sort((a, b) => b.w - a.w).slice(0, n);
    let f = tomar(pool.facil, 16), m = tomar(pool.medio, 16), di = tomar(pool.dificil, 8);
    // rellena huecos con lo que haya
    const resto = [].concat(pool.facil, pool.medio, pool.dificil).filter((x) => ![...f, ...m, ...di].includes(x));
    let falta = 40 - (f.length + m.length + di.length); const extra = resto.sort((a, b) => b.w - a.w).slice(0, Math.max(0, falta));
    const todo = [...f.map((x) => ({ ...x, dif: 'facil' })), ...m.map((x) => ({ ...x, dif: 'medio' })), ...di.map((x) => ({ ...x, dif: 'dificil' })), ...extra.map((x) => ({ ...x, dif: dificultad(x.q) }))];
    for (let i = todo.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [todo[i], todo[j]] = [todo[j], todo[i]]; }
    return todo;
  }
  async function empezar(caps, practicaModo) {
    pantalla(el('h1', {}, '⏳ Preparando preguntas…'));
    const lista = await construirBanco(caps, practicaModo);
    if (lista.length < 5) { PCB.util.toast('No hay suficientes preguntas'); return menu(); }
    const S = { caps, practica: practicaModo, lista, i: 0, cr: 0, aciertos: 0, racha: 0, t0: hoy(), porCap: {}, fallos: [], multi: caps.length >= 3, limite: datos().minutos * 60000 };
    caps.forEach((c) => (S.porCap[c] = { ok: 0, n: 0 }));
    pregunta(S);
  }
  function pregunta(S) {
    stopAll();
    if (S.i >= S.lista.length) return finPreparacion(S);
    PCB.invasion._S = S;
    const it = S.lista[S.i], q = it.q, rest = Math.max(0, S.limite - (hoy() - S.t0));
    const cab = el('div', { class: 'iv-cab' }, el('span', {}, 'Problema ', el('b', {}, S.i + 1), ' / ' + S.lista.length), el('span', { class: 'iv-dif ' + it.dif }, it.dif), el('span', {}, '⚛ ', el('b', {}, fmt(S.cr))), el('span', {}, '🔥 racha ' + S.racha), el('span', { class: 'iv-crono' }, Math.floor(rest / 60000) + ':' + String(Math.floor(rest / 1000) % 60).padStart(2, '0')));
    const cuerpo = el('div', { class: 'iv-q' });
    const enun = el('div', { class: 'iv-enun' }); conTex(enun, q.enunciado);
    cuerpo.append(el('div', { class: 'iv-capq' }, nombreCap(it.capId)), enun);
    const cerrar = (ok, expl) => {
      const pag = ok ? Math.min(PAGO[it.dif] * (1 + Math.min(0.3, 0.1 * Math.floor(S.racha / 3))) * (S.multi ? 1.15 : 1), 999) : 0;
      S.porCap[it.capId].n++; if (ok) { S.aciertos++; S.racha++; S.porCap[it.capId].ok++; S.cr = Math.min(S.cr + pag, MAXPAGO * (S.multi ? 1.15 : 1)); } else { S.racha = 0; S.fallos.push(it); }
      const fb = el('div', { class: 'iv-fb ' + (ok ? 'ok' : 'mal') }, el('b', {}, ok ? '✔ Correcto  +' + fmt(pag) + ' ⚛' : '✘ Incorrecto  +0 ⚛'));
      if (expl) { const e = el('div', { class: 'iv-expl' }); conTex(e, expl); fb.append(e); }
      if (q.pagina_pdf) fb.append(el('small', {}, 'cours p. ' + q.pagina_pdf));
      fb.append(el('button', { class: 'btn primario', on: { click: () => { S.i++; pregunta(S); } } }, S.i + 1 >= S.lista.length ? 'Ir a la defensa →' : 'Siguiente →'));
      cuerpo.append(fb);
      cuerpo.querySelectorAll('button.iv-op, input, .iv-comp').forEach((b) => (b.disabled = true));
    };
    if (q.tipo === 'numerico') {
      const inp = el('input', { type: 'text', class: 'iv-num', placeholder: 'valor (p. ej. 1,5e-3)', autofocus: '' }), uni = el('input', { type: 'text', class: 'iv-uni', placeholder: q.unidad ? 'unidad (' + q.unidad + ')' : 'unidad' });
      const ok = el('button', { class: 'btn primario iv-comp', on: { click: () => { const r = PCB.estudio.corregirNumerico({ valor: inp.value, unidad: uni.value }, { valor: q.valor, unidad: q.unidad, tolerancia_rel: q.tolerancia_rel || 0.02, cifras_sig: q.cifras_sig }); cerrar(!!(r && (r.ok || r.correcto || r.valorOk && r.unidadOk)), (q.pasos ? [].concat(q.pasos).join(' · ') + ' ' : '') + 'Respuesta: ' + q.valor + ' ' + (q.unidad || '')); } } }, 'Comprobar');
      cuerpo.append(el('div', { class: 'iv-numrow' }, inp, uni, ok));
    } else {
      cuerpo.append(el('div', { class: 'iv-ops' }, ...q.opciones.map((o, k) => { const b = el('button', { class: 'iv-op', on: { click: () => { const ok = k === q.correcta; b.classList.add(ok ? 'ok' : 'mal'); if (!ok) cuerpo.querySelectorAll('.iv-op')[q.correcta].classList.add('ok'); cerrar(ok, q.explicacion); } } }); if (q.latex_opciones) tex(o, b); else conTex(b, o); return b; })));
    }
    pantalla(cab, cuerpo, el('div', { class: 'iv-acciones' }, el('button', { class: 'btn mini', on: { click: () => (S.i > 3 ? finPreparacion(S) : menu()) } }, S.i > 3 ? 'Terminar preparación ya →' : '← Salir')));
    timer = setInterval(() => { const c = host.querySelector('.iv-crono'); if (c) { const r = Math.max(0, S.limite - (hoy() - S.t0)); c.textContent = Math.floor(r / 60000) + ':' + String(Math.floor(r / 1000) % 60).padStart(2, '0'); } }, 1000);
  }
  function finPreparacion(S) {
    stopAll();
    const usado = hoy() - S.t0, sobrantes = Math.max(0, (S.limite - usado) / 60000), bonoT = S.i >= S.lista.length ? Math.min(100, Math.floor(sobrantes) * 5) : 0;
    S.cr += bonoT; S.ratio = S.i ? S.aciertos / Math.max(1, S.i) : 0; S.bonoT = bonoT;
    pantalla(el('h1', {}, '⚛ Preparación terminada'), el('div', { class: 'iv-resumen' }, el('div', {}, 'Aciertos: ', el('b', {}, S.aciertos + ' / ' + Math.max(S.i, 1))), el('div', {}, 'Bonus por tiempo: ', el('b', {}, '+' + bonoT + ' ⚛')), el('div', { class: 'iv-grande' }, '⚛ ' + fmt(S.cr) + ' para la defensa')),
      S.fallos.length ? el('p', { class: 'iv-sub' }, 'Los fallos pagan 0 y volverán a tu cola de debilidades.') : null,
      el('div', { class: 'iv-acciones' }, el('button', { class: 'btn primario', on: { click: () => defensa(S) } }, '🛡 ¡A defender la base!')));
  }

  // =====================================================================================
  // DEFENSA (tower defense)
  // =====================================================================================
  function trayecto(cam) { const pts = cam.map((p) => [p[0] + 0.5, p[1] + 0.5]); const seg = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push([tot, tot + l]); tot += l; } return { pts, seg, total: tot }; }
  function posEn(tr, d) { d = Math.max(0, Math.min(d, tr.total)); for (let i = 0; i < tr.seg.length; i++) if (d <= tr.seg[i][1]) { const t = (d - tr.seg[i][0]) / (tr.seg[i][1] - tr.seg[i][0] || 1), a = tr.pts[i], b = tr.pts[i + 1]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; } return tr.pts[tr.pts.length - 1]; }
  function celdasCamino(cams) { const s = new Set(); for (const cam of cams) for (let i = 1; i < cam.length; i++) { const [x0, y0] = cam[i - 1], [x1, y1] = cam[i]; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let k = 0; k <= n; k++) s.add(Math.round(x0 + ((x1 - x0) * k) / (n || 1)) + ',' + Math.round(y0 + ((y1 - y0) * k) / (n || 1))); } return s; }
  const costeTorre = (G, k) => TORRES[k].coste * (G.bonoCap.has(k) ? 0.75 : 1);
  const danoTorre = (G, t) => TORRES[t.k].dano * (1 + (t.nv === 2 ? 0.5 : t.nv === 3 ? 1.2 : 0)) * (G.bonoCap.has(t.k) ? 1.2 : 1) * (1 + bonoDano());
  function defensa(S) {
    stopAll();
    const cams = S.multi ? [CAMINO_A, CAMINO_B] : [CAMINO_A], trs = cams.map(trayecto), vMax = 20 + bonoVida();
    const bonoCap = new Set(); Object.entries(TORRES).forEach(([k, t]) => { if (t.caps.some((c) => S.caps.includes(c) && estudiado(c))) bonoCap.add(k); });
    const G = { S, cams, trs, bloq: celdasCamino(cams), cr: S.cr, vidas: vMax, vMax, torres: [], en: [], ola: 0, fase: 'espera', t: 0, vel: 1, cola: [], sel: 'laser', haz: [], bonoCap, mult: S.multi ? 1.4 : 1, sig: 0, selT: null, fin: false, ts: 0 };
    const cv = el('canvas', { width: COLS * CELDA, height: FILAS * CELDA, class: 'iv-cv' }), ctx = cv.getContext('2d');
    const hud = el('div', { class: 'iv-hud' }), panel = el('div', { class: 'iv-panel' }), msg = el('div', { class: 'iv-msg' });
    const botones = {};
    const refrescar = () => {
      hud.replaceChildren(el('span', {}, '❤ ' + G.vidas + ' / ' + G.vMax), el('span', {}, '⚛ ' + fmt(G.cr)), el('span', {}, 'Oleada ' + Math.min(G.ola + (G.fase === 'oleada' ? 0 : 1), 5) + ' / 5'),
        el('button', { class: 'btn mini', on: { click: () => { G.vel = G.vel === 1 ? 2 : 1; refrescar(); } } }, '×' + G.vel), el('button', { class: 'btn mini primario', disabled: G.fase === 'oleada' || G.fin ? true : null, on: { click: lanzar } }, G.fase === 'oleada' ? 'En curso…' : '▶ Lanzar oleada'));
      panel.replaceChildren(...torresDisp().map((k) => { const t = TORRES[k], c = costeTorre(G, k); const b = el('button', { class: 'iv-torre' + (G.sel === k ? ' sel' : '') + (G.cr < c ? ' caro' : ''), title: t.desc, on: { click: () => { G.sel = k; G.selT = null; refrescar(); } } }, el('span', { style: { color: t.col } }, t.ico + ' ' + t.n), el('small', {}, fmt(c) + ' ⚛' + (G.bonoCap.has(k) ? ' (−25 %, +20 % daño)' : ''))); botones[k] = b; return b; }));
      if (G.selT) { const t = G.selT, cu = t.nv < 3 ? TORRES[t.k].coste * (t.nv === 1 ? 0.6 : 1.0) * (G.bonoCap.has(t.k) ? 0.75 : 1) : 0; panel.append(el('div', { class: 'iv-mejora' }, el('b', {}, TORRES[t.k].n + ' nivel ' + t.nv), t.nv < 3 ? el('button', { class: 'btn mini primario', disabled: G.cr < cu ? true : null, on: { click: () => { if (G.cr >= cu) { G.cr -= cu; t.nv++; refrescar(); } } } }, 'Mejorar ' + fmt(cu) + ' ⚛') : el('span', {}, 'nivel máx.'))); }
    };
    function lanzar() {
      if (G.fase === 'oleada' || G.fin) return;
      const comp = OLEADAS[G.ola], lista = []; let cn = 0;
      Object.entries(comp).forEach(([tipo, n]) => { const cant = tipo === 'jefe' ? n : Math.ceil(n * G.mult); for (let i = 0; i < cant; i++) lista.push(tipo); });
      lista.sort(() => Math.random() - 0.5); const dur = 14;
      G.cola = lista.map((tipo, i) => ({ t: G.t + (i / lista.length) * dur + (tipo === 'jefe' ? 3 : 0), tipo, cam: cn++ % cams.length }));
      G.fase = 'oleada'; msg.textContent = 'Oleada ' + (G.ola + 1); refrescar();
    }
    function nuevoEnemigo(e) { const d = ENEMIGOS[e.tipo], vida = d.hp * (PCB.invasion.HPM || HPM); G.en.push({ tipo: e.tipo, hp: vida, hpMax: vida, d: 0, cam: e.cam, lento: 0, x: -1, y: 1, aire: d.aire }); }
    function posicion(en) { if (en.aire) { const cam = G.cams[en.cam], a = [cam[0][0] + 0.5, cam[0][1] + 0.5], b = [cam[cam.length - 1][0] + 0.5, cam[cam.length - 1][1] + 0.5], tot = Math.hypot(b[0] - a[0], b[1] - a[1]), t = Math.min(1, en.d / tot); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, tot]; } const p = posEn(G.trs[en.cam], en.d); return [p[0], p[1], G.trs[en.cam].total]; }
    const dano = (en, d, quien) => { const def = ENEMIGOS[en.tipo]; let x = d * (1 - (def.armadura || 0)); if (quien === 'acido' && en.tipo === 'blindado') x *= 1.5; en.hp -= x; };
    function paso(dt) {
      G.t += dt;
      while (G.cola.length && G.cola[0].t <= G.t) nuevoEnemigo(G.cola.shift());
      for (const en of G.en) { const def = ENEMIGOS[en.tipo]; en.lento = Math.max(0, en.lento - dt); const v = def.v * (en.lento > 0 ? 0.6 : 1); en.d += v * dt; const [x, y, tot] = posicion(en); en.x = x; en.y = y; en.fin = en.d >= tot; }
      for (const en of G.en) if (en.fin && en.hp > 0) { G.vidas -= ENEMIGOS[en.tipo].vida; en.hp = -1; en.llego = true; if (G.vidas <= 0) { G.vidas = 0; } }
      // torres
      for (const t of G.torres) {
        t.cd -= dt; const def = TORRES[t.k], rango = def.rango, dentro = G.en.filter((e) => e.hp > 0 && Math.hypot(e.x - (t.cx + 0.5), e.y - (t.cy + 0.5)) <= rango && (def.aire || !e.aire));
        if (t.k === 'campo') { dentro.forEach((e) => (e.lento = 0.3)); continue; }
        if (t.cd > 0 || !dentro.length) continue;
        const obj = dentro.sort((a, b) => b.d - a.d)[0], dm = danoTorre(G, t); t.cd = def.cd * 0.9; t.flash = 0.12;
        if (t.k === 'bobina') { const otros = G.en.filter((e) => e !== obj && e.hp > 0 && !e.aire && Math.hypot(e.x - obj.x, e.y - obj.y) < 1.8).slice(0, 2); [obj, ...otros].forEach((e, i) => { dano(e, dm * (i ? 0.7 : 1), 'bobina'); G.haz.push({ a: [t.cx + 0.5, t.cy + 0.5], b: [e.x, e.y], c: def.col, t: 0.15 }); }); }
        else if (t.k === 'gas') { G.en.filter((e) => e.hp > 0 && !e.aire && Math.hypot(e.x - obj.x, e.y - obj.y) < 1.2).forEach((e) => dano(e, dm, 'gas')); G.haz.push({ a: [t.cx + 0.5, t.cy + 0.5], b: [obj.x, obj.y], c: def.col, t: 0.2, r: 1.2 }); }
        else { dano(obj, dm, t.k); G.haz.push({ a: [t.cx + 0.5, t.cy + 0.5], b: [obj.x, obj.y], c: def.col, t: 0.12 }); }
      }
      G.en = G.en.filter((e) => e.hp > 0 || (e.llego ? false : false)).filter((e) => e.hp > 0);
      G.haz.forEach((h) => (h.t -= dt)); G.haz = G.haz.filter((h) => h.t > 0);
      G.torres.forEach((t) => (t.flash = Math.max(0, (t.flash || 0) - dt)));
      if (G.vidas <= 0) return terminar(false);
      if (G.fase === 'oleada' && !G.cola.length && !G.en.length) { G.ola++; G.fase = 'espera'; if (G.ola >= 5) return terminar(true); msg.textContent = 'Oleada superada. Coloca torres y lanza la siguiente.'; refrescar(); }
    }
    function dibujar() {
      ctx.fillStyle = '#0d1430'; ctx.fillRect(0, 0, cv.width, cv.height);
      for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) { ctx.fillStyle = (x + y) % 2 ? '#111a3a' : '#0f1736'; ctx.fillRect(x * CELDA, y * CELDA, CELDA, CELDA); }
      for (const k of G.bloq) { const [x, y] = k.split(',').map(Number); ctx.fillStyle = '#2a2f55'; ctx.fillRect(x * CELDA, y * CELDA, CELDA, CELDA); ctx.fillStyle = '#3b4274'; ctx.fillRect(x * CELDA + 2, y * CELDA + 2, CELDA - 4, 4); }
      // base
      ctx.fillStyle = '#2ee59d'; for (const c of G.cams) { const f = c[c.length - 1]; ctx.fillRect(COLS * CELDA - 10, f[1] * CELDA + 8, 10, CELDA - 16); }
      for (const t of G.torres) { const d = TORRES[t.k], x = t.cx * CELDA, y = t.cy * CELDA; if (G.selT === t) { ctx.strokeStyle = '#fff4'; ctx.beginPath(); ctx.arc(x + CELDA / 2, y + CELDA / 2, d.rango * CELDA, 0, 6.3); ctx.stroke(); } ctx.fillStyle = '#0b1230'; ctx.fillRect(x + 4, y + 4, CELDA - 8, CELDA - 8); ctx.fillStyle = d.col; ctx.globalAlpha = 0.25 + (t.flash > 0 ? 0.5 : 0); ctx.fillRect(x + 6, y + 6, CELDA - 12, CELDA - 12); ctx.globalAlpha = 1; ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(d.ico, x + CELDA / 2, y + CELDA / 2 + 8); ctx.fillStyle = '#ffd23f'; for (let i = 0; i < t.nv; i++) ctx.fillRect(x + 8 + i * 8, y + CELDA - 9, 6, 4); }
      for (const h of G.haz) { ctx.strokeStyle = h.c; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(h.a[0] * CELDA, h.a[1] * CELDA); ctx.lineTo(h.b[0] * CELDA, h.b[1] * CELDA); ctx.stroke(); if (h.r) { ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(h.b[0] * CELDA, h.b[1] * CELDA, h.r * CELDA, 0, 6.3); ctx.fillStyle = h.c; ctx.fill(); ctx.globalAlpha = 1; } }
      for (const e of G.en) { const d = ENEMIGOS[e.tipo], r = e.tipo === 'jefe' ? 17 : e.tipo === 'blindado' ? 13 : 10, x = e.x * CELDA, y = e.y * CELDA; ctx.fillStyle = '#0b1230'; ctx.beginPath(); if (e.aire) { ctx.moveTo(x, y - r - 2); ctx.lineTo(x + r + 2, y + r); ctx.lineTo(x - r - 2, y + r); ctx.closePath(); } else ctx.arc(x, y, r + 2, 0, 6.3); ctx.fill(); ctx.fillStyle = e.lento > 0 ? '#9fe7ff' : d.col; ctx.beginPath(); if (e.aire) { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r - 1); ctx.lineTo(x - r, y + r - 1); ctx.closePath(); } else ctx.arc(x, y, r, 0, 6.3); ctx.fill(); ctx.fillStyle = '#000a'; ctx.fillRect(x - 14, y - r - 9, 28, 4); ctx.fillStyle = '#2ee59d'; ctx.fillRect(x - 14, y - r - 9, 28 * Math.max(0, e.hp / e.hpMax), 4); }
    }
    cv.addEventListener('click', (ev) => {
      if (G.fin) return;
      const r = cv.getBoundingClientRect(), x = Math.floor(((ev.clientX - r.left) / r.width) * COLS), y = Math.floor(((ev.clientY - r.top) / r.height) * FILAS);
      const ex = G.torres.find((t) => t.cx === x && t.cy === y); if (ex) { G.selT = G.selT === ex ? null : ex; return refrescar(); }
      if (G.bloq.has(x + ',' + y)) return PCB.util.toast('Eso es el camino');
      const c = costeTorre(G, G.sel); if (G.cr < c) return PCB.util.toast('No te alcanzan los ⚛');
      G.cr -= c; G.torres.push({ k: G.sel, cx: x, cy: y, cd: 0, nv: 1, flash: 0 }); G.selT = null; refrescar();
    });
    function terminar(gana) {
      G.fin = true; stopAll();
      const basePct = Math.round((G.vidas / G.vMax) * 100), aciertoPct = Math.round((S.ratio || 0) * 100), puntaje = Math.round(0.6 * aciertoPct + 0.4 * basePct);
      resultado(S, { gana, basePct, aciertoPct, puntaje, vidas: G.vidas, ola: G.ola });
    }
    pantalla(el('h1', {}, '🛡 Defiende la base'), msg, hud, el('div', { class: 'iv-campo' }, cv, panel), el('p', { class: 'iv-sub' }, 'Haz clic en una casilla libre para colocar la torre elegida; clic en una torre para mejorarla. Voladores: solo láser y radar (y el campo los frena). ' + (G.mult > 1 ? 'Frente doble: enemigos ×1,4.' : '')));
    msg.textContent = 'Coloca tus torres y lanza la primera oleada.'; refrescar();
    let last = performance.now();
    const loop = (now) => { raf = requestAnimationFrame(loop); let dt = Math.min(0.1, (now - last) / 1000); last = now; if (G.fin) return; for (let i = 0; i < (PCB.invasion._vel || G.vel); i++) if (!G.fin) paso(dt); if (!G.fin) dibujar(); };
    raf = requestAnimationFrame(loop);
    PCB.invasion._G = G;
  }

  // =====================================================================================
  // RESULTADO · Leitner · tecnologías
  // =====================================================================================
  function resultado(S, R) {
    const lineas = [];
    if (!S.practica) {
      guardar((d) => {
        let cons = 0;
        for (const capId of S.caps) {
          const e = (d.cola[capId] ||= { caja: 1, prox: hoy(), n: 0 }), pc = S.porCap[capId] || { ok: 0, n: 0 }, ratio = pc.n ? pc.ok / pc.n : 0, sc = Math.round(0.6 * ratio * 100 + 0.4 * R.basePct);
          const antes = e.caja;
          if (sc >= 85 && R.basePct >= 70) { e.caja = Math.min(5, e.caja + (sc >= 95 ? 2 : 1)); cons++; }
          else if (sc < 60 || !R.gana) e.caja = Math.max(1, e.caja - 2);
          const dias = (sc < 60 || !R.gana) ? 1 : DIAS[e.caja - 1];
          e.prox = hoy() + dias * DIA; e.n++;
          lineas.push(nombreCap(capId) + ': puntaje ' + sc + ' %  · caja ' + antes + ' → ' + e.caja + '  · próximo repaso en ' + dias + ' d');
          if (sc >= 85) d.creditos++;
          d.ultimos[capId] = S.lista.filter((x) => x.capId === capId).map((x) => x.q.id);
        }
        if (R.basePct >= 70) d.creditos++;
        d.historial.push({ t: hoy(), puntaje: R.puntaje, base: R.basePct, practica: false, caps: S.caps.length }); d.historial = d.historial.slice(-30);
        void cons;
      });
    } else guardar((d) => { d.historial.push({ t: hoy(), puntaje: R.puntaje, base: R.basePct, practica: true, caps: S.caps.length }); d.historial = d.historial.slice(-30); });
    if (R.gana) PCB.store.addXP(40 + Math.round(R.puntaje / 2), 'invasion');
    const d = datos();
    pantalla(el('h1', {}, R.gana ? '🏆 ¡Base defendida!' : '💥 La base ha caído'),
      el('div', { class: 'iv-resumen' }, el('div', {}, 'Puntaje: ', el('b', {}, R.puntaje + ' %'), '  (60 % aciertos ' + R.aciertoPct + ' % + 40 % base ' + R.basePct + ' %)'), el('div', {}, 'Vidas restantes: ', el('b', {}, R.vidas)), R.gana ? el('div', {}, 'XP: +' + (40 + Math.round(R.puntaje / 2))) : el('div', {}, 'Llegaste a la oleada ' + (R.ola + 1) + ' de 5')),
      lineas.length ? el('div', { class: 'iv-leitner' }, el('h2', {}, 'Repetición espaciada'), ...lineas.map((l) => el('div', {}, l)), el('div', {}, '⭐ Créditos de tecnología libres: ', el('b', {}, d.creditos - d.gastados))) : el('p', { class: 'iv-sub' }, 'Invasión de práctica: no cambia tus cajas.'),
      S.fallos.length ? el('div', { class: 'iv-leitner' }, el('h2', {}, 'Repasa esto (fallos de hoy)'), ...S.fallos.slice(0, 8).map((f) => { const l = el('div', { class: 'iv-fallo' }); conTex(l, '• ' + (f.q.enunciado || '').slice(0, 140)); return l; })) : null,
      el('div', { class: 'iv-acciones' }, el('button', { class: 'btn primario', on: { click: menu } }, 'Volver al menú'), el('button', { class: 'btn', on: { click: tecnologias } }, '🔬 Tecnologías'), el('button', { class: 'btn', on: { click: () => PCB.flow.volverMapa() } }, 'Mapa')));
  }

  function stopAll() { clearInterval(timer); timer = null; cancelAnimationFrame(raf); raf = 0; }

  PCB.screens.invasion = { async mount(h) { host = h; host.classList.add('iv-host'); menu(); }, unmount() { stopAll(); limpiar.forEach((f) => f()); limpiar = []; } };
  PCB.invasion = { _defensa: defensa, abrir: () => PCB.router.go('invasion', {}), datos, TORRES, ENEMIGOS, OLEADAS };
})();
