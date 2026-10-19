// training.js — free days between tournaments (train here, travel early, or rest), the end of the week,
// and the overall-rating card on Home.

// Start a block of free days. days: how many; at: the country you're in; label: shown in the header.
function startDowntime(days, at, label) {
  const c = current.career;
  c.downtime = { days, used: 0, at, label, choice: null, next: null };
  writeJSON(CAREER_KEY, c);
  openTraining();
}

function openTraining() {
  renderTraining();
  showScreen('train');
}

const pctText = v => `${(v * 100).toFixed(2)}%`;

function fatigueBar(f) {
  const cls = f < 30 ? 'ok' : f < 50 ? 'fine' : f < 70 ? 'warn' : 'bad';
  return `<div class="fbar"><span>Fatigue</span><div class="ftrack"><i class="${cls}" style="width:${clamp(f, 0, 100)}%"></i></div><b>${Math.round(f)} · ${fatigueLabel(f)}</b></div>`;
}

// A training day adds fatigue (overnight recovery only takes the edge off); a rest day clears it.
function drillFatigue(d, c, p) {
  const recover = DAILY_RECOVERY + recoveryBoost(c) + staminaRecovery(p);
  return d.fatigue > 0 ? Math.max(3, Math.round(d.fatigue - recover * 0.4)) : -Math.round(recover - d.fatigue);
}

// Your whole build while you train: every stat, what the last session moved, and your playstyle.
function buildPanel(p, last) {
  const style = detectStyles(p.attrs, p.fav)[0];
  return `<div class="tbuild"><div class="tbhead"><b>Your build</b><span>${style.emoji || ''} ${style.name}</span></div>` +
    ATTRS.map(([k, label]) => {
      const v = p.attrs[k], up = last && last.stats.includes(k);
      return `<div class="tbrow${up ? ' up' : ''}"><span>${label}</span><div class="tbbar"><i style="width:${clamp(v, 0, 100)}%"></i></div><b>${v.toFixed(1)}${up ? ` <small>+${pctText(last.gain)}</small>` : ''}</b></div>`;
    }).join('') + `</div>`;
}

