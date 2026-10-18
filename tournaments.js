// tournaments.js — tournament options, field nationality mix, career state, and the home/draw/match screens

const ENTRY_KEY = 'tourlife.entry';
const CAREER_KEY = 'tourlife.career';
const FIELD_SIZE = 32;

const REGIONS = {
  europe:   ['AUT','BEL','BUL','CRO','CZE','DEN','ESP','FIN','FRA','GBR','GER','GRE','HUN','ITA','NED','NOR','POL','POR','SRB','SUI','SWE','TUR'],
  americas: ['ARG','BRA','CAN','CHI','COL','MEX','USA'],
  africa:   ['EGY','MAR','NGA','RSA','TUN'],
  asia:     ['AUS','CHN','IND','JPN','KAZ','KOR'],
};
const REGION_OF = Object.fromEntries(
  Object.entries(REGIONS).flatMap(([r, list]) => list.map(c => [c, r])));

// How often each nation turns up at ITF events abroad (default 1).
const TRAVEL_WEIGHT = {
  ESP: 6, FRA: 6, ITA: 6, USA: 5, ARG: 5, GER: 4, GBR: 3, AUS: 3, BRA: 3, JPN: 3,
  CZE: 2, SRB: 2, CRO: 2, NED: 2, BEL: 2, SUI: 2, POL: 2, POR: 2, CHI: 2, COL: 2, KOR: 2, IND: 2, CHN: 2, KAZ: 2,
};

// Host nation is the majority of the field; then the host's region; the rest are international.
const HOME_SHARE = 0.55, REGION_SHARE = 0.2;

// Events repeat in a 3-week cycle until the full calendar arrives.
const EVENTS = [
  { id: 'w1-monastir',  week: 1, tier: 'M15', city: 'Monastir',          nation: 'TUN', surface: 'hard' },
  { id: 'w1-cairo',     week: 1, tier: 'M15', city: 'Cairo',             nation: 'EGY', surface: 'clay' },
  { id: 'w1-madrid',    week: 1, tier: 'M25', city: 'Madrid',            nation: 'ESP', surface: 'clay' },
  { id: 'w1-antalya',   week: 1, tier: 'M15', city: 'Antalya',           nation: 'TUR', surface: 'clay' },
  { id: 'w2-sharm',     week: 2, tier: 'M15', city: 'Sharm El Sheikh',   nation: 'EGY', surface: 'hard' },
  { id: 'w2-pula',      week: 2, tier: 'M25', city: 'Santa Margherita di Pula', nation: 'ITA', surface: 'clay' },
  { id: 'w2-rsf',       week: 2, tier: 'M15', city: 'Rancho Santa Fe',   nation: 'USA', surface: 'hard' },
  { id: 'w2-nottingham',week: 2, tier: 'M25', city: 'Nottingham',        nation: 'GBR', surface: 'grass' },
  { id: 'w3-hammamet',  week: 3, tier: 'M15', city: 'Hammamet',          nation: 'TUN', surface: 'clay' },
  { id: 'w3-oslo',      week: 3, tier: 'M15', city: 'Oslo',              nation: 'NOR', surface: 'hard', indoor: true },
  { id: 'w3-bucaramanga',week: 3, tier: 'M25', city: 'Bucaramanga',      nation: 'COL', surface: 'clay' },
  { id: 'w3-shymkent',  week: 3, tier: 'M25', city: 'Shymkent',          nation: 'KAZ', surface: 'clay' },
];

const PRIZE = Object.fromEntries(Object.entries(TIERS).map(([k, t]) => [k, t.prize]));
const tierLabel = t => (TIERS[t] || { label: t }).label;

function weightedPick(list, rng) {
  const total = list.reduce((a, c) => a + (TRAVEL_WEIGHT[c] || 1), 0);
  let r = rng() * total;
  for (const c of list) if ((r -= TRAVEL_WEIGHT[c] || 1) < 0) return c;
  return list[list.length - 1];
}

// Nationalities of the other 31 entrants: host-nation majority, regional neighbours, then the world.
function generateField(event, rng = Math.random) {
  const n = FIELD_SIZE - 1;
  // Bigger events draw a more international field.
  const tier = TIERS[event.tier] || {};
  const home = Math.round(n * (tier.home ?? HOME_SHARE));
  const regional = Math.round(n * (event.tier === 'M15' || event.tier === 'M25' ? REGION_SHARE : 0.15));
  const neighbours = REGIONS[REGION_OF[event.nation]].filter(c => c !== event.nation);
  const world = Object.keys(REGION_OF).filter(c => c !== event.nation);
  const field = [
    ...Array(home).fill(event.nation),
    ...Array.from({ length: regional }, () => weightedPick(neighbours, rng)),
    ...Array.from({ length: n - home - regional }, () => weightedPick(world, rng)),
  ];
  for (let i = field.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [field[i], field[j]] = [field[j], field[i]];
  }
  return field;
}

const nationInfo = code => NATIONS.find(([c]) => c === code) || EXTRA_NATIONS.find(([c]) => c === code) || [code, '🏳️', code];
const flagOf = code => nationInfo(code)[1];
const surfaceLabel = v => SURFACES.find(([s]) => s === v)[1];
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

function fieldSummary(nations) {
  const counts = {};
  for (const c of nations) counts[c] = (counts[c] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const shown = sorted.slice(0, 5).map(([c, k]) => `${flagOf(c)} ${k}`);
  const rest = sorted.slice(5).reduce((a, [, k]) => a + k, 0);
  return shown.join(' · ') + (rest ? ` · +${rest} from ${sorted.length - 5} more nations` : '');
}

function surfaceFit(player, ev) {
  if (ev.surface === player.fav) return '<span class="fit good">Favorite surface</span>';
  if (ev.surface === player.worst) return '<span class="fit bad">Worst surface</span>';
  return '';
}

// --- Storage ---------------------------------------------------------------

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function writeJSON(key, val) {
  try { val === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(val)); }
  catch { window.saveFailed = true; } // usually storage full: Home shows a warning
}

function loadCareer() {
  return { week: 1, points: 0, wins: 0, losses: 0, titles: [], history: [], ...readJSON(CAREER_KEY) };
}

// Entries saved before the draw existed only held nationalities; drop them.
function loadEntry() {
  const e = readJSON(ENTRY_KEY);
  return e && e.entrants ? e : null;
}

let current = { player: null, career: null, entry: null, tab: 0 };

function showScreen(name) {
  for (const id of ['creator', 'home', 'draw', 'match', 'review', 'train', 'admin']) $(id).hidden = id !== name;
  window.scrollTo(0, 0);
  if (typeof screenTips === 'function' && name !== 'admin') screenTips(name);
}

// --- Saved careers -----------------------------------------------------------
// The live career uses the three keys above. Other careers wait in SAVES_KEY until you switch to them.

const SAVES_KEY = 'tourlife.saves';
const loadSaves = () => readJSON(SAVES_KEY) || [];

// Moves the live career into the saved list (if there is one).
function shelveLive() {
  const player = readJSON(SAVE_KEY);
  if (!player) return;
  const id = player.created || Date.now();
  const saves = loadSaves().filter(x => x.id !== id);
  saves.push({ id, player: { ...player, created: id }, career: readJSON(CAREER_KEY), entry: readJSON(ENTRY_KEY), savedAt: Date.now() });
  writeJSON(SAVES_KEY, saves);
  for (const k of [SAVE_KEY, CAREER_KEY, ENTRY_KEY]) writeJSON(k, null);
}

function newCareer() {
  shelveLive();
  location.reload();
}

function switchCareer(id) {
  shelveLive();
  const saves = loadSaves();
  const slot = saves.find(x => x.id === id);
  if (!slot) return;
  writeJSON(SAVE_KEY, slot.player);
  writeJSON(CAREER_KEY, slot.career);
  writeJSON(ENTRY_KEY, slot.entry);
  writeJSON(SAVES_KEY, saves.filter(x => x.id !== id));
  location.reload();
}

function deleteSave(id) {
  writeJSON(SAVES_KEY, loadSaves().filter(x => x.id !== id));
}

// List of saved careers with Load / Delete. Used on the create screen and in the Switch Career window.
function savesHtml() {
  const saves = loadSaves().sort((a, b) => b.savedAt - a.savedAt);
  if (!saves.length) return '<p class="hint">No other saved careers yet.</p>';
  return saves.map(sv => {
    const p = sv.player, c = { week: 1, points: 0, wins: 0, losses: 0, titles: [], ...sv.career };
    const t = TEMPERAMENTS[p.temperament];
    return `<div class="slot"><div class="smain"><b>${flagOf(p.nation)} ${esc(p.name)}</b>` +
      `<small>${t.emoji} ${t.name} · Week ${c.week} · ${c.points} pts · ${c.wins}–${c.losses}${c.titles.length ? ` · 🏆 ${c.titles.length}` : ''}</small></div>` +
      `<button type="button" class="btn small" data-load="${sv.id}">Load</button>` +
      `<button type="button" class="x inline" data-del="${sv.id}" aria-label="Delete">×</button></div>`;
  }).join('');
}

function bindSaves(box, rerender) {
  box.onclick = e => {
    const l = e.target.closest('[data-load]'), d = e.target.closest('[data-del]');
    if (l) switchCareer(+l.dataset.load);
    if (d && confirm('Delete this saved career for good?')) { deleteSave(+d.dataset.del); rerender(); }
  };
}

function openSwitcher() {
  const draw = () => {
    openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
      `<h2 class="itop">Your careers</h2>` +
      `<p class="hint center">Your current career is saved automatically when you switch or start a new one.</p>` +
      `<div id="slotList" class="slots">${savesHtml()}</div>` +
      `<button type="button" class="btn" id="slotNew">Start a new career</button>`);
    bindSaves($('slotList'), draw);
    $('slotNew').onclick = newCareer;
    $('mx').onclick = closeModal;
  };
  draw();
}

// --- Home ------------------------------------------------------------------

