// orders.js — match orders for real tournaments. Players can't be online while the admin streams their
// matches, so they decide ahead of time: a full game plan for each family of opponent, and what to do
// if they lose a set. The orders travel inside the player file; the admin's screen shows them.

const FAMILIES = [
  { id: 'serve', name: 'Big Servers', styles: ['Serve-Dominant', 'Serve +1 Attacker'] },
  { id: 'attack', name: 'Baseline Attackers', styles: ['First-Strike Attacker', 'Aggressive Baseliner', 'Flat Attacker', 'Heavy-Topspin Attacker'] },
  { id: 'grind', name: 'Grinders', styles: ['Solid Baseliner', 'Counterpuncher', 'Defensive Grinder', 'Heavy-Topspin Baseliner'] },
  { id: 'net', name: 'Net Rushers', styles: ['Net Attacker', 'Serve-and-Volley'] },
  { id: 'craft', name: 'Crafty All-Courters', styles: ['All-Court', 'Variety / Slice-Heavy', 'Creative Shotmaker'] },
];
const LOSING = { stick: 'Keep My Plan', switch: 'Change It Up' };
// orders = { plans: { serve: {...plan}, attack: {...}, ... }, losing }. A family with no plan uses your normal plan.
const ordersOf = p => ({ plans: {}, losing: 'stick', ...(p && p.orders) });
const familyOf = p => FAMILIES.find(f => f.styles.includes(styleOf(p).name)) || FAMILIES[4];

// Applied when the admin starts a match (into the match snapshot, so replays match).
function applyOrders(me, opp) {
  if (!me.orders) return;
  const o = ordersOf(me), fam = familyOf(opp);
  me.plan = { ...planOf(me), ...(o.plans[fam.id] || {}) };
  me.ordersNote = `vs ${fam.name}: ${planSummary({ ...DEFAULT_PLAN, ...me.plan })} · Losing a set: ${LOSING[o.losing] || LOSING.stick}`;
}
// After losing a set (called by the engine): "Change It Up" flips the rally plan, once per match.
function ordersAfterSetLost(m, ps, loser) {
  const p = ps[loser];
  if (!p.real || !p.orders || ordersOf(p).losing !== 'switch' || p.switched) return; // admin events only
  const pl = planOf(p), agg = pl.aggression === 'aggressive' ? 'patient' : 'aggressive';
  p.plan = { ...pl, aggression: agg, net: agg === 'aggressive' ? 'often' : 'rarely' };
  p.switched = true;
  m.moments.push({ set: m.sets.length + 1, who: loser, kind: 'orders', label: `changes it up: now ${agg === 'aggressive' ? 'attacking and coming forward' : 'playing patient from the back'}` });
}

// The player's side: a full game plan for each family of opponent, plus what to do after losing a set.
function openOrders(back) {
  const p = readJSON(SAVE_KEY), o = ordersOf(p);
  const save = () => { const pl = readJSON(SAVE_KEY); pl.orders = o; writeJSON(SAVE_KEY, pl); };
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button><h2 class="itop">📋 My Match Orders</h2>` +
    `<p class="big">You won't be there when your matches are played, so set your game plan for each type of opponent. Tap one to open it.</p>` +
    FAMILIES.map(f => `<details class="ordfam"><summary><b>Against ${f.name}</b><small id="ordSum-${f.id}"></small></summary>` +
      `<p class="hint">${f.styles.join(', ')}</p><div class="plan" id="ordPlan-${f.id}"></div></details>`).join('') +
    `<h3 class="ordq">If I lose a set, I…</h3><div class="seg ordseg" style="grid-template-columns:1fr 1fr" id="ordLosing">` +
    Object.entries(LOSING).map(([v, l]) => `<button type="button" data-v="${v}" class="${o.losing === v ? 'on' : ''}">${l}</button>`).join('') + `</div>` +
    `<p class="hint center">Change It Up switches between attacking and patient play, once per match.</p>` +
    `<p class="hint center">Saved as you tap. Send your player again so the tournament gets your new orders.</p>` +
    `<button type="button" class="btn huge" id="ordDone">Done</button>`);
  for (const f of FAMILIES) {
    const plan = o.plans[f.id] = { ...DEFAULT_PLAN, ...planOf(p), ...(o.plans[f.id] || {}) };
    const sum = () => { $(`ordSum-${f.id}`).textContent = planSummary(plan); };
    planEditor($(`ordPlan-${f.id}`), plan, () => { sum(); save(); });
    sum();
  }
  save();
  const close = () => { closeModal(); if (back) back(); };
  $('mx').onclick = close; $('ordDone').onclick = close;
  $('ordLosing').onclick = e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    o.losing = b.dataset.v; save();
    $('ordLosing').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  };
}
