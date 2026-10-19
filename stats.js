// stats.js — overlay window (modal), full match stats, match history, and the post-match adjustment picker

// --- Modal -----------------------------------------------------------------

let modalClose = null;

// --- Fold-out sections ---------------------------------------------------------------------------
// Most panels start closed with a one-line summary, open in place with a tap, and remember how each
// player left them (per section, on this device).
const FOLD_KEY = 'tourlife.folds';
const foldOpen = (id, dflt = false) => { const s = readJSON(FOLD_KEY) || {}; return id in s ? s[id] : dflt; };
function fold(id, title, summary, body, dflt = false) {
  return `<details class="fold" data-fold="${id}" ${foldOpen(id, dflt) ? 'open' : ''}><summary class="foldhead"><span class="foldt">${title}</span>` +
    `<span class="foldsum">${summary || ''}</span><i class="foldchev" aria-hidden="true"></i></summary><div class="foldbody">${body}</div></details>`;
}
function restoreFolds(root = document) {
  const s = readJSON(FOLD_KEY) || {};
  root.querySelectorAll('details[data-fold]').forEach(d => { if (d.dataset.fold in s) d.open = s[d.dataset.fold]; });
}
document.addEventListener('toggle', e => {
  const d = e.target;
  if (!d || !d.dataset || !d.dataset.fold) return;
  const s = readJSON(FOLD_KEY) || {}; s[d.dataset.fold] = d.open; writeJSON(FOLD_KEY, s);
}, true);
document.addEventListener('DOMContentLoaded', () => restoreFolds());

// Full screen hides everything but the court, so step out of it whenever something needs a click.
function leaveFullscreen() {
  const fs = document.fullscreenElement || document.webkitFullscreenElement;
  if (fs) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
}

function openModal(html, { onClose, wide } = {}) {
  leaveFullscreen();
  $('sheet').innerHTML = html;
  $('sheet').className = `sheet${wide ? ' wide' : ''}`;
  $('modal').hidden = false;
  document.body.classList.add('noscroll');
  modalClose = onClose || null;
}

function closeModal() {
  if ($('modal').hidden) return;
  $('modal').hidden = true;
  document.body.classList.remove('noscroll');
  const cb = modalClose;
  modalClose = null;
  if (cb) cb();
}

