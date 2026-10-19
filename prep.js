// prep.js — tournament preparation. Before your first match of an event you can spend money on up to three
// things that help that week: scouting, a specialist hitting partner, a surface camp, recovery, pressure
// training or video analysis. Each one gives a small, visible edge (never a sure win) and lasts the week.

const PREP_SLOTS = 3;
const PREP = [
  { id: 'scout', icon: '🔎', name: 'Detailed scouting', cost: 600, desc: 'Their weaker wing, favourite serves, return position and big-point habits, in your scouting report. A small edge from knowing their patterns.' },
  { id: 'partner', icon: '🎾', name: 'Specialist hitting partner', cost: 1100, desc: 'Practise against one type of player all week. An edge against opponents of that type.' },
  { id: 'camp', icon: '🏟️', name: 'Surface training camp', cost: 850, desc: 'Movement and patterns on this week\'s surface. Better comfort on it all week.' },
  { id: 'recovery', icon: '🛁', name: 'Extra recovery sessions', cost: 450, desc: 'Ice baths, massage, sleep. You start the week 15 fatigue fresher.' },
  { id: 'pressure', icon: '🧠', name: 'Sports psychologist', cost: 700, desc: 'Composure on break points, set points and tiebreaks.' },
  { id: 'video', icon: '📼', name: 'Video analysis', cost: 1300, desc: 'Study your past matches. An edge against anyone who has beaten you before, and a full "what went wrong" breakdown after every loss this week.' },
];
// --- Performance Center ---------------------------------------------------------------------------
// The high-end tier, unlocked by the 🏛️ Elite Program achievement (top 100 plus 5 ATP-level main-draw wins).
// Big items take two of your three slots, every one has a cost beyond money, and none of them wins for you.
const PC = [
  { id: 'pcfit', icon: '🫁', name: 'Elite fitness camp', cost: 8000, slots: 2, desc: 'You tire half as fast in long matches all tournament, and recover better between rounds. But the camp itself costs you: you start the week +10 fatigue.' },
  { id: 'pcintel', icon: '🛰️', name: 'Opponent intelligence package', cost: 5000, slots: 1, desc: 'Full intelligence on every opponent this week: hidden strengths, serve patterns, rally length. A small edge in every match.' },
  { id: 'pcspar', icon: '🥊', name: 'Specialist sparring partner', cost: 6000, slots: 2, desc: 'A former pro who plays exactly one style. A big edge against that style, nothing against anyone else.' },
  { id: 'pcbreak', icon: '🔬', name: 'Technical breakthrough session', cost: 12000, slots: 2, desc: 'Intensive work on one stat: +4% to it in matches this week, and a 1-in-4 chance of a lasting gain. Another part of your game gets a little rusty this week (−1.5%).' },
];
const PC_RECOVERY = { cost: 3500, steps: [20, 12, 6] }; // between rounds; each one helps less
const allPrep = () => [...PREP, ...PC];
const prepSlots = it => it.slots || 1;
const slotsUsed = pr => pr.items.reduce((n, id) => n + prepSlots(allPrep().find(x => x.id === id) || {}), 0);
const atpWins = c => (c.history || []).filter(h => !h.real && ['ATP250', 'ATP500', 'M1000', 'GS'].includes(h.tier) && !String(h.reached).startsWith('Q'))
  .reduce((n, h) => n + (h.matches || []).filter(m => m.won && !m.qual).length, 0);
const pcUnlocked = c => !!(c.badges && c.badges.elite);

