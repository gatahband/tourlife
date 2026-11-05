// cbtouch.js — TourLife Extreme: "touch", a short mini-game for the shot you've just chosen. One button: the
// spacebar (or press and hold anywhere on the card on a phone or with a mouse). How well you time it decides how
// cleanly the shot comes off (cbsim.js reads st.touch). Pressure, tiredness, big points and aiming at the lines all
// tighten the timing. Only on shots you build yourself: a called play still runs at full speed.
(() => {
  if (typeof isExtreme !== 'function' || !isExtreme()) return;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const GAMES = {
    drop:    { name: 'The Scoop', how: 'Tap as the ball kisses the strings' },
    flat:    { name: 'The Contact', how: 'Hold to load the power · let go in the green' },
    topspin: { name: 'The Contact', how: 'Hold to load the spin · let go in the green' },
    slice:   { name: 'The Contact', how: 'Hold to take it high · let go in the green' },
    lob:     { name: 'The Lift', how: 'Hold to lift · let go in the green band' },
    serve:   { name: 'The Toss', how: 'Press in the green to toss · let go in the green to hit' },
  };
  const touchOn = () => cbData().touch !== false;
  window.xpTouchOn = touchOn;

  // --- Drawing: a proper racket and ball, to the same standard as the players ---------------------------------------
  function racketPro(g, x, y, ang, s, paint, faceTilt = 1) {
    // x,y: centre of the head; ang: direction the handle points; s: head radius in px; faceTilt: 1 = face on, 0.3 = edge-on
    g.save(); g.translate(x, y); g.rotate(ang);
    const rx = s * faceTilt, ry = s * 1.22, L = s * 2.7;
    // handle and grip (wrapped), then the open throat
    g.lineCap = 'round';
    g.strokeStyle = '#2a2f36'; g.lineWidth = s * 0.2; g.beginPath(); g.moveTo(0, ry * 0.95); g.lineTo(0, ry + L * 0.42); g.stroke();
    const gy0 = ry + L * 0.42, gy1 = ry + L * 0.8;
    g.strokeStyle = '#111'; g.lineWidth = s * 0.26; g.beginPath(); g.moveTo(0, gy0); g.lineTo(0, gy1); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.2;
    for (let k = gy0 + 3; k < gy1 - 2; k += s * 0.13) { g.beginPath(); g.moveTo(-s * 0.12, k); g.lineTo(s * 0.12, k + s * 0.07); g.stroke(); }
    g.fillStyle = '#e6e6e6'; g.beginPath(); g.ellipse(0, gy1, s * 0.15, s * 0.06, 0, 0, 7); g.fill();
    const fr = XL.fill(g, paint, -rx, -ry, rx, ry);
    g.strokeStyle = fr; g.lineWidth = s * 0.11;
    g.beginPath(); g.moveTo(-rx * 0.45, ry * 0.86); g.quadraticCurveTo(-s * 0.06, ry * 1.12, 0, ry + s * 0.42); g.quadraticCurveTo(s * 0.06, ry * 1.12, rx * 0.45, ry * 0.86); g.stroke();
    // strings, clipped to the head
    g.save(); g.beginPath(); g.ellipse(0, 0, rx * 0.92, ry * 0.93, 0, 0, 7); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(-rx, -ry, rx * 2, ry * 2);
    g.strokeStyle = 'rgba(235,240,245,0.55)'; g.lineWidth = Math.max(0.6, s * 0.022);
    for (let i = -7; i <= 7; i++) { const xx = i * rx / 8; g.beginPath(); g.moveTo(xx, -ry); g.lineTo(xx, ry); g.stroke(); }
    for (let i = -9; i <= 9; i++) { const yy = i * ry / 10; g.beginPath(); g.moveTo(-rx, yy); g.lineTo(rx, yy); g.stroke(); }
    g.restore();
    // frame with a highlight
    g.strokeStyle = fr; g.lineWidth = s * 0.16; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = s * 0.04; g.beginPath(); g.ellipse(0, 0, rx * 1.02, ry * 1.02, 0, Math.PI * 1.1, Math.PI * 1.55); g.stroke();
    if (paint === 'gold') { g.fillStyle = 'rgba(255,250,210,0.9)'; g.beginPath(); g.arc(rx * 0.55, -ry * 0.7, s * 0.08, 0, 7); g.fill(); }
    g.restore();
  }
  function ballPro(g, x, y, r, spin = 0, glow = 0) {
    if (glow) { const gl = g.createRadialGradient(x, y, r, x, y, r * 3.2); gl.addColorStop(0, `rgba(230,255,90,${0.35 * glow})`); gl.addColorStop(1, 'rgba(230,255,90,0)'); g.fillStyle = gl; g.beginPath(); g.arc(x, y, r * 3.2, 0, 7); g.fill(); }
    const b = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.15, x, y, r);
    b.addColorStop(0, '#f6ff9a'); b.addColorStop(0.6, '#dcf03a'); b.addColorStop(1, '#9fb31a');
    g.fillStyle = b; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.clip(); g.translate(x, y); g.rotate(spin);
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = Math.max(1, r * 0.14);
    g.beginPath(); g.arc(-r * 1.05, 0, r * 0.82, -0.9, 0.9); g.stroke(); g.beginPath(); g.arc(r * 1.05, 0, r * 0.82, Math.PI - 0.9, Math.PI + 0.9); g.stroke();
    g.restore();
  }
  const roundRect = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

  // --- The card -----------------------------------------------------------------------------------------------
  function card(U) {
    let el = U.el.querySelector('.xpmini');
    if (!el) {
      U.el.querySelector('.xpstage').insertAdjacentHTML('beforeend', '<div class="xpmini" hidden><div class="xpmhead"><b></b><span></span></div><canvas></canvas><div class="xpmkey"></div></div>');
      el = U.el.querySelector('.xpmini');
    }
    return el;
  }
  // Grades: a word, a colour, and whether it was early / late (for the shot's effect).
  const grade = (q, early, words) => q >= 0.85 ? ['PERFECT', '#7CFFB2'] : q >= 0.6 ? ['GOOD', '#ffd54f'] : [early ? words[0] : words[1], q >= 0.3 ? '#ffb74d' : '#ff6b6b'];

  // Plays the mini-game for shot ch ({ type, aim }) and resolves with { q (0..1), early, label }.
  window.xpAskTouch = (U, st, ch) => new Promise(res => {
    const type = ch.type === 'drop' || (ch.type === 'slice' && Math.abs(ch.aim.y) < 4.8 && !(st.inc && st.inc.volley)) ? 'drop' : ch.type;
    const G = GAMES[type] || GAMES.topspin, el = card(U), cv = el.querySelector('canvas');
    const edge = Math.min(CB.HW - Math.abs(ch.aim.x), CB.HL - Math.abs(ch.aim.y));
    // How hard the timing is: mostly the shot's own risk (its chance of going in, the same number behind the risk
    // word you saw), then pressure, tired legs and the score. A serve: how big a serve you went for.
    const pIn = type === 'serve' ? ({ flat: st.serve2 ? 0.7 : 0.6, slice: 0.8, kick: 0.92 }[ch.spin] || 0.8) : cbValue(st, 0, ch.aim, ch.type, ch.move === 'net').pIn;
    const riskD = clamp((0.97 - pIn) / 0.45, 0, 1);
    const d = clamp(0.75 * riskD + 0.3 * Math.min(1, st.pr[0]) + 0.25 * ((st.tired || [])[0] || 0) + 0.25 * ((st.clutch || [])[0] || 0), 0, 0.95);
    const [rw, rc] = window.xpRiskWord ? xpRiskWord(pIn) : ['', ''];
    const paint = XL.resolve(current.player && current.player.look).racket;
    const phone = matchMedia('(hover: none)').matches;
    el.querySelector('b').textContent = `${type === 'serve' ? `${{ flat: 'Flat', slice: 'Slice', kick: 'Kick' }[ch.spin] || ''} Serve` : { drop: 'Drop Shot', flat: 'Flat', topspin: 'Topspin', slice: 'Slice', lob: 'Lob' }[type]} · ${G.name}`;
    el.querySelector('span').innerHTML = `${G.how}${rw ? ` · <u class="${rc}">${rw}</u>` : ''}`;
    el.querySelector('.xpmkey').innerHTML = phone ? 'Tap / hold anywhere' : '<kbd>Space</kbd>';
    el.hidden = false;
    // Every game is drawn on a 460 × 220 stage and scaled to however big the card is (much bigger on a computer), so
    // the racket, ball and text all grow together and stay sharp.
    const W = 460, H = 220, r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, k = (r.width || W) / W;
    cv.width = Math.round(W * k * dpr); cv.height = Math.round(H * k * dpr);
    const g = cv.getContext('2d'); g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    const t0 = performance.now(); let held = false, pressAt = null, relAt = null, done = null, alive = true;
    const now = () => (performance.now() - t0) / 1000;
    // Timed from the moment the key or finger actually went down (the event's own clock), not the next frame.
    const evT = e => (e && e.timeStamp > 0 && Math.abs(e.timeStamp - performance.now()) < 500 ? (e.timeStamp - t0) / 1000 : now());
    const press = e => { if (done || held) return; held = true; pressAt = evT(e); game.press && game.press(pressAt); };
    const release = e => { if (done || !held) return; held = false; relAt = evT(e); game.release && game.release(relAt); };
    const kd = e => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) press(e); } };
    const ku = e => { if (e.code === 'Space') { e.preventDefault(); release(e); } };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    // Touch: tap or hold anywhere on the match screen (except the buttons along the top), not just on the card.
    const ov = U.el, pd = e => { if (e.target.closest && e.target.closest('.xptopb, .xpdrop, button')) return; e.preventDefault(); press(e); }, pu = e => release(e);
    ov.addEventListener('pointerdown', pd); ov.addEventListener('pointerup', pu); ov.addEventListener('pointercancel', pu);
    const finish = (q, early, words) => { if (done) return; const [label, col] = grade(q, early, words); done = { q, early, label, col, at: now() }; };

    // Background: a dark glass panel with a faint court underneath.
    const bg = () => {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#13202d'); gr.addColorStop(1, '#0b141c');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
      for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(0, H * i / 6); g.lineTo(W, H * i / 6); g.stroke(); }
    };
    // The timing meter along the bottom of every timing game. It fades in a moment before its marker sets off, so
    // there's time to get ready; then the marker slides at a steady speed and crosses the green window at the exact
    // moment to act (the white tick is perfect). A riskier shot: a narrower window and a quicker marker.
    const span0 = 0.95 * (1 - 0.65 * d);
    const meter = (t, ideal, tol, pressT, word, holding = false, span = span0, lead = 0.55) => {
      const x0 = 40, x1 = W - 40, y = H - 13, t0m = ideal - span, t1m = ideal + 0.3, X = tt => x0 + (x1 - x0) * clamp((tt - t0m) / (t1m - t0m), 0, 1);
      const a = clamp((t - (t0m - lead)) / 0.25, 0, 1); if (a <= 0) return;
      g.save(); g.globalAlpha = a;
      g.fillStyle = 'rgba(5,10,15,0.78)'; roundRect(g, x0 - 12, y - 11, x1 - x0 + 24, 22, 11); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.10)'; roundRect(g, x0, y - 3, x1 - x0, 6, 3); g.fill();
      const good = tol * 0.96, gx0 = X(ideal - good), gx1 = X(ideal + good);
      g.fillStyle = 'rgba(255,152,0,0.8)'; roundRect(g, X(ideal - tol * 2.4), y - 4, X(ideal + tol * 2.4) - X(ideal - tol * 2.4), 8, 3); g.fill(); // just off: orange
      g.fillStyle = '#3ddc84'; roundRect(g, gx0, y - 6, Math.max(6, gx1 - gx0), 12, 4); g.fill();
      g.fillStyle = '#fff'; g.fillRect(X(ideal) - 1, y - 6, 2, 12);
      g.fillStyle = 'rgba(124,255,178,0.95)'; g.font = '800 9px system-ui'; g.textAlign = 'center'; g.fillText(word, X(ideal), y - 9);
      const mt = pressT != null ? pressT : t, mx = X(mt);
      const col = pressT != null ? (Math.abs(pressT - ideal) <= good ? '#7CFFB2' : Math.abs(pressT - ideal) <= tol * 2.4 ? '#ffb74d' : '#ff6b6b') : holding ? '#ffd54f' : '#fff';
      g.shadowColor = col; g.shadowBlur = 8; g.fillStyle = col; roundRect(g, mx - 2, y - 10, 4, 20, 2); g.fill();
      g.restore();
    };
    let game;
    if (type === 'serve') {
      // THE TOSS: press to toss, press again to hit as the ball passes the marker. Flat: right at the top. Kick: on the
      // way up, brushing up the back. Slice: just after the top. The racket swings in one arc around the shoulder:
      // resting, cocked behind as the ball goes up, then up through the ball and down across in the follow-through.
      const spin = ch.spin || 'flat', ta = 0.85 * (1 - 0.3 * d), ideal = ta + ({ flat: 0, kick: -0.15, slice: 0.12 }[spin] || 0) * (1 - 0.3 * d), tol = 0.075 * (1 - 0.85 * d);
      const hx = W * 0.5, base = H - 40, topY = 24, tossH = u => (u <= ta ? 1 - (1 - u / ta) ** 2 : Math.max(0, 1 - ((u - ta) / ta) ** 2));
      const yOf = u => base - tossH(u) * (base - topY), zy = yOf(ideal);
      if (window.__xpTest) window.__xpTest.ideal = { hit: ideal, toss: 0.9 };
      const R = 66, aC = -Math.PI * 0.56, piv = { x: hx - R * Math.cos(aC), y: zy - R * Math.sin(aC) };
      const A_REST = Math.PI * 0.3, A_COCK = Math.PI * 0.58, A_END = aC - Math.PI * 0.85;
      const head = a => ({ x: piv.x + R * Math.cos(a), y: piv.y + R * Math.sin(a) });
      const drawRacket = a => { const h = head(a); racketPro(g, h.x, h.y, Math.atan2(piv.y - h.y, piv.x - h.x) - Math.PI / 2, 17, paint, 0.6); };
      const ease = x => x * x * (3 - 2 * x), key = el.querySelector('.xpmkey');
      let toss = null, hitAt = null, hitU = 0, tossQ = 1;
      // Meter one, the rhythm: before the toss a marker swings to and fro; press as it crosses the green for a clean toss.
      const per = 1.3 * (1 - 0.3 * d), rw = 0.09 * (1 - 0.5 * d), osc = t => 0.5 + 0.5 * Math.sin(2 * Math.PI * (t - 0.9) / per); // first crosses the green 0.9 s in: time to get ready
      const setKey = () => { key.innerHTML = phone ? (toss == null ? 'Press and hold in the green to toss' : 'Let go in the green') : toss == null ? 'Press and hold <kbd>Space</kbd> in the green' : 'Let go in the green'; };
      setKey();
      game = {
        press: t => { if (toss == null) { toss = t; tossQ = clamp(1 - Math.abs(osc(t) - 0.5) / (rw * 2.4), 0, 1); setKey(); } }, // press and hold: the toss goes up
        release: t => { // let go: the swing
          if (toss == null || hitAt != null) return;
          hitAt = t; hitU = t - toss; const dt = hitU - ideal; const bad = Math.abs(dt) > tol * 0.96 && tossQ < 0.3; finish(bad ? 0 : 0.6 * clamp(1 - Math.abs(dt) / (tol * 2.4), 0, 1) + 0.4 * tossQ, dt < 0, ['EARLY', 'LATE']);
        },
        draw: t => {
          bg();
          // the toss line and the marker where this serve wants hitting
          g.setLineDash([2, 6]); g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(hx, base); g.lineTo(hx, topY - 8); g.stroke(); g.setLineDash([]);
          const glow = toss != null && hitAt == null && Math.abs((t - toss) - ideal) < tol;
          g.strokeStyle = glow ? '#7CFFB2' : 'rgba(124,255,178,0.6)'; g.lineWidth = 3; g.lineCap = 'round';
          g.beginPath(); g.moveTo(hx - 22, zy); g.lineTo(hx + 22, zy); g.stroke();
          g.fillStyle = 'rgba(124,255,178,0.85)'; g.font = '700 11px system-ui'; g.textAlign = 'right'; g.textBaseline = 'middle';
          g.fillText(spin === 'flat' ? 'AT THE TOP' : spin === 'kick' ? 'ON THE WAY UP ↑' : 'ON THE WAY DOWN ↓', hx - 30, zy); g.textBaseline = 'alphabetic';
          // the racket
          let a;
          if (hitAt == null) a = A_REST + (A_COCK - A_REST) * ease(toss == null ? 0 : clamp((t - toss) / (ta * 0.8), 0, 1));
          else { const k = t - hitAt; a = k < 0.09 ? A_COCK + (aC - 2 * Math.PI - A_COCK) * ease(k / 0.09) : aC - 2 * Math.PI + (A_END - aC) * ease(clamp((k - 0.09) / 0.3, 0, 1)); }
          if (hitAt != null && t - hitAt < 0.45) { // a faint arc of the swing
            g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 10; g.beginPath(); g.arc(piv.x, piv.y, R, a + 0.9, a, true); g.stroke();
          }
          drawRacket(a);
          // the ball: in the hand, up and down the line, then away off the strings
          const u = toss == null ? 0 : hitAt != null ? hitU : t - toss;
          let bx = hx, by = toss == null ? base : yOf(u);
          if (hitAt != null && t - hitAt > 0.09) {
            const k = clamp((t - hitAt - 0.09) / 0.35, 0, 1), off = done ? (1 - done.q) * (done.early ? -60 : 70) : 0;
            bx = hx - k * W * 0.55; by = yOf(hitU) - k * 26 + k * off;
            g.strokeStyle = 'rgba(230,255,90,0.3)'; g.lineWidth = 3; g.beginPath(); g.moveTo(hx, yOf(hitU)); g.lineTo(bx, by); g.stroke();
          }
          ballPro(g, bx, by, 8, t * 5, glow ? 1 : 0);
          if (!done && toss != null && t - toss > 2 * ta) finish(0.05, false, ['EARLY', 'DROPPED']);
          // the meter: before the toss it waits; after it, hit as the marker crosses the green
          if (toss == null) {
            const pulse = 0.65 + 0.35 * Math.sin(t * 5);
            g.globalAlpha = pulse; g.fillStyle = '#e8eef4'; g.font = '800 17px system-ui'; g.textAlign = 'center'; g.fillText('PRESS IN THE GREEN', W / 2 + 120, 80); g.globalAlpha = 1;
            const x0 = 40, x1 = W - 40, y = H - 13, u = osc(t), mx = x0 + (x1 - x0) * u;
            g.fillStyle = 'rgba(5,10,15,0.78)'; roundRect(g, x0 - 12, y - 11, x1 - x0 + 24, 22, 11); g.fill();
            g.fillStyle = 'rgba(255,152,0,0.8)'; roundRect(g, x0 + (x1 - x0) * (0.5 - rw * 2.4), y - 4, (x1 - x0) * rw * 4.8, 8, 3); g.fill();
            g.fillStyle = '#3ddc84'; roundRect(g, x0 + (x1 - x0) * (0.5 - rw), y - 6, (x1 - x0) * rw * 2, 12, 4); g.fill();
            g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8; roundRect(g, mx - 2, y - 10, 4, 20, 2); g.fill(); g.shadowBlur = 0;
          } else meter(t, toss + ideal, tol, hitAt, 'LET GO', true, ideal, 0);
        },
      };
    } else if (type === 'drop') {
      // THE SCOOP: the ball drops onto your strings; tap as it kisses them. Early floats it, late finds the net.
      const T = 1.6 - 0.25 * d, tol = 0.09 * (1 - 0.55 * d), rx = W / 2, ry = H - 62;
      if (window.__xpTest) window.__xpTest.ideal = { tap: T };
      let tapAt = null;
      game = {
        press: t => { tapAt = t; const dt = t - T; finish(clamp(1 - Math.abs(dt) / (tol * 2.4), 0, 1), dt < 0, ['EARLY', 'LATE']); },
        draw: t => {
          bg();
          const u = clamp(t / T, 0, 1.3), by = 26 + (ry - 26 - 10) * Math.min(1, u * u), after = done && tapAt != null ? t - tapAt : 0;
          const ballY = done ? by - Math.sin(Math.min(1, after / 0.45) * Math.PI) * (40 * (done.q > 0.6 ? 1 : 0.4)) - (done.early ? after * 60 : 0) : by;
          // approach ring: closes on the sweet spot exactly when the ball arrives
          const k = clamp((T - t) / T, 0, 1), inWin = Math.abs(t - T) < tol;
          g.strokeStyle = inWin ? 'rgba(124,255,178,0.95)' : 'rgba(255,255,255,0.55)'; g.lineWidth = 3;
          g.beginPath(); g.ellipse(rx, ry, 18 + 90 * k, (18 + 90 * k) * 0.32, 0, 0, 7); g.stroke();
          racketPro(g, rx, ry, -Math.PI / 2, 26, paint, 1.0); // seen from above-ish: face up
          g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(rx, ry, 9 * (0.5 + u * 0.5), 3.5, 0, 0, 7); g.fill();
          ballPro(g, rx, Math.min(ballY, ry - 8), 9, t * 3, inWin ? 1 : 0);
          if (!done && t > T + tol * 2.4) finish(0, false, ['EARLY', 'LATE']);
          meter(t, T, tol, tapAt, 'TAP');
        },
      };
    } else if (type === 'flat' || type === 'topspin' || type === 'slice') {
      // THE CONTACT: a 3D view from just behind you, looking down the court. Their ball comes in, bounces and rises
      // into the ring where you'll meet it: higher off a heavy topspin ball, low off a slice, on your forehand or
      // backhand side. The meter along the bottom says when: press (flat) or let go (topspin, slice) as its marker
      // crosses the green. Flat swings straight through; topspin drops under and brushes up over the shoulder; slice
      // starts high and cuts down and through. When the strings meet the ball sets its launch, then you watch it fly.
      const lerp = (a, b, u) => a + (b - a) * u, rad = Math.PI / 180, L3 = (a, b, u) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u) });
      const Q3 = (a, c, b, u) => L3(L3(a, c, u), L3(c, b, u), u); // a curved path through a control point
      // A TV-style camera: 7 m up, 8 m behind you, tilted 20° down. Your contact area sits about two-thirds down the
      // card and their baseline near the top, so nothing important hugs the bottom edge.
      const cam = { z: -8, y: 7 }, cp = Math.cos(20 * rad), sn = Math.sin(20 * rad);
      const raw = (y, z) => { const dz = z - cam.z, dy = y - cam.y, dd = dz * cp - dy * sn; return { dd, v: dz * sn + dy * cp }; };
      const rA = raw(1.0, 0.7), rB = raw(0, 24), Fv = (H * 0.5) / (rB.v / rB.dd - rA.v / rA.dd), Y0 = H * 0.12 + Fv * rB.v / rB.dd;
      // Where you meet it: forehand or backhand side (mirrored for a lefty), and the height their ball gets to.
      const inc = st.inc || {}, hand = st.ab[0].lefty ? -1 : 1, sx = (inc.wing === 'bh' ? -1 : 1) * hand;
      const cy = inc.volley ? 1.15 : ({ topspin: 1.3, flat: 0.95, slice: 0.62, lob: 1.5, drop: 0.55 }[inc.type] || 1.0);
      const C = { x: sx * 0.8, y: cy, z: 0.7 }, xs = C.x * 0.55; // the view leans a little towards your hitting side
      const P3 = (x, y, z) => { const r = raw(y, z), dd = Math.max(0.3, r.dd), s = Fv / dd; return { X: W / 2 + (x - xs) * s, Y: Y0 - Fv * r.v / dd, s }; };
      const tc = 2.0 - 0.3 * d, tol = 0.085 * (1 - 0.85 * d), swingT = 0.05; // the swing lands almost the moment you press
      // their ball: from where they are to a bounce, then up into your ring (a volley comes straight at you)
      const ox = st.pos && st.pos[1] ? clamp(-st.pos[1].x, -4, 4) : -1.6;
      const B0 = { x: ox, y: 1.1, z: 24 }, BB = { x: C.x * 0.6, y: 0, z: 6.6 }, tb = tc * 0.62;
      const ballIn = t => {
        if (inc.volley) { const u = t / tc; return { x: lerp(B0.x, C.x, u), z: lerp(B0.z, C.z, u), y: lerp(B0.y, C.y, u) + 0.8 * 4 * u * (1 - u) }; }
        if (t <= tb) { const u = t / tb; return { x: lerp(B0.x, BB.x, u), z: lerp(B0.z, BB.z, u), y: lerp(B0.y, 0, u) + 2.3 * 4 * u * (1 - u) }; }
        const u = (t - tb) / (tc - tb); return { x: lerp(BB.x, C.x, u), z: lerp(BB.z, C.z, u), y: Math.max(0, lerp(0, C.y, u) + 0.9 * 4 * u * (1 - u)) };
      };
      // the ball's flight off your strings: speed and how much spin bends it (topspin pulls it down, slice holds it up)
      const V = { flat: 26, topspin: 23, slice: 19 }[type], tgt = { x: ch.aim.x, z: ch.aim.y + 12 };
      const gOf = sp => 9.8 + (type === 'topspin' ? 3 + 10 * sp : type === 'slice' ? -2.5 : 0);
      const fly = (th, sp) => {
        const g0 = gOf(sp), vz = V * Math.cos(th * rad), vy = V * Math.sin(th * rad), tn = (12 - C.z) / vz, yn = C.y + vy * tn - 0.5 * g0 * tn * tn;
        const tl = (vy + Math.sqrt(vy * vy + 2 * g0 * C.y)) / g0; return { net: yn < 0.98, tn, tl, zl: C.z + vz * tl, vz, vy, g0 };
      };
      const sp0 = 0.6; let thA = null, thB = null, thT = null;
      for (let th = -5; th < 45; th += 0.05) { const f = fly(th, sp0), ok = !f.net && f.zl <= 24.1; if (ok && thA == null) thA = th; if (ok) thB = th; if (thT == null && !f.net && f.zl >= tgt.z) thT = th; }
      if (thA == null) { thA = 5; thB = 8; } if (thT == null) thT = (thA + thB) / 2;
      const th0 = Math.min(Math.max(thT, thA + (thB - thA) * 0.3), thB - (thB - thA) * 0.3);
      const tiltK = ({ flat: 18 + 40 * riskD, slice: 25 + 45 * riskD, topspin: 35 + 60 * riskD })[type];
      // The swing, relative to the contact point (dx is towards your hitting side): where the racket waits, where it
      // takes back to, the bend of the path into the ball, and the finish.
      const at = (dx, dy, dz) => ({ x: C.x + sx * dx, y: C.y + dy, z: C.z + dz });
      const SW = {
        flat:    { back: at(1.0, 0.1, -1.2), into: at(0.9, 0.0, -0.1), out: at(-0.6, 0.15, 1.0), end: at(-1.7, 0.45, 0.1), face: 0.3 },
        topspin: { back: at(0.9, -0.7, -1.0), into: at(0.7, -0.45, 0.0), out: at(-0.5, 0.6, 0.8), end: at(-1.2, 1.2, -0.2), face: 0.45 },
        slice:   { back: at(0.7, 0.9, -1.0), into: at(0.6, 0.45, -0.2), out: at(-0.3, -0.25, 1.2), end: at(-0.9, -0.45, 0.9), face: 0.8 },
      }[type];
      const READY = at(0.45, 0.05, -0.7), SHOULDER = { x: sx * 0.15, y: 1.35, z: -0.6 };
      let mode = 'idle', loadAt = null, depth = 0, swingAt = null, flight = null, from = READY;
      const spinQ = sp => clamp(1 - Math.abs(sp - 0.62) / (0.12 * (1 - 0.4 * d) * 2.4), 0, 1);
      // Where the marker stopped decides the shot. Green: it goes in. Orange (just off): a normal shot still goes in,
      // only less cleanly; a risky one usually goes out, now and then it squeaks in. Off the meter: a real chance of an
      // error, bigger the riskier the shot. The flight you see is the result: in, into the net (late) or long (early).
      const strike = t => {
        const dt = t - tc, qt = clamp(1 - Math.abs(dt) / (tol * 2.4), 0, 1), sp = type === 'topspin' ? depth : sp0;
        const spinOff = spinQ(depth) < 0.3; // the load meter (spin, power or cut) way off
        let zone = Math.abs(dt) <= tol * 0.36 ? -1 : Math.abs(dt) <= tol * 0.96 ? 0 : qt > 0 ? 1 : 2; // -1: the white tick, perfect
        if (spinOff) zone = Math.min(2, zone + 1);
        // A big risk needs a near-perfect strike: just green can still miss, orange usually does.
        const errP = zone === -1 ? 0.25 * riskD ** 2 : zone === 0 ? 0.7 * riskD ** 1.5 : zone === 1 ? Math.min(0.97, 0.06 + 0.95 * riskD) : 0.5 + 0.5 * riskD;
        // Both meters wrong is never forgiven: it's a miss. One right still gets you a playable ball.
        const err = (zone >= 1 && spinOff) || Math.random() < errP, safe = [thA + (thB - thA) * 0.18, thB - (thB - thA) * 0.18];
        let th = th0 - dt * tiltK + (type === 'topspin' ? (0.62 - depth) * 4 : (depth - 0.62) * 3); // more power or cut: it flies further
        const long = dt < 0 || (spinOff && (type === 'topspin' ? depth < 0.62 : depth > 0.62));
        th = err ? (long ? Math.max(th, thB + 1.5) : Math.min(th, thA - 1.5)) : clamp(th, safe[0], safe[1]);
        const f = fly(th, sp), res = f.net ? 'net' : f.zl > 24.1 ? 'long' : 'in';
        const wide = tgt.x * (dt < 0 ? 1 + 1.2 * -dt : 1 - 1.2 * dt);
        let q = 0.65 * qt + 0.35 * spinQ(depth); // both meters: the release and the load
        if (res !== 'in') q = Math.min(q, 0.25); else q = Math.max(q, zone === 2 ? 0.15 : 0.3);
        flight = { at: t, f, res, wide, sp, rpm: type === 'topspin' ? Math.round((900 + 3300 * depth) / 10) * 10 : 0 };
        const lw = { topspin: ['NO SPIN', 'TOO MUCH SPIN'], flat: ['NO POWER', 'TOO MUCH POWER'], slice: ['NO BITE', 'TOO MUCH CUT'] }[type][depth < 0.62 ? 0 : 1];
        const words = res === 'net' ? ['NET', 'NET'] : res === 'long' ? ['LONG', 'LONG'] : spinOff ? [lw, lw] : ['EARLY', 'LATE'];
        finish(q, dt < 0, words); done.spin = sp; done.flight = res; done.load = depth;
      };
      const ideal = tc - swingT; // when to press (flat) or let go (topspin, slice)
      if (window.__xpTest) window.__xpTest.ideal = { release: ideal, hold: 0.62 * 0.75 };
      const key = el.querySelector('.xpmkey');
      key.innerHTML = phone ? 'Hold anywhere, let go in the green' : 'Hold <kbd>Space</kbd>, let go in the green';
      game = {
        press: t => { mode = 'load'; loadAt = t; },
        release: t => { if (mode === 'load') { mode = 'swing'; swingAt = t; } },
        draw: t => {
          const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0f1b26'); gr.addColorStop(1, '#0b141c'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
          const poly = (pts, fill) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.X, p.Y) : g.moveTo(p.X, p.Y)); g.closePath(); g.fillStyle = fill; g.fill(); };
          poly([P3(-7, 0, -1.5), P3(7, 0, -1.5), P3(7, 0, 26), P3(-7, 0, 26)], '#2c5a87');
          poly([P3(-5.485, 0, 0), P3(5.485, 0, 0), P3(5.485, 0, 23.77), P3(-5.485, 0, 23.77)], '#3a6ea5');
          g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.2;
          const Ln = (x1, z1, x2, z2) => { const a = P3(x1, 0, z1), b = P3(x2, 0, z2); g.beginPath(); g.moveTo(a.X, a.Y); g.lineTo(b.X, b.Y); g.stroke(); };
          Ln(-5.485, 23.77, 5.485, 23.77); Ln(-5.485, 0, 5.485, 0); for (const x of [-5.485, 5.485, -4.115, 4.115]) Ln(x, 0, x, 23.77); for (const z of [5.49, 18.28]) Ln(-4.115, z, 4.115, z); Ln(0, 5.49, 0, 18.28);
          const n1 = P3(-6.4, 0, 11.885), n2 = P3(6.4, 0, 11.885), t1 = P3(-6.4, 1.07, 11.885), t2 = P3(6.4, 1.07, 11.885), tm = P3(0, 0.914, 11.885);
          g.fillStyle = 'rgba(10,15,20,0.5)'; g.beginPath(); g.moveTo(n1.X, n1.Y); g.lineTo(n2.X, n2.Y); g.lineTo(t2.X, t2.Y); g.quadraticCurveTo(tm.X, tm.Y + 2, t1.X, t1.Y); g.closePath(); g.fill();
          g.strokeStyle = '#f4f4f4'; g.lineWidth = 2; g.beginPath(); g.moveTo(t1.X, t1.Y); g.quadraticCurveTo(tm.X, tm.Y + 2, t2.X, t2.Y); g.stroke();
          // the ring where you meet it, with a dotted drop line to the court so its height reads
          const cP = P3(C.x, C.y, C.z), cG = P3(C.x, 0, C.z), live = !flight && Math.abs(t - ideal) < tol * 0.96;
          g.setLineDash([3, 4]); g.strokeStyle = 'rgba(124,255,178,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cP.X, cP.Y); g.lineTo(cG.X, cG.Y); g.stroke(); g.setLineDash([]);
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cG.X, cG.Y, 10, 3, 0, 0, 7); g.fill();
          const rr = Math.max(13, 0.3 * cP.s);
          g.strokeStyle = live ? 'rgba(124,255,178,0.95)' : 'rgba(124,255,178,0.5)'; g.lineWidth = live ? 3 : 2;
          g.beginPath(); g.arc(cP.X, cP.Y, rr, 0, 7); g.stroke();
          // the racket: waits, takes back as their ball comes (topspin and slice load as you hold), swings along its own path
          if (mode === 'load') depth = clamp((t - loadAt) / 0.75, 0, 1.15);
          const ease = x => x * x * (3 - 2 * x);
          const takeBack = mode === 'idle' ? 0.25 * ease(clamp((t - 0.35) / 0.8, 0, 1)) : Math.min(1, depth / 0.62);
          const rp0 = L3(READY, SW.back, takeBack);
          if (!flight && mode === 'load' && t > tc + tol * 3) { mode = 'swing'; swingAt = t; }
          if (mode === 'swing' && from === READY) from = rp0; // the swing starts from wherever the racket was
          if (!flight && mode === 'swing' && t - swingAt >= swingT) strike(swingAt + swingT);
          if (!done && mode === 'idle' && t > tc + tol * 3) { flight = { res: 'miss' }; finish(0, false, ['EARLY', 'LATE']); done.flight = 'net'; }
          let rp = rp0, k = 0;
          if (mode === 'swing') {
            k = (t - swingAt) / swingT;
            rp = k < 1 ? Q3(from, SW.into, C, k * k) : Q3(C, SW.out, SW.end, 1 - (1 - clamp((k - 1) / 2.6, 0, 1)) ** 2);
          }
          const rP = P3(rp.x, rp.y, rp.z), shP = P3(SHOULDER.x, SHOULDER.y, SHOULDER.z);
          // the handle points back to your hand, so the racket face turns with the swing
          const hx = shP.X - rP.X, hy = shP.Y - rP.Y, ang = Math.atan2(-hx, hy);
          // the ball: incoming, then off your strings along its real flight
          let b = ballIn(t), bs = 0;
          if (flight && flight.f) {
            const u = (t - flight.at) * 0.85, f = flight.f, tEnd = flight.res === 'net' ? f.tn : f.tl;
            const tt = Math.min(u, tEnd), zz = C.z + f.vz * tt, xx = C.x + (flight.wide - C.x) * Math.min(1, (zz - C.z) / (tgt.z - C.z));
            b = { x: xx, z: zz, y: Math.max(0, C.y + f.vy * tt - 0.5 * f.g0 * tt * tt) }; bs = flight.sp;
            const ld = P3(xx, 0, zz);
            if (u >= tEnd && flight.res !== 'net') { g.strokeStyle = flight.res === 'long' ? '#ff6b6b' : '#7CFFB2'; g.lineWidth = 2; g.beginPath(); g.ellipse(ld.X, ld.Y, 6, 2.4, 0, 0, 7); g.stroke(); }
          }
          const sh = P3(b.x, 0, b.z), bp = P3(b.x, b.y, b.z);
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(sh.X, sh.Y, Math.max(2, 0.07 * sh.s), Math.max(1, 0.025 * sh.s), 0, 0, 7); g.fill();
          if (mode === 'swing' && k > 0.2 && k < 2.2) { // a soft blur along the swing path
            g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath();
            for (let i = 0; i <= 12; i++) { const kk = Math.max(0, k - 0.6) + (Math.min(k, 2.2) - Math.max(0, k - 0.6)) * i / 12, p = kk < 1 ? Q3(from, SW.into, C, kk * kk) : Q3(C, SW.out, SW.end, 1 - (1 - clamp((kk - 1) / 2.6, 0, 1)) ** 2), q = P3(p.x, p.y, p.z); i ? g.lineTo(q.X, q.Y) : g.moveTo(q.X, q.Y); }
            g.stroke();
          }
          const ballFirst = b.z > rp.z;
          if (ballFirst) ballPro(g, bp.X, bp.Y, Math.max(3.5, 0.09 * bp.s), t * (6 + bs * 30), live ? 1 : 0);
          racketPro(g, rP.X, rP.Y, ang, Math.max(14, 0.3 * rP.s), paint, SW.face);
          if (!ballFirst) ballPro(g, bp.X, bp.Y, Math.max(3.5, 0.09 * bp.s), t * (6 + bs * 30), live ? 1 : 0);
          // topspin: the spin meter fills as you hold (the green band is the sweet spot); RPM shows once you've hit it
          { // the load meter: spin, power or cut fills as you hold (the green band is the sweet spot)
            const mx = W - 26, my = H - 40, mh = 110, band = [0.62 - 0.12 * (1 - 0.4 * d), 0.62 + 0.12 * (1 - 0.4 * d)];
            g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(mx - 5, my - mh, 10, mh);
            g.fillStyle = 'rgba(124,255,178,0.55)'; g.fillRect(mx - 5, my - mh * band[1] / 1.15, 10, mh * (band[1] - band[0]) / 1.15);
            g.fillStyle = depth > band[1] ? '#ff8a65' : '#ffd54f'; g.fillRect(mx - 3, my - mh * Math.min(depth, 1.15) / 1.15, 6, mh * Math.min(depth, 1.15) / 1.15);
            g.fillStyle = '#9fb3c8'; g.font = '700 10px system-ui'; g.textAlign = 'center'; g.fillText({ topspin: 'SPIN', flat: 'POWER', slice: 'CUT' }[type], mx, my + 13);
            if (flight && flight.rpm) { g.fillStyle = '#e8eef4'; g.font = '800 14px system-ui'; g.textAlign = 'right'; g.fillText(`${flight.rpm.toLocaleString('en-US')} RPM`, mx - 14, my + 10); }
          }
          meter(t, ideal, tol, swingAt, 'LET GO', mode === 'load');
        },
      };
    } else {
      // THE LIFT: hold to lift the arc; let go when its peak clears their reach but stays inside the court.
      const reach = st.atNet[1] ? 0.55 : 0.32, top = 0.86, band = [reach + 0.06, top - 0.06], mid = (band[0] + band[1]) / 2, half = (band[1] - band[0]) / 2 * 0.7 * (1 - 0.4 * d);
      const rate = 1 / (1.4 - 0.2 * d);
      if (window.__xpTest) window.__xpTest.ideal = { hold: mid / rate };
      let h = 0, relH = null;
      game = {
        release: t => { relH = h; finish(clamp(1 - Math.abs(h - mid) / (half * 2.4), 0, 1), h < mid, ['TOO LOW', 'TOO HIGH']); },
        draw: t => {
          bg();
          if (held && !done) h = Math.min(1, (t - pressAt) * rate);
          if (held && !done && h >= 1) { held = false; game.release(t); }
          const gy = H - 26, Y = v => gy - v * (H - 50), hv = relH != null ? relH : h;
          g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 2; g.beginPath(); g.moveTo(16, gy); g.lineTo(W - 16, gy); g.stroke();
          g.fillStyle = 'rgba(124,255,178,0.1)'; g.fillRect(16, Y(mid + half), W - 32, Y(mid - half) - Y(mid + half));
          g.setLineDash([6, 5]); g.lineWidth = 2;
          g.strokeStyle = 'rgba(255,107,107,0.75)'; g.beginPath(); g.moveTo(16, Y(reach)); g.lineTo(W - 16, Y(reach)); g.stroke();
          g.strokeStyle = 'rgba(255,183,77,0.75)'; g.beginPath(); g.moveTo(16, Y(top)); g.lineTo(W - 16, Y(top)); g.stroke(); g.setLineDash([]);
          g.font = '700 11px system-ui'; g.textAlign = 'left'; g.fillStyle = 'rgba(255,107,107,0.9)'; g.fillText('THEIR REACH', 20, Y(reach) - 5);
          g.fillStyle = 'rgba(255,183,77,0.9)'; g.fillText('BASELINE', 20, Y(top) - 5);
          // the opponent's silhouette with racket up
          const ox = W * 0.72; g.fillStyle = 'rgba(255,138,80,0.35)'; roundRect(g, ox - 8, gy - 52, 16, 52, 6); g.fill(); g.beginPath(); g.arc(ox, gy - 60, 8, 0, 7); g.fill();
          g.strokeStyle = 'rgba(255,138,80,0.5)'; g.lineWidth = 4; g.beginPath(); g.moveTo(ox + 6, gy - 46); g.lineTo(ox + 10, Y(reach) + 6); g.stroke();
          // the arc you're lifting, and the ball riding it once you let go
          g.setLineDash([3, 5]); g.strokeStyle = 'rgba(230,255,90,0.7)'; g.lineWidth = 2; g.beginPath();
          for (let i = 0; i <= 40; i++) { const u = i / 40, x = 60 + (W - 90) * u, y = gy - 18 - (Y(0) - Y(hv)) * 4 * u * (1 - u); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.setLineDash([]);
          racketPro(g, 46, gy - 30, -Math.PI / 2 + 0.2 - hv * 1.2, 20, paint, 0.6);
          const u = relH != null ? clamp((t - (done ? done.at : t)) / 0.9, 0, 1) : 0, bx = 60 + (W - 90) * u, byy = gy - 18 - (Y(0) - Y(hv)) * 4 * u * (1 - u);
          ballPro(g, bx, byy, 8, t * 3);
          if (!done && pressAt == null && t > 2.2) finish(0.1, true, ['TOO LOW', 'LATE']);
        },
      };
    }
    const tick = () => {
      if (!alive) return;
      const t = now(); game.draw(t);
      if (done) { // the grade, big, then on with the shot
        const a = clamp((t - done.at) / 0.15, 0, 1), sc = 1 + (1 - a) * 0.4;
        g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `italic 900 ${Math.round(34 * sc)}px system-ui`;
        g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeText(done.label, W / 2, 34); g.fillStyle = done.col; g.fillText(done.label, W / 2, 34); g.restore();
        if (t - done.at > 0.75) { alive = false; cleanup(); return res({ q: done.q, early: done.early, label: done.label, type, spin: done.spin, flight: done.flight, load: done.load, bad: done.q === 0 && type === 'serve' }); }
      }
      requestAnimationFrame(tick);
    };
    const cleanup = () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); ov.removeEventListener('pointerdown', pd); ov.removeEventListener('pointerup', pu); ov.removeEventListener('pointercancel', pu); el.hidden = true; };
    U.godReq = gq => { if (!alive) return; alive = false; cleanup(); res({ god: gq }); };
    requestAnimationFrame(tick);
  });

  // What a timed toss does to the serve (read once by cbServe in cbsim.js).
  // What a timed toss does to the serve (read once by cbServe in cbsim.js). Everything scales smoothly with how far off
  // you were: nearly perfect lands where you aimed, a little off lands a little off (early long, late short), way off faults.
  window.xpServeEffect = (R, spin) => {
    const q = R.q, m = 1 - q, sgn = R.early ? 1 : -1;
    if (R.bad) return { fault: 99, sd: 1.5, pace: -6, dy: sgn * 0.6, dx: 0, miss: R.early ? 'long' : 'net' }; // bad toss and mistimed: a sure fault
    // A well-timed serve rarely faults, and when it does it just misses long or wide, never into the net.
    // A big serve stays a gamble even when timed well: flat keeps more of its fault chance than kick.
    const floor = { flat: 0.6, slice: 0.5, kick: 0.38 }[spin] || 0.5;
    return { fault: q > 0 ? floor + 2.0 * m * m + 0.6 * m : 2.2, sd: 0.45 + 1.05 * m, pace: spin === 'flat' ? 9 * q - 6 * m : 2 * q - 6 * m,
      dy: sgn * 0.55 * m, dx: R.early ? 0.25 * m : -0.25 * m, miss: q < 0.6 ? (R.early ? 'long' : 'net') : 'long' };
  };
  // What a result does to the shot (read once by cbHit in cbsim.js), scaling smoothly with how far off you were.
  // Early: the ball flies on further and wider. Late: it comes up short and back towards the middle. Each shot adds its own.
  window.xpTouchEffect = (type, R) => {
    // net: a clean hit all but removes the shot's own chance of clipping the net; the further off, the bigger it gets.
    const q = R.q, m = 1 - q, e = { sig: 0.5 + 1.1 * m, dx: R.early ? 0.9 * m : -0.6 * m, dy: R.early ? 1.0 * m : -1.0 * m, net: 0.12 + 1.3 * m };
    if (type === 'drop') { if (R.early) e.dy = 1.6 * m; else { e.dy = -0.6 * m; e.net *= 1 + 2.5 * m; } }
    if (type === 'flat') { e.pace = 0.95 + 0.13 * q; if (!R.early) e.net *= 1 + 1.5 * m; }
    if (type === 'topspin' && !R.early) e.net *= 1 + 1.2 * m;
    if (type === 'slice' && !R.early) e.net *= 1 + 1.5 * m;
    if (type === 'lob') { e.dy = R.early ? -2.5 * m : 1.8 * m; e.dx *= 0.5; }
    if (R.spin != null) e.dy += (0.5 - R.spin) * 1.6 * (R.early ? 1 : 0.6); // topspin: too little spin flies long, too much dips short
    if (R.flight === 'net') e.net = Math.max(e.net, 8); // what you saw is what happens: into the net
    if (R.flight === 'long') e.dy = Math.max(e.dy, 2.2);
    if (R.flight === 'in') e.keepIn = true;
    // The second meter means something different for each shot (lq: how close to its sweet spot).
    const lq = R.load == null ? 0 : Math.max(0, 1 - Math.abs(R.load - 0.62) / 0.45);
    if (type === 'flat' && R.load != null) e.pace = 0.92 + 0.2 * Math.min(1.1, R.load) * (0.5 + 0.5 * q); // more power: quicker, still returnable
    if (type === 'slice') { e.sig *= 1.2 - 0.45 * lq; e.press = 0.06 * lq; } // a clean cut floats true and stays low
    if (type === 'topspin') e.press = 0.14 * lq * q; // a heavy, high-kicking ball
    if (type === 'drop') e.slackCut = 0.55 * q * q; // a perfect touch dies before they get there
    if (type === 'lob') e.slackCut = 0.75 * q * q; // a perfect lob drops in over their head // it went in on the timing game, so it goes in on court
    return e;
  };
})();
