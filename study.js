// study.js — the Study Room: unlocked by playing your first ATP-level tournament. Pick any two real ATP
// players, a surface and conditions, and watch them play each other with their real styles and game plans.

const ATP_TIERS = ['ATP250', 'ATP500', 'M1000', 'GS'];
function studyUnlocked(c) {
  if (!c) return false;
  if ((c.history || []).some(h => !h.real && ATP_TIERS.includes(h.tier))) return true;
  const e = current.entry, ev = e && typeof eventOf === 'function' ? eventOf(e) : null;
  return !!(ev && ATP_TIERS.includes(ev.tier));
}
// The small "🎬 Study Room" link at the top right of Home, the draw and free days (opposite the Home button).
function renderStudyBtn(c) {
  const on = studyUnlocked(c);
  document.querySelectorAll('[data-study]').forEach(b => { b.hidden = !on; b.onclick = () => openStudy(); });
}

const studyState = { a: 0, b: 1, surface: 'hard', weather: 'sunny', bestOf: 3 };
function openStudy() {
  const st = studyState, list = ATP_TOP;
  // Type-to-search player boxes: any part of the name, accents ignored; matches show as tappable rows.
  const pick = (id, sel) => `<div class="stsearch"><input id="${id}" class="inp" type="search" autocomplete="off" enterkeyhint="search" ` +
    `placeholder="Type A Name" value="${esc(list[sel][1])}" aria-label="Search players"><div class="stsug" id="${id}s" hidden></div></div>`;
  const seg = (key, opts) => `<div class="seg" style="grid-template-columns:repeat(${opts.length},1fr)" data-key="${key}">${opts.map(([v, l]) =>
    `<button type="button" data-v="${v}" class="${String(st[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const card = (p, vs) => {
    const r = scoutReport(p), g = wingGap(p);
    return `<div class="stcard"><b>${flagOf(p.nation)} ${esc(p.name)}${isLegend(p) ? ' 👑' : ''}</b>` +
      `<small>${esc(styleOf(p).name)}${r.trait ? ` · ${esc(r.trait)}` : ''}</small>` +
      `<span class="stovr">${overall(p).toFixed(1)} <i>OVR</i></span>` +
      (realCeiling(p) ? `<small class="stceil">Ceiling ${realCeiling(p).toFixed(1)}</small>` : '') +
      `<small>${p.hand === 'left' ? 'Left-handed' : 'Right-handed'} · ${TEMPERAMENTS[p.temperament] ? TEMPERAMENTS[p.temperament].name : p.temperament} · Weaker wing: ${g > 0.15 ? 'backhand' : g < -0.1 ? 'forehand' : 'none'}</small>` +
      `<p>${esc(planSummary({ ...DEFAULT_PLAN, ...planOf(p) }))}</p>` +
      (r.strengths[0] ? `<p class="up">💪 ${esc(r.strengths[0])}</p>` : '') + (r.weaknesses[0] ? `<p class="down">🩹 ${esc(r.weaknesses[0])}</p>` : '') + realStatsHtml(p, { form: false, vs }) + `</div>`;
  };
  const A = realPlayer(list[st.a]), B = realPlayer(list[st.b]);
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button><h2 class="itop">📚 Study Room</h2>` +
    `<p class="hint center">Pick any two real players and watch how their games match up.</p>` +
    `<div class="stpick">${pick('stA', st.a)}<b>VS</b>${pick('stB', st.b)}</div>` +
    `<div class="stcards">${card(A, B)}${card(B, A)}</div>` +
    `<label class="lbl">Surface</label>${seg('surface', [['hard', 'Hard'], ['clay', 'Clay'], ['grass', 'Grass']])}` +
    `<label class="lbl">Conditions</label>${seg('weather', Object.entries(WEATHER).map(([k, w]) => [k, w.icon]))}` +
    `<p class="hint">${WEATHER[st.weather].name}</p>` +
    `<label class="lbl">Match Length</label>${seg('bestOf', [[3, 'Best Of 3'], [5, 'Best Of 5']])}` +
    `<button type="button" class="btn huge" id="stGo" ${st.a === st.b ? 'disabled' : ''}>▶ Watch The Match</button>` +
    (isAdminOn() ? quickSimHtml(st) : ''), { wide: true });
  $('mx').onclick = closeModal;
  bindRealMatches($('sheet'));
  bindStudySearch('stA', i => { st.a = i; st.qs = null; openStudy(); });
  bindStudySearch('stB', i => { st.b = i; st.qs = null; openStudy(); });
  $('sheet').querySelectorAll('.seg [data-v]').forEach(b => { b.onclick = () => {
    const k = b.parentElement.dataset.key;
    st[k] = k === 'bestOf' ? +b.dataset.v : b.dataset.v; st.qs = null; openStudy(); }; });
  if ($('qsGo')) $('qsGo').onclick = () => runQuickSim(A, B);
  $('stGo').onclick = () => {
    const seed = (Math.random() * 4294967296) >>> 0;
    const ev = studyEv(st, A);
    watchRealMatch({ replay: { seed, ps: [A, B], ev, bestOf: st.bestOf, side: 0 }, round: 'Study Room', event: `${surfaceLabel(st.surface)} · ${WEATHER[st.weather].name}` },
      { neutral: true, onClose: () => openStudy() });
  };
}

const plainName = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]+/g, ' ');
function bindStudySearch(id, onPick) {
  const inp = $(id), box = $(id + 's'), was = inp.value;
  const show = () => {
    const q = plainName(inp.value).trim();
    const hits = ATP_TOP.map((r, i) => [r, i]).filter(([r]) => !q || q.split(/\s+/).every(w => plainName(r[1]).split(' ').some(part => part.startsWith(w)) || plainName(r[1]).includes(w))).slice(0, 8);
    box.innerHTML = hits.length ? hits.map(([r, i]) => `<button type="button" data-i="${i}"><small>#${r[0]}</small> ${esc(r[1])}${LEGENDS.has(r[1]) ? ' 👑' : ''}</button>`).join('')
      : '<p class="hint">No player by that name.</p>';
    box.hidden = false;
  };
  inp.onfocus = () => { inp.select(); show(); };
  inp.oninput = show;
  inp.onkeydown = e => { if (e.key === 'Enter') { const b = box.querySelector('button'); if (b) b.click(); } };
  inp.onblur = () => setTimeout(() => { box.hidden = true; if (inp.value !== was) inp.value = was; }, 200);
  box.onpointerdown = e => e.preventDefault(); // keep the keyboard up while tapping a name
  box.onclick = e => { const b = e.target.closest('[data-i]'); if (b) onPick(+b.dataset.i); };
}

