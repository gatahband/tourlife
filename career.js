// career.js — the long game: money (prize money, travel, your team), body (injuries, age) and seasons
// (an end-of-season review with goals for the next one), plus retirement.

// --- Money ---------------------------------------------------------------------------

const START_MONEY = 6000;
// Winner's cheque per tier; earlier rounds get a share of it (R32 out, R16 out, QF, SF, F, W).
const WIN_CHEQUE = { M15: 2160, M25: 3600, CH75: 11000, CH125: 18000, ATP250: 100000, ATP500: 400000, M1000: 1000000, GS: 3000000 };
const ROUND_SHARE = [0.06, 0.1, 0.18, 0.32, 0.55, 1];
const QUAL_SHARE = 0.035;
// Your team, paid weekly. Better (pricier) staff do more; you can change level any week.
const TEAM = {
  coach: { icon: '🧑‍🏫', name: 'Coach', levels: [
    { name: 'None', cost: 0, desc: 'You coach yourself.' },
    { name: 'Club coach', cost: 300, train: 1.15, desc: 'Training +15%. Before matches: their game plan and a counter-plan.' },
    { name: 'Tour coach', cost: 900, train: 1.25, desc: 'Training +25%. Full scouting: their rough ratings, plan and a counter-plan.' },
    { name: 'Elite coach', cost: 2500, train: 1.35, desc: 'Training +35%. Exact ratings, plan and a counter-plan.' },
    { name: 'Master coach', cost: 5000, train: 1.45, desc: 'Training +45%. Unlocks the advanced game plan (target wing, depth, energy, big points) and coaches you during matches.' }] },
  physio: { icon: '💆', name: 'Physio', levels: [
    { name: 'None', cost: 0, desc: 'No help recovering.' },
    { name: 'Physio', cost: 300, recover: 3, injury: 0.8, desc: 'Recover faster each day; 20% fewer injuries, shorter layoffs.' },
    { name: 'Medical team', cost: 1200, recover: 5, injury: 0.55, desc: 'Recover much faster; 45% fewer injuries, shorter layoffs.' }] },
};
// Hotel and food for a tournament week. Bigger events put main-draw players up; qualifiers pay their own way.
const LIVING = { M15: 350, M25: 400, CH75: 250, CH125: 250, ATP250: 150, ATP500: 150, M1000: 150, GS: 150 };
const QUAL_LIVING = 250;
const FLIGHTS = [100, 450, 1100]; // same country, same region, another continent

const money = n => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

function prizeFor(tier, reached, qualRound) {
  const w = WIN_CHEQUE[tier] || 0;
  if (reached < 0) return Math.round(w * QUAL_SHARE * (qualRound > 1 ? 1.4 : 1));
  return Math.round(w * ROUND_SHARE[reached]);
}

// Flights by distance from where you are now (business class costs 3x), plus the week's hotel and food.
function tripCost(c, ev, mode = 'main') {
  const t = travelDays(c.location || current.player.nation, ev.nation);
  // At home you stay with family, so the week costs little.
  const living = ev.nation === current.player.nation ? 100 : (LIVING[ev.tier] || 350) + (mode === 'qual' ? QUAL_LIVING : 0);
  const freeJet = c.perks && c.perks.jet && c.perks.jet.weeks > 0; // business class on the house
  return FLIGHTS[t] * (c.business && !freeJet ? 3 : 1) + living;
}
// Fatigue from the journey: long flights in economy wear you down; business class halves it.
const travelFatigue = (c, from, to) => travelDays(from, to) * 4 * (c.business || (c.perks && c.perks.jet && c.perks.jet.weeks > 0) ? 0.5 : 1);

function charge(c, amount, why) {
  c.money = (c.money ?? START_MONEY) - amount;
  c.ledger = [...(c.ledger || []), { week: c.week, amount: -amount, why }].slice(-60);
}
function earn(c, amount, why) {
  c.money = (c.money ?? START_MONEY) + amount;
  c.ledger = [...(c.ledger || []), { week: c.week, amount, why }].slice(-60);
}

// Team level (older saves stored true/false).
const ownLevel = (c, k) => { const v = c.team && c.team[k]; return v === true ? (k === 'coach' ? 2 : 1) : (v | 0); };
// A reward can give you better staff for free for a while.
const teamLevel = (c, k) => { const pk = c.perks && c.perks[k]; return Math.max(ownLevel(c, k), pk && pk.weeks > 0 ? pk.level : 0); };
const teamOf = (c, k) => TEAM[k].levels[teamLevel(c, k)];
const hasTeam = (c, k) => teamLevel(c, k) > 0;
const trainBoost = c => teamOf(c, 'coach').train || 1;
const recoveryBoost = c => teamOf(c, 'physio').recover || 0;

// End of every week: pay your team (they leave if you can't), your sponsors pay you, and
// coaching juniors at home brings in a little when you didn't play an event.
function weeklyMoney(c) {
  const pk = c.perks || {};
  for (const k of Object.keys(TEAM)) {
    // Covered by a free perk this week: nothing to pay.
    if (pk[k] && pk[k].weeks > 0) { pk[k].weeks--; continue; }
    const t = TEAM[k].levels[ownLevel(c, k)];
    if (!t.cost) continue;
    if ((c.money ?? 0) >= t.cost) charge(c, t.cost, `${t.name} (weekly)`);
    else { c.team[k] = 0; c.notice = `You couldn't pay your ${t.name.toLowerCase()}, so they left.`; }
  }
  payDeals(c);
  maybeOffer(c);
  if (pk.jet && pk.jet.weeks > 0) pk.jet.weeks--;
  // Weeks without an event: work as a hitting partner or coach juniors, wherever you are, so you
  // can always save up for the next trip.
  const played = c.history.some(h => h.week === c.week);
  if (!played) earn(c, 300, (c.location || current.player.nation) === current.player.nation ? 'Coaching juniors' : 'Hitting partner work');
}

// --- Body: stamina ------------------------------------------------------------------
// Fit players last longer on tour: matches take less out of them and they bounce back faster.
const staminaFactor = p => clamp(1.45 - (p.attrs.stam ?? 50) / 100, 0.55, 1.15); // 50 → 0.95, 70 → 0.75, 85 → 0.6
const staminaRecovery = p => Math.max(0, ((p.attrs.stam ?? 50) - 50) / 10);     // extra per rest day: 70 → +2, 80 → +3

