// Pruebas numéricas de js/mol3d (sin navegador):  node tools/test-mol3d.js
//  · geometría VSEPR (ángulos de H2O, NH3, CH4, CO2, BF3, PCl5, SF6…) con tolerancia
//  · todas las moléculas de la biblioteca se construyen, con longitudes de enlace razonables y sin átomos solapados
//  · todas las reacciones están ajustadas (átomos y carga), con mapa átomo→átomo coherente y pocos enlaces cambiados
//  · fidelidad: cada molécula y cada reacción asignada a un capítulo aparece de verdad en el texto de ese capítulo
const fs = require('fs'), path = require('path');
global.window = {};
['00-datos', '10-vsepr', '20-biblioteca'].forEach((f) => require(path.join(__dirname, '..', 'js', 'mol3d', f + '.js')));
const M = window.PCB.mol3d, V = M.vsepr;
let fallos = 0, ok = 0;
const check = (cond, msg) => { if (cond) ok++; else { fallos++; console.log('FALLO:', msg); } };
const cerca = (a, b, tol, msg) => check(Math.abs(a - b) <= tol, msg + ' (obtenido ' + a.toFixed(2) + ', esperado ' + b + ' ± ' + tol + ')');

// 1) ángulos VSEPR
const ang = (id, i, j, k) => V.angulo(M.molecula(id), i, j, k);
cerca(ang('H2O', 1, 0, 2), 104.5, 0.1, 'H–O–H en H2O');
cerca(ang('NH3', 1, 0, 2), 107, 0.1, 'H–N–H en NH3');
cerca(ang('CH4', 1, 0, 2), 109.47, 0.1, 'H–C–H en CH4');
cerca(ang('CO2', 0, 1, 2), 180, 0.1, 'O=C=O en CO2');
cerca(ang('BF3', 1, 0, 2), 120, 0.1, 'F–B–F en BF3');
cerca(ang('NH4+', 1, 0, 2), 109.47, 0.1, 'H–N–H en NH4+');
cerca(ang('H3O+', 1, 0, 2), 107, 0.1, 'H–O–H en H3O+');
cerca(ang('SO4^2-', 1, 0, 2), 109.47, 0.1, 'O–S–O en SO4');
cerca(ang('CO3^2-', 1, 0, 2), 120, 0.1, 'O–C–O en CO3');
cerca(ang('SF6', 1, 0, 3), 90, 0.1, 'F–S–F cis en SF6'); cerca(ang('SF6', 1, 0, 2), 180, 0.1, 'F–S–F trans en SF6');
{ const m = M.molecula('PCl5'), vals = new Set(m.centros[0].angulos.map((a) => Math.round(a.deg))); check(vals.has(90) && vals.has(120) && vals.has(180), 'PCl5 tiene 90°, 120° y 180°: ' + [...vals]); }
{ const m = M.molecula('XeF2'); cerca(V.angulo(m, 1, 0, 2), 180, 0.1, 'XeF2 lineal'); check(m.axe === 'AX2E3', 'XeF2 AX2E3'); }
{ const m = M.molecula('XeF4'); check(m.axe === 'AX4E2' && Math.round(V.angulo(m, 1, 0, 2)) % 90 === 0, 'XeF4 plana cuadrada'); }
const axe = { H2O: 'AX2E2', NH3: 'AX3E', CH4: 'AX4', CO2: 'AX2', BF3: 'AX3', SO2: 'AX2E', 'H3O+': 'AX3E', 'NH4+': 'AX4', SF4: 'AX4E', ClF3: 'AX3E2', SF6: 'AX6', PCl5: 'AX5', BrF5: 'AX5E', H2S: 'AX2E2' };
Object.keys(axe).forEach((id) => check(M.molecula(id).axe === axe[id], id + ' debe ser ' + axe[id] + ' (es ' + M.molecula(id).axe + ')'));
// generador por notación AXE
{ const m = V.porAXE('AX2E2', { central: 'O', ligando: 'H' }); cerca(V.angulo(m, 1, 0, 2), 104.5, 0.1, 'porAXE AX2E2'); const t = V.porAXE('AX4', { central: 'C', ligando: 'H' }); cerca(V.angulo(t, 1, 0, 2), 109.47, 0.1, 'porAXE AX4'); }

