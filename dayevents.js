// dayevents.js — the living tour: on some days at an event, something happens (a rain delay, a heat or
// wind advisory) and you choose how to handle it. Events come from that day's weather, which comes from
// the venue's climate and season, so they always fit the place: no humidity in the Alps.

const DAY_EVENTS = {
  damp: { icon: '🌧️', title: 'Rain Delay', text: "Rain has pushed today's schedule back. Your match goes on late, and tomorrow could be a long day.", opts: [
    { id: 'rest', label: 'Rest And Wait', note: 'Recover some energy', fat: -6 },
    { id: 'indoor', label: 'Hit Indoors', note: 'Sharper today, a little more tired', fat: 4, edge: 0.006 },
    { id: 'study', label: 'Study Your Opponent', note: 'Watch their recent matches', cost: 300, edge: 0.008 }] },
  hot: { icon: '🔥', title: 'Heat Advisory', text: 'Extreme heat is forecast. The tournament has extended breaks between sets, but it will still be brutal out there.', opts: [
    { id: 'ice', label: 'Ice Vests And Fluids', note: 'Stay cool in the match', cost: 250, edge: 0.006 },
    { id: 'early', label: 'Short Hit Early', note: 'Get used to it before it peaks', fat: 2, edge: 0.003 },
    { id: 'shade', label: 'Rest In The Shade', note: 'Save your energy', fat: -5 }] },
  humid: { icon: '💧', title: 'Heavy Humidity', text: 'The air is thick today. Balls get heavy and players tire quickly.', opts: [
    { id: 'fluids', label: 'Extra Fluids And Salts', note: 'Hold up better late in the match', cost: 200, edge: 0.005 },
    { id: 'rest', label: 'Rest Indoors', note: 'Recover some energy', fat: -4 }] },
  windy: { icon: '💨', title: 'Wind Advisory', text: 'Strong, gusty wind is forecast. Tosses, lobs and flat balls will be hard to control.', opts: [
    { id: 'practise', label: 'Practise In The Wind', note: 'Get your timing right for it', fat: 3, edge: 0.006 },
    { id: 'rest', label: 'Rest', note: 'Recover some energy', fat: -4 }] },
  cold: { icon: '❄️', title: 'Cold Snap', text: "It's cold today. The ball is dead and muscles take longer to warm up.", opts: [
    { id: 'warm', label: 'Long Warm-Up', note: 'Start the match ready', fat: 2, edge: 0.005 },
    { id: 'rest', label: 'Stay Warm And Rest', note: 'Recover some energy', fat: -4 }] },
};
// Which day of the event it is (qualifying days count), as a key.
const dayKey = entry => entry.qual && !entry.qual.done ? `q${entry.qual.round}` : `r${entry.rounds.length - 1}`;
// Today's event, if any: about half of the days with notable weather (fixed per event and day).
function dayEvent(entry) {
  const ev = eventOf(entry), de = ev && !ev.indoor && DAY_EVENTS[ev.weather];
  if (!de) return null;
  let h = 2166136261;
  for (const ch of `${ev.id || ev.city}@${dayKey(entry)}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h % 100 < 55 ? de : null;
}
const dayCost = (entry, o) => Math.round((o.cost || 0) * (PREP_MULT[eventOf(entry).tier] || 1) / 10) * 10;
// The edge from today's choice (added to your preparation edge for this match).
const dayEdge = entry => { const de = dayEvent(entry), pick = de && (entry.dayPicks || {})[dayKey(entry)]; const o = pick && de.opts.find(x => x.id === pick); return (o && o.edge) || 0; };

function dayEventHtml(entry) {
  const de = dayEvent(entry);
  if (!de) return '';
  const pick = (entry.dayPicks || {})[dayKey(entry)], c = current.career;
  const fx = o => [o.fat ? `${o.fat < 0 ? '−' : '+'}${Math.abs(o.fat)} fatigue` : '', o.cost ? money(dayCost(entry, o)) : '', o.edge ? 'An edge in this match' : ''].filter(Boolean).join(' · ');
  return `<div class="dayev"><div class="dayevhead"><span>${de.icon}</span><b>${de.title}</b></div><p>${de.text}</p>` +
    (pick ? `<p class="dayevdone">✓ ${de.opts.find(o => o.id === pick).label}</p>`
      : `<div class="dayevopts">${de.opts.map(o => `<button type="button" data-dayev="${o.id}" ${o.cost && c.money < dayCost(entry, o) ? 'disabled' : ''}><b>${o.label}</b><small>${o.note}</small><em>${fx(o)}</em></button>`).join('')}</div>`) +
    `<div class="dayevfat">${fatigueBar(current.player.fatigue || 0)}</div></div>`;
}
function bindDayEvent(entry, rerender) {
  document.querySelectorAll('[data-dayev]').forEach(b => { b.onclick = () => {
    const de = dayEvent(entry), o = de && de.opts.find(x => x.id === b.dataset.dayev);
    if (!o || (entry.dayPicks || {})[dayKey(entry)]) return;
    const c = current.career, p = current.player;
    if (o.cost) charge(c, dayCost(entry, o), `${de.title}: ${o.label}`);
    if (o.fat) { p.fatigue = clamp((p.fatigue || 0) + o.fat, 0, 100); writeJSON(SAVE_KEY, p); }
    entry.dayPicks = { ...(entry.dayPicks || {}), [dayKey(entry)]: o.id };
    writeJSON(CAREER_KEY, c); writeJSON(ENTRY_KEY, entry);
    rerender();
  }; });
}