function renderTournaments(player) {
  current.player = player;
  current.career = loadCareer();
  current.entry = loadEntry();
  const c = current.career;
  ensureCareer(c, player);

  // Live totals: past events plus the one in progress (points for the round already reached).
  const e = current.entry;
  const eWins = e ? e.matches.filter(x => x.won).length : 0;
  const eLosses = e ? e.matches.length - eWins : 0;
  const mainWins = e ? e.matches.filter(x => x.won && !String(x.round).startsWith('Q')).length : 0;
  const ePoints = !e ? 0 : e.result ? e.result.points
    : e.qual && !e.qual.done ? 0 : POINTS[eventOf(e).tier][mainWins] + (e.qualified ? TIERS[eventOf(e).tier].qPoints || 0 : 0);
  const pts = rankingPoints(c, e && !e.result ? ePoints : 0), rank = rankFromPoints(pts);
  $('hStats').innerHTML = [
    [`${monthOf(c.week)} · S${seasonOfWeek(c.week)}`, `W${weekInSeason(c.week)}`], ['Ranking', rankText(rank)], ['Won–Lost', `${c.wins + eWins}–${c.losses + eLosses}`], ['Titles', c.titles.length], ['Money', money(c.money)],
  ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
  // Ranking line: points (last 52 weeks, best 18), best ranking, weekly move, points about to drop.
  const move = c.lastRank && rank ? c.lastRank - rank : 0;
  const exp = pointsExpiring(c);
  $('hRank').innerHTML = `<b>${pts}</b> ranking pts` +
    (move ? ` · <span class="${move > 0 ? 'up' : 'down'}">${move > 0 ? '▲' : '▼'} ${Math.abs(move)}</span> this week` : '') +
    (c.bestRank ? ` · Career high #${c.bestRank}` : '') +
    (exp ? ` · ${exp} pts dropping off soon` : '') +
    `<br><small>Counts your best ${COUNT_BEST} results from the last 52 weeks. Challengers need about #${TIERS.CH75.qual} for qualifying; ATP events about #${TIERS.ATP250.qual}.</small>`;

  $('edit').hidden = c.history.length > 0 || !!current.entry;
  renderHistory();
  player.plan = planOf(player);
  planEditor($('hPlan'), player.plan, () => savePlan(player));
  $('hStatsBtn').onclick = () => openPlayerStats();
  $('units').innerHTML = [['mph', 'mph'], ['kmh', 'km/h']].map(([v, l]) =>
    `<button type="button" data-v="${v}" class="${speedUnit() === v ? 'on' : ''}">${l}</button>`).join('');
  $('units').onclick = e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    writeJSON(UNITS_KEY, b.dataset.v);
    $('units').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  };
  // Playstyle card: tap to open the full build (same meters as the creator).
  const ranked = detectStyles(player.attrs, player.fav);
  $('cStyle').textContent = ranked[0].name;
  $('hTopFill').style.width = `${Math.round(ranked[0].score * 100)}%`;
  $('hTopDesc').textContent = ranked[0].desc;
  $('hAttrs').innerHTML = ATTRS.map(([k, label]) => {
    const v = player.attrs[k] ?? 50;
    return `<div class="attr"><div class="lbl">${label}<b>${v.toFixed(2)}</b></div><div class="abar"><div style="width:${clamp(v, 0, 100)}%"></div></div></div>`;
  }).join('');
  $('hStyles').innerHTML = ranked.map((s, i) => {
    const pct = Math.round(s.score * 100);
    return `<li class="${i === 0 ? 'best' : ''}"><span>${s.name}</span><div class="bar"><div style="width:${pct}%"></div></div><span>${pct}%</span></li>`;
  }).join('');
  $('hStyleBox').ontoggle = () => { $('hStyleBox').querySelector('.chev').textContent = $('hStyleBox').open ? 'Hide my build' : 'Show my build'; };

  renderOvr(player);
  renderRivals(c);
  renderBadges(c);
  if (renderCareerBits(c, player)) return;
  if (!c.seed) { c.seed = Math.floor(Math.random() * 1e6) + 1; writeJSON(CAREER_KEY, c); }
  const box = $('events');
  // Mid-week downtime (after a tournament): carry on with the training days.
  if (c.downtime && !current.entry) {
    $('eventsTitle').textContent = `Week ${weekInSeason(c.week)} · ${monthOf(c.week)} — Rest of the week`;
    box.innerHTML = `<div class="event entered row-ev"><div><div class="ev-city">${c.downtime.days - (c.downtime.used || 0)} free day${c.downtime.days - (c.downtime.used || 0) === 1 ? '' : 's'} left this week</div>` +
      `<div class="ev-meta">Train, travel early to next week's event, or rest.</div></div>` +
      `<button type="button" class="btn small" id="toTrain">Plan the days</button></div>`;
    $('toTrain').onclick = () => openTraining();
    return;
  }
  if (current.entry) {
    const ev = eventOf(current.entry);
    $('eventsTitle').textContent = 'This Week';
    box.innerHTML =
      `<div class="event entered row-ev"><div>` +
        `<div class="ev-top"><span class="tier">${tierLabel(ev.tier)}</span><span class="ev-week">In progress</span></div>` +
        `<div class="ev-city">${flagOf(ev.nation)} ${ev.city}, ${nationInfo(ev.nation)[2]}</div>` +
        `<div class="ev-meta">${surfaceLabel(ev.surface)}${ev.indoor ? ' · Indoor' : ''} · ${PRIZE[ev.tier]}${ev.weather ? ` · ${wxLabel(ev)}` : ''}</div>` +
      `</div><button type="button" class="btn small" id="toDraw">Go to draw</button></div>`;
    $('toDraw').onclick = () => openDraw();
    return;
  }

  const wk = weekInSeason(c.week);
  if (isOffSeason(c.week)) {
    $('eventsTitle').textContent = `Week ${wk} · ${monthOf(c.week)} — Off-season`;
    box.innerHTML = `<div class="event row-ev"><div><div class="ev-city">No tournaments until the new season</div>` +
      `<div class="ev-meta">A full training week: six days to work on your game.</div></div>` +
      `<button type="button" class="btn small" id="trainWeek">Train this week</button></div>`;
    $('trainWeek').onclick = () => startDowntime(6, current.player.nation, 'Off-season block');
    return;
  }
  // This week's events, or a look at next week's to plan ahead.
  const next = homeWeekTab === 'next';
  const wkShown = next ? c.week + 1 : c.week;
  const evs = isOffSeason(wkShown) ? [] : weekEvents(wkShown, c.seed);
  $('eventsTitle').innerHTML = `<span>Week ${weekInSeason(wkShown)} · ${monthOf(wkShown)} · Season ${seasonOfWeek(wkShown)} — ${next ? 'Coming next week' : 'Pick a Tournament'}</span>` +
    `<span class="seg two wktabs"><button type="button" data-wk="this" class="${next ? '' : 'on'}">This week</button><button type="button" data-wk="next" class="${next ? 'on' : ''}">Next week</button></span>`;
  box.innerHTML = (evs.length ? evs.map(e =>
    `<div class="event" data-ev="${e.id}"><div class="row-ev"><div>` +
      `<div class="ev-top"><span class="tier">${tierLabel(e.tier)}</span>${surfaceFit(player, e)}</div>` +
      `<div class="ev-city">${flagOf(e.nation)} ${e.city}, ${nationInfo(e.nation)[2]}</div>` +
      `<div class="ev-meta">${surfaceLabel(e.surface)}${e.indoor ? ' · Indoor' : ''} · ${PRIZE[e.tier]} · ${wxLabel({ ...e, weather: weatherFor(e) })}</div>` +
    `</div>${next ? `<button type="button" class="btn small ghost" data-look="${e.id}">Preview</button>` : entryButton(e, rank)}</div>` +
    `<div class="evpanel" hidden></div></div>`
  ).join('') : `<p class="hint">${next ? 'Next week is the off-season: no events.' : 'No events this week.'}</p>`) +
    (next ? '<p class="hint">You can travel early to one of these from your free days after this week\'s event, for bigger practice gains and a comfort boost.</p>'
      : `<button type="button" class="link" id="trainWeek">Skip the tournaments and take a training week</button>`);
  $('eventsTitle').querySelector('.wktabs').onclick = e => { const b = e.target.closest('[data-wk]'); if (b) { homeWeekTab = b.dataset.wk; renderTournaments(player); } };
  // Enter / Qualifying / Preview open a panel with your chances; the panel's button confirms.
  box.onclick = e => {
    const conf = e.target.closest('[data-confirm]');
    if (conf) {
      const ev = evs.find(x => x.id === conf.dataset.confirm), md = conf.dataset.mode;
      if (md === 'wc') { c.perks.wildcards--; writeJSON(CAREER_KEY, c); }
      enterEvent(ev, false, md === 'wc' ? 'main' : md); return;
    }
    if (e.target.closest('[data-close]')) { const pnl = e.target.closest('.evpanel'); pnl.hidden = true; return; }
    const b = e.target.closest('[data-enter],[data-look]');
    if (!b) return;
    const card = b.closest('.event'), pnl = card.querySelector('.evpanel');
    if (!pnl.hidden) { pnl.hidden = true; return; }
    box.querySelectorAll('.evpanel').forEach(x => { x.hidden = true; });
    const ev = evs.find(x => x.id === (b.dataset.enter || b.dataset.look));
    pnl.hidden = false;
    pnl.innerHTML = '<p class="hint">Working out your chances…</p>';
    setTimeout(() => { pnl.innerHTML = eventPreview(ev, b.dataset.mode || eligibility(ev, rank), !next); }, 30);
  };
  if ($('trainWeek')) $('trainWeek').onclick = () => startDowntime(6, c.location || current.player.nation, 'Training week');
}

// Your default plan (Home). Each tournament starts with a copy of it, which you can change for that week.
function savePlan(player) {
  writeJSON(SAVE_KEY, player);
}

function eventPlan(entry) {
  if (!entry.plan) entry.plan = planOf(entry.entrants[0]);
  return entry.plan;
}

function saveEventPlan(entry) {
  entry.entrants[0].plan = { ...entry.plan };
  writeJSON(ENTRY_KEY, entry);
}

let homeWeekTab = 'this';

// Your chances at an event: simulated matches against fields of this level, on this surface, in these
// conditions (later rounds against stronger players), plus a few plain-English notes.
// Simulated chances at an event: matches against fields of its level, on its surface and in its
// conditions, with later rounds against stronger players (tour events climb faster: real top-100s).
function meEntrant(p) {
  return { name: p.name, nation: p.nation, attrs: { ...p.attrs }, temperament: p.temperament, fav: p.fav, worst: p.worst,
    hand: p.hand || 'right', backhand: p.backhand || 'two', plan: planOf(p), formSd: 0.02, fatigue: p.fatigue || 0 };
}
function simOdds(p, ev, mode, N = 70) {
  const me = meEntrant(p);
  const tour = ['ATP250', 'ATP500', 'M1000', 'GS'].includes(ev.tier);
  const qRounds = mode === 'qual' ? (ev.tier === 'GS' ? 3 : 2) : 0;
  const shifts = Array(qRounds).fill(-3).concat(tour ? [0, 2, 5, 7, 9] : [0, 1, 2, 3, 4]);
  const odds = shifts.map(sh => {
    let w = 0;
    for (let i = 0; i < N; i++) {
      const o = generateOpponent(pick(Math.random, Object.keys(REGION_OF)), ev.tier, Math.random, sh);
      const m = newMatch(0, 1);
      playMatch(m, [me, o], ev);
      if (m.winner === 0) w++;
    }
    return (w + 1) / (N + 2);
  });
  const q = odds.slice(0, qRounds).reduce((a, b) => a * b, 1), main = odds.slice(qRounds);
  return { qf: q * main[0] * main[1], title: q * main.reduce((a, b) => a * b, 1) };
}