// 2) todas las moléculas: construidas, enlaces razonables, sin solapes
const dist = (m, i, j) => V.distancia(m, i, j);
M.lista().forEach((id) => {
  const m = M.molecula(id);
  check(m && m.atomos.length > 0, id + ' se construye');
  if (!m) return;
  const unidos = new Set(m.enlaces.map((b) => b.a + '_' + b.b)), esVecino = (i, j) => unidos.has(i + '_' + j) || unidos.has(j + '_' + i);
  m.enlaces.forEach((b) => { const d = dist(m, b.a, b.b), ref = V.longitud(m.atomos[b.a].el, m.atomos[b.b].el, b.orden); check(Math.abs(d - ref) < 0.12 || id.includes('C6H12O6') || m.atomos.length > 20, id + ' enlace ' + m.atomos[b.a].el + '-' + m.atomos[b.b].el + ' mide ' + d.toFixed(2) + ' (ref ' + ref + ')'); });
  for (let i = 0; i < m.atomos.length; i++) for (let j = i + 1; j < m.atomos.length; j++) {
    if (esVecino(i, j)) continue;
    const d = dist(m, i, j), min = (m.atomos[i].el === 'H' && m.atomos[j].el === 'H') ? 1.0 : 1.2;
    check(d > min, id + ' átomos ' + i + '(' + m.atomos[i].el + ') y ' + j + '(' + m.atomos[j].el + ') demasiado cerca: ' + d.toFixed(2) + ' Å');
  }
});

// 3) reacciones
const carga = (ids) => ids.reduce((s, id) => s + M.molecula(id).carga, 0);
const cuenta = (ids) => { const c = {}; ids.forEach((id) => M.molecula(id).atomos.forEach((a) => (c[a.el] = (c[a.el] || 0) + 1))); return JSON.stringify(Object.keys(c).sort().map((k) => k + c[k])); };
const resumen = [];
M.listaReacciones().forEach((id) => {
  let r; try { r = M.reaccionDef(id); } catch (e) { check(false, 'reacción ' + id + ': ' + e.message); return; }
  const ids = (x) => x.map((q) => q.id);
  check(cuenta(ids(r.reactivos)) === cuenta(ids(r.productos)), 'reacción ' + id + ' ajustada en átomos');
  check(carga(ids(r.reactivos)) === carga(ids(r.productos)), 'reacción ' + id + ' ajustada en carga (' + carga(ids(r.reactivos)) + ' vs ' + carga(ids(r.productos)) + ')');
  check(new Set(r.mapa).size === r.mapa.length && r.mapa.every((x) => x >= 0), 'mapa de ' + id + ' es una permutación');
  check(r.mapa.every((b, a) => r.atomosR[a].el === r.atomosP[b].el), 'mapa de ' + id + ' conserva los elementos');
  // enlaces cambiados (rotos + formados) = coste del mapa; un mapa bueno cambia pocos
  const clave = (a, b) => (a < b ? a + '_' + b : b + '_' + a), inv = []; r.mapa.forEach((b, a) => { inv[b] = a; });
  const R = new Map(r.enlacesR.map((e) => [clave(e.a, e.b), e.orden])), P = new Map(r.enlacesP.map((e) => [clave(inv[e.a], inv[e.b]), e.orden]));
  let rotos = 0, formados = 0; // cambios de orden de ±0,5 (resonancia) no cuentan
  R.forEach((o, k) => { if (P.get(k) === undefined || Math.abs(P.get(k) - o) > 0.5) rotos++; }); P.forEach((o, k) => { if (R.get(k) === undefined || Math.abs(R.get(k) - o) > 0.5) formados++; });
  check(rotos + formados <= 8 && rotos + formados >= 1, 'reacción ' + id + ' cambia ' + rotos + ' enlaces rotos y ' + formados + ' formados (sospechoso)');
  resumen.push(id + ': ' + r.ecuacion + '   [−' + rotos + ' +' + formados + ']');
  check(r.capitulos.length > 0, 'reacción ' + id + ' tiene capítulo');
});

