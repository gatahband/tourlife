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

// Saving must never fail silently. If the browser's storage is full, space is freed (caches, backups, the
// fine detail of old seasons' matches) and the write retried. Anything that still can't be written is kept
// in memory (PENDING), so the game never falls back to an older copy, and you're warned straight away with a
// button to download your progress.
const PENDING = {};
function readJSON(key) {
  if (key in PENDING) { try { return JSON.parse(PENDING[key]); } catch { return null; } }
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function writeJSON(key, val) {
  if (val === null) { delete PENDING[key]; try { localStorage.removeItem(key); } catch {} if (typeof idbPut === 'function') idbPut(key, null); return true; }
  if (typeof idbPut === 'function') idbPut(key, JSON.stringify(val)); // mirrored to the large backup store first (safety.js)
  for (let step = 0; step < 6; step++) {
    const text = JSON.stringify(val);
    try { localStorage.setItem(key, text); delete PENDING[key]; if (window.saveFailed && !Object.keys(PENDING).length) window.saveFailed = false; return true; }
    catch {
      PENDING[key] = text;
      if (!freeSpace(step, key, val)) break;
    }
  }
  window.saveFailed = true;
  saveFailedWarning();
  return false;
}
// Make room, least important first. Never deletes a career: only caches, spare backups and old match detail.
function freeSpace(step, key, val) {
  try {
    if (step === 0) { for (const k of ['tourlife.odds', 'tourlife.replayAngle']) localStorage.removeItem(k); const b = readJSON('tourlife.backups'); if (b && b.length > 2) localStorage.setItem('tourlife.backups', JSON.stringify(b.slice(-2))); return true; }
    if (step === 1) { // old seasons' matches keep their result but drop point-by-point detail, in every saved career
      const saves = readJSON(SAVES_KEY) || [];
      for (const sv of saves) if (sv.career) { compactHistory(sv.career); if (sv.career.highlights) sv.career.highlights = sv.career.highlights.slice(-4); }
      localStorage.setItem(SAVES_KEY, JSON.stringify(saves)); return true;
    }
    if (step === 2) { localStorage.removeItem('tourlife.backups'); return true; }
    if (step === 3 && val && val.history) { compactHistory(val); if (val.highlights) val.highlights = val.highlights.slice(-6); return true; }
    if (step === 4) { const c = readJSON(CAREER_KEY); if (c && c.history && key !== CAREER_KEY) { compactHistory(c); c.highlights = (c.highlights || []).slice(-6); localStorage.setItem(CAREER_KEY, JSON.stringify(c)); } return true; }
  } catch {}
  return step < 5;
}
// A red bar pinned to the top of the screen (nothing can cover it) until progress saves again.
function saveFailedWarning() {
  if (document.getElementById('saveBar')) return;
  const bar = document.createElement('div');
  bar.id = 'saveBar';
  bar.innerHTML = `<b>⚠️ Progress can't be saved: this browser's storage is full.</b><span>Nothing is lost while this page stays open. Download it now, before closing or refreshing.</span>` +
    `<button type="button" id="sfSave">⬇️ Download my progress</button>`;
  document.body.appendChild(bar);
  bar.querySelector('#sfSave').onclick = () => { if (typeof saveProgress === 'function') saveProgress(); };
  // Keep trying quietly; the bar goes away once everything is saved.
  const retry = setInterval(() => {
    for (const k of Object.keys(PENDING)) { try { localStorage.setItem(k, PENDING[k]); delete PENDING[k]; } catch {} }
    if (!Object.keys(PENDING).length) { window.saveFailed = false; bar.remove(); clearInterval(retry); }
  }, 15000);
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
  if (name !== 'match') leaveFullscreen();
  for (const id of ['creator', 'home', 'draw', 'match', 'review', 'train', 'admin']) $(id).hidden = id !== name;
  window.scrollTo(0, 0);
  if (typeof renderStudyBtn === 'function' && current.career) renderStudyBtn(current.career);
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
  if (typeof backupLive === 'function') backupLive('Before switching careers');
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
  const gone = loadSaves().find(x => x.id === id);
  if (gone && typeof autoBackup === 'function') autoBackup(gone, 'Before deleting a saved career');
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
  $('shareBuild').onclick = () => shareBuild(player);
  $('units').innerHTML = [['mph', 'mph'], ['kmh', 'km/h']].map(([v, l]) =>
    `<button type="button" data-v="${v}" class="${speedUnit() === v ? 'on' : ''}">${l}</button>`).join('');
  $('units').onclick = e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    writeJSON(UNITS_KEY, b.dataset.v);
    $('units').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  };
  // Playstyle card: tap to open the full build (same meters as the creator).
  const ranked = detectStyles(player.attrs, player.fav, planOf(player));
  const trait = traitOf(player);
  $('cStyle').textContent = ranked[0].name + (trait ? ` · ${trait.name}` : '');
  // The first bar in your build: your overall rating (out of the 99 maximum).
  $('hOvrVal').textContent = `${overall(player).toFixed(1)} OVR`;
  $('hTopFill').style.width = `${clamp(overall(player) / 99 * 100, 2, 100).toFixed(1)}%`;
  $('hTopDesc').textContent = ranked[0].desc + (trait ? ` ${trait.name}: ${trait.desc}` : '');
  $('hAttrs').innerHTML = ATTRS.map(([k, label]) => {
    const v = player.attrs[k] ?? 50;
    return `<div class="attr"><div class="lbl">${label}<b>${v.toFixed(2)}</b></div><div class="abar"><div style="width:${clamp(v, 0, 100)}%"></div></div></div>`;
  }).join('');
  $('hStyles').innerHTML = ranked.map((s, i) => {
    const pct = Math.round(s.score * 100);
    return `<li class="${i === 0 ? 'best' : ''}" tabindex="0"><span>${s.name}</span><div class="stip">${styleTip(s)}</div><div class="bar"><div style="width:${pct}%"></div></div><span>${pct}%</span></li>`;
  }).join('');

  renderOvr(player);
  renderRivals(c);
  renderBadges(c);
  homeSums(c, player);
  if (typeof renderStudyBtn === 'function') renderStudyBtn(c);
  if (typeof featureIntro === 'function') featureIntro(c, player);
  // How tired you are, right above the week's events (check it before you pick or enter one).
  $('hFatigue').innerHTML = fatigueBar(player.fatigue || 0);
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
      : goHomeHtml(c, current.player) + `<button type="button" class="link" id="trainWeek">Skip the tournaments and take a training week</button>`);
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
  if ($('goHome')) $('goHome').onclick = () => goHomeWeek();
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
  const odds = shifts.map((sh, si) => {
    let w = 0;
    for (let i = 0; i < N; i++) {
      const o = generateOpponent(pick(Math.random, Object.keys(REGION_OF)), ev.tier, Math.random, sh);
      const m = newMatch(0, 1);
      if (ev.tier === 'GS' && si >= qRounds) m.bestOf = 5;
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
    const st = styleOf(p).name, e = wxEdge(me, st, evx);
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
    (canEnter ? `<div class="shrow"><button type="button" class="btn small" data-confirm="${ev.id}" data-mode="${mode}">${wc ? `🎟️ Use a Wildcard (${c.perks.wildcards} Left)` : mode === 'qual' ? 'Enter Qualifying' : 'Enter This Event'}</button><button type="button" class="btn small ghost" data-close="1">Not This One</button></div>` : '') +
    weekBudgetHtml(c, ev, wc ? 'main' : mode, canEnter);
}

// The whole week's money before you commit: the trip (flights, hotel, your travelling team), your team's wages and
// your sponsors' pay (after your agent's cut). Prize money comes on top, by round reached.
function weekBudgetHtml(c, ev, mode, now) {
  const trip = tripCost(c, ev, mode), crew = crewTripCost(c, ev), wages = weeklyBill(c);
  const deals = activeDeals(c).filter(d => d.until >= c.week + (now ? 0 : 1));
  const spons = deals.reduce((a, d) => a + dealPay(c, d), 0), cut = hasTeam(c, 'agent') ? Math.round(spons * AGENT_CUT) : 0;
  const net = spons - cut - trip - wages, after = c.money + net;
  const line = (label, v, cls = '') => `<div class="wbrow ${cls}"><span>${label}</span><b>${v >= 0 ? '+' : '−'}${money(Math.abs(v))}</b></div>`;
  return `<div class="wkbudget"><div class="wbhead">💰 This Week's Money${now ? '' : ' (Next Week)'}</div>` +
    line(`✈️ Flights & Hotel${crew ? ' (Incl. Your Team)' : ''}`, -trip, 'down') +
    (wages ? line('👥 Team Wages', -wages, 'down') : '') +
    (spons ? line('🤝 Sponsors', spons, 'up') : '') +
    (cut ? line("💼 Agent's Cut", -cut, 'down') : '') +
    `<div class="wbrow total"><span>Week Total (Before Prize Money)</span><b class="${net < 0 ? 'down' : 'up'}">${net >= 0 ? '+' : '−'}${money(Math.abs(net))}</b></div>` +
    `<p class="hint">You have <b>${money(c.money)}</b> now. After this week you'd have <b class="${after < 0 ? 'down' : ''}">${money(after)}</b>, plus any prize money.${now ? '' : ' Simulated for a typical draw; it opens next week.'}</p></div>`;
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
// The event as it is today: the weather moves on with each round (qualifying days count too).
const eventOf = entry => {
  const e = entry.event || EVENTS.find(x => x.id === entry.id);
  if (!e || e.indoor || !entry.rounds) return e;
  const day = entry.qual ? (entry.qual.done ? entry.qual.need : entry.qual.round) : 0;
  return { ...e, weather: dayWeather(e, day + (entry.qual && !entry.qual.done ? 0 : entry.rounds.length - 1)) };
};
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
    // Played from a saved seed and snapshot, so anyone can watch it later from the draw (this event only).
    const ps = [entry.entrants[slot.a], entry.entrants[slot.b]], seed = (Math.random() * 4294967296) >>> 0, rng = seeded(seed);
    const bestOf = ev.tier === 'GS' ? 5 : 3;
    slot.replay = { seed, bestOf, side: 0, ps: JSON.parse(JSON.stringify(ps)),
      ev: { tier: ev.tier, surface: ev.surface, indoor: !!ev.indoor, weather: ev.weather || null, nation: ev.nation, city: ev.city } };
    const m = newMatch(0, 1, rng, true);
    m.bestOf = bestOf;
    let guard = 0;
    while (m.winner === null && guard++ < 7) playSet(m, ps, ev, rng);
    slot.winner = m.winner === 0 ? slot.a : slot.b;
    slot.score = scoreLine(m, 0);
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
    const e = entry.entrants[i], st = styleOf(e);
    return `<div class="vsside"><div class="vsname">${nameCell(entry, i)}</div><div class="vsstyle">${st.name}</div><small>${st.desc}</small></div>`;
  };
  return `<div class="vsbox">${side(0)}<div class="vsmid">vs</div>${side(oi)}</div>`;
}

// Before your next match, on the draw screen: scouting report, head-to-head, coach's report and your plan.
function prematchHtml(entry, oi) {
  const opp = entry.entrants[oi], ev = eventOf(entry);
  return scoutCard(opp, ev, entry.entrants[0], eventPlan(entry), { moraleData: moraleFor(current.career, current.player, ev, opp, entry), planBtn: 'dPlanBtn' });
}

// The whole pre-match report, laid out to read in seconds: the conditions, who they are, how to beat
// them, and your plan next to the coach's.
function scoutCard(opp, ev, me, plan, { moraleData = null, planBtn = 'dPlanBtn' } = {}) {
  const c = current.career, r = scoutReport(opp);
  const titleCase = t => t.replace(/(^|\s)\S/g, x => x.toUpperCase());
  const sec = (title, body) => `<section class="ssect"><h3>${title}</h3>${body}</section>`;
  const box = (title, items, cls) => `<div class="sbox ${cls}"><h4>${title}</h4>` +
    (items.length ? `<ul>${items.map(x => `<li>${x}</li>`).join('')}</ul>` : '<p class="hint">Nothing stands out.</p>') + `</div>`;

  const coach = hasTeam(c, 'coach'), lvl = coach ? teamLevel(c, 'coach') : 0;
  const near = v => lvl >= 3 ? Math.round(v) : Math.round(v / 2) * 2;
  const know = `<div class="sboxes">${box('💪 Strengths', r.strengths, 'up')}${box('🩹 Weaknesses', r.weaknesses, 'down')}</div>` +
    (hasPrep(current.entry, 'scout') ? scoutDetailHtml(opp) : '') + realStatsHtml(opp) +
    (r.tendencies.length ? `<h4 class="sh4">Their Habits</h4><div class="chips">${r.tendencies.map(t => `<span class="chip">${t}</span>`).join('')}</div>` : '') +
    (lvl >= 2 ? `<h4 class="sh4">Ratings (Your Coach's Read)</h4>${coachCompare(me, opp, near, lvl >= 3)}` : '');
  // How to beat them: nothing without a coach; better coaches see more (the Master adds the full scouting counters).
  const reads = coach ? coachReads(opp, ev, me).slice(0, COACH_READS[lvl]) : [];
  const beatLines = [...reads.map(x => x.why), ...(lvl >= 4 ? r.counters : [])];
  const beat = !coach ? '<p class="hint">🔒 Hire a coach to learn how to beat them. Better coaches see more.</p>'
    : beatLines.length ? `<ol class="beat">${beatLines.map(x => `<li>${x}</li>`).join('')}</ol>` : '<p class="hint">No obvious holes. Play your game.</p>';

  // Your plan, with the coach's suggestion beside each setting.
  const rec = coach ? coachPlan(opp, ev, me) : null, theirs = planOf(opp);
  const myRows = planRows(styleOf(me).name);
  const diffs = rec ? myRows.filter(g => (!g.coach || lvl >= g.coach) && rec[g.key] !== (plan[g.key] || DEFAULT_PLAN[g.key])) : [];
  const pv = k => plan[k] || DEFAULT_PLAN[k];
  const rows = myRows.filter(g => !g.coach || lvl >= g.coach).map((g, i, arr) => {
    const d = rec && rec[g.key] !== pv(g.key);
    return (g.coach && !(arr[i - 1] || {}).coach ? `<tr class="ptier"><th colspan="4">🎓 Master Coach Options</th></tr>` : '') + `<tr class="${d ? 'diff' : ''}"><th>${g.label}</th><td>${planLabel(g.key, pv(g.key))}</td>` +
      (coach ? `<td>${d ? `<b>${planLabel(g.key, rec[g.key])}</b>` : '<span class="ok">✓</span>'}</td>` : '') +
      (coach ? `<td class="them">${planLabel(g.key, theirs[g.key])}</td>` : '') + `</tr>`;
  }).join('');
  const table = `<table class="ptable"><thead><tr><th></th><td>You</td>${coach ? '<td>Coach says</td><td class="them">They play</td>' : ''}</tr></thead><tbody>${rows}</tbody></table>`;
  const tbNote = coach ? `<p class="hint">Your coach reads the stats. Copy the plan word for word and smart opponents read it faster, and some players have strengths no stat shows. Make it your own.</p>` : '';
  const note = !coach ? `<p class="hint coachtease">🧑‍🏫 Hire a coach (Home → Money &amp; Team) to see how they play and get a counter-plan.</p>`
    : diffs.length ? `<p class="coachsays">🧑‍🏫 ${titleCase(teamOf(c, 'coach').name)} suggests ${diffs.length} change${diffs.length === 1 ? '' : 's'} (highlighted).</p>`
    : `<p class="coachsays ok">🧑‍🏫 ${titleCase(teamOf(c, 'coach').name)}: Your plan is spot on for this one.</p>`;
  const btns = `<div class="pbtns">${diffs.length ? `<button type="button" class="btn" id="coachUse">Use the Coach's Plan</button>` : ''}` +
    `<button type="button" class="btn ghost" id="${planBtn}">Change My Plan</button></div>`;

  // Always on show: the three things that matter most. Everything else folds away with a one-line summary.
  const myStyle = styleOf(me).name, oppStyle = styleOf(opp).name;
  const short = t => t.length > 70 ? t.slice(0, 68).replace(/\s+\S*$/, '') + '…' : t;
  const facts = `<div class="keyfacts">` +
    `<div><span>💪</span><b>Strength</b><em>${r.strengths[0] || 'Nothing stands out'}</em></div>` +
    `<div><span>🩹</span><b>Weakness</b><em>${r.weaknesses[0] || 'No clear hole'}</em></div>` +
    `<div><span>🧑‍🏫</span><b>${coach ? 'Coach' : 'Tip'}</b><em>${coach ? (diffs.length ? `Suggests ${diffs.length} plan change${diffs.length === 1 ? '' : 's'}` : 'Your plan is spot on') : 'Hire a coach for a read on them'}</em></div></div>`;
  const pe = prepEdges(current.entry, opp);
  const tags = [...pe.tags, ...(rebuildPen(c) ? [`🔁 New build bedding in (${c.rebuild.weeks} week${c.rebuild.weeks === 1 ? '' : 's'} left)`] : [])];
  const prepTags = tags.length ? `<div class="preptags">${tags.map(t => `<span class="chip">${t}</span>`).join('')}</div>` : '';
  const mo = moraleData ? `${moraleWord(moraleData.edge, moraleData.cap)[0]} · ${moraleData.edge >= 0 ? '+' : '−'}${(Math.abs(moraleData.edge) * 100).toFixed(1)}% on points` : '';
  const scouted = hasPrep(current.entry, 'scout'), qn = quirksOf(opp).length;
  const wx = ev.weather && WEATHER[ev.weather] ? `${wxLabel(ev)} · ` : '';
  return `<div class="card scard"><div class="scouthead"><span>Scouting report</span><h2 class="sname">${esc(opp.name)}${opp.atpRank ? ` <small>ATP #${opp.atpRank}</small>` : ''}${isLegend(opp) ? ' <em class="legend">👑 Legend</em>' : ''}</h2>${r.trait ? `<small class="strait">${esc(styleOf(opp).name)} · ${esc(r.trait)}</small>` : ''}</div>` +
    (isLegend(opp) ? `<p class="legendnote">A former world No. 1. Legends adjust to your plan far faster than you can adjust to theirs. A textbook plan won't last a set; bring one of your own. Beating a legend is worth a lot of experience.</p>` : '') +
    h2hLine(c, opp) + facts + rivalPrepHtml(c, opp, { ...DEFAULT_PLAN, ...plan, ...(typeof advPlan === 'function' ? advPlan({ ...me, isPlayer: true, advLevel: teamLevel(c, 'coach'), plan: { ...DEFAULT_PLAN, ...plan } }) : {}) }) + prepTags +
    (moraleData ? fold('d-morale', '🧠 Morale', mo, moraleHtml(moraleData)) : '') +
    fold('d-cond', '🌤️ Conditions & Matchup', `${wx}${myStyle} vs ${oppStyle}`, weatherHtml(ev, me, opp) + matchupHtml(me, opp)) +
    fold('d-know', '🔍 Know Your Opponent', `${r.strengths.length} strength${r.strengths.length === 1 ? '' : 's'} · ${r.weaknesses.length} weakness${r.weaknesses.length === 1 ? '' : 'es'}${scouted ? ` · ${qn} hidden` : ''}`, know) +
    fold('d-beat', '🎯 How To Beat Them', coach ? esc(short(beatLines[0] || 'No obvious holes')) : '🔒 Needs a coach', beat) +
    fold('d-plan', '📋 Your Game Plan', coach && diffs.length ? `Coach suggests ${diffs.length} change${diffs.length === 1 ? '' : 's'}` : esc(short(planSummary({ ...DEFAULT_PLAN, ...plan }))),
      videoPlanHtml(c, opp, plan) + note + table + tbNote + btns) + `</div>`;
}

function bindPrematch(entry, oi, rerender) {
  const opp = entry.entrants[oi], ev = eventOf(entry);
  bindRealMatches(document);
  if ($('vidUse')) $('vidUse').onclick = () => {
    const v = current.career.videoPlans[opp.id], lv = teamLevel(current.career, 'coach');
    for (const g of GAME_PLAN) if ((!g.coach || lv >= g.coach) && v.plan[g.key]) eventPlan(entry)[g.key] = v.plan[g.key];
    saveEventPlan(entry); rerender();
  };
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
// Simulating plays you on autopilot: −4% on points, so a simmed match only goes your way if you're clearly
// the better player. Watching three full games of the match earns full credit (no autopilot cost after that).
const SIM_PEN = 0.04, STUCK_PEN = 0.02;
const watchCredit = entry => (entry.live.gamesWatched || 0) >= WATCH_GAMES || (entry.live.goodReads || 0) >= 2;
// Autopilot streak: matches in a row you simmed without watching (career.autopilot). The longer it runs,
// the flatter you play (up to −10% on points) and the less you learn, until you stop improving at all.
const autopilotOf = () => (current.career && current.career.autopilot) || 0;
const simPen = () => SIM_PEN + 0.01 * Math.min(6, autopilotOf());
const autopilotGrowth = ap => Math.max(0, 1 - ap / 5);
function autopilotPenalty(entry, watching) {
  const { m } = entry.live, me = m.a === 0 ? 0 : 1;
  let pen = (watching || watchCredit(entry) ? 0 : simPen()) + rustOf(current.career);
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
  // Watching bonus: up to +0.6% on top of the adjustment, for the share of points you watched.
  if (rec) {
    rec.watched = entry.live.total ? Math.min(1, (entry.live.watched || 0) / entry.live.total) : 0;
    // Watch credit: the full +0.6% for watching 3 whole games (a third of it per game); watch every point
    // of the match and the whole match's growth is tripled.
    rec.gamesWatched = entry.live.gamesWatched || 0;
    rec.goodReads = entry.live.goodReads || 0; rec.reads = (entry.live.reads || []).length;
    if (rec.goodReads >= 2) rec.gamesWatched = Math.max(rec.gamesWatched, WATCH_GAMES); // two good reads count as watching
    rec.fullWatch = !!entry.live.total && (entry.live.watched || 0) >= entry.live.total;
    rec.watchBonus = Math.round(WATCH_BONUS * Math.min(1, rec.gamesWatched / WATCH_GAMES) * 10000) / 10000;
    // The autopilot streak going into this match (it shapes this match's growth), then update it:
    // a watched match clears it, a mid-match plan change eases it, a pure sim adds to it.
    const c = current.career;
    rec.autopilot = c.autopilot || 0;
    if (rec.gamesWatched >= WATCH_GAMES) c.autopilot = 0;
    else if ((entry.live.adjusts || []).length || (entry.live.calls || []).some(x => x.id === 'plan')) c.autopilot = Math.max(0, (c.autopilot || 0) - 1);
    else c.autopilot = (c.autopilot || 0) + 1;
  }
  p.fatigue = clamp((p.fatigue || 0) + (10 + (rec ? Math.max(0, rec.sets.length - 2) * 5 : 0)) * ({ hustle: 1.3, conserve: 0.75 }[advPlan({ ...entry.entrants[0], isPlayer: true, advLevel: teamLevel(current.career, 'coach') }).energy] || 1) * staminaFactor(p) * (1 + (wxOf(eventOf(entry)).heat - 1) * 0.4) * (hasPrep(entry, 'pcfit') ? 0.8 : 1) * (teamOf(current.career, 'fitness').fatigue || 1), 0, 100);
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
  $('dPlanTitle').textContent = `📋 Game Plan for ${ev.city}`;
  $('sumWeekPlan').textContent = planSummary({ ...DEFAULT_PLAN, ...eventPlan(entry) }).split(' · ').slice(0, 3).join(' · ');
  { const left = entry.rounds[entry.rounds.length - 1]; $('sumBracket').textContent = `${ROUND_NAMES[entry.rounds.length - 1] || ''} · ${left.length * 2} players left`; }
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
      (entry.live || dayEvent(entry) ? '' : `<div class="drawfat">${fatigueBar(current.player.fatigue || 0)}</div>`) +
      (entry.live ? '' : dayEventHtml(entry)) +
      (entry.live ? '' : prepHtml(entry, entry.entrants[opp])) +
      (entry.live ? '' : prematchHtml(entry, opp)) +
      (entry.live ? '' : checkInHtml(current.player)) +
      `<button type="button" class="btn" id="dPlay">${entry.live ? 'Resume Match' : 'Play Match'}</button>` +
      (entry.live ? '' : `<div class="center"><button type="button" class="link" id="dWithdraw">Withdraw from the tournament</button></div>`);
    $('dPlay').onclick = () => openMatch();
    if (!entry.live) { bindPrematch(entry, opp, renderDraw); bindPrep(entry, renderDraw); bindDayEvent(entry, renderDraw); }
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
    const both = isLegend(entry.entrants[s.a]) && isLegend(entry.entrants[s.b]);
    const watch = s.replay ? `<button type="button" class="btn small ghost dlwatch${both ? ' legend' : ''}" data-rw="${current.tab}-${entry.rounds[current.tab].indexOf(s)}">▶ Watch${both ? ' 👑' : ''}</button>` : '';
    return `<div class="dl-match">${row(s.a, s.b)}${row(s.b, s.a)}${score}${watch}</div>`;
  }).join('');
  $('dList').onclick = e => {
    const b = e.target.closest('[data-rw]'); if (!b) return;
    const [r, k] = b.dataset.rw.split('-').map(Number), s = entry.rounds[r][k];
    const legends = isLegend(entry.entrants[s.a]) && isLegend(entry.entrants[s.b]);
    watchRealMatch({ replay: s.replay, round: ROUND_NAMES[r], event: `${ev.city} ${tierLabel(ev.tier)}` }, { neutral: true,
      onDone: () => { if (!legends) return; const c = current.career || loadCareer(); c.legendWatched = true; writeJSON(CAREER_KEY, c); checkBadges(c); } });
  };
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
  anim.noCalls = false; anim.noChangeovers = false;
  if (!entry.live) {
    const pm = playerMatch(entry), ev0 = eventOf(entry);
    // You carry this week's tiredness (and any early-arrival practice) into the match.
    entry.entrants[0].fatigue = current.player.fatigue || 0;
    entry.entrants[0].acclimated = !!entry.acclimated;
    entry.live = { m: newMatch(pm.a, pm.b, Math.random, true), log: [] };
    if (ev0.tier === 'GS' && !inQual(entry)) entry.live.m.bestOf = 5; // Slam main draws: best of five
    writeJSON(ENTRY_KEY, entry);
  }
  showScreen('match');
  if (!anim.mounted) {
    Court.mount($('court')); Court.setInfoEl($('mInfo')); anim.mounted = true;
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
  $('mView').innerHTML = [['broadcast', 'Broadcast'], ['top', 'Top-Down'], ['gatah', 'GATAH VISION']].map(([v, l]) =>
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
  $('mLabels').innerHTML = [['showType', 'Shot'], ['showWing', 'FH/BH']].map(([k, l]) =>
    `<label class="chk"><input type="checkbox" data-k="${k}" ${lab[k] ? 'checked' : ''}> ${l}</label>`).join('');
  $('mLabels').onchange = e => {
    const k = e.target.dataset.k;
    if (!k) return;
    lab[k] = e.target.checked;
    writeJSON(LABELS_KEY, lab);
    Court.setOptions(lab);
  };
  advTier = ev.tier; // tour-level computer players choose their own advanced plan
  const oth = p => ps[ps[0] === p ? 1 : 0];
  const profile = p => ({ ground: p.attrs.ground, adv: advPlan(p.isPlayer ? { ...p, advLevel: teamLevel(current.career, 'coach') } : p, oth(p)), real: !!p.atpRank && !p.isPlayer, legend: isLegend(p), hand: p.hand || 'right', backhand: p.backhand || 'two', iq: attr(p, 'iq'), net: p.attrs.net, plan: planOf(p),
    style: styleOf(p).name, trait: (traitOf(p) || {}).name });
  Court.scene(ev.surface, ev.indoor, ['You' + tag(ps[me]), shortName(ps[1 - me]) + tag(ps[1 - me])],
    [profile(ps[me]), profile(ps[1 - me])]);
  showPlanOnCourt({ ...ps[me], plan: { ...eventPlan(entry) }, isPlayer: true, advLevel: teamLevel(current.career, 'coach') });
  Court.setWeather(wxOf(ev), ev.weather === 'damp', { key: ev.indoor ? 'indoor' : ev.weather, altitude: altitudeOf(ev), speed: courtSpeed(ev), surface: ev.surface, label: ev.indoor ? '🏟️ Indoors' : ev.weather && WEATHER[ev.weather] ? `${WEATHER[ev.weather].icon} ${WEATHER[ev.weather].name}` : '' });
  renderGvBar();
  // Replays live in memory for the match on screen only.
  const key = `${entry.id}:${roundIndex(entry)}:${m.a}-${m.b}`;
  if (anim.replayKey !== key) { anim.replayKey = key; anim.replays = []; }
  renderPoints();
  renderMatch();
  // Came back mid-set (a refresh): pick the set up right where you left it.
  if (entry.live.inSet && entry.live.snap && !anim.running) watchMatch();
}

function matchPlayers(entry, m) {
  return [entry.entrants[m.a], entry.entrants[m.b]];
}

// Plays the next set in the engine, logs its summary, then (optionally) replays it on court.
const wait = ms => new Promise(r => setTimeout(r, ms));
// Fades the court out (Read The Match between live moments) or back in, so nothing snaps.
async function courtFade(out) {
  const w = $('mCourtWrap');
  if (!w || w.classList.contains('covered') === out) return;
  w.classList.toggle('covered', out);
  await wait(out ? 450 : 550);
}

// Read The Match: while play goes fast after a Match Read, follow what your change is doing (the numbers it
// should move), point by point, under the spinner.
function trackerHtml(m, me, track, recap) {
  const head = recap ? `<span class="trrecap">${esc(recap)}</span>` : '';
  if (!track) return head;
  const pts = (m.points || []).slice(track.from), op = 1 - me, k = track.keys;
  if (!pts.length) return head;
  const won = pts.filter(p => p.w === me).length, items = [`Points Won <b>${won} of ${pts.length}</b>`];
  const cnt = f => pts.filter(f).length;
  if (k.includes('wing')) { const w = track.wing || 'neutral'; items.push(`Their ${w === 'fh' ? 'Forehand' : 'Backhand'} Errors <b>${cnt(p => p.w === me && (p.how === 'ue' || p.how === 'fe') && p.wing === (w === 'fh' ? 'fh' : 'bh'))}</b>`); }
  if (k.includes('net')) items.push(`Your Net Points <b>${cnt(p => p.net && p.net.by === me && p.w === me)}/${cnt(p => p.net && p.net.by === me)}</b>`);
  if (k.includes('drops')) items.push(`Your Drop Shots Won <b>${cnt(p => p.drop && p.drop.by === me && p.w === me)}/${cnt(p => p.drop && p.drop.by === me)}</b>`);
  if (k.includes('returnPos')) { const r = pts.filter(p => p.s === op); items.push(`Return Points Won <b>${r.filter(p => p.w === me).length}/${r.length}</b>`); }
  if (k.includes('serve')) { const s = pts.filter(p => p.s === me); items.push(`Your Serve Points Won <b>${s.filter(p => p.w === me).length}/${s.length}</b>`); }
  if (k.some(x => ['aggression', 'spin', 'depth', 'pressure', 'energy'].includes(x))) items.push(`Your Winners <b>${cnt(p => p.w === me && p.how === 'winner')}</b> · Errors <b>${cnt(p => p.w === op && p.how === 'ue')}</b>`);
  return `${head}<span class="trline"><i>${k.length ? 'Since Your Change' : 'Since You Kept Your Plan'}:</i> ${items.join(' · ')}</span>`;
}

// One line on a finished game for Read The Match (held or broken, how, and the score).
function gameRecap(pt, pts, ps, me) {
  const name = i => (i === me ? 'You' : shortName(ps[i])), held = pt.w === pt.s, g = pt.games;
  const lastGame = pts.slice(-6), aces = lastGame.filter(p => p.how === 'ace' && p.s === pt.s).length, dfs = lastGame.filter(p => p.how === 'df').length;
  const how = pt.how === 'ace' ? 'with an ace' : pt.how === 'winner' ? 'with a winner' : pt.how === 'ue' ? `on a ${name(1 - pt.w) === 'You' ? 'your' : 'their'} error` : pt.how === 'df' ? 'on a double fault' : '';
  return `${held ? `${name(pt.s)} held` : `${name(pt.w)} broke`} ${how}${aces > 1 ? ` (${aces} aces)` : ''}${dfs ? ` · ${dfs} double fault${dfs > 1 ? 's' : ''}` : ''} · ${g[me]}–${g[1 - me]}`;
}

async function playOneSet(animate = true) {
  if (anim.running) return;
  const entry = current.entry, L = entry.live, ev = eventOf(entry);
  // Each set runs on its own saved random seed, from a saved starting state, with every big-point call
  // recorded. So if the page is refreshed mid-set, the set replays exactly as it was and fast-forwards
  // to the point you'd reached.
  if (L.inSet && L.snap) L.m = JSON.parse(L.snap);
  else { L.inSet = true; L.seed = (Math.random() * 4294967296) >>> 0; L.calls = []; L.shownSaved = 0; L.snap = JSON.stringify(L.m); writeJSON(ENTRY_KEY, entry); }
  const { m, log } = L, rng = seeded(L.seed), target = L.shownSaved || 0;
  const ps = matchPlayers(entry, m);
  const me = m.a === 0 ? 0 : 1, op = 1 - me;
  // Racket deal: the frame's boost applies in matches only (the base stats are put back after the set).
  if (ps[me].baseAttrs) ps[me].attrs = { ...ps[me].baseAttrs };
  const rb = typeof racketBoost === 'function' ? racketBoost(current.career) : null;
  if (rb) { ps[me].baseAttrs = { ...ps[me].attrs }; ps[me].attrs[rb.stat] = Math.min(99, ps[me].attrs[rb.stat] * (1 + rb.pct)); }
  // Performance Center: a technical breakthrough (+4% to one stat, −1.5% to another this week) and elite fitness.
  const pr = entry.prep || {};
  if (pr.items && pr.items.includes('pcbreak') && pr.breakStat) {
    if (!ps[me].baseAttrs) ps[me].baseAttrs = { ...ps[me].attrs };
    const dip = pr.breakStat === 'stam' ? 'ret' : 'stam';
    ps[me].attrs[pr.breakStat] = Math.min(99, ps[me].attrs[pr.breakStat] * 1.04);
    ps[me].attrs[dip] = ps[me].attrs[dip] * 0.985;
  }
  ps[me].fitCamp = !!(pr.items && pr.items.includes('pcfit'));
  { const pe = prepEdges(entry, ps[op]); ps[me].prepEdge = pe.edge - rebuildPen(current.career) + dayEdge(entry) + (hasTeam(current.career, 'hitting') ? 0.006 : 0) + (hasTeam(current.career, 'stringer') ? 0.003 : 0);
    ps[me].prepClutch = pe.clutch + (hasTeam(current.career, 'mental') ? 0.012 : 0); ps[me].calmCoach = hasTeam(current.career, 'mental'); } // this week's preparation
  ps[me].advLevel = teamLevel(current.career, 'coach');
  showPlanOnCourt(ps[me]);
  // An opponent you beat recently comes prepared for what beat them, unless you've changed it.
  { const b = rivalPrep(current.career, ps[op]), mine = { ...planOf(ps[me]), ...advPlan(ps[me], ps[op]) };
    ps[op].prepared = b && mine[b.key] === b.val ? b : null; }
  // Copying the coach's plan word for word is textbook, and smart opponents read textbook plans faster.
  if (hasTeam(current.career, 'coach')) {
    const mine = { ...planOf(ps[me]), ...advPlan(ps[me], ps[op]) }, reads = coachReads(ps[op], ev, ps[me]).slice(0, COACH_READS[ps[me].advLevel] || 0);
    // How closely you followed the coach's reads, from 0 (your own) to 1 (a straight copy of a full read).
    const same = reads.length >= 3 ? reads.filter(x => mine[x.key] === x.val).length / reads.length : 0;
    ps[me].textbook = clamp((same - 0.6) / 0.4, 0, 1);
  } else ps[me].textbook = 0; // which advanced plan settings your coach has unlocked
  // Your plan as the set began (a changeover can change it mid-set; a replay must start from the same one).
  if (L.planAtStart) ps[me].plan = JSON.parse(L.planAtStart); else L.planAtStart = JSON.stringify(ps[me].plan || planOf(ps[me]));
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
    let step = 0, lastSim = 0;
    const fixedPen = ps[me].focusPen; // rust and a stuck plan; the autopilot part is decided point by point
    set = await playSetLive(m, ps, ev, async info => {
      step++;
      const fresh = m.points.slice(shown);
      if (fresh.length) {
        // Points you'd already watched before a refresh go by instantly.
        // Read The Match: routine points go by fast, but break points and set points play out on court,
        // and every finished game gets a short recap so you can follow the match.
        const big = fresh.some(p => p.bp !== null || p.press), was = Court.skip, endPt = fresh[fresh.length - 1];
        if (L.mode === 'read' && shown >= target && !Court.skip && !anim.finishAfter) {
          // Read The Match, like a broadcast: big points and the points after a Match Read play live on court;
          // in between, the court fades out and the scoreboard and meter tick through each point.
          if (big || (L.liveLeft || 0) > 0) {
            await courtFade(false);
            if ($('mMeter')) $('mMeter').classList.add('live');
            await A.play(fresh, false);
            if ($('mMeter')) $('mMeter').classList.remove('live');
            if (!big) L.liveLeft = Math.max(0, (L.liveLeft || 0) - fresh.length);
          } else {
            await courtFade(true);
            Court.skip = true; await A.play(fresh, false); Court.skip = was;
            await wait(480);
            if ($('mLoadTxt')) $('mLoadTxt').innerHTML = trackerHtml(m, me, L.track, endPt && endPt.end ? gameRecap(endPt, fresh, ps, me) : '');
            if (endPt && endPt.end) { setCall(gameRecap(endPt, fresh, ps, me), endPt.w !== endPt.s ? 'big' : 'post'); await wait(900); }
          }
        } else {
          const ff = shown < target;
          if (ff) Court.skip = true;
          if ($('mMeter')) $('mMeter').classList.add('live');
          await A.play(fresh, false);
          if ($('mMeter')) $('mMeter').classList.remove('live');
          if (ff) Court.skip = was;
        }
      }
      shown = m.points.length;
      if (shown > (L.shownSaved || 0)) { L.shownSaved = shown; writeJSON(ENTRY_KEY, entry); }
      // Autopilot, point by point: skipping through points (without three watched games yet) plays you flat.
      // Recorded, so a refresh replays the set the same way.
      let sim;
      if (shown < target) { const r = (L.calls || []).filter(c => c.id === 'pen' && c.step <= step).slice(-1)[0]; sim = r ? r.v : 0; }
      else {
        sim = !Court.skip || watchCredit(entry) ? 0 : simPen();
        if (sim !== lastSim) { L.calls = [...(L.calls || []), { step, id: 'pen', v: sim }]; }
      }
      lastSim = sim;
      ps[me].focusPen = fixedPen + sim;
      // Win-probability meter (before each point): the score plus each player's serve record so far.
      { const sv = i => servePct((m.stats[i].firstWon || 0) + (m.stats[i].secondWon || 0), m.stats[i].servePts || 0, SERVE_BASE + (overall(ps[i]) - overall(ps[1 - i])) * 0.002);
        const won = i => m.sets.filter(x => x.games[i] > x.games[1 - i]).length, mt = $('mMeter');
        if (mt) setMeter(mt, winProbability({ pA: sv(me), pB: sv(op), setsA: won(me), setsB: won(op), toWin: setsToWin(m), gA: m.games[me], gB: m.games[op],
          ptsA: (info.pts || [0, 0])[me], ptsB: (info.pts || [0, 0])[op], serverA: info.s === me, tb: !!info.tb }), ['You', shortName(ps[op])]); }
      // Match Read: after games 3 and 7 of every set, while you watch or read the match.
      const lastPt = fresh[fresh.length - 1];
      let readNow = false;
      // (Read The Match: one read a set, after game 5, with more riding on it.)
      if (lastPt && lastPt.end && !lastPt.tb && (L.mode === 'read' ? [5] : [3, 7]).includes(lastPt.games[0] + lastPt.games[1]) && ['watch', 'read'].includes(L.mode)) {
        readNow = true;
        if (shown < target) {
          const pc = (L.calls || []).find(c => c.step === step && c.id === 'plan');
          if (pc) { ps[me].plan = { ...pc.plan }; m.exec[me] = pc.exec; }
        } else if (!Court.skip && !anim.finishAfter) {
          await courtFade(false);
          const planBefore = { ...DEFAULT_PLAN, ...planOf(ps[me]) };
          await openRead(entry, ps, me, step);
          if (L.mode === 'read') {
            L.liveLeft = 2; // two points live to see your change, then the tracker follows it while play goes fast
            L.track = { from: m.points.length, wing: planOf(ps[me]).wing || 'neutral', keys: GAME_PLAN.filter(g => (planOf(ps[me])[g.key] || DEFAULT_PLAN[g.key]) !== planBefore[g.key]).map(g => g.key) };
          }
        }
      }
      // Changeover (after the first game, then every two), at the top level: a chance to adjust the plan.
      if (!readNow && L.mode !== 'read' && lastPt && lastPt.end && !lastPt.tb && (lastPt.games[0] + lastPt.games[1]) % 2 === 1 && changeoversOn(entry)) {
        if (shown < target) {
          const pc = (L.calls || []).find(c => c.step === step && c.id === 'plan');
          if (pc) { ps[me].plan = { ...pc.plan }; m.exec[me] = pc.exec; }
        } else if (!Court.skip && !anim.finishAfter && !anim.noChangeovers) await changeover(entry, ps, me, step);
      }
      if (info.bp !== null || info.press) {
        if (shown < target) {
          const rc = (L.calls || []).find(c => c.step === step && c.id !== 'plan' && c.id !== 'pen'), call = rc && callById(info.s === me ? 'serve' : 'ret', rc.id);
          if (rc && rc.id === 'off') anim.noCalls = true;
          if (call) makeCall(m, ps, me, call);
        } else { anim.step = step; if (L.mode === 'read') await courtFade(false); await bigPoint(info, ps, me); }
      }
    }, rng);
    await A.play(m.points.slice(shown), true);
    await courtFade(false);
    anim.live = false;
  } else set = playSet(m, ps, ev, rng);
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
  L.track = null;
  // Read The Match: the coach goes over this set's read at the set break.
  for (const n of (L.readNotes || []).filter(x => x.set === m.sets.length)) lines.push(`📋 Your read: ${n.text}`);
  // Playing into a hidden strength: after the set, you notice.
  const hits = quirkHits(ps[me], ps[op]).filter(q => !(L.seenQuirks || []).includes(q.id));
  if (hits.length) { L.seenQuirks = [...(L.seenQuirks || []), ...hits.map(q => q.id)]; lines.push(...hits.map(q => `🔍 You notice: ${esc(shortName(ps[op]))} ${q.text}.`)); }
  log.push(lines.join('<br>'));
  if (m.winner !== null) concludeMatch();
  const points = m.points;
  m.points = [];
  entry.live.total = (entry.live.total || 0) + points.length;
  L.inSet = false; L.snap = null; L.calls = []; L.shownSaved = 0; L.planAtStart = null;
  noteMark(); // furthest point reached (see fairplay.js)
  if (ps[me].baseAttrs) { ps[me].attrs = ps[me].baseAttrs; delete ps[me].baseAttrs; }
  writeJSON(ENTRY_KEY, entry);
  if (animate) {
    anim.running = false;
    Court.skip = false;
    leaveFullscreen(); // the set break (or the result) needs you
  }
  Court.setBreak(true); // empty court between sets and after the match (rain shows then, if it's wet)
  renderMatch();
}

// Big point: a banner, a line review if it ends near a line, and (if you're watching) a call to make.
// The numbers that matter for this big point: three for you and three for them, chosen for this situation.
// Every candidate stat scores on how relevant it is to the calls on offer (serving or returning, net, drops,
// rallies, serve choices) plus how unusual it is this match, so the panel changes with the point and the match.
function bpContextHtml(m, ps, me, serving, calls) {
  const op = 1 - me, S = m.stats, ev = readEvidence(m, me).raw, raw = [ev.Y, ev.T];
  const fx = calls.map(c => (typeof CALL_FX !== 'undefined' && CALL_FX[c.id]) || {}), has = f => fx.some(f);
  const pct = (a, b) => (b ? a / b : null), show = v => (v === null ? '–' : `${Math.round(v * 100)}%`);
  const srvCall = has(x => x.serve), net = has(x => x.rush), drop = has(x => x.drop), rally = has(x => x.moon || x.ret === 'deep') || calls.some(c => ['run', 'extend', 'plus1', 'dtl', 'neut'].includes(c.id));
  const insideRet = has(x => x.ret === 'inside'), safeSrv = has(x => x.serve === 'safe' || x.serve === 'kick'), bigSrv = has(x => x.serve === 'big' || x.serve === 'body');
  const cand = i => {
    const st = S[i], o = S[1 - i], r = raw[i === me ? 0 : 1], isSrv = serving ? i === me : i === op, out = [];
    const add = (label, val, text, rel, notable) => out.push({ label, text: text ?? show(val), score: rel + Math.min(1.2, notable || 0) });
    const s1 = pct(st.firstIn || 0, st.servePts || 0), w1 = pct(st.firstWon || 0, st.firstIn || 0), w2 = pct(st.secondWon || 0, (st.servePts || 0) - (st.firstIn || 0));
    const rw = pct((o.servePts || 0) - (o.firstWon || 0) - (o.secondWon || 0), o.servePts || 0), r2 = pct(((o.servePts || 0) - (o.firstIn || 0)) - (o.secondWon || 0), (o.servePts || 0) - (o.firstIn || 0));
    add('1st Serves In', s1, null, isSrv ? (srvCall ? 1.6 : 1.35) : 0, s1 === null ? 0 : Math.abs(s1 - 0.62) * 3);
    add('1st-Serve Points Won', w1, null, isSrv ? 1.4 : 0.2, w1 === null ? 0 : Math.abs(w1 - 0.7) * 3);
    add('2nd-Serve Points Won', w2, null, isSrv ? (safeSrv ? 1.4 : 0.9) : insideRet && i === op ? 1.5 : 0.3, w2 === null ? 0 : Math.abs(w2 - 0.5) * 3);
    add('Aces', null, String(st.aces || 0), isSrv && bigSrv ? 1.3 : isSrv ? 0.6 : 0.1, (st.aces || 0) / Math.max(1, st.servePts || 1) * 8);
    add('Double Faults', null, String(st.df || 0), isSrv && safeSrv ? 1.4 : isSrv ? 0.7 : 0.1, (st.df || 0) * 0.3);
    add('Return Points Won', rw, null, !isSrv ? 1.3 : 0.4, rw === null ? 0 : Math.abs(rw - 0.38) * 3);
    if (!isSrv) add('Return Points Won Vs 2nd Serve', r2, null, insideRet ? 1.5 : 0.8, r2 === null ? 0 : Math.abs(r2 - 0.5) * 2);
    add('Net Points Won', null, `${st.netWon || 0}/${st.netPlayed || 0}`, net ? (i === me ? 1.6 : 0.9) : 0.4, (st.netPlayed || 0) * 0.08);
    if (i === op) add('Passes Won Vs Your Net Play', null, `${(S[me].netPlayed || 0) - (S[me].netWon || 0)}/${S[me].netPlayed || 0}`, net ? 1.5 : 0.2, (S[me].netPlayed || 0) * 0.08);
    add('Rally Errors (This Set)', null, `${r.fhE || 0} FH / ${r.bhE || 0} BH`, rally ? (i === op ? 1.3 : 0.9) : 0.6, Math.min(0.6, Math.abs((r.bhE || 0) - (r.fhE || 0)) * 0.12));
    add('Long Rallies Won (This Set)', null, String(r.longW || 0), rally ? 1.35 : 0.3, Math.min(0.4, (r.longW || 0) * 0.06));
    add('Drop Shots Won', null, `${r.dropW || 0}/${r.drops || 0}`, drop && i === me ? 1.6 : drop ? 0.8 : 0.2, (r.drops || 0) * 0.2);
    if (i === op) add('Return Position', null, (planOf(ps[op]).returnPos || 'normal').replace(/^./, x => x.toUpperCase()), drop || net || srvCall ? 1.5 : 0.3, planOf(ps[op]).returnPos === 'normal' ? 0 : 0.5);
    add('Unforced Errors', null, String(st.ue || 0), 0.5, Math.min(0.5, (st.ue || 0) * 0.05));
    return out.sort((a, b) => b.score - a.score).slice(0, 3);
  };
  const col = (i, title) => `<div class="bpcol"><h5>${title}</h5>${cand(i).map(x => `<div><small>${x.label}</small><b>${x.text}</b></div>`).join('')}</div>`;
  return `<div class="bpctx two">${col(me, 'You')}${col(op, esc(shortName(ps[op])))}</div>`;
}

function bigPoint(info, ps, me) {
  const m = current.entry.live.m;
  const name = i => i === me ? 'You' : shortName(ps[i]);
  const text = info.press ? `${info.press.match ? 'MATCH' : 'SET'} POINT · ${name(info.press.who).toUpperCase()}`
    : `BREAK POINT · ${name(info.bp).toUpperCase()}`;
  anim.review = Math.random() < 0.5;
  if (Court.skip || anim.finishAfter) return Promise.resolve();
  Court.banner(text);
  if (anim.noCalls) return Promise.resolve();
  const serving = info.s === me, calls = callsFor(ps[me], serving ? 'serve' : 'ret');
  const pct = e => `${e >= 0 ? '+' : '−'}${(Math.abs(e) * 100).toFixed(1)}%`;
  const box = $('mCallBox');
  box.className = 'callbox bp';
  box.innerHTML = `<div class="bphead"><div class="cbtitle">${text}</div><div class="cbsub">${serving ? "You're Serving" : "You're Returning"} · Make A Call</div></div>` +
    // The Master coach points to the best call for this point (highlighted in gold).
    (() => {
      const edges = calls.map(c => callEdge(m, ps, me, c));
      const pick = teamLevel(current.career, 'coach') >= 4 ? edges.indexOf(Math.max(...edges)) : -1;
      return `<div class="bpmid"><div class="cbopts eq">${calls.map((c, i) => `<button type="button" data-call="${c.id}" class="${i === pick ? 'rec' : ''}"><span>${c.icon}</span><b>${c.title}</b>` +
        `<small class="${edges[i] >= 0 ? 'up' : 'down'}">${pct(edges[i])} On This Point</small>${i === pick ? '<em class="recpill">🧑‍🏫 Coach\'s Pick</em>' : ''}</button>`).join('')}</div>` +
        '';
    })() +
    bpContextHtml(m, ps, me, serving, calls) + `</div>` +
    `<div class="cbfoot small"><button type="button" class="link" data-call="none">Just Play It</button><button type="button" class="link" data-call="off">Don't Ask Again This Match</button></div>`;
  box.hidden = false;
  return new Promise(done => {
    // Leaving the match or skipping the set answers for you.
    const iv = setInterval(() => { if (Court.skip) finish(null); }, 200);
    const finish = id => {
      clearInterval(iv);
      if (id === 'off') anim.noCalls = true;
      // Remember the call, so a refresh mid-set replays the point the same way.
      const L = current.entry && current.entry.live;
      if (L && L.inSet && id) { L.calls = (L.calls || []).filter(c => c.step !== anim.step || c.id === 'plan' || c.id === 'pen'); L.calls.push({ step: anim.step, id }); }
      const call = calls.find(c => c.id === id);
      if (call) makeCall(m, ps, me, call);
      box.hidden = true; box.onclick = null; box.className = 'callbox';
      done();
    };
    box.onclick = e => { const b = e.target.closest('[data-call]'); if (b) finish(b.dataset.call); };
  });
}

// Watch mode: replay every set on court until the match ends (or you jump to the end).
// Switch how the match is played at any point (mid-set too): you're never locked into one way.
const MODES = [['watch', '🎾', 'Watch Live'], ['read', '🧠', 'Read The Match'], ['sets', '⏭️', 'Set By Set'], ['full', '⚡', 'Full Match']];
function renderModeBar() {
  const el = $('mModes'), L = current.entry && current.entry.live;
  if (!el) return;
  el.hidden = !L || !L.mode || !!L.done;
  if (el.hidden) return;
  el.innerHTML = `<span>Play This Match As</span><div class="modebtns">${MODES.map(([k, i, t]) => `<button type="button" data-sw="${k}" class="${L.mode === k ? 'on' : ''}"><span>${i}</span>${t}</button>`).join('')}</div>`;
  el.onclick = e => { const b = e.target.closest('[data-sw]'); if (b && b.dataset.sw !== L.mode) switchMode(b.dataset.sw); };
}
async function switchMode(k) {
  const entry = current.entry, L = entry.live;
  L.mode = k; writeJSON(ENTRY_KEY, entry);
  renderModeBar();
  if (anim.running) {
    // Mid-set: watching and reading take over from the next point; simming finishes the set, then carries on.
    if (k === 'watch') { courtFade(false); }
    else if (k === 'sets') { anim.paused = false; Court.skip = true; }
    else if (k === 'full') { anim.watching = false; anim.paused = false; anim.finishAfter = true; Court.skip = true; }
    return;
  }
  if (k === 'watch' || k === 'read') watchMatch();
  else if (k === 'full') { while (!entry.live.done) await playOneSet(false); renderMatch(); }
  else renderMatch();
}

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
    const sp = anim.speed;
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
  return `${p.seed ? `<span class="seed">${p.seed}</span>` : ''}${flagOf(p.nation)} ${p.atpRank ? `<span class="realname${isLegend(p) ? ' legend' : ''}">${isLegend(p) ? '👑 ' : ''}${esc(p.name)}</span>` : esc(p.name)}`;
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
  // A first match at a new level (Challenger and up), in qualifying or the main draw.
  {
    const ev = eventOf(entry), fam = t => t === 'CH75' || t === 'CH125' ? 'CH' : t;
    const q = inQual(entry), firstHere = q ? (entry.qual.round || 0) === 0 : roundIndex(entry) === 0;
    const before = current.career.history.some(h => !h.real && fam(h.tier) === fam(ev.tier) && (q || !String(h.reached).startsWith('Q')));
    if (DEBUT_NAME[fam(ev.tier)] && firstHere && !before) rec.debut = { fam: fam(ev.tier), qual: q };
  }
  // After a loss: what went wrong (one lesson, or the full breakdown with video analysis), and with video
  // analysis a counter-plan saved for the next time you meet them.
  if (!rec.won) {
    const vid = hasPrep(entry, 'video');
    rec.lessons = lessonsFor(rec, m, me, ps, eventOf(entry)).slice(0, vid ? 4 : 1);
    rec.lessonsFull = vid;
    if (vid && opp.id) {
      const cp = coachPlan(opp, eventOf(entry), ps[me]);
      Object.assign(cp, { wing: advCoachFull(opp).wing, pressure: attr(opp, 'mental') < 52 ? 'broke' : attr(opp, 'mental') > 66 ? 'safe' : 'standard' });
      current.career.videoPlans = { ...(current.career.videoPlans || {}), [opp.id]: { plan: cp, week: current.career.week, score: rec.score } };
    }
  }
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
  setTimeout(renderModeBar, 0);
  const ps = matchPlayers(entry, m);
  const me = m.a === 0 ? 0 : 1, op = 1 - me;
  $('mTitle').textContent = `${roundLabel(entry)} · ${ev.city} ${tierLabel(ev.tier)}`;
  $('mMeta').textContent = `${surfaceLabel(ev.surface)}${ev.indoor ? ' · Indoor' : ''}${ev.weather ? ` · ${wxLabel(ev)}` : ''}`;
  const opp = ps[op];
  $('mOpp').textContent = `Opponent: ${opp.atpRank ? `ATP #${opp.atpRank} · ` : ''}age ${opp.age} · ${lefty(opp) ? 'left-handed' : 'right-handed'}${opp.seed ? ` · No. ${opp.seed} seed` : ''}`;

  const shown = anim.running && !anim.live ? log.slice(0, -1) : log;
  $('mLog').innerHTML = shown.length ? shown.map(l => `<li>${l}</li>`).join('') : '<li class="hint">Match about to start.</li>';

  // GATAH VISION plays at real pace, so no speed buttons there.
  const speeds = Court.view === 'gatah' ? '<div class="gvtag">Real Time</div>' : `<div class="seg speed">${[1, 2, 4].map(x =>
    `<button type="button" data-speed="${x}" class="${x === anim.speed ? 'on' : ''}">${x}×</button>`).join('')}</div>`;

  const btn = (id, label, ghost) => `<button type="button" class="btn${ghost ? ' ghost' : ''}" id="${id}">${label}</button>`;

  $('mCtl').innerHTML = '';
  $('mCourtWrap').classList.toggle('paused', anim.paused);
  // Playback speed: a column down the right side of the court (GATAH VISION has its own real-time / slow-mo).
  $('mSpeed').hidden = Court.view === 'gatah';
  $('mSpeed').innerHTML = [1, 2, 4].map(x => `<button type="button" data-speed="${x}" class="${x === anim.speed ? 'on' : ''}">${x}×</button>`).join('');
  if (anim.running) {
    // While a set plays, its controls sit on the court itself.
    $('mActions').innerHTML = '';
    if (anim.watching) {
      $('mCtl').innerHTML = `${btn('mPause', anim.paused ? '▶ Resume' : '❚❚ Pause')}${btn('mSkip', '⏭ Skip Set', true)}${btn('mAll', '⏩ Sim to End', true)}`;
      $('mPause').onclick = () => { anim.paused = !anim.paused; $('mPause').textContent = anim.paused ? '▶ Resume' : '❚❚ Pause'; $('mCourtWrap').classList.toggle('paused', anim.paused); };
      $('mAll').onclick = () => { anim.watching = false; anim.paused = false; anim.finishAfter = true; Court.skip = true; };
    } else {
      $('mCtl').innerHTML = `${btn('mSkip', '⏭ Skip Set', true)}`;
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
      setCall('', 'post');
      // The result, in one window in the middle of the court; Continue moves on from there.
      $('mActions').innerHTML = '';
      const bb = $('mBreak'), winner = won ? current.player : opp;
      Court.banner(null);
      $('mCourtWrap').classList.add('veiled');
      bb.hidden = false;
      bb.innerHTML = `<div class="mendbox"><div class="sbtitle">GAME, SET AND MATCH</div>` +
        `<div class="mendname">${flagOf(winner.nation)} ${esc(winner.name)}</div>` +
        `<div class="mendscore">${scoreLine(m, m.winner)}</div>` +
        `<div class="mendres ${won ? 'good' : 'bad'}">${won ? '🏆 You Won' : 'You Lost'}</div></div>` +
        `<button type="button" class="btn mendbtn" id="mDone">Continue</button>`;
      $('mDone').onclick = () => { $('mCourtWrap').classList.remove('veiled'); bb.hidden = true; wrapUpMatch(entry); };
      return;
    }
    if (!m.sets.length) setCall(`${shortName(ps[m.server])} to serve`, 'pre');

    const simAll = async () => { while (!entry.live.done) await playOneSet(false); };
    const mode = entry.live.mode;
    // Set break: up or down, you can change your plan for the rest of the match.
    const setBreak = () => {
      const won = m.sets.filter(x => x.games[me] > x.games[op]).length, lost = m.sets.length - won;
      return `<div class="planline setbreak"><span><b>Set break · ${won > lost ? `You lead ${won}–${lost}` : won < lost ? `You trail ${won}–${lost}` : `${won}–${lost}`}</b>` +
        `<small>${planSummary(planOf(ps[me]))}</small></span><button type="button" class="btn ghost small" id="mAdj">Adjust plan</button></div>` + breakAdviceHtml();
    };
    // The coach talks to you at every set break, however the set was played (watched or simmed).
    const breakAdv = () => teamLevel(current.career, 'coach') >= 4 && m.winner === null ? liveAdvice(m, ps, me, ev) : null;
    const breakAdviceHtml = () => {
      const adv = breakAdv();
      if (!adv) { const n = m.winner === null ? adaptNotice(m, ps, me) : ''; return n ? `<div class="advice">${n}</div>` : ''; }
      return adviceHtml(adv) + `<div class="advbtns">` +
        adv.counters.map((c, i) => `<button type="button" class="btn ghost small" data-bk="ct${i}">${i ? '🅱️' : '🅰️'} ${esc(c.label)}</button>`).join('') +
        (Object.keys(adv.plan).length ? `<button type="button" class="btn small" data-bk="advice">💡 Take The Advice</button>` : '') + `</div>`;
    };
    const bindBreak = () => {
      if ($('mAdj')) $('mAdj').onclick = () => openSetAdjust(entry);
      document.querySelectorAll('[data-bk]').forEach(b => { b.onclick = () => {
        const adv = breakAdv(), k = b.dataset.bk;
        commitSetPlan(entry, { ...planOf(ps[me]), ...(k === 'advice' ? adv.plan : adv.counters[+k.slice(2)].plan) });
        renderMatch();
      }; });
    };
    if (!mode) {
      // Before the first ball: how do you want to play this one?
      $('mActions').innerHTML = `<h2 class="choose">How do you want to play this match?</h2><div class="modes">` +
        [['watch', '🎾', 'Watch Live', 'Every point on court, with Match Reads'],
         ['read', '🧠', 'Read The Match', 'Fast play: big calls and Match Reads'],
         ['sets', '⏭️', 'Set By Set', 'Sim one set at a time'],
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
          if (entry.live.mode === 'watch' || entry.live.mode === 'read') watchMatch();
          else if (entry.live.mode === 'full') simAll();
          else renderMatch();
        };
      });
    } else if (mode === 'watch' || mode === 'read') {
      $('mActions').innerHTML = (m.sets.length ? setBreak() : '') +
        `<div class="btn-row four">${btn('mWatch', mode === 'read' ? `Read Set ${m.sets.length + 1}` : m.sets.length ? `Watch Set ${m.sets.length + 1}` : 'Resume Watching')}` +
        (m.sets.length ? btn('mSet', `Sim Set ${m.sets.length + 1}`, true) : '') + `${btn('mAll', 'Sim to End', true)}${speeds}</div>`;
      bindBreak();
      $('mWatch').onclick = watchMatch;
      if ($('mSet')) $('mSet').onclick = () => playOneSet(false); // sim just this set, then stop at the next set break
      $('mAll').onclick = simAll;
    } else {
      $('mActions').innerHTML = (m.sets.length ? setBreak() : '') + `<div class="btn-row four">${btn('mSet', `Sim Set ${m.sets.length + 1}`)}` +
        `${btn('mWatchSet', `Watch Set ${m.sets.length + 1}`, true)}${btn('mAll', 'Sim to End', true)}${speeds}</div>`;
      bindBreak();
      $('mSet').onclick = () => playOneSet(false);
      $('mWatchSet').onclick = () => playOneSet(true);
      $('mAll').onclick = simAll;
    }
    // Set break, on the court itself: the set score, your coach's advice (small buttons, side by side) and how to
    // play the next set: watch it, read it, sim it, or sim the rest of the match.
    const bb = $('mBreak');
    if (bb) {
      const show = !!mode && m.sets.length > 0 && m.winner === null && !anim.running;
      bb.hidden = !show;
      $('mCourtWrap').classList.toggle('veiled', show);
      if (show) Court.banner(null);
      if (show) {
        const won = m.sets.filter(x => x.games[me] > x.games[op]).length, lost = m.sets.length - won, last = m.sets[m.sets.length - 1];
        const n = m.sets.length + 1;
        bb.innerHTML = `<div class="sbtitle">SET ${m.sets.length} ${last.games[me] > last.games[op] ? 'TO YOU' : 'TO ' + esc(shortName(ps[op])).toUpperCase()} · ${last.games[me]}–${last.games[op]}</div>` +
          `<div class="sbsub">${won > lost ? `You lead ${won}–${lost}` : won < lost ? `You trail ${won}–${lost}` : `${won}–${lost} in sets`}</div>` +
          `<div class="sbadv">${breakAdviceHtml()}</div>` +
          `<button type="button" class="btn ghost small sbadj" id="sbAdj">📝 Adjust My Plan</button>` +
          `<div class="sbhead">Play Set ${n} As</div><div class="modebtns">` +
          [['watch', '🎾', `Watch Set ${n}`], ['read', '🧠', `Read Set ${n}`], ['sets', '⏭️', `Sim Set ${n}`], ['full', '⚡', 'Full Match']].map(([k, i, t]) =>
            `<button type="button" data-nb="${k}" class="${mode === k ? 'on' : ''}"><span>${i}</span>${t}</button>`).join('') + `</div>`;
        // Everything for the set break lives on the court now, so the old controls under it go.
        $('mActions').innerHTML = '';
        bindBreak();
        // Adjust your plan right here on the court (the same compact editor as changeovers).
        $('sbAdj').onclick = () => {
          const pl = { ...DEFAULT_PLAN, ...planOf(ps[me]) };
          bb.innerHTML = `<div class="sbtitle">ADJUST YOUR PLAN FOR SET ${m.sets.length + 1}</div><div class="pcgrid" id="sbGrid"></div>` +
            `<div class="pcbtns"><button type="button" class="btn small" id="sbSave">✅ Save Plan</button><button type="button" class="btn small ghost" id="sbBack">Back</button></div>`;
          compactPlanEditor($('sbGrid'), pl);
          $('sbSave').onclick = () => { commitSetPlan(entry, pl); renderMatch(); };
          $('sbBack').onclick = () => renderMatch();
        };
        bb.querySelectorAll('[data-nb]').forEach(b => { b.onclick = () => {
          const k = b.dataset.nb; entry.live.mode = k; writeJSON(ENTRY_KEY, entry); bb.hidden = true; $('mCourtWrap').classList.remove('veiled');
          if (k === 'watch' || k === 'read') watchMatch(); else if (k === 'sets') playOneSet(false); else simAll();
        }; });
      }
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

// Changeovers: from ATP 250 main draws up, once you're a 75+ player.
const changeoversOn = entry => teamLevel(current.career, 'coach') >= 4 // a Master coach talks to you at every changeover
  || ['ATP250', 'ATP500', 'M1000', 'GS'].includes(eventOf(entry).tier) && !inQual(entry) && overall(current.player) >= 75;
// The Master coach's live advice, as a block of tips (and how many changes it suggests).
const adviceHtml = adv => `<div class="advice"><b>🧑‍🏫 Coach's Advice</b><ul>${adv.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;

// At a changeover the match pauses on court: keep going, take the coach's plan, or adjust your own.
function changeover(entry, ps, me, step) {
  const L = entry.live, m = L.m, opp = ps[1 - me], ev = eventOf(entry);
  const pl = { ...planOf(ps[me]) }, before = JSON.stringify(pl);
  const coach = hasTeam(current.career, 'coach') ? coachPlan(opp, ev, ps[me]) : null;
  const diffs = coach ? GAME_PLAN.filter(g => coach[g.key] !== pl[g.key]).length : 0;
  const adv = teamLevel(current.career, 'coach') >= 4 ? liveAdvice(m, ps, me, ev) : null, nAdv = adv ? Object.keys(adv.plan).length : 0;
  const box = $('mCallBox');
  // Main view: the coach's read, one row of equal choices (short names; hover for the detail), small extras below.
  const mainView = () => {
    box.innerHTML = `<div class="cbtitle">CHANGEOVER · YOU ${m.games[me]}–${m.games[1 - me]}</div>` +
      (adv ? adviceHtml(adv) : adaptNotice(m, ps, me) ? `<div class="advice">${adaptNotice(m, ps, me)}</div>` : '') +
      `<div class="cbopts eq"><button type="button" data-co="go"><span>▶️</span><b>Keep Playing</b><small>Same Plan</small></button>` +
      (adv ? adv.counters.map((c, i) => `<button type="button" data-co="ct${i}" title="${esc(c.label)}"><span>${i ? '🅱️' : '🅰️'}</span><b>${esc(c.short || c.label)}</b><small>Coach's Counter</small></button>`).join('') : '') +
      (nAdv ? `<button type="button" data-co="advice"><span>💡</span><b>Take The Advice</b><small>${nAdv} Change${nAdv === 1 ? '' : 's'}</small></button>` : '') +
      `<button type="button" data-co="edit"><span>📝</span><b>Adjust My Plan</b><small>Pick Settings</small></button></div>` +
      `<div class="cbfoot small">` + (diffs ? `<button type="button" class="link" data-co="coach">🧑‍🏫 Use The Coach's Full Plan (${diffs} Change${diffs === 1 ? '' : 's'})</button>` : '') +
      `<button type="button" class="link" data-co="off">Don't Stop At Changeovers This Match</button></div>`;
  };
  // Adjust view: a compact plan editor right here on court (no jumping to another window).
  const editView = () => {
    box.innerHTML = `<div class="cbtitle small">ADJUST YOUR PLAN</div><div class="pcgrid" id="coGrid"></div>` +
      `<div class="pcbtns"><button type="button" class="btn small" data-co="go">✅ Play On</button><button type="button" class="btn small ghost" data-co="back">Back</button></div>`;
    compactPlanEditor($('coGrid'), pl);
  };
  mainView();
  box.hidden = false;
  return new Promise(done => {
    const iv = setInterval(() => { if (Court.skip) finish(); }, 200);
    function finish() {
      clearInterval(iv);
      box.hidden = true; box.onclick = null;
      if (JSON.stringify(pl) !== before) {
        ps[me].plan = { ...pl };
        m.exec[me] = rollExec(ps[me]);
        showPlanOnCourt(ps[me]);
        L.calls = (L.calls || []).filter(c => !(c.step === step && c.id === 'plan'));
        L.calls.push({ step, id: 'plan', plan: { ...pl }, exec: m.exec[me] });
        writeJSON(ENTRY_KEY, entry);
      }
      setTimeout(done, 700); // no instant click-through
    }
    box.onclick = e => {
      const b = e.target.closest('[data-co]');
      if (!b) return;
      const k = b.dataset.co;
      if (k === 'go') finish();
      else if (k === 'off') { anim.noChangeovers = true; finish(); }
      else if (k === 'coach') { Object.assign(pl, coach); finish(); }
      else if (k === 'advice') { Object.assign(pl, adv.plan); finish(); }
      else if (k.startsWith('ct')) { Object.assign(pl, adv.counters[+k.slice(2)].plan); finish(); }
      else if (k === 'edit') editView();
      else if (k === 'back') { Object.assign(pl, JSON.parse(before)); mainView(); }
    };
  });
}