function eventPreview(ev, mode, canEnter) {
  const p = current.player, c = current.career;
  const evx = { ...ev, weather: weatherFor(ev) };
  const me = meEntrant(p);
  const tour = ['ATP250', 'ATP500', 'M1000', 'GS'].includes(ev.tier);
  const wc = mode === 'wc';
  const { qf, title } = simOdds(p, evx, wc ? 'main' : mode);
  const pct = x => x >= 0.995 ? '99%' : x < 0.01 ? '<1%' : `${Math.round(x * 100)}%`;
  const notes = [];
  if (ev.surface === p.fav) notes.push('🟢 Your favourite surface.');
  if (ev.surface === p.worst) notes.push('🔴 Your worst surface.');
  const wx = evx.weather;
  if (wx && wx !== 'sunny' && wx !== 'indoor') {
    const st = detectStyles(p.attrs, p.fav)[0].name, e = wxEdge(me, st, evx);
    notes.push(`${WEATHER[wx].icon} ${WEATHER[wx].name}: ${e > 0.002 ? 'suits' : e < -0.002 ? 'works against' : 'barely affects'} your ${st} game (${e >= 0 ? '+' : '−'}${(Math.abs(e) * 100).toFixed(1)}% on points).${WX_EFFECT[wx].heat > 1.2 ? ' Tiring heat.' : ''}`);
  }
  if (tour) notes.push('⭐ Real top-100 players in the draw.');
  if (mode === 'qual') notes.push(`🎟️ You'd have to win ${ev.tier === 'GS' ? 3 : 2} qualifying matches first.`);
  if (wc) notes.push('🎟️ A wildcard puts you straight into the main draw, whatever your ranking.');
  const cost = tripCost(c, ev, wc ? 'main' : mode), travel = travelDays(c.location || p.nation, ev.nation);
  notes.push(`🏆 Win it: ${money(prizeFor(ev.tier, ROUND_NAMES.length))} and ${POINTS[ev.tier][ROUND_NAMES.length]} ranking points.${travel ? ` (${travel} day${travel === 1 ? '' : 's'} of travel to get there.)` : ''}`);
  const verdict = title >= 0.35 ? 'You should be among the favourites.' : title >= 0.12 ? 'A real shot at the title.' : qf >= 0.35 ? 'A good week means a deep run.' : 'Tough field for you: a win or two would be a good week.';
  return `<div class="evchances"><div><b>${pct(qf)}</b><span>Reach the Quarter-Finals</span></div><div><b>${pct(title)}</b><span>Win the Title</span></div></div>` +
    `<p class="big">${verdict}</p><ul class="evnotes">${notes.map(n => `<li>${n}</li>`).join('')}</ul>` +
    routeHtml(c.location || p.nation, ev.nation) +
    (canEnter ? `<div class="shrow"><button type="button" class="btn small" data-confirm="${ev.id}" data-mode="${mode}">${wc ? `🎟️ Use a wildcard (${c.perks.wildcards} left)` : mode === 'qual' ? 'Enter qualifying' : 'Enter this event'}</button><button type="button" class="btn small ghost" data-close="1">Not this one</button></div>` +
      `<p class="tripcost">This week costs <b>${money(cost)}</b> (flights and hotel). You'd have <b class="${c.money - cost < 0 ? 'down' : ''}">${money(c.money - cost)}</b> left.</p>`
      : `<p class="tripcost">The trip would cost <b>${money(cost)}</b> (flights and hotel); you have <b>${money(c.money)}</b> now. Simulated for a typical draw; it opens next week.</p>`);
}

// Enter / Enter qualifying / Locked, depending on your ranking.
function entryButton(ev, rank) {
  const el = eligibility(ev, rank), t = TIERS[ev.tier];
  const cost = tripCost(current.career, ev, el);
  if (el !== 'locked' && cost > current.career.money) return `<span class="locked" title="Travel and hotel cost ${money(cost)}">💸 ${money(cost)}</span>`;
  const wcs = (current.career.perks || {}).wildcards || 0;
  if (el === 'main') return `<button type="button" class="btn small" data-enter="${ev.id}" data-mode="main">Preview</button>`;
  if (wcs && t.main) return `<button type="button" class="btn small" data-enter="${ev.id}" data-mode="wc" title="You have a wildcard">Preview 🎟️</button>`;
  if (el === 'qual') return `<button type="button" class="btn small ghost" data-enter="${ev.id}" data-mode="qual" title="Win ${t.qRounds} qualifying matches to make the draw">Preview (qualifying)</button>`;
  return `<span class="locked">🔒 Top ${t.qual}</span>`;
}

// mode: 'main' (straight into the draw) or 'qual' (play qualifying first).
function enterEvent(ev, acclimated = false, mode = 'main') {
  ev = { ...ev, weather: weatherFor(ev) }; // this week's conditions
  const fromNation = current.career.location || current.player.nation; // for jet lag
  // Travel and a week's hotel (already paid if you travelled early).
  if (!acclimated) {
    const c0 = current.career, from = c0.location || current.player.nation;
    charge(c0, tripCost(c0, ev, mode), `Trip to ${ev.city}`);
    current.player.fatigue = clamp((current.player.fatigue || 0) + travelFatigue(c0, from, ev.nation), 0, 100);
    writeJSON(SAVE_KEY, current.player);
  }
  current.career.location = ev.nation;
  writeJSON(CAREER_KEY, current.career);
  const nations = generateField(ev);
  const rank = currentRank(current.career);
  const entrants = buildEntrants(current.player, ev, nations, Math.random, mode === 'main' ? rank : null);
  mixInPool(entrants, current.career, ev.tier, mode === 'main' ? rank : null);
  mixInReal(entrants, ev.tier, mode === 'main' ? rank : null); // the real ATP top 100 at tour events
  current.entry = { id: ev.id, event: ev, entrants, rounds: [makeDraw(entrants)], live: null, matches: [], result: null, plan: planOf(current.player), acclimated };
  if (mode === 'qual') {
    // Qualifying: win 2 (3 at Slams) matches against slightly weaker players to take your spot in the draw.
    const t = TIERS[ev.tier];
    const nationsQ = Object.keys(REGION_OF);
    const opps = Array.from({ length: t.qRounds }, () => {
      const o = generateOpponent(pick(Math.random, nationsQ), ev.tier, Math.random, -3);
      o.seed = null; o.qualifier = true;
      return o;
    });
    current.entry.entrants.push(...opps);
    current.entry.qual = { round: 0, need: t.qRounds, opps: opps.map((_, i) => 32 + i), slot: null, done: false };
  }
  current.entry.fromNation = fromNation;
  writeJSON(ENTRY_KEY, current.entry);
  openDraw();
}

// --- Tournament flow -------------------------------------------------------

// Events now come from the season calendar and are stored on the entry; older entries used the fixed list.
const eventOf = entry => entry.event || EVENTS.find(e => e.id === entry.id);
const roundIndex = entry => entry.rounds.length - 1;

const inQual = entry => !!entry.qual && !entry.qual.done;
const roundLabel = entry => inQual(entry) ? `Q${entry.qual.round + 1}` : ROUND_NAMES[roundIndex(entry)];

function playerMatch(entry) {
  if (inQual(entry)) {
    if (entry.result) return null;
    if (!entry.qual.slot) entry.qual.slot = { a: 0, b: entry.qual.opps[entry.qual.round] };
    return entry.qual.slot.winner === undefined ? entry.qual.slot : null;
  }
  return entry.rounds[roundIndex(entry)].find(x => (x.a === 0 || x.b === 0) && x.winner === undefined);
}

function record(slot, m) {
  slot.winner = m.winner === 0 ? m.a : m.b;
  slot.score = scoreLine(m, 0);
}

function simRound(entry, r) {
  const ev = eventOf(entry);
  for (const slot of entry.rounds[r]) {
    if (slot.winner !== undefined) continue;
    const m = newMatch(slot.a, slot.b);
    playMatch(m, [entry.entrants[slot.a], entry.entrants[slot.b]], ev);
    record(slot, m);
  }
}

function advance(entry) {
  const r = roundIndex(entry);
  simRound(entry, r);
  const winners = entry.rounds[r].map(s => s.winner);
  if (winners.length === 1) return false;
  const next = [];
  for (let i = 0; i < winners.length; i += 2) next.push({ a: winners[i], b: winners[i + 1] });
  entry.rounds.push(next);
  return true;
}

// Called once the player's match is over: finish the round, then either move on or wrap up the event.
function afterPlayerMatch(entry) {
  if (inQual(entry)) {
    const q = entry.qual, won = q.slot && q.slot.winner === 0;
    q.slot = null;
    if (won) { q.round++; if (q.round >= q.need) { q.done = true; entry.qualified = true; } return; }
    // Lost in qualifying: a lucky loser takes your place and the main draw plays out without you.
    const ev = eventOf(entry);
    entry.entrants.push(generateOpponent(pick(Math.random, Object.keys(REGION_OF)), ev.tier, Math.random, -3));
    const ll = entry.entrants.length - 1;
    for (const sl of entry.rounds[0]) { if (sl.a === 0) sl.a = ll; if (sl.b === 0) sl.b = ll; }
    while (advance(entry));
    entry.result = { reached: -1, qualRound: q.round + 1, points: 0, champion: entry.rounds[ROUND_NAMES.length - 1][0].winner };
    return;
  }
  const r = roundIndex(entry);
  const slot = entry.rounds[r].find(x => x.a === 0 || x.b === 0);
  if (!slot || entry.result) return;
  const won = slot.winner === 0;
  if (won && r < ROUND_NAMES.length - 1) { advance(entry); return; }
  const reached = won ? ROUND_NAMES.length : r;
  while (advance(entry));
  const ev = eventOf(entry);
  // Qualifiers also get a few points for coming through qualifying.
  const qp = entry.qualified ? (TIERS[ev.tier].qPoints || 0) : 0;
  entry.result = { reached, points: POINTS[ev.tier][reached] + qp, champion: entry.rounds[ROUND_NAMES.length - 1][0].winner };
}

// You vs them, centred, each with their playstyle and a line on what it means.
function vsHeader(entry, oi) {
  const side = i => {
    const e = entry.entrants[i], st = detectStyles(e.attrs, e.fav)[0];
    return `<div class="vsside"><div class="vsname">${nameCell(entry, i)}</div><div class="vsstyle">${st.name}</div><small>${st.desc}</small></div>`;
  };
  return `<div class="vsbox">${side(0)}<div class="vsmid">vs</div>${side(oi)}</div>`;
}

// Before your next match, on the draw screen: scouting report, head-to-head, coach's report and your plan.
function prematchHtml(entry, oi) {
  const opp = entry.entrants[oi], ev = eventOf(entry);
  return scoutCard(opp, ev, entry.entrants[0], eventPlan(entry), { morale: moraleHtml(moraleFor(current.career, current.player, ev, opp, entry)), planBtn: 'dPlanBtn' });
}

