// Stato dell'app nel browser (localStorage). Un solo oggetto JSON: facile da esportare/importare.
import { DEFAULT_SETTINGS } from './core/settings.js';

const KEY = 'mealprep.v1';
const fresh = () => ({ recipes: [], settings: {}, plan: [], shopChecks: {}, purchases: [], pantry: {}, weights: [], nextId: 1 });
let S = null;

export function state() {
  if (!S) { try { S = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) ?? 'null') }; } catch { S = fresh(); } }
  return S;
}
export function commit() { localStorage.setItem(KEY, JSON.stringify(S)); }
export function replaceState(next) { S = { ...fresh(), ...next }; commit(); }
export const nextId = () => { const s = state(); return s.nextId++; };
export const settings = () => ({ ...DEFAULT_SETTINGS, ...state().settings });
export const ctx = () => { const s = state(); return { settings: settings(), recipes: s.recipes, pantry: s.pantry, plan: s.plan, shopChecks: s.shopChecks }; };

export const exportBackup = () => JSON.stringify({ type: 'mealprep-backup', v: 1, exportedAt: new Date().toISOString(), state: state() });

// Importa un file: backup completo (stato + ricette) oppure pacchetto ricette dal Mac. Ritorna una descrizione.
export function importFile(text) {
  const d = JSON.parse(text);
  if (d.type === 'mealprep-backup') { replaceState(d.state); return `Backup ripristinato (${d.state.recipes.length} ricette, ${d.state.purchases.length} scontrini).`; }
  if (d.type === 'mealprep-recipes') { const s = state(); s.recipes = d.recipes; commit(); return `Ricette aggiornate: ${d.recipes.length}. Piano, dispensa e tracker non sono stati toccati.`; }
  throw new Error('File non riconosciuto: usa un file creato da MealPrep.');
}
