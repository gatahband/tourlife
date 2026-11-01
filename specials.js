// specials.js — Speciality Moves: a fourth big-point option, one per playstyle on serve and one on return.
// Each move plays its point a set way (and the court shows it), and each is a gamble: a bigger edge in the right
// matchup, a cost in the wrong one, decided by the opponent's game and plan on that point. Three per player per
// match. Opponents use theirs too, both sides learn a move once they've seen it, and a miss costs momentum.

const SPECIALS_ON = true; // false hides the whole feature (the button, opponents' moves)
const SPECIAL_USES = 3;

// edge(A, B, ev, m): the swing on this point for A (before the opponent has learned it).
// shape(b, won): how the point plays out, for a win or a loss by the move's user.
const SPM = (id, icon, title, tag, desc, fx, edge, shape, decay = 0.3) => ({ id: 'sp_' + id, icon, title, tag, desc, fx, edge, shape, decay });
const spSurf = ev => (ev.indoor ? 'indoor' : ev.surface);
const spStyle = p => (typeof styleOf === 'function' ? styleOf(p).name : '');
const spPassing = p => (attr(p, 'ground') + attr(p, 'ret')) / 2;
const spRushes = (B, op) => op.net === 'often' || famOf(spStyle(B)) === 'net';

const SPECIALS = {
  'Serve-Dominant': {
    serve: SPM('bomb', '💣', 'Second-Serve Bomb', 'BOMB', 'Full pace on both serves. Aces or double faults: deep returners blunt it.', { serve: 'big' },
      (A, B, ev) => 0.012 + 0.0022 * (attr(A, 'serve') - attr(B, 'ret')) + ({ deep: -0.02, inside: 0.012 }[planOf(B).returnPos] || 0),
      (b, won) => won ? (b.roll() < 0.55 ? b.ace({ second: b.roll() < 0.3 }) : b.unret()) : (b.roll() < 0.5 ? b.df() : b.retWin()), 0.3),
    ret: SPM('guess', '🎲', 'Guess And Commit', 'GUESS', 'Lean early to one side. Pays off against predictable servers, not clever ones.', { ret: 'inside' },
      (A, B) => 0.01 + 0.0015 * (attr(A, 'ret') - attr(B, 'serve')) - 0.0025 * (attr(B, 'iq') - 55),
      (b, won) => won ? b.retWin() : b.roll() < 0.6 ? b.ace() : b.unret()),
  },
  'Serve +1 Attacker': {
    serve: SPM('onetwo', '🥊', 'One-Two Punch', 'ONE-TWO', 'Serve wide, forehand into the open court. Fast defenders track it down.', { serve: 'wide' },
      (A, B) => 0.01 + 0.0018 * (attr(A, 'ground') - attr(B, 'stam')) + 0.001 * (attr(A, 'serve') - attr(B, 'ret')) - (famOf(spStyle(B)) === 'defend' ? 0.012 : 0),
      (b, won) => won ? b.rally(b.i, 'winner', 3, 3, { wing: 'fh' }) : b.rally(b.o, 'winner', 4, 4)),
    ret: SPM('blockrun', '↩️', 'Block, Then Run Around', 'RUN AROUND', 'Block the return deep, then run around for a forehand. Net rushers volley the block away.', { ret: 'deep' },
      (A, B) => 0.008 + 0.0018 * (attr(A, 'ground') - attr(B, 'serve')) - (spRushes(B, planOf(B)) ? 0.015 : 0),
      (b, won) => won ? b.rally(b.i, 'winner', 4, 4, { wing: 'fh', insideOut: true }) : b.roll() < 0.5 ? b.rally(b.o, 'winner', 5, 5) : b.rally(b.o, 'ue', 4, 4, { wing: 'fh' })),
  },
  'First-Strike Attacker': {
    serve: SPM('fbw', '🎯', 'First-Ball Winner', 'FIRST BALL', 'Go for the line on the very first ball after the serve. All or nothing.', { serve: 'big' },
      (A, B) => 0.006 + 0.0024 * (attr(A, 'ground') - attr(B, 'ret')) - (planOf(B).returnPos === 'deep' ? 0.008 : 0),
      (b, won) => won ? b.rally(b.i, 'winner', 3, 3) : b.roll() < 0.6 ? b.rally(b.o, 'ue', 3, 3) : b.rally(b.o, 'winner', 4, 4)),
    ret: SPM('charge', '⚡', 'Charge The Return', 'CHARGE', 'Stand well inside the baseline. Great against weak serves; big servers ace you.', { ret: 'inside' },
      (A, B) => 0.012 + 0.002 * (attr(A, 'ret') - attr(B, 'serve')) - 0.002 * Math.max(0, attr(B, 'serve') - 65),
      (b, won) => won ? b.retWin() : b.roll() < 0.5 ? b.ace() : b.unret()),
  },
  'Aggressive Baseliner': {
    serve: SPM('hammer', '🔨', 'Inside-Out Hammer', 'HAMMER', 'Serve to the backhand, then an inside-out forehand. Fit, fast opponents run it down.', { serve: 'body' },
      (A, B) => 0.01 + 0.002 * (attr(A, 'ground') - attr(B, 'stam')),
      (b, won) => won ? b.rally(b.i, 'winner', 3, 5, { wing: 'fh', insideOut: true }) : b.rally(b.o, 'winner', 4, 6)),
    ret: SPM('takeover', '👑', 'Return And Take Over', 'TAKE OVER', 'Deep through the middle, then dictate. Big servers end it before you can.', {},
      (A, B) => 0.005 + 0.0016 * (attr(A, 'ground') - attr(B, 'ground')) + 0.0012 * (attr(A, 'ret') - attr(B, 'serve')),
      (b, won) => won ? b.rally(b.i, 'winner', 4, 6) : b.rally(b.o, 'winner', 3, 3)),
  },
  'Flat Attacker': {
    serve: SPM('flatbomb', '🚀', 'Flat Bomb Down The T', 'FLAT BOMB', 'A flat first serve down the middle. Brilliant on fast courts, risky on clay.', { serve: 't' },
      (A, B, ev) => ({ grass: 0.02, indoor: 0.02, hard: 0.008, clay: -0.022 }[spSurf(ev)] || 0) + 0.0015 * (attr(A, 'serve') - attr(B, 'ret')),
      (b, won) => won ? (b.roll() < 0.5 ? b.ace() : b.unret()) : b.roll() < 0.4 ? b.retWin() : b.rally(b.o, 'winner', 4, 4)),
    ret: SPM('early', '⏱️', 'Take It Off The Bounce', 'OFF THE BOUNCE', 'Return from right on the baseline. Rushes them on fast courts; misses come too.', { ret: 'inside' },
      (A, B, ev) => ({ grass: 0.018, indoor: 0.018, hard: 0.006, clay: -0.02 }[spSurf(ev)] || 0) + 0.0018 * (attr(A, 'ret') - attr(B, 'serve')),
      (b, won) => won ? (b.roll() < 0.6 ? b.retWin() : b.rally(b.i, 'winner', 3, 3)) : b.retErr()),
  },
  'Heavy-Topspin Attacker': {
    serve: SPM('kickcrush', '🌀', 'Kick And Crush', 'KICK & CRUSH', 'A high kick serve, then a heavy forehand. Crushes weak backhands; it sits up on grass.', { serve: 'kick' },
      (A, B, ev) => 0.004 + (wingGap(B) > 0.15 || B.backhand === 'one' ? 0.024 : -0.004) - (spSurf(ev) === 'grass' ? 0.014 : 0) + 0.0008 * (attr(A, 'serve') - attr(B, 'ret')),
      (b, won) => won ? b.rally(b.i, 'winner', 3, 5, { wing: 'fh' }) : b.roll() < 0.4 ? b.retWin() : b.rally(b.o, 'winner', 4, 4)),
    ret: SPM('loopbh', '🎢', 'Loop It To The Backhand', 'HIGH TO THE BH', 'Heavy, high balls to their backhand until it breaks. Strong backhands step in and punish it.', { moon: true },
      (A, B, ev) => 0.003 + (wingGap(B) > 0.15 || B.backhand === 'one' ? 0.024 : -0.006) - (spSurf(ev) === 'grass' ? 0.012 : 0) + 0.001 * (attr(A, 'ground') - attr(B, 'ground')),
      (b, won) => won ? b.rally(b.i, 'ue', 5, 8, { wing: 'bh' }) : b.rally(b.o, 'winner', 5, 8, { wing: 'fh' })),
  },
  'Heavy-Topspin Baseliner': {
    serve: SPM('kickwide', '📐', 'Kick Wide, Pin Them Back', 'PIN THEM BACK', 'Kick it wide and pin them behind the baseline. Thrives on clay; quick courts punish it.', { serve: 'kick' },
      (A, B, ev) => ({ clay: 0.022, hard: 0.004, indoor: -0.012, grass: -0.018 }[spSurf(ev)] || 0) + 0.001 * (attr(A, 'stam') - attr(B, 'ground')) + (planOf(B).aggression === 'aggressive' ? 0.005 : 0),
      (b, won) => won ? b.rally(b.i, 'fe', 5, 9) : b.rally(b.o, 'winner', 3, 5)),
    ret: SPM('drag', '↔️', 'Drag Them Off Court', 'DRAG WIDE', 'Heavy cross-court angles to pull them out wide. Overcook one and it lands out.', {},
      (A, B, ev) => ({ clay: 0.02, hard: 0.004, indoor: -0.01, grass: -0.016 }[spSurf(ev)] || 0) + 0.0014 * (attr(A, 'ground') - attr(B, 'stam')),
      (b, won) => won ? b.rally(b.i, 'winner', 6, 9) : b.roll() < 0.5 ? b.rally(b.o, 'ue', 6, 9) : b.rally(b.o, 'winner', 6, 9)),
  },
  'Solid Baseliner': {
    serve: SPM('pct', '📊', 'Percentage Play', 'PERCENTAGES', 'Body serve, then the safe ball every time. A small edge that is hard to read.', { serve: 'body' },
      (A, B) => 0.012 + 0.0008 * (attr(A, 'iq') - 50) + 0.0005 * (attr(A, 'ground') - attr(B, 'ground')),
      (b, won) => won ? b.rally(b.i, b.roll() < 0.5 ? 'fe' : 'ue', 5, 9) : b.rally(b.o, 'winner', 5, 9), 0.08),
    ret: SPM('mid', '⬆️', 'Middle, Middle, Middle', 'THROUGH THE MIDDLE', 'Deep through the middle to take away their angles. Net rushers use the time to come in.', { ret: 'deep' },
      (A, B) => 0.008 + (planOf(B).aggression === 'aggressive' ? 0.01 : 0) - (planOf(B).net === 'often' ? 0.012 : 0) + 0.0006 * (attr(A, 'ground') - attr(B, 'ground')),
      (b, won) => won ? b.rally(b.i, 'ue', 5, 9) : b.rally(b.o, 'winner', 5, 9), 0.08),
  },
  'Counterpuncher': {
    serve: SPM('redirect', '🔁', 'Redirect Down The Line', 'REDIRECT', 'Soak up their pace and send it back down the line. Patient players give you nothing to use.', { serve: 'safe' },
      (A, B) => (planOf(B).aggression === 'aggressive' || famOf(spStyle(B)) === 'attack' ? 0.022 : planOf(B).aggression === 'patient' ? -0.012 : 0.002) + 0.0012 * (attr(A, 'iq') - 50),
      (b, won) => won ? b.rally(b.i, 'winner', 4, 6) : b.rally(b.o, 'ue', 6, 9)),
    ret: SPM('lob', '🌈', 'Lob Over The Rusher', 'LOB', 'Invite them forward, then lob. Devastating against net players; a short lob gets smashed.', { ret: 'deep' },
      (A, B) => (spRushes(B, planOf(B)) ? 0.03 : -0.012) - 0.0012 * (attr(B, 'net') - 60) + 0.001 * (attr(A, 'iq') - 50),
      (b, won) => won ? b.net(b.o, false, null, { lo: 4, hi: 5, fx: { lob: true } }) : b.net(b.o, true, null, { lo: 5, hi: 6, fx: { smash: true } })),
  },
  'Defensive Grinder': {
    serve: SPM('nofree', '🧱', 'No Free Points', 'NO FREE POINTS', 'A safe serve, then run down everything. Grows with how tired they are; fitter players outlast you.', { serve: 'safe' },
      (A, B, ev, m) => 0.002 + 0.0009 * (attr(A, 'stam') - attr(B, 'stam')) + 2 * (fatigue(m, B) - fatigue(m, A)),
      (b, won) => won ? b.rally(b.i, b.roll() < 0.6 ? 'ue' : 'fe', 10, 16) : b.rally(b.o, 'winner', 9, 14)),
    ret: SPM('runall', '🏃', 'Run Everything Down', 'RUN IT ALL DOWN', 'Get every ball back and make them hit one more. Fitter players outlast you.', { ret: 'deep' },
      (A, B, ev, m) => 0.002 + 0.0009 * (attr(A, 'stam') - attr(B, 'stam')) + 0.0005 * (attr(A, 'ret') - attr(B, 'serve')) + 2 * (fatigue(m, B) - fatigue(m, A)),
      (b, won) => won ? b.rally(b.i, b.roll() < 0.6 ? 'ue' : 'fe', 10, 16) : b.rally(b.o, 'winner', 9, 14)),
  },
  'All-Court': {
    serve: SPM('disguise', '🎭', 'Disguised Serve', 'DISGUISED', 'Same toss, any direction: they can\'t lean either way. Smart returners still read it.', { serve: 'disguise' },
      (A, B) => 0.005 + 0.002 * (attr(A, 'iq') - attr(B, 'iq')) + (planOf(B).returnPos === 'inside' ? 0.008 : 0),
      (b, won) => won ? (b.roll() < 0.4 ? b.ace() : b.roll() < 0.5 ? b.unret() : b.rally(b.i, 'winner', 3, 3)) : b.rally(b.o, 'winner', 3, 6)),
    ret: SPM('opposite', '🔄', 'Opposite Pattern', 'OPPOSITE', 'Play whatever beats their position: a lob if they rush, a drop if they hang back, a deep drive if they step in. Nothing to exploit against a balanced plan.', {},
      (A, B) => (allCourtCounter(B) ? 0.018 + 0.0015 * (attr(A, 'iq') - 50) : 0),
      (b, won, A, B) => {
        const ct = allCourtCounter(B);
        if (ct === 'lob') return won ? b.net(b.o, false, null, { lo: 4, hi: 5, fx: { lob: true } }) : b.net(b.o, true, null, { lo: 5, hi: 6, fx: { smash: true } });
        if (ct === 'drop') return b.drop(b.i, won ? 'won' : b.roll() < 0.6 ? 'chased' : 'net');
        if (ct === 'deep') return won ? b.rally(b.i, 'winner', 4, 6) : b.rally(b.o, 'winner', 4, 6);
        return won ? b.rally(b.i, 'winner', 4, 7) : b.rally(b.o, 'winner', 4, 7);
      }),
  },
  'Net Attacker': {
    serve: SPM('appsmash', '🏸', 'Approach And Smash', 'APPROACH', 'Build the rally, approach down the line, finish with a volley or smash. Good passers and lobbers punish it.', {},
      (A, B) => 0.01 + 0.002 * (attr(A, 'net') - 60) - 0.0018 * (spPassing(B) - 60) - (famOf(spStyle(B)) === 'defend' ? 0.012 : 0),
      (b, won) => won ? b.net(b.i, true, null, { lo: 5, hi: 6, fx: b.roll() < 0.5 ? { smash: true } : {} }) : b.net(b.i, false, null, { lo: 5, hi: 6, fx: b.roll() < 0.5 ? { lob: true } : {} })),
    ret: SPM('drivein', '🏹', 'Drive Deep, Follow It In', 'DRIVE IN', 'A hard return, then straight to the net. Good baseliners pass you.', { ret: 'inside' },
      (A, B) => 0.008 + 0.0014 * (attr(A, 'ret') - attr(B, 'serve')) + 0.0014 * (attr(A, 'net') - 60) - 0.0014 * (attr(B, 'ground') - 60),
      (b, won) => b.net(b.i, won, 'chip', { fx: { drive: true } })),
  },
  'Serve-and-Volley': {
    serve: SPM('ssv', '💨', 'Second-Serve-And-Volley', 'S&V ON 2ND', 'Rush in even behind the second serve. A shock the first time; returners standing in eat it up.', { serve: 'kick' },
      (A, B) => 0.022 + 0.0016 * (attr(A, 'net') - attr(B, 'ret')) - (planOf(B).returnPos === 'inside' ? 0.02 : 0),
      (b, won) => won ? (b.roll() < 0.3 ? b.retErr({ second: true, rush: true }) : b.net(b.i, true, 'snv', { second: true })) : b.roll() < 0.12 ? b.df() : b.net(b.i, false, 'snv', { second: true }), 0.45),
    ret: SPM('sneak', '🐾', 'Half-Volley Return, Sneak In', 'SNEAK IN', 'Take the return early and creep forward. Hard to do against a big serve.', { ret: 'inside' },
      (A, B) => 0.008 + 0.0018 * (attr(A, 'net') - 60) + 0.001 * (attr(A, 'ret') - attr(B, 'serve')) - 0.0015 * Math.max(0, attr(B, 'serve') - 60),
      (b, won) => b.net(b.i, won, 'chip')),
  },
  'Variety / Slice-Heavy': {
    serve: SPM('slicewide', '🔪', 'Slice Wide, Low Skid', 'SLICE WIDE', 'A low slice serve skidding off the court. Wrecks flat hitters on grass; slow courts sit it up.', { serve: 'wide' },
      (A, B, ev) => ({ grass: 0.02, indoor: 0.01, hard: 0.004, clay: -0.01 }[spSurf(ev)] || 0) + (planOf(B).spin === 'flat' ? 0.008 : 0) + 0.0012 * (attr(A, 'iq') - 50),
      (b, won) => won ? (b.roll() < 0.5 ? b.unret() : b.rally(b.i, 'winner', 3, 3)) : b.rally(b.o, 'winner', 3, 5)),
    ret: SPM('slicedrop', '🪶', 'Slice, Then Drop Shot', 'SLICE & DROP', 'Slice low, then drop it short. Wrecks big hitters; quick, patient grinders get there.', { drop: true },
      (A, B) => 0.004 + 0.0015 * ((attr(A, 'iq') + attr(A, 'net')) / 2 - 55) - 0.0015 * (attr(B, 'stam') - 55) + (planOf(B).aggression === 'patient' ? -0.01 : planOf(B).aggression === 'aggressive' || planOf(B).spin === 'flat' ? 0.008 : 0),
      (b, won) => b.drop(b.i, won ? 'won' : b.roll() < 0.6 ? 'chased' : 'net')),
  },
  'Creative Shotmaker': {
    serve: SPM('under', '🤡', 'Underarm Serve', 'UNDERARM', 'The cheeky underarm. Crushing against deep returners; once seen, they creep in.', {},
      (A, B) => ({ deep: 0.04, inside: -0.03 }[planOf(B).returnPos] ?? 0.01) + 0.0015 * (attr(A, 'iq') - attr(B, 'iq')),
      (b, won) => b.underarm(won), 0.5),
    ret: SPM('fakedrop', '🪄', 'Fake Drop, Hit Deep', 'FAKE DROP', 'Shape up for the drop shot, then hit deep behind them. Smart players aren\'t fooled.', {},
      (A, B) => 0.006 + 0.002 * (attr(A, 'iq') - attr(B, 'iq')) - (planOf(B).net === 'often' ? 0.005 : 0),
      (b, won) => won ? b.rally(b.i, 'winner', 4, 6, { fx: { fake: true } }) : b.rally(b.o, 'ue', 5, 5)),
  },
};
const SPECIAL_LIST = Object.values(SPECIALS).flatMap(x => [x.serve, x.ret]);
const specById = id => SPECIAL_LIST.find(x => x.id === id);
// The court and the big-point helpers read a move's look (serve aim, return position) the same way as a call's.
SPECIAL_LIST.forEach(x => { CALL_FX[x.id] = x.fx; });