// The whole pre-match report, laid out to read in seconds: the conditions, who they are, how to beat
// them, and your plan next to the coach's.
function scoutCard(opp, ev, me, plan, { morale = '', planBtn = 'dPlanBtn' } = {}) {
  const c = current.career, r = scoutReport(opp);
  const sec = (title, body) => `<section class="ssect"><h3>${title}</h3>${body}</section>`;
  const box = (title, items, cls) => `<div class="sbox ${cls}"><h4>${title}</h4>` +
    (items.length ? `<ul>${items.map(x => `<li>${x}</li>`).join('')}</ul>` : '<p class="hint">Nothing stands out.</p>') + `</div>`;

  const coach = hasTeam(c, 'coach'), lvl = coach ? teamLevel(c, 'coach') : 0;
  const near = v => lvl >= 3 ? Math.round(v) : Math.round(v / 2) * 2;
  const know = `<div class="sboxes">${box('💪 Strengths', r.strengths, 'up')}${box('🩹 Weaknesses', r.weaknesses, 'down')}</div>` +
    (r.tendencies.length ? `<h4 class="sh4">Their habits</h4><div class="chips">${r.tendencies.map(t => `<span class="chip">${t}</span>`).join('')}</div>` : '') +
    (lvl >= 2 ? `<h4 class="sh4">Ratings (your coach's read)</h4>${coachCompare(me, opp, near, lvl >= 3)}` : '');
  const beat = r.counters.length ? `<ol class="beat">${r.counters.map(x => `<li>${x}</li>`).join('')}</ol>` : '<p class="hint">No obvious holes. Play your game.</p>';

  // Your plan, with the coach's suggestion beside each setting.
  const rec = coach ? coachPlan(opp, ev, me) : null, theirs = planOf(opp);
  const diffs = rec ? GAME_PLAN.filter(g => rec[g.key] !== plan[g.key]) : [];
  const rows = GAME_PLAN.map(g => {
    const d = rec && rec[g.key] !== plan[g.key];
    return `<tr class="${d ? 'diff' : ''}"><th>${g.label}</th><td>${planLabel(g.key, plan[g.key])}</td>` +
      (coach ? `<td>${d ? `<b>${planLabel(g.key, rec[g.key])}</b>` : '<span class="ok">✓</span>'}</td>` : '') +
      (coach ? `<td class="them">${planLabel(g.key, theirs[g.key])}</td>` : '') + `</tr>`;
  }).join('');
  const table = `<table class="ptable"><thead><tr><th></th><td>You</td>${coach ? '<td>Coach says</td><td class="them">They play</td>' : ''}</tr></thead><tbody>${rows}</tbody></table>`;
  const note = !coach ? `<p class="hint coachtease">🧑‍🏫 Hire a coach (Home → Money &amp; Team) to see how they play and get a counter-plan.</p>`
    : diffs.length ? `<p class="coachsays">🧑‍🏫 ${teamOf(c, 'coach').name} suggests ${diffs.length} change${diffs.length === 1 ? '' : 's'} (highlighted).</p>`
    : `<p class="coachsays ok">🧑‍🏫 ${teamOf(c, 'coach').name}: your plan is spot on for this one.</p>`;
  const btns = `<div class="pbtns">${diffs.length ? `<button type="button" class="btn" id="coachUse">Use the coach's plan</button>` : ''}` +
    `<button type="button" class="btn ghost" id="${planBtn}">Change my plan</button></div>`;

  return `<div class="card scard"><div class="scouthead"><span>Scouting report</span><h2 class="sname">${esc(opp.name)}${opp.atpRank ? ` <small>ATP #${opp.atpRank}</small>` : ''}</h2></div>` +
    h2hLine(c, opp) + morale +
    sec('Conditions and matchup', weatherHtml(ev, me, opp) + matchupHtml(me, opp)) +
    sec('Know your opponent', know) +
    sec('How to beat them', beat) +
    sec('Your game plan', note + table + btns) + `</div>`;
}

function bindPrematch(entry, oi, rerender) {
  const opp = entry.entrants[oi], ev = eventOf(entry);
  if ($('coachUse')) $('coachUse').onclick = () => {
    Object.assign(eventPlan(entry), coachPlan(opp, ev, entry.entrants[0]));
    saveEventPlan(entry);
    rerender();
  };
  $('dPlanBtn').onclick = () => {
    openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
      `<h2 class="itop">Game plan vs ${esc(opp.name)}</h2>` +
      `<p class="hint center">Changes apply for the rest of this tournament. Your default plan on Home stays as it is.</p>` +
      scoutHtml(opp) + `<div id="pmPlan" class="plan"></div><button type="button" class="btn" id="pmDone">Done</button>`,
      { onClose: rerender, wide: true });
    planEditor($('pmPlan'), eventPlan(entry), () => saveEventPlan(entry));
    $('pmDone').onclick = closeModal;
    $('mx').onclick = closeModal;
  };
}

// Pull out before your next match: the opponent gets a walkover, the draw plays out without you,
// and you keep what you'd earned by reaching this round.
function withdraw(entry) {
  const ev = eventOf(entry);
  if (inQual(entry)) {
    const q = entry.qual;
    entry.entrants.push(generateOpponent(pick(Math.random, Object.keys(REGION_OF)), ev.tier, Math.random, -3));
    const ll = entry.entrants.length - 1;
    for (const sl of entry.rounds[0]) { if (sl.a === 0) sl.a = ll; if (sl.b === 0) sl.b = ll; }
    while (advance(entry));
    entry.result = { reached: -1, qualRound: q.round + 1, points: 0, withdrew: true, champion: entry.rounds[ROUND_NAMES.length - 1][0].winner };
  } else {
    const r = roundIndex(entry), slot = playerMatch(entry);
    slot.winner = slot.a === 0 ? slot.b : slot.a;
    slot.score = 'W/O';
    while (advance(entry));
    const qp = entry.qualified ? (TIERS[ev.tier].qPoints || 0) : 0;
    entry.result = { reached: r, points: POINTS[ev.tier][r] + qp, withdrew: true, champion: entry.rounds[ROUND_NAMES.length - 1][0].winner };
  }
  writeJSON(ENTRY_KEY, entry);
  renderDraw();
}

function finishEvent() {
  const entry = current.entry, c = current.career, ev = eventOf(entry);
  const won = entry.matches.filter(m => m.won).length;
  c.points += entry.result.points;
  const prize = prizeFor(ev.tier, entry.result.reached, entry.result.qualRound);
  if (prize) earn(c, prize, `Prize money, ${ev.city}`);
  c.wins += won;
  c.losses += entry.matches.length - won;
  if (entry.result.reached === ROUND_NAMES.length) c.titles.push({ week: c.week, event: ev.id, city: ev.city, tier: ev.tier });
  c.history.push({
    week: c.week, event: ev.id, city: ev.city, nation: ev.nation, tier: ev.tier, surface: ev.surface,
    reached: entry.result.reached < 0 ? `Q${entry.result.qualRound}` : entry.result.reached === ROUND_NAMES.length ? 'W' : ROUND_NAMES[entry.result.reached],
    points: entry.result.points, matches: entry.matches, prize,
  });
  c.location = ev.nation;
  writeJSON(CAREER_KEY, c);
  writeJSON(ENTRY_KEY, null);
  current.entry = null;
  const r = currentRank(c);
  if (r && (!c.bestRank || r < c.bestRank)) c.bestRank = r;
  checkBadges(c, { entry, result: entry.result });
  claimGoals(c, current.player);
  writeJSON(CAREER_KEY, c);
  // A long, tiring week can end in an injury.
  const hurt = entry.result.injured ? c.injury : c.injury ? null : maybeInjure(c, current.player, 1.2);
  if (hurt) { if (!entry.result.injured) c.notice = `🤕 You picked up ${hurt.name} in ${ev.city}. Out for about ${hurt.weeks} week${hurt.weeks === 1 ? '' : 's'}.`; writeJSON(CAREER_KEY, c); advanceWeek(); return; }
  const free = entry.result.reached < 0 ? 5 : FREE_DAYS[entry.result.reached];
  if (free > 0) startDowntime(free, ev.nation, `After ${ev.city}`);
  else advanceWeek();
}

// --- Draw screen -----------------------------------------------------------

function nameCell(entry, i) {
  const e = entry.entrants[i];
  const seed = e.seed ? `<span class="seed">${e.seed}</span>` : '';
  const rival = e.id && current.career && isRival(current.career, e.id) ? ' <span class="rivaltag">⚔️</span>' : '';
  const atp = e.atpRank ? ` <span class="atptag">ATP #${e.atpRank}</span>` : '';
  return `${seed}${flagOf(e.nation)} ${e.isPlayer ? '<b>You</b>' : esc(e.name)}${atp}${rival}`;
}

// After your match ends: finish the round (or the event) and go to the post-match review.
function autopilotNote() {
  return `<p class="hint autopilot">Lose a set and change nothing, and you play the next set flat (<b>−2% on points</b>). ` +
    `Watch or go set by set to adjust at the break; Full Match never stops to let you. Simmed sets cost a little (−0.5%).</p>`;
}

// Autopilot. Simming a set you don't watch costs a little (−0.5% on points); skipping events or simming
// part of a season is fine. The real cost is losing a set and changing nothing: the next set is played
// −2% on points (−1.2% if you came in with a prepared plan). Full Match never stops at set breaks, so a
// lost set there always counts as no change.
const SIM_PEN = 0.005, STUCK_PEN = 0.02;
function autopilotPenalty(entry, watching) {
  const { m } = entry.live, me = m.a === 0 ? 0 : 1;
  let pen = (watching ? 0 : SIM_PEN) + rustOf(current.career);
  const last = m.sets[m.sets.length - 1];
  const lostLast = last && last.games[me] < last.games[1 - me];
  const changed = (entry.live.adjusts || []).some(a => a.after === m.sets.length);
  if (lostLast && !changed) {
    const prepared = JSON.stringify(eventPlan(entry)) !== JSON.stringify(planOf(current.player));
    pen += STUCK_PEN * (prepared ? 0.6 : 1);
    if (!entry.live.stuckNoted) { entry.live.stuckNoted = true; entry.live.log.push('🧠 You lost the set and kept the same plan. Without a change, you play the next set flat (−2% on points).'); }
  }
  return pen;
}

function wrapUpMatch(entry) {
  if (!entry.live) return; // already wrapped up (e.g. a double click)
  // Matches tire you out: more so when they go three sets.
  const rec = entry.matches[entry.matches.length - 1];
  const p = current.player;
  // Watching bonus: up to +2% on top of the adjustment, for the share of points you watched.
  if (rec) {
    rec.watched = entry.live.total ? Math.min(1, (entry.live.watched || 0) / entry.live.total) : 0;
    // Watch credit: the full +2% for watching 3 whole games (a third of it per game); watch every point
    // of the match and the whole match's growth is tripled.
    rec.gamesWatched = entry.live.gamesWatched || 0;
    rec.fullWatch = !!entry.live.total && (entry.live.watched || 0) >= entry.live.total;
    rec.watchBonus = Math.round(WATCH_BONUS * Math.min(1, rec.gamesWatched / WATCH_GAMES) * 10000) / 10000;
  }
  p.fatigue = clamp((p.fatigue || 0) + (10 + (rec && rec.sets.length === 3 ? 5 : 0)) * staminaFactor(p) * (1 + (wxOf(eventOf(entry)).heat - 1) * 0.4), 0, 100);
  writeJSON(SAVE_KEY, p);
  shakeRust(current.career);
  writeJSON(CAREER_KEY, current.career);
  // A set-break change was for that match only: back to your tournament plan.
  entry.entrants[0].plan = { ...eventPlan(entry) };
  entry.live = null;
  afterPlayerMatch(entry);
  // Playing on an exhausted body can end your week: hurt after the match, you pull out of the event.
  if (!entry.result && !current.career.injury) {
    const hurt = maybeInjure(current.career, p, 1.2);
    if (hurt) {
      current.career.notice = `🤕 You picked up ${hurt.name} and had to pull out of ${eventOf(entry).city}. Out for about ${hurt.weeks} week${hurt.weeks === 1 ? '' : 's'}.`;
      writeJSON(CAREER_KEY, current.career);
      withdraw(entry);
      entry.result.injured = true;
    }
  }
  entry.review = entry.matches.length - 1;
  if (rec) checkBadges(current.career, { rec });
  if (rec) saveHighlights(current.career, entry, rec);
  writeJSON(ENTRY_KEY, entry);
  openReview();
}

