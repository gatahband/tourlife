// court.js — the match view. Each point is first planned as a small script (every shot, landing spot,
// run and callout), then played back. Scripts can be replayed later from any camera angle.
// Views: broadcast, top-down, and GATAH VISION (broadcast camera, real-time pace, cinematic zooms and shakes).

function createCourt() {
  // Court geometry in metres; y runs along the court (net at 0), x across it, z is height.
  const BASE = 11.885, SERVICE = 6.4, SINGLES = 4.115, DOUBLES = 5.485, NET_H = 0.914;
  const VIEW_LEN = BASE * 2 + 9, VIEW_WID = DOUBLES * 2 + 3;
  const LOOK = {
    hard:   { out: '#3d7a57', in: '#2f62a8', line: '#f5f5f7', mark: '255,255,255' },
    indoor: { out: '#2a2f38', in: '#2f62a8', line: '#f5f5f7', mark: '255,255,255' },
    clay:   { out: '#b4562f', in: '#c8673c', line: '#f3ede6', mark: '110,40,15' },
    grass:  { out: '#3f7a35', in: '#4b8c3e', line: '#f5f5f7', stripe: '#559845', mark: '255,255,255' },
  };
  const COLORS = { me: '#ff375f', opp: '#f5f5f7', ball: '#dfff4f' };
  const ARM = '#d9a77c';
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  let cv = null, ctx, W = 0, H = 0, dpr = 1, look = LOOK.hard, surface = 'hard', indoorFlag = false;
  let view = 'broadcast';      // broadcast | top | gatah
  let angle = null;            // replay camera: broadcast | reverse | side | top
  let names = ['You', ''];
  // Per side: hand, Tennis IQ, net skill and game plan (drives depth, angles, lobs, volley exchanges).
  let prof = [{ hand: 'right', iq: 50, net: 50, plan: {} }, { hand: 'right', iq: 50, net: 50, plan: {} }];
  let pos = [{ x: 0, y: BASE + 1 }, { x: 0, y: -BASE - 1 }];
  const ball = { x: 0, y: 0, h: 0, on: false };
  let trail = [], marks = [], slides = []; // slides: clay slide marks from this point
  let labels = [null, null]; // each player's current racket pose / callout
  let skip = false;
  let liveSlow = 1; // GATAH VISION live slow-mo factor
  const opts = { showType: true, showWing: true };
  // Cinematic camera: zoom level and the screen point it centres on (identity when zoom is 1 and centred).
  const cam = { zoom: 1, cx: 0, cy: 0, shake: 0, shakeT0: 0 };
  // The court's own clock: it stops while the match is paused, so everything (ball, players, callouts,
  // swings) freezes mid-shot and carries on from the same moment.
  let pauseCheck = () => false, pausedAcc = 0, pausedAt = null;
  function clock() {
    const n = performance.now(), p = pauseCheck();
    if (p && pausedAt === null) pausedAt = n;
    if (!p && pausedAt !== null) { pausedAcc += n - pausedAt; pausedAt = null; }
    return n - pausedAcc - (pausedAt !== null ? n - pausedAt : 0);
  }
  // Big-moment banner ("BREAK POINT") and the line-review panel, drawn over the court.
  let banner = null, review = null;
  // Resting zoom: pulls back a little when a returner stands deep, so they stay in view.
  let camBase = 1;

  const dir = side => side === 0 ? 1 : -1;
  const isIn = p => Math.abs(p.x) <= SINGLES + 0.05 && Math.abs(p.y) <= BASE + 0.05;
  const camera = () => angle || (view === 'top' ? 'top' : 'broadcast');

  // --- Cameras ------------------------------------------------------------------

  let S = 1, F = 1, HZ = 0, SF = 1, SHZ = 0;
  const CAM_Y = BASE + 16, CAM_Z = 9;
  // Framed tight: the whole court plus just enough behind each baseline to see a player standing deep.
  const FAR_Y = -BASE - 3.6, NEAR_Y = BASE + 3.4, TOP = 0.17, BOTTOM = 1; // TOP keeps the far player's name and callout in frame
  const SIDE_CX = -(DOUBLES + 20), SIDE_Z = 14;

  function resize() {
    if (!cv) return;
    dpr = window.devicePixelRatio || 1;
    W = cv.clientWidth || 600;
    // Full screen lifts the height cap (the width is limited in CSS so it fits).
    const fs = !!document.fullscreenElement || !!document.webkitFullscreenElement;
    H = Math.round(camera() === 'top' ? W * VIEW_WID / VIEW_LEN : Math.min(W * 0.6, fs ? 2000 : 620));
    cv.style.height = H + 'px';
    cv.width = W * dpr; cv.height = H * dpr;
    S = W / VIEW_LEN;
    fpsF = W * 0.72; // a slightly tighter lens than a wide GoPro: the far player and ball read bigger
    cam.cx = W / 2; cam.cy = H / 2;
    const df = CAM_Y - FAR_Y, dn = CAM_Y - NEAR_Y;
    F = (BOTTOM - TOP) * H / (CAM_Z * (1 / dn - 1 / df));
    HZ = TOP * H - CAM_Z * F / df;
    // Side camera, high in the stands: the court spans about 42% of the height (far alley to near alley),
    // limited so the near baseline corners stay on screen.
    const sNear = -DOUBLES - 1 - SIDE_CX, sFar = DOUBLES + 1 - SIDE_CX;
    SF = Math.min(0.42 * H / (SIDE_Z * (1 / sNear - 1 / sFar)), 0.48 * W * sNear / BASE);
    SHZ = 0.88 * H - SIDE_Z * SF / sNear;
  }

  // --- First-person (FPS) camera: at a player's eye, turning to track the ball; drag to look around.
  const isFps = () => camera() === 'fps' || camera() === 'fps2';
  const fpsSide = () => camera() === 'fps' ? 0 : 1;
  const EYE_Z = 1.7, PITCH = 0.13, NEAR = 0.3;
  const head = { psi: null, off: 0, drag: false, lastX: 0, prevY: null, pitch: 0.13, rel: 0 };
  let fpsF = 1;

  // Head direction: faces the far end, turns towards the ball (up to ~55°), plus any drag offset.
  function updateLook() {
    const side = fpsSide(), e = pos[side];
    const label = labels[side];
    const base = side === 0 ? Math.PI : 0;
    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    let rel = head.rel ?? 0, pitch = PITCH, rate = 0.12;
    const away = ball.on && head.prevY !== null && (ball.y - head.prevY) * dir(side) < -0.001;
    head.prevY = ball.on ? ball.y : null;
    // Watch the ball onto the strings: when it's close (and through the serve toss), look right at it,
    // up or down; just after you hit, keep your eyes on the contact point for a moment.
    if (label && label.side === side && label.racket && label.racket !== 'trophy' && label.racket !== 'underarmPrep' && !label.prep && !label.cpt && ball.on)
      label.cpt = { x: ball.x, y: ball.y, z: ball.h };
    const holding = label && label.side === side && label.cpt && clock() - label.t0 < 260;
    const close = ball.on && Math.hypot(ball.x - e.x, ball.y - e.y) < 3.5 && !away;
    const tossing = label && label.side === side && label.racket === 'trophy' && ball.on;
    const focusPt = holding ? label.cpt : (close || tossing) ? { x: ball.x, y: ball.y, z: ball.h } : null;
    if (focusPt) {
      const hd = Math.hypot(focusPt.x - e.x, focusPt.y - e.y);
      // A natural glance, not a full head turn: limited turn and tilt so the court stays readable.
      if (hd > 0.5) rel = clamp(wrap(Math.atan2(focusPt.x - e.x, focusPt.y - e.y) - base) * 0.6, -0.3, 0.3);
      // Capped both ways so the court stays in view. On the serve (toss and contact) only a slight lift:
      // the ball goes high but the court across the net stays on screen.
      const serving = tossing || (holding && label.racket === 'serve');
      pitch = clamp(Math.atan2(EYE_Z - focusPt.z, Math.max(1.2, hd)) * 0.6, serving ? -0.1 : -0.2, 0.22);
      rate = 0.09;
    } else {
      // Otherwise track the ball coming at you; while your own shot heads away, ease towards your
      // opponent to read their reply. Look ahead when the ball has gone behind you.
      rel = 0;
      if (ball.on && Math.hypot(ball.x - e.x, ball.y - e.y) > 2.5) {
        const o = pos[1 - side];
        const t = away ? { x: lerp(ball.x, o.x, 0.6), y: lerp(ball.y, o.y, 0.6) } : ball;
        const r = wrap(Math.atan2(t.x - e.x, t.y - e.y) - base);
        // Eyes follow the ball, the head only turns a little: the court stays steady on screen.
        rel = Math.abs(r) > 1.25 ? 0 : clamp(r * 0.6, -0.42, 0.42);
      }
      rate = 0.07;
    }
    head.rel = rel;
    const target = base + rel + head.off;
    head.psi = head.psi === null ? target : head.psi + (target - head.psi) * rate;
    head.pitch += (pitch - head.pitch) * rate;
    // Never lose the ball: if it drifts towards the edge of the view (a wide ball, or a winner flying past
    // you), the head turns with it, so you see every ball you hit and every ball that beats you.
    if (ball.on && !head.drag) {
      const vx = ball.x - e.x, vy = ball.y - e.y, hd = Math.hypot(vx, vy);
      if (hd > 0.5) {
        const ba = wrap(Math.atan2(vx, vy) - head.psi), lim = 0.4;
        if (Math.abs(ba) < 2.2) {
          if (ba > lim) head.psi += ba - lim; else if (ba < -lim) head.psi += ba + lim;
          // Look down far enough to see a low ball near your feet (and a little up for a lob). Not on your
          // own serve: the toss goes up out of view and the court stays on screen.
          const myServe = label && label.side === side && (label.racket === 'trophy' || label.racket === 'serve' || label.racket === 'underarmPrep' || label.racket === 'underarm');
          const bp = Math.atan2(EYE_Z - ball.h, hd), vlim = 0.28;
          if (bp - head.pitch > vlim) head.pitch = Math.min(0.75, bp - vlim);
          else if (!myServe && head.pitch - bp > vlim) head.pitch = Math.max(-0.25, bp + vlim);
        }
      }
    }
    if (!head.drag) head.off *= 0.97;
  }


  // Court point to camera space: r (right), u (up), d (depth ahead).
  function camSpace(x, y, z) {
    const e = pos[fpsSide()], psi = head.psi ?? 0;
    const vx = x - e.x, vy = y - e.y, vz = z - EYE_Z;
    const fx = Math.sin(psi), fy = Math.cos(psi);
    const hor = vx * fx + vy * fy;
    return {
      // Same left/right convention as the other cameras (a righty's forehand side is +x for the near player),
      // so the ball, racket side and arms all match in first person.
      r: vy * Math.sin(psi) - vx * Math.cos(psi),
      d: hor * Math.cos(head.pitch) - vz * Math.sin(head.pitch),
      u: vz * Math.cos(head.pitch) + hor * Math.sin(head.pitch),
    };
  }
  const projCS = c => { const d = Math.max(NEAR, c.d); return [W / 2 + c.r * fpsF / d, H / 2 - c.u * fpsF / d, fpsF / d]; };
  // Clip a segment or polygon to the space in front of the camera.
  const cutNear = (a, b) => { const t = (NEAR - a.d) / (b.d - a.d); return { r: lerp(a.r, b.r, t), u: lerp(a.u, b.u, t), d: NEAR }; };
  function clipPoly(cs) {
    const out = [];
    cs.forEach((a, i) => {
      const b = cs[(i + 1) % cs.length];
      if (a.d >= NEAR) out.push(a);
      if ((a.d >= NEAR) !== (b.d >= NEAR)) out.push(cutNear(a, b));
    });
    return out;
  }

  // Projects a court point (x, y, z metres) to the screen: [sx, sy, px per metre].
  function P(x, y, z = 0) {
    const c = camera();
    if (c === 'fps' || c === 'fps2') return projCS(camSpace(x, y, z));
    if (c === 'top') return [W / 2 - y * S, H / 2 + x * S - z * S * 0.15, S];
    if (c === 'side') {
      const d = Math.max(1, x - SIDE_CX), f = SF / d;
      return [W / 2 - y * f, SHZ + (SIDE_Z - z) * f, f];
    }
    if (c === 'reverse') { x = -x; y = -y; }
    const d = Math.max(1, CAM_Y - y), f = F / d;
    return [W / 2 + x * f, HZ + (CAM_Z - z) * f, f];
  }

  // Distance from the camera, for drawing far things first.
  function depth(p) {
    const c = camera();
    if (c === 'fps' || c === 'fps2') return camSpace(p.x, p.y, 1).d;
    if (c === 'side') return p.x - SIDE_CX;
    if (c === 'reverse') return CAM_Y + p.y;
    return CAM_Y - p.y;
  }

  function mount(canvas) {
    const first = !cv;
    cv = canvas;
    ctx = cv.getContext('2d');
    resize();
    if (first) window.addEventListener('resize', () => { resize(); draw(); });
    // Drag on the court to look around in first person.
    cv.onpointerdown = e => { if (!isFps()) return; head.drag = true; head.lastX = e.clientX; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = e => { if (!head.drag) return; head.off = clamp(head.off - (e.clientX - head.lastX) * 0.006, -1.3, 1.3); head.lastX = e.clientX; draw(); };
    cv.onpointerup = cv.onpointercancel = () => { head.drag = false; };
  }

  function setView(v) { view = v; if (v !== 'gatah') angle = null; resize(); draw(); }
  function setAngle(a) {
    angle = a; head.psi = null; head.off = 0; head.pitch = PITCH; head.rel = 0;
    if (cv) cv.style.touchAction = isFps() ? 'none' : ''; // drag-to-look on touch screens, only in first person
    resize(); draw();
  }
  function setOptions(o) { Object.assign(opts, o); draw(); }

  function scene(surf, indoor, labels, profiles) {
    surface = surf;
    indoorFlag = !!indoor;
    look = indoor ? LOOK.indoor : LOOK[surf];
    names = labels;
    prof = profiles || prof;
    resize();
    reset(0);
    draw();
  }
  const sceneArgs = () => [surface, indoorFlag, names, prof];

  // How each playstyle shapes its shots on court: short-angle odds (×), depth floor (m from the net), extra slice
  // and lob odds, and ball height / kick for topspin, flat and slice drives. Variety players carve low slices and
  // sharp angles, heavy-topspin players loop high and kick, flat hitters skim the net.
  const SHOT_STYLE = {
    'Variety / Slice-Heavy':   { angle: 1.9, sharp: true, slice: 0.2, fhSlice: 0.1, lob: 0.04, h: { slice: 0.85 } },
    'Creative Shotmaker':      { angle: 2.0, sharp: true, slice: 0.12, fhSlice: 0.05, lob: 0.03 },
    'All-Court':               { angle: 1.5, slice: 0.05 },
    'Heavy-Topspin Baseliner': { angle: 0.8, deep: 8.8, h: { topspin: 1.3 }, kick: 1.35, lob: 0.03 },
    'Heavy-Topspin Attacker':  { angle: 1.1, deep: 8.5, h: { topspin: 1.2 }, kick: 1.25 },
    'Defensive Grinder':       { angle: 0.7, deep: 9, h: { topspin: 1.2 }, kick: 1.15, lob: 0.06 },
    'Counterpuncher':          { angle: 0.9, deep: 8.8, lob: 0.03 },
    'Solid Baseliner':         { angle: 0.8, deep: 9 },
    'Aggressive Baseliner':    { angle: 1.25, deep: 8.5, h: { flat: 0.92 } },
    'Flat Attacker':           { angle: 1.2, h: { flat: 0.85, topspin: 0.9 }, kick: 0.85 },
    'First-Strike Attacker':   { angle: 1.3, h: { flat: 0.9 } },
    'Serve +1 Attacker':       { angle: 1.25, h: { flat: 0.92 } },
    'Serve-Dominant':          { angle: 1.1 },
    'Net Attacker':            { angle: 1.1, slice: 0.06 },
    'Serve-and-Volley':        { angle: 1.1, slice: 0.08 },
  };
  const shotStyle = side => (side !== undefined && prof[side] && SHOT_STYLE[prof[side].style]) || {};
  // Where each player likes to stand on the baseline: grinders deeper (and deeper again on clay).
  function homeDepth(side) {
    const ag = (prof[side].plan || {}).aggression, st = prof[side].style;
    // Defenders camp deep; first-strike players hug the baseline.
    const styleD = st === 'Defensive Grinder' || st === 'Counterpuncher' ? 1.2 : st === 'Heavy-Topspin Baseliner' ? 0.8
      : st === 'First-Strike Attacker' || st === 'Flat Attacker' || st === 'Serve +1 Attacker' ? -0.4 : 0;
    const dp = (prof[side].adv || {}).depth; // moonballers camp deeper; deep drivers hold the baseline
    return BASE + (ag === 'patient' ? 2.2 : ag === 'aggressive' ? 0.3 : 1.0) + (surface === 'clay' ? 0.8 : 0) + styleD + (dp === 'high' ? 0.9 : dp === 'deep' ? -0.3 : 0);
  }

  // How far behind the baseline a player stands to return, from their plan. Only a server known for
  // underarm serves draws them inside the baseline.
  // The current point's big-point call (set by plan), so positions follow it.
  let curCall = null;
  function returnDepth(side) {
    const cfx = curCall && curCall.side === side && typeof CALL_FX !== 'undefined' ? CALL_FX[curCall.id] || {} : {};
    if (cfx.ret === 'inside') return BASE - 0.5;
    if (cfx.ret === 'deep') return BASE + 3.6;
    // Strong returners crowd the baseline; defenders give themselves time.
    const st = prof[side].style, styleR = prof[side].trait === 'Return-Oriented' ? -0.6 : st === 'Defensive Grinder' || st === 'Counterpuncher' ? 0.6 : 0;
    const rp = (prof[side].plan || {}).returnPos;
    const expectUnder = ((prof[1 - side].plan || {}).underarm || 'never') !== 'never';
    return BASE + (rp === 'deep' ? 3.2 : rp === 'inside' ? 0.3 : 1.2) - (expectUnder ? 0.7 : 0) + styleR;
  }

  // Server just behind the baseline on the deuce or ad side; returner diagonally opposite at their return depth.
  function servePositions(server, deuce) {
    return [0, 1].map(side => {
      const d = dir(side), serving = side === server;
      return { x: (deuce ? 1 : -1) * d * (serving ? 0.8 : 2.8), y: d * (serving ? BASE + 0.3 : returnDepth(side)) };
    });
  }

  function reset(server, deuce = true) {
    pos = servePositions(server, deuce);
    ball.on = false;
    trail = []; marks = []; slides = []; labels = [null, null];
    camBase = !isFps() && pos.some(p => Math.abs(p.y) > BASE + 3.1) ? 0.92 : 1;
    cam.zoom = camBase; cam.shake = 0; cam.cx = W / 2; cam.cy = H / 2;
  }

  // --- Drawing -----------------------------------------------------------------

  function poly(pts, fill) {
    if (isFps()) {
      const cs = clipPoly(pts.map(([x, y, z = 0]) => camSpace(x, y, z)));
      if (cs.length < 3) return;
      ctx.beginPath();
      cs.forEach((c, i) => { const [a, b] = projCS(c); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      return;
    }
    ctx.beginPath();
    pts.forEach(([x, y, z = 0], i) => { const [a, b] = P(x, y, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function line(x1, y1, x2, y2, z = 0) {
    if (isFps()) {
      let p = camSpace(x1, y1, z), q = camSpace(x2, y2, z);
      if (p.d < NEAR && q.d < NEAR) return;
      if (p.d < NEAR) p = cutNear(p, q); else if (q.d < NEAR) q = cutNear(q, p);
      const [a, b] = projCS(p), [c, d] = projCS(q);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
      return;
    }
    const [a, b] = P(x1, y1, z), [c, d] = P(x2, y2, z);
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
  }

  function draw() {
    if (!ctx) return;
    const c = camera();
    const fps = c === 'fps' || c === 'fps2';
    if (fps) updateLook();
    let sx = 0, sy = 0;
    if (cam.shake > 0) {
      const k = Math.max(0, 1 - (clock() - cam.shakeT0) / 450);
      sx = (Math.random() - 0.5) * cam.shake * k; sy = (Math.random() - 0.5) * cam.shake * k;
      if (k === 0) cam.shake = 0;
    }
    // Zoom scales the scene around the camera centre.
    const z = cam.zoom;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.cx * z + sx), dpr * (H / 2 - cam.cy * z + sy));

    if (fps) drawArena();
    else { ctx.fillStyle = look.out; ctx.fillRect(-W, -H, W * 3, H * 3); }
    if (c === 'broadcast' || c === 'reverse') {
      const [, farY] = P(0, c === 'reverse' ? BASE + 7 : -BASE - 7);
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.fillRect(-W, -H, W * 3, Math.max(0, farY) + H);
    } else if (c === 'side') {
      const [, farY] = P(DOUBLES + 7, 0);
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.fillRect(-W, -H, W * 3, Math.max(0, farY) + H);
    }
    if (!fps && c !== 'top') drawMountainsBand(c);
    poly([[-DOUBLES, -BASE], [DOUBLES, -BASE], [DOUBLES, BASE], [-DOUBLES, BASE]], look.in);
    if (look.stripe) {
      const n = 12, step = BASE * 2 / n;
      for (let i = 0; i < n; i += 2) poly([[-DOUBLES, -BASE + i * step], [DOUBLES, -BASE + i * step], [DOUBLES, -BASE + (i + 1) * step], [-DOUBLES, -BASE + (i + 1) * step]], look.stripe);
    }
    ctx.strokeStyle = look.line;
    ctx.lineWidth = c === 'top' ? Math.max(1, S * 0.08) : 1.4;
    for (const x of [-DOUBLES, DOUBLES, -SINGLES, SINGLES]) line(x, -BASE, x, BASE);
    for (const y of [-BASE, BASE]) line(-DOUBLES, y, DOUBLES, y);
    for (const y of [-SERVICE, SERVICE]) line(-SINGLES, y, SINGLES, y);
    line(0, -SERVICE, 0, SERVICE);
    for (const y of [-BASE, BASE]) line(0, y, 0, y - Math.sign(y) * 0.3);
    drawMarks();

    // Far things first. The net sits at its own depth in the end-on cameras.
    const items = [0, 1].filter(side => !breakTime && !(fps && side === fpsSide())).map(side => ({ d: depth(pos[side]), f: () => drawPlayer(side) }));
    if (ball.on) items.push({ d: fps ? camSpace(ball.x, ball.y, ball.h).d : depth(ball) - 0.01, f: drawBall });
    if (c === 'broadcast' || c === 'reverse' || fps) items.push({ d: fps ? camSpace(0, 0, 0.5).d : depth({ x: 0, y: 0 }), f: drawNet });
    else drawNet();
    items.filter(i => !fps || i.d > NEAR).sort((a, b) => b.d - a.d).forEach(i => i.f());
    if (fps) drawPovRacket();
    drawOverlays();
  }

  // Light drizzle for rainy-weather events: fine, slanted streaks at a few depths (nearer ones longer,
  // brighter and faster), a soft cool haze over the court. Driven by the court clock, so pause freezes it.
  let rain = false, rainLoop = null;
  // Between sets and after the match: players leave the court; in rainy conditions the rain shows then (never during points).
  let breakTime = false;
  const DROPS = Array.from({ length: 140 }, (_, i) => {
    const h = Math.imul(i + 1, 2654435761) >>> 0;
    const depth = ((h >>> 8) % 100) / 100; // 0 far … 1 near
    return { x: (h % 1000) / 1000, o: ((h >>> 12) % 1000) / 1000, depth,
      len: 7 + depth * 16, speed: 0.45 + depth * 0.75, alpha: 0.08 + depth * 0.2, width: depth > 0.75 ? 1.3 : 0.8 };
  });
  function drawRain() {
    const t = clock() / 1000, slant = 0.22;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(120,140,165,0.16)'); g.addColorStop(1, 'rgba(60,75,95,0.08)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round';
    for (const d of DROPS) {
      const span = H + d.len * 2;
      const y = ((d.o + t * d.speed) % 1) * span - d.len;
      const x = ((d.x * (W + 60)) + y * slant) % (W + 60) - 30;
      ctx.strokeStyle = `rgba(220,232,245,${d.alpha})`;
      ctx.lineWidth = d.width;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - d.len * slant, y - d.len); ctx.stroke();
    }
  }

  // High altitude: a low mountain range far behind each end (minimal: the court stays the focus).
  const PEAKS = Array.from({ length: 13 }, (_, i) => { const h = Math.imul(i + 3, 2654435761) >>> 0; return { x: -230 + i * 38 + (h % 20), h: 0.55 + ((h >>> 8) % 100) / 220 }; });
  function drawMountains() {
    if (!conditions.altitude || conditions.altitude < 900 || indoorFlag) return;
    const top = clamp(14 + conditions.altitude / 90, 18, 46), snow = conditions.altitude >= 1500;
    for (const end of [-1, 1]) {
      const y = end * (BASE + 150);
      const ridge = [[-260, y, 0], ...PEAKS.map(p => [p.x, y, top * p.h]), [260, y, 0]];
      poly(ridge, indoorFlag ? '#1d2430' : 'rgba(46,62,82,.92)');
      if (snow) for (const p of PEAKS) if (p.h > 0.85) poly([[p.x - 7, y, top * p.h * 0.82], [p.x, y, top * p.h], [p.x + 7, y, top * p.h * 0.82]], 'rgba(235,240,248,.85)');
    }
  }

  // Behind the far end in the standard views: a low ridge inside the strip above the court.
  function drawMountainsBand(c) {
    if (!conditions.altitude || conditions.altitude < 900 || indoorFlag) return;
    const [, farY] = c === 'side' ? P(DOUBLES + 7, 0) : P(0, c === 'reverse' ? BASE + 7 : -BASE - 7);
    const base = Math.max(8, farY), tall = base * clamp(0.4 + conditions.altitude / 5000, 0.45, 0.85), snow = conditions.altitude >= 1500;
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ridge = (shade, k, off) => {
      ctx.beginPath(); ctx.moveTo(0, base);
      PEAKS.forEach((p, i) => ctx.lineTo((i + off) / (PEAKS.length - 1) * W, base - tall * p.h * k));
      ctx.lineTo(W, base); ctx.closePath(); ctx.fillStyle = shade; ctx.fill();
    };
    ridge('rgba(70,88,112,.55)', 1, 0.5); ridge('rgba(40,54,72,.85)', 0.75, 0);
    if (snow) PEAKS.forEach((p, i) => { if (p.h < 0.85) return; const x = (i + 0.5) / (PEAKS.length - 1) * W, y = base - tall * p.h; ctx.beginPath(); ctx.moveTo(x - 10, y + 8); ctx.lineTo(x, y); ctx.lineTo(x + 10, y + 8); ctx.closePath(); ctx.fillStyle = 'rgba(235,240,248,.8)'; ctx.fill(); });
    ctx.restore();
  }

  // The weather you can see: heat haze, humid fog, a cold tint, wind streaks, a wet sheen after rain.
  function drawWeather() {
    const k = conditions.key, t = clock() / 1000;
    if (!k || k === 'sunny' || k === 'indoor' || indoorFlag) return;
    if (k === 'hot') {
      ctx.fillStyle = 'rgba(255,140,40,.06)'; ctx.fillRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.45); g.addColorStop(0, 'rgba(255,170,70,.28)'); g.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.45);
      // Heat shimmer just above the far end.
      ctx.strokeStyle = 'rgba(255,230,190,.10)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { const y = H * (0.16 + i * 0.035); ctx.beginPath(); for (let x = 0; x <= W; x += 12) { const yy = y + Math.sin(x / 38 + t * 2.4 + i) * 2.2; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); }
    } else if (k === 'humid') {
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.42); g.addColorStop(0, 'rgba(225,232,238,.38)'); g.addColorStop(1, 'rgba(225,232,238,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.42);
    } else if (k === 'cold') {
      ctx.fillStyle = 'rgba(110,160,255,.08)'; ctx.fillRect(0, 0, W, H);
    } else if (k === 'windy') {
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) { const y = ((i * 97) % 100) / 100 * H * 0.9 + 10, len = 30 + (i * 37) % 50, x = ((i * 211 + t * 260) % (W + 120)) - 60; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y - 3); ctx.stroke(); }
    } else if (k === 'damp') {
      ctx.fillStyle = 'rgba(20,40,70,.12)'; ctx.fillRect(0, 0, W, H);
    }
  }
  // Bottom-left badge: today's conditions at a glance (weather, court speed, altitude).
  function drawConditions() {
    if (!conditions.speed || camera() === 'fps' || camera() === 'fps2') return;
    const txt = `${conditions.label || ''}${conditions.label ? ' · ' : ''}${conditions.speed} court${conditions.altitude >= 900 ? ` · ⛰️ ${conditions.altitude.toLocaleString('en-US')} m` : ''}`;
    ctx.font = `600 12px ${FONT}`;
    const w = ctx.measureText(txt).width + 18, x = 10, y = H - 32;
    ctx.fillStyle = 'rgba(14,17,22,.72)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, 22, 11) : ctx.rect(x, y, w, 22); ctx.fill();
    ctx.fillStyle = 'rgba(245,245,247,.92)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x + 9, y + 11);
  }

  // Bottom-right: the plan you're playing right now (only what differs from a balanced plan).
  function drawPlan() {
    if (!planText || camera() === 'fps' || camera() === 'fps2') return;
    ctx.font = `600 11px ${FONT}`;
    const words = planText.split(' · '), maxW = Math.min(W * 0.46, 360), lines = [];
    let line = '📋 ';
    for (const w of words) { const t = line === '📋 ' ? line + w : line + ' · ' + w; if (ctx.measureText(t).width > maxW && line !== '📋 ') { lines.push(line); line = w; } else line = t; }
    lines.push(line);
    const shown = lines.slice(0, 2), w = Math.max(...shown.map(l => ctx.measureText(l).width)) + 18, h = 8 + shown.length * 15;
    const x = W - w - 10, y = H - h - 10;
    ctx.fillStyle = 'rgba(14,17,22,.72)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 10) : ctx.rect(x, y, w, h); ctx.fill();
    ctx.fillStyle = 'rgba(245,245,247,.92)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    shown.forEach((l, i) => ctx.fillText(l, x + 9, y + 11.5 + i * 15));
  }

  function drawOverlays() {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWeather();
    if (!infoEl) { drawConditions(); drawPlan(); }
    if (!banner && !review && !(rain && breakTime)) { ctx.restore(); return; }
    if (rain && breakTime) drawRain();
    if (banner) {
      const age = clock() - banner.t0, life = banner.big ? 1400 : 1600;
      if (age > life) banner = null;
      else if (banner.big) {
        // ACE!: pops in large in the middle of the court, then fades.
        const a = Math.min(1, (life - age) / 350), pop = 1 + Math.max(0, 1 - age / 180) * 0.35;
        ctx.globalAlpha = a;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `italic 900 ${Math.round(Math.min(96, W / 7) * pop)}px ${FONT}`;
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.strokeText(banner.text, W / 2, H * 0.42);
        ctx.fillStyle = '#ffd60a'; ctx.fillText(banner.text, W / 2, H * 0.42);
        ctx.globalAlpha = 1;
      } else {
        const a = Math.min(1, age / 200, (life - age) / 300);
        const y = H * 0.2;
        ctx.globalAlpha = a;
        const g = ctx.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, 'rgba(10,132,255,0)'); g.addColorStop(0.5, 'rgba(10,20,40,.85)'); g.addColorStop(1, 'rgba(191,90,242,0)');
        ctx.fillStyle = g; ctx.fillRect(0, y - 26, W, 46);
        ctx.fillStyle = '#ffd60a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `italic 900 ${Math.round(Math.min(34, W / 18))}px ${FONT}`;
        ctx.fillText(banner.text, W / 2 + (1 - a) * 40, y - 3);
        ctx.globalAlpha = 1;
      }
    }
    if (review) drawReview();
    ctx.restore();
  }

  // Line review: a close-up of the line, the ball comes down and leaves its mark, then the verdict.
  function drawReview() {
    const r = review, t = r.t;
    ctx.fillStyle = `rgba(0,0,0,${0.45 * Math.min(1, t * 5)})`; ctx.fillRect(0, 0, W, H);
    const pw = Math.min(380, W * 0.72), ph = pw * 0.62, x0 = (W - pw) / 2, y0 = (H - ph) / 2 - 16;
    ctx.fillStyle = look.in;
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, y0, pw, ph, 14); else ctx.rect(x0, y0, pw, ph); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, pw, ph); ctx.clip();
    const sc = pw / 0.5; // the panel shows half a metre across
    const cx = x0 + pw / 2, cy = y0 + ph / 2;
    // Lay the close-up out the way the camera sees that line: "out" points the same way on screen as it
    // does on the court (past the far baseline is up, the right sideline is to the right, and so on).
    let horiz = r.axis === 'x', o = 1;
    if (r.pt) {
      const nx = r.axis === 'x' ? Math.sign(r.line) : 0, ny = r.axis === 'y' ? Math.sign(r.line) : 0;
      const [ax, ay] = P(r.pt.x, r.pt.y), [bx2, by2] = P(r.pt.x + nx * 0.5, r.pt.y + ny * 0.5);
      const dx = bx2 - ax, dy = by2 - ay;
      horiz = Math.abs(dx) > Math.abs(dy); o = Math.sign(horiz ? dx : dy) || 1;
    }
    // Inside the line is the court colour. Past it is the surround colour only at the edge of the court (the
    // baseline and the doubles sideline): past a singles sideline is the doubles alley and past a service line is
    // the backcourt, both still court colour.
    const edge = r.axis === 'x' ? Math.abs(r.line) > SINGLES + 0.3 : Math.abs(r.line) > SERVICE + 0.3;
    ctx.fillStyle = look.in;
    if (horiz) ctx.fillRect(o > 0 ? x0 : cx, y0, pw / 2, ph); else ctx.fillRect(x0, o > 0 ? y0 : cy, pw, ph / 2);
    ctx.fillStyle = edge ? look.out : look.in;
    if (horiz) ctx.fillRect(o > 0 ? cx : x0, y0, pw / 2, ph); else ctx.fillRect(x0, o > 0 ? cy : y0, pw, ph / 2);
    const d = (Math.abs(r.coord) - Math.abs(r.line)) * sc; // + = towards out
    // The line's outer edge sits on the boundary; the line itself is inside the court.
    ctx.fillStyle = look.line;
    if (horiz) ctx.fillRect(o > 0 ? cx - 0.05 * sc : cx, y0, 0.05 * sc, ph);
    else ctx.fillRect(x0, o > 0 ? cy - 0.05 * sc : cy, pw, 0.05 * sc);
    const bx = horiz ? cx + o * d : cx + r.along * sc, by = horiz ? cy + r.along * sc : cy + o * d;
    const rad = 0.033 * sc;
    if (t > 0.18) {
      // The ball drops in from above and leaves an oval skid mark.
      const k = clamp((t - 0.18) / 0.32, 0, 1);
      if (k >= 1) { ctx.fillStyle = 'rgba(40,30,20,.55)'; ctx.beginPath(); ctx.ellipse(bx, by, rad * (horiz ? 1 : 1.7), rad * (horiz ? 1.7 : 1), 0, 0, Math.PI * 2); ctx.fill(); }
      const h = (1 - k) * 90;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(bx, by, rad, rad * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      // Once it has landed the ball lifts away, leaving just the mark to judge.
      ctx.globalAlpha = 1 - clamp((t - 0.55) / 0.1, 0, 1);
      ctx.fillStyle = '#e4f14a'; ctx.beginPath(); ctx.arc(bx, by - h, rad, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f5f5f7'; ctx.font = `800 13px ${FONT}`;
    ctx.fillText(t < 0.6 ? 'CHALLENGE · LINE REVIEW' : 'LINE REVIEW', W / 2, y0 - 14);
    if (t > 0.6) {
      const a = clamp((t - 0.6) / 0.12, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = r.out ? '#ff453a' : '#30d158';
      ctx.font = `italic 900 ${Math.round(pw / 7)}px ${FONT}`;
      ctx.fillText(r.out ? 'OUT' : 'IN', W / 2, y0 + ph + 30);
      ctx.fillStyle = '#f5f5f7'; ctx.font = `600 13px ${FONT}`;
      const mm = Math.round((Math.abs(r.coord) - Math.abs(r.line) - 0.033) * 1000);
      ctx.fillText(r.out ? `${Math.max(1, mm)} mm out` : 'Clipped the line', W / 2, y0 + ph + 58);
      ctx.globalAlpha = 1;
    }
  }

  // First person: your racket swings into view at the bottom of the screen, with the callout above it.
  function drawPovRacket() {
    const side = fpsSide();
    const label = labels[side];
    if (!label || label.side !== side || !label.racket) return;
    const age = (clock() - label.t0) / label.life;
    if (age >= 1) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3;
    const col = side === 0 ? COLORS.me : COLORS.opp;
    const handRight = prof[side].hand !== 'left';
    const hand = handRight ? 1 : -1;                 // screen side of your racket hand
    const r = Math.min(W, H) * 0.075;                // racket head radius
    const sw = ease(clamp(age / 0.35, 0, 1));
    let head, tilt;
    if (label.racket === 'trophy') {
      // Toss: racket low on your racket side, lifting up and out of view as the ball goes up.
      const t = ease(label.sw || 0);
      head = { x: W / 2 + hand * W * 0.3, y: lerp(H * 0.9, -r * 2.5, t) };
      tilt = hand * 0.5;
    } else if (label.racket === 'underarm' || label.racket === 'underarmPrep') {
      // Underarm: racket comes up from below on your racket side and lifts through the ball.
      const t = label.racket === 'underarmPrep' ? ease(label.sw || 0) * 0.5 : 0.5 + sw * 0.5;
      head = { x: W / 2 + hand * W * lerp(0.3, 0.12, t), y: lerp(H * 1.2, H * 0.62, t) };
      tilt = hand * 0.3;
    } else if (label.racket === 'prep') {
      // Wind-up: the racket rises into view on the side you'll hit from, taken back and low.
      const wing = label.wingSide === 'bh' ? -hand : hand;
      const t = ease(label.sw || 0);
      head = { x: W / 2 + wing * W * lerp(0.22, 0.4, t), y: lerp(H * 1.15, H * (label.volley ? 0.8 : label.touch ? 0.5 : 0.9), t) }; // slices: taken back high
      tilt = wing * 0.9;
    } else if (label.racket === 'serve') {
      // Contact: the head starts where the ball is on screen, then sweeps down across the body.
      if (!label.povStart) {
        const bs = ball.on ? P(ball.x, ball.y, ball.h) : null;
        label.povStart = bs ? { x: clamp(bs[0], W * 0.15, W * 0.85), y: clamp(bs[1], r, H * 0.4) } : { x: W / 2 + hand * W * 0.06, y: H * 0.14 };
      }
      head = { x: lerp(label.povStart.x, W / 2 - hand * W * 0.34, sw), y: lerp(label.povStart.y, H * 1.15, sw) };
      tilt = lerp(0, -hand * 1.1, sw);
    } else {
      // Groundstrokes and volleys: the racket meets the ball where it really is on screen, then follows
      // through across the body (a short punch on volleys).
      const wing = label.racket === 'bh' ? -hand : hand;
      const short = label.flight === 'volley';
      if (!label.povStart) {
        const c = label.cpt || (ball.on ? { x: ball.x, y: ball.y, z: ball.h } : null);
        const cs = c && camSpace(c.x, c.y, c.z);
        const bs = cs && cs.d > NEAR ? projCS(cs) : null;
        label.povStart = bs ? { x: clamp(bs[0], W * 0.06, W * 0.94), y: clamp(bs[1], H * 0.3, H * 0.95) }
          : { x: W / 2 + wing * W * 0.33, y: H * 0.86 };
      }
      const sw2 = ease(clamp((age - 0.08) / 0.35, 0, 1));
      const slice = ['slice', 'drop'].includes(label.flight);
      // Drives finish high across the body; slices cut down and finish low and forward.
      const finish = slice ? { x: W / 2 + wing * W * 0.05, y: H * 1.05 } : { x: W / 2 - wing * W * (short ? 0.02 : 0.3), y: H * (short ? 0.72 : 0.5) };
      head = { x: lerp(label.povStart.x, finish.x, sw2 * (short ? 0.4 : 1)), y: lerp(label.povStart.y, finish.y, sw2 * (short ? 0.4 : 1)) };
      tilt = wing * lerp(0.9, 0.3, sw);
    }
    // Handle points from the head down towards your hand; the grip is just off the head.
    const toward = { x: W / 2 + hand * W * 0.18 - head.x, y: H * 1.25 - head.y };
    const len = Math.hypot(toward.x, toward.y) || 1;
    const ux = toward.x / len, uy = toward.y / len;
    const neck = { x: head.x + ux * r * 1.0, y: head.y + uy * r * 1.0 };
    const grip = { x: head.x + ux * r * 2.3, y: head.y + uy * r * 2.3 };
    // Short forearm(s) and hand, only when the grip is low enough to be in view.
    if (grip.y > H * 0.55) {
      const arms = [hand];
      if (twoHanded(side, label)) arms.push(-hand);
      ctx.lineCap = 'round';
      // Your racket arm always comes from your racket hand's side (a lefty's forehand comes in from the
      // left and finishes across to the right); the second hand on a two-hander comes from nearer the middle.
      for (const a of arms) {
        const end = { x: W / 2 + hand * W * (a === hand ? 0.24 : -0.04), y: H + r };
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = r * 0.62;
        ctx.beginPath(); ctx.moveTo(grip.x, grip.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        ctx.strokeStyle = ARM; ctx.lineWidth = r * 0.5;
        ctx.beginPath(); ctx.moveTo(grip.x, grip.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      }
      // A fist wrapped round the grip (a second one just above it on two-handers).
      ctx.fillStyle = ARM; ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1.5;
      const fists = arms.length > 1 ? [grip, { x: grip.x - ux * r * 0.55, y: grip.y - uy * r * 0.55 }] : [grip];
      for (const f of fists) { ctx.beginPath(); ctx.ellipse(f.x, f.y, r * 0.5, r * 0.4, Math.atan2(uy, ux), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.lineCap = 'butt';
    }
    ctx.strokeStyle = '#1c1c1e'; ctx.lineWidth = r * 0.17;
    ctx.beginPath(); ctx.moveTo(grip.x, grip.y); ctx.lineTo(neck.x, neck.y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.beginPath(); ctx.ellipse(head.x, head.y, r * 0.75, r, Math.atan2(uy, ux) - Math.PI / 2 + tilt * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = r * 0.17; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = r * 0.11; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = 6;
    if (opts.showType && label.type) { ctx.fillStyle = col; ctx.font = `italic 800 22px ${FONT}`; ctx.fillText(label.type, W / 2, H * 0.6); }
    if (opts.showWing && label.wing) { ctx.fillStyle = '#f5f5f7'; ctx.font = `800 13px ${FONT}`; ctx.fillText(wingText(side, label), W / 2, H * 0.6 + 20); }
    ctx.restore();
  }


  // First person: the arena around the court. Sky (or a dark roof indoors), the run-off, sponsor boards
  // along the back and sides, and stands full of people rising behind them.
  const ARENA_Y = BASE + 6.4, ARENA_X = DOUBLES + 3.7, BOARD_H = 1.0, STAND_D = 16, STAND_H = 9;
  const CROWD = ['#d8d4cc', '#c9b8a0', '#8e8e93', '#5a6270', '#3b4250', '#b04a42', '#4a6fa5', '#e0dcd3', '#7a6a58', '#2f5d8a', '#c8a96b', '#6b7d5a'];
  const SEATS = Array.from({ length: 3200 }, (_, i) => {
    const h = Math.imul(i + 7, 2654435761) >>> 0;
    return { side: i % 4, u: ((h >>> 4) % 1000) / 1000, v: ((h >>> 14) % 1000) / 1000, col: CROWD[(h >>> 24) % CROWD.length] };
  });
  const SEATS_BY_SIDE = [0, 1, 2, 3].map(k => SEATS.filter(st => st.side === k));
  function drawArena() {
    const sky = ctx.createLinearGradient(0, -H, 0, H);
    if (indoorFlag) { sky.addColorStop(0, '#07090d'); sky.addColorStop(1, '#1b2029'); }
    else { sky.addColorStop(0, '#2c64a8'); sky.addColorStop(0.75, '#8fb8e0'); sky.addColorStop(1, '#c9dcef'); }
    ctx.fillStyle = sky; ctx.fillRect(-W, -H, W * 3, H * 3);
    drawMountains();
    const Y = ARENA_Y, X = ARENA_X;
    // Each side: inner edge a→b (at the boards), and which way is outwards.
    const sides = [
      { a: [-X, -Y], b: [X, -Y], o: [0, -1], t: [1, 0] }, { a: [X, Y], b: [-X, Y], o: [0, 1], t: [-1, 0] },
      { a: [-X, Y], b: [-X, -Y], o: [-1, 0], t: [0, -1] }, { a: [X, -Y], b: [X, Y], o: [1, 0], t: [0, 1] },
    ];
    const outer = (pt, sd, sgn) => [pt[0] + sd.o[0] * STAND_D + sd.t[0] * STAND_D * sgn, pt[1] + sd.o[1] * STAND_D + sd.t[1] * STAND_D * sgn];
    const mid = sd => camSpace((sd.a[0] + sd.b[0]) / 2 + sd.o[0] * 6, (sd.a[1] + sd.b[1]) / 2 + sd.o[1] * 6, 3).d;
    sides.map((sd, i) => ({ sd, i, d: mid(sd) })).sort((p, q) => q.d - p.d).forEach(({ sd, i }) => {
      const A = outer(sd.a, sd, -1), B = outer(sd.b, sd, 1);
      // Stands: a slope from the top of the boards up and back, with tier lines and a crowd.
      poly([[sd.a[0], sd.a[1], BOARD_H], [sd.b[0], sd.b[1], BOARD_H], [B[0], B[1], STAND_H], [A[0], A[1], STAND_H]], indoorFlag ? '#1d222c' : '#2a3140');
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
      for (let v = 0.2; v < 1; v += 0.2) {
        const p1 = [lerp(sd.a[0], A[0], v), lerp(sd.a[1], A[1], v)], p2 = [lerp(sd.b[0], B[0], v), lerp(sd.b[1], B[1], v)];
        line(p1[0], p1[1], p2[0], p2[1], lerp(BOARD_H, STAND_H, v));
      }
      for (const st of SEATS_BY_SIDE[i]) {
        const v = 0.04 + st.v * 0.92;
        const ix = lerp(sd.a[0], sd.b[0], st.u), iy = lerp(sd.a[1], sd.b[1], st.u);
        const ox = lerp(A[0], B[0], st.u), oy = lerp(A[1], B[1], st.u);
        const cs = camSpace(lerp(ix, ox, v), lerp(iy, oy, v), lerp(BOARD_H, STAND_H, v) + 0.3);
        if (cs.d < 1) continue;
        const [x, y, k] = projCS(cs), sz = clamp(k * 0.32, 1, 5);
        ctx.fillStyle = st.col; ctx.fillRect(x - sz / 2, y - sz, sz, sz);
      }
      // Sponsor boards along the bottom, with a bright top edge.
      poly([[sd.a[0], sd.a[1], 0], [sd.b[0], sd.b[1], 0], [sd.b[0], sd.b[1], BOARD_H], [sd.a[0], sd.a[1], BOARD_H]], indoorFlag ? '#0d2236' : '#0e3352');
      ctx.strokeStyle = 'rgba(100,210,255,.55)'; ctx.lineWidth = 1.5;
      line(sd.a[0], sd.a[1], sd.b[0], sd.b[1], BOARD_H);
    });
    // The run-off around the court, inside the boards.
    poly([[-X, -Y], [X, -Y], [X, Y], [-X, Y]], look.out);
  }

  function drawNet() {
    const X = DOUBLES + 0.9, c = camera();
    if (c === 'top') {
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = Math.max(1.5, S * 0.14);
      line(-X, 0, X, 0);
      ctx.fillStyle = '#d9d9de';
      for (const x of [-X, X]) { const [a, b] = P(x, 0); ctx.beginPath(); ctx.arc(a, b, Math.max(2, S * 0.15), 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    if (c === 'side') {
      // Seen edge-on: a thin band from the near post to the far post.
      const [a, b] = P(-X, 0, 0), [, d] = P(-X, 0, NET_H + 0.15), [, e] = P(X, 0, NET_H + 0.15), [, f2] = P(X, 0, 0);
      ctx.fillStyle = 'rgba(20,20,24,.5)';
      ctx.fillRect(a - 2, Math.min(d, e), 4, Math.max(b, f2) - Math.min(d, e));
      ctx.strokeStyle = '#f5f5f7'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a, d); ctx.lineTo(a, e); ctx.stroke();
      return;
    }
    poly([[-X, 0, 0], [X, 0, 0], [X, 0, NET_H + 0.15], [-X, 0, NET_H + 0.15]], 'rgba(20,20,24,.45)');
    ctx.strokeStyle = '#f5f5f7'; ctx.lineWidth = 2;
    line(-X, 0, X, 0, NET_H + 0.15);
    ctx.lineWidth = 3; ctx.strokeStyle = '#c7c7cc';
    for (const x of [-X, X]) {
      const [a, b] = P(x, 0, 0), [c2, d] = P(x, 0, NET_H + 0.2);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c2, d); ctx.stroke();
    }
  }

  // Bounce marks for the current point; older ones fade. Out balls are red.
  function drawMarks() {
    const top = camera() === 'top';
    // Clay slide marks: a scuffed streak, widest and darkest where the slide ends.
    for (const sl of slides) {
      if (sl.f <= 0) continue;
      const end = { x: lerp(sl.a.x, sl.b.x, sl.f), y: lerp(sl.a.y, sl.b.y, sl.f) };
      const ux = sl.b.x - sl.a.x, uy = sl.b.y - sl.a.y, L = Math.hypot(ux, uy) || 1, nx = -uy / L, ny = ux / L;
      const w0 = 0.07, w1 = 0.27;
      poly([[sl.a.x + nx * w0, sl.a.y + ny * w0], [end.x + nx * w1, end.y + ny * w1], [end.x - nx * w1, end.y - ny * w1], [sl.a.x - nx * w0, sl.a.y - ny * w0]], `rgba(${look.mark},0.45)`);
      // A second, lighter scuff beside it (the other foot).
      const o = 0.28;
      poly([[sl.a.x + nx * (o + 0.03), sl.a.y + ny * (o + 0.03)], [end.x + nx * (o + 0.1), end.y + ny * (o + 0.1)], [end.x + nx * (o - 0.02), end.y + ny * (o - 0.02)], [sl.a.x + nx * (o - 0.01), sl.a.y + ny * (o - 0.01)]], `rgba(${look.mark},0.25)`);
    }
    marks.forEach((m, i) => {
      if (isFps() && camSpace(m.x, m.y, 0).d < NEAR + 0.3) return;
      const age = marks.length - 1 - i;
      const a = Math.max(0.15, 0.85 - age * 0.12);
      const [x, y, k] = P(m.x, m.y);
      // Small, about ball-sized, so a long rally doesn't cover the court in dots (older ones fade further).
      const r = top ? Math.max(1.6, S * 0.13) * 1.3 : clamp(k * 0.09, 1.4, 7);
      ctx.fillStyle = m.out ? `rgba(255,69,58,${a})` : `rgba(${look.mark},${a * 0.8})`;
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.15, top ? r : r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      if (m.out && age === 0) {
        ctx.fillStyle = '#ff453a';
        ctx.font = `700 ${Math.max(11, Math.min(16, k * 0.6))}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('OUT', x, y - r - 5);
      }
    });
  }

  // A small gold crown sitting on a player's head; returns the new top (for the name label above it).
  function drawCrown(cx, top, w) {
    const h = w * 0.62, y0 = top - 1, y1 = y0 - h;
    ctx.save();
    ctx.fillStyle = '#ffd60a'; ctx.strokeStyle = 'rgba(80,55,0,.7)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y0); ctx.lineTo(cx - w / 2, y1 + h * 0.25); ctx.lineTo(cx - w / 4, y1 + h * 0.6);
    ctx.lineTo(cx, y1); ctx.lineTo(cx + w / 4, y1 + h * 0.6); ctx.lineTo(cx + w / 2, y1 + h * 0.25); ctx.lineTo(cx + w / 2, y0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff375f';
    for (const dx of [-w / 2, 0, w / 2]) { ctx.beginPath(); ctx.arc(cx + dx, (dx ? y1 + h * 0.25 : y1), Math.max(1.2, w * 0.08), 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    return y1 - 2;
  }

  function drawPlayer(side) {
    const p = pos[side];
    const gold = prof[side] && prof[side].real; // real ATP players are drawn in gold
    const color = gold ? '#ffd60a' : side === 0 ? COLORS.me : COLORS.opp;
    const [fx, fy, k] = P(p.x, p.y, 0);
    let top, below;
    if (camera() === 'top') {
      const r = Math.max(6, k * 0.6);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(fx + r * 0.3, fy + r * 0.4, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(fx, fy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      top = fy - r; below = fy + r + 12;
    } else {
      const [, hy] = P(p.x, p.y, 1.45);
      const [, headY] = P(p.x, p.y, 1.72);
      const bw = Math.max(5, k * 0.55), hr = Math.max(3.5, k * 0.17);
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(fx, fy, bw * 0.9, bw * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(fx - bw / 2, hy, bw, fy - hy, bw / 2.2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(fx, headY, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      top = headY - hr; below = P(p.x, p.y, 0.8)[1];
    }
    // Legends wear a crown.
    if (prof[side] && prof[side].legend) { top = drawCrown(fx, top, camera() === 'top' ? Math.max(12, k * 0.8) : Math.max(13, k * 0.55)); }
    ctx.fillStyle = gold ? '#ffd60a' : 'rgba(255,255,255,.95)';
    ctx.font = `600 ${camera() === 'top' ? clamp(S * 0.62, 10, 14) : 13}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(names[side], fx, top - 5);
    drawShot(side, top, below);
  }

  function drawBall() {
    const top = camera() === 'top';
    const r0 = top ? Math.max(2.5, S * 0.2) : null;
    trail.forEach((t, i) => {
      if (isFps() && camSpace(t.x, t.y, t.h).d < NEAR + 0.2) return;
      const [x, y, k] = P(t.x, t.y, t.h);
      const r = r0 ? r0 * (1 + t.h * 0.13) : clamp(k * 0.11, 1.5, 10);
      ctx.fillStyle = `rgba(223,255,79,${(i + 1) / trail.length * 0.35})`;
      ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, Math.PI * 2); ctx.fill();
    });
    const [sx, sy, k] = P(ball.x, ball.y, 0);
    const [bx, by] = P(ball.x, ball.y, ball.h);
    // Capped so a ball right at the camera (first person) doesn't fill the screen.
    const r = r0 || (isFps() ? clamp(k * 0.13, 3.2, 14) : clamp(k * 0.12, 2.2, 12));
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.ball;
    ctx.beginPath(); ctx.arc(bx, by, top ? r * (1 + ball.h * 0.13) : r, 0, Math.PI * 2); ctx.fill();
  }

  // Which way (in court x) the forehand side faces for this player, given their end and hand.
  const fhDir = side => (side === 0 ? 1 : -1) * (prof[side].hand === 'left' ? -1 : 1);

  // Two hands on the backhand by default (one-handed backhands can be switched on per player later).
  // Slices, volleys and drop shots are hit one-handed either way.
  // Drop shots and slices (and their wind-ups) and volleys are always one-handed, for lefties and righties alike.
  const twoHanded = (side, lab) => (lab.racket === 'bh' || (lab.racket === 'prep' && lab.wingSide === 'bh' && !lab.volley && !lab.touch))
    && prof[side].backhand !== 'one' && !['slice', 'volley', 'drop'].includes(lab.flight);
  const wingText = (side, lab) => lab.wing !== 'BH' ? lab.wing : twoHanded(side, lab) ? '2H BH' : prof[side].backhand === 'one' ? '1H BH' : 'BH';

  // Where the racket head, grip and shoulders are (metres, relative to the player) at this point in the stroke.
  // Serves: trophy position during the toss, up to meet the ball, then follow-through across the body.
  // Groundstrokes: from contact on the hitting side through to the finish (high over the shoulder on drives,
  // low and forward on slices and drops, short on volleys).
  function racketPose(side, lab, age) {
    const d = dir(side), fh = fhDir(side);
    const mix = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });
    // Underarm serve: racket low behind the body while the ball is dropped, swings up underneath to meet it
    // around knee height in front, then finishes low and forward.
    if (lab.racket === 'underarm' || lab.racket === 'underarmPrep') {
      const back = { x: fh * 0.5, y: d * 0.45, z: 0.35 };
      const hit = { x: fh * 0.4, y: -d * 0.4, z: 0.55 };
      const finish = { x: fh * 0.25, y: -d * 0.6, z: 0.9 };
      const head = lab.racket === 'underarmPrep' ? mix(back, hit, ease(lab.sw || 0))
        : age < 0.08 ? hit : mix(hit, finish, ease(clamp((age - 0.08) / 0.35, 0, 1)));
      const sh = { x: fh * 0.22, y: 0, z: 1.4 };
      return { head, grip: mix(sh, head, 0.45), shoulders: [sh] };
    }
    if (lab.racket === 'serve' || lab.racket === 'trophy') {
      const trophy = { x: fh * 0.35, y: d * 0.35, z: 1.25 };
      const hit = { x: fh * 0.2, y: -d * 0.45, z: 2.6 };
      const follow = { x: -fh * 0.45, y: -d * 0.25, z: 0.9 };
      const head = lab.racket === 'trophy' ? mix(trophy, hit, ease(lab.sw || 0))
        : age < 0.35 ? mix(hit, follow, age / 0.35) : follow;
      const sh = { x: fh * 0.2, y: 0, z: 1.55 };
      return { head, grip: mix(sh, head, 0.4), shoulders: [sh] };
    }
    // Wind-up while the ball comes: from the ready position, take the racket back on the hitting side
    // (a short, compact take-back for volleys).
    if (lab.racket === 'prep') {
      const rs = lab.wingSide === 'bh' ? -fh : fh;
      const ready = { x: rs * 0.15, y: -d * 0.35, z: 1.05 };
      // Slices and drops are taken back high (above the shoulder) to come down through the ball.
      const back = lab.volley ? { x: rs * 0.55, y: -d * 0.1, z: 1.3 } : lab.touch ? { x: rs * 0.55, y: d * 0.4, z: 1.75 } : { x: rs * 0.6, y: d * 0.55, z: 1.2 };
      const head = mix(ready, back, ease(lab.sw || 0));
      const near = { x: rs * 0.22, y: 0, z: 1.4 }, far = { x: -rs * 0.22, y: 0, z: 1.4 };
      return { head, grip: mix(near, head, 0.45), shoulders: twoHanded(side, lab) ? [near, far] : [near] };
    }
    const rs = lab.racket === 'bh' ? -fh : fh;
    const contact = { x: rs * 0.8, y: -d * 0.15, z: 1.0 };
    // Finishes stay on the hitting side so forehands and backhands read clearly (a drive finishes high
    // near the head rather than all the way over the other shoulder).
    const finish = lab.flight === 'volley' ? { x: rs * 0.55, y: -d * 0.5, z: 1.15 }
      : ['slice', 'drop'].includes(lab.flight) ? { x: rs * 0.25, y: -d * 0.65, z: 0.5 } // down and through, low and forward
      : { x: rs * 0.12, y: -d * 0.05, z: 1.85 };
    // Hold at contact a beat, then swing through.
    const head = mix(contact, finish, ease(clamp((age - 0.12) / 0.35, 0, 1)));
    const near = { x: rs * 0.22, y: 0, z: 1.4 }, far = { x: -rs * 0.22, y: 0, z: 1.4 };
    return { head, grip: mix(near, head, 0.45), shoulders: twoHanded(side, lab) ? [near, far] : [near] };
  }

  // Racket on the forehand or backhand side (overhead on serves and smashes) plus the callout text.
  function drawShot(side, headTop, belowHead) {
    const label = labels[side];
    if (!label || label.side !== side) return;
    const age = (clock() - label.t0) / label.life;
    if (age >= 1) return;
    const alpha = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3;
    const p = pos[side];
    const color = side === 0 ? COLORS.me : COLORS.opp;
    const top = camera() === 'top';
    ctx.globalAlpha = alpha;
    if (label.racket) {
      const pose = racketPose(side, label, age);
      const sc = top ? 2.2 : 1;
      const at = q => P(p.x + q.x * sc, p.y + q.y * sc, top ? 0 : q.z);
      const [gx, gy] = at(pose.grip);
      const [cx, cy, k] = at(pose.head);
      // Arms to the grip (skin-toned so they show against the shirt): two of them on a two-handed backhand.
      ctx.lineCap = 'round';
      for (const [w, c] of [[0.11, 'rgba(0,0,0,.45)'], [0.07, ARM]]) {
        ctx.strokeStyle = c; ctx.lineWidth = Math.max(2, k * w);
        for (const sh of pose.shoulders) { const [sx, sy] = at(sh); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(gx, gy); ctx.stroke(); }
      }
      const rx = Math.max(4, k * (top ? 0.22 : 0.16)), ry = Math.max(5, k * (top ? 0.28 : 0.2));
      ctx.strokeStyle = '#1c1c1e';
      ctx.lineWidth = Math.max(2, k * 0.05);
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(cx - (cx - gx) * 0.35, cy - (cy - gy) * 0.35); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, Math.atan2(cy - gy, cx - gx) + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = Math.max(3, k * 0.08); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.6, k * 0.045); ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,.75)';
    ctx.shadowBlur = 5;
    if (opts.showType && label.type) {
      ctx.fillStyle = color;
      ctx.font = `italic 800 ${top ? 14 : 15}px ${FONT}`;
      ctx.fillText(label.type, P(p.x, p.y)[0], headTop - 22);
    }
    if (opts.showWing && label.wing) {
      ctx.font = `800 ${top ? 11 : 10}px ${FONT}`;
      ctx.fillStyle = top ? '#f5f5f7' : '#111';
      ctx.shadowBlur = top ? 4 : 0;
      ctx.fillText(wingText(side, label), P(p.x, p.y)[0], belowHead);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // --- Timing --------------------------------------------------------------------

  function tween(ms, frame) {
    return new Promise(done => {
      if (skip || ms <= 0) { frame(1); draw(); return done(); }
      const t0 = clock();
      const step = () => {
        if (skip) { frame(1); draw(); return done(); }
        if (pauseCheck()) { clock(); return requestAnimationFrame(step); } // frozen: nothing moves or redraws
        const t = clamp((clock() - t0) / ms, 0, 1);
        frame(t);
        draw();
        t < 1 ? requestAnimationFrame(step) : done();
      };
      requestAnimationFrame(step);
    });
  }
  const wait = ms => tween(ms, () => {});

  function setBall(p, h) {
    ball.x = p.x; ball.y = p.y; ball.h = h;
    trail.push({ x: p.x, y: p.y, h });
    if (trail.length > 7) trail.shift();
  }

  // --- Shot flight ---------------------------------------------------------------------

  // apex = when the ball peaks (null: right over the net); h = peak height (m); mps = average ball speed
  // before the bounce (it loses about 40% after it); bounce = kick height; split = share before the bounce.
  const FLIGHT = {
    serve:   { apex: 0.12, h: () => 2.8,             mps: 40, bounce: 1.2,  split: 0.6 },
    kick:    { apex: 0.14, h: () => 3.0,             mps: 30, bounce: 2.3,  split: 0.55 },
    topspin: { apex: 0.42, h: () => rand(2.4, 3.2),  mps: 27, bounce: 1.7,  split: 0.62 },
    slice:   { apex: 0.56, h: () => rand(1.15, 1.5), mps: 20, bounce: 0.55, split: 0.68 },
    flat:    { apex: 0.5,  h: () => rand(1.05, 1.35), mps: 35, bounce: 1.0, split: 0.6 },
    lob:     { apex: 0.5,  h: () => rand(7, 9.5),    mps: 11, bounce: 2.4,  split: 0.78 },
    drop:    { apex: null, h: () => 1.3,             mps: 11, bounce: 0.5,  split: 0.6 },
    popped:  { apex: null, h: () => 2.3,             mps: 12, bounce: 0.9,  split: 0.62 },
    volley:  { apex: 0.4,  h: () => 1.35,            mps: 19, bounce: 1.0,  split: 0.6 },
    smash:   { apex: 0.05, h: () => 2.9,             mps: 32, bounce: 2.0,  split: 0.55 },
    post:    { apex: 0.3,  h: () => 0.75,            mps: 25, bounce: 0.9,  split: 0.62 },
  };
  const TYPE_FLIGHT = { 'TOPSPIN!': 'topspin', 'SLICE!': 'slice', 'FLAT!': 'flat', 'LOB!': 'lob', 'DROP SHOT!': 'drop',
    'VOLLEY!': 'volley', 'SMASH!': 'smash', 'AROUND THE POST!': 'post', 'TWEENER!': 'lob' };

  // Ball height along a flight: rises to the peak (slowing), then falls (speeding up).
  // Soft shots (drops, underarms) lose forward speed through the air: position along the line = 1 − (1 − u)^SOFT.
  // Planning (net clearance) and playback both use this, so the ball is drawn exactly where it was checked.
  const SOFT = 1.25;
  function arc(u, h0, ua, H, h1) {
    if (u < ua) return lerp(h0, H, Math.sin(Math.PI / 2 * u / ua));
    return lerp(H, h1, 1 - Math.cos(Math.PI / 2 * (u - ua) / (1 - ua)));
  }

  // --- Rally shape ----------------------------------------------------------------------

  // Real-time movement: players react a beat after contact, then sprint (about 6.5 m/s once up to speed);
  // after hitting they recover more slowly. Everything is in metres and seconds, in every view.
  const REACT = 0.15, ACCEL = 16, VMAX = 6.5, RECOVER = 4.2;
  const runDist = t => { t = Math.max(0, t - REACT); const t1 = VMAX / ACCEL; return t < t1 ? 0.5 * ACCEL * t * t : 0.5 * VMAX * t1 + VMAX * (t - t1); };
  const recoverDist = t => RECOVER * Math.max(0, t - 0.1);
  // Seconds needed to run d metres (inverse of runDist).
  const runTime = d => { let lo = 0, hi = 6; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (runDist(mid) < d) lo = mid; else hi = mid; } return hi; };
  // Flight time (ms) for a ball travelling pre metres before the bounce and post metres after it.
  // How each surface treats the ball: speed through the air (court pace), how much it keeps after the
  // bounce, and how high it bounces. Clay is slow and high; grass skids through low and fast.
  const SURF = {
    clay:   { pace: 0.94, keep: 0.5,  bounce: 1.25, sliceLow: 0.9 },
    hard:   { pace: 1,    keep: 0.6,  bounce: 1,    sliceLow: 0.85 },
    indoor: { pace: 1.04, keep: 0.64, bounce: 0.95, sliceLow: 0.8 },
    grass:  { pace: 1.06, keep: 0.72, bounce: 0.7,  sliceLow: 0.6 },
  };
  // Weather on top of the surface: heavy humid air or a damp court slows the ball; heat speeds it up.
  let wx = { pace: 1, bounce: 1 };
  // Today's conditions, for the scenery and the badge on court: weather key, altitude (m), court speed.
  let conditions = { key: null, altitude: 0, speed: null };
  let infoEl = null; // when set, conditions and plan show in this strip under the court instead of on it
  function fillInfo() {
    if (!infoEl) return;
    const cond = conditions.speed ? `${conditions.label || ''}${conditions.label ? ' · ' : ''}${conditions.speed} court${conditions.altitude >= 900 ? ` · ⛰️ ${conditions.altitude.toLocaleString('en-US')} m` : ''}` : '';
    const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    infoEl.innerHTML = (cond ? `<span class="ci-cond">${esc(cond)}</span>` : '') + (planText ? `<span class="ci-plan">📋 ${esc(planText)}</span>` : '');
    infoEl.hidden = !cond && !planText;
  }
  let planText = ''; // your current game plan, shown bottom-right (set from the match screen)
  const surf = () => { const b = SURF[indoorFlag ? 'indoor' : surface] || SURF.hard; return { ...b, pace: b.pace * wx.pace, bounce: b.bounce * wx.bounce, keep: b.keep * (wx.pace < 1 ? 0.95 : 1) }; };
  const flightMs = (pre, post, v) => clamp((pre / v + post / (v * surf().keep)) * 1000, 200, 3800);

  // Turns the engine's point (how it ended, rally length, net approach, net cord) into shots.
  function buildRally(pt, info) {
    const { server } = info;
    const returner = 1 - server, winner = pt.w, loser = 1 - winner;
    const fault = { by: server, kind: 'fault' };
    if (pt.how === 'df') return { shots: [fault, fault], end: 'df', length: 0 };
    if (pt.underarm) {
      const shots = [{ by: server, kind: 'underarm' }];
      if (pt.how === 'underarmLost') shots.push({ by: returner, kind: 'winner' });
      return { shots, end: pt.how, length: shots.length };
    }
    const pre = pt.serve2 ? [fault] : [];
    if (pt.how === 'ace') return { shots: [...pre, { by: server, kind: 'ace' }], end: 'ace', length: 1 };
    if (pt.how === 'unreturned') return { shots: [...pre, { by: server, kind: 'ace' }], end: 'unreturned', length: 1 };
    const n = pt.len;
    const hitter = k => k % 2 === 0 ? server : returner;
    const base = () => Array.from({ length: n }, (_, k) => ({ by: hitter(k), kind: k === 0 ? 'serve' : 'rally' }));
    if (pt.netcord && pt.netcord.result !== 'continue' && n >= 2) { // a serve off the tape is a let, never a net-cord winner
      const shots = base();
      shots[n - 1].kind = pt.netcord.result === 'over' ? 'cordOver' : 'cordBack';
      return { shots: [...pre, ...shots], end: pt.netcord.result === 'over' ? 'netcord' : 'netcordback', length: n };
    }
    let shots;
    let end;
    if (pt.drop && pt.drop.result !== 'retrieved') {
      const res = pt.drop.result;
      shots = base();
      shots[n - 1].kind = res === 'won' ? 'drop' : res === 'net' ? 'net' : 'winner';
      if (res === 'chased') shots[n - 2].kind = 'drop';
      if (res === 'chased' && pt.drop.redrop) { shots[n - 1].kind = 'drop'; shots[n - 1].redrop = true; } // a drop answered with a cross-court drop
      if (res === 'won' && pt.drop.spin) shots[n - 1].spinAway = true;
      if (res === 'net') shots[n - 1].dropNet = true;
      end = { won: 'drop', net: 'dropnet', chased: 'dropchased' }[res];
    } else {
      const clean = pt.how === 'winner';
      const app = pt.net ? pt.net.by : null;
      shots = [];
      for (let k = 0; k < n; k++) {
        let kind = k === 0 ? 'serve' : 'rally';
        if (k === n - 1) kind = clean ? (app === winner ? 'volley' : 'winner') : (Math.random() < 0.45 ? 'net' : 'out');
        else if (app !== null && hitter(n - 1) === app && k === n - 3 && k > 0) kind = 'approach';
        else if (app !== null && hitter(n - 1) !== app && k === n - 2 && k > 0) kind = 'approach'; // never replaces the serve (serve-and-volley points ending on the return)
        if (app === hitter(n - 1) && k === n - 2 && kind !== 'serve') kind = 'pass';
        shots.push({ by: hitter(k), kind, passWin: k === n - 1 && clean && app !== null && app === loser });
      }
      if (app !== null && !clean && hitter(n - 1) === app) shots[n - 1].volleyErr = true;
      end = clean ? (app === winner ? 'volley' : app === loser ? 'pass' : 'winner')
        : n === 2 && loser === returner ? 'return-error' : pt.how === 'ue' ? 'ue' : 'fe';
    }
    // The last ball is hit with the wing the engine recorded (and the ball before it is placed to that side).
    const body = shots.filter(s => s.kind !== 'fault'), fin = body[body.length - 1];
    if (pt.wing && body.length >= 3 && ['winner', 'net', 'out', 'pass'].includes(fin.kind)) {
      fin.forceWing = pt.wing; body[body.length - 2].aimWing = pt.wing;
      // Signature patterns. Attacking baseliners run around for the inside-out forehand winner.
      const st = (prof[fin.by] || {}).style;
      if (fin.kind === 'winner' && pt.wing === 'fh' && ['Aggressive Baseliner', 'Heavy-Topspin Attacker', 'All-Court', 'Flat Attacker'].includes(st) && Math.random() < 0.45) body[body.length - 2].aimWing = 'bh', fin.insideOut = true;
    }
    // Serve +1: a big server goes wide, then puts the next ball into the open court.
    if (body.length === 3 && body[0].kind === 'serve' && body[2].kind === 'winner' && body[2].by === server && ['Serve +1 Attacker', 'First-Strike Attacker', 'Serve-Dominant'].includes((prof[server] || {}).style)) body[0].aim = 'wide';
    // A drop shot that got dug back: the rally carried on from there.
    if (pt.drop && pt.drop.result === 'retrieved') {
      const idx = shots.findIndex((sh, i) => i > 0 && i < shots.length - 2 && sh.by === pt.drop.by && sh.kind === 'rally');
      if (idx > 0) { shots[idx].kind = 'drop'; shots[idx].dug = true; }
    }
    // A net cord mid-rally: the ball clips the tape and play goes on.
    if (pt.netcord && pt.netcord.result === 'continue' && shots.length > 2) {
      const mid = shots.slice(1, -1).filter(s => s.kind === 'rally');
      if (mid.length) mid[Math.floor(Math.random() * mid.length)].cordTick = true;
    }
    return { shots: [...pre, ...shots], end, length: n };
  }

  // Where the ball will be met, relative to where the player starts, decides the wing.
  function chooseWing(side, bodyX, ballX) {
    const d = (ballX - bodyX) * fhDir(side);
    if (d > 0.4) return 'Forehand';
    if (d < -0.4) return d > -1.6 && Math.random() < 0.18 ? 'Forehand' : 'Backhand';
    return Math.random() < 0.6 ? 'Forehand' : 'Backhand';
  }

  // The player stands about an arm's length from the ball, on the side they hit from.
  const racketSign = (side, wingName) => (wingName === 'Forehand' ? 1 : -1) * fhDir(side);
  const bodyFor = (side, wingName, b) => ({ x: b.x - racketSign(side, wingName) * 0.75, y: b.y });

  // The callout for the shot about to be hit, and its flight.
  // c: { defensive, oppAtNet, cornered, overhead, chasingLob }.
  function nameShot(shot, wingName, kmh, c, side) {
    const k = shot.kind;
    // How much the hitter flattens it out, from their game plan.
    const spin = side === undefined ? 'mixed' : (prof[side].plan || {}).spin || 'mixed';
    const st = side === undefined ? null : prof[side].style;
    // Playstyle on top of the plan: first-strike players go flat right after the serve, flat attackers
    // flatten everything, grinders and heavy-topspin players roll it.
    const flatOdds = st === 'First-Strike Attacker' || st === 'Serve +1 Attacker' ? (c.k <= 2 ? 0.75 : 0.45) : st === 'Flat Attacker' ? 0.55
      : st === 'Defensive Grinder' || st === 'Heavy-Topspin Baseliner' || st === 'Heavy-Topspin Attacker' ? 0.03 : { flat: 0.6, mixed: 0.18, topspin: 0.04 }[spin];
    const agg = side === undefined ? null : (prof[side].plan || {}).aggression;
    const flatOdds2 = clamp(flatOdds + (agg === 'aggressive' ? 0.2 : agg === 'patient' ? -0.1 : 0), 0, 0.9);
    const defender = st === 'Defensive Grinder' || st === 'Counterpuncher';
    const drive = () => out(Math.random() < flatOdds2 ? 'FLAT!' : 'TOPSPIN!');
    if (k === 'serve' || k === 'ace' || k === 'fault') return { type: speedText(kmh).toUpperCase(), wing: null, racket: 'serve', flight: 'serve' };
    const wing = wingName === 'Forehand' ? 'FH' : 'BH';
    const out = (type, flight) => ({ type, wing, racket: wing.toLowerCase(), flight: flight || TYPE_FLIGHT[type] });
    if (c.overhead) return { type: 'SMASH!', wing: null, racket: 'serve', flight: 'smash' };
    if (k === 'underarm') return { type: 'UNDERARM!', wing: null, racket: 'underarm', flight: 'drop' };
    if (k === 'cordOver' || k === 'cordBack') return out('NET CORD!', 'flat');
    if (k === 'drop' || shot.dropNet) return out('DROP SHOT!');
    if (k === 'volley' || k === 'volleyx' || shot.volleyErr) return out('VOLLEY!');
    if (k === 'approach') return out(c.chip || Math.random() < 0.6 ? 'SLICE!' : 'TOPSPIN!');
    // Pulled far wide near the net: sometimes the only way back is around the net post.
    if (c.cornered && (k === 'winner' || k === 'pass') && Math.random() < 0.4) { shot.post = true; return out('AROUND THE POST!'); }
    if (c.chasingLob && Math.random() < 0.15) { shot.lob = true; return out('TWEENER!'); }
    if (k === 'pass' || c.oppAtNet) {
      // Defenders love the lob over a net rusher; attackers try to drive it past them.
      const lobPass = defender ? 0.45 : st === 'First-Strike Attacker' || st === 'Flat Attacker' || st === 'Aggressive Baseliner' ? 0.15 : 0.3;
      if (Math.random() < lobPass) { shot.lob = true; return out('LOB!'); }
      return out(Math.random() < Math.max(0.3, flatOdds) ? 'FLAT!' : 'TOPSPIN!');
    }
    const ss = shotStyle(side);
    // Lobs: mostly a defensive shot (defenders a bit more), rare from neutral.
    // A moonball call: high, heavy balls all point (some go up as lobs).
    if (k === 'rally' && curCall && curCall.side === side && typeof CALL_FX !== 'undefined' && (CALL_FX[curCall.id] || {}).moon) { if (Math.random() < 0.3) { shot.lob = true; return out('LOB!'); } return out('TOPSPIN!'); }
    const lobOdds = c.defensive ? 0.12 * (defender ? 1.3 : 1) + (ss.lob || 0) : (surface === 'clay' ? 0.03 : 0.015) + (ss.lob || 0) / 3;
    if (k === 'rally' && Math.random() < lobOdds) { shot.lob = true; return out('LOB!'); }
    const sliceOdds = (wing === 'BH' ? (surface === 'grass' ? 0.38 : 0.2) : 0.04) + (c.defensive ? 0.2 : 0)
      + (defender && c.defensive ? 0.15 : 0) + (wing === 'BH' ? ss.slice || 0 : ss.fhSlice || 0) - (st === 'First-Strike Attacker' || st === 'Flat Attacker' ? 0.1 : 0);
    if (Math.random() < sliceOdds) return out('SLICE!');
    if (k === 'winner' && Math.random() < 0.45) return out('FLAT!');
    return drive();
  }

  // Rally shot direction: mostly crosscourt, some down the line, some through the middle,
  // and short angles, which smarter players use more often.
  function rallyTarget(shot, from, yMin, yMax) {
    const d = dir(shot.by), hx = from.x, adv = prof[shot.by].adv || {}, ss = shotStyle(shot.by);
    // Baseline styles keep the ball deep; moonballs and deep drives both land near the baseline.
    if (ss.deep && yMin < ss.deep && yMax > ss.deep + 1) yMin = ss.deep;
    if (adv.depth === 'high') { yMin = Math.max(yMin, 8.5); yMax = Math.max(yMax, 11.3); }
    if (adv.depth === 'deep') { yMin = Math.max(yMin, 9.8); yMax = Math.max(yMax, 11.6); }
    // Target wing: most rally balls go to the chosen side of the receiver.
    if ((adv.wing === 'fh' || adv.wing === 'bh') && Math.random() < 0.72) {
      const recv = 1 - shot.by, wx = (adv.wing === 'fh' ? 1 : -1) * fhDir(recv);
      return { x: wx * rand(1.3, 3.9), y: -d * rand(yMin, yMax) };
    }
    const side = Math.abs(hx) < 0.6 ? (Math.random() < 0.5 ? 1 : -1) : Math.sign(hx);
    const angleOdds = clamp((prof[shot.by].iq - 40) / 150 * (ss.angle || 1), 0.03, 0.5);
    const r = Math.random();
    // Short angles: variety players carve them sharper and shorter, pulling the opponent off the court.
    if (r < angleOdds && adv.depth !== 'deep') return ss.sharp && Math.random() < 0.6 ? { x: -side * rand(3.5, 4.05), y: -d * rand(3.8, 5.6) } : { x: -side * rand(3.2, 4.0), y: -d * rand(4.5, 7) }; // deep drivers don't play short angles
    if (r < angleOdds + 0.5) return { x: -side * rand(1.4, 3.9), y: -d * rand(yMin, yMax) };
    if (r < angleOdds + 0.75) return { x: side * rand(1.4, 3.9), y: -d * rand(yMin, yMax) };
    return { x: rand(-1.4, 1.4), y: -d * rand(yMin, yMax) };
  }

  // Where a shot lands.
  function landing(shot, from, deuce, recvPos) {
    const d = dir(shot.by);
    // Placed to a wing (so the next ball is struck with the wing the engine recorded): a rally ball to that side.
    if (shot.aimWing && recvPos && ['rally', 'approach', 'pass'].includes(shot.kind)) {
      const recv = 1 - shot.by;
      return { x: clamp(recvPos.x + (shot.aimWing === 'fh' ? 1 : -1) * fhDir(recv) * rand(1.4, 2.8), -3.9, 3.9), y: -d * rand(8, 11.2) };
    }
    // A re-drop goes cross-court, to the far side of the net from the drop it answered.
    if (shot.redrop) return { x: -Math.sign(from.x || 1) * rand(2.6, 3.8), y: -d * rand(0.6, 1.6) };
    // Lobs vary: most go deep, some fall short (and get punished).
    // A winning lob goes right over the player at the net and lands deep behind them.
    if (shot.lob && (shot.kind === 'pass' || shot.kind === 'winner') && recvPos) return { x: clamp(recvPos.x + rand(-0.8, 0.8), -3.8, 3.8), y: -d * rand(9.8, 11.5) };
    if (shot.lob) return { x: rand(-3.6, 3.6), y: -d * (Math.random() < 0.3 ? rand(6.5, 9) : rand(9.5, 11.6)) };
    if (shot.post) return { x: Math.sign(from.x) * rand(2.6, 3.9), y: -d * rand(5, 10) };
    switch (shot.kind) {
      case 'ace': case 'serve': {
        const side = (deuce ? -1 : 1) * d;
        // A serve call aims it: into the body (at the returner) or out wide.
        const aim = shot.aim || (curCall && curCall.side === shot.by && typeof CALL_FX !== 'undefined' ? (CALL_FX[curCall.id] || {}).serve : null);
        const wide = aim === 'body' && recvPos ? clamp(Math.abs(recvPos.x) + rand(-0.4, 0.3), 0.6, 3.4) : aim === 'wide' ? rand(3.3, 3.95)
          : shot.kind === 'ace' ? (Math.random() < 0.5 ? 0.35 : 3.8) : rand(0.6, 3.6);
        return { x: side * wide, y: -d * rand(shot.kind === 'ace' ? 5.4 : 3, 6.1) };
      }
      case 'winner': case 'volley': {
        const away = recvPos.x > 0 ? -1 : 1;
        return { x: away * rand(2.6, 3.95), y: -d * rand(shot.kind === 'volley' ? 3.5 : 8, 11.3) };
      }
      case 'volleyx': return { x: rand(-3, 3), y: -d * rand(2.5, 6) };
      case 'underarm': return { x: (deuce ? -1 : 1) * d * rand(0.5, 3), y: -d * rand(1, 3) };
      case 'out': return Math.random() < 0.55
        ? { x: rand(-3.5, 3.5), y: -d * rand(12.4, 13.6) }
        : { x: (Math.random() < 0.5 ? -1 : 1) * rand(4.5, 5.3), y: -d * rand(7, 11) };
      case 'approach': return rallyTarget(shot, from, 8.5, 11);
      // A good drop dies just over the net; a poor one sits up a few metres further back.
      case 'drop': return { x: rand(-3.2, 3.2), y: -d * (shot.popped ? rand(2.6, 4.5) : rand(0.5, 1.6)) };
      case 'fault': return Math.random() < 0.6
        ? { x: (deuce ? -1 : 1) * d * rand(0.8, 3.6), y: -d * rand(6.7, 7.6) }
        : { x: (deuce ? -1 : 1) * d * rand(4.2, 4.8), y: -d * rand(3, 6) };
      default: return rallyTarget(shot, from, 6.5, 11.3);
    }
  }

  // Where the receiver meets the ball. Heavy and deep balls push them back; angles pull them off the court.
  function contactPoint(bounce, recv, shot, next, flight) {
    const d = dir(recv);
    if (next && (next.kind === 'volley' || next.kind === 'volleyx')) return { x: clamp(bounce.x * 0.7, -4, 4), y: d * rand(1.8, 3) };
    if (shot.kind === 'drop' || shot.kind === 'underarm') return { x: clamp(bounce.x * 1.05, -DOUBLES, DOUBLES), y: d * rand(0.9, 1.8) };
    const carry = { serve: rand(3.5, 5.5), topspin: rand(2.2, 4.4), flat: rand(1.8, 3.4), slice: rand(1.0, 2.2),
      lob: rand(1.5, 4.5), smash: rand(3, 6), post: rand(1.5, 3), volley: rand(1.2, 2.4), popped: rand(1, 2) }[flight] ?? rand(1.3, 2.8);
    // How the receiver's plan meets the ball: aggressive players step in and take it on the rise, patient
    // players and moonballers let it come to them deep, deep drivers hold the baseline.
    const pl = prof[recv].plan || {}, ad = prof[recv].adv || {};
    const early = flight === 'serve' ? 0 : (pl.aggression === 'aggressive' ? -0.9 : pl.aggression === 'patient' ? 0.9 : 0) + (ad.depth === 'high' ? 1.0 : ad.depth === 'deep' ? -0.4 : 0);
    return {
      // Wide balls drag the receiver out past the alley; short angles even further.
      x: clamp(bounce.x * 1.3 + (Math.abs(bounce.x) > 3.2 && Math.abs(bounce.y) < 8 ? Math.sign(bounce.x) * rand(0.8, 2.2) : 0), -DOUBLES - 2.6, DOUBLES + 2.6),
      // Let the ball come up off the bounce (no short-hops on rally balls): at least ~1.6 m past the bounce.
      y: d * clamp(Math.abs(bounce.y) + Math.max(flight === 'slice' ? 1.8 : 2.3, carry + early), 1.5, BASE + 6.5),
    };
  }

  const inAirNext = next => !!next && (next.kind === 'volley' || next.kind === 'volleyx' || !!next.volleyErr || !!next.smash);

  // Clay: a long run to a wide ball (or a lunge at a winner) ends in a slide, leaving a mark.
  function slideFor(r0, body, reach, final) {
    if (surface !== 'clay' || indoorFlag) return null;
    const end = { x: lerp(r0.x, body.x, reach), y: lerp(r0.y, body.y, reach) }, D = dist(r0, end);
    if (D < 2.6 || (!final && Math.abs(end.x) < SINGLES - 0.4)) return null;
    const len = Math.min(D * 0.45, rand(0.8, 1.6));
    const ux = (end.x - r0.x) / D, uy = (end.y - r0.y) / D;
    return { a: { x: end.x - ux * len, y: end.y - uy * len }, b: end, len, D, f: 0 };
  }

  // --- Planning a point ---------------------------------------------------------------------

  // Builds the full script for one point, from the current positions.
  function plan(pt, info) {
    const { server, deuce } = info;
    curCall = pt.call || null;
    const start = pos.map(p => ({ ...p }));
    const cur = pos.map(p => ({ ...p }));
    const segs = [];
    const goal = servePositions(server, deuce);
    const walk = Math.max(dist(cur[0], goal[0]), dist(cur[1], goal[1]));
    segs.push({ t: 'walk', to: goal, base: 250 + walk * 40, real: clamp(walk / 4.5 * 1000, 400, 2400) });
    cur[0] = { ...goal[0] }; cur[1] = { ...goal[1] };
    segs.push({ t: 'pause', base: 150, real: 700 });

    const rally = buildRally(pt, info);
    // Serves are struck at the hitting point: a little to the racket side and in front of the server.
    let from = { x: cur[server].x + fhDir(server) * 0.2, y: cur[server].y - dir(server) * 0.45 }, fromH = 2.6;
    const wingNext = [null, null], defensive = [false, false], chasingLob = [false, false];
    const atNet = side => Math.abs(cur[side].y) < 6;
    let faults = 0, highlight = null;

    if (pt.let) {
      const spot = { x: (deuce ? -1 : 1) * dir(server) * rand(1, 3), y: -dir(server) * rand(2.5, 5.5) };
      segs.push({ t: 'let', side: server, from: { ...from }, spot, call: nameShot({ kind: 'serve' }, '', pt.kmh1, {}) });
    }

    for (let k = 0; k < rally.shots.length; k++) {
      const shot = rally.shots[k], next = rally.shots[k + 1];
      if (shot.kind === 'fault') {
        const call = nameShot(shot, '', faults === 0 ? pt.kmh1 : pt.kmh2, {});
        segs.push({ t: 'fault', side: server, from: { ...from }, spot: landing(shot, from, deuce, cur[1 - server]), call, df: faults === 1 });
        faults++;
        continue;
      }
      const hitter = shot.by, recv = 1 - hitter, final = !next;
      const r0 = { ...cur[recv] }, h0 = { ...cur[hitter] };
      const isServe = shot.kind === 'serve' || shot.kind === 'ace';
      const myWing = wingNext[hitter] || chooseWing(hitter, h0.x, from.x);
      const cornered = Math.abs(from.x) > DOUBLES + 1.2 && Math.abs(from.y) < BASE - 1;
      const chip = !!(pt.net && pt.net.style === 'chip' && pt.net.by === hitter);
      const call = nameShot(shot, myWing, faults ? pt.kmh2 : pt.kmh1,
        { defensive: defensive[hitter], oppAtNet: atNet(recv) && !isServe, cornered, overhead: shot.smash || shot.bounceSmash, chasingLob: chasingLob[hitter], chip, k: k - faults }, hitter);
      // Big-point calls show on the callout: the big serve, the chip, the serve-and-volley.
      { const sv = isServe && pt.call && pt.call.side === hitter && !faults && typeof CALL_FX !== 'undefined' ? (CALL_FX[pt.call.id] || {}).serve : null;
        if (sv) call.type += { big: ' · BIG SERVE', body: ' · BODY SERVE', wide: ' · OUT WIDE', kick: ' · KICK SERVE', safe: ' · FIRST SERVE IN' }[sv] || ''; }
      // Serve-and-volley: the server follows the serve straight in.
      const rushIn = isServe && pt.net && pt.net.style === 'snv' && pt.net.by === hitter;
      if (rushIn) call.type += ' · S&V';
      if (shot.kind === 'drop' && !final && !shot.dug) shot.popped = true;
      if (shot.kind === 'underarm') fromH = 0.55;
      // Second serves are kicked: a higher, longer bounce that pushes the returner back.
      const kick = isServe && (faults > 0 || !!(pt.call && pt.call.side === hitter && typeof CALL_FX !== 'undefined' && (CALL_FX[pt.call.id] || {}).serve === 'kick'));
      if (kick) call.type += ' · KICK';
      let fl = FLIGHT[shot.popped ? 'popped' : kick ? 'kick' : call.flight || 'topspin'];
      // Shot depth shows in the flight: moonballs loop high and kick up; deep drives skim low and fast.
      const dpt = (prof[hitter].adv || {}).depth, rallyBall = !isServe && (call.flight === 'topspin' || call.flight === 'flat') && !shot.popped;
      if (rallyBall && dpt === 'high') { const f0 = fl; fl = { ...f0, h: (...a) => f0.h(...a) * 1.7 + 0.5, mps: f0.mps * 0.78, bounce: f0.bounce * 1.25 }; if (Math.random() < 0.35) call.type = 'MOONBALL!'; }
      if (rallyBall && dpt === 'deep') { const f0 = fl; fl = { ...f0, h: (...a) => f0.h(...a) * 0.85, mps: f0.mps * 1.12 }; if (Math.random() < 0.3) { call.prevType = call.type; call.type = 'DEEP DRIVE!'; } }
      // Going for broke on a big point: the shot that ends it is all or nothing.
      if (final && pt.press || final && pt.bp !== null && pt.bp !== undefined) {
        const pr = (prof[hitter].adv || {}).pressure;
        if (pr === 'broke' && rallyBall && shot.kind !== 'net' && shot.kind !== 'out') call.type = 'GOES FOR BROKE!';
      }
      // Recover towards the middle at your preferred depth (less so when pulled far out).
      const home = homeDepth(hitter);
      const hGoal = rushIn ? { x: h0.x * 0.3, y: dir(hitter) * 6.2 }
        : shot.kind === 'approach' ? { x: h0.x * 0.5, y: dir(hitter) * 5.5 }
        : (shot.kind === 'volleyx' || shot.kind === 'volley') ? { x: h0.x * 0.7, y: h0.y }
        : isServe ? { x: h0.x * 0.4, y: dir(hitter) * (BASE + 0.8) }
        // Recover towards the middle at your preferred depth; from far out wide or deep you only get part of the way back.
        : (() => {
          // Energy: hustlers get all the way back to the middle; conservers drift and stay near where they hit.
          const en = (prof[hitter].adv || {}).energy, back = en === 'hustle' ? 0.05 : en === 'conserve' ? 0.65 : Math.abs(h0.x) > DOUBLES ? 0.55 : 0.3;
          return { x: h0.x * back, y: dir(hitter) * lerp(Math.abs(h0.y), home, en === 'hustle' ? 0.9 : en === 'conserve' ? 0.25 : Math.abs(h0.y) > BASE + 3 ? 0.4 : 0.6) };
        })();

      // Into the net (including a drop shot that doesn't clear it).
      if (shot.kind === 'net') {
        const at = { x: lerp(from.x, rand(-3, 3), 0.8), y: dir(hitter) * 0.15 };
        const base = flightMs(dist(from, at), 0, fl.mps) / 0.7;
        segs.push({ t: 'netball', hitter, call, from: { ...from }, fromH, at, h0, hGoal, base, real: base });
        cur[hitter] = hGoal;
        break;
      }
      // Net cord that ends the point: trickles over, or drops back.
      if (shot.kind === 'cordOver' || shot.kind === 'cordBack') {
        const at = { x: lerp(from.x, rand(-3, 3), 0.7), y: 0 };
        const spot = shot.kind === 'cordOver' ? { x: at.x + rand(-0.4, 0.4), y: -dir(hitter) * rand(0.5, 1.3) } : { x: at.x, y: dir(hitter) * rand(0.4, 0.9) };
        const rGoal = { x: lerp(r0.x, spot.x, 0.6), y: lerp(r0.y, spot.y, 0.55) };
        const base = flightMs(dist(from, at), dist(at, spot) * 2, fl.mps) * 1.3;
        segs.push({ t: 'cord', hitter, recv, call, from: { ...from }, fromH, at, spot, r0, rGoal, h0, hGoal, base, real: base });
        highlight = highlight || (shot.kind === 'cordOver' ? 'zoom' : null);
        cur[hitter] = hGoal; cur[recv] = rGoal;
        break;
      }

      let bounce = landing(shot, from, deuce, r0);
      // Lob over a player at the net: they smash it out of the air, or turn and chase it.
      chasingLob[recv] = false;
      if (shot.lob && next && atNet(recv)) {
        // A deep lob gets chased; only a lob that falls short gets smashed out of the air.
        if (Math.abs(bounce.y) < 9 || Math.random() < 0.35) { next.smash = true; if (Math.abs(bounce.y) > 8.5) bounce.y = Math.sign(bounce.y) * rand(6.5, 8.5); }
        else chasingLob[recv] = true;
      }
      // A short lob to a player at the back: they move in and smash it after the bounce.
      if (shot.lob && next && !next.smash && !atNet(recv) && Math.abs(bounce.y) < 9 && Math.random() < 0.75) next.bounceSmash = true;
      const inAir = !!next && (next.kind === 'volley' || next.kind === 'volleyx' || !!next.volleyErr || !!next.smash);
      const prevShot = rally.shots[k - 1], firstVolley = inAir && !!prevShot && prevShot.by === recv && (prevShot.kind === 'serve' || prevShot.kind === 'approach');
      const goodDrop = final && (shot.kind === 'drop' || shot.kind === 'underarm');
      const serveMps = (faults ? pt.kmh2 : pt.kmh1) / 3.6 * 0.75;
      // Put-aways are struck harder than rally balls.
      const power = 0.88 + (prof[hitter].ground ?? 50) / 400; // a 50-rated hitter ≈ 1.0, a 90 ≈ 1.1
      let v = (isServe ? serveMps : fl.mps * power * (final && (shot.kind === 'winner' || shot.kind === 'volley') ? 1.2 : 1)) * surf().pace;
      // Where the receiver would like to meet it. Returns are taken back at the returner's depth.
      const desiredFor = b => next && next.smash ? { x: b.x * 0.9, y: lerp(r0.y, b.y, 0.5) }
        : next && next.bounceSmash ? { x: b.x * 1.05, y: dir(recv) * (Math.abs(b.y) + rand(0.3, 1)) } // step in and take it high off the bounce
        : isServe && !inAirNext(next) ? { x: clamp(b.x * 1.4, -DOUBLES - 1.5, DOUBLES + 1.5), y: dir(recv) * (returnDepth(recv) - 0.2 + (kick ? 0.9 : 0) + rand(-0.3, 0.4)) }
        : contactPoint(b, recv, shot, next, shot.popped ? 'popped' : call.flight);
      // Seen from above, the ball travels in a straight line, before and after the bounce. The receiver
      // meets it on that line: as close to where they'd like as they can reach in time.
      // sMax: how far past the bounce they can still take it (a winner has to be got to quickly).
      const meet = (b, sMax = 11) => {
        const L = Math.max(0.1, dist(from, b)), hx = (b.x - from.x) / L, hy = (b.y - from.y) / L;
        const want = desiredFor(b);
        const wing = next && next.forceWing ? (next.forceWing === 'fh' ? 'Forehand' : 'Backhand') : chooseWing(recv, r0.x, want.x);
        const base = inAir ? from : b;
        const sWant = (want.x - base.x) * hx + (want.y - base.y) * hy;
        let best = null;
        const [s0, s1] = inAir ? [Math.max(1, L * 0.35), L - 0.2] : [goodDrop ? 0.3 : final || (next && next.bounceSmash) ? 0.5 : Math.min(Math.max(2.0, 0.14 * v * surf().keep), sMax), sMax] /* rally balls: at least ~0.14 s off the bounce */;
        for (let sv = s0; sv <= s1; sv += 0.25) {
          const pnt = { x: base.x + hx * sv, y: base.y + hy * sv };
          if (Math.sign(pnt.y) !== dir(recv) || Math.abs(pnt.y) > BASE + 6.5 || Math.abs(pnt.x) > DOUBLES + 2.8) continue;
          // Volleys are hit around the net, never from the back of the court. A serve-and-volleyer's first volley
          // comes in around the service line, as they charge in behind the serve.
          if (inAir && !(next && next.smash) && Math.abs(pnt.y) > (firstVolley ? 8.6 : 6.5)) continue;
          const ms = inAir ? clamp(sv / v * 1000, 150, 3800) : flightMs(L, sv, v);
          const body = bodyFor(recv, wing, pnt);
          const need = dist(r0, body), can = runDist(ms / 1000);
          const ok = need <= can + 0.05;
          const score = ok ? Math.abs(sv - sWant) : 100 + need - can;
          if (!best || score < best.score) best = { score, ok, contact: pnt, body, wing, ms, need, can, L };
        }
        return best || { ok: false, contact: want, body: bodyFor(recv, wing, want), wing, ms: flightMs(L, 2, v), need: 9, can: 0, L };
      };
      let met = meet(bounce);
      // A ball that comes back must be reachable: if not, it was placed a little closer to them.
      if (!final) for (let it = 0; it < (inAir ? 8 : 4) && !met.ok; it++) {
        const b2 = landing(shot, from, deuce, r0);
        b2.x = lerp(b2.x, r0.x, Math.min(0.9, (inAir ? 0.15 : 0.25) * (it + 1)));
        const m2 = meet(b2);
        if (m2.ok || m2.need - m2.can < met.need - met.can) { bounce = b2; met = m2; }
      }
      // A ball the net player volleys has to reach them: if it still can't, it was a softer, dipping ball
      // (so the volley is played where they are, never with the ball turning back short of them).
      if (!final && inAir && !met.ok) {
        const v0 = v;
        for (const f of [0.85, 0.72, 0.6, 0.5]) { v = v0 * f; const m2 = meet(bounce); if (m2.ok || m2.need - m2.can < met.need - met.can) met = m2; if (met.ok) break; }
        if (!met.ok) { v = v0 * 0.5; const near = { x: lerp(bounce.x, r0.x, 0.8), y: bounce.y }; const m2 = meet(near); if (m2.ok || m2.need - m2.can < met.need - met.can) { bounce = near; met = m2; } }
      }
      // A winner has to beat them: if they could get to it, it was hit further from them.
      const isWinner = final && ['winner', 'volley', 'drop', 'underarm', 'ace'].includes(shot.kind) || (final && shot.post);
      const WIN_WINDOW = 1.5;
      if (isWinner) met = meet(bounce, WIN_WINDOW);
      if (isWinner) for (let it = 0; it < 8 && (met.ok || met.need - met.can < 1.2); it++) {
        const b2 = landing(shot, from, deuce, r0);
        if (shot.kind === 'winner' || shot.kind === 'volley') b2.x = -Math.sign(r0.x || 1) * rand(3.3, 4.05);
        const m2 = meet(b2, WIN_WINDOW);
        if (!m2.ok || m2.need - m2.can > met.need - met.can) { bounce = b2; met = m2; }
      }
      // Line review on this point: the ball lands right by the line (just out, or clipping it).
      let reviewInfo = null;
      if (pt.review && final && !inAir && (shot.kind === 'out' || shot.kind === 'winner' || shot.kind === 'volley')) {
        const out = shot.kind === 'out';
        const sgn = v => (v < 0 ? -1 : 1);
        const sideline = out ? Math.abs(bounce.x) > SINGLES : Math.abs(bounce.x) > SINGLES - 0.8;
        if (sideline) {
          const line = sgn(bounce.x) * SINGLES;
          bounce.x = line + sgn(bounce.x) * (out ? rand(0.07, 0.13) : rand(-0.02, 0.025));
          bounce.y = clamp(bounce.y, -BASE + 0.5, BASE - 0.5);
          reviewInfo = { axis: 'x', line, coord: bounce.x, along: rand(-0.08, 0.08), out, pt: { x: bounce.x, y: bounce.y } };
        } else {
          const line = sgn(bounce.y) * BASE;
          bounce.y = line + sgn(bounce.y) * (out ? rand(0.07, 0.13) : rand(-0.02, 0.025));
          bounce.x = clamp(bounce.x, -SINGLES + 0.3, SINGLES - 0.3);
          reviewInfo = { axis: 'y', line, coord: bounce.y, along: rand(-0.08, 0.08), out, pt: { x: bounce.x, y: bounce.y } };
        }
      }
      // Still can't get there? Give the ball just enough extra time (at most 35% more) so they arrive
      // rather than appear: no player ever jumps to a ball.
      // The ball keeps the speed it was hit at. A stretched player lunges and reaches with the racket (up to
      // about a metre further than the body gets); only a big miss gets a little extra time (at most 10%).
      let lunge = 1;
      if (!final && !met.ok) {
        if (met.need - met.can <= 1.0) { lunge = Math.max(0.6, met.can / met.need); met.ok = true; }
        else { const needMs = runTime(dist(r0, met.body) - 1.0) * 1000; if (needMs <= met.ms * 1.1) { met.ms = needMs; met.ok = true; lunge = Math.max(0.6, (met.need - 1) / met.need); } }
      }
      let contact = met.contact, body = met.body;
      wingNext[recv] = met.wing;
      let tb = inAir ? 1 : fl.split;
      const to0 = inAir ? contact : bounce;
      const endH = next && next.smash ? 2.7 : inAir ? 1.2 : 0;
      const cross = Math.sign(from.y) !== Math.sign(to0.y) ? Math.abs(from.y) / (Math.abs(from.y) + Math.abs(to0.y)) : null;
      // Drop shots peak on the hitter's side and are already falling as they cross the net.
      const softShot = shot.kind === 'drop' || shot.kind === 'underarm';
      // Soft shots slow down in flight (see play), so they reach the net later in the flight than a straight line would.
      const crossU = softShot && cross !== null ? 1 - (1 - cross) ** (1 / SOFT) : cross;
      const ua = softShot && cross !== null ? clamp(crossU * 0.65, 0.15, 0.8) : fl.apex ?? clamp(cross ?? 0.5, 0.15, 0.9);
      let peak = isServe ? fromH + (kick ? 0.15 : 0.03) : fl.h() * (((shotStyle(hitter).h || {})[call.flight]) || 1); // style shapes ball height
      // Every ball clears the net, except shots going around the post.
      if (cross !== null && !shot.post) while (arc(crossU, fromH, ua, peak, endH) < NET_H + 0.12 && peak < 9) peak += 0.1;
      // After the bounce it carries straight on along the same line.
      const L = dist(from, bounce), ux = (bounce.x - from.x) / (L || 1), uy = (bounce.y - from.y) / (L || 1);
      const postTo = !final ? contact
        // Heavy backspin: the drop bites, checks up and kicks a few inches sideways.
        : shot.spinAway ? { x: bounce.x + Math.sign(bounce.x || 1) * rand(0.08, 0.2), y: bounce.y - uy * 0.06 }
        : { x: bounce.x + ux * (goodDrop ? 0.15 : L * 0.35), y: bounce.y + uy * (goodDrop ? 0.15 : L * 0.35) };
      const preDist = dist(from, to0);
      // Share of the flight before the bounce, from the real distances (ball slows a little after the
      // bounce), so it never crawls the last metre to the racket.
      if (!inAir) { const pre = preDist / v, post = dist(bounce, postTo) / (v * surf().keep); tb = clamp(pre / (pre + post), 0.4, 0.94); }
      const realMs = final ? flightMs(preDist, dist(bounce, postTo), v) : met.ms;
      // On a point-ending shot the receiver runs flat out at the ball's line and gets only as far as they can.
      const need = dist(r0, body), tSec = realMs / 1000;
      const cap = shot.kind === 'ace' ? 0.2 : shot.kind === 'out' ? 0.5 : 0.92;
      // (They only have until the ball passes the spot they're running to.)
      let reach = !final ? lunge : need < 0.01 ? 0 : Math.min(cap, runDist(met.ms / 1000) / need);
      // A clean winner is clearly out of reach: they lunge, but finish well short of the ball.
      if (isWinner && need > 0.01) reach = Math.min(reach, Math.max(0, 1 - 1.7 / need));
      // The hitter recovers only as far as they can before the ball comes back.
      const hD = dist(h0, hGoal);
      // Energy: hustlers sprint back into position after every shot; conservers walk.
      const pace = { hustle: 1.35, conserve: 0.72 }[(prof[hitter].adv || {}).energy] || 1;
      if (hD > 0.01) { const k = Math.min(1, (shot.kind === 'approach' || rushIn ? runDist(tSec) : recoverDist(tSec) * pace) / hD); hGoal.x = lerp(h0.x, hGoal.x, k); hGoal.y = lerp(h0.y, hGoal.y, k); }
      // Highlights for GATAH VISION: big moments get a zoom, aces get a shake.
      let fx = null;
      if (final) {
        if (shot.kind === 'ace') fx = 'shake';
        else if (goodDrop || shot.post || (shot.lob && shot.kind !== 'out') || call.type === 'TWEENER!'
          || (pt.how === 'winner' && rally.length >= 8)) fx = 'zoom';
        highlight = fx;
      }
      // Only call it a deep drive if it really lands deep (near the baseline).
      if (call.type === 'DEEP DRIVE!' && (inAir || !bounce || Math.abs(bounce.y) < 9)) call.type = call.prevType || 'FLAT!';
      segs.push({
        t: 'shot', hitter, recv, call, final, kind: shot.kind, rush: rushIn, cordTick: !!shot.cordTick,
        // What the receiver is getting ready to hit (drives their wind-up during this flight).
        nextWing: final ? null : wingNext[recv], nextKind: final ? null : next.smash || next.bounceSmash ? 'smash' : next.dropNet ? 'drop' : next.kind,
        from: { ...from }, fromH, to0, bounce: inAir ? null : bounce, postTo, ua, peak, endH, tb,
        bounceH: fl.bounce * surf().bounce * (call.flight === 'slice' ? surf().sliceLow : 1) * (call.flight === 'topspin' || call.flight === 'flat' ? shotStyle(hitter).kick || 1 : 1), slide: slideFor(r0, body, reach, final), goodDrop, softShot, r0, body, reach, beaten: final && !met.ok, metOk: met.ok, metNeed: met.need, metCan: met.can, metMs: met.ms, review: reviewInfo, h0, hGoal, base: realMs, realMs, fx, final, passWin: !!shot.passWin, lowBounce: ['slice', 'drop'].includes(call.flight) || shot.kind === 'drop',
      });
      // Where everyone ends up after this shot.
      cur[recv] = { x: lerp(r0.x, body.x, reach), y: lerp(r0.y, body.y, reach) };
      cur[hitter] = { ...hGoal };
      defensive[recv] = Math.abs(contact.y) > BASE + 2.5 || Math.abs(contact.x) > DOUBLES + 0.3;
      if (final) break;
      from = { ...contact };
      fromH = endH || (next && next.bounceSmash ? 2.4 : 1);
    }
    // Each shot knows what the next one will be, so the wind-up matches it (slices and drops are one-handed).
    const shotSegs = segs.filter(x => x.t === 'shot');
    shotSegs.forEach((x, i) => { if (shotSegs[i + 1]) x.nextFlight = shotSegs[i + 1].call.flight; });
    segs.push({ t: 'pause', base: 300, real: 900 });
    return { rally, segs, start, highlight };
  }

  // --- Playing a script --------------------------------------------------------------------

  function say(side, call, life) {
    labels[side] = { side, ...call, t0: clock(), life };
  }

  // Cinematic zoom on a big moment. Each frame the camera frames everything that matters (ball, both
  // players and the hitter's callout, landing spot) and zooms only as far as all of it still fits.
  let focusMax = 1;
  function focus(zMax) { focusMax = zMax; }
  function followFocus(s) {
    const pts = [P(ball.x, ball.y, ball.h), P(s.to0 ? (s.bounce || s.to0).x : s.at.x, s.to0 ? (s.bounce || s.to0).y : s.at.y)];
    for (const side of [s.hitter, s.recv]) {
      const p = pos[side];
      pts.push(P(p.x, p.y, 0));
      const [hx, hy] = P(p.x, p.y, 1.9);
      pts.push([hx, hy - 45]); // room for the name and callout above the head
    }
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const x0 = Math.min(...xs) - 50, x1 = Math.max(...xs) + 50, y0 = Math.min(...ys) - 30, y1 = Math.max(...ys) + 30;
    const zT = clamp(Math.min(focusMax, W / (x1 - x0), H / (y1 - y0)), camBase, focusMax);
    const half = [W / (2 * cam.zoom), H / (2 * cam.zoom)];
    const cxT = clamp((x0 + x1) / 2, half[0], W - half[0]), cyT = clamp((y0 + y1) / 2, half[1], H - half[1]);
    cam.zoom += (zT - cam.zoom) * 0.08;
    cam.cx += (cxT - cam.cx) * 0.12;
    cam.cy += (cyT - cam.cy) * 0.12;
  }
  async function unfocus() {
    const z0 = cam.zoom, x0 = cam.cx, y0 = cam.cy;
    await tween(420, t => { const e = ease(t); cam.zoom = lerp(z0, camBase, e); cam.cx = lerp(x0, W / 2, e); cam.cy = lerp(y0, H / 2, e); });
    focusMax = 1;
  }

  // Plays a planned point. o: { speed (normal views), real (true pace), slow (replay slow-mo), cinematic }.
  async function play(script, o) {
    pos = script.start.map(p => ({ ...p }));
    ball.on = false; trail = []; marks = []; labels = [null, null];
    // Clay slide marks last just the point they're made in (replays redraw theirs).
    slides = [];
    for (const sg of script.segs) if (sg.slide) sg.slide.shown = false;
    cam.zoom = camBase; cam.shake = 0; cam.cx = W / 2; cam.cy = H / 2;
    // A returner standing deep: ease the camera back during the walk to the line.
    const walk0 = script.segs[0] && script.segs[0].t === 'walk' ? script.segs[0] : null;
    const zoomTo = !isFps() && walk0 && walk0.to.some(p => Math.abs(p.y) > BASE + 3.1) ? 0.92 : 1;
    const slow = o.slow || 1;
    const T = s => (o.real ? (s.real ?? s.base) : s.base / o.speed) * slow;
    const lifeMs = o.real ? 1300 * slow : Math.max(500, 1000 / o.speed);
    // After the point ends, the ball keeps going: real gravity, smaller and smaller bounces, then it rolls
    // to a stop (or off the boards). v: metres per second (vz up).
    const settle = (vx, vy, vz, physMs = 1300) => {
      let last = 0, x = ball.x, y = ball.y, h = ball.h;
      const lx = ARENA_X - 0.15, ly = ARENA_Y - 0.15;
      return tween(physMs * (o.real ? 1 : 1 / o.speed) * slow, t => {
        const dt = (t - last) * physMs / 1000 / 4; last = t;
        for (let n = 0; n < 4; n++) {
          if (h > 0 || vz > 0) { vz -= 9.8 * dt; h += vz * dt; }
          x += vx * dt; y += vy * dt;
          if (h < 0) { h = 0; vz = -vz * 0.55; vx *= 0.8; vy *= 0.8; if (vz < 0.5) vz = 0; }
          if (h === 0 && vz === 0) { const f = Math.max(0, 1 - 1.8 * dt); vx *= f; vy *= f; }
          if (Math.abs(x) > lx) { x = Math.sign(x) * lx; vx *= -0.3; }
          if (Math.abs(y) > ly) { y = Math.sign(y) * ly; vy *= -0.3; }
        }
        setBall({ x, y }, h);
      });
    };
    // Movement runs on the ball's real clock (t = share of the flight), at real running speeds.
    const moveRecv = (s, t, goal, reach = 1) => {
      const end = { x: lerp(s.r0.x, goal.x, reach), y: lerp(s.r0.y, goal.y, reach) }, D = dist(s.r0, end);
      const k = D < 0.01 ? 1 : Math.min(1, runDist(t * (s.real ?? s.realMs) / 1000) / D);
      pos[s.recv] = { x: lerp(s.r0.x, end.x, k), y: lerp(s.r0.y, end.y, k) };
      // The slide mark grows under their feet over the last stretch of the run.
      if (s.slide) {
        if (!s.slide.shown) { s.slide.shown = true; s.slide.f = 0; slides.push(s.slide); }
        s.slide.f = clamp((k * s.slide.D - (s.slide.D - s.slide.len)) / s.slide.len, 0, 1);
      }
    };
    const moveHitter = (s, t) => {
      const D = dist(s.h0, s.hGoal), mv = s.kind === 'approach' || s.rush ? runDist : recoverDist;
      const k = D < 0.01 ? 1 : Math.min(1, mv(t * (s.real ?? s.realMs ?? s.base) / 1000) / D);
      pos[s.hitter] = { x: lerp(s.h0.x, s.hGoal.x, k), y: lerp(s.h0.y, s.hGoal.y, k) };
    };

    // Ball toss before a serve: rises from the hand to about 3 m, racket in the trophy position,
    // and is struck just after the peak.
    const toss = async (side, from) => {
      labels[side] = { side, type: null, wing: null, racket: 'trophy', sw: 0, t0: clock(), life: 1e9 };
      ball.on = true; trail = [];
      const p = pos[side], hand = { x: p.x - fhDir(side) * 0.25, y: p.y - dir(side) * 0.1 };
      // Real physics: released at 1.6 m, rises under gravity to about 3.3 m, falls back to contact at 2.6 m,
      // drifting steadily over the hitting point the whole way.
      const G = 9.8, h0 = 1.6, top = 3.3, hit = 2.6;
      const v0 = Math.sqrt(2 * G * (top - h0)), up = v0 / G, total = up + Math.sqrt(2 * (top - hit) / G);
      await tween(total * 1000 / (o.real ? 1 : o.speed) * slow, t => {
        const ts = t * total;
        ball.x = lerp(hand.x, from.x, t); ball.y = lerp(hand.y, from.y, t);
        ball.h = h0 + v0 * ts - 0.5 * G * ts * ts;
        labels[side].sw = clamp((ts - up * 0.7) / (total - up * 0.7), 0, 1);
      });
    };
    const isServeCall = c => c && c.racket === 'serve' && c.flight === 'serve';
    // Underarm serve: the ball is dropped from waist height while the racket swings up from below.
    const underDrop = async (side, from) => {
      labels[side] = { side, type: null, wing: null, racket: 'underarmPrep', sw: 0, t0: clock(), life: 1e9 };
      ball.on = true; trail = [];
      await tween((o.real ? 500 : Math.max(250, 420 / o.speed)) * slow, t => {
        ball.x = from.x; ball.y = from.y;
        ball.h = lerp(1.0, 0.55, t * t);
        labels[side].sw = t;
      });
    };

    for (const s of script.segs) {
      if (s.t === 'walk') {
        const p0 = pos.map(p => ({ ...p })), z0 = cam.zoom;
        await tween(Math.max(T(s), zoomTo !== z0 ? 450 : 0), t => {
          const e = ease(t); pos = p0.map((p, i) => ({ x: lerp(p.x, s.to[i].x, e), y: lerp(p.y, s.to[i].y, e) }));
          if (s === walk0) cam.zoom = lerp(z0, zoomTo, e);
        });
        if (s === walk0) camBase = zoomTo;
      } else if (s.t === 'pause') {
        await wait(T(s));
      } else if (s.t === 'fault' || s.t === 'let') {
        await toss(s.side, s.from);
        say(s.side, s.call, lifeMs);
        ball.on = true;
        let marked = false;
        await tween((o.real ? 700 : 620 / o.speed) * slow, t => {
          if (s.t === 'let') {
            // Clips the tape, then drops into the service box.
            const mx = lerp(s.from.x, s.spot.x, 0.6);
            if (t < 0.55) { const u = t / 0.55; setBall({ x: lerp(s.from.x, mx, u), y: lerp(s.from.y, 0, u) }, lerp(2.6, NET_H, u)); }
            else { const u = (t - 0.55) / 0.45; setBall({ x: lerp(mx, s.spot.x, u), y: lerp(0, s.spot.y, u) }, NET_H * (1 - u) + Math.sin(Math.PI * u) * 0.4); }
            return;
          }
          if (t < 0.7) setBall({ x: lerp(s.from.x, s.spot.x, t / 0.7), y: lerp(s.from.y, s.spot.y, t / 0.7) }, lerp(2.6, 0, t / 0.7) + Math.sin(Math.PI * t / 0.7) * 0.5);
          else {
            if (!marked) { marks.push({ ...s.spot, out: true }); marked = true; }
            const u = (t - 0.7) / 0.3;
            setBall({ x: s.spot.x, y: s.spot.y - dir(s.side) * 2 * u }, Math.sin(Math.PI * u) * 0.6);
          }
        });
        if (s.t === 'let') say(s.side, { type: 'LET', wing: null, racket: null }, lifeMs);
        if (s.df) banner = { text: 'DOUBLE FAULT!', t0: clock(), big: true }; // the second serve missed too
        await wait((o.real ? 900 : 450 / o.speed) * slow * (s.df ? 1.6 : 1));
        ball.on = false; trail = [];
      } else if (s.t === 'netball') {
        s.h0 = { ...pos[s.hitter] };
        say(s.hitter, s.call, lifeMs);
        ball.on = true;
        await tween(T(s) * 0.7, t => {
          setBall({ x: lerp(s.from.x, s.at.x, t), y: lerp(s.from.y, s.at.y, t) }, lerp(s.fromH, 0.7, t) + Math.sin(Math.PI * t) * 0.6);
          moveHitter(s, t);
        });
        const b0 = { x: ball.x, y: ball.y };
        await tween((o.real ? 300 : 260 / o.speed) * slow, t => setBall({ x: b0.x, y: b0.y + dir(s.hitter) * 0.6 * t }, 0.7 * (1 - t)));
      } else if (s.t === 'cord') {
        s.r0 = { ...pos[s.recv] }; s.h0 = { ...pos[s.hitter] };
        say(s.hitter, s.call, lifeMs * 1.4);
        ball.on = true;
        const zoomCord = o.cinematic && !isFps();
        if (zoomCord) focus(1.45);
        await tween(T(s), t => {
          if (t < 0.55) { const u = t / 0.55; setBall({ x: lerp(s.from.x, s.at.x, u), y: lerp(s.from.y, 0, u) }, arc(u, s.fromH, 0.4, 2.2, NET_H)); }
          else {
            // Pops up off the tape, then falls over (or back).
            const u = (t - 0.55) / 0.45;
            setBall({ x: lerp(s.at.x, s.spot.x, u), y: lerp(0, s.spot.y, u) }, NET_H + Math.sin(Math.PI * u) * 0.45 - NET_H * u);
          }
          moveRecv(s, t, s.rGoal);
          moveHitter(s, t);
          if (zoomCord) followFocus(s);
        });
        marks.push({ ...s.spot, out: false });
        banner = { text: 'NET CORD!', t0: clock(), big: true };
        {
          // Dribbles on in the direction it was going, with a couple of little hops.
          const dx = s.spot.x - s.at.x, dy = s.spot.y, L = Math.hypot(dx, dy) || 1;
          await settle(dx / L * 1.6, dy / L * 1.6, 1.4, o.cinematic ? 1100 : 600);
        }
        if (zoomCord) await unfocus();
      } else if (s.t === 'shot') {
        // Start from where both players really are, so nobody jumps between shots.
        s.r0 = { ...pos[s.recv] }; s.h0 = { ...pos[s.hitter] };
        if (isServeCall(s.call)) await toss(s.hitter, s.from);
        if (s.kind === 'underarm') await underDrop(s.hitter, s.from);
        say(s.hitter, s.call, lifeMs);
        ball.on = true;
        // Drop shots get a zoom (except in first person). Only a point-ending highlight slows down;
        // everything else plays at real speed.
        const dropMoment = s.kind === 'drop' || s.kind === 'underarm';
        const big = !isFps() && ((o.cinematic && s.fx === 'zoom') || dropMoment);
        const ms = (o.real ? s.realMs : s.realMs / o.speed) * slow;
        if (big) focus(1.5);
        let marked = false, ticked = false;
        await tween(ms, t => {
          if (t <= s.tb) {
            const u = t / s.tb;
            let h = arc(u, s.fromH, s.ua, s.peak, s.endH);
            // Mid-rally net cord: the ball clips the tape and kicks up.
            if (s.cordTick) {
              const cu = Math.abs(s.from.y) / (Math.abs(s.from.y) + Math.abs(s.to0.y));
              if (u > cu) {
                h += Math.sin(Math.PI * clamp((u - cu) / (1 - cu), 0, 1)) * 0.9;
                if (!ticked) { ticked = true; say(s.hitter, { type: 'NET CORD!', wing: null, racket: null }, lifeMs); }
              }
            }
            // Backspin on drop shots: forward speed bleeds off, so it drops steeply after the net.
            const uh = s.softShot ? 1 - (1 - u) ** SOFT : u;
            setBall({ x: lerp(s.from.x, s.to0.x, uh), y: lerp(s.from.y, s.to0.y, uh) }, h);
          } else {
            if (!marked) {
              marks.push({ ...s.bounce, out: !isIn(s.bounce) }); marked = true;
              // Big and loud, every view: aces, drop-shot winners and passing-shot winners.
              const inside = isIn(s.bounce);
              const clean = s.final && inside && (s.beaten || s.passWin || ['winner', 'volley', 'pass', 'smash'].includes(s.kind));
              const pop = s.kind === 'ace' ? 'ACE!' : clean && (s.kind === 'drop' || s.goodDrop) ? 'DROPPER!' : clean && s.kind !== 'serve' && s.kind !== 'underarm' ? 'WINNER!' : null;
              if (pop) banner = { text: pop, t0: clock(), big: true };
              if (o.cinematic && s.fx === 'shake') { cam.shake = 14; cam.shakeT0 = clock(); }
            }
            const u = (t - s.tb) / (1 - s.tb);
            // A good drop: one soft hop, then a smaller one, then it dies.
            const h = s.goodDrop
              ? (u < 0.62 ? Math.sin(Math.PI * u / 0.62) * s.bounceH * 0.7 : Math.sin(Math.PI * (u - 0.62) / 0.38) * s.bounceH * 0.22)
              : Math.sin(Math.PI * u * 0.7) * (s.final || s.lowBounce ? s.bounceH : Math.max(s.bounceH, 1.15)); // rally balls sit up to waist height
            setBall({ x: lerp(s.bounce.x, s.postTo.x, u), y: lerp(s.bounce.y, s.postTo.y, u) }, h);
          }
          moveRecv(s, t, s.body, s.reach);
          moveHitter(s, t);
          // Receiver winds up as the ball comes: racket back on the side they'll hit from (overhead for a smash).
          if (s.nextKind && t > 0.3) {
            const sw = clamp((t - 0.3) / 0.6, 0, 1);
            const cur = labels[s.recv];
            if (!cur || !cur.prep) labels[s.recv] = { side: s.recv, prep: true, type: null, wing: null, t0: clock(), life: 1e9,
              racket: s.nextKind === 'smash' ? 'trophy' : 'prep', wingSide: s.nextWing === 'Forehand' ? 'fh' : 'bh',
              volley: s.nextKind === 'volley' || s.nextKind === 'volleyx',
              touch: s.nextKind === 'drop' || s.nextFlight === 'slice' || s.nextFlight === 'drop' };
            labels[s.recv].sw = sw;
          }
          if (big) followFocus(s);
        });
        // Point over: the ball carries on from where it was (it never freezes mid-air).
        if (s.final && ball.on && s.bounce) {
          const post = Math.max(0.05, (s.realMs || 600) * (1 - s.tb) / 1000);
          // A good drop shot dies where it lands: it barely rolls on.
          const slow = s.goodDrop ? 0.12 : 1;
          const vx = (s.postTo.x - s.bounce.x) / post * slow, vy = (s.postTo.y - s.bounce.y) / post * slow;
          const vz = s.goodDrop ? 0 : s.bounceH * 0.7 * Math.PI * Math.cos(0.7 * Math.PI) / post;
          await settle(vx, vy, vz, big ? 700 : 1100);
        }
        // Hold the moment on a point-ending shot; mid-rally, ease straight back out.
        if (big) { await unfocus(); }
        if (s.review) {
          review = { ...s.review, t: 0 };
          await tween(2800 * slow, t => { review.t = t; });
          review = null;
          draw();
        }
      }
    }
    cam.zoom = camBase; cam.cx = W / 2; cam.cy = H / 2;
    draw();
    return script.rally;
  }

  // Plans and plays a live point. Returns the rally shape with its script attached (for replays).
  async function playPoint(pt, info, speed) {
    breakTime = false;
    const script = plan(pt, info);
    const real = view === 'gatah';
    const rally = await play(script, { speed, real, cinematic: real, slow: real ? liveSlow / (speed || 1) : 1 }); // GATAH VISION: real pace × your speed
    rally.script = script;
    rally.highlight = script.highlight;
    return rally;
  }

  return {
    mount, scene, sceneArgs, draw, playPoint, play, reset, setView, setAngle, setOptions,
    planOnly: (pt, info) => plan(pt, info), // testing: the shot-by-shot script for a point, without playing it
    setSlow(v) { liveSlow = v; },
    set pauseCheck(fn) { pauseCheck = fn; },
    banner(text) { banner = text ? { text, t0: clock() } : null; draw(); },
    setPlan(text) { planText = text || ''; fillInfo(); draw(); },
    setBreak(on) { breakTime = !!on; ball.on = ball.on && !on; if (on) banner = null; draw(); },
    setInfoEl(el) { infoEl = el; fillInfo(); draw(); },
    setWeather(w, rainy = false, cond = {}) {
      wx = w ? { pace: w.pace || 1, bounce: w.bounce || 1 } : { pace: 1, bounce: 1 };
      conditions = { key: cond.key || null, altitude: cond.altitude || 0, speed: cond.speed || null, label: cond.label || '' };
      fillInfo();
      rain = rainy;
      // Keep the drizzle moving between points too (about 30 frames a second).
      if (rain && !rainLoop) { let last = 0; const tick = now => { if (!rain) { rainLoop = null; return; } if (now - last > 33 && cv && cv.offsetParent) { last = now; draw(); } rainLoop = requestAnimationFrame(tick); }; rainLoop = requestAnimationFrame(tick); }
      draw();
    },
    resize() { resize(); draw(); },
    get view() { return view; },
    set skip(v) { skip = v; },
    get skip() { return skip; },
  };
}

const Court = createCourt();
