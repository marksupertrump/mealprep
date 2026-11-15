import { api, icsText } from './api.js';
import { state as store, exportBackup, importFile } from './store.js';
const $ = (s, el = document) => el.querySelector(s);
const eur = (n) => (n ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const g = (n) => (n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 2 : 0).replace(/\.?0+$/, '') + ' kg' : Math.round(n) + ' g');
const DOW = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MEAL = { colazione: 'Colazione', spuntino1: 'Spuntino', pranzo: 'Pranzo', spuntino2: 'Spuntino', cena: 'Cena' };
const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let state = null, tab = 'plan';
const view = $('#view');

async function load() { state = await api('/api/state'); render(); }
function render() { view.onclick = view.onchange = null; ({ plan: renderPlan, shop: renderShop, recipes: renderRecipes, track: renderTrack, cal: renderCal, settings: renderSettings, data: renderData })[tab](); }

$('#tabs').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  tab = b.dataset.tab; document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b)); render();
};
$('#close').onclick = () => ($('#modal').hidden = true);
$('#modal').onclick = (e) => { if (e.target.id === 'modal') $('#modal').hidden = true; };
const openModal = (html) => { $('#modal-body').innerHTML = html; $('#modal').hidden = false; return $('#modal-body'); };

// ---------------- PIANO ----------------
function renderPlan() {
  const { plan, totals, shopping: sh, settings: S, week } = state;
  if (!plan.length) {
    view.innerHTML = `<div class="card"><h2>Nessun piano per questa settimana</h2><p class="mut">Genero 7 giorni di pasti sui tuoi target (${S.kcal_target} kcal, ${S.protein_g} g proteine, budget ${eur(S.budget_week)}).</p><button class="btn pri" id="gen">Genera piano</button></div>`;
    $('#gen').onclick = generate; return;
  }
  const days = [...Array(7).keys()].map((d) => plan.filter((p) => p.day === d));
  const avgK = Math.round(Object.values(totals).reduce((a, t) => a + t.kcal, 0) / 7);
  const avgP = Math.round(Object.values(totals).reduce((a, t) => a + t.protein, 0) / 7);
  const over = sh.weeklyCost > S.budget_week;
  view.innerHTML = `
  <div class="row"><h2 class="grow">Settimana dal ${fmtDate(week)}</h2><button class="btn" id="gen">🔄 Rigenera piano</button></div>
  <div class="kpis">
    <div class="kpi ${Math.abs(avgK - S.kcal_target) < 100 ? 'ok' : 'bad'}"><span class="mut small">Kcal medie / giorno</span><b>${avgK}</b><span class="small mut">target ${S.kcal_target}</span></div>
    <div class="kpi ${avgP >= S.protein_g * 0.93 ? 'ok' : 'bad'}"><span class="mut small">Proteine medie / giorno</span><b>${avgP} g</b><span class="small mut">target ${S.protein_g} g</span></div>
    <div class="kpi ${sh.weeklyCost > S.budget_max ? 'bad' : over ? '' : 'ok'}"><span class="mut small">Costo reale settimana</span><b>${eur(sh.weeklyCost)}</b><span class="small mut">budget ${eur(S.budget_week)} (max ${eur(S.budget_max)})</span></div>
    <div class="kpi"><span class="mut small">Spreco stimato</span><b>${g(sh.wasteG)}</b><span class="small mut">≈ ${eur(sh.wasteEur)} di freschi avanzati</span></div>
  </div>
  <div class="days">${days.map((slots, d) => {
    const date = slots[0]?.date, t = totals[date] ?? {};
    return `<div class="card day"><h3><span>${DOW[d]} ${fmtDate(date)}</span><span class="mut small">${t.kcal} kcal · ${t.protein}P · ${t.carbs}C · ${t.fat}F</span></h3>
      <div class="bar"><i style="width:${Math.min(100, (t.kcal / S.kcal_target) * 100)}%"></i></div>
      ${slots.map((s) => `<div class="slot"><span class="m">${MEAL[s.meal]}</span><div class="t"><b>${esc(s.recipe.title)}</b><span class="small mut">${s.scale}× porzione · ${Math.round(s.recipe.kcal * s.scale)} kcal · ${Math.round(s.recipe.protein * s.scale)}P</span></div>
      <button class="btn sm" data-open="${s.recipe.id}" data-scale="${s.scale}">Esplodi</button><button class="btn sm" data-swap="${s.id}" data-meal="${s.meal}" title="Cambia ricetta">⇄</button></div>`).join('')}
    </div>`;
  }).join('')}</div>`;
  $('#gen').onclick = () => confirm('Rigenerare l\'intero piano? Le modifiche manuali andranno perse.') && generate();
  view.onclick = (e) => {
    const o = e.target.closest('[data-open]'); if (o) return explode(Number(o.dataset.open), Number(o.dataset.scale));
    const s = e.target.closest('[data-swap]'); if (s) return swapPicker(Number(s.dataset.swap), s.dataset.meal);
  };
}
async function generate() { view.innerHTML = '<p class="mut">Calcolo il piano migliore…</p>'; await new Promise((r) => setTimeout(r, 50)); state = await api('/api/plan/generate', {}); render(); }

