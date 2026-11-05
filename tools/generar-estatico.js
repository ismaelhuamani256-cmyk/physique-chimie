// Genera la versión "doble clic" de la app (sin servidor):
//   1) contenido/bundle.js  -> todo contenido/*.json empaquetado en window.PCB_CONTENIDO
//   2) index.html           -> con todos los <link> y <script> escritos a mano (sin /api/scripts)
// Se ejecuta con:  node tools/generar-estatico.js     (solo hace falta si cambias contenido/ o añades archivos js/css)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const leer = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

// 1) bundle de contenido (se ignoran los niveles de prueba que empiezan por _)
const B = { indice: leer('contenido/indice.json'), capitulos: {}, niveles: {}, intros: {}, quizzes: {} };
for (const k of Object.keys(B).filter((x) => x !== 'indice')) {
  const d = path.join(ROOT, 'contenido', k);
  for (const f of fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort()) B[k][f.slice(0, -5)] = leer(`contenido/${k}/${f}`);
}
fs.writeFileSync(path.join(ROOT, 'contenido', 'bundle.js'),
  '// Generado por tools/generar-estatico.js — NO editar a mano.\nwindow.PCB_CONTENIDO = ' + JSON.stringify(B) + ';\n');

// 2) lista ordenada de scripts (misma regla que server.js): core, anim-core, js/<carpeta>/* alfabético, js/*.js sueltos
const js = path.join(ROOT, 'js'), out = ['js/core.js', 'js/anim-core.js'];
const walk = (dir, rel) => fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((e) => {
  const r = rel + '/' + e.name;
  if (e.isDirectory()) walk(path.join(dir, e.name), r); else if (e.name.endsWith('.js') && !out.includes(r)) out.push(r);
});
fs.readdirSync(js, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort().forEach((d) => walk(path.join(js, d), 'js/' + d));
fs.readdirSync(js).filter((f) => f.endsWith('.js')).sort().forEach((f) => { if (!out.includes('js/' + f) && f !== 'loader.js') out.push('js/' + f); });
const css = fs.readdirSync(path.join(ROOT, 'css')).filter((f) => f.endsWith('.css')).sort((a, b) => (a === 'base.css' ? -1 : b === 'base.css' ? 1 : a.localeCompare(b))).map((f) => 'css/' + f);

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Super Claude Bros · Physique-Chimie</title>
<link rel="stylesheet" href="lib/katex/katex.min.css">
${css.map((h) => `<link rel="stylesheet" href="${h}">`).join('\n')}
</head>
<body>
<div id="topbar"></div>
<div id="app"></div>
<div id="overlay"></div>
<script src="lib/three/three.min.js"></script>
<script src="lib/katex/katex.min.js"></script>
<script src="contenido/bundle.js"></script>
${out.map((s) => `<script src="${s}"></script>`).join('\n')}
<script>window.PCB && PCB.boot && PCB.boot();</script>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'index.html'), html);

// 3) carpeta docs/ = lo único que se publica en GitHub Pages (app + contenido empaquetado; SIN los PDF de cours/ ni data/)
const copiar = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); };
const copiarDir = (d) => { const src = path.join(ROOT, d); (function r(x, rel) { fs.readdirSync(x, { withFileTypes: true }).forEach((e) => {
  const rr = path.join(rel, e.name); if (e.isDirectory()) r(path.join(x, e.name), rr); else copiar(path.join(x, e.name), path.join(ROOT, 'docs', rr)); }); })(src, d); };
fs.rmSync(path.join(ROOT, 'docs'), { recursive: true, force: true });
['css', 'js', 'lib'].forEach(copiarDir);
copiar(path.join(ROOT, 'index.html'), path.join(ROOT, 'docs', 'index.html'));
copiar(path.join(ROOT, 'contenido', 'bundle.js'), path.join(ROOT, 'docs', 'contenido', 'bundle.js'));
fs.writeFileSync(path.join(ROOT, 'docs', '.nojekyll'), '');
console.log(`bundle: ${(fs.statSync(path.join(ROOT, 'contenido', 'bundle.js')).size / 1e6).toFixed(2)} MB · ${out.length} scripts · ${css.length} css`);