function renderTraining() {
  const c = current.career, p = current.player, dt = c.downtime;
  if (!dt) { renderTournaments(p); showScreen('home'); return; }
  const left = dt.days - dt.used;
  const where = nationInfo(dt.at);
  $('tTitle').textContent = dt.label;
  $('tMeta').textContent = `Week ${weekInSeason(c.week)} · ${monthOf(c.week)} · ${where[1]} ${where[2]}`;
  $('tStatus').innerHTML = fatigueBar(p.fatigue || 0) +
    `<div class="tovr">OVR <b>${overall(p).toFixed(1)}</b> · ${levelOf(overall(p)).name}</div>` +
    `<p class="hint">${left} free day${left === 1 ? '' : 's'} left${dt.next ? ` · then ${flagOf(dt.next.nation)} ${dt.next.city} (${tierLabel(dt.next.tier)}, ${surfaceLabel(dt.next.surface)})` : ''}.</p>` +
    buildPanel(p, dt.lastSession);

  const box = $('tBody');
  // Step 1: where to spend the days.
  if (!dt.choice) {
    const nextWeek = c.week + 1;
    const rank = currentRank(c);
    // Only events you can get into; qualifying ones are marked.
    const nextEvs = (isOffSeason(nextWeek) ? [] : weekEvents(nextWeek, c.seed))
      .map(e => ({ ...e, mode: eligibility(e, rank) })).filter(e => e.mode !== 'locked');
    const opt = (id, icon, title, desc, extra = '', disabled = false) =>
      `<button type="button" class="topt${disabled ? ' off' : ''}" data-choice="${id}" ${disabled ? 'disabled' : ''}><span class="ticon">${icon}</span>` +
      `<span><b>${title}</b><small>${desc}</small>${extra}</span></button>`;
    box.innerHTML = `<h2>How do you want to use the days?</h2><div class="topts">` +
      opt('here', '🏟️', `Train here`, `${left} training day${left === 1 ? '' : 's'}. +1–3.5% per stat each day.`) +
      nextEvs.map((e, i) => {
        const t = travelDays(dt.at, e.nation), stay = left - t;
        return opt(`go${i}`, '✈️', `Travel early to ${flagOf(e.nation)} ${e.city}`,
          stay > 0 ? `${t ? `${t} travel day${t === 1 ? '' : 's'}, then ` : ''}${stay} practice day${stay === 1 ? '' : 's'} on site: better gains (usually 2–3.5%) and a comfort boost on those courts. You'll be entered automatically.`
            : `Too far to arrive early (${t} travel days).`,
          `<em class="tag2">${tierLabel(e.tier)}${e.mode === 'qual' ? ' qualifying' : ''} · ${surfaceLabel(e.surface)}${e.indoor ? ' · Indoor' : ''}</em>`, stay <= 0);
      }).join('') +
      opt('rest', '🛌', 'Rest the whole time', 'Full recovery. No gains.') + `</div>` +
      (nextEvs.length ? '' : '<p class="hint">Next week is the off-season, so there is no event to travel to.</p>');
    box.onclick = e => {
      const b = e.target.closest('[data-choice]');
      if (!b || b.disabled) return;
      const ch = b.dataset.choice;
      if (ch === 'rest') { for (let i = dt.used; i < dt.days; i++) applyDay('rest'); dt.choice = 'rest'; }
      else if (ch === 'here') dt.choice = 'here';
      else {
        const ev = nextEvs[+ch.slice(2)];
        const t = travelDays(dt.at, ev.nation);
        const cost = tripCost(c, ev, ev.mode);
        if (cost > c.money) { alert(`You can't afford that trip (${money(cost)}).`); return; }
        charge(c, cost, `Trip to ${ev.city}`);
        c.location = ev.nation;
        dt.choice = 'travel'; dt.next = ev; dt.at = ev.nation;
        for (let i = 0; i < t; i++) { p.fatigue = clamp((p.fatigue || 0) - DAILY_RECOVERY - recoveryBoost(c) + (c.business ? 3 : 6), 0, 100); dt.used++; }
        dt.log = [...(dt.log || []), `✈️ Travelled to ${ev.city} (${t} day${t === 1 ? '' : 's'}).`];
      }
      writeJSON(SAVE_KEY, p); writeJSON(CAREER_KEY, c);
      renderTraining();
    };
    return;
  }

  // Step 2: one session per day.
  const logHtml = (dt.log || []).slice(-6).map(l => `<li>${l}</li>`).join('');
  if (left <= 0) {
    box.innerHTML = `<h2>Week done</h2><ul class="tlog">${logHtml}</ul>` +
      `<button type="button" class="btn" id="tNext">Start next week${dt.next ? ` in ${dt.next.city}` : ''}</button>`;
    $('tNext').onclick = advanceWeek;
    return;
  }
  const local = dt.choice === 'travel';
  const range = local ? 'usually 2–3.5%' : '1–3.5%';
  box.innerHTML = `<h2>Day ${dt.used + 1} of ${dt.days}${local ? ' · practising on site' : ''}</h2>` +
    `<div class="drills">${DRILLS.map(d => {
      const after = d.stats.map(k => `<span class="chip">${attrLabel(k)} <b>+${range}</b></span>`).join('');
      return `<button type="button" class="drill" data-drill="${d.id}"><span class="ticon">${d.icon}</span><b>${d.title}</b>` +
        `<small>${d.desc}</small><div class="chips">${after}</div>` +
        `<div class="dfat">${(f => f > 0 ? `+${f}` : `${f}`)(drillFatigue(d, c, p))} fatigue</div></button>`;
    }).join('')}</div>` +
    (burnout(c) < 1 ? `<p class="hint warnline">🔥 Burnout: ${idleWeeks(c)} weeks in a row without an event, so training only counts ${Math.round(burnout(c) * 100)}% this week. Play a tournament to reset it.</p>` : '') +
    (rustOf(c) >= 0.001 ? `<p class="hint warnline">🧊 ${rustText(c)}</p>` : '') +
    (logHtml ? `<ul class="tlog">${logHtml}</ul>` : '') +
    `<button type="button" class="link" id="tRestAll">Rest the remaining ${left} day${left === 1 ? '' : 's'}</button>`;
  box.onclick = e => {
    const b = e.target.closest('[data-drill]');
    if (!b) return;
    applyDay(b.dataset.drill, rollTrain(local) * trainBoost(c));
    renderTraining();
  };
  $('tRestAll').onclick = () => { while (dt.used < dt.days) applyDay('rest'); renderTraining(); };
}

