// Reparte peligros nuevos del entorno (44-relieve.js → poblarPeligros) por contenido/niveles/*.json y se queda con el primer
// resultado que pasa el validador.   node tools/peligros-niveles.js [--forzar]
const fs = require('fs'), path = require('path');
const Rel = require('../js/juego/44-relieve.js'), V = require('../js/juego/validador.js');
const base = path.join(__dirname, '..', 'contenido'), forzar = process.argv.includes('--forzar');
const HAZ = ['mina', 'prensa', 'pendulo', 'picos', 'planta_carnivora', 'estalactita', 'lluvia_rocas', 'sierra', 'torreta', 'canon_bala', 'geiser', 'laser', 'planta_techo'];
let ok = 0, mal = 0;
for (const f of fs.readdirSync(path.join(base, 'niveles')).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort()) {
  const p = path.join(base, 'niveles', f), nivel = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (nivel.peligros && !forzar) { console.log('  =', f, '(ya tiene peligros)'); continue; }
  const cap = JSON.parse(fs.readFileSync(path.join(base, 'capitulos', f), 'utf8'));
  const errores = (cap.errores_tipicos || []).filter((e) => e.nombre && e.correccion);
  const antes = nivel.segmentos.filter((s) => HAZ.includes(s.tipo)).length;
  let elegido = null, usado = 0;
  for (const inten of [1, 0.85, 0.7, 0.55, 0.4]) {
    for (let intento = 0; intento < 10 && !elegido; intento++) {
      const cand = Rel.poblarPeligros(nivel, { seed: nivel.capitulo_id + '#' + intento, intensidad: inten, errores, ambiente: nivel.ambiente });
      if (V.validar(cand).ok) { elegido = cand; usado = inten; }
    }
    if (elegido) break;
  }
  if (elegido) {
    fs.writeFileSync(p, JSON.stringify(elegido, null, 1)); ok++;
    const despues = elegido.segmentos.filter((s) => HAZ.includes(s.tipo)).length, c = {};
    elegido.segmentos.filter((s) => HAZ.includes(s.tipo)).forEach((s) => (c[s.tipo] = (c[s.tipo] || 0) + 1));
    console.log('  ✔', f.padEnd(26), `peligros ${antes} → ${despues}`, '(×' + (antes ? (despues / antes).toFixed(1) : '∞') + ')', 'int.', usado);
  } else { mal++; const r = V.validar(Rel.poblarPeligros(nivel, { seed: nivel.capitulo_id + '#0', intensidad: 0.4, errores, ambiente: nivel.ambiente })); console.log('  ✖', f, 'ningún intento pasó:', (r.errores || []).slice(0, 2).join(' / ')); }
}
console.log(`\npeligros añadidos: ${ok} · sin cambios por fallo: ${mal}`);
