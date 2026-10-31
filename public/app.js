const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sessionId = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);
const HEAD = { 'Content-Type': 'application/json' };

let spirits = [], cur = null, history = [], busy = false, ctrl = null;
let image = null, vision = true, council = false, picked = [];

/* ---------- Web Audio Ambient Synthesizer ---------- */
let audioCtx = null, droneOsc = null, droneGain = null, audioEnabled = false;

function initAudio() {
  if (audioCtx) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  } catch {}
}

function toggleAudio() {
  initAudio();
  audioEnabled = !audioEnabled;
  const btn = $('#audio-toggle');
  if (btn) {
    btn.setAttribute('aria-pressed', String(audioEnabled));
    btn.textContent = audioEnabled ? '🕯️ Audio: On' : '🕯️ Audio: Off';
    btn.classList.toggle('active', audioEnabled);
  }
  if (audioCtx && audioCtx.state === 'suspended' && audioEnabled) {
    audioCtx.resume();
  }
  if (audioEnabled) {
    startDrone();
    playChime(440);
  } else {
    stopDrone();
  }
}

function startDrone() {
  if (!audioCtx || !audioEnabled || droneOsc) return;
  try {
    droneOsc = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    droneGain = audioCtx.createGain();

    droneOsc.type = 'triangle';
    droneOsc.frequency.setValueAtTime(55, audioCtx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, audioCtx.currentTime);

    droneGain.gain.setValueAtTime(0.01, audioCtx.currentTime);
    droneGain.gain.exponentialRampToValueAtTime(0.06, audioCtx.currentTime + 2);

    droneOsc.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(audioCtx.destination);
    droneOsc.start();
  } catch {}
}

function stopDrone() {
  if (droneOsc && audioCtx) {
    try {
      droneGain?.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      setTimeout(() => {
        droneOsc?.stop();
        droneOsc = null;
        droneGain = null;
      }, 450);
    } catch {
      droneOsc = null;
      droneGain = null;
    }
  }
}

function playChime(freq = 520) {
  if (!audioCtx || !audioEnabled) return;
  try {
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.98, t + 1.2);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 1.25);
  } catch {}
}

function playTick() {
  if (!audioCtx || !audioEnabled) return;
  try {
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(700 + Math.random() * 300, t);
    gain.gain.setValueAtTime(0.02, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  } catch {}
}

function setEvp(active) {
  const el = $('#evp-meter');
  if (el) el.classList.toggle('active', active);
}

function toggleCrt() {
  const isPhosphor = document.body.classList.toggle('phosphor');
  const btn = $('#crt-toggle');
  if (btn) btn.textContent = isPhosphor ? '⚡ Glow: Phosphor' : '⚡ Glow: Amber';
}

/* ---------- ritual summons quick prompts ---------- */
const RITUAL_PROMPTS = {
  cobol: [
    'Explain the Y2K crisis',
    'Why do financial systems still rely on you?',
    'Show a classic COBOL loop'
  ],
  perl: [
    'Write a cursed regex one-liner',
    'Why did developers say you were write-only?',
    'Explain TIMTOWTDI'
  ],
  flash: [
    'Why did Steve Jobs banish you from iOS?',
    'What made ActionScript animations so special?',
    'Tell me about the Golden Age of Newgrounds'
  ],
  vb6: [
    'Explain "On Error Resume Next"',
    'What was DLL Hell?',
    'Why did visual forms feel like magic?'
  ],
  ie6: [
    'Explain the dreaded box model bug',
    'Why did CSS layout take so long to standardize?',
    'What was it like holding 95% market share?'
  ],
  python2: [
    'Why was the Python 3 migration so painful?',
    'Explain print statement vs print function',
    'What was your finest feature?'
  ],
  fortran: [
    'Explain punch card column syntax (1-80)',
    'Why are supercomputers still running Fortran?',
    'Compare numerical speed with modern C++'
  ]
};

function renderPrompts(spiritId) {
  const bar = $('#prompts-bar');
  const list = $('#prompts-list');
  if (!bar || !list) return;
  const prompts = RITUAL_PROMPTS[spiritId] || [];
  list.innerHTML = '';
  if (!prompts.length || council) {
    bar.hidden = true;
    return;
  }
  prompts.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'prompt-pill';
    btn.textContent = p;
    btn.onclick = () => {
      $('#input').value = p;
      playChime(600);
      ask({ mode: 'chat', message: p }, p);
    };
    list.appendChild(btn);
  });
  bar.hidden = false;
}

