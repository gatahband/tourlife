// rivals.js — a living tour: players you meet are remembered (with their stats and age), turn up again
// at events of their level, improve or decline each season, and build head-to-head records with you.
// Three or more meetings with at least two close ones (a deciding set or a tiebreak) make them a rival.

const POOL_MAX = 220;

// The pool lives in the career, so it travels with saved careers and save codes.
const poolOf = c => (c.pool = c.pool || {});
const h2hOf = c => (c.h2h = c.h2h || {});

function poolAdd(c, o, week) {
  if (!o || !o.id || o.isPlayer) return;
  const pool = poolOf(c);
  const keep = ['id', 'name', 'nation', 'attrs', 'age', 'temperament', 'hand', 'backhand', 'curve', 'formSd', 'fav', 'worst', 'plan', 'atp', 'atpRank'];
  pool[o.id] = { ...Object.fromEntries(keep.filter(k => o[k] !== undefined).map(k => [k, o[k]])), attrs: { ...o.attrs }, met: week };
  // Too many: forget the least recently met players who aren't rivals.
  const ids = Object.keys(pool);
  if (ids.length > POOL_MAX) {
    ids.filter(id => !isRival(c, id)).sort((a, b) => pool[a].met - pool[b].met)
      .slice(0, ids.length - POOL_MAX).forEach(id => delete pool[id]);
  }
}

const isRival = (c, id) => { const h = h2hOf(c)[id]; return !!h && h.w + h.l >= 3 && h.close >= 2; };

// After you play someone: update the head-to-head. Returns { h, newRival }.
function h2hRecord(c, opp, rec, ev) {
  if (!opp.id) return null;
  const h2h = h2hOf(c);
  const was = isRival(c, opp.id);
  const h = h2h[opp.id] = h2h[opp.id] || { w: 0, l: 0, close: 0 };
  if (rec.won) h.w++; else h.l++;
  if (rec.sets.length === 3 || rec.sets.some(s => s.tb)) h.close++;
  h.last = { week: c.week, won: rec.won, score: rec.score, city: ev.city, round: rec.round };
  poolAdd(c, opp, c.week);
  return { h: { ...h }, newRival: !was && isRival(c, opp.id) };
}

// Ranking a player of this rating would typically hold (inverse of rankToOvr).
function ovrToRank(ovr) {
  if (ovr >= RANK_OVR[0][1]) return 1;
  for (let i = 1; i < RANK_OVR.length; i++) {
    const [r0, o0] = RANK_OVR[i - 1], [r1, o1] = RANK_OVR[i];
    if (ovr >= o1) return Math.round(r0 * Math.exp(Math.log(r1 / r0) * (o0 - ovr) / (o0 - o1)));
  }
  return Math.round(1500 + (49 - ovr) * 120);
}

// Swap some of a new field for remembered players whose level suits this event. Rivals are the most
// likely to turn up. Keeps your seeding rules (call before the draw is made).
function mixInPool(entrants, c, tier, playerRank) {
  const pool = poolOf(c), lvl = TIERS[tier].level;
  const taken = new Set(entrants.map(e => e.name));
  // Real ATP players only turn up at tour events (see realplayers.js).
  const fits = Object.values(pool).filter(p => !p.atp && !taken.has(p.name) && Math.abs(overall(p) - lvl) <= (isRival(c, p.id) ? 8 : 5));
  const rivals = fits.filter(p => isRival(c, p.id) && Math.random() < 0.6);
  const others = fits.filter(p => !isRival(c, p.id)).sort(() => Math.random() - 0.5).slice(0, Math.round(entrants.length * 0.3));
  const chosen = [...rivals, ...others].slice(0, entrants.length - 4);
  // Replace unseeded generated players (keep you, at index 0).
  const slots = entrants.map((e, i) => i).filter(i => i > 0 && !entrants[i].fromPool).sort(() => Math.random() - 0.5);
  chosen.forEach((p, k) => {
    if (k >= slots.length) return;
    entrants[slots[k]] = { ...p, attrs: { ...p.attrs }, plan: { ...p.plan }, seed: null, fromPool: true };
  });
  const strength = p => p.isPlayer ? rankToOvr(playerRank) : overall(p);
  entrants.forEach(e => { e.seed = null; });
  [...entrants].sort((a, b) => strength(b) - strength(a)).forEach((p, i) => { p.seed = i < 8 && strength(p) > 0 ? i + 1 : null; });
}

