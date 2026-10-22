// planbook.js — the Plan Book: every game plan you've used against each playstyle, set by set, and how it went.
// Before a match it suggests the plans that have worked best against that kind of player; on Home it lists
// every style you've faced. Kept as small running totals on the career (career.planBook), so it never gets big.

// The settings that make a plan a "different plan" (the advanced ones count only when you've changed them).
const PB_CORE = ['serve', 'returnPos', 'aggression', 'spin', 'net', 'drops', 'sig', 'underarm'];
const PB_ADV = ['wing', 'depth', 'energy', 'pressure'];
const pbPlan = plan => { const p = { ...DEFAULT_PLAN, ...plan }; return Object.fromEntries([...PB_CORE, ...PB_ADV.filter(k => p[k] !== DEFAULT_PLAN[k])].map(k => [k, p[k]])); };
const pbKey = plan => JSON.stringify(pbPlan(plan));
const PB_MAX = 10; // plans remembered per playstyle (the least used drop off)

// After a match: credit each set to the plan you started it with, and the match to the plan you finished with.
function pbRecord(c, rec, setPlans) {
  const style = rec.styles && rec.styles[1];
  if (!style || !rec.sets || !rec.sets.length) return;
  const book = c.planBook = c.planBook || {}, byStyle = book[style] = book[style] || {};
  const entry = plan => { const k = pbKey(plan); return byStyle[k] = byStyle[k] || { plan: pbPlan(plan), sw: 0, sl: 0, mw: 0, ml: 0, last: 0 }; };
  rec.sets.forEach((st, i) => {
    const e = entry(setPlans[i] || setPlans[setPlans.length - 1] || rec.plan);
    if (st.games[0] > st.games[1]) e.sw++; else e.sl++;
    e.last = c.week;
  });
  const fin = entry(rec.plan);
  if (rec.won) fin.mw++; else fin.ml++;
  // Keep it small: drop the least used plans for this style.
  const keys = Object.keys(byStyle);
  if (keys.length > PB_MAX) keys.sort((a, b) => (byStyle[a].sw + byStyle[a].sl) - (byStyle[b].sw + byStyle[b].sl) || byStyle[a].last - byStyle[b].last)
    .slice(0, keys.length - PB_MAX).forEach(k => delete byStyle[k]);
}

// Plans against a style, best first. A plan needs a few sets before it can top the list (a lucky set isn't proof).
function pbRanked(c, style) {
  const byStyle = (c.planBook || {})[style] || {};
  return Object.values(byStyle).map(e => ({ ...e, n: e.sw + e.sl, score: (e.sw + 1) / (e.sw + e.sl + 2) }))
    .sort((a, b) => (b.n >= 3) - (a.n >= 3) || b.score - a.score || b.n - a.n);
}
const pbRecordLine = e => `${e.sw}–${e.sl} in sets${e.mw + e.ml ? ` · ${e.mw}–${e.ml} in matches` : ''}`;
const pbStyleTotals = (c, style) => Object.values((c.planBook || {})[style] || {}).reduce((t, e) => ({ sw: t.sw + e.sw, sl: t.sl + e.sl, mw: t.mw + e.mw, ml: t.ml + e.ml }), { sw: 0, sl: 0, mw: 0, ml: 0 });

// Before a match: what has worked against this opponent's playstyle, with one-tap buttons to use it.
let pbShown = [];
function pbMatchHtml(c, style, current) {
  const list = pbRanked(c, style).slice(0, 3);
  pbShown = list.map(e => e.plan);
  if (!list.length) return `<p class="hint">No matches against a ${esc(style)} yet. Every set you play against one is saved here, with the plan you used.</p>`;
  const curKey = pbKey(current || {});
  return `<div class="pblist">${list.map((e, i) => {
    const good = e.n >= 3 && e.score >= 0.6, bad = e.n >= 3 && e.score < 0.4, mine = pbKey(e.plan) === curKey;
    return `<div class="pbrow ${good ? 'good' : bad ? 'bad' : ''}"><div><b>${i === 0 && e.n >= 3 ? '⭐ ' : ''}${esc(pbRecordLine(e))}</b>` +
      `<small>${esc(planSummary({ ...DEFAULT_PLAN, ...e.plan }))}</small>${e.n < 3 ? '<em>Only a set or two so far</em>' : bad ? '<em>This hasn\'t worked: think twice</em>' : ''}</div>` +
      (mine ? '<span class="pbon">✓ Your Plan</span>' : bad ? '' : `<button type="button" class="btn small ghost" data-pbuse="${i}">Use This Plan</button>`) + `</div>`;
  }).join('')}</div>`;
}
// The fold's one-line summary.
function pbMatchSum(c, style) {
  const best = pbRanked(c, style)[0], t = pbStyleTotals(c, style);
  return !best ? 'Nothing saved yet' : `${t.mw}–${t.ml} vs ${style}s${best.n >= 3 ? ` · best plan ${best.sw}–${best.sl} in sets` : ''}`;
}

// Home: every playstyle you've faced, your record against it and the plan that has worked best.
function pbHomeHtml(c) {
  const styles = Object.keys(c.planBook || {}).map(s => ({ s, t: pbStyleTotals(c, s), best: pbRanked(c, s)[0] }))
    .filter(x => x.t.sw + x.t.sl).sort((a, b) => (b.t.sw + b.t.sl) - (a.t.sw + a.t.sl));
  if (!styles.length) return `<p class="hint center">Your Plan Book fills up as you play. Every set is saved with the game plan you used and the opponent's playstyle, and the plans that work get suggested before your next match against that kind of player.</p>`;
  return `<p class="hint center">What has worked against each kind of player. Before a match, your best plan against that style is suggested in the scouting report.</p>` +
    `<div class="pbstyles">${styles.map(({ s, t, best }) => `<div class="pbstyle"><div class="pbshead"><b>${esc(s)}</b><span>${t.mw}–${t.ml} in matches · ${t.sw}–${t.sl} in sets</span></div>` +
      (best && best.n >= 3 ? `<small>⭐ Best plan (${best.sw}–${best.sl} in sets): ${esc(planSummary({ ...DEFAULT_PLAN, ...best.plan }))}</small>` : '<small>Not enough sets yet to call a best plan.</small>') + `</div>`).join('')}</div>`;
}

// "Use This Plan": copies it into this tournament's plan. rerender redraws whichever screen you're on.
let pbRerender = null;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pbuse]');
  if (!b || !current.entry) return;
  const plan = pbShown[+b.dataset.pbuse];
  if (!plan) return;
  Object.assign(eventPlan(current.entry), plan);
  saveEventPlan(current.entry);
  if (pbRerender) pbRerender();
});