// --- Body: injuries ------------------------------------------------------------------

const INJURIES = [
  ['a sore wrist', 1, 2], ['a tight hamstring', 1, 3], ['a shoulder strain', 2, 4], ['a rolled ankle', 1, 3],
  ['a back spasm', 1, 2], ['tennis elbow', 2, 4], ['an abdominal strain', 2, 3], ['knee tendinitis', 2, 5],
];

// Playing and training while exhausted can get you hurt. Returns the injury (or null).
function maybeInjure(c, p, heavy = 1) {
  const f = p.fatigue || 0;
  const age = p.age || 18;
  const odds = Math.max(0, f - 62) * 0.004 * heavy * (age > 30 ? 1 + (age - 30) * 0.12 : 1) * (1 - (p.attrs.stam - 50) / 200)
    * (teamOf(c, 'physio').injury || 1);
  if (Math.random() >= odds) return null;
  const [name, lo, hi] = pick(Math.random, INJURIES);
  const weeks = Math.max(1, randInt(Math.random, lo, hi) - (hasTeam(c, 'physio') && Math.random() < 0.5 ? 1 : 0));
  c.injury = { name, weeks, total: weeks, week: c.week };
  c.injuriesThisSeason = (c.injuriesThisSeason || 0) + 1;
  return c.injury;
}

// A week of rehab: no events, no training, lots of rest.
function rehabWeek() {
  const c = current.career, p = current.player;
  p.fatigue = clamp((p.fatigue || 0) - 35, 0, 100);
  c.injury.weeks--;
  if (c.injury.weeks <= 0) { c.notice = `✅ You're fit again after ${c.injury.name}.`; c.injury = null; }
  writeJSON(SAVE_KEY, p);
  writeJSON(CAREER_KEY, c);
  advanceWeek();
}

// --- Age ------------------------------------------------------------------------------

const START_AGE = 18, RETIRE_FROM = 30, RETIRE_FORCED = 38;

// A year older: young bodies still fill out, then stamina goes first, then everything slowly fades
// (while nous keeps growing).
function agePlayer(p) {
  p.age = (p.age || START_AGE) + 1;
  const a = p.age;
  const change = k => a <= 21 ? 0.008
    : a <= 27 ? 0
    : a <= 30 ? (k === 'stam' ? -0.01 : 0)
    : a <= 33 ? (k === 'stam' ? -0.025 : k === 'iq' || k === 'mental' ? 0.005 : -0.01)
    : (k === 'stam' ? -0.04 : k === 'iq' || k === 'mental' ? 0.005 : -0.02);
  const before = overall(p);
  for (const k of Object.keys(p.attrs)) p.attrs[k] = Math.min(STAT_CAP, Math.round(p.attrs[k] * (1 + change(k)) * 1000) / 1000);
  p.playstyle = detectStyles(p.attrs, p.fav)[0].name;
  return overall(p) - before;
}

// --- Seasons and goals -------------------------------------------------------------------

const TITLE_LADDER = ['M15', 'M25', 'CH75', 'CH125', 'ATP250', 'ATP500', 'M1000', 'GS'];
const niceRank = r => r > 500 ? Math.round(r / 100) * 100 : r > 100 ? Math.round(r / 50) * 50 : r > 20 ? Math.round(r / 10) * 10 : Math.max(1, Math.round(r / 5) * 5);

function seasonStats(c, season) {
  const hs = c.history.filter(h => seasonOfWeek(h.week) === season);
  const wins = hs.reduce((a, h) => a + h.matches.filter(m => m.won).length, 0);
  const losses = hs.reduce((a, h) => a + h.matches.filter(m => !m.won).length, 0);
  const titles = hs.filter(h => h.reached === 'W');
  const prize = hs.reduce((a, h) => a + (h.prize || 0), 0);
  const order = ['Q1', 'Q2', 'Q3', 'R32', 'R16', 'QF', 'SF', 'F', 'W'];
  const best = [...hs].sort((a, b) => TITLE_LADDER.indexOf(b.tier) * 10 + order.indexOf(b.reached) - (TITLE_LADDER.indexOf(a.tier) * 10 + order.indexOf(a.reached)))[0];
  return { wins, losses, titles, prize, best, events: hs.length };
}

// Five goals for the season, pitched at your level, each with a reward the moment you reach it.
// Rewards are the things that come with success on tour: sponsors, wildcards, a famous coach's help,
// training camps, confidence, agents finding you perks.
const SPONSOR_DEAL = [150, 300, 600, 1200, 3000, 8000, 20000];
function makeGoals(c, p) {
  const ovr = overall(p), rank = currentRank(c), season = seasonOfWeek(c.week);
  const tierIdx = ovr < 54 ? 0 : ovr < 58 ? 1 : ovr < 62 ? 2 : ovr < 66 ? 3 : ovr < 69 ? 4 : ovr < 72 ? 5 : 6;
  const T = TITLE_LADDER[tierIdx], T2 = TITLE_LADDER[Math.min(7, tierIdx + 1)], lab = t => TIERS[t].label;
  const an = t => /^[AEIMO]/.test(lab(t)) ? 'an' : 'a';
  const last = seasonStats(c, season - 1);
  const winTarget = Math.max(15, Math.min(60, Math.round((last.wins || 12) * 1.25 / 5) * 5));
  const rankT = rank ? niceRank(rank * 0.6) : 1000;
  const goals = [
    { type: 'rank', target: rankT, text: rank ? `Reach the top ${rankT}` : 'Break into the top 1,000',
      reward: { kind: 'sponsor', amount: SPONSOR_DEAL[tierIdx] }, rtext: `Gatex signs you as a racket ambassador: ${money(SPONSOR_DEAL[tierIdx])} a week for the rest of the season` },
    { type: 'title', target: T, text: `Win ${an(T)} ${lab(T)} title (or bigger)`,
      reward: { kind: 'wildcard', n: 1 }, rtext: 'Tournament directors take notice: a wildcard into any main draw' },
    { type: 'wins', target: winTarget, text: `Win ${winTarget} matches`,
      reward: { kind: 'camp' }, rtext: 'An off-season training camp: +2% to your two weakest stats' },
  ];
  // Two more, rotating by season.
  const extra = [
    { type: 'final', target: T2, text: `Reach a final at ${an(T2)} ${lab(T2)} or bigger`,
      reward: { kind: 'coach', level: 3, weeks: 4 }, rtext: 'A legendary coach works with you for free for 4 weeks (Elite coach)' },
    tierIdx >= 4 ? { type: 'scalp', target: 20, text: 'Beat a top-20 player', reward: { kind: 'stat', stats: ['mental'], gain: 0.08 }, rtext: 'Big-match belief: +8% Mental Resilience' }
      : { type: 'seed', target: 1, text: 'Beat a seeded player', reward: { kind: 'stat', stats: ['mental'], gain: 0.025 }, rtext: 'Big-match belief: +2.5% Mental Resilience' },
    { type: 'surfaces', target: 3, text: 'Win matches on clay, grass and hard', reward: { kind: 'stat', stats: ['iq', 'net'], gain: 0.015 }, rtext: 'All-court craft: +1.5% Tennis IQ and Net' },
    { type: 'prize', target: [5000, 12000, 30000, 70000, 200000, 600000, 1500000][tierIdx], text: `Earn ${money([5000, 12000, 30000, 70000, 200000, 600000, 1500000][tierIdx])} in prize money`,
      reward: { kind: 'jet', weeks: 8 }, rtext: 'Your agent lands a travel deal: free business-class flights for 8 weeks' },
    { type: 'physio', target: 0, text: 'Play 15 events without an injury', reward: { kind: 'physio', level: 2, weeks: 6 }, rtext: 'A sports-science team joins free for 6 weeks (Medical team)' },
  ];
  const pickN = [0, 1, 2, 3, 4].sort((a, b) => ((a * 7 + season * 3) % 5) - ((b * 7 + season * 3) % 5)).slice(0, 2);
  return [...goals, ...pickN.map(i => extra[i])];
}

