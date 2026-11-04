// cbplay.js — TourLife Extreme on screen: the Court Breaker court, its controls, Extreme career matches, the three
// practice modes (Trap Builder, Escape Artist, Blitz Duel) with tutorials, and the owner's God Panel.
// The simulation lives in cbsim.js. Extreme only exists on the local test link (see TL_MODE in names.js), so on the
// live site nothing here shows or runs. Extreme keeps its own saves (tourlife.extreme.*): a TourLife career is never touched.

const cbLocal = () => location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/.test(location.hostname);
const isExtreme = () => typeof TL_MODE !== 'undefined' && TL_MODE === 'extreme';
// God Panel: Extreme, on the local link, and logged in as admin. Anywhere else it doesn't exist.
const cbGod = () => isExtreme() && cbLocal() && typeof isAdminOn === 'function' && isAdminOn();
const CB_KEY = TL_NS + 'cb';
const cbData = () => ({ best: {}, duel: 0, tut: {}, untimed: false, feedback: true, god: {}, ...(readJSON(CB_KEY) || {}) });
const cbSave = d => writeJSON(CB_KEY, d);
const cbGodOn = k => cbGod() && !!cbData().god[k];
const cbWait = ms => new Promise(r => setTimeout(r, ms));
const CB_ME = '#22d3ee', CB_OPP = '#fb923c';