function openDraw() {
  // A match that finished but was never wrapped up (e.g. the page closed or reloaded on the result screen).
  if (current.entry.live && current.entry.live.done) return wrapUpMatch(current.entry);
  if (current.entry.review != null) return openReview();
  current.tab = roundIndex(current.entry);
  renderDraw();
  showScreen('draw');
}

function renderDraw() {
  const entry = current.entry, ev = eventOf(entry);
  $('dPlanTitle').textContent = `Game plan for ${ev.city}`;
  planEditor($('dPlan'), eventPlan(entry), () => saveEventPlan(entry));
  renderPlanReport($('dReport'), entry.matches.filter(r => r.stats.servePts !== undefined).map(rec => ({ rec })),
    'Your stats here will build up as you play matches at this event.');
  $('dTitle').textContent = `${flagOf(ev.nation)} ${ev.city} · ${tierLabel(ev.tier)}`;
  $('dMeta').textContent = `${surfaceLabel(ev.surface)}${ev.indoor ? ' · Indoor' : ''} · ${PRIZE[ev.tier]} · Field: ${fieldSummary(entry.entrants.slice(1).map(e => e.nation))}`;

  const pm = playerMatch(entry);
  const act = $('dAction');
  if (entry.result) {
    const res = entry.result;
    const champ = entry.entrants[res.champion];
    const head = res.reached === ROUND_NAMES.length ? '🏆 Champion!'
      : res.injured ? '🤕 Pulled out injured'
      : res.withdrew ? `Withdrew before the ${res.reached < 0 ? `Q${res.qualRound}` : ROUND_NAMES[res.reached]}`
      : res.reached < 0 ? `Out in qualifying (Q${res.qualRound})` : `Out in the ${ROUND_NAMES[res.reached]}`;
    act.innerHTML = `<div class="top">${head}</div>` +
      `<p class="hint">+${res.points} ranking point${res.points === 1 ? '' : 's'}` +
      (champ.isPlayer ? '' : ` · Champion: ${flagOf(champ.nation)} ${esc(champ.name)}`) + `</p>` +
      `<button type="button" class="btn" id="dFinish">Back to Home</button>`;
    $('dFinish').onclick = finishEvent;
  } else if (pm) {
    const opp = pm.a === 0 ? pm.b : pm.a;
    act.innerHTML = `<p class="hint">Next: ${roundLabel(entry)}${inQual(entry) ? ` · qualifying: win ${entry.qual.need - entry.qual.round} more to reach the main draw` : ''}</p>` +
      vsHeader(entry, opp) +
      (entry.live ? '' : prematchHtml(entry, opp)) +
      (entry.live ? '' : checkInHtml(current.player)) +
      `<button type="button" class="btn" id="dPlay">${entry.live ? 'Resume Match' : 'Play Match'}</button>` +
      (entry.live ? '' : `<div class="center"><button type="button" class="link" id="dWithdraw">Withdraw from the tournament</button></div>`);
    $('dPlay').onclick = () => openMatch();
    if (!entry.live) bindPrematch(entry, opp, renderDraw);
    if ($('dWithdraw')) $('dWithdraw').onclick = () => {
      if (confirm(`Withdraw from ${eventOf(entry).city}? You keep the points and prize money you've earned so far, and your opponent gets a walkover.`)) withdraw(entry);
    };
  }

  $('dTabs').innerHTML = ROUND_NAMES.map((n, i) =>
    `<button type="button" data-r="${i}" class="${i === current.tab ? 'on' : ''}" ${i >= entry.rounds.length ? 'disabled' : ''}>${n}</button>`).join('');
  $('dTabs').onclick = e => {
    const b = e.target.closest('button');
    if (b && !b.disabled) { current.tab = +b.dataset.r; renderDraw(); }
  };

  $('dList').innerHTML = entry.rounds[current.tab].map(s => {
    const row = (i, other) => {
      const won = s.winner === i, lost = s.winner === other;
      const me = entry.entrants[i].isPlayer ? ' me' : '';
      return `<div class="dl-row${me}${lost ? ' lost' : ''}">` +
        `<span>${nameCell(entry, i)}</span><span class="dl-mark">${won ? '✓' : ''}</span></div>`;
    };
    const score = s.score ? `<div class="dl-score">${s.score}</div>` : '';
    return `<div class="dl-match">${row(s.a, s.b)}${row(s.b, s.a)}${score}</div>`;
  }).join('');
}

// --- Match screen ----------------------------------------------------------

const TEMPER_EMOJI = t => TEMPERAMENTS[t].emoji;
// Emoji for a match moment: brain for working out a game plan, otherwise the player's temperament.
const momentEmoji = (mo, p) => mo.kind === 'adapt' ? '🧠' : TEMPER_EMOJI(p.temperament);
const SPEED_KEY = 'tourlife.speed';
const VIEW_KEY = 'tourlife.view';
const LABELS_KEY = 'tourlife.labels';
const anim = { running: false, watching: false, paused: false, finishAfter: false, speed: readJSON(SPEED_KEY) || 1, mounted: false };

// Surname for tight spaces (court labels, calls).
function shortName(p) {
  if (p.isPlayer) return 'You';
  if (FAMILY_FIRST.has(p.nation)) return p.name.split(' ')[0];
  const last = NAMES[p.nation] && NAMES[p.nation][1].find(l => p.name.endsWith(' ' + l));
  return last || p.name.split(' ').pop();
}

function openMatch() {
  const entry = current.entry;
  anim.noCalls = false;
  if (!entry.live) {
    const pm = playerMatch(entry);
    // You carry this week's tiredness (and any early-arrival practice) into the match.
    entry.entrants[0].fatigue = current.player.fatigue || 0;
    entry.entrants[0].acclimated = !!entry.acclimated;
    entry.live = { m: newMatch(pm.a, pm.b, Math.random, true), log: [] };
    writeJSON(ENTRY_KEY, entry);
  }
  showScreen('match');
  if (!anim.mounted) {
    Court.mount($('court')); anim.mounted = true;
    Court.pauseCheck = () => anim.paused;
    // Full screen: the court plus the view tabs, GATAH bar, speed and match controls.
    const stage = $('mStage');
    const isFs = () => document.fullscreenElement === stage || document.webkitFullscreenElement === stage;
    $('mFull').onclick = () => {
      if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage);
    };
    // Controls fade out while you watch and come back when you move the mouse or tap.
    const wrap = $('mCourtWrap');
    let idleT = null;
    const wake = () => { wrap.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => wrap.classList.add('idle'), 2500); };
    ['mousemove', 'touchstart', 'click'].forEach(ev => wrap.addEventListener(ev, wake, { passive: true }));
    wake();
    const onFs = () => { $('mFull').textContent = isFs() ? '✕' : '⛶'; setTimeout(() => Court.resize(), 60); };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
  }
  const { m } = entry.live, ev = eventOf(entry);
  const ps = matchPlayers(entry, m), me = m.a === 0 ? 0 : 1;
  const tag = p => lefty(p) ? ' (L)' : '';
  const savedView = readJSON(VIEW_KEY) || 'broadcast';
  if (Court.view !== savedView) Court.setView(savedView);
  $('mView').innerHTML = [['broadcast', 'Broadcast'], ['top', 'Top-down'], ['gatah', 'GATAH VISION']].map(([v, l]) =>
    `<button type="button" data-v="${v}" class="${v === savedView ? 'on' : ''}${v === 'gatah' ? ' gv' : ''}">${l}</button>`).join('');
  $('mView').onclick = e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    writeJSON(VIEW_KEY, b.dataset.v);
    Court.setView(b.dataset.v);
    $('mView').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    renderGvBar();
    renderPoints();
    if (!anim.running) renderMatch();
  };
  // Label toggles (shot type, FH/BH), remembered between matches.
  const lab = { showType: true, showWing: true, ...readJSON(LABELS_KEY) };
  Court.setOptions(lab);
  $('mLabels').innerHTML = [['showType', 'Shot type'], ['showWing', 'FH/BH']].map(([k, l]) =>
    `<label class="chk"><input type="checkbox" data-k="${k}" ${lab[k] ? 'checked' : ''}> ${l}</label>`).join('');
  $('mLabels').onchange = e => {
    const k = e.target.dataset.k;
    if (!k) return;
    lab[k] = e.target.checked;
    writeJSON(LABELS_KEY, lab);
    Court.setOptions(lab);
  };
  const profile = p => ({ hand: p.hand || 'right', backhand: p.backhand || 'two', iq: attr(p, 'iq'), net: p.attrs.net, plan: planOf(p),
    style: detectStyles(p.attrs, p.fav)[0].name });
  Court.scene(ev.surface, ev.indoor, ['You' + tag(ps[me]), shortName(ps[1 - me]) + tag(ps[1 - me])],
    [profile(ps[me]), profile(ps[1 - me])]);
  Court.setWeather(wxOf(ev), ev.weather === 'damp');
  renderGvBar();
  // Replays live in memory for the match on screen only.
  const key = `${entry.id}:${roundIndex(entry)}:${m.a}-${m.b}`;
  if (anim.replayKey !== key) { anim.replayKey = key; anim.replays = []; }
  renderPoints();
  renderMatch();
}

function matchPlayers(entry, m) {
  return [entry.entrants[m.a], entry.entrants[m.b]];
}

// Plays the next set in the engine, logs its summary, then (optionally) replays it on court.
async function playOneSet(animate = true) {
  if (anim.running) return;
  const entry = current.entry, { m, log } = entry.live, ev = eventOf(entry);
  const ps = matchPlayers(entry, m);
  const me = m.a === 0 ? 0 : 1, op = 1 - me;
  const before = JSON.parse(JSON.stringify(m.stats));
  const momentsBefore = m.moments.length;
  // Autopilot: a small cost for simming, a bigger one for losing a set and changing nothing.
  ps[me].focusPen = autopilotPenalty(entry, animate);
  // Morale: the person behind the player (crowd, travel, pressure, memories, life on the road).
  ps[me].moraleEdge = moraleFor(current.career, current.player, ev, ps[op], entry).edge;
  ps[op].moraleEdge = oppMorale(ev, ps[op], current.player);
  let set, shown = 0;
  if (animate) {
    // Live: the set is played point by point as you watch, and big points stop for your call.
    anim.running = true; anim.live = true;
    renderMatch();
    const A = makeAnimator(m.sets.slice(), m.sets.length + 1);
    set = await playSetLive(m, ps, ev, async info => {
      const fresh = m.points.slice(shown);
      shown = m.points.length;
      if (fresh.length) await A.play(fresh, false);
      if (info.bp !== null || info.press) await bigPoint(info, ps, me);
    });
    await A.play(m.points.slice(shown), true);
    anim.live = false;
  } else set = playSet(m, ps, ev);
  const d = i => ({
    bpWon: m.stats[i].bpWon - before[i].bpWon, bpChances: m.stats[i].bpChances - before[i].bpChances,
    bpSaved: m.stats[i].bpSaved - before[i].bpSaved, bpFaced: m.stats[i].bpFaced - before[i].bpFaced,
  });
  const you = d(me);
  const [g1, g2] = [set.games[me], set.games[op]];
  const lines = [];
  lines.push(`<b>Set ${m.sets.length}: ${g1}-${g2}${set.tb ? ` (tiebreak ${set.tb[me]}-${set.tb[op]})` : ''} ${g1 > g2 ? 'to you' : 'to ' + esc(ps[op].name)}</b>`);
  lines.push(`You broke ${you.bpWon} time${you.bpWon === 1 ? '' : 's'} (${you.bpWon}/${you.bpChances} on break points). ` +
    `Saved ${you.bpSaved} of ${you.bpFaced} break point${you.bpFaced === 1 ? '' : 's'} faced.`);
  for (const mo of m.moments.slice(momentsBefore)) {
    const who = mo.who === me ? 'You' : esc(ps[op].name);
    lines.push(`${momentEmoji(mo, ps[mo.who])} ${who} ${moodText(mo, mo.who === me)}.${mo.effect ? ` <small class="mfx ${mo.kind === 'surge' ? 'up' : 'down'}">${mo.effect}</small>` : ''}`);
  }
  log.push(lines.join('<br>'));
  if (m.winner !== null) concludeMatch();
  const points = m.points;
  m.points = [];
  entry.live.total = (entry.live.total || 0) + points.length;
  writeJSON(ENTRY_KEY, entry);
  if (animate) {
    anim.running = false;
    Court.skip = false;
  }
  renderMatch();
}

