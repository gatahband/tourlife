// story.js — turns a finished match record into a short written match story, and suggests training focus

const ROUND_LONG = { Q1: 'first qualifying round', Q2: 'second qualifying round', Q3: 'final qualifying round', R32: 'first round', R16: 'second round', QF: 'quarter-finals', SF: 'semi-finals', F: 'final' };
const NEXT_ROUND = { Q1: 'next qualifying round', Q2: 'next qualifying round', Q3: 'main draw', R32: 'second round', R16: 'quarter-finals', QF: 'semi-finals', SF: 'final' };
const ORDINAL = ['first', 'second', 'third'];

const pickOne = list => list[Math.floor(Math.random() * list.length)];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const times = n => n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;
const SURFACE_NOUN = { hard: 'hard courts', clay: 'clay', grass: 'grass' };

function setScore(set, side = 0) {
  const g = side === 0 ? set.games : [set.games[1], set.games[0]];
  return `${g[0]}-${g[1]}${set.tb ? `(${Math.min(...set.tb)})` : ''}`;
}

function oppIntro(o, ev) {
  const name = esc(o.name);
  if (o.seed) return pickOne([`No. ${o.seed} seed ${name}`, `${name} (No. ${o.seed} seed)`]);
  if (o.nation === ev.nation) return pickOne([`home favourite ${name}`, `local player ${name}`]);
  if (o.age <= 19) return `teenager ${name}`;
  if (o.age >= 31) return `veteran ${name}`;
  return `${name} of ${nationInfo(o.nation)[2]}`;
}

function openingLine(rec, ev, o) {
  const opp = oppIntro(o, ev);
  const round = ROUND_LONG[rec.round];
  const oppScore = rec.sets.map(s => setScore(s, 1)).join(' ');
  const straight = rec.sets.length === 2;
  const lostGames = rec.sets.reduce((a, s) => a + s.games[1], 0);
  if (rec.won) {
    const feel = straight && lostGames <= 4 ? 'dominant' : rec.sets.some(s => s.tb) ? 'tight' : straight ? 'solid' : 'hard-fought';
    return pickOne([
      `You beat ${opp} ${rec.score} in the ${round} in ${ev.city}.`,
      `A ${feel} win in ${ev.city}: ${rec.score} over ${opp}.`,
      `${ev.city}, ${round}: you got past ${opp}, ${rec.score}.`,
    ]);
  }
  return pickOne([
    `${cap(opp)} ended your run in ${ev.city}, winning the ${round} ${oppScore}.`,
    `It wasn't your day in ${ev.city}. ${cap(opp)} won ${oppScore}.`,
    `${cap(opp)} was too good in the ${round}, ${oppScore}.`,
  ]);
}

function surfaceLine(rec, ev, player) {
  const name = SURFACE_NOUN[ev.surface];
  const verb = ev.surface === 'hard' ? 'are' : 'is';
  if (ev.surface === player.fav) return rec.won
    ? pickOne([`${cap(name)} ${verb} your favourite surface, and it showed.`, `You looked at home on ${name}.`])
    : `Even on your favourite ${name}, there was no way through.`;
  if (ev.surface === player.worst) return rec.won
    ? `${cap(name)} ${verb} your least favourite surface, which makes this one sweeter.`
    : `${cap(name)} ${verb} your least favourite surface, and it told.`;
  if (ev.indoor) return 'Under the roof there was no wind, so it came down to clean hitting.';
  return {
    clay: pickOne(['The clay slowed everything down. Rallies were long and physical.', 'On the slow clay, every point had to be earned.']),
    grass: pickOne(['On the fast grass, points were short and the serve mattered most.', 'The grass kept the ball low and the points quick.']),
    hard: pickOne(['The hard court rewarded clean, aggressive hitting.', 'A true bounce on the hard court made for honest tennis.']),
  }[ev.surface];
}

