// reads.js — Match Reads, the Tactical rating and the win-probability meter.
// A Match Read stops the match twice a set (after games 3 and 7). You get the raw numbers from this set so far,
// no diagnosis, and you can change up to two settings of your game plan (or keep it). Right changes help for the
// rest of the set, wrong ones hurt, and doing nothing when they've worked you out costs you too. Reads get harder
// as you climb, and your Tactical rating (earned from reads) limits how far your stats can grow.

// --- The evidence: this set's numbers, side by side ------------------------------------------------
function readEvidence(m, me, lastGames = 0) {
  const op = 1 - me, side = () => ({ sp: 0, sw: 0, s1: 0, s1in: 0, s1w: 0, s2: 0, s2w: 0, rp: 0, rw: 0, win: 0, ue: 0, net: 0, netW: 0, long: 0, longW: 0, drops: 0, dropW: 0, len: 0, n: 0 });
  const S = [side(), side()];
  let pts = m.points || [];
  if (lastGames) { const ends = pts.map((p, i) => p.end ? i : -1).filter(i => i >= 0); if (ends.length > lastGames) pts = pts.slice(ends[ends.length - lastGames - 1] + 1); }
  for (const pt of pts) {
    if (pt.s === undefined) continue;
    const s = pt.s, r = 1 - s, w = pt.w, l = 1 - w;
    S[s].sp++; S[r].rp++; if (w === s) S[s].sw++; else S[r].rw++;
    if (!pt.serve2) { S[s].s1in++; if (w === s) S[s].s1w++; } else { S[s].s2++; if (w === s) S[s].s2w++; }
    S[s].s1++;
    if (pt.how === 'winner' || pt.how === 'ace') S[w].win++;
    if (pt.how === 'ue' || pt.how === 'df') S[l].ue++;
    if (pt.wing && pt.how === 'winner') S[w][pt.wing + 'W'] = (S[w][pt.wing + 'W'] || 0) + 1;
    if (pt.wing && (pt.how === 'ue' || pt.how === 'fe')) S[l][pt.wing + 'E'] = (S[l][pt.wing + 'E'] || 0) + 1;
    if (pt.net) { S[pt.net.by].net++; if (pt.w === pt.net.by) S[pt.net.by].netW++; }
    if (pt.drop) { S[pt.drop.by].drops++; if (pt.w === pt.drop.by) S[pt.drop.by].dropW++; }
    const len = pt.len || 1;
    S[0].len += len; S[0].n++;
    if (len >= 7) { S[0].long++; S[w].longW++; }
  }
  const pc = (a, b) => b ? `${Math.round(a / b * 100)}%` : '–';
  const Y = S[me], T = S[op];
  return {
    raw: { Y, T, avgLen: S[0].n ? S[0].len / S[0].n : 0, long: S[0].long },
    rows: [
      ['First Serves In', pc(Y.s1in, Y.s1), pc(T.s1in, T.s1)],
      ['1st-Serve Points Won', pc(Y.s1w, Y.s1in), pc(T.s1w, T.s1in)],
      ['2nd-Serve Points Won', pc(Y.s2w, Y.s2), pc(T.s2w, T.s2)],
      ['Return Points Won', pc(Y.rw, Y.rp), pc(T.rw, T.rp)],
      ['Winners', Y.win, T.win],
      ['Winners: Forehand / Backhand', `${Y.fhW || 0} / ${Y.bhW || 0}`, `${T.fhW || 0} / ${T.bhW || 0}`],
      ['Unforced Errors', Y.ue, T.ue],
      ['Rally Errors: Forehand / Backhand', `${Y.fhE || 0} / ${Y.bhE || 0}`, `${T.fhE || 0} / ${T.bhE || 0}`],
      ['Net Points Won', `${Y.netW}/${Y.net}`, `${T.netW}/${T.net}`],
      ['Long Rallies (7+) Won', `${S[me].longW}`, `${S[op].longW}`],
      ['Drop Shots Won', `${Y.dropW}/${Y.drops}`, `${T.dropW}/${T.drops}`],
    ],
  };
}

