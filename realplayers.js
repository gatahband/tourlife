// realplayers.js — the real ATP top 100 (singles ranking of 5 October 2026, via livetennis.io).
// They play at ATP 250s and above. To update: replace the list below (rank, name, country, hand, age, style).
// Styles: serve (big server), power (aggressive baseliner), counter (defender/counterpuncher),
// allcourt, clay (clay-court grinder), crafty (touch and variety).

const ATP_DATE = '5 October 2026';
const ATP_TOP = [
  [1, 'Jannik Sinner', 'ITA', 'R', 25, 'power'], [2, 'Alexander Zverev', 'GER', 'R', 29, 'serve'],
  [3, 'Carlos Alcaraz', 'ESP', 'R', 23, 'allcourt'], [4, 'Ben Shelton', 'USA', 'L', 24, 'serve'],
  [5, 'Daniil Medvedev', 'NEU', 'R', 30, 'counter'], [6, 'Felix Auger-Aliassime', 'CAN', 'R', 26, 'serve'],
  [7, 'Flavio Cobolli', 'ITA', 'R', 24, 'power'], [8, 'Frances Tiafoe', 'USA', 'R', 28, 'allcourt'],
  [9, 'Alex de Minaur', 'AUS', 'R', 27, 'counter'], [10, 'Arthur Fils', 'FRA', 'R', 22, 'power'],
  [11, 'Novak Djokovic', 'SRB', 'R', 39, 'allcourt'], [12, 'Taylor Fritz', 'USA', 'R', 29, 'serve'],
  [13, 'Rafael Jodar', 'ESP', 'R', 20, 'power'], [14, 'Valentin Vacherot', 'MON', 'R', 28, 'serve'],
  [15, 'Jakub Mensik', 'CZE', 'R', 21, 'serve'], [16, 'Learner Tien', 'USA', 'L', 21, 'counter'],
  [17, 'Tommy Paul', 'USA', 'R', 29, 'allcourt'], [18, 'Brandon Nakashima', 'USA', 'R', 25, 'power'],
  [19, 'Jiri Lehecka', 'CZE', 'R', 25, 'power'], [20, 'Francisco Cerundolo', 'ARG', 'R', 28, 'clay'],
  [21, 'Luciano Darderi', 'ITA', 'R', 24, 'clay'], [22, 'Alexander Bublik', 'KAZ', 'R', 29, 'crafty'],
  [23, 'Andrey Rublev', 'NEU', 'R', 29, 'power'], [24, 'Casper Ruud', 'NOR', 'R', 28, 'clay'],
  [25, 'Lorenzo Musetti', 'ITA', 'R', 24, 'crafty'], [26, 'Alejandro Davidovich Fokina', 'ESP', 'R', 27, 'counter'],
  [27, 'Karen Khachanov', 'NEU', 'R', 30, 'power'], [28, 'Alexander Blockx', 'BEL', 'R', 21, 'power'],
  [29, 'Joao Fonseca', 'BRA', 'R', 20, 'power'], [30, 'Alejandro Tabilo', 'CHI', 'L', 29, 'clay'],
  [31, 'Tomas Martin Etcheverry', 'ARG', 'R', 27, 'clay'], [32, 'Ugo Humbert', 'FRA', 'L', 28, 'power'],
  [33, 'Arthur Rinderknech', 'FRA', 'R', 31, 'serve'], [34, 'Hubert Hurkacz', 'POL', 'R', 29, 'serve'],
  [35, 'Alex Michelsen', 'USA', 'R', 22, 'allcourt'], [36, 'Ignacio Buse', 'PER', 'R', 22, 'clay'],
  [37, 'Arthur Fery', 'GBR', 'R', 24, 'allcourt'], [38, 'Matteo Arnaldi', 'ITA', 'R', 25, 'counter'],
  [39, 'Zizou Bergs', 'BEL', 'R', 27, 'power'], [40, 'Cameron Norrie', 'GBR', 'L', 31, 'counter'],
  [41, 'Botic van de Zandschulp', 'NED', 'R', 31, 'allcourt'], [42, 'Denis Shapovalov', 'CAN', 'L', 27, 'power'],
  [43, 'Stefanos Tsitsipas', 'GRE', 'R', 28, 'allcourt'], [44, 'Daniel Merida Aguilar', 'ESP', 'R', 22, 'clay'],
  [45, 'Luca van Assche', 'FRA', 'R', 22, 'counter'], [46, 'Matteo Berrettini', 'ITA', 'R', 30, 'serve'],
  [47, 'Mariano Navone', 'ARG', 'R', 25, 'clay'], [48, 'Quentin Halys', 'FRA', 'R', 30, 'serve'],
  [49, 'Jaume Munar', 'ESP', 'R', 29, 'clay'], [50, 'Raphael Collignon', 'BEL', 'R', 24, 'allcourt'],
  [51, 'Nuno Borges', 'POR', 'R', 29, 'counter'], [52, 'Adolfo Daniel Vallejo', 'PAR', 'R', 22, 'clay'],
  [53, 'Sebastian Baez', 'ARG', 'R', 26, 'clay'], [54, 'Thiago Agustin Tirante', 'ARG', 'L', 25, 'clay'],
  [55, 'Juan Manuel Cerundolo', 'ARG', 'L', 25, 'clay'], [56, 'Arthur Gea', 'FRA', 'R', 22, 'power'],
  [57, 'Yannick Hanfmann', 'GER', 'R', 35, 'clay'], [58, 'Tallon Griekspoor', 'NED', 'R', 30, 'serve'],
  [59, 'Jan-Lennard Struff', 'GER', 'R', 36, 'serve'], [60, 'Jaime Faria', 'POR', 'R', 23, 'power'],
  [61, 'Miomir Kecmanovic', 'SRB', 'R', 27, 'counter'], [62, 'Roman Andres Burruchaga', 'ARG', 'R', 24, 'clay'],
  [63, 'Fabian Marozsan', 'HUN', 'R', 27, 'power'], [64, 'James Duckworth', 'AUS', 'R', 34, 'serve'],
  [65, 'Pablo Carreno Busta', 'ESP', 'R', 35, 'counter'], [66, 'Ethan Quinn', 'USA', 'R', 22, 'serve'],
  [67, 'Daniel Altmaier', 'GER', 'R', 28, 'clay'], [68, 'Vit Kopriva', 'CZE', 'R', 29, 'clay'],
  [69, 'Facundo Diaz Acosta', 'ARG', 'L', 26, 'clay'], [70, 'Kamil Majchrzak', 'POL', 'R', 30, 'counter'],
  [71, 'Corentin Moutet', 'FRA', 'L', 27, 'crafty'], [73, 'Martin Landaluce', 'ESP', 'R', 20, 'power'],
  [74, 'Sebastian Korda', 'USA', 'R', 26, 'power'], [75, 'Tomas Machac', 'CZE', 'R', 26, 'allcourt'],
  [77, 'Camilo Ugo Carabelli', 'ARG', 'R', 27, 'clay'], [78, 'Hamad Medjedovic', 'SRB', 'R', 23, 'serve'],
  [79, 'Roman Safiullin', 'NEU', 'R', 29, 'power'], [80, 'Marin Cilic', 'CRO', 'R', 38, 'serve'],
  [81, 'Aleksandar Kovacevic', 'USA', 'R', 28, 'power'], [82, 'Zachary Svajda', 'USA', 'R', 24, 'counter'],
  [83, 'Adrian Mannarino', 'FRA', 'L', 38, 'crafty'], [84, 'Alex Molcan', 'SVK', 'L', 29, 'clay'],
  [85, 'Rinky Hijikata', 'AUS', 'R', 25, 'allcourt'], [86, 'Mattia Bellucci', 'ITA', 'L', 25, 'crafty'],
  [87, 'Lorenzo Sonego', 'ITA', 'R', 31, 'allcourt'], [88, 'Marcos Giron', 'USA', 'R', 33, 'counter'],
  [89, 'Hugo Gaston', 'FRA', 'L', 26, 'crafty'], [90, 'Marco Trungelliti', 'ARG', 'R', 36, 'clay'],
  [91, 'Jan Choinski', 'GBR', 'R', 30, 'allcourt'], [95, 'Jesper de Jong', 'NED', 'R', 26, 'counter'],
  [96, 'Jacob Fearnley', 'GBR', 'R', 25, 'power'], [98, 'Adam Walton', 'AUS', 'R', 27, 'allcourt'],
  [99, 'Terence Atmane', 'FRA', 'L', 24, 'power'], [101, 'Coleman Wong', 'HKG', 'R', 22, 'allcourt'],
  [102, 'Jenson Brooksby', 'USA', 'R', 26, 'counter'], [104, 'Martin Damm', 'USA', 'L', 23, 'serve'],
  [105, 'Valentin Royer', 'FRA', 'R', 25, 'power'], [109, 'Sho Shimabukuro', 'JPN', 'R', 29, 'counter'],
  [111, 'Alexander Shevchenko', 'KAZ', 'R', 26, 'power'], [115, 'Aleksandar Vukic', 'AUS', 'R', 30, 'serve'],
];