function setsLine(rec, oppName) {
  const lines = [];
  const [s1, s2, s3] = rec.sets;
  const won = s => s.games[0] > s.games[1];
  if (s1.tb) lines.push(won(s1) ? `You edged a first-set tiebreak ${s1.tb[0]}-${s1.tb[1]}.` : `You lost a first-set tiebreak ${s1.tb[0]}-${s1.tb[1]}.`);
  else lines.push(won(s1) ? `You took the opener ${setScore(s1)}.` : `You dropped the opener ${setScore(s1)}.`);

  const lopsided = s => Math.max(...s.games) === 6 && Math.min(...s.games) <= 1;
  if (lopsided(s2)) lines.push(won(s2) ? `Then you raced through the second set ${setScore(s2)}.` : `The second set got away from you, ${setScore(s2)}.`);
  else if (s2.tb) lines.push(`The second set went to a tiebreak, and ${won(s2) ? 'you held your nerve' : `${oppName} held his`}.`);
  else lines.push(won(s2) ? `You won the second ${setScore(s2)}.` : `${oppName} took the second ${setScore(s2, 1)}.`);

  if (s3) {
    if (!won(s1) && rec.won) lines.push(`From a set down, you won the decider ${setScore(s3)}.`);
    else if (won(s1) && !rec.won) lines.push(`You led by a set but couldn't close it out, losing the decider ${setScore(s3)}.`);
    else lines.push(`In the deciding set, ${won(s3) ? `you pulled clear ${setScore(s3)}` : `${oppName} pulled clear ${setScore(s3, 1)}`}.`);
  }
  return lines.join(' ');
}

function breakLine(rec, oppName) {
  const { bpWon: w, bpChances: c, bpSaved: sv, bpFaced: f } = rec.stats;
  let a;
  if (c === 0) a = `You never got a look at ${oppName}'s serve: no break points all match.`;
  else if (w / c >= 0.5) a = `You were sharp on return, converting ${w} of ${c} break points.`;
  else if (c >= 6 && w / c < 0.3) a = `You had chances but took just ${w} of ${c} break points${rec.won ? ', and it nearly cost you' : ''}.`;
  else if (w === 0) a = `You couldn't break, despite ${plural(c, 'chance')}.`;
  else a = `You broke ${times(w)} from ${plural(c, 'chance')}.`;
  let b;
  if (f === 0) b = "You didn't face a single break point.";
  else if (sv === f) b = f === 1 ? 'You saved the only break point you faced.' : `You saved all ${f} break points you faced.`;
  else if (f >= 3) b = `You saved ${sv} of ${f} break points.`;
  else b = `You were broken ${times(f - sv)}.`;
  return `${a} ${b}`;
}

function extrasLine(rec, oppName) {
  const lines = [];
  if (rec.stats.aces >= 5) lines.push(`${rec.stats.aces} aces kept your service games short.`);
  if (rec.oppStats.aces >= 5) lines.push(`${oppName} hit ${rec.oppStats.aces} aces.`);
  const mine = rec.stats.points, theirs = rec.oppStats.points;
  if (rec.won && mine < theirs) lines.push(`You won fewer points (${mine} to ${theirs}) but won the ones that mattered.`);
  if (!rec.won && mine > theirs) lines.push(`You actually won more points (${mine} to ${theirs}). Tennis can be cruel.`);
  const dp = rec.stats.dropPlayed || 0, dw = rec.stats.dropWon || 0;
  if (dp >= 2) lines.push(dw / dp >= 0.6 ? `Your drop shot was a weapon: ${dw} of ${dp} worked.`
    : dw / dp <= 0.35 ? `The drop shot let you down: only ${dw} of ${dp} came off.` : `You won ${dw} of ${dp} drop shots.`);
  const odp = rec.oppStats.dropPlayed || 0;
  if (odp >= 3) lines.push(`${oppName} kept dragging you forward with ${odp} drop shots.`);
  if (rec.stats.netcords) lines.push(`A net cord trickled over to win you a point${rec.stats.netcords > 1 ? ', more than once' : ''}.`);
  if (rec.oppStats.netcords) lines.push(`${oppName} got a lucky net cord.`);
  if (rec.opponent.hand === 'left') lines.push(rec.won ? `You handled the lefty serve well.` : `The left-hander's serve out wide on the ad side was a problem all day.`);
  return lines.join(' ');
}

// Mental moments, written to match each temperament.
const MIND = {
  fiery: {
    dip: n => `Your 🤬 temper flared in the ${n} set. A dropped serve set off a racket slam, and a few loose games followed.`,
    surge: n => `A break in the ${n} set lit you up 🤬, and you rode that energy.`,
    calm: 'For once the 🤬 temper stayed in check.',
  },
  stoic: {
    dip: n => `Even the 🧊 ice cracked a little in the ${n} set after a dropped serve.`,
    calm: '🧊 Ice-cool throughout. Nothing rattled you.',
  },
  moping: {
    dip: (n, label) => label.includes('slump')
      ? `Losing the ${n} set sent you into a 🌧️ slump that was hard to shake.`
      : `After being broken in the ${n} set, your shoulders dropped 🌧️.`,
    calm: 'No 🌧️ sulking today, even when things went wrong.',
  },
  robotic: { calm: 'Your 🤖 calm never changed, good points or bad.' },
};