/* ---------- boot, badges, stats ---------- */
async function boot() {
  spirits = await (await fetch('/api/spirits')).json();
  const box = $('#spirits');
  spirits.forEach(s => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'spirit'; b.dataset.id = s.id; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<strong></strong><span></span><em></em>';
    b.children[0].textContent = s.name; b.children[1].textContent = s.years; b.children[2].textContent = s.epitaph;
    b.onclick = () => (council ? pick(s.id) : summon(s.id));
    box.appendChild(b);
  });
  $('#audio-toggle')?.addEventListener('click', toggleAudio);
  $('#crt-toggle')?.addEventListener('click', toggleCrt);
  health(); stats();
  setInterval(health, 15000); setInterval(stats, 30000);
}

async function health() {
  try {
    const h = await (await fetch('/api/health')).json(), d = h.db || {};
    vision = !!h.vision;
    $('#file').disabled = !vision; $('#attach-label').title = vision ? '' : 'Needs gemma3:4b or larger';
    $('#badges').innerHTML = '';
    if (!h.ollama) {
      badge(`Gemma: ${h.model}`, false, 'offline');
    } else if (h.modelReady === false) {
      badge(`Gemma: ${h.model}`, false, 'the spirits are still waking (model downloading)', 'waking');
    } else {
      badge(`Gemma: ${h.model}`, true, 'online');
    }
    badge('TigerData: ' + (d.ready ? ['pgvector', d.timescale ? 'timescale' : null].filter(Boolean).join(' + ') : 'memory off'), d.ready, d.ready ? 'connected' : 'not connected');
    badge('Vision', vision, vision ? 'screenshots on' : 'needs gemma3:4b+');
    badge('Tools', !h.toolsOff, h.toolsOff ? 'tools off' : 'tools on');
  } catch { $('#badges').textContent = 'Server unreachable.'; }
}
function badge(text, on, state, extraClass = '') {
  const el = document.createElement('span');
  el.className = 'badge' + (on ? ' on' : '') + (extraClass ? ' ' + extraClass : '');
  el.innerHTML = '<i></i>'; el.append(`${text} (${state})`);
  $('#badges').appendChild(el);
}

async function stats() {
  const bars = $('#bars'), list = $('#by-spirit');
  try {
    const s = await (await fetch('/api/stats')).json();
    bars.innerHTML = ''; list.innerHTML = '';
    if (s.offline || !s.hourly?.length) {
      bars.innerHTML = '<div class="empty">' + (s.offline ? 'Connect TigerData to see the graveyard.' : 'No hauntings yet. Summon a spirit.') + '</div>';
      return;
    }
    const max = Math.max(...s.hourly.map(h => h.summons));
    s.hourly.forEach(h => {
      const d = document.createElement('div');
      d.style.height = Math.max(6, (h.summons / max) * 100) + '%';
      d.title = `${new Date(h.bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${h.summons}`;
      bars.appendChild(d);
    });
    const add = (label, text) => { const li = document.createElement('li'); li.innerHTML = '<b></b>'; li.firstChild.textContent = label; li.append(' ' + text); list.appendChild(li); };
    s.bySpirit.forEach(r => add(r.spirit, `${r.summons} summons, ${r.avg_ms ?? 0} ms avg`));
    (s.kinds || []).forEach(k => add(k.kind, `${k.n} this week`));
    if (s.p95 != null) add('p95 latency', `${s.p95} ms`);
    add('echoes', `${s.memories} remembered`);
  } catch { /* ignore */ }
}

/* ---------- rendering ---------- */
function render(el, text) {
  el.textContent = '';
  text.split('```').forEach((part, i) => {
    if (i % 2) {
      const pre = document.createElement('pre'), code = document.createElement('code');
      code.textContent = part.replace(/^[\w+#.-]*\n/, ''); pre.appendChild(code); el.appendChild(pre);
    } else if (part) el.appendChild(document.createTextNode(part));
  });
}
function addMsg(role, text = '', who = '') {
  const el = document.createElement('div');
  el.className = 'msg ' + role; if (who) el.dataset.who = who;
  if (text) render(el, text);
  $('#log').appendChild(el); el.scrollIntoView({ block: 'end' });
  return el;
}
function speak(text, queue = false) {
  if (!$('#voice').checked || !('speechSynthesis' in window)) return;
  const clean = text.replace(/```[\s\S]*?```/g, ' ').trim();
  if (!clean) return;
  if (!queue) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean); u.pitch = 0.5; u.rate = 0.88;
  speechSynthesis.speak(u);
}
async function readNdjson(r, onEvent) {
  if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).error || 'The veil is silent.');
  const rd = r.body.getReader(), dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
}
const lock = on => { busy = on; $('#send').disabled = on; };