// Countries some of them play for that the game doesn't otherwise use (flags only).
const EXTRA_NATIONS = [['MON', '🇲🇨', 'Monaco'], ['PER', '🇵🇪', 'Peru'], ['PAR', '🇵🇾', 'Paraguay'],
  ['HKG', '🇭🇰', 'Hong Kong'], ['SVK', '🇸🇰', 'Slovakia'], ['NEU', '🏳️', 'Neutral']];

// Stat shape per style (added to the level their ranking implies), in ATTR_KEYS order:
// serve, ground, ret, net, stam, mental, iq.
const REAL_STYLE = {
  serve:    { bias: [7, 1, -3, 2, -2, 0, -1], fav: 'grass', plan: { serve: 'big', spin: 'flat', aggression: 'aggressive' } },
  power:    { bias: [2, 6, 1, -2, 0, 0, -1], fav: 'hard', plan: { aggression: 'aggressive', spin: 'flat' } },
  counter:  { bias: [-4, 1, 5, -2, 5, 2, 2], fav: 'hard', plan: { aggression: 'patient', returnPos: 'deep', spin: 'topspin' } },
  allcourt: { bias: [1, 2, 1, 4, 0, 1, 3], fav: 'hard', plan: { net: 'often', drops: 'sometimes' } },
  clay:     { bias: [-3, 3, 1, -3, 5, 1, 1], fav: 'clay', plan: { aggression: 'patient', spin: 'topspin', drops: 'often' } },
  crafty:   { bias: [0, -1, 1, 4, -1, 0, 6], fav: 'grass', plan: { drops: 'often', net: 'often', spin: 'mixed' } },
};

