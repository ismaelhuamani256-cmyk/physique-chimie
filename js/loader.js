// Carga ordenada de CSS y JS que lista el servidor, y arranca la app.
(async () => {
  let lista;
  try { lista = await (await fetch('/api/scripts')).json(); }
  catch (e) { document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif">Abre la app con <b>iniciar.bat</b> / <b>iniciar.command</b> (node server.js), no con doble clic en index.html.</p>'; return; }
  lista.css.forEach(h => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = h; document.head.appendChild(l); });
  for (const src of lista.js) {
    await new Promise(ok => { const s = document.createElement('script'); s.src = src + '?v=' + Date.now(); s.onload = ok; s.onerror = () => { console.error('No cargó', src); ok(); }; document.body.appendChild(s); });
  }
  window.PCB && PCB.boot && PCB.boot();
})();