async function swapPicker(slotId, meal) {
  const all = await api('/api/recipes');
  const pool = all.filter((r) => r.meal === (meal.startsWith('spuntino') ? 'snack' : meal === 'colazione' ? 'colazione' : 'main'));
  const b = openModal(`<h2>Cambia ricetta</h2>${pool.map((r) => `<div class="slot"><div class="t"><b>${esc(r.title)}</b><span class="small mut">${r.kcal} kcal · ${r.protein}P · ${eur(r.est_cost)}/porz</span></div><button class="btn sm pri" data-pick="${r.id}">Scegli</button></div>`).join('')}`);
  b.onclick = async (e) => { const p = e.target.closest('[data-pick]'); if (!p) return; state = await api('/api/plan/swap', { id: slotId, recipe_id: Number(p.dataset.pick) }); $('#modal').hidden = true; render(); };
}

// ---------------- ESPLODI RICETTA ----------------
async function explode(id, scale = 1) {
  const r = await api(`/api/recipe?id=${id}`);
  const per = (x) => (x / r.servings) * scale;
  const ing = r.ingredients.map((i) => {
    const q = per(i.g), pz = i.piece ? ` ≈ ${Math.round((q / i.piece) * 10) / 10} pz` : '';
    return `<tr><td>${esc(i.name)}${i.note ? `<div class="small mut">${esc(i.note)}</div>` : ''}</td><td style="text-align:right;white-space:nowrap">${i.staple && q < 15 ? 'q.b.' : g(q)}${pz}</td></tr>`;
  }).join('');
  const b = openModal(`
    <h2>${esc(r.title)}</h2>
    <div class="row small mut"><span>⏱ ${r.prep_min + r.cook_min} min (prep ${r.prep_min} + cottura ${r.cook_min})</span><span>·</span><span>🔥 ${Math.round(r.kcal * scale)} kcal</span><span>·</span><span>${Math.round(r.protein * scale)}P ${Math.round(r.carbs * scale)}C ${Math.round(r.fat * scale)}F</span></div>
    <p>${r.tags.filter((t) => !['main', 'snack', 'colazione'].includes(t)).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}${r.thaw_hours ? '<span class="chip">🧊 scongela prima</span>' : ''}</p>
    ${r.note ? `<p class="small warn">⚠ ${esc(r.note)}</p>` : ''}
    <h3>Ingredienti per ${scale}× porzione (1 persona)</h3>
    <table>${ing}</table>
    <h3 style="margin-top:16px">Preparazione <span class="small mut">(tocca un passaggio per segnarlo fatto)</span></h3>
    <ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    ${r.fridge > 1 ? `<p class="small mut">💡 Si conserva ${r.fridge} giorni in frigo: puoi cuocere ${r.servings} porzioni insieme e mangiarle in più giorni.</p>` : ''}
    ${r.source_url ? `<p class="small"><a href="${esc(r.source_url)}" target="_blank" rel="noopener">Apri il reel originale ↗</a></p>` : ''}`);
  b.onclick = (e) => e.target.closest('ol.steps li')?.classList.toggle('done');
}