// The kind of player a hitting partner imitates.
const PARTNERS = {
  lefty: { name: 'a left-hander', match: o => o.hand === 'left' },
  server: { name: 'a big server', match: o => o.attrs.serve >= o.attrs.ret + 4 || ['Big Server', 'First-Strike Player'].includes(detectStyles(o.attrs, o.fav)[0].name) },
  topspin: { name: 'a heavy-topspin grinder', match: o => planOf(o).spin === 'topspin' || famOf(detectStyles(o.attrs, o.fav)[0].name) === 'defend' },
  net: { name: 'a net rusher', match: o => planOf(o).net === 'often' || famOf(detectStyles(o.attrs, o.fav)[0].name) === 'net' },
  flat: { name: 'a flat hitter', match: o => planOf(o).spin === 'flat' || famOf(detectStyles(o.attrs, o.fav)[0].name) === 'attack' },
};
// Prices follow the level: cheap at ITF events, steep at the Slams.
const PREP_MULT = { M15: 0.25, M25: 0.3, CH75: 0.8, CH125: 1, ATP250: 2, ATP500: 2.5, M1000: 3.2, GS: 4 };
const prepCost = (item, tier) => Math.max(50, Math.round(item.cost * (PREP_MULT[tier] || 1) / 10) * 10);
const prepOf = entry => (entry.prep = entry.prep || { items: [], partner: null });
const hasPrep = (entry, id) => !!(entry && entry.prep && (entry.prep.items.includes(id) || (id === 'scout' && entry.prep.items.includes('pcintel'))));

// Your edge from this week's preparation against this opponent. clutch: extra on big points only.
function prepEdges(entry, opp) {
  const pr = entry.prep;
  if (!pr || !pr.items.length) return { edge: 0, clutch: 0, tags: [] };
  const ev = eventOf(entry), c = current.career, tags = [];
  let edge = 0, clutch = 0;
  if (pr.items.includes('scout')) { edge += 0.004; tags.push('🔎 You know their patterns'); }
  if (pr.items.includes('pcintel')) { edge += 0.006; tags.push('🛰️ Full intelligence on them'); }
  if (pr.items.includes('pcspar') && pr.spar && PARTNERS[pr.spar]) {
    if (PARTNERS[pr.spar].match(opp)) { edge += 0.016; tags.push(`🥊 A week of sparring with ${PARTNERS[pr.spar].name}`); }
    else tags.push(`🥊 Your sparring partner played like ${PARTNERS[pr.spar].name}: no help here`);
  }
  if (pr.items.includes('pcfit')) tags.push('🫁 Elite fitness: you tire half as fast');
  if (pr.items.includes('pcbreak') && pr.breakStat) tags.push(`🔬 Breakthrough: ${attrLabel(pr.breakStat)} +4% this week`);
  if (pr.items.includes('partner') && pr.partner && PARTNERS[pr.partner]) {
    if (PARTNERS[pr.partner].match(opp)) { edge += 0.009; tags.push(`🎾 You practised against ${PARTNERS[pr.partner].name} all week`); }
    else tags.push(`🎾 Your hitting partner played like ${PARTNERS[pr.partner].name}: no help against this one`);
  }
  if (pr.items.includes('camp')) { edge += 0.007; tags.push(`🏟️ Sharp on ${surfaceLabel(ev.surface).toLowerCase()} after your camp`); }
  if (pr.items.includes('pressure')) { clutch += 0.028; tags.push('🧠 Calm on the big points'); }
  if (pr.items.includes('video')) {
    const h = opp.id && c.h2h && c.h2h[opp.id];
    if (h && h.l > 0) { edge += 0.009; tags.push('📼 You studied your losses to them'); }
  }
  return { edge, clutch, tags };
}

