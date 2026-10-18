// morale.js — the person behind the player. Crowds, travel, surface switches, pressure, memories of past
// matches and life on the road nudge each match a little. Everything is shown before you play (as tags
// on a Morale meter), most downsides have a fix, and there are as many lifts as dips.
// The higher the level, the bigger the swings: life at the top gets no easier.

// How much morale matters at each level (ITF mild … Grand Slams heavy).
const MORALE_SCALE = { M15: 0.5, M25: 0.6, CH75: 0.75, CH125: 0.85, ATP250: 1, ATP500: 1.1, M1000: 1.25, GS: 1.4 };
const MORALE_CAP = 0.03; // ×scale: at most ±1.5% on points at an M15, ±4.2% at a Slam

const tzBetween = (a, b) => { const A = NATION_LL[a], B = NATION_LL[b]; return A && B ? Math.round(Math.abs(A[1] - B[1]) / 15) : 0; };

// Every factor for you at this event (opp optional). Returns { edge, tags: [{icon, text, v}] }.
// general: only the things you carry week to week (for Home), not the event-specific ones.
function moraleFor(c, p, ev, opp, entry, general = false) {
  const sc = MORALE_SCALE[ev.tier] || 0.7, tags = [];
  const add = (icon, text, v) => { if (Math.abs(v) >= 0.0005) tags.push({ icon, text, v: v * sc }); };
  const mental = attr(p, 'mental'), calm = 1.2 - mental / 100; // strong minds feel the bad stuff less
  const temper = p.temperament;
  const hs = c.history.filter(h => !h.real && !h.exhibition);
  const played = entry ? entry.matches.length : 0;

  // Crowd: at home it lifts you; against the local favourite abroad it can be hostile.
  if (general) {} else if (ev.nation === p.nation) add('🏠', 'Home crowd behind you', 0.012);
  else if (opp && opp.nation === ev.nation) {
    if (temper === 'fiery') add('📣', 'Hostile crowd: you feed off it', 0.004);
    else add('📣', `Crowd behind the local favourite`, temper === 'moping' ? -0.012 : temper === 'robotic' ? -0.002 : -0.007);
  }

  // Surface switch: the first event on a new surface after weeks on another (practising on site fixes it).
  const recent = hs.filter(h => h.week >= c.week - 4 && h.week < c.week);
  if (!general && recent.length && recent.every(h => h.surface !== ev.surface) && !(entry && entry.acclimated))
    add('🔄', `Adjusting to ${surfaceLabel(ev.surface).toLowerCase()} after weeks on ${surfaceLabel(recent[recent.length - 1].surface).toLowerCase()}`, played < 2 ? -0.012 : -0.005);

  // Jet lag: long trips across time zones, for the first couple of matches (arriving early or flying business helps).
  const from = entry ? entry.fromNation : c.location || p.nation;
  const tz = from ? tzBetween(from, ev.nation) : 0;
  if (!general && tz >= 5 && played < 1 && !(entry && entry.acclimated)) {
    const biz = c.business || (c.perks && c.perks.jet && c.perks.jet.weeks > 0);
    add('✈️', `Jet-lagged (${tz} time zones)`, -Math.min(0.02, 0.004 * (tz - 4)) * (biz ? 0.5 : 1));
  }

  // Target on your back: a much weaker opponent swings freely.
  // …and the flip side: as the big underdog, you swing freely.
  if (opp && overall(p) - overall(opp) >= 10) add('🎯', 'Big favourite: they have nothing to lose', -0.005 * calm);
  else if (opp && overall(opp) - overall(p) >= 6) add('🆓', 'Underdog: nothing to lose', 0.006);

  // Defending points: back at an event where you did well a year ago.
  const lastYear = hs.find(h => h.week >= c.week - 54 && h.week <= c.week - 50 && h.city === ev.city);
  if (!general && lastYear && lastYear.points >= POINTS[ev.tier][3] && played < 2) {
    add('🛡️', `Defending ${lastYear.points} points from last year`, -Math.min(0.02, 0.006 + lastYear.points / 20000) * calm);
    if (lastYear.reached === 'W') add('🏆', 'Defending champion: the crowd loves you', 0.006);
  }

  // Post-title hangover: a big title in the last two weeks, with no rest week since.
  const bigTitle = hs.find(h => h.reached === 'W' && h.week >= c.week - 3 && h.week < c.week && TITLE_LADDER.indexOf(h.tier) >= TITLE_LADDER.indexOf(ev.tier));
  if (bigTitle && (c.restSince || 0) < bigTitle.week)
    add('🥂', `Still riding the high of ${bigTitle.city}`, -0.012);

  // Bogey player: an opponent who keeps beating you.
  if (opp && opp.id && c.h2h && c.h2h[opp.id]) {
    const h = c.h2h[opp.id];
    if (h.l >= 3 && h.l >= h.w + 2) add('😬', `Bogey player (${h.w}–${h.l})`, -0.012 * calm);
  }
  if (c.exorcised && c.week - c.exorcised <= 2) add('💪', 'Beat your bogey player: belief is sky-high', 0.008);

  // Form: a hot streak lifts you, a run of early exits drags.
  const recs = [...hs.flatMap(h => h.matches), ...(entry ? entry.matches : [])];
  let streak = 0; for (let i = recs.length - 1; i >= 0 && recs[i].won; i--) streak++;
  if (streak >= 5) add('🔥', `On a roll: ${streak} wins in a row`, Math.min(0.012, 0.004 + streak * 0.0008));
  const lastFour = hs.slice(-4);
  if (lastFour.length === 4 && lastFour.every(h => !h.matches.some(m => m.won))) add('🌧️', 'In a slump: four events without a win', -0.006);

  // Life on the road: weeks in a row away from home (a coach and physio make it easier).
  const away = c.awayWeeks || 0;
  if (away >= 8) add('🧳', `${away} weeks on the road`, -Math.min(0.012, 0.002 * (away - 7)) * (hasTeam(c, 'coach') || hasTeam(c, 'physio') ? 0.5 : 1));

  // Good memories and big moments.
  if (!general && hs.some(h => h.city === ev.city && h.matches.some(m => m.won)) && !lastYear) add('🗺️', `Good memories of ${ev.city}`, 0.004);
  if (!general && entry && entry.qualified && played < 3) add('🎟️', 'Came through qualifying: match-tight', 0.006);
  if (!general && !hs.some(h => h.tier === ev.tier) && TIER_ORDER.indexOf(ev.tier) < 6) add('✨', 'First time at this level: buzzing', 0.006);

  // Fresh: first event back after a week off.
  if (!general && c.restSince === c.week - 1 && !bigTitle) add('🌱', 'Fresh after a week off', 0.006);

  const cap = MORALE_CAP * sc;
  const edge = Math.max(-cap, Math.min(cap, tags.reduce((a, t) => a + t.v, 0)));
  return { edge, tags, cap };
}

