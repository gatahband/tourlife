// strokegesture.js — Swipe Shots for Play The Points (admin test). You draw the shot the way your arm swings it. Each
// shot has its own shape on the forehand (the backhand mirrors it), going down the line ("forward") or crosscourt, taken from
// the owner's drawings (SG_SHAPES, for a right-hander; mirrored for a lefty). The stroke is matched to the closest shape
// for the side the ball is on: that sets the shot and, between its forward and cross shapes, the angle; the stroke's
// length sets the distance. Holding still before you swing disguises it. Then the shot is timed with the usual gauge.
// The engine still decides the point: a swipe only chooses which of your dealt shots you play and exactly where it
// lands (see hoGesturePick in playpoints.js).
//
// Three parts: StrokeGestureEngine (pointer input → stroke features → stroke type), SwipeTrail (the trail drawn under
// your finger) and StrokeFlow (the per-shot state machine: dealt → slow motion → draw → time → done).

// Stroke types, how they're labelled, and the flight the court draws for them.
const SG_TYPES = {
  topspin: { label: 'Topspin Drive', flight: 'topspin', color: '#ffd60a' },
  flat: { label: 'Flat Drive', flight: 'flat', color: '#ff7ad9' },
  slice: { label: 'Slice', flight: 'slice', color: '#64d2ff' },
  lob: { label: 'Lob', flight: 'lob', color: '#bf5af2' },
  drop: { label: 'Drop Shot', flight: 'drop', color: '#3dff6e' },
  disguise: { label: 'Disguised Shot', flight: null, color: '#ff9f0a' },
};
// The thresholds, in pad heights (U) and seconds. Tuned on drawn test strokes (tools/stroke-check.js); real hands vary,
// so they're generous and all in one place.
const SG_TUNE = { minLen: 0.04, curve: 0.82, down: -0.45, still: 0.035, dwellMs: 300, fitBad: 0.23, shortLen: 0.25, longLen: 1.1, longOut: 2.8, netLen: 0.12, hook: [1.22, 1.4], bend: [0.45, 0.6, 135], cancelMs: 700, margin: 0.015 };

const sgAng = (x, y) => Math.atan2(x, y) * 180 / Math.PI; // 0 = straight up the screen, + = to the right
const sgWrap = a => ((a + 540) % 360) - 180;

// The shapes are a right-handed forehand in screen points (x right, y down; first point = start, last = stop).
// The backhand is the forehand mirrored, and a lefty mirrors them again.
// One shape per shot (the owner's picks from the key, Nov 2026), as a right-handed forehand. Drawn as shown it goes
// straight ahead; turned, it angles off (see SG_TURN). The cross shape is the same shape turned, for the guides and drills.
const SG_TURN = -40; // degrees a forehand stroke is turned (anticlockwise) to go crosscourt; mirrored on the backhand
const sgTurn = (P, deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r), cx = P.reduce((a, p) => a + p[0], 0) / P.length, cy = P.reduce((a, p) => a + p[1], 0) / P.length;
  return P.map(([x, y]) => [Math.round(cx + (x - cx) * c - (y - cy) * sn), Math.round(cy + (x - cx) * sn + (y - cy) * c)]); };