const OPP_MIND = {
  'boiled over': (o, n) => `${o} lost his cool in the ${n} set.`,
  'fired up': (o, n) => `${o} got fired up in the ${n} set.`,
  wobbled: (o, n) => `${o} wobbled for a moment in the ${n} set.`,
  drooped: (o, n) => `${o}'s head dropped after a lost serve in the ${n} set.`,
  'sank into a slump': (o, n) => `${o} sank into a slump after losing the ${n} set.`,
};

function mindLine(rec, player, oppName) {
  const t = MIND[player.temperament];
  const mine = rec.moments.filter(x => x.who === 'you');
  const dip = mine.find(x => x.kind === 'dip');
  const surge = mine.find(x => x.kind === 'surge');
  const lines = [];
  if (dip && t.dip) lines.push(t.dip(ORDINAL[dip.set - 1], dip.label));
  if (surge && t.surge) lines.push(t.surge(ORDINAL[surge.set - 1]));
  if (!dip && !surge) lines.push(t.calm);
  const theirs = rec.moments.find(x => x.who === 'opponent' && x.kind !== 'adapt');
  if (theirs && theirs.text) lines.push(`In the ${ORDINAL[theirs.set - 1]} set, ${oppName} ${moodText(theirs, false)}.`);
  else if (theirs && OPP_MIND[theirs.label]) lines.push(OPP_MIND[theirs.label](oppName, ORDINAL[theirs.set - 1]));
  return lines.join(' ');
}

// Did the plan work? One or two lines on the most telling settings.
function planLine(rec, oppName) {
  const pl = rec.plan;
  if (!pl) return '';
  const st = rec.stats, lines = [];
  if (pl.net === 'often' && st.netPlayed >= 6) {
    const r = st.netWon / st.netPlayed;
    lines.push(r >= 0.62 ? `Rushing the net paid off: ${st.netWon} of ${st.netPlayed} net points won.`
      : r < 0.5 ? `The net rushing backfired. ${oppName} passed you ${st.netPlayed - st.netWon} times.` : `You came forward ${st.netPlayed} times and won ${st.netWon}.`);
  }
  if (pl.aggression === 'aggressive') {
    lines.push(st.winners >= st.ue ? `Playing aggressive worked: ${st.winners} winners to ${st.ue} unforced errors.`
      : `Going for too much cost you: ${st.ue} unforced errors against ${st.winners} winners.`);
  }
  if (pl.aggression === 'patient' && st.ue <= 15) lines.push(`Your patience kept the errors down to ${st.ue}.`);
  if (pl.serve === 'big' && st.servePts) {
    const inPct = Math.round(st.firstIn / st.servePts * 100);
    lines.push(st.aces >= 5 ? `The big first serve delivered ${st.aces} aces.` : inPct < 52 ? `Going big on serve meant only ${inPct}% of first serves landed.` : '');
  }
  if (st.underarm) lines.push(`The cheeky underarm serve won you ${st.underarmWon || 0} of ${st.underarm} points.`);
  if (rec.oppStats.underarm) lines.push(`${oppName} caught you with ${rec.oppStats.underarmWon || 0} underarm serve${rec.oppStats.underarmWon === 1 ? '' : 's'}.`);
  if (pl.returnPos === 'deep' && rec.oppStats.aces <= 2 && rec.oppStats.servePts) lines.push('Standing deep took the sting out of their serve.');
  // Plans meeting answers.
  const adapt = rec.moments.find(x => x.kind === 'adapt');
  if (adapt) lines.unshift(adapt.who === 'opponent'
    ? `After the ${ORDINAL[adapt.set - 2]} set, ${oppName} found answers to your game plan.`
    : `After the ${ORDINAL[adapt.set - 2]} set, you found answers to ${oppName}'s game plan.`);
  return lines.filter(Boolean).slice(0, 2).join(' ');
}

function closingLine(rec) {
  if (!rec.won) return pickOne(['Time to regroup and get back on the practice court.', 'Take the lessons and move on to the next one.']);
  if (rec.round === 'F') return '🏆 The title is yours.';
  return `Next up: the ${NEXT_ROUND[rec.round]}.`;
}

// Returns paragraphs (HTML strings) for one match record.
// Blown leads and comebacks: "You were up 5-2 in the second set and lost it 7-5."
function swingLine(rec, oppName) {
  const ord = ['first', 'second', 'third'];
  return rec.sets.map((st, i) => {
    if (!st.blown) return '';
    const score = `${st.games[0]}-${st.games[1]}`;
    return st.blown.you
      ? `You were up ${st.blown.lead} in the ${ord[i]} set and somehow lost it ${score}.`
      : `${oppName} led ${st.blown.lead} in the ${ord[i]} set, but you stormed back to take it ${score}.`;
  }).filter(Boolean).join(' ');
}