// All-Court's Opposite Pattern: what beats this opponent's position, or nothing against a balanced plan.
function allCourtCounter(B) {
  const op = planOf(B), fam = famOf(spStyle(B));
  if (spRushes(B, op)) return 'lob';
  if (op.aggression === 'patient' || op.returnPos === 'deep' || fam === 'defend') return 'drop';
  if (op.aggression === 'aggressive' || op.returnPos === 'inside') return 'deep';
  return null;
}

// The move player i can use on this point (serve or return side), or null (none for the style, or all used).
function specialFor(m, ps, i, side) {
  if (!SPECIALS_ON) return null;
  const set = SPECIALS[(m.styles || [])[i] || spStyle(ps[i])];
  if (!set || ((m.sp && m.sp.used[i]) || 0) >= SPECIAL_USES) return null;
  return set[side];
}
const specialsLeft = (m, i) => SPECIAL_USES - ((m.sp && m.sp.used[i]) || 0);

// The edge shown on the button and applied to the point. Each time a move is used, the opponent reads it better
// (legends faster), so the second and third goes are worth less.
function specialEdge(m, ps, i, sp, ev) {
  const A = ps[i], B = ps[1 - i], seen = (m.sp && m.sp.seen[i][sp.id]) || 0;
  const raw = sp.edge(A, B, ev, m), learn = Math.max(0, 1 - sp.decay * (isLegend(B) ? 1.4 : 1)) ** seen;
  return clamp((raw > 0 ? raw * learn : raw) - 0.006 * seen, -0.09, 0.09);
}

