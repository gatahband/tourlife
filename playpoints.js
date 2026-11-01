// playpoints.js — Play The Points (admin test only): a fifth way to play a match. In some games of each set you play
// every point yourself, shot by shot: pick a shot from the cards your game plan deals you before the clock runs out,
// then time the hit. The other games play on court as usual. Your stats still set the odds on every point; your
// choices and timing only nudge them (never by more than HO_CAP), so a fast thumb can't beat a much better player.

// Games played by hand in each set (counted from 0): the first two, the game before and after each Match Read
// (after games 3 and 7) so you see your change at work, and every tiebreak. The rest go by on the skip screen.
const HO_GAMES = [0, 1, 2, 3, 6, 7]; // the opening two games, so you both serve and return early on
const HO_CAP = 0.05; // the most your choices and timing can move a point either way
const HO_SKILL = 0.65; // how much your choices and timing count, against the engine's own odds (tuned with bots: see tools/playpoints-check.html)
const HO_TIMER = { serve: 18, serve2: 18, ret: 4.5, rally: 5 }; // seconds to choose: plenty of time between serves, a quick read once the ball is coming
const HO_RING_MS = 1100; // the moment the rings meet (tighter windows close in quicker, so the green never gets too thin to see)
const HO_PERFECT = 0.4; // the green: this share of the window either side is a perfect hit
// Open to everyone on a computer or a tablet. Phones are left out for now: the screen is too small to show the court
// and a drawing pad together (the owner's call, to be revisited).
const playPointsOn = () => Math.min(screen.width, screen.height) >= 700 || (typeof isAdminOn === 'function' && isAdminOn());
const hoPointHere = (m, info) => !!info.tb || HO_GAMES.includes(m.games[0] + m.games[1]) || hoTutOn(); // the tutorial: every game

// Each kind of shot: its edge by position (stretched −2 … in control +2), how much timing matters, how often it
// ends the point, how big the timing window is, and the stat behind it. Drops, passes, lobs over a net player and
// volleys always decide the point; an approach leads to a pass and then a volley.
const HO_KIND = {
  defend: { edge: [0.032, 0.016, -0.032, -0.064, -0.08], gain: 0.034, end: 0.7, ring: 1.15, stat: 'stam' },
  safe: { edge: [-0.016, 0.008, 0.008, -0.016, -0.032], gain: 0.034, end: 0.6, ring: 1.25, stat: 'ground' },
  deep: { edge: [-0.048, -0.008, 0.016, 0.016, 0], gain: 0.038, end: 0.8, ring: 1.05, stat: 'ground' },
  attack: { edge: [-0.128, -0.064, 0, 0.032, 0.048], gain: 0.06, end: 1.5, ring: 0.8, stat: 'ground' },
  net: { edge: [-0.16, -0.096, -0.024, 0.032, 0.048], gain: 0.06, end: 9, ring: 0.85, stat: 'net' },
  drop: { edge: [-0.144, -0.08, -0.024, 0.024, 0.048], gain: 0.068, end: 9, ring: 0.7, stat: 'iq' },
  pass: { edge: [-0.05, -0.02, 0.01, 0.025, 0.035], gain: 0.06, end: 9, ring: 0.85, stat: 'ground' },
  lob: { edge: [0.01, 0, -0.015, -0.03, -0.04], gain: 0.05, end: 9, ring: 0.95, stat: 'iq' },
  volley: { edge: [-0.02, 0, 0.015, 0.03, 0.04], gain: 0.06, end: 9, ring: 0.9, stat: 'net' },
};
const HO_HOLD_AT = 0.4; // how far through their ball's flight the court stops for your choice
const HO_SAFE_ORDER = ['defend', 'safe', 'deep', 'lob', 'volley', 'pass', 'attack', 'net', 'drop'];
const HO_SURF = { clay: 0.8, hard: 1, grass: 1.2 };
const HO_DOWN = 0.15; // a bad choice can cost more than a good one gains: wrong shots in the wrong places lose points
const HO_BAD = 1.5; // how hard a poor choice of shot counts (good choices count at HO_SKILL)

const hoOpp = c => c.ps[1 - c.me];
const hoStyle = c => (c.m.styles || [])[c.me] || (typeof styleOf === 'function' ? styleOf(c.ps[c.me]).name : '');
const hoWeak = c => (wingGap(hoOpp(c)) >= 0 ? 'bh' : 'fh'); // their weaker wing
const hoSpin = pl => ({ topspin: 'Heavy ', flat: 'Flat ' })[pl.spin] || '';
const hoAgg = (pl, a) => a[{ patient: 0, balanced: 1, aggressive: 2 }[pl.aggression] ?? 1];

// The rally deck. Which shots you're dealt depends on the ball coming to you, where they are, your plan and your style.
// dir: where the ball goes on court (line = straight ahead, cross = diagonal, middle, angle = short and wide, open =
// away from them); wing: aimed at one of their wings.
const HO_SHOTS = [
  { id: 'cross', icon: '↗️', t: (c, st) => `${hoSpin(c.plan)}${hoW(st)} Crosscourt`, kind: 'safe', dir: 'cross', w: pl => hoAgg(pl, [3, 2.2, 1.3]) },
  { id: 'middle', icon: '⬆️', t: c => c.adv.depth === 'high' ? 'High And Heavy Down The Middle' : 'Deep Down The Middle', kind: 'deep', dir: 'middle', w: pl => hoAgg(pl, [2.4, 1.6, 1]) },
  { id: 'weak', icon: '🎯', t: c => `Deep To Their ${hoWeak(c) === 'bh' ? 'Backhand' : 'Forehand'}`, kind: 'deep', weak: true,
    w: (pl, st, c) => 0.8 + (c.adv.wing !== 'neutral' ? 2 : 0) + Math.min(1.5, Math.abs(wingGap(hoOpp(c))) * 2) },
  { id: 'strong', icon: '🎯', t: c => `Deep To Their ${hoWeak(c) === 'bh' ? 'Forehand' : 'Backhand'}`, kind: 'deep', strong: true, w: () => 0.6 },
  { id: 'line', icon: '⬆️', t: (c, st) => `${hoW(st)} Down The Line`, kind: 'attack', dir: 'line', w: pl => hoAgg(pl, [0.7, 1.4, 2.2]) },
  { id: 'angle', icon: '📐', t: () => 'Short Crosscourt Angle', kind: 'attack', dir: 'angle', ring: 0.8, w: pl => hoAgg(pl, [0.4, 1, 1.6]) },
  { id: 'open', icon: '🕳️', t: () => 'Into The Open Court', kind: 'attack', dir: 'open', bonus: 0.03, when: st => st.open, w: () => 4 },
  { id: 'rip', icon: '💥', t: (c, st) => `Rip The ${hoW(st)} Down The Line`, kind: 'attack', dir: 'line', ring: 0.7, endMul: 1.4, when: (st, c) => c.pos >= 0 || st.ball === 'short', w: pl => hoAgg(pl, [0.3, 0.9, 2]) },
  { id: 'approach', icon: '🏃', t: () => 'Approach Down The Line', kind: 'net', dir: 'line', w: (pl, st) => ({ rarely: 0.1, sometimes: 0.7, often: 1.8 })[pl.net] * (st.ball === 'short' ? 2.5 : 1) },
  { id: 'drop', icon: '🪶', t: () => 'Drop Shot', kind: 'drop', w: (pl, st) => ({ rarely: 0.1, sometimes: 0.6, often: 1.5 })[pl.drops] * (st.ball === 'short' ? 1.8 : 1) },
  { id: 'heavy', icon: '🌀', t: () => 'Heavy Topspin Crosscourt', kind: 'deep', dir: 'cross', when: (st, c) => c.plan.spin === 'topspin' || c.adv.depth === 'high', w: () => 1.6 },
  { id: 'slice', icon: '🔪', t: (c, st) => `${c.pos <= -1 ? 'Defensive' : 'Low'} ${hoW(st)} Slice Crosscourt`, kind: 'defend', dir: 'cross', w: (pl, st, c) => (c.pos <= -1 ? 2 : 0.5) * (pl.spin === 'topspin' ? 0.6 : 1) },
  { id: 'lob', icon: '🌈', t: () => 'High Defensive Lob', kind: 'defend', lob: true, when: (st, c) => c.pos <= -1, w: () => 1.5 },
  // On the back foot: buy time, reset, or gamble.
  { id: 'slice_line', icon: '🔪', t: (c, st) => `${hoW(st)} Slice Down The Line`, kind: 'defend', dir: 'line', when: (st, c) => c.pos <= -1 || st.wing === 'bh', w: (pl, st, c) => c.pos <= -1 ? 1.1 : 0.5 },
  { id: 'block', icon: '🧱', t: () => 'Block It Back Deep', kind: 'defend', dir: 'middle', when: (st, c) => c.pos <= -1 || st.ball === 'deep', w: (pl, st, c) => c.pos <= -1 ? 1.4 : 0.6 },
  { id: 'moon', icon: '🌙', t: () => 'High Moonball To Reset', kind: 'defend', dir: 'middle', endMul: 0.7, when: (st, c) => c.pos <= 0, w: pl => hoAgg(pl, [1.4, 0.9, 0.4]) },
  { id: 'squash', icon: '🦵', t: () => 'Squash Shot On The Run', kind: 'defend', dir: 'cross', when: (st, c) => c.pos <= -2 || (c.pos <= -1 && st.ball === 'wide'), w: () => 1.3 },
  { id: 'stretch', icon: '🎲', t: () => 'Full-Stretch Winner Attempt', kind: 'attack', dir: 'line', ring: 0.65, bonus: 0.05, endMul: 1.6, when: (st, c) => c.pos <= -1, w: () => 0.9 / 0.35 },
  // Building the point: change the rhythm, pull them in, take time away.
  { id: 'chipshort', icon: '🪃', t: () => 'Short Slice To Pull Them In', kind: 'defend', dir: 'angle', pullIn: true, when: (st, c) => c.pos >= -1 && st.ball !== 'high', w: pl => ({ rarely: 0.4, sometimes: 0.7, often: 1 })[pl.drops] },
  { id: 'pace', icon: '🔪', t: () => 'Change Of Pace: Backhand Slice', kind: 'deep', dir: 'cross', skid: true, when: st => st.wing === 'bh', w: () => 0.9 },
  { id: 'jam', icon: '🎯', t: () => 'Jam Them In The Body', kind: 'deep', dir: 'middle', ring: 0.9, when: (st, c) => c.pos >= 0, w: () => 0.7 },
  { id: 'swing', icon: '🌪️', t: () => 'Swinging Volley', kind: 'attack', dir: 'open', ring: 0.7, bonus: 0.015, when: (st, c) => st.ball === 'high' && c.pos >= 1, w: () => 1.6 },
  { id: 'insidein', icon: '⬆️', t: () => 'Run Around: Inside-In Forehand', kind: 'attack', dir: 'line', ring: 0.7,
    when: (st, c) => st.wing === 'bh' && c.pos >= 1 && wingGap(c.ps[c.me]) > 0.05, w: () => 1 },
  { id: 'approach_slice', icon: '🔪', t: () => 'Slice Approach Down The Line', kind: 'net', dir: 'line', chip: true, ring: 1.05, bonus: -0.005,
    when: st => st.ball === 'low' || st.ball === 'short', w: (pl, st) => ({ rarely: 0.1, sometimes: 0.6, often: 1.4 })[pl.net] },
  { id: 'approach_cross', icon: '🏃', t: () => 'Approach Crosscourt', kind: 'net', dir: 'cross', bonus: -0.01, when: st => st.ball === 'short', w: pl => ({ rarely: 0.1, sometimes: 0.4, often: 0.9 })[pl.net] },
  { id: 'runaround', icon: '↪️', t: () => 'Run Around: Inside-Out Forehand', kind: 'attack', dir: 'cross', ring: 0.8,
    when: (st, c) => st.wing === 'bh' && c.pos >= 0 && wingGap(c.ps[c.me]) > 0.05, w: () => 1.4 },
];
// They've come to the net: pass them or lob them.
const HO_PASS = [
  { id: 'pass_line', icon: '⬆️', t: () => 'Pass Down The Line', kind: 'pass', dir: 'line', ring: 0.8 },
  { id: 'pass_cross', icon: '↗️', t: () => 'Crosscourt Pass', kind: 'pass', dir: 'cross' },
  { id: 'lob_over', icon: '🌈', t: () => 'Lob Over Them', kind: 'lob', lob: true },
  { id: 'dip', icon: '⬇️', t: () => 'Dip It At Their Feet', kind: 'pass', dir: 'short', ring: 1.1, bonus: -0.01, endMul: 1 },
  { id: 'at_them', icon: '🎯', t: () => 'Drive It Right At Them', kind: 'pass', dir: 'middle', ring: 1.05, bonus: -0.005 },
  { id: 'tslob', icon: '🌀', t: () => 'Topspin Lob', kind: 'lob', lob: true, ring: 0.7, bonus: 0.012, when: c => c.pos >= 0 },
  { id: 'hilob', icon: '🌈', t: () => 'Defensive Lob Up High', kind: 'lob', lob: true, ring: 1.2, bonus: -0.004, when: c => c.pos <= -1 },
  { id: 'scramble', icon: '🦵', t: () => 'Stretch And Block It Low', kind: 'pass', dir: 'short', ring: 1.25, bonus: -0.02, when: c => c.pos <= -1 },
];
// You're at the net: finish it.
const HO_VOLLEY = [
  { id: 'v_open', icon: '🕳️', t: () => 'Volley Into The Open Court', kind: 'volley', dir: 'open', ring: 0.8 },
  { id: 'v_deep', icon: '⬆️', t: () => 'Deep Volley Down The Middle', kind: 'volley', dir: 'middle', ring: 1.15, bonus: -0.01 },
  { id: 'v_drop', icon: '🪶', t: () => 'Drop Volley', kind: 'volley', dir: 'short', ring: 0.7, bonus: 0.005 },
  { id: 'v_angle', icon: '📐', t: () => 'Angled Volley Crosscourt', kind: 'volley', dir: 'angle', ring: 0.8 },
  { id: 'v_line', icon: '⬆️', t: () => 'Punch Volley Down The Line', kind: 'volley', dir: 'line', ring: 0.95 },
];
// They threw up a lob over you at the net.
const HO_SMASH = [
  { id: 'smash', icon: '💥', t: () => 'Overhead Smash', kind: 'volley', dir: 'open', ring: 0.8, bonus: 0.02 },
  { id: 'smash_b', icon: '⬇️', t: () => 'Let It Bounce, Then Smash', kind: 'volley', dir: 'middle', ring: 1.1, bonus: 0.005 },
  { id: 'sky_angle', icon: '📐', t: () => 'Angled Overhead', kind: 'volley', dir: 'angle', ring: 0.7, bonus: 0.01 },
  { id: 'run_back', icon: '🏃', t: () => 'Run Back And Lob It Deep', kind: 'lob', lob: true, ring: 1.15, bonus: -0.02 },
];
// The shots each playstyle reaches for: dealt far more often, so every style's hands feel like that style.
const HO_FAV = {
  'Serve-Dominant': ['rip', 'middle', 'line'], 'Serve +1 Attacker': ['runaround', 'rip', 'open', 'insidein'],
  'First-Strike Attacker': ['rip', 'line', 'runaround', 'approach'], 'Flat Attacker': ['line', 'rip', 'jam', 'pace'],
  'Aggressive Baseliner': ['runaround', 'insidein', 'line', 'angle'], 'Heavy-Topspin Attacker': ['heavy', 'angle', 'runaround', 'swing'],
  'Heavy-Topspin Baseliner': ['heavy', 'moon', 'weak', 'cross'], 'Solid Baseliner': ['middle', 'weak', 'cross', 'block'],
  'Defensive Grinder': ['moon', 'block', 'lob', 'squash', 'slice'], 'Counterpuncher': ['block', 'slice_line', 'cross', 'stretch'],
  'Return-Oriented': ['jam', 'middle', 'weak', 'block'], 'Variety / Slice-Heavy': ['slice', 'pace', 'chipshort', 'slice_line', 'drop'],
  'Creative Shotmaker': ['drop', 'chipshort', 'angle', 'swing'], 'All-Court': ['approach', 'approach_slice', 'swing', 'weak'],
  'Serve-and-Volley': ['approach_slice', 'approach', 'chipshort'], 'Net Attacker': ['approach', 'approach_cross', 'swing'],
};
// Each style's own extra serve (where it isn't Serve And Volley).
const HO_SERVE_STYLE = {
  bomb: { id: 'sv_bomb', icon: '💣', t: 'Flat Bomb Down The T', ring: 0.7, ace: 1.5, inMod: -0.07, serve: 't' },
  kick: { id: 'sv_kick', icon: '🌀', t: 'Heavy Kick Out Wide', ring: 1.3, ace: 0.7, inMod: 0.05, serve: 'wide' },
  slice: { id: 'sv_slice', icon: '↪️', t: 'Slice Serve Out Wide', ring: 1.05, ace: 1.1, inMod: 0.01, serve: 'wide' },
};
const HO_SERVE_OF = { 'Serve-Dominant': 'bomb', 'Serve +1 Attacker': 'bomb', 'First-Strike Attacker': 'bomb', 'Flat Attacker': 'bomb',
  'Aggressive Baseliner': 'bomb', 'Heavy-Topspin Attacker': 'kick', 'Heavy-Topspin Baseliner': 'kick', 'Solid Baseliner': 'kick',
  'Defensive Grinder': 'kick', 'Counterpuncher': 'kick', 'Return-Oriented': 'kick', 'Variety / Slice-Heavy': 'slice', 'Creative Shotmaker': 'slice' };
