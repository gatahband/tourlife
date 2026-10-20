// weather.js — conditions for each tournament week, from the venue's climate and the time of year.
// Weather shifts who it suits (by playstyle, serve, spin and fitness), how the ball behaves on court,
// and how tiring it is. Indoor events have no weather.

const WEATHER = {
  sunny:  { icon: '☀️', name: 'Sunny and mild', desc: 'Perfect tennis weather. Nothing to adjust for.' },
  hot:    { icon: '🔥', name: 'Hot and dry', desc: 'The ball flies through the air and jumps off the court. Big servers and flat hitters love it; long rallies drain everyone.' },
  humid:  { icon: '💧', name: 'Hot and humid', desc: 'Heavy, sticky air: the ball slows down and stays low. Big serves lose their bite, grinders thrive, and fitness gets tested.' },
  windy:  { icon: '💨', name: 'Windy', desc: 'Gusts push the ball around. Flat hitters and big servers miss more; margin, slice and touch win out.' },
  damp:   { icon: '🌧️', name: 'Damp after rain', desc: 'A heavy, wet court. On clay the ball dies and rallies drag on: power is blunted and clay-courters dig in. On grass it skids and slips.' },
  cold:   { icon: '🥶', name: 'Cold', desc: 'Cold, dead balls are hard to hit through. Topspin bites less and patience pays.' },
  indoor: { icon: '🏟️', name: 'Indoors', desc: 'No weather: true bounces, no wind.' },
};

// How each condition shifts a player's points (added to their chance, + = helps them).
// fam: by playstyle family; serve: per point of serve above 55; stam: per point of stamina above 55;
// spin: by spin plan. ball: on-court pace and bounce; heat: how tiring; rally/ace/ue: how points look.
const WX_EFFECT = {
  sunny:  { fam: {}, serve: 0, stam: 0, spin: {}, pace: 1, bounce: 1, heat: 1, rally: 1, ace: 1, ue: 0 },
  hot:    { fam: { attack: 0.008, net: 0.003, defend: -0.006 }, serve: 0.0012, stam: 0.0008, spin: { flat: 0.004 }, pace: 1.06, bounce: 1.08, heat: 1.5, rally: 0.9, ace: 1.15, ue: 0 },
  humid:  { fam: { attack: -0.01, net: -0.004, defend: 0.008, craft: 0.002 }, serve: -0.0012, stam: 0.001, spin: { topspin: 0.004, flat: -0.003 }, pace: 0.93, bounce: 0.92, heat: 1.7, rally: 1.15, ace: 0.85, ue: 0.02 },
  windy:  { fam: { attack: -0.01, net: -0.004, craft: 0.01, defend: 0.003 }, serve: -0.0008, stam: 0, spin: { flat: -0.008, topspin: 0.004 }, pace: 1, bounce: 1, heat: 1, rally: 1, ace: 0.8, ue: 0.08 },
  damp:   { fam: { attack: -0.008, defend: 0.008 }, serve: -0.001, stam: 0.0004, spin: { topspin: 0.003 }, pace: 0.92, bounce: 0.85, heat: 1.1, rally: 1.2, ace: 0.9, ue: 0.02 },
  cold:   { fam: { attack: -0.004, defend: 0.004 }, serve: -0.0005, stam: 0, spin: { topspin: -0.004 }, pace: 0.95, bounce: 0.9, heat: 0.9, rally: 1.05, ace: 0.95, ue: 0.01 },
  indoor: { fam: {}, serve: 0, stam: 0, spin: {}, pace: 1, bounce: 1, heat: 1, rally: 1, ace: 1, ue: 0 },
};
// Damp clay is much heavier; damp grass skids low and helps the net player.
const WX_SURFACE = { damp: { clay: { fam: { attack: -0.014, defend: 0.012, net: -0.006 }, pace: 0.86, bounce: 0.8, rally: 1.3 },
  grass: { fam: { net: 0.008, attack: 0.004, defend: -0.004 }, pace: 1.02, bounce: 0.8, rally: 0.9 } } };