// ---------------- SPESA ----------------
async function renderShop() {
  const [sh, st] = [await api(`/api/shopping?week=${state.week}`), state.settings];
  if (!sh.items.length) { view.innerHTML = '<div class="card">Genera prima un piano.</div>'; return; }
  const buy = sh.items.filter((i) => !i.staple && i.packs > 0);
  const have = sh.items.filter((i) => !i.staple && i.packs === 0);
  const staples = sh.items.filter((i) => i.staple);
  const cats = [...new Set(buy.map((i) => i.cat))];
  const done = buy.filter((i) => i.checked).length;
  const row = (i) => `
    <div class="item ${i.checked ? 'chk' : ''}"><input type="checkbox" data-k="${i.key}" ${i.checked ? 'checked' : ''} title="Preso">
      <span class="n grow">${esc(i.name)}${i.frozen ? ' <span class="chip">🧊 freezer</span>' : ''}<div class="small mut">servono ${g(i.needG)}${i.pantryG ? ` · in dispensa ${g(i.pantryG)}` : ''}${i.leftoverG ? ` · avanzano ${g(i.leftoverG)}` : ''}</div></span>
      <span>${i.packs}× ${g(i.pack)}${i.pieces ? ` (≈${i.pieces} pz)` : ''}</span><b style="width:64px;text-align:right">${eur(i.cost)}</b>
      <button class="btn sm" data-have="${i.key}" data-g="${i.needG}" title="Ce l'ho già in casa">🏠 Ce l'ho</button></div>`;
  view.innerHTML = `
  <div class="row"><h2 class="grow">Lista della spesa</h2><span class="mut">${done}/${buy.length} presi</span></div>
  <div class="kpis">
    <div class="kpi"><span class="mut small">Da comprare oggi</span><b>${eur(sh.total)}</b><span class="small mut">confezioni intere, dispensa già sottratta</span></div>
    <div class="kpi ${sh.weeklyCost > st.budget_max ? 'bad' : 'ok'}"><span class="mut small">Costo della settimana</span><b>${eur(sh.weeklyCost)}</b><span class="small mut">tolto ciò che hai in casa</span></div>
  </div>
  ${cats.map((c) => `<div class="cat">${esc(c)}</div>` + buy.filter((i) => i.cat === c).map(row).join('')).join('')}
  ${have.length ? `<div class="cat">🏠 Già in dispensa (${have.length})</div>` + have.map((i) => `<div class="item"><span class="n grow">${esc(i.name)}<div class="small mut">servono ${g(i.needG)} · hai ${g(i.pantryG)}</div></span><button class="btn sm" data-nohave="${i.key}">Rimetti in lista</button></div>`).join('') : ''}
  ${staples.length ? `<div class="cat">Dispensa di base: controlla di averli</div><p class="small mut">${staples.map((i) => esc(i.name)).join(' · ')}</p>` : ''}
  <div class="card" style="margin-top:16px"><h3>Registra lo scontrino reale</h3><div class="row">
    <input id="p-total" type="number" step="0.01" placeholder="Totale €"><input id="p-store" placeholder="Negozio"><button class="btn pri" id="p-add">Salva nel tracker</button></div></div>`;
  view.onchange = async (e) => {
    const k = e.target.dataset.k; if (!k) return;
    await api('/api/shopping/check', { week: state.week, key: k, checked: e.target.checked });
    e.target.closest('.item').classList.toggle('chk', e.target.checked);
  };
  view.onclick = async (e) => {
    const h = e.target.closest('[data-have]'), n = e.target.closest('[data-nohave]');
    if (h) await api('/api/pantry', { key: h.dataset.have, qty: Number(h.dataset.g) });
    else if (n) await api('/api/pantry', { key: n.dataset.nohave, qty: null });
    else return;
    state = await api('/api/state'); renderShop();
  };
  $('#p-add').onclick = async () => { const t = Number($('#p-total').value); if (!t) return; await api('/api/purchases', { total: t, store: $('#p-store').value }); alert('Salvato nel tracker.'); };
}

// ---------------- RICETTE ----------------
async function renderRecipes() {
  const all = await api('/api/recipes');
  const must = new Set(state.settings.must_include ?? []);
  const label = { main: 'Pranzo / cena', colazione: 'Colazione', snack: 'Spuntino' };
  view.innerHTML = `<h2>Ricette (${all.length})</h2><p class="mut small">${all.filter((r) => r.collection === 'Cucina').length} dai tuoi salvati Instagram, ${all.filter((r) => r.collection === 'base').length} ricette base aggiunte da me. 📌 = deve comparire nel piano della prossima generazione (e quindi nella spesa).</p>` +
    Object.keys(label).map((m) => `<div class="cat">${label[m]}</div>` + all.filter((r) => r.meal === m).map((r) => `
      <div class="slot"><div class="t"><b>${esc(r.title)}</b><span class="small mut">${r.kcal} kcal · ${r.protein}P · ${eur(r.est_cost)}/porz${r.collection === 'base' ? ' · base' : ''}</span></div>
      <button class="btn sm ${must.has(r.code) ? 'pri' : ''}" data-pin="${esc(r.code)}" title="Includi sempre nel piano">📌</button>
      <button class="btn sm" data-open="${r.id}" data-scale="1">Esplodi</button></div>`).join('')).join('');
  view.onclick = async (e) => {
    const o = e.target.closest('[data-open]'); if (o) return explode(Number(o.dataset.open), 1);
    const p = e.target.closest('[data-pin]'); if (!p) return;
    const c = p.dataset.pin; must.has(c) ? must.delete(c) : must.add(c);
    state.settings = await api('/api/settings', { must_include: [...must] }); renderRecipes();
  };
}