// Every playstyle's own shot, dealt when the moment suits it (and a little stronger than the plain version).
const HO_SIG = {
  'Serve-Dominant': { icon: '⚡', t: 'Put Away The Short Return', kind: 'attack', dir: 'open', when: st => st.first },
  'Serve +1 Attacker': { icon: '🥊', t: 'Serve +1 Forehand Into The Corner', kind: 'attack', dir: 'cross', when: st => st.first },
  'First-Strike Attacker': { icon: '🎯', t: 'First-Strike Forehand Down The Line', kind: 'attack', dir: 'line', when: st => st.first || st.ball === 'short' },
  'Flat Attacker': { icon: '🚀', t: 'Flat Laser Down The Line', kind: 'attack', dir: 'line', when: (st, c) => c.pos >= 0 },
  'Aggressive Baseliner': { icon: '↪️', t: 'Inside-Out Forehand', kind: 'attack', dir: 'cross', when: (st, c) => c.pos >= 0 },
  'Heavy-Topspin Attacker': { icon: '🌪️', t: 'Heavy Forehand Into The Corner', kind: 'attack', dir: 'cross', when: (st, c) => c.pos >= -1 },
  'Heavy-Topspin Baseliner': { icon: '🌀', t: 'Heavy Topspin Up High', kind: 'deep', dir: 'cross', pushBack: true },
  'Solid Baseliner': { icon: '🧱', t: 'Rock-Solid Depth', kind: 'deep', dir: 'middle' },
  'Defensive Grinder': { icon: '🛡️', t: 'Make Them Hit One More', kind: 'defend', dir: 'middle', when: (st, c) => c.pos <= 0, grind: true },
  'Counterpuncher': { icon: '🔁', t: 'Redirect Their Pace Down The Line', kind: 'attack', dir: 'line', when: (st, c) => c.pos <= 0, counter: true },
  'Return-Oriented': { icon: '⏱️', t: 'Take Time Away Crosscourt', kind: 'deep', dir: 'cross' },
  'Variety / Slice-Heavy': { icon: '🔪', t: 'Skidding Slice', kind: 'deep', dir: 'cross', skid: true },
  'Creative Shotmaker': { icon: '🎩', t: 'Disguised Drop Shot', kind: 'drop', when: st => !st.open },
  'All-Court': { icon: '🏃', t: 'Approach And Close In', kind: 'net', dir: 'line', when: st => st.ball !== 'deep' },
  'Serve-and-Volley': { icon: '🏃', t: 'Chip And Charge', kind: 'net', dir: 'cross', when: st => st.ball !== 'deep' },
  'Net Attacker': { icon: '🏃', t: 'Chip And Charge', kind: 'net', dir: 'cross', when: st => st.ball !== 'deep' },
};

// Everything a hands-on point needs to know. uses: how often you've played each shot this set (opponents read repeats).
function hoContext(m, ps, ev, me, info, uses) {
  const A = ps[me], clutch = !!info.tb || info.bp !== null, big = clutch || !!info.press;
  const pts = info.pts || [0, 0], tense = !info.tb && pts[0] >= 2 && pts[1] >= 2;
  // Pressure on this point, eased by Mental Resilience; nerves from the engine (serving for the set, missed chances) add to it.
  const level = (big ? 1 : tense ? 0.45 : 0.15) + (m.nerves && m.nerves[me] < 0 ? 0.3 : 0);
  return { m, ps, ev, me, s: info.s, info, clutch, ad: (pts[0] + pts[1]) % 2 === 1, uses, plan: planOf(A), adv: advPlan(A, ps[1 - me]),
    pf: clamp(level * (1 - attr(A, 'mental') / 110), 0, 1), pos: 0, j: 0, st: { wing: 'fh', ball: 'neutral', open: false, net: null, last: null, first: false } };
}

// How well they've read a shot: not just how often you've played it, but how much of your choosing it makes up
// (mixing three serves evenly is never read; the same serve every time is, late in the set).
const hoGroup = id => /^(sv_|snv)/.test(id) ? 's1' : /2$/.test(id) ? 's2' : /^r_/.test(id) ? 'r' : 'x';
const hoReadN = (c, id) => {
  const g = hoGroup(id), n = c.uses[id] || 0, tot = Object.keys(c.uses).reduce((a, k) => a + (hoGroup(k) === g ? c.uses[k] : 0), 0);
  return Math.max(0, n - 5 - 0.35 * tot);
};
const hoW = st => (st.wing === 'bh' ? 'Backhand' : 'Forehand');

// Where you really are for this ball (from the court; test bots get a likely spot): near the middle there's no line
// to go down, so those shots become corners; out by the sideline the ball really is wide.
function hoSpot(c, spot, rng = Math.random) {
  const st = c.st, ax = spot ? Math.abs(spot.x) : (rng() < 0.25 ? 0.5 : 2.8);
  if (spot) { st.x = spot.x; st.inX = spot.inX; } // where you hit it, and where their ball came from
  if (spot && spot.wing) st.wing = /^b/i.test(spot.wing) ? 'bh' : 'fh';
  st.zone = ax < 1.4 ? 'middle' : 'side';
  if (ax > 3.4 && st.ball !== 'short' && st.net !== 'you') st.ball = 'wide';
  else if (st.ball === 'wide' && ax < 2.4) st.ball = 'neutral';
}
function hoFit(c, cards) {
  if (c.st.zone === 'middle') {
    const cw = hoWeak(c), corner = `To Their ${cw === 'bh' ? 'Backhand' : 'Forehand'} Corner`;
    cards = cards.filter(cd => cd.id !== 'insidein').map(cd => cd.dir !== 'line' ? cd
      : { ...cd, dir: cw + 'c', title: /Down The Line/.test(cd.title) ? cd.title.replace('Down The Line', corner) : `${cd.title}: ${corner}` });
  }
  return cards.map(cd => ({ ...cd, icon: hoArrow(c, cd) }));
}
// Arrows point where the ball will really go on screen (you're at the bottom; + x is screen right):
// crosscourt from the right goes up-left, a corner is on the side of their forehand or backhand.
function hoArrow(c, cd) {
  if (!['↗️', '⬆️', '↖️'].includes(cd.icon) || c.st.x === undefined) return cd.icon;
  const side = c.st.x >= 0 ? 1 : -1, fh = c.ps[1 - c.me].hand === 'left' ? 1 : -1, up = sd => (sd > 0 ? '↗️' : '↖️');
  return ({ line: '⬆️', middle: '⬆️', cross: up(-side), angle: side > 0 ? '⬅️' : '➡️', fhc: up(fh), bhc: up(-fh) })[cd.dir] || cd.icon;
}
const hoReadPen = card => Math.min(0.03, 0.008 * Math.max(0, card.readN - 2)) * (['safe', 'deep', 'defend'].includes(card.kind) ? 0.5 : 1); // a steady pattern is harder to punish than a repeated trick

// What the ball coming to you looks like (shown above the cards).
function hoSituation(c) {
  const st = c.st;
  if (st.net === 'them') return st.last === 'chipshort' ? "You've Drawn Them In" : "They're Rushing The Net";
  if (st.net === 'you') return st.lobbed ? 'They Throw Up A Lob' : "You're At The Net";
  const ball = { short: 'Short Ball', deep: 'Deep Ball', wide: 'Wide Ball', high: 'High Kicking Ball', low: 'Low Skidding Ball' }[st.ball] || 'Rally Ball';
  return `${ball} To Your ${st.wing === 'bh' ? 'Backhand' : 'Forehand'}${st.open ? " · They're Out Of Position" : c.pos <= -2 ? " · You're Stretched" : c.pos >= 2 ? " · You're In Control" : ''}`;
}

// first: the first serve you just missed (a second serve can only go big again where that one went).
function hoGoAgain(mk, pl, first) {
  const at = (first && first.serve) || 't', where = { wide: 'Out Wide', body: 'Into The Body', t: 'Down The T' }[at];
  return pl.serve === 'big' ? mk('big2', '💥', `Go Big Again ${where}`, { dfMul: 2.2, ring: 0.8, ace: at === 'body' ? 1.3 : 1.8, edge: 0.03, serve: at })
    : mk('flat2', '🎯', `Flat ${where}`, { dfMul: 1.3, ring: 1, ace: at === 'body' ? 0.9 : 1.2, edge: 0.01, serve: at });
}
function serveCards(c, second, first) {
  const pl = c.plan, mk = (id, icon, title, o) => ({ id, icon, title, kind: 'serve', read: id, readN: hoReadN(c, id), ...o });
  if (second) return [
    // Their backhand is out wide in the ad court and down the T in the deuce court (the other way round for a lefty).
    mk('kick2', '🌀', 'Kick Serve To The Backhand', { dfMul: 0.75, ring: 1.3, ace: 0.6, serve: c.ad === ((c.ps[1 - c.me].hand || 'right') === 'right') ? 'wide' : 't' }),
    mk('slice2', '↪️', 'Slice Into The Body', { dfMul: 0.9, ring: 1.15, ace: 0.8, serve: 'body' }),
    hoGoAgain(mk, pl, first),
  ];
  // The plan sets how the serves are hit (and how forgiving they are); you choose where.
  const word = { safe: 'Spin ', balanced: '', big: 'Flat ' }[pl.serve] || '', ring = { safe: 1.25, balanced: 1, big: 0.75 }[pl.serve] || 1;
  const cards = [
    mk('sv_wide', c.ad ? '↗️' : '↖️', `${word}Out Wide`, { ring, ace: 1.05, inMod: 0, serve: 'wide' }),
    mk('sv_body', '🎯', `${word}Into The Body`, { ring, ace: 0.75, inMod: 0.03, serve: 'body' }),
    mk('sv_t', '⬆️', `${word}Down The T`, { ring, ace: 1.2, inMod: -0.02, serve: 't' }),
  ];
  const ss = HO_SERVE_STYLE[HO_SERVE_OF[hoStyle(c)]];
  if (ss) cards.push(mk(ss.id, c.ad && ss.serve === 'wide' ? '↗️' : ss.serve === 'wide' ? '↖️' : ss.icon, ss.t, { ring: ss.ring * ring, ace: ss.ace, inMod: ss.inMod, serve: ss.serve }));
  if (pl.net === 'often' || famOf(hoStyle(c)) === 'net' || (pl.net === 'sometimes' && Math.random() < 0.4)) cards.push(mk('snv', '🏃', 'Serve And Volley', { ring, ace: 0.9, inMod: 0, snv: true, serve: 'wide' }));
  return cards;
}

function returnCards(c, second) {
  const pl = c.plan, mk = (id, icon, title, kind, dir, o) => ({ id, icon, title, kind, dir, read: id, readN: hoReadN(c, id), ...o });
  const cross = mk('r_cross', '↗️', 'Deep Crosscourt Return', 'safe', 'cross');
  const set = {
    deep: [mk('r_block', '🧱', 'Block It Back Deep', 'safe', 'middle'), mk('r_loop', '🌈', 'High Loop Return', 'defend', 'middle'), mk('r_chip', '🔪', 'Low Chip Crosscourt', 'deep', 'cross'),
      second ? mk('r_step', '⬆️', 'Step In: Return Down The Line', 'attack', 'line') : mk('r_slline', '🔪', 'Slice Return Down The Line', 'defend', 'line')],
    normal: [cross, mk('r_mid', '⬆️', 'Return Down The Middle', 'deep', 'middle'), second ? mk('r_att', '💥', 'Attack The Second Serve Down The Line', 'attack', 'line') : mk('r_chip', '🔪', 'Low Chip Crosscourt', 'defend', 'cross'),
      second ? mk('r_ang', '📐', 'Short Angle Return', 'attack', 'angle') : mk('r_block', '🧱', 'Block It Back Deep', 'safe', 'middle')],
    inside: [mk('r_early', '⚡', 'Take It Early Crosscourt', 'attack', 'cross'), mk('r_line', '⬆️', 'Return Down The Line', 'attack', 'line'),
      pl.net !== 'rarely' ? mk('r_charge', '🏃', 'Chip And Charge', 'net', 'cross', { chip: true }) : cross, mk('r_feet', '⬇️', 'Low Return At Their Feet', 'deep', 'middle')],
  }[pl.returnPos] || [cross];
  if (hoStyle(c) === 'Return-Oriented') set.push(mk('r_sig', '⏱️', 'Block It Back At Their Feet', 'deep', 'short', { bonus: 0.015 }));
  // Going after a big first serve is a gamble; a second serve is there to be attacked.
  const big = attr(c.ps[c.s], 'serve') >= 65;
  return hoFit(c, set.map(cd => cd.kind === 'attack' ? { ...cd, bonus: second ? 0.015 : big ? -0.02 : 0 } : cd));
}

