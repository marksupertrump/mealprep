// Planner settimanale (puro, senza database: lavora su un `ctx` = {settings, recipes, pantry, plan}).
// Assegna una ricetta a ogni pasto cercando di centrare kcal/proteine, restare nel budget e non sprecare freschi.
import { FOODS } from './foods.js';

const SLOT_SHARE = { colazione: 0.2, pranzo: 0.33, cena: 0.33, spuntino: 0.07 };
export const MEAL_ORDER = ['colazione', 'spuntino1', 'pranzo', 'spuntino2', 'cena'];

export const isoDate = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDate(d); };
export function nextMonday(from = new Date()) {
  const d = new Date(from); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return isoDate(d);
}

const mealIdx = (e) => e.day * 10 + MEAL_ORDER.indexOf(e.meal);
const isBatch = (r) => r.servings >= 3; // ricette "da più giorni": si cucinano a batch intero

export function slotScale(r, targetKcal) {
  const s = targetKcal / Math.max(r.kcal, 1);
  if (r.discrete) return Math.max(1, Math.round(s)); // muffin, pancake: pezzi interi
  return Math.min(1.6, Math.max(0.5, Math.round(s * 4) / 4));
}

// Sessioni di cucina. Ricette da >=3 porzioni: si cucina il batch intero e le porzioni si ritrovano nei giorni dopo
// (entro i giorni di frigo). Le altre: si cucina solo quanto serve. Ogni sessione usa gli ingredienti nel giorno in cui si cucina.
export function cookPlan(entries) {
  const byRecipe = new Map();
  for (const e of entries) { if (!byRecipe.has(e.recipe.id)) byRecipe.set(e.recipe.id, []); byRecipe.get(e.recipe.id).push(e); }
  const batches = [];
  for (const list of byRecipe.values()) {
    list.sort((a, b) => mealIdx(a) - mealIdx(b));
    const r = list[0].recipe, batch = isBatch(r);
    let open = null;
    for (const e of list) {
      const fits = open && e.day - open.startDay <= r.fridge && (!batch || open.used + e.scale <= open.cap * 1.25 + 0.01);
      if (!fits) { open = { recipe: r, startDay: e.day, cap: batch ? r.servings : 0, used: 0, entries: [] }; batches.push(open); }
      open.used += e.scale; open.entries.push(e);
    }
  }
  let minutes = 0, leftoverValue = 0, leftoverPortions = 0;
  for (const b of batches) {
    b.batch = isBatch(b.recipe);
    b.factor = b.batch ? Math.max(1, Math.ceil((b.used / b.cap) * 4) / 4) : b.used / b.recipe.servings; // si cucina in proporzione, mai meno di 1 ricetta
    b.leftover = b.batch ? Math.max(0, b.factor * b.cap - b.used) : 0;
    minutes += b.recipe.prep_min + b.recipe.cook_min;
    // avanzi a fine settimana: si possono ancora mangiare la settimana dopo, penalità dimezzata
    const lastEat = b.startDay + b.recipe.fridge;
    const w = lastEat >= 7 ? 0.5 : 1;
    leftoverValue += b.leftover * (b.recipe.est_cost ?? 1) * w; leftoverPortions += b.leftover * w;
  }
  return { batches, minutes, leftoverValue, leftoverPortions };
}

// Costo d'acquisto + spreco. Freschi: confezione intera (l'avanzo è spreco). Alimenti che durano: solo il consumato.
export function evaluate(entries, pantry = {}) {
  const cook = cookPlan(entries);
  const need = {};
  for (const b of cook.batches) for (const i of b.recipe.ingredients) {
    const n = (need[i.key] ??= { g: 0, days: [] });
    n.g += i.g * b.factor; n.days.push(b.startDay);
  }
  let cost = 0, waste = 0, wasteG = 0, spoil = 0;
  for (const [k, n] of Object.entries(need)) {
    const f = FOODS[k]; if (!f || f.staple) continue;
    const buy = Math.max(0, n.g - (pantry[k] ?? 0));
    if (buy <= 0) continue;
    const perishable = f.life && f.life <= 14 && !f.frozen;
    if (perishable) {
      const packs = Math.ceil(buy / f.pack - 1e-9);
      cost += (packs * f.pack * f.price) / 1000;
      const left = packs * f.pack - buy;
      if (f.life <= 7) { waste += (left * f.price) / 1000; wasteG += left; }
    } else cost += (buy * f.price) / 1000;
    const span = Math.max(...n.days) - Math.min(...n.days);
    if (f.life && !f.frozen && span > f.life - 1) spoil += (span - f.life + 1) * 2;
  }
  return { cost, waste, wasteG, spoil, need, cook };
}