// Off the court: the biggest morale factors going into the match.
function moraleLine(rec) {
  const t = rec.moraleTags || [];
  if (!t.length) return '';
  const lc = s => s.charAt(0).toLowerCase() + s.slice(1);
  const ups = t.filter(x => x.v > 0), downs = t.filter(x => x.v < 0);
  if (downs.length && !ups.length) return `Off the court, ${downs.map(x => lc(x.text)).join(' and ')} weighed on you.`;
  if (ups.length && !downs.length) return `Off the court, you had a lift: ${ups.map(x => lc(x.text)).join(' and ')}.`;
  return `Off the court: ${lc(ups[0].text)} helped, but ${lc(downs[0].text)} didn't.`;
}

// Big-point calls: how many you made and how many came off.
function callsLine(rec) {
  if (!rec.calls) return '';
  const { made, won } = rec.calls;
  return `On the big points you made ${made} call${made === 1 ? '' : 's'} and won ${won} of ${made === 1 ? 'it' : 'them'}.` +
    (won / made >= 0.66 ? ' Clutch.' : won / made <= 0.34 ? ' The big moments got away from you.' : '');
}

// Set-break plan changes: what you changed, and whether it worked.
function adjustLine(rec) {
  if (!rec.adjusts) return '';
  return rec.adjusts.map(a => {
    const sw = ['first', 'second', 'third', 'fourth'][a.after - 1] || 'set';
    const lead = a.score.split(' ').reduce((n, st) => { const [x, y] = st.split('-').map(Number); return n + (x > y ? 1 : -1); }, 0);
    const state = lead > 0 ? 'with a set in hand' : lead < 0 ? 'a set down' : 'level';
    const what = a.changes.length > 2 ? `${a.changes.slice(0, 2).join(', ')} and more` : a.changes.join(' and ');
    const verdict = a.won && !a.lost ? (a.won > 1 ? 'It worked: you took both sets after it.' : 'It worked: you took the next set.')
      : a.lost && !a.won ? (lead > 0 ? "It didn't pay off: you dropped the next set." : "It didn't turn things around.")
      : 'It helped some: you split the sets after it.';
    return `After the ${sw} set, ${state}, you changed your plan (${what}). ${verdict}`;
  }).join(' ');
}

// Stepping up a level: your first match at a Challenger, on the ATP Tour, at a Masters or a Slam.
const DEBUT_NAME = { CH: 'Challenger', ATP250: 'ATP Tour', ATP500: 'ATP 500', M1000: 'Masters 1000', GS: 'Grand Slam' };
function debutLine(rec, ev) {
  const d = rec.debut;
  if (!d) return '';
  const name = DEBUT_NAME[d.fam];
  if (d.qual) return `This was your first ever ${name} qualifying match${rec.won ? ', and you won it' : ''}. ${rec.won ? 'The bigger stage suits you.' : 'Now you know what the level feels like.'}`;
  const where = d.fam === 'GS' ? ` in ${ev.city}` : '';
  return rec.won ? `It was your first ever ${name} main-draw match${where}, and you won it. A day to remember.`
    : `It was your first ever ${name} main-draw match${where}. You lost, but you belong at this level now.`;
}

function matchStory(rec, ev, player) {
  const oppName = esc(shortName(rec.opponent));
  return [
    `${openingLine(rec, ev, rec.opponent)} ${debutLine(rec, ev)} ${surfaceLine(rec, ev, player)}`,
    `${setsLine(rec, oppName)} ${swingLine(rec, oppName)} ${breakLine(rec, oppName)} ${extrasLine(rec, oppName)} ${styleLine(rec, oppName)}`.trim(),
    `${planLine(rec, oppName)} ${moraleLine(rec)} ${adjustLine(rec)} ${callsLine(rec)} ${mindLine(rec, player, oppName)} ${closingLine(rec)} ${typeof h2hStory === 'function' ? h2hStory(rec) : ''}`.trim(),
  ];
}

// --- Post-match adjustments ------------------------------------------------
// Tactical ideas the player can work into their game. Each trains a few stats.
// tags: match signals that make the idea relevant (see matchSignals).