function makeSpecial(m, ps, i, sp, ev) {
  m.sp = m.sp || { used: [0, 0], seen: [{}, {}], log: [] };
  const edge = specialEdge(m, ps, i, sp, ev);
  m.sp.used[i]++;
  m.sp.seen[i][sp.id] = (m.sp.seen[i][sp.id] || 0) + 1;
  m.call = null;
  m.spec = { side: i, id: sp.id, edge };
}

// After the point: remember how it went. A move that fails costs a little momentum.
function endSpecial(m, winner) {
  const x = m.spec, won = winner === x.side;
  m.sp.log.push({ side: x.side, id: x.id, won });
  if (!won) m.mo = clamp((m.mo || 0) + (x.side === 0 ? -1 : 1) * 0.015, -MO_MAX, MO_MAX);
  m.spec = null;
}

// An opponent's choice on a big point: they use a move when it suits the matchup (not every time).
function oppWantsSpecial(m, ps, i, side, ev, roll) {
  const sp = specialFor(m, ps, i, side);
  if (!sp) return null;
  const e = specialEdge(m, ps, i, sp, ev);
  return roll < (e > 0.015 ? 0.5 : e > 0.005 ? 0.25 : 0) ? sp : null;
}

// Point builders: every shape is one of the engine's point types, so the court plays it as it would any point.
function spBuilder(m, s, i, rng) {
  const r = 1 - s, o = 1 - i, S = m.stats;
  const hit = k => (k % 2 === 0 ? s : r);
  const fit = (len, last) => (hit(len - 1) === last ? len : len + 1);
  const between = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  return {
    i, o, s, r, roll: () => rng(),
    ace: (x = {}) => { S[s].aces++; return { w: s, pt: { how: 'ace', len: 1, serve2: !!x.second }, fx: x.second ? { bomb2: true } : {} }; },
    unret: () => ({ w: s, pt: { how: 'unreturned', len: 1 } }),
    df: () => { S[s].df++; return { w: r, pt: { how: 'df', serve2: true }, fx: { bomb2: true } }; },
    retWin: () => { S[r].winners++; return { w: r, pt: { how: 'winner', len: 2, returnWinner: true } }; },
    retErr: (x = {}) => { S[r].ue++; return { w: s, pt: { how: 'ue', len: 2, serve2: !!x.second, net: x.rush ? { by: s, won: true, style: 'snv' } : null } }; },
    // A rally that ends on a winner by w, or an error by the other player.
    rally: (w, how, lo, hi, x = {}) => {
      const last = how === 'winner' ? w : 1 - w;
      if (how === 'winner') S[w].winners++; else if (how === 'ue') S[1 - w].ue++;
      return { w, pt: { how, len: fit(between(lo, hi), last), wing: x.wing || null }, fx: { ...(x.fx || {}), insideOut: !!x.insideOut } };
    },
    // A point at the net: by comes in and wins (a volley or smash) or loses (passed, lobbed or a missed volley).
    net: (by, won, style, x = {}) => {
      const w = won ? by : 1 - by, clean = (x.fx && (x.fx.lob || x.fx.smash)) || rng() < 0.7, how = clean ? 'winner' : won ? 'fe' : 'ue', last = clean ? w : 1 - w;
      S[by].netPlayed++; if (won) S[by].netWon++;
      if (clean) S[w].winners++; else if (how === 'ue') S[1 - w].ue++;
      const len = style === 'snv' ? (last === s ? 3 : 2) : style === 'chip' ? (last === by ? 4 : 3) : fit(between(x.lo || 3, x.hi || 6), last);
      return { w, pt: { how, len, net: { by, won, style }, serve2: !!x.second }, fx: x.fx || {} };
    },
    drop: (by, result) => {
      const w = result === 'won' ? by : 1 - by, last = result === 'net' ? by : w;
      S[by].dropPlayed = (S[by].dropPlayed || 0) + 1;
      if (result === 'won') { S[by].dropWon = (S[by].dropWon || 0) + 1; S[by].winners++; } else if (result === 'net') S[by].ue++; else S[w].winners++;
      return { w, pt: { how: { won: 'drop', net: 'dropnet', chased: 'dropchased' }[result], len: fit(between(3, 6), last), drop: { by, result } } };
    },
    underarm: won => {
      S[s].underarm = (S[s].underarm || 0) + 1;
      if (won) S[s].underarmWon = (S[s].underarmWon || 0) + 1; else S[r].winners++;
      return { w: won ? s : r, pt: { how: won ? 'underarmWin' : 'underarmLost', underarm: true, len: won ? 1 : 2 } };
    },
  };
}

