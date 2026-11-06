// =====================================================================================
// 30-audio.js — chiptune ORIGINAL con WebAudio (música de bucle por tema + efectos)
//   · El AudioContext solo se crea tras la primera interacción (activar()).
//   · Respeta PCB.settings.musica / PCB.settings.sfx en cada nota/efecto.
//   · cerrar() libera todo (se llama desde unmount).
// Las melodías y efectos son composiciones propias, sin relación con ninguna franquicia.
// =====================================================================================
(function () {
  const J = window.PCB.juego;
  const A = (J.Audio = {});
  let ctx = null, master = null, gMus = null, gSfx = null, timer = null, ruido = null, lp = null, enAgua = false;
  let tema = 'base', paso = 0, proximo = 0, vuelta = 0;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const ajustes = () => (window.PCB.settings || {});

  // Cada tema: tempo (bpm, corcheas), tónica MIDI, melodía de 32 pasos (semitonos sobre la tónica; null = silencio),
  // fundamentales del bajo por compás (8 pasos) y timbres.
  const MUSICAS = {
    lab: { bpm: 138, root: 60, onda: 'square', vol: 0.05, lead: [0, 3, 7, 3, 10, 7, 3, null, 0, 3, 7, 12, 10, 7, 3, null, 5, 8, 12, 8, 10, 8, 5, null, 3, 7, 10, 7, 3, 0, null, null], bajo: [0, 0, 5, 7], arp: [0, 0, 7, 0, 12, 7, 0, 7] },
    lava: { bpm: 92, root: 50, onda: 'sawtooth', vol: 0.04, lead: [0, null, 3, null, 7, null, 5, 3, 0, null, -2, null, 3, null, 2, 0, 0, null, 3, null, 7, null, 10, 8, 7, null, 5, null, 3, 2, 0, null], bajo: [0, -2, -4, -5], arp: [0, null, 0, null, 7, null, 0, 3] },
    cielo: { bpm: 112, root: 64, onda: 'triangle', vol: 0.09, lead: [0, 4, 7, 12, 9, 7, 4, null, 2, 5, 9, 14, 12, 9, 5, null, 4, 7, 11, 16, 14, 11, 7, null, 9, 12, 9, 7, 4, 2, 0, null], bajo: [0, -3, -5, -7], arp: [0, 7, 12, 7, 4, 7, 12, 16] },
    agua: { bpm: 84, root: 57, onda: 'sine', vol: 0.11, lead: [0, null, 4, null, 7, null, 4, null, 2, null, 5, null, 9, null, 5, null, 0, null, 4, null, 7, null, 12, null, 9, null, 7, null, 4, null, 2, null], bajo: [0, -3, -5, -7], arp: [0, null, 7, null, 12, null, 7, null] },
    base: { bpm: 120, root: 57, onda: 'square', vol: 0.05, lead: [0, 2, 4, 7, 4, 2, 0, null, 5, 4, 2, 4, 2, 0, null, null, 7, 9, 12, 9, 7, 4, 7, null, 4, 2, 0, 2, 4, 2, 0, null], bajo: [0, 5, 7, 0], arp: [0, 0, 7, 0, 4, 4, 7, 4] },
  };

  /** Llamar tras un gesto del usuario (tecla, clic, toque). */
  A.activar = function () {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        // master -> filtro paso-bajo (sonido amortiguado bajo el agua) -> salida
        lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.7; lp.connect(ctx.destination);
        master = ctx.createGain(); master.gain.value = 0.55; master.connect(lp);
        gMus = ctx.createGain(); gMus.gain.value = 1; gMus.connect(master);
        gSfx = ctx.createGain(); gSfx.gain.value = 1; gSfx.connect(master);
        // buffer de ruido blanco reutilizable
        ruido = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
        const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        proximo = ctx.currentTime + 0.1;
        timer = setInterval(planificar, 90);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* sin audio: el juego sigue */ }
  };
  A.listo = () => !!ctx;

  A.musica = function (nombreMusica) {
    tema = MUSICAS[nombreMusica] ? nombreMusica : 'base'; paso = 0; vuelta = 0;
    if (ctx) proximo = ctx.currentTime + 0.1;
  };
  /** Bajo el agua el sonido se amortigua (paso-bajo). */
  A.agua = function (b) {
    if (!ctx || !lp || b === enAgua) return;
    enAgua = b;
    lp.frequency.setTargetAtTime(b ? 650 : 20000, ctx.currentTime, 0.06);
  };
  A.pausarMusica = function (p) { if (gMus) gMus.gain.value = p ? 0.35 : 1; };

  A.cerrar = function () {
    clearInterval(timer); timer = null;
    try { if (ctx) ctx.close(); } catch (e) {}
    ctx = master = gMus = gSfx = ruido = lp = null; enAgua = false;
  };

  // ---------- síntesis ----------
  function nota(destino, f, t0, dur, onda, vol, desliza) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = onda; o.frequency.setValueAtTime(f, t0);
    if (desliza) o.frequency.exponentialRampToValueAtTime(Math.max(20, desliza), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(destino); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function golpeRuido(destino, t0, dur, vol, fc) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = ruido; f.type = 'bandpass'; f.frequency.value = fc || 3000;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(destino); s.start(t0); s.stop(t0 + dur + 0.02);
  }

  // ---------- música: planificador con antelación ----------
  function planificar() {
    if (!ctx) return;
    const m = MUSICAS[tema], dur = 60 / m.bpm / 2;
    while (proximo < ctx.currentTime + 0.35) {
      if (ajustes().musica) {
        const i = paso % 32, compas = Math.floor(paso / 8) % 4;
        const trans = vuelta % 2 ? 5 : 0;   // en la vuelta impar se transporta para dar variedad
        const l = m.lead[i];
        if (l != null) nota(gMus, mtof(m.root + 12 + l + trans), proximo, dur * 0.9, m.onda, m.vol);
        const b = m.arp[paso % 8];
        if (b != null) nota(gMus, mtof(m.root - 12 + m.bajo[compas] + b), proximo, dur * 0.8, 'triangle', 0.08);
        if (paso % 2 === 1) golpeRuido(gMus, proximo, 0.04, 0.025, 7000);
        if (paso % 8 === 0 || paso % 8 === 4) nota(gMus, 70, proximo, 0.12, 'sine', 0.12, 38);
      }
      proximo += dur; paso++;
      if (paso % 32 === 0) vuelta++;
    }
  }

  // ---------- efectos ----------
  const SFX = {
    salto: (t) => nota(gSfx, 320, t, 0.16, 'square', 0.09, 760),
    moneda: (t) => { nota(gSfx, 988, t, 0.07, 'square', 0.08); nota(gSfx, 1319, t + 0.07, 0.16, 'square', 0.08); },
    pisoton: (t) => { golpeRuido(gSfx, t, 0.08, 0.15, 900); nota(gSfx, 260, t, 0.12, 'square', 0.1, 90); },
    golpe: (t) => { golpeRuido(gSfx, t, 0.22, 0.2, 500); nota(gSfx, 200, t, 0.2, 'sawtooth', 0.1, 60); },
    muerte: (t) => { [0, 1, 2, 3, 4].forEach((i) => nota(gSfx, 520 - i * 70, t + i * 0.1, 0.14, 'square', 0.09)); nota(gSfx, 200, t + 0.5, 0.5, 'sawtooth', 0.08, 40); },
    victoria: (t) => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => nota(gSfx, f, t + i * 0.12, i > 4 ? 0.5 : 0.14, 'square', 0.08)); },
    derrota: (t) => { [392, 349, 311, 262].forEach((f, i) => nota(gSfx, f, t + i * 0.22, 0.3, 'triangle', 0.14)); },
    resorte: (t) => nota(gSfx, 180, t, 0.3, 'square', 0.09, 900),
    checkpoint: (t) => { nota(gSfx, 659, t, 0.1, 'triangle', 0.14); nota(gSfx, 880, t + 0.1, 0.25, 'triangle', 0.14); },
    palanca: (t) => { golpeRuido(gSfx, t, 0.1, 0.25, 400); nota(gSfx, 110, t, 0.3, 'square', 0.12, 55); nota(gSfx, 90, t + 0.25, 0.6, 'sawtooth', 0.08, 30); },
    acierto: (t) => { [523, 659, 784].forEach((f, i) => nota(gSfx, f, t + i * 0.08, 0.2, 'square', 0.08)); },
    fallo: (t) => { nota(gSfx, 150, t, 0.35, 'sawtooth', 0.1, 70); nota(gSfx, 140, t, 0.35, 'square', 0.06, 65); },
    fuego: (t) => { golpeRuido(gSfx, t, 0.25, 0.14, 1800); nota(gSfx, 500, t, 0.25, 'sawtooth', 0.05, 120); },
    onda: (t) => { golpeRuido(gSfx, t, 0.35, 0.25, 250); nota(gSfx, 80, t, 0.35, 'sine', 0.25, 30); },
    aviso: (t) => nota(gSfx, 740, t, 0.08, 'square', 0.05),
    explosion: (t) => { golpeRuido(gSfx, t, 0.45, 0.35, 700); nota(gSfx, 120, t, 0.4, 'sawtooth', 0.14, 35); nota(gSfx, 70, t, 0.5, 'square', 0.1, 30); },
    atomo: (t) => { nota(gSfx, 880, t, 0.06, 'sine', 0.1); nota(gSfx, 1320, t + 0.05, 0.12, 'sine', 0.09); },
    estacion: (t) => { [523, 659, 784, 1047, 1319].forEach((f, i) => nota(gSfx, f, t + i * 0.09, 0.25, 'triangle', 0.1)); },
    interruptor: (t) => { nota(gSfx, 180, t, 0.07, 'square', 0.1); nota(gSfx, 360, t + 0.07, 0.1, 'square', 0.08); },
    prensa: (t) => { golpeRuido(gSfx, t, 0.18, 0.28, 300); nota(gSfx, 70, t, 0.2, 'square', 0.16, 40); },
    sprint: (t) => { [330, 330, 440, 660].forEach((f, i) => nota(gSfx, f, t + i * 0.12, 0.15, 'square', 0.08)); },
    romper: (t) => { golpeRuido(gSfx, t, 0.22, 0.2, 2600); nota(gSfx, 520, t, 0.1, 'square', 0.06, 160); },
    mordisco: (t) => { golpeRuido(gSfx, t, 0.07, 0.2, 2200); nota(gSfx, 300, t, 0.08, 'square', 0.1, 90); nota(gSfx, 300, t + 0.1, 0.08, 'square', 0.08, 90); },
    tiembla: (t) => { nota(gSfx, 90, t, 0.35, 'sawtooth', 0.06, 70); golpeRuido(gSfx, t, 0.3, 0.05, 300); },
    tonk: (t) => { nota(gSfx, 140, t, 0.1, 'square', 0.12, 90); golpeRuido(gSfx, t, 0.05, 0.1, 1500); },
    premio: (t) => { [659, 784, 988, 1319].forEach((f, i) => nota(gSfx, f, t + i * 0.07, 0.16, 'square', 0.07)); },
    puerta: (t) => { golpeRuido(gSfx, t, 0.4, 0.12, 600); nota(gSfx, 200, t, 0.5, 'sawtooth', 0.06, 700); nota(gSfx, 880, t + 0.3, 0.3, 'triangle', 0.1); },
    tubo: (t) => { nota(gSfx, 600, t, 0.5, 'square', 0.07, 120); golpeRuido(gSfx, t, 0.3, 0.08, 400); },
    teletransporte: (t) => { nota(gSfx, 300, t, 0.3, 'triangle', 0.12, 1400); nota(gSfx, 1400, t + 0.3, 0.2, 'sine', 0.08, 500); },
    splash: (t) => { golpeRuido(gSfx, t, 0.25, 0.18, 1200); nota(gSfx, 300, t, 0.15, 'sine', 0.1, 120); },
    nadar: (t) => { golpeRuido(gSfx, t, 0.12, 0.06, 700); nota(gSfx, 220, t, 0.14, 'sine', 0.06, 440); },
    menu: (t) => nota(gSfx, 600, t, 0.05, 'square', 0.05),
  };
  A.sfx = function (nombre) {
    if (!ctx || ajustes().sfx === false || !SFX[nombre]) return;
    try { SFX[nombre](ctx.currentTime + 0.005); } catch (e) {}
  };
  A._estado = () => ({ ctx: !!ctx, estado: ctx && ctx.state, tema, paso });
})();