// Every idea trains exactly two stats, so no card is worth more than another.
// Every pair of stats has at least one idea, so three cards can always split all six between them.
const IDEAS = [
  { id: 'firststrike', title: 'Serve plus one: attack the first ball', stats: ['serve', 'ground'], tags: ['hard', 'grass', 'lowSave'],
    desc: 'Follow a good serve with an aggressive forehand to end points fast.' },
  { id: 'returnPlus', title: 'Serve-and-return practice sets', stats: ['serve', 'ret'], tags: ['lowConvert', 'lowSave'],
    desc: 'Play sets where only the first two shots count. Sharpen how every point starts.' },
  { id: 'snv',       title: 'Serve and volley on key points', stats: ['serve', 'net'], tags: ['grass', 'fewAces'],
    desc: 'Surprise the returner and finish points at the net.' },
  { id: 'volume',    title: 'High-volume serving sessions', stats: ['serve', 'stam'], tags: ['fewAces', 'decider'],
    desc: 'Hit hundreds of serves a day so your motion holds up late in matches.' },
  { id: 'bodyserve', title: 'Aim more first serves at the body', stats: ['serve', 'mental'], tags: ['lowSave', 'fewAces'],
    desc: 'Jam the returner and win cheap points under pressure.' },
  { id: 'kick',      title: 'Kick serve to the backhand on big points', stats: ['serve', 'mental'], tags: ['lowSave', 'dip'],
    desc: 'A safe, high-bouncing serve you can trust at 30-40.' },
  { id: 'early',     title: 'Take the return earlier', stats: ['ret', 'ground'], tags: ['hard', 'lowConvert', 'oppAces'],
    desc: 'Step in, shorten the swing and take time away from the server.' },
  { id: 'slice',     title: 'Use the backhand slice to change pace', stats: ['ground', 'ret'], tags: ['grass', 'hard', 'lost'],
    desc: 'Break the rhythm of hard hitters and buy time when stretched.' },
  { id: 'dropshot',  title: 'Mix in drop shots from the baseline', stats: ['iq', 'net'], tags: ['clay', 'longRallies', 'badDrops'],
    desc: 'Pull opponents forward and break up long baseline exchanges.' },
  { id: 'approach',  title: 'Approach behind the slice', stats: ['net', 'ground'], tags: ['grass', 'won'],
    desc: 'A low slice approach forces weak passing shots.' },
  { id: 'topspin',   title: 'Hit heavier topspin crosscourt', stats: ['ground', 'stam'], tags: ['clay', 'lost', 'longRallies'],
    desc: 'Build safer rallies with height and margin over the net.' },
  { id: 'oneMore',   title: 'Play one more ball', stats: ['ground', 'mental'], tags: ['lost', 'clay', 'decider'],
    desc: 'Cut the errors. Make your opponent hit one more shot every rally.' },
  { id: 'chipcharge',title: 'Chip and charge on second serves', stats: ['ret', 'net'], tags: ['grass', 'lowConvert'],
    desc: 'Slice the return low and follow it in to put the server under pressure.' },
  { id: 'splitstep', title: 'Split-step timing drills', stats: ['net', 'ret'], tags: ['grass', 'oppAces'],
    desc: 'Sharper reactions at the net and on the return.' },
  { id: 'standback', title: 'Stand deeper to return', stats: ['ret', 'stam'], tags: ['oppAces', 'clay', 'lowConvert'],
    desc: 'Buy time against big serves and get more balls back in play.' },
  { id: 'reset',     title: 'Reset after losing serve', stats: ['mental', 'ret'], tags: ['dip', 'lowSave'],
    desc: 'Treat the next return game as a fresh start instead of dwelling on the break.' },
  { id: 'pressure',  title: 'Practise 30-40 pressure games', stats: ['ret', 'mental'], tags: ['lowConvert', 'dip'],
    desc: 'Play practice games that start at break point, again and again.' },
  { id: 'readtoss',  title: 'Read the server’s toss', stats: ['ret', 'mental'], tags: ['oppAces', 'lowConvert'],
    desc: 'Pick up serve direction earlier from the toss and the body.' },
  { id: 'footwork',  title: 'Net footwork and recovery drills', stats: ['net', 'stam'], tags: ['grass', 'longRallies'],
    desc: 'Get in and out of the net faster, point after point.' },
  { id: 'trustvolley', title: 'Commit to the net on big points', stats: ['net', 'mental'], tags: ['dip', 'grass', 'won'],
    desc: 'Back your volleys when it matters instead of hanging back.' },
  { id: 'serveplan', title: 'Plan your serve locations in advance', stats: ['iq', 'serve'], tags: ['lowSave', 'fewAces'],
    desc: 'Decide where every serve goes before you bounce the ball.' },
  { id: 'construct', title: 'Construct points: open the court first', stats: ['iq', 'ground'], tags: ['lost', 'longRallies', 'hard'],
    desc: 'Move your opponent side to side before going for the winner.' },
  { id: 'scouting',  title: 'Scout opponents on video', stats: ['iq', 'ret'], tags: ['oppAces', 'lowConvert'],
    desc: 'Learn their serve patterns and favourite plays before you step on court.' },
  { id: 'energy',    title: 'Manage your energy: pick your moments', stats: ['iq', 'stam'], tags: ['decider', 'longRallies'],
    desc: 'Save your legs on dead points and go all-out on the ones that matter.' },
  { id: 'scoreboard', title: 'Play the scoreboard', stats: ['iq', 'mental'], tags: ['dip', 'lowConvert', 'lefty'],
    desc: 'Know when to take risks and when to play safe, based on the score.' },
  { id: 'routine',   title: 'Build a between-point routine', stats: ['mental', 'stam'], tags: ['dip', 'decider'],
    desc: 'Towel, breathe, plan the next point. Reset after every mistake.' },
  { id: 'fitness',   title: 'Add an off-court fitness block', stats: ['stam', 'mental'], tags: ['decider', 'lost', 'longRallies'],
    desc: 'Stay fresh in third sets and long matches.' },
];