function goalDone(c, g, season = seasonOfWeek(c.week)) {
  const st = seasonStats(c, season);
  const hs = c.history.filter(h => seasonOfWeek(h.week) === season && !h.exhibition);
  const wins = hs.flatMap(h => h.matches.filter(m => m.won).map(m => ({ m, h })));
  if (g.type === 'rank') { const r = currentRank(c); return !!r && r <= g.target; }
  if (g.type === 'title') return st.titles.some(h => TITLE_LADDER.indexOf(h.tier) >= TITLE_LADDER.indexOf(g.target));
  if (g.type === 'wins') return st.wins >= g.target;
  if (g.type === 'final') return hs.some(h => (h.reached === 'F' || h.reached === 'W') && TITLE_LADDER.indexOf(h.tier) >= TITLE_LADDER.indexOf(g.target));
  if (g.type === 'scalp') return wins.some(({ m }) => m.opponent && m.opponent.atpRank && m.opponent.atpRank <= g.target);
  if (g.type === 'seed') return wins.some(({ m }) => m.opponent && m.opponent.seed);
  if (g.type === 'surfaces') return ['hard', 'clay', 'grass'].every(sf => wins.some(({ h }) => h.surface === sf));
  if (g.type === 'prize') return st.prize >= g.target;
  if (g.type === 'physio') return hs.length >= 15 && !(c.injuriesThisSeason > 0);
  return false;
}

// How far along a goal is, in a few characters ("9/15", "#240", "$4k/$12k").
function goalProgress(c, g) {
  const season = seasonOfWeek(c.week), st = seasonStats(c, season);
  const hs = c.history.filter(h => seasonOfWeek(h.week) === season && !h.exhibition);
  const k = n => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (g.type === 'wins') return `${st.wins}/${g.target}`;
  if (g.type === 'rank') { const r = currentRank(c); return r ? `#${r}` : 'Unranked'; }
  if (g.type === 'prize') return `${k(st.prize)}/${k(g.target)}`;
  if (g.type === 'surfaces') return `${['hard', 'clay', 'grass'].filter(sf => hs.some(h => h.surface === sf && h.matches.some(m => m.won))).length}/3`;
  if (g.type === 'physio') return `${hs.length}/15`;
  return '';
}

// Hand out rewards for goals just reached.
function claimGoals(c, p) {
  if (!c.goals) return;
  let changed = false;
  for (const g of c.goals) {
    if (g.claimed || !g.reward || !goalDone(c, g)) continue;
    g.claimed = c.week; changed = true;
    giveReward(c, p, g.reward);
    setTimeout(() => toast(`🎯 Goal reached: ${g.text}`, g.rtext), 400);
  }
  if (changed) { writeJSON(CAREER_KEY, c); writeJSON(SAVE_KEY, p); }
}

function giveReward(c, p, r) {
  c.perks = c.perks || {};
  if (r.kind === 'sponsor') {
    // Gatex signs you on the spot, unless you already have a better racket deal: then it's a cash bonus.
    const cur = activeDeals(c).find(d => d.cat === 'racket');
    if (cur && cur.weekly >= r.amount) earn(c, r.amount * 8, 'Ranking bonus from your racket sponsor');
    else {
      c.deals = dealsOf(c).filter(d => d.cat !== 'racket' || d.until < c.week);
      signDeal(c, { brand: 'gatex', cat: 'racket', weekly: r.amount, weeks: 52 - weekInSeason(c.week) + 1, bonus: r.amount * 2 });
    }
  }
  if (r.kind === 'wildcard') c.perks.wildcards = (c.perks.wildcards || 0) + r.n;
  if (r.kind === 'coach') c.perks.coach = { level: r.level, weeks: r.weeks };
  if (r.kind === 'physio') c.perks.physio = { level: r.level, weeks: r.weeks };
  if (r.kind === 'jet') c.perks.jet = { weeks: r.weeks };
  if (r.kind === 'camp') {
    const weakest = ATTR_KEYS.slice().sort((a, b) => p.attrs[a] - p.attrs[b]).slice(0, 2);
    weakest.forEach(k => applyGain(p.attrs, k, 0.02));
  }
  if (r.kind === 'stat') r.stats.forEach(k => applyGain(p.attrs, k, r.gain));
  p.playstyle = detectStyles(p.attrs, p.fav)[0].name;
}

