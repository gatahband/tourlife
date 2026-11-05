// cbxp.js — TourLife Extreme: the turn-based Court Breaker screen used by Extreme matches and practice.
// Every time the ball comes to you the point stops: you read the situation, build your shot (ball, direction,
// depth, or an exact spot) and choose where to move. No clock. The point itself is played by cbsim.js.
// Only switched on in Extreme (cbplay.js gates Extreme to the local test link).
(() => {
  if (typeof isExtreme !== 'function' || !isExtreme()) return;
  const q = (el, s) => el.querySelector(s);
  const pause = ms => new Promise(r => setTimeout(r, ms));
  // How slowly the ball travels (1 = real time). The saved setting keeps its old values; they now mean quicker speeds.
  const SPEED_OF = { 2.4: 1.7, 1.6: 1.3, 1.1: 1.05 };
  const speed = () => { const v = +(cbData().speed || 1.6); return SPEED_OF[v] || v; };
  const speedKey = () => +(cbData().speed || 1.6);

  // --- Words ---------------------------------------------------------------------------------------------------
  const TYPE_N = { topspin: 'Topspin', flat: 'Flat', slice: 'Slice', lob: 'Lob', drop: 'Drop Shot' };
  const LANE_N = { cross: 'Crosscourt', line: 'Down The Line', middle: 'Through The Middle' };
  const ZONE_N = { wide: 'Out Wide', body: 'Into The Body', t: 'Down The T' };
  const SPIN_N = { flat: 'Flat', slice: 'Slice', kick: 'Kick' };
  const wingN = w => (w === 'bh' ? 'Backhand' : 'Forehand');
  function shotName(sh) {
    if (sh.serve) return `${SPIN_N[sh.spin]} Serve`;
    const w = wingN(sh.wing);
    if (sh.volley) return sh.type === 'drop' || (sh.type === 'slice' && Math.abs(sh.aim.y) < 4.8) ? `${w} Drop Volley` : sh.type === 'lob' ? `${w} Lob Volley` : `${w} Volley`;
    return `${w} ${TYPE_N[sh.type]}`;
  }
  function shotWhere(sh) {
    if (sh.serve) return ZONE_N[sh.zone];
    const lane = LANE_N[cbLane(sh.from, sh.aim)], ay = Math.abs(sh.aim.y);
    if (sh.type === 'drop' || ay < 4.8) return `Short, ${lane}`;
    if (sh.type === 'lob') return `Over Them, ${lane}`;
    if (ay < 7.5) return `Short Angle, ${lane}`;
    return `Deep, ${lane}`;
  }

  // --- The court (a broadcast camera behind your baseline) ---------------------------------------------------------
  const CAM = { y: -34, h: 17 };
  const V = { c: null, g: null, W: 0, H: 0, f: 1, hy: 0, on: false };
  const SURF = { hard: { court: '#3a6ea5', out: '#2c5a87', bg: '#1d3a57' }, clay: { court: '#c46a3c', out: '#ad5a31', bg: '#5e3420' }, grass: { court: '#4f9147', out: '#3f7d39', bg: '#24461f' } };
  const S = { surface: 'hard', players: [], ball: null, trail: [], marks: [], targets: [], bubbles: [null, null], n: 0 };
  const cur = { st: null, U: null, pending: null };

  function fit() {
    if (!V.c) return;
    const r = V.c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (!r.width) return;
    V.c.width = Math.round(r.width * dpr); V.c.height = Math.round(r.height * dpr); V.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    V.W = r.width; V.H = r.height;
    // On a computer the score column sits on the left and the decisions on the right: the court is centred in between.
    // A tablet held sideways gets the computer layout with a slimmer panel; the court uses the whole width.
    const tab = matchMedia('(pointer: coarse) and (min-width: 768px) and (orientation: landscape)').matches && window.innerWidth <= 1400;
    const desk = window.innerWidth >= 1100 || tab, side = tab ? 310 : desk ? 392 : 0, left = tab ? 310 : desk ? 362 : 0; // on a tablet: equal room both sides, so the court sits dead centre
    const W = V.W - side - left; V.cx = left + W / 2;
    // Framed from your feet standing Very Deep (about 15.5 m back) to the far player's head (drawn a little larger).
    const dn = -17.3 - CAM.y, df = 13.4 - CAM.y, top0 = 5.6;
    V.f = Math.min((V.H - (side ? 36 : 16)) / (CAM.h / dn - (CAM.h - top0) / df), 0.47 * W * (-11.885 - CAM.y) / 5.485);
    const top0px = side ? 18 : 8, bot = side ? 14 : 8; // on a computer the score and panel sit beside the court, so it can fill the height
    V.hy = V.H - bot - CAM.h * V.f / dn;
    const top = V.hy + (CAM.h - top0) * V.f / df;
    if (top > top0px) V.hy -= (top - top0px) / 2;
  }
  const proj = (x, y, z = 0) => { const s = V.f / (y - CAM.y); return { X: (V.cx ?? V.W / 2) + x * s, Y: V.hy + (CAM.h - z) * s, s }; };
  const unproj = (X, Y) => { const d = CAM.h * V.f / (Y - V.hy); return { x: (X - (V.cx ?? V.W / 2)) * d / V.f, y: d + CAM.y }; };
  function seg(g, a, b) { g.beginPath(); g.moveTo(a.X, a.Y); g.lineTo(b.X, b.Y); g.stroke(); }
  function poly(g, pts, fill) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.X, p.Y) : g.moveTo(p.X, p.Y))); g.closePath(); g.fillStyle = fill; g.fill(); }

  function drawCourt(g) {
    const C = SURF[S.surface] || SURF.hard;
    g.fillStyle = C.bg; g.fillRect(0, 0, V.W, V.H);
    poly(g, [proj(-9, -16.8), proj(9, -16.8), proj(9, 16), proj(-9, 16)], C.out); // ends just behind Very Deep, like the far end
    poly(g, [proj(-5.485, -11.885), proj(5.485, -11.885), proj(5.485, 11.885), proj(-5.485, 11.885)], C.court);
    g.strokeStyle = '#fff'; g.lineCap = 'round';
    const L = (x1, y1, x2, y2) => { g.lineWidth = Math.max(1, 0.06 * proj(0, (y1 + y2) / 2).s); seg(g, proj(x1, y1), proj(x2, y2)); };
    for (const y of [-11.885, 11.885]) L(-5.485, y, 5.485, y);
    for (const x of [-5.485, 5.485, -4.115, 4.115]) L(x, -11.885, x, 11.885);
    for (const y of [-6.4, 6.4]) L(-4.115, y, 4.115, y);
    L(0, -6.4, 0, 6.4); L(0, -11.885, 0, -11.6); L(0, 11.885, 0, 11.6);
  }
  function drawNet(g) {
    const top = [];
    for (let i = 0; i <= 16; i++) { const x = -6.4 + 12.8 * i / 16; top.push(proj(x, 0, 0.914 + 0.156 * (x / 6.4) ** 2)); }
    poly(g, [...top, proj(6.4, 0), proj(-6.4, 0)], 'rgba(15,20,25,0.45)');
    g.strokeStyle = '#f4f4f4'; g.lineWidth = Math.max(2, 0.08 * top[8].s);
    g.beginPath(); top.forEach((p, i) => (i ? g.lineTo(p.X, p.Y) : g.moveTo(p.X, p.Y))); g.stroke();
    g.strokeStyle = '#ccc'; g.lineWidth = 3;
    for (const x of [-6.4, 6.4]) seg(g, proj(x, 0), proj(x, 0, 1.07));
  }
  // The swings themselves live with the body drawing (cblook.js), so both courts can share them.
  const handDir = XL.handDir, racketAt = XL.racketAt;
  const PSCALE = 1.4; // players drawn a little larger than life so you can read their swings
  function drawPlayer(g, p) {
    const G = proj(p.x, p.y), d = p.y - CAM.y, s = G.s * PSCALE * (1 + 0.6 * Math.max(0, (d - 21) / 25));
    const P = (dx, z) => [G.X + dx * s, G.Y - z * s];
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(G.X, G.Y, 0.45 * s, 0.13 * s, 0, 0, 7); g.fill();
    const [hx, hz, rx, rz] = racketAt(p), hd = handDir(p);
    const twoHands = XL.twoHanded(p);
    g.strokeStyle = p.side === 0 ? 'rgba(66,165,245,0.8)' : 'rgba(255,138,80,0.8)'; g.lineWidth = 2; // a ring in your colour or theirs under each player
    g.beginPath(); g.ellipse(G.X, G.Y, 0.45 * s, 0.13 * s, 0, 0, 7); g.stroke();
    XL.drawBody(g, P, s, { side: p.side, sw: Math.sin(p.run) * 0.2, hand: [hx, hz, rx, rz], hd, twoHands, turn: !!p.pose, look: p.look });
    if (p.side === 1) { g.fillStyle = '#fff'; g.font = `600 ${Math.max(10, 0.22 * s)}px system-ui`; g.textAlign = 'center'; g.fillText(p.name, G.X, P(0, 2.05)[1]); }
    const b = S.bubbles[p.side];
    if (b && performance.now() < b.until) bubble(g, p.side === 0 ? P(0, 2.25) : [G.X, G.Y + 52], b, p.side); // far player's label sits below them
  }
  function bubble(g, [x, y], b, side) {
    g.font = '700 14px system-ui'; const w1 = g.measureText(b.t1).width; g.font = '12px system-ui'; const w2 = b.t2 ? g.measureText(b.t2).width : 0;
    const w = Math.max(w1, w2) + 18, h = b.t2 ? 40 : 24, bx = Math.max(4, Math.min(V.W - w - 4, x - w / 2)), by = Math.max(4, y - h - 6);
    g.fillStyle = side === 0 ? 'rgba(10,40,70,0.92)' : 'rgba(70,25,10,0.92)'; g.beginPath(); g.roundRect(bx, by, w, h, 8); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 14px system-ui'; g.fillText(b.t1, bx + w / 2, by + 17);
    if (b.t2) { g.font = '12px system-ui'; g.fillStyle = '#cfe3f5'; g.fillText(b.t2, bx + w / 2, by + 33); }
  }
  function drawBall(g) {
    const b = S.ball; if (!b) return;
    const sh = proj(b.x, b.y, 0), p = proj(b.x, b.y, b.z), r = Math.max(3.5, 0.11 * p.s);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(sh.X, sh.Y, r, r * 0.4, 0, 0, 7); g.fill();
    S.trail.forEach((t, i) => { const k = proj(t.x, t.y, t.z); g.fillStyle = `rgba(230,255,80,${0.08 + 0.3 * i / S.trail.length})`; g.beginPath(); g.arc(k.X, k.Y, r * 0.7, 0, 7); g.fill(); });
    g.fillStyle = '#e6ff50'; g.strokeStyle = '#6b7a10'; g.lineWidth = 1; g.beginPath(); g.arc(p.X, p.Y, r, 0, 7); g.fill(); g.stroke();
  }
  function drawMarks(g) {
    for (const m of S.marks) {
      const p = proj(m.x, m.y), r = Math.max(5, 0.25 * p.s);
      g.lineWidth = 2;
      if (m.kind === 'land') { // where each player's last ball bounced: a solid dot in their colour
        const rr = Math.max(4, 0.15 * p.s); g.fillStyle = m.by === 0 ? 'rgba(66,165,245,0.35)' : 'rgba(255,138,80,0.35)'; g.strokeStyle = m.by === 0 ? 'rgba(66,165,245,0.8)' : 'rgba(255,138,80,0.8)'; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(p.X, p.Y, rr, rr * 0.45, 0, 0, 7); g.fill(); g.stroke();
      } else if (m.kind === 'aim') { // where you aimed, joined to where it landed
        const rr = Math.max(5, 0.16 * p.s), l = S.marks.find(k => (k.kind === 'land' || k.kind === 'out') && k.by === 0 && k.n === m.n);
        g.setLineDash([3, 3]); if (l) { g.strokeStyle = 'rgba(255,213,79,0.55)'; g.lineWidth = 1; seg(g, p, proj(l.x, l.y)); } g.setLineDash([]);
        g.strokeStyle = 'rgba(255,213,79,0.85)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(p.X, p.Y, rr, rr * 0.45, 0, 0, 7); g.stroke();
        g.fillStyle = 'rgba(255,213,79,0.85)'; g.font = '700 10px system-ui'; g.textAlign = 'center'; g.fillText('AIM', p.X, p.Y - rr * 0.45 - 3);
      }
    }
    for (const t of S.targets) {
      const p = proj(t.x, t.y), r = Math.max(6, 0.2 * p.s);
      g.strokeStyle = '#ffd54f'; g.lineWidth = 2; g.beginPath(); g.ellipse(p.X, p.Y, r, r * 0.5, 0, 0, 7); g.stroke();
      g.fillStyle = '#ffd54f'; g.beginPath(); g.arc(p.X, p.Y, 2.5, 0, 7); g.fill();
    }
  }
  // The flight of the shot you're building as a dotted line while you decide: floated, flat, dipping or dying short.
  function drawPath(g) {
    if (!S.path) return;
    g.setLineDash([2, 5]); g.lineWidth = 2; g.strokeStyle = S.path.by === 0 ? 'rgba(144,202,249,0.75)' : 'rgba(255,204,128,0.8)';
    g.beginPath(); S.path.pts.forEach((b, i) => { const p = proj(b.x, b.y, b.z); i ? g.lineTo(p.X, p.Y) : g.moveTo(p.X, p.Y); }); g.stroke();
    g.setLineDash([]);
  }
  // Where "Then" takes you: an arrow on the court from your feet to where you'll move after the shot.
  function drawArrow(g) {
    const A = S.arrow; if (!A || Math.hypot(A.to.x - A.from.x, A.to.y - A.from.y) < 0.3) return;
    const a = proj(A.from.x, A.from.y), b = proj(A.to.x, A.to.y), ang = Math.atan2(b.Y - a.Y, b.X - a.X), hl = Math.max(8, 0.35 * b.s);
    g.strokeStyle = 'rgba(100,181,246,0.9)'; g.fillStyle = 'rgba(100,181,246,0.9)'; g.lineWidth = 2.5; g.setLineDash([6, 4]);
    g.beginPath(); g.moveTo(a.X, a.Y); g.lineTo(b.X - Math.cos(ang) * hl * 0.6, b.Y - Math.sin(ang) * hl * 0.6); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.moveTo(b.X, b.Y); g.lineTo(b.X - Math.cos(ang - 0.45) * hl, b.Y - Math.sin(ang - 0.45) * hl); g.lineTo(b.X - Math.cos(ang + 0.45) * hl, b.Y - Math.sin(ang + 0.45) * hl); g.closePath(); g.fill();
    g.font = '700 11px system-ui'; g.textAlign = 'center'; g.fillText('THEN', b.X, b.Y + 16);
  }
  // NET / OUT: drawn last so the net never hides the label.
  function drawErrs(g) {
    for (const m of S.marks) {
      if (m.kind !== 'net' && m.kind !== 'out') continue;
      const p = proj(m.x, m.y), r = Math.max(5, 0.25 * p.s), ly = m.kind === 'net' ? proj(m.x, m.y, 1.3).Y : p.Y - r - 4;
      g.strokeStyle = '#ff5252'; g.lineWidth = 2; seg(g, { X: p.X - r, Y: p.Y - r * 0.5 }, { X: p.X + r, Y: p.Y + r * 0.5 }); seg(g, { X: p.X - r, Y: p.Y + r * 0.5 }, { X: p.X + r, Y: p.Y - r * 0.5 });
      g.font = '800 13px system-ui'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeText(m.kind === 'net' ? 'NET' : 'OUT', p.X, ly);
      g.fillStyle = '#ff5252'; g.fillText(m.kind === 'net' ? 'NET' : 'OUT', p.X, ly);
    }
  }
  // ACE! / DOUBLE FAULT! / WINNER! / DROPPER!: big in the middle of the court with a shake, as on the main court.
  function drawPop(g) {
    const P0 = S.pop; if (!P0) return;
    const age = performance.now() - P0.t0, life = P0.life || 1400;
    if (age > life) { S.pop = null; return; }
    const a = Math.min(1, (life - age) / 350), pop = 1 + Math.max(0, 1 - age / 180) * 0.35;
    g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle';
    const X = V.cx ?? V.W / 2, Y = V.H * 0.42;
    g.font = `italic 900 ${Math.round(Math.min(92, V.W / 9) * pop)}px system-ui`;
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(P0.text, X, Y);
    g.fillStyle = P0.bad ? '#ff6b6b' : '#ffd60a'; g.fillText(P0.text, X, Y);
    if (P0.sub) { g.font = `800 ${Math.round(Math.min(34, V.W / 24))}px system-ui`; g.lineWidth = 4; g.strokeText(P0.sub, X, Y + Math.min(70, V.W / 12)); g.fillStyle = '#fff'; g.fillText(P0.sub, X, Y + Math.min(70, V.W / 12)); }
    g.globalAlpha = 1; g.textBaseline = 'alphabetic';
  }
  function draw() {
    if (!V.g || !V.W) return;
    const g = V.g;
    g.save();
    if (S.shake) { const k = Math.max(0, 1 - (performance.now() - S.shake) / 450); if (k === 0) S.shake = 0; else g.translate((Math.random() - 0.5) * 14 * k, (Math.random() - 0.5) * 14 * k); }
    drawCourt(g); drawMarks(g); drawPath(g); drawArrow(g);
    const ballFar = S.ball && S.ball.y >= 0;
    S.players.filter(p => p.y >= 0).forEach(p => drawPlayer(g, p)); if (ballFar) drawBall(g);
    drawNet(g);
    S.players.filter(p => p.y < 0).forEach(p => drawPlayer(g, p)); if (!ballFar) drawBall(g);
    drawErrs(g); drawPop(g);
    g.restore();
  }
  const popFor = (over, sh) => {
    const t = over.how === 'ace' ? 'ACE!' : over.how === 'df' ? 'DOUBLE FAULT!' : over.how === 'winner' ? (sh.type === 'drop' ? 'DROPPER!' : 'WINNER!') : null;
    if (t) { S.bubbles = [null, null]; S.pop = { text: t, t0: performance.now(), bad: over.w !== 0, life: over.how === 'ace' ? 2300 : 1600, sub: over.how === 'ace' && sh.kmh ? `${sh.kmh} km/h` : '' }; if (over.how === 'ace' || over.how === 'df') S.shake = performance.now(); }
  };
  const loop = () => { if (!V.on) return; draw(); requestAnimationFrame(loop); };
  const tween = (ms, fn) => new Promise(res => { const t0 = performance.now(); const step = now => { const u = Math.min(1, (now - t0) / Math.max(1, ms)); fn(u); if (u < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });

  // A player walks to a spot (legs moving, easing in and out) instead of snapping there. A newer walk takes over.
  let walkId = 0;
  function walkTo(p, to, mps = 3.2) {
    const id = ++walkId, from = { x: p.x, y: p.y }, dist = Math.hypot(to.x - from.x, to.y - from.y);
    if (dist < 0.02) return Promise.resolve();
    return tween(Math.max(250, dist / mps * 1000), u => { if (id !== walkId) return; const e = u * u * (3 - 2 * u); moveP(p, from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e); });
  }

  // --- Animating a shot ------------------------------------------------------------------------------------------
  const lerp = (a, b, u) => a + (b - a) * u;
  const wingDir = (p, wing) => handDir(p) * (wing === 'bh' ? -1 : 1);
  const standFor = (p, c, wing) => ({ x: c.x - wingDir(p, wing) * 0.75, y: c.y + (p.side === 0 ? -0.1 : 0.1) }); // the racket reaches the ball
  function moveP(p, x, y) { p.run += Math.hypot(x - p.x, y - p.y) * 3.2; p.x = x; p.y = y; }
  const poseOf = sh => (sh.serve ? 'serve' : sh.volley ? 'volley' : sh.type === 'drop' ? 'slice' : sh.type);
  function landWords(sh) {
    const L = sh.land, ax = Math.abs(L.x), ay = Math.abs(L.y), m = v => `${v.toFixed(1)} m`;
    const who = sh.by === 0 ? '<b class="me">Your ball</b>' : `<b class="op">${esc(S.players[1].name)}'s ball</b>`;
    if (sh.err) { const wide = ax - CB.HW, long = ay - (sh.serve ? CB.SL : CB.HL); return `${who} was <b class="bad">out</b>: ${long > wide ? `long by ${m(Math.max(0.05, long))}` : `wide by ${m(Math.max(0.05, wide))}`}.`; }
    const where = sh.serve ? `${m(CB.SL - ay)} inside the service line` : ay >= 8.5 ? `${m(CB.HL - ay)} inside the baseline` : ay <= 4 ? `${m(ay)} from the net` : 'short, near the service line';
    const side = ax > CB.HW - 0.8 ? `, ${m(CB.HW - ax)} from the sideline` : '';
    const aim = sh.by === 0 && !sh.serve && sh.aim ? ` (${m(Math.hypot(L.x - sh.aim.x, L.y - sh.aim.y))} off your aim)` : '';
    return `${who} landed ${where}${side}${aim}.`;
  }
  // Plays shot sh. freeze: stop just after the bounce as you arrive (your decision), finish with resume().
  async function playShot(sh, res, freeze = false) {
    const U = cur.U, H = S.players[sh.by], R = S.players[1 - sh.by], slow = speed();
    const v = Math.max(8, (sh.kmh || 100) * (sh.serve ? 0.76 : 0.78) / 3.6);
    const z0 = sh.serve ? 2.75 : sh.volley ? 1.2 : 0.95, p0 = { x: sh.from.x, y: sh.from.y, z: z0 };
    H.pose = poseOf(sh); H.wing = sh.wing; H.pu = 0;
    if (sh.serve) { S.ball = { x: H.x + handDir(H) * 0.1, y: H.y, z: 1.2 }; S.trail = []; await tween(420 * Math.min(1.6, slow / 1.6), u => { S.ball.z = lerp(1.2, 2.9, Math.sin(u * Math.PI / 2)); H.pu = u * 0.4; }); }
    else await tween(300 * Math.min(1.6, slow / 1.6), u => { H.pu = u * 0.4; });
    S.bubbles[1 - sh.by] = null;
    S.bubbles[sh.by] = { t1: shotName(sh), t2: '', until: performance.now() + 2600 * slow / 1.6 }; // just the shot; the rest is noise mid-rally
    U.call(`<b class="${sh.by === 0 ? 'me' : 'op'}">${sh.by === 0 ? 'You' : esc(S.players[1].name)}</b> ${shotName(sh)}`);
    const land = sh.land, shotN = ++S.n;
    S.marks = []; S.path = null; // only the shot being played is marked
    if (sh.by === 0) { S.marks = S.marks.filter(m => m.kind !== 'aim'); const a = sh.serve ? cbServeTarget(cur.st, sh.zone) : sh.aim; if (a) S.marks.push({ kind: 'aim', by: 0, n: shotN, x: a.x, y: a.y }); }
    const dA = Math.hypot(land.x - p0.x, land.y - p0.y) || 1;
    const apex = sh.serve ? 0.4 : (CB_SHOT[sh.type] || { apex: 1.5 }).apex;
    let end = null, tB = 0;
    if (sh.err === 'net') tB = 0;
    else if (sh.contact && !sh.err) {
      const reach = !res.over || res.over.how === 'fe' || res.over.how === 'ue';
      end = reach ? { ...sh.contact, z: sh.met ? 1.2 : 0.95 } : { x: land.x + (sh.contact.x - land.x) * 2, y: land.y + (sh.contact.y - land.y) * 2, z: 0.3 };
      tB = Math.max(0.25, (sh.time || 1) - dA / v) * (reach ? 1 : 1.6);
    } else { end = { x: land.x + (land.x - p0.x) / dA * 4, y: land.y + (land.y - p0.y) / dA * 4, z: 0.2 }; tB = 0.5; }
    const hump = { topspin: 1.3, flat: 0.8, slice: 0.45, lob: 2.6, drop: 0.5 }[sh.type] || (sh.spin === 'kick' ? 1.5 : 0.9);
    if (sh.met) tB = 0; // a volley: met before the bounce
    const tA = (sh.met ? Math.hypot(sh.contact.x - p0.x, sh.contact.y - p0.y) : dA) / v;
    // Pace you can feel: a big ball flies visibly quicker than a rally ball, so the firepower grows with the level.
    const punch = sh.type === 'lob' || sh.type === 'drop' ? 1 : cbClamp(Math.pow((sh.kmh || 110) / 110, 1.1), 0.85, 1.7);
    const T = (tA + tB) * 1000 * Math.max(1, slow / punch), gA = tA / (tA + tB);
    const h0 = { x: H.x, y: H.y }, hTo = sh.after || h0, r0 = { x: R.x, y: R.y };
    let rTo = r0;
    if (sh.contact && !sh.err) { const s2 = standFor(R, sh.contact, cur.st.inc ? cur.st.inc.wing : 'fh'); rTo = res.over && res.over.how !== 'fe' && res.over.how !== 'ue' ? { x: lerp(r0.x, s2.x, 0.7), y: lerp(r0.y, s2.y, 0.7) } : s2; }
    const netEnd = sh.met ? { x: sh.contact.x, y: sh.contact.y, z: 1.2 } : null;
    // Any ball that goes over clears the tape where it crosses (the drawn arc gets lifted if it would dip through).
    const tgtA = netEnd || { ...land, z: 0 }, un = (p0.y - 0) / ((p0.y - tgtA.y) || 1), arc = apex * (netEnd ? 0.5 : 1.15);
    let lift = 0;
    if (sh.err !== 'net' && un > 0.02 && un < 0.98) { const zN = lerp(z0, tgtA.z, un) + arc * 4 * un * (1 - un); if (zN < 1.12) lift = (1.12 - zN) / (4 * un * (1 - un)); }
    if (window.__xpNetLog && sh.err !== 'net' && un > 0.02 && un < 0.98) window.__xpNetLog.push(+(lerp(z0, tgtA.z, un) + (arc + lift) * 4 * un * (1 - un)).toFixed(2)); // tests only
    function ballAt(gl) {
      let b;
      if (sh.err === 'net') b = { x: lerp(p0.x, land.x, gl), y: lerp(p0.y, 0, gl), z: lerp(z0, 0.55, gl) + 0.6 * 4 * gl * (1 - gl) };
      else if (gl <= gA) { const u = gl / gA, tgt = netEnd || { ...land, z: 0 }; b = { x: lerp(p0.x, tgt.x, u), y: lerp(p0.y, tgt.y, u), z: lerp(z0, tgt.z, u) + (arc + lift) * 4 * u * (1 - u) }; }
      else { const u = (gl - gA) / (1 - gA); b = { x: lerp(land.x, end.x, u), y: lerp(land.y, end.y, u), z: lerp(0, end.z, u) + hump * 4 * u * (1 - u) }; }
      return b;
    }
    let landed = false;
    const at = gl => {
      H.pu = Math.min(1, 0.4 + 0.6 * gl * (tA + tB) * 1000 * slow / 500);
      const hu = Math.min(1, gl * 1.1); moveP(H, lerp(h0.x, hTo.x, hu), lerp(h0.y, hTo.y, hu));
      const ru = Math.max(0, Math.min(1, (gl - 0.12) / 0.88)); moveP(R, lerp(r0.x, rTo.x, ru), lerp(r0.y, rTo.y, ru));
      const b = ballAt(gl);
      S.ball = b; S.trail.push({ ...b }); if (S.trail.length > (punch > 1.25 ? 14 : 9)) S.trail.shift(); // a longer streak behind a heavy ball
      if (!landed && !sh.met && sh.err !== 'net' && gl >= gA) { // the bounce: mark it and say where it landed
        landed = true; S.marks = S.marks.filter(m => m.kind === 'aim');
        S.marks.push({ x: land.x, y: land.y, kind: sh.err ? 'out' : 'land', by: sh.by, n: shotN });
        U.land(landWords(sh));
      }
    };
    const run = (g0, g1) => tween((g1 - g0) * T, u => at(lerp(g0, g1, u)));
    const fin = async g0 => {
      await run(g0, 1);
      if (res && res.over) popFor(res.over, sh);
      if (sh.err === 'net') { S.marks.push({ x: land.x, y: land.y, kind: 'net', by: sh.by }); U.land(`${sh.by === 0 ? '<b class="me">Your ball</b>' : `<b class="op">${esc(S.players[1].name)}'s ball</b>`} hit the <b class="bad">net</b>.`); }
      H.pose = null; R.pose = null;
    };
    if (freeze && !sh.err) { const gN = sh.met ? 0.75 : Math.max(gA + 0.05, 0.86); await run(0, gN); cur.pending = () => { S.path = null; return fin(gN); }; return; }
    cur.pending = null; await fin(0);
  }
  async function resume() { const p = cur.pending; cur.pending = null; if (p) await p(); }

  // --- Reading the situation ------------------------------------------------------------------------------------
  const sideWords = x => (x > 0 ? 'right' : 'left'); // as you look at the screen
  // What you're told about the rally grows with your coach. With none, only what anyone could see from the court.
  const coachLv = () => (typeof teamLevel === 'function' && current.career ? teamLevel(current.career, 'coach') : 0);
  const STYLE_TIP = {
    'Counterpuncher': 'They chase everything down: build with depth before you go for it.',
    'Defensive Grinder': 'Long rallies suit them: take the ball early and come forward.',
    'Net Attacker': 'They want the net: keep it low at their feet, or lob them.',
    'Serve-and-Volley': 'Return low at their feet and make them volley up.',
    'Flat Attacker': 'They hit through you: use height and spin to throw off their timing.',
    'Heavy-Topspin Baseliner': 'High balls are their home: slice it low, especially to the backhand.',
    'Heavy-Topspin Attacker': 'High balls are their home: slice it low and take time away.',
    'Serve-Dominant': 'Their rally game is weaker than their serve: get the return deep and make them play.',
    'Solid Baseliner': 'Few holes: change direction and pace, then attack the short ball.',
    'Aggressive Baseliner': 'They go for winners early: make them hit one more ball.',
    'First-Strike Attacker': 'They want it over in three shots: return deep through the middle.',
    'Serve +1 Attacker': 'They want it over in three shots: return deep through the middle.',
    'All-Court': 'They can do a bit of everything: keep testing their weaker wing.',
    'Variety / Slice-Heavy': 'They break up the rhythm: stay patient and step in on the low ball.',
    'Creative Shotmaker': 'Expect the unexpected: stay central and don’t give them angles.',
  };
  function situation(st) {
    const opp = esc(S.players[1].name), inc = st.shots[st.shots.length - 1], me = st.inc, L = [], lv = coachLv();
    if (inc && !inc.feed) L.push(`<b class="op">${opp}</b>: ${shotName(inc)}.`);
    const o = st.pos[1];
    L.push(st.atNet[1] ? `<b class="op">${opp}</b> ${Math.abs(o.y) > 6.2 ? 'is coming in to the net' : 'is at the net'}.` : Math.abs(o.x) < 1 ? `<b class="op">${opp}</b> is back in the middle.`
      : `<b class="op">${opp}</b> is over to your ${sideWords(o.x)}.`);
    if (lv >= 1) {
      const pr = st.pr[0]; L.push(`🧑‍🏫 You're ${pr < 0.35 ? 'balanced, with time' : pr < 0.65 ? 'a little rushed' : pr < 0.95 ? 'stretched' : 'on the run'}.`);
      const B = st.ab[1]; if (B.bh < B.fh - 3) L.push('🧑‍🏫 Their backhand is the weaker side.'); else if (B.fh < B.bh - 3) L.push('🧑‍🏫 Their forehand is the weaker side.');
    }
    if (lv >= 2) {
      const lanes = st.mem.oppLanes && inc && inc.wing && !inc.serve ? st.mem.oppLanes[inc.wing] : null, n = lanes ? lanes.cross + lanes.line + lanes.middle : 0;
      if (n >= 3) { const best = Object.keys(lanes).sort((a, b) => lanes[b] - lanes[a])[0]; L.push(`🧑‍🏫 From the ${wingN(inc.wing).toLowerCase()} they've gone ${LANE_N[best].toLowerCase()} ${lanes[best]} of ${n} times.`); }
      const ex = cbExpect(st); if (ex) L.push(`🧑‍🏫 They're starting to read your ${wingN(me.wing).toLowerCase()} ${LANE_N[ex].toLowerCase()}.`);
    }
    if (lv >= 3 && STYLE_TIP[st.ab[1].style]) L.push(`🧑‍🏫 ${STYLE_TIP[st.ab[1].style]}`);
    if (lv >= 4) { const w = Object.entries(st.mem.works || {}).filter(([, v]) => v[1] >= 3).sort((a, b) => b[1][0] / b[1][1] - a[1][0] / a[1][1])[0]; if (w) L.push(`🧑‍🏫 Working best today: ${w[0]} (won ${w[1][0]} of ${w[1][1]}).`); }
    for (const n of st.ab[0].edgeNotes || []) L.push(n);
    if (lv === 0) L.push('<span class="xphint">Hire a coach for a better read on the rally.</span>');
    return L.map(t => `<p>${t}</p>`).join('');
  }
  // Six steps of risk, from the shot's chance of landing in: the same number sets how tight its mini-game is.
  const riskWord = p => (p >= 0.93 ? ['Safe', 'g'] : p >= 0.82 ? ['Low Risk', 'g'] : p >= 0.68 ? ['Risky', 'y'] : p >= 0.52 ? ['High Risk', 'r'] : p >= 0.38 ? ['Very High Risk', 'rr'] : ['Extreme', 'x']);
  window.xpRiskWord = riskWord;
  const hurtWord = v => (v >= 0.8 ? 'Winner Chance' : v >= 0.6 ? 'Puts Them In Trouble' : v >= 0.46 ? 'Builds Pressure' : 'Keeps You In It');

  // --- Decisions (no clock: nothing happens until you press the button) --------------------------------------------
  const SHOTS = [['topspin', 'Topspin'], ['flat', 'Flat'], ['slice', 'Slice'], ['drop', 'Drop Shot'], ['lob', 'Lob']];
  const DIRS = [['cross', 'Crosscourt'], ['middle', 'Middle'], ['line', 'Down The Line'], ['open', 'Open Court'], ['behind', 'Behind Them'], ['bh', 'Their Backhand'], ['fh', 'Their Forehand']];
  const ANGLE = ['angle', 'Extreme Angle'];
  const CROSSNET = ['crossnet', 'Cross-Net Angle'];
  const DIR_N = Object.fromEntries([...DIRS, ANGLE, CROSSNET]);
  const canAngle = st => st.atNet[0] || Math.abs(st.pos[0].x) > 3.4; // only from the net or from far out wide
  // A volley played along the net from one side of the court to the other: a net player's speciality.
  const NET_STYLES = ['All-Court', 'Net Attacker', 'Serve-and-Volley', 'Creative Shotmaker', 'Variety / Slice-Heavy'];
  const canCrossNet = st => st.atNet[0] && Math.abs(st.pos[0].y) < 4.5 && (NET_STYLES.includes(st.ab[0].style) || st.ab[0].net >= 65);
  // Which directions make sense from here. Down the line needs a line near you; behind them needs court behind them
  // (they've come inside the baseline); open court needs them pulled off to one side.
  function dirOK(st, k) {
    if (k === 'line') return Math.abs(st.pos[0].x) >= 1.2;
    if (k === 'behind') return Math.abs(st.pos[1].y) < 11.0;
    if (k === 'open') return Math.abs(st.pos[1].x) >= 1.0;
    if (k === 'angle') return canAngle(st);
    if (k === 'crossnet') return canCrossNet(st);
    return true;
  }
  // The nearest sensible direction when the one asked for (by your last shot or a play) isn't on here.
  function dirFallback(st, k) {
    if (dirOK(st, k)) return k;
    if (k === 'behind') return dirOK(st, 'open') ? 'open' : 'cross';
    if (k === 'line') return 'middle';
    return 'cross';
  }
  const DEPTHS = [['deep', 'Deep'], ['mid', 'Mid-Court'], ['short', 'Short Angle']];
  const DEPTH_N = Object.fromEntries(DEPTHS);
  const MOVES_N = { recover: 'Recover', cross: 'Cover Cross', line: 'Cover Line', net: 'Come In' };
  // Which side (court x sign) a direction means right now: open court is away from them, behind them is where they are.
  function sideFor(st, dir) {
    const sg = st.pos[0].x >= 0 ? 1 : -1, ox = st.pos[1].x;
    if (dir === 'cross') return -sg;
    if (dir === 'line') return sg;
    if (dir === 'open') return Math.abs(ox) < 0.8 ? -sg : -Math.sign(ox);
    if (dir === 'behind') return Math.abs(ox) < 0.8 ? sg : Math.sign(ox);
    if (dir === 'bh') return st.ab[1].lefty ? -1 : 1; // the far player's backhand side
    if (dir === 'fh') return st.ab[1].lefty ? 1 : -1; // and their forehand side: from the middle, the other corner
    return 0;
  }
  // The flight of the shot you're building, from your racket to where you're aiming and on after the bounce:
  // a lob floats high, flat skims the net, a drop shot dies short. Drawn the same way the real ball is.
  function previewPath(st, aim, type) {
    const vol = st.inc && st.inc.volley, t = type === 'slice' && Math.abs(aim.y) < 4.8 && !vol ? 'drop' : type, T = CB_SHOT[t] || CB_SHOT.topspin;
    // Under pressure the ball comes up a little short (as in cbsim.js): the path ends where it will really land.
    aim = { x: aim.x, y: aim.y - (t === 'lob' || t === 'drop' ? 0 : Math.min(1.2, st.pr[0]) * 0.8) };
    const p0 = { x: st.pos[0].x, y: st.pos[0].y, z: vol ? 1.2 : 0.95 }, arc = T.apex * 1.15, un = (0 - p0.y) / ((aim.y - p0.y) || 1);
    let lift = 0;
    if (un > 0.02 && un < 0.98) { const zN = p0.z * (1 - un) + arc * 4 * un * (1 - un); if (zN < 1.12) lift = (1.12 - zN) / (4 * un * (1 - un)); }
    const pts = [];
    for (let k = 0; k <= 30; k++) { const u = k / 30; pts.push({ x: lerp(p0.x, aim.x, u), y: lerp(p0.y, aim.y, u), z: p0.z * (1 - u) + (arc + lift) * 4 * u * (1 - u) }); }
    const dx = aim.x - p0.x, dy = aim.y - p0.y, L = Math.hypot(dx, dy) || 1, bl = T.bounce * (st.surf ? st.surf.bounce : 1);
    const hump = { topspin: 1.3, flat: 0.8, slice: 0.45, lob: 2.6, drop: 0.5 }[t] || 0.9;
    for (let k = 1; k <= 12; k++) { const u = k / 12; pts.push({ x: aim.x + dx / L * bl * u, y: aim.y + dy / L * bl * u, z: hump * Math.sin(u * Math.PI * 0.8) }); }
    return { by: 0, pts };
  }
  function aimFor(st, dir, depth, type) {
    if (dir === 'crossnet') return { x: -(st.pos[0].x >= 0 ? 1 : -1) * 3.65, y: 1.8 }; // just over the net, out by the far sideline
    const side = sideFor(st, dir === 'angle' ? 'cross' : dir);
    if (dir === 'angle' && type !== 'drop' && type !== 'lob') return { x: side * 3.95, y: st.atNet[0] ? 3.3 : 4.4 }; // short and wide, across the net
    if (type === 'drop') return { x: side * 1.7, y: 2.4 };
    if (type === 'lob') return { x: side * 1.8, y: 10.3 };
    if (depth === 'short') return { x: side * 3.5, y: side ? 5.6 : 5.0 };
    return { x: side * 2.8, y: depth === 'mid' ? 7.6 : 9.9 };
  }
  // How close to the lines you aim: safe pulls the ball in, on the lines paints the sideline and baseline (riskier, more winners).
  const MARGINS = [['safe', 'Safe'], ['normal', 'Normal'], ['lines', 'On The Lines']];
  function applyMargin(aim, margin) {
    if (!margin || margin === 'normal') return aim;
    const sx = Math.sign(aim.x), ax = Math.abs(aim.x), ay = aim.y;
    if (margin === 'safe') return { x: sx * ax * 0.75, y: ay >= 8 ? ay - 0.9 : ay + 0.4 };
    return { x: ax > 0.6 ? sx * Math.min(3.85, ax + (3.85 - ax) * 0.7) : aim.x, y: ay >= 8 ? Math.min(11.4, ay + (11.4 - ay) * 0.7) : ay < 3 ? Math.max(1.3, ay - 0.6) : ay };
  }
  // Where "Then" takes you after the shot: back to the middle of their angles, a step towards the side you're covering, or in to the net.
  // Exactly what the engine will do (cbsim.js): head for that spot and get as far as the time allows before they hit.
  function thenSpot(st, meet, move) {
    const t = { ...st, atNet: [st.atNet[0] || move === 'net', st.atNet[1]], cover: move === 'cross' || move === 'line' ? move : null };
    return cbMoveToward(st.pos[0], cbCoverSpot(t, 0, meet.contact), cbRecoverReach(t, 0, meet));
  }
  const segBtns = (key, items, cur0, cls = '', hint = null) => `<div class="xpseg ${cls}">${items.map(([k, l, tip]) => `<button type="button" data-${key}="${k}" class="${k === cur0 ? 'on' : ''}${hint ? (hint.has(k) ? ' hint' : ' safe') : ''}"${tip ? ` title="${tip}" aria-label="${tip}"` : ''}>${l}</button>`).join('')}</div>`;
  // Icon mode (the 🔣 button): the shot panel in pictures. An arrow drawn the way the ball (or you) will go, seen from behind you.
  const iconsOn = () => !!cbData().icons;
  const arrowSvg = deg => `<svg class="xpico" viewBox="-12 -12 24 24"><g transform="rotate(${Math.round(deg)})"><path d="M0 9V-7M-5.5-1.5L0-8L5.5-1.5" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
  const degTo = (from, to) => { const A = proj(from.x, from.y), B = proj(to.x, to.y); return Math.atan2(B.X - A.X, A.Y - B.Y) * 180 / Math.PI; }; // as it looks on screen
  const racketSvg = n => `<svg class="xpico" viewBox="0 0 24 24"><ellipse cx="12" cy="8" rx="5.5" ry="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 14.5V23" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>${n === 2 ? '<circle cx="8.6" cy="20.4" r="2.6" fill="#ffd54f"/><circle cx="15.4" cy="20.4" r="2.6" fill="#ffd54f"/>' : '<circle cx="12" cy="20.4" r="2.8" fill="#ffd54f"/>'}</svg>`;
  const SHOT_ICO = { lob: '🌈', slice: '🔪', drop: '🪶', topspin: '🌀', flat: '⚡' };
  const DEPTH_ICO = { deep: '⏫', mid: '🔼', short: '📐' }, MARGIN_ICO = { safe: '🛡️', normal: '⚖️', lines: '🎯' };
  let lastShot = { type: 'topspin', dir: 'cross', depth: 'deep', margin: 'normal' };
  // God Panel: "win/lose this point" while a decision is open.
  const godHook = (U, res, clean) => { U.godReq = g => { clean(); res({ god: g }); }; };
  // o.step: a play's planned shot (pre-filled); o.why: why the play stopped; o.play: the play; o.done: the play has finished.
  window.xpAskShot = (U, st, o = {}) => new Promise(res => {
    let { type, dir, depth, margin = 'normal' } = o.step || lastShot, move = (o.step && o.step.move) || 'recover', spot = null, dropped = false;
    const dirs = [...DIRS, ANGLE, CROSSNET].filter(([k]) => dirOK(st, k));
    dir = dirFallback(st, dir);
    if (move === 'net' && st.atNet[0]) move = 'recover';
    const moves = [['recover', st.atNet[0] ? 'Hold The Net' : 'Recover To Middle'], ['cross', 'Cover Their Crosscourt'], ['line', 'Cover Their Line'], ...(st.atNet[0] ? [] : [['net', 'Come To The Net']])];
    U.setRead(situation(st)); // the rally read lives in the drop-down under the scoreboard, not with the controls
    let moveSet = false; // the Then arrow stays hidden until you tap a Then
    const clean = () => { V.c.onclick = null; S.targets = []; S.path = null; S.arrow = null; U.panel(''); U.godReq = null; cur.rerender = null; };
    // A faint dot on the choices that this ball makes risky right now (a hint, not a number).
    // Only the choices clearly riskier than the safest one in their row are marked, so the dot means "not this one, here".
    const pInOf = (k, kind) => cbValue(st, 0, kind === 't' ? (spot || applyMargin(aimFor(st, dir, depth, k), margin)) : applyMargin(aimFor(st, k, depth, type), margin), kind === 't' ? k : type, move === 'net').pIn;
    const riskySet = (keys, kind) => { const p = keys.map(k => pInOf(k, kind)), top = Math.max(...p); return new Set(keys.filter((k, i) => p[i] < top - 0.12 && p[i] < 0.82)); };
    const head = () => o.step && !dropped ? `<div class="xpaud"><b>📖 ${esc(o.play.name)}: Audible?</b><p>${o.why}</p><p class="xphint">Planned: ${stepText(o.step)}. Change it below and press Hit It, or:</p>` +
        '<div class="xpseg"><button type="button" data-run>Run The Play</button><button type="button" data-dropplay>Drop The Play</button></div></div>'
      : o.done ? `<div class="xpaud"><b>📖 ${esc(o.play.name)}: Play Complete</b><p>You're on your own from here.</p></div>` : '';
    cur.rerender = () => render(); // the 🔣 button redraws the panel in words or pictures
    const render = () => {
      const aim = spot || applyMargin(aimFor(st, dir, depth, type), margin), e = cbValue(st, 0, aim, type, move === 'net'), [rw, rc] = riskWord(e.pIn);
      const sh = { wing: st.inc.wing, volley: st.inc.volley, type: e.t, aim, from: st.pos[0] };
      S.targets = [{ ...aim }]; S.path = previewPath(st, aim, type); // the flight of the shot you're building
      S.arrow = moveSet ? { from: { ...st.pos[0] }, to: thenSpot(st, e.meet, move) } : null; // where you'll go after it, once you've picked a Then
      const hintT = riskySet(SHOTS.map(([k]) => k), 't'), hintD = spot ? new Set() : riskySet(dirs.map(([k]) => k), 'd');
      const ic = iconsOn(), me = st.pos[0];
      let shotsI = SHOTS, dirsI = dirs, depthsI = DEPTHS, marginsI = MARGINS, movesI = moves;
      if (ic) { // pictures; directions that would land in the same place show once
        shotsI = SHOTS.map(([k, l]) => [k, SHOT_ICO[k], l]);
        const seen = []; dirsI = [];
        for (const [k, l] of dirs) {
          if (k === 'bh' || k === 'fh') { dirsI.push([k, racketSvg(k === 'bh' ? 2 : 1), l]); continue; }
          const dg = degTo(me, aimFor(st, k, depth, type));
          if (seen.some(x => Math.abs(x - dg) < 9) && k !== dir) continue;
          seen.push(dg); dirsI.push([k, arrowSvg(dg), l]);
        }
        depthsI = DEPTHS.map(([k, l]) => [k, DEPTH_ICO[k], l]); marginsI = MARGINS.map(([k, l]) => [k, MARGIN_ICO[k], l]);
        movesI = moves.map(([k, l]) => { const to = thenSpot(st, e.meet, k), far = Math.hypot(to.x - me.x, to.y - me.y) < 0.4; return [k, far ? '⏺️' : arrowSvg(degTo(me, to)), l]; });
      }
      U.panel(head() + '<h3>Shot</h3>' + segBtns('t', shotsI, type, ic ? 'diamond icons' : 'five', hintT) +
        '<h3>Direction</h3>' + segBtns('d', dirsI, spot ? null : dir, ic ? 'three icons' : 'three', hintD) +
        (type === 'drop' || type === 'lob' || dir === 'angle' || dir === 'crossnet' ? '' : '<h3>Depth</h3>' + segBtns('p', depthsI, spot ? null : depth, ic ? 'three icons' : 'three')) +
        (spot ? '<p class="xphint">Aiming at the spot you tapped.</p>' : '<h3>Margin</h3>' + segBtns('mg', marginsI, margin, ic ? 'three icons' : 'three')) +
        '<h3>Then</h3>' + segBtns('m', movesI, move, ic ? 'four icons' : '') +
        `<div class="xphitbar"><div class="xppre"><b>${shotName(sh)}</b><span>${shotWhere(sh)}</span><em><u class="${rc}">${rw}</u> ${hurtWord(e.v)}</em></div>` +
        '<button type="button" class="xpbig" data-hit>Hit It</button></div>');
      const P = U.pan;
      P.querySelectorAll('[data-t]').forEach(b => { b.onclick = () => { type = b.dataset.t; render(); }; });
      P.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => { dir = b.dataset.d; spot = null; render(); }; });
      P.querySelectorAll('[data-p]').forEach(b => { b.onclick = () => { depth = b.dataset.p; spot = null; render(); }; });
      P.querySelectorAll('[data-m]').forEach(b => { b.onclick = () => { move = b.dataset.m; moveSet = true; render(); }; });
      P.querySelectorAll('[data-mg]').forEach(b => { b.onclick = () => { margin = b.dataset.mg; render(); }; });
      const rb = q(P, '[data-run]'); if (rb) rb.onclick = () => { clean(); res({ ...stepShot(st, o.step), run: true }); };
      const db = q(P, '[data-dropplay]'); if (db) db.onclick = () => { dropped = true; render(); };
      q(P, '[data-hit]').onclick = () => { clean(); lastShot = { type, dir, depth, margin }; res({ aim, type, move, dropped }); };
    };
    V.c.onclick = ev => { // tap their side of the court: aim at that spot
      const r = V.c.getBoundingClientRect(), p = unproj(ev.clientX - r.left, ev.clientY - r.top);
      if (!(p.y > 0.5 && p.y < 13.5 && Math.abs(p.x) < 6)) return;
      spot = { x: Math.max(-4.4, Math.min(4.4, p.x)), y: Math.min(12.2, p.y) }; render();
    };
    godHook(U, res, clean);
    render();
  });
  const backBtn = '<button type="button" class="xpback" data-back>‹ Back To Plays</button>';
  window.xpAskServe = (U, st, o = {}) => new Promise(res => {
    const B = st.ab[1], c = st.mem.serve[st.deuce ? 'd' : 'a'], rs = cbReturnSpot(st), lv = coachLv();
    const bhZone = ['wide', 't'].find(z => cbWing(B, 1, rs, cbServeTarget(st, z)) === 'bh');
    let zone = null, sv = false;
    const clean = () => { S.targets = []; U.panel(''); U.godReq = null; };
    U.setRead(`<p><b class="me">Your ${st.serve2 ? 'second' : 'first'} serve</b> · ${st.deuce ? 'Deuce' : 'Ad'} side.</p>` +
      (lv >= 1 && B.bh < B.fh - 3 && bhZone ? `<p>🧑‍🏫 Their backhand return is weaker: on this side that's ${ZONE_N[bhZone].toLowerCase()}.</p>` : '') +
      (lv >= 2 && c.wide + c.body + c.t ? `<p>🧑‍🏫 They've seen you serve here: wide ${c.wide} · body ${c.body} · T ${c.t}.</p>` : '') +
      (lv >= 3 && STYLE_TIP[B.style] ? `<p>🧑‍🏫 ${STYLE_TIP[B.style]}</p>` : '') + (lv === 0 ? '<p class="xphint">Hire a coach for a better read.</p>' : ''));
    const render = () => {
      S.targets = zone ? [{ ...cbServeTarget(st, zone) }] : [];
      U.panel((o.back ? backBtn : '') + `<h3>${st.serve2 ? 'Second Serve' : 'First Serve'} · Where</h3>` + segBtns('z', ['wide', 'body', 't'].map(z => [z, ZONE_N[z]]), zone, 'three') +
        `<h3>Which Serve</h3><div class="xpseg three">${[['flat', 'Fastest'], ['slice', 'Curves Away'], ['kick', 'Safest']].map(([k, d]) =>
          `<button type="button" class="xpcard" data-s="${k}" ${zone ? '' : 'disabled'}><b>${SPIN_N[k]}</b><span>${d}</span></button>`).join('')}</div>` +
        (st.serve2 ? '' : `<div class="xpseg one"><button type="button" data-sv class="${sv ? 'on' : ''}">Serve And Volley: ${sv ? 'On' : 'Off'}</button></div>`));
      const P = U.pan;
      P.querySelectorAll('[data-z]').forEach(b => { b.onclick = () => { zone = b.dataset.z; render(); }; });
      const svb = q(P, '[data-sv]'); if (svb) svb.onclick = () => { sv = !sv; render(); };
      P.querySelectorAll('[data-s]').forEach(b => { b.onclick = () => { clean(); res({ zone, spin: b.dataset.s, approach: sv }); }; });
      const bk = q(P, '[data-back]'); if (bk) bk.onclick = () => { clean(); res({ back: true }); };
    };
    godHook(U, res, clean);
    render();
  });
  // Where you stand to return: in to take it early, back to buy time against pace (remembered between points).
  const RETPOS = [['inside', 'Inside'], ['normal', 'Normal'], ['deep', 'Deep'], ['vdeep', 'Very Deep']];
  const retPos = () => cbData().retPos || 'normal';
  const standRow = () => '<h3>Stand</h3>' + segBtns('rp', RETPOS, retPos(), 'four');
  // Tapping a spot walks you there straight away (no waiting for the point, no snapping).
  const bindStand = (P, again, st) => P.querySelectorAll('[data-rp]').forEach(b => { b.onclick = () => {
    const d = cbData(); d.retPos = b.dataset.rp; cbSave(d);
    // Between points you walk there now; once the ball is in play it waits for the next point.
    if (st && st.server === 1 && cur.dead) { st.ab[0].retPos = d.retPos; walkTo(S.players[0], cbReturnSpot(st)); }
    again();
  }; });
  // Returning needs no input: a moment to change where you stand, then their serve comes.
  window.xpAskReturn = (U, st) => new Promise(res => {
    U.setRead(`<p><b class="op">${esc(S.players[1].name)}</b> to serve · ${st.deuce ? 'Deuce' : 'Ad'} side.</p>`);
    const render = () => { U.panel(`<h3>Their Serve · Stand</h3>` + segBtns('rp', RETPOS, retPos(), 'four')); bindStand(U.pan, render, st); };
    godHook(U, res, () => { U.panel(''); U.godReq = null; });
    render(); setTimeout(() => res(null), 1100);
  });
  window.xpAskRead = (U, st, o = {}) => new Promise(res => {
    const c = (st.mem.oppServe || {})[st.deuce ? 'd' : 'a'] || { wide: 0, body: 0, t: 0 }, n = c.wide + c.body + c.t, lv = coachLv();
    const clean = () => { U.panel(''); U.godReq = null; };
    U.setRead(`<p><b class="op">${esc(S.players[1].name)}</b> to serve · ${st.serve2 ? 'second serve' : 'first serve'} · ${st.deuce ? 'Deuce' : 'Ad'} side.</p>` +
      (lv >= 1 && n ? `<p>🧑‍🏫 Their serves on this side: wide ${c.wide} · body ${c.body} · T ${c.t}.</p>` : '') +
      (st.ab[0].scouted && st.ab[1].favServe ? `<p>🔎 Scouted: they favour ${ZONE_N[st.ab[1].favServe[st.deuce ? 'd' : 'a']].toLowerCase()} on this side.</p>` : '') +
      (lv >= 3 && STYLE_TIP[st.ab[1].style] ? `<p>🧑‍🏫 ${STYLE_TIP[st.ab[1].style]}</p>` : '') + (lv === 0 ? '<p class="xphint">Hire a coach for a better read.</p>' : ''));
    const render = () => {
      const fav = st.ab[0].scouted && st.ab[1].favServe ? st.ab[1].favServe[st.deuce ? 'd' : 'a'] : null;
      U.panel((o.back ? backBtn : '') + (fav ? `<p class="xpedge">🔎 Scouted: they favour <b>${ZONE_N[fav]}</b> on this side.</p>` : '') + `<h3>${st.serve2 ? 'Second Serve' : 'Their Serve'} · Your Guess</h3>${segBtns('g', [...['wide', 'body', 't'].map(z => [z, ZONE_N[z]]), ['', 'Just React']])}` + standRow());
      U.pan.querySelectorAll('[data-g]').forEach(b => { b.onclick = () => { clean(); res(b.dataset.g || null); }; });
      bindStand(U.pan, render, st);
      const bk = q(U.pan, '[data-back]'); if (bk) bk.onclick = () => { clean(); res({ back: true }); };
    };
    godHook(U, res, clean);
    render();
  });

  // --- The Playbook ---------------------------------------------------------------------------------------------
  // A play: a serve (or a return guess) and up to four shots, each with a Then. Called before a point, it runs at
  // full speed and stops only when the point breaks it. Plays are kept in the Extreme practice data (cbData().plays)
  // with a lifetime record; how often you've called each one this match is in the match memory (they learn it).
  const STARTER_PLAYS = [
    { id: 'p1', kind: 'serve', name: 'Wide Then Open Court', serve: { zone: 'wide', spin: 'slice', approach: false }, steps: [{ type: 'flat', dir: 'open', depth: 'deep', move: 'recover' }, { type: 'topspin', dir: 'open', depth: 'deep', move: 'recover' }] },
    { id: 'p2', kind: 'serve', name: 'Body Jam', serve: { zone: 'body', spin: 'kick', approach: false }, steps: [{ type: 'topspin', dir: 'bh', depth: 'deep', move: 'recover' }, { type: 'flat', dir: 'open', depth: 'deep', move: 'net' }] },
    { id: 'p3', kind: 'serve', name: 'Serve And Volley T', serve: { zone: 't', spin: 'flat', approach: true }, steps: [{ type: 'flat', dir: 'open', depth: 'deep', move: 'recover' }, { type: 'drop', dir: 'open', depth: 'short', move: 'recover' }] },
    { id: 'p4', kind: 'return', name: 'Deep Middle Reset', read: null, steps: [{ type: 'topspin', dir: 'middle', depth: 'deep', move: 'recover' }, { type: 'topspin', dir: 'bh', depth: 'deep', move: 'recover' }] },
    { id: 'p5', kind: 'return', name: 'Chip And Charge', read: null, steps: [{ type: 'slice', dir: 'line', depth: 'deep', move: 'net' }, { type: 'flat', dir: 'open', depth: 'deep', move: 'recover' }] },
    { id: 'p6', kind: 'return', name: 'Pound The Backhand', read: null, steps: [{ type: 'topspin', dir: 'bh', depth: 'deep', move: 'cross' }, { type: 'topspin', dir: 'bh', depth: 'deep', move: 'recover' }, { type: 'flat', dir: 'open', depth: 'deep', move: 'recover' }] },
  ];
  function plays() { const d = cbData(); if (!Array.isArray(d.plays)) { d.plays = STARTER_PLAYS.map(p => ({ ...p, n: 0, won: 0 })); cbSave(d); } return d.plays; }
  const stepText = p => `${TYPE_N[p.type]} ${DIR_N[p.dir]}${p.type === 'drop' || p.type === 'lob' ? '' : ` ${DEPTH_N[p.depth]}`}${p.margin === 'lines' ? ' On The Lines' : p.margin === 'safe' ? ' (Safe)' : ''} (${MOVES_N[p.move] || 'Recover'})`;
  const stepShot = (st, p) => ({ aim: applyMargin(aimFor(st, dirFallback(st, p.dir), p.depth, p.type), p.margin), type: p.type, move: st.atNet[0] && p.move === 'net' ? 'recover' : p.move });
  const playLine = p => [p.kind === 'serve' ? `${SPIN_N[p.serve.spin]} ${ZONE_N[p.serve.zone]}${p.serve.approach ? ' + Volley' : ''}` : p.read ? `Guess ${ZONE_N[p.read]}` : 'Return',
    ...p.steps.map(x => `${TYPE_N[x.type]} ${DIR_N[x.dir]}`)].join(' → ');
  // Why a play can't simply carry on here (null = it can).
  function playBreak(st, step) {
    if (st.pr[0] >= 0.85) return "You're stretched: the planned shot is a big risk from here.";
    if (st.atNet[1] && step.type !== 'lob') return Math.abs(st.pos[1].y) > 6.2 ? "They're coming in to the net." : "They're at the net.";
    if (!st.inc.volley && st.pos[0].y > -8.3 && step.type !== 'drop') return 'A short ball: a chance to attack.';
    return null;
  }
  // Before a point: call a play, or play it live.
  window.xpAskPlay = (U, st) => new Promise(res => {
    const kind = st.server === 0 ? 'serve' : 'return', seen = (st.mem.plays || {});
    const clean = () => { U.panel(''); U.godReq = null; };
    U.setRead(`<p>${kind === 'serve' ? '<b class="me">Your serve</b>' : `<b class="op">${esc(S.players[1].name)}</b> to serve`} · ${st.deuce ? 'Deuce' : 'Ad'} side.</p>`);
    let open = false; // the play list folds away behind the Plays button
    const render = () => {
      const list = plays().filter(p => p.kind === kind);
      U.panel(`<div class="xpseg three"><button type="button" data-live>🎾 Play It Live</button><button type="button" data-book>📖 Edit Playbook</button><button type="button" data-plays class="${open ? 'on' : ''}">📋 Plays ${open ? '▴' : '▾'}</button></div>` +
        `<div class="xpplays"${open ? '' : ' hidden'}>${list.map(p => `<button type="button" class="xpplay" data-play="${p.id}"><b>${esc(p.name)}</b><span>${playLine(p)}</span>` +
          `<em>${p.n ? `Won ${p.won} Of ${p.n}` : 'Not Used Yet'}${seen[p.id] >= 2 ? ` · <u class="r">They've Seen It ${seen[p.id]}×</u>` : seen[p.id] ? ' · Seen Once' : ''}</em></button>`).join('')}</div>` +
        (kind === 'return' ? standRow() : ''));
      // A play starts on its own after a moment, with a Back button in case you change your mind.
      U.pan.querySelectorAll('[data-play]').forEach(b => { b.onclick = () => {
        const p = plays().find(x => x.id === b.dataset.play);
        U.panel(`<div class="xpstart"><div><b>📖 ${esc(p.name)}</b><span>Starting…</span></div>${backBtn}</div>`);
        const t = setTimeout(() => { clean(); res(p); }, 1300);
        q(U.pan, '[data-back]').onclick = () => { clearTimeout(t); render(); };
      }; });
      q(U.pan, '[data-live]').onclick = () => { clean(); res(null); };
      q(U.pan, '[data-book]').onclick = () => playbookEditor(render);
      q(U.pan, '[data-plays]').onclick = () => { open = !open; render(); };
      bindStand(U.pan, render, st);
    };
    godHook(U, res, clean);
    render();
  });
  // The Playbook editor (a window over whatever is on screen).
  function playbookEditor(onDone = () => {}) {
    let edit = null; // the play being edited (a copy) or null for the list
    const close = () => { closeModal(); onDone(); };
    const save = list => { const d = cbData(); d.plays = list; cbSave(d); };
    const newStep = () => ({ type: 'topspin', dir: 'cross', depth: 'deep', move: 'recover' });
    const render = () => {
      if (!edit) {
        const list = plays();
        openModal(`<button type="button" class="x" data-pb="close" aria-label="Close">×</button><h2 class="itop">📖 Your Playbook</h2>` +
          '<p class="hint center">Plays you can call before a point. Each one runs at full speed until the point breaks it.</p>' +
          ['serve', 'return'].map(k => `<h3 class="ssec">${k === 'serve' ? 'Serve Plays' : 'Return Plays'}</h3>` + list.filter(p => p.kind === k).map(p =>
            `<div class="xpbrow"><div><b>${esc(p.name)}</b><span>${playLine(p)}</span><em>${p.n ? `Won ${p.won} Of ${p.n}` : 'Not Used Yet'}</em></div>` +
            `<button type="button" class="btn small" data-pb="edit" data-id="${p.id}">Edit</button></div>`).join('') +
            `<button type="button" class="btn ghost small" data-pb="new" data-k="${k}">+ New ${k === 'serve' ? 'Serve' : 'Return'} Play</button>`).join('') +
          '<button type="button" class="btn" data-pb="close">Done</button>', { wide: true, onClose: onDone });
      } else {
        const e = edit, row = (key, items, cur0, i, cls = 'three') => `<div class="xpseg ${cls}">${items.map(([k, l]) => `<button type="button" data-pb="set" data-f="${key}" data-i="${i}" data-v="${k}" class="${k === cur0 ? 'on' : ''}">${l}</button>`).join('')}</div>`;
        openModal(`<h2 class="itop">${e.isNew ? 'New' : 'Edit'} ${e.kind === 'serve' ? 'Serve' : 'Return'} Play</h2><div class="xpbed">` +
          `<label class="xplbl">Name<input type="text" id="pbName" maxlength="28" value="${esc(e.name)}"></label>` +
          (e.kind === 'serve' ? '<h3>Serve</h3>' + row('zone', ['wide', 'body', 't'].map(z => [z, ZONE_N[z]]), e.serve.zone, -1) + row('spin', ['flat', 'slice', 'kick'].map(z => [z, SPIN_N[z]]), e.serve.spin, -1) +
            row('approach', [['', 'Stay Back'], ['1', 'Serve And Volley']], e.serve.approach ? '1' : '', -1, '')
            : '<h3>Return: Your Guess</h3>' + row('read', [...['wide', 'body', 't'].map(z => [z, ZONE_N[z]]), ['', 'Just React']], e.read || '', -1, '')) +
          e.steps.map((st0, i) => `<div class="xpstep"><h3>Shot ${i + 1}${e.steps.length > 1 ? ` <button type="button" class="link" data-pb="del" data-i="${i}">Remove</button>` : ''}</h3>` +
            row('type', SHOTS, st0.type, i) + row('dir', [...DIRS, ANGLE], st0.dir, i) + (st0.type === 'drop' || st0.type === 'lob' || st0.dir === 'angle' ? '' : row('depth', DEPTHS, st0.depth, i)) + row('margin', MARGINS, st0.margin || 'normal', i) +
            '<p class="xphint">Then</p>' + row('move', Object.entries(MOVES_N), st0.move, i, '') + '</div>').join('') +
          (e.steps.length < 4 ? '<button type="button" class="btn ghost small" data-pb="add">+ Add A Shot</button>' : '') +
          `<div class="btn-row"><button type="button" class="btn" data-pb="save">Save Play</button><button type="button" class="btn ghost" data-pb="back">Cancel</button></div>` +
          (e.isNew ? '' : '<p class="center"><button type="button" class="link" data-pb="remove">Delete This Play</button></p>') + '</div>', { wide: true, onClose: onDone });
      }
      const sheet = document.getElementById('sheet');
      sheet.onclick = ev => {
        const b = ev.target.closest('[data-pb]'); if (!b) return;
        const k = b.dataset.pb, nameEl = document.getElementById('pbName');
        if (edit && nameEl) edit.name = nameEl.value.trim() || edit.name;
        if (k === 'close') return close();
        if (k === 'edit') edit = JSON.parse(JSON.stringify(plays().find(p => p.id === b.dataset.id)));
        if (k === 'new') edit = b.dataset.k === 'serve' ? { isNew: 1, id: 'u' + Date.now().toString(36), kind: 'serve', name: 'My Serve Play', serve: { zone: 'wide', spin: 'slice', approach: false }, steps: [newStep()], n: 0, won: 0 }
          : { isNew: 1, id: 'u' + Date.now().toString(36), kind: 'return', name: 'My Return Play', read: null, steps: [newStep()], n: 0, won: 0 };
        if (k === 'set') {
          const i = +b.dataset.i, f = b.dataset.f, v = b.dataset.v;
          if (i < 0) { if (f === 'read') edit.read = v || null; else if (f === 'approach') edit.serve.approach = !!v; else edit.serve[f] = v; }
          else edit.steps[i][f] = v;
        }
        if (k === 'add') edit.steps.push(newStep());
        if (k === 'del') edit.steps.splice(+b.dataset.i, 1);
        if (k === 'back') edit = null;
        if (k === 'save') { const p = { ...edit }; delete p.isNew; const list = plays(), i = list.findIndex(x => x.id === p.id); if (i >= 0) list[i] = p; else list.push(p); save(list); edit = null; }
        if (k === 'remove') { save(plays().filter(x => x.id !== edit.id)); edit = null; }
        render();
      };
    };
    render();
  }
  window.xpPlaybook = playbookEditor;

  // --- One point ----------------------------------------------------------------------------------------------
  function setPlayers(st) {
    const nm = n => String(n || 'Opponent').split(' ').slice(-1)[0];
    S.players = [{ side: 0, x: st.pos[0].x, y: st.pos[0].y, name: 'You', run: 0, pu: 0, lefty: st.ab[0].lefty, oneBh: st.ab[0].oneBh, look: XL.resolve(current.player && current.player.look) },
      { side: 1, x: st.pos[1].x, y: st.pos[1].y, name: nm(st.ab[1].name), run: 0, pu: 0, lefty: st.ab[1].lefty, oneBh: st.ab[1].oneBh, look: XL.randomFor(st.ab[1].name) }];
  }
  function placeForServe(st) {
    const sp = cbServeSpot(st), rp = cbReturnSpot(st), sv = S.players[st.server], rc = S.players[1 - st.server];
    sv.x = sp.x; sv.y = sp.y; rc.x = rp.x; rc.y = rp.y; sv.pose = rc.pose = null; S.ball = null; S.trail = []; S.marks = [];
  }
  // Plays a point (o.incoming: a rally already under way, their ball in the air; o.onMyTurn(st) true ends it early).
  async function xpRunPoint(U, st, o = {}) {
    cur.st = st; cur.U = U; S.surface = U.surface; st.cover = null;
    st.mem.oppLanes = st.mem.oppLanes || { fh: { cross: 0, line: 0, middle: 0 }, bh: { cross: 0, line: 0, middle: 0 } };
    st.mem.oppServe = st.mem.oppServe || { d: { wide: 0, body: 0, t: 0 }, a: { wide: 0, body: 0, t: 0 } };
    st.mem.plays = st.mem.plays || {};
    const godEnd = g => { st.over = { w: g === 'win' ? 0 : 1, how: 'winner', shot: null, god: true }; return st.over; };
    setPlayers(st); S.marks = []; S.bubbles = [null, null]; S.ball = null; U.call(''); U.land(''); U.play('');
    let next = null, r = null, play = null, queue = [], stepNo = 0;
    // They've only "seen" a play once it actually runs: your serve goes in, or you hit one of its shots. A double fault doesn't count.
    let ran = false;
    const markRan = () => { if (play && !ran) { ran = true; st.mem.plays[play.id] = (st.mem.plays[play.id] || 0) + 1; } };
    // A play they've seen this match: the more often, the likelier they read where its shots are going.
    const seenEdge = () => play ? Math.min(0.5, 0.1 * (st.mem.plays[play.id] - 1) * cbClamp((st.ab[1].iq - 30) / 50, 0.3, 1.2)) : 0;
    const playNote = () => play && U.play(queue.length ? `📖 <b>${esc(play.name)}</b> · Shot ${stepNo + 1} Of ${play.steps.length}` : `📖 <b>${esc(play.name)}</b> · Done`);
    if (o.incoming) {
      const inc = o.incoming;
      S.players[1].x = inc.from.x; S.players[1].y = inc.from.y;
      const rf = inc.rcvFrom || st.pos[0]; S.players[0].x = rf.x; S.players[0].y = rf.y;
      await playShot(inc, { over: null }, true); next = 0;
    } else {
      start: for (;;) { // the play list; Back from the first serve or return choice comes back here
      play = null; queue = []; st.play = null;
      st.ab[0].retPos = retPos(); placeForServe(st);
      cur.dead = true;
      const pk = st.server === 0 ? await window.xpAskPlay(U, st) : await window.xpAskReturn(U, st);
      if (pk && pk.god) return godEnd(pk.god);
      if (pk) { play = pk; queue = pk.steps.map(x => ({ ...x })); st.play = { id: pk.id, name: pk.name }; }
      st.ab[0].retPos = retPos(); playNote();
      for (let g = 0; g < 2; g++) {
        placeForServe(st);
        let ch, guess;
        if (st.server === 0) {
          ch = play ? (g === 0 ? { ...play.serve } : { zone: play.serve.zone, spin: 'kick', approach: false }) : await window.xpAskServe(U, st, { back: g === 0 });
          if (ch.back) continue start;
          if (ch.god) return godEnd(ch.god);
          // The Toss: your serve's timing (every serve, in a play too: it comes before the rally).
          if (window.xpAskTouch && window.xpTouchOn && xpTouchOn()) {
            const R = await window.xpAskTouch(U, st, { type: 'serve', spin: ch.spin, aim: cbServeTarget(st, ch.zone) });
            if (R.god) return godEnd(R.god);
            st.serveTouch = xpServeEffect(R, ch.spin);
          }
          guess = cbGuessServe(st);
        } else {
          guess = play ? play.read || null : null;
          if (guess && guess.back) continue start;
          if (guess && guess.god) return godEnd(guess.god);
          st.ab[0].retPos = retPos(); await walkTo(S.players[0], cbReturnSpot(st)); // finish walking to where you chose to stand
          ch = cbChooseServe(st);
          if (guess) { const rc = S.players[0], gt = cbServeTarget(st, guess); await walkTo(rc, { x: rc.x + (gt.x - rc.x) * 0.25, y: rc.y }, 4); } // lean towards your guess
        }
        cur.dead = false; r = cbServe(st, ch.zone, ch.spin, guess, ch.approach);
        if (st.server === 1) st.mem.oppServe[st.deuce ? 'd' : 'a'][ch.zone]++;
        else if (!r.fault && !(r.over && r.over.how === 'df')) markRan();
        await playShot(r.shot, r, st.server === 1 && !r.over && !r.fault);
        if (r.fault) { S.bubbles[st.server] = { t1: r.over ? 'Double Fault' : 'Fault', t2: '', until: performance.now() + 1400 }; await pause(900); if (r.over) break; continue; }
        break;
      }
      break;
      }
      next = r.over ? null : r.next;
    }
    while (!st.over && next !== null) {
      if (next === 0) {
        if (o.onMyTurn && o.onMyTurn(st)) { await resume(); break; }
        let ch, scripted = false;
        if (queue.length) {
          const why0 = playBreak(st, queue[0]);
          if (!why0) { ch = stepShot(st, queue[0]); scripted = true; }
          else ch = await window.xpAskShot(U, st, { step: queue[0], why: why0, play });
          if (ch.dropped) queue = [];
          else { queue.shift(); stepNo++; markRan(); }
          if (ch.run) scripted = true;
        } else ch = await window.xpAskShot(U, st, play ? { play, done: true } : {});
        if (ch.god) { await resume(); return godEnd(ch.god); }
        await resume();
        // Touch: a shot you built yourself gets its mini-game as the ball arrives (a called play runs straight through).
        if (!scripted && window.xpAskTouch && window.xpTouchOn && xpTouchOn()) {
          const R = await window.xpAskTouch(U, st, ch);
          if (R.god) return godEnd(R.god);
          st.touch = xpTouchEffect(R.type, R);
        }
        if (scripted && Math.random() < seenEdge()) st.forceRead = 1; // they saw it coming
        st.cover = ch.move === 'cross' || ch.move === 'line' ? ch.move : null; // before the hit: you move that way as the ball goes
        const h = cbHit(st, 0, ch.aim, ch.type, ch.move === 'net');
        playNote();
        await playShot(h.shot, h, false);
        next = h.over ? null : h.next;
      } else {
        const ch = cbChoose(st, 1), h = cbHit(st, 1, ch.aim, ch.type, ch.approach);
        if (h.shot && h.shot.wing && h.shot.lane && !h.shot.err) st.mem.oppLanes[h.shot.wing][h.shot.lane]++;
        // While a play is running and nothing breaks it, there's no stop: their ball comes straight through.
        const flows = queue.length && !h.over && !playBreak(st, queue[0]);
        await playShot(h.shot, h, !h.over && !flows);
        next = h.over ? null : h.next;
      }
    }
    await resume();
    if (st.play) st.play.ran = ran;
    if (play && ran && st.over && !st.over.god) { const d = cbData(), p = (d.plays || []).find(x => x.id === play.id); if (p) { p.n = (p.n || 0) + 1; if (st.over.w === 0) p.won = (p.won || 0) + 1; cbSave(d); } }
    // What's working this match (a Master coach tells you): your last shot of each point and whether the point was won.
    const last = [...st.shots].reverse().find(s => s.by === 0 && !s.serve && !s.feed && s.aim);
    if (last && st.over && !st.over.god) { const k = `${shotName(last).toLowerCase()} ${LANE_N[cbLane(last.from, last.aim)].toLowerCase()}`, w = (st.mem.works = st.mem.works || {})[k] || [0, 0]; st.mem.works[k] = [w[0] + (st.over.w === 0 ? 1 : 0), w[1] + 1]; }
    return st.over;
  }
  // Why the point ended, in one plain line: what happened, then the real causes behind it (the same things the
  // engine used: how stretched the hitter was, how close to the line they aimed, a flat or touch shot, tired legs).
  function why(st) {
    const o = st.over, s = o.shot;
    if (!s) return o.god ? 'Point set by the God Panel.' : '';
    const mine = s.by === 0, who = mine ? 'Your' : 'Their', shot = shotName(s).toLowerCase();
    if (o.how === 'ace') return mine ? `Ace${s.guess && s.guess !== s.zone ? ': they guessed the wrong way' : ''}.` : `Aced${s.guess && s.guess !== s.zone ? `: you guessed ${ZONE_N[s.guess].toLowerCase()}, it went ${ZONE_N[s.zone].toLowerCase()}` : ''}.`;
    if (o.how === 'df') return mine ? 'You double faulted.' : 'They double faulted.';
    if (o.how === 'unreturned') return mine ? 'Your serve was too good to return.' : `Their ${shot} ${ZONE_N[s.zone].toLowerCase()} was too good to return.`;
    if (o.how === 'winner') {
      const cause = mine ? (s.read < 0 ? 'you wrong-footed them' : 'they couldn’t get there') : (s.read < 0 ? 'you were covering the other side' : st.pr[0] >= 0.8 || s.pr2 >= 0.8 ? 'you were out of position from the shot before' : 'it was out of your reach');
      return `${who} ${shot} was a winner: ${cause}.`;
    }
    const miss = s.err === 'net' ? 'into the net' : Math.abs(s.land.x) > CB.HW ? 'wide' : 'long', c = [];
    if (s.pr >= 0.85) c.push(mine ? 'you were on the run' : 'your shot had them on the run');
    else if (s.pr >= 0.55) c.push(mine ? 'you were stretched' : 'your shot stretched them');
    if (s.aim && Math.abs(s.aim.y) > 4 && Math.min(CB.HW - Math.abs(s.aim.x), CB.HL - Math.abs(s.aim.y)) < 0.8) c.push(mine ? 'you aimed close to the line' : 'they went for the line');
    if (mine && s.type === 'flat') c.push('flat is the riskiest shot');
    if (mine && s.type === 'drop') c.push('a drop shot has tiny margins');
    if ((st.tired || [])[s.by] > 0.5) c.push(mine ? 'your legs are tired' : 'they’re tiring');
    if (!c.length) c.push(mine ? 'a plain miss from a comfortable spot' : 'an unforced miss');
    return `${who} ${shot} went ${miss}: ${c.slice(0, 2).join(', ')}.`;
  }
  // After the point: who won it and why, in one line, then straight on to the next point (tap to go now).
  function xpShowPoint(U, st, title, won) {
    const line = why(st);
    if (U.addPoint) U.addPoint(won, line);
    U.panel(`<div class="xpend ${won ? 'good' : 'bad'}" data-next><h2>${title}</h2><p>${line}</p></div>`);
    return new Promise(res => {
      let done = false; const go = () => { if (done) return; done = true; U.panel(''); res(); };
      q(U.pan, '[data-next]').onclick = go; setTimeout(go, 1600 + 400 * speed());
    });
  }

  // --- The screen ---------------------------------------------------------------------------------------------
  function xpOverlay({ surface = 'hard', exit = null } = {}) {
    const el = document.createElement('div');
    el.className = 'xpov';
    el.innerHTML = `<div class="xptop"><div class="xpleft"><div class="xpsb"><div class="xbscore" data-tip="Tap for the rally read and every point so far"></div><div class="xpnote" hidden></div></div><div class="xpedgebar"></div></div>` +
      `<div class="xptopb"><button type="button" data-x="read" aria-label="Rally read" data-tip="Rally read and every point so far (what your coach can tell you)">🔍</button>` +
      `<button type="button" data-x="touch" aria-label="Shot mini-games on or off"></button><button type="button" data-x="icons" aria-label="Words or icons" data-tip="Shot buttons: words or icons">🔣</button><button type="button" data-x="speed"></button>` +
      `${cbGod() ? '<button type="button" data-x="god" aria-label="God Panel" data-tip="God Panel: win or lose points while testing">⚡</button>' : ''}${exit ? '<button type="button" data-x="exit" aria-label="Leave" data-tip="Leave for the draw (finished points are saved)">✕</button>' : ''}</div></div>` +
      `<div class="xpdrop" hidden><div class="xpdread"></div><div class="xpdedges"></div><h3 class="xpdph">Points</h3><ol class="xpdpts"></ol></div>` +
      `<div class="xpstage"><canvas class="xpcourt"></canvas><div class="xpmsg" hidden></div></div><div class="xpcall"></div><div class="xpland"></div><div class="xpplayln"></div><div class="xppanel"></div>`;
    document.body.appendChild(el); document.body.classList.add('xbopen');
    V.c = q(el, '.xpcourt'); V.g = V.c.getContext('2d'); S.surface = surface;
    const msg = q(el, '.xpmsg'), sp = q(el, '[data-x="speed"]');
    const spLabel = () => { const [i, l] = { 2.4: ['🐢', 'Slow'], 1.6: ['▶', 'Medium'], 1.1: ['⏩', 'Fast'] }[speedKey()] || ['▶', 'Medium']; sp.innerHTML = `${i}<span class="xplbl"> ${l}</span>`; sp.dataset.tip = `Ball speed: ${l} (tap to change)`; };
    spLabel();
    const tb = q(el, '[data-x="touch"]'), tLabel = () => { const on = cbData().touch !== false; tb.textContent = on ? '🎯' : '🎯 Off'; tb.classList.toggle('off', !on); tb.dataset.tip = `Shot mini-games: ${on ? 'on' : 'off'} (tap to turn ${on ? 'off' : 'on'})`; }; tLabel();
    const U = { el, surface, paused: false, godReq: null, pan: q(el, '.xppanel'), V: { pos: null, trails: [], draw() {} } };
    U.panel = html => { U.pan.innerHTML = html; };
    U.call = html => { q(el, '.xpcall').innerHTML = html; };
    U.land = html => { q(el, '.xpland').innerHTML = html; };
    U.play = html => { q(el, '.xpplayln').innerHTML = html || ''; };
    U.score = html => { q(el, '.xbscore').innerHTML = html; };
    // The drop-down under the scoreboard: the rally read (what your coach can tell you) and every point so far, newest first.
    const drop = q(el, '.xpdrop'); U.hist = [];
    U.setRead = html => { q(drop, '.xpdread').innerHTML = html || ''; };
    U.addPoint = (won, line) => { U.hist.unshift({ won, line }); q(drop, '.xpdpts').innerHTML = U.hist.slice(0, 40).map((h, i) => `<li class="${h.won ? 'good' : 'bad'}"><b>${h.won ? 'Won' : 'Lost'}</b> ${h.line}</li>`).join(''); };
    const toggleDrop = () => { drop.hidden = !drop.hidden; if (window.innerWidth >= 1100 || matchMedia('(pointer: coarse) and (min-width: 768px) and (orientation: landscape)').matches) drop.style.top = `${q(el, '.xpleft').getBoundingClientRect().bottom + 8}px`; else drop.style.top = ''; }; // sits just under the score box
    q(el, '.xbscore').onclick = toggleDrop;
    // Your edges this match (preparation, team, racket deal): small badges under the score, the details in the drop-down.
    U.setEdges = list => {
      q(el, '.xpedgebar').innerHTML = list.map(e => `<button type="button" class="${e.idle ? 'idle' : ''}" aria-label="${esc(e.name)}" data-tip="${esc(e.name)}: ${esc(e.what.replace(/<[^>]+>/g, ''))}">${e.icon}</button>`).join('');
      q(drop, '.xpdedges').innerHTML = list.length ? `<h3>Your Edges</h3>${list.map(e => `<p class="${e.idle ? 'idle' : ''}">${e.icon} <b>${esc(e.name)}</b> · ${e.what}</p>`).join('')}` : '';
    };
    // A short note when one of them is doing its job.
    let noteT = null;
    U.edgeNote = text => { const n = q(el, '.xpnote'); n.textContent = text; n.hidden = false; clearTimeout(noteT); noteT = setTimeout(() => { n.hidden = true; }, 2600); };
    U.flash = html => { msg.innerHTML = html; msg.hidden = false; };
    U.hideFlash = () => { msg.hidden = true; };
    U.tapOn = ms => new Promise(r => { let done = false; const fin = () => { if (done) return; done = true; msg.onclick = null; r(); }; msg.onclick = fin; setTimeout(fin, ms); });
    U.wait = ms => pause(ms);
    U.setPause = () => {};
    U.close = () => { V.on = false; window.removeEventListener('resize', fit); el.remove(); document.body.classList.remove('xbopen'); V.c = null; };
    q(el, '.xptopb').onclick = e => { const b = e.target.closest('[data-x]'); if (!b) return;
      if (b.dataset.x === 'icons') { const d = cbData(); d.icons = !d.icons; cbSave(d); if (cur.rerender) cur.rerender(); }
      if (b.dataset.x === 'speed') { const d = cbData(), order = [2.4, 1.6, 1.1]; d.speed = order[(order.indexOf(speedKey()) + 1) % 3]; cbSave(d); spLabel(); }
      if (b.dataset.x === 'read') toggleDrop();
      if (b.dataset.x === 'touch') { const d = cbData(); d.touch = d.touch === false; cbSave(d); tLabel(); }
      if (b.dataset.x === 'exit' && exit) exit();
      if (b.dataset.x === 'god') cbGodMatchMenu(U); };
    window.addEventListener('resize', fit);
    V.on = true; setTimeout(() => { fit(); loop(); }, 0);
    return U;
  }

  // Extreme matches and practice use this screen in place of the first version.
  cbOverlay = xpOverlay; cbRunPoint = xpRunPoint; cbShowPoint = xpShowPoint;
  if (/[?&]raf=timer/.test(location.search)) { window.requestAnimationFrame = f => setTimeout(() => f(performance.now()), 16); window.__xpS = S; } // headless tests
})();