// A compact plan editor for the court overlay: every setting as a short label and three small buttons
// (the long explanation shows when you hover the label).
function compactPlanEditor(el, plan) {
  const lv = teamLevel(current.career, 'coach');
  const draw = () => {
    // The basic settings, then the coach-unlocked ones as their own tier (with a little space and a heading).
    const row = g => `<div class="pcrow"><span title="${esc(g.hint)}">${g.label.replace(/\b\w/g, c => c.toUpperCase())}</span><div class="pcseg" data-key="${g.key}">${g.opts.map(([v, l]) =>
      `<button type="button" data-v="${v}" class="${(plan[g.key] || DEFAULT_PLAN[g.key]) === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
    const basic = GAME_PLAN.filter(g => !g.coach), adv = GAME_PLAN.filter(g => g.coach && lv >= g.coach);
    el.innerHTML = basic.map(row).join('') + (adv.length ? `<div class="pctier">🎓 Master Coach Options</div>${adv.map(row).join('')}` : '');
  };
  el.onclick = e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    e.stopPropagation();
    plan[b.parentElement.dataset.key] = b.dataset.v;
    draw();
  };
  draw();
}

// The plan you're playing, short, for the corner of the court: only what differs from a balanced plan.
const PLAN_SHORT = { serve: { big: 'Big serve', safe: 'Safe serve' }, returnPos: { deep: 'Deep return', inside: 'Inside return' },
  aggression: { aggressive: 'Aggressive', patient: 'Patient' }, spin: { flat: 'Flat', topspin: 'Topspin' }, net: { often: 'Net often', rarely: 'Net rarely' },
  drops: { often: 'Drops often', rarely: 'Few drops' }, underarm: { rarely: 'Underarm sometimes', sometimes: 'Underarm often' },
  wing: { bh: 'Target BH', fh: 'Target FH' }, depth: { high: 'High margin', deep: 'Deep drives' }, energy: { hustle: 'Hustle', conserve: 'Conserve' }, pressure: { broke: 'Go for broke', safe: 'Safe big points' } };
