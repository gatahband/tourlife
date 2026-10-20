// realplayers.js — the real ATP top 100 (singles ranking of 5 October 2026, via livetennis.io).
// They play at ATP 250s and above. To update: replace the list below (rank, name, country, hand, age, style).
// Styles are the playstyle names in player.js (STYLES) and describe how each player builds points, not
// how good they are. Tagged October 2026 from ATP match reporting, player interviews and the Tennis
// Abstract Match Charting Project.

const ATP_DATE = '5 October 2026';
const ATP_TOP = [
  [1, 'Jannik Sinner', 'ITA', 'R', 25, 'Aggressive Baseliner'], [2, 'Alexander Zverev', 'GER', 'R', 29, 'Solid Baseliner'],
  [3, 'Carlos Alcaraz', 'ESP', 'R', 23, 'All-Court'], [4, 'Ben Shelton', 'USA', 'L', 24, 'Serve +1 Attacker'],
  [5, 'Daniil Medvedev', 'NEU', 'R', 30, 'Counterpuncher'], [6, 'Felix Auger-Aliassime', 'CAN', 'R', 26, 'Serve +1 Attacker'],
  [7, 'Flavio Cobolli', 'ITA', 'R', 24, 'Aggressive Baseliner'], [8, 'Frances Tiafoe', 'USA', 'R', 28, 'All-Court'],
  [9, 'Alex de Minaur', 'AUS', 'R', 27, 'Counterpuncher'], [10, 'Arthur Fils', 'FRA', 'R', 22, 'Aggressive Baseliner'],
  [11, 'Novak Djokovic', 'SRB', 'R', 39, 'All-Court'], [12, 'Taylor Fritz', 'USA', 'R', 29, 'Serve +1 Attacker'],
  [13, 'Rafael Jodar', 'ESP', 'R', 20, 'Aggressive Baseliner'], [14, 'Valentin Vacherot', 'MON', 'R', 28, 'Solid Baseliner'],
  [15, 'Jakub Mensik', 'CZE', 'R', 21, 'Serve +1 Attacker'], [16, 'Learner Tien', 'USA', 'L', 21, 'Counterpuncher'],
  [17, 'Tommy Paul', 'USA', 'R', 29, 'All-Court'], [18, 'Brandon Nakashima', 'USA', 'R', 25, 'Solid Baseliner'],
  [19, 'Jiri Lehecka', 'CZE', 'R', 25, 'First-Strike Attacker'], [20, 'Francisco Cerundolo', 'ARG', 'R', 28, 'Aggressive Baseliner'],
  [21, 'Luciano Darderi', 'ITA', 'R', 24, 'Heavy-Topspin Attacker'], [22, 'Alexander Bublik', 'KAZ', 'R', 29, 'Creative Shotmaker'],
  [23, 'Andrey Rublev', 'NEU', 'R', 29, 'Aggressive Baseliner'], [24, 'Casper Ruud', 'NOR', 'R', 28, 'Heavy-Topspin Baseliner'],
  [25, 'Lorenzo Musetti', 'ITA', 'R', 24, 'Variety / Slice-Heavy'], [26, 'Alejandro Davidovich Fokina', 'ESP', 'R', 27, 'All-Court'],
  [27, 'Karen Khachanov', 'NEU', 'R', 30, 'Aggressive Baseliner'], [28, 'Alexander Blockx', 'BEL', 'R', 21, 'Aggressive Baseliner'],
  [29, 'Joao Fonseca', 'BRA', 'R', 20, 'Aggressive Baseliner'], [30, 'Alejandro Tabilo', 'CHI', 'L', 29, 'Flat Attacker'],
  [31, 'Tomas Martin Etcheverry', 'ARG', 'R', 27, 'Heavy-Topspin Baseliner'], [32, 'Ugo Humbert', 'FRA', 'L', 28, 'Flat Attacker'],
  [33, 'Arthur Rinderknech', 'FRA', 'R', 31, 'Serve +1 Attacker'], [34, 'Hubert Hurkacz', 'POL', 'R', 29, 'Serve-Dominant'],
  [35, 'Alex Michelsen', 'USA', 'R', 22, 'All-Court'], [36, 'Ignacio Buse', 'PER', 'R', 22, 'Aggressive Baseliner'],
  [37, 'Arthur Fery', 'GBR', 'R', 24, 'All-Court'], [38, 'Matteo Arnaldi', 'ITA', 'R', 25, 'Aggressive Baseliner'],
  [39, 'Zizou Bergs', 'BEL', 'R', 27, 'First-Strike Attacker'], [40, 'Cameron Norrie', 'GBR', 'L', 31, 'Solid Baseliner'],
  [41, 'Botic van de Zandschulp', 'NED', 'R', 31, 'Flat Attacker'], [42, 'Denis Shapovalov', 'CAN', 'L', 27, 'First-Strike Attacker'],
  [43, 'Stefanos Tsitsipas', 'GRE', 'R', 28, 'Serve +1 Attacker'], [44, 'Daniel Merida Aguilar', 'ESP', 'R', 22, 'Aggressive Baseliner'],
  [45, 'Luca van Assche', 'FRA', 'R', 22, 'Counterpuncher'], [46, 'Matteo Berrettini', 'ITA', 'R', 30, 'Serve +1 Attacker'],
  [47, 'Mariano Navone', 'ARG', 'R', 25, 'Defensive Grinder'], [48, 'Quentin Halys', 'FRA', 'R', 30, 'First-Strike Attacker'],
  [49, 'Jaume Munar', 'ESP', 'R', 29, 'Solid Baseliner'], [50, 'Raphael Collignon', 'BEL', 'R', 24, 'All-Court'],
  [51, 'Nuno Borges', 'POR', 'R', 29, 'All-Court'], [52, 'Adolfo Daniel Vallejo', 'PAR', 'R', 22, 'Aggressive Baseliner'],
  [53, 'Sebastian Baez', 'ARG', 'R', 26, 'Heavy-Topspin Baseliner'], [54, 'Thiago Agustin Tirante', 'ARG', 'R', 25, 'Aggressive Baseliner'],
  [55, 'Juan Manuel Cerundolo', 'ARG', 'L', 25, 'Heavy-Topspin Baseliner'], [56, 'Arthur Gea', 'FRA', 'R', 22, 'Serve +1 Attacker'],
  [57, 'Yannick Hanfmann', 'GER', 'R', 35, 'First-Strike Attacker'], [58, 'Tallon Griekspoor', 'NED', 'R', 30, 'Serve +1 Attacker'],
  [59, 'Jan-Lennard Struff', 'GER', 'R', 36, 'Net Attacker'], [60, 'Jaime Faria', 'POR', 'R', 23, 'Aggressive Baseliner'],
  [61, 'Miomir Kecmanovic', 'SRB', 'R', 27, 'Solid Baseliner'], [62, 'Roman Andres Burruchaga', 'ARG', 'R', 24, 'Defensive Grinder'],
  [63, 'Fabian Marozsan', 'HUN', 'R', 27, 'First-Strike Attacker'], [64, 'James Duckworth', 'AUS', 'R', 34, 'Serve +1 Attacker'],
  [65, 'Pablo Carreno Busta', 'ESP', 'R', 35, 'Solid Baseliner'], [66, 'Ethan Quinn', 'USA', 'R', 22, 'First-Strike Attacker'],
  [67, 'Daniel Altmaier', 'GER', 'R', 28, 'Heavy-Topspin Baseliner'], [68, 'Vit Kopriva', 'CZE', 'R', 29, 'Defensive Grinder'],
  [69, 'Facundo Diaz Acosta', 'ARG', 'L', 26, 'Heavy-Topspin Baseliner'], [70, 'Kamil Majchrzak', 'POL', 'R', 30, 'Solid Baseliner'],
  [71, 'Corentin Moutet', 'FRA', 'L', 27, 'Variety / Slice-Heavy'], [73, 'Martin Landaluce', 'ESP', 'R', 20, 'Aggressive Baseliner'],
  [74, 'Sebastian Korda', 'USA', 'R', 26, 'Flat Attacker'], [75, 'Tomas Machac', 'CZE', 'R', 26, 'All-Court'],
  [77, 'Camilo Ugo Carabelli', 'ARG', 'R', 27, 'Heavy-Topspin Baseliner'], [78, 'Hamad Medjedovic', 'SRB', 'R', 23, 'First-Strike Attacker'],
  [79, 'Roman Safiullin', 'NEU', 'R', 29, 'Flat Attacker'], [80, 'Marin Cilic', 'CRO', 'R', 38, 'Serve +1 Attacker'],
  [81, 'Aleksandar Kovacevic', 'USA', 'R', 28, 'First-Strike Attacker'], [82, 'Zachary Svajda', 'USA', 'R', 24, 'Counterpuncher'],
  [83, 'Adrian Mannarino', 'FRA', 'L', 38, 'Counterpuncher'], [84, 'Alex Molcan', 'SVK', 'L', 29, 'Counterpuncher'],
  [85, 'Rinky Hijikata', 'AUS', 'R', 25, 'All-Court'], [86, 'Mattia Bellucci', 'ITA', 'L', 25, 'Creative Shotmaker'],
  [87, 'Lorenzo Sonego', 'ITA', 'R', 31, 'Serve +1 Attacker'], [88, 'Marcos Giron', 'USA', 'R', 33, 'Solid Baseliner'],
  [89, 'Hugo Gaston', 'FRA', 'L', 26, 'Variety / Slice-Heavy'], [90, 'Marco Trungelliti', 'ARG', 'R', 36, 'Defensive Grinder'],
  [91, 'Jan Choinski', 'GBR', 'R', 30, 'Serve +1 Attacker'], [95, 'Jesper de Jong', 'NED', 'R', 26, 'Solid Baseliner'],
  [96, 'Jacob Fearnley', 'GBR', 'R', 25, 'Counterpuncher'], [98, 'Adam Walton', 'AUS', 'R', 27, 'Solid Baseliner'],
  [99, 'Terence Atmane', 'FRA', 'L', 24, 'First-Strike Attacker'], [101, 'Coleman Wong', 'HKG', 'R', 22, 'Aggressive Baseliner'],
  [102, 'Jenson Brooksby', 'USA', 'R', 26, 'Counterpuncher'], [104, 'Martin Damm', 'USA', 'L', 23, 'Serve-Dominant'],
  [105, 'Valentin Royer', 'FRA', 'R', 25, 'Net Attacker'], [109, 'Sho Shimabukuro', 'JPN', 'R', 29, 'First-Strike Attacker'],
  [111, 'Alexander Shevchenko', 'KAZ', 'R', 26, 'Aggressive Baseliner'], [115, 'Aleksandar Vukic', 'AUS', 'R', 30, 'Serve +1 Attacker'],
];