// What stood out in this match, plus why it matters (shown on the idea card).
function matchSignals(rec, ev) {
  const sig = {};
  const { bpWon, bpChances, bpSaved, bpFaced, aces } = rec.stats;
  const opp = esc(shortName(rec.opponent));
  if (bpFaced >= 3 && bpSaved / bpFaced < 0.5) sig.lowSave = `You saved just ${bpSaved} of ${bpFaced} break points.`;
  if (bpChances >= 4 && bpWon / bpChances < 0.35) sig.lowConvert = `You converted only ${bpWon} of ${bpChances} break points.`;
  if (rec.oppStats.aces >= 4) sig.oppAces = `${opp} hit ${rec.oppStats.aces} aces past you.`;
  if (aces <= 1) sig.fewAces = `You hit ${aces === 0 ? 'no aces' : 'only one ace'}.`;
  const dip = rec.moments.find(x => x.who === 'you' && x.kind === 'dip');
  if (dip) sig.dip = `You ${dip.label} in the ${ORDINAL[dip.set - 1]} set.`;
  if (rec.sets.length === 3 || rec.sets.length === 5) sig.decider = `It went the distance: ${rec.sets.length === 5 ? 'five' : 'three'} sets.`;
  if (rec.stats.points + rec.oppStats.points > 150) sig.longRallies = 'A long, physical match.';
  const dp = rec.stats.dropPlayed || 0;
  if (dp >= 3 && (rec.stats.dropWon || 0) / dp < 0.4) sig.badDrops = `Only ${rec.stats.dropWon || 0} of ${dp} drop shots worked.`;
  if (rec.opponent.hand === 'left') sig.lefty = `${opp} is a lefty. Expect more of them.`;
  sig[ev.surface] = `Useful on ${SURFACE_NOUN[ev.surface]}.`;
  sig[rec.won ? 'won' : 'lost'] = rec.won ? 'Build on a winning game.' : 'A fix for next time.';
  return sig;
}

// Three ideas that fit this match. They never share a stat, so together they cover all six:
// the choice is which part of your game to work on, not which card is bigger.
function offerIdeas(rec, ev) {
  const sig = matchSignals(rec, ev);
  const strong = ['lowSave', 'lowConvert', 'oppAces', 'dip', 'decider', 'fewAces', 'badDrops'];
  const scored = IDEAS.map(idea => {
    const hits = idea.tags.filter(t => sig[t]).sort((a, b) => strong.includes(b) - strong.includes(a));
    const score = hits.reduce((a, t) => a + (strong.includes(t) ? 3 : 1), 0) + Math.random() * 3;
    return { idea, hits, score };
  });
  const apart = (...xs) => new Set(xs.flatMap(x => x.idea.stats)).size === xs.length * 2;
  let best = null, bestScore = -1;
  for (let i = 0; i < scored.length; i++)
    for (let j = i + 1; j < scored.length; j++) {
      if (!apart(scored[i], scored[j])) continue;
      for (let k = j + 1; k < scored.length; k++) {
        if (!apart(scored[i], scored[j], scored[k])) continue;
        const total = scored[i].score + scored[j].score + scored[k].score;
        if (total > bestScore) { bestScore = total; best = [scored[i], scored[j], scored[k]]; }
      }
    }
  // Give each card its own reason where possible.
  const used = new Set();
  return best.sort(() => Math.random() - 0.5).map(({ idea, hits }) => {
    const t = hits.find(h => !used.has(h)) || hits[0] || (rec.won ? 'won' : 'lost');
    used.add(t);
    return { id: idea.id, why: sig[t] };
  });
}

