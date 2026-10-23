// career.js — the long game: money (prize money, travel, your team), body (injuries, age) and seasons
// (an end-of-season review with goals for the next one), plus retirement.

// --- Money ---------------------------------------------------------------------------

const START_MONEY = 6000;
// Winner's cheque per tier; earlier rounds get a share of it (R32 out, R16 out, QF, SF, F, W).
const WIN_CHEQUE = { CLUB: 750, M15: 2160, M25: 3600, CH75: 11000, CH125: 18000, ATP250: 100000, ATP500: 400000, M1000: 1000000, GS: 3000000 };
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
  fitness: { icon: '🏋️', name: 'Fitness Trainer', levels: [
    { name: 'None', cost: 0, desc: 'You manage your own conditioning.' },
    { name: 'Fitness trainer', cost: 600, fatigue: 0.85, desc: 'Matches tire you 15% less, and training weeks without events burn you out more slowly.' }] },
  mental: { icon: '🧘', name: 'Mental Coach', levels: [
    { name: 'None', cost: 0, desc: 'No one to talk you through the big moments.' },
    { name: 'Mental coach', cost: 700, desc: 'Better on big points, and bad days come less often.' }] },
  hitting: { icon: '🎾', name: 'Hitting Partner', levels: [
    { name: 'None', cost: 0, desc: 'You find practice partners on site.' },
    { name: 'Travelling hitting partner', cost: 900, desc: 'A small preparation edge in every match, every week.' }] },
  stringer: { icon: '🧵', name: 'Stringer', levels: [
    { name: 'None', cost: 0, desc: 'Tournament stringing.' },
    { name: 'Dedicated stringer', cost: 250, desc: 'Rackets strung exactly how you like them: a tiny edge, and a few fewer errors.' }] },
  hotel: { icon: '🏨', name: 'Hotel', levels: [
    { name: 'Standard', cost: 0, desc: 'The official players\' hotel.' },
    { name: 'Upgraded hotel', cost: 500, recover: 2, desc: 'A suite near the venue: you recover more between matches.' }] },
  agent: { icon: '💼', name: 'Agent', levels: [
    { name: 'None', cost: 0, desc: 'You handle your own deals.' },
    { name: 'Agent', cost: 0, desc: 'Takes 12% of your sponsor money, but brings bigger offers (about 35% more a week).' }] },
};
// Staff who travel with you to every event (their flights and hotels are added to each trip).
const TRAVELLERS = ['coach', 'physio', 'fitness', 'mental', 'hitting', 'stringer'];
const AGENT_CUT = 0.12, AGENT_BOOST = 1.35;
// Hotel and food for a tournament week. Bigger events put main-draw players up; qualifiers pay their own way.
const LIVING = { CLUB: 0, M15: 350, M25: 400, CH75: 250, CH125: 250, ATP250: 150, ATP500: 150, M1000: 150, GS: 150 };
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
  // Your travelling team: each one's flight (premium economy, or business if you fly business) and hotel.
  const crew = TRAVELLERS.filter(k => ownLevel(c, k) > 0).length;
  const crewCost = crew * (FLIGHTS[t] * (c.business ? 3 : 1.5) + (ev.nation === current.player.nation ? 80 : 150));
  return FLIGHTS[t] * (c.business && !freeJet ? 3 : 1) + living + Math.round(crewCost);
}
// What your travelling team adds to a trip (shown with the trip cost).
const crewTripCost = (c, ev) => { const t = travelDays(c.location || current.player.nation, ev.nation); const crew = TRAVELLERS.filter(k => ownLevel(c, k) > 0).length;
  return Math.round(crew * (FLIGHTS[t] * (c.business ? 3 : 1.5) + (ev.nation === current.player.nation ? 80 : 150))); };
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
const recoveryBoost = c => (teamOf(c, 'physio').recover || 0) + (teamOf(c, 'hotel').recover || 0);

// End of every week: pay your team (they leave if you can't), your sponsors pay you, and
// coaching juniors at home brings in a little when you didn't play an event.
// Staff wages follow your fame: cheap while you're unknown, steep once you're on the ATP Tour
// (a Master coach runs about $8,000 a week in the top 50). The more help you buy, the more it costs.
function staffMult(c) {
  const r = currentRank(c) || 9999;
  return r <= 50 ? 1.6 : r <= 100 ? 1.4 : r <= 200 ? 1.15 : r <= 500 ? 1 : 0.8;
}
const teamCost = (c, k, lv = ownLevel(c, k)) => Math.round(TEAM[k].levels[lv].cost * staffMult(c) / 50) * 50;
const weeklyBill = c => Object.keys(TEAM).reduce((t, k) => t + (c.perks && c.perks[k] && c.perks[k].weeks > 0 ? 0 : teamCost(c, k)), 0);

