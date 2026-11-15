// Lista della spesa: aggrega il piano, sottrae la dispensa, arrotonda ai formati.
import { FOODS } from './foods.js';
import { readPlan, evaluate, addDays } from './planner.js';

export function buildShopping(ctx, weekStart) {
  const entries = readPlan(ctx, weekStart).map((p) => ({ day: p.day, recipe: p.recipe, scale: p.scale }));
  const pantry = ctx.pantry ?? {};
  const ev = evaluate(entries, pantry);
  const checked = ctx.shopChecks?.[weekStart] ?? {};
  const items = [];
  for (const [key, n] of Object.entries(ev.need)) {
    const f = FOODS[key]; if (!f) continue;
    const buy = Math.max(0, n.g - (pantry[key] ?? 0));
    const packs = buy > 0 ? Math.ceil(buy / f.pack - 1e-9) : 0;
    items.push({
      key, name: f.name, cat: f.cat, staple: !!f.staple,
      needG: Math.round(n.g), buyG: Math.round(packs * f.pack), packs, pack: f.pack,
      pieces: f.piece ? Math.round((packs * f.pack) / f.piece * 10) / 10 : null,
      cost: f.staple ? 0 : Math.round((packs * f.pack * f.price) / 10) / 100,
      leftoverG: Math.max(0, Math.round(packs * f.pack - n.g)),
      frozen: !!f.frozen,
      pantryG: Math.round(pantry[key] ?? 0), inPantry: (pantry[key] ?? 0) >= n.g - 1 && n.g > 0,
      checked: !!checked[key],
    });
  }
  items.sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));
  const total = items.reduce((a, i) => a + i.cost, 0);
  return { weekStart, items, total: Math.round(total * 100) / 100, weeklyCost: Math.round(ev.cost * 100) / 100, wasteG: Math.round(ev.wasteG), wasteEur: Math.round(ev.waste * 100) / 100 };
}

// Ingredienti surgelati da scongelare: raggruppati per sera (la sera prima del pasto)
export function thawEvents(ctx, weekStart) {
  const byNight = {}, seen = new Set();
  for (const p of readPlan(ctx, weekStart)) {
    if (p.meal.startsWith('spuntino')) continue;
    for (const ing of p.recipe.ingredients) {
      const f = FOODS[ing.key];
      if (!f?.frozen || !f.thaw) continue;
      const k = `${p.date}|${ing.key}`; if (seen.has(k)) continue; seen.add(k);
      (byNight[addDays(p.date, -1)] ??= []).push({ date: p.date, meal: p.meal, food: f.name, thawH: f.thaw, recipe: p.recipe.title });
    }
  }
  return byNight;
}
