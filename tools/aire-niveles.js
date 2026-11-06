// Añade plataformas móviles y enemigos voladores (44-relieve.js → poblarAire) a contenido/niveles/*.json y se queda con el
// primer resultado que pasa el validador.   node tools/aire-niveles.js [--forzar]
const fs = require('fs'), path = require('path');
const Rel = require('../js/juego/44-relieve.js'), V = require('../js/juego/validador.js');
const base = path.join(__dirname, '..', 'contenido'), forzar = process.argv.includes('--forzar');
let ok = 0, mal = 0;
for (const f of fs.readdirSync(path.join(base, 'niveles')).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort()) {
  const p = path.join(base, 'niveles', f), nivel = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (nivel.aire && !forzar) { console.log('  =', f, '(ya tiene aire)'); continue; }
  const cap = JSON.parse(fs.readFileSync(path.join(base, 'capitulos', f), 'utf8'));
  const errores = (cap.errores_tipicos || []).filter((e) => e.nombre && e.correccion);
  let elegido = null, usado = 0;
  for (const inten of [1, 0.7, 0.45, 0.25]) {
    for (let intento = 0; intento < 8 && !elegido; intento++) {
      const cand = Rel.poblarAire(nivel, { seed: nivel.capitulo_id + '#' + intento, intensidad: inten, errores, ambiente: nivel.ambiente });
      if (V.validar(cand).ok) { elegido = cand; usado = inten; }
    }
    if (elegido) break;
  }
  if (elegido) {
    fs.writeFileSync(p, JSON.stringify(elegido, null, 1)); ok++;
    const n = nivel.segmentos.length, m = elegido.segmentos.slice(n);
    console.log('  ✔', f.padEnd(28), 'intensidad', usado, '| móviles', m.filter((s) => s.tipo === 'plataforma_movil').length, '| voladores', m.filter((s) => s.tipo === 'bicho').length);
  } else { mal++; const r = V.validar(Rel.poblarAire(nivel, { seed: nivel.capitulo_id + '#0', intensidad: 0.25, errores, ambiente: nivel.ambiente })); console.log('  ✖', f, 'ningún intento pasó:', (r.errores || []).slice(0, 2).join(' / ')); }
}
console.log(`\naire añadido: ${ok} · sin cambios por fallo: ${mal}`);