// The top two are in a league of their own; everyone else is rated by ranking on a steep curve
// (No. 2 about 93, top 10 about 87–90, No. 50 about 79, No. 100 about 74). Real players can go past
// the 95 cap that applies to your own stats.
const REAL_OVR = { 'Jannik Sinner': 99, 'Carlos Alcaraz': 99 };
const REAL_CURVE = [[2, 93], [5, 90], [10, 87], [20, 84], [50, 79], [100, 74], [120, 72]];
function realLevel(rank, name) {
  if (REAL_OVR[name]) return REAL_OVR[name];
  for (let i = 1; i < REAL_CURVE.length; i++) {
    const [r0, o0] = REAL_CURVE[i - 1], [r1, o1] = REAL_CURVE[i];
    if (rank <= r1) return o0 + (o1 - o0) * Math.log(Math.max(rank, r0) / r0) / Math.log(r1 / r0);
  }
  return 72;
}

// A stable little wobble per player so the same name always gets the same ratings.
function nameHash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }

function realPlayer([rank, name, nation, hand, age, style]) {
  const lvl = realLevel(rank, name), st = REAL_STYLE[style] || REAL_STYLE.power;
  const elite = !!REAL_OVR[name]; // no weak spots: style shows only as a slight lean
  let h = nameHash(name);
  const wob = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return (h % 1000) / 1000 * 3 - 1.5; };
  const attrs = Object.fromEntries(ATTR_KEYS.map((k, i) => [k, Math.round(clamp(lvl + (elite ? Math.min(0, st.bias[i]) * 0.2 : st.bias[i] + wob()), 30, 99))]));
  return {
    id: `atp-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`, name, nation, hand: hand === 'L' ? 'left' : 'right',
    age, attrs, atp: true, atpRank: rank, temperament: ['stoic', 'fiery', 'robotic', 'stoic'][nameHash(name) % 4],
    fav: st.fav, worst: st.fav === 'clay' ? 'grass' : 'clay', curve: 'peak', formSd: 0.018,
    plan: { ...DEFAULT_PLAN, ...st.plan }, seed: null,
  };
}

// Swap generated players for real ones at ATP 250s and above. Stronger events draw more of the top
// names. Call before the draw is made; seeding then follows their ATP ranking.
const REAL_SHARE = { ATP250: 0.5, ATP500: 0.65, M1000: 0.85, GS: 0.85 };
const REAL_RANGE = { ATP250: [12, 115], ATP500: [1, 80], M1000: [1, 115], GS: [1, 115] };
function mixInReal(entrants, tier, playerRank) {
  const share = REAL_SHARE[tier];
  if (!share) return;
  const [lo, hi] = REAL_RANGE[tier];
  const taken = new Set(entrants.map(e => e.name));
  // Better players are more likely to enter (the top few skip some 250s).
  const pool = ATP_TOP.filter(r => r[0] >= lo && r[0] <= hi && !taken.has(r[1]))
    .map(r => ({ r, k: Math.random() * (1 + r[0] / 60) })).sort((a, b) => a.k - b.k).map(x => realPlayer(x.r));
  const slots = entrants.map((e, i) => i).filter(i => i > 0 && !entrants[i].isPlayer).sort(() => Math.random() - 0.5);
  const n = Math.min(Math.round((entrants.length - 1) * share), pool.length, slots.length);
  for (let k = 0; k < n; k++) entrants[slots[k]] = pool[k];
  const strength = p => p.isPlayer ? rankToOvr(playerRank) : p.atpRank ? 200 - p.atpRank : overall(p);
  entrants.forEach(e => { e.seed = null; });
  [...entrants].sort((a, b) => strength(b) - strength(a)).forEach((p, i) => { p.seed = i < 8 && strength(p) > 0 ? i + 1 : null; });
}