// Deals the shots for this ball: from the rally deck (weighted by your plan and style), or passes and lobs when they're
// at the net, or volleys when you are. Always one steady option to fall back on.
function hoDeal(c, rng = Math.random) {
  const st = c.st, pl = c.plan, fam = famOf(hoStyle(c)), card = d => ({ ...d, title: typeof d.t === 'function' ? d.t(c, st) : d.t, read: d.id, readN: hoReadN(c, d.id) });
  const some = (list, n) => { const l = list.filter(d => !d.when || d.when(c)); while (l.length > n) l.splice(Math.floor(rng() * l.length), 1); return l.map(card); };
  if (st.net === 'them') return hoFit(c, some(HO_PASS, 4));
  if (st.net === 'you') return hoFit(c, some(st.lobbed ? HO_SMASH : HO_VOLLEY, 4));
  const n = 4, risk = c.clutch ? c.adv.pressure : 'standard', fav0 = HO_FAV[hoStyle(c)] || [];
  const famK = { attack: { attack: 1.3 }, defend: { defend: 1.3, deep: 1.3 }, craft: { drop: 1.4, net: 1.2 }, net: { net: 1.6 } }[fam] || {};
  const pool = HO_SHOTS.filter(d => !d.when || d.when(st, c)).map(d => {
    let w = (d.w(pl, st, c) || 0) * (famK[d.kind] || 1) * (fav0.includes(d.id) ? 2.5 : 1);
    if (risk === 'broke' && d.kind === 'attack') w *= 1.6;
    if (risk === 'safe' && ['safe', 'deep'].includes(d.kind)) w *= 1.6;
    if (c.pos <= -1 && ['attack', 'net', 'drop'].includes(d.kind) && d.id !== 'open') w *= 0.35; // hard to attack off a good ball
    return { d, w };
  });
  // Your own pattern stays on offer while you're in position to play it: the shot you just hit, or else the one you've
  // played most this set (always to their backhand, always defending...). The other three are fresh for this ball.
  const ok = x => x && x.w > 0 && !(c.pos <= -1 && ['attack', 'net', 'drop'].includes(x.d.kind) && x.d.id !== 'open');
  const fav = pool.filter(ok).sort((a, b) => (c.uses[b.d.id] || 0) - (c.uses[a.d.id] || 0))[0];
  const keep = ok(pool.find(x => x.d.id === st.last)) ? pool.find(x => x.d.id === st.last) : fav && (c.uses[fav.d.id] || 0) >= 2 ? fav : null;
  const hand = keep ? [keep.d] : [], k0 = hand.length;
  while (hand.length < n) {
    const left = pool.filter(x => x.w > 0 && !hand.some(h => h.id === x.d.id)), tot = left.reduce((a, x) => a + x.w, 0);
    if (!left.length) break;
    let r = rng() * tot;
    hand.push((left.find(y => (r -= y.w) <= 0) || left[left.length - 1]).d);
  }
  // Always something steady; on the back foot always a real defensive shot; a short ball always offers an attack.
  const swap = (test, id) => { if (!hand.some(test)) { const at = hand.findIndex((h, i) => i >= k0 && !h.sig && !test(h) && h.kind !== 'defend'); hand[at < 0 ? hand.length - 1 : at] = HO_SHOTS.find(d => d.id === id); } };
  swap(h => ['safe', 'deep', 'defend'].includes(h.kind), c.pos <= -1 ? 'slice' : 'cross');
  if (c.pos <= -1) swap(h => h.lob || h.id === 'block' || h.id === 'squash', c.pos <= -2 ? 'lob' : 'block');
  if (st.ball === 'short' || c.pos >= 2) swap(h => h.kind === 'attack' || h.kind === 'net', st.open ? 'open' : 'line');
  // Your style's own shot comes as a fifth option when the moment suits it.
  const sig = HO_SIG[hoStyle(c)];
  if (sig && (!sig.when || sig.when(st, c)) && rng() < 0.6) hand.push({ ...sig, id: 'sig', bonus: 0.015, sig: true });
  return hoFit(c, hand.map(card));
}

const hoSafest = cards => cards.slice().sort((a, b) => HO_SAFE_ORDER.indexOf(a.kind) - HO_SAFE_ORDER.indexOf(b.kind))[0];

// Is it the right shot for this ball? Hard changes of direction off wide balls, angles off deep balls and attacking
// from your weaker wing go wrong; short balls are there to attack; one shot can set up the next.
function hoGeom(c, card) {
  const st = c.st, g0 = wingGap(hoOpp(c)), mine = wingGap(c.ps[c.me]);
  let g = 0;
  if (st.ball === 'wide' && card.dir === 'line') g -= card.kind === 'defend' ? 0.02 : 0.035;
  if (st.ball === 'wide' && card.kind === 'attack') g -= 0.015;
  if (st.ball === 'deep' && (card.dir === 'angle' || card.id === 'rip')) g -= 0.03;
  if (st.ball === 'deep' && card.kind === 'net') g -= 0.035;
  if (st.ball === 'short' && ['attack', 'net', 'drop'].includes(card.kind)) g += 0.02;
  if (st.ball === 'short' && card.kind === 'defend') g -= 0.025;
  if (st.ball === 'high' && card.kind === 'attack' && !['Heavy-Topspin Attacker', 'Flat Attacker'].includes(hoStyle(c))) g -= 0.015;
  if (st.ball === 'low' && card.kind === 'attack') g -= 0.015;
  if (st.ball === 'low' && ['drop', 'net'].includes(card.kind)) g += 0.01;
  if (st.wing === 'bh' && card.kind === 'attack' && card.id !== 'runaround' && mine > 0.15) g -= 0.02; // attacking off your weaker wing
  if (card.weak) g += 0.035 * Math.min(0.8, Math.abs(g0));
  if (st.open && card.dir !== 'open' && card.kind === 'attack') g += 0.01;
  // Point construction: an angle opens the line, depth sets up the approach, pressure on the weak wing sets up the kill.
  if (st.last === 'angle' && card.dir === 'line') g += 0.02;
  if ((st.last === 'middle' || st.last === 'weak') && card.kind === 'net') g += 0.015;
  if (st.last === 'weak' && card.kind === 'attack') g += 0.01;
  if (st.last && st.last === card.id && ['attack', 'net', 'drop'].includes(card.kind)) g -= 0.01; // the same trick twice in a row
  // Each defensive shot has its moment: lobs when you're way out of it, the squash shot when you're dragged wide,
  // a block against a deep heavy ball, a moonball to reset on slow courts.
  if (card.lob && card.kind === 'defend') g += c.pos <= -2 ? 0.012 : st.ball === 'low' ? -0.012 : 0;
  if (card.id === 'squash') g += c.pos <= -2 && st.ball === 'wide' ? 0.018 : c.pos <= -2 ? 0.006 : -0.01;
  if (card.id === 'block') g += st.ball === 'deep' || st.ball === 'high' ? 0.01 : -0.005;
  if (card.id === 'moon') g += ({ clay: 0.008, grass: -0.012 })[c.ev.surface] || 0;
  if (card.id === 'slice' && st.ball === 'low') g += 0.008;
  if (card.id === 'chipshort') g += (55 - attr(hoOpp(c), 'net')) / 1500; // works best on someone who hates coming in
  if (card.id === 'stretch' && st.ball !== 'wide') g -= 0.015;
  if (card.id === 'swing') g += ({ grass: -0.01 })[c.ev.surface] || 0;
  if (card.chip && st.ball === 'low') g += 0.012;
  if (st.last === 'chipshort' && (card.kind === 'pass' || card.kind === 'lob')) g += 0.02; // drew them in, now pass them
  if (card.kind === 'drop') g += ({ clay: 0.01, grass: 0.005 })[c.ev.surface] || 0;
  if (card.kind === 'net' || card.kind === 'volley') g += ({ grass: 0.01, clay: -0.01 })[c.ev.surface] || 0;
  return g;
}

// The edge from choosing this shot here (before how well you hit it).
function hoEdge(c, card) {
  const K = HO_KIND[card.kind], p = card.counter ? Math.max(c.pos, 0) : c.pos;
  return K.edge[p + 2] + (card.bonus || 0) - hoReadPen(card) + hoGeom(c, card);
}
// How it's struck on court: attacking shots, passes and put-aways are slammed; lobs, moonballs and touch shots floated.
const HO_SOFT = ['moon', 'chipshort', 'block', 'squash', 'v_drop', 'dip', 'scramble', 'r_loop', 'r_block', 'run_back', 'smash_b'];
const hoPace = card => card.lob || HO_SOFT.includes(card.id) || card.kind === 'drop' ? 'soft'
  : ['attack', 'pass', 'volley', 'net'].includes(card.kind) ? 'hard' : undefined;
const hoAim = card => {
  const sg = card.sg, a = card.serve ? { serve: card.serve } : { dir: card.lob ? undefined : card.dir, lob: card.lob || undefined, wing: card.weak ? card.weakWing : card.strong ? (card.weakWing === 'bh' ? 'fh' : 'bh') : undefined, pace: hoPace(card) };
  // A drawn shot: its spin, and exactly where across and how deep it lands (the court keeps it in the shot's lane).
  if (sg && !card.serve) Object.assign(a, { out: sg.miss || undefined, flight: sg.flight || undefined, aimX: sg.aim, depth: sg.depth, pace: sg.kmh >= 140 ? 'hard' : sg.kmh <= 70 ? 'soft' : a.pace });
  return a;
};

// Seconds to choose: quicker reading (Tennis IQ) buys a little time; being stretched or tight takes some away.
function hoSecs(c, stage) {
  return Math.max(1.8, HO_TIMER[stage] + clamp((attr(c.ps[c.me], 'iq') - 60) / 20, -0.5, 1) - (stage !== 'serve' && stage !== 'serve2' && c.pos <= -1 ? 0.5 : 0) - 0.5 * c.pf);
}

// The timing window (ms either side of perfect): the stat behind the shot, how risky it is, your plan's spin, your
// position, fatigue, pressure (eased by Mental Resilience) and how well they're reading it.
function hoWindow(c, card, stage) {
  const A = c.ps[c.me], kind = HO_KIND[card.kind];
  const stat = stage === 'serve' || stage === 'serve2' ? 'serve' : stage === 'ret' ? 'ret' : kind.stat;
  let w = 150 * (0.7 + (attr(A, stat) - 40) / 100) * (card.ring || (kind ? kind.ring : 1)) * (stage === 'serve2' ? 1.1 : 1);
  if (kind) w *= ({ topspin: 1.1, flat: 0.9 })[c.plan.spin] || 1;
  if (stage === 'rally' || stage === 'ret') w *= [0.7, 0.85, 1, 1.08, 1.15][c.pos + 2];
  w *= 1 - Math.min(0.3, fatigue(c.m, A) * 8 + tiredness(A) * 4 + c.j * (({ hustle: 0.02, conserve: 0.045 })[c.adv.energy] || 0.03));
  w *= 1 - 0.6 * c.pf;
  w *= 1 - 0.06 * Math.min(4, Math.max(0, card.readN - 2));
  // Serves are the exception: a thin window, even for a big server, so a perfectly timed serve (and the ace it brings) is hard.
  if (stage === 'serve' || stage === 'serve2') return clamp(w * 0.8, 45, 170);
  return clamp(w * 1.5, 70, 380); // generous: the challenge is the choice, timing just polishes it
}

// --- Swipe Shots (strokegesture.js) ----------------------------------------------------------------------------
// You draw the shot and it's matched to the closest of the shots you were dealt: the same choices as the cards (so
// the same balance), but you pick by drawing, and the line you draw sets the spin and exactly where it lands.
const HO_SWIPE_KEY = 'tourlife.hoSwipe';
const hoSwipeOn = () => { try { return typeof StrokeGestureEngine === 'function' && localStorage.getItem(HO_SWIPE_KEY) === '1'; } catch { return false; } };
const HO_FAM = {
  topspin: ['cross', 'heavy', 'weak', 'strong', 'middle', 'angle', 'open', 'runaround', 'insidein', 'swing', 'pass_cross', 'dip', 'r_cross', 'r_early', 'r_mid', 'approach', 'approach_cross', 'sv_kick', 'kick2'],
  flat: ['line', 'rip', 'stretch', 'jam', 'pass_line', 'at_them', 'r_line', 'r_att', 'r_step', 'r_feet', 'smash', 'smash_b', 'sky_angle', 'v_line', 'v_open', 'v_deep', 'sv_bomb', 'big2', 'flat2', 'sv_t'],
  slice: ['slice', 'slice_line', 'pace', 'block', 'squash', 'chipshort', 'approach_slice', 'r_chip', 'r_slline', 'r_block', 'r_charge', 'scramble', 'v_angle', 'sv_slice', 'slice2', 'sv_body'],
  lob: ['lob', 'moon', 'lob_over', 'tslob', 'hilob', 'run_back', 'r_loop'],
  drop: ['drop', 'v_drop', 'r_sig'],
};
const HO_NEAR = { topspin: { flat: 0.8, lob: 0.3 }, flat: { topspin: 0.8 }, slice: { drop: 0.5, lob: 0.3 }, lob: { topspin: 0.4, slice: 0.3 }, drop: { slice: 0.6 } };
function hoCardFam(cd) {
  for (const [f, ids] of Object.entries(HO_FAM)) if (ids.includes(cd.id)) return f;
  if (cd.lob) return 'lob';
  if (cd.sig) return cd.kind === 'drop' ? 'drop' : cd.skid || cd.kind === 'net' ? 'slice' : cd.kind === 'attack' ? 'flat' : 'topspin';
  return ({ attack: 'flat', deep: 'topspin', safe: 'topspin', defend: 'slice', volley: 'flat', pass: 'topspin', net: 'slice', drop: 'drop', lob: 'lob' })[cd.kind] || 'topspin';
}
// Which side of the screen a card's ball goes to (−1 left, 0 middle, +1 right; null: no particular side).
function hoCardSide(c, cd) {
  const x = c.st.x === undefined ? 1 : c.st.x, side = x >= 0 ? 1 : -1, fh = hoOpp(c).hand === 'left' ? 1 : -1;
  if (cd.serve) { const s = c.ad ? 1 : -1; return { wide: s, body: s * 0.3, t: -s * 0.45 }[cd.serve]; } // swipe directions (hoServeKey)
  if (cd.weak || cd.strong) { const w = hoWeak(c), wing = cd.weak ? w : w === 'bh' ? 'fh' : 'bh'; return wing === 'fh' ? fh : -fh; }
  return ({ line: side, cross: -side, angle: -side * 1.2, middle: 0, fhc: fh, bhc: -fh })[cd.dir] ?? null;
}
// The dealt card closest to the drawn stroke: spin first, then direction (a sideways stroke wants an angle).
function hoGesturePick(c, stage, cards, g) {
  const fam = g.type === 'disguise' ? g.base : g.type;
  let best = null;
  for (const cd of cards) {
    const f = hoCardFam(cd), sd = hoCardSide(c, cd);
    let sc = f === fam ? 2 : (HO_NEAR[fam] || {})[f] || 0;
    if (cd.serve) sc = sc * 0.4 + 3 - Math.min(3, Math.abs(g.aim - sd) * 2.4); // a serve is mostly where you draw it
    else if (sd === null) sc += cd.dir === 'open' || cd.dir === 'short' && fam === 'drop' ? 0.9 : 0.5;
    else sc += 1.5 - Math.min(1.5, Math.abs(g.aim - sd) * 1.1) + (cd.dir === 'angle' && g.wide ? 0.4 : 0);
    if (cd.snv) sc -= 1; // serve and volley is a tap on its card
    if (!best || sc > best.score) best = { card: cd, score: sc };
  }
  // A serve goes where you swiped it: if none of the serves you were dealt goes there (a second serve has only two
  // targets), the chosen serve is hit there instead, with its own spin and risk.
  if (best && best.card.serve && !best.card.snv) {
    const v = g.aim * (c.ad ? 1 : -1), to = v >= 0.65 ? 'wide' : v >= -0.075 ? 'body' : 't';
    if (best.card.serve !== to) {
      const word = { slice: 'Slice', topspin: 'Kick', flat: 'Flat' }[fam] || '';
      best = { ...best, src: best.card, card: { ...best.card, serve: to, title: `${word} Serve ${({ wide: 'Out Wide', body: 'Into The Body', t: 'Down The T' })[to]}` } };
    }
  }
  // None of your dealt shots is what you drew (another spin, or well off its direction): you play what you drew.
  if (best && stage !== 'serve' && stage !== 'serve2') {
    const f = hoCardFam(best.card), sd = hoCardSide(c, best.card);
    // The direction must be the one you drew too (down the line, the middle or crosscourt), never just the nearest card.
    const x = c.st.x === undefined ? 1 : c.st.x, v = sd === null ? null : sd * (x >= 0 ? 1 : -1);
    const cat = v === null ? null : v > 0.5 ? 'line' : v < -0.5 ? 'cross' : 'middle', drawn = g.cross >= 0.65 ? 'cross' : g.cross <= 0.35 ? 'line' : 'middle';
    if (f !== fam || (cat !== null && cat !== drawn)) return { card: hoImprov(c, g), score: 0 };
  }
  return best;
}
// A shot you drew that wasn't dealt: an ordinary shot of its kind (its edge still depends on where you are and the
// ball), a little harder to time and slightly worse than a dealt one, so drawing never beats the cards.
const HO_IMP = { flat: 'attack', topspin: 'deep', slice: 'defend', lob: 'lob', drop: 'drop' };
function hoImprov(c, g) {
  const fam = g.type === 'disguise' ? g.base : g.type, net = c.st.net === 'you';
  const kind = net && ['flat', 'topspin', 'slice'].includes(fam) ? 'volley' : HO_IMP[fam];
  const dir = g.cross >= 0.65 ? 'cross' : g.cross <= 0.35 ? 'line' : 'middle', id = `imp_${fam}_${dir}`;
  const title = `${c.st.wing === 'bh' ? 'Backhand' : 'Forehand'} ${({ flat: 'Flat', topspin: 'Topspin', slice: 'Slice', lob: 'Lob', drop: 'Drop Shot' })[fam]}${net && kind === 'volley' ? ' Volley' : ''} ${({ line: 'Down The Line', cross: 'Crosscourt', middle: 'Down The Middle' })[dir]}`;
  return { id, icon: '✍️', title, kind, dir: fam === 'lob' ? undefined : dir, lob: fam === 'lob' || undefined, read: id, readN: hoReadN(c, id), ring: 0.9, bonus: -0.01, improv: true };
}
// The card as drawn. A disguised shot can't be read (it's counted on its own) but is harder to time; a swing against
// the way your arm moves (see SG_TUNE) is a little harder to time and less accurate.
function hoGestureCard(c, cd, g, ph) {
  const t = SG_TYPES[g.type], out = { ...cd, sg: { type: g.type, flight: g.type === 'disguise' ? SG_TYPES[g.base].flight : t.flight, awkward: !!g.awkward, miss: g.miss || undefined, ...ph } };
  if (g.type === 'disguise') Object.assign(out, { read: 'disguise', readN: hoReadN(c, 'disguise'), ring: (cd.ring || 1) * 0.85, title: `Disguised: ${cd.title}` });
  if (g.awkward) out.ring = (out.ring || 1) * 0.9;
  return out;
}
// Which side of the screen the ball comes to you on (you're always at the bottom): a right-hander's forehand is on the right.
// A racket on the pad, its head pointing to the side the ball is on: your forehand side (right for a right-hander,
// left for a left-hander) or your backhand side. It says which wing you're hitting with, without words.
const HO_RACKET = `<svg class="sgracket" viewBox="0 0 130 56" aria-label="Racket"><rect x="4" y="24" width="40" height="9" rx="4.5"/>` +
  `<path class="throat" d="M44 28.5 L62 18 M44 28.5 L62 39"/><ellipse cx="90" cy="28.5" rx="30" ry="24"/>` +
  `<path class="str" d="M75 9 V48 M90 5 V52 M105 9 V48 M63 18 H117 M61 28.5 H119 M63 39 H117"/></svg>`;