function showPlanOnCourt(p) {
  const pl = { ...planOf(p), ...(typeof advPlan === 'function' ? advPlan(p) : {}) };
  const bits = Object.entries(PLAN_SHORT).map(([k, m]) => m[pl[k]]).filter(Boolean);
  Court.setPlan(bits.length ? bits.join(' · ') : 'Balanced plan');
}

// Commit a set-break plan change: remembered for the match story, and the new plan's execution is rolled fresh.
function commitSetPlan(entry, pl) {
  const { m } = entry.live, ps = matchPlayers(entry, m), me = m.a === 0 ? 0 : 1;
  const old = planOf(ps[me]);
  const changes = GAME_PLAN.filter(g => pl[g.key] !== undefined && pl[g.key] !== old[g.key]);
  if (!changes.length) return;
  entry.live.adjusts = [...(entry.live.adjusts || []), { after: m.sets.length,
    changes: changes.map(g => `${g.label.toLowerCase()} to ${planLabel(g.key, pl[g.key])}`),
    score: m.sets.map(st => `${st.games[me]}-${st.games[1 - me]}`).join(' ') }];
  ps[me].plan = { ...pl };
  m.exec[me] = rollExec(ps[me]);
  showPlanOnCourt(ps[me]);
  entry.live.log.push(`🔄 <b>Set break:</b> you changed your plan. ${planSummary(pl)}`);
  writeJSON(ENTRY_KEY, entry);
  toast('🔄 Plan changed', changes.map(g => g.label).join(', '));
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
    (teamLevel(current.career, 'coach') >= 4 ? (adv => adviceHtml(adv) + adv.counters.map((c, i) => `<button type="button" class="btn ghost sact" data-ct="${i}">${i ? '🅱️' : '🅰️'} ${esc(c.label)}</button>`).join('') +
      `<button type="button" class="btn" id="saAdvice">💡 Take the Advice</button>`)(liveAdvice(m, ps, me, eventOf(entry)))
      : adaptNotice(m, ps, me) ? `<div class="advice">${adaptNotice(m, ps, me)}</div>` : '') +
    scoutHtml(opp) + (hasTeam(current.career, 'coach') ? `<button type="button" class="btn ghost" id="saCoach">🧑‍🏫 Use the Coach's Plan</button>` : '') +
    `<div id="saPlan" class="plan"></div><button type="button" class="btn" id="saDone">Back to the match</button>`,
    { wide: true, onClose: () => {
      if (JSON.stringify(pl) !== before) {
        // Remember the change so the match story can say whether it worked.
        const old = JSON.parse(before);
        entry.live.adjusts = [...(entry.live.adjusts || []), { after: m.sets.length,
          changes: GAME_PLAN.filter(g => pl[g.key] !== old[g.key]).map(g => `${g.label.toLowerCase()} to ${planLabel(g.key, pl[g.key])}`),
          score: m.sets.map(st => `${st.games[me]}-${st.games[1 - me]}`).join(' ') }];
        ps[me].plan = { ...pl };
        m.exec[me] = rollExec(ps[me]);
        showPlanOnCourt(ps[me]);
        entry.live.log.push(`🔄 <b>Set break:</b> you changed your plan. ${planSummary(pl)}`);
        writeJSON(ENTRY_KEY, entry);
      }
      renderMatch();
    } });
  planEditor($('saPlan'), pl, () => {});
  document.querySelectorAll('.sact').forEach(b => { b.onclick = () => { Object.assign(pl, liveAdvice(m, ps, me, eventOf(entry)).counters[+b.dataset.ct].plan); planEditor($('saPlan'), pl, () => {}); }; });
  if ($('saAdvice')) $('saAdvice').onclick = () => { Object.assign(pl, liveAdvice(m, ps, me, eventOf(entry)).plan); planEditor($('saPlan'), pl, () => {}); };
  if ($('saCoach')) $('saCoach').onclick = () => { Object.assign(pl, coachPlan(opp, eventOf(entry), ps[me])); planEditor($('saPlan'), pl, () => {}); };
  $('saDone').onclick = closeModal;
  $('mx').onclick = closeModal;
}

