// calendar.js — the season calendar (52 weeks following the real tennis year), travel between venues,
// training sessions, and the overall-rating level guide.

// --- Venues -------------------------------------------------------------------
// [city, nation, surface, indoor]
const VENUES = [
  // Hard
  ['Monastir', 'TUN', 'hard'], ['Sharm El Sheikh', 'EGY', 'hard'], ['Antalya', 'TUR', 'hard'],
  ['Rancho Santa Fe', 'USA', 'hard'], ['Tampa', 'USA', 'hard'], ['Calabasas', 'USA', 'hard'], ['Lakewood', 'USA', 'hard'],
  ['Canberra', 'AUS', 'hard'], ['Traralgon', 'AUS', 'hard'], ['Bendigo', 'AUS', 'hard'],
  ['New Delhi', 'IND', 'hard'], ['Bengaluru', 'IND', 'hard'], ['Kashiwa', 'JPN', 'hard'], ['Tsukuba', 'JPN', 'hard'],
  ['Changwon', 'KOR', 'hard'], ['Shenzhen', 'CHN', 'hard'], ['Cancún', 'MEX', 'hard'], ['Toronto', 'CAN', 'hard'],
  ['Johannesburg', 'RSA', 'hard'], ['Lagos', 'NGA', 'hard'],
  // Indoor hard
  ['Oslo', 'NOR', 'hard', true], ['Helsinki', 'FIN', 'hard', true], ['Stockholm', 'SWE', 'hard', true],
  ['Bergamo', 'ITA', 'hard', true], ['Poitiers', 'FRA', 'hard', true], ['Sunderland', 'GBR', 'hard', true],
  ['Aktobe', 'KAZ', 'hard', true], ['Ostrava', 'CZE', 'hard', true],
  // Clay
  ['Cairo', 'EGY', 'clay'], ['Hammamet', 'TUN', 'clay'], ['Antalya', 'TUR', 'clay'], ['Madrid', 'ESP', 'clay'],
  ['Valencia', 'ESP', 'clay'], ['Santa Margherita di Pula', 'ITA', 'clay'], ['Rome', 'ITA', 'clay'], ['Oeiras', 'POR', 'clay'],
  ['Belgrade', 'SRB', 'clay'], ['Novi Sad', 'SRB', 'clay'], ['Opatija', 'CRO', 'clay'], ['Prague', 'CZE', 'clay'],
  ['Sofia', 'BUL', 'clay'], ['Bucaramanga', 'COL', 'clay'], ['Santiago', 'CHI', 'clay'], ['Buenos Aires', 'ARG', 'clay'],
  ['Curitiba', 'BRA', 'clay'], ['Shymkent', 'KAZ', 'clay'], ['Marrakech', 'MAR', 'clay'], ['Heraklion', 'GRE', 'clay'],
  ['Poznań', 'POL', 'clay'], ['Kassel', 'GER', 'clay'], ['Wels', 'AUT', 'clay'], ['Båstad', 'SWE', 'clay'],
  // Grass
  ['Nottingham', 'GBR', 'grass'], ['Ilkley', 'GBR', 'grass'], ['Roehampton', 'GBR', 'grass'], ['Ede', 'NED', 'grass'],
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const seasonOfWeek = week => Math.floor((week - 1) / 52) + 1;
const weekInSeason = week => ((week - 1) % 52) + 1;
const monthOf = week => MONTHS[Math.min(11, Math.floor((weekInSeason(week) - 1) / 4.34))];
const isOffSeason = week => weekInSeason(week) >= 49;

// Which surfaces are in season, week by week.
function surfaceMix(wk) {
  if (wk <= 8) return { hard: 1 };
  if (wk <= 13) return { hard: 0.6, clay: 0.4 };
  if (wk <= 24) return { clay: 0.85, hard: 0.15 };
  if (wk <= 29) return { grass: 0.45, clay: 0.45, hard: 0.1 };
  if (wk <= 40) return { hard: 0.6, clay: 0.4 };
  return { hard: 1 }; // autumn: hard, much of it indoors
}

// Small seeded random generator so a season's calendar is the same every time you look at it.
function seeded(seed) {
  let x = (seed >>> 0) || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

// The big events, by week of the season.
const SLAMS = { 3: ['Melbourne', 'AUS', 'hard'], 21: ['Paris', 'FRA', 'clay'], 27: ['London', 'GBR', 'grass'], 35: ['New York', 'USA', 'hard'] };
const MASTERS = { 10: ['Indian Wells', 'USA', 'hard'], 12: ['Miami', 'USA', 'hard'], 15: ['Monte-Carlo', 'FRA', 'clay'],
  18: ['Madrid', 'ESP', 'clay'], 19: ['Rome', 'ITA', 'clay'], 31: ['Montreal', 'CAN', 'hard'], 32: ['Cincinnati', 'USA', 'hard'],
  41: ['Shanghai', 'CHN', 'hard'], 44: ['Paris', 'FRA', 'hard', true] };
// ATP 250 / 500 events: [city, nation, surface, indoor, tier, first week, last week]
const ATP_EVENTS = [
  ['Brisbane', 'AUS', 'hard', false, 'ATP250', 1, 1], ['Adelaide', 'AUS', 'hard', false, 'ATP250', 2, 2],
  ['Dallas', 'USA', 'hard', true, 'ATP250', 5, 5], ['Montpellier', 'FRA', 'hard', true, 'ATP250', 5, 5],
  ['Rotterdam', 'NED', 'hard', true, 'ATP500', 6, 6], ['Buenos Aires', 'ARG', 'clay', false, 'ATP250', 6, 6],
  ['Delray Beach', 'USA', 'hard', false, 'ATP250', 7, 7], ['Marseille', 'FRA', 'hard', true, 'ATP250', 7, 7],
  ['Rio de Janeiro', 'BRA', 'clay', false, 'ATP500', 8, 8], ['Acapulco', 'MEX', 'hard', false, 'ATP500', 9, 9],
  ['Santiago', 'CHI', 'clay', false, 'ATP250', 9, 9], ['Houston', 'USA', 'clay', false, 'ATP250', 14, 14],
  ['Marrakech', 'MAR', 'clay', false, 'ATP250', 14, 14], ['Estoril', 'POR', 'clay', false, 'ATP250', 14, 14],
  ['Barcelona', 'ESP', 'clay', false, 'ATP500', 16, 16], ['Munich', 'GER', 'clay', false, 'ATP250', 16, 16],
  ['Geneva', 'SUI', 'clay', false, 'ATP250', 20, 20], ['Lyon', 'FRA', 'clay', false, 'ATP250', 20, 20],
  ['Stuttgart', 'GER', 'grass', false, 'ATP250', 23, 23], ['s-Hertogenbosch', 'NED', 'grass', false, 'ATP250', 23, 23],
  ['Halle', 'GER', 'grass', false, 'ATP500', 24, 24], ['London', 'GBR', 'grass', false, 'ATP500', 24, 24],
  ['Mallorca', 'ESP', 'grass', false, 'ATP250', 25, 25], ['Eastbourne', 'GBR', 'grass', false, 'ATP250', 25, 25],
  ['Båstad', 'SWE', 'clay', false, 'ATP250', 28, 28], ['Gstaad', 'SUI', 'clay', false, 'ATP250', 28, 28],
  ['Hamburg', 'GER', 'clay', false, 'ATP500', 29, 29], ['Umag', 'CRO', 'clay', false, 'ATP250', 29, 29], ['Atlanta', 'USA', 'hard', false, 'ATP250', 29, 29],
  ['Washington', 'USA', 'hard', false, 'ATP500', 30, 30], ['Kitzbühel', 'AUT', 'clay', false, 'ATP250', 30, 30], ['Los Cabos', 'MEX', 'hard', false, 'ATP250', 30, 30],
  ['Winston-Salem', 'USA', 'hard', false, 'ATP250', 33, 33], ['Chengdu', 'CHN', 'hard', false, 'ATP250', 38, 38],
  ['Beijing', 'CHN', 'hard', false, 'ATP500', 39, 39], ['Tokyo', 'JPN', 'hard', false, 'ATP500', 39, 39],
  ['Stockholm', 'SWE', 'hard', true, 'ATP250', 42, 42], ['Antwerp', 'BEL', 'hard', true, 'ATP250', 42, 42],
  ['Vienna', 'AUT', 'hard', true, 'ATP500', 43, 43], ['Basel', 'SUI', 'hard', true, 'ATP500', 43, 43],
  ['Metz', 'FRA', 'hard', true, 'ATP250', 45, 45], ['Belgrade', 'SRB', 'hard', true, 'ATP250', 45, 45],
];

// The tournaments on offer in a given (career) week, biggest first: a Slam or Masters (some weeks),
// ATP 250/500s, two Challengers and three ITF events.
function weekEvents(week, careerSeed = 1) {
  if (isOffSeason(week)) return [];
  const wk = weekInSeason(week), season = seasonOfWeek(week);
  const rng = seeded(careerSeed * 7919 + season * 104729 + wk * 131);
  const mix = surfaceMix(wk);
  const autumnIndoor = wk >= 41;
  const make = (city, nation, surface, indoor, tier) => ({
    id: `s${season}w${wk}-${tier.toLowerCase()}-${city.toLowerCase().replace(/[^a-z]/g, '')}`,
    week, tier, city, nation, surface, indoor: !!indoor,
  });
  const events = [], used = new Set();
  if (SLAMS[wk]) { const [c, n, sf] = SLAMS[wk]; events.push(make(c, n, sf, false, 'GS')); used.add(c); }
  if (MASTERS[wk]) { const [c, n, sf, ind] = MASTERS[wk]; events.push(make(c, n, sf, ind, 'M1000')); used.add(c); }
  for (const [c, n, sf, ind, tier, w0, w1] of ATP_EVENTS) if (wk >= w0 && wk <= w1 && !used.has(c)) { events.push(make(c, n, sf, ind, tier)); used.add(c); }

  const pool = VENUES.filter(v => mix[v[2]] && (!v[3] || autumnIndoor || wk <= 8));
  const pickVenues = (count, tierFor) => {
    for (let tries = 0, got = 0; got < count && tries < 60; tries++) {
      let r = rng(), surf = 'hard';
      for (const [sname, w] of Object.entries(mix)) { if ((r -= w) < 0) { surf = sname; break; } }
      const opts = pool.filter(v => v[2] === surf && !used.has(v[0]));
      if (!opts.length) continue;
      const [city, nation, surface, indoor] = opts[Math.floor(rng() * opts.length)];
      used.add(city);
      events.push(make(city, nation, surface, indoor, tierFor()));
      got++;
    }
  };
  pickVenues(2, () => rng() < 0.3 ? 'CH125' : 'CH75');
  pickVenues(SLAMS[wk] ? 2 : 3, () => rng() < 0.4 ? 'M25' : 'M15');
  return events.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
}

// Travel time between countries, in days: none within a country, one within a region, two across the world.
function travelDays(from, to) {
  if (!from || from === to) return 0;
  return REGION_OF[from] === REGION_OF[to] ? 1 : 2;
}

// Free days left in the week after a tournament, by how far you got (index into R32..F, 5 = title).
const FREE_DAYS = [5, 4, 3, 2, 1, 0];

// --- Training sessions -------------------------------------------------------
// Training: each session improves its stats by 1–3.5% (rolled per day). Practising on site at next
// week's venue rolls twice and keeps the better one.
const TRAIN_MIN = 0.01, TRAIN_MAX = 0.035;
const rollTrain = local => {
  const r = () => TRAIN_MIN + Math.random() * (TRAIN_MAX - TRAIN_MIN);
  return Math.round((local ? Math.max(r(), r()) : r()) * 10000) / 10000;
};
const DRILLS = [
  { id: 'serve',    icon: '🎯', title: 'Serve practice',     stats: ['serve', 'mental'], fatigue: 12, desc: 'Baskets of serves to targets, then pressure games.' },
  { id: 'baseline', icon: '🎾', title: 'Baseline drills',    stats: ['ground', 'stam'],  fatigue: 14, desc: 'Crosscourt and down-the-line patterns from the back.' },
  { id: 'return',   icon: '↩️', title: 'Return drills',      stats: ['ret', 'iq'],       fatigue: 12, desc: 'Returning big serves and reading the toss.' },
  { id: 'net',      icon: '🕸️', title: 'Net & volleys',      stats: ['net', 'ground'],   fatigue: 12, desc: 'Approaches, first volleys and overheads.' },
  { id: 'touch',    icon: '🪶', title: 'Touch & drop shots', stats: ['iq', 'net'],       fatigue: 10, desc: 'Feel at the net and disguising the drop shot.' },
  { id: 'tactics',  icon: '♟️', title: 'Match-play sets',    stats: ['iq', 'mental'],    fatigue: 14, desc: 'Practice sets against a hitting partner.' },
  { id: 'fitness',  icon: '🫁', title: 'Fitness session',    stats: ['stam', 'mental'],  fatigue: 18, desc: 'Sprints, footwork and endurance work.' },
  { id: 'rest',     icon: '🛌', title: 'Rest & recovery',    stats: [],                  fatigue: -25, desc: 'Physio, stretching and sleep. Clears fatigue.' },
];
const DAILY_RECOVERY = 8;

const fatigueLabel = f => f < 30 ? 'Fresh' : f < 50 ? 'Fine' : f < 70 ? 'Tired' : 'Exhausted';

// --- Overall rating and levels ------------------------------------------------
// Simulated results for balanced players at each rating: [OVR, title %, QF-or-better %] per tournament.
const OVR_TABLE = {
  M15: [[44, 0, 4], [48, 0, 11], [52, 2, 28], [56, 11, 58], [60, 35, 73], [64, 58, 89], [68, 84, 93]],
  M25: [[44, 0, 2], [48, 0, 4], [52, 0, 12], [56, 1, 34], [60, 10, 52], [64, 30, 75], [68, 60, 87]],
};

// Levels along the way. The later ones point at the tours still to come (Challengers, ATP).
const LEVELS = [
  { min: 0,  name: 'Rising junior',        note: 'First-round exits are normal at M15s. A quarter-final is a good week.' },
  { min: 47, name: 'ITF journeyman',       note: 'Winning rounds at M15s; the odd quarter-final.' },
  { min: 51, name: 'M15 contender',        note: 'Regular M15 quarter-finals, with the occasional final.' },
  { min: 55, name: 'M15 title threat',     note: 'Expect M15 titles over a season and some deep M25 runs.' },
  { min: 59, name: 'M25 contender',        note: 'Dominant at M15s and winning M25s. Ready for the next level.' },
  { min: 63, name: 'Challenger level',     note: 'Winning M25s and competing at Challengers. Climb the ranking to get in.' },
  { min: 68, name: 'Top-200 player',       note: 'Winning Challengers and knocking on the door of the ATP Tour.' },
  { min: 73, name: 'ATP Tour player',      note: 'A top-100 level: main draws at ATP events and Grand Slams.' },
  { min: 79, name: 'Elite',                note: 'Top-20 level. Deep runs at the biggest events.' },
];

function levelOf(ovr) {
  let i = 0;
  while (i + 1 < LEVELS.length && ovr >= LEVELS[i + 1].min) i++;
  return { ...LEVELS[i], next: LEVELS[i + 1] || null };
}

// Interpolated chances per tournament at this rating.
function expectAt(tier, ovr) {
  const t = OVR_TABLE[tier];
  if (ovr <= t[0][0]) return { title: t[0][1], qf: t[0][2] };
  for (let i = 1; i < t.length; i++) {
    if (ovr <= t[i][0]) {
      const k = (ovr - t[i - 1][0]) / (t[i][0] - t[i - 1][0]);
      return { title: t[i - 1][1] + k * (t[i][1] - t[i - 1][1]), qf: t[i - 1][2] + k * (t[i][2] - t[i - 1][2]) };
    }
  }
  const last = t[t.length - 1];
  return { title: last[1], qf: last[2] };
}