const hoBallSide = c => (c.st.wing !== 'bh') === ((c.ps[c.me].hand || 'right') !== 'left') ? 1 : -1;
// A drawn groundstroke's side on screen: down the line lands on the side you're hitting from, crosscourt on the other.
function hoSwipeAim(c, stage, g) {
  if (!g || stage === 'serve' || stage === 'serve2') return g;
  const x = c.st.x === undefined ? hoBallSide(c) : c.st.x, s = Math.abs(x) >= 0.6 ? Math.sign(x) : hoBallSide(c), k = g.cross;
  // Where it lands across (metres, + = your side of the court for down the line): forward ≈ 3 m in on the line side,
  // the cross shape ≈ 2.8 m in on the far side; turned further it keeps going, and only a swing turned well past
  // either shape (about 40°) carries past the sideline (4.2 m).
  const m = k <= 0 ? 3 + 1.3 * -k : k <= 1 ? 3 - 5.8 * k : -2.8 - 1.5 * (k - 1);
  g.landX = s * m;
  g.aim = clamp(g.landX / 3.9, -1, 1);
  g.wide = k >= 0.85;
  g.miss = Math.abs(m) > 4.2 ? 'wide' : g.long ? 'long' : g.short ? 'net' : null; // decided by the swing, however well it's timed
  return g;
}
// The swing guide under the pad: the drawn shape of each shot for this wing, with an arrowhead where the stroke ends
// (like the owner's sheet), forward and cross, mirrored for a lefty. The small arrow under it shows where the ball goes.
const hoArrowHead = (z, p, L = 7) => { const a = Math.atan2(z.y - p.y, z.x - p.x), w = k => `${(z.x - L * Math.cos(a + k)).toFixed(1)} ${(z.y - L * Math.sin(a + k)).toFixed(1)}`;
  return `M${w(0.5)} L${z.x.toFixed(1)} ${z.y.toFixed(1)} L${w(-0.5)}`; };
function hoSwingGuide(wing, lefty) {
  const w = wing === 'bh' ? 'bh' : 'fh', crossArrow = (w === 'fh') !== !!lefty ? '↖' : '↗';
  const shape = (t, d) => { const own = SG_NORM[`${w}.${t}.${d}`]; return own.own ? own[0] : SG_SHAPES[w][t][d]; }; // yours, once set up
  const svg = pts => { const N = sgNorm(pts, 24).map(p => ({ x: 20 + (lefty ? -p.x : p.x) * 30, y: 20 + p.y * 30 }));
    return `<svg viewBox="0 0 40 40"><path d="M${N.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')} ${hoArrowHead(N[N.length - 1], N[N.length - 4])}"/></svg>`; };
  return `<div class="sgguide">${['flat', 'topspin', 'slice', 'lob', 'drop'].map(t => `<figure><b>${SG_TYPES[t].label.replace(/ (Drive|Shot)$/, '')}</b><div>` +
    `<span>${svg(shape(t, 'fwd'))}<i>↑</i></span><span>${svg(shape(t, 'cross'))}<i>${crossArrow}</i></span></div></figure>`).join('')}</div>`;
}

// The serve key: which way to swipe for each target from this side (deuce: wide is well to the left, the body nearly
// straight up, the T a little to the right; the ad court is the mirror). Matches the serve sides in hoCardSide.
const hoServeKey = ad => `<div class="sgguide${ad ? ' flip' : ''}">${[['Out Wide', -50], ['Body', -13], ['Down The T', 20]].map(([t, deg]) => {
  const r = deg * Math.PI / 180, z = { x: 24 + 25 * Math.sin(r), y: 36 - 25 * Math.cos(r) };
  return `<figure><svg viewBox="0 0 40 40"><path d="M24 36 L${z.x.toFixed(1)} ${z.y.toFixed(1)} ${hoArrowHead(z, { x: 24, y: 36 })}"/></svg><figcaption>${t}</figcaption></figure>`; }).join('')}</div>`;