// The point itself: who wins is decided first, from the point odds with the move's edge (as on every point).
// Then the move's pattern for a win or a loss is what gets played (and shown on court).
function specialPoint(m, ps, ev, s, clutch, rng, ad) {
  const x = m.spec, sp = specById(x.id), i = x.side, r = 1 - s, A = ps[s], st = m.stats[s];
  const p = pointProb(m, ps, ev, s, clutch, ad);
  const w = rng() < p ? s : r;
  const res = sp.shape(spBuilder(m, s, i, rng), w === i, ps[i], ps[1 - i], ev, m);
  const pt = { serve2: false, net: null, ...res.pt, call: { side: i, id: sp.id }, spec: { by: i, id: sp.id, ...(res.fx || {}) } };
  // Serve numbers, as servePoint keeps them.
  st.servePts++;
  pt.kmh1 = Math.round(140 + A.attrs.serve * 0.8 + ((SERVE_PLAN[planOf(A).serve] || {}).kmh || 0) + gauss(rng) * 6 + (i === s && ['big', 't', 'body'].includes(sp.fx.serve) ? 8 : 0));
  if (!pt.serve2) {
    st.firstIn++; st.sp1 += pt.kmh1; st.sp1n++; st.spMax = Math.max(st.spMax, pt.kmh1);
    if (res.w === s) st.firstWon++;
  } else {
    // Second-Serve Bomb: the second serve goes at first-serve pace.
    pt.kmh2 = pt.spec.bomb2 ? pt.kmh1 - Math.round(rng() * 6) : Math.round(115 + A.attrs.serve * 0.6 + gauss(rng) * 5);
    if (pt.how !== 'df') { st.sp2 += pt.kmh2; st.sp2n++; st.spMax = Math.max(st.spMax, pt.kmh2); if (res.w === s) st.secondWon++; }
  }
  return { w: res.w, pt };
}