// Who's ahead on a stat row (0 = you, 1 = them, -1 = level or no data). Errors: fewer is better.
function statLead(label, y, t) {
  const val = v => { v = String(v); if (v.includes('%')) return parseFloat(v) / 100; const m = v.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) return /Forehand \/ Backhand/.test(label) ? +m[1] + +m[2] : +m[2] ? +m[1] / +m[2] : -1; return parseFloat(v); }; // none tried: behind anyone who did
  const a = val(y), b = val(t);
  if (!isFinite(a) || !isFinite(b) || (a === -1 && b === -1)) return -1;
  if (a === b) return 2; // level
  const lowerBetter = /Errors/.test(label);
  return (a > b) !== lowerBetter ? 0 : 1;
}

// How hard reads are at this level: 0 ITF (one clear pointer), 1 Challenger, 2 ATP, 3 against a legend.
function readLevel(ev, opp) {
  if (typeof isLegend === 'function' && isLegend(opp)) return 3;
  return ['ATP250', 'ATP500', 'M1000', 'GS'].includes(ev.tier) ? 2 : ['CH75', 'CH125'].includes(ev.tier) ? 1 : 0;
}

// What the opponent has done to your plan this match (their adjustments against you).
const adaptsAgainst = (m, me) => (m.adapted || []).filter(a => a.against === me);

// The read: is the plan you leave with better than the one you came in with, given what's really going on?
function judgeRead(m, ps, me, ev, before, after) {
  const opp = ps[1 - me], A = { ...ps[me], plan: before }, B = { ...ps[me], plan: after };
  const sh = p => strengthHits(p, opp).length, rh = p => readHits(p, opp, ev);
  const notes = [];
  let q = 0;
  const shB = sh(A), shA = sh(B), rhB = rh(A), rhA = rh(B);
  if (shA < shB) { q += 0.5 * (shB - shA); notes.push('You stopped playing into their strengths.'); }
  if (shA > shB) { q -= 0.5 * (shA - shB); notes.push(...strengthHits(B, opp).filter(x => !strengthHits(A, opp).includes(x)).map(x => `Wrong turn: ${x}.`)); }
  if (rhA > rhB) { q += 0.35 * (rhA - rhB); notes.push('You went after a real weakness of theirs.'); }
  if (rhA < rhB) { q -= 0.35 * (rhB - rhA); notes.push('You dropped something that was working against them.'); }
  // They worked out part of your plan: did you change the very thing they're countering?
  const ad = adaptsAgainst(m, me).filter(a => !a.answered).slice(-1)[0];
  if (ad) {
    const answered = ad.key === 'plan' ? JSON.stringify(before) !== JSON.stringify(after) : (before[ad.key] || DEFAULT_PLAN[ad.key]) !== (after[ad.key] || DEFAULT_PLAN[ad.key]);
    if (answered) { q += 0.6; ad.answered = true; notes.push(`They had adjusted (${ad.label}), and you changed exactly that.`); }
    else { q -= 0.45; notes.push(`They had adjusted (${ad.label}), and you didn't answer it.`); }
  }
  const changed = GAME_PLAN.filter(g => (before[g.key] || DEFAULT_PLAN[g.key]) !== (after[g.key] || DEFAULT_PLAN[g.key])).length;
  // Keeping your plan is only right if it's actually working: no strengths walked into, and it already goes
  // after their weaknesses. Keeping a plan that doesn't is a missed chance.
  if (!changed && !ad) {
    if (shB > 0) { q -= 0.25; notes.push(...strengthHits(A, opp).map(x => `You kept ${x}.`)); }
    else if (rhB >= 2) { q += 0.3; notes.push('Your plan was already exploiting their weaknesses: keeping it was right.'); }
    else if (rhB === 1) { q += 0.05; notes.push('Your plan was fine, but there was more to find in their game.'); }
    else { q -= 0.1; notes.push('Your plan wasn\'t going after anything in their game. There was something to find.'); }
  }
  if (changed && q === 0) { q -= 0.15; notes.push('The changes didn\'t address anything that was going wrong.'); }
  return { q: clamp(q, -1, 1), notes, changed, answered: !!(ad && ad.answered) };
}