// Perks still running, for the Home card.
function perkLines(c) {
  const k = c.perks || {}, out = [];

  if (k.wildcards) out.push(`🎟️ ${k.wildcards} wildcard${k.wildcards === 1 ? '' : 's'} to use`);
  if (k.coach && k.coach.weeks > 0) out.push(`🧑‍🏫 Free ${TEAM.coach.levels[k.coach.level].name}: ${k.coach.weeks} week${k.coach.weeks === 1 ? '' : 's'} left`);
  if (k.physio && k.physio.weeks > 0) out.push(`💆 Free ${TEAM.physio.levels[k.physio.level].name}: ${k.physio.weeks} week${k.physio.weeks === 1 ? '' : 's'} left`);
  if (k.jet && k.jet.weeks > 0) out.push(`✈️ Free business class: ${k.jet.weeks} week${k.jet.weeks === 1 ? '' : 's'} left`);
  return out;
}

// Fill in anything older careers don't have yet.
function ensureCareer(c, p) {
  let changed = false;
  if (c.money === undefined) { c.money = START_MONEY; changed = true; }
  if (!c.team) { c.team = { coach: false, physio: false }; changed = true; }
  if (p.age === undefined) { p.age = START_AGE + seasonOfWeek(c.week) - 1; writeJSON(SAVE_KEY, p); }
  if (!c.goals || !c.goals[0] || !c.goals[0].reward) { c.goals = makeGoals(c, p); c.goalSeason = seasonOfWeek(c.week); changed = true; }
  if (!c.perks) { c.perks = {}; changed = true; }
  // Older saves: a goal-reward sponsorship becomes a proper Gatex deal.
  if (c.perks.sponsor) { if (c.perks.sponsor.season === seasonOfWeek(c.week)) signDeal(c, { brand: 'gatex', cat: 'racket', weekly: c.perks.sponsor.amount, weeks: 52 - weekInSeason(c.week) + 1, bonus: 0 }); delete c.perks.sponsor; changed = true; }
  for (const g of c.goals || []) if (g.type === 'scalp' && !g.claimed && g.reward.gain !== 0.08) { g.reward.gain = 0.08; g.rtext = 'Big-match belief: +8% Mental Resilience'; changed = true; }
  if (!c.seasonStart) { c.seasonStart = { ovr: overall(p), rank: currentRank(c), age: p.age }; changed = true; }
  compactHistory(c);
  if (changed) writeJSON(CAREER_KEY, c);
}

// Called by advanceWeek when a new season begins.
function newSeason(c, p) {
  const season = seasonOfWeek(c.week) - 1;
  const st = seasonStats(c, season);
  const rivalsNow = Object.keys(c.h2h || {}).filter(id => isRival(c, id)).length;
  const review = {
    season, ...st, titles: st.titles.map(h => `${h.city} (${(TIERS[h.tier] || { label: h.tier }).label})`),
    best: st.best ? `${st.best.reached === 'W' ? 'Won' : `Reached the ${st.best.reached}`} at ${st.best.city} (${(TIERS[st.best.tier] || { label: st.best.tier }).label})` : null,
    rankStart: c.seasonStart && c.seasonStart.rank, rankEnd: currentRank(c), bestRank: c.bestRank || null,
    ovrStart: c.seasonStart ? c.seasonStart.ovr : overall(p), ovrEnd: overall(p),
    goals: (c.goals || []).map(g => ({ text: g.text, done: !!g.claimed || goalDone(c, g, season), rtext: g.rtext })),
    rivals: rivalsNow, rivalsNew: rivalsNow - ((c.seasonStart && c.seasonStart.rivals) || 0), money: c.money,
  };
  poolAge(c);
  compactHistory(c);
  const ageDelta = agePlayer(p);
  review.age = p.age; review.ageDelta = ageDelta;
  c.seasons = [...(c.seasons || []), review];
  c.goals = makeGoals(c, p);
  c.goalSeason = seasonOfWeek(c.week);
  c.injuriesThisSeason = 0;
  c.seasonStart = { ovr: overall(p), rank: currentRank(c), age: p.age, rivals: rivalsNow };
  c.pendingReview = true;
  if (p.age >= RETIRE_FORCED) c.forcedRetire = true;
  writeJSON(SAVE_KEY, p);
}

function openSeasonReview(c) {
  const r = c.seasons[c.seasons.length - 1];
  c.pendingReview = false;
  writeJSON(CAREER_KEY, c);
  const tile = (label, value, sub = '') => `<div class="rcell"><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  const met = r.goals.filter(g => g.done).length;
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<h2 class="itop">Season ${r.season} review</h2>` +
    `<div class="ovrexp review">` +
      tile('Ranking', rankText(r.rankEnd), r.rankStart ? `started ${rankText(r.rankStart)}` : 'started unranked') +
      tile('Record', `${r.wins}–${r.losses}`, `${r.events} events`) +
      tile('Titles', r.titles.length, r.titles.slice(0, 2).join(', ')) +
      tile('Prize money', money(r.prize), `bank ${money(r.money)}`) +
      tile('OVR', r.ovrEnd.toFixed(1), `${r.ovrEnd >= r.ovrStart ? '+' : ''}${(r.ovrEnd - r.ovrStart).toFixed(1)} this season`) +
      tile('Rivals', r.rivals, r.rivalsNew > 0 ? `${r.rivalsNew} new` : '') +
    `</div>` +
    (r.best ? `<p class="big center">Best result: <b>${esc(r.best)}</b></p>` : '') +
    `<h3 class="ssec">Goals: ${met} of ${r.goals.length} met</h3><ul class="goals">${r.goals.map(g => `<li>${g.done ? '✅' : '❌'} ${g.text}</li>`).join('')}</ul>` +
    `<h3 class="ssec">Season ${r.season + 1} goals</h3><ul class="goals">${c.goals.map(g => `<li>🎯 ${g.text}<small class="grew">🎁 ${g.rtext}</small></li>`).join('')}</ul>` +
    `<p class="hint center">You're now ${r.age}.${Math.abs(r.ageDelta) >= 0.05 ? ` Your body ${r.ageDelta > 0 ? 'filled out a little' : 'is starting to slow down'} (OVR ${r.ageDelta > 0 ? '+' : ''}${r.ageDelta.toFixed(1)}).` : ''}` +
      `${c.forcedRetire ? ' At this age it is time to hang up the racket.' : ''}</p>` +
    `<button type="button" class="btn" id="srGo">${c.forcedRetire ? 'Retire' : `Start season ${r.season + 1}`}</button>`,
    { wide: true, onClose: () => { if (c.forcedRetire) retire(); } });
  $('mx').onclick = closeModal;
  $('srGo').onclick = closeModal;
}

