const $ = s => document.querySelector(s);
let photo = null, ctrl = null, lastText = '';

$('#photo').addEventListener('change', async e => {
  const f = e.target.files[0]; photo = null;
  if (!f) return;
  try {
    const bmp = await createImageBitmap(f), k = Math.min(1, 600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    photo = c.toDataURL('image/jpeg', 0.85);
  } catch { $('#err').textContent = 'That file could not be read as an image.'; $('#err').hidden = false; }
});

const items = () => {
  const out = [];
  if ($('#foods').value.trim()) out.push('Favorite foods: ' + $('#foods').value.trim());
  if ($('#songs').value.trim()) out.push('Favorite songs: ' + $('#songs').value.trim());
  return out;
};

$('#form').addEventListener('submit', async e => {
  e.preventDefault();
  $('#err').hidden = true; $('#go').disabled = true;
  if (ctrl) ctrl.abort();
  ctrl = new AbortController();
  const name = $('#name').value.trim();
  $('#card-name').textContent = name; $('#card-rel').textContent = $('#rel').value.trim();
  $('#card-photo').hidden = !photo; if (photo) $('#card-photo').src = photo;
  $('#card-items').innerHTML = ''; items().forEach(t => { const li = document.createElement('li'); li.textContent = t; $('#card-items').appendChild(li); });
  $('#remembrance').textContent = ''; lastText = '';
  try {
    const r = await fetch('/api/ofrenda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ name, relationship: $('#rel').value, foods: $('#foods').value, songs: $('#songs').value, memory: $('#memory').value, language: $('#language').value, verse: $('#verse').checked }) });
    if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).error || 'The candle would not light.');
    $('#ofrenda').hidden = false; $('#ofrenda').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line) continue;
        const j = JSON.parse(line);
        if (j.t) { lastText += j.t; $('#remembrance').textContent = lastText; }
        if (j.err) throw new Error(j.err);
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') { $('#err').textContent = err.message; $('#err').hidden = false; }
  } finally { $('#go').disabled = false; }
});

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
$('#download').addEventListener('click', () => {
  const name = $('#name').value.trim(), rel = $('#rel').value.trim();
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ofrenda for ${esc(name)}</title>
<style>body{margin:0;background:#150a05;color:#efe6d2;font-family:Georgia,serif;display:grid;place-items:center;min-height:100vh;padding:24px}
.c{max-width:560px;border:3px solid #ff9f1c;border-radius:14px;padding:28px;background:#1c0f08;text-align:center;box-shadow:0 0 30px rgba(255,159,28,.3)}
.k{width:12px;height:34px;margin:0 auto 14px;border-radius:6px 6px 2px 2px;background:linear-gradient(#fff3c4,#ff9f1c 55%,#7a3f00);box-shadow:0 0 22px 6px rgba(255,159,28,.6)}
img{width:150px;height:150px;object-fit:cover;border-radius:50%;border:3px solid #ff9f1c}h1{color:#ffb347;margin:8px 0}p{white-space:pre-wrap;text-align:left;font-size:1.1rem;line-height:1.6}
small{display:block;color:#9a8fae;margin-top:14px}</style></head><body><div class="c"><div class="k"></div>${photo ? `<img src="${photo}" alt="">` : ''}
<h1>${esc(name)}</h1>${rel ? `<em>${esc(rel)}</em>` : ''}<p>${esc(lastText)}</p>${items().map(t => `<small>${esc(t)}</small>`).join('')}
<small>Written locally with open-weight Gemma. Día de los Muertos.</small></div></body></html>`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `ofrenda-${name.toLowerCase().replace(/\W+/g, '-') || 'remembered'}.html`; a.click(); URL.revokeObjectURL(a.href);
});

$('#clear').addEventListener('click', () => {
  if (ctrl) ctrl.abort();
  $('#form').reset(); photo = null; lastText = ''; $('#ofrenda').hidden = true;
  $('#remembrance').textContent = ''; $('#card-photo').removeAttribute('src');
});