const SG_ONE = {
  flat: [[465, 330], [465, 290], [465, 250], [380, 250], [280, 250], [160, 250]], // a "1" on its side: a short stem up into a right angle, then straight across
  topspin: [[205, 338], [240, 355], [295, 342], [340, 295], [357, 225], [340, 150], [300, 105], [250, 90], [205, 100]], // a "C": under, up and round over the top
  slice: [[232, 212], [220, 185], [224, 155], [240, 136], [262, 136], [280, 152], [340, 245], [385, 315], [428, 390]], // a hook over the top, then a steep cut down
  lob: [[258, 295], [285, 330], [312, 365], [308, 290], [303, 200], [298, 100]], // a dip, then straight up
  drop: [[450, 545], [478, 550], [485, 572], [460, 598], [468, 625], [455, 660], [415, 685], [360, 690], [310, 668], [282, 645]], // a little "3" (or a "w"), then scoop round and up
};
const SG_FH = Object.fromEntries(Object.entries(SG_ONE).map(([t, P]) => [t, { fwd: P, cross: sgTurn(P, SG_TURN) }]));
const sgMirror = S => Object.fromEntries(Object.entries(S).map(([t, v]) => [t, Object.fromEntries(Object.entries(v).map(([d, P]) => [d, P.map(([x, y]) => [1000 - x, y])]))]));
const SG_SHAPES = { fh: SG_FH, bh: sgMirror(SG_FH) };
// A path resampled to n evenly spaced points, centred and scaled to fit a unit box (keeping its shape), so a big and a
// small drawing of the same swing match.
function sgNorm(pts, n = 32) {
  const P = pts.map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : p);
  let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y);
  const out = [{ x: P[0].x, y: P[0].y }], step = L / (n - 1);
  let acc = 0, prev = P[0];
  for (let i = 1; i < P.length && out.length < n; i++) {
    let cur = P[i], d = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    while (acc + d >= step && d > 0 && out.length < n) {
      const f = (step - acc) / d, q = { x: prev.x + (cur.x - prev.x) * f, y: prev.y + (cur.y - prev.y) * f };
      out.push(q); prev = q; d = Math.hypot(cur.x - prev.x, cur.y - prev.y); acc = 0;
    }
    acc += d; prev = cur;
  }
  while (out.length < n) out.push({ ...P[P.length - 1] });
  const xs = out.map(p => p.x), ys = out.map(p => p.y), S = Math.max(1e-6, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return out.map(p => ({ x: (p.x - cx) / S, y: (p.y - cy) / S }));
}
const sgDist = (A, B) => A.reduce((s, p, i) => s + Math.hypot(p.x - B[i].x, p.y - B[i].y), 0) / A.length;
const SG_NORM = {}; // per wing.shot.direction: the shapes to match, normalised (your own drawings, or the sheet's)
// The heading the end of a path is going (0 = up the screen, 90 = right; clockwise is +).
const sgHead = N => { const a = N[Math.floor(N.length * 0.6)], z = N[N.length - 1]; return Math.atan2(z.x - a.x, a.y - z.y) * 180 / Math.PI; };
// How round the wind-up is: the path from the start to the corner (the point furthest from the start–end line),
// over the straight distance between them. A flat's straight flag ≈ 1; a slice's hook well over. Smoothed first, so
// a shaky hand doesn't make a straight flag look curly.
function sgWindup(N) {
  const S = N.map((p, i) => { let x = 0, y = 0, n = 0; for (let j = Math.max(0, i - 2); j <= Math.min(N.length - 1, i + 2); j++) { x += N[j].x; y += N[j].y; n++; } return { x: x / n, y: y / n }; });
  const a = S[0], z = S[S.length - 1], dx = z.x - a.x, dy = z.y - a.y, L = Math.hypot(dx, dy) || 1;
  let k = 0, far = -1;
  for (let i = 0; i < S.length * 0.7; i++) { const d = Math.abs((S[i].x - a.x) * dy - (S[i].y - a.y) * dx) / L; if (d > far) { far = d; k = i; } }
  let wl = 0; for (let i = 1; i <= k; i++) wl += Math.hypot(S[i].x - S[i - 1].x, S[i].y - S[i - 1].y);
  return wl / Math.max(0.02, Math.hypot(S[k].x - a.x, S[k].y - a.y));
}
// How the stroke turns: total turning (degrees) and the most of it inside any short stretch (a sixth of the stroke).
// A flat is one sharp corner between straight lines (nearly all its turning in one place); a topspin curves smoothly
// all the way round (its turning spread out). Smoothed first, so a shaky hand isn't a corner.
function sgBend(N0) {
  const N = sgNorm(N0, 24), S = N.map((p, i) => { let x = 0, y = 0, n = 0; for (let j = Math.max(0, i - 2); j <= Math.min(N.length - 1, i + 2); j++) { x += N[j].x; y += N[j].y; n++; } return { x: x / n, y: y / n }; });
  // Signed turning, so a wobble one way and back cancels out.
  const d = []; for (let i = 2; i < S.length; i++) d.push(sgWrap(sgAng(S[i].x - S[i - 1].x, S[i - 1].y - S[i].y) - sgAng(S[i - 1].x - S[i - 2].x, S[i - 2].y - S[i - 1].y)));
  const total = Math.abs(d.reduce((a, b) => a + b, 0)), w = 4;
  let peak = 0; for (let i = 0; i + w <= d.length; i++) peak = Math.max(peak, Math.abs(d.slice(i, i + w).reduce((a, b) => a + b, 0)));
  return { total, peak, share: peak / Math.max(1, total) };
}
const SG_HEAD = {}, SG_FWDH = {}; // per wing.shot: degrees of turn from forward to cross (signed), and forward's heading
// Your own drawings (Set Up My Swipes): a right-handed forehand, two of each shape, kept on this device. When there,
// they're the shapes (the backhand mirrors them), so the shots you draw are read the way you draw them.
const SG_MINE_KEY = 'tourlife.sgMine2'; // (tourlife.sgMine held the old forward-and-cross drawings: left alone)
const sgMine = () => { try { return JSON.parse(localStorage.getItem(SG_MINE_KEY) || 'null'); } catch { return null; } };
const sgMeanAng = A => sgAng(A.reduce((s, a) => s + Math.sin(a * Math.PI / 180), 0), A.reduce((s, a) => s + Math.cos(a * Math.PI / 180), 0));
function sgBuild() {
  const mine = sgMine() || {};
  for (const w of ['fh', 'bh']) for (const t in SG_FH) {
    for (const d in SG_FH[t]) {
      const mf = mine[t] && mine[t].fwd && mine[t].fwd.length ? mine[t].fwd.map(P => d === 'cross' ? sgTurn(P.map(([x, y]) => [x * 1000, y * 1000]), SG_TURN) : P) : null;
      const own = mf ? mf.map(P => w === 'bh' ? P.map(([x, y]) => [-x, y]) : P) : null;
      SG_NORM[`${w}.${t}.${d}`] = (own || [SG_SHAPES[w][t][d]]).map(P => sgNorm(P));
      SG_NORM[`${w}.${t}.${d}`].own = !!own;
    }
    const h = d => sgMeanAng(SG_NORM[`${w}.${t}.${d}`].map(sgHead));
    SG_FWDH[`${w}.${t}`] = h('fwd'); SG_HEAD[`${w}.${t}`] = w === 'bh' ? -SG_TURN : SG_TURN; // every shot turns the same way to go cross
  }
}
sgBuild();