// Info per l'interfaccia: per ogni pasto, se si cucina quel giorno o è un avanzo
export function cookInfo(entries) {
  const out = {}, cp = cookPlan(entries);
  for (const b of cp.batches) {
    const sorted = [...b.entries].sort((x, y) => mealIdx(x) - mealIdx(y));
    for (const [i, e] of sorted.entries()) out[e.id] = { isCook: i === 0, cookDay: b.startDay, cookDate: sorted[0].date, portions: b.batch ? b.factor * b.cap : b.used, eaten: sorted.length, leftover: b.leftover, dates: sorted.map((x) => x.date) };
  }
  return { byId: out, batches: cp.batches, minutes: cp.minutes };
}

function mulberry(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function generatePlan(ctx, { weekStart, seed = Date.now(), iterations = 25000, locked = {}, restarts = 4 } = {}) {
  let top = null;
  // se il risultato sfora il budget massimo riprova (poche volte): evita i rari piani sbagliati
  for (let i = 0; i < restarts * 3; i++) {
    if (i >= restarts && top.ev.cost <= ctx.settings.budget_max) break;
    const r = searchPlan(ctx, { weekStart, seed: seed + i * 7919, iterations, locked });
    if (!top || r.pen < top.pen) top = r;
  }
  return top;
}

function searchPlan(ctx, { weekStart, seed, iterations, locked }) {
  const S = ctx.settings, recipes = ctx.recipes, pantry = ctx.pantry ?? {};
  const pools = { colazione: recipes.filter((r) => r.meal === 'colazione'), main: recipes.filter((r) => r.meal === 'main'), snack: recipes.filter((r) => r.meal === 'snack') };
  if (!pools.colazione.length || !pools.main.length || !pools.snack.length) throw new Error('Servono ricette di colazione, pranzo/cena e spuntino: importa le ricette dalla scheda Dati.');
  const rnd = mulberry(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  const slotsOf = (d) => [
    { day: d, meal: 'colazione', pool: 'colazione', share: SLOT_SHARE.colazione },
    { day: d, meal: 'spuntino1', pool: 'snack', share: SLOT_SHARE.spuntino },
    { day: d, meal: 'pranzo', pool: 'main', share: SLOT_SHARE.pranzo },
    { day: d, meal: 'spuntino2', pool: 'snack', share: SLOT_SHARE.spuntino },
    { day: d, meal: 'cena', pool: 'main', share: SLOT_SHARE.cena },
  ].filter((s) => (s.meal.startsWith('spuntino') ? Number(s.meal.slice(-1)) <= S.snacks_per_day : true));

  const slots = [...Array(7).keys()].flatMap(slotsOf);
  // ricette "fisse" scelte dall'utente: ognuna occupa uno slot casuale del tipo giusto, in giorni diversi
  locked = { ...locked };
  const usedDays = new Set();
  for (const code of S.must_include ?? []) {
    const r = recipes.find((x) => x.shortcode === code); if (!r) continue;
    const pool = r.meal === 'main' ? 'main' : r.meal;
    const all = slots.map((_, i) => i).filter((i) => slots[i].pool === pool && locked[i] == null);
    const free = all.filter((i) => !usedDays.has(slots[i].day));
    const cand = free.length ? free : all;
    if (!cand.length) continue;
    const i = cand[Math.floor(rnd() * cand.length)];
    locked[i] = r; usedDays.add(slots[i].day);
  }

  const batchRecipes = recipes.filter((r) => isBatch(r) && r.meal !== 'snack');
  const poolIdx = { colazione: [], main: [], snack: [] };
  slots.forEach((sl, i) => poolIdx[sl.pool].push(i));
  const kcalTarget = S.kcal_target;
  const shareSum = slotsOf(0).reduce((a, s) => a + s.share, 0);
  const build = (assign) => slots.map((s, i) => ({ ...s, recipe: assign[i], scale: slotScale(assign[i], (kcalTarget * s.share) / shareSum) }));

  const score = (assign) => {
    const entries = build(assign);
    const ev = evaluate(entries, pantry);
    let pen = 0;
    pen += ev.cost > S.budget_week ? (ev.cost - S.budget_week) * 9 : (ev.cost / S.budget_week) * 2;
    if (ev.cost > S.budget_max) pen += (ev.cost - S.budget_max) * 30;
    pen += ev.waste * 3 + ev.spoil;
    pen += ev.cook.minutes / 6 + ev.cook.leftoverValue * 6 + ev.cook.leftoverPortions * 2;
    for (let d = 0; d < 7; d++) {
      const day = entries.filter((e) => e.day === d);
      const kcal = day.reduce((a, e) => a + e.recipe.kcal * e.scale, 0);
      const pro = day.reduce((a, e) => a + e.recipe.protein * e.scale, 0);
      pen += Math.abs(kcal - kcalTarget) / 30;
      if (pro < S.protein_g) pen += (S.protein_g - pro) / 0.8;
      const ids = day.map((e) => e.recipe.id);
      pen += (ids.length - new Set(ids).size) * 300; // regola: lo stesso piatto non compare due volte nello stesso giorno
    }
    const eaten = new Map(); // varietà: oltre 4 pasti dello stesso piatto a settimana si annoia
    for (const e of entries) eaten.set(e.recipe.id, (eaten.get(e.recipe.id) ?? 0) + 1);
    for (const n of eaten.values()) if (n > 4) pen += (n - 4) * 10;
    const times = new Map(); // quante volte si cucina lo stesso piatto nella settimana
    for (const b of ev.cook.batches) times.set(b.recipe.id, (times.get(b.recipe.id) ?? 0) + 1);
    for (const [id, n] of times) { const r = recipes.find((x) => x.id === id); if (n > (isBatch(r) ? 1 : 2)) pen += (n - (isBatch(r) ? 1 : 2)) * (isBatch(r) ? 70 : 25); }
    return { pen, ev, entries };
  };

  let best = null, bestAssign = null;
  let cur = slots.map((s, i) => locked[i] ?? pick(pools[s.pool])), curScore = score(cur);
  for (let it = 0; it < iterations; it++) {
    const cand = cur.slice();
    if (batchRecipes.length && rnd() < 0.35) {
      // mossa a batch: una ricetta da più porzioni occupa gli slot consecutivi dello stesso tipo
      const r = pick(batchRecipes), idx = poolIdx[r.meal === 'main' ? 'main' : r.meal];
      const p = Math.floor(rnd() * idx.length);
      for (let k = 0; k < r.servings && p + k < idx.length; k++) if (locked[idx[p + k]] == null) cand[idx[p + k]] = r;
    } else {
      const n = rnd() < 0.3 ? 2 : 1;
      for (let k = 0; k < n; k++) { const i = Math.floor(rnd() * slots.length); if (locked[i] == null) cand[i] = pick(pools[slots[i].pool]); }
    }
    const sc = score(cand);
    const T = 3 * (1 - it / iterations) + 0.01;
    if (sc.pen < curScore.pen || rnd() < Math.exp((curScore.pen - sc.pen) / T)) { cur = cand; curScore = sc; }
    if (!best || curScore.pen < best.pen) { best = curScore; bestAssign = cur.slice(); }
  }
  return { entries: best.entries, ev: best.ev, assign: bestAssign, weekStart, pen: best.pen };
}

export function readPlan(ctx, weekStart) {
  const recipes = Object.fromEntries(ctx.recipes.map((r) => [r.id, r]));
  const end = addDays(weekStart, 7);
  return ctx.plan
    .filter((p) => p.date >= weekStart && p.date < end)
    .map((p) => ({ id: p.id, date: p.date, day: Math.round((new Date(p.date) - new Date(weekStart)) / 864e5), meal: p.meal, scale: p.scale || 1, recipe: recipes[p.recipe_id] }))
    .filter((p) => p.recipe)
    .sort((a, b) => a.day - b.day || MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal));
}

export function dayTotals(entries) {
  const out = {};
  for (const e of entries) {
    const t = (out[e.date] ??= { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    t.kcal += e.recipe.kcal * e.scale; t.protein += e.recipe.protein * e.scale; t.carbs += e.recipe.carbs * e.scale; t.fat += e.recipe.fat * e.scale;
  }
  for (const t of Object.values(out)) for (const k of Object.keys(t)) t[k] = Math.round(t[k]);
  return out;
}
