// Database alimenti. Valori per 100 g (o ml). Prezzi €/kg indicativi da supermercato discount italiano:
// vanno ritoccati sui prezzi reali del tuo negozio.
//   pack:   formato d'acquisto in grammi (la spesa si arrotonda a multipli di questo)
//   piece:  grammi di un pezzo (per mostrare "≈ 2 pz")
//   life:   giorni di freschezza una volta aperto/acquistato (assente = lunga conservazione)
//   frozen: di solito lo tieni in freezer -> serve scongelare (thaw = ore prima)
//   staple: dispensa di base (olio, sale, spezie): non conta nel budget, solo "controlla scorta"
const F = (name, kcal, p, c, f, price, cat, pack, extra = {}) => ({ name, kcal, p, c, f, price, cat, pack, ...extra });

export const FOODS = {
  petto_pollo:      F('Petto di pollo', 110, 23, 0, 1.5, 9.5, 'Carne e pesce', 500, { frozen: true, thaw: 24 }),
  tacchino_macinato:F('Macinato di tacchino', 105, 22, 0, 2, 10, 'Carne e pesce', 400, { frozen: true, thaw: 24 }),
  maiale_filetto:   F('Filetto di maiale', 120, 21, 0, 3.5, 9, 'Carne e pesce', 500, { frozen: true, thaw: 24 }),
  merluzzo:         F('Merluzzo', 80, 18, 0, 0.7, 14, 'Carne e pesce', 400, { frozen: true, thaw: 12 }),
  gamberi:          F('Gamberi', 85, 18, 1, 1, 16, 'Carne e pesce', 400, { frozen: true, thaw: 8 }),
  frutti_mare:      F('Mix frutti di mare', 70, 12, 2, 1.5, 11, 'Carne e pesce', 400, { frozen: true, thaw: 8 }),
  tonno_scatola:    F('Tonno al naturale (sgocciolato)', 110, 25, 0, 1, 11, 'Dispensa', 160, { piece: 80 }),

  uova:             F('Uova', 143, 12.5, 1, 10, 5, 'Latticini e uova', 360, { piece: 60, life: 14 }),
  albume:           F('Albume', 50, 11, 0.7, 0.2, 4, 'Latticini e uova', 500, { life: 7 }),
  yogurt_greco:     F('Yogurt greco 0%', 55, 10, 4, 0.2, 3.5, 'Latticini e uova', 500, { life: 6 }),
  fiocchi_latte:    F('Fiocchi di latte', 95, 12, 3, 4, 8, 'Latticini e uova', 200, { life: 5 }),
  feta:             F('Feta', 260, 14, 4, 21, 9, 'Latticini e uova', 200, { life: 7 }),
  parmigiano:       F('Parmigiano Reggiano', 390, 33, 0, 28, 19, 'Latticini e uova', 100, { life: 30 }),
  burro:            F('Burro', 740, 0.5, 0.5, 82, 9, 'Latticini e uova', 125, { life: 30 }),
  latte_mandorla:   F('Latte di mandorla', 24, 0.5, 3, 1.2, 1.7, 'Latticini e uova', 1000, { life: 5 }),
  ricotta:          F('Ricotta', 146, 9, 3.5, 10.9, 7, 'Latticini e uova', 250, { life: 5 }),
  formaggio_spalm:  F('Formaggio spalmabile light', 170, 8, 5, 13, 8, 'Latticini e uova', 150, { life: 14 }),
  tofu:             F('Tofu naturale', 120, 13, 2, 7, 8.5, 'Latticini e uova', 250, { life: 5 }),

  pasta_integrale:  F('Pasta integrale', 340, 13, 64, 2.5, 1.7, 'Dispensa', 500),
  riso:             F('Riso', 350, 7, 78, 0.6, 2.3, 'Dispensa', 1000),
  couscous:         F('Cous cous', 360, 12, 72, 1.8, 2.6, 'Dispensa', 500),
  farina_avena:     F("Farina d'avena", 370, 13, 60, 7, 3.2, 'Dispensa', 500),
  farina_00:        F('Farina 00', 340, 10, 72, 1, 1.1, 'Dispensa', 1000),
  pane_integrale:   F('Pane integrale', 250, 9, 45, 3, 3.5, 'Dispensa', 400, { life: 4 }),
  pancarre:         F('Pancarrè', 270, 8, 50, 4, 3.2, 'Dispensa', 400, { life: 7 }),
  pangrattato:      F('Pangrattato', 360, 12, 72, 3, 2.5, 'Dispensa', 400),
  ceci_cotti:       F('Ceci cotti (scatola)', 120, 8, 18, 3, 2.2, 'Dispensa', 400),
  lenticchie_cotte: F('Lenticchie cotte (scatola)', 100, 8, 16, 0.5, 2.2, 'Dispensa', 400),
  lenticchie_rosse: F('Lenticchie rosse decorticate', 340, 25, 50, 1.5, 3.5, 'Dispensa', 500),
  pelati:           F('Pomodori pelati', 25, 1.3, 4, 0.2, 1.3, 'Dispensa', 400),
  burro_arachidi:   F("Burro d'arachidi", 600, 25, 15, 50, 7, 'Dispensa', 350),
  mandorle:         F('Mandorle', 600, 21, 7, 53, 14, 'Dispensa', 200),
  gocce_cioccolato: F('Gocce di cioccolato', 500, 5, 60, 28, 12, 'Dispensa', 100),
  cacao:            F('Cacao amaro', 350, 20, 10, 12, 14, 'Dispensa', 100),

  whey:             F('Proteine in polvere (whey)', 380, 80, 5, 6, 25, 'Dispensa', 900),

  manzo_macinato:   F('Macinato di manzo magro', 180, 20, 0, 11, 11, 'Carne e pesce', 300, { life: 3 }),
  manzo_stufato:    F('Manzo da stufato / roast beef', 150, 21, 0, 7, 14, 'Carne e pesce', 500, { life: 3 }),
  cuori_merluzzo:   F('Cuori di merluzzo (surgelati)', 80, 18, 0, 0.7, 18, 'Carne e pesce', 400, { frozen: true, thaw: 12 }),
  ricotta_hp:       F('Ricotta high protein (stima: controlla l\'etichetta)', 115, 15, 3, 4, 9, 'Latticini e uova', 200, { life: 5 }),
  panna_cucina:     F('Panna da cucina', 195, 2, 3.5, 20, 3, 'Latticini e uova', 200, { life: 7 }),
  cheddar:          F('Cheddar a fette', 400, 25, 1, 33, 14, 'Latticini e uova', 150, { life: 20 }),
  mozzarella:       F('Mozzarella', 250, 18, 1, 19, 8, 'Latticini e uova', 125, { life: 5 }),
  tortillas:        F('Tortillas', 300, 8, 50, 7, 5, 'Dispensa', 240, { life: 10 }),
  cornflakes:       F('Cornflakes', 375, 7, 84, 1, 4, 'Dispensa', 375),
  gelatina:         F('Gelatina neutra', 335, 85, 0, 0, 30, 'Dispensa', 50),
  carta_riso:       F('Carta di riso', 330, 0.5, 80, 0.5, 15, 'Dispensa', 100),
  olive:            F('Olive taggiasche', 200, 1, 2, 20, 14, 'Dispensa', 150, { life: 14 }),
  lenticchie_secche:F('Lenticchie secche', 330, 24, 50, 1.5, 3.5, 'Dispensa', 500),
  miele:            F('Miele', 304, 0.3, 82, 0, 9, 'Dispensa di base', 250, { staple: true }),

  patate:           F('Patate', 77, 2, 17, 0.1, 1.3, 'Frutta e verdura', 1000, { life: 20 }),
  zucca:            F('Zucca', 26, 1, 6, 0.1, 1.8, 'Frutta e verdura', 500, { life: 7 }),
  zucchine:         F('Zucchine', 17, 1.2, 3, 0.2, 1.9, 'Frutta e verdura', 500, { life: 6 }),
  carote:           F('Carote', 41, 0.9, 10, 0.2, 1.3, 'Frutta e verdura', 1000, { life: 14 }),
  cipolla:          F('Cipolla / porro', 40, 1.1, 9, 0.1, 1.5, 'Frutta e verdura', 1000, { life: 20 }),
  melanzane:        F('Melanzane', 25, 1, 6, 0.2, 2.5, 'Frutta e verdura', 500, { piece: 300, life: 6 }),
  peperoni:         F('Peperoni', 31, 1, 6, 0.3, 3, 'Frutta e verdura', 500, { piece: 200, life: 6 }),
  pomodorini:       F('Pomodorini', 20, 0.9, 4, 0.2, 3, 'Frutta e verdura', 250, { life: 6 }),
  pomodori:         F('Pomodori', 18, 0.9, 3.5, 0.2, 2.5, 'Frutta e verdura', 500, { piece: 150, life: 6 }),
  funghi:           F('Funghi champignon', 22, 3, 3, 0.3, 6, 'Frutta e verdura', 250, { life: 4 }),
  cavolfiore:       F('Cavolfiore', 25, 2, 5, 0.3, 2.5, 'Frutta e verdura', 500, { life: 6 }),
  insalata:         F('Insalata mista', 15, 1.4, 2, 0.2, 6, 'Frutta e verdura', 150, { life: 4 }),
  piselli:          F('Piselli surgelati', 80, 5, 14, 0.4, 2.5, 'Frutta e verdura', 450, { frozen: true, thaw: 0 }),
  avocado:          F('Avocado', 160, 2, 9, 15, 8, 'Frutta e verdura', 150, { piece: 150, life: 3 }),
  limone:           F('Limone', 29, 1, 9, 0.3, 3, 'Frutta e verdura', 100, { piece: 100, life: 14 }),
  mela:             F('Mela', 52, 0.3, 14, 0.2, 2, 'Frutta e verdura', 180, { piece: 180, life: 10 }),
  banana:           F('Banana', 89, 1, 23, 0.3, 1.8, 'Frutta e verdura', 120, { piece: 120, life: 5 }),
  frutti_bosco:     F('Frutti di bosco surgelati', 45, 1, 8, 0.5, 5, 'Frutta e verdura', 300, { frozen: true, thaw: 0 }),
  erbe:             F('Erbe fresche (prezzemolo, basilico...)', 30, 3, 4, 0.5, 20, 'Frutta e verdura', 40, { life: 5 }),

  olio_evo:         F('Olio extravergine', 884, 0, 0, 100, 7, 'Dispensa di base', 1000, { staple: true }),
  spezie:           F('Spezie, sale, pepe', 0, 0, 0, 0, 0, 'Dispensa di base', 100, { staple: true }),
  salsa_soia:       F('Salsa di soia', 60, 8, 6, 0, 4, 'Dispensa di base', 250, { staple: true }),
  aglio:            F('Aglio', 130, 6, 30, 0.5, 10, 'Dispensa di base', 50, { staple: true }),
  zenzero:          F('Zenzero', 80, 1.8, 18, 0.8, 8, 'Dispensa di base', 50, { staple: true }),
  dolcificante:     F('Eritritolo / stevia', 0, 0, 0, 0, 10, 'Dispensa di base', 200, { staple: true }),
  lievito:          F('Lievito per dolci', 60, 0, 14, 0, 6, 'Dispensa di base', 50, { staple: true }),
  amido_mais:       F('Amido di mais', 360, 0, 88, 0, 3, 'Dispensa di base', 250, { staple: true }),
  salse_gamberi:    F('Sriracha / salsa chili', 90, 2, 18, 1, 6, 'Dispensa di base', 200, { staple: true }),
  maionese_light:   F('Maionese light', 280, 1, 10, 26, 5, 'Dispensa di base', 250, { staple: true }),
  brodo:            F('Brodo vegetale', 5, 0.2, 1, 0, 2, 'Dispensa di base', 1000, { staple: true }),
};

export const foodName = (k) => FOODS[k]?.name ?? k;