function weeklyMoney(c) {
  const pk = c.perks || {};
  for (const k of Object.keys(TEAM)) {
    // Covered by a free perk this week: nothing to pay.
    if (pk[k] && pk[k].weeks > 0) { pk[k].weeks--; continue; }
    const t = TEAM[k].levels[ownLevel(c, k)], cost = teamCost(c, k);
    if (!cost) continue;
    if ((c.money ?? 0) >= cost) charge(c, cost, `${t.name} (weekly)`);
    else { c.team[k] = 0; c.notice = `You couldn't pay your ${t.name.toLowerCase()}, so they left.`; }
  }
  payDeals(c);
  maybeOffer(c);
  // Running out of money: a heads-up while there's still time to downsize.
  const bill = weeklyBill(c);
  if (bill > 0 && c.money < bill * 3 && !c.notice) c.notice = `💸 Your team costs ${money(bill)} a week and you have ${money(c.money)} left: about ${Math.max(0, Math.floor(c.money / bill))} week${Math.floor(c.money / bill) === 1 ? '' : 's'} of wages. Win some prize money or downgrade your team (Home → Money & Team).`;
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

// Go home for a week: fly home (your team comes too), skip the tournaments, rest with family. Resets the weeks on
// the road, and you come back fresher and in better spirits for a couple of weeks.
function goHomeCost(c, p) {
  const t = travelDays(c.location || p.nation, p.nation), freeJet = c.perks && c.perks.jet && c.perks.jet.weeks > 0;
  const crew = TRAVELLERS.filter(k => ownLevel(c, k) > 0).length;
  return Math.round(FLIGHTS[t] * (c.business && !freeJet ? 3 : 1) + crew * FLIGHTS[t] * (c.business ? 3 : 1.5) + 100);
}
function goHomeHtml(c, p) {
  if ((c.location || p.nation) === p.nation) return '';
  const away = c.awayWeeks || 0, cost = goHomeCost(c, p);
  return `<div class="gohome"><div><b>🏠 Go Home This Week</b><small>${away ? `${away} week${away === 1 ? '' : 's'} on the road. ` : ''}Fly home to ${flagOf(p.nation)} ${nationInfo(p.nation)[2]}, skip this week's tournaments and rest with family. Resets your weeks on the road and lifts your spirits. Flights: ${money(cost)}.</small></div>` +
    `<button type="button" class="btn small" id="goHome" ${c.money < cost ? 'disabled' : ''}>Go Home</button></div>`;
}
function goHomeWeek() {
  const c = current.career, p = current.player;
  charge(c, goHomeCost(c, p), 'Flight home');
  const trip = travelFatigue(c, c.location || p.nation, p.nation); // the flight tires you a little; the week at home more than makes up for it
  c.location = p.nation;
  c.homeBoost = c.week + 1; // a lift for the next couple of weeks (morale.js)
  p.fatigue = clamp((p.fatigue || 0) + trip - 35, 0, 100);
  c.notice = `🏠 A week at home with family. You're rested and the road weariness is gone.`;
  writeJSON(SAVE_KEY, p);
  writeJSON(CAREER_KEY, c);
  advanceWeek();
}

// Local club tournament: when no tour event this week is affordable, a real event at your local club. It plays like
// any other tournament (the draw, live matches, Match Reads), with a small prize and no ranking points.
function clubEvent(c, p) {
  const nation = c.location || p.nation;
  return { id: `club-w${c.week}`, week: c.week, tier: 'CLUB', city: 'Local Club', nation, surface: p.fav || 'hard', indoor: false };
}
function clubHtml(c, p, evs, rank) {
  const canGo = evs.some(e => { const el = eligibility(e, rank); return el !== 'locked' && tripCost(c, e, el) <= c.money; });
  if (canGo) return '';
  return `<div class="gohome"><div><b>🎾 Local Club Tournament</b><small>No tour event you can afford this week? Play the local club's tournament: a full draw, ` +
    `played like any other event, with a prize of up to ${money(WIN_CHEQUE.CLUB)} and no ranking points. It keeps you match-sharp and earns Match Reads experience.</small></div>` +
    `<button type="button" class="btn small" id="clubGo">Enter</button></div>`;
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
  p.playstyle = styleOf(p).name;
  return overall(p) - before;
}

// --- Seasons and goals -------------------------------------------------------------------

const TITLE_LADDER = ['M15', 'M25', 'CH75', 'CH125', 'ATP250', 'ATP500', 'M1000', 'GS'];
const niceRank = r => r > 500 ? Math.round(r / 100) * 100 : r > 100 ? Math.round(r / 50) * 50 : r > 20 ? Math.round(r / 10) * 10 : Math.max(1, Math.round(r / 5) * 5);

function seasonStats(c, season) {
  const hs = c.history.filter(h => seasonOfWeek(h.week) === season);
  const wins = hs.reduce((a, h) => a + h.matches.filter(m => m.won).length, 0);
  const losses = hs.reduce((a, h) => a + h.matches.filter(m => !m.won).length, 0);
  const titles = hs.filter(h => h.reached === 'W' && !h.club); // club wins aren't tour titles
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
  p.playstyle = styleOf(p).name;
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
  // How you looked after yourself nudges when your game blooms: a top coach brings it forward, injuries push it back.
  const bloom = bloomOf(c);
  c.bloom = clamp(bloom + (c.injuriesThisSeason >= 2 ? 0.3 : 0) - (teamLevel(c, 'coach') >= 3 ? 0.25 : 0), BLOOM_MIN - 0.5, BLOOM_MAX + 1);
  const ageDelta = agePlayer(p);
  review.age = p.age; review.ageDelta = ageDelta; review.phase = maturityPhase(p.age, c.bloom);
  c.seasons = [...(c.seasons || []), review];
  c.goals = makeGoals(c, p);
  c.goalSeason = seasonOfWeek(c.week);
  c.injuriesThisSeason = 0;
  if (c.rebuild && c.rebuild.off) c.rebuild = null; // an off-season rebuild is always settled by the new season
  c.seasonStart = { ovr: overall(p), rank: currentRank(c), age: p.age, rivals: rivalsNow };
  c.pendingReview = true;
  if (p.age >= RETIRE_FORCED) c.forcedRetire = true;
  writeJSON(SAVE_KEY, p);
}

// A hint about where you are in your career arc, never the number itself.
function maturityPhase(age, bloom) {
  if (age < bloom - 3) return 'Your game is still maturing. The best years are ahead of you: keep building.';
  if (age < bloom) return 'Something is starting to click. Your coach thinks your prime is close.';
  if (age <= bloom + 2) return "You're in your prime. This is your window.";
  return 'Experience is your weapon now: you know how to win.';
}
function openSeasonReview(c) {
  const r = c.seasons[c.seasons.length - 1];
  c.pendingReview = false;
  writeJSON(CAREER_KEY, c);
  const tile = (label, value, sub = '') => `<div class="rcell"><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  const met = r.goals.filter(g => g.done).length;
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<h2 class="itop">Season ${r.season} Review</h2>` +
    `<div class="ovrexp review">` +
      tile('Ranking', rankText(r.rankEnd), r.rankStart ? `started ${rankText(r.rankStart)}` : 'started unranked') +
      tile('Record', `${r.wins}–${r.losses}`, `${r.events} events`) +
      tile('Titles', r.titles.length, r.titles.slice(0, 2).join(', ')) +
      tile('Prize Money', money(r.prize), `bank ${money(r.money)}`) +
      tile('OVR', r.ovrEnd.toFixed(1), `${r.ovrEnd >= r.ovrStart ? '+' : ''}${(r.ovrEnd - r.ovrStart).toFixed(1)} this season`) +
      tile('Rivals', r.rivals, r.rivalsNew > 0 ? `${r.rivalsNew} new` : '') +
    `</div>` +
    (r.best ? `<p class="big center">Best Result: <b>${esc(r.best)}</b></p>` : '') +
    `<h3 class="ssec">Goals: ${met} of ${r.goals.length} met</h3><ul class="goals">${r.goals.map(g => `<li>${g.done ? '✅' : '❌'} ${g.text}</li>`).join('')}</ul>` +
    `<h3 class="ssec">Season ${r.season + 1} Goals</h3><ul class="goals">${c.goals.map(g => `<li>🎯 ${g.text}<small class="grew">🎁 ${g.rtext}</small></li>`).join('')}</ul>` +
    (r.phase ? `<p class="big center">🌱 ${r.phase}</p>` : '') +
    `<p class="hint center">You're now ${r.age}.${Math.abs(r.ageDelta) >= 0.05 ? ` Your body ${r.ageDelta > 0 ? 'filled out a little' : 'is starting to slow down'} (OVR ${r.ageDelta > 0 ? '+' : ''}${r.ageDelta.toFixed(1)}).` : ''}` +
      `${c.forcedRetire ? ' At this age it is time to hang up the racket.' : ''}</p>` +
    `<button type="button" class="btn" id="srGo">${c.forcedRetire ? 'Retire' : `Start Season ${r.season + 1}`}</button>`,
    { wide: true, onClose: () => { if (c.forcedRetire) retire(); } });
  $('mx').onclick = closeModal;
  $('srGo').onclick = closeModal;
}

