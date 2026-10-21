// sim.js — opponent generation, draw building, and point-by-point match simulation

const ATTR_KEYS = ['serve', 'ground', 'ret', 'net', 'stam', 'mental', 'iq'];
const LEFTY_SHARE = 0.13;

// Game plan: five tactical settings. You choose yours; opponents get one that suits their stats.
const DEFAULT_PLAN = { serve: 'balanced', returnPos: 'normal', aggression: 'balanced', net: 'sometimes', drops: 'sometimes', underarm: 'never', spin: 'mixed',
  wing: 'neutral', depth: 'balanced', energy: 'normal', pressure: 'standard' };
const planOf = p => ({ ...DEFAULT_PLAN, ...(p.dropShots ? { drops: p.dropShots } : {}), ...p.plan });

function opponentPlan(a, rng) {
  const lvl = (x, lo, hi, levels) => x >= hi ? levels[2] : x <= lo ? levels[0] : levels[1];
  const plan = {
    serve: lvl(a.serve, 43, 58, ['safe', 'balanced', 'big']),
    returnPos: a.ret >= 57 ? 'inside' : a.stam >= 56 ? 'deep' : 'normal',
    aggression: a.ground >= 57 && a.iq < 55 ? 'aggressive' : a.stam >= 55 || a.iq >= 57 ? 'patient' : 'balanced',
    net: lvl(a.net, 43, 58, ['rarely', 'sometimes', 'often']),
    drops: lvl(a.iq + a.net, 90, 115, ['rarely', 'sometimes', 'often']),
    // A few crafty players keep a cheeky underarm serve in their pocket.
    // Big ball-strikers who like quick courts flatten it out; grinders and clay-courters roll it.
    spin: a.ground >= 56 && a.stam < 54 ? 'flat' : a.stam >= 56 || a.ground < 46 ? 'topspin' : 'mixed',
    underarm: rng() < 0.04 + Math.max(0, a.iq - 55) * 0.006 ? (rng() < 0.3 ? 'sometimes' : 'rarely') : 'never',
  };
  // Not every player plays to their strengths.
  const OPTIONS = { serve: ['safe', 'balanced', 'big'], returnPos: ['deep', 'normal', 'inside'],
    aggression: ['patient', 'balanced', 'aggressive'], spin: ['topspin', 'mixed', 'flat'], net: ['rarely', 'sometimes', 'often'], drops: ['rarely', 'sometimes', 'often'] };
  for (const k of Object.keys(OPTIONS)) if (rng() < 0.2) plan[k] = pick(rng, OPTIONS[k]);
  return plan;
}

// Typical opponent level (average attribute) and spread per tier.
// Tour levels. level = typical opponent average stat; points by round reached (R32 out, R16 out, QF, SF, F, W);
// main / qual = ranking needed for the main draw / qualifying (null = open to all); home = share of locals in the field.
const TIERS = {
  M15:    { label: 'M15',        name: 'ITF M15',        level: 46, sd: 5, prize: '$15,000',  points: [0, 1, 2, 4, 8, 15],             main: null, qual: null, home: 0.55 },
  M25:    { label: 'M25',        name: 'ITF M25',        level: 50, sd: 5, prize: '$25,000',  points: [0, 1, 4, 8, 16, 25],            main: null, qual: null, home: 0.5 },
  CH75:   { label: 'CH 75',      name: 'Challenger 75',  level: 57, sd: 4.5, prize: '$82,000',  points: [0, 6, 12, 22, 44, 75],       main: 450, qual: 650, home: 0.25, qRounds: 2, qPoints: 4 },
  CH125:  { label: 'CH 125',     name: 'Challenger 125', level: 61, sd: 4.5, prize: '$160,000', points: [0, 8, 16, 35, 64, 125],      main: 300, qual: 450, home: 0.22, qRounds: 2, qPoints: 6 },
  ATP250: { label: 'ATP 250',    name: 'ATP 250',        level: 73.5, sd: 4,   prize: '$650,000', points: [0, 25, 50, 100, 165, 250],   main: 110, qual: 200, home: 0.12, qRounds: 2, qPoints: 12 },
  ATP500: { label: 'ATP 500',    name: 'ATP 500',        level: 76, sd: 4,   prize: '$2.1M',    points: [0, 50, 100, 200, 330, 500],  main: 70,  qual: 140, home: 0.1,  qRounds: 2, qPoints: 20 },
  M1000:  { label: 'Masters',    name: 'Masters 1000',   level: 78.5, sd: 3.5, prize: '$8.9M',    points: [10, 100, 200, 400, 650, 1000], main: 50, qual: 110, home: 0.1, qRounds: 2, qPoints: 25 },
  GS:     { label: 'Grand Slam', name: 'Grand Slam',     level: 80, sd: 3.5, prize: '$50M',     points: [50, 200, 400, 800, 1300, 2000], main: 104, qual: 230, home: 0.08, qRounds: 3, qPoints: 25 },
};
const TIER_ORDER = ['GS', 'M1000', 'ATP500', 'ATP250', 'CH125', 'CH75', 'M25', 'M15'];
const TIER_LEVEL = Object.fromEntries(Object.entries(TIERS).map(([k, t]) => [k, { mean: t.level, sd: t.sd }]));

// Hidden career curves: shape age, match-to-match variance and attribute drift.
const CURVES = {
  riser:   { ages: [17, 20], formSd: 0.025, adjust: { mental: -5, stam: 2, iq: -4 } },
  peak:    { ages: [22, 27], formSd: 0.02,  adjust: {} },
  veteran: { ages: [29, 34], formSd: 0.015, adjust: { mental: 8, stam: -6, iq: 6 } },
  streaky: { ages: [19, 30], formSd: 0.045, adjust: {} },
  steady:  { ages: [21, 31], formSd: 0.01,  adjust: { mental: 3 } },
};

const CLAY_NATIONS = new Set(['ESP','ARG','ITA','BRA','CHI','COL','POR','SRB','CRO','BUL','TUN','MAR','EGY','AUT','URU']);

const ROUND_NAMES = ['R32', 'R16', 'QF', 'SF', 'F'];
const POINTS = Object.fromEntries(Object.entries(TIERS).map(([k, t]) => [k, t.points]));