// Hybrids: the second half of the label is a secondary trait (shown next to the style, and it shapes points).
const REAL_TRAIT = { 'Alexander Zverev': 'Powerful Serve', 'Valentin Vacherot': 'Powerful Serve',
  'Adrian Mannarino': 'Flat Hitting', 'Jacob Fearnley': 'Aggressive' };
// Favorite surface when it isn't the one their style suggests.
const REAL_FAV = { 'Francisco Cerundolo': 'clay', 'Alejandro Tabilo': 'clay', 'Ignacio Buse': 'clay', 'Daniel Merida Aguilar': 'clay',
  'Jaume Munar': 'clay', 'Adolfo Daniel Vallejo': 'clay', 'Thiago Agustin Tirante': 'clay', 'Yannick Hanfmann': 'clay',
  'Alex Molcan': 'clay', 'Jaime Faria': 'clay', 'Pablo Carreno Busta': 'clay', 'Lorenzo Musetti': 'clay', 'Jesper de Jong': 'clay',
  'Matteo Berrettini': 'grass', 'Jan-Lennard Struff': 'hard' };
// Provisional tags: less direct evidence, worth checking against video or shot-level data.
const REAL_PROVISIONAL = new Set(['Thiago Agustin Tirante', 'Jaime Faria', 'Roman Andres Burruchaga', 'Vit Kopriva', 'Kamil Majchrzak',
  'Alex Molcan', 'Marco Trungelliti', 'Jan Choinski', 'Jesper de Jong', 'Adam Walton', 'Coleman Wong']);