// --- Retirement -------------------------------------------------------------------------

function retire() {
  const c = current.career, p = current.player;
  if (c.retired) return;
  c.retired = { week: c.week, age: p.age, ovr: overall(p), rank: currentRank(c) };
  writeJSON(CAREER_KEY, c);
  renderTournaments(p);
  showScreen('home');
  openCareerSummary();
}

function careerSummaryHtml(c, p) {
  const all = c.history;
  const wins = all.reduce((a, h) => a + h.matches.filter(m => m.won).length, 0);
  const losses = all.reduce((a, h) => a + h.matches.filter(m => !m.won).length, 0);
  const prize = all.reduce((a, h) => a + (h.prize || 0), 0);
  const big = c.titles.filter(t => TITLE_LADDER.indexOf(t.tier) >= 4);
  const rivals = Object.keys(c.h2h || {}).filter(id => isRival(c, id) && c.pool && c.pool[id])
    .map(id => `${flagOf(c.pool[id].nation)} ${esc(c.pool[id].name)} (${c.h2h[id].w}–${c.h2h[id].l})`);
  const tile = (label, value) => `<div class="rcell"><span>${label}</span><b>${value}</b></div>`;
  return `<div class="ovrexp review">` + tile('Career high', c.bestRank ? `#${c.bestRank}` : '—') + tile('Titles', c.titles.length) +
    tile('Record', `${wins}–${losses}`) + tile('Prize money', money(prize)) + tile('Seasons', seasonOfWeek(c.week)) + tile('Peak OVR', (c.peakOvr || overall(p)).toFixed(1)) + `</div>` +
    (big.length ? `<p class="big center">Tour titles: ${big.map(t => `${esc(t.city)} (${TIERS[t.tier].label})`).join(', ')}</p>` : '') +
    (rivals.length ? `<p class="hint center">Rivals: ${rivals.join(' · ')}</p>` : '');
}

function openCareerSummary() {
  const c = current.career, p = current.player;
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<h2 class="itop">${esc(p.name)}: career over</h2>` +
    `<p class="hint center">Retired at ${c.retired.age}.</p>` + careerSummaryHtml(c, p) +
    `<button type="button" class="btn" id="csNew">Start a new career</button>`, { wide: true });
  $('mx').onclick = closeModal;
  $('csNew').onclick = newCareer;
}

// --- Home pieces -------------------------------------------------------------------------

// Goals (live ticks), team and money card, notices. Returns true if Home should stop here (retired / injured).
function renderCareerBits(c, p) {
  if (overall(p) > (c.peakOvr || 0)) { c.peakOvr = overall(p); writeJSON(CAREER_KEY, c); }
  $('cMeta').textContent = $('cMeta').textContent.replace(/ · Age \d+$/, '') + ` · Age ${p.age}`;
  claimGoals(c, p);
  const perks = perkLines(c);
  const nBadges = Object.keys(c.badges || {}).length, nHl = (c.highlights || []).length;
  $('hGoals').innerHTML = `<div class="goalbox"><div class="gbhead"><b>Season ${c.goalSeason} goals</b><span>${c.goals.filter(g => g.claimed).length} of ${c.goals.length} done</span></div>` +
    c.goals.map(g => `<div class="grow2 ${g.claimed ? 'gdone' : ''}"><span class="gicon">${g.claimed ? '✅' : '🎯'}</span>` +
      `<div class="gtext"><b>${g.text}</b><small>🎁 ${g.claimed ? 'Earned: ' : ''}${g.rtext}</small></div><span class="gprog">${g.claimed ? 'Done' : goalProgress(c, g)}</span></div>`).join('') +
    (perks.length ? `<div class="perks"><b>Your rewards</b>${perks.map(x => `<div>${x}</div>`).join('')}</div>` : '') +
    itineraryHtml(c, p) +
    `<div class="gbbtns"><button type="button" class="btn small ghost" id="gbBadges">🏅 Achievements (${nBadges})</button>` +
    `<button type="button" class="btn small ghost" id="gbHl">🎬 Highlights (${nHl})</button></div></div>`;
  $('gbHl').onclick = () => openHighlights();
  $('gbBadges').onclick = () => { const d = document.querySelector('.badgebox'); d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const last = (c.ledger || []).slice(-4).reverse();
  $('hTeam').innerHTML = `<div class="moneyline"><b>${money(c.money)}</b><span>in the bank</span></div>` +
    `<div class="team">${Object.entries(TEAM).map(([k, t]) => {
      const lv = teamLevel(c, k), cur = t.levels[lv], pk = c.perks && c.perks[k];
      const free = pk && pk.weeks > 0 && pk.level > ownLevel(c, k) ? pk : null;
      return `<div class="teamrow"><span class="ticon">${t.icon}</span><div class="teammain"><b>${t.name}: ${cur.name}${free ? ` · free for ${free.weeks} more week${free.weeks === 1 ? '' : 's'} 🎁` : cur.cost ? ` · ${money(cur.cost)}/week` : ''}</b><small>${cur.desc}</small>` +
        `<div class="seg" style="grid-template-columns:repeat(${t.levels.length},1fr)" data-team="${k}">${t.levels.map((l, i) =>
          `<button type="button" data-lv="${i}" class="${i === lv ? 'on' : ''}">${l.name.replace(/ (coach|team)$/, '')}${free && i === free.level ? '<small>Free 🎁</small>' : l.cost ? `<small>${money(l.cost)}</small>` : ''}</button>`).join('')}</div>` +
        (free ? `<small class="hint">A season-goal reward. Tap another option to give it up and pick your own.</small>` : '') + `</div></div>`;
    }).join('')}` +
    `<label class="teamrow bizrow"><input type="checkbox" id="hBiz" ${c.business ? 'checked' : ''}><span class="ticon">✈️</span><div class="teammain"><b>Fly business class</b>` +
    `<small>Flights cost 3× as much, but long trips tire you half as much.</small></div></label>` +
    `<p class="hint">Main-draw players at Challengers and tour events get a hotel; qualifiers pay their own.</p></div>` + sponsorsHtml(c) +
    (last.length ? `<ul class="ledger">${last.map(l => `<li><span>W${weekInSeason(l.week)} · ${esc(l.why)}</span><b class="${l.amount >= 0 ? 'up' : 'down'}">${l.amount >= 0 ? '+' : '−'}${money(Math.abs(l.amount))}</b></li>`).join('')}</ul>` : '') +
    `<p class="hint">Prize money comes in by round reached. Flights and the week's hotel are paid when you enter.</p>` +
    (p.age >= RETIRE_FROM && !c.retired ? `<button type="button" class="link" id="hRetire">Retire from tennis…</button>` : '');
  $('hTeam').onclick = e => {
    const b = e.target.closest('[data-lv]');
    if (!b) return;
    const k = b.parentElement.dataset.team, lv = +b.dataset.lv, pk = c.perks && c.perks[k];
    // A free reward is covering this role: picking something else means giving it up.
    if (pk && pk.weeks > 0 && pk.level > ownLevel(c, k)) {
      if (lv === pk.level) return;
      if (!confirm(`Give up your free ${TEAM[k].levels[pk.level].name} (${pk.weeks} week${pk.weeks === 1 ? '' : 's'} left) and switch to ${TEAM[k].levels[lv].name}?`)) return;
      delete c.perks[k];
    }
    c.team[k] = lv;
    writeJSON(CAREER_KEY, c);
    renderCareerBits(c, p);
  };
  if ($('hOffer')) $('hOffer').onclick = () => openOffer(c);
  $('hBiz').onchange = e => { c.business = e.target.checked; writeJSON(CAREER_KEY, c); renderTournaments(p); };
  if ($('hRetire')) $('hRetire').onclick = () => { if (confirm(`Retire ${p.name} for good? This ends the career.`)) retire(); };
  if (window.saveFailed) c.notice = "⚠️ Your browser's storage is full, so progress may not be saving. Save a copy (Back up or move my career), then delete old saved careers.";
  if (c.notice) { $('hNotice').textContent = c.notice; $('hNotice').hidden = false; c.notice = null; writeJSON(CAREER_KEY, c); }
  else $('hNotice').hidden = true;
  if (c.pendingReview && c.seasons && c.seasons.length) setTimeout(() => openSeasonReview(c), 50);
  else if (c.offer && !c.offer.shown) { c.offer.shown = true; writeJSON(CAREER_KEY, c); setTimeout(() => openOffer(c), 300); }

  const box = $('events');
  if (c.retired) {
    $('eventsTitle').textContent = 'Retired';
    box.innerHTML = careerSummaryHtml(c, p) + `<button type="button" class="btn" id="hNew">Start a new career</button>`;
    $('hNew').onclick = newCareer;
    return true;
  }
  if (c.injury && !current.entry) {
    $('eventsTitle').textContent = `Week ${weekInSeason(c.week)} · ${monthOf(c.week)} — Injured`;
    box.innerHTML = `<div class="event row-ev"><div><div class="ev-city">🤕 Out with ${c.injury.name}</div>` +
      `<div class="ev-meta">${c.injury.weeks} week${c.injury.weeks === 1 ? '' : 's'} to go. Rest and rehab until you're fit.${hasTeam(c, 'physio') ? ' Your physio is helping.' : ''}</div></div>` +
      `<button type="button" class="btn small" id="hRehab">Rehab this week</button></div>`;
    $('hRehab').onclick = rehabWeek;
    return true;
  }
  return false;
}