// New season: everyone in the pool gets a year older. Young players improve, players past 30 decline.
function poolAge(c) {
  for (const p of Object.values(poolOf(c))) {
    p.age = (p.age || 24) + 1;
    const drift = p.age <= 21 ? 2.2 : p.age <= 24 ? 1.2 : p.age <= 27 ? 0.4 : p.age <= 30 ? -0.3 : -1.6;
    for (const k of Object.keys(p.attrs)) {
      // Stamina fades first with age; smarts and nerve keep growing a little longer.
      const kd = k === 'stam' && p.age > 28 ? drift - 0.8 : (k === 'iq' || k === 'mental') && p.age > 27 ? drift + 0.6 : drift;
      p.attrs[k] = Math.round(clamp(p.attrs[k] + kd + gauss(Math.random) * 1.2, 20, 95));
    }
  }
}

// One line for the scouting card: the head-to-head and the last meeting.
function h2hLine(c, opp) {
  const h = opp.id && h2hOf(c)[opp.id];
  if (!h) return opp.fromPool ? `<p class="h2h">You haven't played ${esc(shortName(opp))} yet, but you've seen them around the tour.</p>` : '';
  const lead = h2hText(h, esc(shortName(opp)));
  const last = h.last ? ` · Last time: ${h.last.won ? 'you won' : 'you lost'} ${h.last.score} (${esc(h.last.city)}, ${h.last.round})` : '';
  return `<p class="h2h">${isRival(c, opp.id) ? '<span class="rivaltag">⚔️ RIVAL</span> ' : ''}<b>Head-to-head:</b> ${lead}${last}</p>`;
}

// One sentence for the match story.
function h2hStory(rec) {
  if (!rec.h2h) return '';
  const { w, l } = rec.h2h, name = esc(shortName(rec.opponent));
  if (rec.newRival) return `That's ${w + l} tight battles with ${name} now. A real rivalry is forming.`;
  if (w + l < 2) return '';
  return w > l ? `You lead the head-to-head with ${name} ${w}–${l}.` : w < l ? `${name} leads your head-to-head ${l}–${w}.` : `Your head-to-head with ${name} is tied at ${w}–${l}.`;
}

// Home card: rivals and the players you've met most. Each row is "You vs Them"; tap it to open the
// head-to-head, the last meeting and every match between you.
const h2hText = (h, oppName) => h.w > h.l ? `You lead ${h.w}–${h.l}` : h.w < h.l ? `${oppName} leads ${h.l}–${h.w}` : `Tied ${h.w}–${h.l}`;