// --- Rebuild Camp ------------------------------------------------------------------------
// Move your stat points into a different build. Same points (your OVR can't go up this way: stats that count more cost
// more). Mid-season (REBUILDS_PER_SEASON a season) you first sit out CAMP_WEEKS weeks at a camp, then the new game
// takes REBUILD_WEEKS weeks to bed in. In the off-season there's one free rebuild that beds in over OFF_REBUILD_WEEKS
// weeks and is always settled by the first week of the new season, so it never costs you a match.
const REBUILD_WEEKS = 6, OFF_REBUILD_WEEKS = 3, CAMP_WEEKS = 3, RESPEC_MIN = 30;
const offRebuildOpen = c => isOffSeason(c.week) && c.offRebuild !== seasonOfWeek(c.week);
const REBUILDS_PER_SEASON = 2;
// Rebuilds left this season (older saves stored just the season of their one rebuild).
const rebuildsLeft = c => { const r = c.respecUsed, season = seasonOfWeek(c.week);
  const used = r && typeof r === 'object' ? (r.season === season ? r.n : 0) : r === season ? 1 : 0; return Math.max(0, REBUILDS_PER_SEASON - used); };
const canRespec = c => (rebuildsLeft(c) > 0 || offRebuildOpen(c)) && !(c.camp && c.camp.weeks > 0) && !c.injury && !current.entry;
const rebuildPen = c => c && c.rebuild && c.rebuild.weeks > 0 ? 0.03 * c.rebuild.weeks / (c.rebuild.total || REBUILD_WEEKS) : 0;
function openRespec(c, p, draft = null, opts = {}) {
  const orig = { ...p.attrs }, d = draft || { ...orig };
  // Stats that count more toward OVR cost more to raise and give back more when lowered, so your OVR stays put.
  const avgW = OVR_TOTAL / ATTR_KEYS.length, cost = k => OVR_WEIGHTS[k] / avgW;
  const left = Math.round(ATTR_KEYS.reduce((a, k) => a + cost(k) * (orig[k] - d[k]), 0) * 100) / 100;
  const minCost = Math.min(...ATTR_KEYS.map(cost));
  const ovr0 = overall({ attrs: orig }), ovr1 = overall({ attrs: d });
  const changed = ATTR_KEYS.some(k => Math.abs(d[k] - orig[k]) > 0.001);
  const row = ([k, label]) => `<div class="rsrow"><span>${label}<small>${cost(k).toFixed(1)} pts each</small></span>` +
    `<button type="button" class="btn ghost" data-k="${k}" data-d="-1" ${d[k] - 1 < RESPEC_MIN ? 'disabled' : ''} aria-label="Lower ${label}">−</button>` +
    `<b class="${d[k] > orig[k] + 0.001 ? 'up' : d[k] < orig[k] - 0.001 ? 'down' : ''}">${Math.round(d[k])}</b>` +
    `<button type="button" class="btn ghost" data-k="${k}" data-d="1" ${left < cost(k) - 0.001 || d[k] + 1 > STAT_CAP ? 'disabled' : ''} aria-label="Raise ${label}">+</button></div>`;
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button><h2 class="itop">🔁 Rebuild My Game</h2>` +
    `<p class="hint center">Lower one part of your game to free up points, then put them somewhere else. Stats that matter more cost more, so your OVR stays the same.</p>` +
    `<div class="rsinfo"><div><b>${left.toFixed(1)}</b><small>Points To Place</small></div><div><b>${ovr1.toFixed(1)}</b><small>OVR (Was ${ovr0.toFixed(1)})</small></div>` +
    `<div><b>${esc(styleOf({ ...p, attrs: d, plan: { ...(p.plan || {}), ...(opts.plan || {}) } }).name)}</b><small>New Playstyle</small></div></div>` +
    (opts.plan && Object.keys(opts.plan).length ? `<p class="hint center">📋 This style also sets your game plan: ${Object.entries(opts.plan).map(([k, v]) => planLabel(k, v)).join(', ')}.</p>` : '') +
    `<div class="rsrows">${ATTRS.map(row).join('')}</div>` +
    `<button type="button" class="btn ghost" id="rsPreview">🎬 Preview Playstyles</button>` +
    respecStylesHtml({ ...p, plan: { ...(p.plan || {}), ...(opts.plan || {}) } }, d) +
    (left >= minCost - 0.001 ? `<p class="hint center">Place your points before locking in.</p>` : '') +
    `<button type="button" class="btn" id="rsGo" ${!changed || left >= minCost - 0.001 ? 'disabled' : ''}>Lock In New Build</button>` +
    `<button type="button" class="link" id="rsBack">‹ Keep My Current Build</button>`, { wide: true, onClose: () => renderTournaments(current.player) });
  $('mx').onclick = closeModal;
  $('rsBack').onclick = closeModal;
  // Preview a playstyle on court, then come straight back to this rebuild (nothing locked in).
  $('sheet').querySelectorAll('[data-style]').forEach(b => { b.onclick = () => openRespec(c, p, autoBuild(p, orig, b.dataset.style), { ...opts, plan: stylePlanBits(b.dataset.style) }); });
  $('rsPreview').onclick = () => { modalClose = null; openStylePreview(p, d, styleOf({ ...p, attrs: d }).name, () => setTimeout(() => openRespec(c, p, d, opts), 0)); };
  $('sheet').querySelectorAll('[data-k]').forEach(b => { b.onclick = () => {
    const k = b.dataset.k, step = +b.dataset.d;
    d[k] = Math.round((d[k] + step) * 1000) / 1000;
    openRespec(c, p, d, opts);
  }; });
  $('rsGo').onclick = () => {
    if (!$('rsConfirm')) { respecConfirm(opts, () => $('rsGo').click()); return; }
    $('rsConfirm').remove();
    p.attrs = { ...d };
    if (opts.plan) p.plan = { ...(p.plan || {}), ...opts.plan };
    p.playstyle = styleOf(p).name;
    if (opts.off) { c.rebuild = { weeks: OFF_REBUILD_WEEKS, total: OFF_REBUILD_WEEKS, off: true }; c.offRebuild = seasonOfWeek(c.week); }
    else {
      c.rebuild = { weeks: REBUILD_WEEKS };
      c.respecUsed = { season: seasonOfWeek(c.week), n: REBUILDS_PER_SEASON - rebuildsLeft(c) + 1 };
      c.camp = { weeks: CAMP_WEEKS };
    }
    writeJSON(SAVE_KEY, p);
    writeJSON(CAREER_KEY, c);
    closeModal();
    toast(opts.off ? `🔁 New build locked in: ${p.playstyle}. It'll be settled before the new season starts.`
      : `🔁 Off to Rebuild Camp: ${CAMP_WEEKS} weeks to learn your new ${p.playstyle} game.`);
  };
}
// Start of the off-season: the free rebuild, offered once.
function openOffRebuildPrompt(c, p) {
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button><h2 class="itop">🔁 Off-Season Rebuild</h2>` +
    `<p class="big center">The season's over. Want to try a new build for next year?</p>` +
    `<p class="hint center">It's free in the off-season: no camp, and it settles in over ${OFF_REBUILD_WEEKS} weeks, so you're fully ready for your first match of the new season. You can do it any time before the season starts, from Home.</p>` +
    `<div class="pbtns"><button type="button" class="btn ghost" id="opLater">Not Now</button><button type="button" class="btn" id="opGo">🔁 Rebuild My Game</button></div>`, { wide: true });
  $('mx').onclick = closeModal; $('opLater').onclick = closeModal;
  $('opGo').onclick = () => { modalClose = null; openRespec(c, p, null, { off: true }); };
}

