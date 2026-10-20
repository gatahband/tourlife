// study.js — the Study Room: unlocked by playing your first ATP-level tournament. Pick any two real ATP
// players, a surface and conditions, and watch them play each other with their real styles and game plans.

const ATP_TIERS = ['ATP250', 'ATP500', 'M1000', 'GS'];
function studyUnlocked(c) {
  if (!c) return false;
  if ((c.history || []).some(h => !h.real && ATP_TIERS.includes(h.tier))) return true;
  const e = current.entry, ev = e && typeof eventOf === 'function' ? eventOf(e) : null;
  return !!(ev && ATP_TIERS.includes(ev.tier));
}
function renderStudyBtn(c) {
  const b = $('studyBtn');
  if (!b) return;
  b.hidden = !studyUnlocked(c);
  b.onclick = () => openStudy();
}

const studyState = { a: 0, b: 1, surface: 'hard', weather: 'sunny', bestOf: 3 };
function openStudy() {
  const st = studyState, list = ATP_TOP;
  const opt = sel => list.map((r, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>#${r[0]} ${esc(r[1])}${LEGENDS.has(r[1]) ? ' 👑' : ''}</option>`).join('');
  const seg = (key, opts) => `<div class="seg" style="grid-template-columns:repeat(${opts.length},1fr)" data-key="${key}">${opts.map(([v, l]) =>
    `<button type="button" data-v="${v}" class="${String(st[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const card = p => {
    const r = scoutReport(p), g = wingGap(p);
    return `<div class="stcard"><b>${flagOf(p.nation)} ${esc(p.name)}${isLegend(p) ? ' 👑' : ''}</b>` +
      `<small>${esc(styleOf(p).name)}${r.trait ? ` · ${esc(r.trait)}` : ''}</small>` +
      `<span class="stovr">${overall(p).toFixed(1)} <i>OVR</i></span>` +
      `<small>${p.hand === 'left' ? 'Left-handed' : 'Right-handed'} · ${TEMPERAMENTS[p.temperament] ? TEMPERAMENTS[p.temperament].name : p.temperament} · Weaker wing: ${g > 0.15 ? 'backhand' : g < -0.1 ? 'forehand' : 'none'}</small>` +
      `<p>${esc(planSummary({ ...DEFAULT_PLAN, ...planOf(p) }))}</p>` +
      (r.strengths[0] ? `<p class="up">💪 ${esc(r.strengths[0])}</p>` : '') + (r.weaknesses[0] ? `<p class="down">🩹 ${esc(r.weaknesses[0])}</p>` : '') + `</div>`;
  };
  const A = realPlayer(list[st.a]), B = realPlayer(list[st.b]);
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button><h2 class="itop">📚 Study Room</h2>` +
    `<p class="hint center">Pick any two real players and watch how their games match up.</p>` +
    `<div class="stpick"><select id="stA" class="inp">${opt(st.a)}</select><b>VS</b><select id="stB" class="inp">${opt(st.b)}</select></div>` +
    `<div class="stcards">${card(A)}${card(B)}</div>` +
    `<label class="lbl">Surface</label>${seg('surface', [['hard', 'Hard'], ['clay', 'Clay'], ['grass', 'Grass']])}` +
    `<label class="lbl">Conditions</label>${seg('weather', Object.entries(WEATHER).map(([k, w]) => [k, w.icon]))}` +
    `<p class="hint">${WEATHER[st.weather].name}</p>` +
    `<label class="lbl">Match Length</label>${seg('bestOf', [[3, 'Best Of 3'], [5, 'Best Of 5']])}` +
    `<button type="button" class="btn huge" id="stGo" ${st.a === st.b ? 'disabled' : ''}>▶ Watch The Match</button>`, { wide: true });
  $('mx').onclick = closeModal;
  $('stA').onchange = e => { st.a = +e.target.value; openStudy(); };
  $('stB').onchange = e => { st.b = +e.target.value; openStudy(); };
  $('sheet').querySelectorAll('.seg [data-v]').forEach(b => { b.onclick = () => {
    const k = b.parentElement.dataset.key; st[k] = k === 'bestOf' ? +b.dataset.v : b.dataset.v; openStudy(); }; });
  $('stGo').onclick = () => {
    const seed = (Math.random() * 4294967296) >>> 0;
    const ev = { tier: st.bestOf === 5 ? 'GS' : 'M1000', surface: st.surface, indoor: st.weather === 'indoor', weather: st.weather, nation: A.nation, city: 'Study Room' };
    watchRealMatch({ replay: { seed, ps: [A, B], ev, bestOf: st.bestOf, side: 0 }, round: 'Study Room', event: `${surfaceLabel(st.surface)} · ${WEATHER[st.weather].name}` },
      { neutral: true, onClose: () => openStudy() });
  };
}