// --- The Tactical rating ---------------------------------------------------------------------------
// Starts at 30 and moves with every read (harder reads count for more). Your stats can only grow so far
// above it: about 72 + 0.28 × Tactical (so 95 OVR needs a Tactical rating around 82).
const tacticalOf = c => (c && c.tactical !== undefined ? c.tactical
  : typeof current !== 'undefined' && current.player ? clamp((overall(current.player) - 72) / 0.28, 30, 100) : 30); // existing careers start where they are
const tacticalCap = c => 72 + 0.28 * tacticalOf(c);
function addTactical(c, q, level) {
  const t = tacticalOf(c), w = [1.5, 2.2, 3, 4][level] || 2;
  c.tactical = clamp(t + q * w * (q > 0 ? Math.max(0.15, 1 - t / 110) : 1), 0, 100);
}

// --- The read itself (in the court overlay, like a changeover) -------------------------------------
function openRead(entry, ps, me, step) {
  const L = entry.live, m = L.m, opp = ps[1 - me], ev = eventOf(entry), lvl = readLevel(ev, opp);
  const before = { ...DEFAULT_PLAN, ...planOf(ps[me]) }, pl = { ...before };
  const fast = L.mode === 'read'; // the fast route: more at stake, less to go on, debrief later
  const evd = readEvidence(m, me, fast ? 3 : 0), box = $('mCallBox');
  if ($('mMeter')) $('mMeter').classList.add('frozen');
  // Clues by level: a pointer at the ITFs, their adjustment named at the Challengers, only a hint on tour,
  // nothing at all against a legend.
  const ad = adaptsAgainst(m, me).filter(a => !a.answered).slice(-1)[0];
  const clue = lvl === 0 ? readPointer(evd, ad) : lvl === 1 && ad ? `They've adjusted: ${ad.label}.` : lvl === 2 && ad ? 'Something in how they play you has changed.' : '';
  const MAX = 2;
  const draw = () => {
    const changed = GAME_PLAN.filter(g => pl[g.key] !== before[g.key]).length;
    box.innerHTML = `<div class="cbtitle">📋 MATCH READ · SET ${m.sets.length + 1} · YOU ${m.games[me]}–${m.games[1 - me]}</div>` +
      `<p class="rdhint">${fast ? 'The last 3 games' : 'This set so far'}: read the numbers, then keep your plan or change up to ${MAX} settings.${fast ? ' <b>A lot rides on this one.</b>' : ''}</p>` +
      `<table class="rdtab"><tr><th></th><th>You</th><th>${esc(shortName(opp))}</th></tr>${evd.rows.map(([k, y, t]) => { const L = statLead(k, y, t);
        return `<tr><td>${k}</td><td class="${L === 0 ? 'lead' : L === 2 ? 'tie' : ''}">${y}</td><td class="${L === 1 ? 'lead' : L === 2 ? 'tie' : ''}">${t}</td></tr>`; }).join('')}` +
      `<tr><td>Average Rally</td><td colspan="2">${evd.raw.avgLen.toFixed(1)} shots</td></tr></table>` +
      (clue ? `<p class="rdclue">🔎 ${esc(clue)}</p>` : '') +
      `<div class="pcgrid" id="rdGrid"></div>` +
      `<div class="pcbtns"><span class="rdcount">${changed}/${MAX} Changes</span><button type="button" class="btn small" data-rd="go">${changed ? '✅ Lock In Changes' : '▶️ Keep My Plan'}</button>` +
      (changed ? `<button type="button" class="btn small ghost" data-rd="reset">Undo</button>` : '') + `</div>`;
    compactPlanEditor($('rdGrid'), pl);
    // Limit: once two settings differ, a third change is undone.
    $('rdGrid').addEventListener('click', () => setTimeout(() => {
      const diff = GAME_PLAN.filter(g => pl[g.key] !== before[g.key]);
      if (diff.length > MAX) { const last = diff[diff.length - 1]; pl[last.key] = before[last.key]; }
      draw();
    }, 0));
  };
  draw();
  box.className = 'callbox rdwin'; // its own solid window over the court, so the numbers are fully readable
  Court.banner(null); $('mCourtWrap').classList.add('veiled'); // nothing from the court shows (or flickers) behind it
  box.hidden = false;
  box.scrollTop = 0; // always open at the top (the title was getting cut off)
  return new Promise(done => {
    const finish = () => {
      box.hidden = true; box.onclick = null; box.className = 'callbox'; $('mCourtWrap').classList.remove('veiled');
      const j = judgeRead(m, ps, me, ev, before, pl);
      ps[me].plan = { ...pl };
      // Consequences: answering their adjustment wins back what it cost; a wrong turn costs more.
      const stake = fast ? 1.75 : 1;
      if (j.answered) m.exec[me] = Math.min(1.5, m.exec[me] + 0.3 * stake);
      if (j.q > 0.2 && !j.answered) m.exec[me] = Math.min(1.5, m.exec[me] + 0.1 * stake);
      if (j.q < 0) m.exec[me] = Math.max(0, m.exec[me] - 0.15 * -j.q * stake);
      showPlanOnCourt(ps[me]);
      L.reads = [...(L.reads || []), { set: m.sets.length + 1, q: j.q, level: lvl }];
      if (j.q > 0.2) L.goodReads = (L.goodReads || 0) + 1;
      addTactical(current.career, j.q * (fast ? 1.5 : 1), lvl);
      writeJSON(CAREER_KEY, current.career);
      L.calls = (L.calls || []).filter(c => !(c.step === step && c.id === 'plan'));
      L.calls.push({ step, id: 'plan', plan: { ...pl }, exec: m.exec[me], read: true });
      writeJSON(ENTRY_KEY, entry);
      // The debrief: the numbers always; what they meant, from your coach (more with a better coach).
      const cl = teamLevel(current.career, 'coach');
      const say = cl >= 3 ? j.notes.join(' ') : cl >= 1 ? (j.notes[0] || '') : '';
      const verdict = j.q > 0.2 ? '✅ Good read' : j.q < -0.1 ? '❌ Poor read' : '➖ Neutral read';
      if (fast) { L.readNotes = [...(L.readNotes || []), { set: m.sets.length + 1, text: `${verdict}${say ? `. 🧑‍🏫 ${say}` : ''}` }]; setCall('📋 Read locked in. You\'ll get the verdict at the set break.', 'post'); }
      else setCall(`${verdict}${say ? ` · 🧑‍🏫 ${say}` : ''}`, j.q > 0.2 ? 'big' : 'post');
      if ($('mMeter')) $('mMeter').classList.remove('frozen');
      setTimeout(done, 1800); // a moment to take in the debrief before play resumes
    };
    const iv = setInterval(() => { if (Court.skip) { clearInterval(iv); finish(); } }, 200);
    box.onclick = e => {
      const b = e.target.closest('[data-rd]');
      if (!b) return;
      if (b.dataset.rd === 'go') { clearInterval(iv); finish(); }
      if (b.dataset.rd === 'reset') { Object.assign(pl, before); draw(); }
    };
  });
}
// ITF-level pointer: the single most unusual number this set.
function readPointer(evd, ad) {
  if (ad) return `They've adjusted: ${ad.label}.`;
  const { Y, T } = evd.raw, r = (a, b) => (b ? a / b : 0);
  const c = [
    [r(T.rw, T.rp) > 0.5 && Y.s2 >= 3 ? 1 : 0, 'Look at how your second serve is doing.'],
    [Y.ue >= T.ue + 4 ? 1 : 0, 'Your unforced errors are piling up.'],
    [Y.net >= 3 && r(Y.netW, Y.net) < 0.45 ? 1 : 0, 'Your net approaches are not paying off.'],
    [evd.raw.long >= 3 && T.longW > Y.longW + 1 ? 1 : 0, 'They are winning the long rallies.'],
  ].filter(x => x[0]);
  return c.length ? c[0][1] : 'Compare the two columns: where are you losing points?';
}