// Big point: a banner, a line review if it ends near a line, and (if you're watching) a call to make.
function bigPoint(info, ps, me) {
  const m = current.entry.live.m;
  const name = i => i === me ? 'You' : shortName(ps[i]);
  const text = info.press ? `${info.press.match ? 'MATCH' : 'SET'} POINT · ${name(info.press.who).toUpperCase()}`
    : `BREAK POINT · ${name(info.bp).toUpperCase()}`;
  anim.review = Math.random() < 0.5;
  if (Court.skip || anim.finishAfter) return Promise.resolve();
  Court.banner(text);
  if (anim.noCalls) return Promise.resolve();
  const serving = info.s === me, calls = CALLS[serving ? 'serve' : 'ret'];
  const pct = e => `${e >= 0 ? '+' : '−'}${(Math.abs(e) * 100).toFixed(1)}%`;
  const box = $('mCallBox');
  box.innerHTML = `<div class="cbtitle">${text}</div><div class="cbsub">${serving ? "You're serving" : "You're returning"}. Make a call:</div>` +
    `<div class="cbopts">${calls.map(c => { const e = callEdge(m, ps, me, c);
      return `<button type="button" data-call="${c.id}"><span>${c.icon}</span><b>${c.title}</b><small class="${e >= 0 ? 'up' : 'down'}">${pct(e)} on this point</small></button>`; }).join('')}</div>` +
    `<div class="cbfoot"><button type="button" class="link" data-call="none">Just play it</button><button type="button" class="link" data-call="off">Don't ask again this match</button></div>`;
  box.hidden = false;
  return new Promise(done => {
    // Leaving the match or skipping the set answers for you.
    const iv = setInterval(() => { if (Court.skip) finish(null); }, 200);
    const finish = id => {
      clearInterval(iv);
      if (id === 'off') anim.noCalls = true;
      const call = calls.find(c => c.id === id);
      if (call) makeCall(m, ps, me, call);
      box.hidden = true; box.onclick = null;
      done();
    };
    box.onclick = e => { const b = e.target.closest('[data-call]'); if (b) finish(b.dataset.call); };
  });
}

// Watch mode: replay every set on court until the match ends (or you jump to the end).
async function watchMatch() {
  if (anim.watching) return;
  anim.watching = true;
  anim.paused = false;
  // One set at a time: the set break is your chance to change the plan.
  await playOneSet(true);
  if (!anim.finishAfter) { anim.watching = false; renderMatch(); return; }
  anim.watching = false;
  if (anim.finishAfter) {
    anim.finishAfter = false;
    while (!current.entry.live.done) await playOneSet(false);
  }
  renderMatch();
}

const pause = ms => Court.skip ? Promise.resolve() : new Promise(r => setTimeout(r, ms));

function ptsLabels(pts, tb) {
  if (tb) return pts.map(String);
  const [a, b] = pts;
  if (a >= 3 && b >= 3) return a === b ? ['40', '40'] : a > b ? ['AD', ''] : ['', 'AD'];
  const L = ['0', '15', '30', '40'];
  return [L[a], L[b]];
}

// Plays points on court as the live set produces them. prior: finished sets; setNo: this set's number.
// play(points, last) can be called many times; last marks the chunk that ends the set.
function makeAnimator(prior, setNo) {
  const entry = current.entry, { m } = entry.live;
  const ps = matchPlayers(entry, m);
  const me = m.a === 0 ? 0 : 1, op = 1 - me;
  const view = i => i === me ? 0 : 1;
  const name = i => shortName(ps[i]);
  let games = [0, 0], labels = ['0', '0'], inGame = 0, idx = 0, gameSeen = true;

  return { play: async (points, last) => { for (let j = 0; j < points.length; j++, idx++) {
    const i = idx;
    while (anim.paused && !Court.skip) await new Promise(r => setTimeout(r, 120));
    const pt = points[j];
    liveBoard(prior, games, labels, view(pt.s));
    let call = '';
    if (pt.press) call = `${pt.press.match ? 'Match' : 'Set'} point — ${name(pt.press.who)}`;
    else if (pt.bp !== null) call = `Break point — ${name(pt.bp)}`;
    else if (pt.tb && inGame === 0) call = 'Tiebreak';
    setCall(call, 'pre');
    $('mMood').textContent = '';

    const mapBy = o => o && { ...o, by: view(o.by) };
    const review = (pt.bp !== null || pt.press) ? anim.review : Math.random() < 0.05;
    const rally = await Court.playPoint({ ...pt, review, w: view(pt.w), net: mapBy(pt.net), drop: mapBy(pt.drop), netcord: mapBy(pt.netcord),
      call: pt.call && { ...pt.call, side: view(pt.call.side) } },
      { server: view(pt.s), deuce: inGame % 2 === 0 }, anim.speed);
    // Points actually watched (not skipped) earn the watching bonus.
    if (!Court.skip) entry.live.watched = (entry.live.watched || 0) + 1;
    else gameSeen = false;
    // A game counts as watched only if every point of it was (not skipped).
    if (pt.end) { if (gameSeen) entry.live.gamesWatched = (entry.live.gamesWatched || 0) + 1; gameSeen = true; }

    const W = name(pt.w), L = name(1 - pt.w), S = name(pt.s);
    const text = {
      df: `Double fault — ${S}`, ace: `Ace — ${S}`, unreturned: `Service winner — ${S}`,
      'return-error': `Return error — ${L}`,
      winner: rally.length >= 9 ? `${W} wins a ${rally.length}-shot rally` : `Winner — ${W}`,
      volley: `Volley winner — ${W}`, pass: `Passing shot — ${W}`,
      ue: `Unforced error — ${L}`, fe: `Forced error — ${L}`,
      drop: `Drop shot winner — ${W}`, dropnet: `Drop shot into the net — ${L}`, dropchased: `${W} runs down the drop shot`,
      netcord: `Net cord winner — ${W}`, netcordback: `Off the tape and back — ${L}`,
      underarmWin: `Underarm serve! — ${S}`, underarmLost: `${W} punishes the underarm serve`,
    }[rally.end];
    games = pt.games;
    if (pt.end) {
      labels = ['', ''];
      const setOver = last && j === points.length - 1;
      const broke = !pt.tb && pt.w !== pt.s;
      setCall(setOver ? `Set — ${W}` : pt.tb ? `Tiebreak — ${W}` : broke ? `Break — ${W}` : `Game — ${W}`, broke || setOver ? 'big' : 'post');
    } else {
      // Point scores come in engine order; the board shows you first.
      const L = ptsLabels(pt.pts, pt.tb);
      labels = [L[me], L[op]];
      setCall(text, 'post');
    }
    liveBoard(prior, games, labels, view(pt.s));
    const moods = m.moments.filter(x => x.set === setNo && x.at === i);
    $('mMood').textContent = moods.map(x => `${momentEmoji(x, ps[x.who])} ${x.who === me ? 'You' : name(x.who)} ${moodText(x, x.who === me)}${x.effect ? ` (${x.effect})` : ''}`).join('  ·  ');
    // Keep the point for replays (GATAH VISION), labelled with the score after it.
    // Advantage reads as AD-40 / 40-AD.
    const lab = pt.end ? `${pt.games[me]}-${pt.games[op]}` : `${labels[0] || '40'}-${labels[1] || '40'}`;
    const gameNo = pt.games[0] + pt.games[1] - (pt.end ? 1 : 0) + 1;
    anim.replays.push({ script: rally.script, set: setNo, label: lab, game: `${games[me]}-${games[op]}`, end: rally.end, highlight: rally.highlight,
      call: pt.end ? '' : text, text, gameNo, tb: pt.tb, server: name(pt.s), gameEnd: pt.end, broke: pt.end && !pt.tb && pt.w !== pt.s, winner: name(pt.w),
      // For saved highlights: what was at stake and who won it.
      mine: pt.w === me, bp: pt.bp === null ? null : pt.bp === me ? 'you' : 'them',
      press: pt.press ? { match: pt.press.match, you: pt.press.who === me } : null, len: rally.length || 1,
      review: rally.script.segs.some(sg => sg.review) });
    renderPoints();
    const gv = Court.view === 'gatah';
    const sp = gv ? 1 : anim.speed;
    await pause((pt.end ? (gv ? 1800 : 1000) : (gv ? 1100 : 450)) / sp + (moods.length ? 900 / sp : 0));
    inGame = pt.end ? 0 : inGame + 1;
  } } };
}

function setCall(text, kind) {
  const el = $('mCall');
  el.textContent = text;
  el.className = `call ${kind || ''}`;
}

// Scoreboard while a set is being replayed: finished sets, current games, current points.
function liveBoard(prior, games, labels, server) {
  const entry = current.entry, { m } = entry.live;
  const ps = matchPlayers(entry, m);
  const me = m.a === 0 ? 0 : 1, op = 1 - me;
  const row = (i, v) => {
    const cells = prior.map(s => `<td class="${s.games[i] > s.games[1 - i] ? 'w' : ''}">${s.games[i]}</td>`).join('');
    const dot = server === v ? '<span class="serve-dot"></span>' : '<span class="serve-dot off"></span>';
    return `<tr><th>${dot}${playerLabel(ps, i, me)}</th>${cells}<td class="cur">${games[i]}</td><td class="pts">${labels[v]}</td></tr>`;
  };
  $('mBoard').innerHTML = row(me, 0) + row(op, 1);
}

function playerLabel(ps, i, me) {
  const p = ps[i];
  if (i === me) return `${flagOf(p.nation)} You`;
  return `${p.seed ? `<span class="seed">${p.seed}</span>` : ''}${flagOf(p.nation)} ${esc(p.name)}`;
}