function initModal() {
  $('modal').onclick = e => { if (e.target === $('modal')) closeModal(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

// --- Full match stats ------------------------------------------------------

const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const mph = kmh => Math.round(kmh * 0.621371);
const UNITS_KEY = 'tourlife.units';
const speedUnit = () => readJSON(UNITS_KEY) || 'mph';
// Serve speed in your chosen unit (mph by default; km/h is a setting on Home).
const speedText = kmh => speedUnit() === 'kmh' ? `${Math.round(kmh)} km/h` : `${mph(kmh)} mph`;

// Derived numbers for one side, given their stats (st) and the opponent's (os).
function derive(st, os, n = 1) {
  const second = st.servePts - st.firstIn, oSecond = os.servePts - os.firstIn;
  const d = {
    firstPct: pct(st.firstIn, st.servePts),
    firstWonPct: pct(st.firstWon, st.firstIn),
    secondWonPct: pct(st.secondWon, second),
    svcWonPct: pct(st.svcHeld, st.svcGames),
    retFirst: os.firstIn - os.firstWon, retFirstPct: pct(os.firstIn - os.firstWon, os.firstIn),
    retSecond: oSecond - os.secondWon, retSecondPct: pct(oSecond - os.secondWon, oSecond),
    retGamesWonPct: pct(os.svcGames - os.svcHeld, os.svcGames),
    bpConvPct: pct(st.bpWon, st.bpChances),
    svcPts: st.firstWon + st.secondWon,
    retPts: os.servePts - os.firstWon - os.secondWon,
    second, oSecond,
  };
  d.serveRating = Math.round(d.firstPct + d.firstWonPct + d.secondWonPct + d.svcWonPct + (st.aces - st.df) / n);
  d.returnRating = d.retFirstPct + d.retSecondPct + d.retGamesWonPct + d.bpConvPct;
  return d;
}

// n = number of matches the stats cover (for season totals, aces and double faults are per match in the rating).
function statSections(rec, n = 1) {
  const a = rec.stats, b = rec.oppStats;
  if (!a || rec.compact || a.servePts === undefined) return null; // older seasons keep only a summary
  const A = derive(a, b, n), B = derive(b, a, n);
  // k says how the bar fills: pct = the actual percentage, share = each side's share of the total,
  // speed = on a 100–240 km/h scale.
  const frac = (n, d) => ({ text: `${n}/${d}`, sub: `(${pct(n, d)}%)`, v: pct(n, d), k: 'pct' });
  const num = v => ({ text: String(v), v, k: 'share' });
  const other = v => speedUnit() === 'kmh' ? `${mph(v)} mph` : `${Math.round(v)} km/h`;
  const speed = v => ({ text: v ? speedText(v) : '—', sub: v ? other(v) : '', v: v || 0, k: 'speed' });
  const total = a.points + b.points;
  return [
    ['Service', [
      ['Serve Rating', num(A.serveRating), num(B.serveRating)],
      ['Aces', num(a.aces), num(b.aces)],
      ['Double Faults', num(a.df), num(b.df), true],
      ['First Serve', frac(a.firstIn, a.servePts), frac(b.firstIn, b.servePts)],
      ['1st Serve Points Won', frac(a.firstWon, a.firstIn), frac(b.firstWon, b.firstIn)],
      ['2nd Serve Points Won', frac(a.secondWon, A.second), frac(b.secondWon, B.second)],
      ['Break Points Saved', frac(a.bpSaved, a.bpFaced), frac(b.bpSaved, b.bpFaced)],
      ['Service Games Played', num(a.svcGames), num(b.svcGames)],
    ]],
    ['Return', [
      ['Return Rating', num(A.returnRating), num(B.returnRating)],
      ['1st Serve Return Points Won', frac(A.retFirst, b.firstIn), frac(B.retFirst, a.firstIn)],
      ['2nd Serve Return Points Won', frac(A.retSecond, B.second), frac(B.retSecond, A.second)],
      ['Break Points Converted', frac(a.bpWon, a.bpChances), frac(b.bpWon, b.bpChances)],
      ['Return Games Played', num(b.svcGames), num(a.svcGames)],
    ]],
    ['Points', [
      ['Net Points Won', frac(a.netWon, a.netPlayed), frac(b.netWon, b.netPlayed)],
      ['Winners', num(a.winners), num(b.winners)],
      ...(a.dropPlayed !== undefined ? [['Drop Shots Won', frac(a.dropWon, a.dropPlayed), frac(b.dropWon, b.dropPlayed)]] : []),
      ...(a.underarm || b.underarm ? [['Underarm Serves Won', frac(a.underarmWon || 0, a.underarm || 0), frac(b.underarmWon || 0, b.underarm || 0)]] : []),
      ['Unforced Errors', num(a.ue), num(b.ue), true],
      ['Service Points Won', frac(A.svcPts, a.servePts), frac(B.svcPts, b.servePts)],
      ['Return Points Won', frac(A.retPts, b.servePts), frac(B.retPts, a.servePts)],
      ['Total Points Won', frac(a.points, total), frac(b.points, total)],
    ]],
    ['Service Speed', [
      ['Max Speed', speed(a.spMax), speed(b.spMax)],
      ['1st Serve Average Speed', speed(a.sp1n && a.sp1 / a.sp1n), speed(b.sp1n && b.sp1 / b.sp1n)],
      ['2nd Serve Average Speed', speed(a.sp2n && a.sp2 / a.sp2n), speed(b.sp2n && b.sp2 / b.sp2n)],
    ]],
  ];
}

function statRow([label, l, r, lowerBetter]) {
  // Bar fill: percentages fill to their real value (10/13 = 77%), counts show each side's share of the
  // total, speeds sit on a 100–240 km/h scale.
  const fill = x => x.k === 'pct' ? clamp(x.v, 0, 100)
    : x.k === 'speed' ? clamp((x.v - 100) / 140 * 100, 0, 100)
    : l.v + r.v > 0 ? x.v / (l.v + r.v) * 100 : 0;
  const lBest = lowerBetter ? l.v < r.v : l.v > r.v;
  const rBest = lowerBetter ? r.v < l.v : r.v > l.v;
  const cell = (x, best, side) => `<div class="sv ${side}${best ? ' best' : ''}">${x.text}${x.sub ? `<small>${x.sub}</small>` : ''}</div>`;
  return `<div class="srow">${cell(l, lBest, 'l')}` +
    `<div class="sbar l${lBest ? ' lead' : ''}"><i style="width:${fill(l)}%"></i></div>` +
    `<div class="slabel">${label}</div>` +
    `<div class="sbar r${rBest ? ' lead' : ''}"><i style="width:${fill(r)}%"></i></div>` +
    `${cell(r, rBest, 'r')}</div>`;
}

const ROUND_FULL = { Q1: 'Qualifying R1', Q2: 'Qualifying R2', Q3: 'Qualifying R3', R32: 'First round', R16: 'Second round', QF: 'Quarter-final', SF: 'Semi-final', F: 'Final' };

// Opens the stats window for one match. item: { rec, ev, week }
function openMatchStats(item, tab = 'stats') {
  const { rec, ev } = item;
  const o = rec.opponent;
  const sections = statSections(rec);
  const story = rec.story || matchStory(rec, ev, current.player);
  const adj = rec.adjustment && IDEAS.find(x => x.id === rec.adjustment);
  const adjWhy = adj && rec.ideas && (rec.ideas.find(x => x.id === adj.id) || {}).why;

  const statsHtml = sections
    ? sections.map(([title, rows]) => `<h3 class="ssec">${title} Stats</h3>${rows.map(statRow).join('')}`).join('')
    : '<p class="hint">Full stats are only recorded for matches played after this update.</p>';
  const storyHtml = story.map(p => `<p>${p}</p>`).join('') +
    (adj ? `<div class="adj"><h3 class="ssec">Adjustment you worked on</h3>` +
      `<b>${adj.title}</b><p class="hint">${adj.desc}</p>${adjWhy ? `<div class="why">${adjWhy}</div>` : ''}` +
      `<div class="chips">${adj.stats.map(k => `<span class="chip">${attrLabel(k)} <b>+${((rec.gain ? totalGain(rec) : FOCUS_GAIN) * 100).toFixed(2)}%</b></span>`).join('')}</div></div>`
      : rec.focus ? '' : '<p class="hint">No adjustment picked yet.</p>') +
    (rec.plan ? `<div class="adj"><h3 class="ssec">Game plans</h3>` +
      `<p><b>You:</b> ${planSummary(rec.plan)}</p><p><b>${esc(shortName(o))}:</b> ${planSummary(rec.oppPlan)}</p></div>` : '');

  openModal(
    `<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<div class="shead">` +
      `<div class="sp"><span class="sflag">${flagOf(current.player.nation)}</span><b>You</b></div>` +
      `<div class="sscore"><div class="${rec.won ? 'good' : 'bad'}">${rec.won ? 'Won' : 'Lost'}</div><b>${rec.score}</b>` +
        `<small>${ROUND_FULL[rec.round]} · ${esc(ev.city)} ${(TIERS[ev.tier] || { label: ev.tier }).label} · ${surfaceLabel(ev.surface)}${item.week ? ` · Week ${item.week}` : ''}</small></div>` +
      `<div class="sp r"><span class="sflag">${flagOf(o.nation)}</span><b>${o.seed ? `(${o.seed}) ` : ''}${esc(o.name)}</b>${o.hand === 'left' ? '<small class="hint">Left-handed</small>' : ''}</div>` +
    `</div>` +
    `<div class="seg stabs"><button type="button" data-tab="stats">Match Stats</button><button type="button" data-tab="story">Story &amp; Feedback</button></div>` +
    `<div id="tabStats" class="sbody">${statsHtml}</div>` +
    `<div id="tabStory" class="sbody story">${storyHtml}</div>`,
    { wide: true });
  const show = t => {
    $('tabStats').hidden = t !== 'stats';
    $('tabStory').hidden = t !== 'story';
    document.querySelectorAll('.stabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  };
  document.querySelector('.stabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); };
  $('mx').onclick = closeModal;
  show(tab);
}

// --- Match history -----------------------------------------------------------

// Every match you've played, newest first: past events plus the one in progress.
function allMatches() {
  const c = current.career || loadCareer();
  const items = [];
  for (const h of c.history) {
    const ev = EVENTS.find(e => e.id === h.event) || { city: h.city, tier: h.tier, surface: h.surface, nation: h.nation };
    for (const rec of h.matches) items.push({ rec, ev, week: h.week });
  }
  const entry = current.entry || loadEntry();
  if (entry) for (const rec of entry.matches) items.push({ rec, ev: eventOf(entry), week: c.week });
  return items.reverse();
}

function renderHistory() {
  const items = allMatches();
  const box = $('hHistory');
  if (!items.length) { box.innerHTML = '<p class="hint">No matches yet. Your results and stats will show up here.</p>'; return; }
  box.innerHTML = items.map((it, i) => {
    const { rec, ev } = it, o = rec.opponent;
    return `<button type="button" class="hrow" data-i="${i}">` +
      `<span class="wl ${rec.won ? 'w' : 'l'}">${rec.won ? 'W' : 'L'}</span>` +
      `<span class="hmain"><b>${flagOf(o.nation)} ${esc(o.name)}</b><small>${rec.round} · ${esc(ev.city)} ${(TIERS[ev.tier] || { label: ev.tier }).label} · Week ${it.week}</small></span>` +
      `<span class="hscore">${rec.score}</span>${rec.replay ? `<span class="hwatch" data-w="${i}">▶ Watch</span>` : ''}</button>`;
  }).join('');
  box.onclick = e => {
    const w = e.target.closest('[data-w]');
    if (w) { watchRealMatch(items[+w.dataset.w].rec); return; }
    const b = e.target.closest('[data-i]'); if (b) openMatchStats(items[+b.dataset.i]);
  };
}

// --- Post-match adjustment picker (popup) ---------------------------------------

const STAT_ICON = { serve: '🎯', ground: '🎾', ret: '↩️', net: '🕸️', stam: '🫁', mental: '🧠', iq: '💡' };

function openIdeas() {
  const entry = current.entry;
  if (!entry || !entry.matches[entry.review]) return;
  const rec = entry.matches[entry.review];
  const player = current.player;
  const gain = totalGain(rec), base = matchGain(rec), games = rec.gamesWatched || 0;
  writeJSON(ENTRY_KEY, entry);
  let pick = null, intro = true;
  // What each idea does to your build: new stats, OVR and playstyle (it can tip you into a new style).
  const afterIdea = idea => {
    const a = { ...player.attrs };
    for (const k of idea.stats) applyGain(a, k, gain);
    return a;
  };
  const stylesNow = detectStyles(player.attrs, player.fav);
  const styleTag = idea => {
    const after = detectStyles(afterIdea(idea), player.fav);
    if (after[0].name !== stylesNow[0].name) return `<div class="istyle warn">⚠️ Changes your style: ${stylesNow[0].name} → <b>${after[0].name}</b></div>`;
    const before = Object.fromEntries(stylesNow.map(x => [x.name, x.score]));
    const gainer = after.map(x => ({ name: x.name, d: x.score - before[x.name] })).sort((a, b) => b.d - a.d)[0];
    return gainer.name === stylesNow[0].name ? `<div class="istyle">Strengthens your <b>${gainer.name}</b> style</div>`
      : `<div class="istyle">Leans toward <b>${gainer.name}</b></div>`;
  };
  const buildHtml = () => {
    const idea = pick && IDEAS.find(x => x.id === pick);
    const after = idea ? afterIdea(idea) : player.attrs;
    const sAfter = detectStyles(after, player.fav);
    const ovr0 = overall(player), ovr1 = overall({ ...player, attrs: after });
    const rows = ATTRS.map(([k, label]) => {
      const up = idea && idea.stats.includes(k);
      return `<div class="hattr${up ? ' up' : ''}"><span>${label}</span><b>${player.attrs[k].toFixed(2)}${up ? ` <em>→ ${after[k].toFixed(2)} (+${(after[k] - player.attrs[k]).toFixed(2)})</em>` : ''}</b></div>`;
    }).join('');
    const top = sAfter.slice(0, 3).map(x => {
      const was = stylesNow.find(y => y.name === x.name).score;
      return `<div class="smeter"><span>${x.name}</span><div class="strack"><i style="width:${Math.round(x.score * 100)}%"></i></div><b>${Math.round(x.score * 100)}%${idea && Math.abs(x.score - was) >= 0.005 ? ` <em class="${x.score > was ? 'pos' : 'neg'}">${x.score > was ? '+' : ''}${Math.round((x.score - was) * 100)}</em>` : ''}</b></div>`;
    }).join('');
    const change = idea && sAfter[0].name !== stylesNow[0].name;
    return `<h3 class="ssec">Your build${idea ? ` · with ${idea.title}` : ''}</h3>` +
      `<div class="ibtop"><span>OVR <b>${ovr0.toFixed(2)}</b>${idea ? ` → <b class="upc">${ovr1.toFixed(2)}</b>` : ''}</span>` +
      `<span>Style <b>${stylesNow[0].name}</b>${change ? ` → <b class="warnc">${sAfter[0].name}</b>` : ''}</span></div>` +
      `<div class="hattrs">${rows}</div><div class="smeters">${top}</div>` +
      (idea ? '' : '<p class="hint center">Tap a card to see what it does to your build.</p>');
  };
  const draw = () => {
    $('ideaCards').innerHTML = rec.ideas.map(({ id, why }, i) => {
      const idea = IDEAS.find(x => x.id === id);
      const chips = idea.stats.map(k => {
        const now = player.attrs[k], eff = gain * growthFactor(now);
        return `<span class="chip${pick === id ? ' open' : ''}"><span>${attrLabel(k)} <b>+${(eff * 100).toFixed(2)}%</b></span>${pick === id ? `<em>${now.toFixed(2)} → ${Math.min(STAT_CAP, now * (1 + eff)).toFixed(2)}</em>` : ''}</span>`;
      }).join('');
      return `<button type="button" class="icard${intro ? ' intro' : ''}${pick === id ? ' on' : ''}${pick && pick !== id ? ' dim' : ''}" data-id="${id}" style="animation-delay:${i * 110}ms">` +
        `<span class="iicon">${STAT_ICON[idea.stats[0]]}</span><b>${idea.title}</b><small>${idea.desc}</small>` +
        (why ? `<div class="why">${why}</div>` : '') + `<div class="chips">${chips}</div>${styleTag(idea)}</button>`;
    }).join('');
    intro = false;
    $('ideaBuild').innerHTML = buildHtml();
    $('ideaGo').disabled = !pick;
    $('ideaGo').textContent = pick ? 'Lock it in' : 'Pick a card';
  };
  openModal(
    `<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<h2 class="itop">Choose your adjustment</h2>` +
    `<p class="hint center">Pick one idea to work into your game. Every stat it trains improves by <b>${(gain * 100).toFixed(2)}%</b>, for good: ${(base * 100).toFixed(2)}% from the match + ${((rec.watchBonus || 0) * 100).toFixed(2)}% for watching ${games} full game${games === 1 ? '' : 's'}` +
    `${rec.fullWatch ? ', <b>tripled for watching the whole match</b>' : games < WATCH_GAMES ? ` (watch ${WATCH_GAMES} full games for the full +2%; the whole match triples it)` : ' (watch the whole match to triple it)'}.</p>` +
    `<div id="ideaCards" class="icards"></div>` +
    `<button type="button" class="btn" id="ideaGo" disabled>Pick a card</button>` +
    `<div id="ideaBuild" class="ibuild"></div>`,
    { wide: true });
  $('ideaCards').onclick = e => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    pick = pick === b.dataset.id ? null : b.dataset.id;
    draw();
  };
  $('ideaGo').onclick = () => {
    if (!pick) return;
    current.pick = pick;
    modalClose = null;
    closeModal();
    saveReview();
  };
  $('mx').onclick = closeModal;
  draw();
}

// --- Game plan report: how your plan has gone across recent matches -------------

// Summary tiles for a set of matches (used on the draw screen for the current event).
function renderPlanReport(box, items, emptyText) {
  if (!items.length) { box.innerHTML = `<p class="hint">${emptyText}</p>`; return; }
  const { t, o, wins, n } = sumStats(items);
  const oppRetPts = o.servePts - o.firstWon - o.secondWon;
  const cells = [
    ['Record', `${wins}–${n - wins}`, `${n} match${n === 1 ? '' : 'es'}`],
    ['1st serve in', `${pct(t.firstIn, t.servePts)}%`, `${(t.aces / n).toFixed(1)} aces a match`],
    ['Return pts won', `${pct(oppRetPts, o.servePts)}%`, ''],
    ['Winners / errors', `${t.winners} / ${t.ue}`, `${(t.winners / Math.max(1, t.ue)).toFixed(2)} ratio`],
    ['Net points won', `${pct(t.netWon, t.netPlayed)}%`, `${t.netWon}/${t.netPlayed}`],
    ['Drop shots won', `${pct(t.dropWon || 0, t.dropPlayed || 0)}%`, `${t.dropWon || 0}/${t.dropPlayed || 0}`],
  ];
  box.innerHTML = cells.map(([k, v, sub]) => `<div class="rcell"><span>${k}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`).join('');
}

// Adds up your stats (t) and your opponents' (o) over a set of matches.
function sumStats(items) {
  const t = {}, o = {};
  let wins = 0;
  for (const { rec } of items) {
    if (!rec.stats || !rec.oppStats) continue;
    if (rec.won) wins++;
    for (const [k, v] of Object.entries(rec.stats)) t[k] = k === 'spMax' ? Math.max(t[k] || 0, v) : (t[k] || 0) + v;
    for (const [k, v] of Object.entries(rec.oppStats)) o[k] = k === 'spMax' ? Math.max(o[k] || 0, v) : (o[k] || 0) + v;
  }
  return { t, o, wins, n: items.length };
}

// --- Player stats over a period ------------------------------------------------------

const PERIODS = [['event', 'This event'], ['4w', 'Last 4 weeks'], ['season', 'This season'], ['career', 'Career']];
const seasonOf = week => Math.floor((week - 1) / 52) + 1;

function periodItems(period) {
  const c = current.career || loadCareer();
  const all = allMatches();
  const entry = current.entry;
  return all.filter(it => {
    if (period === 'event') return entry ? it.week === c.week && entry.matches.includes(it.rec) : it.week === c.week - 1;
    if (period === '4w') return it.week > c.week - 4;
    if (period === 'season') return seasonOf(it.week) === seasonOf(c.week);
    return true;
  });
}

// Win–loss split by each game plan setting, and by surface.
function splitsHtml(items) {
  const wl = list => { const w = list.filter(x => x.rec.won).length; return `${w}–${list.length - w}`; };
  const rows = GAME_PLAN.map(g => {
    const cells = g.opts.map(([v, l]) => {
      const m = items.filter(it => it.rec.plan && it.rec.plan[g.key] === v);
      return m.length ? `<span class="split"><em>${l}</em> ${wl(m)}</span>` : '';
    }).join('');
    return cells ? `<div class="srow2"><b>${g.label}</b><div>${cells}</div></div>` : '';
  }).join('');
  const surf = SURFACES.map(([v, l]) => {
    const m = items.filter(it => it.ev.surface === v);
    return m.length ? `<span class="split"><em>${l}</em> ${wl(m)}</span>` : '';
  }).join('');
  return (surf ? `<div class="srow2"><b>Surface</b><div>${surf}</div></div>` : '') +
    (rows || '<p class="hint">Plan splits show up for matches played with a game plan.</p>');
}

function openPlayerStats(period = current.entry ? 'event' : 'season') {
  const items = periodItems(period).filter(it => it.rec.stats.servePts !== undefined);
  const p = current.player;
  let body;
  if (!items.length) body = '<p class="hint center">No matches with full stats in this period yet.</p>';
  else {
    const { t, o, wins, n } = sumStats(items);
    const sections = statSections({ stats: t, oppStats: o }, n);
    body = `<div class="sscore center"><div class="${wins >= n - wins ? 'good' : 'bad'}">Record</div><b>${wins}–${n - wins}</b>` +
      `<small>${n} match${n === 1 ? '' : 'es'} · You vs your opponents (combined)</small></div>` +
      `<h3 class="ssec">Splits</h3>${splitsHtml(items)}` +
      sections.map(([title, rows]) => `<h3 class="ssec">${title} Stats</h3>${rows.map(statRow).join('')}`).join('');
  }
  openModal(
    `<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<h2 class="itop">${flagOf(p.nation)} ${esc(p.name)}: stats</h2>` +
    `<div class="seg periods">${PERIODS.map(([v, l]) => `<button type="button" data-p="${v}" class="${v === period ? 'on' : ''}">${l}</button>`).join('')}</div>` +
    `<div class="slegend"><span class="me">You</span><span>Opponents</span></div>` +
    `<div class="sbody">${body}</div>`,
    { wide: true });
  document.querySelector('.periods').onclick = e => { const b = e.target.closest('[data-p]'); if (b) openPlayerStats(b.dataset.p); };
  $('mx').onclick = closeModal;
}