// Countries some of them play for that the game doesn't otherwise use (flags only).
const EXTRA_NATIONS = [['MON', '🇲🇨', 'Monaco'], ['PER', '🇵🇪', 'Peru'], ['PAR', '🇵🇾', 'Paraguay'],
  ['HKG', '🇭🇰', 'Hong Kong'], ['SVK', '🇸🇰', 'Slovakia'], ['NEU', '🏳️', 'Neutral']];

// Stat shape per style (added to the level their ranking implies), in ATTR_KEYS order:
// serve, ground, ret, net, stam, mental, iq.
const REAL_STYLE = {
  'Serve-Dominant':          { bias: [7, 1, -3, 2, -2, 0, -1], fav: 'grass', plan: { serve: 'big', spin: 'flat', aggression: 'aggressive' } },
  'Serve +1 Attacker':       { bias: [5, 4, -2, 0, -2, 0, -1], fav: 'hard', plan: { serve: 'big', aggression: 'aggressive' } },
  'First-Strike Attacker':   { bias: [4, 3, 2, -1, -3, 0, -1], fav: 'hard', plan: { aggression: 'aggressive', spin: 'flat', returnPos: 'inside' } },
  'Aggressive Baseliner':    { bias: [2, 6, 1, -2, 0, 0, -1], fav: 'hard', plan: { aggression: 'aggressive' } },
  'Flat Attacker':           { bias: [2, 6, 0, -1, -1, -1, -2], fav: 'hard', plan: { aggression: 'aggressive', spin: 'flat' } },
  'Solid Baseliner':         { bias: [1, 4, 1, -3, 2, 2, 0], fav: 'hard', plan: {} },
  'Counterpuncher':          { bias: [-4, 1, 5, -2, 5, 2, 2], fav: 'hard', plan: { aggression: 'patient', returnPos: 'deep', spin: 'topspin' } },
  'Defensive Grinder':       { bias: [-4, 2, 2, -4, 7, 2, 0], fav: 'clay', plan: { aggression: 'patient', returnPos: 'deep', spin: 'topspin' } },
  'Heavy-Topspin Baseliner': { bias: [-3, 4, 0, -3, 4, 0, 2], fav: 'clay', plan: { aggression: 'patient', spin: 'topspin', drops: 'often' } },
  'Heavy-Topspin Attacker':  { bias: [0, 6, 0, -2, 2, -1, -2], fav: 'clay', plan: { aggression: 'aggressive', spin: 'topspin' } },
  'All-Court':               { bias: [1, 2, 1, 4, 0, 1, 3], fav: 'hard', plan: { net: 'often', drops: 'sometimes' } },
  'Net Attacker':            { bias: [0, 1, 0, 6, -1, 0, 1], fav: 'grass', plan: { net: 'often', aggression: 'aggressive' } },
  'Serve-and-Volley':        { bias: [5, -1, -1, 6, -2, 0, 0], fav: 'grass', plan: { serve: 'big', net: 'often' } },
  'Variety / Slice-Heavy':   { bias: [-2, -1, 1, 3, -1, 1, 6], fav: 'grass', plan: { drops: 'often', net: 'often', spin: 'mixed' } },
  'Creative Shotmaker':      { bias: [2, -1, -1, 3, -2, -2, 6], fav: 'grass', plan: { drops: 'often', underarm: 'sometimes', spin: 'mixed' } },
};
// What a researched trait does to the stat shape and plan.
const REAL_TRAIT_SHAPE = { 'Powerful Serve': { bias: [3, 0, 0, 0, 0, 0, 0], plan: { serve: 'big' } },
  'Flat Hitting': { bias: [0, 1, 0, 0, 0, 0, -1], plan: { spin: 'flat' } }, Aggressive: { bias: [0, 2, 0, 0, -1, 0, -1], plan: { aggression: 'balanced' } } };