// Altitude (metres) of the high venues: thin air, so the ball flies further and faster.
const ALTITUDE = { Bogota: 2640, 'Bogotá': 2640, Quito: 2850, 'Mexico City': 2240, Johannesburg: 1750, Gstaad: 1050, Kitzbuhel: 760, 'Kitzbühel': 760,
  Bucaramanga: 960, Bengaluru: 920, Curitiba: 935, Madrid: 650, Sofia: 550, Santiago: 570 };
const altitudeOf = ev => (ev && ALTITUDE[ev.city]) || 0;
const highAltitude = ev => altitudeOf(ev) >= 900;
const wxOf = ev => {
  const id = ev && ev.weather;
  let e = !id || !WX_EFFECT[id] ? WX_EFFECT.sunny : (WX_SURFACE[id] || {})[ev.surface] ? { ...WX_EFFECT[id], ...WX_SURFACE[id][ev.surface] } : WX_EFFECT[id];
  // High altitude: livelier ball (more aces and winners, shorter rallies), on top of the weather.
  const a = Math.max(0, Math.min(1, (altitudeOf(ev) - 500) / 2000));
  if (a > 0) e = { ...e, fam: { ...e.fam, attack: (e.fam.attack || 0) + 0.006 * a, defend: (e.fam.defend || 0) - 0.005 * a },
    serve: e.serve + 0.0008 * a, pace: e.pace * (1 + 0.08 * a), bounce: e.bounce * (1 + 0.06 * a), ace: e.ace * (1 + 0.25 * a), rally: e.rally * (1 - 0.12 * a) };
  return e;
};

// --- Climate ---------------------------------------------------------------------------
const SOUTH = new Set(['AUS', 'ARG', 'CHI', 'BRA', 'RSA', 'URU']);
const HUMID = new Set(['IND', 'CHN', 'JPN', 'KOR', 'MEX', 'COL', 'BRA', 'NGA', 'USA', 'AUS']);
const DRY = new Set(['EGY', 'MAR', 'TUN', 'ESP', 'GRE', 'TUR', 'KAZ', 'CHI', 'MEX', 'POR', 'ITA']);
const WET = new Set(['GBR', 'NED', 'BEL', 'DEN', 'NOR', 'SWE', 'FIN', 'GER', 'FRA', 'SUI', 'AUT', 'POL', 'CZE']);
const TROPICAL = new Set(['MEX', 'COL', 'BRA', 'IND', 'NGA', 'EGY', 'MAR', 'TUN']); // never cold
const WINDY = new Set(['AUS', 'GBR', 'NED', 'DEN', 'USA', 'CHI', 'ARG', 'POR', 'RSA']);