// One day: natural recovery, then the session's fatigue and stat gains (kept for good).
function applyDay(drillId, gain = rollTrain(false)) {
  const c = current.career, p = current.player, dt = c.downtime;
  const d = DRILLS.find(x => x.id === drillId);
  const before = overall(p);
  p.fatigue = clamp((p.fatigue || 0) + drillFatigue(d, c, p), 0, 100);
  gain *= burnout(c); // training week after week without playing counts for less
  for (const k of d.stats) applyGain(p.attrs, k, gain);
  dt.lastSession = d.stats.length ? { stats: d.stats, gain } : null;
  p.playstyle = detectStyles(p.attrs, p.fav)[0].name;
  dt.used++;
  // Hard sessions on a tired body can end in an injury: the rest of the week is rest.
  if (d.fatigue > 0 && maybeInjure(c, p, 0.6)) {
    dt.log = [...(dt.log || []), `🤕 Day ${dt.used}: you hurt yourself (${c.injury.name}). The rest of the week is rest.`];
    while (dt.used < dt.days) { p.fatigue = clamp(p.fatigue - DAILY_RECOVERY, 0, 100); dt.used++; }
    writeJSON(SAVE_KEY, p); writeJSON(CAREER_KEY, c);
    return;
  }
  const ovrTxt = d.stats.length ? ` +${pctText(gain)}${burnout(c) < 1 ? ' (burnout)' : ''}. OVR ${before.toFixed(2)} → ${overall(p).toFixed(2)}.` : '';
  dt.log = [...(dt.log || []), `${d.icon} Day ${dt.used}: ${d.title}.${ovrTxt} Fatigue ${Math.round(p.fatigue)}.`];
  c.trainLog = [...(c.trainLog || []), { week: c.week, drill: d.id, gain: d.stats.length ? gain : 0 }].slice(-200);
  writeJSON(SAVE_KEY, p);
  writeJSON(CAREER_KEY, c);
}

// End of the week: a little extra recovery, then on to the next week (straight into the event you travelled to).
function advanceWeek() {
  const c = current.career, p = current.player;
  const next = c.downtime && c.downtime.next;
  c.lastRank = currentRank(c);
  weeklyMoney(c);
  noteWeek(c);
  moraleWeek(c, p);
  noteMark();
  c.week++;
  if (weekInSeason(c.week) === 1) newSeason(c, p);
  c.downtime = null;
  if (next) c.location = next.nation;
  p.fatigue = clamp((p.fatigue || 0) - 10 - staminaRecovery(p) * 2, 0, 100);
  writeJSON(SAVE_KEY, p);
  writeJSON(CAREER_KEY, c);
  current.career = c;
  if (next) { enterEvent(next, true, next.mode || 'main'); return; }
  renderTournaments(p);
  showScreen('home');
}

// --- Overall rating card (Home) --------------------------------------------------
// Odds at the levels you can enter right now (simulated, saved per OVR so Home stays quick).
const ODDS_CACHE = 'tourlife.odds';
function cachedOdds(p, tier, mode) {
  const key = `${tier}|${mode}|${overall(p).toFixed(1)}|${detectStyles(p.attrs, p.fav)[0].name}`;
  const cache = readJSON(ODDS_CACHE) || {};
  return { key, val: cache[key] };
}
function saveOdds(key, val) {
  const cache = readJSON(ODDS_CACHE) || {};
  cache[key] = val;
  const keys = Object.keys(cache);
  if (keys.length > 60) delete cache[keys[0]];
  writeJSON(ODDS_CACHE, cache);
}