// --- Between matches: check-in --------------------------------------------------------

// Injury risk from how tired you are (see maybeInjure).
const injuryRisk = f => f < 62 ? ['Low', 'ok'] : f < 72 ? ['Some', 'warn'] : f < 85 ? ['High', 'bad'] : ['Very high', 'bad'];

function checkInHtml(p) {
  const f = p.fatigue || 0, [risk, cls] = injuryRisk(f), pen = tiredness(p);
  return `<div class="checkin"><h3 class="ssec">How you're feeling</h3>${fatigueBar(f)}` +
    (rustOf(current.career) >= 0.001 ? `<p class="hint">🧊 ${rustText(current.career)}</p>` : '') +
    `<p class="hint center">Injury risk: <b class="risk ${cls}">${risk}</b>.${pen >= 0.005 ? ` Tiredness costs you <b class="risk ${f >= 85 ? 'bad' : 'warn'}">−${(pen * 100).toFixed(1)}% on points</b>.` : ''} ${f >= 72 ? 'Playing on this tired could get you hurt. You can pull out and keep what you have earned.' : 'Each match adds fatigue; three-setters add more.'}</p>` +
    `</div>`;
}

// --- Coach: full scouting report and a counter-plan --------------------------------------

// The plan your coach would pick against this opponent, here.
function coachPlan(o, ev, me) {
  const a = o.attrs, op = planOf(o), mine = planOf(me);
  const fast = ev.surface === 'grass' || ev.indoor;
  return {
    serve: a.ret >= 58 ? 'safe' : a.ret <= 46 || me.attrs.serve >= 60 ? 'big' : 'balanced',
    returnPos: a.serve >= 60 || op.serve === 'big' ? 'deep' : a.serve <= 46 ? 'inside' : 'normal',
    aggression: a.ground <= 46 ? 'patient' : a.stam >= 58 || op.aggression === 'patient' ? 'aggressive' : mine.aggression,
    spin: op.spin === 'flat' && !fast ? 'topspin' : op.spin === 'topspin' && fast ? 'flat' : ev.surface === 'clay' ? 'topspin' : mine.spin,
    net: a.ground <= 48 || ev.surface === 'grass' ? 'often' : a.ground >= 60 ? 'rarely' : 'sometimes',
    drops: a.stam <= 48 || a.net <= 46 || ev.surface === 'clay' ? 'often' : a.net >= 60 ? 'rarely' : 'sometimes',
    underarm: op.returnPos === 'deep' && me.attrs.iq >= 55 ? 'rarely' : 'never',
    // Advanced settings, when your coach is good enough to unlock them.
    ...advCoach(o, ev, me),
  };
}
function advCoach(o, ev, me) {
  const lv = teamLevel(current.career, 'coach') >= 4 ? 4 : 0, mine = planOf(me), a = o.attrs, g = wingGap(o);
  const fast = ev.surface === 'grass' || ev.indoor, hot = typeof wxOf === 'function' && wxOf(ev).heat > 1.15;
  return {
    wing: lv >= 2 ? (g > 0.15 ? 'bh' : g < -0.1 ? 'fh' : 'neutral') : mine.wing,
    depth: lv >= 2 ? (ev.surface === 'clay' && (planOf(o).aggression === 'aggressive' || a.ground >= 60) && planOf(o).net !== 'often' ? 'high'
      : me.attrs.ground >= 62 && !(ev.surface === 'clay') ? 'deep' : 'balanced') : mine.depth,
    energy: lv >= 3 ? (hot && me.attrs.stam < 62 ? 'conserve' : me.attrs.stam >= 66 && !hot ? 'hustle' : 'normal') : mine.energy,
    pressure: lv >= 3 ? (a.mental < 52 ? 'broke' : a.mental > 66 ? 'safe' : 'standard') : mine.pressure,
  };
}

