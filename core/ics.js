// Calendario iCalendar (RFC 5545) con i reminder: spesa e scongelamento. Orari "floating" = ora locale del dispositivo.
import { addDays, isoDate } from './planner.js';
import { thawEvents, buildShopping } from './shopping.js';

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const fold = (l) => (Array.from(l).reduce((a, c, i) => (i && i % 70 === 0 ? a + '\r\n ' + c : a + c), ''));
const stamp = (iso, hhmm) => `${iso.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
const DAYS = { domenica: 0, lunedì: 1, martedì: 2, mercoledì: 3, giovedì: 4, venerdì: 5, sabato: 6 };

function event({ uid, date, start, end, title, desc, alarmMin = 0 }) {
  return ['BEGIN:VEVENT', `UID:${uid}@mealprep.local`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${stamp(date, start)}`, `DTEND:${stamp(date, end)}`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, `TRIGGER:-PT${alarmMin}M`, 'END:VALARM', 'END:VEVENT'].map(fold).join('\r\n');
}

export function remindersFor(ctx, weekStart, today = isoDate(new Date())) {
  const S = ctx.settings, out = [];
  const wd = DAYS[String(S.shopping_day).toLowerCase()] ?? 6;
  let shop = weekStart;
  for (let i = 1; i <= 7; i++) { const d = addDays(weekStart, -i); if (new Date(d + 'T12:00:00').getDay() === wd) { shop = d; break; } }
  if (shop < today) shop = today;
  const list = buildShopping(ctx, weekStart);
  const buy = list.items.filter((i) => i.packs > 0 && !i.staple);
  out.push({ uid: `spesa-${weekStart}`, date: shop, start: '10:00', end: '11:00', alarmMin: 60,
    title: `🛒 Fai la spesa (~${list.total.toFixed(0)} €)`,
    desc: `Costo reale dei consumi della settimana: ~${list.weeklyCost.toFixed(0)} € (budget ${S.budget_week} €).\n` + buy.map((i) => `• ${i.name}: ${i.buyG >= 1000 ? (i.buyG / 1000).toFixed(1) + ' kg' : i.buyG + ' g'}`).join('\n') });
  for (const [night, evs] of Object.entries(thawEvents(ctx, weekStart))) {
    if (night < today) continue;
    out.push({ uid: `scongela-${night}`, date: night, start: '20:30', end: '20:45', alarmMin: 0,
      title: `🧊 Scongela: ${[...new Set(evs.map((e) => e.food))].join(', ')}`,
      desc: evs.map((e) => `${e.food} → ${e.recipe} (${e.date}, ${e.meal}). Sposta dal freezer al frigo.`).join('\n') });
  }
  return out;
}

export function buildIcs(ctx, weekStart) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//mealprep//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Piano alimentare',
    ...remindersFor(ctx, weekStart).map(event), 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
