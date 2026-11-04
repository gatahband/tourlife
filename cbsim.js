// cbsim.js — Court Breaker (TourLife Extreme): the shot-by-shot point simulator. No screen code here.
// Its own model, separate from the main match engine (sim.js): it only reads player ratings and playstyles.
// Court in metres: x across (singles sideline at ±4.115), y along (net at 0, baselines at ±11.885).
// Side 0 is the near side (y < 0, you), side 1 the far side. Every shot is resolved from where the hitter is,
// how much time they had, the ball they chose, and where the other player is when it crosses the net.

const CB = { HL: 11.885, HW: 4.115, DW: 5.485, SL: 6.40 };
// Ball types. v: average speed (m/s); sig: aim scatter at skill 50 (metres); net: chance of the net;
// bounce: how far it carries after the bounce (m); apex: height over the net (for drawing); q: how heavy it is deep.
const CB_SHOT = {
  topspin: { v: 24, sig: 0.95, net: 0.022, bounce: 3.6, apex: 2.4, q: 0.2 },
  flat:    { v: 30, sig: 1.3, net: 0.045, bounce: 3.3, apex: 1.3, q: 0.18 },
  slice:   { v: 20, sig: 0.95, net: 0.03, bounce: 2.4, apex: 1.5, q: 0.08 },
  lob:     { v: 12.5, sig: 1.4, net: 0.004, bounce: 4.4, apex: 7, q: 0 },
  drop:    { v: 10, sig: 1.25, net: 0.1, bounce: 0.8, apex: 1.4, q: 0 },
};
const CB_TYPES = ['topspin', 'flat', 'slice', 'lob'];
const CB_SERVES = ['flat', 'slice', 'kick'];
const CB_ZONES = ['wide', 'body', 't'];
// Quicker movers among the playstyles (metres per second added to foot speed).
const CB_FAST = { 'Counterpuncher': 0.45, 'Defensive Grinder': 0.55, 'All-Court': 0.2, 'Heavy-Topspin Baseliner': 0.15, 'Serve-Dominant': -0.3, 'Serve-and-Volley': -0.05, 'Flat Attacker': -0.1 };
// The ball each playstyle likes to hit (a small pull in its choices) and its risk appetite (−1 patient … +1 bold).
const CB_FAV = { 'Heavy-Topspin Baseliner': 'topspin', 'Heavy-Topspin Attacker': 'topspin', 'Flat Attacker': 'flat', 'Aggressive Baseliner': 'flat',
  'First-Strike Attacker': 'flat', 'Serve +1 Attacker': 'flat', 'Variety / Slice-Heavy': 'slice', 'Creative Shotmaker': 'slice', 'Counterpuncher': 'topspin', 'Defensive Grinder': 'topspin', 'Solid Baseliner': 'topspin' };
const CB_RISK = { 'Serve-Dominant': 0.4, 'Serve +1 Attacker': 0.6, 'First-Strike Attacker': 0.8, 'Aggressive Baseliner': 0.6, 'Flat Attacker': 0.9, 'Solid Baseliner': 0,
  'Counterpuncher': -0.5, 'Defensive Grinder': -0.8, 'Heavy-Topspin Baseliner': -0.2, 'Heavy-Topspin Attacker': 0.4, 'All-Court': 0.1, 'Net Attacker': 0.3, 'Serve-and-Volley': 0.4, 'Variety / Slice-Heavy': -0.1, 'Creative Shotmaker': 0.5 };
const CB_NETTY = { 'Net Attacker': 0.6, 'Serve-and-Volley': 0.8, 'All-Court': 0.3, 'Variety / Slice-Heavy': 0.25, 'Creative Shotmaker': 0.2, 'First-Strike Attacker': 0.15 };
const CB_SURF = { hard: { post: 0.62, bounce: 1, low: 0, high: 0 }, clay: { post: 0.52, bounce: 0.95, low: -0.04, high: 0.07 }, grass: { post: 0.72, bounce: 1.12, low: 0.09, high: -0.04 } };

const cbClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cbFwd = side => (side === 0 ? 1 : -1); // the direction side's shots travel (towards the other baseline)
const cbDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function cbGauss(rng) { let u = 0; while (!u) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); }
function cbPhi(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
// Skill to scatter: 30 sprays the ball, 90 paints lines.
const cbSkf = s => cbClamp(1.42 - 0.0128 * (s - 30), 0.55, 1.55);

// A player's Court Breaker abilities, from their TourLife ratings and playstyle.
function cbAbilities(p) {
  const a = k => (p.attrs && p.attrs[k]) ?? 50;
  const style = typeof styleOf === 'function' ? styleOf(p).name : 'All-Court';
  const plan = typeof planOf === 'function' ? planOf(p) : (p.plan || {});
  const gap = typeof wingGap === 'function' ? wingGap(p) : 0; // + means the backhand is the weaker wing
  const g = a('ground');
  return { name: p.name, style, lefty: p.hand === 'left', oneBh: p.backhand === 'one', fh: g + 5 * gap, bh: g - 9 * gap, ground: g,
    serve: a('serve'), ret: a('ret'), net: a('net'), stam: a('stam'), mental: a('mental'), iq: a('iq'),
    spd: 5.9 + 0.032 * (a('stam') - 50) + (CB_FAST[style] || 0), react: 0.27 - 0.0012 * (a('iq') - 50),
    risk: CB_RISK[style] ?? 0, fav: CB_FAV[style] || null, netty: CB_NETTY[style] || 0, retPos: plan.returnPos || 'normal' };
}

// Which wing a ball at `at` is for the player at `pos` on `side` (a ball right at them goes to the stronger wing).
function cbWing(ab, side, pos, at) {
  const off = (at.x - pos.x) * cbFwd(side) * (ab.lefty ? -1 : 1);
  if (Math.abs(off) < 0.35) return ab.fh >= ab.bh ? 'fh' : 'bh';
  return off > 0 ? 'fh' : 'bh';
}
// Lane of a shot from contact `from` to target `to`: crosscourt, down the line, or through the middle.
function cbLane(from, to) {
  if (Math.abs(to.x) < 1.1) return 'middle';
  return Math.sign(to.x) === Math.sign(from.x || 0.01) ? 'line' : 'cross';
}

// A new point. ab: [near, far] abilities; o: { surface, wx, server, deuce, clutch:[0..1,0..1], tired:[0..1,0..1], mem }.
function cbNewPoint(ab, o) {
  const surf = CB_SURF[o.surface] || CB_SURF.hard, wx = o.wx || {};
  return { ab, surf, surface: o.surface || 'hard', wind: 1 + (wx.ue || 0) * 1.6, pace: wx.pace || 1, server: o.server ?? 0, deuce: o.deuce !== false,
    clutch: o.clutch || [0, 0], tired: o.tired || [0, 0], mem: o.mem || cbMemory(), pos: [{ x: 0, y: -12.2 }, { x: 0, y: 12.2 }],
    pr: [0, 0], atNet: [false, false], shots: [], over: null, serve2: false, inc: null };
}
// What the opponent remembers of your patterns this match (kept small: counts only).
const cbMemory = () => ({ lanes: { fh: { cross: 0, line: 0, middle: 0 }, bh: { cross: 0, line: 0, middle: 0 } }, serve: { d: { wide: 0, body: 0, t: 0 }, a: { wide: 0, body: 0, t: 0 } } });

// Scatter (metres, across) for a shot.
function cbSigma(st, by, type, wing, volley, ret) {
  const A = st.ab[by], T = CB_SHOT[type];
  let skill = volley ? A.net : wing === 'bh' ? A.bh : A.fh;
  if (ret) skill = 0.55 * A.ret + 0.45 * skill;
  if (type === 'drop' || type === 'lob') skill = 0.6 * skill + 0.4 * A.iq; // touch
  const long = Math.max(0, st.shots.length - 6) * 0.012 * (1.35 - A.stam / 100);
  return 0.5 * T.sig * cbSkf(skill) * (1 + 0.95 * st.pr[by]) * (1 + 0.22 * st.clutch[by] + 0.14 * st.tired[by] + long) * (type === 'flat' || type === 'lob' ? st.wind : 1 + (st.wind - 1) * 0.5) * (volley ? 0.8 : 1);
}

// Where and when the receiver meets a ball that lands at `land`, and how hard it is for them. Deterministic, so
// the computer can weigh up shots with it. rcvPos: where the receiver is as the ball is struck.
function cbMeet(st, by, from, land, type, rcvPos, read = 0) {
  const r = 1 - by, B = st.ab[r], T = CB_SHOT[type], sf = st.surf;
  let v = T.v * st.pace * (type === 'flat' || type === 'topspin' ? 1 + 0.004 * (st.ab[by].ground - 50) : 1) * (1 - 0.22 * Math.min(1, st.pr[by])) * (st.smash ? 1.35 : 1);
  const dx = land.x - from.x, dy = land.y - from.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  if (type !== 'lob' && type !== 'drop' && !st.smash) v *= cbClamp(Math.pow(L / 23, 0.6), 0.72, 1.05); // a short ball has to be hit slower to dip in
  const atNet = Math.abs(rcvPos.y) < 6.2;
  let contact, time, volley = false;
  if (atNet && type !== 'lob' && type !== 'drop' && Math.abs(land.y) > Math.abs(rcvPos.y) - 0.4) {
    // A volley: met on the way through, where the ball crosses their line.
    const k = Math.max(0.1, (rcvPos.y - from.y) / dy);
    contact = { x: from.x + dx * k, y: rcvPos.y }; time = L * k / v; volley = true;
  } else {
    const bl = T.bounce * sf.bounce * (type === 'slice' && st.surface === 'grass' ? 1.1 : 1);
    contact = { x: cbClamp(land.x + ux * bl, -7, 7), y: land.y + uy * bl };
    if (Math.abs(contact.y) > 15.5) contact.y = Math.sign(contact.y) * 15.5;
    time = L / v + (type === 'drop' ? 0.75 * (st.surface === 'grass' ? 0.8 : 1) : type === 'lob' ? 0.7 : bl / (sf.post * v)); // a drop sits up; a lob comes down from high
  }
  // Reading the shot: a correct read gets them moving early; a wrong one sends them the wrong way first.
  const react = B.react + (read < 0 ? 0.12 : read > 0 ? -0.07 : 0) + (volley ? 0.03 : 0);
  const d = cbDist(rcvPos, contact), reach = volley ? 1.4 : 1.35, sp = B.spd * (1 - 0.07 * st.tired[r]);
  const slack = time - react - Math.max(0, d - reach) / sp;
  let pr = slack >= 0 ? cbClamp(0.85 - slack * 1.05, 0, 0.85) : 0.85 + Math.min(0.6, -slack * 1.5);
  // The ball itself: depth and weight, the weaker wing, height, and being pushed well back.
  const wing = cbWing(B, r, rcvPos, contact);
  const deep = cbClamp((Math.abs(land.y) - 8.6) / 2.8, 0, 1);
  pr += T.q * deep * (type === 'topspin' ? 1 + sf.high * 3 : 1) + (type === 'flat' ? 0.05 * deep * (v / 30) : 0);
  if (wing === 'bh' && B.bh < B.fh) pr += cbClamp((B.fh - B.bh) / 45, 0, 0.22); else if (wing === 'fh' && B.fh < B.bh) pr += cbClamp((B.bh - B.fh) / 45, 0, 0.22);
  if (type === 'topspin' && wing === 'bh' && B.oneBh) pr += 0.08 * deep;
  if (type === 'slice') pr += sf.low + (wing === 'bh' ? 0.03 : 0);
  if (Math.abs(contact.y) > 13.6 && !volley) pr += 0.08;
  { const edge = Math.min(CB.HW - Math.abs(land.x), CB.HL - Math.abs(land.y)); if (edge < 0.6 && edge >= 0 && !volley) pr += 0.15 * (1 - edge / 0.6); } // a ball on the line is harder to handle
  if (volley && type === 'topspin' && Math.abs(land.y) < 7) pr += 0.3;
  if (volley && Math.abs(contact.y) > 4.5) pr += 0.12; // a first volley from around the service line // a dipping pass at the feet
  if (atNet && type === 'lob') pr += 0.25; // turned around, running back
  return { contact, time, slack, pr: cbClamp(pr, 0, 1.6), wing, volley, v };
}

// Where a player heads after hitting: the middle of the angles the other player has, or the net.
function cbRecoverSpot(side, oppContact, approach) {
  const f = cbFwd(side);
  return approach ? { x: oppContact.x * 0.45, y: -f * 2.4 } : { x: oppContact.x * 0.38, y: -f * 12.5 };
}
function cbMoveToward(pos, to, dist) {
  const d = cbDist(pos, to);
  if (d <= dist || d < 1e-6) return { ...to };
  return { x: pos.x + (to.x - pos.x) * dist / d, y: pos.y + (to.y - pos.y) * dist / d };
}

// How the receiver reads a shot from your patterns (+1 read right, −1 wrong-footed, 0 no read).
function cbReadOf(st, by, from, to, w) {
  if (by === 0 && st.forceRead) { const r = st.forceRead; st.forceRead = 0; return r; } // a play they've seen before (cbxp.js)
  if (by !== 0) { // you read them by choosing which lane to cover after your shot (st.cover), if you chose one
    if (!st.cover) return 0;
    const lane = cbLane(from, to);
    return lane === st.cover ? 1 : lane === 'middle' ? 0 : -1;
  }
  const B = st.ab[1], c = st.mem.lanes[w], n = c.cross + c.line + c.middle;
  if (n < 3) return 0;
  const lane = cbLane(from, to), best = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  const conf = c[best] / n - 0.34, sharp = cbClamp((B.iq - 35) / 50, 0.1, 1);
  if (conf * sharp < 0.12) return 0;
  return lane === best ? 1 : (best !== 'middle' && lane !== 'middle' ? -1 : 0);
}
// The lane the computer expects from you right now (for its lean on court), or null.
function cbExpect(st) {
  const w = st.inc ? st.inc.wing : 'fh', c = st.mem.lanes[w], n = c.cross + c.line + c.middle;
  if (n < 3) return null;
  const best = Object.keys(c).sort((a, b) => c[b] - c[a])[0], conf = c[best] / n - 0.34, sharp = cbClamp((st.ab[1].iq - 35) / 50, 0.1, 1);
  return conf * sharp >= 0.12 ? best : null;
}

// Hits a shot: from the hitter's contact point towards aim, with ball type. Returns what happened.
// approach: follow it in to the net. rng: random source.
function cbHit(st, by, aim, type, approach, rng = Math.random) {
  const r = 1 - by, from = { ...st.pos[by] }, f = cbFwd(by), volley = !!(st.inc && st.inc.volley);
  if (type === 'slice' && Math.abs(aim.y) < 4.8 && !volley) type = 'drop'; // a short slice is a drop shot
  const ret = st.shots.length === 1, wing = st.inc ? st.inc.wing : 'fh';
  const sg = cbSigma(st, by, type, wing, volley, ret);
  const short = type === 'lob' || type === 'drop' ? 0 : Math.min(1.2, st.pr[by]) * 0.8 * f; // under pressure the ball lands shorter
  const land = { x: aim.x + cbGauss(rng) * sg, y: aim.y - short + cbGauss(rng) * sg * 1.1 };
  if (Math.abs(aim.x) >= 1.2 && Math.sign(land.x) !== Math.sign(aim.x)) land.x = aim.x * 0.35; // the side you chose is the side it goes: a miss is long, wide or short, never the other way
  const shot = { by, from, aim: { ...aim }, land, type, approach: !!approach, pr: st.pr[by], wing, lane: cbLane(from, aim), volley };
  st.shots.push(shot);
  if (by === 0) st.mem.lanes[wing][shot.lane]++;
  const pNet = CB_SHOT[type].net * (1 + 1.8 * st.pr[by]) * cbSkf(volley ? st.ab[by].net : st.ab[by].ground) ** 2 * (Math.abs(aim.y) < 7 && type !== 'lob' ? 1.5 : 1);
  if (rng() < pNet || land.y * f < 0.3) { shot.err = 'net'; shot.land = { x: aim.x * 0.4 + from.x * 0.6, y: 0 }; return cbEnd(st, r, 'err', shot); }
  if (Math.abs(land.x) > CB.HW || Math.abs(land.y) > CB.HL) { shot.err = 'out'; return cbEnd(st, r, 'err', shot); }
  // The receiver as the ball is struck: where they got to, leaning on a read of you.
  const read = cbReadOf(st, by, from, aim, wing);
  shot.rcvFrom = { ...st.pos[r] };
  const meet = cbMeet(st, by, from, land, type, st.pos[r], read);
  Object.assign(shot, { met: meet.volley, read, slack: meet.slack, pr2: meet.pr, contact: meet.contact, time: meet.time, kmh: Math.round(meet.v * 3.6 / 0.78) });
  // The hitter recovers while the ball travels (a fast ball gives you less time to get back too).
  st.atNet[by] = st.atNet[by] || approach;
  const spot = cbRecoverSpot(by, meet.contact, st.atNet[by]);
  st.pos[by] = cbMoveToward(from, spot, Math.max(0, meet.time - 0.22 - 0.3 * Math.min(1, st.pr[by])) * st.ab[by].spd * (st.atNet[by] ? 1 : 0.92)); // stretched: slower to get back
  shot.after = { ...st.pos[by] };
  if (meet.slack < -0.5 || (meet.slack < 0 && rng() > 0.9 + meet.slack * 1.6)) return cbEnd(st, by, 'winner', shot);
  st.pos[r] = meet.contact; st.pr[r] = meet.pr; st.atNet[r] = Math.abs(meet.contact.y) < 6.2;
  st.inc = { by, type, volley: meet.volley, rcvPos: meet.contact, wing: meet.wing };
  st.smash = type === 'lob' && Math.abs(meet.contact.y) < 9.5 && meet.slack > 0.15;
  return { shot, next: r };
}

function cbEnd(st, w, kind, shot) {
  const how = kind === 'winner' ? 'winner' : kind === 'ace' ? 'ace' : kind === 'unret' ? 'unreturned' : kind === 'df' ? 'df' : shot && shot.pr >= 0.55 ? 'fe' : 'ue';
  st.over = { w, how, shot };
  return { shot, over: st.over };
}

// --- Serving ------------------------------------------------------------------------------------------
// Where the server stands, and where each serve zone is in the box they serve into.
function cbServeSpot(st) {
  const s = st.server, f = cbFwd(s), side = st.deuce ? 1 : -1;
  return { x: 0.8 * side * f, y: -f * 12.05 };
}
function cbServeTarget(st, zone) {
  const s = st.server, f = cbFwd(s), sx = Math.sign(cbServeSpot(st).x), bx = -sx;
  const x = zone === 'wide' ? 3.5 : zone === 't' ? 0.4 : 2.0;
  return { x: bx * x, y: f * 5.55 };
}
function cbReturnSpot(st) {
  const r = 1 - st.server, f = cbFwd(st.server), sx = Math.sign(cbServeSpot(st).x);
  const back = { deep: 1.4, inside: -0.8 }[st.ab[r].retPos] || 0;
  return { x: -sx * 1.9, y: f * (12.1 + back) };
}
// The computer returner's guess from your serving pattern on this side (and a little playstyle sense).
function cbGuessServe(st, rng = Math.random) {
  if (st.server !== 0) return null;
  const c = st.mem.serve[st.deuce ? 'd' : 'a'], n = c.wide + c.body + c.t, B = st.ab[1];
  const sharp = cbClamp((B.iq - 30) / 55, 0.1, 1);
  const w = CB_ZONES.map(z => (c[z] + 1.2) / (n + 3.6));
  const pick = CB_ZONES.map((z, i) => [z, Math.pow(w[i], 1 + 3 * sharp) * (0.7 + 0.6 * rng())]).sort((a, b) => b[1] - a[1])[0][0];
  return n >= 2 || rng() < 0.4 ? pick : null;
}
const cbGuessHit = (zone, guess) => !guess ? 0 : guess === zone ? 1 : (zone === 'body' || guess === 'body') ? 0 : -1;

// One serve: zone and spin, second serve or not, and the returner's guess (null = no guess).
function cbServe(st, zone, spin, guess, approach, rng = Math.random) {
  const s = st.server, r = 1 - s, A = st.ab[s], f = cbFwd(s), second = st.serve2;
  const pf = { flat: 0.45, slice: 0.35, kick: 0.22 }[spin] * cbClamp(1.36 - 0.013 * (A.serve - 30), 0.6, 1.5)
    * (second ? 0.42 : 1) + (zone === 'body' ? -0.05 : 0.04) + 0.06 * st.clutch[s] + 0.03 * (st.wind - 1) * 10 * (spin === 'flat' ? 1 : 0.4);
  const from = cbServeSpot(st), tgt = cbServeTarget(st, zone);
  if (s === 0) st.mem.serve[st.deuce ? 'd' : 'a'][zone]++;
  const kmh = Math.round((158 + 0.62 * A.serve) - ({ flat: 0, slice: 18, kick: 32 })[spin] - (second ? 10 : 0) + cbGauss(rng) * 4);
  const shot = { by: s, from, serve: true, zone, spin, kmh, guess, second, approach: !!approach };
  if (rng() < cbClamp(pf, 0.03, 0.75)) {
    shot.err = rng() < 0.55 ? 'net' : 'out';
    shot.land = shot.err === 'net' ? { x: (from.x + tgt.x) / 2, y: 0 } : { x: tgt.x * 1.05, y: f * (CB.SL + 0.5) };
    st.shots.push(shot);
    if (!second) { st.serve2 = true; st.shots = []; return { shot, fault: true }; }
    return { shot, over: cbEnd(st, r, 'df', shot).over };
  }
  const land = { x: cbClamp(tgt.x + cbGauss(rng) * 0.35, -CB.HW + 0.05, CB.HW - 0.05), y: f * cbClamp(Math.abs(tgt.y) + cbGauss(rng) * 0.3, 3.5, CB.SL - 0.05) };
  shot.land = land; st.shots.push(shot);
  // The returner: in their spot, shifted by their guess.
  const g = cbGuessHit(zone, guess), B = st.ab[r];
  let rp = cbReturnSpot(st);
  if (guess) { const gt = cbServeTarget(st, guess); rp = cbMoveToward(rp, { x: gt.x, y: rp.y }, 0.55); }
  const v = kmh / 3.6 * 0.76 * st.pace * ({ grass: 1.05, clay: 0.95 }[st.surface] || 1), dx = land.x - from.x, dy = land.y - from.y, L = Math.hypot(dx, dy);
  const curl = spin === 'slice' ? 0.9 * Math.sign(land.x || 1) * (zone === 'wide' ? 1 : 0.4) : 0; // slice swings away
  const bl = ({ flat: 3.1, slice: 2.7, kick: 3.6 })[spin] * st.surf.bounce;
  const contact = { x: land.x + dx / L * bl + curl, y: land.y + dy / L * bl };
  const time = L / v + bl / (st.surf.post * v * (spin === 'kick' ? 0.85 : 1));
  const react = B.react - 0.07 + (g > 0 ? -0.1 : g < 0 ? 0.12 : 0);
  const slack = time - react - Math.max(0, cbDist(rp, contact) - 1.4) / (B.spd + 0.45);
  Object.assign(shot, { slack, contact, read: g, rcvFrom: { ...rp }, time });
  if (slack < -0.22) return { shot, over: cbEnd(st, s, 'ace', shot).over };
  let pr = slack >= 0 ? cbClamp(0.9 - slack * 1.4, 0.1, 0.9) : 0.9 + Math.min(0.5, -slack * 1.6);
  pr *= cbClamp(1.25 - 0.008 * (B.ret - 30), 0.6, 1.3) * (second ? 0.72 : 1);
  const wing = cbWing(B, r, rp, contact);
  if (spin === 'kick' && wing === 'bh') pr += (B.oneBh ? 0.14 : 0.07) + st.surf.high;
  if (wing === 'bh' && B.bh < B.fh) pr += cbClamp((B.fh - B.bh) / 50, 0, 0.18);
  if (spin === 'slice') pr += st.surf.low;
  if (slack < 0.05 && rng() > 0.86 + (slack - 0.05) * 2) return { shot, over: cbEnd(st, s, 'unret', shot).over };
  shot.pr2 = cbClamp(pr, 0, 1.5); shot.wing = wing;
  // The server recovers from the follow-through (or comes in behind it).
  st.atNet[s] = !!approach;
  st.pos[s] = cbMoveToward({ x: from.x, y: from.y + f * 0.6 }, cbRecoverSpot(s, contact, approach), Math.max(0, time - 0.3) * A.spd);
  shot.after = { ...st.pos[s] };
  st.pos[r] = contact; st.pr[r] = shot.pr2; st.inc = { by: s, type: 'flat', volley: false, rcvPos: contact, wing };
  return { shot, next: r };
}

// --- The computer's choices -------------------------------------------------------------------------------
// Targets it weighs up (on the other side of the net from `by`): depths, angles, drops and lobs.
function cbCandidates(by) {
  const f = cbFwd(by), out = [];
  for (const x of [-3.2, -1.9, 0, 1.9, 3.2]) for (const d of [10.3, 8.4]) for (const t of ['topspin', 'flat', 'slice']) out.push({ x, y: f * d, t });
  for (const x of [-3.5, 3.5]) for (const t of ['topspin', 'slice']) out.push({ x, y: f * 6.2, t });
  for (const x of [-2.2, 2.2]) out.push({ x, y: f * 2.8, t: 'slice' });
  for (const x of [-2.2, 0, 2.2]) out.push({ x, y: f * 10.4, t: 'lob' });
  return out;
}
// How good a shot is on paper: the chance it goes in, times how much trouble it puts the receiver in,
// less the court it leaves open behind the hitter. Also used to coach you after the point.
function cbValue(st, by, aim, type, approach) {
  const from = st.pos[by], volley = !!(st.inc && st.inc.volley);
  const t = type === 'slice' && Math.abs(aim.y) < 4.8 && !volley ? 'drop' : type;
  const wing = st.inc ? st.inc.wing : 'fh';
  const sg = cbSigma(st, by, t, wing, volley, st.shots.length === 1);
  const sx = sg, sy = sg * 1.1, ay = Math.abs(aim.y);
  const pIn = (cbPhi((CB.HW - aim.x) / sx) - cbPhi((-CB.HW - aim.x) / sx)) * (cbPhi((CB.HL - ay) / sy) - cbPhi((0.3 - ay) / sy))
    * (1 - CB_SHOT[t].net * (1 + 1.8 * st.pr[by]) * cbSkf(st.ab[by].ground) ** 2);
  const sh = t === 'lob' || t === 'drop' ? 0 : Math.min(1.2, st.pr[by]) * 0.8 * cbFwd(by);
  const m = cbMeet(st, by, from, { x: aim.x, y: aim.y - sh }, t, st.pos[1 - by], 0);
  const hurt = m.slack < -0.5 ? 1 : m.slack < 0 ? 0.8 + 0.2 * Math.min(1, -m.slack / 0.5) : 0.38 + 0.36 * Math.min(1.2, m.pr) / 1.2;
  // Court left open: how far short of a good spot the hitter will be when the reply comes.
  const spot = cbRecoverSpot(by, m.contact, approach || st.atNet[by]);
  const gap = cbDist(cbMoveToward(from, spot, Math.max(0, m.time - 0.22 - 0.3 * Math.min(1, st.pr[by])) * st.ab[by].spd), spot);
  let v = hurt - 0.06 * Math.min(1, gap / 3);
  if (approach) v += 0.14 * (m.pr - 0.85) + 0.06 * (st.ab[by].net - 55) / 30 - 0.05;
  return { v: cbClamp(v, 0, 1), pIn: cbClamp(pIn, 0, 1), ev: cbClamp(pIn, 0, 1) * cbClamp(v, 0, 1), meet: m, t };
}
// The computer picks a shot. Smarter players pick closer to the best; bolder playstyles accept more risk.
function cbChoose(st, by, rng = Math.random) {
  const A = st.ab[by], k = 1 - 0.22 * A.risk, temp = cbClamp(0.085 - 0.0011 * (A.iq - 40), 0.018, 0.11);
  const opts = [];
  for (const c of cbCandidates(by)) {
    const e = cbValue(st, by, c, c.t, false);
    let u = Math.pow(e.pIn, k) * e.v + (A.fav === c.t ? 0.02 : 0);
    opts.push({ c, u, app: false });
    // Following it in: net players more often, everyone on a short ball that hurts.
    if (!st.atNet[by] && c.t !== 'lob' && Math.abs(st.pos[by].y) < 10.5 + A.netty * 2) {
      const e2 = cbValue(st, by, c, c.t, true);
      opts.push({ c, u: Math.pow(e2.pIn, k) * e2.v + 0.03 * A.netty - 0.02, app: true });
    }
  }
  const top = Math.max(...opts.map(o => o.u));
  let sum = 0;
  for (const o of opts) { o.w = Math.exp((o.u - top) / temp); sum += o.w; }
  let x = rng() * sum;
  for (const o of opts) { x -= o.w; if (x <= 0) return { aim: { x: o.c.x, y: o.c.y }, type: o.c.t, approach: o.app }; }
  const o = opts[0]; return { aim: { x: o.c.x, y: o.c.y }, type: o.c.t, approach: false };
}
// The computer's serve: zone and spin by playstyle and score, mixing it up more the smarter it is.
function cbChooseServe(st, rng = Math.random) {
  const A = st.ab[st.server], big = A.serve >= 62 && !st.serve2;
  const spin = st.serve2 ? (rng() < 0.75 ? 'kick' : 'slice') : big ? (rng() < 0.65 ? 'flat' : 'slice') : (rng() < 0.4 ? 'flat' : rng() < 0.6 ? 'slice' : 'kick');
  const r = 1 - st.server, B = st.ab[r], bhWeak = B.bh < B.fh - 3;
  const w = { wide: 1, body: st.serve2 ? 1.2 : 0.7, t: 1 };
  if (bhWeak) { const toBh = cbServeTarget(st, 'wide').x * (B.lefty ? -1 : 1) * cbFwd(r) < 0 ? 'wide' : 't'; w[toBh] += 0.8 * cbClamp((A.iq - 30) / 50, 0.2, 1); }
  let sum = w.wide + w.body + w.t, x = rng() * sum;
  const zone = (x -= w.wide) < 0 ? 'wide' : (x -= w.body) < 0 ? 'body' : 't';
  return { zone, spin, approach: !st.serve2 && rng() < A.netty * 0.55 };
}

// --- After the point: what worked and what didn't (a few short tags, never paragraphs) ----------------------------
function cbTags(st, me = 0) {
  const o = st.over, tags = [], mine = st.shots.filter(s => s.by === me && !s.serve), theirs = st.shots.filter(s => s.by !== me && !s.serve);
  if (!o) return tags;
  const won = o.w === me, last = o.shot;
  if (o.how === 'ace') tags.push(won ? { t: 'Ace', good: 1 } : { t: 'Aced', good: 0 });
  if (o.how === 'df') tags.push({ t: 'Double Fault', good: won ? 1 : 0 });
  const sv = st.shots.find(s => s.serve && !s.err);
  if (sv && sv.by === me && sv.read > 0) tags.push({ t: 'They Read Your Serve', good: 0 });
  if (sv && sv.by === me && sv.read < 0) tags.push({ t: 'Wrong-Footed Returner', good: 1 });
  if (sv && sv.by !== me && sv.read > 0) tags.push({ t: 'You Read The Serve', good: 1 });
  if (mine.some(s => s.slack !== undefined && s.slack < 0.25 && s.pr2 >= 0.7)) tags.push({ t: 'Pulled Them Wide', good: 1 });
  if (mine.some(s => s.read < 0)) tags.push({ t: 'Wrong-Footed Them', good: 1 });
  if (mine.some(s => s.read > 0)) tags.push({ t: 'They Read You', good: 0 });
  if (won && o.how === 'winner' && last && last.by === me) tags.push({ t: last.type === 'drop' ? 'Drop Shot Winner' : last.volley ? 'Volley Winner' : 'Open Court Winner', good: 1 });
  if (!won && last && last.by === me && last.err) tags.push({ t: last.pr >= 0.75 ? 'Forced Error' : last.pr < 0.35 && (last.type === 'flat' || Math.abs(Math.abs(last.aim.x) - CB.HW) < 0.9) ? 'Went For Too Much' : last.err === 'net' ? 'Into The Net' : 'Long Or Wide', good: 0 });
  if (!won && o.how === 'winner' && last && last.by !== me && theirs.length) { const mineLast = mine[mine.length - 1]; tags.push({ t: mineLast && mineLast.pr2 < 0.3 ? 'Gave Them A Short Ball' : 'Late Recovery', good: 0 }); }
  if (won && mine.some(s => s.pr >= 0.85)) tags.push({ t: 'Great Defense', good: 1 });
  if (mine.filter(s => s.pr2 >= 0.6).length >= 2 && won) tags.push({ t: 'Built The Point', good: 1 });
  return tags.slice(0, 3);
}

// Bot point (both sides chosen by the computer): for tuning and for testing.
function cbBotPoint(st, rng = Math.random) {
  for (let g = 0; g < 2 && !st.over; g++) {
    const c = cbChooseServe(st, rng), guess = cbGuessServe(st, rng) || (st.server === 1 ? (rng() < 0.6 ? CB_ZONES[Math.floor(rng() * 3)] : null) : null);
    const r = cbServe(st, c.zone, c.spin, guess, c.approach, rng);
    if (r.fault) continue;
    if (r.over) break;
    let who = r.next;
    for (let k = 0; k < 80 && !st.over; k++) { const ch = cbChoose(st, who, rng); const h = cbHit(st, who, ch.aim, ch.type, ch.approach, rng); if (h.over) break; who = h.next; }
    break;
  }
  return st.over;
}

// The result in the form the TourLife engine takes for a point you played (playpoints.js forcedPoint): w is the
// engine's player index. sideToIdx: [engine index of side 0, engine index of side 1].
function cbEngineResult(st, sideToIdx) {
  const o = st.over, sv = st.shots.find(s => s.serve) || {}, net = [0, 1].find(i => st.atNet[i]);
  const pt = { how: o.how, len: Math.max(1, st.shots.length), hands: true, serve2: !!st.serve2, kmh1: sv.kmh || 180, kmh2: sv.kmh || 150 };
  if (net !== undefined && o.how !== 'ace' && o.how !== 'df') pt.net = { by: sideToIdx[net], won: o.w === net, style: 'top' };
  return { w: sideToIdx[o.w], pt };
}