// Set Up My Swipes: you draw each shape from the sheet (right-handed forehand) twice, and those become the shapes the
// game reads (the backhand mirrors them; a lefty's strokes are mirrored to match). Kept on this device only. Then a
// try-out pad says what any stroke reads as, so you can check it before playing.
const SG_SETUP_ORDER = ['flat', 'topspin', 'slice', 'lob', 'drop'].flatMap(t => ['fwd', 'cross'].map(d => [t, d]));
function hoSwipeSetup(onDone) {
  const NAME = { flat: 'Flat', topspin: 'Topspin', slice: 'Slice', lob: 'Lob', drop: 'Drop Shot' }, DIR = { fwd: 'Down The Line', cross: 'Crosscourt' };
  const got = {}, REPS = 2;
  let i = 0, eng = null, trail = null;
  const sheet = (t, d) => { const N = sgNorm(SG_FH[t][d], 24).map(p => ({ x: 20 + p.x * 30, y: 20 + p.y * 30 }));
    return `<svg viewBox="0 0 40 40"><path d="M${N.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')} ${hoArrowHead(N[N.length - 1], N[N.length - 4])}"/></svg>`; };
  const stop = () => { if (eng) { eng.detach(); eng = null; } };
  const pad = (id, onStroke) => {
    stop(); const el = document.getElementById(id); trail = new SwipeTrail(el);
    eng = new StrokeGestureEngine(el, { move: (g, pts) => trail.set(pts, '#f5f5f7'), cancel: () => trail.set([]), commit: (g, pts) => { trail.set(pts, '#ffd60a'); trail.done(); onStroke(g, pts); } }, {}).attach();
  };
  const step = () => {
    if (i >= SG_SETUP_ORDER.length) return finish();
    const [t, d] = SG_SETUP_ORDER[i], n = (got[t] && got[t][d] || []).length;
    $('sheet').querySelector('.sgsetup').innerHTML = `<p class="sgstep">${i + 1} Of ${SG_SETUP_ORDER.length} · Forehand (Right-Handed)</p>` +
      `<div class="sgwant"><div class="sgguide one"><span>${sheet(t, d)}<i>${d === 'fwd' ? '↑' : '↖'}</i></span></div><b>${NAME[t]} · ${DIR[d]}</b></div>` +
      `<p class="hint">Draw it the way you'll draw it in a match (${n + 1} of ${REPS}).</p><div class="sgpad" id="sgSetPad"></div>` +
      `<div class="horow"><button type="button" class="btn small ghost" data-sg="redo">↩ Redo This One</button><button type="button" class="btn small ghost" data-sg="keep">Use The Sheet's Shape</button></div>`;
    pad('sgSetPad', (g, pts) => {
      const P = sgNorm(pts, 24).map(p => [Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000]);
      ((got[t] = got[t] || {})[d] = got[t][d] || []).push(P);
      if (got[t][d].length >= REPS) i++;
      setTimeout(step, 350);
    });
  };
  const finish = () => {
    stop();
    try { localStorage.setItem(SG_MINE_KEY, JSON.stringify(got)); } catch {}
    sgBuild();
    $('sheet').querySelector('.sgsetup').innerHTML = `<p class="sgstep">Saved. Try Any Stroke</p><p class="hint">Draw any shot below: it says what it reads, so you can check before you play.</p>` +
      `<div class="horow"><button type="button" class="btn small ghost" data-sg="wing">Reading As: <b>${tryWing === 'fh' ? 'Forehand' : 'Backhand'}</b></button></div>` +
      `<div class="sgpad" id="sgTryPad"><div class="sglive" id="sgTryOut">Draw A Shot</div></div>` +
      `<div class="horow"><button type="button" class="btn small ghost" data-sg="again">Start Over</button><button type="button" class="btn small" data-sg="done">✅ Done</button></div>`;
    pad('sgTryPad', (g0, pts) => {
      const g = StrokeGestureEngine.read(pts, { wing: tryWing });
      const dir = !g ? '' : g.cross >= 0.65 ? (g.cross > 1.6 ? 'Crosscourt (Very Sharp)' : 'Crosscourt') : g.cross <= 0.35 ? (g.cross < -0.6 ? 'Down The Line (Very Wide)' : 'Down The Line') : 'Down The Middle';
      $('sgTryOut').textContent = !g || g.unclear ? 'Not A Clear Shot' : `${SG_TYPES[g.base].label} · ${dir}${g.type === 'disguise' ? ' · Disguised' : ''}`;
    });
  };
  let tryWing = 'fh';
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button><h2 class="itop">✍️ Set Up My Swipes</h2><div class="sgsetup"></div>`, { onClose: () => { stop(); if (onDone) onDone(); } });
  $('mx').onclick = closeModal;
  $('sheet').onclick = e => {
    const b = e.target.closest('[data-sg]'); if (!b) return;
    const k = b.dataset.sg, [t, d] = SG_SETUP_ORDER[Math.min(i, SG_SETUP_ORDER.length - 1)];
    if (k === 'redo') { if (got[t]) delete got[t][d]; step(); }
    else if (k === 'keep') { if (got[t]) delete got[t][d]; i++; step(); }
    else if (k === 'again') { for (const x in got) delete got[x]; i = 0; step(); }
    else if (k === 'wing') { tryWing = tryWing === 'fh' ? 'bh' : 'fh'; b.querySelector('b').textContent = tryWing === 'fh' ? 'Forehand' : 'Backhand'; }
    else if (k === 'done') closeModal();
  };
  step();
}

// Which timing gauge a shot uses, one simple rule: serves are press, hold and release (the bar only fills while you
// hold); every other shot is the closing rings.
const hoGauge = (card, stage) => stage === 'serve' || stage === 'serve2' ? 'hold' : 'ring';
// How well it was hit, from how far off the tap was (ms): perfect in the green, okay on the grey, mistimed outside.
const hoTiming = (d, W, P = HO_PERFECT) => d <= W * P ? 1 - 0.15 * d / (W * P) : d <= W ? 0.75 - 0.3 * (d - W * P) / (W * (1 - P)) : 0.1;
const hoPerfect = card => !card.late && card.u >= 0.85; // a perfect hit never goes out or into the net
const hoQuality = u => u >= 0.85 ? 'PERFECT' : u >= 0.4 ? 'OKAY' : 'MISTIMED';

async function hoPickAndHit(c, ui, stage, cards) {
  const r = await ui.choose(stage, cards, hoSecs(c, stage), c);
  const card = { ...r.card };
  if (r.late) { card.u = 0.2; card.late = true; if (ui.flash) ui.flash('TOO LATE'); }
  else {
    card.u = await ui.hit(card, hoWindow(c, card, stage), c.pf, stage);
    // A drawn shot angled past the sideline, or swung too long or too short, misses however well it was timed.
    const miss = card.sg && card.sg.miss && ({ wide: 'OUT WIDE', long: 'OVERHIT: LONG', net: 'UNDERHIT: NET' })[card.sg.miss];
    if (ui.flash) ui.flash(miss ? `${hoQuality(card.u)} · ${miss}` : hoQuality(card.u));
  }
  c.uses[card.read] = (c.uses[card.read] || 0) + 1;
  if (card.weak || card.strong) card.weakWing = hoWeak(c);
  return card;
}

// Their reply: where it goes, what kind of ball it is, whether you're still in control, and whether they come in.
function hoReply(c, card, rng) {
  const st = c.st, A = c.ps[c.me], B = hoOpp(c), u = card.u, os = (c.m.styles || [])[1 - c.me] || '';
  const push = c.push * (card.kind === 'deep' ? 0.75 : 1) * (u < 0.35 ? 1.5 : 1) * (card.grind ? 0.7 : 1);
  c.pos = clamp(c.pos + (u > 0.8 ? 1 : u < 0.35 ? -1 : 0) + (card.kind === 'attack' && u > 0.7 ? 1 : 0) + (card.kind === 'defend' && u > 0.5 && c.pos < 0 ? 1 : 0) - (rng() < push ? 1 : 0), -2, 2);
  const open = ['angle', 'open', 'line', 'bhc', 'fhc'].includes(card.dir) && card.kind === 'attack' && u > 0.6 && rng() < 0.6;
  const w = { short: 0.15 + (u > 0.75 ? 0.15 : 0) + (card.skid || card.pushBack ? 0.2 : 0) + (open ? 0.15 : 0), deep: 0.3 + (c.pos < 0 ? 0.15 : 0),
    wide: 0.15 + (card.dir === 'line' ? 0.12 : 0) + (u < 0.35 ? 0.1 : 0), high: /Topspin/.test(os) ? 0.22 : 0.04, low: famOf(os) === 'craft' ? 0.15 : 0.04, neutral: 0.3 };
  let r = rng() * Object.values(w).reduce((a, x) => a + x, 0);
  st.ball = Object.keys(w).find(k => (r -= w[k]) <= 0) || 'neutral';
  const bw = advPlan(B, A).wing;
  st.wing = rng() < (bw === 'bh' ? 0.7 : bw === 'fh' ? 0.3 : 0.5) ? 'bh' : 'fh';
  st.open = open;
  // A short or weak ball from you invites them in (as often as their plan comes forward).
  st.net = (u < 0.45 || ['defend', 'safe'].includes(card.kind) && c.pos < 0) && rng() < ({ rarely: 0.03, sometimes: 0.1, often: 0.25 })[planOf(B).net] ? 'them' : null;
  if (card.pullIn && u > 0.45 && rng() < 0.6) st.net = 'them'; // they had to come in for it
  st.last = card.id; st.first = false;
}

// Plays one point. ui: { choose, hit, reach, finish } (the court, or a test bot). You choose and hit every shot:
// reach(k, pt) plays the point on court up to your shot k; finish(result) plays it to the end. Returns { w, pt }.
async function hoPlay(c, ui, rng = Math.random) {
  const { m, ps, ev, me, s } = c, op = 1 - me, A = ps[me], B = ps[op], serving = s === me;
  const o = serveOdds(m, ps, ev, s, c.clutch, c.ad), SP = SERVE_PLAN[planOf(ps[s]).serve];
  const pt = { serve2: false, how: null, len: 1, net: null, hands: true, aims: {}, kmh1: Math.round(140 + ps[s].attrs.serve * 0.8 + SP.kmh + gauss(rng) * 6) };
  const kmh2 = Math.round(115 + ps[s].attrs.serve * 0.6 + gauss(rng) * 5), hit = i => (i % 2 === 0 ? s : 1 - s);
  const out = (w, extra) => ({ w, pt: Object.assign(pt, extra) });
  // Stand-in endings that show the point up to your next shot (every real ending opens the same way).
  const probe = k => ({ ...pt, how: 'ue', len: k + 2, w: hit(k), missNet: true });
  // Their approach's spin is settled once (sliced or topspin), so the court shows the same approach however it ends.
  const oppApp = () => (c.oppApp = c.oppApp || (rng() < 0.6 ? 'chip' : 'top'));
  const probePass = k => ({ ...pt, how: 'winner', len: k + 2, w: op, net: { by: op, won: true, style: oppApp() } });
  const probeVolley = (a, chip) => ({ ...pt, how: 'winner', len: a + 3, w: me, net: { by: me, won: true, style: a === 0 ? 'snv' : chip ? 'chip' : 'top', at: a } }); // the same approach (a chip is sliced)
  let swMissed = false; // your drawn shot was already called out when you hit it
  const done = async r => { if (r.pt.missNet === undefined) r.pt.missNet = rng() < 0.45; await ui.finish(r);
    // Say it when a ball goes out or into the net, once it's landed (the court's small "OUT" is easy to miss).
    if (ui.flash && !swMissed && ['ue', 'fe'].includes(r.pt.how)) ui.flash(`${r.w === op ? 'Your Shot' : 'Their Shot'}: ${r.pt.missNet ? 'Into The Net' : 'Out'}`.toUpperCase());
    return r; };
  // Your drawn shot missed (angled out, overhit or underhit): the point is theirs, shown as your error.
  const missed = (k, card) => { pt.aims[k] = hoAim(card); swMissed = true; return done(out(op, { how: 'ue', len: k + 1, missNet: card.sg.miss === 'net' })); };
  c.push = clamp(0.28 + (attr(B, 'ground') - attr(A, 'ground')) * 0.006 + (({ aggressive: 0.07, patient: -0.04 })[planOf(B).aggression] || 0), 0.1, 0.6);
  let R, R0, k0, card;
  const pWin = e => clamp(R + e, R0 - HO_DOWN, R0 + HO_CAP);
  // The point swing from a shot: the choice (poor ones cost the most) and how well you hit it.
  const swing = card => { const ch = hoEdge(c, card); return (ch < 0 ? HO_BAD : HO_SKILL) * ch + HO_SKILL * (card.u - 0.55) * HO_KIND[card.kind].gain; };
  const timed = swing;
  // You came to the net with shot a: their pass may decide it; if not, you volley.
  const approach = async (a, card) => {
    pt.aims[a] = hoAim(card);
    const eA = timed(card);
    if (rng() < 0.45) { const won = rng() < pWin(eA); return done(out(won ? me : op, { how: won ? 'fe' : 'winner', len: a + 2, net: { by: me, won, style: a === 0 ? 'snv' : card.chip ? 'chip' : 'top', at: a } })); }
    c.st = { ...c.st, net: 'you', open: card.u > 0.6, lobbed: rng() < 0.25 }; c.pos = clamp(c.pos + (card.u > 0.6 ? 1 : 0), -2, 2);
    hoSpot(c, await ui.reach(a + 2, probeVolley(a, card.chip)), rng);
    const v = await hoPickAndHit(c, ui, 'rally', hoDeal(c, rng));
    if (v.sg && v.sg.miss) return missed(a + 2, v);
    pt.aims[a + 2] = hoAim(v);
    const won = rng() < pWin(timed(v) + 0.5 * eA);
    const passed = !won && hoPerfect(v); // a perfect volley goes in: they had to pass you off it
    return done(out(won ? me : op, { how: won ? 'winner' : passed ? 'winner' : 'ue', len: passed ? a + 4 : a + 3, net: { by: me, won, style: a === 0 ? 'snv' : card.chip ? 'chip' : 'top', after: passed || undefined, at: a } }));
  };
  if (serving) {
    card = await hoPickAndHit(c, ui, 'serve', serveCards(c, false));
    pt.aims[0] = hoAim(card);
    // A perfect serve never misses; one that would have missed went in as a safer, softer serve (no free points from it).
    let first = rng() < clamp(o.a + (card.u - 0.55) * 0.2 * HO_SKILL + (card.inMod || 0), 0.25, 0.95), soft = 0;
    if (!first && hoPerfect(card)) soft = 1;
    if (!first && !soft) {
      Object.assign(pt, { serve2: true, kmh2 });
      pt.aims.f1 = pt.aims[0]; // the fault misses near where the first serve was aimed
      await ui.reach(0, probe(0)); // the fault plays out, then you're back on the line
      card = await hoPickAndHit(c, ui, 'serve2', serveCards(c, true, card));
      pt.aims[0] = hoAim(card);
      if (rng() < clamp(o.df * (1 + (0.55 - card.u) * 1.2 * HO_SKILL) * card.dfMul, 0.01, 0.4)) { if (!hoPerfect(card)) return done(out(op, { how: 'df' })); soft = 2; }
    }
    // The engine's odds once the serve is in, split into a free point (ace, unreturned) and the rally after it.
    const W = first ? o.w1 : o.w2, aceB = first ? o.aceP : 0, unr = (first ? 0.16 : 0.05) * o.aceK * (soft ? 0 : 1);
    const I0 = W * (aceB + (1 - aceB) * unr), Rs = (W - I0) / (1 - I0);
    if (!soft && rng() < clamp(I0 * (1 + ((card.ace || 1) * (0.75 + 0.45 * card.u) - 1) * HO_SKILL), 0, 0.9)) return done(out(me, { how: aceB && rng() < aceB / (aceB + (1 - aceB) * unr) ? 'ace' : 'unreturned' }));
    R0 = Rs; R = Rs + ((card.u - 0.55) * 0.03 + (card.edge || 0) - hoReadPen(card)) * HO_SKILL - [0, 0.1, 0.2][soft];
    c.pos = soft ? -1 : card.u > 0.75 ? 1 : card.u < 0.35 ? -1 : 0;
    c.st = { wing: rng() < 0.5 ? 'fh' : 'bh', ball: card.u > 0.75 ? 'short' : card.u < 0.35 ? 'deep' : rng() < 0.5 ? 'neutral' : 'deep', open: false, net: null, last: null, first: true };
    if (card.snv) return approach(0, { ...card, kind: 'net' });
    pt.aims[1] = { wing: c.st.wing };
    k0 = 2;
  } else {
    const first = rng() < o.a;
    if (!first) { Object.assign(pt, { serve2: true, kmh2 }); if (rng() < o.df) return done(out(me, { how: 'df' })); }
    const W = first ? o.w1 : o.w2, aceB = first ? o.aceP : 0;
    if (rng() < W * aceB) return done(out(op, { how: 'ace' }));
    const W1 = (W - W * aceB) / (1 - W * aceB), U0 = W1 * (first ? 0.16 : 0.05) * o.aceK, Rs = (W1 - U0) / (1 - U0);
    c.pos = { deep: first ? -1 : 0, normal: first ? -1 : 0, inside: first ? 0 : 1 }[c.plan.returnPos] ?? 0;
    c.st = { wing: rng() < 0.5 ? 'fh' : 'bh', ball: first ? 'deep' : 'neutral', open: false, net: null, last: null, first: false };
    hoSpot(c, await ui.reach(1, probe(1)), rng); // the serve comes at you
    card = await hoPickAndHit(c, ui, 'ret', returnCards(c, !first));
    if (card.sg && card.sg.miss) return missed(1, card);
    // A perfect return never misses: one that would have been a forced error just gets back, and you start the rally in trouble.
    const jammed = rng() < clamp(U0 * (1 + (clamp(1.4 - 0.73 * card.u, 0.6, 1.4) - 1) * HO_SKILL), 0, 0.6);
    if (jammed && !hoPerfect(card)) return done(out(op, { how: 'fe', len: 2 }));
    R0 = 1 - Rs; R = R0 - (jammed ? 0.25 : 0);
    if (jammed) c.pos = -2;
    if (card.kind === 'net') return approach(1, card);
    pt.aims[1] = hoAim(card);
    // The return may decide the point; if not, the rally is on.
    const e = timed(card), K = HO_KIND[card.kind];
    if (rng() < clamp(0.3 * K.end * HO_SURF[ev.surface] * (card.u < 0.3 ? 1.6 : 1), 0.06, 1)) return done(hoEnd(pt, me, s, 1, card, rng() < pWin(e), rng));
    hoReply(c, card, rng);
    pt.aims[2] = { wing: c.st.wing };
    k0 = 3;
  }
  // The rally: you choose and hit every ball until someone wins it.
  for (let j = 0; ; j++) {
    const k = k0 + 2 * j;
    c.j = j;
    if (c.st.net === 'them') {
      hoSpot(c, await ui.reach(k, probePass(k)), rng);
      card = await hoPickAndHit(c, ui, 'rally', hoDeal(c, rng));
      if (card.sg && card.sg.miss) return missed(k, card);
      pt.aims[k] = hoAim(card);
      return done(hoEndPass(pt, me, s, k, card, rng() < pWin(timed(card)), rng, oppApp()));
    }
    hoSpot(c, await ui.reach(k, probe(k)), rng);
    card = await hoPickAndHit(c, ui, 'rally', hoDeal(c, rng));
    if (card.sg && card.sg.miss) return missed(k, card);
    if (card.kind === 'net') return approach(k, card);
    pt.aims[k] = hoAim(card);
    const raw = hoEdge(c, card) + (card.u - 0.55) * HO_KIND[card.kind].gain, e = swing(card), K = HO_KIND[card.kind];
    card.e = raw;
    // Bad choices and mistimed balls end points (usually yours); attacking shots end them either way.
    const h = j >= 9 ? 1 : clamp(0.26 * K.end * (card.endMul || 1) * HO_SURF[ev.surface] * (card.u < 0.3 ? 1.7 : 1) * (1 + clamp(-raw * 12, 0, 1.5)) * (card.dir === 'open' ? 1.5 : 1), 0.06, 1);
    if (rng() < h) return done(hoEnd(pt, me, s, k, card, rng() < pWin(e), rng));
    hoReply(c, card, rng);
    pt.aims[k + 1] = { wing: c.st.wing }; // their ball comes to the wing you'll play next
  }
}

// How the point ended, shaped for the court and the match stats. k: the shot you hit (0 = the serve).
function hoEnd(pt, me, s, k, card, won, rng) {
  const op = 1 - me, hit = i => (i % 2 === 0 ? s : 1 - s), fix = (len, last) => (hit(len - 1) !== last ? len + 1 : len);
  const u = card.u, set = (w, x) => ({ w, pt: Object.assign(pt, x) });
  if (card.kind === 'drop') {
    if (won) return set(me, { how: 'drop', len: fix(k + 1, me), drop: { by: me, result: 'won' } });
    if (!hoPerfect(card) && (u < 0.45 || rng() < 0.35)) return set(op, { how: 'dropnet', len: fix(k + 1, me), drop: { by: me, result: 'net' } });
    return set(op, { how: 'dropchased', len: fix(k + 2, op), drop: { by: me, result: 'chased' } });
  }
  if (won) {
    if (k === 1 && card.kind === 'attack' && rng() < 0.5) return set(me, { how: 'winner', len: 2, returnWinner: true });
    const mine = card.kind === 'attack' ? rng() < 0.75 : rng() < 0.25 + 0.3 * u;
    return mine ? set(me, { how: 'winner', len: fix(k + 1, me) }) : set(me, { how: rng() < 0.55 ? 'fe' : 'ue', len: fix(k + 2, op) });
  }
  // Lost: a mistimed ball or the wrong shot for the moment ends in your error.
  const myErr = !hoPerfect(card) && (u < 0.35 || rng() < (card.kind === 'attack' ? 0.55 : 0.3) + clamp(-(card.e || 0) * 8, 0, 0.4));
  return myErr ? set(op, { how: 'ue', len: fix(k + 1, me) }) : set(op, { how: 'winner', len: fix(k + 2, op) });
}

// They came to the net (their approach was shot k − 1) and you went for the pass or the lob.
function hoEndPass(pt, me, s, k, card, won, rng, style) {
  const op = 1 - me, set = (w, x) => ({ w, pt: Object.assign(pt, x) });
  if (won) return set(me, { how: 'winner', len: k + 1, net: { by: op, won: false, style } });
  if (!hoPerfect(card) && (card.u < 0.4 || rng() < 0.4)) return set(op, { how: 'ue', len: k + 1, net: { by: op, won: true, style } });
  return set(op, { how: 'winner', len: k + 2, net: { by: op, won: true, style } });
}

// The engine side: count a hands-on point in the match stats exactly as servePoint would have.
function forcedPoint(m, ps, s) {
  const f = m.forced, st = m.stats[s], pt = { ...f.pt }, w = f.w, l = 1 - w;
  m.forced = null;
  st.servePts++;
  if (pt.how === 'df') { st.df++; return { w, pt }; }
  if (!pt.serve2) { st.firstIn++; st.sp1 += pt.kmh1; st.sp1n++; st.spMax = Math.max(st.spMax, pt.kmh1); }
  else { st.sp2 += pt.kmh2; st.sp2n++; st.spMax = Math.max(st.spMax, pt.kmh2); }
  if (w === s) pt.serve2 ? st.secondWon++ : st.firstWon++;
  if (pt.how === 'ace') st.aces++;
  if (['winner', 'drop', 'dropchased'].includes(pt.how)) m.stats[w].winners++;
  if (['ue', 'dropnet'].includes(pt.how)) m.stats[l].ue++;
  if (pt.net) { m.stats[pt.net.by].netPlayed++; if (pt.net.won) m.stats[pt.net.by].netWon++; }
  if (pt.drop) { const d = m.stats[pt.drop.by]; d.dropPlayed = (d.dropPlayed || 0) + 1; if (pt.drop.result === 'won') d.dropWon = (d.dropWon || 0) + 1; }
  return { w, pt };
}

// --- On court ------------------------------------------------------------------------------

// Plays a hands-on point on court as you play it: up to each decision (reach), then to the end (finish). Every
// version of the point is planned from the same start with the same random seed, so they open identically and the
// rest of the point can be swapped in at the moment you choose.
function hoCourt(c) {
  const me = c.me, V = i => (i === me ? 0 : 1), seed = (Math.random() * 4294967296) >>> 0;
  const info = { server: V(c.s), deuce: (c.info.pts[0] + c.info.pts[1]) % 2 === 0 };
  const map = p => ({ ...p, w: V(p.w), net: p.net && { ...p.net, by: V(p.net.by) }, drop: p.drop && { ...p.drop, by: V(p.drop.by) }, review: false });
  let script = null, playing = null, at = 0, hold = -1, cut = 0, reached = null, release = null, spot = null, ended = false;
  // If the court ever stops early (an error, or it was cut short), nothing must wait for it: the point carries on.
  const settle = e => { if (e) console.error(e); if (window.__hoCheck && reached) window.__hoCheck.early = (window.__hoCheck.early || 0) + 1; ended = true; hold = -1; const r = reached; reached = null; if (r) r(spot); };
  const hook = async i => {
    if (i !== hold) return;
    at = cut; hold = -1;
    const r = reached; reached = null; if (r) r(spot);
    await new Promise(res => { release = res; });
  };
  const load = next => {
    if (!script) { script = next; playing = Court.playScript(script, anim.speed, hook); playing.then(() => settle(), settle); return; }
    // (Test pages count any opening that doesn't match: it would show as a jump on court.)
    if (window.__hoCheck) { const key = sg => JSON.stringify({ ...(({ holdAt, ...rest }) => rest)(sg), nextFlight: 0, nextKind: 0, rush: 0, slide: 0, h0: 0, r0: 0 }); /* wind-up pose only; h0 is filled in as it plays */ window.__hoCheck.n++; const j = script.segs.slice(0, at).findIndex((sg, i) => key(sg) !== key(next.segs[i])); if (j >= 0) { window.__hoCheck.bad++; const A = script.segs[j], B = next.segs[j]; window.__hoCheck.why = (window.__hoCheck.why || []).concat(A.t + '[' + j + '/' + at + ' ' + A.kind + ' ' + JSON.stringify(A.call && A.call.type) + ' vs ' + JSON.stringify(B.call && B.call.type) + ' sw ' + A.sw + '/' + B.sw + ' pace ' + JSON.stringify([A.bounce, B.bounce]) + ']:' + Object.keys({ ...A, ...B }).filter(x => JSON.stringify(A[x]) !== JSON.stringify(B[x])).join(',')); } }
    script.segs.splice(at, script.segs.length - at, ...next.segs.slice(at));
    script.rally = next.rally; script.highlight = next.highlight;
  };
  const go = () => { const r = release; release = null; if (r) r(); };
  const plan = pt => Court.planSeeded(map(pt), info, seed, script && script.start);
  const api = {
    rally: null,
    reach(k, pt) {
      return new Promise(res => {
        const next = plan(pt);
        let n = -1;
        const idx = next.segs.findIndex(sg => sg.t === 'shot' && ++n === k);
        if (ended || idx < 0 || (script && idx <= at)) { if (window.__hoCheck) { const h = window.__hoCheck; h.skipped = (h.skipped || 0) + 1; h.skipWhy = (h.skipWhy || []).concat(`${ended ? 'ended' : idx < 0 ? 'noshot' : 'past'} k${k} idx${idx} at${at}`).slice(-6); } return res(); } // nothing to stop at: carry on
        // Where you'll hit this ball from, and with which wing, as drawn on court: the cards are dealt for that.
        const prev = next.segs.slice(0, idx).reverse().find(sg => sg.t === 'shot');
        spot = { x: next.segs[idx].from.x, wing: prev && prev.nextWing, inX: prev && prev.from ? prev.from.x : undefined };
        if (window.__hoCheck) window.__hoCheck.spot = spot;
        // You choose while their ball is still on its way (part-way through its flight), before you've run to it.
        const pi = prev ? next.segs.lastIndexOf(prev) : -1;
        if (pi >= 0 && pi >= at) { prev.holdAt = HO_HOLD_AT; hold = pi + 0.5; cut = pi + 1; } else { hold = idx; cut = idx; }
        reached = res;
        load(next); go();
        // Last resort: if the court hasn't reached your shot after 15 s of unpaused play, carry on without it.
        let waited = 0; const dog = setInterval(() => { if (reached !== res) return clearInterval(dog);
          if (!(typeof anim !== 'undefined' && anim.paused)) waited += 500;
          if (waited >= 15000) { clearInterval(dog); console.warn('Play The Points: court stalled, carrying on'); settle(); } }, 500);
      });
    },
    async finish(r) {
      hold = -1;
      if (ended) return; // the court stopped early: the point is shown the usual way instead
      load(plan(r.pt ? { ...r.pt, w: r.w } : r)); go();
      api.rally = await playing.catch(() => null);
    },
  };
  return api;
}

// Phones: the court is too small to draw on, so a decision becomes a game screen. The court sits at the top of the
// screen and the controls fill everything below it, fixed in place (the page can't scroll away mid-shot).
function hoGameScreen(box, on) {
  const wrap = document.getElementById('mCourtWrap');
  if (!on || innerWidth > 760 || document.fullscreenElement || !wrap) {
    box.classList.remove('hofix'); box.style.top = ''; document.body.classList.remove('hofixed');
    // Computers and tablets: bring the whole court (and the choice on it) into view if part of it is off screen.
    if (on && wrap && !document.fullscreenElement) { const r = wrap.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) wrap.scrollIntoView({ block: r.height > innerHeight ? 'start' : 'center' }); }
    return;
  }
  if (!document.body.classList.contains('hofixed')) wrap.scrollIntoView({ block: 'start' });
  const r = wrap.getBoundingClientRect(), top = Math.round(Math.min(Math.max(r.bottom, 120), innerHeight * 0.45));
  box.style.top = `${top}px`; box.classList.add('hofix'); document.body.classList.add('hofixed');
}

// The shot cards and the timing rings, drawn in the call box over the frozen court.
// idle (the live match record): turns in a row with no action. Two in a row hands the match to Read The Match.
function hoUI(box, c, idle = {}) {
  const me = c.me, serving = c.s === me, info = c.info;
  const stop = () => ui.away || typeof Court !== 'undefined' && (Court.skip || (typeof anim !== 'undefined' && anim.finishAfter));
  const paused = () => typeof anim !== 'undefined' && anim.paused && !stop();
  const acted = yes => { idle.hoIdle = yes ? 0 : (idle.hoIdle || 0) + 1; if (idle.hoIdle >= 2) ui.away = true; };
  const HELD = `<button type="button" class="hoheld">▶ Paused: Tap To Resume</button>`;
  // Pausing from the decision screen too (the match's own Pause button can be out of reach behind it).
  const PAUSE = `<button type="button" class="hoswap hopause" data-pause="1">❚❚ Pause</button>`;
  const SETUP = `<button type="button" class="hoswap hopause" data-setup="1">✍️ Set Up My Swipes</button>`;
  const pauseNow = () => { const b = document.getElementById('mPause'); if (b && typeof anim !== 'undefined' && !anim.paused) b.click(); };
  // The pause notice is also the way back: tapping it resumes the match.
  if (!box.__resume) { box.__resume = 1; box.addEventListener('click', e => { if (e.target.closest('.hoheld') && typeof anim !== 'undefined' && anim.paused) { const b = document.getElementById('mPause'); if (b) b.click(); } }); }
  let at = { x: innerWidth / 2, y: innerHeight / 2 };
  const spot = el => { const r = (el || box).getBoundingClientRect(); if (r.width) at = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const lab = typeof ptsLabels === 'function' ? ptsLabels([info.pts[me], info.pts[1 - me]], info.tb) : ['', ''];
  const tag = info.press ? `${info.press.match ? 'Match' : 'Set'} Point` : info.bp !== null ? 'Break Point' : info.tb ? 'Tiebreak' : '';
  const score = lab[0] === 'AD' ? 'Advantage You' : lab[1] === 'AD' ? 'Advantage Them' : !info.tb && lab[0] === '40' && lab[1] === '40' ? 'Deuce' : `${lab[0]}–${lab[1]}`;
  const head = sub => `<div class="hohead"><b>${serving ? "You're Serving" : "You're Returning"} · ${score}${tag ? ` · ${tag}` : ''}</b><small>${sub}</small></div>`;
  const STAGE = { serve: 'First Serve: Pick Your Serve', serve2: 'Second Serve: Pick Your Serve', ret: 'Return: Pick Your Shot', rally: 'Pick Your Shot' };
  let keyFn = null;
  const setKey = fn => { if (keyFn) window.removeEventListener('keydown', keyFn, true); keyFn = fn; if (fn) window.addEventListener('keydown', fn, true); };
  const show = cls => { box.className = `callbox ho ${cls}`; box.hidden = false; hoGameScreen(box, true); };
  const hide = () => { box.hidden = true; box.innerHTML = ''; box.onclick = null; box.onpointerdown = null; hoGameScreen(box, false); };
  const ui = {
    away: false,
    choose(stage, cards, secs) {
      if (stop()) return Promise.resolve({ card: hoSafest(cards), late: false });
      return new Promise(done => {
        const sit = stage === 'rally' ? hoSituation(c) : stage === 'ret' ? (c.pos >= 1 ? 'Second Serve: Step In' : c.pos < 0 ? 'Big Serve Coming' : 'Serve Coming') : '';
        show('pick');
        // The clock only runs while the match does: a pause stops it and hides the cards (no free thinking time).
        // Swipe Shots gives a little more time: drawing takes longer than tapping.
        let left = secs * 1000 * (hoSwipeOn() ? 1.3 : 1), total = left, last = performance.now(), held = false, eng = null, trail = null, bar = null;
        const cardsHtml = (cls = '') => `<div class="hocards${cls}" style="--n:${cards.length}">${cards.map((cd, i) => `<button type="button" data-ho="${i}"><kbd class="hokey">${i + 1}</kbd><span>${cd.icon}</span><b>${cd.title}</b>` +
          `${cd.sig ? `<small>Your Signature Shot</small>` : ''}${cd.readN >= 3 ? `<em>They're Reading This</em>` : ''}</button>`).join('')}</div>`;
        // Two ways to play, never both at once: tap cards, or draw swipes. A big switch at the top changes it.
        const modeSwitch = sw => `<div class="hoplayas"><button type="button" data-swap="cards" class="${sw ? '' : 'on'}">🃏 Cards</button><button type="button" data-swap="swipe" class="${sw ? 'on' : ''}">✍️ Swipes</button></div>`;
        // The pad: serves are swiped towards the target; other shots are swung like your arm would, on the ball's side.
        const isServe = stage === 'serve' || stage === 'serve2', bs = hoBallSide(c), lefty = (c.ps[c.me].hand || 'right') === 'left';
        const swipePad = () => isServe
          ? `<div class="sgpad"><div class="sglive">Swipe Your Serve</div><small class="sglegend">Swipe up from the bottom towards where you want it to land.</small></div>` + hoServeKey(c.ad)
          : `<div class="sgpad ${bs < 0 ? 'bl' : 'br'}" data-wing="${c.st.wing === 'bh' ? 'bh' : 'fh'}" data-lefty="${lefty ? 1 : 0}">${HO_RACKET}<span class="sgball">🎾</span><div class="sglive"></div>` +
            `<small class="sglegend">Draw the shape for your shot, ending where the arrow points. Longer trails go deeper. Hold still first to disguise it.</small></div>` + hoSwingGuide(c.st.wing, lefty);
        // Draw it (Swipe Shots) or pick a card; either way the cards show what's on for this ball.
        const render = () => {
          if (eng) { eng.detach(); eng = null; } if (trail) { trail.remove(); trail = null; }
          const sw = hoSwipeOn();
          box.innerHTML = head(STAGE[stage]) + modeSwitch(sw) + (sit ? `<div class="hosit ${c.pos > 0 || c.st.open ? 'good' : c.pos < 0 || c.st.net === 'them' ? 'bad' : ''}">${sit}</div>` : '') + `<div class="hotimer"><i></i></div>` +
            (sw ? swipePad() + cardsHtml(' sgchips') : cardsHtml()) + `<div class="horow">${sw && !isServe ? SETUP : ''}${PAUSE}</div>` + HELD;
          bar = box.querySelector('.hotimer i'); bar.style.transition = 'transform .1s linear';
          if (!sw) return;
          const pad = box.querySelector('.sgpad'), live = box.querySelector('.sglive'), chips = [...box.querySelectorAll('.sgchips [data-ho]')];
          trail = new SwipeTrail(pad);
          const idle = live.textContent;
          const MISS = { wide: 'Going Out Wide', long: 'Overhit: Going Long', net: 'Underhit: Into The Net' };
          const show1 = (g, drawing) => {
            const m = g && hoGesturePick(c, stage, cards, hoSwipeAim(c, stage, g));
            if (g && g.unclear) { // mid-stroke it's just not finished yet; only a finished stroke is refused
              chips.forEach(b => b.classList.remove('on')); live.textContent = drawing ? 'Drawing…' : 'Not A Clear Shot: Draw It Again'; live.classList.toggle('out', !drawing); return { m: null, miss: drawing ? null : 'unclear' }; }
            const miss = g && g.miss && !(drawing && g.miss === 'net') ? g.miss : null; // too short only counts once you let go
            chips.forEach((b, i) => b.classList.toggle('on', !!m && cards[i] === (m.src || m.card)));
            live.textContent = g ? `${SG_TYPES[g.type].label}${g.awkward ? ' (Awkward Swing)' : ''}${m ? ` → ${m.card.title}` : ''}${miss ? ` · ${MISS[miss]}` : ''}` : idle;
            live.classList.toggle('out', !!miss);
            return { m, miss };
          };
          eng = new StrokeGestureEngine(pad, {
            // While you draw, the trail stays plain: a half-drawn stroke would keep changing its reading. It's read when you let go.
            // The words still say which shot it's turning into once there's enough of a stroke to read.
            // It turns red while the stroke would send the ball out; hold still at the end of it to cancel and draw again.
            move: (g, pts) => { const r = g && g.len >= 0.2 ? show1(g, true) : null; if (!r) { live.textContent = 'Drawing…'; live.classList.remove('out'); chips.forEach(b => b.classList.remove('on')); }
              trail.set(pts, r && r.miss ? '#ff3b30' : '#f5f5f7'); },
            cancel: why => { trail.set([]); show1(null); if (why === 'still') live.textContent = 'Cancelled: Draw Again'; },
            commit: (g, pts) => {
              if (paused()) { trail.set([]); return show1(null); }
              const { m } = show1(g);
              if (!m) { trail.set(pts, '#ff3b30'); trail.done(); return; } // not clearly one of your shapes: nothing is played, draw again
              trail.set(pts, SG_TYPES[g.type].color); trail.done();
              const A = c.ps[c.me], stat = stage === 'serve' || stage === 'serve2' ? 'serve' : (HO_KIND[m.card.kind] || {}).stat || 'ground';
              const ph = StrokeGestureEngine.physics(g, attr(A, stat), stage === 'serve' || stage === 'serve2');
              pick(hoGestureCard(c, m.card, g, ph));
            },
          }, isServe ? {} : { wing: c.st.wing === 'bh' ? 'bh' : 'fh', lefty }).attach();
        };
        render();
        const iv = setInterval(() => {
          if (stop()) return fin(hoSafest(cards), false);
          const now = performance.now(), p = paused();
          if (p !== held) { held = p; box.classList.toggle('held', p); }
          if (!p) left -= now - last;
          last = now;
          bar.style.transform = `scaleX(${Math.max(0, left / total)})`;
          if (left <= 0) { acted(false); fin(hoSafest(cards), true); }
        }, 100);
        const fin = (card, late) => {
          clearInterval(iv); box.onclick = null; setKey(null); box.classList.remove('held');
          if (eng) { eng.detach(); eng = null; }
          if (trail) { const t = trail; trail = null; setTimeout(() => t.remove(), 500); }
          if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // so Space can't press a card again
          done({ card, late });
        };
        const pick = card => { if (paused()) return; acted(true); fin(card, false); };
        box.onclick = e => {
          if (e.target.closest('[data-pause]')) return pauseNow();
          if (e.target.closest('[data-setup]')) { pauseNow(); return hoSwipeSetup(() => render()); }
          const sb = e.target.closest('[data-swap]');
          if (sb) { const want = sb.dataset.swap === 'swipe'; if (want !== hoSwipeOn()) { try { localStorage.setItem(HO_SWIPE_KEY, want ? '1' : '0'); } catch {} render(); } return; }
          const b = e.target.closest('[data-ho]'); if (b) pick(cards[+b.dataset.ho]);
        };
        setKey(e => {
          const n = +e.key;
          if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); if (paused()) document.getElementById('mPause').click(); else pauseNow(); }
          else if (n >= 1 && n <= cards.length) { e.preventDefault(); pick(cards[n - 1]); }
          else if (e.code === 'Space' || e.key === ' ') e.preventDefault();
        });
      }).then(r => { if (r.late) { spot(box); hide(); } return r; });
    },
    // Rings close in; tap (or press Space) when the yellow ring sits in the green.
    hit(card, W, pf, stage) {
      if (stop()) return Promise.resolve(0.5);
      const kind = hoGauge(card, stage);
      return new Promise(done => {
        // Three ways to time a shot, all judged the same way (ms off the perfect moment): the closing rings,
        // press-hold-release for serves and power shots, a sweeping marker for touch shots.
        // Hold and release: a small green (35% of the rings' share, never under ±10 ms so it's still humanly possible)
        // with only a thin grey edge around it (15% of the usual): a perfect release is a real challenge.
        let PF = HO_PERFECT;
        if (kind === 'hold') { const g = Math.min(W, Math.max(W * HO_PERFECT * 0.35, 10)); W = g + (W - g) * 0.15; PF = g / W; }
        const R0 = 50, S0 = 2.6, Pm = W * PF;
        const T = kind === 'ring' ? clamp((S0 - 1) * R0 * Pm / 6, 650, HO_RING_MS) : 750 + Math.random() * 300;
        const LEAD = kind === 'hold' ? 0 : 350, END = T + Math.max(W, 120) + 250, SPAN = T + W + 260;
        const bar = (x0, x1) => `left:${(clamp(x0 / SPAN, 0, 1) * 100).toFixed(2)}%;width:${((clamp(x1 / SPAN, 0, 1) - clamp(x0 / SPAN, 0, 1)) * 100).toFixed(2)}%`;
        show('hit');
        let gauge, say;
        if (kind === 'ring') {
          // The rings show the real windows: yellow fully inside the green is perfect, touching the grey is okay, outside is mistimed.
          const px = (S0 - 1) * R0 / T, band = W * px + 2, clean = Pm * px + 2, ring = (r, b) => `width:${2 * (r + b)}px;height:${2 * (r + b)}px;border-width:${2 * b}px`;
          gauge = `<div class="horing hogauge${pf > 0.25 ? ' shaky' : ''}" style="--wob:${(pf * 5).toFixed(1)}px"><i class="hoband" style="${ring(R0, band)}"></i><i class="hoclean" style="${ring(R0, clean)}"></i>` +
            `<i class="hoouter" style="width:${2 * R0 + 4}px;height:${2 * R0 + 4}px"></i></div>`;
          say = 'Tap, Click Or Press Space When The Rings Meet';
        } else {
          // A bar: the green is perfect, the grey okay. Hold: it fills while you hold and the shot goes when you let go.
          gauge = `<div class="hobar hogauge ${kind}${pf > 0.25 && kind !== 'hold' ? ' shaky' : ''}" style="--wob:${(pf * 4).toFixed(1)}px"><i class="hobband" style="${bar(T - W, T + W)}"></i>` +
            `<i class="hobclean" style="${bar(T - Pm, T + Pm)}"></i><i class="hobfill"></i><i class="hobmark"></i></div>`;
          say = kind === 'hold' ? 'Press And Hold Before The Timer Runs Out, Let Go In The Green' : 'Tap, Click Or Press Space In The Green';
          // Hold: a timer to start the swing (you can't wait as long as you like), and a tag so it never looks like the tap bar.
          if (kind === 'hold') gauge = `<b class="hotag hold">✊ Hold</b>${gauge}<div class="hobwait"><i></i></div>`;
          else gauge = `<b class="hotag">👆 Tap</b>${gauge}`;
        }
        const sgl = card.sg ? `<div class="sgread">${SG_TYPES[card.sg.type].label} · ${card.sg.kmh} km/h · ${Math.abs(card.sg.rpm).toLocaleString('en-US')} rpm ${card.sg.rpm < 0 ? 'backspin' : 'topspin'}${card.sg.awkward ? ' · Awkward Swing' : ''}</div>` : '';
        box.innerHTML = `<div class="hohit" data-g="${kind}" data-t="${Math.round(T + LEAD)}"><div class="hoshot">${card.icon} ${card.title}</div>${sgl}${gauge}<small>${say}</small></div>` + HELD;
        const outer = box.querySelector('.hoouter'), fill = box.querySelector('.hobfill'), mark = box.querySelector('.hobmark'), wait = box.querySelector('.hobwait');
        let pressBy = 1500; // ms to start a hold
        const t0 = performance.now() + LEAD;
        let raf = 0, over = false, heldMs = 0, heldAt = null, pressAt = null;
        // Gauge time leaves out any time the match was paused, so it freezes with it.
        const clock = now => now - t0 - heldMs - (heldAt !== null ? now - heldAt : 0);
        const at = ts => clock(ts > 0 && ts < 1e11 ? ts : performance.now());
        const show1 = t => {
          if (outer) outer.style.transform = `translate(-50%, -50%) scale(${clamp(S0 - (S0 - 1) * t / T, 0.1, S0)})`;
          else { const f = clamp(t / SPAN, 0, 1) * 100; mark.style.left = `${f}%`; if (kind === 'hold') fill.style.width = `${f}%`; }
        };
        // Drawn one frame ahead, so what you see on screen is where it really is.
        const tick = now => {
          if (over) return;
          const p = paused();
          if (p && heldAt === null) { heldAt = now; box.classList.add('held'); if (pressAt !== null) pressBy = Math.max(pressBy, clock(now) + 1000); pressAt = null; by = null; } // a pause drops a hold: press again after
          if (!p && heldAt !== null) { heldMs += now - heldAt; heldAt = null; box.classList.remove('held'); }
          if (stop()) return fin(0.5);
          if (kind === 'hold') {
            show1(pressAt === null ? 0 : clock(now) - pressAt + 16);
            if (wait) wait.firstChild.style.transform = `scaleX(${pressAt === null ? clamp((pressBy - clock(now)) / 1500, 0, 1) : 0})`;
            if (pressAt !== null && clock(now) - pressAt >= SPAN) { acted(true); return fin(hoTiming(SPAN - T, W, PF)); } // held too long: overhit
            if (pressAt === null && clock(now) >= pressBy) { acted(false); return fin(0); } // never started the swing
          } else {
            show1(clock(now) + 16);
            if (clock(now) >= END) { acted(false); return fin(0); }
          }
          raf = requestAnimationFrame(tick);
        };
        // A hold only fills while something is really held down: letting go of it, or leaving the page, releases the shot.
        let by = null;
        const up = e => { if (kind === 'hold' && by === 'ptr') release(e.timeStamp); };
        const lost = () => { if (kind === 'hold' && by) release(0); };
        const fin = u => {
          if (over) return; over = true; cancelAnimationFrame(raf); setKey(null); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true); removeEventListener('keyup', keyUp, true);
          removeEventListener('blur', lost); document.removeEventListener('visibilitychange', lost);
          box.classList.remove('held'); spot(box.querySelector('.hogauge')); hide(); done(u);
        };
        // Timed from the moment of the tap or release itself (the event's own time stamp), not when the page gets to it.
        const tap = (ts, src) => {
          if (over || heldAt !== null) return;
          if (kind === 'hold') { if (pressAt === null) { pressAt = at(ts); by = src; const b = box.querySelector('.hobar'); if (b) b.classList.add('down'); } return; }
          acted(true);
          fin(hoTiming(Math.abs(at(ts) - T), W, PF));
        };
        const release = ts => {
          if (over || heldAt !== null || pressAt === null) return;
          acted(true);
          fin(hoTiming(Math.abs(at(ts) - pressAt - T), W, PF));
        };
        const keyUp = e => { if ((e.code === 'Space' || e.key === ' ' || e.key === 'Enter') && kind === 'hold' && by === 'key') { e.preventDefault(); release(e.timeStamp); } };
        // A card is picked on its click (after the finger lifts) and a swipe on letting go, so any press from now on is a
        // fresh one: take it straight away (waiting here used to swallow a quick press on the hold bar).
        box.onpointerdown = e => { e.preventDefault(); tap(e.timeStamp, 'ptr'); };
        box.oncontextmenu = e => e.preventDefault(); // a long press on a phone mustn't open a menu
        addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true); addEventListener('keyup', keyUp, true);
        addEventListener('blur', lost); document.addEventListener('visibilitychange', lost);
        // A key already held down when the gauge appeared (auto-repeat) never starts a swing: press it fresh.
        setKey(e => { if ((e.code === 'Space' || e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); if (!e.repeat) tap(e.timeStamp, 'key'); } });
        raf = requestAnimationFrame(tick);
      });
    },
    // Just the word, small, right where the rings were (never over the court's top, where the ball lands).
    flash(text) {
      const el = document.createElement('div');
      el.className = `hoflash ${({ PERFECT: 'good', OKAY: 'ok' })[text] || (text.startsWith('THEIR') ? 'good' : 'bad')}`;
      el.textContent = text; el.style.left = `${innerWidth / 2}px`; el.style.top = `${innerHeight * 0.45}px`; // always the middle of the screen
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 900);
    },
    close() { setKey(null); hide(); },
  };
  // The tutorial: a tip the first time each thing comes up (before its clock starts), a little more time to choose
  // and a wider timing window while you learn (a practice match, so it gives nothing away).
  if (hoTutOn()) {
    const choose0 = ui.choose, hit0 = ui.hit;
    ui.choose = (stage, cards, secs) => stop() ? choose0.call(ui, stage, cards, secs) : hoTutBefore(stage).then(() => choose0.call(ui, stage, cards, secs * 1.5));
    ui.hit = (card, W, pf, stage) => stop() ? hit0.call(ui, card, W, pf, stage) : hoTutTip(hoGauge(card, stage)).then(() => hit0.call(ui, card, W * 1.4, pf, stage));
  }
  return ui;
}