// ---------------- TRACKER ----------------
async function renderTrack() {
  const t = await api('/api/tracker'); const S = t.settings;
  const weeks = Object.entries(t.weekly).sort((a, b) => b[0].localeCompare(a[0]));
  const last = t.weights.at(-1)?.kg ?? S.weight_kg;
  const prog = Math.max(0, Math.min(100, ((S.weight_kg - last) / (S.weight_kg - S.goal_weight_kg)) * 100));
  const max = Math.max(S.budget_max, ...Object.values(t.weekly), 1);
  view.innerHTML = `
  <h2>Tracker</h2>
  <div class="card"><h3>Spesa settimanale vs budget</h3>
    ${weeks.length ? weeks.map(([w, v]) => `<div class="row small"><span style="width:70px">${fmtDate(w)}</span><div class="bar grow"><i style="width:${(v / max) * 100}%;background:${v > S.budget_max ? 'var(--warn)' : 'var(--acc)'}"></i></div><b style="width:70px;text-align:right">${eur(v)}</b></div>`).join('') : '<p class="mut">Nessuno scontrino ancora. Registrali dalla scheda Spesa.</p>'}
    <p class="small mut">Budget ${eur(S.budget_week)} · massimo ${eur(S.budget_max)}. La prima settimana include le scorte (olio, riso, pasta...), poi cala.</p>
    <div class="row"><input id="p-total" type="number" step="0.01" placeholder="Totale €"><input id="p-store" placeholder="Negozio"><button class="btn pri" id="p-add">Aggiungi scontrino</button></div>
    <table style="margin-top:8px">${t.purchases.slice(0, 8).map((p) => `<tr><td>${fmtDate(p.date)}</td><td>${esc(p.store)}</td><td style="text-align:right">${eur(p.total)}</td><td><button class="btn sm" data-del="${p.id}">✕</button></td></tr>`).join('')}</table></div>
  <div class="card"><h3>Peso: ${S.weight_kg} → ${S.goal_weight_kg} kg</h3>
    <div class="bar"><i style="width:${prog}%"></i></div><p class="small mut">Attuale ${last} kg · mancano ${(last - S.goal_weight_kg).toFixed(1)} kg · ritmo sano 0,5 kg/settimana</p>
    <div class="row"><input id="w-kg" type="number" step="0.1" placeholder="Peso kg"><button class="btn pri" id="w-add">Registra pesata</button></div>
    <table style="margin-top:8px">${t.weights.slice(-8).reverse().map((w) => `<tr><td>${fmtDate(w.date)}</td><td style="text-align:right">${w.kg} kg</td></tr>`).join('')}</table></div>`;
  $('#p-add').onclick = async () => { const v = Number($('#p-total').value); if (v) { await api('/api/purchases', { total: v, store: $('#p-store').value }); renderTrack(); } };
  $('#w-add').onclick = async () => { const v = Number($('#w-kg').value); if (v) { await api('/api/weights', { kg: v }); renderTrack(); } };
  view.onclick = async (e) => { const d = e.target.closest('[data-del]'); if (d) { await api('/api/purchases/delete', { id: Number(d.dataset.del) }); renderTrack(); } };
}

// ---------------- CALENDARIO ----------------
function renderCal() {
  view.innerHTML = `<h2>Reminder a calendario</h2>
  <div class="card"><p>File iCal con la spesa e i promemoria di scongelamento (la sera prima, alle 20:30), calcolati sul piano della settimana.</p>
    <p class="small mut">Scaricalo e aprilo: Google Calendar (o il calendario del telefono) importa gli eventi. Dopo aver rigenerato il piano, scaricalo di nuovo.</p>
    <button class="btn pri" id="ics">⬇ Scarica promemoria (.ics)</button></div>
  <div class="card"><h3>Prossimi promemoria</h3>${state.reminders.map((r) => `<div class="slot"><span class="m">${fmtDate(r.date)}<br>${r.start}</span><div class="t"><b>${esc(r.title)}</b><span class="small mut" style="white-space:pre-line">${esc(r.desc.split('\n').slice(0, 3).join('\n'))}</span></div></div>`).join('') || '<p class="mut">Nessun promemoria: genera un piano.</p>'}</div>`;
  const btn = $('#ics'); if (btn) btn.onclick = () => download('mealprep.ics', icsText(), 'text/calendar');
}