// Conditions change during the week: each day (round) keeps yesterday's weather about half the time,
// otherwise it's rolled again from the venue's climate. Day 0 is the forecast the event opens with.
function dayWeather(ev, day) {
  if (!ev || ev.indoor) return 'indoor';
  let w = ev.weather || weatherFor(ev);
  for (let d = 1; d <= day; d++) {
    let h = 2166136261;
    for (const ch of `${ev.id || ev.city}#${d}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    if (h % 100 >= 50) w = weatherFor({ ...ev, id: `${ev.id || ev.city}#${d}` });
  }
  return w;
}

function weatherFor(ev) {
  if (!ev || ev.indoor) return 'indoor';
  // The week comes from the event id ("s1w23-...").
  const wk = ev.week ? weekInSeason(ev.week) : +((String(ev.id).match(/w(\d+)-/) || [0, 1])[1]), n = ev.nation;
  // Hot months: northern summer (weeks 22–36), southern summer (weeks 48–10).
  const hotSeason = SOUTH.has(n) ? (wk >= 48 || wk <= 10) : (wk >= 22 && wk <= 36);
  const coldSeason = SOUTH.has(n) ? (wk >= 22 && wk <= 34) : (wk <= 10 || wk >= 44);
  const w = { sunny: 4, hot: 0, humid: 0, windy: 1.5, damp: 1, cold: 0 };
  if (hotSeason) { w.hot += 3 + (DRY.has(n) ? 2 : 0); if (HUMID.has(n)) w.humid += 4; }
  if (WINDY.has(n)) w.windy += 1.5;
  if (WET.has(n) && !hotSeason) w.damp += 2;
  if (ev.surface === 'clay' && wk >= 14 && wk <= 24) w.damp += 1; // spring clay swing showers
  if (coldSeason && !TROPICAL.has(n)) w.cold += 2 + (WET.has(n) ? 1 : 0);
  // The same event always has the same weather (rolled from its id).
  let h = 2166136261;
  for (const ch of String(ev.id || ev.city)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  let roll = (h % 10000) / 10000 * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(w)) { if ((roll -= v) < 0) return k; }
  return 'sunny';
}

// --- Effects ----------------------------------------------------------------------------

// Weather tilts matches without deciding them (an even match in conditions that suit one player
// becomes roughly 60/40).
const WX_SCALE = 0.35;

// The change to a player's chance of winning a point in these conditions.
function wxEdge(p, style, ev) {
  const e = wxOf(ev);
  if (e === WX_EFFECT.sunny || e === WX_EFFECT.indoor) return 0; // (altitude makes a fresh object, so it counts)
  const pl = planOf(p);
  return WX_SCALE * ((e.fam[famOf(style)] || 0) + e.serve * (p.attrs.serve - 55) + e.stam * (p.attrs.stam - 55) + (e.spin[pl.spin] || 0));
}

const wxLabel = ev => { const k = ev && ev.weather; return (k && WEATHER[k] ? `${WEATHER[k].icon} ${WEATHER[k].name}` : '') + (highAltitude(ev) ? ` · ⛰️ ${altitudeOf(ev).toLocaleString('en-US')} m altitude` : ''); };
// How fast the court plays today: surface, weather and altitude together.
const SURF_PACE = { clay: 0.94, hard: 1, grass: 1.06 };
const courtSpeed = ev => { const v = (ev.indoor ? 1.04 : SURF_PACE[ev.surface] || 1) * wxOf(ev).pace; return v < 0.93 ? 'Slow' : v < 0.99 ? 'Medium-slow' : v < 1.04 ? 'Medium' : v < 1.09 ? 'Medium-fast' : 'Fast'; };

// Draw screen: the conditions and who they suit.
function weatherHtml(ev, me, opp) {
  const k = ev.weather;
  if (!k || !WEATHER[k] || k === 'sunny' || k === 'indoor') return k && WEATHER[k] ? `<p class="wxline">${wxLabel(ev)} · ${WEATHER[k].desc}</p>` : '';
  const sm = styleOf(me).name, so = styleOf(opp).name;
  const a = wxEdge(me, sm, ev), b = wxEdge(opp, so, ev);
  const pct = x => `${x >= 0 ? '+' : '−'}${(Math.abs(x) * 100).toFixed(1)}%`;
  const verdict = a - b > 0.004 ? '<span class="wxv up">Suits you</span>' : b - a > 0.004 ? '<span class="wxv down">Suits them</span>' : '<span class="wxv">Even</span>';
  return `<div class="wxbox"><div class="wxtop"><b>${wxLabel(ev)}</b>${verdict}</div><p class="hint">${WEATHER[k].desc}</p>` +
    `<div class="wxnums"><span>Your ${sm} game <b class="${a >= 0 ? 'up' : 'down'}">${pct(a)}</b></span><span>Their ${so} game <b class="${b >= 0 ? 'up' : 'down'}">${pct(b)}</b></span></div>` +
    `${WX_EFFECT[k].heat > 1.2 ? '<p class="hint">🥵 The heat will tire you faster.</p>' : ''}</div>`;
}