// Before a hands-on point (tournaments.js): play it, record it (so a refresh replays it, never re-asks it) and hand it to the engine.
async function playHandsOn(entry, m, ps, me, ev, info, step) {
  const L = entry.live, box = $('mCallBox');
  // Which shots they've seen from you: counted per set, and half forgotten when you change your plan.
  const planKey = JSON.stringify(planOf(ps[me]));
  if (!L.hoUses || L.hoUses.set !== m.sets.length) L.hoUses = { set: m.sets.length, plan: planKey, c: {} };
  else if (L.hoUses.plan !== planKey) { for (const k in L.hoUses.c) L.hoUses.c[k] = Math.floor(L.hoUses.c[k] / 2); L.hoUses.plan = planKey; }
  // Saved before the first shot: a point left half-played by a refresh is simply played by the engine, no second try.
  L.calls = [...(L.calls || []), { step, id: 'ho' }];
  writeJSON(ENTRY_KEY, entry);
  const c = hoContext(m, ps, ev, me, info, L.hoUses.c);
  await courtFade(false); // back from the skip screen
  Court.reset(me === info.s ? 0 : 1, (info.pts[0] + info.pts[1]) % 2 === 0);
  Court.draw();
  const tag = info.press ? `${info.press.match ? 'MATCH' : 'SET'} POINT` : info.bp !== null ? 'BREAK POINT' : '';
  Court.banner(tag || null);
  const court = hoCourt(c), hu = hoUI(box, c, L), ui = Object.assign(hu, { reach: court.reach, finish: court.finish });
  const res = await hoPlay(c, ui);
  ui.close();
  // Two turns in a row with no action: you've stepped away, so Read The Match takes over (switch back any time).
  if (hu.away && L.mode === 'play') {
    L.hoIdle = 0;
    switchMode('read');
    if (typeof toast === 'function') toast('Switched To Read The Match', 'No shots were picked, so the match carries on without you. Switch back any time.');
  }
  box.className = 'callbox';
  anim.hoRally = court.rally; // already shown: the animator just scores it
  const rec = L.calls.find(x => x.step === step && x.id === 'ho');
  if (rec) rec.res = res;
  writeJSON(ENTRY_KEY, entry);
  m.forced = res;
}


