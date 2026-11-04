// cblook.js — player looks (skin tone, kit, racket) and the Pro Shop. Built for TourLife Extreme first; the body
// drawing (XL.drawBody) is written to be reused by the main TourLife court later. Cosmetic only: nothing here
// changes how anyone plays. Looks live on the player (player.look); bought items on the career (career.wardrobe).
const XL = (() => {
  const SKINS = ['#f7dcc8', '#efc6a6', '#e0ac85', '#c99164', '#ad7448', '#8d5a36', '#6e4428', '#4b2e1c'];
  const RARITY = { common: ['Common', '#9aa5b1'], rare: ['Rare', '#4fa3ff'], epic: ['Epic', '#b46cff'], legendary: ['Legendary', '#ffc940'] };
  const CATS = [['skin', 'Skin'], ['shirt', 'Shirts'], ['shorts', 'Shorts'], ['shoes', 'Shoes'], ['band', 'Headbands'], ['hat', 'Hats'], ['racket', 'Rackets'], ['wrist', 'Wristbands']];
  const GOLD = ['#8a6a12', '#f7e27a', '#c9a227', '#fff5c0', '#b8860b'];
  // [id, name, rarity, price, paint, extra]. Paint: '#hex', { g: [colours] } a fade, 'gold', { split }, { hoops }, { stars }.
  const ITEMS = {
    shirt: [['s_sky', 'Sky Blue', 'common', 0, '#2196f3'], ['s_white', 'Classic White', 'common', 0, '#f2f2f2'], ['s_navy', 'Navy', 'common', 0, '#1a2a4f'],
      ['s_red', 'Red', 'common', 400, '#d32f2f'], ['s_green', 'Forest Green', 'common', 400, '#2e7d32'], ['s_black', 'Black', 'common', 600, '#1b1b1b'],
      ['s_split', 'Two-Tone Split', 'rare', 4000, { split: ['#1e88e5', '#ffffff'] }], ['s_hoops', 'Club Hoops', 'rare', 5000, { hoops: ['#c62828', '#ffffff'] }],
      ['s_sunset', 'Sunset Fade', 'epic', 40000, { g: ['#ff9800', '#e91e63'] }], ['s_ocean', 'Ocean Fade', 'epic', 40000, { g: ['#00bcd4', '#0d47a1'] }],
      ['s_neon', 'Neon Fade', 'epic', 55000, { g: ['#76ff03', '#00e5ff'] }], ['s_gold', 'Gold Rush', 'legendary', 300000, 'gold'], ['s_galaxy', 'Galaxy', 'legendary', 400000, { stars: ['#311b92', '#05030f'] }]],
    shorts: [['sh_navy', 'Navy', 'common', 0, '#1c2733'], ['sh_white', 'White', 'common', 0, '#eeeeee'], ['sh_grey', 'Grey', 'common', 300, '#78909c'], ['sh_red', 'Red', 'common', 300, '#c62828'],
      ['sh_char', 'Charcoal Fade', 'rare', 3000, { g: ['#263238', '#607d8b'] }], ['sh_royal', 'Royal Fade', 'epic', 25000, { g: ['#1a237e', '#7b1fa2'] }], ['sh_gold', 'Gold Shorts', 'legendary', 200000, 'gold']],
    shoes: [['sho_white', 'White', 'common', 0, '#f5f5f5'], ['sho_black', 'Black', 'common', 0, '#212121'], ['sho_red', 'Red', 'common', 500, '#e53935'],
      ['sho_neon', 'Neon Yellow', 'rare', 1500, '#d4ff00'], ['sho_fade', 'Fade Runners', 'epic', 30000, { g: ['#ff4081', '#7c4dff'] }], ['sho_gold', 'Gold Shoes', 'legendary', 250000, 'gold']],
    band: [['b_none', 'None', 'common', 0, null], ['b_white', 'White', 'common', 0, '#ffffff'], ['b_black', 'Black', 'common', 200, '#111111'], ['b_red', 'Red', 'common', 200, '#e53935'],
      ['b_blue', 'Blue', 'common', 200, '#1e88e5'], ['b_split', 'Two-Tone', 'rare', 2000, { split: ['#ffffff', '#1e88e5'] }],
      ['b_rainbow', 'Rainbow', 'epic', 20000, { g: ['#f44336', '#ffeb3b', '#4caf50', '#2196f3', '#9c27b0'] }], ['b_gold', 'Gold Band', 'legendary', 150000, 'gold']],
    hat: [['h_none', 'None', 'common', 0, null], ['h_white', 'White Cap', 'common', 600, '#f5f5f5', 'cap'], ['h_navy', 'Navy Cap', 'common', 600, '#1a2a4f', 'cap'],
      ['h_back', 'Backwards Cap', 'rare', 4000, '#212121', 'back'], ['h_visor', 'White Visor', 'rare', 3500, '#ffffff', 'visor'],
      ['h_fade', 'Fade Visor', 'epic', 30000, { g: ['#00e5ff', '#ff4081'] }, 'visor'], ['h_gold', 'Champion Cap', 'legendary', 250000, 'gold', 'cap']],
    racket: [['r_black', 'Classic Black', 'common', 0, '#222222'], ['r_white', 'White Frame', 'common', 0, '#eeeeee'], ['r_red', 'Red Frame', 'common', 500, '#d32f2f'],
      ['r_blue', 'Blue Frame', 'common', 500, '#1e88e5'], ['r_carbon', 'Carbon Two-Tone', 'rare', 6000, { split: ['#111111', '#00bcd4'] }],
      ['r_fade', 'Fade Frame', 'epic', 45000, { g: ['#ff6d00', '#d500f9'] }], ['r_gold', 'Golden Racket', 'legendary', 1000000, 'gold']],
    wrist: [['w_none', 'None', 'common', 0, null], ['w_white', 'White', 'common', 0, '#ffffff'], ['w_black', 'Black', 'common', 150, '#111111'], ['w_red', 'Red', 'common', 150, '#e53935'],
      ['w_split', 'Double Bands', 'rare', 1500, { split: ['#ffffff', '#1e88e5'] }], ['w_fade', 'Fade Bands', 'epic', 15000, { g: ['#00e676', '#2979ff'] }], ['w_gold', 'Gold Bands', 'legendary', 120000, 'gold']],
  };
  const ALL = {};
  for (const [cat, list] of Object.entries(ITEMS)) for (const [id, name, rarity, price, paint, kind] of list) ALL[id] = { id, cat, name, rarity, price, paint, kind };
  const DEFAULT = { skin: 2, shirt: 's_sky', shorts: 'sh_navy', shoes: 'sho_white', band: 'b_white', hat: 'h_none', racket: 'r_black', wrist: 'w_none' };
  const look = l => ({ ...DEFAULT, ...(l || {}) });
  // A look ready to draw: colours and paints for every part.
  function resolve(l) {
    const L = look(l), it = k => ALL[L[k]] || ALL[DEFAULT[k]];
    return { skin: SKINS[L.skin] || SKINS[2], shirt: it('shirt').paint, shorts: it('shorts').paint, shoes: it('shoes').paint, band: it('band').paint,
      hat: it('hat').paint ? { paint: it('hat').paint, kind: it('hat').kind } : null, racket: it('racket').paint, wrist: it('wrist').paint };
  }
  // Opponents get a look of their own, the same every time for the same name (mostly everyday kit, now and then something rare).
  function randomFor(name) {
    let h = 2166136261; for (const ch of String(name || '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const r = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
    const pickFrom = cat => { const list = ITEMS[cat].filter(x => x[2] === 'common' || (x[2] === 'rare' && r() < 0.25)); return list[Math.floor(r() * list.length)][0]; };
    const l = { skin: Math.floor(r() * SKINS.length) };
    for (const cat of Object.keys(ITEMS)) l[cat] = pickFrom(cat);
    if (l.hat !== 'h_none' && r() < 0.6) l.hat = 'h_none';
    return resolve(l);
  }
  // A canvas paint across the box (x0,y0)-(x1,y1).
  function fill(g, paint, x0, y0, x1, y1) {
    if (!paint) return 'transparent';
    if (typeof paint === 'string' && paint !== 'gold') return paint;
    const stops = paint === 'gold' ? GOLD : paint.g || paint.stars || paint.split || paint.hoops;
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((c, i) => gr.addColorStop(i / Math.max(1, stops.length - 1), c));
    return gr;
  }
  // The same paint as a CSS background (shop swatches).
  function css(paint) {
    if (!paint) return 'repeating-linear-gradient(45deg,#2a3642 0 6px,#1e2b38 6px 12px)';
    if (paint === 'gold') return `linear-gradient(135deg,${GOLD.join(',')})`;
    if (typeof paint === 'string') return paint;
    if (paint.split) return `linear-gradient(90deg,${paint.split[0]} 50%,${paint.split[1]} 50%)`;
    if (paint.hoops) return `repeating-linear-gradient(0deg,${paint.hoops[0]} 0 7px,${paint.hoops[1]} 7px 14px)`;
    if (paint.stars) return `radial-gradient(circle at 30% 30%,#fff 1px,transparent 2px),radial-gradient(circle at 70% 60%,#fff 1px,transparent 2px),linear-gradient(135deg,${paint.stars.join(',')})`;
    return `linear-gradient(135deg,${paint.g.join(',')})`;
  }
  // Draws a body. P(dx, z) maps metres (across, up) from the feet to the screen; s = pixels per metre.
  // o: { side (0 = seen from behind), sw (stride), hand: [hx, hz, rx, rz] racket hand and head, hd (racket-hand side), twoHands, look (resolved) }
  function drawBody(g, P, s, o) {
    const L = o.look || resolve(), sw = o.sw || 0, [hx, hz, rx, rz] = o.hand, hd = o.hd;
    const legs = [[-0.12, -0.16 + sw], [0.12, 0.16 - sw]];
    g.lineCap = 'round';
    g.strokeStyle = L.skin; g.lineWidth = Math.max(2, 0.12 * s);
    for (const [lx, fx] of legs) { g.beginPath(); g.moveTo(...P(lx, 0.9)); g.lineTo(...P(fx, 0.08)); g.stroke(); }
    for (const [, fx] of legs) { const [a, b] = P(fx, 0.05); g.fillStyle = fill(g, L.shoes, a - 0.1 * s, b, a + 0.1 * s, b); g.beginPath(); g.ellipse(a, b, 0.1 * s, 0.05 * s, 0, 0, 7); g.fill(); }
    const [sx0, sy0] = P(-0.25, 0.98), [sx1, sy1] = P(0.25, 0.62);
    g.strokeStyle = fill(g, L.shorts, sx0, sy0, sx1, sy1); g.lineWidth = Math.max(3, 0.17 * s);
    for (const [lx, fx] of legs) { g.beginPath(); g.moveTo(...P(lx, 0.98)); g.lineTo(...P(lx + (fx - lx) * 0.35, 0.62)); g.stroke(); }
    // Shirt: broad shoulders tapering to the waist.
    const [tx0, ty0] = P(-0.29, 1.5), [tx1, ty1] = P(0.29, 0.95);
    g.save(); g.beginPath(); g.moveTo(...P(-0.29, 1.5)); g.lineTo(...P(0.29, 1.5)); g.lineTo(...P(0.2, 0.95)); g.lineTo(...P(-0.2, 0.95)); g.closePath(); g.clip();
    const sh = L.shirt, pat = sh && typeof sh === 'object' ? sh : {}; // plain colours are strings (and strings have a .split method)
    if (pat.split) { g.fillStyle = sh.split[0]; g.fillRect(tx0, ty0, (tx1 - tx0) / 2, ty1 - ty0); g.fillStyle = sh.split[1]; g.fillRect((tx0 + tx1) / 2, ty0, (tx1 - tx0) / 2, ty1 - ty0); }
    else if (pat.hoops) { const h = (ty1 - ty0) / 6; for (let i = 0; i < 6; i++) { g.fillStyle = sh.hoops[i % 2]; g.fillRect(tx0, ty0 + i * h, tx1 - tx0, h + 0.5); } }
    else { g.fillStyle = fill(g, sh, tx0, ty0, tx1, ty1); g.fillRect(tx0, ty0, tx1 - tx0, ty1 - ty0); }
    if (pat.stars) { g.fillStyle = '#fff'; for (const [u, v] of [[0.2, 0.25], [0.7, 0.4], [0.45, 0.7], [0.85, 0.15], [0.3, 0.85]]) g.fillRect(tx0 + u * (tx1 - tx0), ty0 + v * (ty1 - ty0), Math.max(1, s * 0.02), Math.max(1, s * 0.02)); }
    if (sh === 'gold') { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(tx0 + (tx1 - tx0) * 0.15, ty0, (tx1 - tx0) * 0.08, ty1 - ty0); }
    g.restore();
    // Arms, wristbands and racket.
    // Arms: shoulder → elbow → hand. The elbow is found from the shoulder and hand (two-bone reach), bending down
    // and out the way a real elbow does; a hand too far away straightens the arm.
    const UPPER = 0.29, FORE = 0.27;
    const elbowOf = (x0, z0, x1, z1) => {
      const dx = x1 - x0, dz = z1 - z0, d = Math.hypot(dx, dz) || 1e-6;
      if (d >= UPPER + FORE - 0.005) return [x0 + dx * UPPER / (UPPER + FORE), z0 + dz * UPPER / (UPPER + FORE)];
      const a = Math.acos(Math.max(-1, Math.min(1, (UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d)))), base = Math.atan2(dz, dx);
      const c1 = [x0 + UPPER * Math.cos(base + a), z0 + UPPER * Math.sin(base + a)], c2 = [x0 + UPPER * Math.cos(base - a), z0 + UPPER * Math.sin(base - a)];
      if (z1 > z0 - 0.1) return c1[1] < c2[1] ? c1 : c2; // hand up high (a serve, a finish): the elbow sits below it
      const out = Math.sign(x0) || 1; return c1[0] * out > c2[0] * out ? c1 : c2; // otherwise elbows bend out, away from the body
    };
    const arm = (x0, z0, x1, z1) => {
      const [ex, ez] = elbowOf(x0, z0, x1, z1);
      g.strokeStyle = L.skin; g.lineCap = 'round';
      g.lineWidth = Math.max(2.5, 0.115 * s); g.beginPath(); g.moveTo(...P(x0, z0)); g.lineTo(...P(ex, ez)); g.stroke();
      g.lineWidth = Math.max(2, 0.095 * s); g.beginPath(); g.moveTo(...P(ex, ez)); g.lineTo(...P(x1, z1)); g.stroke();
      g.fillStyle = L.skin; g.beginPath(); g.arc(...P(x1, z1), Math.max(1.5, 0.05 * s), 0, 7); g.fill(); // the hand
      if (L.wrist) { // a thin band across the forearm just above the hand
        const [ax, ay] = P(ex + (x1 - ex) * 0.82, ez + (z1 - ez) * 0.82), [bx, by] = P(x1, z1), dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1;
        const nx = -dy / d * 0.07 * s, ny = dx / d * 0.07 * s;
        g.save(); g.lineCap = 'butt'; g.strokeStyle = fill(g, L.wrist, ax - nx, ay - ny, ax + nx, ay + ny); g.lineWidth = Math.max(1.5, 0.045 * s);
        g.beginPath(); g.moveTo(ax - nx, ay - ny); g.lineTo(ax + nx, ay + ny); g.stroke(); g.restore(); }
    };
    const shw = o.turn ? 0.15 : 0.26; // side-on in a swing, so the shoulders look narrower
    const off = o.twoHands ? [hx, hz] : o.turn ? [-hd * 0.3, 1.02] : [-hd * 0.31, 0.9];
    arm(hd * shw, 1.45, hx, hz);
    arm(-hd * shw, 1.45, off[0], off[1]);
    g.strokeStyle = '#333'; g.lineWidth = Math.max(1.5, 0.05 * s);
    g.beginPath(); g.moveTo(...P(hx, hz)); g.lineTo(...P(hx + (rx - hx) * 0.45, hz + (rz - hz) * 0.45)); g.stroke();
    const [cx, cy] = P(hx + (rx - hx) * 0.75, hz + (rz - hz) * 0.75);
    g.strokeStyle = fill(g, L.racket, cx - 0.15 * s, cy - 0.17 * s, cx + 0.15 * s, cy + 0.17 * s); g.lineWidth = Math.max(2, 0.06 * s);
    g.beginPath(); g.ellipse(cx, cy, 0.14 * s, 0.17 * s, Math.atan2(-(rz - hz), rx - hx) + Math.PI / 2, 0, 7); g.stroke();
    if (L.racket === 'gold') { g.fillStyle = 'rgba(255,250,210,0.9)'; g.beginPath(); g.arc(cx + 0.09 * s, cy - 0.12 * s, Math.max(1.2, 0.03 * s), 0, 7); g.fill(); }
    // Neck, head, hair, then a hat or a headband.
    g.fillStyle = L.skin; g.fillRect(P(-0.05, 1.58)[0], P(0, 1.58)[1], 0.1 * s, 0.1 * s);
    g.beginPath(); g.arc(...P(0, 1.7), 0.12 * s, 0, 7); g.fill();
    const hat = L.hat, dome = hat && hat.kind !== 'visor';
    if (!dome) { g.fillStyle = '#2b1f16'; if (o.side === 0) { g.beginPath(); g.arc(...P(0, 1.72), 0.125 * s, 0, 7); g.fill(); } else { g.beginPath(); g.arc(...P(0, 1.74), 0.125 * s, Math.PI * 1.05, Math.PI * 1.95); g.fill(); } }
    if (hat) {
      const [ax, ay] = P(-0.14, 1.9), [bx, by] = P(0.14, 1.7), paint = fill(g, hat.paint, ax, ay, bx, by);
      if (dome) { g.fillStyle = paint; g.beginPath(); g.arc(...P(0, 1.74), 0.135 * s, Math.PI, 2 * Math.PI); g.fill(); g.fillRect(P(-0.135, 1.76)[0], P(0, 1.76)[1], 0.27 * s, 0.03 * s); }
      else { g.fillStyle = paint; g.fillRect(P(-0.13, 1.79)[0], P(0, 1.79)[1], 0.26 * s, Math.max(2, 0.05 * s)); }
      if ((o.side === 1) !== (hat.kind === 'back')) { g.fillStyle = paint; g.beginPath(); g.ellipse(...P(0, 1.73), 0.13 * s, 0.045 * s, 0, 0, Math.PI); g.fill(); } // the peak, when it faces the camera
    } else if (L.band) {
      const [a, b] = P(-0.12, 1.77); g.fillStyle = fill(g, L.band, a, b, a + 0.24 * s, b); g.fillRect(a, b, 0.24 * s, Math.max(1.5, 0.04 * s));
    }
  }
  // Two still figures, front and back, for the creator and the shop.
  function preview(canvas, l, only = null) {
    const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (!r.width) return;
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
    const s = only === null ? Math.min(r.height / 2.35, r.width / 2.2) : Math.min(r.height / 2.25, r.width / 1.15), L = resolve(l);
    for (const [side, fx] of only === null ? [[1, 0.28], [0, 0.72]] : [[only, 0.5]]) {
      const X = r.width * fx, Y = r.height - 10, P = (dx, z) => [X + dx * s, Y - z * s], hd = side === 0 ? 1 : -1;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(X, Y, 0.4 * s, 0.1 * s, 0, 0, 7); g.fill();
      drawBody(g, P, s, { side, sw: 0, hand: REST(hd), hd, twoHands: false, look: L });
      if (only === null) { g.fillStyle = '#9fb3c8'; g.font = '600 12px system-ui'; g.textAlign = 'center'; g.fillText(side ? 'Front' : 'Back', X, 14); }
    }
  }
  const REST = hd => [hd * 0.31, 0.9, hd * 0.37, 0.27]; // hand by the side, racket head down by the shin
  const owned = c => new Set([...Object.values(ALL).filter(x => !x.price).map(x => x.id), ...((c && c.wardrobe) || [])]);
  return { REST, SKINS, RARITY, CATS, ITEMS, ALL, DEFAULT, look, resolve, randomFor, fill, css, drawBody, preview, owned };
})();

// --- The Pro Shop and the creator's look picker (Extreme for now) -------------------------------------------------
(() => {
  if (typeof isExtreme !== 'function' || !isExtreme()) return;
  const R_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 };
  // The shop: try anything on, buy with prize money, equip what you own. Skin tone is free to change.
  function proShop(cat0 = 'shirt') {
    const p = current.player, c = current.career;
    if (!p || !c) return;
    let cat = cat0, tryOn = null;
    const render = () => {
      const have = XL.owned(c), cur = XL.look(p.look), show = tryOn ? { ...cur, [tryOn.cat]: tryOn.id } : cur;
      const items = cat === 'skin' ? [] : Object.values(XL.ALL).filter(x => x.cat === cat).sort((a, b) => R_ORDER[a.rarity] - R_ORDER[b.rarity] || a.price - b.price);
      const sel = tryOn && tryOn.cat === cat ? tryOn : null;
      const act = !sel ? '' : cur[cat] === sel.id ? '<button type="button" class="btn" disabled>Equipped</button>'
        : have.has(sel.id) ? `<button type="button" class="btn" data-sh="equip">Equip ${esc(sel.name)}</button>`
        : c.money >= sel.price ? `<button type="button" class="btn" data-sh="buy">Buy For ${money(sel.price)}</button>`
        : `<button type="button" class="btn" disabled>Need ${money(sel.price - c.money)} More</button>`;
      openModal(`<button type="button" class="x" data-sh="close" aria-label="Close">×</button><div class="xlshop">` +
        `<div class="xlside"><h2 class="itop">👕 Pro Shop</h2><div class="xlmoney">${money(c.money)}</div><canvas class="xlprev" id="xlPrev"></canvas>` +
        (sel ? `<div class="xlsel"><b>${esc(sel.name)}</b><span style="color:${XL.RARITY[sel.rarity][1]}">${XL.RARITY[sel.rarity][0]}</span>${act}</div>` : '<p class="hint center">Tap anything to try it on.</p>') + `</div>` +
        `<div class="xlmain"><div class="xltabs">${XL.CATS.map(([k, l]) => `<button type="button" data-cat="${k}" class="${k === cat ? 'on' : ''}">${l}</button>`).join('')}</div>` +
        (cat === 'skin' ? `<p class="hint">Skin tone is free to change at any time.</p><div class="xlskins">${XL.SKINS.map((h, i) => `<button type="button" data-skin="${i}" class="${cur.skin === i ? 'on' : ''}" style="background:${h}" aria-label="Skin tone ${i + 1}"></button>`).join('')}</div>`
          : `<div class="xlgrid">${items.map(x => { const own = have.has(x.id), eq = cur[cat] === x.id, [rn, rc] = XL.RARITY[x.rarity];
            return `<button type="button" class="xlitem r-${x.rarity}${sel && sel.id === x.id ? ' sel' : ''}" data-item="${x.id}" style="--rc:${rc}"><i style="background:${XL.css(x.paint)}"></i>` +
              `<b>${esc(x.name)}</b><small style="color:${rc}">${rn}</small><em>${eq ? '✓ Equipped' : own ? 'Owned' : money(x.price)}</em></button>`; }).join('')}</div>`) +
        `</div></div>`, { wide: true, onClose: () => { if (typeof renderTournaments === 'function') renderTournaments(current.player); } });
      setTimeout(() => { const cv = document.getElementById('xlPrev'); if (cv) XL.preview(cv, show); }, 0);
      document.getElementById('sheet').onclick = ev => {
        const b = ev.target.closest('[data-sh],[data-cat],[data-item],[data-skin]'); if (!b) return;
        if (b.dataset.cat) { cat = b.dataset.cat; tryOn = null; }
        else if (b.dataset.skin) { p.look = { ...XL.look(p.look), skin: +b.dataset.skin }; writeJSON(SAVE_KEY, p); }
        else if (b.dataset.item) tryOn = XL.ALL[b.dataset.item];
        else if (b.dataset.sh === 'close') return closeModal();
        else if (b.dataset.sh === 'buy' && tryOn && c.money >= tryOn.price && !XL.owned(c).has(tryOn.id)) {
          charge(c, tryOn.price, `Pro Shop: ${tryOn.name}`);
          c.wardrobe = [...(c.wardrobe || []), tryOn.id]; writeJSON(CAREER_KEY, c);
          p.look = { ...XL.look(p.look), [tryOn.cat]: tryOn.id }; writeJSON(SAVE_KEY, p);
          if (typeof toast === 'function') toast('👕 Pro Shop', `${tryOn.name} is yours.`);
        } else if (b.dataset.sh === 'equip' && tryOn && XL.owned(c).has(tryOn.id)) { p.look = { ...XL.look(p.look), [tryOn.cat]: tryOn.id }; writeJSON(SAVE_KEY, p); }
        render();
      };
    };
    render();
  }
  window.xlShop = proShop;

  // Home: your avatar where the overall used to be (tap to turn around), with the Pro Shop under it. The OVR moves right.
  let facing = 1;
  function homeCard() {
    const top = document.querySelector('#hOvr .ovrtop'); if (!top || !current.player) return;
    ['xlHead', 'xlHome'].forEach(id => { const o = document.getElementById(id); if (o) o.remove(); });
    let av = top.querySelector('.xlavatar');
    if (!av) {
      top.insertAdjacentHTML('afterbegin', '<div class="xlavatar"><button type="button" class="xlturn" title="Tap to turn around" aria-label="Your player: tap to turn around"><canvas></canvas></button><button type="button" class="link xlshopbtn">👕 Pro Shop</button></div>');
      av = top.querySelector('.xlavatar');
      av.querySelector('.xlturn').onclick = () => { facing = 1 - facing; XL.preview(av.querySelector('canvas'), current.player.look, facing); };
      av.querySelector('.xlshopbtn').onclick = () => proShop();
    }
    setTimeout(() => XL.preview(av.querySelector('canvas'), current.player.look, facing), 0);
  }
  // The top card is redrawn by the main game whenever Home refreshes, so put the avatar back each time.
  window.addEventListener('load', () => { const h = document.getElementById('hOvr'); if (h) new MutationObserver(() => { if (!h.querySelector('.xlavatar')) homeCard(); }).observe(h, { childList: true }); });
  if (typeof cbHome === 'function') { const _h = cbHome; cbHome = function (...a) { const r = _h.apply(this, a); try { homeCard(); } catch (e) { console.error(e); } return r; }; }

  // Creating an Extreme player: pick a skin tone and a starting kit (the free items).
  function creatorCard() {
    const cr = document.getElementById('creator'); if (!cr || document.getElementById('xlCreate')) return;
    const id = cr.querySelectorAll('section.card')[1]; if (!id) return; // after Identity
    id.insertAdjacentHTML('afterend', '<section class="card" id="xlCreate"><h2>Your Look</h2><div class="xlhomerow"><canvas class="xlprev" id="xlCrPrev"></canvas><div id="xlCrPick"></div></div>' +
      '<p class="hint">More kit, rackets and colours are in the Pro Shop once your career starts.</p></section>');
    const draw = () => {
      const L = XL.look(state.look), free = cat => Object.values(XL.ALL).filter(x => x.cat === cat && !x.price);
      const row = (cat, label) => `<h3 class="ssec left">${label}</h3><div class="xlswatches">${free(cat).map(x => `<button type="button" data-c="${cat}" data-v="${x.id}" class="${L[cat] === x.id ? 'on' : ''}" style="background:${XL.css(x.paint)}" title="${esc(x.name)}" aria-label="${esc(x.name)}"></button>`).join('')}</div>`;
      document.getElementById('xlCrPick').innerHTML = `<h3 class="ssec left">Skin Tone</h3><div class="xlswatches">${XL.SKINS.map((h, i) => `<button type="button" data-c="skin" data-v="${i}" class="${L.skin === i ? 'on' : ''}" style="background:${h}" aria-label="Skin tone ${i + 1}"></button>`).join('')}</div>` +
        row('shirt', 'Shirt') + row('shorts', 'Shorts') + row('racket', 'Racket');
      XL.preview(document.getElementById('xlCrPrev'), L);
    };
    document.getElementById('xlCrPick').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; state.look = { ...XL.look(state.look), [b.dataset.c]: b.dataset.c === 'skin' ? +b.dataset.v : b.dataset.v }; draw(); };
    setTimeout(draw, 0);
  }
  window.addEventListener('load', () => setTimeout(creatorCard, 0));
})();