function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------- DATI (import / export) ----------------
async function renderData() {
  const s = store();
  const mac = await fetch('./recipes-pack.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  view.innerHTML = `<h2>Dati</h2>
  <div class="card"><h3>Ricette: ${s.recipes.length}</h3>
    <p class="small mut">Le ricette vengono dal Mac (dove si importano i reel e si trascrive l'audio). Qui non sono incluse nel sito: le carichi con un file.</p>
    ${mac ? `<button class="btn pri" id="mac">⬇ Carica le ricette dal Mac (${mac.recipes.length})</button>` : ''}
    <label class="btn" style="display:inline-block">📥 Importa file…<input id="imp" type="file" accept=".json,application/json" hidden></label>
    <p id="msg" class="small"></p></div>
  <div class="card"><h3>Backup dei tuoi dati</h3>
    <p class="small mut">Piano, dispensa, scontrini, pesate e profilo stanno solo su questo dispositivo. Esporta un backup per spostarli (per esempio dal telefono al Mac) o per sicurezza.</p>
    <button class="btn pri" id="exp">⬆ Esporta backup</button></div>
  <div class="card"><h3>Cancella tutto</h3><button class="btn" id="wipe">Cancella i dati di questo dispositivo</button></div>`;
  const say = (t, bad) => { $('#msg').textContent = t; $('#msg').className = 'small ' + (bad ? 'warn' : ''); };
  const apply = async (text) => { try { say(importFile(text)); state = await api('/api/state'); } catch (e) { say(e.message, true); } };
  if (mac) $('#mac').onclick = () => apply(JSON.stringify(mac));
  $('#imp').onchange = async (e) => { const f = e.target.files[0]; if (f) apply(await f.text()); };
  $('#exp').onclick = () => download(`mealprep-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup());
  $('#wipe').onclick = () => { if (confirm('Cancellare piano, dispensa, scontrini e ricette di questo dispositivo?')) { localStorage.removeItem('mealprep.v1'); location.reload(); } };
}

// ---------------- PROFILO ----------------
function renderSettings() {
  const S = state.settings;
  const f = (k, label, type = 'number', step = 1) => `<label class="row"><span style="width:200px">${label}</span><input data-k="${k}" type="${type}" step="${step}" value="${esc(S[k])}"></label>`;
  view.innerHTML = `<h2>Profilo e obiettivi</h2><div class="card">
    ${f('weight_kg', 'Peso attuale (kg)', 'number', 0.1)}${f('goal_weight_kg', 'Peso obiettivo (kg)', 'number', 0.1)}${f('height_cm', 'Altezza (cm) ⚠ segnaposto')}${f('age', 'Età')}
    ${f('workouts_per_week', 'Allenamenti a settimana')}${f('kcal_target', 'Kcal al giorno')}${f('protein_g', 'Proteine g/giorno')}
    ${f('budget_week', 'Budget settimana €')}${f('budget_max', 'Budget massimo €')}${f('snacks_per_day', 'Spuntini al giorno')}
    <label class="row"><span style="width:200px">Giorno della spesa</span><select data-k="shopping_day">${['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'].map((d) => `<option ${S.shopping_day === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
    <button class="btn pri" id="save">Salva</button> <span class="mut small">Poi rigenera il piano per applicarli.</span></div>`;
  $('#save').onclick = async () => {
    const patch = {}; view.querySelectorAll('[data-k]').forEach((el) => (patch[el.dataset.k] = el.type === 'number' ? Number(el.value) : el.value));
    await api('/api/settings', patch); await load(); tab = 'settings'; render();
  };
}

async function boot() {
  if (!store().recipes.length) {
    const mac = await fetch('./recipes-pack.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (mac) importFile(JSON.stringify(mac));
  }
  await load();
  if (!store().recipes.length) { tab = 'data'; document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === 'data')); render(); }
}
boot();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