function concludeMatch() {
  const entry = current.entry, { m } = entry.live;
  const ps = matchPlayers(entry, m);
  const me = m.a === 0 ? 0 : 1, op = 1 - me;
  const slot = inQual(entry) ? entry.qual.slot : entry.rounds[roundIndex(entry)].find(x => x.a === m.a && x.b === m.b);
  record(slot, m);
  const opp = ps[op];
  entry.matches.push({
    round: roundLabel(entry), won: m.winner === me, score: scoreLine(m, me),
    opponent: { name: opp.name, nation: opp.nation, seed: opp.seed, age: opp.age, temperament: opp.temperament, hand: opp.hand || 'right', atpRank: opp.atpRank },
    plan: planOf(ps[me]), oppPlan: planOf(opp),
    sets: m.sets.map(s => ({ games: [s.games[me], s.games[op]], tb: s.tb && [s.tb[me], s.tb[op]],
      blown: s.blown && { you: s.blown.who === me, lead: s.blown.lead } })),
    stats: m.stats[me], oppStats: m.stats[op],
    moments: m.moments.map(x => ({ set: x.set, who: x.who === me ? 'you' : 'opponent', kind: x.kind, label: x.label, text: x.text, effect: x.effect })),
  });
  // Head-to-head and the tour's memory of this opponent.
  const rec = entry.matches[entry.matches.length - 1];
  if (m.styles) rec.styles = [m.styles[me], m.styles[op]];
  if (m.rally) rec.rally = { sum: m.rally.sum, n: m.rally.n, long: [m.rally.long[me], m.rally.long[op]], short: [m.rally.short[me], m.rally.short[op]] };
  const myCalls = (m.callLog || []).filter(x => x.side === me);
  if (myCalls.length) rec.calls = { made: myCalls.length, won: myCalls.filter(x => x.won).length };
  // Set-break plan changes, and how the sets after each one went.
  const adj = entry.live.adjusts || [];
  if (adj.length) rec.adjusts = adj.map((a, i) => {
    const until = i + 1 < adj.length ? adj[i + 1].after : rec.sets.length;
    const after = rec.sets.slice(a.after, until);
    return { ...a, won: after.filter(st => st.games[0] > st.games[1]).length, lost: after.filter(st => st.games[0] < st.games[1]).length };
  });
  const mo = moraleFor(current.career, current.player, eventOf(entry), opp, entry);
  rec.moraleTags = mo.tags.slice().sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 2).map(t => ({ text: t.text, v: t.v }));
  const wasBogey = opp.id && current.career.h2h && current.career.h2h[opp.id] && current.career.h2h[opp.id].l >= 3 && current.career.h2h[opp.id].l >= current.career.h2h[opp.id].w + 2;
  const hh = h2hRecord(current.career, opp, rec, eventOf(entry));
  if (wasBogey && rec.won) current.career.exorcised = current.career.week;
  if (hh) { rec.h2h = { w: hh.h.w, l: hh.h.l }; rec.newRival = hh.newRival; rec.opponent.id = opp.id; writeJSON(CAREER_KEY, current.career); }
  entry.live.done = true;
}

function renderMatch() {
  const entry = current.entry, { m, log, done } = entry.live, ev = eventOf(entry);
  const ps = matchPlayers(entry, m);
  const me = m.a === 0 ? 0 : 1, op = 1 - me;
  $('mTitle').textContent = `${roundLabel(entry)} · ${ev.city} ${tierLabel(ev.tier)}`;
  $('mMeta').textContent = `${surfaceLabel(ev.surface)}${ev.indoor ? ' · Indoor' : ''}${ev.weather ? ` · ${wxLabel(ev)}` : ''}`;
  const opp = ps[op];
  $('mOpp').textContent = `Opponent: ${opp.atpRank ? `ATP #${opp.atpRank} · ` : ''}age ${opp.age} · ${lefty(opp) ? 'left-handed' : 'right-handed'}${opp.seed ? ` · No. ${opp.seed} seed` : ''}`;

  const shown = anim.running && !anim.live ? log.slice(0, -1) : log;
  $('mLog').innerHTML = shown.length ? shown.map(l => `<li>${l}</li>`).join('') : '<li class="hint">Match about to start.</li>';

  // GATAH VISION plays at real pace, so no speed buttons there.
  const speeds = Court.view === 'gatah' ? '<div class="gvtag">Real time</div>' : `<div class="seg speed">${[1, 2, 4].map(x =>
    `<button type="button" data-speed="${x}" class="${x === anim.speed ? 'on' : ''}">${x}×</button>`).join('')}</div>`;

  const btn = (id, label, ghost) => `<button type="button" class="btn${ghost ? ' ghost' : ''}" id="${id}">${label}</button>`;

  $('mCtl').innerHTML = '';
  $('mCourtWrap').classList.toggle('paused', anim.paused);
  if (anim.running) {
    // While a set plays, its controls sit on the court itself.
    $('mActions').innerHTML = '';
    if (anim.watching) {
      $('mCtl').innerHTML = `${btn('mPause', anim.paused ? '▶ Resume' : '❚❚ Pause')}${btn('mSkip', '⏭ Skip Set', true)}${btn('mAll', '⏩ Sim to End', true)}${speeds}`;
      $('mPause').onclick = () => { anim.paused = !anim.paused; $('mPause').textContent = anim.paused ? '▶ Resume' : '❚❚ Pause'; $('mCourtWrap').classList.toggle('paused', anim.paused); };
      $('mAll').onclick = () => { anim.watching = false; anim.paused = false; anim.finishAfter = true; Court.skip = true; };
    } else {
      $('mCtl').innerHTML = `${btn('mSkip', '⏭ Skip Set', true)}${speeds}`;
    }
    $('mSkip').onclick = () => { anim.paused = false; Court.skip = true; };
  } else {
    const row = i => {
      const cells = m.sets.map(s => {
        const w = s.games[i] > s.games[1 - i];
        return `<td class="${w ? 'w' : ''}">${s.games[i]}${s.tb ? `<sup>${s.tb[i]}</sup>` : ''}</td>`;
      }).join('');
      return `<tr><th>${playerLabel(ps, i, me)}${m.winner === i ? ' ✓' : ''}</th>${cells}</tr>`;
    };
    $('mBoard').innerHTML = row(me) + row(op);
    Court.reset(me === 0 ? m.server : 1 - m.server);
    Court.draw();
    $('mMood').textContent = '';

    if (done) {
      const won = m.winner === me;
      setCall(won ? 'Game, set and match — You' : `Game, set and match — ${shortName(opp)}`, 'big');
      $('mActions').innerHTML =
        `<div class="top ${won ? 'good' : 'bad'}">${won ? 'You won' : 'You lost'} ${scoreLine(m, me)}</div>` +
        `<button type="button" class="btn" id="mDone">Continue</button>`;
      $('mDone').onclick = () => wrapUpMatch(entry);
      return;
    }
    if (!m.sets.length) setCall(`${shortName(ps[m.server])} to serve`, 'pre');

    const simAll = async () => { while (!entry.live.done) await playOneSet(false); };
    const mode = entry.live.mode;
    // Set break: up or down, you can change your plan for the rest of the match.
    const setBreak = () => {
      const won = m.sets.filter(x => x.games[me] > x.games[op]).length, lost = m.sets.length - won;
      return `<div class="planline setbreak"><span><b>Set break · ${won > lost ? `You lead ${won}–${lost}` : won < lost ? `You trail ${won}–${lost}` : `${won}–${lost}`}</b>` +
        `<small>${planSummary(planOf(ps[me]))}</small></span><button type="button" class="btn ghost small" id="mAdj">Adjust plan</button></div>`;
    };
    const bindBreak = () => { if ($('mAdj')) $('mAdj').onclick = () => openSetAdjust(entry); };
    if (!mode) {
      // Before the first ball: how do you want to play this one?
      $('mActions').innerHTML = `<h2 class="choose">How do you want to play this match?</h2><div class="modes">` +
        [['watch', '🎾', 'Watch Live', 'Every point played out on court'],
         ['sets', '⏭️', 'Set by Set', 'Sim one set at a time'],
         ['full', '⚡', 'Full Match', 'Straight to the result']].map(([k, icon, t, d]) =>
          `<button type="button" class="mode" data-mode="${k}"><span>${icon}</span><b>${t}</b><small>${d}</small></button>`).join('') +
        `</div>` +
        scoutCard(opp, ev, ps[me], eventPlan(entry), { planBtn: 'mPlan' });
      if ($('coachUse')) $('coachUse').onclick = () => {
        Object.assign(eventPlan(entry), coachPlan(opp, ev, ps[me]));
        saveEventPlan(entry);
        ps[me].plan = { ...entry.plan };
        renderMatch();
      };
      $('mPlan').onclick = () => {
        openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
          `<h2 class="itop">Game plan vs ${esc(opp.name)}</h2>` +
          `<p class="hint center">Changes apply for the rest of this tournament. Your default plan on Home stays as it is.</p>` +
          scoutHtml(opp) +
          `<div id="pmPlan" class="plan"></div><button type="button" class="btn" id="pmDone">Done</button>`,
          { onClose: renderMatch, wide: true });
        planEditor($('pmPlan'), eventPlan(entry), () => saveEventPlan(entry));
        $('pmDone').onclick = closeModal;
        $('mx').onclick = closeModal;
      };
      $('mActions').querySelectorAll('[data-mode]').forEach(b => {
        b.onclick = () => {
          entry.live.mode = b.dataset.mode;
          writeJSON(ENTRY_KEY, entry);
          if (entry.live.mode === 'watch') watchMatch();
          else if (entry.live.mode === 'full') simAll();
          else renderMatch();
        };
      });
    } else if (mode === 'watch') {
      $('mActions').innerHTML = (m.sets.length ? setBreak() : '') +
        `<div class="btn-row three">${btn('mWatch', m.sets.length ? `Watch Set ${m.sets.length + 1}` : 'Resume Watching')}${btn('mAll', 'Sim to End', true)}${speeds}</div>`;
      bindBreak();
      $('mWatch').onclick = watchMatch;
      $('mAll').onclick = simAll;
    } else {
      $('mActions').innerHTML = (m.sets.length ? setBreak() : '') + `<div class="btn-row four">${btn('mSet', `Sim Set ${m.sets.length + 1}`)}` +
        `${btn('mWatchSet', `Watch Set ${m.sets.length + 1}`, true)}${btn('mAll', 'Sim to End', true)}${speeds}</div>`;
      bindBreak();
      $('mSet').onclick = () => playOneSet(false);
      $('mWatchSet').onclick = () => playOneSet(true);
      $('mAll').onclick = simAll;
    }
  }
  $('mStage').querySelectorAll('[data-speed]').forEach(b => {
    b.onclick = () => {
      anim.speed = +b.dataset.speed;
      writeJSON(SPEED_KEY, anim.speed);
      $('mStage').querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', +x.dataset.speed === anim.speed));
    };
  });
}