// Court extras for a move's point (called from buildRally): the lob, the smash, the inside-out forehand, the drive
// approach and the fake drop.
function specCourt(shots, pt) {
  const x = pt.spec;
  if (!x) return;
  const body = shots.filter(sh => sh.kind !== 'fault'), fin = body[body.length - 1], prev = body[body.length - 2];
  if (!fin) return;
  if (x.lob && fin.kind === 'winner') fin.lob = true;
  if (x.smash && prev && fin.kind === 'volley') { prev.lob = true; prev.shortLob = true; }
  if (x.insideOut && fin.kind === 'winner' && prev) { fin.forceWing = 'fh'; prev.aimWing = 'bh'; fin.insideOut = true; }
  if (x.drive) { const ap = body.find(sh => sh.kind === 'approach' && sh.by === x.by); if (ap) ap.drive = true; }
  if (x.fake && fin.by === x.by && fin.kind === 'winner') fin.fake = true;
}

// Big-point button for your move, and how the match went for the moves (for the match record).
function specialButton(m, ps, me, sp, ev, rec) {
  const e = specialEdge(m, ps, me, sp, ev), pct = `${e >= 0 ? '+' : '−'}${(Math.abs(e) * 100).toFixed(1)}%`;
  return `<button type="button" data-call="sp" class="spbtn${rec ? ' rec' : ''}" title="${esc(sp.desc)}"><span>${sp.icon}</span><b>${sp.title}</b>` +
    `<small class="${e >= 0 ? 'up' : 'down'}">${pct} On This Point</small><em class="sppill">⭐ Speciality · ${specialsLeft(m, me)} Left</em>` +
    (rec ? '<em class="recpill">🧑‍🏫 Coach\'s Pick</em>' : '') + '</button>';
}
function specialRecord(m, me) {
  const log = (m.sp && m.sp.log) || [], mine = log.filter(x => x.side === me), theirs = log.filter(x => x.side !== me);
  if (!log.length) return null;
  return { made: mine.length, won: mine.filter(x => x.won).length, opp: theirs.length, oppWon: theirs.filter(x => x.won).length };
}