// Video analysis: the full read on an opponent (not limited by your coach's level).
const advCoachFull = o => { const g = wingGap(o); return { wing: g > 0.15 ? 'bh' : g < -0.1 ? 'fh' : 'neutral' }; };
// Before a rematch: the counter-plan from your video analysis of the last loss.
function videoPlanHtml(c, opp, plan) {
  const v = opp.id && c.videoPlans && c.videoPlans[opp.id];
  if (!v) return '';
  const lv = teamLevel(c, 'coach');
  const diffs = GAME_PLAN.filter(g => (!g.coach || lv >= g.coach) && v.plan[g.key] && v.plan[g.key] !== (plan[g.key] || DEFAULT_PLAN[g.key]));
  return `<div class="advice"><b>📼 Your video analysis of the last loss (${esc(v.score)})</b>` +
    (diffs.length ? `<ul>${diffs.map(g => `<li>${g.label}: <b>${planLabel(g.key, v.plan[g.key])}</b></li>`).join('')}</ul><button type="button" class="btn small" id="vidUse">Use the video plan</button>`
      : '<p class="hint">Your plan already follows it.</p>') + `</div>`;
}

// When an opponent adjusts to your plan: two ways to answer it (the Master coach offers both).
function counters(key, cur) {
  const other = cur.wing === 'bh' ? 'fh' : 'bh';
  return ({
    wing: [{ label: `Switch to their ${other === 'bh' ? 'backhand' : 'forehand'} and catch them out of position`, plan: { wing: other } },
      { label: 'Go back to neutral and drive deep through the middle', plan: { wing: 'neutral', depth: 'deep' } }],
    aggression: [{ label: 'Be patient: make them hit one more ball', plan: { aggression: 'patient' } },
      { label: 'Come forward and finish points at the net', plan: { net: 'often' } }],
    serve: [{ label: 'Serve safer and mix up the placement', plan: { serve: 'balanced' } },
      { label: 'Follow the serve in and rush them', plan: { net: 'often' } }],
    net: [{ label: 'Stay back and rally', plan: { net: 'rarely' } },
      { label: 'Approach off deeper, heavier balls', plan: { spin: 'topspin', depth: 'deep' } }],
    depth: [{ label: 'Drive it deep and flat instead', plan: { depth: 'deep', spin: 'flat' } },
      { label: 'Drop shot them when they step in', plan: { drops: 'often' } }],
    spin: [{ label: 'Use heavy topspin to get the ball up high', plan: { spin: 'topspin' } },
      { label: 'Shorten the points: attack earlier', plan: { aggression: 'aggressive' } }],
    drops: [{ label: 'Save the drop shot for the big moments', plan: { drops: 'rarely' } },
      { label: 'Push them deep first, then drop', plan: { depth: 'deep' } }],
    returnPos: [{ label: 'Step back to a normal return position', plan: { returnPos: 'normal' } },
      { label: 'Stand deep and start the rally neutral', plan: { returnPos: 'deep' } }],
  })[key] || [{ label: 'Change the rhythm: switch your rally style', plan: { aggression: cur.aggression === 'aggressive' ? 'patient' : 'aggressive' } },
    { label: 'Change the shape: heavier topspin and more margin', plan: { spin: 'topspin', depth: 'high' } }];
}
// The latest adjustment the opponent made against you this match, if any.
const lastAdapt = (m, me) => (m.adapted || []).filter(a => a.against === me).slice(-1)[0] || null;
// What a coach below Master tells you about it.
function adaptNotice(m, ps, me) {
  const a = lastAdapt(m, me), lv = teamLevel(current.career, 'coach');
  if (!a || lv >= 4) return '';
  return lv > 0 ? `🧑‍🏫 Your coach: "Something changed. ${esc(shortName(ps[1 - me]))} has adjusted to your plan, and it isn't working like before."` : '';
}