// --- Win-probability meter ---------------------------------------------------------------------------
// Worked out like a TV predictor: the score, plus how often each player has actually won points on serve so
// far (blended with what their ratings suggest before there's much to go on). Never the engine's hidden numbers.
function winProbability(state) {
  const { setsA, setsB, toWin, gA, gB, ptsA, ptsB, serverA, tb } = state;
  // Early serve records overstate how big the gap is: pull both toward tour average so the meter stays sane.
  const pA = 0.62 + (state.pA - 0.62) * 0.6, pB = 0.62 + (state.pB - 0.62) * 0.6;
  const D = p => p * p / (p * p + (1 - p) * (1 - p));
  const game = (p, a, b) => { if (a >= 4 && a - b >= 2) return 1; if (b >= 4 && b - a >= 2) return 0; if (a >= 3 && b >= 3) { const d = D(p); return a === b ? d : a > b ? p + (1 - p) * d : p * d; } return p * game(p, a + 1, b) + (1 - p) * game(p, a, b + 1); };
  const q = (pA + (1 - pB)) / 2; // tiebreak points
  const tbW = (a, b) => { if (a >= 7 && a - b >= 2) return 1; if (b >= 7 && b - a >= 2) return 0; if (a >= 6 && b >= 6) { const d = D(q); return a === b ? d : a > b ? q + (1 - q) * d : q * d; } return q * tbW(a + 1, b) + (1 - q) * tbW(a, b + 1); };
  const hA = game(pA, 0, 0), hB = game(pB, 0, 0), memo = {};
  const set = (a, b, sA) => { const k = `${a},${b},${sA}`; if (k in memo) return memo[k];
    let v; if (a >= 6 && a - b >= 2 || a === 7) v = 1; else if (b >= 6 && b - a >= 2 || b === 7) v = 0; else if (a === 6 && b === 6) v = tbW(0, 0);
    else { const g = sA ? hA : 1 - hB; v = g * set(a + 1, b, !sA) + (1 - g) * set(a, b + 1, !sA); } return memo[k] = v; };
  const fresh = (set(0, 0, true) + set(0, 0, false)) / 2;
  const mm = {}; const match = (a, b) => { const k = a + ',' + b; if (k in mm) return mm[k]; return mm[k] = a >= toWin ? 1 : b >= toWin ? 0 : fresh * match(a + 1, b) + (1 - fresh) * match(a, b + 1); };
  let pSet;
  if (tb) pSet = tbW(ptsA, ptsB);
  else { const g = serverA ? game(pA, ptsA, ptsB) : 1 - game(pB, ptsB, ptsA); pSet = g * set(gA + 1, gB, !serverA) + (1 - g) * set(gA, gB + 1, !serverA); }
  return clamp(pSet * match(setsA + 1, setsB) + (1 - pSet) * match(setsA, setsB + 1), 0.01, 0.99);
}
// Serve-point win rate so far, blended with a prior from the ratings.
const servePct = (won, played, prior) => (won + prior * 40) / (played + 40); // ratings matter until there's a real sample
function meterHtml(pYou, names) {
  const y = Math.round(pYou * 100);
  return `<div class="wpmeter"><span>${esc(names[0])} <b data-y>${y}</b>%</span><div class="wptrack"><i style="width:${y}%"></i></div><span><b data-o>${100 - y}</b>% ${esc(names[1])}</span></div>`;
}
// Updates a meter in place so it glides to the new value (and counts there) instead of jumping.
function setMeter(el, pYou, names) {
  if (!el) return;
  const y = Math.round(pYou * 100), bar = el.querySelector('.wptrack i');
  if (!bar) { el.innerHTML = meterHtml(pYou, names); return; }
  bar.style.width = `${y}%`;
  const yb = el.querySelector('[data-y]'), ob = el.querySelector('[data-o]'), from = +yb.textContent, t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / 1200), v = Math.round(from + (y - from) * k); yb.textContent = v; ob.textContent = 100 - v; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