// "Are you sure?" on top of the rebuild window, spelling out what the rebuild costs.
function respecConfirm(opts, yes) {
  const box = document.createElement('div');
  box.id = 'rsConfirm'; box.className = 'rsconfirm';
  box.innerHTML = `<div class="rscard" role="dialog" aria-modal="true"><h3>⚠️ Are You Sure?</h3>` +
    (opts.off
      ? `<p>This is your <b>free off-season rebuild</b>. No camp, and your new build beds in over <b>${OFF_REBUILD_WEEKS} weeks</b> of the off-season, so it's settled before your first match of the new season.</p>`
      : `<p>A mid-season rebuild means <b>${CAMP_WEEKS} weeks out of tournaments</b> at a Rebuild Camp.</p><p>After that, your new build takes <b>${REBUILD_WEEKS} more weeks</b> to bed in, playing a little below your best.</p>`) +
    (opts.off ? `<p>It doesn't count toward your ${REBUILDS_PER_SEASON} mid-season rebuilds.</p>`
      : `<p>You get ${REBUILDS_PER_SEASON} rebuilds per season. ${rebuildsLeft(current.career) === 1 ? 'This is your last one this season.' : `After this you'll have ${rebuildsLeft(current.career) - 1} left.`}</p>`) +
    `<div class="pbtns"><button type="button" class="btn ghost" id="rsNo">No, Go Back</button><button type="button" class="btn" id="rsYes">Yes, Rebuild</button></div></div>`;
  document.body.appendChild(box);
  $('rsNo').onclick = () => box.remove();
  box.onclick = e => { if (e.target === box) box.remove(); };
  $('rsYes').onclick = yes;
}

// One button per playstyle: tap one and your points are shaped into that build automatically.
function respecStylesHtml(p, d) {
  const cur = styleOf({ ...p, attrs: d }).name;
  return `<p class="tbshead rsshead">Build Me A Playstyle</p><p class="hint center">Tap a style and your points are shaped into it. You can still fine-tune with − and + after.</p>` +
    `<div class="rsstylebtns">${STYLES.map(s => `<button type="button" class="btn ghost ${s.name === cur ? 'on' : ''}" data-style="${esc(s.name)}">${esc(s.name)}</button>`).join('')}</div>`;
}
// Shape the same points into a playstyle: its key stats go up first (to the cap if the points allow), everything else
// gets a sensible share that suits the style, nothing drops below RESPEC_MIN, and the OVR stays the same.
function autoBuild(p, orig, styleName) {
  const st = STYLES.find(x => x.name === styleName), avgW = OVR_TOTAL / ATTR_KEYS.length, cost = k => OVR_WEIGHTS[k] / avgW;
  const budget = ATTR_KEYS.reduce((a, k) => a + cost(k) * orig[k], 0);
  const w = st && st.w ? st.w : ATTR_KEYS.map(() => 0);
  const shape = (spread) => {
    const at = L => Object.fromEntries(ATTR_KEYS.map((k, i) => [k, clamp(L + spread * w[i], RESPEC_MIN, STAT_CAP)]));
    let lo = 0, hi = 120;
    for (let n = 0; n < 50; n++) { const mid = (lo + hi) / 2, a = at(mid); (ATTR_KEYS.reduce((x, k) => x + cost(k) * a[k], 0) > budget ? hi = mid : lo = mid); }
    const a = at(lo);
    return Object.fromEntries(ATTR_KEYS.map(k => [k, Math.round(a[k] * 1000) / 1000]));
  };
  // Start gentle and widen the gap between key and other stats only as far as it takes to land on the style
  // (with the game plan that style plays: patient, topspin or flat, see stylePlanBits).
  const plan = { ...(p.plan || {}), ...stylePlanBits(styleName) };
  let best = shape(5);
  for (const spread of [5, 6, 7, 8, 10, 12]) { const a = shape(spread); best = a; if (styleOf({ ...p, attrs: a, plan }).name === styleName) break; }
  return best;
}
// Some playstyles are as much a way of playing as a set of stats: these are the game plan settings they need.
const stylePlanBits = name => { const st = STYLES.find(x => x.name === name) || {}; return { ...(st.agg ? { aggression: st.agg } : {}), ...(st.spin ? { spin: st.spin } : {}) }; };

// A week at Rebuild Camp: no events, training the new game, plenty of rest.
function campWeek() {
  const c = current.career, p = current.player;
  p.fatigue = clamp((p.fatigue || 0) - 25, 0, 100);
  c.camp.weeks--;
  if (c.camp.weeks <= 0) { c.notice = `🔁 Rebuild Camp is done. Your new ${p.playstyle} game needs ${REBUILD_WEEKS} weeks of matches to bed in.`; c.camp = null; }
  writeJSON(SAVE_KEY, p);
  writeJSON(CAREER_KEY, c);
  advanceWeek();
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
    tile('Record', `${wins}–${losses}`) + tile('Prize Money', money(prize)) + tile('Seasons', seasonOfWeek(c.week)) + tile('Peak OVR', (c.peakOvr || overall(p)).toFixed(1)) + `</div>` +
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
  const bill = weeklyBill(c), runway = bill ? Math.floor(c.money / bill) : null;
  $('hTeam').innerHTML = `<div class="moneyline"><b>${money(c.money)}</b><span>in the bank</span></div>` +
    (bill ? `<p class="hint ${runway < 4 ? 'warnline' : ''}">Team wages: <b>${money(bill)}/week</b> · enough for ${runway} week${runway === 1 ? '' : 's'} without prize money.${staffMult(c) > 1 ? ' Staff charge more the higher you are ranked.' : ''}</p>` : '') +
    (() => {
    const row = ([k, t]) => {
      const lv = teamLevel(c, k), cur = t.levels[lv], pk = c.perks && c.perks[k];
      const free = pk && pk.weeks > 0 && pk.level > ownLevel(c, k) ? pk : null;
      return `<div class="teamrow"><span class="ticon">${t.icon}</span><div class="teammain"><b>${t.name}: ${cur.name}${free ? ` · free for ${free.weeks} more week${free.weeks === 1 ? '' : 's'} 🎁` : teamCost(c, k, lv) ? ` · ${money(teamCost(c, k, lv))}/week` : ''}</b><small>${cur.desc}</small>` +
        `<div class="seg" style="grid-template-columns:repeat(${t.levels.length},1fr)" data-team="${k}">${t.levels.map((l, i) =>
          `<button type="button" data-lv="${i}" class="${i === lv ? 'on' : ''}">${l.name.replace(/ (coach|team)$/, '')}${free && i === free.level ? '<small>Free 🎁</small>' : l.cost ? `<small>${money(teamCost(c, k, i))}</small>` : ''}</button>`).join('')}</div>` +
        (free ? `<small class="hint">A season-goal reward. Tap another option to give it up and pick your own.</small>` : '') + `</div></div>`;
    };
    const core = ['coach', 'physio'], extra = Object.entries(TEAM).filter(([k]) => !core.includes(k)), hired = extra.filter(([k]) => ownLevel(c, k) > 0).length;
    const crew = TRAVELLERS.filter(k => ownLevel(c, k) > 0).length;
    return `<div class="team">${core.map(k => row([k, TEAM[k]])).join('')}` +
      `<details class="teamextra" ${foldOpen('h-staff') ? 'open' : ''} data-fold="h-staff"><summary><b>More Staff & Upgrades</b><small>${hired ? `${hired} hired` : 'Fitness, mental coach, hitting partner, stringer, hotel, agent'}</small></summary>${extra.map(row).join('')}</details>` +
      (crew ? `<p class="hint">🧳 Your travelling team (${crew}) flies and stays with you: about ${money(crew * (FLIGHTS[2] * (c.business ? 3 : 1.5) + 150))} extra on a long-haul trip, added to each trip's cost.</p>` : '');
    })() +
    `<button type="button" class="bizcard ${c.business ? 'on' : ''}" id="hBiz" aria-pressed="${!!c.business}"><span class="bzicon">✈️</span>` +
    `<span class="bzmain"><b>Fly Business Class</b><small>Flights cost 3× as much, but long trips tire you half as much.</small>` +
    `<em>${c.business ? 'On: travelling in comfort' : 'Off: flying economy'}</em></span><span class="bztoggle" aria-hidden="true"></span></button>` +
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
  $('hBiz').onclick = () => { c.business = !c.business; writeJSON(CAREER_KEY, c); renderTournaments(p); };
  if ($('hRetire')) $('hRetire').onclick = () => { if (confirm(`Retire ${p.name} for good? This ends the career.`)) retire(); };
  if (window.saveFailed) c.notice = "⚠️ Your browser's storage is full, so progress may not be saving. Save a copy (Back up or move my career), then delete old saved careers.";
  if (c.notice) { $('hNotice').textContent = c.notice; $('hNotice').hidden = false; c.notice = null; writeJSON(CAREER_KEY, c); }
  else $('hNotice').hidden = true;
  if (c.pendingReview && c.seasons && c.seasons.length) setTimeout(() => openSeasonReview(c), 50);
  // The off-season has started: offer the free rebuild once.
  else if (c.offPrompt === seasonOfWeek(c.week) && offRebuildOpen(c) && !current.entry) { c.offPrompt = null; writeJSON(CAREER_KEY, c); setTimeout(() => openOffRebuildPrompt(c, p), 50); }
  else if (c.offer && !c.offer.shown) { c.offer.shown = true; writeJSON(CAREER_KEY, c); setTimeout(() => openOffer(c), 300); }

  const box = $('events');
  if (c.retired) {
    $('eventsTitle').textContent = 'Retired';
    box.innerHTML = careerSummaryHtml(c, p) + `<button type="button" class="btn" id="hNew">Start a new career</button>`;
    $('hNew').onclick = newCareer;
    return true;
  }
  if (c.camp && c.camp.weeks > 0 && !current.entry) {
    $('eventsTitle').textContent = `Week ${weekInSeason(c.week)} · ${monthOf(c.week)} — Rebuild Camp`;
    box.innerHTML = `<div class="event row-ev"><div><div class="ev-city">🔁 Rebuild Camp</div>` +
      `<div class="ev-meta">Learning your new ${esc(p.playstyle || styleOf(p).name)} game. ${c.camp.weeks} week${c.camp.weeks === 1 ? '' : 's'} to go, no tournaments.</div></div>` +
      `<button type="button" class="btn small" id="hCamp">Camp Week</button></div>`;
    $('hCamp').onclick = campWeek;
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
// What the coach passes on: the opponent's reads (see matchReads in sim.js), limited to the settings your coach has unlocked.
function coachReads(o, ev, me) {
  const lv = typeof teamLevel === 'function' ? teamLevel(current.career, 'coach') : 0;
  return matchReads(o, ev).filter(x => { const gp = GAME_PLAN.find(q => q.key === x.key); return !gp || !gp.coach || lv >= gp.coach; });
}
// How many reads each coach level gives: none without a coach, one from a club coach, all from the Master.
const COACH_READS = [0, 1, 3, 5, 99];
function coachPlan(o, ev, me) {
  const n = COACH_READS[typeof teamLevel === 'function' ? teamLevel(current.career, 'coach') : 0] || 0;
  const rec = { ...DEFAULT_PLAN, ...planOf(me), ...Object.fromEntries(coachReads(o, ev, me).slice(0, n).map(x => [x.key, x.val])) };
  // Any coach weighs up your signature play for this opponent and these conditions.
  const st = styleOf(me).name;
  if (n && SIGNATURE[st]) rec.sig = sigWorth(st, { ...me, plan: { ...planOf(me), sig: 'on' } }, o, ev) > 0.002 ? 'on' : 'off';
  return rec;
}
// Roughly what your signature play is worth against this opponent (rally edge plus the serve-and-return ones).
function sigWorth(st, me, o, ev) {
  const m0 = { styles: [st, styleOf(o).name], sets: [], exec: [1, 1] };
  const serveOnes = { 'Serve +1 Attacker': 0.008, 'First-Strike Attacker': o.attrs.serve >= me.attrs.ret + 6 ? -0.004 : 0.007,
    'Serve-and-Volley': o.attrs.serve >= me.attrs.ret + 6 ? -0.003 : 0.006, 'Serve-Dominant': me.attrs.serve >= 78 ? 0.006 : -0.004 };
  return sigRally(m0, [me, o], 0, ev) + (serveOnes[st] || 0);
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
    wing: [{ short: `Hit To Their ${other === 'bh' ? 'Backhand' : 'Forehand'}`, label: `Switch to their ${other === 'bh' ? 'backhand' : 'forehand'} and catch them out of position`, plan: { wing: other } },
      { short: 'Neutral & Deep', label: 'Go back to neutral and drive deep through the middle', plan: { wing: 'neutral', depth: 'deep' } }],
    aggression: [{ short: 'Be Patient', label: 'Be patient: make them hit one more ball', plan: { aggression: 'patient' } },
      { short: 'Finish At The Net', label: 'Come forward and finish points at the net', plan: { net: 'often' } }],
    serve: [{ short: 'Safer Serve', label: 'Serve safer and mix up the placement', plan: { serve: 'balanced' } },
      { short: 'Serve And Volley', label: 'Follow the serve in and rush them', plan: { net: 'often' } }],
    net: [{ short: 'Stay Back', label: 'Stay back and rally', plan: { net: 'rarely' } },
      { short: 'Deeper Approaches', label: 'Approach off deeper, heavier balls', plan: { spin: 'topspin', depth: 'deep' } }],
    depth: [{ short: 'Drive Flat & Deep', label: 'Drive it deep and flat instead', plan: { depth: 'deep', spin: 'flat' } },
      { short: 'Drop Shot Them', label: 'Drop shot them when they step in', plan: { drops: 'often' } }],
    spin: [{ short: 'Heavy Topspin', label: 'Use heavy topspin to get the ball up high', plan: { spin: 'topspin' } },
      { short: 'Attack Earlier', label: 'Shorten the points: attack earlier', plan: { aggression: 'aggressive' } }],
    drops: [{ short: 'Save The Drops', label: 'Save the drop shot for the big moments', plan: { drops: 'rarely' } },
      { short: 'Deep, Then Drop', label: 'Push them deep first, then drop', plan: { depth: 'deep' } }],
    sig: [{ short: 'Switch It Off', label: 'Switch your signature play off for now and win some other way', plan: { sig: 'off' } },
      { short: 'Change The Rhythm', label: 'Keep the signature, but change the rhythm around it', plan: { aggression: cur.aggression === 'aggressive' ? 'balanced' : 'aggressive' } }],
    returnPos: [{ short: 'Normal Return', label: 'Step back to a normal return position', plan: { returnPos: 'normal' } },
      { short: 'Deep Return', label: 'Stand deep and start the rally neutral', plan: { returnPos: 'deep' } }],
  })[key] || [{ short: 'Switch Rally Style', label: 'Change the rhythm: switch your rally style', plan: { aggression: cur.aggression === 'aggressive' ? 'patient' : 'aggressive' } },
    { short: 'Topspin & Margin', label: 'Change the shape: heavier topspin and more margin', plan: { spin: 'topspin', depth: 'high' } }];
}
// The latest adjustment the opponent made against you this match, if any.
const lastAdapt = (m, me) => (m.adapted || []).filter(a => a.against === me).slice(-1)[0] || null;

// This season's numbers (every match played this season): win rate, dominance ratio, hold %, break %,
// return points won % and total points won %. Returns null before the first match.
function seasonNumbers(c, season = seasonOfWeek(c.week)) {
  const recs = [...c.history.filter(h => seasonOfWeek(h.week) === season).flatMap(h => h.matches || []),
    ...((current.entry && seasonOfWeek(c.week) === season && current.entry.matches) || [])].filter(r => r.stats && r.oppStats);
  if (!recs.length) return null;
  let w = 0, pts = 0, oppPts = 0, sp = 0, spw = 0, rp = 0, rpw = 0, sg = 0, held = 0, rg = 0, brk = 0;
  for (const r of recs) {
    const Y = r.stats, T = r.oppStats;
    if (r.won) w++;
    pts += Y.points || 0; oppPts += T.points || 0;
    sp += Y.servePts || 0; spw += (Y.firstWon || 0) + (Y.secondWon || 0);
    rp += T.servePts || 0; rpw += (T.servePts || 0) - (T.firstWon || 0) - (T.secondWon || 0);
    sg += Y.svcGames || 0; held += Y.svcHeld || 0; rg += T.svcGames || 0; brk += (T.svcGames || 0) - (T.svcHeld || 0);
  }
  const pc = (a, b) => (b ? a / b : 0);
  const rpwPct = pc(rpw, rp), spLost = 1 - pc(spw, sp);
  return { matches: recs.length, wins: w, winRate: pc(w, recs.length), dominance: spLost ? rpwPct / spLost : 0,
    hold: pc(held, sg), brk: pc(brk, rg), returnWon: rpwPct, pointsWon: pc(pts, pts + oppPts) };
}
const SEASON_STATS = [['winRate', 'Win Rate', 'pct'], ['dominance', 'Dominance Ratio', 'ratio'], ['hold', 'Hold %', 'pct'],
  ['brk', 'Break %', 'pct'], ['returnWon', 'Return Pts Won', 'pct'], ['pointsWon', 'Total Pts Won', 'pct']];
const fmtStat = (v, kind) => kind === 'ratio' ? v.toFixed(2) : `${(v * 100).toFixed(1)}%`;

// One-line summaries on Home's fold-out sections.
function homeSums(c, p) {
  const set = (id, t) => { const el = $(id); if (el) el.textContent = t; };
  const goals = c.goals && c.goals.list ? c.goals.list : (c.goals || []);
  const done = Array.isArray(goals) ? goals.filter(g => g.done || g.claimed).length : 0, rank = currentRank(c);
  set('sumSeason', `Season ${seasonOfWeek(c.week)} · ${rank ? `#${rank}` : 'Unranked'}${Array.isArray(goals) && goals.length ? ` · ${done} of ${goals.length} goals done` : ''}`);
  const bill = typeof weeklyBill === 'function' ? weeklyBill(c) : 0;
  set('sumTeam', `${money(c.money)} in the bank${bill ? ` · wages ${money(bill)}/week` : ''}${activeDeals(c).length ? ` · ${activeDeals(c).length} sponsor${activeDeals(c).length === 1 ? '' : 's'}` : ''}`);
  set('sumBadges', `${BADGES.filter(b => (c.badges || {})[b.id]).length} of ${BADGES.length} earned`);
  renderCoachBits(c, p);
  // Hitting a ceiling: tell them once a season (and the training screens step aside, see training.js).
  { const b = growthBlock(c, p), key = `${seasonOfWeek(c.week)}:${b ? (b.byAge ? 'a' : '') + (b.byTac ? 't' : '') : ''}`;
    if (b && c.capNote !== key && !c.notice) { c.capNote = key; c.notice = `🧱 You've reached your current ceiling. ${b.text} Training won't add anything until then.`; writeJSON(CAREER_KEY, c); } }
  if ($('hModeSwitch')) $('hModeSwitch').innerHTML = modeSwitchHtml('home');
  { const el = $('hPlanBook'); if (el) el.innerHTML = pbHomeHtml(c);
    const n = Object.keys(c.planBook || {}).length; set('sumPlanBook', n ? `${n} playstyle${n === 1 ? '' : 's'} faced` : 'Fills up as you play'); }
  const riv = Object.keys(h2hOf(c)).filter(id => isRival(c, id)).length, met = Object.keys(h2hOf(c)).length;
  set('sumRivals', `${riv} rival${riv === 1 ? '' : 's'} · ${met} player${met === 1 ? '' : 's'} met`);
  set('sumPlan', planSummary(planOf(p)).split(' · ').slice(0, 3).join(' · '));
  const all = c.history.flatMap(h => h.matches || []), w = all.filter(m => m.won).length;
  set('sumHistory', all.length ? `${w}–${all.length - w} career record` : 'No matches yet');
}

// Master coach, mid-match: reads how the match is actually going and suggests changes, with the reasons.
// Returns { tips: [text], plan: {changes} }.
// The coach's read at a break: what's actually happening and why, with changes to make. Better coaches see more
// and explain more: Club (1) a single read; Tour (2) one change with the numbers behind it; Elite (3) two changes
// plus an answer to any adjustment they've made; Master (4) up to three, the advanced plan, and two answers.
function liveAdvice(m, ps, me, ev, lv = 4) {
  const op = 1 - me, Y = m.stats[me], T = m.stats[op], A = ps[me], O = ps[op], cur = planOf(A), on = shortName(O);
  const tips = [], plan = {};
  const pct = (a, b) => (b ? a / b : 0), P = x => `${Math.round(x * 100)}%`;
  const usable = k => { const g = GAME_PLAN.find(q => q.key === k); return !g || !g.coach || lv >= g.coach; };
  const max = [0, 1, 1, 2, 3][lv] || 0;
  const set = (k, v, why) => { if (tips.length < max && usable(k) && cur[k] !== v && plan[k] === undefined) { plan[k] = v; tips.push(why); } };
  const note = why => { if (tips.length < max) tips.push(why); };
  const totalPts = Y.points + T.points, myShare = pct(Y.points, totalPts);
  // Their adjustment, read against what has actually happened since: it may be hurting you, or not yet.
  const ad = lastAdapt(m, me);
  let cts = [];
  if (ad) {
    const since = totalPts - (ad.at || 0), wonSince = Y.points - (ad.wonAt || 0), shareSince = since >= 6 ? wonSince / since : null;
    const before = (ad.at || 0) ? (ad.wonAt || 0) / ad.at : null;
    const hurting = shareSince !== null && before !== null && shareSince < before - 0.05;
    const what = `${on} ${ad.label}`;
    const read = shareSince === null ? `${what}. It's only just happened, so watch whether it starts costing you.`
      : hurting ? `${what}, and it's working: you're winning ${P(shareSince)} of points since, down from ${P(before)}.`
      : `${what}, but it hasn't hurt you yet (${P(shareSince)} of points since). Stay with your plan and keep an eye on it.`;
    if (hurting || shareSince === null || lv >= 3) {
      cts = lv >= 3 && hurting ? counters(ad.key, cur).map(c => ({ ...c, plan: Object.fromEntries(Object.entries(c.plan).filter(([k, v]) => cur[k] !== v && usable(k))) })).filter(c => Object.keys(c.plan).length).slice(0, lv >= 4 ? 2 : 1) : [];
      note(read + (hurting && cts.length ? ` ${cts.length === 2 ? 'Two ways' : 'One way'} to answer it below.` : ''));
    }
  }
  // A few games in, a Master coach spots any hidden strength you're playing into.
  if (lv >= 4 && m.totalGames >= 4) for (const q of quirkHits(A, O)) {
    const fix = q.key === 'wing' ? 'neutral' : DEFAULT_PLAN[q.key];
    set(q.key, fix, `Careful: ${on} ${q.text}. Switch ${GAME_PLAN.find(g => g.key === q.key).label.toLowerCase()} to ${planLabel(q.key, fix).toLowerCase()}.`);
  }
  // Their serve.
  const theirServe = pct(T.firstWon + T.secondWon, T.servePts);
  if (T.servePts >= 12 && pct(T.firstWon, T.firstIn) > 0.78) set('returnPos', 'deep', `Their first serve is winning ${P(pct(T.firstWon, T.firstIn))} of points. Stand deeper so you get more returns back in play.`);
  else if (T.servePts >= 12 && T.aces / T.servePts > 0.09 && theirServe > 0.62) set('returnPos', 'deep', `They've hit ${T.aces} aces and are winning ${P(theirServe)} on serve. Stand deeper to get more returns back.`);
  else if (T.servePts >= 12 && pct(T.secondWon, T.servePts - T.firstIn) < 0.45) set('returnPos', 'inside', `They're winning only ${P(pct(T.secondWon, T.servePts - T.firstIn))} on their second serve. Step in and attack it.`);
  // Your serve.
  if (Y.servePts >= 12 && pct(Y.firstIn, Y.servePts) < 0.55) set('serve', 'safe', `Only ${P(pct(Y.firstIn, Y.servePts))} of your first serves are going in, so they're feasting on second serves. Take some pace off and make them.`);
  if (Y.df >= 4) set('serve', 'safe', `${Y.df} double faults already: that's free points. Play safer on serve.`);
  // Errors and winners.
  if (Y.ue >= T.ue + 4) { set('aggression', 'patient', `You've made ${Y.ue} unforced errors to their ${T.ue}: you're beating yourself. Be patient and make them play.`); set('depth', 'high', 'Give yourself more margin over the net until the errors stop.'); }
  else if (T.ue >= Y.ue + 5) set('aggression', 'patient', `They've made ${T.ue} errors to your ${Y.ue}. They're giving you points: keep the ball in play and let them miss.`);
  if (T.winners >= Y.winners + 6) set('depth', 'deep', `They've hit ${T.winners} winners to your ${Y.winners}. Push them back with deep balls so they can't attack.`);
  // The net.
  if (Y.netPlayed >= 5 && pct(Y.netWon, Y.netPlayed) < 0.45) set('net', 'rarely', `You're winning only ${P(pct(Y.netWon, Y.netPlayed))} of points at the net (${Y.netWon} of ${Y.netPlayed}): they're passing you. Stay back.`);
  else if (Y.netPlayed >= 4 && pct(Y.netWon, Y.netPlayed) > 0.7) set('net', 'often', `You're winning ${P(pct(Y.netWon, Y.netPlayed))} at the net. Come in more.`);
  // Big points.
  if (Y.bpChances >= 3 && pct(Y.bpWon, Y.bpChances) < 0.3 && attr(O, 'mental') < 60) set('pressure', 'broke', `You've converted ${Y.bpWon} of ${Y.bpChances} break points, and they look nervous. Go for it on the big ones.`);
  else if (Y.bpFaced >= 3 && pct(Y.bpSaved, Y.bpFaced) < 0.5) set('pressure', 'safe', `You've saved only ${Y.bpSaved} of ${Y.bpFaced} break points. Stay solid when it's tight.`);
  // Legs.
  if (m.totalGames >= 18 && attr(A, 'stam') < 62 && cur.energy === 'hustle') set('energy', 'conserve', "This is getting long and you're the one who'll fade. Save your legs.");
  else if (m.totalGames >= 18 && attr(A, 'stam') >= 66 && attr(O, 'stam') < 56) set('energy', 'hustle', "They're tiring. Raise the intensity and make every point physical.");
  // Their weaker wing (a Master's read).
  const g = wingGap(O), want = g > 0.15 ? 'bh' : g < -0.1 ? 'fh' : null;
  if (want) set('wing', want, `Keep going at their ${want === 'bh' ? 'backhand' : 'forehand'}: it's the weaker side.`);
  // Nothing to change: say why, from the numbers.
  if (!tips.length) {
    const sv = pct(Y.firstWon + Y.secondWon, Y.servePts), why = Y.servePts >= 10 ? ` You're winning ${P(sv)} on serve and ${P(myShare)} of all points.` : '';
    const ahead = m.sets.reduce((n, st) => n + (st.games[me] > st.games[op] ? 1 : -1), 0) + Math.sign(m.games[me] - m.games[op]) * 0.5;
    tips.push(ahead >= 0 ? `It's working. Change nothing.${why}` : `The plan is right; it's small margins.${why} Stay with it.`);
  }
  // A club coach tells you what they see; changing the plan is up to you.
  return { tips, plan: lv >= 2 ? plan : {}, counters: cts, level: lv };
}
// Below a Master coach, between sets: the same honest read, with less detail.
function adaptNotice(m, ps, me) {
  const lv = teamLevel(current.career, 'coach');
  if (!lv || lv >= 4) return '';
  const adv = liveAdvice(m, ps, me, null, lv);
  return adv.tips.length ? `🧑‍🏫 Your coach: "${esc(adv.tips.join(' '))}"` : '';
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