/* ---------- single spirit ---------- */
async function ask(payload, userText) {
  lock(true);
  setEvp(true);
  const el = addMsg('ghost'); el.classList.add('typing');
  let full = '', meta = null;
  ctrl = new AbortController();
  try {
    const r = await fetch('/api/seance', { method: 'POST', headers: HEAD, signal: ctrl.signal,
      body: JSON.stringify({ ...payload, spirit: cur.id, sessionId, priv: $('#priv').checked, history }) });
    await readNdjson(r, j => {
      if (j.meta) meta = j.meta;
      if (j.tool) {
        playChime(560);
        const line = document.createElement('div');
        line.className = 'meta tool-line';
        let desc = 'the spirit consults the grimoire...';
        if (j.tool.name === 'run_snippet') desc = 'the spirit executes code in the void...';
        else if (j.tool.name === 'compare_eras') desc = 'the spirit compares across eras...';
        line.textContent = desc;
        $('#log').insertBefore(line, el);
        line.scrollIntoView({ block: 'end' });
      }
      if (j.toolResult) {
        playChime(620);
        const line = document.createElement('div');
        line.className = 'meta tool-line';
        line.textContent = `the spirit learned: ${j.toolResult.summary}`;
        $('#log').insertBefore(line, el);
        line.scrollIntoView({ block: 'end' });
      }
      if (j.t) {
        playTick();
        full += j.t;
        render(el, full);
        el.scrollIntoView({ block: 'end' });
      }
      if (j.err) throw new Error(j.err);
    });
    if (userText) history.push({ role: 'user', content: userText });
    history.push({ role: 'assistant', content: full });
    if (meta && (meta.grimoire || meta.echoes)) {
      const m = document.createElement('div'); m.className = 'meta';
      m.textContent = `consulted ${meta.grimoire} grimoire ${meta.grimoire === 1 ? 'entry' : 'entries'}, ${meta.echoes} ${meta.echoes === 1 ? 'echo' : 'echoes'} from ${meta.model}`;
      $('#log').appendChild(m);
    }
    speak(full);
  } catch (e) {
    if (e.name !== 'AbortError') {
      const msg = /waking/i.test(e.message)
        ? 'The spirits are still waking (model downloading). Please wait a moment.'
        : e.message;
      el.textContent = msg;
      el.classList.add('err');
    }
  } finally {
    setEvp(false);
    el.classList.remove('typing');
    lock(false);
    ctrl = null;
    setTimeout(stats, 800);
  }
}