const studyEv = (st, A) => ({ tier: st.bestOf === 5 ? 'GS' : 'M1000', surface: st.surface, indoor: st.weather === 'indoor', weather: st.weather, nation: A.nation, city: 'Study Room' });

// --- Admin: Quick Sim ------------------------------------------------------------------------------------------
// Plays the chosen matchup 100 or 200 times in the background and shows the averages: who wins, the likely
// scores and the full match stats. Only shows when the admin page has been unlocked in this browser session.
const isAdminOn = () => { try { return sessionStorage.getItem('tourlife.admin') === 'ok'; } catch { return false; } };
// 1,000 matches: about a second to run, and enough that the win chance only wobbles by about ±3 points. More sims
// wouldn't be any closer to real results, since the sim's own gap from real tennis is bigger than that.
const QS_N = 1000;
function quickSimHtml(st) {
  return `<section class="qsim"><h3>⚡ Quick Sim <small>Admin</small></h3>` +
    `<p class="hint">Plays this matchup 1,000 times with the surface and conditions above, then averages everything.</p>` +
    `<button type="button" class="btn" id="qsGo" ${st.a === st.b ? 'disabled' : ''}>⚡ Simulate 1,000 Matches</button>` +
    `<div id="qsOut">${st.qs ? quickSimResult(st.qs) : ''}</div></section>`;
}
function runQuickSim(A, B) {
  const st = studyState, N = QS_N, ev = studyEv(st, A), bo = st.bestOf;
  const keys = ['points', 'servePts', 'firstIn', 'firstWon', 'secondWon', 'df', 'aces', 'bpChances', 'bpWon', 'bpFaced', 'bpSaved', 'winners', 'ue', 'netWon', 'netPlayed', 'svcGames', 'svcHeld'];
  const R = { n: 0, N, names: [shortName(A), shortName(B)], wins: [0, 0], scores: {}, counts: {}, games: 0, tbs: 0, deciders: 0, sets: 0, tot: [{}, {}] };
  $('qsGo').disabled = true;
  const step = () => {
    if (!$('qsOut')) return; // Study Room closed
    for (let k = 0; k < 50 && R.n < N; k++, R.n++) {
      const m = newMatch(0, 1, Math.random, false); m.bestOf = bo;
      playMatch(m, [JSON.parse(JSON.stringify(A)), JSON.parse(JSON.stringify(B))], ev);
      const w = m.winner; R.wins[w]++;
      const sc = `${w}|` + m.sets.map(x => `${x.games[w]}-${x.games[1 - w]}`).join(' ');
      R.scores[sc] = (R.scores[sc] || 0) + 1;
      const won = m.sets.filter(x => x.games[w] > x.games[1 - w]).length, ct = `${w}|${won}-${m.sets.length - won}`;
      R.counts[ct] = (R.counts[ct] || 0) + 1;
      for (const x of m.sets) { R.games += x.games[0] + x.games[1]; R.sets++; if (Math.max(...x.games) === 7 && Math.min(...x.games) === 6) R.tbs++; }
      if (m.sets.length === bo) R.deciders++;
      for (const i of [0, 1]) for (const key of keys) R.tot[i][key] = (R.tot[i][key] || 0) + (m.stats[i][key] || 0);
    }
    $('qsGo').textContent = `Simulating… ${R.n} / ${N}`;
    if (R.n < N) return setTimeout(step, 0);
    st.qs = R;
    $('qsGo').disabled = false; $('qsGo').textContent = '⚡ Simulate 1,000 Matches Again';
    $('qsOut').innerHTML = quickSimResult(R);
  };
  step();
}
function quickSimResult(R) {
  const N = R.n, [a, b] = R.names, name = i => i ? b : a;
  const pc = (x, y) => y ? (100 * x / y).toFixed(1) + '%' : '–';
  const p = R.wins[0] / N, moe = Math.round(196 * Math.sqrt(p * (1 - p) / N));
  const top = (o, n) => Object.entries(o).sort((x, y) => y[1] - x[1]).slice(0, n);
  const T = R.tot, srv = i => T[i].servePts, ret = i => T[1 - i].servePts;
  // [label, value for player i, number used to pick the leader, lower is better]
  const rows = [
    ['Points Won', i => pc(T[i].points, T[0].points + T[1].points), i => T[i].points],
    ['1st Serve In', i => pc(T[i].firstIn, srv(i)), i => T[i].firstIn / srv(i)],
    ['1st Serve Won', i => pc(T[i].firstWon, T[i].firstIn), i => T[i].firstWon / T[i].firstIn],
    ['2nd Serve Won', i => pc(T[i].secondWon, srv(i) - T[i].firstIn), i => T[i].secondWon / (srv(i) - T[i].firstIn)],
    ['Serve Pts Won', i => pc(T[i].firstWon + T[i].secondWon, srv(i)), i => (T[i].firstWon + T[i].secondWon) / srv(i)],
    ['Return Pts Won', i => pc(ret(i) - T[1 - i].firstWon - T[1 - i].secondWon, ret(i)), i => 1 - (T[1 - i].firstWon + T[1 - i].secondWon) / ret(i)],
    ['Hold', i => pc(T[i].svcHeld, T[i].svcGames), i => T[i].svcHeld / T[i].svcGames],
    ['Break', i => pc(T[1 - i].svcGames - T[1 - i].svcHeld, T[1 - i].svcGames), i => 1 - T[1 - i].svcHeld / T[1 - i].svcGames],
    ['Aces / Match', i => (T[i].aces / N).toFixed(1), i => T[i].aces],
    ['Double Faults / Match', i => (T[i].df / N).toFixed(1), i => T[i].df, true],
    ['Break Points Saved', i => pc(T[i].bpSaved, T[i].bpFaced), i => T[i].bpSaved / T[i].bpFaced],
    ['Break Points Won', i => `${pc(T[i].bpWon, T[i].bpChances)} (${(T[i].bpWon / N).toFixed(1)} / Match)`, i => T[i].bpWon / T[i].bpChances],
    ['Winners / Match', i => (T[i].winners / N).toFixed(1), i => T[i].winners],
    ['Errors / Match', i => (T[i].ue / N).toFixed(1), i => T[i].ue, true],
    ['Net Points Won', i => pc(T[i].netWon, T[i].netPlayed), i => T[i].netWon / T[i].netPlayed],
  ];
  const cls = (f, low, i) => { const x = f(0), y = f(1); if (!isFinite(x) || !isFinite(y)) return ''; if (Math.abs(x - y) < 1e-9) return 'tie'; return ((low ? x < y : x > y) === (i === 0)) ? 'lead' : ''; };
  const table = `<table class="qstab"><thead><tr><td>${esc(a)}</td><th></th><td>${esc(b)}</td></tr></thead><tbody>` +
    rows.map(([l, v, f, low]) => `<tr><td class="${cls(f, low, 0)}">${v(0)}</td><th>${l}</th><td class="${cls(f, low, 1)}">${v(1)}</td></tr>`).join('') + `</tbody></table>`;
  const line = ([k, c]) => { const [w, sc] = k.split('|'); return `<li><b>${esc(name(+w))}</b> ${esc(sc)}<em>${pc(c, N)}</em></li>`; };
  return `<div class="qsres"><div class="qswin"><div class="${p > 0.5 ? 'lead' : ''}"><b>${pc(R.wins[0], N)}</b><small>${esc(a)}</small></div>` +
    `<span>Wins<br><small>±${moe}</small></span><div class="${p < 0.5 ? 'lead' : ''}"><b>${pc(R.wins[1], N)}</b><small>${esc(b)}</small></div></div>` +
    `<p class="hint">${N.toLocaleString()} matches · Win chance is within ±${moe} points, 19 times out of 20.</p>` +
    `<div class="qsfacts"><div><b>${(R.games / N).toFixed(1)}</b><small>Games / Match</small></div><div><b>${(R.tbs / N).toFixed(2)}</b><small>Tiebreaks / Match</small></div><div><b>${pc(R.deciders, N)}</b><small>Go The Distance</small></div></div>` +
    `<h4>Most Likely Results</h4><ul class="qslist">${top(R.counts, 6).map(line).join('')}</ul>` +
    `<h4>Most Likely Scores</h4><ul class="qslist">${top(R.scores, 5).map(line).join('')}</ul>` +
    `<h4>Average Match Stats</h4>${table}</div>`;
}
