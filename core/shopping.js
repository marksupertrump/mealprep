// Lista della spesa: aggrega il piano, sottrae la dispensa, arrotonda ai formati.
import { FOODS } from './foods.js';
import { readPlan, evaluate, addDays, cookInfo } from './planner.js';

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

// Ingredienti surgelati da scongelare: la sera prima del giorno in cui si cucina (non di quando si mangia)
export function thawEvents(ctx, weekStart) {
  const byNight = {};
  const { batches } = cookInfo(readPlan(ctx, weekStart));
  for (const b of batches) {
    if (b.entries.every((e) => e.meal.startsWith('spuntino'))) continue;
    const date = addDays(weekStart, b.startDay);
    for (const ing of b.recipe.ingredients) {
      const f = FOODS[ing.key];
      if (!f?.frozen || !f.thaw) continue;
      (byNight[addDays(date, -1)] ??= []).push({ date, meal: b.entries[0].meal, food: f.name, thawH: f.thaw, recipe: b.recipe.title });
    }
  }
  return byNight;
}