class StrokeGestureEngine {
  // el: the pad element. on: { move(g), commit(g), cancel() } — g is the live reading of the stroke (see read()).
  // ctx: { wing: 'fh' or 'bh' for the ball you're hitting, lefty } — see read(). No wing: a serve, aimed by direction.
  constructor(el, on = {}, ctx = {}) {
    this.el = el; this.on = on; this.ctx = ctx; this.pts = null; this.id = null;
    this.down = e => this.start(e); this.mv = e => this.move(e); this.up = e => this.end(e, false); this.cx = e => this.end(e, true);
  }
  attach() {
    this.el.style.touchAction = 'none'; // the page mustn't scroll while you draw
    this.el.addEventListener('pointerdown', this.down);
    addEventListener('pointermove', this.mv, true); addEventListener('pointerup', this.up, true); addEventListener('pointercancel', this.cx, true);
    return this;
  }
  abort(why) { clearInterval(this.watch); if (!this.pts) return; this.pts = null; if (this.on.cancel) this.on.cancel(why); }
  detach() {
    clearInterval(this.watch);
    this.el.removeEventListener('pointerdown', this.down);
    removeEventListener('pointermove', this.mv, true); removeEventListener('pointerup', this.up, true); removeEventListener('pointercancel', this.cx, true);
    this.pts = null;
  }
  // Points are kept in pad units (U = the pad's height), so a phone and a monitor read the same stroke the same way.
  at(e) {
    const r = this.el.getBoundingClientRect(), U = Math.max(60, r.height);
    return { x: (e.clientX - r.left) / U, y: (e.clientY - r.top) / U, t: e.timeStamp || performance.now(), px: e.clientX - r.left, py: e.clientY - r.top };
  }
  start(e) {
    if (this.pts || (e.button !== undefined && e.button > 0)) return;
    e.preventDefault();
    this.id = e.pointerId; this.pts = [this.at(e)];
    // Holding still at the end of a stroke (before letting go) cancels it, so a bad stroke can be drawn again.
    // (Holding still before you start is the disguise, so this only counts once the stroke has got going.)
    this.anchor = this.pts[0]; this.movedAt = performance.now(); this.going = false;
    clearInterval(this.watch);
    this.watch = setInterval(() => { if (this.pts && this.going && performance.now() - this.movedAt >= SG_TUNE.cancelMs) this.abort('still'); }, 50);
    if (this.on.start) this.on.start(this.pts[0]);
  }
  move(e) {
    if (!this.pts || e.pointerId !== this.id) return;
    // Coalesced events give the full path on fast swipes (browsers batch them per frame).
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of list.length ? list : [e]) this.pts.push(this.at(ev));
    const p = this.pts[this.pts.length - 1];
    if (Math.hypot(p.x - this.anchor.x, p.y - this.anchor.y) > SG_TUNE.still) { this.anchor = p; this.movedAt = performance.now(); this.going = true; }
    if (this.on.move) this.on.move(StrokeGestureEngine.read(this.pts, this.ctx), this.pts);
  }
  end(e, cancelled) {
    if (!this.pts || e.pointerId !== this.id) return;
    this.pts.push(this.at(e)); clearInterval(this.watch);
    const pts = this.pts, g = StrokeGestureEngine.read(pts, this.ctx);
    this.pts = null;
    if (cancelled || !g) { if (this.on.cancel) this.on.cancel(); return; }
    if (this.on.commit) this.on.commit(g, pts);
  }

  // The stroke's features and its type. pts: [{ x, y (down the screen), t (ms) }] in pad units. ctx.side: the side of the
  // screen the ball is on, so the same swing reads the same on the forehand and the backhand (mirrored).
  static read(pts, ctx = {}) {
    if (!pts || pts.length < 2) return null;
    const T = SG_TUNE;
    // Holding still before the swing (a late decision) disguises it; the rest is read as the stroke.
    let k0 = 0;
    while (k0 < pts.length - 1 && Math.hypot(pts[k0 + 1].x - pts[0].x, pts[k0 + 1].y - pts[0].y) < T.still) k0++;
    const disguised = pts[k0].t - pts[0].t >= T.dwellMs, P = disguised ? pts.slice(k0) : pts;
    if (P.length < 2) return null;
    const a = P[0], z = P[P.length - 1];
    let len = 0, top = Infinity, bot = -Infinity;
    for (let i = 1; i < P.length; i++) len += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y);
    for (const p of P) { top = Math.min(top, p.y); bot = Math.max(bot, p.y); }
    if (len < T.minLen) return null; // a tap, not a stroke
    const dx = z.x - a.x, dy = a.y - z.y, chord = Math.hypot(dx, dy), dur = Math.max(0.016, (z.t - a.t) / 1000), tall = bot - top;
    // Peak speed over ~60 ms windows: a flick is quick even if the finger lingers at the end.
    let peak = 0;
    for (let i = 0, j = 0; i < P.length; i++) {
      while (j < i && P[i].t - P[j].t > 60) j++;
      const dt = (P[i].t - P[j].t) / 1000;
      if (dt > 0.02) peak = Math.max(peak, Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y) / dt);
    }
    const speed = Math.max(len / dur, peak * 0.8);
    const along = f => { let d = 0; for (let i = 1; i < P.length; i++) { d += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y); if (d >= f * len) return P[i]; } return z; };
    const p35 = along(0.35), p65 = along(0.65);
    const head0 = sgAng(p35.x - a.x, a.y - p35.y), head1 = sgAng(z.x - p65.x, p65.y - z.y);
    const straight = chord / len, lift = dy / len;
    const g = { len, dur, speed, dx, dy, lift, straight, tall, turn: sgWrap(head1 - head0), head0, head1, n: P.length };
    if (ctx.wing) {
      const m = StrokeGestureEngine.match(P, ctx);
      Object.assign(g, { base: m.type, cross: m.cross, fit: m.dist, unclear: m.unclear, awkward: false });
    } else g.base = straight < T.curve ? 'topspin' : lift < T.down ? 'slice' : 'flat'; // a serve: aimed by direction
    g.type = disguised ? 'disguise' : g.base;
    if (g.cross === undefined) g.cross = 0.5;
    // Where it goes on screen (serves are aimed by direction: −1 = far left, +1 = far right). Groundstrokes are turned
    // into a side by the game, from where you hit it (hoSwipeAim in playpoints.js).
    const side = Math.sin(head1 * Math.PI / 180);
    g.aim = Math.max(-1, Math.min(1, side * 1.3));
    g.wide = ctx.wing ? g.cross >= 0.85 : Math.abs(side) >= 0.86;
    // Distance: the longer the trail, the deeper the ball (in pad heights).
    g.depth = Math.max(0, Math.min(1, (len - T.shortLen) / (T.longLen - T.shortLen)));
    // Too long a stroke is overhit (long), too short a drive is underhit (into the net).
    g.long = len > T.longOut && g.base !== 'drop'; g.short = len < T.netLen && ['flat', 'topspin', 'slice'].includes(g.base);
    return g;
  }
  // The closest of the drawn shapes for this side, allowing for the stroke being turned. The shot is the shape that
  // fits best. The angle (cross: 0 = forward, 1 = the cross shape) is that shape plus how far the stroke is turned
  // beyond it, so turning it further keeps angling the ball further across (and too far goes out).
  static match(pts, ctx) {
    const N = sgNorm(ctx.lefty ? pts.map(p => ({ x: -p.x, y: p.y })) : pts), w = ctx.wing === 'bh' ? 'bh' : 'fh';
    const turned = [];
    for (let a = -60; a <= 60; a += 6) { const r = -a * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r); turned.push([a, sgNorm(N.map(p => ({ x: p.x * c - p.y * sn, y: p.x * sn + p.y * c })), N.length)]); } // re-fitted to the box once turned
    // Each shape counts either way round: drawn as on this side's key, or as the other side's (flipped) version of it.
    // The key's own way round is preferred a touch when both fit.
    const by = {};
    for (const ow of [w, w === 'fh' ? 'bh' : 'fh']) for (const t in SG_FH) for (const k in SG_FH[t]) for (const T of SG_NORM[`${ow}.${t}.${k}`]) {
      for (const [a, R] of turned) {
        const dist = sgDist(R, T) + Math.abs(a) * 0.0012 + (ow === w ? 0 : 0.01); // a turned stroke fits a little less well than a straight one
        if (!by[t] || dist < by[t].dist) by[t] = { type: t, dir: k, turn: a, dist, ow };
      }
    }
    const ranked = Object.values(by).sort((a, b) => a.dist - b.dist);
    let best = ranked[0];
    // With the sheet's shapes, flat and slice overlap in angle, so the wind-up tells them apart: a flat is a "1"
    // (a straight flag into a sharp corner), a slice a hook. Your own drawings don't need it.
    const own = SG_NORM[`${w}.flat.fwd`].own && SG_NORM[`${w}.slice.fwd`].own;
    // (Clearly straight or clearly hooked decides it; in between, the closer shape does.)
    if (!own && (best.type === 'flat' || best.type === 'slice') && by.flat && by.slice && Math.abs(by.flat.dist - by.slice.dist) < 0.03) { const wu = sgWindup(N); if (wu < SG_TUNE.hook[0]) best = by.flat; else if (wu > SG_TUNE.hook[1]) best = by.slice; }
    // Flat or topspin is settled by how the stroke bends, never by a near-fit of the wrong shape: a smooth curve
    // isn't a flat, and a sharp corner between straight lines isn't a topspin. If the other one doesn't fit either,
    // it's not clear (draw again) rather than the wrong shot.
    let bendBad = false;
    if (best.type === 'flat' || best.type === 'topspin') {
      const b = sgBend(N), smooth = b.share < SG_TUNE.bend[0] && b.total > 100 || b.total > SG_TUNE.bend[2] /* a flat only turns about 90° */, corner = b.share > SG_TUNE.bend[1] && b.peak > 60;
      const want = best.type === 'flat' && smooth ? 'topspin' : best.type === 'topspin' && corner ? 'flat' : null;
      if (want) { if (by[want] && by[want].dist <= SG_TUNE.fitBad) best = by[want]; else bendBad = true; }
    }
    // Not clearly one shot (too far from every shape, or almost as close to another one): it isn't played; draw again.
    const next = ranked.find(r => r.type !== best.type);
    const fs = r => r.type === 'flat' || r.type === 'slice', split = !own && next && fs(best) && fs(next) && next.dist - best.dist < 0.03; // (settled by the wind-up)
    best.unclear = bendBad || best.dist > SG_TUNE.fitBad || (!!next && !split && next.dist - best.dist < SG_TUNE.margin);
    // The angle: how far the stroke's end is turned from your forward shape's (your cross shape = 1), and on past it.
    const D = SG_HEAD[`${best.ow}.${best.type}`];
    best.cross = Math.abs(D) >= 12 ? sgWrap(sgHead(N) - SG_FWDH[`${best.ow}.${best.type}`]) / D : (best.dir === 'fwd' ? 0 : 1) + best.turn / (30 * Math.sign(D || 1));
    return best;
  }

  // The ball the stroke makes, for the feedback line and the court: speed (km/h), launch angle, spin (rpm, + = topspin),
  // and where it lands (aim −1…1 across, depth 0…1). attr: the stat behind the shot; serve: a serve.
  static physics(g, attr = 60, serve = false, rng = Math.random) {
    const s = Math.max(0, Math.min(1, (g.speed - 0.6) / 3.4)), q = 0.8 + attr / 250;
    const type = g.type === 'disguise' ? g.base : g.type;
    const [lo, hi] = serve ? ({ topspin: [150, 185], slice: [155, 195], flat: [175, 225] }[type] || [150, 200])
      : ({ topspin: [95, 150], flat: [110, 175], slice: [70, 115], lob: [45, 70], drop: [40, 60] }[type] || [90, 140]);
    const cap = serve ? 140 + attr : 100 + attr * 0.9; // your stats cap the pace, however hard you swipe
    const kmh = Math.round(Math.min(cap, (lo + (hi - lo) * s) * q));
    const rpm = Math.round({ topspin: 1500 + 2500 * Math.min(1, Math.max(0, g.lift, (1 - g.straight) * 1.6)) * (0.5 + s / 2), flat: 450 + 600 * (1 - s), slice: -(900 + 1500 * (1 - g.straight + 0.3)),
      lob: 1100 + 800 * s, drop: -2200 }[type] ?? 1000);
    const launch = Math.round({ topspin: 6 + 10 * Math.min(1, Math.max(0, g.lift, 1 - g.straight)), flat: 3 + 3 * Math.abs(g.lift), slice: 4 + 5 * Math.abs(g.lift), lob: 24 + 16 * Math.max(0, g.lift), drop: 12 }[type] ?? 8);
    // Accuracy: lower stats and a shaky line scatter it; a disguise is harder to keep tidy.
    const sd = 0.05 + (1 - attr / 100) * 0.22 + Math.min(0.15, (g.fit || 0) * 0.6); // a swing that's far from its shape scatters more
    const gs = () => { let u = 0; while (!u) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
    return { kmh, rpm, launch, aim: Math.max(-1, Math.min(1, g.aim + gs() * sd)), depth: Math.max(0, Math.min(1, g.depth + gs() * sd * 0.6)) };
  }
}

