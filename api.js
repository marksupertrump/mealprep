// "API" locale: stesse rotte e stesse risposte del vecchio server, ma tutto nel browser.
import { state, commit, nextId, settings, ctx } from './store.js';
import { DEFAULT_SETTINGS } from './core/settings.js';
import { FOODS } from './core/foods.js';
import { generatePlan, readPlan, dayTotals, nextMonday, addDays, isoDate, slotScale, cookInfo } from './core/planner.js';
import { buildShopping } from './core/shopping.js';
import { remindersFor, buildIcs } from './core/ics.js';

export const currentWeek = () => {
  const dates = state().plan.map((p) => p.date).sort();
  if (!dates.length) return nextMonday();
  const d = dates.at(-1);
  return addDays(d, -((new Date(d + 'T12:00:00').getDay() + 6) % 7));
};

function weekPayload(week) {
  const c = ctx(), base = readPlan(c, week);
  const ci = cookInfo(base), plan = base.map((p) => ({ ...p, cook: ci.byId[p.id] ?? null }));
  const sh = plan.length ? buildShopping(c, week) : null;
  return {
    week, settings: c.settings, plan, totals: dayTotals(plan), cooking: { sessions: ci.batches.length, minutes: ci.minutes },
    shopping: sh && { total: sh.total, weeklyCost: sh.weeklyCost, wasteG: sh.wasteG, wasteEur: sh.wasteEur },
    reminders: plan.length ? remindersFor(c, week) : [],
  };
}

const slim = (r) => ({ id: r.id, code: r.shortcode, title: r.title, meal: r.meal, kcal: r.kcal, protein: r.protein, est_cost: r.est_cost, servings: r.servings, tags: r.tags, source_url: r.source_url, collection: r.collection });

const routes = {
  'GET /api/state': (b, q) => weekPayload(q.get('week') || currentWeek()),
  'POST /api/plan/generate': ({ weekStart = nextMonday() }) => {
    const s = state(), c = ctx();
    const p = generatePlan(c, { weekStart });
    const end = addDays(weekStart, 7);
    s.plan = s.plan.filter((x) => x.date < weekStart || x.date >= end);
    for (const e of p.entries) s.plan.push({ id: nextId(), date: addDays(weekStart, e.day), meal: e.meal, recipe_id: e.recipe.id, scale: e.scale });
    delete s.shopChecks[weekStart];
    commit();
    return weekPayload(weekStart);
  },
  'POST /api/plan/swap': ({ id, recipe_id }) => {
    const s = state(), slot = s.plan.find((x) => x.id === id), r = s.recipes.find((x) => x.id === recipe_id);
    if (!slot || !r) throw new Error('not found');
    const target = slot.meal.startsWith('spuntino') ? 150 : slot.meal === 'colazione' ? 410 : 680;
    slot.recipe_id = recipe_id; slot.scale = slotScale(r, target);
    commit();
    return weekPayload(currentWeek());
  },
  'GET /api/recipes': () => state().recipes.map(slim),
  'GET /api/recipe': (b, q) => {
    const r = state().recipes.find((x) => x.id === Number(q.get('id')));
    if (!r) throw new Error('not found');
    return { ...r, ingredients: r.ingredients.map((i) => ({ ...i, name: FOODS[i.key]?.name ?? i.key, piece: FOODS[i.key]?.piece ?? null, staple: !!FOODS[i.key]?.staple })) };
  },
  'GET /api/settings': () => settings(),
  'POST /api/settings': (b) => {
    const s = state();
    for (const [k, v] of Object.entries(b)) if (k in DEFAULT_SETTINGS) s.settings[k] = v;
    commit(); return settings();
  },
  'GET /api/shopping': (b, q) => buildShopping(ctx(), q.get('week') || currentWeek()),
  'POST /api/shopping/check': ({ week, key, checked }) => {
    const m = (state().shopChecks[week] ??= {});
    checked ? (m[key] = true) : delete m[key];
    commit(); return { ok: true };
  },
  'POST /api/pantry': ({ key, qty }) => {
    const s = state(); qty == null ? delete s.pantry[key] : (s.pantry[key] = Number(qty));
    commit(); return { ok: true };
  },
  'POST /api/purchases': (b) => { state().purchases.push({ id: nextId(), date: b.date || isoDate(new Date()), store: b.store || '', total: Number(b.total), note: b.note || '' }); commit(); return { ok: true }; },
  'POST /api/purchases/delete': ({ id }) => { const s = state(); s.purchases = s.purchases.filter((p) => p.id !== id); commit(); return { ok: true }; },
  'POST /api/weights': (b) => {
    const s = state(), date = b.date || isoDate(new Date()), w = s.weights.find((x) => x.date === date);
    w ? (w.kg = Number(b.kg)) : s.weights.push({ date, kg: Number(b.kg) });
    s.weights.sort((a, b2) => a.date.localeCompare(b2.date)); commit(); return { ok: true };
  },
  'GET /api/tracker': () => {
    const s = state(), weekly = {};
    const purchases = [...s.purchases].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 60);
    for (const p of purchases) {
      const d = new Date(p.date + 'T12:00:00'), mon = addDays(p.date, -((d.getDay() + 6) % 7));
      weekly[mon] = Math.round(((weekly[mon] ?? 0) + p.total) * 100) / 100;
    }
    return { purchases, weekly, weights: s.weights, settings: settings() };
  },
};

export async function api(path, body) {
  const u = new URL(path, 'http://x');
  const h = routes[`${body ? 'POST' : 'GET'} ${u.pathname}`];
  if (!h) throw new Error(`Rotta sconosciuta: ${u.pathname}`);
  return h(body ?? {}, u.searchParams);
}
export const icsText = () => buildIcs(ctx(), currentWeek());