// Set-break plan change (this match only). A new plan is fresh: the opponent hasn't worked it out,
// but how well it comes off is rolled again, so changing a plan that's clicking is a gamble.
function openSetAdjust(entry) {
  const { m } = entry.live, ps = matchPlayers(entry, m), me = m.a === 0 ? 0 : 1, opp = ps[1 - me];
  const before = JSON.stringify(planOf(ps[me]));
  const pl = { ...planOf(ps[me]) };
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<h2 class="itop">Set break: adjust your plan</h2>` +
    `<p class="hint center">Applies for the rest of this match. A new plan resets what ${esc(shortName(opp))} has figured out, but it might click or flop.</p>` +
    scoutHtml(opp) + `<div id="saPlan" class="plan"></div><button type="button" class="btn" id="saDone">Back to the match</button>`,
    { wide: true, onClose: () => {
      if (JSON.stringify(pl) !== before) {
        // Remember the change so the match story can say whether it worked.
        const old = JSON.parse(before);
        entry.live.adjusts = [...(entry.live.adjusts || []), { after: m.sets.length,
          changes: GAME_PLAN.filter(g => pl[g.key] !== old[g.key]).map(g => `${g.label.toLowerCase()} to ${planLabel(g.key, pl[g.key])}`),
          score: m.sets.map(st => `${st.games[me]}-${st.games[1 - me]}`).join(' ') }];
        ps[me].plan = { ...pl };
        m.exec[me] = rollExec(ps[me]);
        entry.live.log.push(`🔄 <b>Set break:</b> you changed your plan. ${planSummary(pl)}`);
        writeJSON(ENTRY_KEY, entry);
      }
      renderMatch();
    } });
  planEditor($('saPlan'), pl, () => {});
  $('saDone').onclick = closeModal;
  $('mx').onclick = closeModal;
}

// --- Post-match review: match story + one tactical adjustment ---------------

const FOCUS_GAIN = 0.0043; // older matches
// Each match's adjustment improves its stats by 0.75–1%, rolled once per match.
const WATCH_BONUS = 0.02;
const WATCH_GAMES = 3;
const totalGain = rec => (matchGain(rec) + (rec.watchBonus || 0)) * (rec.fullWatch ? 3 : 1);
const matchGain = rec => rec.gain || (rec.gain = Math.round((0.0075 + Math.random() * 0.0025) * 10000) / 10000);
const attrLabel = k => ATTRS.find(([key]) => key === k)[1];

function openReview() {
  current.pick = null;
  renderReview();
  showScreen('review');
}

function renderReview() {
  const entry = current.entry, ev = eventOf(entry), rec = entry.matches[entry.review];
  const player = current.player;
  if (!rec.story) {
    rec.story = matchStory(rec, ev, player);
    writeJSON(ENTRY_KEY, entry);
  }
  $('rTitle').textContent = rec.won ? 'You won' : 'You lost';
  $('rTitle').className = rec.won ? 'good' : 'bad';
  $('rMeta').textContent = `${rec.score} · ${ROUND_LONG[rec.round]} · ${ev.city} ${tierLabel(ev.tier)} · vs ${rec.opponent.name}`;
  $('rStory').innerHTML = rec.story.map(p => `<p>${p}</p>`).join('');
  // A good chunk of the story shows; the rest opens on tap.
  $('rStoryBox').classList.add('clip');
  $('rMore').textContent = 'Read the full story ▾';
  $('rMore').onclick = () => {
    const open = $('rStoryBox').classList.toggle('clip') === false;
    $('rMore').textContent = open ? 'Show less ▴' : 'Read the full story ▾';
  };
  // Full match stats right on the page, under the story.
  const sections = statSections(rec);
  $('rFullStats').innerHTML = sections
    ? `<div class="rs-key"><span>You</span><span>${esc(shortName(rec.opponent))}</span></div>` +
      sections.map(([title, rows]) => `<h3 class="ssec">${title}</h3>${rows.map(statRow).join('')}`).join('')
    : '<p class="hint">No detailed stats for this match.</p>';

  if (!rec.ideas) {
    rec.ideas = offerIdeas(rec, ev);
    writeJSON(ENTRY_KEY, entry);
  }
  $('rFull').onclick = () => openMatchStats({ rec, ev, week: current.career.week });
  $('rSave').textContent = '📈 Choose your post-match adjustment';
  $('rSave').onclick = openIdeas;
}

// Applies the training gains for good, to the saved player and to you in this draw.
function saveReview() {
  const entry = current.entry, player = current.player, rec = entry.matches[entry.review];
  const idea = IDEAS.find(x => x.id === current.pick);
  for (const k of idea.stats) {
    applyGain(player.attrs, k, totalGain(rec));
    entry.entrants[0].attrs[k] = player.attrs[k];
  }
  player.playstyle = detectStyles(player.attrs, player.fav)[0].name;
  rec.adjustment = idea.id;
  entry.review = null;
  writeJSON(SAVE_KEY, player);
  writeJSON(ENTRY_KEY, entry);
  $('cStyle').textContent = player.playstyle;
  openDraw();
}

// --- GATAH VISION: point list and replays -------------------------------------------

const ReplayCourt = createCourt();
const HL_ICON = { zoom: '⭐', shake: '⚡' };

// Every point watched this match, by score, newest last. Click one to replay it.
// Every point watched this match, grouped by set and game (one row per game). Click a point to replay it.
function renderPoints() {
  const box = $('mPoints');
  const on = Court.view === 'gatah';
  box.hidden = !on;
  if (!on) return;
  const list = anim.replays || [];
  if (!list.length) { box.innerHTML = '<p class="hint">Points you watch appear here. Click one to replay it from another angle.</p>'; return; }
  // Group: set -> game -> points (keeping each point's index for replay).
  const sets = [];
  list.forEach((r, i) => {
    let st = sets.find(x => x.set === r.set);
    if (!st) sets.push(st = { set: r.set, games: [] });
    const key = r.gameNo ?? 0;
    let g = st.games.find(x => x.key === key);
    if (!g) st.games.push(g = { key, pts: [] });
    g.pts.push({ r, i });
  });
  box.innerHTML = sets.map(st => `<div class="pset">Set ${st.set}</div>` + st.games.map(g => {
    const first = g.pts[0].r, last = g.pts[g.pts.length - 1].r;
    const title = first.tb ? 'Tiebreak' : `Game ${g.key}`;
    const sub = first.tb ? '' : `<small>${esc(first.server || '')} serving</small>`;
    const result = last.gameEnd
      ? `<span class="pres${last.broke ? ' brk' : ''}">${last.game} · ${esc(last.winner || '')} ${last.tb ? 'won the tiebreak' : last.broke ? 'broke' : 'held'}</span>` : '';
    const chips = g.pts.map(({ r, i }) =>
      `<button type="button" class="pchip${r.highlight ? ' hl' : ''}" data-i="${i}" title="${esc(r.call || (r.gameEnd ? 'Game point' : ''))}">` +
      `${r.highlight ? HL_ICON[r.highlight] + ' ' : ''}${r.gameEnd ? (r.tb ? 'TB' : 'Game') : r.label}</button>`).join('');
    return `<div class="pgame"><div class="plabel2"><b>${title}</b>${sub}</div><div class="pchips">${chips}</div>${result}</div>`;
  }).join('')).join('');
  box.scrollTop = box.scrollHeight;
  box.onclick = e => { const b = e.target.closest('[data-i]'); if (b) openReplay(+b.dataset.i); };
}

function openReplay(i) { playClips(anim.replays, i, Court.sceneArgs()); }

// Plays a list of points (live replays or saved highlights) with angle and speed controls.
function playClips(list, i, scene, heading) {
  const r = list[i];
  if (!r) return;
  let ang = readJSON('tourlife.replayAngle') || 'broadcast', slow = 1;
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<h2 class="itop">${heading ? esc(heading) : `Replay · Set ${r.set} · ${r.game}`}</h2>` +
    `<p class="hint center">${list.length > 1 ? `${i + 1} of ${list.length} · ` : ''}${esc(r.desc || r.call || '')}</p>` +
    `<div class="rpbar"><div class="seg four" id="rpAngle">${[['broadcast', 'Broadcast'], ['reverse', 'Reverse'], ['side', 'Side'], ['top', 'Top-down'], ['fps', 'POV: You'], ['fps2', 'POV: Opp']]
      .map(([v, l]) => `<button type="button" data-v="${v}" class="${v === ang ? 'on' : ''}">${l}</button>`).join('')}</div>` +
    `<div class="seg two" id="rpSpeed"><button type="button" data-s="1" class="on">Real time</button><button type="button" data-s="2.5">Slow-mo</button></div></div>` +
    `<canvas id="rpCourt" class="court"></canvas>` +
    `<div class="btn-row three"><button type="button" class="btn ghost" id="rpPrev">‹ Previous</button>` +
    `<button type="button" class="btn" id="rpPlay">Replay</button><button type="button" class="btn ghost" id="rpNext">Next ›</button></div>`,
    { wide: true, onClose: () => { ReplayCourt.skip = true; } });
  ReplayCourt.skip = false;
  ReplayCourt.mount($('rpCourt'));
  ReplayCourt.setOptions({ showType: true, showWing: true, ...readJSON(LABELS_KEY) });
  ReplayCourt.setAngle(ang);
  const [surf, indoor, names, prof] = scene;
  ReplayCourt.scene(surf, indoor, names, prof);
  let playing = false;
  const run = async () => {
    if (playing) { ReplayCourt.skip = true; await new Promise(res => setTimeout(res, 30)); }
    ReplayCourt.skip = false;
    playing = true;
    await ReplayCourt.play(r.script, { real: true, slow, cinematic: true });
    playing = false;
  };
  $('rpAngle').onclick = e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    ang = b.dataset.v; writeJSON('tourlife.replayAngle', ang);
    $('rpAngle').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    ReplayCourt.setAngle(ang); run();
  };
  $('rpSpeed').onclick = e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    slow = +b.dataset.s;
    $('rpSpeed').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    run();
  };
  $('rpPlay').onclick = run;
  $('rpPrev').onclick = () => { ReplayCourt.skip = true; if (i > 0) playClips(list, i - 1, scene, heading); };
  $('rpNext').onclick = () => { ReplayCourt.skip = true; if (i < list.length - 1) playClips(list, i + 1, scene, heading); };
  $('mx').onclick = closeModal;
  run();
}

// GATAH VISION camera bar: angle and real time / slow-mo for the live match (only shown in that view).
const GV_KEY = 'tourlife.gvcam';
function renderGvBar() {
  const bar = $('mGvBar'), spd = $('mGvSpeed');
  const on = Court.view === 'gatah';
  bar.hidden = spd.hidden = !on;
  const cam = { angle: 'broadcast', slow: 1, ...readJSON(GV_KEY) };
  if (!on) return;
  Court.setAngle(cam.angle === 'broadcast' ? null : cam.angle);
  Court.setSlow(cam.slow);
  // GATAH camera angles join the view list on the left; real time / slow-mo sits on the right.
  bar.innerHTML = [['broadcast', 'Broadcast'], ['reverse', 'Reverse'], ['side', 'Side'], ['top', 'Top-down'], ['fps', 'POV: You'], ['fps2', 'POV: Opp']]
    .map(([v, l]) => `<button type="button" data-v="${v}" class="${v === cam.angle ? 'on' : ''}">${l}</button>`).join('');
  spd.innerHTML = [[1, 'Real time'], [2.5, 'Slow-mo']]
    .map(([v, l]) => `<button type="button" data-s="${v}" class="${v === cam.slow ? 'on' : ''}">${l}</button>`).join('');
  spd.onclick = e => bar.onclick(e);
  bar.onclick = e => {
    const a = e.target.closest('[data-v]'), sp = e.target.closest('[data-s]');
    if (a) cam.angle = a.dataset.v;
    if (sp) cam.slow = +sp.dataset.s;
    if (!a && !sp) return;
    writeJSON(GV_KEY, cam);
    renderGvBar();
  };
}