function renderRivals(c) {
  const h2h = h2hOf(c), pool = poolOf(c), me = current.player;
  const ids = Object.keys(h2h).filter(id => pool[id] && pool[id].name && h2h[id].w + h2h[id].l >= 2)
    .sort((a, b) => (isRival(c, b) - isRival(c, a)) || (h2h[b].w + h2h[b].l) - (h2h[a].w + h2h[a].l)).slice(0, 6);
  $('hRivalsCard').hidden = !ids.length;
  if (!ids.length) return;
  const myRank = currentRank(c);
  $('hRivals').innerHTML = `<p class="hint">Players you've faced more than once. ⚔️ = rival (3+ meetings, 2+ of them close). Tap one for the head-to-head.</p>` + ids.map(id => {
    const p = pool[id], h = h2h[id], r = p.atpRank || ovrToRank(overall(p));
    const items = allMatches().filter(it => it.rec.opponent && (it.rec.opponent.id === id || (!it.rec.opponent.id && it.rec.opponent.name === p.name)));
    return `<details class="rvbox">` +
      `<summary class="rvrow">${isRival(c, id) ? '<span class="rivaltag">⚔️</span>' : ''}<span class="adname"><b>${flagOf(me.nation)} ${esc(me.name)} <span class="rvvs">vs</span> ${flagOf(p.nation)} ${esc(p.name)}</b>` +
      `<small>${h.w + h.l} meetings · they're ${p.atpRank ? `ATP #${p.atpRank}` : `about #${r}`}${myRank ? (r < myRank ? ' (above you)' : ' (below you)') : ''}</small></span><span class="chev">▾</span></summary>` +
      `<div class="rvbody"><div class="rvlead ${h.w > h.l ? 'up' : h.w < h.l ? 'down' : ''}">${h2hText(h, esc(shortName(p)))}</div>` +
      (h.last ? `<p class="hint">Last time: ${h.last.won ? 'you won' : 'you lost'} ${h.last.score} · ${esc(h.last.city)} ${h.last.round}</p>` : '') +
      `<p class="hint">Age ${p.age} · ${p.hand === 'left' ? 'left-handed' : 'right-handed'}${TEMPERAMENTS[p.temperament] ? ` · ${TEMPERAMENTS[p.temperament].emoji} ${TEMPERAMENTS[p.temperament].name}` : ''}</p>` +
      `<div class="hlist">${items.map((it, i) => `<button type="button" class="hrow" data-rvm="${id}" data-i="${i}"><span class="wl ${it.rec.won ? 'w' : 'l'}">${it.rec.won ? 'W' : 'L'}</span>` +
        `<span class="hmain"><b>${esc(it.ev.city)} · ${it.rec.round}</b><small>Week ${weekInSeason(it.week)}, season ${seasonOfWeek(it.week)}</small></span><span class="hscore">${it.rec.score}</span></button>`).join('')}</div></div></details>`;
  }).join('');
  $('hRivals').onclick = e => {
    const b = e.target.closest('[data-rvm]');
    if (!b) return;
    const p = pool[b.dataset.rvm];
    const items = allMatches().filter(it => it.rec.opponent && (it.rec.opponent.id === b.dataset.rvm || (!it.rec.opponent.id && it.rec.opponent.name === p.name)));
    openMatchStats(items[+b.dataset.i]);
  };
}

// Every match against one opponent.
function openRival(id) {
  const c = current.career, p = poolOf(c)[id], h = h2hOf(c)[id];
  const items = allMatches().filter(it => it.rec.opponent && (it.rec.opponent.id === id || (!it.rec.opponent.id && it.rec.opponent.name === p.name)));
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<h2 class="itop">${flagOf(p.nation)} ${esc(p.name)}</h2>` +
    `<p class="big center">${isRival(c, id) ? '⚔️ Rival · ' : ''}You ${h.w}–${h.l} ${esc(shortName(p))}</p>` +
    `<p class="hint center">Age ${p.age} · ${p.hand === 'left' ? 'left-handed' : 'right-handed'} · ${TEMPERAMENTS[p.temperament] ? TEMPERAMENTS[p.temperament].emoji + ' ' + TEMPERAMENTS[p.temperament].name : ''}</p>` +
    `<div class="hlist">${items.map((it, i) => `<button type="button" class="hrow" data-i="${i}"><span class="wl ${it.rec.won ? 'w' : 'l'}">${it.rec.won ? 'W' : 'L'}</span>` +
      `<span class="hmain"><b>${esc(it.ev.city)} · ${it.rec.round}</b><small>Week ${weekInSeason(it.week)}, season ${seasonOfWeek(it.week)}</small></span><span class="hscore">${it.rec.score}</span></button>`).join('') || '<p class="hint">No match records found.</p>'}</div>`);
  $('mx').onclick = closeModal;
  $('sheet').querySelector('.hlist').onclick = e => { const b = e.target.closest('[data-i]'); if (b) { closeModal(); openMatchStats(items[+b.dataset.i]); } };
}