// --- Scouting report ---------------------------------------------------------
// What you'd know about an opponent before playing them: no numbers, just strengths, weaknesses,
// tendencies, and which game plan settings might counter them.

const SCOUT = {
  serve:  { up: 'Big serve',               down: 'Weak serve',
            vsUp: 'Stand deep on return to blunt the serve.',      vsDown: 'Stand inside on return and attack the second serve.' },
  ground: { up: 'Heavy groundstrokes',     down: 'Shaky groundstrokes',
            vsUp: 'Come to the net to take time away from them.',  vsDown: 'Play patient. Make them hit one more ball.' },
  ret:    { up: 'Dangerous returner',      down: 'Poor returner',
            vsUp: "A big first serve won't buy many free points. Play safe and construct the point.", vsDown: 'Go big on the first serve.' },
  net:    { up: 'Comfortable at the net',  down: 'Uncomfortable at the net',
            vsUp: 'Keep them pinned back. Avoid short balls.',     vsDown: 'Drop shots will drag them into the net.' },
  stam:   { up: 'Excellent fitness',       down: 'Tires in long matches',
            vsUp: 'Shorten the points. Be aggressive.',            vsDown: 'Patient rallies and drop shots will wear them down.' },
  mental: { up: 'Tough on big points',     down: 'Fragile under pressure',
            vsUp: 'Take your chances early. Break points will be hard.', vsDown: 'Stay solid. They can crack when it gets tight.' },
  iq:     { up: 'Smart, crafty player',    down: 'Predictable patterns',
            vsUp: 'Expect variety, including drop shots. Stay alert at the baseline.', vsDown: 'Mix it up. Come forward and use the drop shot.' },
};

const TENDENCY = {
  serve:      { big: 'Goes big on first serves', safe: 'Plays safe with the serve' },
  returnPos:  { deep: 'Returns from deep', inside: 'Stands inside to return' },
  aggression: { aggressive: 'Aggressive from the baseline', patient: 'Patient, grinds long rallies' },
  spin:       { flat: 'Hits flat and fast', topspin: 'Heavy topspin, high bouncing balls' },
  net:        { often: 'Comes to the net a lot', rarely: 'Stays on the baseline' },
  drops:      { often: 'Loves a drop shot' },
  underarm:   { rarely: 'Might try an underarm serve', sometimes: 'Loves a cheeky underarm serve' },
};

// How to handle their spin (see spinEdge in sim.js).
const SPIN_TIP = {
  flat: 'Heavy topspin gets the ball above their strike zone, best on clay. Flat against flat is a shootout.',
  topspin: 'Flatten it out to rush them, best on grass and indoors. Topspin against topspin is a grind.',
};

function scoutReport(o) {
  const keys = ['serve', 'ground', 'ret', 'net', 'stam', 'mental', 'iq'];
  const vals = keys.map(k => [k, o.attrs[k] ?? 50]);
  const avg = vals.reduce((a, [, v]) => a + v, 0) / vals.length;
  const ups = vals.filter(([, v]) => v >= avg + 4).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const downs = vals.filter(([, v]) => v <= avg - 4).sort((a, b) => a[1] - b[1]).slice(0, 2);
  const plan = planOf(o);
  const tendencies = Object.entries(TENDENCY).map(([k, m]) => m[plan[k]]).filter(Boolean);
  if (o.hand === 'left') tendencies.unshift('Left-handed: watch the serve out wide on the ad side');
  const g = wingGap(o);
  if (g > 0.3) tendencies.push(`Weaker on the backhand${o.backhand === 'one' ? ' (one-hander)' : ''}`);
  else if (g < -0.1) tendencies.push('Weaker on the forehand');
  return {
    strengths: ups.map(([k]) => SCOUT[k].up),
    weaknesses: downs.map(([k]) => SCOUT[k].down),
    tendencies,
    counters: [...(SPIN_TIP[plan.spin] ? [SPIN_TIP[plan.spin]] : []),
      ...downs.map(([k]) => SCOUT[k].vsDown), ...ups.map(([k]) => SCOUT[k].vsUp)].slice(0, 3),
  };
}