// --- The Play The Points tutorial ------------------------------------------------------------------------------
// A practice match with your own player against a computer player at about your level, played in the throwaway
// test saves (tourlife.test.*), so your career isn't touched. Every game is yours. A short tip explains each thing
// the first time it comes up: serving, the hold bar, returning, rally cards, the rings, then Swipe Shots.
const HO_TUT_KEY = 'tourlife.test.tutorial';
const hoTutState = () => { try { return JSON.parse(localStorage.getItem(HO_TUT_KEY) || 'null'); } catch { return null; } };
const hoTutSave = st => { try { localStorage.setItem(HO_TUT_KEY, JSON.stringify(st)); } catch {} };
const hoTutOn = () => typeof isTestMatch === 'function' && isTestMatch() && !!(hoTutState() || {}).on;

const HO_TUT_TIPS = {
  start: ['🎮', 'Play The Points', [
    'In Play The Points you play the key games of your match yourself, shot by shot. The rest of the match plays out on its own.',
    'In this practice match every game is yours, against an opponent at about your level. Nothing here counts for your career.',
    'There are two ways to play: tap shot cards, or draw each shot with Swipes. You start with cards, then learn Swipes.',
    'When the match stops, it is your turn: pick a shot before the timer bar runs out. Tap ❚❚ Pause whenever you need a break.']],
  serve: ['🎾', 'Your Serve', ['Pick where to serve: out wide, into the body or down the T. Wide serves and serves down the T win more aces, but they are harder to land.']],
  hold: ['✊', 'Hold, Then Let Go', ['Serves are timed with the hold bar. Press and hold anywhere in the box (or hold Space). The bar only fills while you hold. Let go when it reaches the green.',
    'Green is perfect and grey is okay. Let go outside them and the serve is mistimed.']],
  ret: ['↩️', 'Returning', ['The line above your cards says what is coming, such as a big serve, or a second serve you can step in on. Pick the return that suits it.']],
  rally: ['🎯', 'Rally Shots', ['Each card is a shot you can play from where you are on court. The line above them shows whether you are in control (green) or under pressure (red).',
    'Going for winners under pressure is risky. Work the point until you are in control, then attack. If a card says "They\'re Reading This", you have played it too often.']],
  ring: ['⭕', 'Tap When The Rings Meet', ['Every shot apart from the serve is timed with the rings. Tap (or press Space) when the yellow ring sits inside the green.',
    'How well you hit it shows in the middle of the screen: Perfect, Okay or Mistimed. Better timing means better shots.']],
  swipeOn: ['✍️', 'Now Try Swipe Shots', [
    'Instead of tapping a card, you can draw your shot. Swipes is now switched on. The Cards / Swipes switch at the top of the screen changes it at any time.',
    'Draw a shape from the key under the box: Flat, Topspin, Slice, Lob or Drop. The first shape of each goes down the line, the second goes crosscourt. Finish your stroke where the arrow points.',
    'Turn the stroke further to angle the ball more, and draw a longer trail to hit deeper. If the trail turns red, that stroke sends the ball out: keep your finger still for a moment to cancel it, then draw again.',
    'If your strokes aren\'t read the way you draw them, tap ✍️ Set Up My Swipes and draw each shape your own way.',
    'Next, a quick drill: draw a few shots and see how each one is read.']],
  swserve: ['🎾', 'Swiping Your Serve', ['Swipe up from the bottom of the box towards where you want the serve to land: out wide, into the body or down the T. The key under the box shows the three directions.',
    'Wide serves and serves down the T win more aces, but they are harder to land.']],
};
// One tip, shown once in this tutorial; resolves when it's closed. Tips never stack on another open window.
function hoTutTip(key) {
  const st = hoTutState(), tip = HO_TUT_TIPS[key];
  if (!hoTutOn() || !tip || st.seen[key]) return Promise.resolve();
  st.seen[key] = 1; hoTutSave(st);
  const [icon, title, slides] = tip;
  return new Promise(done => {
    const show = i => {
      const last = i === slides.length - 1;
      openModal(`<div class="help welcome"><div class="helpicon">${icon}</div><div class="newtag">Tutorial</div><h2 class="itop">${title}</h2><p class="big">${slides[i]}</p>` +
        (slides.length > 1 ? `<div class="helpdots">${slides.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>` : '') +
        `<button type="button" class="btn huge" id="tuNext">${last ? 'Got It' : 'Next'}</button></div>`, { onClose: () => done() });
      $('tuNext').onclick = () => { if (last) closeModal(); else show(i + 1); };
    };
    show(0);
  });
}
// Before each choice: the right tip for this moment, and after a few card shots, Swipe Shots; then you're done.
async function hoTutBefore(stage) {
  const st = hoTutState(); if (!st) return;
  const serve = stage === 'serve' || stage === 'serve2';
  await hoTutTip('start');
  if (!serve && !st.seen.swipeOn && st.seen.ring && st.n >= 6) { try { localStorage.setItem(HO_SWIPE_KEY, '1'); } catch {} await hoTutTip('swipeOn'); await hoSwipeDrill(); }
  if (serve) await hoTutTip(hoSwipeOn() ? 'swserve' : 'serve');
  else await hoTutTip(stage === 'ret' ? 'ret' : 'rally');
  const s2 = hoTutState(); s2.n++; if (hoSwipeOn()) s2.ns = (s2.ns || 0) + 1; hoTutSave(s2);
  if (s2.seen.swipeOn && s2.seen.hold && s2.seen.ret && s2.ns >= 7 && !s2.seen.done) { s2.seen.done = 1; hoTutSave(s2); await hoTutDone(); }
}
function hoTutDone() {
  try { localStorage.setItem('tourlife.hoTutDone', '1'); } catch {}
  return new Promise(done => {
    openModal(`<div class="help welcome"><div class="helpicon">🏆</div><div class="newtag">Tutorial</div><h2 class="itop">You're Ready</h2>` +
      `<p class="big">That is everything. In your own matches, choose 🎮 Play The Points before the first ball, then Cards or Swipes, and you will play the key games yourself.</p>` +
      `<button type="button" class="btn huge" id="tuKeep">Keep Practising</button><button type="button" class="btn ghost" id="tuLeave">Leave The Tutorial</button></div>`, { onClose: () => done() });
    $('tuKeep').onclick = closeModal;
    $('tuLeave').onclick = () => hoTutLeave(true);
  });
}
// Start it: your player (as they are now) against a computer player of about your level, on a hard court.
function hoStartTutorial() {
  const base = readJSON(TL_NS + 'player'), career0 = readJSON(TL_NS + 'career'), fromTest = isTestMatch();
  // From an admin test match: that match is put aside and comes back when you leave the tutorial.
  if (fromTest) for (const k of ['player', 'career', 'entry']) { const v = localStorage.getItem('tourlife.test.' + k); if (v !== null) localStorage.setItem('tourlife.testbak.' + k, v); }
  if (!base || !career0) { toast('Make Your Player First', 'The tutorial uses your own player, so create one first.'); return; }
  const me = JSON.parse(JSON.stringify(base)), ovr = overall(me);
  Object.assign(me, { fatigue: 0, injury: null });
  const tier = Object.keys(TIERS).filter(t => t !== 'GS' && TIER_LEVEL[t]).sort((a, b) => Math.abs(TIERS[a].level - ovr) - Math.abs(TIERS[b].level - ovr))[0];
  const opp = generateOpponent(pick(Math.random, Object.keys(REGION_OF)), tier, Math.random, ovr - TIERS[tier].level);
  // About your level, a touch below: it's for learning.
  for (let n = 0; n < 6; n++) { const d = ovr - 1 - overall(opp); ATTR_KEYS.forEach(k => { opp.attrs[k] = Math.round(clamp(opp.attrs[k] + d, 20, 95)); }); }
  Object.assign(opp, { seed: null, isPlayer: false });
  const career = JSON.parse(JSON.stringify(career0));
  Object.assign(career, { injury: null, notice: null, offer: null, money: TEST_MONEY });
  const you = { name: me.name, nation: me.nation, attrs: { ...me.attrs }, temperament: me.temperament, fav: me.fav, worst: me.worst,
    hand: me.hand, backhand: me.backhand, plan: planOf(me), formSd: 0.02, seed: null, isPlayer: true, realStyle: me.realStyle, bhGap: me.bhGap };
  const id = 'tut' + Date.now();
  const ev = { id, city: 'Practice Court', name: 'Play The Points Tutorial', nation: me.nation, tier, surface: 'hard', indoor: false, weather: 'sunny', week: career.week || 1 };
  const entry = { id, test: true, tutorial: true, event: ev, entrants: [you, opp], rounds: [[{ a: 0, b: 1 }]], live: null, matches: [], result: null, plan: planOf(me), acclimated: true };
  for (const [k, v] of [['player', me], ['career', career], ['entry', entry]]) localStorage.setItem('tourlife.test.' + k, JSON.stringify(v));
  let swipe = null; try { swipe = localStorage.getItem(HO_SWIPE_KEY); localStorage.setItem(HO_SWIPE_KEY, '0'); } catch {}
  hoTutSave({ on: 1, seen: {}, n: 0, ns: 0, swipe, back: fromTest ? 'test' : 'career' });
  localStorage.setItem('tourlife.mode', 'test');
  location.hash = '';
  location.reload();
}
// Back to your own career (and your own Swipe Shots setting).
function hoTutLeave(finished) {
  const st = hoTutState() || {};
  try { if (st.swipe === null || st.swipe === undefined) localStorage.removeItem(HO_SWIPE_KEY); else localStorage.setItem(HO_SWIPE_KEY, st.swipe); } catch {}
  if (finished) try { localStorage.setItem('tourlife.hoTutDone', '1'); } catch {}
  for (const k of Object.keys(localStorage)) if (k.startsWith('tourlife.test.')) localStorage.removeItem(k);
  // Back to the admin test match it was started from, or to your career.
  const back = st.back === 'test' && localStorage.getItem('tourlife.testbak.entry');
  for (const k of Object.keys(localStorage)) if (k.startsWith('tourlife.testbak.')) { if (back) localStorage.setItem('tourlife.test.' + k.slice(17), localStorage.getItem(k)); localStorage.removeItem(k); }
  localStorage.setItem('tourlife.mode', back ? 'test' : 'player');
  location.hash = '';
  location.reload();
}
// Before your next match (once per device, on a computer or tablet): the tutorial, which you can't skip. Play The
// Points is new, and nobody should meet it for the first time in a match that counts.
const hoTutNeeded = () => { try { return playPointsOn() && !hoTutOn() && !localStorage.getItem('tourlife.hoTutDone') && !(typeof isCoachMode === 'function' && isCoachMode()); } catch { return false; } };
function hoTutRequired() {
  openModal(`<div class="help welcome"><div class="helpicon">🎓</div><div class="newtag">New</div><h2 class="itop">Before Your Next Match</h2>` +
    `<p class="big">There is a new way to play: Play The Points. You play the key games yourself, shot by shot, by tapping shot cards or by drawing each shot.</p>` +
    `<p>A short practice match with your own player shows you how it all works. It doesn't count for your career, and this match will wait for you.</p>` +
    `<button type="button" class="btn huge" id="tuGo">🎓 Start The Tutorial</button></div>`);
  $('tuGo').onclick = () => { closeModal(); hoStartTutorial(); };
}
// Picking Play The Points: cards or swipes, two different ways to play (you can switch during the match).
function hoPlayAs(play) {
  openModal(`<div class="help welcome"><div class="helpicon">🎮</div><h2 class="itop">How Do You Want To Play The Points?</h2>` +
    `<div class="playas"><button type="button" class="btn huge" data-as="0"><span>🃏</span><b>Cards</b><small>Tap a shot card, then time your shot.</small></button>` +
    `<button type="button" class="btn huge" data-as="1"><span>✍️</span><b>Swipes</b><small>Draw each shot with your finger or mouse, then time it.</small></button></div></div>`);
  $('sheet').querySelectorAll('[data-as]').forEach(b => { b.onclick = () => { try { localStorage.setItem(HO_SWIPE_KEY, b.dataset.as); } catch {} closeModal(); play(); }; });
}