const rand = (rng, a, b) => a + rng() * (b - a);
const randInt = (rng, a, b) => Math.floor(rand(rng, a, b + 1));
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function gauss(rng) {
  let u = 0;
  while (!u) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

function pickSurfaces(nation, rng) {
  const fav = CLAY_NATIONS.has(nation) && rng() < 0.6 ? 'clay'
    : pick(rng, ['hard', 'hard', 'hard', 'clay', 'clay', 'grass']);
  const worst = pick(rng, ['hard', 'clay', 'grass', 'grass'].filter(s => s !== fav));
  return { fav, worst };
}

// shift: level offset (qualifiers are a little below the main-draw field).
function generateOpponent(nation, tier, rng = Math.random, shift = 0) {
  const lvl = TIER_LEVEL[tier];
  const level = lvl.mean + shift + gauss(rng) * lvl.sd;
  const curveId = pick(rng, Object.keys(CURVES));
  const curve = CURVES[curveId];
  const style = pick(rng, STYLES);
  const attrs = {};
  ATTR_KEYS.forEach((k, i) => {
    const bias = style.w ? style.w[i] * 4 : 0;
    attrs[k] = Math.round(clamp(level + bias + gauss(rng) * 4 + (curve.adjust[k] || 0), 20, 95));
  });
  attrs.iq = attrs.iq ?? 50;
  return {
    id: 'o' + Math.floor(rng() * 1e12).toString(36),
    plan: { ...opponentPlan(attrs, rng), ...(style.spin ? { spin: style.spin } : {}), ...(style.agg ? { aggression: style.agg } : {}) },
    name: randomName(nation, rng),
    nation,
    age: randInt(rng, ...curve.ages),
    attrs,
    temperament: pick(rng, Object.keys(TEMPERAMENTS)),
    hand: rng() < LEFTY_SHARE ? 'left' : 'right',
    ...pickSurfaces(nation, rng),
    curve: curveId,
    formSd: curve.formSd,
  };
}

function rating(p) {
  return ATTR_KEYS.reduce((a, k) => a + attr(p, k), 0) / ATTR_KEYS.length;
}

// Overall rating: stats weighted by how much each one moves the match engine.
const OVR_WEIGHTS = { serve: 1.1, ground: 1.25, ret: 1.0, net: 0.6, stam: 0.75, mental: 0.85, iq: 1.05 };
const OVR_TOTAL = Object.values(OVR_WEIGHTS).reduce((a, b) => a + b, 0);
function overall(p) {
  return Object.entries(OVR_WEIGHTS).reduce((a, [k, w]) => a + attr(p, k) * w, 0) / OVR_TOTAL;
}

// Tiredness carried into a match (0-100). Fit players shake it off better.
// Above 85 the body is running on empty and it shows quickly: at 100 you lose about 6% on points.
function tiredness(p) {
  const f = p.fatigue || 0;
  return (Math.max(0, f - 35) * 0.0005 + Math.max(0, f - 85) * 0.002) * (1 - (p.attrs.stam - 50) / 150);
}

// Older saves and draws predate Tennis IQ and handedness.
const attr = (p, k) => p.attrs[k] ?? 50;
const lefty = p => p.hand === 'left';

// 32 entrants: the player plus generated opponents. Top 8 opponents by rating are seeded.
// Ranking -> the overall rating a player at that ranking typically has (used to seed you by ranking).
const RANK_OVR = [[1, 82], [20, 77], [100, 72], [200, 68], [400, 63], [700, 58], [1000, 54], [1500, 49]];
function rankToOvr(rank) {
  if (!rank) return 0;
  for (let i = 1; i < RANK_OVR.length; i++) {
    const [r0, o0] = RANK_OVR[i - 1], [r1, o1] = RANK_OVR[i];
    if (rank <= r1) return o0 + (o1 - o0) * (Math.log(rank / r0) / Math.log(r1 / r0));
  }
  return 47;
}

// 32 entrants: you plus generated opponents. The 8 strongest are seeded: opponents by their level,
// you by your ranking (unranked players are never seeded).
function buildEntrants(player, event, nations, rng = Math.random, playerRank = null) {
  const used = new Set();
  const opps = nations.map(n => {
    let o;
    do { o = generateOpponent(n, event.tier, rng); } while (used.has(o.name));
    used.add(o.name);
    return o;
  });
  const me = {
    name: player.name, nation: player.nation, attrs: { ...player.attrs },
    temperament: player.temperament, fav: player.fav, worst: player.worst,
    hand: player.hand || 'right', backhand: player.backhand || 'two', plan: planOf(player),
    formSd: 0.02, seed: null, isPlayer: true,
  };
  const all = [me, ...opps];
  const strength = p => p.isPlayer ? rankToOvr(playerRank) : overall(p);
  [...all].sort((a, b) => strength(b) - strength(a)).forEach((p, i) => { p.seed = i < 8 && strength(p) > 0 ? i + 1 : null; });
  opps.sort((a, b) => (a.seed || 99) - (b.seed || 99) || overall(b) - overall(a));
  return [me, ...opps];
}

// Standard 32-draw seed lines; everyone else fills the remaining lines at random.
function makeDraw(entrants, rng = Math.random) {
  const lines = Array(32).fill(null);
  const bySeed = s => entrants.findIndex(e => e.seed === s);
  lines[0] = bySeed(1);
  lines[31] = bySeed(2);
  const [l3, l4] = rng() < 0.5 ? [8, 23] : [23, 8];
  lines[l3] = bySeed(3); lines[l4] = bySeed(4);
  const five = [7, 15, 16, 24].sort(() => rng() - 0.5);
  [5, 6, 7, 8].forEach((s, i) => { lines[five[i]] = bySeed(s); });
  const rest = entrants.map((_, i) => i).filter(i => !lines.includes(i)).sort(() => rng() - 0.5);
  for (let i = 0; i < 32; i++) if (lines[i] === null) lines[i] = rest.pop();
  const first = [];
  for (let i = 0; i < 32; i += 2) first.push({ a: lines[i], b: lines[i + 1] });
  return first;
}

// --- Match engine -----------------------------------------------------------

function serveRating(p, surface) {
  const a = p.attrs;
  if (surface === 'grass') return 0.55 * a.serve + 0.2 * a.ground + 0.25 * a.net;
  if (surface === 'clay') return 0.4 * a.serve + 0.45 * a.ground + 0.15 * a.net;
  return 0.5 * a.serve + 0.35 * a.ground + 0.15 * a.net;
}

function returnRating(p, surface) {
  const a = p.attrs;
  if (surface === 'clay') return 0.45 * a.ret + 0.4 * a.ground + 0.15 * a.stam;
  return 0.55 * a.ret + 0.35 * a.ground + 0.1 * a.stam;
}

const SURFACE_SERVE = { hard: 0, clay: -0.03, grass: 0.03 };
// Base chance of winning a point on serve, tuned so tour-level holds and tiebreaks match real tennis (tools/stats-check.html).
let SERVE_BASE = 0.664;
// When two real players meet (Study Room, AI matches), the point-by-point gap between them is scaled by this, tuned so
// the sim's favourites win as often as real favourites do (tools/predict-check.html). Matches involving you are unchanged.
let REAL_GAP = 0.45;
// Legends' surge and pressure, scaled up with the stronger serve (holding is easier, so legends need more bite to stay as hard).
let LEGEND_X = 1.4;

function comfort(p, ev) {
  let c = p.acclimated ? 0.01 : 0; // arrived early and practised on these courts
  if (p.fav === ev.surface) c += 0.012;
  if (p.worst === ev.surface) c -= 0.012;
  if (ev.indoor) c += p.fav === 'hard' ? 0.006 : p.worst === 'hard' ? -0.006 : 0;
  return c;
}

// Mood swings after big moments, by temperament. Mental resilience lowers the odds.
// [chance, point-win shift, games it lasts, short label (for the match story), what you see happen].
// In the texts, {their}/{they're}/{themself} become your/you're/yourself when it's you.
const MOOD = {
  fiery: {
    broken: [0.5, -0.04, 3, 'boiled over', [
      'smashed {their} racket into the court and got a code violation',
      'screamed at the sky after getting broken',
      'whacked a ball into the stands and got a warning from the umpire',
      'got into a heated row with the umpire over a line call',
      'kicked the courtside bench at the changeover']],
    broke: [0.6, 0.02, 2, 'fired up', [
      'roared and pumped both fists at {their} box after the break',
      'got the whole crowd on its feet after breaking serve',
      'is bouncing on {their} toes after the break, full of energy',
      'let out a huge "Come on!" after breaking serve']],
  },
  stoic: {
    broken: [0.15, -0.015, 2, 'wobbled', [
      'let out a rare sigh after getting broken',
      'stared at {their} strings for a long moment after dropping serve',
      'took an extra few seconds at the towel to reset']],
  },
  moping: {
    broken: [0.35, -0.025, 3, 'drooped', [
      'hung {their} head after dropping serve',
      'trudged back to the baseline muttering to {themself}',
      'sat with a towel over {their} head at the changeover']],
    setLost: [0.6, -0.04, 6, 'sank into a slump', [
      'slumped in the chair after losing the set, looking beaten',
      'stopped chasing down balls after losing the set',
      'is shaking {their} head and looking up at the sky between points']],
  },
  robotic: {},
};
// "−4% on points for 3 games"
const moodEffect = (delta, games) => `${delta > 0 ? '+' : '−'}${+(Math.abs(delta) * 100).toFixed(1)}% on points for ${games} games`;
const moodText = (mo, you) => !mo.text ? mo.label : you
  ? mo.text.replace(/\{their\}/g, 'your').replace(/\{themself\}/g, 'yourself').replace(/\bis /, 'are ')
  : mo.text.replace(/\{their\}/g, 'their').replace(/\{themself\}/g, 'themself');

// track: record every point in m.points so the match screen can replay it.
function newMatch(a, b, rng = Math.random, track = false) {
  const s = () => ({
    points: 0, servePts: 0, firstIn: 0, firstWon: 0, secondWon: 0, df: 0, aces: 0,
    bpChances: 0, bpWon: 0, bpFaced: 0, bpSaved: 0, winners: 0, ue: 0, netWon: 0, netPlayed: 0,
    svcGames: 0, svcHeld: 0, spMax: 0, sp1: 0, sp1n: 0, sp2: 0, sp2n: 0, dropPlayed: 0, dropWon: 0,
  });
  return {
    a, b, sets: [], games: [0, 0], tb: null, server: rng() < 0.5 ? 0 : 1,
    form: null, mood: [0, 0], moodLeft: [0, 0], totalGames: 0,
    stats: [s(), s()], moments: [], winner: null, track, points: [], bestOf: 3,
  };
}

function initForm(m, ps, rng) {
  const g = ps.map(() => gauss(rng));
  m.realPair = ps.every(p => p.atpRank && !p.isPlayer);
  m.form = ps.map((p, i) => g[i] * p.formSd * (p.temperament === 'robotic' ? 0.5 : 1));
  // Bad days: now and then anyone, even the best, just plays badly (the low tail of their form roll; fiery
  // players have them more often, robotic ones less). Errors pour out and it can turn a match.
  m.badDay = ps.map((p, i) => g[i] < (p.temperament === 'fiery' ? -1.45 : p.temperament === 'robotic' ? -1.95 : -1.65) - (p.calmCoach ? 0.35 : 0)); // a mental coach helps
  m.badDay.forEach((b, i) => { if (b) { m.form[i] -= 0.03; m.moments.push({ set: 1, who: i, kind: 'badday', label: 'is having a bad day: the errors keep coming', at: 0 }); } });
  // How well each player's game plan comes off today. 1 = as expected; it can click (up to 2x)
  // or flop and even backfire (below 0). Smarter players execute a little more reliably.
  m.exec = ps.map(p => rollExec(p, rng));
  // A textbook (coach-copied) plan is what the other camp prepared for: it comes off less well from the
  // start, more so the higher the level.
  ps.forEach((p, i) => { if (p.textbook) m.exec[i] *= 1 - 0.3 * p.textbook * Math.min(1.5, ADAPT_RATE[advTier] || 1); });
  // Opponents who prepared for the plan that beat them last time (only against you).
  ps.forEach((p, i) => { if (p.prepared && ps[1 - i].isPlayer) { m.exec[1 - i] -= 0.3; m.moments.push({ set: 1, who: i, kind: 'adapt', label: `came prepared: ${p.prepared.counter}`, at: 0 }); } });
  // Each player's playstyle for this match: it shapes how their points are played (see servePoint).
  m.styles = ps.map(p => typeof styleOf === 'function' ? styleOf(p).name : null);
  m.traits = ps.map(p => typeof traitOf === 'function' ? (traitOf(p) || {}).name || null : null);
}

// --- Playstyle matchups ---------------------------------------------------------------------
// How playstyles show in points, for both players at once. None of this changes who wins a point
// (that's decided first, from stats, plans and form); it changes how the point is won: the serve,
// the return, rally length, net rushes, passing shots, drop shots, winners versus errors.
const STYLE_FAMILY = { 'Serve-Dominant': 'attack', 'Serve +1 Attacker': 'attack', 'First-Strike Attacker': 'attack', 'Flat Attacker': 'attack',
  'Aggressive Baseliner': 'attack', 'Heavy-Topspin Attacker': 'attack', 'Serve-and-Volley': 'net', 'Net Attacker': 'net',
  'Defensive Grinder': 'defend', 'Counterpuncher': 'defend', 'Heavy-Topspin Baseliner': 'defend', 'Solid Baseliner': 'defend',
  'Variety / Slice-Heavy': 'craft', 'Creative Shotmaker': 'craft', 'All-Court': 'craft' };
// Old style names (saved match records from before the 2026 style revision) read as their new ones.
const LEGACY_STYLE = { 'Big Server': 'Serve-Dominant', 'First-Strike Player': 'First-Strike Attacker', 'Power Hitter': 'Flat Attacker',
  'Clay-Court Specialist': 'Heavy-Topspin Baseliner', 'All-Courter': 'All-Court', 'Net Rusher': 'Net Attacker',
  'Serve-and-Volleyer': 'Serve-and-Volley', 'Tactician': 'Variety / Slice-Heavy', 'Return Specialist': 'Counterpuncher',
  'Marathon Man': 'Defensive Grinder', 'Clutch Competitor': 'Solid Baseliner' };
const styleName = st => LEGACY_STYLE[st] || st;
const famOf = st => STYLE_FAMILY[styleName(st)] || 'craft';
// Serve points the server wins: how many become aces or unreturned serves (server's style x returner's).
// Secondary traits add to it: a powerful serve on one side, a returner's eye on the other.
const ACE_SERVER = { 'Serve-Dominant': 1.45, 'First-Strike Attacker': 1.3, 'Serve +1 Attacker': 1.25, 'Serve-and-Volley': 1.15,
  'Flat Attacker': 1.15, 'Creative Shotmaker': 1.1, 'Powerful Serve': 1.15 };
const ACE_RETURNER = { 'Return-Oriented': 0.6, 'Counterpuncher': 0.8, 'Defensive Grinder': 0.85 };
// Points the returner wins: how many are won outright with the return (more off second serves).
const RETURN_WINNER = { 'Return-Oriented': 0.25, 'Counterpuncher': 0.12, 'Flat Attacker': 0.1, 'First-Strike Attacker': 0.1, 'Aggressive Baseliner': 0.08 };
// Coming in: [serve-and-volley behind a first serve, behind a second serve, approach or chip-and-charge in a rally].
const NET_STYLE = { 'Serve-and-Volley': [0.65, 0.3, 0.1], 'Net Attacker': [0.3, 0.15, 0.24], 'All-Court': [0.1, 0.04, 0.08],
  'Creative Shotmaker': [0.08, 0.03, 0.1] };
// Beating a net player: how often it's a clean pass or lob (rather than the volleyer missing).
const PASSER = { defend: 0.82, craft: 0.75, attack: 0.7, net: 0.55 };
// Rally points won with a drop shot.
const DROP_STYLE = { 'Variety / Slice-Heavy': 0.2, 'Creative Shotmaker': 0.14, 'Heavy-Topspin Baseliner': 0.08, 'All-Court': 0.06 };
const STYLE_RALLY = { 'Defensive Grinder': 1.6, 'Counterpuncher': 1.35, 'Heavy-Topspin Baseliner': 1.25, 'Solid Baseliner': 1.15,
  'Heavy-Topspin Attacker': 0.95, 'First-Strike Attacker': 0.55, 'Serve +1 Attacker': 0.65, 'Flat Attacker': 0.7, 'Serve-Dominant': 0.7,
  'Aggressive Baseliner': 0.8, 'Serve-and-Volley': 0.7, 'Net Attacker': 0.8 };
const STYLE_CLEAN = { 'First-Strike Attacker': 0.2, 'Flat Attacker': 0.18, 'Serve +1 Attacker': 0.15, 'Aggressive Baseliner': 0.1,
  'Heavy-Topspin Attacker': 0.08, 'Serve-Dominant': 0.08, 'Solid Baseliner': -0.05, 'Heavy-Topspin Baseliner': -0.06,
  'Counterpuncher': -0.15, 'Defensive Grinder': -0.2 };
// Rally length: both styles set the tempo (two grinders = marathons, two first-strikers = two-shot
// points), and the winner pulls it their way. Marathon players drag long matches out further.
function matchupRally(sty, w, ev, m) {
  const f = i => STYLE_RALLY[sty[i]] || 1;
  let k = Math.sqrt(f(0) * f(1)) * Math.sqrt(f(w));
  if (ev.surface === 'clay' && sty.includes('Heavy-Topspin Baseliner')) k *= 1.15;
  if ((m.traits || []).includes('Marathon') && m.totalGames > 18) k *= 1.2;
  return k;
}

// How well your plan comes off today: usually close to as planned, sometimes a strong day, sometimes a flat
// one, never a total backfire. Smarter players are more consistent.
const rollExec = (p, rng = Math.random) => clamp(1 + gauss(rng) * (0.28 - (attr(p, 'iq') - 50) * 0.002), 0.4, 1.6);

// Plan execution multiplier for side i (older saved matches have none).
const ex = (m, i) => (m.exec ? m.exec[i] : 1);

// A plan has something to execute (and to counter) only if it isn't the middle setting everywhere.
const hasPlan = p => Object.entries(planOf(p)).some(([k, v]) => v !== DEFAULT_PLAN[k]);
// Something to read: any plan away from the defaults, and against a legend, any plan at all (default included).
const readable = (ps, who, target) => hasPlan(ps[target]) || (isLegend(ps[who]) && ps[target].isPlayer)
  || (ps[target].atpRank && !ps[target].isPlayer && !ps[who].isPlayer); // real players always have a signature to read

function fatigue(m, p) {
  const pace = { conserve: 0.5, normal: 1, hustle: 1.6 }[advPlan(p).energy] || 1;
  return Math.max(0, m.totalGames - 20) / 20 * Math.max(0, 70 - p.attrs.stam) * 0.001 * pace * (p.fitCamp ? 0.5 : 1); // elite fitness camp
}

// --- Hidden strengths --------------------------------------------------------------------------
// Many players have a strength their stats don't show, so a textbook plan can walk straight into it.
// Coaches read the stats; detailed scouting (or watching closely) finds these.
const QUIRKS = [
  { id: 'highballs', key: 'depth', val: 'high', text: 'loves high balls: moonballs sit up for them' },
  { id: 'passer', key: 'net', val: 'often', text: 'is a superb passer: net rushers get punished' },
  { id: 'pace', key: 'spin', val: 'flat', text: 'feeds on pace: flat hitting plays into their hands' },
  { id: 'readserve', key: 'serve', val: 'big', text: 'reads the big serve and returns it well' },
  { id: 'disguise', key: 'wing', val: 'weak', text: 'is solid on their "weak" wing: they have worked on it' },
  { id: 'clutch', key: 'pressure', val: 'broke', text: 'loves it when you go for broke on big points' },
  { id: 'engine', key: 'energy', val: 'hustle', text: 'never tires: hustling just burns your own legs' },
  { id: 'counter', key: 'aggression', val: 'aggressive', text: 'counterpunches brilliantly against attackers' },
  { id: 'dropread', key: 'drops', val: 'often', text: 'gets to drop shots in a flash' },
  { id: 'jammer', key: 'returnPos', val: 'inside', text: 'jams anyone who stands inside to return' },
];
function quirksOf(p) {
  if (!p || p.isPlayer || p.real) return [];
  let h = 2166136261;
  for (const ch of String(p.name || '') + 'qk') { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const n = h % 100 < 35 ? 0 : h % 100 < 80 ? 1 : 2, a = (h >>> 8) % QUIRKS.length, b = (a + 1 + ((h >>> 16) % (QUIRKS.length - 1))) % QUIRKS.length;
  return [QUIRKS[a], QUIRKS[b]].slice(0, n);
}
// What the coach reads about an opponent: settings to change, most important first, each with the reason.
// Reads compare the opponent with their own average (at tour level everyone's stats are high), plus their plan,
// their weaker wing and the surface. Your plan following a read pays off on court (readHits); how many reads you're told depends on your coach (coachPlan).
function matchReads(o, ev) {
  const op = planOf(o), r = k => rel(o, k), g = wingGap(o), out = [];
  const add = (key, val, why, w) => out.push({ key, val, why, w });
  if (op.returnPos === 'deep') { add('net', 'often', 'They return from far back: serve and come forward.', 3); add('drops', 'often', 'Their deep position leaves the drop shot open.', 2.5); }
  if (g > 0.15) add('wing', 'bh', 'Their backhand is the weaker wing.', 3);
  else if (g < -0.1) add('wing', 'fh', 'Their forehand is the weaker wing.', 3);
  if (r('serve') <= -3) add('returnPos', 'inside', "Their serve is the weakest part of their game: step in and attack it.", 2.8);
  else if (r('serve') >= 3 || op.serve === 'big') add('returnPos', 'deep', 'Big serve: stand back and get it in play.', 2.6);
  if (r('ret') >= 3) add('serve', 'safe', 'Elite returner: make first serves rather than go for broke.', 2.2);
  else if (r('ret') <= -3) add('serve', 'big', 'Their return is a weakness: go after your first serve.', 2.4);
  if (op.spin === 'flat') add('spin', 'topspin', 'Flat hitters hate high, heavy balls.', 2.5);
  else if (op.spin === 'topspin') add('aggression', 'aggressive', 'Heavy spin needs time: take the ball early.', 2.2);
  if (r('stam') >= 3 || op.aggression === 'patient') add('aggression', 'aggressive', "Don't get dragged into their long rallies.", 2.3);
  else if (r('stam') <= -3) add('aggression', 'patient', 'Their stamina is a weakness: make the points long.', 2.3);
  if (r('ground') >= 3 && op.aggression === 'aggressive') { add('aggression', 'patient', "Don't trade power with them: absorb and redirect.", 2.2); add('depth', 'deep', 'Keep it deep so they can\'t step in.', 1.8); }
  if (r('net') >= 3 || op.net === 'often') add('net', 'rarely', 'They are dangerous at the net: keep them back and pass.', 2);
  else if (r('net') <= -3) add('drops', 'often', 'Bring them forward: the net is not their place.', 2);
  if (r('mental') <= -3) add('pressure', 'broke', 'They get tight on big points: go for it.', 1.5);
  else if (r('mental') >= 3) add('pressure', 'safe', 'They are ice-cold on big points: make them earn it.', 1.4);
  if (ev.surface === 'grass') add('net', 'often', 'Grass rewards coming forward.', 1);
  if (ev.surface === 'clay') add('spin', 'topspin', 'Clay rewards heavy spin.', 1);
  // One read per setting (the most important).
  const seen = new Set();
  return out.sort((x, y) => y.w - x.w).filter(x => !seen.has(x.key) && seen.add(x.key));
}
// How many of the opponent's reads your plan exploits (your plans only). Their effect fades as they adjust.
function readHits(A, B, ev) {
  if (!A || !A.isPlayer || !B) return 0;
  const pl = { ...planOf(A), ...advPlan(A, B) };
  return matchReads(B, ev).filter(x => x.w >= 1.4 && pl[x.key] === x.val).length;
}
// Does your plan walk into what this opponent is known to be good at? Each one costs points (your plans only;
// computer players are judged by the adapting system instead). Reads are relative to the opponent's own game.
function strengthHits(A, B) {
  if (!A || !A.isPlayer || !B) return [];
  const pl = { ...planOf(A), ...advPlan(A, B) }, op = planOf(B), r = k => rel(B, k), g = wingGap(B), hits = [];
  if ((r('net') >= 3 || op.net === 'often') && pl.drops === 'often') hits.push('drops into a great mover at the net');
  if (r('ground') >= 2 && r('ret') >= 2 && pl.net === 'often') hits.push('rushing the net against a great passer');
  if (r('ret') >= 3 && pl.serve === 'big') hits.push('big first serves into an elite returner');
  if (r('serve') >= 3 && pl.returnPos === 'inside') hits.push('standing in against a huge serve');
  if (r('ground') >= 3 && op.aggression === 'aggressive' && pl.aggression === 'aggressive') hits.push('trading power with a power hitter');
  if ((r('stam') >= 3 || op.aggression === 'patient') && pl.aggression === 'patient') hits.push('grinding against a grinder');
  if (op.spin === 'flat' && pl.spin === 'flat') hits.push('feeding pace to a flat hitter');
  if (op.spin === 'topspin' && pl.depth === 'high') hits.push('moonballing a heavy-spin hitter');
  if ((pl.wing === 'bh' && g < -0.1) || (pl.wing === 'fh' && g > 0.15)) hits.push('attacking their stronger wing');
  return hits;
}
// Does A's plan play into one of B's hidden strengths?
function quirkHits(A, B) {
  const qs = quirksOf(B);
  if (!qs.length) return [];
  const pl = { ...planOf(A), ...advPlan(A, B) }, g = wingGap(B);
  return qs.filter(q => q.val === 'weak' ? (pl.wing === 'bh' && g > 0.15) || (pl.wing === 'fh' && g < -0.1) : pl[q.key] === q.val);
}

// --- Adapting --------------------------------------------------------------------------------
// How often players adjust to an opponent's plan, by level: rarely at the ITFs, constantly at the top.
const ADAPT_RATE = { M15: 0.4, M25: 0.5, CH75: 0.85, CH125: 1, ATP250: 1.2, ATP500: 1.3, M1000: 1.45, GS: 1.5 };
const adaptRate = () => ADAPT_RATE[advTier] || 1;
// Legends (former world No. 1s) adjust far more often, and are much harder to adjust to. A textbook plan
// is read almost at once; only an original plan holds up.
const isLegend = p => !!(p && p.atpRank && typeof LEGENDS !== 'undefined' && LEGENDS.has(p.name));
// A legend behind against you finds another level: the further behind in the set (and in the match), the
// harder they come back. 0–5 down is never safe against Sinner or Alcaraz. Fades once they're level again.
function legendSurge(m, ps, i) {
  if (!isLegend(ps[i]) || !ps[1 - i].isPlayer) return 0;
  const behind = (m.games[1 - i] || 0) - (m.games[i] || 0), set = (m.sets || []).length;
  const setsWon = j => (m.sets || []).filter(x => x.games[j] > x.games[1 - j]).length, setsBehind = setsWon(1 - i) - setsWon(i);
  // Comeback mode: once 3 games down, they stay switched on for the rest of the set (until they lead).
  m.comeback = m.comeback || {};
  if (behind >= 3) m.comeback[i] = set;
  if (behind < 0) delete m.comeback[i];
  const on = m.comeback[i] === set;
  return (on ? 0.09 : Math.max(0, behind - 1) * 0.012) + Math.max(0, setsBehind) * 0.008;
}
// A legend's grip on the match: they're simply better at the top level (an aura on every point), and every
// adjustment of theirs you haven't answered keeps costing you, point after point, until you change exactly what
// they countered. Unanswered, it snowballs; answer it and the pressure lifts.
function legendPressure(m, ps, i) {
  if (!isLegend(ps[i]) || !ps[1 - i].isPlayer) return 0;
  const you = { ...planOf(ps[1 - i]), ...advPlan(ps[1 - i], ps[i]) };
  // (A general read of your plan is answered by changing anything in it.)
  // Each unanswered adjustment hurts more the longer you leave it: a point or two is cheap, a set is crushing.
  let open = 0;
  const played = m.stats ? m.stats[0].points + m.stats[1].points : 0;
  for (const a of (m.adapted || []).filter(a => a.who === i && a.val !== undefined)) {
    const still = a.key === 'plan' ? JSON.stringify(you) === a.val : you[a.key] === a.val;
    if (still) open += Math.min(1.8, Math.max(0, played - (a.at || 0) - 4) * 0.045);
    // Answered: you win back the plan they'd taken away (once per adjustment).
    else if (!a.answered) { a.answered = true; if (m.exec) m.exec[1 - i] = Math.min(1.4, (m.exec[1 - i] || 0) + 0.25); }
  }
  const o = Math.min(3, open);
  return 0.004 + o * 0.01 + o * o * 0.006; // several unanswered at once snowball
}
// Phase two: a legend who loses a set against you rethinks their whole plan, built around what's wrong in your
// game (your weaknesses), so the match changes under you and you have to read it again.
function legendPhase(m, ps, i) {
  if (!isLegend(ps[i]) || !ps[1 - i].isPlayer || typeof matchReads !== 'function') return;
  let reads = matchReads(ps[1 - i], { surface: m.surface || 'hard' }).slice(0, 3);
  // Nothing obvious to attack: they change the rhythm of the match instead.
  if (!reads.length) { const pl = planOf(ps[i]); reads = [{ key: 'aggression', val: pl.aggression === 'aggressive' ? 'patient' : 'aggressive' }, { key: 'net', val: pl.net === 'often' ? 'rarely' : 'often' }]; }
  ps[i].plan = { ...planOf(ps[i]), ...Object.fromEntries(reads.map(x => [x.key, x.val])) };
  m.exec[i] = Math.min(1.5, (m.exec[i] || 1) + 0.25);
  m.legendPhase = (m.legendPhase || 0) + 1;
  const what = reads.map(x => (GAME_PLAN.find(g => g.key === x.key) || {}).label + ': ' + planLabel(x.key, x.val)).join(', ');
  m.moments.push({ set: m.sets.length + 1, who: i, kind: 'adapt', label: `changes everything for the next set (${what})`, at: 0 });
}
// Only in matches against you: between computer players, legends play to their rating.
const legendAdapt = (ps, who, target) =>  (isLegend(ps[who]) && ps[target].isPlayer ? 2 * (1 + 0.8 * (ps[target].textbook || 0)) : 1) * (isLegend(ps[target]) && ps[who].isPlayer ? 0.35 : 1);
// What the adjuster changes depends on the plan they're facing (its most distinctive setting).
function adaptTo(m, ps, who, target, set) {
  const pl = planOf(ps[target]), ad = advPlan(ps[target], ps[who]);
  const opts = [
    ad.wing !== 'neutral' && { key: 'wing', label: `is standing further back and running around the ${ad.wing === 'bh' ? 'backhand' : 'forehand'}` },
    pl.aggression === 'aggressive' && { key: 'aggression', label: 'is blocking everything back deep, waiting for the errors' },
    pl.serve === 'big' && { key: 'serve', label: 'is standing deeper to return the big serve' },
    pl.net === 'often' && { key: 'net', label: 'is passing lower and lobbing more' },
    ad.depth === 'high' && { key: 'depth', label: 'is stepping in to take the moonballs early' },
    pl.spin === 'flat' && { key: 'spin', label: 'is slicing low so the flat balls have nothing to hit through' },
    pl.drops === 'often' && { key: 'drops', label: 'is reading the drop shot and staying closer' },
    pl.returnPos === 'inside' && { key: 'returnPos', label: 'is serving into the body to jam the return' },
  ].filter(Boolean);
  // Between two real players, they go after whatever is actually hurting them most so far (and something new each
  // time); against you, the order above stands.
  let pick = opts[0] || { key: 'plan', label: 'found answers to the game plan' };
  if (m.realPair && opts.length) {
    const st = m.stats[target], done = new Set((m.adapted || []).filter(a => a.who === who && a.against === target).map(a => a.key));
    const hurt = { serve: st.aces / Math.max(1, st.servePts) * 6, net: st.netWon / Math.max(1, st.points) * 8, drops: (st.dropWon || 0) / Math.max(1, st.points) * 14,
      aggression: st.winners / Math.max(1, st.points) * 2.2, wing: 0.5, spin: 0.35, depth: 0.35, returnPos: 0.3 };
    const left = opts.filter(o => !done.has(o.key));
    if (left.length) pick = left.reduce((b, o) => (hurt[o.key] || 0.3) > (hurt[b.key] || 0.3) ? o : b);
  }
  // A legend's adjustment against you works mostly as pressure (legendPressure) that lifts when you answer it.
  if (isLegend(ps[who]) && ps[target].isPlayer) m.exec[target] = Math.max(0.35, m.exec[target] - 0.2);
  else m.exec[target] -= (0.25 + attr(ps[who], 'iq') / 200) * (isLegend(ps[target]) && ps[who].isPlayer ? 0.45 : 1);
  if (isLegend(ps[who]) && ps[target].isPlayer && m.exec[who] !== undefined) m.exec[who] = Math.min(1.6, m.exec[who] + 0.15); // a legend's answer also sharpens their own game
  if (pick.key === 'wing') { m.adj = m.adj || {}; m.adj[ps[who].name] = { wing: ad.wing }; }
  // What they countered, and the value it had: until you change that setting, a legend keeps punishing it.
  const cur = { ...planOf(ps[target]), ...advPlan(ps[target], ps[who]) };
  const played = (m.stats ? m.stats[0].points + m.stats[1].points : 0);
  m.adapted = [...(m.adapted || []), { who, against: target, key: pick.key, label: pick.label, set, at: played, val: pick.key === 'plan' ? JSON.stringify(cur) : cur[pick.key] }];
  m.moments.push({ set, who, kind: 'adapt', label: pick.label, at: m.points.length - 1 });
}

// Between two real players, whoever has been countered can answer back: they rework that part of their game and
// get some of their edge back. Smarter players find answers sooner.
const ANSWER = {
  serve: 'is mixing up the serve: more bodies and slices to the deeper returner',
  net: 'is coming in behind deeper approaches instead of any short ball',
  drops: 'is hiding the drop shot better and saving it for the right moment',
  aggression: 'is building the point first before pulling the trigger',
  wing: 'is opening up the court to run around and hit forehands',
  spin: 'is adding more shape to get the ball up above the slice',
  depth: 'is mixing the depth so they can\'t sit on it',
  returnPos: 'is standing a step further back to handle the body serve',
  plan: 'has reworked the game plan',
};
function answerBack(m, ps, i, set, rng) {
  if (!m.realPair || !m.exec) return;
  const a = (m.adapted || []).find(x => x.against === i && !x.answered);
  if (!a || rng() >= 0.12 + (attr(ps[i], 'iq') - 50) * 0.004) return;
  a.answered = true;
  m.exec[i] = Math.min(1, m.exec[i] + 0.6 * (0.25 + attr(ps[a.who], 'iq') / 200));
  m.moments.push({ set, who: i, kind: 'adapt', label: ANSWER[a.key] || ANSWER.plan, at: m.points.length - 1 });
}

// --- Advanced game plan (unlocked by better coaches) --------------------------------------
// Target wing, shot depth, energy pacing and big-point risk. Your settings count only if your coach
// has unlocked them; computer players at ATP level and above pick their own, so the top gets tactical.
const ADV_UNLOCK = { wing: 4, depth: 4, energy: 4, pressure: 4 }; // the Master coach
const ADV_TIERS = new Set(['ATP250', 'ATP500', 'M1000', 'GS']);
// How much weaker a player's backhand is than their forehand (negative: the forehand is the weaker
// wing). Fixed per player; one-handers tend to have the bigger gap.
function wingGap(p) {
  // You: your own (visible, trainable) gap, first set from the same formula everyone else uses.
  if (p && p.isPlayer && p.bhGap !== undefined) return p.bhGap;
  // Real players: the researched weaker wing (realscout.js).
  if (p && p.atpRank && typeof REAL_SCOUT !== 'undefined' && REAL_SCOUT[p.name]) return REAL_SCOUT[p.name].wing;
  let h = 2166136261;
  for (const ch of String(p.name || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return (h % 1000) / 1000 * 0.9 - 0.2 + (p.backhand === 'one' ? 0.15 : 0);
}
// Your forehand and backhand as ratings (from Groundstrokes and your wing gap): opponents aim at the weaker one.
function ensureWing(p) { if (p && p.bhGap === undefined) p.bhGap = Math.round(wingGap({ ...p, isPlayer: false }) * 100) / 100; return p; }
const wingRatings = p => { const g = wingGap(p), gr = p.attrs.ground ?? 50; return { fh: Math.round(Math.min(99, gr + (g < 0 ? -1 : 0.35) * Math.abs(g) * 14)), bh: Math.round(Math.min(99, gr + (g > 0 ? -1 : 0.35) * Math.abs(g) * 14)) }; };
let advTier = null; // the tier of the match being played (set by setGen)
function advPlan(p, o) {
  const pl = planOf(p), lv = p.advLevel || 0;
  if (p.isPlayer) {
    const out = {};
    for (const k of Object.keys(ADV_UNLOCK)) out[k] = lv >= ADV_UNLOCK[k] ? pl[k] : DEFAULT_PLAN[k];
    return out;
  }
  if (p.real || !ADV_TIERS.has(advTier) || !o) return { wing: pl.wing, depth: pl.depth, energy: pl.energy, pressure: pl.pressure };
  // Tour-level computer players play the percentages (real players keep their researched shot depth).
  const g = wingGap(o), a = p.attrs, rs = p.atpRank && typeof REAL_SCOUT !== 'undefined' && REAL_SCOUT[p.name];
  return {
    wing: g > 0.25 ? 'bh' : g < -0.1 ? 'fh' : 'neutral',
    depth: rs && rs.plan.depth ? rs.plan.depth : a.ground >= 62 ? 'deep' : a.ground < 52 ? 'high' : 'balanced',
    energy: a.stam >= 66 ? 'hustle' : 'normal',
    pressure: attr(o, 'mental') < 50 ? 'broke' : attr(o, 'mental') > 68 ? 'safe' : 'standard',
  };
}
// A's edge on a point against B from these settings.
function advEdge(m, A, B, ev, clutch) {
  const pl = advPlan(A, B);
  let e = 0;
  // Target wing: pick on the weaker side. Smart opponents adjust (run around it) as the match goes on.
  if (pl.wing !== 'neutral') {
    const g = wingGap(B) * (pl.wing === 'bh' ? 1 : -1);
    const covered = m.adj && m.adj[B.name] && m.adj[B.name].wing === pl.wing ? 0.25 : 1; // they've moved to cover it
    e += 0.014 * g * covered * Math.max(0.35, 1 - m.totalGames * attr(B, 'iq') / 100 * 0.025);
  }
  // Depth and margin: moonballs suit clay and blunt big hitters; deep driving suits strong ball-strikers on quick courts.
  const fast = ev.surface === 'grass' || ev.indoor, clay = ev.surface === 'clay';
  if (pl.depth === 'high') e += (clay ? 0.006 : fast ? -0.007 : 0) + (planOf(B).aggression === 'aggressive' ? 0.004 : 0) - (planOf(B).net === 'often' ? 0.005 : 0) + (55 - attr(A, 'ground')) * 0.0002;
  if (pl.depth === 'deep') e += (attr(A, 'ground') - 60) * 0.0005 + (fast ? 0.004 : clay ? -0.002 : 0);
  // Energy: all-out hustle wins more points now (and tires you faster); conserving does the opposite.
  if (pl.energy === 'hustle') e += 0.008;
  if (pl.energy === 'conserve') e -= 0.005;
  // Big points: go for broke against a fragile opponent, stay solid against a tough one.
  if (clutch) {
    if (pl.pressure === 'broke') e += clamp(0.0012 * (55 - attr(B, 'mental')) + 0.0006 * (attr(A, 'mental') - 60), -0.03, 0.03);
    if (pl.pressure === 'safe') e += clamp(0.0006 * (attr(B, 'mental') - 55), -0.012, 0.012);
  }
  return A.textbook && e > 0 ? e * (1 - 0.6 * A.textbook) : e; // a copied plan's edges are expected (and partly covered)
}

// Lefty serving to a righty: the slice out wide on the ad side is the classic weapon.
function handEdge(A, B, ad) {
  if (lefty(A) && !lefty(B)) return ad ? 0.012 : 0.003;
  if (!lefty(A) && lefty(B)) return -0.002;
  return 0;
}

function pointProb(m, ps, ev, s, clutch, ad = false) {
  const r = 1 - s, A = ps[s], B = ps[r];
  let p = SERVE_BASE + 0.0034 * (serveRating(A, ev.surface) - returnRating(B, ev.surface))
    + 0.0018 * (attr(A, 'iq') - attr(B, 'iq')) + handEdge(A, B, ad)
    + SURFACE_SERVE[ev.surface] + comfort(A, ev) - comfort(B, ev)
    + m.form[s] - m.form[r] + m.mood[s] - m.mood[r]
    - (fatigue(m, A) - fatigue(m, B)) * (typeof wxOf === 'function' ? wxOf(ev).heat : 1) - tiredness(A) + tiredness(B)
    - (A.focusPen || 0) + (B.focusPen || 0) // autopilot: simming without watching (see tournaments.js)
    + (A.moraleEdge || 0) - (B.moraleEdge || 0) // morale (see morale.js)
    + (A.serveEdge || 0) - (B.returnEdge || 0) // a real player's own serve and return numbers (realstats.js)
    + advEdge(m, A, B, ev, clutch) - advEdge(m, B, A, ev, clutch) // advanced plan (coach unlocks)
    + (A.prepEdge || 0) - (B.prepEdge || 0) + (clutch ? (A.prepClutch || 0) - (B.prepClutch || 0) : 0) // week's preparation (prep.js)
    - 0.022 * (quirkHits(A, B).length - quirkHits(B, A).length) // walking into a hidden strength
    - 0.012 * (Math.min(4, strengthHits(A, B).length) - Math.min(4, strengthHits(B, A).length)) // walking into a known strength
    + LEGEND_X * (legendSurge(m, ps, s) - legendSurge(m, ps, r)) // a legend raising their level when behind
    + LEGEND_X * (legendPressure(m, ps, s) - legendPressure(m, ps, r)) // a legend's aura, and every adjustment you haven't answered
    + 0.012 * (Math.min(4, readHits(A, B, ev)) * clamp(m.exec ? m.exec[s] : 1, 0, 1.3) - Math.min(4, readHits(B, A, ev)) * clamp(m.exec ? m.exec[r] : 1, 0, 1.3)); // exploiting a known weakness
  if (m.call) p += m.call.side === s ? m.call.edge : -m.call.edge; // big-point call
  // Momentum and nerves (see gameMood).
  if (m.mo) p += s === 0 ? m.mo : -m.mo;
  if (m.nerves) p += m.nerves[s] - m.nerves[r];
  // Weather: conditions suit some styles, serves and spins more than others.
  if (m.styles && typeof wxEdge === 'function') p += wxEdge(A, m.styles[s], ev) - wxEdge(B, m.styles[r], ev);
  if (clutch) {
    const edge = 0.003 * (A.attrs.mental - B.attrs.mental);
    const robotCap = x => x > 0 ? x * 0.5 : x;
    p += A.temperament === 'robotic' ? robotCap(edge) : B.temperament === 'robotic' ? -robotCap(-edge) : edge;
  }
  if (m.realPair && REAL_GAP !== 1) { const mid = SERVE_BASE + SURFACE_SERVE[ev.surface]; p = mid + (p - mid) * REAL_GAP; }
  return clamp(p, 0.35, 0.85);
}

function trigger(m, ps, i, kind, rng) {
  const rule = MOOD[ps[i].temperament][kind];
  if (!rule || m.moodLeft[i] > 0) return;
  const [chance, delta, games, label, texts] = rule;
  const odds = delta < 0 ? chance * (1 - ps[i].attrs.mental / 120) : chance;
  if (rng() >= odds) return;
  m.mood[i] = delta;
  m.moodLeft[i] = games;
  m.moments.push({ set: m.sets.length + 1, who: i, kind: delta < 0 ? 'dip' : 'surge', label, text: texts && pick(rng, texts), effect: moodEffect(delta, games), at: m.points.length - 1 });
}

function tickMood(m) {
  for (const i of [0, 1]) if (m.moodLeft[i] > 0 && --m.moodLeft[i] === 0) m.mood[i] = 0;
}

// Sets needed to win the match (best of 3, or best of 5 at the Slams).
const setsToWin = m => Math.ceil((m.bestOf || 3) / 2);
// Tiebreak length: first to 10 in the fifth set of a best-of-five (the Grand Slam rule), else first to 7.
const tbTarget = m => (m.bestOf || 3) === 5 && m.sets.length === 4 ? 10 : 7;

// Who would win the set (and whether the match) by winning the next point, if anyone.
function pressure(m, pts, tb) {
  const won = [0, 1].map(i => m.sets.filter(x => x.games[i] > x.games[1 - i]).length);
  for (const i of [0, 1]) {
    const o = 1 - i, p = pts[i] + 1;
    const winsGame = tb ? p >= tbTarget(m) && p - pts[o] >= 2 : p >= 4 && p - pts[o] >= 2;
    if (!winsGame) continue;
    const g = m.games[i] + 1;
    if (!tb && !(g >= 6 && g - m.games[o] >= 2)) return null;
    return { who: i, match: won[i] === setsToWin(m) - 1 };
  }
  return null;
}

function logPoint(m, rec) {
  // Rally lengths for the match story: total, long rallies (9+) and quick points (3 or fewer) by winner.
  const r = m.rally = m.rally || { sum: 0, n: 0, long: [0, 0], short: [0, 0], net: [0, 0] };
  const len = rec.len || 1;
  r.sum += len; r.n++;
  if (len >= 9) r.long[rec.w]++;
  if (len <= 3) r.short[rec.w]++;
  if (m.track) m.points.push({ ...rec, games: [...m.games] });
}

const RALLY_MEAN = { grass: 2.5, hard: 3.5, clay: 5 };

// One point on serve: first/second serve, double faults, aces, rally length and how it ended.
// Win odds per serve are solved so the overall point odds stay equal to pointProb.
const SERVE_PLAN = { safe: { da: 0.1, ace: 0.5, kmh: -8 }, balanced: { da: 0, ace: 1, kmh: 0 }, big: { da: -0.1, ace: 1.6, kmh: 6 } };

// How much a player's rally style shifts the points they're in. Aggressive pays off only with
// strong groundstrokes; patient pays off with stamina and smarts.
// It also depends on who's across the net: fit defenders soak up aggression; patience pays against
// shaky ball-strikers and against opponents who go for too much.
// Spin: flat hitting is fast and direct (needs clean groundstrokes, loves grass and indoor courts);
// heavy topspin is safe and kicks up high (needs legs, loves clay).
const SPIN_SURFACE = { flat: { grass: 0.008, hard: 0.002, clay: -0.006 }, topspin: { grass: -0.007, hard: -0.002, clay: 0.006 } };
// Matchups: high topspin pushes a flat hitter out of their strike zone (more so on slow clay);
// flat pace rushes a topspin grinder on quick courts.
const SPIN_VS = { topspin: { clay: 0.006, hard: 0.003, grass: 0 }, flat: { grass: 0.006, hard: 0.002, clay: 0 } };
function spinEdge(p, o, ev) {
  const sp = planOf(p).spin, os = planOf(o).spin;
  let e = 0;
  // Relative to each player's own game and to the opponent, so it means the same at every level.
  if (sp === 'flat') e = 0.0012 * rel(p, 'ground') + 0.0006 * (p.attrs.ground - o.attrs.stam) + SPIN_SURFACE.flat[ev.surface] + (ev.indoor ? 0.003 : 0);
  if (sp === 'topspin') e = 0.0008 * rel(p, 'stam') + 0.0005 * (p.attrs.stam - o.attrs.ground) + SPIN_SURFACE.topspin[ev.surface] - (ev.indoor ? 0.002 : 0);
  if (sp === 'topspin' && os === 'flat') e += SPIN_VS.topspin[ev.surface] - 0.0006 * rel(o, 'ground');
  if (sp === 'flat' && os === 'topspin') e += SPIN_VS.flat[ev.surface] + (ev.indoor ? 0.003 : 0) - 0.0006 * rel(o, 'stam');
  return e;
}

function rallyEdge(p, o, ev) {
  const pl = planOf(p), op = planOf(o);
  const sp = ev ? spinEdge(p, o, ev) : 0;
  return sp + rallyStyle(p, o, pl, op);
}
function rallyStyle(p, o, pl, op) {
  // Relative: your groundstrokes against their legs (aggressive), your legs and smarts against their hitting (patient).
  if (pl.aggression === 'aggressive') return 0.0014 * rel(p, 'ground') + 0.0009 * (p.attrs.ground - o.attrs.stam) - 0.0008 * rel(o, 'stam');
  if (pl.aggression === 'patient') return 0.0011 * rel(p, 'stam') + 0.0009 * rel(p, 'iq') + 0.0008 * (p.attrs.stam - o.attrs.ground) - 0.002
    - 0.0008 * rel(o, 'ground') + (op.aggression === 'aggressive' ? -0.0012 * rel(o, 'ground') + 0.003 : 0);
  return 0;
}

// One point on serve: first/second serve, double faults, aces, rally length and how it ended.
// Base win odds per serve are solved so the overall point odds equal pointProb; the game plans then shift them.
// Which wing hit the point's last ball: errors come more from a player's weaker wing (and the wing the opponent
// targets), winners more from the stronger one. Decided from the point count, not the random stream, so it
// never changes a result.
// A steady 0–1 number for this point (from the point count): picks presentation details without touching the
// random stream, so results never change.
const pointHash = (m, salt = 0) => Math.abs(Math.sin(((m.sets || []).length * 97 + (m.points || []).length + 1) * 12.9898 + salt * 4.1414) * 43758.5453) % 1;
function finalWing(m, ps, h, clean) {
  const g = wingGap(ps[h]), tgt = advPlan(ps[1 - h], ps[h]).wing, n = (m.sets || []).length * 97 + (m.points || []).length;
  const pBh = clamp(0.42 + (tgt === 'bh' ? 0.18 : tgt === 'fh' ? -0.18 : 0) + (clean ? -0.5 : 0.7) * g, 0.1, 0.9);
  const u = Math.abs(Math.sin((n + 1) * 12.9898 + h * 78.233) * 43758.5453) % 1;
  return u < pBh ? 'bh' : 'fh';
}
function servePoint(m, ps, ev, s, clutch, rng, ad = false) {
  const r = 1 - s, A = ps[s], B = ps[r], st = m.stats[s];
  const sp = planOf(A), rp = planOf(B), SP = SERVE_PLAN[sp.serve];
  const p = pointProb(m, ps, ev, s, clutch, ad);
  const a0 = clamp(0.62 - (A.attrs.serve - 50) * 0.0015 + (A.attrs.mental - 50) * 0.0015, 0.5, 0.75);
  const df = clamp(0.07 + (A.attrs.serve - 50) * 0.0006 - (A.attrs.mental - 50) * 0.0008 + (clutch ? 0.015 : 0), 0.02, 0.14);
  let w1 = Math.min(0.9, p + 0.08);
  let w2 = clamp((p - a0 * w1) / ((1 - a0) * (1 - df)), 0.2, 0.75);
  // Serve plan: big = fewer in but more damage (worth it with a big serve); safe = the reverse.
  const a = clamp(a0 + SP.da, 0.4, 0.85);
  if (sp.serve === 'big') w1 += (0.03 + rel(A, 'serve') * 0.0015 + (A.attrs.serve - B.attrs.ret) * 0.0008 - rel(B, 'ret') * 0.001) * ex(m, s);
  if (sp.serve === 'safe') w1 -= 0.03 - (A.attrs.mental - 50) * 0.0005;
  // Return position: deep blunts big first serves but hands over second-serve points; inside does the opposite.
  const bigness = Math.max(0, A.attrs.serve - 50);
  if (rp.returnPos === 'deep') { w1 -= (0.012 + bigness * 0.0008) * ex(m, r); w2 += 0.03; }
  if (rp.returnPos === 'inside') { w1 += 0.02 + Math.max(0, rel(A, 'serve')) * 0.002; w2 -= (0.035 + rel(B, 'ret') * 0.001 + (B.attrs.ret - A.attrs.serve) * 0.0008 - rel(A, 'serve') * 0.0008) * ex(m, r); }
  // Rally style applies to the points that become rallies.
  const edge = 0.8 * (rallyEdge(A, B, ev) * ex(m, s) - rallyEdge(B, A, ev) * ex(m, r));
  w1 = clamp(w1 + edge, 0.3, 0.95);
  w2 = clamp(w2 + edge, 0.15, 0.85);

  // Occasionally, by plan, a cheeky underarm serve instead.
  const under = tryUnderarm(m, ps, s, rng);
  if (under) return under;
  st.servePts++;
  const pt = { serve2: false, how: null, len: 1, net: null };
  // A big-point call is carried out on this point (and shown on court).
  const call = m.call ? { side: m.call.side, id: m.call.id } : null;
  if (call) pt.call = call;
  const sty = m.styles || [];
  let w;
  // ITF-level average (serve 50): ~180 km/h first, ~145 km/h second. Elite servers (90) reach ~210+.
  const kmh1 = Math.round(140 + A.attrs.serve * 0.8 + SP.kmh + gauss(rng) * 6 + (call && call.side === s && ['big', 'body'].includes(callFx(call).serve) ? 8 : 0));
  pt.kmh1 = kmh1;
  // A let (serve clips the tape and lands in) is replayed; it only shows on court.
  if (rng() < 0.006) pt.let = true;
  if ((call && call.side === s && ['safe', 'kick'].includes(callFx(call).serve)) || rng() < a) { // "make the first serve" calls always land it
    st.firstIn++;
    st.sp1 += kmh1; st.sp1n++; st.spMax = Math.max(st.spMax, kmh1);
    w = rng() < w1 ? s : r;
  } else {
    pt.serve2 = true;
    const kmh2 = Math.round(115 + A.attrs.serve * 0.6 + gauss(rng) * 5);
    pt.kmh2 = kmh2;
    if (rng() < df) {
      st.df++;
      pt.how = 'df';
      return { w: r, pt };
    }
    st.sp2 += kmh2; st.sp2n++; st.spMax = Math.max(st.spMax, kmh2);
    w = rng() < w2 ? s : r;
  }
  const done = () => { if (w === s) pt.serve2 ? st.secondWon++ : st.firstWon++; return { w, pt }; };
  if (w === s) {
    const tr = m.traits || [];
    const aceK = (ACE_SERVER[sty[s]] || 1) * (ACE_SERVER[tr[s]] || 1) * (ACE_RETURNER[sty[r]] || 1) * (ACE_RETURNER[tr[r]] || 1) * (rp.returnPos === 'deep' ? 0.85 : 1) * (typeof wxOf === 'function' ? wxOf(ev).ace : 1);
    if (!pt.serve2 && rng() < Math.max(0, A.attrs.serve - 30) / 280 * SP.ace * aceK) { st.aces++; pt.how = 'ace'; return done(); }
    if (rng() < (pt.serve2 ? 0.05 : 0.16) * aceK) { pt.how = 'unreturned'; return done(); }
  }
  // Net cord, roughly once a match: the ball clips the tape and trickles over (a winner), falls back
  // (an error), or pops up and the rally goes on.
  if (rng() < 0.0065) {
    const by = rng() < 0.5 ? s : r, roll = rng();
    const hitter = k => k % 2 === 0 ? s : r;
    let len = 3 + Math.floor(rng() * 4);
    if (hitter(len - 1) !== by) len++;
    if (roll < 0.45) {
      w = by;
      m.stats[by].winners++;
      m.stats[by].netcords = (m.stats[by].netcords || 0) + 1;
      Object.assign(pt, { how: 'netcord', len, netcord: { by, result: 'over' } });
      return done();
    }
    if (roll < 0.65) {
      w = 1 - by;
      m.stats[by].ue++;
      Object.assign(pt, { how: 'netcordback', len, netcord: { by, result: 'back' } });
      return done();
    }
    pt.netcord = { by, result: 'continue' };
  }
  // Tactics: a drop shot or a net approach replaces the normal rally outcome.
  // Serve-and-volley and chip-and-charge calls always come in.
  const fx = callFx(call);
  const rush = call && (fx.rush === 'serve' && call.side === s || fx.rush === 'return' && call.side === r) ? call.side : null;
  const tactic = rush !== null ? tryNet(m, ps, ev, s, rng, rush) : tryDrop(m, ps, ev, s, rng, fx.drop ? call.side : undefined) || tryNet(m, ps, ev, s, rng);
  if (tactic && tactic.retrieved) Object.assign(pt, tactic.pt);
  else if (tactic) {
    w = tactic.w;
    Object.assign(pt, tactic.pt);
    return done();
  }
  // Net players come in: a serve-and-volleyer follows most first serves, a Net Attacker comes in
  // from anywhere, an All-Court player picks moments. How it ends depends on who is passing.
  const hit = k => k % 2 === 0 ? s : r;
  if (rush === null && !pt.netcord && !pt.drop) {
    let by = null, style = null;
    const ns = NET_STYLE[sty[s]], nr = NET_STYLE[sty[r]];
    if (ns && rng() < (pt.serve2 ? ns[1] : ns[0])) { by = s; style = 'snv'; }
    else if (nr && rng() < nr[2]) { by = r; style = rng() < 0.55 ? 'chip' : null; }
    else if (ns && rng() < ns[2]) { by = s; style = null; }
    if (by !== null) {
      const won = w === by, o = 1 - by;
      // The volleyer finishes it (volley winner or a forced error), or gets passed / misses a volley.
      const clean = won ? rng() < 0.68 + (famOf(sty[by]) === 'net' ? 0.08 : 0) : rng() < PASSER[famOf(sty[o])];
      const last = clean ? w : 1 - w;
      pt.how = clean ? 'winner' : won ? 'fe' : 'ue';
      m.stats[by].netPlayed++; if (won) m.stats[by].netWon++;
      if (clean) m.stats[w].winners++; else if (pt.how === 'ue') m.stats[1 - w].ue++;
      let len = style === 'snv' ? (last === s ? 3 : 2) : style === 'chip' ? (last === by ? 4 : 3) : 3 + Math.floor(rng() * 5);
      if (!style && hit(len - 1) !== last) len++;
      Object.assign(pt, { len, net: { by, won, style } });
      return done();
    }
  }
  const l = 1 - w;
  // A return winner: the returner's style (and standing in) shows on the very first ball.
  if (w === r && !call && !pt.drop && !pt.netcord && rng() < Math.max(RETURN_WINNER[sty[r]] || 0, RETURN_WINNER[(m.traits || [])[r]] || 0) * (pt.serve2 ? 1.5 : 1) * (rp.returnPos === 'inside' ? 1.3 : 1)) {
    pt.how = 'winner'; pt.len = 2; pt.returnWinner = true;
    m.stats[r].winners++;
    return done();
  }
  // Drop shots: a Variety / Slice-Heavy player wins plenty of points with touch.
  if (!pt.drop && !pt.netcord && rng() < (DROP_STYLE[sty[w]] || 0)) {
    let len = 3 + Math.floor(rng() * 4);
    if (hit(len - 1) !== w) len++;
    m.stats[w].dropPlayed = (m.stats[w].dropPlayed || 0) + 1; m.stats[w].dropWon = (m.stats[w].dropWon || 0) + 1; m.stats[w].winners++;
    Object.assign(pt, { how: 'drop', len, drop: { by: w, result: 'won' } });
    return done();
  }
  // Rally: who hit the last ball, and was it a winner or an error? Plans and both styles shape it.
  const styleLen = [sp, rp].reduce((x, pl) => x * (pl.aggression === 'aggressive' ? 0.75 : pl.aggression === 'patient' ? 1.25 : 1)
    * (pl.spin === 'flat' ? 0.88 : pl.spin === 'topspin' ? 1.1 : 1), 1)
    * (rp.returnPos === 'deep' ? 1.1 : 1);
  // Advanced plans shape the points too (not who wins them): moonballs and hustle make long rallies,
  // deep driving and going for broke make short ones; safe big points become grinds.
  const aw = advPlan(ps[w], ps[l]), al = advPlan(ps[l], ps[w]);
  const advLen = [aw, al].reduce((x, a) => x * ({ high: 1.55, deep: 0.72 }[a.depth] || 1) * ({ hustle: 1.22, conserve: 0.85 }[a.energy] || 1)
    * (clutch ? ({ broke: 0.5, safe: 1.6 }[a.pressure] || 1) : 1), 1);
  let len = 1 + Math.ceil(-Math.log(rng() || 0.01) * RALLY_MEAN[ev.surface] * styleLen * matchupRally(sty, w, ev, m) * (typeof wxOf === 'function' ? wxOf(ev).rally : 1) * advLen);
  // A first-strike server wins it on the serve +1.
  if ((sty[w] === 'First-Strike Attacker' || sty[w] === 'Serve +1 Attacker') && w === s) len = Math.min(len, rng() < 0.7 ? 3 : 5);
  const W = ps[w].attrs, wp = planOf(ps[w]), lp = planOf(ps[l]);
  const fw = famOf(sty[w]), fl = famOf(sty[l]);
  // Attackers beat defenders with winners; defenders beat attackers by making them miss.
  const cleanOdds = 0.35 + ((W.ground + W.net) / 2 - 50) * 0.004 + (wp.aggression === 'aggressive' ? 0.12 : wp.aggression === 'patient' ? -0.08 : 0)
    + (wp.spin === 'flat' ? 0.06 : wp.spin === 'topspin' ? -0.04 : 0) + (STYLE_CLEAN[sty[w]] || 0)
    + (fw === 'attack' && fl === 'defend' ? 0.06 : 0) - (fw === 'defend' && fl === 'attack' ? 0.08 : 0)
    + ({ deep: 0.12, high: -0.14 }[aw.depth] || 0) + (al.energy === 'conserve' ? 0.1 : al.energy === 'hustle' ? -0.08 : 0)
    + (clutch ? ({ broke: 0.22, safe: -0.14 }[aw.pressure] || 0) : 0)
    - (m.badDay && m.badDay[l] ? 0.15 : 0); // against someone having a bad day, points end on their errors
  const clean = rng() < clamp(cleanOdds, 0.12, 0.75);
  const ueOdds = 0.6 - (ps[l].attrs.ground - 50) * 0.003 - (attr(ps[l], 'iq') - 50) * 0.003
    + (lp.aggression === 'aggressive' ? 0.15 : lp.aggression === 'patient' ? -0.12 : 0)
    + (lp.spin === 'flat' ? 0.06 : lp.spin === 'topspin' ? -0.03 : 0)
    + (fl === 'attack' && fw === 'defend' ? 0.14 : 0) - (fl === 'defend' ? 0.08 : 0) + (typeof wxOf === 'function' ? wxOf(ev).ue : 0)
    + ({ high: -0.2, deep: 0.08 }[al.depth] || 0) + (clutch ? ({ broke: 0.25, safe: -0.2 }[al.pressure] || 0) : 0)
    // Pressure on the weak wing draws the errors.
    + (aw.wing !== 'neutral' ? 0.25 * wingGap(ps[l]) * (aw.wing === 'bh' ? 1 : -1) : 0)
    + (m.badDay && m.badDay[l] ? 0.3 : 0); // a bad day: the misses keep coming
  pt.how = clean ? 'winner' : rng() < clamp(ueOdds, 0.2, 0.9) ? 'ue' : 'fe';
  const last = clean ? w : l;
  if (hit(len - 1) !== last) len++;
  pt.len = len;
  pt.wing = finalWing(m, ps, last, clean); // which wing hit the last ball (shown in Match Reads)
  if (clean) m.stats[w].winners++;
  else if (pt.how === 'ue') m.stats[l].ue++;
  return done();
}

const NET_RATE = { rarely: 0.03, sometimes: 0.09, often: 0.2 };
const NET_SURFACE = { grass: 0.06, hard: 0, clay: -0.05 };
// Coming in rarely means only on the best balls; coming in often means some poor approaches.
const NET_PICKINESS = { rarely: 0.05, sometimes: 0, often: -0.06 };

// Net approach: odds depend on volleys and approach shot against the opponent's passing game.
// forced: the side that comes in no matter what (a serve-and-volley or chip-and-charge call).
function tryNet(m, ps, ev, s, rng, forced = null) {
  const rate = i => NET_RATE[planOf(ps[i]).net] * (ev.surface === 'grass' ? 1.4 : ev.surface === 'clay' ? 0.7 : 1);
  const order = rng() < 0.5 ? [s, 1 - s] : [1 - s, s];
  const by = forced !== null ? forced : order.find(i => rng() < rate(i));
  if (by === undefined) return null;
  const o = 1 - by, X = ps[by], O = ps[o];
  const q = clamp(0.55 + (X.attrs.net - 50) * 0.0045 + (X.attrs.ground - 50) * 0.0015 + (attr(X, 'iq') - 50) * 0.001
    - (O.attrs.ret - 50) * 0.002 - (O.attrs.ground - 50) * 0.003
    + NET_SURFACE[ev.surface] + NET_PICKINESS[planOf(X).net] * (1 - (attr(X, 'iq') - 50) / 100)
    + (ex(m, by) - 1) * 0.06, 0.25, 0.85);
  m.stats[by].netPlayed++;
  const won = rng() < q;
  const w = won ? by : o, l = 1 - w;
  if (won) m.stats[by].netWon++;
  // Won at the net: volley winner or a missed pass. Lost: passing winner or a missed volley.
  const clean = rng() < (won ? 0.7 : 0.65);
  const how = clean ? 'winner' : won ? 'fe' : 'ue';
  if (clean) m.stats[w].winners++;
  else if (how === 'ue') m.stats[l].ue++;
  const hitter = k => k % 2 === 0 ? s : 1 - s;
  const last = clean ? w : l;
  // Serve-and-volley: serve, return, volley. Chip-and-charge: serve, chip, pass, volley.
  const style = forced === null ? null : by === s ? 'snv' : 'chip';
  let len = style === 'snv' ? (last === s ? 3 : 2) : style === 'chip' ? (last === by ? 4 : 3) : 3 + Math.floor(rng() * 5);
  if (!style && hitter(len - 1) !== last) len++;
  return { w, pt: { how, len, net: { by, won, style } } };
}

const DROP_RATE = { rarely: 0.012, sometimes: 0.03, often: 0.06 };
const DROP_SURFACE = { clay: 0.08, grass: 0.04, hard: 0 };

// Rate comes from the game plan; opponents' plans already reflect their touch and smarts.
function dropRate(p, ev) {
  return DROP_RATE[planOf(p).drops] * (ev.surface === 'clay' ? 1.3 : ev.surface === 'grass' ? 0.8 : 1);
}

// Odds a drop shot works: touch and IQ against the opponent's legs, plus the surface and how long the match has gone.
// How well the opponent covers a drop: legs (stamina, minus tiredness) plus reading it early (IQ).
function retrieval(m, O) {
  return (O.attrs.stam - 50 - fatigue(m, O) * 400) + (attr(O, 'iq') - 50) * 0.8;
}

function dropSuccess(m, D, O, ev) {
  const touch = (attr(D, 'iq') + D.attrs.net) / 2 - 50;
  return clamp(0.5 + touch * 0.006 - retrieval(m, O) * 0.0035 + DROP_SURFACE[ev.surface], 0.2, 0.8);
}

function tryDrop(m, ps, ev, s, rng, forced) {
  const order = rng() < 0.5 ? [s, 1 - s] : [1 - s, s];
  const by = forced !== undefined ? forced : order.find(i => rng() < dropRate(ps[i], ev)); // a drop-shot call always plays it
  if (by === undefined) return null;
  const o = 1 - by;
  const st = m.stats[by];
  st.dropPlayed = (st.dropPlayed || 0) + 1;
  const hitter = k => k % 2 === 0 ? s : 1 - s;
  let len = 3 + Math.floor(rng() * 4);
  if (rng() < dropSuccess(m, ps[by], ps[o], ev) + (ex(m, by) - 1) * 0.06) {
    st.dropWon = (st.dropWon || 0) + 1;
    st.winners++;
    if (hitter(len - 1) !== by) len++;
    // Heavy backspin: now and then the ball bites and spins away sideways off the bounce.
    return { w: by, pt: { how: 'drop', len, drop: { by, result: 'won', spin: pointHash(m, 5) < clamp((attr(ps[by], 'iq') - 55) / 90, 0.05, 0.4) } } };
  }
  // Not a winner. It clips the net; or the opponent gets there. A smart, fit retriever arrives early
  // enough to counterattack and win the point; otherwise they just dig it back and the rally goes on.
  if (rng() < 0.35) {
    st.ue++;
    if (hitter(len - 1) !== by) len++;
    return { w: o, pt: { how: 'dropnet', len, drop: { by, result: 'net' } } };
  }
  const counter = clamp(0.35 + retrieval(m, ps[o]) * 0.008, 0.1, 0.8);
  if (rng() < counter) {
    m.stats[o].winners++;
    if (hitter(len - 1) !== o) len++;
    // Great hands answer a drop with a drop: dug up and re-dropped cross-court, away from the hitter.
    const touch = (attr(ps[o], 'iq') + ps[o].attrs.net) / 2, h = pointHash(m, 3);
    return { w: o, pt: { how: 'dropchased', len, drop: { by, result: 'chased', redrop: touch >= 66 && h < (touch - 56) / 60 } } };
  }
  return { retrieved: true, pt: { drop: { by, result: 'retrieved' } } };
}

const UNDERARM_RATE = { never: 0, rarely: 0.007, sometimes: 0.02 };

// Cheeky underarm serve: deadly against a returner standing deep, punished by one who reads it.
// Each one in a match is less of a surprise.
function tryUnderarm(m, ps, s, rng) {
  const A = ps[s], B = ps[1 - s];
  if (rng() >= UNDERARM_RATE[planOf(A).underarm || 'never']) return null;
  const st = m.stats[s];
  const used = st.underarm || 0;
  const rp = planOf(B);
  const deep = rp.returnPos === 'deep' ? 0.25 : rp.returnPos === 'inside' ? -0.15 : 0;
  const odds = clamp(0.5 + deep + (attr(A, 'iq') - 50) * 0.004 - (attr(B, 'iq') - 50) * 0.003 - (B.attrs.stam - 50) * 0.002 - used * 0.08, 0.12, 0.85);
  st.underarm = used + 1;
  st.servePts++;
  if (rng() < odds) {
    st.underarmWon = (st.underarmWon || 0) + 1;
    st.firstWon++; st.firstIn++;
    return { w: s, pt: { how: 'underarmWin', underarm: true, len: 1 } };
  }
  st.firstIn++;
  m.stats[1 - s].winners++;
  return { w: 1 - s, pt: { how: 'underarmLost', underarm: true, len: 2 } };
}

// The game, tiebreak and set loops are generators: they pause (yield) before every point with what's at
// stake, so a live match can stop and ask for a big-point call. playSet runs straight through.
// --- Momentum, nerves and swings ------------------------------------------------------------
// Matches aren't steady. Every point won builds momentum and every point lost drains it, so runs feed
// themselves. Fiery players swing harder, robotic ones barely move. Serving for a set can bring on nerves
// (more so with low mental strength) while the player far behind swings freely. Now and then a player
// finds another gear, or goes off the boil, out of nowhere.
const MO_GAIN = 0.01, MO_DECAY = 0.92, MO_MAX = 0.08;
const moSense = p => ({ fiery: 1.4, moping: 1.2, stoic: 0.9, robotic: 0.5 })[p.temperament] || 1;
// m.mo > 0 favours side 0.
function momentumPoint(m, ps, winner) {
  const k = moSense(ps[winner]) * 0.5 + moSense(ps[1 - winner]) * 0.5;
  m.mo = clamp(((m.mo || 0) + (winner === 0 ? 1 : -1) * MO_GAIN * k) * MO_DECAY, -MO_MAX, MO_MAX);
}
// At the start of each game: nerves for a player serving for the set; a free swing for the one far behind;
// and the occasional swing out of nowhere.
function gameMood(m, ps, s, rng) {
  m.nerves = [0, 0];
  const r = 1 - s, g = m.games;
  // Missed break chances linger: the player who wasted them serves this game shakier.
  if (m.missed && m.missed.who === s) {
    const n = m.missed.n, hit = Math.min(0.06, 0.015 + 0.012 * n) * (1.2 - attr(ps[s], 'mental') / 100) * moSense(ps[s]);
    if (rng() < 0.3 + 0.1 * n - (attr(ps[s], 'mental') - 50) / 100) {
      m.nerves[s] -= hit;
      m.moments.push({ set: m.sets.length + 1, who: s, kind: 'dip', label: 'rued the missed chances', at: m.points.length - 1,
        text: pick(rng, [`was still thinking about the ${n} missed break point${n === 1 ? '' : 's'}`, 'looked rattled after letting the break chances slip', 'served nervously after wasting the break chances']),
        effect: `−${(hit * 100).toFixed(1)}% on points this game` });
    }
  }
  m.missed = null;
  const servingForSet = g[s] >= 5 && g[s] - g[r] >= 1;
  if (servingForSet) {
    const tight = 0.42 * (1 - attr(ps[s], 'mental') / 110) * moSense(ps[s]) + (g[s] - g[r] >= 3 ? 0.1 : 0);
    if (rng() < tight) {
      m.nerves[s] = -0.07;
      m.moments.push({ set: m.sets.length + 1, who: s, kind: 'dip', label: 'got tight', at: m.points.length - 1,
        text: pick(rng, ['got tight serving for the set', 'started to feel the nerves serving for the set', 'went tentative trying to close out the set']), effect: 'Serving for the set: −7% on points this game' });
    }
  }
  // A big lead breeds complacency; far behind, there's nothing to lose.
  for (const i of [0, 1]) if (g[i] - g[1 - i] >= 3) { m.nerves[i] -= 0.02; m.nerves[1 - i] += 0.035; }
  if (rng() < 0.025) { // the odd unexplained swing (rarer: most swings now come from pressure, leads and fatigue)
    const i = rng() < 0.5 ? 0 : 1, up = rng() < 0.4 + (attr(ps[i], 'mental') - 50) / 100;
    m.mo = clamp((m.mo || 0) + (i === 0 ? 1 : -1) * (up ? 0.05 : -0.05), -MO_MAX, MO_MAX);
    m.moments.push({ set: m.sets.length + 1, who: i, kind: up ? 'surge' : 'dip', label: up ? 'found another gear' : 'went off the boil', at: m.points.length - 1,
      text: up ? pick(rng, ['suddenly found another gear', 'started hitting everything clean', 'caught fire out of nowhere'])
        : pick(rng, ['went off the boil', 'lost focus for a few games', 'let their level slip']), effect: 'Momentum swing' });
  }
}

function* gameGen(m, ps, ev, rng) {
  const s = m.server, r = 1 - s;
  const pts = [0, 0];
  let gameBps = 0;
  gameMood(m, ps, s, rng);
  for (;;) {
    const bp = pts[r] >= 3 && pts[r] > pts[s];
    const press = m.track ? pressure(m, pts, false) : null;
    if (bp) { m.stats[r].bpChances++; m.stats[s].bpFaced++; gameBps++; }
    yield { s, bp: bp ? r : null, press, tb: false, pts: [...pts] };
    const { w: winner, pt } = servePoint(m, ps, ev, s, bp, rng, (pts[0] + pts[1]) % 2 === 1);
    endCall(m, ps, winner);
    momentumPoint(m, ps, winner);
    pts[winner]++;
    m.stats[winner].points++;
    if (bp) winner === r ? m.stats[r].bpWon++ : m.stats[s].bpSaved++;
    const over = pts[winner] >= 4 && pts[winner] - pts[1 - winner] >= 2;
    if (over) {
      m.games[winner]++; m.totalGames++;
      m.stats[s].svcGames++;
      if (winner === s) m.stats[s].svcHeld++;
    }
    logPoint(m, { s, w: winner, ace: pt.how === 'ace', ...pt, bp: bp ? r : null, press, tb: false, pts: [...pts], end: over });
    if (over) {
      tickMood(m);
      if (winner === r) { trigger(m, ps, s, 'broken', rng); trigger(m, ps, r, 'broke', rng); }
      // Held despite facing break points: the returner wasted them (they may carry it into their own serve).
      if (winner === s && gameBps > 0) m.missed = { who: r, n: gameBps };
      // A break swings the mood towards the breaker.
      if (winner === r) m.mo = clamp((m.mo || 0) + (r === 0 ? 0.02 : -0.02), -MO_MAX, MO_MAX);
      // Remember each player's biggest lead this set (for blown leads in the story).
      m.lead = m.lead || [null, null];
      for (const i of [0, 1]) if (m.games[i] >= 4 && m.games[i] - m.games[1 - i] >= 2 && (!m.lead[i] || m.games[i] - m.games[1 - i] > m.lead[i][0] - m.lead[i][1])) m.lead[i] = [m.games[i], m.games[1 - i]];
      m.server = r;
      return;
    }
  }
}

function* tiebreakGen(m, ps, ev, rng) {
  const pts = [0, 0];
  const first = m.server;
  for (let n = 0; ; n++) {
    const s = Math.floor((n + 1) / 2) % 2 === 0 ? first : 1 - first;
    const press = m.track ? pressure(m, pts, true) : null;
    yield { s, bp: null, press, tb: true, pts: [...pts] };
    const { w: winner, pt } = servePoint(m, ps, ev, s, true, rng, (pts[0] + pts[1]) % 2 === 1);
    endCall(m, ps, winner);
    momentumPoint(m, ps, winner);
    pts[winner]++;
    m.stats[winner].points++;
    const over = pts[winner] >= tbTarget(m) && pts[winner] - pts[1 - winner] >= 2;
    if (over) { m.games[winner]++; m.totalGames++; }
    logPoint(m, { s, w: winner, ace: pt.how === 'ace', ...pt, bp: null, press, tb: true, pts: [...pts], end: over });
    if (over) {
      m.server = 1 - first;
      return pts;
    }
  }
}

// One full set; returns { games, tb } where tb is the tiebreak score if one was played.
function* setGen(m, ps, ev, rng = Math.random) {
  advTier = ev.tier;
  if (!m.form) initForm(m, ps, rng);
  m.games = [0, 0];
  m.points = [];
  m.lead = [null, null];
  m.nerves = [0, 0];
  let tb = null;
  for (;;) {
    const [g0, g1] = m.games;
    if ((g0 >= 6 || g1 >= 6) && Math.abs(g0 - g1) >= 2) break;
    if (g0 === 6 && g1 === 6) { tb = yield* tiebreakGen(m, ps, ev, rng); break; }
    yield* gameGen(m, ps, ev, rng);
    // At tour level, a player falling behind mid-set may adjust right away.
    const [h0, h1] = m.games, trail = h0 < h1 ? 0 : 1;
    if (ADV_TIERS.has(advTier) && h0 + h1 === 6 && Math.abs(h0 - h1) >= 2 && m.exec && readable(ps, trail, 1 - trail) && m.exec[1 - trail] > 0.6
      && rng() < 0.3 * adaptRate() * (attr(ps[trail], 'iq') / 60) * (1 + 0.6 * (ps[1 - trail].textbook || 0)) * legendAdapt(ps, trail, 1 - trail)) adaptTo(m, ps, trail, 1 - trail, m.sets.length + 1);
    // Real players who've been countered may answer back at the changeover.
    if ((h0 + h1) % 2 === 1) for (const i of [0, 1]) answerBack(m, ps, i, m.sets.length + 1, rng);
    // A legend broken by you works out what you did, straight away.
    { const lp = m.points && m.points[m.points.length - 1];
      if (lp && lp.end && !lp.tb && lp.w !== lp.s && isLegend(ps[lp.s]) && ps[lp.w].isPlayer && m.exec && rng() < 0.6) adaptTo(m, ps, lp.s, lp.w, m.sets.length + 1); }
    // A legend 3+ games down re-reads your current plan straight away (once a set).
    { const lgB = [0, 1].find(i => isLegend(ps[i]) && ps[1 - i].isPlayer && m.games[1 - i] - m.games[i] >= 3);
      if (lgB !== undefined && !(m.surgeRead || {})[m.sets.length] && m.exec) { m.surgeRead = { ...(m.surgeRead || {}), [m.sets.length]: true }; adaptTo(m, ps, lgB, 1 - lgB, m.sets.length + 1); } }
    // A legend checks your plan early in every set, ahead or behind.
    const lg = isLegend(ps[0]) && ps[1].isPlayer ? 0 : isLegend(ps[1]) && ps[0].isPlayer ? 1 : -1;
    if (lg >= 0 && (h0 + h1 === 2 || h0 + h1 === 5) && m.exec && m.exec[1 - lg] > 0.3
      && rng() < 0.4 * (1 + 1.2 * (ps[1 - lg].textbook || 0))) adaptTo(m, ps, lg, 1 - lg, m.sets.length + 1);
  }
  const set = { games: [...m.games], tb };
  // A lead of 3+ games (or a break-up 5-3) that got away.
  const setLoser = set.games[0] > set.games[1] ? 1 : 0, lead = m.lead[setLoser];
  if (lead && lead[0] - lead[1] >= 2 && lead[0] >= 5 || lead && lead[0] - lead[1] >= 3) set.blown = { who: setLoser, lead: `${lead[0]}-${lead[1]}` };
  m.sets.push(set);
  const loser = set.games[0] > set.games[1] ? 1 : 0;
  trigger(m, ps, loser, 'setLost', rng);
  if (m.winner === null) legendPhase(m, ps, loser); // a legend who drops a set comes back with a new plan
  if (typeof ordersAfterSetLost === 'function') ordersAfterSetLost(m, ps, loser); // real players' match orders
  // Players have answers: whoever lost the set may work out the winner's plan. Smarter players adapt more,
  // and the higher the level, the more often it happens.
  const winner = 1 - loser;
  if (m.exec && readable(ps, loser, winner) && m.exec[winner] > 0.6 && rng() < (0.35 + (attr(ps[loser], 'iq') - 50) * 0.01) * adaptRate() * (1 + 0.6 * (ps[winner].textbook || 0)) * legendAdapt(ps, loser, winner)) adaptTo(m, ps, loser, winner, m.sets.length + 1);
  const won = [0, 1].map(i => m.sets.filter(x => x.games[i] > x.games[1 - i]).length);
  if (won[0] === setsToWin(m)) m.winner = 0;
  if (won[1] === setsToWin(m)) m.winner = 1;
  return set;
}

function playSet(m, ps, ev, rng = Math.random) {
  const g = setGen(m, ps, ev, rng);
  let r;
  while (!(r = g.next()).done);
  return r.value;
}

// A live set: before each point, await before(info) (which can animate and ask for a call).
async function playSetLive(m, ps, ev, before, rng = Math.random) {
  const g = setGen(m, ps, ev, rng);
  let r = g.next();
  while (!r.done) { await before(r.value); r = g.next(); }
  return r.value;
}

// --- Big-point calls ---------------------------------------------------------------------
// On a big point you can make a call. Each one tweaks your plan for that point and gives an edge that
// depends on your build (and the opponent's). Using the same call again in a match is easier to read.
// Edges compare a stat with the player's own average, so the call that suits your build helps you
// (and the one that plays into the opponent's strength hurts).
const rel = (p, k) => attr(p, k) - ATTR_KEYS.reduce((a, x) => a + attr(p, x), 0) / ATTR_KEYS.length;
const CALLS = {
  serve: [
    { id: 'big', icon: '💥', title: 'Go Big Down The T', plan: { serve: 'big' }, edge: (A, B) => 0.004 * rel(A, 'serve') - 0.002 * rel(B, 'ret') },
    { id: 'safe', icon: '🎯', title: 'Make The First Serve, Then Build', plan: { serve: 'safe' }, edge: (A, B) => 0.003 * rel(A, 'ground') + 0.002 * rel(A, 'iq') - 0.0015 * rel(B, 'ground') },
    { id: 'snv', icon: '🏃', title: 'Serve And Volley', plan: { net: 'often' }, edge: (A, B) => 0.004 * rel(A, 'net') - 0.002 * rel(B, 'ret') },
  ],
  ret: [
    { id: 'attack', icon: '⚡', title: 'Step In And Attack', plan: { returnPos: 'inside' }, edge: (A, B) => 0.004 * rel(A, 'ret') - 0.002 * rel(B, 'serve') },
    { id: 'deep', icon: '🧱', title: 'Stand Back, Make Them Play', plan: { returnPos: 'deep', aggression: 'patient' }, edge: (A, B) => 0.003 * rel(A, 'stam') + 0.002 * rel(A, 'iq') - 0.0015 * rel(B, 'ground') },
    { id: 'chip', icon: '🪶', title: 'Chip And Charge', plan: { net: 'often' }, edge: (A, B) => 0.004 * rel(A, 'net') + 0.001 * rel(A, 'ret') - 0.002 * rel(B, 'ground') },
  ],
};

// Each family of playstyles has its own three calls on serve and on return: a big server and a
// grinder don't solve a break point the same way. Edges still come from your stats against theirs.
const CALL_FAMILY = { 'Serve-Dominant': 'serve', 'Serve +1 Attacker': 'serve', 'First-Strike Attacker': 'attack', 'Aggressive Baseliner': 'attack',
  'Flat Attacker': 'attack', 'Heavy-Topspin Attacker': 'attack', 'Solid Baseliner': 'grind', Counterpuncher: 'grind', 'Defensive Grinder': 'grind',
  'Heavy-Topspin Baseliner': 'grind', 'Net Attacker': 'net', 'Serve-and-Volley': 'net', 'All-Court': 'craft', 'Variety / Slice-Heavy': 'craft', 'Creative Shotmaker': 'craft' };
const [cBig, cSafe, cSnv] = CALLS.serve, [cAttack, cDeep, cChip] = CALLS.ret;
const CALL = (id, icon, title, plan, edge) => ({ id, icon, title, plan, edge });
const FAMILY_CALLS = {
  serve: {
    serve: [cBig, CALL('body', '🎯', 'Body Serve, Jam Them', { serve: 'big' }, (A, B) => 0.003 * rel(A, 'serve') + 0.002 * rel(A, 'iq') - 0.002 * rel(B, 'ret')),
      CALL('wide1', '↗️', 'Out Wide, Hit The Open Court', { serve: 'balanced', aggression: 'aggressive' }, (A, B) => 0.003 * rel(A, 'serve') + 0.002 * rel(A, 'ground') - 0.002 * rel(B, 'stam'))],
    ret: [CALL('block', '🧱', 'Block It Back Deep', { returnPos: 'deep' }, (A, B) => 0.003 * rel(A, 'ret') + 0.001 * rel(A, 'iq') - 0.002 * rel(B, 'serve')), cAttack,
      CALL('cut', '💥', 'Take A Big Cut', { returnPos: 'inside', aggression: 'aggressive' }, (A, B) => 0.004 * rel(A, 'serve') + 0.001 * rel(A, 'ret') - 0.002 * rel(B, 'serve'))],
  },
  attack: {
    serve: [CALL('plus1', '🎾', 'Serve, Then Forehand', { serve: 'balanced', aggression: 'aggressive' }, (A, B) => 0.004 * rel(A, 'ground') - 0.002 * rel(B, 'ret')), cBig,
      CALL('kick', '🌀', 'Kick Serve To The Backhand', { serve: 'safe', spin: 'topspin' }, (A, B) => 0.003 * rel(A, 'serve') + 0.002 * rel(A, 'iq') - 0.0015 * rel(B, 'ret'))],
    ret: [cAttack, CALL('dtl', '⚡', 'Rip It Down The Line', { returnPos: 'inside', spin: 'flat' }, (A, B) => 0.004 * rel(A, 'ground') - 0.002 * rel(B, 'serve')),
      CALL('neut', '⚖️', 'Neutralize, Then Dictate', { returnPos: 'normal', aggression: 'balanced' }, (A, B) => 0.003 * rel(A, 'ground') + 0.002 * rel(A, 'iq') - 0.0015 * rel(B, 'ground'))],
  },
  grind: {
    serve: [cSafe, CALL('run', '🏃', 'Make Them Run', { serve: 'safe', aggression: 'patient' }, (A, B) => 0.003 * rel(A, 'stam') + 0.002 * rel(A, 'ground') - 0.0015 * rel(B, 'stam')),
      CALL('kick2', '🌀', 'Heavy Kick, Start The Rally', { serve: 'safe', spin: 'topspin' }, (A, B) => 0.003 * rel(A, 'ground') + 0.002 * rel(A, 'mental') - 0.0015 * rel(B, 'ret'))],
    ret: [cDeep, CALL('extend', '🔁', 'Make Them Hit One More', { aggression: 'patient', returnPos: 'deep' }, (A, B) => 0.004 * rel(A, 'stam') - 0.002 * rel(B, 'ground')),
      CALL('moon', '🌙', 'Moonball Deep', { spin: 'topspin', aggression: 'patient' }, (A, B) => 0.003 * rel(A, 'ground') + 0.002 * rel(A, 'mental') - 0.002 * rel(B, 'ground'))],
  },
  net: {
    serve: [cSnv, CALL('bodyin', '🎯', 'Body Serve, Close In', { serve: 'big', net: 'often' }, (A, B) => 0.003 * rel(A, 'net') + 0.002 * rel(A, 'serve') - 0.002 * rel(B, 'ret')), cSafe],
    ret: [cChip, CALL('slicein', '🪶', 'Low Slice, Then Close', { net: 'often', spin: 'mixed' }, (A, B) => 0.003 * rel(A, 'net') + 0.002 * rel(A, 'iq') - 0.0015 * rel(B, 'ground')), cAttack],
  },
  craft: {
    serve: [CALL('surprise', '🎭', 'Surprise Serve And Volley', { net: 'often' }, (A, B) => 0.003 * rel(A, 'net') + 0.002 * rel(A, 'iq') - 0.002 * rel(B, 'ret')),
      CALL('pace', '🔀', 'Change The Pace', { serve: 'balanced', aggression: 'balanced', drops: 'often' }, (A, B) => 0.004 * rel(A, 'iq') - 0.002 * rel(B, 'iq')), cSafe],
    ret: [cChip, CALL('dropret', '🤏', 'Throw In A Drop', { drops: 'often', returnPos: 'normal' }, (A, B) => 0.004 * rel(A, 'iq') - 0.002 * rel(B, 'stam')), cDeep],
  },
};
// What each call actually does on its point (beyond the plan change and the edge): the serve it hits, whether
// you rush the net, where you stand to return, a forced drop shot, or moonballs. Used by the engine and the court.
const CALL_FX = { big: { serve: 'big' }, body: { serve: 'body' }, bodyin: { serve: 'body', rush: 'serve' }, wide1: { serve: 'wide' }, plus1: { serve: 'wide' },
  safe: { serve: 'safe' }, run: { serve: 'safe' }, kick: { serve: 'kick' }, kick2: { serve: 'kick' }, snv: { rush: 'serve' }, surprise: { rush: 'serve' },
  pace: { drop: true }, chip: { rush: 'return' }, slicein: { rush: 'return' }, attack: { ret: 'inside' }, dtl: { ret: 'inside' }, cut: { ret: 'inside' },
  deep: { ret: 'deep' }, block: { ret: 'deep' }, extend: { ret: 'deep' }, moon: { moon: true }, dropret: { drop: true }, neut: {} };
const callFx = c => (c && CALL_FX[c.id]) || {};
// The three calls this player gets on serve or return.
function callsFor(p, side) {
  const st = typeof styleOf === 'function' ? styleOf(p).name : null, fam = FAMILY_CALLS[CALL_FAMILY[st]];
  return fam ? fam[side] : CALLS[side];
}
// Any call by id (replays of a set look calls up this way).
const callById = (side, id) => [CALLS[side], ...Object.values(FAMILY_CALLS).map(f => f[side])].flat().find(c => c.id === id);

// The edge a call would give side i right now (shown on the buttons, then applied).
function callEdge(m, ps, i, call) {
  const used = (m.callsUsed && m.callsUsed[i] && m.callsUsed[i][call.id]) || 0;
  return clamp(call.edge(ps[i], ps[1 - i]) + 0.01 - used * 0.012, -0.05, 0.06);
}

function makeCall(m, ps, i, call) {
  m.callsUsed = m.callsUsed || [{}, {}];
  const edge = callEdge(m, ps, i, call);
  m.callsUsed[i][call.id] = (m.callsUsed[i][call.id] || 0) + 1;
  m.call = { side: i, id: call.id, edge, savedPlan: ps[i].plan };
  ps[i].plan = { ...planOf(ps[i]), ...call.plan };
}

// After the point: put the plan back and remember how the call went.
function endCall(m, ps, winner) {
  if (!m.call) return;
  const c = m.call;
  ps[c.side].plan = c.savedPlan;
  m.callLog = [...(m.callLog || []), { side: c.side, id: c.id, won: winner === c.side }];
  m.call = null;
}

function playMatch(m, ps, ev, rng = Math.random) {
  while (m.winner === null) playSet(m, ps, ev, rng);
  return m;
}

// Score string from one side's point of view, e.g. "6-4 3-6 7-6(5)".
function scoreLine(m, side = 0) {
  return m.sets.map(s => {
    const [x, y] = side === 0 ? s.games : [s.games[1], s.games[0]];
    const tb = s.tb ? `(${Math.min(...s.tb)})` : '';
    return `${x}-${y}${tb}`;
  }).join(' ');
}