// Master coach, mid-match: reads how the match is actually going and suggests changes, with the reasons.
// Returns { tips: [text], plan: {changes} }.
function liveAdvice(m, ps, me, ev) {
  const op = 1 - me, Y = m.stats[me], T = m.stats[op], A = ps[me], O = ps[op], cur = planOf(A);
  const tips = [], plan = {};
  // First: if they've adjusted to you, name it and give two counters.
  const ad = lastAdapt(m, me);
  const cts = ad ? counters(ad.key, cur).map(c => ({ ...c, plan: Object.fromEntries(Object.entries(c.plan).filter(([k, v]) => cur[k] !== v)) })).filter(c => Object.keys(c.plan).length) : [];
  if (ad && cts.length) tips.push(`${shortName(O)} ${ad.label}. Two ways to answer it (buttons below).`);
  const pct = (a, b) => (b ? a / b : 0);
  const set = (k, v, why) => { if (tips.length < 3 && cur[k] !== v && plan[k] === undefined) { plan[k] = v; tips.push(why); } };
  // Their serve is hurting you.
  if (T.servePts >= 12 && (T.aces / T.servePts > 0.09 || pct(T.firstWon, T.firstIn) > 0.78)) set('returnPos', 'deep', `Their first serve is winning ${Math.round(pct(T.firstWon, T.firstIn) * 100)}% of points. Stand deeper to return.`);
  else if (T.servePts >= 12 && pct(T.secondWon, T.servePts - T.firstIn) < 0.45) set('returnPos', 'inside', `Their second serve is weak (${Math.round(pct(T.secondWon, T.servePts - T.firstIn) * 100)}% won). Step in and attack it.`);
  // Your serve.
  if (Y.servePts >= 12 && pct(Y.firstIn, Y.servePts) < 0.55) set('serve', 'safe', `Only ${Math.round(pct(Y.firstIn, Y.servePts) * 100)}% of first serves are going in. Take some pace off and make them.`);
  if (Y.df >= 4) set('serve', 'safe', `${Y.df} double faults already. Play safer on serve.`);
  // Errors vs winners.
  if (Y.ue >= T.ue + 4) { set('aggression', 'patient', `You've made ${Y.ue} unforced errors to their ${T.ue}. Be patient and make them play.`); set('depth', 'high', 'Give yourself more margin over the net until the errors stop.'); }
  else if (T.ue >= Y.ue + 5) set('aggression', 'patient', `They're missing a lot (${T.ue} errors). Keep the ball in play and let them.`);
  if (T.winners >= Y.winners + 6) set('depth', 'deep', `They've hit ${T.winners} winners. Push them back with deep balls so they can't attack.`);
  // Net game.
  if (Y.netPlayed >= 5 && pct(Y.netWon, Y.netPlayed) < 0.45) set('net', 'rarely', `You're only winning ${Math.round(pct(Y.netWon, Y.netPlayed) * 100)}% at the net. Stay back.`);
  else if (Y.netPlayed >= 4 && pct(Y.netWon, Y.netPlayed) > 0.7) set('net', 'often', `You're winning ${Math.round(pct(Y.netWon, Y.netPlayed) * 100)}% at the net. Come in more.`);
  // Big points.
  if (Y.bpChances >= 3 && pct(Y.bpWon, Y.bpChances) < 0.3 && attr(O, 'mental') < 60) set('pressure', 'broke', `You've taken ${Y.bpWon} of ${Y.bpChances} break points. They're nervous: go for it on the big ones.`);
  else if (Y.bpFaced >= 3 && pct(Y.bpSaved, Y.bpFaced) < 0.5) set('pressure', 'safe', `You've saved only ${Y.bpSaved} of ${Y.bpFaced} break points. Stay solid when it's tight.`);
  // Legs.
  if (m.totalGames >= 18 && attr(A, 'stam') < 62 && cur.energy === 'hustle') set('energy', 'conserve', 'This is getting long. Save your legs or you will fade.');
  else if (m.totalGames >= 18 && attr(A, 'stam') >= 66 && attr(O, 'stam') < 56) set('energy', 'hustle', 'They are tiring. Raise the intensity and make every point physical.');
  // Their weaker wing.
  const g = wingGap(O), want = g > 0.15 ? 'bh' : g < -0.1 ? 'fh' : null;
  if (want) set('wing', want, `Keep going at their ${want === 'bh' ? 'backhand' : 'forehand'}: it is the weaker side.`);
  // Nothing wrong: say so.
  const won = m.games[me] - m.games[op] + m.sets.reduce((n, st) => n + (st.games[me] > st.games[op] ? 3 : -3), 0);
  if (!tips.length) tips.push(won >= 0 ? "It's working. Change nothing." : "The plan is right; it's small margins. Stay with it.");
  return { tips, plan, counters: cts };
}

const SHORT_ATTR = { serve: 'Serve', ground: 'Ground', ret: 'Return', net: 'Net', stam: 'Stamina', mental: 'Mental', iq: 'IQ' };

// Coach-only: your stats next to theirs (their numbers are your coach's read: close for a tour
// coach, exact for an elite one), with whoever leads each one highlighted.
function coachCompare(me, o, near, exact) {
  const rows = ATTRS.map(([k, label]) => {
    const a = me.attrs[k], b = near(o.attrs[k]), d = a - b;
    const lead = Math.abs(d) < (exact ? 0.5 : 1.5) ? 'even' : d > 0 ? 'you' : 'them';
    return `<tr><td class="${lead === 'you' ? 'lead' : ''}">${a.toFixed(0)}</td><th>${label}</th><td class="${lead === 'them' ? 'lead them' : ''}">${exact ? '' : '~'}${b}</td></tr>`;
  }).join('');
  const ahead = ATTRS.filter(([k]) => me.attrs[k] - near(o.attrs[k]) >= (exact ? 0.5 : 1.5)).length;
  const behind = ATTRS.filter(([k]) => near(o.attrs[k]) - me.attrs[k] >= (exact ? 0.5 : 1.5)).length;
  return `<table class="cmp"><tr><td><b>You</b></td><th></th><td><b>${esc(shortName(o))}</b></td></tr>${rows}` +
    `<tr><td>OVR ${overall(me).toFixed(1)}</td><th></th><td>${exact ? '' : '~'}${overall(o).toFixed(1)}</td></tr></table>` +
    `<p class="hint center">You lead in ${ahead}, they lead in ${behind}.</p>`;
}

function coachHtml(o, ev, me) {
  const c = current.career;
  if (!hasTeam(c, 'coach')) return `<p class="hint coachtease">🧑‍🏫 Hire a coach (Home → Money &amp; Team) to see their game plan and get a counter-plan. Better coaches also read their ratings.</p>`;
  const rec = coachPlan(o, ev, me), mine = planOf(me), theirs = planOf(o);
  const diffs = GAME_PLAN.filter(g => rec[g.key] !== mine[g.key]);
  const lvl = teamLevel(c, 'coach');
  const near = v => lvl >= 3 ? Math.round(v) : Math.round(v / 2) * 2; // a tour coach's read is close; an elite coach's is exact
  return `<div class="coachrep"><h4>🧑‍🏫 ${teamOf(c, 'coach').name}'s report</h4>` +
    (lvl < 2 ? '' : coachCompare(me, o, near, lvl >= 3)) +
    `<p class="hint"><b>Their plan:</b> ${planSummary(theirs)}</p>` +
    (diffs.length
      ? `<p class="hint"><b>Coach says:</b> ${diffs.map(g => `${g.label} → <b>${planLabel(g.key, rec[g.key])}</b>`).join(' · ')}</p>` +
        `<button type="button" class="btn ghost small" id="coachUse">Use the coach's plan</button>`
      : `<p class="hint"><b>Coach says:</b> your plan is spot on for this one.</p>`) + `</div>`;
}