// The trail under your finger: a tapering, fading line in the stroke type's colour.
class SwipeTrail {
  constructor(host) {
    this.c = document.createElement('canvas'); this.c.className = 'sgtrail'; host.appendChild(this.c);
    this.x = this.c.getContext('2d'); this.pts = []; this.color = '#f5f5f7'; this.fade = 0; this.raf = 0;
  }
  size() {
    const r = this.c.getBoundingClientRect(), k = devicePixelRatio || 1;
    if (this.c.width !== Math.round(r.width * k)) { this.c.width = Math.round(r.width * k); this.c.height = Math.round(r.height * k); }
    this.x.setTransform(k, 0, 0, k, 0, 0);
  }
  set(pts, color) { this.pts = pts.map(p => ({ x: p.px, y: p.py })); if (color) this.color = color; this.fade = 0; this.draw(); }
  done(color) {
    if (color) this.color = color;
    const t0 = performance.now(), step = now => { this.fade = Math.min(1, (now - t0) / 450); this.draw(); if (this.fade < 1) this.raf = requestAnimationFrame(step); };
    this.raf = requestAnimationFrame(step);
  }
  draw() {
    this.size();
    const g = this.x, P = this.pts, r = this.c.getBoundingClientRect();
    g.clearRect(0, 0, r.width, r.height);
    if (P.length < 2) return;
    g.lineCap = 'round'; g.strokeStyle = this.color; g.shadowColor = this.color; g.shadowBlur = 10;
    for (let i = 1; i < P.length; i++) {
      const f = i / (P.length - 1);
      g.globalAlpha = (0.25 + 0.75 * f) * (1 - this.fade);
      g.lineWidth = 3 + 9 * f;
      g.beginPath(); g.moveTo(P[i - 1].x, P[i - 1].y); g.lineTo(P[i].x, P[i].y); g.stroke();
    }
    g.globalAlpha = 1;
  }
  remove() { cancelAnimationFrame(this.raf); this.c.remove(); }
}

// One shot's steps. The court slows the incoming ball (dilate) and stops it at your contact; you draw (draw), the
// gauge times it (time), then the point goes on (done). A pause or a missed clock can end any step early.
class StrokeFlow {
  constructor(onChange) { this.state = 'idle'; this.onChange = onChange || (() => {}); this.log = []; }
  static get NEXT() { return { idle: ['dilate', 'draw'], dilate: ['draw'], draw: ['time', 'done'], time: ['done'], done: ['idle'] }; }
  go(to) {
    if (!StrokeFlow.NEXT[this.state].includes(to)) return false; // only the allowed steps
    this.log.push(`${this.state}>${to}`); if (this.log.length > 20) this.log.shift();
    this.state = to; this.onChange(to);
    return true;
  }
  reset() { this.state = 'idle'; this.onChange('idle'); }
}