// The top two are in a league of their own; everyone else is rated by ranking on a steep curve
// (No. 2 about 93, top 10 about 87–90, No. 50 about 79, No. 100 about 74). Real players can go past
// the 95 cap that applies to your own stats.
// Former world No. 1s on tour: legends. They read your plan faster than you read theirs.
const LEGENDS = new Set(['Jannik Sinner', 'Carlos Alcaraz', 'Novak Djokovic', 'Daniil Medvedev']);
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
  const lvl = realLevel(rank, name), st = REAL_STYLE[style] || REAL_STYLE['Aggressive Baseliner'];
  const trait = REAL_TRAIT[name], ts = REAL_TRAIT_SHAPE[trait] || { bias: [0, 0, 0, 0, 0, 0, 0], plan: {} };
  const bias = st.bias.map((b, i) => b + ts.bias[i]);
  const elite = !!REAL_OVR[name]; // no weak spots: style shows only as a slight lean
  let h = nameHash(name);
  const wob = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return (h % 1000) / 1000 * 3 - 1.5; };
  const attrs = Object.fromEntries(ATTR_KEYS.map((k, i) => [k, Math.round(clamp(lvl + (elite ? Math.min(0, bias[i]) * 0.2 : bias[i] + wob()), 30, 99))]));
  const fav = REAL_FAV[name] || st.fav;
  return {
    id: `atp-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`, name, nation, hand: hand === 'L' ? 'left' : 'right',
    age, attrs, atp: true, atpRank: rank, temperament: ['stoic', 'fiery', 'robotic', 'stoic'][nameHash(name) % 4],
    fav, worst: fav === 'clay' ? 'grass' : 'clay', curve: 'peak', formSd: 0.018,
    plan: { ...DEFAULT_PLAN, ...st.plan, ...ts.plan }, seed: null,
    legend: LEGENDS.has(name) || undefined, realStyle: style, realTrait: trait || null, provisional: REAL_PROVISIONAL.has(name) || undefined,
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