// The tutorial's swipe drill: draw the shot it asks for, on the forehand, and see how it's read. Close enough
// counts: the right shot, and on the right side of halfway between down the line and crosscourt.
const HO_DRILL = [['flat', 'fwd'], ['topspin', 'cross'], ['slice', 'fwd'], ['lob', 'cross'], ['drop', 'fwd'], ['flat', 'cross']];
const hoShapeSvg = (w, t, d, lefty) => { const own = SG_NORM[`${w}.${t}.${d}`], P = own && own.own ? own[0] : SG_SHAPES[w][t][d];
  const N = sgNorm(P, 24).map(p => ({ x: 20 + (lefty ? -p.x : p.x) * 30, y: 20 + p.y * 30 }));
  return `<svg viewBox="0 0 40 40"><path d="M${N.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')} ${hoArrowHead(N[N.length - 1], N[N.length - 4])}"/></svg>`; };
function hoSwipeDrill() {
  const lefty = ((readJSON(TL_NS + 'player') || {}).hand || 'right') === 'left';
  const NAME = { flat: 'Flat', topspin: 'Topspin', slice: 'Slice', lob: 'Lob', drop: 'Drop Shot' };
  const out = k => k > 1.93 || k < -0.92; // past the sideline (see hoSwipeAim)
  let i = 0, tries = 0, eng = null, trail = null;
  return new Promise(done => {
    const stop = () => { if (eng) { eng.detach(); eng = null; } };
    const step = () => {
      stop();
      if (i >= HO_DRILL.length) {
        $('sheet').querySelector('.sgsetup').innerHTML = `<p class="big">Well drawn. Now play some points with Swipes: draw your shot, then time it with the rings as before.</p><button type="button" class="btn huge" id="drDone">Back To The Match</button>`;
        $('drDone').onclick = closeModal; return;
      }
      const [t, d] = HO_DRILL[i];
      $('sheet').querySelector('.sgsetup').innerHTML = `<p class="sgstep">Swipe Drill · ${i + 1} Of ${HO_DRILL.length}</p>` +
        `<div class="sgwant"><div class="sgguide one"><span>${hoShapeSvg('fh', t, d, lefty)}<i>${d === 'fwd' ? '↑' : lefty ? '↗' : '↖'}</i></span></div>` +
        `<b>${NAME[t]} · ${d === 'fwd' ? 'Down The Line' : 'Crosscourt'}</b></div>` +
        `<p class="hint">Draw this shape, finishing where the arrow points. It doesn't have to be perfect: close enough counts.</p>` +
        `<div class="sgpad ${lefty ? 'bl' : 'br'}" id="drPad">${HO_RACKET}<span class="sgball">🎾</span><div class="sglive" id="drOut">Draw Here</div></div>` +
        (tries >= 2 ? `<button type="button" class="btn small ghost" id="drSkip">Skip This One</button>` : '');
      if ($('drSkip')) $('drSkip').onclick = () => { i++; tries = 0; step(); };
      const el = $('drPad'); trail = new SwipeTrail(el);
      eng = new StrokeGestureEngine(el, {
        move: (g, pts) => trail.set(pts, g && g.len >= 0.2 && !g.unclear && out(g.cross) ? '#ff3b30' : '#f5f5f7'),
        cancel: () => trail.set([]),
        commit: (g, pts) => {
          const dir = g.cross >= 0.5 ? 'Crosscourt' : 'Down The Line', isOut = out(g.cross);
          const said = g.unclear ? 'Not A Clear Shot' : `${SG_TYPES[g.base].label} · ${dir}${isOut ? ' (Out Wide)' : ''}`;
          const ok = !g.unclear && g.base === t && (d === 'fwd' ? g.cross < 0.5 : g.cross >= 0.5);
          trail.set(pts, ok ? '#3dff6e' : '#ff3b30'); trail.done();
          $('drOut').textContent = ok ? `✅ ${said}` : `That read as: ${said}. Try again.`;
          $('drOut').classList.toggle('out', !ok);
          if (ok) { i++; tries = 0; setTimeout(step, 900); } else { tries++; if (tries === 2) setTimeout(step, 1200); }
        },
      }, { wing: 'fh', lefty }).attach();
    };
    openModal(`<h2 class="itop">✍️ Swipe Drill</h2><div class="sgsetup"></div>`, { onClose: () => { stop(); done(); } });
    step();
  });
}