// --- Playstyle matchup preview --------------------------------------------------------
// What points between these two styles tend to look like, and the key to it.
const MATCHUP = {
  attack: { attack: 'Two first-strike games: short points decided by the serve and the first big shot. Hold serve and pounce on second serves.',
    net: "They'll rush the net, so you'll get passing chances. Drive it low at their feet.",
    defend: "They'll drag you into long rallies and wait for you to miss. Win it early, but don't overpress: your errors are how they win.",
    craft: "They'll mix it up with slices and touch. Keep the ball deep and take their time away." },
  net: { attack: 'They hit hard from the back. Get in fast and make them pass you; a big serve sets it up.',
    net: 'Both of you want the net. Whoever gets there first usually wins the point.',
    defend: 'They love to pass and lob net rushers. Pick your moments and come in off short balls.',
    craft: 'Expect clever passes and lobs. Approach deep and cover the line.' },
  defend: { attack: "They'll go for big winners early. Get everything back and let them miss.",
    net: "They'll come forward a lot. Your passing shots and lobs are the weapon.",
    defend: 'A grinding match: long rallies, and patience wins. Fitness will matter.',
    craft: "They'll try to break your rhythm with drops and slices. Stay alert and move forward early." },
  craft: { attack: 'They hit big. Take pace off with slices and use angles to move them.',
    net: "They'll rush you. Lobs and dipping passes will frustrate them.",
    defend: "They'll defend everything. Use drops and changes of pace to drag them in.",
    craft: 'A chess match: variety, angles and touch from both sides.' },
};

function matchupHtml(me, o) {
  const mine = detectStyles(me.attrs, me.fav)[0], theirs = detectStyles(o.attrs, o.fav)[0];
  const extra = [];
  if (theirs.name === 'Return Specialist' && famOf(mine.name) !== 'defend') extra.push("Their return is a weapon: your serve won't buy as many free points.");
  if ((theirs.name === 'Big Server' || theirs.name === 'First-Strike Player') && mine.name === 'Return Specialist') extra.push('Your return can take the sting out of their serve.');
  if (theirs.name === 'Serve-and-Volleyer') extra.push('They follow most first serves to the net.');
  if (theirs.name === 'Tactician') extra.push('Watch for the drop shot.');
  return `<div class="matchup"><div class="mutop"><span>You: <b>${mine.name}</b></span><span class="muvs">🆚</span><span>Them: <b>${theirs.name}</b></span></div><p>${MATCHUP[famOf(mine.name)][famOf(theirs.name)]}${extra.length ? ' ' + extra.join(' ') : ''}</p>${styleRecordHtml(theirs.name)}</div>`;
}

// Your win-loss record against a playstyle, this season and over your career.
function styleRecordHtml(style) {
  const c = current.career;
  if (!c) return '';
  const season = seasonOfWeek(c.week);
  const all = [...c.history.flatMap(h => h.matches.map(m => [m, h.week])), ...((current.entry && current.entry.matches) || []).map(m => [m, c.week])]
    .filter(([m]) => m.styles && m.styles[1] === style);
  const wl = list => `${list.filter(([m]) => m.won).length}–${list.filter(([m]) => !m.won).length}`;
  const plural = /s$/.test(style) ? style : style + 's';
  return `<div class="murec"><span>Your record vs ${plural}</span><b>Season ${wl(all.filter(([, w]) => seasonOfWeek(w) === season))}</b><b>Career ${wl(all)}</b></div>`;
}

// After the match: how the clash of styles actually played out.
function styleLine(rec, oppName) {
  if (!rec.styles || !rec.rally || !rec.rally.n) return '';
  const r = rec.rally, avg = (r.sum / r.n).toFixed(1);
  const longs = r.long[0] + r.long[1], shorts = r.short[0] + r.short[1];
  const bits = [];
  if (longs >= 4) bits.push(`won ${r.long[0]} of ${longs} long rallies`);
  if (shorts >= 8) bits.push(`${r.short[0]} of ${shorts} quick points`);
  return `Your ${rec.styles[0]} game against ${oppName}'s ${rec.styles[1]}: points averaged ${avg} shots${bits.length ? `, and you ${bits.join(' and ')}` : ''}.`;
}

function scoutHtml(o) {
  const r = scoutReport(o);
  const list = (title, items, cls) => items.length
    ? `<div class="scol"><h4>${title}</h4><ul class="${cls}">${items.map(x => `<li>${x}</li>`).join('')}</ul></div>` : '';
  return `<div class="scout">${list('Strengths', r.strengths, 'up')}${list('Weaknesses', r.weaknesses, 'down')}` +
    `${list('Tendencies', r.tendencies, '')}${list('How to beat them', r.counters, 'tip')}</div>`;
}