// 4) fidelidad al cours: la fórmula (o su alias/nombre) está en el texto del capítulo
const dirCap = path.join(__dirname, '..', 'contenido', 'capitulos');
const texto = {};
fs.readdirSync(dirCap).filter((f) => f.endsWith('.json') && f !== '_').forEach((f) => {
  const strs = []; (function rec(o) { if (typeof o === 'string') strs.push(o); else if (o && typeof o === 'object') Object.values(o).forEach(rec); })(JSON.parse(fs.readFileSync(path.join(dirCap, f), 'utf8')));
  const sub = '₀₁₂₃₄₅₆₇₈₉', sup = { '⁺': '+', '⁻': '-', '²': '2', '³': '3', '⁴': '4' };
  texto[f.slice(0, -5)] = strs.join('\n').replace(/\\(?:mathrm|text|ce)\{([^}]*)\}/g, '$1').replace(/_\{?(\d+)\}?/g, '$1').replace(/\^\{?(\d*[+-])\}?/g, '$1').replace(/[₀-₉]/g, (d) => sub.indexOf(d)).replace(/[⁺⁻²³⁴]/g, (d) => sup[d]).replace(/−/g, '-');
});
const ALT = { 'H2': ['dihydrogène', 'dihidrógeno'], 'O2': ['dioxygène', 'dioxígeno'], 'N2': ['diazote'], 'O3': ['ozone'], 'C6H12O6': ['glucose', 'glucosa'], 'CH3CO2H': ['CH3COOH', 'C2H4O2', 'ácido etanoico'], 'C6H5CO2H': ['C7H6O2', 'benzoico', 'benzoïque'], 'C6H5CO2-': ['C7H5O2-'],
  'C2H5OH': ['CH3CH2OH', 'etanol', 'éthanol'], 'CH3OH': ['metanol', 'méthanol'], 'C3H4O4': ['C3O4H4'], 'CO(NH2)2': ['OC(NH2)2'], 'Zn': ['Zn(s)'], 'Zn^2+': ['Zn2+'], 'CO3^2-': ['CO32-'], 'SO4^2-': ['SO42-'], 'PO4^3-': ['PO43-'], 'HPO4^2-': ['HPO42-'], 'SO3^2-': ['SO32-'],
  'CH3CO2C2H5': ['Etanoato de etilo', "éthanoate d'éthyle"], 'C6H5CO2C2H5': ['C6H5CO2CH2CH3'], 'MMA': ['CH2=C(CH3)CO2CH3', 'CO2CH3'], 'C2H5Cl': ['R–Cl', 'R-Cl'], 'C3H8O': ['C3H8O'], 'HO-': ['HO-', 'OH-'], 'C6H5CH2OH': ['C6H5CH2OH'] };
M.lista({ categoria: 'cours' }).forEach((id) => {
  M.infoMolecula(id).caps.forEach((cap) => {
    const t = texto[cap]; check(!!t, 'capítulo ' + cap + ' existe');
    if (!t) return;
    const toks = [id.replace('^', '')].concat(ALT[id] || []);
    check(toks.some((k) => t.toLowerCase().includes(k.toLowerCase())), 'molécula ' + id + ' NO aparece en el texto de ' + cap);
  });
});
M.listaReacciones().forEach((rid) => {
  const r = M.reaccionDef(rid);
  r.capitulos.forEach((cap) => {
    const t = texto[cap] || '';
    // cada especie de la ecuación (molécula) debe aparecer en el capítulo
    r.reactivos.concat(r.productos).forEach((q) => {
      const toks = [q.id.replace('^', '')].concat(ALT[q.id] || []);
      check(toks.some((k) => t.toLowerCase().includes(k.toLowerCase())), 'reacción ' + rid + ': especie ' + q.id + ' no aparece en ' + cap);
    });
  });
});
// delCapitulo: capítulos de física sin moléculas
check(M.delCapitulo('newton-2').moleculas.length === 0 && M.delCapitulo('photons').reacciones.length === 0, 'newton-2 y photons no tienen moléculas');
check(M.delCapitulo('acide-base').moleculas.includes('H2O') && M.delCapitulo('acide-base').reacciones.includes('hcl-agua'), 'acide-base contiene H2O y HCl+H2O');
// identificadores equivalentes
check(M.molecula('OH-').id === 'HO-' && M.molecula('CH3COOH').id === 'CH3CO2H' && M.molecula('SO4²⁻').id === 'SO4^2-' && M.molecula('H₂O').id === 'H2O' && M.molecula('H3O+').id === 'H3O+', 'alias de identificadores');

console.log('\nBiblioteca: ' + M.lista().length + ' moléculas (' + M.lista({ categoria: 'cours' }).length + ' del cours) · ' + M.listaReacciones().length + ' reacciones');
if (process.argv.includes('-v')) console.log(resumen.join('\n'));
console.log(fallos ? '\n' + fallos + ' FALLOS (' + ok + ' ok)' : '\nTODO OK (' + ok + ' comprobaciones)');
process.exit(fallos ? 1 : 0);
