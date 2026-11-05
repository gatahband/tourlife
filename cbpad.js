// cbpad.js — TourLife Extreme: play the points live with a PS5 (or any standard) controller. No mini-games: the ball
// flies in at full speed and you hit it by pressing at the right moment. The point itself is still played by cbsim.js
// (the timing only feeds st.touch / st.serveTouch, the same as the old timing games), so it adds no new save data
// except an on/off setting. Your player runs to the ball on their own; the sticks aim and swing.
//   Buttons: ✕ Flat · ○ Topspin · □ Slice · △ Lob. Tap = normal, hold then let go = harder (and riskier).
//   R1 + ✕ Power Flat · R1 + ○ Floater · R1 + □ Drop Shot · R1 + △ Low Lob. L1 held = the lines (perfect only; stacks
//   with R1), L2 = come in. The shot meter only appears once you start a swing.
//   Left stick at the hit: left/right = where it goes, up = deeper, down = short angle.
//   Right stick flicks: down then swoop to a side = topspin; down then flick = flat; a half circle under = drop shot;
//   top, down to the bottom and back up = lob; top to bottom = slice.
//   Serve: pull the right stick down to toss, flick it up (left / middle / right) to hit; hold ✕ Flat, ○ Kick, □ Slice.
(() => {
  if (typeof isExtreme !== 'function' || !isExtreme() || !window.xpLive) return;
  const X = window.xpLive, S = X.S;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now();

  // --- Reading the controller ------------------------------------------------------------------------------------
  const pad = () => { for (const g of (navigator.getGamepads ? navigator.getGamepads() : [])) if (g && g.connected && g.buttons && g.buttons.length >= 8) return g; return null; };
  let training = null; // the Training Room's settings while it's open (the controller is always on there)
  // On the live site the controller only plays in the Training Room for now (beta); on the test link, matches too.
  const padOn = () => (training || (TL_LOCAL && cbData().pad !== false)) && !!pad();
  window.xpPadLive = padOn;
  const DZ = 0.22;
  function read() {
    const g = pad(); if (!g) return null;
    const b = i => !!(g.buttons[i] && g.buttons[i].pressed), ax = i => +(g.axes[i] || 0), dz = v => (Math.abs(v) < DZ ? 0 : v);
    // Standard layout: 0 ✕, 1 ○, 2 □, 3 △, 4 L1, 5 R1. Stick up reads negative, so it's flipped here (up = +).
    return { g, x: b(0), o: b(1), sq: b(2), tri: b(3), l1: b(4), r1: b(5), l2: b(6) || +((g.buttons[6] || {}).value || 0) > 0.4, lx: dz(ax(0)), ly: -dz(ax(1)), rx: ax(2), ry: -ax(3) };
  }
  // A short rumble: a clean hit is a crisp tap, a mistimed one a dull thud.
  function buzz(P, strong, weak, ms) {
    const a = P && P.g && P.g.vibrationActuator;
    try { if (a && a.playEffect) a.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) { /* not every browser rumbles */ }
  }
  // Runs fn every frame with the controller state until it returns true.
  const watch = fn => new Promise(res => { const step = () => { if (fn(read(), now())) res(); else requestAnimationFrame(step); }; requestAnimationFrame(step); });

  // --- Minimal feedback: the shot meter under your player (if it's on), a hint line under the court -------------------
  // After the hit the meter holds where you let go for a moment, outlined green (perfect), yellow (good) or red.
  const cueOn = () => cbData().padCue !== false;
  const COL = { good: '#69f0ae', meh: '#ffd54f', bad: '#ff7961' };
  function tag(U, text, cls, at) {
    const col = cls === 'good' && text !== 'Perfect' ? '#c5e1a5' : COL[cls] || COL.bad;
    if (S.meter) { S.meter.done = now(); S.meter.at = at ?? now(); S.meter.col = col; }
    S.fb = { text, col, t0: now() }; // one thin word under your feet
  }
  // Button names for the controller in use: PlayStation symbols, Xbox letters, or Switch letters (same positions; the
  // browser's standard layout puts them all in the same places). Text uses {x} {o} {sq} {tri} {L1} {R1} {L2} {R2}.
  const famOf = g => { const id = String(g && g.id || '').toLowerCase(); return /xbox|xinput|045e/.test(id) ? 'xbox' : /057e|pro controller|joy-con|nintendo/.test(id) ? 'switch' : 'ps'; };
  const GLYPH = { ps: { x: '✕', o: '○', sq: '□', tri: '△', L1: 'L1', R1: 'R1', L2: 'L2', R2: 'R2' }, xbox: { x: 'A', o: 'B', sq: 'X', tri: 'Y', L1: 'LB', R1: 'RB', L2: 'LT', R2: 'RT' },
    switch: { x: 'B', o: 'A', sq: 'Y', tri: 'X', L1: 'L', R1: 'R', L2: 'ZL', R2: 'ZR' } };
  const glyphs = () => GLYPH[famOf(pad())];
  const G = str => { const g = glyphs(); return str.replace(/\{(x|o|sq|tri|L1|R1|L2|R2)\}/g, (_, k) => g[k]); };
  const HINT_RALLY = '🎮 <b>{x}</b> Flat · <b>{o}</b> Topspin · <b>{sq}</b> Slice · <b>{tri}</b> Lob · Let Go In The Green · Hold = Harder · <b>{R1}</b> = Special · <b>{L1}</b> = The Lines · <b>{L2}</b> = Come In';
  const HINT_SERVE = '🎮 Right Stick: <b>Pull Down</b> To Toss, <b>Flick Up</b> To Serve · Hold <b>{x}</b> Flat · <b>{o}</b> Kick · <b>{sq}</b> Slice · <b>{L2}</b> = Serve And Volley';

  // --- Timing ------------------------------------------------------------------------------------------------------
  // How well a press lined up with the ideal moment (ms off). Pressure, tired legs, big points and going for more
  // all narrow the window; the perfect band stays small so it can't be farmed.
  // P: the perfect (green) half-window in ms; Z: past this it's no good at all (the meter's yellow band).
  // Going for the lines (L1) is a different class of shot: the green shrinks to under half.
  const windows = (d, lines = false) => ({ P: 70 * (1 - 0.55 * d) * (lines ? 0.45 : 1), Z: 280 * (1 - 0.45 * d) * (lines ? 0.8 : 1) });
  function quality(err, d, lines = false) {
    const { P, Z } = windows(d, lines), a = Math.abs(err);
    return a <= P ? 1 : clamp(1 - (a - P) / (Z - P), 0, 1);
  }
  // How hard the shot you're making is to time. The ball you're facing (how stretched you are), tired legs and big
  // points, then the shot itself: flat and drop shots are touchier than topspin, the corners and short angles tighter
  // than through the middle, a held (harder) swing and the R1 specials tighter still (the Floater is the safe one).
  const TYPE_D = { flat: 0.12, topspin: 0, slice: 0.03, lob: 0.06, drop: 0.2 };
  // L1 (lines) and R1 (the specials) stack: both add their difficulty.
  function shotD(st, dBase, type, mod, power, lx, ly, lines = false) {
    const ax = Math.abs(lx);
    return clamp(dBase + (TYPE_D[type] || 0) + (type === 'drop' || type === 'lob' ? 0 : (ax > 0.7 ? 0.08 : 0) + (ly < -0.4 ? 0.12 : ly > 0.4 ? 0.05 : 0))
      + 0.35 * power + (mod === 'power' ? 0.2 : mod === 'floater' ? -0.15 : mod === 'lowlob' ? 0.1 : 0) + (st.inc && st.inc.volley ? 0.06 : 0) + (lines ? 0.25 : 0), 0, 0.95);
  }
  const SERVE_D = { flat: 0.1, kick: 0, slice: 0.05 };
  const NAME = { flat: 'Flat', topspin: 'Topspin', slice: 'Slice', lob: 'Lob', drop: 'Drop Shot', power: 'Power Flat', floater: 'Floater', lowlob: 'Low Lob' };
  const word = (q, early) => (q >= 0.95 ? ['Perfect', 'good'] : q >= 0.6 ? ['Good', 'good'] : q > 0 ? [early ? 'Early' : 'Late', 'meh'] : [early ? 'Way Early' : 'Way Late', 'bad']);
  let pendR = null; // the timing result for the shot just chosen, picked up by xpAskTouch below

  // --- Right-stick strokes -----------------------------------------------------------------------------------------
  // Samples the stick from the moment it leaves the middle until it has rested back in the middle for a moment.
  function stroke() {
    const G = { pts: [], on: false, restAt: 0, lastRim: 0 };
    G.step = (x, y, t) => {
      const r = Math.hypot(x, y);
      if (!G.on) { if (r > 0.45) { G.on = true; G.pts = [{ x, y, t, r }]; G.restAt = 0; G.lastRim = t; } return null; }
      G.pts.push({ x, y, t, r });
      if (r > 0.6) { G.lastRim = t; G.restAt = 0; }
      if (r < 0.25) { if (!G.restAt) G.restAt = t; } else G.restAt = 0;
      // A flick through the middle takes a frame or two; resting there for 70 ms means the stroke is finished.
      if (G.restAt && t - G.restAt > 70) { G.on = false; const k = classify(G.pts); return k ? { ...k, t: G.lastRim } : { none: true }; }
      if (t - G.pts[0].t > 1400) { G.on = false; return { none: true }; } // too slow to be a swing
      return null;
    };
    return G;
  }
  function classify(pts) {
    const rim = pts.filter(p => p.r > 0.6); if (rim.length < 2) return null;
    const s = rim[0], e = rim[rim.length - 1], hasBottom = pts.some(p => p.y < -0.6);
    const iS = pts.indexOf(s), iE = pts.indexOf(e);
    let sweep = 0; for (let i = 1; i < rim.length; i++) { let d = Math.atan2(rim[i].y, rim[i].x) - Math.atan2(rim[i - 1].y, rim[i - 1].x); d = Math.atan2(Math.sin(d), Math.cos(d)); sweep += Math.abs(d); }
    const deg = sweep * 180 / Math.PI;
    if (s.y > 0.55 && hasBottom && e.y > 0.55) return { type: 'lob', gx: 0 }; // over the top and back: a lob
    if (s.y > 0.55 && e.y < -0.55) return { type: 'slice', gx: clamp(e.x * 1.3, -1, 1) }; // high to low: slice
    if (Math.abs(s.x) > 0.55 && Math.abs(s.y) < 0.55 && hasBottom && deg >= 110) return { type: 'drop', gx: clamp(e.x, -1, 1) }; // a half circle under the ball
    if (s.y < -0.55) {
      const iB = pts.findIndex(p => p.y < -0.6);
      const through = pts.slice(iB, iE).some(p => p.r < 0.35); // back through the middle: a straight flick
      if (through && iE > iB && e.y > -0.4) return { type: 'flat', gx: clamp(e.x * 1.3, -1, 1) };
      if (!through && Math.abs(e.x) > 0.5 && deg >= 40) return { type: 'topspin', gx: Math.sign(e.x) * 0.8 }; // round the rim: a swoop
    }
    return null;
  }

  // --- Your shot ---------------------------------------------------------------------------------------------------
  const SHOTS = { x: 'flat', o: 'topspin', sq: 'slice', tri: 'lob' };
  const MOD = { flat: ['flat', 'power', 'Power Flat'], topspin: ['topspin', 'floater', 'Floater'], slice: ['drop', 'drop', 'Drop Shot'], lob: ['lob', 'lowlob', 'Low Lob'] };
  // Where it goes: the left stick at the hit (or the stroke's direction), as you look at the court.
  // The same stick always sends the ball to the same place (give or take your timing), so you can learn it by watching
  // where it lands: no aim marker. lines (L1): the sideline if you push left or right, and always the baseline.
  function aimOf(st, type, lx, ly, mod, lines = false) {
    if (type === 'drop') return lines ? { x: (Math.sign(lx) || 1) * 3.65, y: 1.9 } : { x: clamp(lx * 2.6, -2.9, 2.9), y: 2.4 }; // with L1: tight to the sideline, just over
    if (type === 'lob') return { x: clamp(lx * (lines ? 3.2 : 2.4), -3.6, 3.6), y: lines ? (mod === 'lowlob' ? 11.2 : 11.5) : mod === 'lowlob' ? 9.4 : 10.3 };
    if (lines) return ly < -0.4 ? { x: (Math.sign(lx) || 1) * 3.95, y: 5.4 } : { x: Math.abs(lx) > 0.3 ? Math.sign(lx) * 3.9 : lx * 2.5, y: 11.55 };
    if (ly < -0.4) return { x: clamp(lx * 3.6, -3.7, 3.7), y: 5.6 }; // short angle
    // Full stick to a side is the corner (deep and wide); in between, a little inside it; up adds depth.
    const ax = Math.abs(lx), y = (ly > 0.4 ? 10.6 : 9.4) + (ax > 0.7 ? 0.6 : 0);
    return { x: clamp(lx * (ax > 0.7 ? 3.4 : 3.0), -3.6, 3.6), y: Math.min(10.9, y) };
  }
  function padShot(U, st) {
    return new Promise(res => {
      // Their ball keeps flying while you decide; the engine waits for it before your shot plays.
      const ms = X.ms(), fly = X.take(), flight = fly ? fly() : Promise.resolve(); X.put(() => flight);
      // If you haven't swung when it reaches you, the ball doesn't wait: it carries on (slowing a little) until you do.
      let landedAt = 0, step = null, last = null;
      flight.then(() => { landedAt = now(); });
      const t0 = now(), ideal = t0 + ms, SK = stroke();
      if (window.__xpTest) window.__xpTest.pad = { kind: 'shot', ideal };
      // The meter only comes up once you start a swing (a button, or a stroke on the right stick): the marker sets off from
      // the left the moment you press, and reaches the middle of the green as the ball reaches you.
      S.meter = null;
      const meterAt = t1 => { if (cueOn() && !S.meter) S.meter = { start: t1, ideal, end: Math.max(ideal + 320, t1 + 500) }; };
      st.recK = [1.45, 1]; // your player recovers smartly (cbsim cbRecoverReach)
      const dBase = clamp(0.3 * Math.min(1, st.pr[0]) + 0.25 * ((st.tired || [])[0] || 0) + 0.25 * ((st.clutch || [])[0] || 0), 0, 0.8);
      let held = null, heldAt = 0, r1 = false, l1 = false, l1s = false, l2 = false, lx = 0, ly = 0;
      U.play(G(HINT_RALLY));
      const finish = (P, t, type, mod, power, gx) => {
        const L = l1s || !!(P && P.l1), // L1 at any point in the swing (letting go of both together still counts)
          ax = Math.abs(lx) > 0.2 || gx == null ? lx : gx, aim = aimOf(st, type, ax, ly, mod, L);
        const d = shotD(st, dBase, type, mod, power, ax, ly, L);
        const err = t - ideal, q0 = quality(err, d, L), q = L && q0 < 0.95 ? Math.min(q0, 0.9) : q0, [w, cls] = word(q, err < 0);
        pendR = { pad: true, type, q, early: err < 0, power, mod, lines: L, ms: Math.round(err) };
        if (S.meter) Object.assign(S.meter, windows(d, L), { lines: L });
        tag(U, L && q < 0.95 ? 'Out' : w, L && q < 0.95 ? 'bad' : cls, t); buzz(P, q >= 0.95 ? 0.15 : 0.6 * (1 - q) + 0.2, q >= 0.6 ? 0.9 : 0.3, q >= 0.95 ? 45 : 90);
        U.play('');
        res({ aim, type, move: l2 && !st.atNet[0] ? 'net' : 'recover' });
        return true;
      };
      watch((P, t) => {
        if (S.ball && !landedAt) { if (last) step = { x: S.ball.x - last.x, y: S.ball.y - last.y, z: S.ball.z - last.z }; last = { ...S.ball }; }
        if (landedAt && step && S.ball) { S.ball = { x: S.ball.x + step.x, y: S.ball.y + step.y, z: Math.max(0.15, S.ball.z + step.z) }; S.trail.push({ ...S.ball }); if (S.trail.length > 4) S.trail.shift(); step = { x: step.x * 0.88, y: step.y * 0.88, z: step.z * 0.88 - 0.004 }; }
        if (!P) { if (t > ideal + 300) { pendR = null; tag(U, 'Missed', 'bad'); U.play(''); res({ missed: true, aim: { x: 0, y: 9 }, type: 'topspin', move: 'recover' }); return true; } return false; }
        lx = P.lx; ly = P.ly; r1 = r1 || P.r1; l1 = P.l1 || l1; l2 = P.l2 || l2;
        // A button: the swing goes when you let go (a quick tap is a normal shot, holding winds up a harder one).
        if ((held || SK.on) && P.l1) l1s = true;
        if (!held) { const k = ['x', 'o', 'sq', 'tri'].find(k0 => P[k0]); if (k) { held = k; heldAt = t; r1 = P.r1; meterAt(t); if (P.l1) l1s = true; } }
        else if (!P[held]) {
          const base = SHOTS[held], [type, mod] = r1 ? MOD[base] : [base, null], power = clamp((t - heldAt - 100) / 400, 0, 1); // full power after half a second
          return finish(P, t, type, mod, power, null);
        }
        // The meter's green follows what you're doing right now: the shot held (topspin until you pick one), how long, where.
        if (S.meter && !S.meter.done) {
          const b0 = held ? SHOTS[held] : 'topspin', [ty, md] = held && r1 ? MOD[b0] : [b0, null], pw = held ? clamp((t - heldAt - 100) / 400, 0, 1) : 0, Ln = !!P.l1;
          Object.assign(S.meter, windows(shotD(st, dBase, ty, md, pw, lx, ly, Ln), Ln), { lines: Ln, label: held ? `${NAME[md || ty]}${Ln ? ' · Lines' : ''}${pw > 0.05 ? ` · ${Math.round(pw * 100)}%` : ''}` : Ln ? 'Lines' : '' });
        }
        // Or a stroke on the right stick (only if no button is being held).
        if (!held) { const k = SK.step(P.rx, P.ry, t); if (SK.on) meterAt(SK.pts[0].t); if (k && !k.none) return finish(P, k.t, k.type, k.type === 'drop' ? 'drop' : null, 0, k.gx); if (k && k.none && S.meter && !S.meter.done) S.meter = null; }
        // Never swung: the ball goes past you (or off the frame).
        if (t > ideal + 300) { pendR = null; tag(U, 'Missed', 'bad'); buzz(P, 0.7, 0.2, 140); U.play(''); res({ missed: true, aim: aimOf(st, 'topspin', lx, ly), type: 'topspin', move: 'recover' }); return true; } // it goes past you: their winner
        return false;
      });
    });
  }

  // --- Your serve ------------------------------------------------------------------------------------------------
  // Ideal time from toss to hit: flat at the top of the toss, kick on the way up, slice on the way down (as The Toss).
  const TOSS_IDEAL = { flat: 620, kick: 490, slice: 720 };
  function zoneFor(st, rx) {
    const zs = ['wide', 'body', 't'].map(z => ({ z, x: cbServeTarget(st, z).x })).sort((a, b) => a.x - b.x);
    return rx < -0.35 ? zs[0].z : rx > 0.35 ? zs[2].z : 'body';
  }
  function padServe(U, st) {
    return new Promise(res => {
      let toss = 0; const H = S.players[0];
      U.play(G(HINT_SERVE));
      watch((P, t) => {
        if (!P) return false;
        const zone = zoneFor(st, P.rx);
        const sp0 = P.x ? 'flat' : P.o ? 'kick' : P.sq ? 'slice' : st.serve2 ? 'kick' : 'flat';
        if (toss && cueOn()) S.meter = { start: toss, end: toss + 1150, ideal: toss + TOSS_IDEAL[sp0], ...windows((st.serve2 ? 0.1 : 0.3) + SERVE_D[sp0]), label: `${{ flat: 'Flat', kick: 'Kick', slice: 'Slice' }[sp0]} Serve` }; // starts with the toss; the held button moves the green
        if (!toss) { if (P.ry < -0.6) { toss = t; buzz(P, 0, 0.25, 40); if (window.__xpTest) window.__xpTest.pad = { kind: 'serve', toss }; } return false; }
        // The ball in the air: up and down under gravity, peaking at about 3.1 m.
        const u = (t - toss) / 1000; S.ball = { x: H.x + 0.1, y: H.y, z: Math.max(0.9, 1.2 + 6.1 * u - 4.9 * u * u) }; H.pu = Math.min(0.4, u);
        if (P.ry > 0.6) {
          const spin = P.x ? 'flat' : P.o ? 'kick' : P.sq ? 'slice' : st.serve2 ? 'kick' : 'flat';
          const err = t - toss - TOSS_IDEAL[spin], q = quality(err, (st.serve2 ? 0.1 : 0.3) + SERVE_D[spin]), [w, cls] = word(q, err < 0);
          if (S.meter) S.meter.ideal = toss + TOSS_IDEAL[spin];
          pendR = { pad: true, serve: true, q, early: err < 0, bad: Math.abs(err) > 450, ms: Math.round(err) };
          tag(U, w, cls, t); buzz(P, q >= 0.95 ? 0.2 : 0.5, 0.8, 60);
          U.play('');
          res({ zone, spin, approach: P.l2 && !st.serve2 });
          return true;
        }
        if (t - toss > 1300) { toss = 0; S.ball = null; H.pu = 0; S.meter = null; } // caught it: toss again
        return false;
      });
    });
  }

  window.xpPadFns = { classify, quality, aimOf, shotD, windows }; // for tools/cb-pad.html
  // --- Plugging in -------------------------------------------------------------------------------------------------
  const base = { shot: window.xpAskShot, serve: window.xpAskServe, play: window.xpAskPlay, touch: window.xpAskTouch, on: window.xpTouchOn, fx: window.xpTouchEffect };
  window.xpAskShot = (U, st, o) => (padOn() ? padShot(U, st) : base.shot(U, st, o));
  window.xpAskServe = (U, st, o) => (padOn() ? padServe(U, st) : base.serve(U, st, o));
  // Live points: no play list before your serve, just a moment for the players to reset.
  window.xpAskPlay = (U, st) => (padOn() ? new Promise(r => { U.play(''); setTimeout(() => r(null), 500); }) : base.play(U, st));
  // The engine asks for the timing result after the shot is chosen: the controller has it already.
  window.xpTouchOn = () => !!pendR || (base.on ? base.on() : false);
  window.xpAskTouch = (U, st, ch) => { if (pendR) { const R = pendR; pendR = null; return Promise.resolve(R); } return base.touch(U, st, ch); };
  // The old timing games' effects, plus what holding (power) and R1 (the specials) add.
  window.xpTouchEffect = (type, R) => {
    if (R && R.miss) return { forceErr: 'net' };
    const e = base.fx(type, R); if (!R || !R.pad) return e;
    const p = R.power || 0;
    if (p) { e.pace = (e.pace || 1) * (1 + 0.15 * p); e.sig *= 1 + 0.5 * p; e.net *= 1 + 0.4 * p; e.press = (e.press || 0) + 0.1 * p * R.q; }
    // A well-timed drive comes off heavier: quicker, and harder to handle (CB_PADK can be tuned from the tests).
    if (type !== 'drop' && type !== 'lob') { const K = window.CB_PADK || { pace: 0.15, press: 0.15 }; e.pace = (e.pace || 1) * (1 + K.pace * R.q); e.press = (e.press || 0) + K.press * R.q; }
    if (R.mod === 'power') { e.pace = (e.pace || 1) * 1.05; e.sig *= 1.5; e.net *= 1.35; e.press = (e.press || 0) + 0.03 * R.q; } // big, but a gamble and returnable
    if (type === 'topspin' && R.mod !== 'floater') e.press = (e.press || 0) + 0.06 * R.q; // a heavy, kicking ball
    if (type === 'slice') e.press = (e.press || 0) + 0.04 * R.q; // stays low
    if (e.pace) e.pace = Math.min(e.pace, 1.3); // all the boosts together never make a ball unplayable
    if (R.mod === 'floater') { e.pace = 0.85; e.sig *= 0.75; e.net *= 0.5; e.press = (e.press || 0) - 0.06; e.dy = (e.dy || 0) + 0.3; } // safe and loopy: it gives them time
    // L1, the lines: only a perfect release kisses the line; anything less carries on out, wide and long.
    if (R.lines) { if (R.q >= 0.95) { e.keepIn = true; e.sig *= 0.5; } else { e.keepIn = false; e.dx = 0.75; e.dy = type === 'lob' ? 0.9 : 0.8; e.sig = Math.min(e.sig, 0.5); } }
    if (R.mod === 'lowlob') { e.slackCut = (e.slackCut || 0) + 0.25 * R.q; e.sig *= 1.25; e.net *= 1.8; } // over them quicker, but less room
    return e;
  };

  // A 🎮 switch in the match bar while a controller is connected (off = the usual tap screens).
  const baseOv = cbOverlay;
  cbOverlay = o => {
    const U = baseOv(o), bar = U.el.querySelector('.xptopb'); if (!bar || !(training || TL_LOCAL)) return U;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'xpadbtn';
    const lab = () => { const on = cbData().pad !== false; b.hidden = !pad(); b.textContent = on ? '🎮' : '🎮 Off'; b.classList.toggle('off', !on); b.dataset.tip = `Controller: ${on ? 'on' : 'off'} (tap to turn ${on ? 'off' : 'on'}). Press any button on the controller if it isn't picked up.`; };
    b.onclick = e => { e.stopPropagation(); const d = cbData(); d.pad = d.pad === false; cbSave(d); lab(); };
    bar.insertBefore(b, bar.firstChild); lab();
    // 📶 the shot meter on or off (only shown while a controller is connected).
    const c = document.createElement('button'); c.type = 'button'; c.className = 'xpadbtn';
    const cl = () => { const on = cueOn(); c.hidden = !pad(); c.textContent = on ? '📶' : '📶 Off'; c.classList.toggle('off', !on); c.dataset.tip = `Shot meter: ${on ? 'on' : 'off'} (tap to turn ${on ? 'off' : 'on'})`; };
    c.onclick = e => { e.stopPropagation(); const d = cbData(); d.padCue = d.padCue === false; cbSave(d); cl(); if (!cueOn()) S.meter = null; };
    b.after(c); cl();
    const ch = () => { lab(); cl(); }; window.addEventListener('gamepadconnected', ch); window.addEventListener('gamepaddisconnected', ch);
    const close = U.close; U.close = () => { window.removeEventListener('gamepadconnected', ch); window.removeEventListener('gamepaddisconnected', ch); close(); };
    return U;
  };

  // --- Training Room: just you, the controller and a hitting partner -------------------------------------------------
  // Practice only: no stats, money or fitness change. The settings are kept between visits (cbData().train).
  const pause = ms => new Promise(r => setTimeout(r, ms));
  // Their game while you train: stay back, come in behind every ball, or play as they like.
  const baseChoose = cbChoose, baseServe = cbChooseServe;
  cbChoose = (st, by, rng) => {
    const c = baseChoose(st, by, rng);
    if (training && by === 1) { if (training.net === 'net') c.approach = c.type !== 'lob' && c.type !== 'drop'; else if (training.net === 'back') c.approach = false; }
    return c;
  };
  cbChooseServe = (st, ...a) => {
    const c = baseServe(st, ...a);
    if (training && st.server === 1) { if (training.net === 'net') c.approach = !st.serve2; else if (training.net === 'back') c.approach = false; }
    return c;
  };
  // The controller on screen: the buttons light up and the sticks move as you press them.
  // The controller on screen, drawn as a pad: the buttons light up and the sticks move as you press them. Drag it
  // anywhere; where you leave it is remembered on this device (cbData().ctlPos, as a share of the screen).
  const CTL_SVG = '<svg viewBox="0 0 300 196" class="xpcsvg">' +
    '<path class="body" d="M62 30C95 20 205 20 238 30C268 39 288 88 294 140C299 178 274 194 254 178C238 165 225 142 205 137L95 137C75 142 62 165 46 178C26 194 1 178 6 140C12 88 32 39 62 30Z"/>' +
    '<rect data-b="6" class="sh" x="40" y="2" width="58" height="13" rx="6"/><text x="69" y="12" data-l="L2">L2</text>' +
    '<rect data-b="7" class="sh" x="202" y="2" width="58" height="13" rx="6"/><text x="231" y="12" data-l="R2">R2</text>' +
    '<rect data-b="4" class="sh" x="44" y="18" width="52" height="10" rx="5"/><text x="70" y="26.5" class="sm" data-l="L1">L1</text>' +
    '<rect data-b="5" class="sh" x="204" y="18" width="52" height="10" rx="5"/><text x="230" y="26.5" class="sm" data-l="R1">R1</text>' +
    '<rect class="pad" x="108" y="32" width="84" height="44" rx="9"/>' +
    '<g class="dpad"><rect x="68" y="56" width="14" height="14" rx="2"/><rect x="68" y="84" width="14" height="14" rx="2"/><rect x="54" y="70" width="14" height="14" rx="2"/><rect x="82" y="70" width="14" height="14" rx="2"/></g>' +
    '<g class="face"><circle data-b="3" cx="226" cy="54" r="11"/><text x="226" y="58.5" data-l="tri">△</text><circle data-b="1" cx="249" cy="77" r="11"/><text x="249" y="81.5" data-l="o">○</text>' +
    '<circle data-b="0" cx="226" cy="100" r="11"/><text x="226" y="104.5" data-l="x">✕</text><circle data-b="2" cx="203" cy="77" r="11"/><text x="203" y="81.5" data-l="sq">□</text></g>' +
    '<circle class="well" cx="114" cy="116" r="20"/><circle data-s="0" class="stick" cx="114" cy="116" r="13"/>' +
    '<circle class="well" cx="186" cy="116" r="20"/><circle data-s="2" class="stick" cx="186" cy="116" r="13"/></svg>';
  function ctlPad(U) {
    const el = document.createElement('div'); el.className = 'xpctl';
    el.innerHTML = CTL_SVG + '<p class="xpcmsg"></p>';
    U.el.appendChild(el);
    const pos = cbData().ctlPos;
    const place = (x, y) => { const r = el.getBoundingClientRect(); el.style.left = `${clamp(x, 0, innerWidth - r.width)}px`; el.style.top = `${clamp(y, 0, innerHeight - r.height)}px`; el.style.right = el.style.bottom = 'auto'; el.style.transform = 'none'; };
    if (pos) requestAnimationFrame(() => place(pos.x * innerWidth, pos.y * innerHeight));
    let drag = null;
    el.addEventListener('pointerdown', e => { const r = el.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; el.setPointerCapture(e.pointerId); el.classList.add('drag'); e.preventDefault(); });
    el.addEventListener('pointermove', e => { if (drag) place(e.clientX - drag.dx, e.clientY - drag.dy); });
    const drop = () => { if (!drag) return; drag = null; el.classList.remove('drag'); const r = el.getBoundingClientRect(), d = cbData(); d.ctlPos = { x: r.left / innerWidth, y: r.top / innerHeight }; cbSave(d); };
    el.addEventListener('pointerup', drop); el.addEventListener('pointercancel', drop);
    const bs = [...el.querySelectorAll('[data-b]')], ss = [...el.querySelectorAll('[data-s]')], ls = [...el.querySelectorAll('[data-l]')], msg = el.querySelector('.xpcmsg');
    let fam = '';
    const tick = () => {
      if (!el.isConnected) return;
      const g = pad();
      if (g && famOf(g) !== fam) { fam = famOf(g); ls.forEach(t => { t.textContent = GLYPH[fam][t.dataset.l]; }); } // PlayStation, Xbox or Switch names
      msg.textContent = g ? '' : 'Press Any Button On Your Controller';
      bs.forEach(b => b.classList.toggle('on', !!(g && g.buttons[+b.dataset.b] && (g.buttons[+b.dataset.b].pressed || g.buttons[+b.dataset.b].value > 0.4))));
      ss.forEach(b => { const i = +b.dataset.s, x = g ? +(g.axes[i] || 0) : 0, y = g ? +(g.axes[i + 1] || 0) : 0; b.setAttribute('transform', `translate(${(x * 8).toFixed(1)} ${(y * 8).toFixed(1)})`); b.classList.toggle('on', Math.hypot(x, y) > 0.3); });
      requestAnimationFrame(tick);
    };
    tick();
  }
  const TR_OPTS = [
    ['net', 'Their Game', [['back', 'Stay Back'], ['net', 'Come To The Net'], ['mix', 'Mix It Up']]],
    ['start', 'Each Point Starts With', [['rally', 'A Rally Ball'], ['serve', 'Your Serve'], ['ret', 'Their Serve']]],
    ['level', 'Hitting Partner', [['-4', 'Easy'], ['0', 'Your Level'], ['4', 'Tough']]],
    ['cue', 'Shot Meter', [['on', 'On'], ['off', 'Off']]],
  ];
  // Live Tennis Extreme (beta) runs in this browser tab only (names.js isLiveTennis): leaving goes back to where you were.
  const LIVE = typeof isLiveTennis === 'function' && isLiveTennis();
  const leaveLive = () => { try { sessionStorage.removeItem('tl.live'); } catch {} location.reload(); };
  // Someone with no Extreme player yet still gets to hit: a practice player of a fair standard (nothing is saved).
  const practicePro = () => ({ name: 'You', nation: 'USA', hand: 'right', backhand: 'two', age: 22, attrs: { serve: 62, ground: 64, fh: 64, bh: 62, ret: 62, net: 58, spd: 63, stam: 62, mental: 60, iq: 60 } });
  const me = () => current.player || practicePro();
  function trainingRoom() {
    let starting = false;
    const T = { net: 'back', start: 'rally', level: '0', ...(cbData().train || {}), cue: cueOn() ? 'on' : 'off' };
    const render = () => {
      openModal(G(`<button type="button" class="x" id="trX" aria-label="Close">×</button><h2 class="itop">🎮 ${LIVE ? 'Live Tennis Extreme <i class="xbeta inl">Beta</i>' : 'Training Room'}</h2>` +
        `<p class="hint center">${LIVE ? 'Plug in a controller (PlayStation, Xbox or any other) and hit live shots against a practice partner. Nothing here changes your careers.' : 'Hit with a controller against a practice partner. Nothing here changes your stats, money or fitness.'}</p>` +
        TR_OPTS.map(([k, l, items]) => `<h3 class="ssec">${l}</h3><div class="seg">${items.map(([v, n]) => `<button type="button" data-tr="${k}" data-v="${v}" class="${T[k] === v ? 'on' : ''}">${n}</button>`).join('')}</div>`).join('') +
        `<details class="card fold"><summary class="foldhead"><span class="foldt">🎮 The Controls</span><i class="foldchev"></i></summary><div class="foldbody xpckeys">` +
        '<p><b>{x}</b> Flat · <b>{o}</b> Topspin · <b>{sq}</b> Slice · <b>{tri}</b> Lob</p><p>Your swing goes when you let go of the button. Let go as the ball reaches you: the shot meter under your player shows when, and its green window shows how hard this shot is to time. Hold the button longer for a harder, riskier shot.</p>' +
        '<p><b>{R1} +</b> {x} Power Flat · {o} Floater · {sq} Drop Shot · {tri} Low Lob. Hold <b>{L1}</b> as well to take any of them to the lines.</p><p><b>Left Stick</b> as you hit: left and right aims, up goes deeper, down plays a short angle. There is no aim marker: watch where your balls land and learn it.</p><p><b>{L1}</b> held: go for the lines. The green is tiny: only a perfect release kisses the line; anything less goes out. <b>{L2}</b> held: come to the net.</p>' +
        '<p><b>Right Stick</b> strokes: down then swoop to a side for topspin, down then flick for flat, a half circle under the ball for a drop shot, top to bottom and back up for a lob.</p>' +
        '<p><b>Serve:</b> pull the right stick down to toss, then flick it up to the left, middle or right. Hold {x} for Flat, {o} for Kick or {sq} for Slice.</p></div></details>' +
        `<button type="button" class="btn huge" id="trGo">Start Training</button>` + (LIVE ? '<p class="center"><button type="button" class="link" id="trLeave">‹ Back To TourLife</button></p>' : '')),
        { wide: true, onClose: () => { if (LIVE && !starting) leaveLive(); } });
      document.getElementById('trX').onclick = closeModal;
      const lvb = document.getElementById('trLeave'); if (lvb) lvb.onclick = leaveLive;
      document.querySelectorAll('[data-tr]').forEach(b => { b.onclick = () => { T[b.dataset.tr] = b.dataset.v; const d = cbData(); d.train = { ...T }; d.padCue = T.cue !== 'off'; cbSave(d); render(); }; });
      document.getElementById('trGo').onclick = () => { starting = true; closeModal(); runTraining(T); };
    };
    render();
  }
  async function runTraining(T) {
    const p = me(), opp = cbPartner(p, +T.level || 0), ab = [cbAbilities({ ...p, isPlayer: true }), cbAbilities(opp)], surface = 'hard', mem = cbMemory();
    training = T;
    let quit = false, won = 0, n = 0;
    const U = cbOverlay({ surface, exit: () => { quit = true; if (training === T) training = null; U.close(); trainingRoom(); } });
    ctlPad(U);
    const net = { back: 'Stays Back', net: 'Comes In', mix: 'Mixes It Up' }[T.net];
    const sc = () => U.score(`<div class="xbrow me"><span class="xbn">🎮 Training Room</span><b class="p">${won}/${n}</b></div><div class="xbrow op"><span class="xbn">${esc(opp.name)} · ${net}</span></div>`);
    while (!quit) {
      sc();
      while (!pad() && !quit) await pause(300); // wait for the controller (the on-screen pad says so)
      if (quit) break;
      let st, incoming = null;
      if (T.start === 'rally') {
        const s0 = cbPracticeStart('trap', ab, surface, mem); if (!s0) continue;
        ({ st, incoming } = s0); U.V.pos = [{ ...(incoming.rcvFrom || st.pos[0]) }, { ...incoming.from }]; await pause(400);
      } else st = cbNewPoint(ab, { surface, server: T.start === 'serve' ? 0 : 1, deuce: n % 2 === 0, mem });
      const o = await cbRunPoint(U, st, incoming ? { incoming } : {}); if (quit) break;
      n++; if (o && o.w === 0) won++; sc();
      await cbShowPoint(U, st, o && o.w === 0 ? 'Your Point' : 'Their Point', o && o.w === 0);
    }
    if (training === T) training = null; // a newer session may already be running
  }
  window.xpTrainingRoom = trainingRoom;
  // Opened from the Live Tennis Extreme tab: straight into the Training Room (once Home has drawn underneath).
  if (LIVE) { document.body.classList.add('tlive'); setTimeout(() => { if (typeof closeModal === 'function') closeModal(); trainingRoom(); }, 600); }
  // The way in: top right of Home, where the Research Lab link sits.
  const links = document.querySelector('#home .studylinks');
  if (links && !links.querySelector('[data-train]')) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'studylink'; b.dataset.train = '1'; b.textContent = '🎮 Training Room';
    b.onclick = trainingRoom; links.insertBefore(b, links.firstChild);
  }
})();