// Scouting extras (bought with Detailed scouting): exact weak wing, serve habits, return spot, big points.
function scoutDetailHtml(o) {
  const g = wingGap(o), pl = planOf(o);
  let h = 2166136261;
  for (const ch of String(o.name || '') + 'srv') { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const dirs = ['out wide', 'down the T', 'into the body'];
  const lines = [
    g > 0.15 ? `Weaker wing: <b>backhand</b> (${Math.round(g * 100)}% worse than the forehand)` : g < -0.1 ? `Weaker wing: <b>forehand</b> (${Math.round(-g * 100)}% worse than the backhand)` : 'Wings: <b>even</b>, no clear weak side',
    `Favourite serves: <b>${dirs[h % 3]}</b> on the deuce side, <b>${dirs[(h >> 3) % 3]}</b> on the ad side`,
    `Returns from: <b>${planLabel('returnPos', pl.returnPos).toLowerCase()}</b> position`,
    `On big points: <b>${attr(o, 'mental') < 52 ? 'tightens up (go after them)' : attr(o, 'mental') > 66 ? 'raises their level (stay solid)' : 'plays them like any other point'}</b>`,
    `Rallies: <b>${pl.aggression === 'aggressive' ? 'goes for it early' : pl.aggression === 'patient' ? 'happy to grind' : 'mixes it up'}</b>, ${planLabel('spin', pl.spin).toLowerCase()} spin`,
  ];
  const qs = quirksOf(o);
  lines.push(qs.length ? `Hidden strength${qs.length > 1 ? 's' : ''}: <b>${qs.map(q => q.text).join('; ')}</b>` : 'Hidden strengths: <b>none found</b>');
  return `<div class="scoutx"><h4 class="sh4">🔎 Detailed scouting</h4><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul></div>`;
}

// The Prepare card on the draw screen: open until your first match of the week starts.
function prepHtml(entry, opp) {
  const pr = prepOf(entry), ev = eventOf(entry), c = current.career;
  const open = !entry.matches.length && !entry.live;
  const used = slotsUsed(pr);
  if (!open) {
    return (pr.items.length ? `<div class="prepbox done"><b>This week's preparation</b><div class="chips">${pr.items.map(id => { const it = allPrep().find(x => x.id === id);
      return `<span class="chip">${it.icon} ${it.name}${id === 'partner' && pr.partner ? ` (${PARTNERS[pr.partner].name})` : ''}</span>`; }).join('')}</div></div>` : '') + recoveryHtml(entry);
  }
  const guess = Object.keys(PARTNERS).find(k => PARTNERS[k].match(opp)) || 'server';
  return `<div class="prepbox">` + fold('d-prep', '🧰 Prepare for the week', `${used} / ${PREP_SLOTS} slots booked · ${money(c.money)} in the bank`,
    `<p class="hint">Pick up to ${PREP_SLOTS}. They last this tournament, and you can only buy them before your first match.</p>` +
    `<div class="prepitems">${PREP.map(it => {
      const got = pr.items.includes(it.id), cost = prepCost(it, ev.tier);
      const can = !got && used < PREP_SLOTS && c.money >= cost;
      return `<div class="prepitem${got ? ' got' : ''}"><span class="ticon">${it.icon}</span><div><b>${it.name}</b><small>${it.desc}</small>` +
        (it.id === 'partner' ? `<select class="inp" id="prepPartner" ${got ? 'disabled' : ''}>${Object.entries(PARTNERS).map(([k, v]) =>
          `<option value="${k}" ${(pr.partner || guess) === k ? 'selected' : ''}>Plays like ${v.name}</option>`).join('')}</select>` : '') +
        `</div><button type="button" class="btn small${got ? ' ghost' : ''}" data-prep="${it.id}" ${got || !can ? 'disabled' : ''}>${got ? '✓ Booked' : money(cost)}</button></div>`;
    }).join('')}</div>` + pcHtml(entry, opp, used)) + `</div>`;
}

// The Performance Center row: locked (with your progress) until you earn the Elite Program achievement.
function pcHtml(entry, opp, used) {
  const pr = prepOf(entry), c = current.career;
  if (!pcUnlocked(c)) {
    if ((c.bestRank || 9999) > 300) return '';
    const w = Math.min(5, atpWins(c));
    return `<div class="pclock"><b>🏛️ Performance Center</b> <span>🔒 Unlocks with the Elite Program achievement: reach the top 100 (best so far: ${c.bestRank ? '#' + c.bestRank : 'unranked'}) and win 5 main-draw matches at ATP level (${w}/5).</span></div>`;
  }
  const guess = Object.keys(PARTNERS).find(k => PARTNERS[k].match(opp)) || 'server';
  return `<div class="pchead"><b>🏛️ Performance Center</b><span>Premium. Two-slot items fill most of your week.</span></div><div class="prepitems">${PC.map(it => {
    const got = pr.items.includes(it.id), can = !got && used + prepSlots(it) <= PREP_SLOTS && c.money >= it.cost;
    return `<div class="prepitem pc${got ? ' got' : ''}"><span class="ticon">${it.icon}</span><div><b>${it.name}${it.slots > 1 ? ' <em class="slot2">2 slots</em>' : ''}</b><small>${it.desc}</small>` +
      (it.id === 'pcspar' ? `<select class="inp" id="pcSpar" ${got ? 'disabled' : ''}>${Object.entries(PARTNERS).map(([k, v]) => `<option value="${k}" ${(pr.spar || guess) === k ? 'selected' : ''}>Plays like ${v.name}</option>`).join('')}</select>` : '') +
      (it.id === 'pcbreak' ? `<select class="inp" id="pcStat" ${got ? 'disabled' : ''}>${ATTRS.map(([k, l]) => `<option value="${k}" ${pr.breakStat === k ? 'selected' : ''}>${l}</option>`).join('')}</select>` : '') +
      `</div><button type="button" class="btn small${got ? ' ghost' : ''}" data-prep="${it.id}" ${got || !can ? 'disabled' : ''}>${got ? '✓ Booked' : money(it.cost)}</button></div>`;
  }).join('')}</div>`;
}

// Between rounds (Performance Center): premium recovery, each one helping less.
function recoveryHtml(entry) {
  const pr = prepOf(entry), c = current.career, n = pr.rec || 0;
  if (!pcUnlocked(c) || !entry.matches.length || entry.result || n >= PC_RECOVERY.steps.length) return '';
  return `<div class="prepbox done pcrec"><b>🛁 Premium recovery treatment</b> <span>−${PC_RECOVERY.steps[n]} fatigue before your next match${n ? ' (each one this week helps less)' : ''}.</span>` +
    `<button type="button" class="btn small" id="pcRec" ${c.money < PC_RECOVERY.cost ? 'disabled' : ''}>${money(PC_RECOVERY.cost)}</button></div>`;
}

function bindPrep(entry, rerender) {
  document.querySelectorAll('[data-prep]').forEach(b => {
    b.onclick = () => {
      const pr = prepOf(entry), it = allPrep().find(x => x.id === b.dataset.prep), c = current.career;
      const cost = it.slots !== undefined ? it.cost : prepCost(it, eventOf(entry).tier);
      if (slotsUsed(pr) + prepSlots(it) > PREP_SLOTS || c.money < cost || pr.items.includes(it.id)) return;
      charge(c, cost, `${it.name} (${eventOf(entry).city})`);
      pr.items.push(it.id);
      if (it.id === 'partner') pr.partner = $('prepPartner').value;
      if (it.id === 'recovery') { current.player.fatigue = clamp((current.player.fatigue || 0) - 15, 0, 100); writeJSON(SAVE_KEY, current.player); }
      if (it.id === 'pcspar') pr.spar = $('pcSpar').value;
      if (it.id === 'pcfit') { current.player.fatigue = clamp((current.player.fatigue || 0) + 10, 0, 100); writeJSON(SAVE_KEY, current.player); }
      if (it.id === 'pcbreak') {
        pr.breakStat = $('pcStat').value;
        if (Math.random() < 0.25) { applyGain(current.player.attrs, pr.breakStat, 0.015); writeJSON(SAVE_KEY, current.player); setTimeout(() => toast('🔬 Breakthrough!', `A lasting gain in ${attrLabel(pr.breakStat)}`), 2700); }
      }
      writeJSON(CAREER_KEY, c); writeJSON(ENTRY_KEY, entry);
      toast(`${it.icon} Booked: ${it.name}`, money(cost));
      rerender();
    };
  });
  if ($('pcRec')) $('pcRec').onclick = () => {
    const pr = prepOf(entry), c = current.career, n = pr.rec || 0;
    if (c.money < PC_RECOVERY.cost || n >= PC_RECOVERY.steps.length) return;
    charge(c, PC_RECOVERY.cost, `Premium recovery (${eventOf(entry).city})`);
    current.player.fatigue = clamp((current.player.fatigue || 0) - PC_RECOVERY.steps[n], 0, 100);
    pr.rec = n + 1;
    writeJSON(SAVE_KEY, current.player); writeJSON(CAREER_KEY, c); writeJSON(ENTRY_KEY, entry);
    toast('🛁 Recovery done', `−${PC_RECOVERY.steps[n]} fatigue`);
    rerender();
  };
}