function renderOvr(p) {
  const ovr = overall(p), lv = levelOf(ovr), c = current.career;
  const prog = lv.next ? clamp((ovr - lv.min) / (lv.next.min - lv.min), 0, 1) : 1;
  const st = detectStyles(p.attrs, p.fav)[0];
  // The most useful three: one level below your best main-draw level, that level, and the next one up
  // (via qualifying if that's how you'd get in).
  const rank = currentRank(c);
  const ladder = TITLE_LADDER.map(t => ({ t, el: eligibility({ tier: t }, rank) }));
  // (Slams take a lower ranking than Masters for the main draw, so they don't count as your "level".)
  let top = 0;
  ladder.forEach((x, i) => { if (x.el === 'main' && x.t !== 'GS') top = i; });
  const levels = [top - 1, top, top + 1].filter(i => i >= 0 && i < ladder.length && ladder[i].el !== 'locked').map(i => ladder[i]);
  const cell = ({ t, el }) => {
    const { key, val } = cachedOdds(p, t, el);
    return `<div class="rcell" data-odds="${key}" data-tier="${t}" data-mode="${el}"><span>${TIERS[t].label}${el === 'qual' ? ' · via qualifying' : ''}</span>` +
      `<b>${val ? `${val.title < 0.01 ? '<1' : Math.round(val.title * 100)}% Title` : '…'}</b><small>${val ? `${Math.round(val.qf * 100)}% Reach the QF` : 'working it out'}</small></div>`;
  };
  $('hOvr').innerHTML =
    `<div class="ovrtop"><div class="ovrnum"><b>${ovr.toFixed(1)}</b><span>OVR</span></div>` +
    `<div class="ovrinfo"><b>${lv.name}</b><small>${lv.note}</small>` +
    (lv.next ? `<div class="ovrprog"><i style="width:${prog * 100}%"></i></div><small>${(lv.next.min - ovr).toFixed(1)} to ${lv.next.name} (${lv.next.min})</small>` : '') +
    `</div></div>` +
    // Your build at a glance: playstyle and the seven stats.
    `<div class="ovrbuild"><div class="obstyle"><span>Playstyle</span><b>${st.name}</b><small>${st.desc}</small></div>` +
    `<div class="obbars">${ATTRS.map(([k]) => `<div title="${attrLabel(k)} ${p.attrs[k].toFixed(1)}"><i style="height:${(clamp((p.attrs[k] - 30) / 65, 0.06, 1) * 48).toFixed(1)}px"></i><span>${SHORT_ATTR[k]}</span><b>${Math.round(p.attrs[k])}</b></div>`).join('')}</div></div>` +
    `<h3 class="ssec">Your chances at the levels you can play</h3>` +
    `<div class="ovrexp">${levels.map(cell).join('')}</div>` +
    fatigueBar(p.fatigue || 0) +
    moraleHtml(moraleFor(c, p, { tier: (levels[1] || levels[0] || { t: 'M15' }).t, nation: '', city: '', surface: '' }, null, null, true)) +
    `<p class="hint">Simulated title and quarter-final chances per event at each level you can enter now (on hard courts, in good conditions). Surfaces, weather, your plan and form swing them.</p>`;
  // Fill in any odds not worked out yet, one at a time so the page stays responsive.
  const todo = [...$('hOvr').querySelectorAll('[data-odds]')].filter(el => el.querySelector('b').textContent === '…');
  const next = () => {
    const el = todo.shift();
    if (!el || !el.isConnected) return;
    const val = simOdds(p, { tier: el.dataset.tier, surface: 'hard', indoor: false, nation: p.nation }, el.dataset.mode, 50);
    saveOdds(el.dataset.odds, val);
    el.querySelector('b').textContent = `${val.title < 0.01 ? '<1' : Math.round(val.title * 100)}% Title`;
    el.querySelector('small').textContent = `${Math.round(val.qf * 100)}% Reach the QF`;
    setTimeout(next, 30);
  };
  setTimeout(next, 60);
}