// --- The court ------------------------------------------------------------------------------------------
// Drawn top-down with a light tilt (the far end a little narrower). Court metres in, screen pixels out, and back.
function cbCourtView(host, surface) {
  const cv = document.createElement('canvas'); cv.className = 'xbcv'; host.appendChild(cv);
  const ctx = cv.getContext('2d');
  const V = { surface: surface || 'hard', pos: [{ x: 0, y: -12.2 }, { x: 0, y: 12.2 }], ball: null, trails: [], zones: null, aim: null, ring: null, ghosts: [], lean: null, timer: null, press: null, onTap: null };
  let W = 300, H = 600, k = 20, top = 0, cx = 150;
  const TILT = 0.15, YS = 0.9, VIEW = 14.6;
  const sc = y => 1 - TILT * (y + VIEW) / (2 * VIEW);
  const P = (x, y, h = 0) => [cx + x * k * sc(y), top + (VIEW - y) * YS * k - h * k * 0.5 * sc(y)];
  V.toScreen = P;
  V.toCourt = (X, Y) => { const y = VIEW - (Y - top) / (YS * k); return { x: (X - cx) / (k * sc(y)), y }; };
  V.fit = () => {
    const r = host.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    W = Math.max(200, r.width); H = Math.max(260, r.height);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    k = Math.min(W / 13.6, H / (2 * VIEW * YS)); top = (H - 2 * VIEW * YS * k) / 2; cx = W / 2;
    V.draw();
  };
  const COL = { hard: ['#2c6a4c', '#2f63a3'], clay: ['#a94f2a', '#c4673a'], grass: ['#3a7431', '#4a8c3c'] };
  const poly = (pts, fill, stroke, lw) => { ctx.beginPath(); pts.forEach(([x, y], i) => { const [a, b] = P(x, y); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); } };
  const line = (x1, y1, x2, y2, col = '#fff', lw = 1.6) => { const [a, b] = P(x1, y1), [c, d] = P(x2, y2); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); };
  const disc = (x, y, h, r, fill, stroke) => { const [a, b] = P(x, y, h); ctx.beginPath(); ctx.arc(a, b, r, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); } };
  const shadow = (x, y, r) => { const [a, b] = P(x, y); ctx.beginPath(); ctx.ellipse(a, b, r, r * 0.45, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill(); };
  V.draw = () => {
    const [out, inn] = COL[V.surface] || COL.hard;
    ctx.fillStyle = out; ctx.fillRect(0, 0, W, H);
    const D = CB.DW, S = CB.HW, L = CB.HL, SL = CB.SL;
    poly([[-D, -L], [D, -L], [D, L], [-D, L]], inn);
    if (V.surface === 'grass') for (let i = -6; i < 6; i++) if (i % 2) poly([[-D, i * 2], [D, i * 2], [D, i * 2 + 2], [-D, i * 2 + 2]], 'rgba(255,255,255,.05)');
    // Serve zones (when serving or reading a serve).
    for (const z of V.zones || []) { poly([[z.x0, z.y0], [z.x1, z.y0], [z.x1, z.y1], [z.x0, z.y1]], z.on ? 'rgba(250,204,21,.45)' : 'rgba(255,255,255,.12)', 'rgba(255,255,255,.5)', 1);
      const [a, b] = P((z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2); const zw = Math.abs(z.x1 - z.x0) * k; ctx.fillStyle = '#fff'; ctx.font = `600 ${Math.max(9, Math.min(k * 0.62, zw / 3.2))}px -apple-system,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(z.label, a, b); }
    for (const y of [-L, L]) line(-D, y, D, y, '#fff', 2.2);
    for (const x of [-D, D, -S, S]) line(x, -L, x, L);
    for (const y of [-SL, SL]) line(-S, y, S, y);
    line(0, -SL, 0, SL); line(0, -L, 0, -L + 0.3); line(0, L, 0, L - 0.3);
    // The net.
    line(-D - 0.9, 0, D + 0.9, 0, 'rgba(0,0,0,.35)', 5); line(-D - 0.9, 0, D + 0.9, 0, '#e5e7eb', 2.2);
    for (const x of [-D - 0.9, D + 0.9]) disc(x, 0, 0, 3, '#e5e7eb');
    // Shot trails (after the point).
    for (const t of V.trails) { ctx.beginPath(); t.pts.forEach((p, i) => { const [a, b] = P(p.x, p.y); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.strokeStyle = t.col; ctx.lineWidth = t.last ? 3 : 2; ctx.globalAlpha = t.last ? 1 : 0.55; ctx.stroke(); ctx.globalAlpha = 1;
      const e = t.pts[t.pts.length - 1]; if (t.err) { const [a, b] = P(e.x, e.y); ctx.strokeStyle = '#f87171'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a - 6, b - 6); ctx.lineTo(a + 6, b + 6); ctx.moveTo(a + 6, b - 6); ctx.lineTo(a - 6, b + 6); ctx.stroke(); } else disc(e.x, e.y, 0, 3.5, t.col); }
    // Where you'll meet the ball, and where they'll be when you do.
    for (const g of V.ghosts) { const [a, b] = P(g.x, g.y, 1); ctx.beginPath(); ctx.setLineDash([4, 4]); ctx.arc(a, b, Math.max(8, 0.42 * k * sc(g.y)), 0, Math.PI * 2); ctx.strokeStyle = g.col; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); }
    if (V.lean) { const [a, b] = P(V.lean.x, V.lean.y, 1), [c, d] = P(V.lean.x + V.lean.dx, V.lean.y, 1); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.strokeStyle = CB_OPP; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c, d); ctx.lineTo(c - Math.sign(V.lean.dx) * 7, d - 5); ctx.lineTo(c - Math.sign(V.lean.dx) * 7, d + 5); ctx.closePath(); ctx.fillStyle = CB_OPP; ctx.fill(); }
    // Your aim: where you tapped, and the circle the ball could land in (shifted short if you're under pressure).
    if (V.ring) { const [a, b] = P(V.ring.x, V.ring.y); ctx.beginPath(); ctx.ellipse(a, b, Math.max(6, V.ring.r * k * sc(V.ring.y)), Math.max(5, V.ring.r * 1.1 * YS * k), 0, 0, Math.PI * 2);
      ctx.fillStyle = V.ring.col + '33'; ctx.fill(); ctx.strokeStyle = V.ring.col; ctx.lineWidth = 2; ctx.stroke(); }
    if (V.aim) { const [a, b] = P(V.aim.x, V.aim.y); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(a - 9, b); ctx.lineTo(a + 9, b); ctx.moveTo(a, b - 9); ctx.lineTo(a, b + 9); ctx.stroke(); }
    // Players (far one first) and the ball.
    const fig = (i, col) => { const p = V.pos[i], r = Math.max(9, 0.45 * k * sc(p.y)); shadow(p.x, p.y, r); disc(p.x, p.y, 1, r, col, 'rgba(0,0,0,.45)');
      if (i === 0 && V.press !== null) { const [a, b] = P(p.x, p.y, 1); const pc = V.press < 0.4 ? '#4ade80' : V.press < 0.8 ? '#fbbf24' : '#f87171';
        ctx.beginPath(); ctx.arc(a, b, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (V.timer === null ? 1 : V.timer)); ctx.strokeStyle = pc; ctx.lineWidth = 4; ctx.stroke(); } };
    fig(1, CB_OPP); fig(0, CB_ME);
    if (V.ball) { const b = V.ball; shadow(b.x, b.y, Math.max(3, 0.12 * k)); disc(b.x, b.y, b.h, Math.max(4, 0.14 * k * sc(b.y)), '#e8ff3a', 'rgba(0,0,0,.4)'); }
  };
  const tap = e => { if (!V.onTap) return; const r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; V.onTap(V.toCourt(t.clientX - r.left, t.clientY - r.top)); };
  cv.addEventListener('pointerdown', e => { e.preventDefault(); tap(e); });
  V.zoneAt = p => (V.zones || []).find(z => p.x >= Math.min(z.x0, z.x1) - 0.4 && p.x <= Math.max(z.x0, z.x1) + 0.4 && p.y >= Math.min(z.y0, z.y1) - 0.6 && p.y <= Math.max(z.y0, z.y1) + 0.6);
  return V;
}

// The ball's path for a shot (u from 0 to 1): through the air to the bounce, then on to where it's met.
function cbBallPath(sh) {
  const from = sh.from, land = sh.land || from, T = CB_SHOT[sh.type] || { apex: 0.8 };
  const dir = (() => { const dx = land.x - from.x, dy = land.y - from.y, L = Math.hypot(dx, dy) || 1; return { x: dx / L, y: dy / L }; })();
  const past = d => ({ x: land.x + dir.x * d, y: land.y + dir.y * d });
  const end = sh.err === 'net' ? land : sh.err === 'out' ? past(2.5) : sh.contact && !sh.winner ? sh.contact : past(4);
  const met = !!sh.met, uB = met || sh.err === 'net' ? 1 : sh.type === 'drop' ? 0.62 : 0.72;
  const h0 = sh.serve ? 2.7 : 1, apex = sh.serve ? 0.5 : T.apex;
  return u => {
    if (u <= uB) { const q = u / uB, tgt = met ? sh.contact : land;
      return { x: from.x + (tgt.x - from.x) * q, y: from.y + (tgt.y - from.y) * q, h: Math.max(0, h0 * (1 - q) + (met ? 1 : 0) * q + apex * 4 * q * (1 - q)) }; }
    const q = (u - uB) / (1 - uB);
    return { x: land.x + (end.x - land.x) * q, y: land.y + (end.y - land.y) * q, h: 1.1 * Math.sin(q * Math.PI * 0.55) };
  };
}
const cbLerp = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });

// --- The overlay: scoreboard, court, controls ---------------------------------------------------------------
function cbOverlay({ surface = 'hard', exit = null } = {}) {
  const el = document.createElement('div');
  el.className = 'xbov';
  el.innerHTML = `<div class="xbtop"><div class="xbscore"></div><div class="xbtopb">${cbGod() ? '<button type="button" class="xbic" data-cb="god" aria-label="God Panel">⚡</button>' : ''}` +
    `<button type="button" class="xbic" data-cb="pause" aria-label="Pause">❚❚</button>${exit ? '<button type="button" class="xbic" data-cb="exit" aria-label="Leave">✕</button>' : ''}</div></div>` +
    `<div class="xbtime"><i></i></div><div class="xbstage"><div class="xbmsg" hidden></div><div class="xbpaused" hidden>Paused<small>Tap To Carry On</small></div></div><div class="xbbar"></div>`;
  document.body.appendChild(el); document.body.classList.add('xbopen');
  const stage = el.querySelector('.xbstage'), bar = el.querySelector('.xbbar'), msg = el.querySelector('.xbmsg'), tbar = el.querySelector('.xbtime i'), pz = el.querySelector('.xbpaused');
  const V = cbCourtView(stage, surface);
  const U = { el, V, bar, paused: false, godReq: null, untimed: () => cbData().untimed };
  const onR = () => V.fit(); window.addEventListener('resize', onR); setTimeout(onR, 0);
  U.close = () => { window.removeEventListener('resize', onR); el.remove(); document.body.classList.remove('xbopen'); };
  U.score = html => { el.querySelector('.xbscore').innerHTML = html; };
  U.setPause = on => { U.paused = on; pz.hidden = !on; };
  pz.onclick = () => U.setPause(false);
  el.querySelector('.xbtopb').onclick = e => { const b = e.target.closest('[data-cb]'); if (!b) return;
    if (b.dataset.cb === 'pause') U.setPause(!U.paused);
    if (b.dataset.cb === 'exit' && exit) exit();
    if (b.dataset.cb === 'god') cbGodMatchMenu(U); };
  // Waits that hold still while paused.
  U.wait = async ms => { let t = 0; while (t < ms) { await cbWait(40); if (!U.paused) t += 40; } };
  // The shot clock: a bar along the top and a ring round your player. Untimed practice never runs out.
  let tm = null;
  U.timer = (sec, onEnd) => {
    U.stopTimer();
    if (U.untimed()) { tbar.style.width = '100%'; V.timer = null; return; }
    let left = sec * 1000;
    tm = setInterval(() => { if (U.paused) return; left -= 50; const f = Math.max(0, left / (sec * 1000)); tbar.style.width = (f * 100) + '%'; tbar.className = f < 0.3 ? 'low' : ''; V.timer = f; V.draw();
      if (left <= 0) { U.stopTimer(); onEnd(); } }, 50);
  };
  U.stopTimer = () => { if (tm) clearInterval(tm); tm = null; tbar.style.width = '0%'; V.timer = null; };
  U.flash = (text, kind = '') => { msg.innerHTML = text; msg.className = 'xbmsg ' + kind; msg.hidden = false; };
  U.hideFlash = () => { msg.hidden = true; };
  U.idle = (on = true) => bar.classList.toggle('idle', on); // controls dim while it isn't your turn
  // Plays part of a shot (u0 to u1 of it): the ball, the hitter recovering, the receiver running to it.
  U.anim = (sh, u0 = 0, u1 = 1) => new Promise(done => {
    const path = cbBallPath(sh), by = sh.by, r = 1 - by, dur = Math.round(cbClamp(sh.serve ? 0.62 : (sh.time || 0.9) * 0.95, 0.5, 1.7) * 1000 * (u1 - u0));
    const hFrom = sh.from, hTo = sh.after || sh.from, rFrom = sh.rcvFrom || V.pos[r];
    const rTo = sh.err ? rFrom : sh.winner ? cbMoveToward(rFrom, sh.contact || sh.land, Math.max(0, (sh.time || 0.8) - 0.3) * 6) : (sh.contact || rFrom);
    let t = 0;
    const step = () => {
      if (!U.paused) t += 16;
      const u = u0 + (u1 - u0) * Math.min(1, dur ? t / dur : 1);
      V.ball = path(u);
      V.pos[by] = cbLerp(hFrom, hTo, cbClamp((u - 0.15) / 0.85, 0, 1));
      V.pos[r] = cbLerp(rFrom, rTo, cbClamp(u / 0.95, 0, 1));
      V.draw();
      if (t >= dur) done(); else setTimeout(step, 16);
    };
    step();
  });
  // Tap anywhere to move on (or it moves on by itself).
  U.tapOn = ms => new Promise(done => { let over = false; const go = () => { if (over) return; over = true; stage.removeEventListener('pointerdown', go); done(); }; stage.addEventListener('pointerdown', go); U.wait(ms).then(go); });
  return U;
}

// Your shot: tap where it should land, then the ball (or the ball first, then the spot). Returns { aim, type, approach }.
function cbAskShot(U, st) {
  const V = U.V, volley = !!(st.inc && st.inc.volley), smash = !!st.smash;
  return new Promise(done => {
    let aim = null, type = null, app = false, over = false;
    const types = [['topspin', '🌀', 'Topspin'], ['flat', '⚡', smash ? 'Smash' : 'Flat'], ['slice', '🪶', 'Slice'], ['lob', '🌈', 'Lob']];
    const draw = () => {
      U.bar.innerHTML = `<div class="xbshots">${types.map(([k, i, t]) => `<button type="button" data-t="${k}" class="${type === k ? 'on' : ''}"><span>${i}</span>${t}</button>`).join('')}</div>` +
        (st.atNet[0] ? '' : `<button type="button" class="xbnet ${app ? 'on' : ''}" data-net>🏃 Come To The Net</button>`);
    };
    const ring = () => {
      if (!aim) { V.ring = null; V.aim = null; V.draw(); return; }
      const t = type || 'topspin', tt = t === 'slice' && Math.abs(aim.y) < 4.8 && !volley ? 'drop' : t;
      const e = cbValue(st, 0, aim, t, app), sg = cbSigma(st, 0, tt, st.inc ? st.inc.wing : 'fh', volley, st.shots.length === 1);
      const short = tt === 'lob' || tt === 'drop' ? 0 : Math.min(1.2, st.pr[0]) * 1.5;
      V.aim = aim; V.ring = { x: aim.x, y: aim.y - short, r: sg * 1.15, col: e.pIn >= 0.86 ? '#4ade80' : e.pIn >= 0.68 ? '#fbbf24' : '#f87171' }; V.draw();
    };
    const fire = late => { if (over) return; over = true; U.idle(); U.stopTimer(); V.onTap = null; U.bar.onclick = null; V.ring = null; V.aim = null; V.ghosts = []; V.lean = null; V.press = null;
      done({ aim: aim || { x: -st.pos[0].x * 0.3, y: 9.6 }, type: type || 'topspin', approach: app, late: !!late }); };
    U.godReq = g => { if (over) return; over = true; U.idle(); U.stopTimer(); V.onTap = null; V.ring = null; V.aim = null; V.ghosts = []; V.lean = null; V.press = null; done({ god: g }); };
    V.onTap = p => { if (U.paused || p.y < 0.4) return; aim = { x: cbClamp(p.x, -5.5, 5.5), y: cbClamp(p.y, 0.8, 13.5) }; ring(); if (type) fire(); };
    U.bar.onclick = e => {
      if (U.paused) return;
      const b = e.target.closest('[data-t]'), n = e.target.closest('[data-net]');
      if (n) { app = !app; draw(); ring(); return; }
      if (!b) return;
      type = b.dataset.t; draw(); ring();
      if (aim) fire();
    };
    draw();
    // What you can see: where you'll meet it, where they'll be, and a lean if they think they know where you're going.
    V.press = st.pr[0];
    V.ghosts = [{ ...st.pos[0], col: CB_ME }, { ...st.pos[1], col: CB_OPP }];
    const ex = typeof cbExpect === 'function' ? cbExpect(st) : null;
    if (ex && ex !== 'middle') { const sx = Math.sign(st.pos[0].x || 0.01); const dir = ex === 'line' ? sx : -sx; V.lean = { x: st.pos[1].x, y: st.pos[1].y, dx: dir * 1.2 }; }
    V.draw();
    U.idle(false);
    U.timer(cbClamp(2.2 + 0.8 * (1 - Math.min(1, st.pr[0])), 2.2, 3), () => fire(true));
  });
}

// The three serve zones of the box a serve goes into.
function cbZones(st) {
  const f = cbFwd(st.server), sx = cbServeTarget(st, 'wide').x > 0 ? 1 : -1;
  const y0 = f * 0.25, y1 = f * (CB.SL - 0.05), edges = [CB.HW, 2.75, 1.25, 0];
  return [['wide', 'Wide', 0], ['body', 'Body', 1], ['t', 'T', 2]].map(([id, label, i]) => ({ id, label, x0: sx * edges[i], x1: sx * edges[i + 1], y0, y1 }));
}
// Your serve: tap a zone (Wide, Body, T) and a spin (Flat, Slice, Kick); come in behind it if you like.
function cbAskServe(U, st) {
  const V = U.V;
  return new Promise(done => {
    let zone = null, spin = null, app = false, over = false;
    V.zones = cbZones(st);
    const zrow = () => `<div class="xbzones">${[['wide', 'Wide'], ['body', 'Body'], ['t', 'T']].map(([k, t]) => `<button type="button" data-z="${k}" class="${zone === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    const draw = () => { U.bar.innerHTML = zrow() + `<div class="xbshots">${[['flat', '⚡', 'Flat'], ['slice', '🪶', 'Slice'], ['kick', '🦘', 'Kick']].map(([k, i, t]) => `<button type="button" data-s="${k}" class="${spin === k ? 'on' : ''}"><span>${i}</span>${t}</button>`).join('')}</div>` +
      (st.serve2 ? '' : `<button type="button" class="xbnet ${app ? 'on' : ''}" data-net>🏃 Serve And Volley</button>`); };
    const fire = () => { if (over) return; over = true; U.idle(); U.stopTimer(); V.zones = null; V.onTap = null; U.bar.onclick = null; V.draw(); done({ zone: zone || 'body', spin: spin || 'kick', approach: app }); };
    U.godReq = g => { if (over) return; over = true; U.idle(); U.stopTimer(); V.zones = null; V.onTap = null; done({ god: g }); };
    V.onTap = p => { if (U.paused) return; const z = V.zoneAt(p); if (!z) return; zone = z.id; V.zones.forEach(x => { x.on = x.id === zone; }); V.draw(); draw(); if (spin) fire(); };
    U.bar.onclick = e => { if (U.paused) return; const n = e.target.closest('[data-net]'); if (n) { app = !app; draw(); return; }
      const zb = e.target.closest('[data-z]'); if (zb) { zone = zb.dataset.z; V.zones.forEach(x => { x.on = x.id === zone; }); V.draw(); draw(); if (spin) fire(); return; }
      const b = e.target.closest('[data-s]'); if (!b) return; spin = b.dataset.s; draw(); if (zone) fire(); };
    draw(); V.draw();
    U.idle(false);
    U.timer(st.serve2 ? 7 : 8, fire);
  });
}
// Their serve: tap where you think it's going, or don't guess.
function cbAskRead(U, st) {
  const V = U.V;
  return new Promise(done => {
    let over = false;
    V.zones = cbZones(st);
    const fin = z => { if (over) return; over = true; U.idle(); U.stopTimer(); V.zones = null; V.onTap = null; U.bar.onclick = null; V.draw(); done(z); };
    U.godReq = g => fin({ god: g });
    U.bar.innerHTML = `<div class="xbreadq">Where Is Their Serve Going?</div><div class="xbzones">${[['wide', 'Wide'], ['body', 'Body'], ['t', 'T']].map(([k, t]) => `<button type="button" data-z="${k}">${t}</button>`).join('')}</div><button type="button" class="xbnet" data-no>No Guess</button>`;
    U.bar.onclick = e => { if (U.paused) return; if (e.target.closest('[data-no]')) return fin(null); const zb = e.target.closest('[data-z]'); if (zb) { V.zones.forEach(x => { x.on = x.id === zb.dataset.z; }); V.draw(); zb.classList.add('on'); setTimeout(() => fin(zb.dataset.z), 120); } };
    V.onTap = p => { if (U.paused) return; const z = V.zoneAt(p); if (z) { V.zones.forEach(x => { x.on = x === z; }); V.draw(); setTimeout(() => fin(z.id), 120); } };
    V.draw();
    U.idle(false);
    U.timer(2.6, () => fin(null));
  });
}

// --- One point, start to finish ----------------------------------------------------------------------------
// o.incoming: a rally that's already started (practice); o.onMyTurn(st): checked before each of your shots.
async function cbRunPoint(U, st, o = {}) {
  const V = U.V, godEnd = g => { st.over = { w: g === 'win' ? 0 : 1, how: 'winner', shot: null, god: true }; return st.over; };
  V.trails = []; V.ball = null; U.hideFlash();
  let who = 0, incoming = o.incoming || null;
  if (!incoming) {
    st.pos[st.server] = cbServeSpot(st); st.pos[1 - st.server] = cbReturnSpot(st);
    for (let g = 0; g < 2; g++) {
      V.pos = [{ ...st.pos[0] }, { ...st.pos[1] }]; V.ball = { ...cbServeSpot(st), h: 1.2 }; V.draw();
      let c, guess = null;
      if (st.server === 0) { c = await cbAskServe(U, st); if (c.god) return godEnd(c.god); guess = cbGuessServe(st); }
      else { c = cbChooseServe(st); U.bar.innerHTML = ''; guess = await cbAskRead(U, st); if (guess && guess.god) return godEnd(guess.god); }
      const r = cbServe(st, c.zone, c.spin, guess, c.approach);
      if (r.over && r.over.how === 'ace') r.shot.winner = true;
      if (r.next === 0) { incoming = r.shot; who = 0; break; }
      await U.anim(r.shot);
      if (r.fault) { U.flash('Fault'); await U.wait(650); U.hideFlash(); st.pos[st.server] = cbServeSpot(st); st.pos[1 - st.server] = cbReturnSpot(st); continue; }
      if (r.over) break;
      who = r.next; break;
    }
  } else who = 0;
  while (!st.over) {
    if (who === 0) {
      if (incoming) await U.anim(incoming, 0, 0.5);
      if (o.onMyTurn && o.onMyTurn(st)) break;
      const me = await cbAskShot(U, st);
      if (me.god) return godEnd(me.god);
      if (incoming) await U.anim(incoming, 0.5, 1);
      if (me.late) { st.pr[0] = Math.min(1.4, st.pr[0] + 0.25); U.flash('Late', 'small'); }
      const h = cbHit(st, 0, me.aim, me.type, me.approach);
      if (h.over && h.over.how === 'winner') h.shot.winner = true;
      await U.anim(h.shot);
      U.hideFlash();
      incoming = null; who = 1;
    } else {
      const c = cbChoose(st, 1), h = cbHit(st, 1, c.aim, c.type, c.approach);
      if (h.over) { if (h.over.how === 'winner') h.shot.winner = true; await U.anim(h.shot); break; }
      incoming = h.shot; who = 0;
    }
  }
  return st.over;
}

// After the point: every shot's path, and two or three words on what worked or didn't.
async function cbShowPoint(U, st, title, wonByMe) {
  const V = U.V, shots = st.shots.filter(s => s.land || s.contact);
  V.trails = shots.slice(-8).map((s, i, a) => ({ pts: [s.from, s.land || s.contact], col: s.by === 0 ? CB_ME : CB_OPP, err: !!s.err, last: i === a.length - 1 }));
  V.ball = null; V.draw();
  const tags = cbData().feedback && st.over && !st.over.god ? cbTags(st, 0) : [];
  U.flash(`<b class="${wonByMe ? 'good' : 'bad'}">${title}</b>${tags.length ? `<span class="xbtags">${tags.map(t => `<i class="${t.good ? 'g' : 'b'}">${t.t}</i>`).join('')}</span>` : ''}`);
  await U.tapOn(tags.length ? 1700 : 1000);
  U.hideFlash(); V.trails = []; V.draw();
}

// --- Extreme career matches ------------------------------------------------------------------------------
// Every point of an Extreme match is played on the Court Breaker court; the TourLife engine keeps the score,
// the stats and everything after the match (prize money, ranking points, records). Matches are one set
// (best of three in a Slam main draw), so a week moves quickly.
let cbBusy = false;
async function cbMatch(entry) {
  if (cbBusy) return; cbBusy = true;
  try {
    const L = entry.live, ev = eventOf(entry);
    if (!L.cbInit) { L.cbInit = 1; L.mode = 'cb'; if (!L.m.sets.length && !L.inSet) L.m.bestOf = ev.tier === 'GS' && !inQual(entry) ? 3 : 1; writeJSON(ENTRY_KEY, entry); }
    // ✕ leaves for the draw: finished points are saved, so a clean reload resumes from the draw.
    const U = cbOverlay({ surface: ev.surface, exit: () => { sessionStorage.setItem('tourlife.xbToDraw', '1'); location.reload(); } });
    cbMatchU = U;
    await cbTutorial('turns');
    await cbTutorial('plays');
    while (!L.done) {
      await cbSet(entry, U);
      if (!L.done) { const s = L.m.sets[L.m.sets.length - 1], me = L.m.a === 0 ? 0 : 1; U.flash(`<b>Set ${L.m.sets.length}: ${s.games[me]}-${s.games[1 - me]}</b><small>Tap To Start The Next Set</small>`); await U.tapOn(60000); U.hideFlash(); }
    }
    const m = L.m, me = m.a === 0 ? 0 : 1;
    U.flash(`<b class="${m.winner === me ? 'good' : 'bad'}">${m.winner === me ? 'You Win' : 'You Lose'}</b><small>${scoreLine(m, me)}</small>`);
    await U.tapOn(2200);
    U.close();
  } finally { cbBusy = false; cbMatchU = null; }
  renderMatch();
}
let cbMatchU = null;
const cbPtsText = (pts, tb, me) => {
  if (tb) return [pts[me], pts[1 - me]];
  const n = ['0', '15', '30', '40'], [a, b] = [pts[me], pts[1 - me]];
  if (a >= 3 && b >= 3) return a === b ? ['40', '40'] : a > b ? ['AD', ''] : ['', 'AD'];
  return [n[Math.min(3, a)], n[Math.min(3, b)]];
};
// tagRow: the row (0 you, 1 them) whose big point it is; the tag sits just right of their points. null: under the score.
function cbScoreHtml(names, sets, games, pts, serving, tag, tagRow = null) {
  const row = (i, cls) => `<div class="xbrow ${cls}"><span class="xbn">${serving === i ? '<i class="sv"></i>' : ''}${esc(names[i])}</span>${sets.map(s => `<b>${s[i]}</b>`).join('')}<b class="g">${games[i]}</b><b class="p">${pts[i]}</b>` +
    `<span class="xbtag inrow">${tag && tagRow === i ? tag : ''}</span></div>`;
  return row(0, 'me') + row(1, 'op') + (tag && tagRow === null ? `<div class="xbtag">${tag}</div>` : '');
}
async function cbSet(entry, U) {
  const L = entry.live, ev = eventOf(entry);
  if (L.inSet && L.snap) L.m = JSON.parse(L.snap);
  else { L.inSet = true; L.seed = (Math.random() * 4294967296) >>> 0; L.cbRes = []; L.snap = JSON.stringify(L.m); writeJSON(ENTRY_KEY, entry); }
  const m = L.m, rng = seeded(L.seed), ps = matchPlayers(entry, m), me = m.a === 0 ? 0 : 1, op = 1 - me;
  const side = [me, op], ab = [cbAbilities(ps[me]), cbAbilities(ps[op])], wx = typeof wxOf === 'function' ? wxOf(ev) : {};
  L.cbMem = L.cbMem || cbMemory(); L.cbRes = L.cbRes || [];
  const names = ['You', shortName(ps[op])];
  let step = 0;
  const set = await playSetLive(m, ps, ev, async info => {
    const k = step++;
    if (k < L.cbRes.length) { m.forced = L.cbRes[k]; return; } // picked up after a refresh: the points already played
    const pts = info.pts || [0, 0], big = info.bp !== null || !!info.press || !!info.tb;
    const tag = info.press ? `${info.press.match ? 'Match' : 'Set'} Point` : info.bp !== null ? 'Break Point' : info.tb ? 'Tiebreak' : '';
    U.score(cbScoreHtml(names, m.sets.map(s => [s.games[me], s.games[op]]), [m.games[me], m.games[op]], cbPtsText(pts, info.tb, me), info.s === me ? 0 : 1, tag,
      info.press ? (info.press.who === me ? 0 : 1) : info.bp !== null ? (info.bp === me ? 0 : 1) : null));
    const level = i => (big ? 1 : !info.tb && pts[0] >= 2 && pts[1] >= 2 ? 0.45 : 0.12) * (1 - attr(ps[i], 'mental') / 110);
    const tired = i => cbClamp((m.totalGames + m.games[0] + m.games[1]) / 34 * (1.25 - attr(ps[i], 'stam') / 100) * (wx.heat || 1) + (i === me ? (current.player.fatigue || 0) / 200 : 0), 0, 1);
    let res;
    if (U.godAuto) res = cbGodResult(U.godAuto === 'win', side);
    else {
      const st = cbNewPoint(ab, { surface: ev.surface, wx: ev.indoor ? {} : wx, server: info.s === me ? 0 : 1, deuce: (pts[0] + pts[1]) % 2 === 0, clutch: [level(me), level(op)], tired: [tired(me), tired(op)], mem: L.cbMem });
      const o = await cbRunPoint(U, st);
      res = o.god ? cbGodResult(o.w === 0, side) : cbEngineResult(st, side);
      await cbShowPoint(U, st, o.w === 0 ? 'Your Point' : `${names[1]}'s Point`, o.w === 0);
    }
    L.cbRes.push(res); writeJSON(ENTRY_KEY, entry);
    m.forced = res;
  }, rng);
  // The set's line in the match log, then the same tidy-up as any set.
  const [g1, g2] = [set.games[me], set.games[op]];
  L.log.push(`<b>Set ${m.sets.length}: ${g1}-${g2}${set.tb ? ` (tiebreak ${set.tb[me]}-${set.tb[op]})` : ''} ${g1 > g2 ? 'to you' : 'to ' + esc(ps[op].name)}</b>`);
  if (m.winner !== null) concludeMatch();
  entry.live.total = (entry.live.total || 0) + m.points.length;
  m.points = [];
  L.inSet = false; L.snap = null; L.cbRes = []; L.calls = [];
  writeJSON(ENTRY_KEY, entry);
}
const cbGodResult = (won, side) => ({ w: side[won ? 0 : 1], pt: { how: 'winner', len: 3, hands: true, serve2: false, kmh1: 190, kmh2: 150 } });

// --- Practice: Trap Builder, Escape Artist, Blitz Duel -------------------------------------------------------
// Practice changes nothing in your career (no stats, money or fatigue), so it can be played as often as you like.
const CB_MODES = {
  trap: { icon: '🪤', name: 'Trap Builder', sub: 'Build an opening, then finish it', n: 8 },
  escape: { icon: '🧗', name: 'Escape Artist', sub: 'Survive the attack and turn it around', n: 8 },
  duel: { icon: '⚡', name: 'Blitz Duel', sub: 'First to 7 against an opponent who adapts', n: 0 },
};
// A practice opponent around your level, with a playstyle of their own (God Panel can set both).
function cbPartner(p, lift = 0) {
  const d = cbData(), g = cbGod() ? d.god : {};
  const keys = ['serve', 'ground', 'ret', 'net', 'stam', 'mental', 'iq'], avg = keys.reduce((a, k) => a + attr(p, k), 0) / keys.length;
  const st = g.oppStyle ? STYLES.find(s => s.name === g.oppStyle) : STYLES[Math.floor(Math.random() * STYLES.length)];
  const lv = g.oppLevel !== undefined && g.oppLevel !== '' && g.oppLevel !== null ? +g.oppLevel : lift;
  const attrs = {};
  keys.forEach((k, i) => { attrs[k] = Math.round(cbClamp(avg + lv * 2.5 + (st.w ? st.w[i] * 3 : 0) + (Math.random() - 0.5) * 8, 25, 96)); });
  const nat = Object.keys(NAMES)[Math.floor(Math.random() * Object.keys(NAMES).length)], [fs, ls] = NAMES[nat];
  return { name: `${fs[Math.floor(Math.random() * fs.length)]} ${ls[Math.floor(Math.random() * ls.length)]}`, nation: nat, attrs, realStyle: st.name,
    hand: Math.random() < 0.15 ? 'left' : 'right', backhand: Math.random() < 0.2 ? 'one' : 'two' };
}
// A rally already under way: their first ball is in the air when you take over.
function cbPracticeStart(kind, ab, surface, mem) {
  for (let tries = 0; tries < 30; tries++) {
    const st = cbNewPoint(ab, { surface, server: 1, mem });
    st.shots.push({ serve: true, by: 1, feed: true });
    if (kind === 'escape') {
      // Pulled out wide; they're inside the baseline, hitting into your open court.
      const wide = Math.random() < 0.5 ? 1 : -1;
      st.pos = [{ x: wide * 4.7, y: -12.4 }, { x: -wide * 0.4, y: 8.7 }];
      st.inc = { wing: 'fh' }; st.pr[1] = 0.05;
      const x = -wide * (3.1 - tries * 0.08);
      const h = cbHit(st, 1, { x, y: -9.6 }, Math.random() < 0.5 ? 'flat' : 'topspin', false);
      if (!h.over && st.pr[0] >= 0.75) return { st, incoming: h.shot };
    } else {
      // A neutral, deep crosscourt ball from the baseline.
      const side = Math.random() < 0.5 ? 1 : -1;
      st.pos = [{ x: side * 0.5, y: -12.3 }, { x: -side * 1.2, y: 12.4 }];
      st.inc = { wing: 'fh' }; st.pr[1] = 0.15;
      const h = cbHit(st, 1, { x: side * 2.3, y: -10.1 }, 'topspin', false);
      if (!h.over && st.pr[0] < 0.6) return { st, incoming: h.shot };
    }
  }
  return null;
}
async function cbPractice(kind) {
  const p = current.player;
  if (!p) return;
  await cbTutorial('turns');
  await cbTutorial(kind);
  const d = cbData(), opp = cbPartner(p, kind === 'duel' ? d.duel : 0), ab = [cbAbilities({ ...p, isPlayer: true }), cbAbilities(opp)];
  const surface = cbGodOn('surface') ? d.god.surface : (['hard', 'clay', 'grass'])[Math.floor(Math.random() * 3)], mem = cbMemory();
  let quit = false;
  const U = cbOverlay({ surface, exit: () => { quit = true; U.close(); } });
  const M = CB_MODES[kind], names = ['You', opp.name.split(' ').slice(-1)[0]];
  let won = 0, stars = 0, played = 0;
  const sc = (tag, serving = null) => U.score(`<div class="xbrow me"><span class="xbn">${M.icon} ${M.name}</span><b class="p">${kind === 'duel' ? `${won}-${played - won}` : `${won}/${M.n}`}</b></div>` +
    `<div class="xbrow op"><span class="xbn">${serving === 1 ? '<i class="sv"></i>' : ''}${esc(opp.name)} · ${esc(opp.realStyle)}</span>${kind === 'duel' ? `<b class="p">Level ${d.duel}</b>` : `<b class="p">${'★'.repeat(stars) || ''}</b>`}</div>${tag ? `<div class="xbtag">${tag}</div>` : ''}`);
  if (kind === 'duel') {
    while (!quit && won < 7 && played - won < 7) {
      const k = played, server = Math.floor((k + 1) / 2) % 2 === 0 ? 0 : 1, close = won >= 5 || played - won >= 5;
      sc(close ? 'Big Point' : '', server);
      const st = cbNewPoint(ab, { surface, server, deuce: k % 2 === 0, clutch: close ? [0.6 * (1 - p.attrs.mental / 110), 0.5] : [0.1, 0.1], mem });
      const o = await cbRunPoint(U, st); if (quit) return;
      played++; if (o.w === 0) won++;
      await cbShowPoint(U, st, o.w === 0 ? 'Your Point' : `${names[1]}'s Point`, o.w === 0);
    }
    if (quit) return;
    const win = won === 7;
    d.duel = Math.max(-5, d.duel + (win ? 1 : -1)); d.best.duel = Math.max(d.best.duel || 0, d.duel); cbSave(d);
    U.close();
    return cbResult(kind, win ? `You Won ${won}-${played - won}` : `You Lost ${won}-${played - won}`, win ? `Next duel: Level ${d.duel}. They'll be a little better.` : `Next duel: Level ${d.duel}.`);
  }
  for (let i = 0; i < M.n && !quit; i++) {
    sc(`Rally ${i + 1} Of ${M.n}`);
    const start = cbPracticeStart(kind, ab, surface, mem);
    if (!start) continue;
    const { st, incoming } = start;
    let calm = 0, escaped = false;
    const onMyTurn = kind === 'escape' ? s => {
      // Back in the point: two balls in a row with time to play, and them back behind the baseline.
      if (s.shots.filter(x => x.by === 0).length >= 1 && s.pr[0] < 0.45 && Math.abs(s.pos[1].y) > 10.8 && !s.atNet[1]) calm++; else calm = 0;
      if (calm >= 2) { escaped = true; return true; }
      return false;
    } : null;
    U.V.pos = [{ ...(incoming.rcvFrom || st.pos[0]) }, { ...incoming.from }];
    await U.wait(300);
    const o = await cbRunPoint(U, st, { incoming, onMyTurn }); if (quit) return;
    if (escaped) { won++; await cbShowEscape(U, st); continue; }
    const w = o && o.w === 0;
    const built = w && (cbTags(st, 0).some(t => t.t === 'Built The Point' || t.t === 'Pulled Them Wide' || t.t === 'Open Court Winner'));
    if (w) { won++; if (built || kind === 'escape') stars++; }
    sc(`Rally ${i + 1} Of ${M.n}`);
    await cbShowPoint(U, st, w ? (kind === 'escape' ? 'Turned It Around' : built ? 'Trap Sprung' : 'Rally Won') : 'Rally Lost', w);
  }
  if (quit) return;
  const score = won * 10 + stars * 5, best = d.best[kind] || 0;
  if (score > best) { d.best[kind] = score; cbSave(d); }
  U.close();
  cbResult(kind, `${won} Of ${M.n} ${kind === 'escape' ? 'Escaped' : 'Won'}${stars ? ` · ${'★'.repeat(stars)}` : ''}`, score > best ? `New best: ${score} points.` : `Score ${score} · Best ${best}`);
}
async function cbShowEscape(U, st) {
  U.V.trails = st.shots.filter(s => s.land).slice(-6).map((s, i, a) => ({ pts: [s.from, s.land], col: s.by === 0 ? CB_ME : CB_OPP, last: i === a.length - 1 }));
  U.V.draw(); U.flash('<b class="good">Escaped</b><span class="xbtags"><i class="g">Back In The Point</i></span>'); await U.tapOn(1400); U.hideFlash(); U.V.trails = [];
}
function cbResult(kind, line, sub) {
  const M = CB_MODES[kind];
  openModal(`<div class="help welcome"><div class="helpicon">${M.icon}</div><h2 class="itop">${M.name}</h2><p class="big center"><b>${line}</b></p><p class="hint center">${sub}</p>` +
    `<button type="button" class="btn huge" id="cbAgain">Play Again</button><button type="button" class="link" id="cbDone">Done</button></div>`);
  $('cbAgain').onclick = () => { closeModal(); cbPractice(kind); };
  $('cbDone').onclick = () => { closeModal(); cbHome(); };
}

// --- Tutorials: a few short slides, once each (How To Play shows them again) ----------------------------------
const CB_TUT = {
  turns: [['⏸️', 'No Clock', 'Every time the ball comes to you, the point stops. Take your time: nothing happens until you press Hit It.'],
    ['🔍', 'Read The Situation', 'You are told what they hit, how much time you have, where they are standing, which side is open and what their habits are.'],
    ['🎾', 'Build Your Shot', 'Pick the shot (Topspin, Flat, Slice, Drop Shot or Lob), the direction and the depth, or tap an exact spot on their side. The risk shows as you build it.'],
    ['🏃', 'Choose Where To Go', 'After your shot: recover to the middle, cover their crosscourt or their line, or come to the net. Guess their next shot right and you are there early.'],
    ['📍', 'See Where It Lands', 'Every bounce leaves a dot: blue for you, orange for them. Your yellow aim ring shows how far off you were.'],
    ['🧠', 'Build The Point', 'Move them side to side, use depth, attack the weaker wing, then go for the open court. Repeat yourself and good players start to read you.'],
    ['🎾', 'Serving And Returning', 'Serve: pick where, then Flat, Slice or Kick. Returning: guess where their serve is going, or just react.']],
  plays: [['📖', 'Call A Play', 'Before each point you can call a play from your Playbook: a serve or return, then up to four shots, each with where you go next. It runs at full speed.'],
    ['🗣️', 'Audibles', 'A play only stops when the point breaks it: you are stretched, they rush the net, or you get a short ball. Then change the shot, run the play anyway, or drop it.'],
    ['🧠', 'They Learn Your Plays', 'Call the same play too often in a match and they start reading it. Mix your plays up, and build new ones in the Playbook.']],
  trap: [['🪤', 'Trap Builder', 'Each rally starts neutral. Build an opening and finish it. You earn a ★ for points you built, not ones they gave you.']],
  escape: [['🧗', 'Escape Artist', 'You start pulled wide while they attack. Buy time with height, depth or slice, recover to the middle, then counter. Surviving counts.']],
  duel: [['⚡', 'Blitz Duel', 'First to 7 points, serving in turns. Win and the next opponent is a level better. Lose and they drop a level.']],
};
function cbTutorial(key, force = false) {
  const d = cbData();
  if (!force && d.tut[key]) return Promise.resolve();
  d.tut[key] = 1; cbSave(d);
  const slides = CB_TUT[key];
  return new Promise(done => {
    const show = i => {
      const [icon, title, text] = slides[i], last = i === slides.length - 1;
      openModal(`<div class="help welcome"><div class="helpicon">${icon}</div><div class="newtag">How To Play</div><h2 class="itop">${title}</h2><p class="big">${text}</p>` +
        (slides.length > 1 ? `<div class="helpdots">${slides.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>` : '') +
        `<button type="button" class="btn huge" id="cbTuNext">${last ? 'Got It' : 'Next'}</button></div>`, { onClose: () => done() });
      $('cbTuNext').onclick = () => { if (last) closeModal(); else show(i + 1); };
    };
    show(0);
  });
}

// --- Home: the TourLife / TourLife Extreme switch and the practice card ---------------------------------------
function cbSwitchHtml() {
  if (!cbLocal() || (typeof isCoachMode === 'function' && isCoachMode())) return '';
  return `<div class="xswitch"><button type="button" data-xmode="player" class="${isExtreme() ? '' : 'on'}">TourLife</button><button type="button" data-xmode="extreme" class="xm ${isExtreme() ? 'on' : ''}">TourLife Extreme</button></div>`;
}
function cbHome() {
  for (const id of ['home', 'creator']) {
    const host = $(id); if (!host) continue;
    let sw = host.querySelector('.xswitch');
    const html = cbSwitchHtml();
    if (!html) { if (sw) sw.remove(); continue; }
    if (!sw) { host.insertAdjacentHTML('afterbegin', html); } else sw.outerHTML = html;
  }
  if (!isExtreme()) return;
  document.body.classList.add('xmode');
  const ovr = $('hOvr'); if (!ovr) return;
  let card = $('cbHome');
  if (!card) { ovr.insertAdjacentHTML('afterend', '<section class="card xbhome" id="cbHome"></section>'); card = $('cbHome'); }
  const d = cbData();
  card.innerHTML = `<h2>🎯 Court Breaker Practice</h2><div class="xbmodes">${Object.entries(CB_MODES).map(([k, M]) =>
    `<button type="button" data-cbp="${k}"><b>${M.icon} ${M.name}</b><small>${M.sub}${k === 'duel' ? ` · Level ${d.duel}` : d.best[k] ? ` · Best ${d.best[k]}` : ''}</small></button>`).join('')}</div>` +
    `<div class="xbopts"><label class="chk"><input type="checkbox" id="cbFeed" ${d.feedback ? 'checked' : ''}> Point Feedback</label><button type="button" class="link" data-cbp="book">📖 Playbook</button><button type="button" class="link" data-cbp="howto">How To Play</button></div>` +
    `<p class="hint">Practice doesn't change your stats, money or fitness. Your matches are played the same way, every point.</p>`;
  card.onclick = e => { const b = e.target.closest('[data-cbp]'); if (!b) return; if (b.dataset.cbp === 'howto') cbTutorial('turns', true); else if (b.dataset.cbp === 'book') { if (window.xpPlaybook) xpPlaybook(); } else cbPractice(b.dataset.cbp); };
  $('cbFeed').onchange = e => { const x = cbData(); x.feedback = e.target.checked; cbSave(x); };
}
document.addEventListener('click', e => { const b = e.target.closest('[data-xmode]'); if (!b || b.classList.contains('on')) return; try { localStorage.setItem('tourlife.mode', b.dataset.xmode); } catch {} location.reload(); });

// --- God Panel (owner only: Extreme + local link + admin) ------------------------------------------------------
function cbGodSave(k, v) { const d = cbData(); d.god[k] = v; cbSave(d); }
function cbGodPanel() {
  if (!cbGod()) return;
  const p = current.player, c = current.career, g = cbData().god, inEvent = !!(current.entry && !current.entry.result);
  const keys = [['serve', 'Serve Power'], ['ground', 'Groundstrokes'], ['ret', 'Return Quality'], ['net', 'Net Proficiency'], ['stam', 'Stamina'], ['mental', 'Mental Resilience'], ['iq', 'Tennis IQ']];
  openModal(`<button type="button" class="x" id="gdX" aria-label="Close">×</button><h2 class="itop">⚡ God Panel</h2><p class="hint center">Test tools for TourLife Extreme. Only you can see this.</p>` +
    (p ? `<details class="card fold" open><summary class="foldhead"><span class="foldt">📊 Your Stats</span><i class="foldchev"></i></summary><div class="foldbody">${keys.map(([k, l]) =>
      `<label class="gdrow">${l}<input type="range" min="20" max="99" value="${Math.round(attr(p, k))}" data-gk="${k}"><b>${Math.round(attr(p, k))}</b></label>`).join('')}
      <div class="btn-row"><button type="button" class="btn small ghost" data-gd="all99">All 99</button><button type="button" class="btn small ghost" data-gd="all50">All 50</button></div></div></details>` : '') +
    (c ? `<details class="card fold"><summary class="foldhead"><span class="foldt">💰 Money</span><i class="foldchev"></i></summary><div class="foldbody">
      <label class="chk"><input type="checkbox" data-gt="money" ${g.money ? 'checked' : ''}> Infinite Money</label><button type="button" class="btn small ghost" data-gd="cash">Add $1,000,000</button></div></details>
      <details class="card fold"><summary class="foldhead"><span class="foldt">📅 Schedule</span><i class="foldchev"></i></summary><div class="foldbody">
      <label class="chk"><input type="checkbox" data-gt="anyEvent" ${g.anyEvent ? 'checked' : ''}> Enter Any Event (No Ranking Needed)</label>
      <div class="btn-row"><button type="button" class="btn small ghost" data-gd="week1" ${inEvent ? 'disabled' : ''}>Skip 1 Week</button><button type="button" class="btn small ghost" data-gd="week4" ${inEvent ? 'disabled' : ''}>Skip 4 Weeks</button></div>
      ${inEvent ? '<p class="hint">Finish this event to skip weeks.</p>' : ''}<button type="button" class="btn small ghost" data-gd="rest">Reset Fatigue</button></div></details>` : '') +
    `<details class="card fold"><summary class="foldhead"><span class="foldt">🎾 Court Breaker</span><i class="foldchev"></i></summary><div class="foldbody">
      <label class="gdrow">Practice Opponent<select data-gs="oppStyle"><option value="">Random Playstyle</option>${STYLES.map(s => `<option ${g.oppStyle === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}</select></label>
      <label class="gdrow">Opponent Level<input type="range" min="-8" max="16" value="${g.oppLevel ?? 0}" data-gl><b>${g.oppLevel ?? 'Auto'}</b></label><button type="button" class="link" data-gd="autolevel">Back To Auto Level</button>
      <label class="chk"><input type="checkbox" data-gt="surface" ${g.surface ? 'checked' : ''}> Choose Practice Surface</label><select data-gs="surface">${['hard', 'clay', 'grass'].map(s => `<option ${g.surface === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div></details>`, { wide: true, onClose: () => { if (current.player && !current.entry) { renderTournaments(current.player); } } });
  $('gdX').onclick = closeModal;
  const box = $('modal') || document.querySelector('.modal') || document.body;
  box.querySelectorAll('[data-gk]').forEach(r => { r.oninput = () => { r.nextElementSibling.textContent = r.value; p.attrs[r.dataset.gk] = +r.value; if (p.baseAttrs) delete p.baseAttrs; writeJSON(SAVE_KEY, p); }; });
  box.querySelectorAll('[data-gt]').forEach(x => { x.onchange = () => { if (x.dataset.gt === 'surface') cbGodSave('surface', x.checked ? (box.querySelector('[data-gs="surface"]').value || 'hard') : null); else cbGodSave(x.dataset.gt, x.checked); if (x.dataset.gt === 'money' && x.checked) { c.money = Math.max(c.money || 0, 1e7); writeJSON(CAREER_KEY, c); } }; });
  box.querySelectorAll('[data-gs]').forEach(x => { x.onchange = () => cbGodSave(x.dataset.gs, x.value || null); });
  const lv = box.querySelector('[data-gl]'); if (lv) lv.oninput = () => { lv.nextElementSibling.textContent = lv.value; cbGodSave('oppLevel', +lv.value); };
  box.querySelectorAll('[data-gd]').forEach(b => { b.onclick = () => {
    const k = b.dataset.gd;
    if (k === 'all99' || k === 'all50') { for (const [a] of keys) p.attrs[a] = k === 'all99' ? 99 : 50; writeJSON(SAVE_KEY, p); closeModal(); cbGodPanel(); }
    if (k === 'cash') { c.money = (c.money || 0) + 1e6; writeJSON(CAREER_KEY, c); toast('⚡ God Panel', 'Added $1,000,000.'); }
    if (k === 'rest') { p.fatigue = 0; writeJSON(SAVE_KEY, p); toast('⚡ God Panel', 'Fatigue reset.'); }
    if (k === 'week1' || k === 'week4') { closeModal(); for (let i = 0; i < (k === 'week4' ? 4 : 1); i++) { if (current.entry && !current.entry.result) break; advanceWeek(); } }
    if (k === 'autolevel') { cbGodSave('oppLevel', null); closeModal(); cbGodPanel(); }
  }; });
}
// In a match or practice: win or lose the point now, or the rest of the set.
function cbGodMatchMenu(U) {
  U.setPause(true);
  openModal(`<h2 class="itop">⚡ God Panel</h2><div class="btn-row"><button type="button" class="btn" data-gm="win">Win This Point</button><button type="button" class="btn ghost" data-gm="lose">Lose This Point</button></div>` +
    (cbMatchU === U ? `<div class="btn-row"><button type="button" class="btn ghost" data-gm="winset">Win The Rest Of The Set</button><button type="button" class="btn ghost" data-gm="loseset">Lose The Rest Of The Set</button></div>` : ''), { onClose: () => U.setPause(false) });
  document.querySelectorAll('[data-gm]').forEach(b => { b.onclick = () => {
    const k = b.dataset.gm; closeModal();
    if (k === 'winset' || k === 'loseset') U.godAuto = k === 'winset' ? 'win' : 'lose';
    if (U.godReq) U.godReq(k.startsWith('win') ? 'win' : 'lose');
  }; });
}
function cbGodButton() {
  let b = $('cbGodBtn');
  if (!cbGod()) { if (b) b.remove(); return; }
  if (!b) { document.body.insertAdjacentHTML('beforeend', '<button type="button" id="cbGodBtn" class="xbgodbtn" aria-label="God Panel">⚡</button>'); b = $('cbGodBtn'); b.onclick = cbGodPanel; }
}

// --- Hooks into the career (Extreme only; normal TourLife is left exactly as it is) ---------------------------------
if (isExtreme()) {
  // Test link only: any error shows as a red bar at the bottom, so the owner can screenshot it for a fix.
  const cbErr = (msg, where) => { let b = document.getElementById('xbErr');
    if (!b) { b = document.createElement('div'); b.id = 'xbErr'; b.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99;background:#b71c1c;color:#fff;font:14px/1.35 system-ui;padding:10px 12px;border-radius:10px;white-space:pre-wrap'; b.onclick = () => b.remove(); (document.body || document.documentElement).appendChild(b); }
    b.textContent = `Something broke (screenshot this for Claude, tap to hide):\n${msg}\n${where || ''}`; };
  // Only the game's own errors: browser extensions (chrome-extension://…) throw into the page too.
  const ours = where => !/extension:\/\//.test(where || '') && (!where || where.includes(location.origin) || !/:\/\//.test(where));
  window.addEventListener('error', e => { if (ours(e.filename)) cbErr(e.message, `${(e.filename || '').split('/').pop()}:${e.lineno}`); });
  window.addEventListener('unhandledrejection', e => { const st = String(e.reason && e.reason.stack || ''); if (ours(st)) cbErr(String(e.reason && e.reason.message || e.reason), st.split('\n').slice(1, 3).join(' ')); });
  if (sessionStorage.getItem('tourlife.xbToDraw')) { sessionStorage.removeItem('tourlife.xbToDraw'); window.addEventListener('load', () => setTimeout(() => { if (current.entry && typeof openDraw === 'function') openDraw(); }, 300)); }
  document.body.classList.add('xmode'); // hides the game plan screens (you call every shot yourself)
  // Home: the practice card and the switch, each time Home is drawn.
  if (typeof homeSums === 'function') { const _hs = homeSums; homeSums = function (...a) { const r = _hs.apply(this, a); try { cbHome(); cbGodButton(); } catch (e) { console.error(e); } return r; }; }
  // God Panel: infinite money and entering any event.
  if (typeof charge === 'function') { const _ch = charge; charge = function (c, ...a) { _ch(c, ...a); if (cbGodOn('money')) c.money = Math.max(c.money, 1e7); }; }
  if (typeof eligibility === 'function') { const _el = eligibility; eligibility = function (ev, rank) { return cbGodOn('anyEvent') ? 'main' : _el(ev, rank); }; }
}
// The switch shows on the creator and Home for both modes (on the local link only).
cbHome(); cbGodButton();
setTimeout(() => { cbHome(); cbGodButton(); }, 400);