// The opponent's morale: just the crowd (they're not living your career).
function oppMorale(ev, opp, p) {
  const sc = MORALE_SCALE[ev.tier] || 0.7;
  return opp.nation === ev.nation && opp.nation !== p.nation ? 0.008 * sc : 0;
}

const moraleWord = (edge, cap) => edge > cap * 0.35 ? ['Confident', 'up'] : edge < -cap * 0.35 ? ['Shaky', 'down'] : ['Steady', ''];

function moraleHtml(m) {
  const [word, cls] = moraleWord(m.edge, m.cap), pct = Math.round(50 + (m.edge / m.cap) * 50);
  return `<div class="morale"><div class="mohead"><span>Morale</span><b class="${cls}">${word}</b><small>${m.edge >= 0 ? '+' : '−'}${(Math.abs(m.edge) * 100).toFixed(1)}% on points</small></div>` +
    `<div class="mobar"><i style="left:${Math.max(2, Math.min(98, pct))}%"></i></div>` +
    (m.tags.length ? `<ul class="motags">${m.tags.map(t => `<li class="${t.v >= 0 ? 'up' : 'down'}">${t.icon} ${t.text}</li>`).join('')}</ul>` : '<p class="hint">Nothing on your mind. Just play.</p>') + `</div>`;
}

// Weekly upkeep: weeks away from home, rest weeks (which clear a title hangover).
function moraleWeek(c, p) {
  const played = c.history.some(h => h.week === c.week);
  c.awayWeeks = (c.location || p.nation) === p.nation ? 0 : (c.awayWeeks || 0) + 1;
  if (!played) c.restSince = c.week;
}