// --- Post-match review: match story + one tactical adjustment ---------------

const FOCUS_GAIN = 0.0043; // older matches
// Each match's adjustment improves its stats by 0.75–1%, rolled once per match.
const WATCH_BONUS = 0.006;
const WATCH_GAMES = 3;
// A match you only simmed (under three games watched) teaches you far less than one you played.
const totalGain = rec => (matchGain(rec) * ((rec.gamesWatched || 0) >= WATCH_GAMES ? 1 : 0.15 * autopilotGrowth(rec.autopilot || 0)) + (rec.watchBonus || 0)) * (rec.fullWatch ? 3 : 1) * legendXp(rec);
// Playing a legend teaches you a lot; beating one, far more.
const legendXp = rec => rec.opponent && isLegend(rec.opponent) ? (rec.won ? 2.5 : 1.3) : 1;
const matchGain = rec => rec.gain || (rec.gain = Math.round((0.0075 + Math.random() * 0.0025) * toughness(rec) * 10000) / 10000);
// Tough matches teach more: close wins and narrow losses count up to +30%, easy wins and blowout losses less.
function toughness(rec) {
  const sets = rec.sets || [], tbs = sets.filter(s => s.tb).length, decider = sets.length === 3 || sets.length === 5;
  const mine = sets.reduce((a, s) => a + s.games[0], 0), theirs = sets.reduce((a, s) => a + s.games[1], 0);
  if (rec.won) return decider || tbs ? 1.25 : theirs <= 4 ? 0.7 : 1;
  if (mine <= 4) return 0.8; // a blowout loss teaches little (and can't be farmed)
  return decider || tbs || theirs - mine <= 4 ? 1.3 : 1.05;
}
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
  player.playstyle = styleOf(player).name;
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
// "Ace — Moreno" → "Ace · Moreno": how the point was won, under the score on each point chip.
const shortHow = t => { const [how, who] = String(t).split(' — '); return who ? `${how} · ${who}` : how; };
function renderPoints() {
  { const live = current.entry && current.entry.live, sp = $('mStyles');
    if (sp && live && live.m) { const ps = matchPlayers(current.entry, live.m), me = live.m.a === 0 ? 0 : 1;
      sp.innerHTML = stylePanelHtml([ps[me], ps[1 - me]], { moments: (live.m.moments || []).map(mo => ({ ...mo, who: mo.who === me ? 0 : 1 })) }, ['You', shortName(ps[1 - me])]);
      bindStylePanel(sp); } }
  const box = $('mPoints');
  box.hidden = false; // the point-by-point list shows in every view
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
  const gameHtml = g => {
    const first = g.pts[0].r, last = g.pts[g.pts.length - 1].r;
    const title = first.tb ? 'Tiebreak' : `Game ${g.key}`;
    const sub = first.tb ? '' : `<small>${esc(first.server || '')} serving</small>`;
    const result = last.gameEnd
      ? `<span class="pres${last.broke ? ' brk' : ''}">${last.game} · ${esc(last.winner || '')} ${last.tb ? 'won the tiebreak' : last.broke ? 'broke' : 'held'}</span>` : '';
    const chips = g.pts.map(({ r, i }) =>
      `<button type="button" class="pchip${r.highlight ? ' hl' : ''}" data-i="${i}" title="${esc(r.text ? shortHow(r.text) : r.call || (r.gameEnd ? 'Game point' : ''))}">` +
      `${r.highlight ? HL_ICON[r.highlight] + ' ' : ''}${r.gameEnd ? (r.tb ? 'TB' : 'Game') : r.label}</button>`).join('');
    return `<div class="pgame"><div class="plabel2"><b>${title}</b>${sub}</div><div class="pchips">${chips}</div>${result}</div>`;
  };
  // Only the current game is open. Earlier games of this set, and whole earlier sets, fold away
  // (and stay open if you opened them, as points keep coming in).
  anim.pfold = anim.pfold || {};
  const fold = (key, label, inner) => `<details class="pfold" data-pf="${key}" ${anim.pfold[key] ? 'open' : ''}><summary>${label}</summary>${inner}</details>`;
  box.innerHTML = sets.map((st, si) => {
    const lastG = st.games[st.games.length - 1], lastR = lastG.pts[lastG.pts.length - 1].r;
    if (si < sets.length - 1) return fold(`s${st.set}`, `Set ${st.set} · ${lastR.game || ''} <small>${st.games.length} games</small>`, st.games.map(gameHtml).join(''));
    const earlier = st.games.slice(0, -1);
    return `<div class="pset">Set ${st.set}</div>` + (earlier.length ? fold(`e${st.set}`, `Earlier Games <small>${earlier.length}</small>`, earlier.map(gameHtml).join('')) : '') + gameHtml(lastG);
  }).join('');
  box.ontoggle = null;
  box.querySelectorAll('details.pfold').forEach(d => { d.ontoggle = () => { anim.pfold[d.dataset.pf] = d.open; }; });
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
    `<div class="rpbar"><div class="seg four" id="rpAngle">${[['broadcast', 'Broadcast'], ['reverse', 'Reverse'], ['side', 'Side'], ['top', 'Top-Down'], ['fps', 'POV: You'], ['fps2', 'POV: Opp']]
      .map(([v, l]) => `<button type="button" data-v="${v}" class="${v === ang ? 'on' : ''}">${l}</button>`).join('')}</div>` +
    `<div class="seg two" id="rpSpeed"><button type="button" data-s="1" class="on">Real Time</button><button type="button" data-s="2.5">Slow-Mo</button></div></div>` +
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
  if ($('mSpeed')) $('mSpeed').hidden = on; // in GATAH VISION the speeds join real time / slow-mo in one menu
  const cam = { angle: 'broadcast', slow: 1, ...readJSON(GV_KEY) };
  if (!on) return;
  Court.setAngle(cam.angle === 'broadcast' ? null : cam.angle);
  Court.setSlow(cam.slow);
  // GATAH camera angles join the view list on the left; real time / slow-mo sits on the right.
  bar.innerHTML = [['broadcast', 'Broadcast'], ['reverse', 'Reverse'], ['side', 'Side'], ['top', 'Top-Down'], ['fps', 'POV: You'], ['fps2', 'POV: Opp']]
    .map(([v, l]) => `<button type="button" data-v="${v}" class="${v === cam.angle ? 'on' : ''}">${l}</button>`).join('');
  spd.innerHTML = [[1, 'Real Time'], [2.5, 'Slow-Mo']]
    .map(([v, l]) => `<button type="button" data-s="${v}" class="${v === cam.slow ? 'on' : ''}">${l}</button>`).join('') +
    `<i class="segsep"></i>` + [1, 2, 4].map(x => `<button type="button" data-speed="${x}" class="${x === anim.speed ? 'on' : ''}">${x}×</button>`).join('');
  spd.onclick = e => {
    const b = e.target.closest('[data-speed]');
    if (b) { anim.speed = +b.dataset.speed; writeJSON(SPEED_KEY, anim.speed); renderGvBar(); return; }
    bar.onclick(e);
  };
  bar.onclick = e => {
    const a = e.target.closest('[data-v]'), sp = e.target.closest('[data-s]');
    if (a) cam.angle = a.dataset.v;
    if (sp) cam.slow = +sp.dataset.s;
    if (!a && !sp) return;
    writeJSON(GV_KEY, cam);
    renderGvBar();
  };
}