async function summon(id) {
  if (busy && ctrl) ctrl.abort();
  speechSynthesis?.cancel?.();
  playChime(440);
  cur = spirits.find(s => s.id === id); history = [];
  document.querySelectorAll('.spirit').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  renderPrompts(id);
  openChat(cur.name, cur.epitaph, false);
  $('#summon-text').textContent = `Summoning ${cur.name}...`; $('#summon').hidden = false;
  await sleep(reduce ? 0 : 1800);
  $('#summon').hidden = true;
  await ask({ mode: 'greet', message: '' });
  $('#input').focus();
}
function openChat(title, sub, isCouncil) {
  $('#log').innerHTML = ''; $('#chat').classList.remove('out'); $('#chat').hidden = false;
  $('#s-name').textContent = title; $('#s-epitaph').textContent = sub;
  $('#mode').disabled = isCouncil; if (isCouncil) $('#mode').value = 'chat';
  $('#file').disabled = isCouncil || !vision; clearImage();
  $('#input').placeholder = isCouncil ? 'Pose a question to the council' : 'Ask the spirit a question';
  $('#chat').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/* ---------- council ---------- */
function setCouncil(on) {
  council = on; picked = [];
  const pBar = $('#prompts-bar');
  if (pBar) pBar.hidden = true;
  $('#council-toggle').textContent = on ? 'Cancel council' : 'Convene a council';
  $('#council-hint').hidden = !on; $('#council-go').hidden = true;
  document.querySelectorAll('.spirit').forEach(b => b.setAttribute('aria-pressed', 'false'));
}
function pick(id) {
  const i = picked.indexOf(id);
  if (i >= 0) picked.splice(i, 1); else if (picked.length < 3) picked.push(id);
  document.querySelectorAll('.spirit').forEach(b => b.setAttribute('aria-pressed', String(picked.includes(b.dataset.id))));
  $('#council-go').hidden = picked.length < 2;
  $('#council-hint').textContent = picked.length < 2 ? 'Pick two or three spirits.' : `${picked.length} chosen. Begin when ready.`;
}
$('#council-toggle').onclick = () => setCouncil(!council);
$('#council-go').onclick = () => {
  if (picked.length < 2) return;
  speechSynthesis?.cancel?.();
  cur = { id: 'council', name: 'The Council', ids: [...picked] };
  history = [];
  const names = picked.map(id => spirits.find(s => s.id === id).name);
  openChat('The Council', names.join(', '), true);
  addMsg('ghost', 'The candles gutter. Pose your question and the council will answer in turn.', 'The Council');
  $('#input').focus();
};

async function askCouncil(text) {
  lock(true);
  let el = null, full = '';
  ctrl = new AbortController();
  try {
    const r = await fetch('/api/council', { method: 'POST', headers: HEAD, signal: ctrl.signal,
      body: JSON.stringify({ spirits: cur.ids, message: text, sessionId, priv: $('#priv').checked }) });
    await readNdjson(r, j => {
      if (j.speaker) {
        if (el) { el.classList.remove('typing'); speak(full, true); }
        full = ''; el = addMsg('ghost', '', j.speaker.name); el.classList.add('typing');
      }
      if (j.t && el) { full += j.t; render(el, full); el.scrollIntoView({ block: 'end' }); }
      if (j.err) throw new Error(j.err);
    });
    if (el) { el.classList.remove('typing'); speak(full, true); }
  } catch (e) {
    if (e.name !== 'AbortError') { const x = el || addMsg('ghost'); x.textContent = e.message; x.classList.add('err'); x.classList.remove('typing'); }
  } finally { lock(false); ctrl = null; setTimeout(stats, 800); }
}

/* ---------- input ---------- */
$('#form').addEventListener('submit', async e => {
  e.preventDefault();
  const text = $('#input').value.trim();
  if ((!text && !image) || busy || !cur) return;
  const mode = $('#mode').value;
  const you = addMsg('you', text);
  if (image) { const im = document.createElement('img'); im.src = image; im.alt = 'Attached screenshot'; you.prepend(im); }
  $('#input').value = '';
  if (cur.id === 'council') return askCouncil(text);
  const img = image; clearImage();
  const note = mode === 'chat' ? text : `[Visitor submitted code for ${mode}]`;
  await ask({ mode, message: text, image: img }, img && !text ? '[Visitor showed a screenshot]' : note);
});
$('#input').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) $('#form').requestSubmit(); });
$('#mode').addEventListener('change', e => {
  $('#input').placeholder = { chat: 'Ask the spirit a question', review: 'Paste code for the spirit to judge', exorcise: 'Paste legacy code to modernize' }[e.target.value];
});

function clearImage() { image = null; $('#file').value = ''; $('#attached').hidden = true; }
$('#file').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const bmp = await createImageBitmap(f), k = Math.min(1, 896 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    image = c.toDataURL('image/jpeg', 0.85);
    $('#attached').hidden = false; $('#attached').textContent = `Screenshot attached (${Math.round(image.length / 1024)} KB)`;
  } catch { clearImage(); alert('That file could not be read as an image.'); }
});

/* ---------- save + banish ---------- */
$('#save').addEventListener('click', () => {
  if (!cur) return;
  const lines = [...document.querySelectorAll('#log .msg')].map(m => `**${m.classList.contains('you') ? 'You' : (m.dataset.who || cur.name)}:** ${m.innerText.trim()}`);
  const blob = new Blob([`# Séance with ${cur.name}\n\n${lines.join('\n\n')}\n`], { type: 'text/markdown' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `seance-${cur.name.toLowerCase().replace(/\W+/g, '-')}.md`; a.click(); URL.revokeObjectURL(a.href);
});

$('#banish').addEventListener('click', async () => {
  if (!cur) return;
  if (busy && ctrl) { ctrl.abort(); await sleep(150); }
  speechSynthesis?.cancel?.();
  if (cur.id !== 'council') { await ask({ mode: 'farewell', message: '' }); await sleep(reduce ? 300 : 1200); }
  $('#chat').classList.add('out');
  await sleep(reduce ? 0 : 1600);
  $('#chat').hidden = true; cur = null; history = []; setCouncil(false);
});

boot();
